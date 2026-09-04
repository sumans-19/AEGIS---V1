import time
import logging
import numpy as np
import cv2
from typing import List

from core.hardware.interfaces import Frame
from core.perception.interfaces import (
    Detection,
    BoundingBox,
)
from core.perception.config import perception_config

logger = logging.getLogger("yolo_adapter")


class YOLOBackend:
    """Abstract wrapper to prevent direct ultralytics dependency everywhere."""

    def __init__(self, model_path: str, device: str):
        try:
            from ultralytics import YOLO

            # This loads the model from the local path. It will fail if model doesn't exist locally.
            self.model = YOLO(model_path)
            self.device = device
            self.model_name = model_path
            self.model_version = "v8"  # simplified
        except ImportError:
            logger.error(
                "ultralytics package not installed. YOLO Perception will fail."
            )
            self.model = None

    def predict(self, image: np.ndarray, conf: float, iou: float, classes: List[int]):
        if not self.model:
            return []
        # Ultralytics prediction without auto-download (assuming model_path is local)
        try:
            results = self.model.predict(
                source=image,
                conf=conf,
                iou=iou,
                classes=classes,
                device=self.device,
                verbose=False,
            )
            return results
        except Exception as e:
            logger.error(f"Inference failed: {e}")
            return []


class YOLOPerceptionAdapter:
    """
    Non-blocking Perception Engine.
    Reads from a CameraInterface, drops frames if the queue is full,
    processes via a background thread pool, and publishes DomainEvents.
    """

    def __init__(self, drone_id: str, camera: "CameraInterface", bus: "MessageBus"):
        self.drone_id = drone_id
        self.camera = camera
        self.bus = bus
        self.config = perception_config
        self.backend = YOLOBackend(
            self.config.PERCEPTION_MODEL_PATH, self.config.PERCEPTION_DEVICE
        )

        # Bounded queue to prevent memory explosion and latency lag
        self.queue_size = 3
        self.frame_queue = asyncio.Queue(maxsize=self.queue_size)

        self.is_running = False
        self._producer_task = None
        self._consumer_task = None

    def start(self):
        if not self.is_running:
            self.is_running = True
            self._producer_task = asyncio.create_task(self._frame_producer())
            self._consumer_task = asyncio.create_task(self._inference_consumer())
            logger.info(f"YOLOPerceptionAdapter started for drone {self.drone_id}")

    def stop(self):
        self.is_running = False
        if self._producer_task:
            self._producer_task.cancel()
        if self._consumer_task:
            self._consumer_task.cancel()
        logger.info(f"YOLOPerceptionAdapter stopped for drone {self.drone_id}")

    async def _frame_producer(self):
        """Reads frames from the camera and pushes to the bounded queue."""
        while self.is_running:
            try:
                frame = await self.camera.get_frame()
                if frame.status == "GOOD":
                    # If queue is full, we must drop the old frame to keep latency low
                    if self.frame_queue.full():
                        try:
                            self.frame_queue.get_nowait()
                            self.frame_queue.task_done()
                            logger.debug(
                                f"[{self.drone_id}] Perception queue full, dropping oldest frame."
                            )
                        except asyncio.QueueEmpty:
                            pass

                    await self.frame_queue.put(frame)

                # Target ~10 FPS for inference processing to save CPU
                await asyncio.sleep(0.1)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in frame producer: {e}")
                await asyncio.sleep(0.5)

    async def _inference_consumer(self):
        """Pulls frames from the queue and runs YOLO in a thread pool."""
        loop = asyncio.get_running_loop()
        while self.is_running:
            try:
                frame = await self.frame_queue.get()

                if self.backend.model:
                    # Run CPU/GPU bound inference in a separate thread
                    detections = await loop.run_in_executor(
                        None, self._process_frame_sync, frame
                    )

                    # Publish events to the MessageBus
                    if detections:
                        from core.domain.events import ObjectDetectedEvent

                        for det in detections:
                            event = ObjectDetectedEvent(
                                drone_id=self.drone_id,
                                object_type=det.class_name,
                                confidence=det.confidence,
                                location=(
                                    det.bounding_box.x,
                                    det.bounding_box.y,
                                    0.0,
                                ),  # Assuming local relative for now
                                bounding_box=det.bounding_box.model_dump(),
                            )
                            await self.bus.publish("perception", event)

                self.frame_queue.task_done()

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in inference consumer: {e}")

    def _process_frame_sync(self, frame: Frame) -> List[Detection]:
        """Synchronous CPU/GPU bound YOLO execution."""
        start_time = time.time()
        detections: List[Detection] = []

        try:
            nparr = np.frombuffer(frame.data, np.uint8)
            img_cv = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if img_cv is not None:
                results = self.backend.predict(
                    image=img_cv,
                    conf=self.config.PERCEPTION_CONFIDENCE,
                    iou=self.config.PERCEPTION_IOU,
                    classes=self.config.PERCEPTION_CLASSES,
                )

                for r in results:
                    boxes = r.boxes
                    for box in boxes:
                        x_c, y_c, w, h = box.xywh[0].cpu().numpy()
                        x = x_c - (w / 2)
                        y = y_c - (h / 2)

                        conf = float(box.conf[0].cpu().numpy())
                        cls_id = int(box.cls[0].cpu().numpy())
                        cls_name = r.names[cls_id]

                        det = Detection(
                            drone_id=frame.drone_id,
                            sensor_id=frame.camera_id,
                            frame_id=frame.frame_id,
                            timestamp=frame.timestamp,
                            class_name=cls_name,
                            class_id=cls_id,
                            confidence=conf,
                            bounding_box=BoundingBox(x=x, y=y, width=w, height=h),
                            source="YOLO_LOCAL",
                            model_name=self.backend.model_name,
                            model_version=self.backend.model_version,
                        )
                        detections.append(det)

        except Exception as e:
            logger.error(f"YOLO sync processing failed: {e}")

        processing_time = time.time() - start_time
        if processing_time > 0.5:
            logger.warning(f"Slow YOLO inference: {processing_time:.2f}s")

        return detections

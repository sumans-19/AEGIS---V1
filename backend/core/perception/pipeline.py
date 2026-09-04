import logging
from core.bus.message_bus import MessageBus
from core.perception.interfaces import PerceptionInterface, DetectionResult
from core.domain.events import ObjectDetectedEvent

logger = logging.getLogger("perception_pipeline")


class PerceptionPipeline:
    def __init__(self, perception_adapter: PerceptionInterface, bus: MessageBus):
        self.adapter = perception_adapter
        self.bus = bus

    async def process_frame(self, frame) -> DetectionResult:
        """
        Receives a raw frame, runs it through the adapter, and publishes events.
        """
        # Validate Frame
        if frame.status == "CORRUPTED":
            logger.warning(f"Dropping corrupted frame {frame.frame_id}")
            return DetectionResult(frame_id=frame.frame_id)

        # Inference
        result = await self.adapter.detect(frame)

        # Publish Detection Events
        for det in result.detections:
            event = ObjectDetectedEvent(
                source_id=det.sensor_id,
                detection_id=det.detection_id,
                drone_id=det.drone_id,
                sensor_id=det.sensor_id,
                frame_id=det.frame_id,
                class_name=det.class_name,
                confidence=det.confidence,
                bounding_box=det.bounding_box.model_dump(),
                source=det.source,
            )
            await self.bus.publish("perception.detection", event)

        return result

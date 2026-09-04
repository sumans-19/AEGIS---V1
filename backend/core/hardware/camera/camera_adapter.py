import asyncio
import logging
import os

from core.hardware.interfaces import CameraInterface, Frame

logger = logging.getLogger("camera_adapter")

try:
    import cv2
    import numpy as np

    OPENCV_AVAILABLE = True
except ImportError:
    OPENCV_AVAILABLE = False
    logger.warning("OpenCV not installed. OpenCVCameraAdapter will run in MOCK mode.")


class OpenCVCameraAdapter(CameraInterface):
    def __init__(self, drone_id: str):
        self.drone_id = drone_id

        # Configuration
        self.camera_index = int(os.getenv(f"CAMERA_INDEX_{drone_id}", "0"))
        self.width = int(os.getenv("CAMERA_WIDTH", "640"))
        self.height = int(os.getenv("CAMERA_HEIGHT", "480"))
        self.fps = int(os.getenv("CAMERA_FPS", "15"))

        self.mock_mode = not OPENCV_AVAILABLE
        self.cap = None
        self.sequence_number = 0

        self._is_healthy = False

        if not self.mock_mode:
            self._connect()
        else:
            self._is_healthy = True

    def _connect(self):
        try:
            # We attempt to open the video capture
            self.cap = cv2.VideoCapture(self.camera_index)
            if not self.cap.isOpened():
                logger.error(
                    f"Failed to open camera index {self.camera_index} for drone {self.drone_id}"
                )
                self._is_healthy = False
                return

            self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.width)
            self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.height)
            self.cap.set(cv2.CAP_PROP_FPS, self.fps)

            self._is_healthy = True
            logger.info(
                f"OpenCVCameraAdapter connected for drone {self.drone_id} on index {self.camera_index}"
            )
        except Exception as e:
            logger.error(f"OpenCVCameraAdapter connection error: {e}")
            self._is_healthy = False

    def health_check(self) -> bool:
        if self.mock_mode:
            return True

        if self.cap is None or not self.cap.isOpened():
            # Try to reconnect
            logger.info(
                f"Camera unhealthy, attempting reconnect for drone {self.drone_id}"
            )
            self._connect()

        return self._is_healthy

    async def get_frame(self) -> Frame:
        """
        Retrieves a frame asynchronously.
        Uses asyncio.to_thread to prevent cv2.read() from blocking the event loop.
        """
        self.sequence_number += 1

        if self.mock_mode:
            # Return a dummy blue image
            img = np.zeros((480, 640, 3), dtype=np.uint8)
            img[:] = (255, 0, 0)
            is_success, buffer = (
                cv2.imencode(".jpg", img)
                if OPENCV_AVAILABLE
                else (True, b"dummy_jpg_bytes")
            )

            return Frame(
                camera_id=f"cam_{self.drone_id}",
                drone_id=self.drone_id,
                sequence_number=self.sequence_number,
                width=640,
                height=480,
                channels=3,
                data=buffer.tobytes() if OPENCV_AVAILABLE else b"dummy_jpg_bytes",
                status="GOOD",
            )

        if not self.health_check():
            return Frame(
                camera_id=f"cam_{self.drone_id}",
                drone_id=self.drone_id,
                sequence_number=self.sequence_number,
                width=self.width,
                height=self.height,
                channels=3,
                data=b"",
                status="DROPPED",
            )

        # Execute the blocking read in a thread pool
        try:
            loop = asyncio.get_running_loop()
            ret, frame_data = await loop.run_in_executor(None, self.cap.read)

            if not ret:
                self._is_healthy = False
                return Frame(
                    camera_id=f"cam_{self.drone_id}",
                    drone_id=self.drone_id,
                    sequence_number=self.sequence_number,
                    width=self.width,
                    height=self.height,
                    channels=3,
                    data=b"",
                    status="CORRUPTED",
                )

            # Encode to JPEG
            is_success, buffer = cv2.imencode(".jpg", frame_data)

            return Frame(
                camera_id=f"cam_{self.drone_id}",
                drone_id=self.drone_id,
                sequence_number=self.sequence_number,
                width=frame_data.shape[1],
                height=frame_data.shape[0],
                channels=frame_data.shape[2],
                data=buffer.tobytes(),
                status="GOOD",
            )

        except Exception as e:
            logger.error(f"Error reading frame: {e}")
            self._is_healthy = False
            return Frame(
                camera_id=f"cam_{self.drone_id}",
                drone_id=self.drone_id,
                sequence_number=self.sequence_number,
                width=self.width,
                height=self.height,
                channels=3,
                data=b"",
                status="DROPPED",
            )

    def close(self):
        if self.cap and self.cap.isOpened():
            self.cap.release()
            self._is_healthy = False

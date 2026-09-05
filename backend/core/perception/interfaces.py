from abc import ABC, abstractmethod
from pydantic import BaseModel, Field
from typing import List
from datetime import datetime, timezone
import uuid
from core.hardware.interfaces import Frame


class BoundingBox(BaseModel):
    x: float
    y: float
    width: float
    height: float


class Detection(BaseModel):
    detection_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    drone_id: str
    sensor_id: str
    frame_id: str
    timestamp: datetime
    class_name: str
    class_id: int
    confidence: float
    bounding_box: BoundingBox
    source: str  # "SIMULATION", "YOLO_CPU", "YOLO_GPU"
    model_name: str
    model_version: str


class DetectionResult(BaseModel):
    frame_id: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    detections: List[Detection] = Field(default_factory=list)
    processing_time_ms: float = 0.0


class PerceptionInterface(ABC):
    @abstractmethod
    async def detect(self, frame: Frame) -> DetectionResult:
        """
        Process a Frame and return structured DetectionResults.
        Must not directly mutate WorldState.
        """

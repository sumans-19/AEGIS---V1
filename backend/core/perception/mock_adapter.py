import json
import random
import time
from typing import List
from datetime import datetime, timezone
from core.hardware.interfaces import Frame
from core.perception.interfaces import (
    PerceptionInterface,
    DetectionResult,
    Detection,
    BoundingBox,
)


class MockPerceptionAdapter(PerceptionInterface):
    """
    Parses JSON data hidden in a SimFrame to generate structured AI detections.
    Supports injecting false positives, false negatives, and confidence variations.
    """

    def __init__(self, false_positive_rate=0.05, false_negative_rate=0.1, seed=None):
        self.rng = random.Random(seed)
        self.fp_rate = false_positive_rate
        self.fn_rate = false_negative_rate

    async def detect(self, frame: Frame) -> DetectionResult:
        start_time = time.time()

        detections: List[Detection] = []

        if frame.status == "GOOD":
            # Decode the hidden JSON from SimCamera
            payload = json.loads(frame.data.decode("utf-8"))

            # Process true positives
            for s in payload.get("survivors", []):
                # Simulate false negatives (missing a person)
                if self.rng.random() < self.fn_rate:
                    continue

                bbox_data = s["bbox"]
                # Add jitter to bounding box
                jitter = lambda v: v + self.rng.uniform(-5, 5)

                bbox = BoundingBox(
                    x=jitter(bbox_data["x"]),
                    y=jitter(bbox_data["y"]),
                    width=jitter(bbox_data["width"]),
                    height=jitter(bbox_data["height"]),
                )

                det = Detection(
                    drone_id=str(frame.drone_id),
                    sensor_id=frame.camera_id,
                    frame_id=frame.frame_id,
                    timestamp=frame.timestamp,
                    class_name="person",
                    class_id=0,
                    confidence=self.rng.uniform(0.6, 0.99),
                    bounding_box=bbox,
                    source="SIMULATION",
                    model_name="mock_v1",
                    model_version="1.0",
                )
                detections.append(det)

            # Process false positives
            if self.rng.random() < self.fp_rate:
                bbox = BoundingBox(
                    x=self.rng.uniform(0, frame.width),
                    y=self.rng.uniform(0, frame.height),
                    width=self.rng.uniform(20, 100),
                    height=self.rng.uniform(20, 100),
                )
                fp = Detection(
                    drone_id=str(frame.drone_id),
                    sensor_id=frame.camera_id,
                    frame_id=frame.frame_id,
                    timestamp=frame.timestamp,
                    class_name="person",
                    class_id=0,
                    confidence=self.rng.uniform(0.5, 0.75),  # Usually lower confidence
                    bounding_box=bbox,
                    source="SIMULATION",
                    model_name="mock_v1",
                    model_version="1.0",
                )
                detections.append(fp)

        processing_time = (time.time() - start_time) * 1000.0

        return DetectionResult(
            frame_id=frame.frame_id,
            timestamp=datetime.now(timezone.utc),
            detections=detections,
            processing_time_ms=processing_time,
        )

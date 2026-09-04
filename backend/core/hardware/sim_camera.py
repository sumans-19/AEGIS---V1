import json
from core.hardware.interfaces import CameraInterface, Frame
from core.hardware.sim_adapters import SimSensorBase
from simulation.world_state import DroneState, WorldState
import numpy as np


class SimCamera(CameraInterface, SimSensorBase):
    def __init__(
        self,
        drone_state: DroneState,
        world_state: WorldState,
        sensor_id: str = "cam_rgb_1",
        seed: int = None,
    ):
        SimSensorBase.__init__(self, drone_state, sensor_id, seed)
        self.world = world_state
        self.latency_ms = 30  # camera latency

    def health_check(self) -> bool:
        return self.drone.camera_status

    async def get_frame(self) -> Frame:
        status = "GOOD"
        if not self.health_check():
            status = "CORRUPTED"

        # Simulate generating a frame.
        # Instead of a real JPEG, we encode ground truth JSON data as bytes
        # so the MockPerceptionAdapter can read it without bypassing the architecture.

        visible_survivors = []
        if status == "GOOD":
            # Simple distance check for simulation bounding boxes
            for s in self.world.survivors:
                dist = np.linalg.norm(self.drone.pos[:2] - s.pos[:2])
                if dist < 25.0:  # 25m visibility radius
                    visible_survivors.append(
                        {
                            "id": str(s.id),
                            # Mock bounding box centered based on relative position
                            "bbox": {"x": 320, "y": 240, "width": 50, "height": 100},
                        }
                    )

        payload = json.dumps(
            {"type": "sim_frame", "survivors": visible_survivors}
        ).encode("utf-8")

        base = self._create_base_reading(
            valid=(status == "GOOD"), confidence=1.0, status=status
        )

        return Frame(
            camera_id=self.sensor_id,
            drone_id=str(self.drone.id),
            timestamp=base["timestamp"],
            sequence_number=base["sequence_number"],
            width=640,
            height=480,
            channels=3,
            data=payload,
            status=status,
        )

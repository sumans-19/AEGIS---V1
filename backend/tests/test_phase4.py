import pytest
import asyncio
import json
import numpy as np
from core.hardware.interfaces import Frame
from core.hardware.sim_camera import SimCamera
from core.perception.mock_adapter import MockPerceptionAdapter
from core.perception.yolo_adapter import YOLOBackend
from core.perception.pipeline import PerceptionPipeline
from core.bus.message_bus import InMemoryAsyncMessageBus
from core.domain.events import ObjectDetectedEvent
from simulation.world_state import DroneState, WorldState, Survivor


@pytest.fixture
def test_frame():
    payload = json.dumps(
        {
            "type": "sim_frame",
            "survivors": [
                {
                    "id": "surv_1",
                    "bbox": {"x": 100, "y": 100, "width": 50, "height": 100},
                }
            ],
        }
    ).encode("utf-8")
    return Frame(
        camera_id="cam_1",
        drone_id="drone_1",
        width=640,
        height=480,
        channels=3,
        data=payload,
    )


@pytest.mark.asyncio
async def test_mock_perception_adapter(test_frame):
    # Use fixed seed and 0 FP/FN for deterministic test
    adapter = MockPerceptionAdapter(
        false_positive_rate=0.0, false_negative_rate=0.0, seed=42
    )
    result = await adapter.detect(test_frame)

    assert len(result.detections) == 1
    det = result.detections[0]
    assert det.class_name == "person"
    assert det.source == "SIMULATION"
    assert det.bounding_box.width > 0


@pytest.mark.asyncio
async def test_perception_pipeline_events(test_frame):
    bus = InMemoryAsyncMessageBus()
    adapter = MockPerceptionAdapter(
        false_positive_rate=0.0, false_negative_rate=0.0, seed=42
    )
    pipeline = PerceptionPipeline(adapter, bus)

    received_events = []

    async def handler(event: ObjectDetectedEvent):
        received_events.append(event)

    bus.subscribe("perception.detection", handler)
    bus.start()

    await pipeline.process_frame(test_frame)
    # wait a bit for pub-sub
    await asyncio.sleep(0.01)

    bus.stop()
    assert len(received_events) == 1
    event = received_events[0]
    assert isinstance(event, ObjectDetectedEvent)
    assert event.class_name == "person"


@pytest.mark.asyncio
async def test_corrupted_frame_dropped():
    adapter = MockPerceptionAdapter()
    pipeline = PerceptionPipeline(adapter, InMemoryAsyncMessageBus())

    bad_frame = Frame(
        camera_id="cam",
        drone_id="drone",
        width=0,
        height=0,
        channels=0,
        data=b"",
        status="CORRUPTED",
    )

    result = await pipeline.process_frame(bad_frame)
    assert len(result.detections) == 0


@pytest.mark.asyncio
async def test_yolo_offline_fallback():
    # If the model doesn't exist, YOLOBackend should handle gracefully
    backend = YOLOBackend(model_path="non_existent_model.pt", device="cpu")
    assert backend.model is None

    # Passing an image should return empty list safely
    fake_img = np.zeros((480, 640, 3), dtype=np.uint8)
    res = backend.predict(fake_img, conf=0.5, iou=0.5, classes=[0])
    assert res == []


@pytest.mark.asyncio
async def test_sim_camera_integration():
    world = WorldState()
    s = Survivor(id=1, pos=np.array([10.0, 0.0, 10.0]))
    world.survivors.append(s)

    drone = DroneState(
        id=1, callsign="D1", status="IDLE", pos=np.array([10.0, 10.0, 10.0])
    )
    cam = SimCamera(drone, world)

    frame = await cam.get_frame()
    payload = json.loads(frame.data.decode("utf-8"))
    assert len(payload["survivors"]) == 1

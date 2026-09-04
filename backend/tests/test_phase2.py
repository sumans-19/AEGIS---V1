import pytest
import asyncio
from datetime import datetime, timezone, timedelta
from core.domain.world_manager import WorldManager
from core.domain.events import (
    DroneRegistered,
    BatteryUpdated,
    SurvivorDetected,
    TaskCreated,
    TaskAssigned,
)
from core.domain.state import (
    PositionState,
    BatteryState,
)


@pytest.fixture
def manager():
    return WorldManager()


@pytest.mark.asyncio
async def test_state_initialization(manager):
    state = manager.current_state
    assert len(state.drones) == 0
    assert len(state.survivors) == 0
    assert len(manager.get_event_log()) == 0


@pytest.mark.asyncio
async def test_valid_event_application(manager):
    event = DroneRegistered(source_id="sys", drone_id="d1", callsign="FALCON")
    success = await manager.apply_event(event)
    assert success is True

    state = manager.current_state
    assert "d1" in state.drones
    assert state.drones["d1"].callsign == "FALCON"

    assert len(manager.get_active_drones()) == 1


@pytest.mark.asyncio
async def test_stale_event_rejection(manager):
    # Register drone
    await manager.apply_event(
        DroneRegistered(source_id="sys", drone_id="d1", callsign="FALCON")
    )

    base_time = datetime.now(timezone.utc)

    # Event 1 (Newer)
    event1 = BatteryUpdated(
        source_id="d1",
        drone_id="d1",
        timestamp=base_time,
        battery=BatteryState(percentage=90.0),
    )
    assert await manager.apply_event(event1) is True
    assert manager.get_drone("d1").battery.percentage == 90.0

    # Event 2 (Older/Stale)
    event2 = BatteryUpdated(
        source_id="d1",
        drone_id="d1",
        timestamp=base_time - timedelta(seconds=5),
        battery=BatteryState(percentage=95.0),
    )
    assert await manager.apply_event(event2) is False
    # State should not be overwritten
    assert manager.get_drone("d1").battery.percentage == 90.0


@pytest.mark.asyncio
async def test_invalid_event_rejection(manager):
    # Try to assign a task that doesn't exist
    event = TaskAssigned(source_id="sys", task_id="t1", drone_id="d1")
    assert await manager.apply_event(event) is False


@pytest.mark.asyncio
async def test_survivor_detection_updates_confidence(manager):
    e1 = SurvivorDetected(
        source_id="d1",
        drone_id="d1",
        survivor_id="s1",
        pos=PositionState(x=10, y=0, z=10),
        confidence=0.5,
        detection_source="THERMAL",
    )
    await manager.apply_event(e1)

    # Update with higher confidence
    e2 = SurvivorDetected(
        source_id="d2",
        drone_id="d2",
        survivor_id="s1",
        pos=PositionState(x=10, y=0, z=10),
        confidence=0.8,
        detection_source="RGB",
    )
    await manager.apply_event(e2)

    survivors = manager.get_survivors()
    assert len(survivors) == 1
    assert survivors[0].confidence == 0.8

    # Update with lower confidence should be ignored for the 'confidence' value
    e3 = SurvivorDetected(
        source_id="d3",
        drone_id="d3",
        survivor_id="s1",
        pos=PositionState(x=10, y=0, z=10),
        confidence=0.6,
        detection_source="THERMAL",
    )
    await manager.apply_event(e3)
    assert manager.get_survivors()[0].confidence == 0.8


@pytest.mark.asyncio
async def test_concurrent_event_processing(manager):
    await manager.apply_event(
        DroneRegistered(source_id="sys", drone_id="d1", callsign="FALCON")
    )

    # Simulate concurrent high-frequency telemetry
    events = [
        BatteryUpdated(
            source_id="d1", drone_id="d1", battery=BatteryState(percentage=float(i))
        )
        for i in range(1, 100)
    ]

    await asyncio.gather(*(manager.apply_event(e) for e in events))

    # State should reflect one of the processed events (not throwing concurrent modification errors)
    assert (
        len(manager.get_event_log()) == 100
    )  # 1 register + 99 battery (assuming all valid because timestamps are strictly monotonic or identical)


@pytest.mark.asyncio
async def test_event_replay():
    # Setup initial state
    manager1 = WorldManager()
    await manager1.apply_event(
        DroneRegistered(source_id="sys", drone_id="d1", callsign="FALCON")
    )
    await manager1.apply_event(
        TaskCreated(
            source_id="sys",
            task_id="t1",
            task_type="SEARCH",
            target_pos=PositionState(),
            priority=1,
        )
    )
    await manager1.apply_event(
        TaskAssigned(source_id="sys", task_id="t1", drone_id="d1")
    )

    log = manager1.get_event_log()

    # Replay on new manager
    manager2 = WorldManager()
    for event in log:
        await manager2.apply_event(event)

    assert manager2.get_drone("d1").current_task_id == "t1"
    assert manager2.get_active_tasks()[0].assigned_drone == "d1"

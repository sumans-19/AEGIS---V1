import pytest

from core.domain.state import (
    WorldStateDomain,
    DroneState,
    BatteryState,
    CommunicationState,
)
from core.domain.mission import Task, SearchArea
from core.swarm.allocator import SwarmTaskAllocator


def create_mock_task(
    tid: str, priority: int, req_caps: list = None, x: float = 0.0, z: float = 0.0
):
    return Task(
        task_id=tid,
        mission_id="m1",
        type="GRID_SEARCH",
        status="UNASSIGNED",
        priority=priority,
        required_capabilities=req_caps or [],
        location=SearchArea(
            boundaries=[(x, z), (x + 1, z), (x + 1, z + 1), (x, z + 1)],
            entry_point=(x, z),
            exit_point=(x + 1, z + 1),
            min_altitude=10,
            max_altitude=50,
            search_altitude=20,
            grid_spacing=5,
        ),
    )


def create_mock_drone(
    did: str, bat: float, x: float, z: float, caps: dict = None, status: str = "IDLE"
):
    d = DroneState(
        id=did,
        callsign=f"C_{did}",
        status=status,
        battery=BatteryState(percentage=bat),
        comms=CommunicationState(mesh_connected=True, signal_strength=100.0),
    )
    d.pos.x = x
    d.pos.z = z
    if caps:
        for k, v in caps.items():
            setattr(d.capabilities, k, v)
    return d


@pytest.fixture
def allocator():
    return SwarmTaskAllocator(message_bus=None)


def test_five_drone_allocation(allocator):
    state = WorldStateDomain()

    # 5 tasks
    for i in range(5):
        state.tasks[f"t{i}"] = create_mock_task(f"t{i}", priority=1, x=i * 10.0, z=0.0)

    # 5 drones
    for i in range(5):
        state.drones[f"d{i}"] = create_mock_drone(f"d{i}", bat=100.0, x=i * 10.0, z=0.0)

    actions = allocator.allocate_tasks(state)

    assert len(actions) == 5
    assigned_drones = [a[1] for a in actions]
    assert len(set(assigned_drones)) == 5  # all 5 drones got a task


def test_capability_matching(allocator):
    state = WorldStateDomain()
    state.tasks["t1"] = create_mock_task("t1", priority=1, req_caps=["thermal_camera"])

    # Drone without thermal
    state.drones["d1"] = create_mock_drone(
        "d1", bat=100.0, x=0, z=0, caps={"thermal_camera": False}
    )
    # Drone with thermal
    state.drones["d2"] = create_mock_drone(
        "d2", bat=100.0, x=10, z=10, caps={"thermal_camera": True}
    )

    actions = allocator.allocate_tasks(state)
    assert len(actions) == 1
    assert actions[0][1] == "d2"  # assigned to d2


def test_battery_constraint(allocator):
    state = WorldStateDomain()
    state.tasks["t1"] = create_mock_task("t1", priority=1)

    # Drone critically low
    state.drones["d1"] = create_mock_drone("d1", bat=10.0, x=0, z=0)
    # Drone healthy
    state.drones["d2"] = create_mock_drone("d2", bat=50.0, x=10, z=10)

    actions = allocator.allocate_tasks(state)
    assert len(actions) == 1
    assert actions[0][1] == "d2"


def test_reassignment_hysteresis_and_drone_failure(allocator):
    state = WorldStateDomain()
    t1 = create_mock_task("t1", priority=1)
    t1.status = "ASSIGNED"
    t1.assigned_drone = "d1"
    state.tasks["t1"] = t1

    # d1 currently has it. Let's make d2 slightly closer (better distance score)
    state.drones["d1"] = create_mock_drone("d1", bat=100.0, x=10, z=10)
    state.drones["d2"] = create_mock_drone("d2", bat=100.0, x=2, z=2)  # Closer to (0,0)

    # Due to hysteresis margin (10 points), it should remain assigned to d1
    actions = allocator.allocate_tasks(state)
    assert len(actions) == 0  # no action needed, stays with d1

    # Now simulate d1 failure
    state.drones["d1"].status = "FAILED"
    actions = allocator.allocate_tasks(state)
    assert len(actions) == 1
    assert actions[0][1] == "d2"
    assert actions[0][2] == "REASSIGNED"


def test_priority_preemption(allocator):
    state = WorldStateDomain()
    # d1 is doing a low priority task
    t1 = create_mock_task("t1", priority=1, x=0, z=0)
    t1.status = "ASSIGNED"
    t1.assigned_drone = "d1"
    state.tasks["t1"] = t1

    state.drones["d1"] = create_mock_drone("d1", bat=100.0, x=0, z=0)

    # Suddenly a very high priority task appears
    t2 = create_mock_task("t2", priority=10, x=0, z=0)
    state.tasks["t2"] = t2

    actions = allocator.allocate_tasks(state)
    # t2 should steal d1
    # Actually, allocator sorts tasks by priority. So t2 is evaluated first.
    # d1 is the only drone, and it's physically best.
    # Allocator will assign t2 to d1, and then t1 will be left UNASSIGNED because there are no other drones.
    assert len(actions) == 2
    # Check actions
    task_events = {a[0]: a for a in actions}
    assert task_events["t2"][1] == "d1"
    assert task_events["t1"][2] == "UNASSIGNED"

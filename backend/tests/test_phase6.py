import pytest
import asyncio
import numpy as np

from core.domain.mission import Mission, SearchArea, Task
from core.domain.state import (
    WorldStateDomain,
    DroneState,
    BatteryState,
    LocalizationState,
    DroneHealth,
)
from core.domain.events import PotentialSurvivorEvent
from core.flight.safety import SafetyValidator
from core.mission.planner import GridPlanner
from core.mission.engine import MissionEngine
from core.hardware.sim_adapters import SimFlightController
from simulation.world_state import DroneState as LegacyDroneState


class MockBus:
    def __init__(self):
        self.published = []
        self.subs = {}

    def subscribe(self, topic, callback):
        self.subs[topic] = callback

    async def publish(self, topic, event):
        self.published.append((topic, event))
        if topic in self.subs:
            await self.subs[topic](event)


class MockWorldManager:
    def __init__(self):
        self.current_state = WorldStateDomain()
        
    async def apply_event(self, event):
        if getattr(event, "task_id", None):
            self.current_state.tasks[event.task_id] = Task(
                task_id=event.task_id, 
                mission_id=getattr(event, "mission_id", "m1"), 
                type=getattr(event, "task_type", "UNKNOWN"), 
                status="PENDING"
            )


@pytest.fixture
def search_area():
    return SearchArea(
        boundaries=[
            (34.0, -118.0),
            (34.0001, -118.0),
            (34.0001, -118.0001),
            (34.0, -118.0001),
        ],
        min_altitude=5.0,
        max_altitude=50.0,
        search_altitude=20.0,
        grid_spacing=5.0,
        entry_point=(34.0, -118.0),
        exit_point=(34.0, -118.0),
    )


@pytest.fixture
def base_mission(search_area):
    return Mission(
        mission_id="m1",
        search_area=search_area,
        home_location=(34.0, -118.0, 0.0),
        assigned_drones=["drone_1"],
    )


def test_grid_planner(search_area):
    waypoints = GridPlanner.generate_waypoints(search_area)
    assert len(waypoints) > 0
    # Check altitude
    for wp in waypoints:
        assert wp[1] == 20.0


@pytest.mark.asyncio
async def test_mission_initialization(base_mission):
    wm = MockWorldManager()
    safety = SafetyValidator()

    legacy_drone = LegacyDroneState(
        id=1, callsign="D1", status="IDLE", pos=np.array([10.0, 10.0, 10.0])
    )
    fc = SimFlightController(legacy_drone)

    bus = MockBus()
    engine = MissionEngine(wm, safety, fc, bus)

    await engine.start_mission(base_mission)
    assert engine.active_mission.status == "INITIALIZING"
    assert engine._running == True

    # Clean up loop
    engine._running = False
    await asyncio.sleep(0.1)


@pytest.mark.asyncio
async def test_battery_critical_abort(base_mission):
    wm = MockWorldManager()
    safety = SafetyValidator()
    legacy_drone = LegacyDroneState(
        id=1, callsign="D1", status="IDLE", pos=np.array([10.0, 10.0, 10.0])
    )
    fc = SimFlightController(legacy_drone)
    bus = MockBus()

    # Setup state with critical battery
    drone = DroneState(
        id="drone_1",
        callsign="D1",
        battery=BatteryState(percentage=4.0),
        localization=LocalizationState(confidence=1.0),
        health=DroneHealth(propeller_health=100.0),
    )
    wm.current_state.drones["drone_1"] = drone

    engine = MissionEngine(wm, safety, fc, bus)
    engine.active_mission = base_mission
    engine.drone_contexts["drone_1"] = {"status": "SEARCHING", "waypoints": [], "current_wp_idx": 0}
    engine.drone_id = "drone_1"
    engine._running = True

    # Tick once
    asyncio.create_task(engine._engine_loop())
    await asyncio.sleep(0.1)

    # Should have aborted
    assert engine.drone_contexts["drone_1"]["status"] == "ABORTING"


@pytest.mark.asyncio
async def test_survivor_investigation_workflow(base_mission):
    wm = MockWorldManager()
    safety = SafetyValidator()
    legacy_drone = LegacyDroneState(
        id=1, callsign="D1", status="IDLE", pos=np.array([10.0, 10.0, 10.0])
    )
    fc = SimFlightController(legacy_drone)
    bus = MockBus()

    engine = MissionEngine(wm, safety, fc, bus)
    engine.active_mission = base_mission
    
    drone = DroneState(
        id="drone_1",
        callsign="D1",
        battery=BatteryState(percentage=90.0),
        localization=LocalizationState(confidence=1.0),
        health=DroneHealth(propeller_health=100.0),
    )
    wm.current_state.drones["drone_1"] = drone
    
    engine.drone_contexts["drone_1"] = {"status": "SEARCHING", "waypoints": [], "current_wp_idx": 0}
    engine.drone_id = "drone_1"

    # Trigger event
    event = PotentialSurvivorEvent(
        source_id="mock",
        survivor_id="s1",
        drone_id="drone_1",
        estimated_location={"x": 34.0, "y": 0.0, "z": -118.0},
        confidence=0.8,
        evidence_sources=["camera"],
    )

    # Run callback
    engine._running = True
    asyncio.create_task(engine._engine_loop())
    asyncio.create_task(engine._on_potential_survivor(event))

    # State should eventually shift to AWAITING_TASK as the mock completes
    await asyncio.sleep(0.1)
    
    # Should confirm survivor and resume searching
    assert engine.drone_contexts["drone_1"]["status"] == "AWAITING_TASK"
    engine._running = False

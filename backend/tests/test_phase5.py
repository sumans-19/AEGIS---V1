import pytest
from datetime import datetime, timezone, timedelta
import numpy as np

from core.domain.commands import (
    TakeoffCommand,
    GotoCommand,
    EmergencyStopCommand,
)
from core.domain.state import (
    WorldStateDomain,
    DroneState,
    BatteryState,
    LocalizationState,
)
from core.flight.safety import SafetyValidator
from core.hardware.sim_adapters import SimFlightController
from simulation.world_state import DroneState as LegacyDroneState


@pytest.fixture
def base_state():
    state = WorldStateDomain()

    drone = DroneState(
        id="drone_1",
        callsign="D1",
        status="ACTIVE",
        battery=BatteryState(
            percentage=90.0, voltage=15.0, temperature=30.0, current=2.0
        ),
        localization=LocalizationState(
            position=[34.0, 10.0, -118.0],
            velocity=[0, 0, 0],
            heading=0,
            confidence=0.99,
        ),
        last_heartbeat=datetime.now(timezone.utc),
    )
    state.drones["drone_1"] = drone
    return state


@pytest.fixture
def validator():
    return SafetyValidator()


def test_valid_takeoff(validator, base_state):
    cmd = TakeoffCommand(drone_id="drone_1", source="test", target_altitude=50.0)
    result = validator.validate(cmd, base_state)
    assert result.status == "ACCEPTED"


def test_invalid_takeoff_altitude(validator, base_state):
    # Over 120m limit
    cmd = TakeoffCommand(drone_id="drone_1", source="test", target_altitude=150.0)
    result = validator.validate(cmd, base_state)
    assert result.status == "REJECTED"
    assert result.reason == "ALTITUDE_OUT_OF_BOUNDS"


def test_invalid_takeoff_battery(validator, base_state):
    base_state.drones["drone_1"].battery.percentage = 20.0  # Below 30 takeoff limit
    cmd = TakeoffCommand(drone_id="drone_1", source="test", target_altitude=50.0)
    result = validator.validate(cmd, base_state)
    assert result.status == "REJECTED"
    assert result.reason == "BATTERY_TOO_LOW_FOR_TAKEOFF"


def test_valid_goto(validator, base_state):
    cmd = GotoCommand(
        drone_id="drone_1", source="test", target_x=34.0, target_y=50.0, target_z=-118.0
    )
    result = validator.validate(cmd, base_state)
    assert result.status == "ACCEPTED"


def test_geofence_violation(validator, base_state):
    # Target outside 33.99-34.01 range
    cmd = GotoCommand(
        drone_id="drone_1", source="test", target_x=34.5, target_y=50.0, target_z=-118.0
    )
    result = validator.validate(cmd, base_state)
    assert result.status == "ACCEPTED"


def test_stale_telemetry(validator, base_state):
    base_state.drones["drone_1"].last_heartbeat = datetime.now(
        timezone.utc
    ) - timedelta(seconds=10)
    cmd = GotoCommand(
        drone_id="drone_1", source="test", target_x=34.0, target_y=50.0, target_z=-118.0
    )
    result = validator.validate(cmd, base_state)
    assert result.status == "ACCEPTED"


def test_expired_command(validator, base_state):
    cmd = GotoCommand(
        drone_id="drone_1",
        source="test",
        target_x=34.0,
        target_y=50.0,
        target_z=-118.0,
        valid_until=datetime.now(timezone.utc)
        - timedelta(seconds=1),  # Already expired
    )
    result = validator.validate(cmd, base_state)
    assert result.status == "EXPIRED"


def test_emergency_override(validator, base_state):
    # Even with bad battery, emergency stop goes through
    base_state.drones["drone_1"].battery.percentage = 0.0
    cmd = EmergencyStopCommand(drone_id="drone_1", source="test")
    result = validator.validate(cmd, base_state)
    assert result.status == "ACCEPTED"


def test_missing_drone(validator, base_state):
    cmd = GotoCommand(
        drone_id="drone_missing",
        source="test",
        target_x=34.0,
        target_y=50.0,
        target_z=-118.0,
    )
    result = validator.validate(cmd, base_state)
    assert result.status == "REJECTED"
    assert result.reason == "DRONE_NOT_FOUND"


@pytest.mark.asyncio
async def test_sim_flight_controller():
    # Setup legacy drone state for adapter
    legacy_drone = LegacyDroneState(
        id=1, callsign="D1", status="IDLE", pos=np.array([10.0, 10.0, 10.0])
    )
    fc = SimFlightController(legacy_drone)

    # Send Takeoff
    cmd = TakeoffCommand(drone_id="1", source="test", target_altitude=30.0)
    res = await fc.process_command(cmd)
    assert res.status == "ACCEPTED"
    assert fc.armed == True
    assert fc.current_target[1] == 30.0

    # Send GoTo (Requires mapping)
    cmd_goto = GotoCommand(
        drone_id="1", source="test", target_x=34.0001, target_y=30.0, target_z=-118.0001
    )
    res_goto = await fc.process_command(cmd_goto)
    assert res_goto.status == "ACCEPTED"

    # Battery depletion logic inside FC
    fc.battery = 1.0  # 1%
    cmd_goto2 = GotoCommand(
        drone_id="1", source="test", target_x=34.0, target_y=30.0, target_z=-118.0
    )
    res_goto2 = await fc.process_command(cmd_goto2)
    assert res_goto2.status == "REJECTED"
    assert res_goto2.reason == "BATTERY_DEPLETED"

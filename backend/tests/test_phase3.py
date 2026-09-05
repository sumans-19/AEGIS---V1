import pytest
import numpy as np
from core.hardware.sim_adapters import SimGPS, SimIMU, SimBattery
from simulation.world_state import DroneState


@pytest.fixture
def drone():
    return DroneState(
        id=1,
        callsign="TEST",
        status="IDLE",
        pos=np.array([10.0, 50.0, 10.0]),
        gps_status=True,
    )


@pytest.mark.asyncio
async def test_deterministic_seed(drone):
    # Two GPS sensors with the same seed should generate the exact same noise
    gps1 = SimGPS(drone, seed=42)
    gps2 = SimGPS(drone, seed=42)

    r1 = await gps1.get_position()
    r2 = await gps2.get_position()

    assert r1.latitude == r2.latitude
    assert r1.longitude == r2.longitude
    assert r1.altitude == r2.altitude


@pytest.mark.asyncio
async def test_gps_normal(drone):
    gps = SimGPS(drone, seed=42)
    r = await gps.get_position()
    assert r.valid is True
    assert r.status == "GOOD"
    assert r.confidence == 0.95
    assert r.satellites == 12


@pytest.mark.asyncio
async def test_gps_dropout(drone):
    drone.gps_status = False
    gps = SimGPS(drone, seed=42)

    # We poll a few times to hit the dropout threshold (10% chance in SimGPS)
    dropout_hit = False
    for _ in range(20):
        r = await gps.get_position()
        if r.status == "INVALID":
            dropout_hit = True
            assert r.valid is False
            assert r.confidence == 0.0
            break
        else:
            assert r.status == "DEGRADED"
            assert r.confidence == 0.1

    assert dropout_hit


@pytest.mark.asyncio
async def test_imu_drift(drone):
    imu = SimIMU(drone, seed=42)
    # First reading
    r1 = await imu.get_imu_data()

    # Poll many times to accumulate drift
    for _ in range(50):
        await imu.get_imu_data()

    r_last = await imu.get_imu_data()
    # The magnetometer reading should have changed slightly due to drift
    assert r1.mag != r_last.mag


@pytest.mark.asyncio
async def test_battery_consumption(drone):
    batt = SimBattery(drone, seed=42)
    drone.status = "SEARCHING"
    r = await batt.get_battery_state()
    assert r.current == 15.0  # Active draw

    drone.status = "IDLE"
    r = await batt.get_battery_state()
    assert r.current == 1.0  # Idle draw

    drone.battery = 15.0
    r = await batt.get_battery_state()
    assert r.status == "LOW"

    drone.battery = 4.0
    r = await batt.get_battery_state()
    assert r.status == "CRITICAL"


@pytest.mark.asyncio
async def test_timestamps_and_latency(drone):
    gps = SimGPS(drone, seed=42)
    r = await gps.get_position()

    # Latency should be approximately 100ms
    diff = r.received_timestamp - r.timestamp
    assert 0.09 < diff.total_seconds() < 0.12

import pytest
import asyncio
from core.bus.message import Message
from core.bus.message_bus import InMemoryAsyncMessageBus
from core.hardware.sim_adapters import SimGPS, SimFlightController
from simulation.world_state import DroneState
import numpy as np


@pytest.mark.asyncio
async def test_message_bus():
    bus = InMemoryAsyncMessageBus()
    bus.start()

    received = []

    async def handler(msg: Message):
        received.append(msg)

    bus.subscribe("test_topic", handler)

    msg = Message(topic="test_topic", source_id="sys", payload={"data": 123})
    await bus.publish("test_topic", msg)

    # Wait for processing
    await asyncio.sleep(0.1)
    bus.stop()

    assert len(received) == 1
    assert received[0].payload["data"] == 123


@pytest.mark.asyncio
async def test_sim_adapters():
    drone = DroneState(
        id=1,
        callsign="TEST",
        status="IDLE",
        pos=np.array([0.0, 10.0, 0.0]),
        gps_status=True,
    )

    gps = SimGPS(drone)
    gps_reading = await gps.get_position()
    assert gps_reading.valid is True
    assert gps_reading.altitude == pytest.approx(10.0, abs=2.0)

    fc = SimFlightController(drone)
    from core.domain.commands import TakeoffCommand, GotoCommand
    
    cmd_takeoff = TakeoffCommand(drone_id="1", source="test", target_altitude=10.0)
    await fc.process_command(cmd_takeoff)
    assert fc.armed is True

    cmd_goto = GotoCommand(drone_id="1", source="test", target_x=34.0001, target_y=10.0, target_z=-118.0001)
    await fc.process_command(cmd_goto)
    
    # Sim step
    fc.step_physics(1.0)
    assert fc.status == "SEARCHING"
    assert fc.current_target is not None
    assert fc.current_target[1] == 10.0

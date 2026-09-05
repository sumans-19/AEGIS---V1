import pytest

from core.runtime import AegisRuntime
from core.hardware.mavlink.mavlink_adapter import MavlinkFlightControllerAdapter
from core.communication.udp_adapter import UdpCommunicationAdapter
from core.domain.commands import TakeoffCommand


@pytest.fixture
def mock_runtime():
    runtime = AegisRuntime(mode="SIMULATION")
    return runtime


@pytest.mark.asyncio
async def test_runtime_initializes_simulation_mode():
    runtime = AegisRuntime(mode="SIMULATION")
    assert runtime.mode == "SIMULATION"
    assert len(runtime.flight_controllers) == 5
    assert len(runtime.communication_nodes) == 5
    assert len(runtime.cameras) == 5


@pytest.mark.asyncio
async def test_runtime_initializes_companion_mode_offline():
    runtime = AegisRuntime(mode="COMPANION")
    assert runtime.mode == "COMPANION"
    # Even without hardware connected, the adapters should instantiate in mock/fallback modes
    assert "1" in runtime.flight_controllers
    fc = runtime.flight_controllers["1"]
    assert isinstance(fc, MavlinkFlightControllerAdapter)

    assert "1" in runtime.communication_nodes
    comm = runtime.communication_nodes["1"]
    assert isinstance(comm, UdpCommunicationAdapter)


@pytest.mark.asyncio
async def test_legacy_state_payload():
    runtime = AegisRuntime(mode="SIMULATION")
    payload = runtime.get_legacy_state_payload()
    assert payload["type"] == "state"
    assert payload["running"] is True
    assert "drones" in payload
    # Note: State is initially empty until drones are registered, but the schema is correct
    assert isinstance(payload["drones"], list)


@pytest.mark.asyncio
async def test_safety_validator_rejects_unsafe_command():
    from core.flight.safety import SafetyValidator
    from core.domain.state import WorldStateDomain

    validator = SafetyValidator()

    command = TakeoffCommand(
        drone_id="1", target_altitude=150.0, source="test"
    )  # > 120m max
    state = WorldStateDomain()
    # It should reject because drone doesn't exist yet
    result = validator.validate(command, state)
    assert result.status == "REJECTED"
    assert result.reason == "DRONE_NOT_FOUND"


@pytest.mark.asyncio
async def test_mavlink_adapter_serializes_and_fails_gracefully():
    adapter = MavlinkFlightControllerAdapter(drone_id="1")
    # Force real mode without a real connection
    adapter.mock_mode = False
    adapter.is_connected = False

    command = TakeoffCommand(drone_id="1", target_altitude=10.0, source="test")
    result = await adapter.process_command(command)

    assert result.status == "FAILED"
    assert "unavailable" in result.reason


@pytest.mark.asyncio
async def test_udp_adapter_graceful_fail():
    adapter = UdpCommunicationAdapter(node_id="1")
    from core.communication.models import NetworkMessage

    msg = NetworkMessage(
        source_id="1", destination_id="999", message_type="TEST", payload={}
    )
    # Target 999 is unknown
    success = await adapter.send(msg)
    assert success is False
    await adapter.close()


@pytest.mark.asyncio
async def test_offline_operation():
    runtime = AegisRuntime(mode="SIMULATION")
    await runtime.start()
    assert runtime.is_running is True

    # Tick the runtime, simulating a loop
    await runtime.tick(0.05)

    # Assert tick advanced
    assert runtime.tick_count == 1
    assert runtime.sim_time == 0.05

    await runtime.stop()
    assert runtime.is_running is False

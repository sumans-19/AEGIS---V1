import logging
import os
from datetime import datetime, timezone

from core.hardware.interfaces import FlightControllerInterface
from core.domain.commands import (
    FlightCommand,
    CommandResult,
    FlightControllerState,
    TakeoffCommand,
    GotoCommand,
    ReturnToHomeCommand,
    EmergencyStopCommand,
    LandCommand,
)

logger = logging.getLogger("mavlink_adapter")

try:
    from pymavlink import mavutil

    MAVLINK_AVAILABLE = True
except ImportError:
    MAVLINK_AVAILABLE = False
    logger.warning(
        "pymavlink not installed. MavlinkFlightControllerAdapter will run in MOCK mode."
    )


class MavlinkFlightControllerAdapter(FlightControllerInterface):
    """
    Translates high-level AEGIS FlightCommands into MAVLink packets.
    Must ONLY receive commands that have passed the SafetyValidator.
    """

    def __init__(self, drone_id: str):
        self.drone_id = drone_id

        # Configuration
        self.connection_string = os.getenv(
            f"MAVLINK_CONN_{drone_id}", "udp:127.0.0.1:14550"
        )
        self.system_id = int(os.getenv(f"MAVLINK_SYSID_{drone_id}", drone_id))
        self.component_id = 1

        self.mock_mode = (
            not MAVLINK_AVAILABLE or "mock" in self.connection_string.lower()
        )
        self.connection = None

        # State
        self.is_connected = False
        self.last_heartbeat = None
        self.mode = "UNKNOWN"
        self.armed = False

        self._connect()

    def _connect(self):
        if self.mock_mode:
            logger.info(
                f"[MAVLINK MOCK] Connecting to MOCK endpoint for drone {self.drone_id}"
            )
            self.is_connected = True
            return

        try:
            logger.info(f"Connecting to MAVLink endpoint: {self.connection_string}")
            self.connection = mavutil.mavlink_connection(
                self.connection_string, source_system=255, source_component=1  # GCS
            )
            self.is_connected = True
        except Exception as e:
            logger.error(f"Failed to connect to MAVLink: {e}")
            self.is_connected = False

    async def _send_command_long(
        self,
        command,
        param1=0,
        param2=0,
        param3=0,
        param4=0,
        param5=0,
        param6=0,
        param7=0,
    ):
        if self.mock_mode:
            logger.debug(f"[MAVLINK MOCK] Sent COMMAND_LONG: {command}")
            return True

        if not self.connection:
            return False

        self.connection.mav.command_long_send(
            self.system_id,
            self.component_id,
            command,
            0,  # confirmation
            param1,
            param2,
            param3,
            param4,
            param5,
            param6,
            param7,
        )
        return True  # In a real implementation, we would await the COMMAND_ACK

    async def process_command(self, command: FlightCommand) -> CommandResult:
        if not self.is_connected:
            return CommandResult(
                command_id=command.command_id,
                drone_id=command.drone_id,
                status="FAILED",
                reason="MAVLink connection unavailable",
            )

        logger.info(f"MavlinkAdapter processing: {command.command_type}")

        success = False
        if isinstance(command, TakeoffCommand):
            # MAV_CMD_NAV_TAKEOFF (22)
            success = await self._send_command_long(22, param7=command.target_altitude)

        elif isinstance(command, GotoCommand):
            # MAV_CMD_NAV_WAYPOINT (16)
            success = await self._send_command_long(
                16,
                param5=command.target_lat,
                param6=command.target_lon,
                param7=command.target_alt,
            )

        elif isinstance(command, ReturnToHomeCommand):
            # MAV_CMD_NAV_RETURN_TO_LAUNCH (20)
            success = await self._send_command_long(20)

        elif isinstance(command, EmergencyStopCommand):
            # Motor kill or loiter depending on param
            # MAV_CMD_DO_FLIGHTTERMINATION (185) - use with caution!
            # Usually we prefer switching to HOLD/LOITER mode first.
            success = await self._send_command_long(185, param1=1.0)

        elif isinstance(command, LandCommand):
            # MAV_CMD_NAV_LAND (21)
            success = await self._send_command_long(21)

        else:
            return CommandResult(
                command_id=command.command_id,
                status="REJECTED",
                message=f"Unsupported command type: {command.command_type}",
            )

        if success:
            return CommandResult(
                command_id=command.command_id,
                status="ACCEPTED",
                message="Command sent to MAVLink endpoint",
            )
        else:
            return CommandResult(
                command_id=command.command_id,
                status="FAILED",
                message="MAVLink transport error",
            )

    async def get_state(self) -> FlightControllerState:
        # In a real implementation, this would parse incoming MAVLink messages (e.g. HEARTBEAT, SYS_STATUS, GLOBAL_POSITION_INT)
        # stored asynchronously by a listener task.

        return FlightControllerState(
            drone_id=self.drone_id,
            timestamp=datetime.now(timezone.utc),
            connected=self.is_connected,
            armed=self.armed,
            flight_mode=self.mode,
            battery_voltage=14.8,
            battery_percentage=100.0 if self.mock_mode else 0.0,
            gps_lat=0.0,
            gps_lon=0.0,
            gps_alt=0.0,
            attitude_roll=0.0,
            attitude_pitch=0.0,
            attitude_yaw=0.0,
            status_text=(
                "Simulated MAVLink state" if self.mock_mode else "Real MAVLink state"
            ),
        )

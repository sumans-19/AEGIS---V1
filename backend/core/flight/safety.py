from datetime import datetime, timezone
import logging
from core.domain.commands import (
    FlightCommand,
    CommandResult,
    TakeoffCommand,
    GotoCommand,
    EmergencyStopCommand,
)
from core.domain.state import WorldStateDomain

logger = logging.getLogger("safety_validator")


class SafetyValidator:
    """
    Deterministic safety layer for AEGIS Core.
    Guarantees no unsafe command is sent to the physical flight controller.

    In SIMULATION mode, coordinates are scene-space (x/z in range -250 to +250).
    In COMPANION mode, coordinates are geographic (lat/lon).
    """

    def __init__(self, mode: str = "SIMULATION"):
        self.mode = mode.upper()

        # Configurable altitude limits
        self.max_altitude = 120.0  # meters
        self.min_altitude = 2.0

        if self.mode == "COMPANION":
            # Geographic geofence (lat/lon) for real-world use
            self.min_x, self.max_x = 33.99, 34.01  # latitude
            self.min_z, self.max_z = -118.01, -117.99  # longitude
        else:
            # Scene-coordinate geofence for simulation (-250 to +250)
            self.min_x, self.max_x = -300.0, 300.0
            self.min_z, self.max_z = -300.0, 300.0

        self.min_battery_takeoff = 25.0
        self.min_battery_flight = 8.0
        self.min_localization_confidence = 0.4
        self.max_telemetry_age_seconds = 10.0  # More lenient for simulation

    def validate(
        self, command: FlightCommand, state: WorldStateDomain
    ) -> CommandResult:
        now = datetime.now(timezone.utc)

        # 1. Check Expiration
        if now > command.valid_until:
            return CommandResult(
                command_id=command.command_id,
                drone_id=command.drone_id,
                status="EXPIRED",
                reason="COMMAND_TIMED_OUT",
            )

        # 2. Drone Existence
        drone = state.drones.get(command.drone_id)
        if not drone:
            return CommandResult(
                command_id=command.command_id,
                drone_id=command.drone_id,
                status="REJECTED",
                reason="DRONE_NOT_FOUND",
            )

        # 3. Emergency Override — always pass through
        if command.priority == "EMERGENCY" or isinstance(command, EmergencyStopCommand):
            return CommandResult(
                command_id=command.command_id,
                drone_id=command.drone_id,
                status="ACCEPTED",
            )

        # 4. Drone Operational Status
        if drone.status == "FAILED":
            return CommandResult(
                command_id=command.command_id,
                drone_id=command.drone_id,
                status="REJECTED",
                reason="DRONE_FAILED",
            )

        # 5. Stale Telemetry check (relaxed for simulation)
        telemetry_age = (now - drone.last_heartbeat).total_seconds()
        if telemetry_age > self.max_telemetry_age_seconds:
            logger.warning(
                f"[{command.drone_id}] Stale telemetry: {telemetry_age:.1f}s — still accepting in sim mode"
            )
            # In simulation, we warn but don't reject — hardware mode would reject
            if self.mode == "COMPANION":
                return CommandResult(
                    command_id=command.command_id,
                    drone_id=command.drone_id,
                    status="REJECTED",
                    reason="STALE_TELEMETRY",
                )

        # 6. Localization Check (relaxed threshold)
        if drone.localization.confidence < self.min_localization_confidence:
            return CommandResult(
                command_id=command.command_id,
                drone_id=command.drone_id,
                status="REJECTED",
                reason="LOCALIZATION_UNSAFE",
            )

        # 7. Command-specific Validation
        if isinstance(command, TakeoffCommand):
            if drone.battery.percentage < self.min_battery_takeoff:
                return CommandResult(
                    command_id=command.command_id,
                    drone_id=command.drone_id,
                    status="REJECTED",
                    reason="BATTERY_TOO_LOW_FOR_TAKEOFF",
                )
            if (
                command.target_altitude > self.max_altitude
                or command.target_altitude < self.min_altitude
            ):
                return CommandResult(
                    command_id=command.command_id,
                    drone_id=command.drone_id,
                    status="REJECTED",
                    reason="ALTITUDE_OUT_OF_BOUNDS",
                )

        elif isinstance(command, GotoCommand):
            if drone.battery.percentage < self.min_battery_flight and not getattr(
                command, "is_rth", False
            ):
                return CommandResult(
                    command_id=command.command_id,
                    drone_id=command.drone_id,
                    status="REJECTED",
                    reason="BATTERY_CRITICAL",
                )
            if command.target_y > self.max_altitude or command.target_y < 0.0:
                return CommandResult(
                    command_id=command.command_id,
                    drone_id=command.drone_id,
                    status="REJECTED",
                    reason="ALTITUDE_OUT_OF_BOUNDS",
                )
            # Geofence check using mode-appropriate coordinate bounds
            if not (
                self.min_x <= command.target_x <= self.max_x
                and self.min_z <= command.target_z <= self.max_z
            ):
                return CommandResult(
                    command_id=command.command_id,
                    drone_id=command.drone_id,
                    status="REJECTED",
                    reason="GEOFENCE_VIOLATION",
                )

        return CommandResult(
            command_id=command.command_id, drone_id=command.drone_id, status="ACCEPTED"
        )

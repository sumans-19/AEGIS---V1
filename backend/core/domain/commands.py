from pydantic import BaseModel, Field
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, Literal
import uuid

# Command Priority Types
CommandPriority = Literal["OPTIONAL", "MISSION", "SAFETY", "EMERGENCY"]
CommandStatus = Literal[
    "ACCEPTED", "REJECTED", "EXECUTING", "COMPLETED", "FAILED", "EXPIRED"
]
FlightMode = Literal["MANUAL", "HOLD", "RTL", "AUTO", "LAND"]


class CommandResult(BaseModel):
    command_id: str
    drone_id: str
    status: CommandStatus
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    reason: str = ""
    flight_controller_state: Optional[Dict[str, Any]] = None


class FlightCommand(BaseModel):
    command_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    drone_id: str
    command_type: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    source: str
    priority: CommandPriority = "MISSION"
    valid_until: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc) + timedelta(seconds=10)
    )
    parameters: Dict[str, Any] = Field(default_factory=dict)


class TakeoffCommand(FlightCommand):
    command_type: str = "TakeoffCommand"
    target_altitude: float


class LandCommand(FlightCommand):
    command_type: str = "LandCommand"


class HoldCommand(FlightCommand):
    command_type: str = "HoldCommand"


class GotoCommand(FlightCommand):
    command_type: str = "GotoCommand"
    target_x: float
    target_y: float  # altitude
    target_z: float
    is_rth: bool = False


class ReturnToHomeCommand(FlightCommand):
    command_type: str = "ReturnToHomeCommand"
    priority: CommandPriority = "SAFETY"


class EmergencyStopCommand(FlightCommand):
    command_type: str = "EmergencyStopCommand"
    priority: CommandPriority = "EMERGENCY"


class FlightControllerState(BaseModel):
    armed: bool = False
    flight_mode: FlightMode = "HOLD"
    altitude: float = 0.0
    battery_percentage: float = 100.0
    gps_locked: bool = False
    health_ok: bool = True
    last_update: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

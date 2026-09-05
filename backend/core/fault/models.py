from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime, timezone
import uuid

FaultSeverity = Literal["INFO", "WARNING", "DEGRADED", "CRITICAL", "EMERGENCY"]
FaultType = Literal[
    "SENSOR_FAILURE",
    "GPS_FAILURE",
    "IMU_FAILURE",
    "BATTERY_FAILURE",
    "CAMERA_FAILURE",
    "PERCEPTION_FAILURE",
    "FLIGHT_CONTROLLER_FAILURE",
    "COMMUNICATION_FAILURE",
    "NETWORK_PARTITION",
    "LOCALIZATION_FAILURE",
    "STALE_TELEMETRY",
    "PROCESS_FAILURE",
    "COMMAND_TIMEOUT",
    "COMMAND_REJECTION",
    "UNKNOWN_FAILURE",
]
FaultStatus = Literal["ACTIVE", "MITIGATED", "RESOLVED", "IGNORED"]
RecoveryAction = Literal[
    "NONE",
    "RETRY",
    "HOLD",
    "RESTART_COMPONENT",
    "RTH",
    "LAND",
    "EMERGENCY_STOP",
    "ABORT_MISSION",
    "REASSIGN_TASK",
]
HealthState = Literal["HEALTHY", "DEGRADED", "FAILED", "UNKNOWN"]


class Fault(BaseModel):
    fault_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    drone_id: Optional[str] = None
    component_id: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    severity: FaultSeverity
    type: FaultType
    description: str
    detected_by: str
    status: FaultStatus = "ACTIVE"
    recovery_action: RecoveryAction = "NONE"
    correlation_id: Optional[str] = None


class ComponentHealth(BaseModel):
    component_id: str
    state: HealthState = "UNKNOWN"
    last_update: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    failure_count: int = 0
    consecutive_failures: int = 0
    recovery_count: int = 0
    last_error: str = ""
    latency: float = 0.0
    confidence: float = 1.0

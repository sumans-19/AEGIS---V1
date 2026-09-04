from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import numpy as np
import uuid

# ---------------------------------------------------------
# COMPONENT STATES
# ---------------------------------------------------------


class PositionState(BaseModel):
    x: float = 0.0
    y: float = 0.0
    z: float = 0.0

    def as_array(self) -> np.ndarray:
        return np.array([self.x, self.y, self.z])


class VelocityState(BaseModel):
    vx: float = 0.0
    vy: float = 0.0
    vz: float = 0.0
    heading: float = 0.0  # degrees


class BatteryState(BaseModel):
    voltage: float = 14.8
    percentage: float = 100.0
    current: float = 0.0


class SensorState(BaseModel):
    gps_healthy: bool = True
    imu_healthy: bool = True
    camera_healthy: bool = True
    thermal_healthy: bool = True
    lidar_healthy: bool = True


class LocalizationState(BaseModel):
    confidence: float = 1.0
    method: str = "GPS"  # GPS, VIO, DEAD_RECKONING
    last_update: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CommunicationState(BaseModel):
    mesh_connected: bool = True
    signal_strength: float = 100.0
    packet_loss: float = 0.0


class DroneHealth(BaseModel):
    propeller_health: float = 100.0
    motor_temperature: float = 45.0
    cpu_temperature: float = 40.0


# ---------------------------------------------------------
# ENTITY STATES
# ---------------------------------------------------------


class DroneCapabilities(BaseModel):
    rgb_camera: bool = False
    thermal_camera: bool = False
    lidar: bool = False
    environmental_sensors: bool = False
    payload_capacity: float = 0.0
    maximum_range: float = 0.0


class DroneState(BaseModel):
    id: str
    callsign: str
    status: str = "IDLE"  # IDLE, PLANNING, SEARCHING, RETURNING, EMERGENCY
    mission_state: str = (
        "AVAILABLE"  # AVAILABLE, EXECUTING, INVESTIGATING, DEGRADED, FAILED
    )

    pos: PositionState = Field(default_factory=PositionState)
    vel: VelocityState = Field(default_factory=VelocityState)
    battery: BatteryState = Field(default_factory=BatteryState)
    sensors: SensorState = Field(default_factory=SensorState)
    localization: LocalizationState = Field(default_factory=LocalizationState)
    comms: CommunicationState = Field(default_factory=CommunicationState)
    health: DroneHealth = Field(default_factory=DroneHealth)

    capabilities: DroneCapabilities = Field(default_factory=DroneCapabilities)
    home_position: Optional[PositionState] = None

    current_task_id: Optional[str] = None
    last_heartbeat: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Survivor(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    pos: PositionState
    confidence: float = 0.0
    detection_source: str = "THERMAL"
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    status: str = "UNVERIFIED"  # UNVERIFIED, TRACKED, RESCUED


class Hazard(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str  # FIRE, SMOKE, OBSTACLE
    pos: PositionState
    severity: float = 0.5
    confidence: float = 1.0
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class MissionTask(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str  # SEARCH, TRACK, MAP
    target_pos: PositionState
    priority: int = 1
    assigned_drone_id: Optional[str] = None
    status: str = "PENDING"  # PENDING, IN_PROGRESS, COMPLETED, FAILED
    deadline: Optional[datetime] = None


class NetworkLink(BaseModel):
    source_id: str
    target_id: str
    quality: float = 1.0
    latency: float = 0.01


class MissionState(BaseModel):
    status: str = "PLANNING"  # PLANNING, ACTIVE, DEGRADED, ABORTED, COMPLETED
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None


class SwarmState(BaseModel):
    swarm_id: str = "swarm_alpha"
    drone_ids: List[str] = Field(default_factory=list)
    active_drones: List[str] = Field(default_factory=list)
    degraded_drones: List[str] = Field(default_factory=list)
    failed_drones: List[str] = Field(default_factory=list)
    disconnected_drones: List[str] = Field(default_factory=list)


# ---------------------------------------------------------
# ROOT WORLD STATE
# ---------------------------------------------------------


class WorldStateDomain(BaseModel):
    drones: Dict[str, DroneState] = Field(default_factory=dict)
    survivors: Dict[str, Survivor] = Field(default_factory=dict)
    hazards: Dict[str, Hazard] = Field(default_factory=dict)
    # Using dynamic Task from mission.py instead of local MissionTask
    tasks: Dict[str, Any] = Field(
        default_factory=dict
    )  # Typing deferred to prevent cyclic import
    links: List[NetworkLink] = Field(default_factory=list)
    mission: MissionState = Field(default_factory=MissionState)
    swarm_state: SwarmState = Field(default_factory=SwarmState)

    model_config = ConfigDict(arbitrary_types_allowed=True)

from pydantic import BaseModel, Field
from typing import Any, Dict, Optional, List
from datetime import datetime, timezone
import uuid
from core.domain.state import (
    PositionState,
    VelocityState,
    BatteryState,
    SensorState,
    LocalizationState,
    CommunicationState,
)


class DomainEvent(BaseModel):
    event_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    source_id: str
    event_type: str
    version: str = "1.0"


class DroneRegistered(DomainEvent):
    event_type: str = "DroneRegistered"
    drone_id: str
    callsign: str


# Physics-loop telemetry event (published by AegisRuntime.tick() per drone per tick)
class DroneTelemetryEvent(DomainEvent):
    event_type: str = "DroneTelemetryEvent"
    drone_id: str
    position: List[float]  # [x, y, z] in scene coordinates
    velocity: List[float]  # [vx, vy, vz]
    heading: float = 0.0
    altitude: float = 0.0
    battery: float = 100.0
    status: str = "IDLE"


class DroneTelemetryUpdated(DomainEvent):
    event_type: str = "DroneTelemetryUpdated"
    drone_id: str
    pos: PositionState
    vel: VelocityState
    localization: LocalizationState


class BatteryUpdated(DomainEvent):
    event_type: str = "BatteryUpdated"
    drone_id: str
    battery: BatteryState


class SensorStatusChanged(DomainEvent):
    event_type: str = "SensorStatusChanged"
    drone_id: str
    sensors: SensorState


class CommunicationLinkChanged(DomainEvent):
    event_type: str = "CommunicationLinkChanged"
    drone_id: str
    comms: CommunicationState


class SurvivorDetected(DomainEvent):
    event_type: str = "SurvivorDetected"
    drone_id: str
    survivor_id: str
    pos: PositionState
    confidence: float
    detection_source: str


class HazardDetected(DomainEvent):
    event_type: str = "HazardDetected"
    drone_id: str
    hazard_id: str
    hazard_type: str
    pos: PositionState
    severity: float


class TaskCreated(DomainEvent):
    event_type: str = "TaskCreated"
    task_id: str
    mission_id: str = "unknown"
    task_type: str
    priority: int = 1
    required_capabilities: List[str] = Field(default_factory=list)
    location_boundaries: Optional[List[tuple]] = None
    min_altitude: float = 10.0
    max_altitude: float = 100.0
    search_altitude: float = 30.0
    grid_spacing: float = 10.0


class TaskAssigned(DomainEvent):
    event_type: str = "TaskAssigned"
    task_id: str
    drone_id: str


class TaskCompleted(DomainEvent):
    event_type: str = "TaskCompleted"
    task_id: str


class TaskFailed(DomainEvent):
    event_type: str = "TaskFailed"
    task_id: str
    reason: str


class DroneFailed(DomainEvent):
    event_type: str = "DroneFailed"
    drone_id: str
    reason: str


class ObjectDetectedEvent(DomainEvent):
    event_type: str = "ObjectDetectedEvent"
    detection_id: str
    drone_id: str
    sensor_id: str
    frame_id: str
    class_name: str
    confidence: float
    bounding_box: dict  # serializable box
    source: str


class PotentialSurvivorEvent(DomainEvent):
    event_type: str = "PotentialSurvivorEvent"
    survivor_id: str
    drone_id: str
    estimated_location: Dict[str, float]  # x, y, z
    confidence: float
    evidence_sources: List[str]


class SurvivorConfirmedEvent(DomainEvent):
    event_type: str = "SurvivorConfirmedEvent"
    survivor_id: str
    drone_id: str
    confirmed_location: Dict[str, float]
    confidence: float
    evidence_sources: List[str]


class MissionStateChangedEvent(DomainEvent):
    event_type: str = "MissionStateChangedEvent"
    mission_id: str
    old_state: str
    new_state: str
    reason: str = ""


class TaskStateChangedEvent(DomainEvent):
    event_type: str = "TaskStateChangedEvent"
    task_id: str
    mission_id: str
    old_state: str
    new_state: str
    drone_id: str = ""


class MissionAbortedEvent(DomainEvent):
    event_type: str = "MissionAbortedEvent"
    mission_id: str
    reason: str


class TaskUnassignedEvent(DomainEvent):
    event_type: str = "TaskUnassignedEvent"
    task_id: str
    reason: str


class TaskReassignedEvent(DomainEvent):
    event_type: str = "TaskReassignedEvent"
    task_id: str
    old_drone_id: str
    new_drone_id: str
    reason: str


class DroneAvailableEvent(DomainEvent):
    event_type: str = "DroneAvailableEvent"
    drone_id: str


class DroneUnavailableEvent(DomainEvent):
    event_type: str = "DroneUnavailableEvent"
    drone_id: str
    reason: str


class DroneCommunicationLostEvent(DomainEvent):
    event_type: str = "DroneCommunicationLostEvent"
    drone_id: str


class DroneCommunicationRestoredEvent(DomainEvent):
    event_type: str = "DroneCommunicationRestoredEvent"
    drone_id: str


class SwarmStateChangedEvent(DomainEvent):
    event_type: str = "SwarmStateChangedEvent"
    swarm_id: str
    active_count: int


# --- Phase 10: Fault & Health Events ---
class FaultDetectedEvent(DomainEvent):
    event_type: str = "FaultDetectedEvent"
    fault: Dict[str, Any]


class FaultEscalatedEvent(DomainEvent):
    event_type: str = "FaultEscalatedEvent"
    fault: Dict[str, Any]


class FaultRecoveredEvent(DomainEvent):
    event_type: str = "FaultRecoveredEvent"
    fault: Dict[str, Any]


class ComponentHealthChangedEvent(DomainEvent):
    event_type: str = "ComponentHealthChangedEvent"
    drone_id: str
    component_id: str
    state: str


class DroneDegradedEvent(DomainEvent):
    event_type: str = "DroneDegradedEvent"
    drone_id: str
    reason: str


class DroneFailedEvent(DomainEvent):
    event_type: str = "DroneFailedEvent"
    drone_id: str
    reason: str


class FailsafeTriggeredEvent(DomainEvent):
    event_type: str = "FailsafeTriggeredEvent"
    drone_id: str
    action: str
    reason: str


class DistressReceivedEvent(DomainEvent):
    event_type: str = "DistressReceivedEvent"
    receiver_drone_id: str
    distress_drone_id: str
    fault: Dict[str, Any]

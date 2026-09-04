from pydantic import BaseModel, Field
from datetime import datetime, timezone
from typing import List, Optional, Literal, Tuple, Dict
import uuid

MissionStatus = Literal[
    "IDLE",
    "INITIALIZING",
    "PRE_FLIGHT_CHECK",
    "TAKEOFF",
    "TRANSIT",
    "SEARCHING",
    "INVESTIGATING",
    "RETURNING_HOME",
    "LANDING",
    "MISSION_COMPLETE",
    "PAUSED",
    "ABORTING",
    "FAILED",
]


class SearchArea(BaseModel):
    # Polygon represented by list of (lat, lon) coordinates
    boundaries: List[Tuple[float, float]]
    min_altitude: float = 10.0
    max_altitude: float = 100.0
    search_altitude: float = 30.0
    grid_spacing: float = 10.0  # meters
    entry_point: Tuple[float, float]
    exit_point: Tuple[float, float]


class Task(BaseModel):
    task_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    mission_id: str
    type: str  # GRID_SEARCH, INVESTIGATE, RETURN_HOME, TAKEOFF
    status: Literal[
        "PENDING",
        "ASSIGNED",
        "EXECUTING",
        "PAUSED",
        "COMPLETED",
        "FAILED",
        "CANCELLED",
        "EXPIRED",
        "UNASSIGNED",
    ] = "UNASSIGNED"
    assigned_drone: Optional[str] = None
    assignment_revision: int = 0
    assignment_timestamp: Optional[datetime] = None

    # Phase 7 spatial and priority fields
    location: Optional[SearchArea] = None  # Or single point in context
    priority: int = 1
    risk_level: float = 0.5
    required_capabilities: List[str] = Field(default_factory=list)
    estimated_duration: float = 0.0
    deadline: Optional[datetime] = None

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    retry_count: int = 0
    # Additional context specific to the task
    context: dict = Field(default_factory=dict)


class Mission(BaseModel):
    mission_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    mission_type: str = "SEARCH_AND_RESCUE"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    started_at: Optional[datetime] = None
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    status: MissionStatus = "IDLE"
    priority: int = 1
    search_area: SearchArea
    home_location: Tuple[float, float, float]  # lat, lon, alt
    assigned_drones: List[str] = Field(default_factory=list)
    tasks: List[Task] = Field(default_factory=list)
    mission_constraints: dict = Field(default_factory=dict)

    # Internal FSM tracking
    current_waypoint_index: int = 0
    generated_waypoints: List[Tuple[float, float, float]] = Field(default_factory=list)
    investigation_target: Optional[Dict[str, float]] = None  # x, y, z

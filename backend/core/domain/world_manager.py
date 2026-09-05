import asyncio
import logging
import uuid
from typing import List, Optional
from datetime import datetime, timezone
from core.domain.state import (
    WorldStateDomain,
    DroneState,
    Survivor,
    PositionState,
    VelocityState,
    BatteryState,
)
from core.domain.mission import Task
from core.domain.events import (
    DomainEvent,
    DroneRegistered,
    DroneTelemetryUpdated,
    BatteryUpdated,
    SensorStatusChanged,
    SurvivorDetected,
    TaskCreated,
    TaskAssigned,
    TaskCompleted,
    TaskFailed,
    DroneFailed,
    ObjectDetectedEvent,
    PotentialSurvivorEvent,
)

logger = logging.getLogger("world_manager")


class WorldManager:
    """
    Authoritative state manager for AEGIS Core.
    Mutates WorldStateDomain ONLY through validated DomainEvents.
    """

    def __init__(self, bus: Optional["MessageBus"] = None):
        self._state = WorldStateDomain()
        self._event_log: List[DomainEvent] = []
        self._lock = asyncio.Lock()
        self.bus = bus

        # Subscribe to telemetry events from the runtime physics loop
        if bus:
            bus.subscribe("drone.telemetry", self._on_drone_telemetry)

    @property
    def current_state(self) -> WorldStateDomain:
        """Returns a snapshot of the current authoritative state."""
        return self._state.model_copy(deep=True)

    def get_event_log(self) -> List[DomainEvent]:
        return list(self._event_log)

    async def _on_drone_telemetry(self, event):
        """
        Handles DroneTelemetryEvent published by AegisRuntime.tick().
        Updates drone position, velocity, battery, and status directly.
        """
        drone_id = event.drone_id
        if drone_id not in self._state.drones:
            # Auto-register drone if not present
            logger.debug(f"Auto-registering drone {drone_id} from telemetry")
            self._state.drones[drone_id] = DroneState(
                id=drone_id,
                callsign=f"DRONE-{drone_id}",
                last_heartbeat=datetime.now(timezone.utc),
            )

        drone = self._state.drones[drone_id]

        if hasattr(event, "position") and event.position:
            pos = event.position
            drone.pos = PositionState(x=pos[0], y=pos[1], z=pos[2])

        if hasattr(event, "velocity") and event.velocity:
            vel = event.velocity
            drone.vel = VelocityState(vx=vel[0], vy=vel[1], vz=vel[2])

        if hasattr(event, "battery") and event.battery is not None:
            drone.battery = BatteryState(percentage=event.battery)

        if hasattr(event, "status") and event.status:
            drone.status = event.status

        drone.last_heartbeat = datetime.now(timezone.utc)

    def seed_survivor(self, x: float, z: float, survivor_id: str = None) -> str:
        """
        Seeds a survivor into the world state at the given scene coordinates.
        Used when the user places survivors on the map before deploying.
        """
        sid = survivor_id or f"SURV-{str(uuid.uuid4())[:8]}"
        self._state.survivors[sid] = Survivor(
            id=sid,
            pos=PositionState(x=x, y=0.0, z=z),
            confidence=0.0,
            status="UNVERIFIED",
        )
        logger.info(f"Survivor seeded: {sid} at ({x:.1f}, {z:.1f})")
        return sid

    async def apply_event(self, event: DomainEvent) -> bool:
        """Validates and applies an event to the state."""
        async with self._lock:
            if not self._validate_event(event):
                logger.warning(
                    f"Event rejected: {event.event_type} (ID: {event.event_id})"
                )
                return False

            await self._apply_event_logic(event)
            self._event_log.append(event)
            return True

    def _validate_event(self, event: DomainEvent) -> bool:
        """Determines if an event is valid and ordered correctly."""
        now = datetime.now(timezone.utc)
        age = (now - event.timestamp).total_seconds()

        if age > 30.0:  # Relaxed to 30s for simulation (was 10s)
            logger.debug(f"Dropping stale event: {event.event_type} age={age:.1f}s")
            return False

        from core.domain.events import (
            DroneTelemetryUpdated,
            BatteryUpdated,
            SensorStatusChanged,
            CommunicationLinkChanged,
            TaskAssigned,
            TaskCompleted,
            TaskFailed,
        )

        if isinstance(
            event,
            (
                DroneTelemetryUpdated,
                BatteryUpdated,
                SensorStatusChanged,
                CommunicationLinkChanged,
            ),
        ):
            drone = self._state.drones.get(event.drone_id)
            if drone:
                if event.timestamp < drone.last_heartbeat:
                    return False

        if isinstance(event, (TaskAssigned, TaskCompleted, TaskFailed)):
            if event.task_id not in self._state.tasks:
                return False

        return True

    async def _apply_event_logic(self, event: DomainEvent):
        """Applies the event to the domain state."""
        if isinstance(event, DroneRegistered):
            if event.drone_id not in self._state.drones:
                self._state.drones[event.drone_id] = DroneState(
                    id=event.drone_id,
                    callsign=event.callsign,
                    last_heartbeat=datetime.now(timezone.utc),
                )

        elif isinstance(event, DroneTelemetryUpdated):
            if event.drone_id in self._state.drones:
                drone = self._state.drones[event.drone_id]
                drone.pos = event.pos
                drone.vel = event.vel
                drone.localization = event.localization
                drone.last_heartbeat = event.timestamp

        elif isinstance(event, BatteryUpdated):
            if event.drone_id in self._state.drones:
                drone = self._state.drones[event.drone_id]
                drone.battery = event.battery

        elif isinstance(event, SensorStatusChanged):
            pass

        elif isinstance(event, ObjectDetectedEvent):
            if event.class_name == "person" and event.confidence > 0.5:
                drone = self._state.drones.get(event.drone_id)
                if drone:
                    est_x = drone.pos.x
                    est_y = drone.pos.y
                    est_z = drone.pos.z

                    potential_event = PotentialSurvivorEvent(
                        source_id="WorldManager",
                        survivor_id=f"surv_{event.detection_id}",
                        drone_id=event.drone_id,
                        estimated_location={"x": est_x, "y": est_y, "z": est_z},
                        confidence=event.confidence,
                        evidence_sources=[event.source],
                    )

                    if self.bus:
                        asyncio.create_task(
                            self.bus.publish(
                                "mission.potential_survivor", potential_event
                            )
                        )

        elif isinstance(event, SurvivorDetected):
            if event.survivor_id not in self._state.survivors:
                self._state.survivors[event.survivor_id] = Survivor(
                    id=event.survivor_id,
                    pos=event.pos,
                    confidence=event.confidence,
                    detection_source=event.detection_source,
                    timestamp=event.timestamp,
                    status="TRACKED",
                )
            else:
                existing = self._state.survivors[event.survivor_id]
                if event.confidence > existing.confidence:
                    existing.confidence = event.confidence
                    existing.pos = event.pos
                existing.status = "TRACKED"

        elif isinstance(event, TaskCreated):
            from core.domain.mission import SearchArea

            loc = None
            if event.location_boundaries:
                loc = SearchArea(
                    boundaries=event.location_boundaries,
                    min_altitude=event.min_altitude,
                    max_altitude=event.max_altitude,
                    search_altitude=event.search_altitude,
                    grid_spacing=event.grid_spacing,
                    entry_point=event.location_boundaries[0],
                    exit_point=event.location_boundaries[-1],
                )

            self._state.tasks[event.task_id] = Task(
                task_id=event.task_id,
                mission_id=event.mission_id,
                type=event.task_type,
                priority=event.priority,
                required_capabilities=event.required_capabilities,
                location=loc,
            )

        elif isinstance(event, TaskAssigned):
            task = self._state.tasks[event.task_id]
            task.assigned_drone = event.drone_id
            task.status = "ASSIGNED"
            task.assignment_revision += 1
            task.assignment_timestamp = datetime.now(timezone.utc)
            if event.drone_id in self._state.drones:
                self._state.drones[event.drone_id].current_task_id = event.task_id

        elif isinstance(event, TaskCompleted):
            self._state.tasks[event.task_id].status = "COMPLETED"

        elif isinstance(event, TaskFailed):
            self._state.tasks[event.task_id].status = "FAILED"

        elif isinstance(event, DroneFailed):
            if event.drone_id in self._state.drones:
                self._state.drones[event.drone_id].status = "FAILED"
                self._state.drones[event.drone_id].mission_state = "FAILED"

        elif hasattr(event, "event_type") and event.event_type == "TaskUnassignedEvent":
            if event.task_id in self._state.tasks:
                self._state.tasks[event.task_id].status = "UNASSIGNED"
                self._state.tasks[event.task_id].assigned_drone = None

        elif hasattr(event, "event_type") and event.event_type == "TaskReassignedEvent":
            if event.task_id in self._state.tasks:
                task = self._state.tasks[event.task_id]
                task.status = "ASSIGNED"
                task.assigned_drone = event.new_drone_id
                task.assignment_revision += 1
                task.assignment_timestamp = datetime.now(timezone.utc)

    # ---------------------------------------------------------
    # QUERY METHODS
    # ---------------------------------------------------------

    def get_drone(self, drone_id: str) -> Optional[DroneState]:
        return self._state.drones.get(drone_id)

    def get_active_drones(self) -> List[DroneState]:
        return [d for d in self._state.drones.values() if d.status != "FAILED"]

    def get_failed_drones(self) -> List[DroneState]:
        return [d for d in self._state.drones.values() if d.status == "FAILED"]

    def get_survivors(self) -> List[Survivor]:
        return list(self._state.survivors.values())

    def get_active_tasks(self) -> List[Task]:
        return [
            t
            for t in self._state.tasks.values()
            if t.status
            in ("PENDING", "IN_PROGRESS", "UNASSIGNED", "ASSIGNED", "EXECUTING")
        ]

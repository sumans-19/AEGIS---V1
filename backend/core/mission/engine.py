import asyncio
import logging
import math
from typing import Optional, Dict, List
from datetime import datetime, timezone

from core.domain.mission import Mission, SearchArea
from core.domain.state import DroneState
from core.domain.events import (
    PotentialSurvivorEvent,
    MissionStateChangedEvent,
    TaskCreated,
    TaskAssigned,
    TaskUnassignedEvent,
    TaskReassignedEvent,
)
from core.flight.safety import SafetyValidator
from core.domain.commands import (
    TakeoffCommand,
    GotoCommand,
    EmergencyStopCommand,
    ReturnToHomeCommand,
    LandCommand,
)
from core.mission.planner import GridPlanner
from core.hardware.interfaces import FlightControllerInterface
from core.swarm.allocator import SwarmTaskAllocator

logger = logging.getLogger("mission_engine")


class MissionEngine:
    def __init__(
        self,
        world_manager,
        safety_validator: SafetyValidator,
        flight_controllers: Dict[str, FlightControllerInterface],
        bus=None,
    ):
        self.wm = world_manager
        self.safety = safety_validator
        # Dictionary mapping drone_id -> FlightControllerInterface
        self.fcs = flight_controllers
        self.bus = bus
        self.active_mission: Optional[Mission] = None
        self.allocator = SwarmTaskAllocator(message_bus=self.bus)

        self.min_battery_reserve = 15.0
        self._running = False
        self._pause_requested = False

        # Track per-drone execution state
        # dict: drone_id -> {"status": "IDLE", "waypoints": [], "current_wp_idx": 0, "investigation_target": None}
        self.drone_contexts: Dict[str, dict] = {}

        # Track handled distress events to prevent duplicate AI calls
        self._handled_distress = set()

        if self.bus:
            self.bus.subscribe(
                "mission.potential_survivor", self._on_potential_survivor
            )
            self.bus.subscribe("fault.detected", self._on_fault)
            self.bus.subscribe("fault.escalated", self._on_fault)
            self.bus.subscribe("network.distress_received", self._on_distress_received)

    async def _on_potential_survivor(self, event: PotentialSurvivorEvent):
        """Callback from WorldManager's perception aggregation."""
        drone_id = event.drone_id
        if not self.active_mission:
            return

        logger.info(
            f"[{drone_id}] Potential survivor detected. Creating INVESTIGATE task for Swarm Allocator."
        )

        from core.domain.events import TaskCreated

        task_id = f"investigate_{event.survivor_id}"

        # Don't create if already exists
        if task_id in self.wm.current_state.tasks:
            return

        tc = TaskCreated(
            source_id="MissionEngine",
            task_id=task_id,
            mission_id=self.active_mission.mission_id,
            task_type="INVESTIGATE",
            priority=10,  # Very high priority
            required_capabilities=["thermal_camera"],  # Ideally requires thermal
            location_boundaries=[
                (event.estimated_location["x"], event.estimated_location["z"])
            ],
            min_altitude=10.0,
            max_altitude=20.0,
            search_altitude=15.0,  # Descend for investigation
            grid_spacing=0.0,
        )
        if self.bus:
            await self.bus.publish("mission.task_created", tc)
        await self.wm.apply_event(tc)

    async def _on_distress_received(self, event):
        """Handle decentralized distress signal received over mesh network."""
        drone_id = event.distress_drone_id
        receiver = getattr(event, "receiver_drone_id", "unknown")
        logger.warning(
            f"[{receiver}] Received DISTRESS from {drone_id} over mesh network!"
        )

        if drone_id in self._handled_distress:
            return

        self._handled_distress.add(drone_id)

        from api.groq_client import generate_commander_assessment_sync
        import asyncio

        logger.info(f"[{receiver}] Triggering AI Swarm Commander for reallocation...")
        prompt = f"WHAT-IF SIMULATION: Drone {drone_id} has suffered a catastrophic failure (distress received by {receiver}). Reassess the swarm strategy and recommend a reallocation to cover its tasks. Return structured JSON."

        try:
            assessment = await asyncio.to_thread(
                generate_commander_assessment_sync, prompt
            )
            if assessment:
                rec_drone = assessment.get("recommended_drone_id")
                logger.info(
                    f"Swarm Commander recommends {rec_drone} to cover {drone_id}'s tasks. The internal SwarmTaskAllocator will reassign the task on next tick."
                )
        except Exception as e:
            logger.error(f"AI Reallocation failed: {e}")

    async def _on_fault(self, event):
        """Handle incoming fault events from FaultManager."""
        fault = event.fault
        drone_id = fault.get("drone_id")
        action = fault.get("recovery_action", "NONE")
        fault.get("severity", "INFO")

        if drone_id and drone_id in self.drone_contexts:
            ctx = self.drone_contexts[drone_id]
            logger.warning(
                f"[{drone_id}] MissionEngine handling fault: {fault.get('type')} with action: {action}"
            )

            if action == "EMERGENCY_STOP":
                ctx["status"] = "FAILED"
                await self._execute_command(
                    drone_id,
                    EmergencyStopCommand(drone_id=drone_id, source="MissionEngine"),
                )
            elif action == "LAND":
                ctx["status"] = "LANDING"
                await self._execute_command(
                    drone_id, LandCommand(drone_id=drone_id, source="MissionEngine")
                )
            elif action == "RTH":
                ctx["status"] = "RETURNING_HOME"
                await self._execute_command(
                    drone_id,
                    ReturnToHomeCommand(drone_id=drone_id, source="MissionEngine"),
                )
            elif action == "HOLD":
                if ctx["status"] not in ["FAILED", "LANDING", "RETURNING_HOME"]:
                    ctx["status"] = "FAILSAFE"  # Paused mid-air due to fault
            # If NONE, mission continues or SwarmAllocator will reassign the task if necessary.

    def _decompose_search_area(
        self, area: SearchArea, num_tasks: int
    ) -> List[SearchArea]:
        """Simple spatial decomposition cutting the bounding box along the latitude (x-axis)."""
        lats = [pt[0] for pt in area.boundaries]
        lons = [pt[1] for pt in area.boundaries]
        min_lat, max_lat = min(lats), max(lats)
        min_lon, max_lon = min(lons), max(lons)

        lat_step = (max_lat - min_lat) / max(1, num_tasks)
        sub_areas = []

        for i in range(num_tasks):
            s_lat = min_lat + (i * lat_step)
            e_lat = min_lat + ((i + 1) * lat_step)
            # Define new polygon
            bounds = [
                (s_lat, min_lon),
                (e_lat, min_lon),
                (e_lat, max_lon),
                (s_lat, max_lon),
            ]
            sa = SearchArea(
                boundaries=bounds,
                min_altitude=area.min_altitude,
                max_altitude=area.max_altitude,
                search_altitude=area.search_altitude,
                grid_spacing=area.grid_spacing,
                entry_point=(s_lat, min_lon),
                exit_point=(e_lat, max_lon),
            )
            sub_areas.append(sa)

        return sub_areas

    async def start_mission(self, mission: Mission):
        self.active_mission = mission
        self._running = True

        for d_id in mission.assigned_drones:
            self.drone_contexts[d_id] = {
                "status": "INITIALIZING",
                "waypoints": [],
                "current_wp_idx": 0,
                "investigation_target": None,
            }

        await self._transition_mission_state("INITIALIZING", "Mission started")

        # Decompose search area into tasks based on drone count (or fixed number)
        num_tasks = max(len(mission.assigned_drones), 5)
        sub_areas = self._decompose_search_area(mission.search_area, num_tasks)

        for i, sa in enumerate(sub_areas):
            task_id = f"task_search_{i}"
            tc = TaskCreated(
                source_id="MissionEngine",
                task_id=task_id,
                mission_id=mission.mission_id,
                task_type="GRID_SEARCH",
                priority=1,
                required_capabilities=[],
                location_boundaries=sa.boundaries,
                min_altitude=sa.min_altitude,
                max_altitude=sa.max_altitude,
                search_altitude=sa.search_altitude,
                grid_spacing=sa.grid_spacing,
            )
            if self.bus:
                await self.bus.publish("mission.task_created", tc)
            await self.wm.apply_event(tc)

        # Start the engine loop
        asyncio.create_task(self._engine_loop())

    async def abort_mission(self):
        """Forces all drones to immediately abort current tasks and return to base."""
        if not self.active_mission:
            return

        await self._transition_mission_state(
            "ABORTED", "Operator requested abort (RTH)"
        )

        for drone_id, ctx in self.drone_contexts.items():
            if ctx["status"] not in ["LANDING", "MISSION_COMPLETE"]:
                ctx["status"] = "RETURNING_HOME"

    async def _transition_mission_state(self, new_state: str, reason: str = ""):
        old_state = self.active_mission.status
        self.active_mission.status = new_state
        self.active_mission.updated_at = datetime.now(timezone.utc)

        event = MissionStateChangedEvent(
            source_id="MissionEngine",
            mission_id=self.active_mission.mission_id,
            old_state=old_state,
            new_state=new_state,
            reason=reason,
        )
        if self.bus:
            await self.bus.publish("mission.state_changed", event)

    async def _execute_command(self, drone_id: str, cmd) -> bool:
        """Runs the command through the SafetyValidator, then executes via FC."""
        state_snapshot = self.wm.current_state
        result = self.safety.validate(cmd, state_snapshot)

        if result.status == "ACCEPTED":
            fc = self.fcs.get(drone_id)
            if fc:
                fc_res = await fc.process_command(cmd)
                return fc_res.status == "ACCEPTED"
            return False
        else:
            logger.error(
                f"[{drone_id}] Command rejected by SafetyValidator: {result.reason}"
            )
            return False

    def _evaluate_battery(self, drone: DroneState) -> str:
        if drone.battery.percentage < 5.0:
            return "CRITICAL"
        if drone.battery.percentage < 20.0:
            return "LOW"
        return "NORMAL"

    async def _engine_loop(self):
        """The core tick loop of the multi-drone mission engine."""
        while self._running and self.active_mission:
            if self._pause_requested:
                if self.active_mission.status != "PAUSED":
                    await self._transition_mission_state(
                        "PAUSED", "Operator requested pause"
                    )
                await asyncio.sleep(1.0)
                continue

            state = self.wm.current_state

            # Phase 7: Dynamic Task Allocation (Swarm level)
            alloc_actions = self.allocator.allocate_tasks(state)
            for task_id, drone_id, action in alloc_actions:
                event = None
                topic = ""
                if action == "ASSIGNED":
                    logger.info(f"Allocator: Assigned {task_id} to {drone_id}")
                    event = TaskAssigned(
                        source_id="MissionEngine", task_id=task_id, drone_id=drone_id
                    )
                    topic = "mission.task_assigned"
                elif action == "REASSIGNED":
                    logger.info(f"Allocator: Reassigned {task_id} to {drone_id}")
                    event = TaskReassignedEvent(
                        source_id="MissionEngine",
                        task_id=task_id,
                        old_drone_id="unknown",
                        new_drone_id=drone_id,
                        reason="optimization",
                    )
                    topic = "mission.task_reassigned"
                elif action == "UNASSIGNED":
                    logger.warning(f"Allocator: Unassigned {task_id}")
                    event = TaskUnassignedEvent(
                        source_id="MissionEngine",
                        task_id=task_id,
                        reason="drone_invalid",
                    )
                    topic = "mission.task_unassigned"

                if event:
                    await self.wm.apply_event(event)
                    if self.bus:
                        await self.bus.publish(topic, event)

            # Phase 7: Individual Drone Processing
            all_complete = True
            for drone_id in self.active_mission.assigned_drones:
                if drone_id not in self.drone_contexts:
                    continue

                ctx = self.drone_contexts[drone_id]
                drone = state.drones.get(drone_id)

                if (
                    not drone
                    or drone.status == "FAILED"
                    or not drone.comms.mesh_connected
                ):
                    # Drone unavailable
                    if ctx["status"] not in ["FAILED", "OFFLINE"]:
                        ctx["status"] = "OFFLINE"
                    continue

                # Evaluate Battery
                batt_state = self._evaluate_battery(drone)
                if batt_state == "CRITICAL" and ctx["status"] not in ["ABORTING"]:
                    ctx["status"] = "ABORTING"

                    # Task Handoff Logic
                    current_task_id = drone.current_task_id
                    if current_task_id and current_task_id in self.wm._state.tasks:
                        self.wm._state.tasks[current_task_id].status = "UNASSIGNED"
                        self.wm._state.tasks[current_task_id].assigned_drone = None
                        drone.current_task_id = None

                    # Broadcast critical battery distress with handoff
                    from core.communication.models import (
                        NetworkMessage,
                        MessagePriority,
                    )
                    from core.runtime import aegis_runtime

                    router = aegis_runtime.message_routers.get(drone_id)
                    if router:
                        msg = NetworkMessage(
                            source_id=drone_id,
                            destination_id="BROADCAST",
                            message_type="DISTRESS",
                            priority=MessagePriority.CRITICAL,
                            payload={
                                "event_type": "DistressReceivedEvent",
                                "distress_drone_id": drone_id,
                                "handoff_task_id": current_task_id,
                                "fault": {
                                    "fault_type": "BATTERY_CRITICAL",
                                    "severity": "CRITICAL",
                                    "description": "Battery critically low, aborting.",
                                },
                            },
                        )
                        router.send_message(msg)

                    cmd = ReturnToHomeCommand(drone_id=drone_id, source="MissionEngine")
                    await self._execute_command(drone_id, cmd)
                    continue
                elif batt_state == "LOW" and ctx["status"] not in [
                    "RETURNING_HOME",
                    "LANDING",
                    "MISSION_COMPLETE",
                    "ABORTING",
                ]:
                    logger.warning(f"[{drone_id}] Low battery! Triggering RTH.")
                    ctx["status"] = "RETURNING_HOME"

                    # Task Handoff Logic
                    current_task_id = drone.current_task_id
                    if current_task_id and current_task_id in self.wm._state.tasks:
                        self.wm._state.tasks[current_task_id].status = "UNASSIGNED"
                        self.wm._state.tasks[current_task_id].assigned_drone = None
                        drone.current_task_id = None

                    # Broadcast low battery distress with handoff
                    from core.communication.models import (
                        NetworkMessage,
                        MessagePriority,
                    )
                    from core.runtime import aegis_runtime

                    router = aegis_runtime.message_routers.get(drone_id)
                    if router:
                        msg = NetworkMessage(
                            source_id=drone_id,
                            destination_id="BROADCAST",
                            message_type="DISTRESS",
                            priority=MessagePriority.HIGH,
                            payload={
                                "event_type": "DistressReceivedEvent",
                                "distress_drone_id": drone_id,
                                "handoff_task_id": current_task_id,
                                "fault": {
                                    "fault_type": "BATTERY_LOW",
                                    "severity": "LOW",
                                    "description": "Battery low, returning home.",
                                },
                            },
                        )
                        router.send_message(msg)

                # Check current task
                current_task_id = drone.current_task_id
                task = state.tasks.get(current_task_id) if current_task_id else None

                status = ctx["status"]

                if status != "MISSION_COMPLETE":
                    all_complete = False

                if status == "INITIALIZING":
                    ctx["status"] = "PRE_FLIGHT_CHECK"

                elif status == "PRE_FLIGHT_CHECK":
                    if (
                        drone.health.propeller_health > 50
                        and drone.localization.confidence > 0.5
                    ):
                        ctx["status"] = "TAKEOFF"
                    else:
                        ctx["status"] = "FAILED"

                elif status == "TAKEOFF":
                    target_alt = self.active_mission.search_area.search_altitude
                    cmd = TakeoffCommand(
                        drone_id=drone_id,
                        source="MissionEngine",
                        target_altitude=target_alt,
                    )
                    if await self._execute_command(drone_id, cmd):
                        if drone.pos.y >= (target_alt - 2.0):
                            ctx["status"] = "AWAITING_TASK"

                elif status == "TRANSIT":
                    if "astar_path" not in ctx:
                        from simulation.world_state import world
                        from core.mission.astar import AStarPlanner

                        planner = AStarPlanner(getattr(world, "terrain_grid", None))
                        target_x, target_z = 0.0, 0.0
                        if task and task.location and task.location.entry_point:
                            target_x, target_z = task.location.entry_point

                        ctx["astar_path"] = planner.plan(
                            (drone.pos.x, drone.pos.z),
                            (target_x, target_z),
                            (
                                task.location.search_altitude
                                if task and task.location
                                else self.active_mission.search_area.search_altitude
                            ),
                        )
                        ctx["current_wp_idx"] = 0

                    if ctx["current_wp_idx"] >= len(ctx["astar_path"]):
                        ctx.pop("astar_path", None)
                        ctx["status"] = ctx.get("post_transit_status", "AWAITING_TASK")
                        continue

                    target = ctx["astar_path"][ctx["current_wp_idx"]]
                    cmd = GotoCommand(
                        drone_id=drone_id,
                        source="MissionEngine",
                        target_x=target[0],
                        target_y=target[1],
                        target_z=target[2],
                    )
                    if await self._execute_command(drone_id, cmd):
                        dist = math.sqrt(
                            (drone.pos.x - target[0]) ** 2
                            + (drone.pos.z - target[2]) ** 2
                        )
                        if dist < 5.0:
                            ctx["current_wp_idx"] += 1

                elif status == "AWAITING_TASK":
                    if task and task.location:
                        if task.type == "GRID_SEARCH":
                            ctx["waypoints"] = GridPlanner.generate_waypoints(
                                task.location
                            )
                            ctx["current_wp_idx"] = 0
                            ctx.pop("astar_path", None)
                            ctx["status"] = "TRANSIT"
                            ctx["post_transit_status"] = "SEARCHING"
                        elif task.type == "INVESTIGATE":
                            ctx["investigate_target"] = task.location.entry_point
                            ctx.pop("astar_path", None)
                            ctx["status"] = "TRANSIT"
                            ctx["post_transit_status"] = "INVESTIGATING"

                elif status == "SEARCHING":
                    if not task or task.status == "UNASSIGNED":
                        # Task was ripped away by allocator
                        ctx["status"] = "AWAITING_TASK"
                        continue

                    if ctx["current_wp_idx"] >= len(ctx["waypoints"]):
                        logger.info(f"[{drone_id}] Task {current_task_id} complete.")
                        from core.domain.events import TaskCompleted

                        if self.bus:
                            await self.bus.publish(
                                "mission.task_completed",
                                TaskCompleted(
                                    source_id="MissionEngine", task_id=current_task_id
                                ),
                            )
                        ctx["status"] = "AWAITING_TASK"
                        continue

                    target = ctx["waypoints"][ctx["current_wp_idx"]]
                    # Waypoints are (x, y, z) in scene coords — pass directly
                    cmd = GotoCommand(
                        drone_id=drone_id,
                        source="MissionEngine",
                        target_x=target[0],
                        target_y=target[1],
                        target_z=target[2],
                    )

                    if await self._execute_command(drone_id, cmd):
                        # Advance waypoint when drone is close enough
                        dist = math.sqrt(
                            (drone.pos.x - target[0]) ** 2
                            + (drone.pos.z - target[2]) ** 2
                        )
                        if dist < 5.0:
                            ctx["current_wp_idx"] += 1
                            # Update drone status to SEARCHING for perception detection
                            if drone_id in self.wm._state.drones:
                                self.wm._state.drones[drone_id].status = "SEARCHING"

                elif status == "INVESTIGATING":
                    if "investigate_timer" not in ctx:
                        ctx["investigate_timer"] = 2.0  # seconds

                    ctx["investigate_timer"] -= 1.0

                    if ctx["investigate_timer"] <= 0:
                        logger.info(f"[{drone_id}] Investigation complete!")
                        survivor_id = (
                            current_task_id.replace("investigate_", "")
                            if current_task_id
                            else "unknown"
                        )

                        from core.domain.events import (
                            TaskCompleted,
                            SurvivorConfirmedEvent,
                        )

                        confirmed = SurvivorConfirmedEvent(
                            source_id="MissionEngine",
                            survivor_id=survivor_id,
                            drone_id=drone_id,
                            confirmed_location={
                                "x": drone.pos.x,
                                "y": drone.pos.y,
                                "z": drone.pos.z,
                            },
                            confidence=0.9,
                            evidence_sources=["sensor_fusion"],
                        )
                        if self.bus:
                            await self.bus.publish(
                                "mission.survivor_confirmed", confirmed
                            )
                            await self.bus.publish(
                                "mission.task_completed",
                                TaskCompleted(
                                    source_id="MissionEngine", task_id=current_task_id
                                ),
                            )

                        ctx["status"] = "AWAITING_TASK"
                        del ctx["investigate_timer"]

                elif status == "RETURNING_HOME":
                    base_pads = [
                        (-190.0, 2.0, -190.0),
                        (-170.0, 2.0, -190.0),
                        (-190.0, 2.0, -170.0),
                        (-170.0, 2.0, -170.0),
                        (-180.0, 2.0, -180.0),
                    ]
                    drone_idx = int(drone_id) - 1 if str(drone_id).isdigit() else 0
                    if 0 <= drone_idx < len(base_pads):
                        home = base_pads[drone_idx]
                    else:
                        home = self.active_mission.home_location

                    if "astar_path_home" not in ctx:
                        from simulation.world_state import world
                        from core.mission.astar import AStarPlanner

                        planner = AStarPlanner(getattr(world, "terrain_grid", None))
                        return_altitude = 50.0 + (
                            drone_idx * 5.0
                        )  # Stagger altitudes to prevent crashing
                        ctx["astar_path_home"] = planner.plan(
                            (drone.pos.x, drone.pos.z),
                            (home[0], home[2]),
                            return_altitude,
                        )
                        ctx["current_wp_idx"] = 0

                    if ctx["current_wp_idx"] >= len(ctx["astar_path_home"]):
                        # Wait until directly above base pad
                        dist = math.sqrt(
                            (drone.pos.x - home[0]) ** 2 + (drone.pos.z - home[2]) ** 2
                        )
                        if dist < 2.0:
                            ctx["status"] = "LANDING"
                            del ctx["astar_path_home"]
                        else:
                            # keep sending to last point
                            return_altitude = 50.0 + (drone_idx * 5.0)
                            cmd = GotoCommand(
                                drone_id=drone_id,
                                source="MissionEngine",
                                target_x=home[0],
                                target_y=return_altitude,
                                target_z=home[2],
                                is_rth=True,
                            )
                            await self._execute_command(drone_id, cmd)
                        continue

                    target = ctx["astar_path_home"][ctx["current_wp_idx"]]
                    cmd = GotoCommand(
                        drone_id=drone_id,
                        source="MissionEngine",
                        target_x=target[0],
                        target_y=target[1],
                        target_z=target[2],
                        is_rth=True,
                    )
                    await self._execute_command(drone_id, cmd)
                    dist = math.sqrt(
                        (drone.pos.x - target[0]) ** 2 + (drone.pos.z - target[2]) ** 2
                    )
                    if dist < 5.0:
                        ctx["current_wp_idx"] += 1

                elif status == "LANDING":
                    cmd = LandCommand(drone_id=drone_id, source="MissionEngine")
                    await self._execute_command(drone_id, cmd)
                    if drone.pos.y < 3.0:
                        ctx["status"] = "CHARGING"
                        if drone_id in self.wm._state.drones:
                            self.wm._state.drones[drone_id].status = "CHARGING"

                elif status == "CHARGING":
                    # Simulate rapid battery recovery
                    if drone_id in self.wm._state.drones:
                        d = self.wm._state.drones[drone_id]
                        d.battery.percentage = min(100.0, d.battery.percentage + 1.0)
                        if d.battery.percentage >= 99.0:
                            logger.info(
                                f"[{drone_id}] Fully charged. Ready for redeployment."
                            )
                            ctx["status"] = "AWAITING_TASK"
                            d.status = "IDLE"

            # If all drones are complete, mission is complete
            # Or if there are no more active tasks
            active_tasks = [
                t
                for t in state.tasks.values()
                if t.status in ("UNASSIGNED", "PENDING", "ASSIGNED", "EXECUTING")
            ]
            if all_complete and not active_tasks:
                if self.active_mission.status != "MISSION_COMPLETE":
                    await self._transition_mission_state(
                        "MISSION_COMPLETE", "All tasks done"
                    )
                    self._running = False

            await asyncio.sleep(1.0)

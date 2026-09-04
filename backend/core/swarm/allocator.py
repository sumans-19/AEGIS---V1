import logging
import math
from typing import List, Tuple
from core.domain.state import DroneState, WorldStateDomain
from core.domain.mission import Task

logger = logging.getLogger("swarm_allocator")


class SwarmTaskAllocator:
    """
    Deterministic task allocator for AEGIS Swarm.
    Evaluates drones based on capabilities, battery, distance, communication, and priority.
    """

    def __init__(self, message_bus=None):
        self.bus = message_bus

        # Scoring weights
        self.BATTERY_WEIGHT = 1.0
        self.DISTANCE_WEIGHT = 2.0
        self.CAPABILITY_WEIGHT = 3.0
        self.PRIORITY_WEIGHT = 2.0

        # Hysteresis: new score must be this much higher than current to trigger reassignment
        self.REASSIGNMENT_MARGIN = 10.0

    def _check_capabilities(self, drone: DroneState, task: Task) -> bool:
        """Hard gate for capabilities."""
        if not task.required_capabilities:
            return True
        for req in task.required_capabilities:
            if not getattr(drone.capabilities, req, False):
                return False
        return True

    def _check_battery_safety(self, drone: DroneState, task: Task) -> bool:
        """Hard gate for battery life."""
        # Minimum safe operation limit is 15% (could be dynamic based on distance to home)
        if drone.battery.percentage < 15.0:
            return False
        return True

    def _calculate_distance(self, p1, p2) -> float:
        if not p1 or not p2:
            return 0.0
        return math.sqrt((p1.x - p2.x) ** 2 + (p1.z - p2.z) ** 2)

    def compute_score(self, drone: DroneState, task: Task) -> float:
        """Returns the suitability score of a drone for a given task."""
        if not self._check_capabilities(drone, task):
            return 0.0

        if not self._check_battery_safety(drone, task):
            return 0.0

        score = 0.0

        # 1. Battery Score (0-100 normalized)
        score += drone.battery.percentage * self.BATTERY_WEIGHT

        # 2. Distance Score (Inverted: closer is higher)
        dist = 0.0
        if task.location and task.location.entry_point:
            # We assume coordinates are small cartesian values for simulation
            target_x, target_z = task.location.entry_point
            dist = math.sqrt(
                (drone.pos.x - target_x) ** 2 + (drone.pos.z - target_z) ** 2
            )

        # Example formula: max 100 points, losing 1 point per 10 meters
        distance_points = max(0, 100 - (dist / 10.0))
        score += distance_points * self.DISTANCE_WEIGHT

        # 3. Capability Bonus
        # E.g. if the task requires thermal and the drone has thermal, they pass the gate.
        # But if the drone also has Lidar (which is not strictly required but could be useful),
        # we might give a small bonus. Or if the drone perfectly matches without wasting capacity.
        # For now, base capability passing is enough.

        # 4. Priority Score
        score += task.priority * 10 * self.PRIORITY_WEIGHT

        # 5. Communication Score
        if drone.comms.mesh_connected:
            # High signal strength adds points. High packet loss removes points heavily.
            comm_score = drone.comms.signal_strength * 0.5
            penalty = (
                drone.comms.packet_loss * 100.0
            )  # up to 100 points penalty for 100% loss
            score += max(0, comm_score - penalty)

        return score

    def allocate_tasks(
        self, world_state: WorldStateDomain
    ) -> List[Tuple[str, str, str]]:
        actions = []

        active_tasks = [
            t
            for t in world_state.tasks.values()
            if t.status in ("UNASSIGNED", "PENDING", "ASSIGNED", "EXECUTING")
        ]
        active_drones = [
            d
            for d in world_state.drones.values()
            if d.status != "FAILED" and d.comms.mesh_connected
        ]

        # Sort tasks by priority DESC
        active_tasks.sort(key=lambda t: t.priority, reverse=True)

        # Drones that have been assigned a task during THIS allocation tick
        # This prevents a lower-priority task from stealing back a drone
        assigned_this_tick = set()

        # Pre-calculate which drones are bound to which tasks currently
        current_bindings = {
            t.assigned_drone: t.task_id for t in active_tasks if t.assigned_drone
        }

        for task in active_tasks:
            best_drone = None

            current_drone_id = task.assigned_drone
            current_drone_valid = False
            current_score = 0.0

            # If the current drone hasn't been stolen by a higher priority task this tick
            if current_drone_id and current_drone_id not in assigned_this_tick:
                if current_drone_id in world_state.drones:
                    cd = world_state.drones[current_drone_id]
                    if cd.status != "FAILED" and cd.comms.mesh_connected:
                        current_score = self.compute_score(cd, task)
                        if current_score > 0:
                            current_drone_valid = True

            candidates = []
            for drone in active_drones:
                # If drone was already assigned to a higher priority task this tick, skip
                if drone.id in assigned_this_tick:
                    continue

                score = self.compute_score(drone, task)
                if score > 0:
                    dist = 0
                    if task.location:
                        dist = math.sqrt(
                            (drone.pos.x - task.location.entry_point[0]) ** 2
                            + (drone.pos.z - task.location.entry_point[1]) ** 2
                        )
                    candidates.append((score, dist, drone.battery.percentage, drone.id))

            if not candidates:
                if current_drone_id and not current_drone_valid:
                    actions.append((task.task_id, current_drone_id, "UNASSIGNED"))
                continue

            candidates.sort(key=lambda c: (-c[0], c[1], -c[2], c[3]))

            top_candidate = candidates[0]
            top_drone_id = top_candidate[3]
            top_score = top_candidate[0]

            if not current_drone_id:
                # New assignment
                best_drone = top_drone_id
                actions.append((task.task_id, best_drone, "ASSIGNED"))
                assigned_this_tick.add(best_drone)
            else:
                if top_drone_id != current_drone_id:
                    # If the top candidate is the current drone of ANOTHER lower priority task,
                    # we can steal it if the score exceeds margin.
                    # Or if current_drone is invalid (stolen by a higher priority task or failed)
                    if (
                        top_score > (current_score + self.REASSIGNMENT_MARGIN)
                        or not current_drone_valid
                    ):
                        best_drone = top_drone_id
                        actions.append((task.task_id, best_drone, "REASSIGNED"))
                        assigned_this_tick.add(best_drone)
                    else:
                        best_drone = current_drone_id
                        assigned_this_tick.add(best_drone)
                else:
                    best_drone = current_drone_id
                    assigned_this_tick.add(best_drone)

        return actions

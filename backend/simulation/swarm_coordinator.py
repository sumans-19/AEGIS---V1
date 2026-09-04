import numpy as np
from simulation.world_state import world, LogEntry


def get_uncovered_cells(zone):
    """Return a list of (ix, iy) cells in the given zone that are not fully covered."""
    uncovered = []
    if not zone:
        return uncovered
    x1, y1, x2, y2 = zone
    for ix in range(x1, x2):
        for iy in range(y1, y2):
            if world.zone_coverage[ix, iy] < 0.1:
                uncovered.append((ix, iy))
    return uncovered


def rebalance_zones(world_state):
    """Detects offline/returning drones and reallocates their uncovered cells to active drones."""
    active_drones = [
        d for d in world_state.drones if d.status in ("SCANNING", "SEARCHING")
    ]
    inactive_drones = [
        d for d in world_state.drones if d.status not in ("SCANNING", "SEARCHING")
    ]

    if not active_drones:
        return

    uncovered_total = []

    # Collect all uncovered cells from inactive drones' assigned zones
    for drone in inactive_drones:
        if hasattr(drone, "assigned_zone") and drone.assigned_zone:
            uncovered_total.extend(get_uncovered_cells(drone.assigned_zone))
            drone.assigned_zone = None  # Clear assigned zone once redistributed

    if not uncovered_total:
        return

    # Simply assign the uncovered cells to the active drones using an auction mechanism
    auction_cells(world_state, active_drones, uncovered_total)

    world_state.event_log.append(
        LogEntry(
            world_state.sim_time,
            None,
            "system",
            f"SWARM REBALANCED: {len(uncovered_total)} cells reallocated to {len(active_drones)} active drones.",
        )
    )


def auction_cells(world_state, active_drones, cells):
    """Auction cells to the nearest active drone to expand their assigned zones conceptually.
    For simplicity, we'll just expand the bounding boxes of assigned_zones for active drones.
    """
    for ix, iy in cells:
        # Find nearest active drone to this cell
        cell_world_pos = np.array([ix * 5 - 250, 20.0, iy * 5 - 250])
        best_drone = min(
            active_drones, key=lambda d: np.linalg.norm(d.pos - cell_world_pos)
        )

        # Expand that drone's assigned zone to encompass this cell
        if not hasattr(best_drone, "assigned_zone") or best_drone.assigned_zone is None:
            best_drone.assigned_zone = (ix, iy, ix + 1, iy + 1)
        else:
            x1, y1, x2, y2 = best_drone.assigned_zone
            x1 = min(x1, ix)
            x2 = max(x2, ix + 1)
            y1 = min(y1, iy)
            y2 = max(y2, iy + 1)
            best_drone.assigned_zone = (x1, y1, x2, y2)


def allocate_tasks(world_state):
    """
    Centralized Task Allocator:
    Evaluates all drone-task combinations and assigns tasks globally using hard constraints and a robust scoring system.
    """
    unassigned_tasks = [
        t for t in world_state.task_queue.values() if t.assigned_drone_id is None
    ]
    if not unassigned_tasks:
        return

    available_drones = [
        d
        for d in world_state.drones
        if d.current_task_id is None and d.status not in ("RETURNING", "CHARGING")
    ]
    if not available_drones:
        return

    # Sort tasks by priority (highest first)
    unassigned_tasks.sort(key=lambda t: t.priority, reverse=True)

    for task in unassigned_tasks:
        best_drone = None
        best_score = -float("inf")

        for drone in available_drones:
            # 1. HARD CONSTRAINTS
            if drone.battery < task.required_battery:
                continue

            # Check sensors
            sensors_ok = True
            for req_sensor in task.required_sensors:
                if req_sensor == "thermal" and not drone.thermal_status:
                    sensors_ok = False
                elif req_sensor == "camera" and not drone.camera_status:
                    sensors_ok = False
                elif req_sensor == "lidar" and not drone.lidar_status:
                    sensors_ok = False

            if not sensors_ok:
                continue

            # 2. SCORE CANDIDATES
            # Wd × DistanceScore + Wb × BatteryScore + Wc × CommunicationScore + Ws × SensorCapabilityScore + Wp × PriorityScore + Wr × RiskScore + Wt × TimeScore

            dist = 0
            if task.location is not None:
                dist = np.linalg.norm(drone.pos - task.location)
            elif task.zone is not None:
                z_x1, z_y1, z_x2, z_y2 = task.zone
                center_x = (z_x1 + z_x2) / 2 * 5 - 250
                center_y = (z_y1 + z_y2) / 2 * 5 - 250
                dist = np.linalg.norm(drone.pos - np.array([center_x, 20.0, center_y]))

            distance_score = max(0, 100 - dist) / 100.0  # Normalized roughly 0 to 1
            battery_score = drone.battery / 100.0
            comm_score = drone.signal_strength / 100.0
            sensor_score = (
                int(drone.thermal_status)
                + int(drone.camera_status)
                + int(drone.lidar_status)
            ) / 3.0
            priority_score = min(task.priority / 10.0, 1.0)
            risk_score = drone.propeller_health / 100.0

            # Weights
            Wd, Wb, Wc, Ws, Wp, Wr = 2.0, 1.0, 1.0, 1.5, 2.0, 1.0

            total_score = (
                Wd * distance_score
                + Wb * battery_score
                + Wc * comm_score
                + Ws * sensor_score
                + Wp * priority_score
                + Wr * risk_score
            )

            if total_score > best_score:
                best_score = total_score
                best_drone = drone

        if best_drone:
            # Assign task
            task.assigned_drone_id = best_drone.id
            best_drone.current_task_id = task.id
            best_drone.current_task_type = task.type
            if task.zone:
                best_drone.assigned_zone = task.zone

            available_drones.remove(best_drone)
            world_state.event_log.append(
                LogEntry(
                    world_state.sim_time,
                    best_drone.id,
                    "system",
                    f"Assigned task {task.type} (ID: {task.id})",
                )
            )


def process_commander_assessment(assessment: dict, trigger_event: str):
    """
    Called asynchronously when Groq provides a JSON recommendation.
    Validates it deterministically against constraints.
    """
    action = assessment.get("recommended_action")
    drone_id = assessment.get("recommended_drone_id")
    task_type = assessment.get("priority")
    reason = assessment.get("reason", "")
    trade_offs = assessment.get("trade_offs", {})
    why_not = trade_offs.get("why_not_others", "")

    # 1. Base Commander Assessment Log
    world.event_log.append(
        LogEntry(world.sim_time, None, "critical", f"COMMANDER ASSESSMENT: {reason}")
    )

    if why_not:
        world.event_log.append(
            LogEntry(world.sim_time, None, "system", f"TRADE-OFFS: {why_not}")
        )

    if action == "REALLOCATE" and drone_id is not None:
        drone = next((d for d in world.drones if d.id == drone_id), None)
        if not drone:
            return

        # Deterministic Validation
        # Find highest priority task matching task_type
        target_task = None
        for t in sorted(
            world.task_queue.values(), key=lambda t: t.priority, reverse=True
        ):
            if t.type == task_type and t.assigned_drone_id is None:
                target_task = t
                break

        if target_task:
            # Check hard constraints
            valid = True
            if drone.battery < target_task.required_battery:
                valid = False
            for req_sensor in target_task.required_sensors:
                if req_sensor == "thermal" and not drone.thermal_status:
                    valid = False
                elif req_sensor == "camera" and not drone.camera_status:
                    valid = False
                elif req_sensor == "lidar" and not drone.lidar_status:
                    valid = False

            if valid:
                # Apply recommendation!
                if drone.current_task_id:
                    # Free up old task
                    old_task = world.task_queue.get(drone.current_task_id)
                    if old_task:
                        old_task.assigned_drone_id = None

                target_task.assigned_drone_id = drone.id
                drone.current_task_id = target_task.id
                drone.current_task_type = target_task.type
                if target_task.zone:
                    drone.assigned_zone = target_task.zone

                world.event_log.append(
                    LogEntry(
                        world.sim_time,
                        drone.id,
                        "system",
                        f"STRATEGIC OVERRIDE: Assigned task {target_task.type} (ID: {target_task.id}) per Commander recommendation.",
                    )
                )
            else:
                world.event_log.append(
                    LogEntry(
                        world.sim_time,
                        drone.id,
                        "warning",
                        f"COMMANDER RECOMMENDATION REJECTED: Drone {drone.id} fails hard constraints for {target_task.type}.",
                    )
                )

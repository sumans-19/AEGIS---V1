import numpy as np
import heapq
import random
from simulation.world_state import world


def get_grid_cost(ix, iy):
    # base_cost = 1.0, damage > 0.8: cost += 2.0, gas leak: cost += 10.0, unscanned preference
    if not (0 <= ix < 100 and 0 <= iy < 100):
        return -1
    cost = 1.0
    damage = world.terrain_grid[ix, iy]
    if damage > 0.8:
        return -1  # Buildings are completely impassable
    # Scan coverage (scanned cells are preferred slightly less to push outward)
    if world.zone_coverage[ix, iy] > 0:
        cost += 3.0
    # Hazard zones (gas/fire)
    for hazard in world.hazard_zones:
        # Distance check (hazard in world coords, our grid ix, iy mapped 5m per cell)
        hx, hy = hazard["center"]
        grid_hx, grid_hy = int((hx + 250) / 5), int((hy + 250) / 5)
        dist = np.sqrt((ix - grid_hx) ** 2 + (iy - grid_hy) ** 2)  # grid radius approx
        if dist < hazard["radius"] / 5:
            cost += 10.0
    return cost


def a_star(start_grid, goal_grid):
    # grid coords are [ix, iy]
    rows, cols = 100, 100
    pq = [(0, start_grid)]
    came_from = {}
    cost_so_far = {tuple(start_grid): 0}

    while pq:
        _, current = heapq.heappop(pq)
        cur_ix, cur_iy = current

        if current == goal_grid:
            break

        for dx, dy in [
            (-1, 0),
            (1, 0),
            (0, -1),
            (0, 1),
            (-1, -1),
            (1, 1),
            (-1, 1),
            (1, -1),
        ]:
            neighbor = (cur_ix + dx, cur_iy + dy)
            if 0 <= neighbor[0] < rows and 0 <= neighbor[1] < cols:
                cell_cost = get_grid_cost(neighbor[0], neighbor[1])
                if cell_cost < 0:
                    continue  # Impassable
                new_cost = cost_so_far[tuple(current)] + cell_cost
                if neighbor not in cost_so_far or new_cost < cost_so_far[neighbor]:
                    cost_so_far[neighbor] = new_cost
                    # Heuristic = Euclidean to goal
                    priority = new_cost + np.linalg.norm(
                        np.array(neighbor) - np.array(goal_grid)
                    )
                    heapq.heappush(pq, (priority, neighbor))
                    came_from[neighbor] = current

    # Return path as list of [ix, iy]
    if tuple(goal_grid) not in came_from:
        return []

    path = []
    curr = tuple(goal_grid)
    while curr in came_from:
        path.append(curr)
        curr = came_from[curr]
    path.reverse()
    return path


def update_all_trajectories():
    from simulation.world_state import LogEntry

    for drone in world.drones:
        # Re-evaluate current trajectory if it goes through a hazard
        if drone.trajectory:
            reroute = False
            for wp in drone.trajectory[:3]:
                wp_ix = int((wp[0] + 250) / 5)
                wp_iy = int((wp[2] + 250) / 5)
                if get_grid_cost(wp_ix, wp_iy) >= 10.0:
                    reroute = True
                    break
            if reroute:
                drone.trajectory = []
                world.event_log.append(
                    LogEntry(
                        world.sim_time,
                        drone.id,
                        "warning",
                        f"Hazard detected on path, rerouting...",
                    )
                )

        # Pop next waypoint if reached previous target
        if drone.current_target is None and drone.trajectory:
            drone.current_target = drone.trajectory.pop(0)

        # If no path, plan according to current task
        if not drone.trajectory and drone.status not in ("RETURNING", "IDLE"):
            cur_ix, cur_iy = int((drone.pos[0] + 250) / 5), int(
                (drone.pos[2] + 250) / 5
            )
            cur_ix, cur_iy = min(99, max(0, cur_ix)), min(99, max(0, cur_iy))
            target_grid = None

            if drone.current_task_type == "SEARCH" and drone.assigned_zone:
                z_x1, z_y1, z_x2, z_y2 = drone.assigned_zone
                candidates = []
                for ix in range(z_x1, z_x2):
                    for iy in range(z_y1, z_y2):
                        if world.zone_coverage[ix, iy] < 0.1:
                            candidates.append((ix, iy))
                if candidates:
                    target_grid = random.choice(candidates)
            elif (
                drone.current_task_type in ["INVESTIGATE", "TRACK_SURVIVOR", "RELAY"]
                and drone.current_task_id
            ):
                task = world.task_queue.get(drone.current_task_id)
                if task and task.location is not None:
                    target_grid = (
                        int((task.location[0] + 250) / 5),
                        int((task.location[2] + 250) / 5),
                    )
                    target_grid = (
                        min(99, max(0, target_grid[0])),
                        min(99, max(0, target_grid[1])),
                    )
            elif (
                drone.status == "SCANNING"
                and hasattr(drone, "assigned_zone")
                and drone.assigned_zone
            ):
                z_x1, z_y1, z_x2, z_y2 = drone.assigned_zone
                candidates = []
                for ix in range(z_x1, z_x2):
                    for iy in range(z_y1, z_y2):
                        if world.zone_coverage[ix, iy] < 0.1:
                            candidates.append((ix, iy))
                if candidates:
                    target_grid = random.choice(candidates)

            if target_grid:
                grid_path = a_star((cur_ix, cur_iy), target_grid)
                path_world = []
                for ix, iy in grid_path:
                    path_world.append([ix * 5 - 250, 30.0, iy * 5 - 250])

                drone.trajectory = [np.array(p) for p in path_world]
                if drone.trajectory:
                    drone.current_target = drone.trajectory.pop(0)

        # Mark current grid pos as scanned
        cur_ix, cur_iy = int((drone.pos[0] + 250) / 5), int((drone.pos[2] + 250) / 5)
        if 0 <= cur_ix < 100 and 0 <= cur_iy < 100:
            world.zone_coverage[cur_ix, cur_iy] = 1.0

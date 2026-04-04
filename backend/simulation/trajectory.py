import numpy as np
import heapq
import random
from simulation.world_state import world, DroneState

def get_grid_cost(ix, iy):
    # base_cost = 1.0, damage > 0.8: cost += 2.0, gas leak: cost += 10.0, unscanned preference
    if not (0 <= ix < 20 and 0 <= iy < 20):
        return 1e6
    cost = 1.0
    damage = world.terrain_grid[ix, iy]
    if damage > 0.8:
        cost += 2.0
    # Scan coverage (scanned cells are preferred slightly less to push outward)
    if world.zone_coverage[ix, iy] > 0:
        cost += 3.0
    # Hazard zones (gas/fire)
    for hazard in world.hazard_zones:
        # Distance check (hazard in world coords, our grid ix, iy mapped 5m per cell)
        hx, hy = hazard["center"]
        grid_hx, grid_hy = int((hx + 50) / 5), int((hy + 50) / 5)
        dist = np.sqrt((ix - grid_hx)**2 + (iy - grid_hy)**2) # grid radius approx
        if dist < hazard["radius"] / 5:
            cost += 10.0
    return cost

def a_star(start_grid, goal_grid):
    # grid coords are [ix, iy]
    rows, cols = 20, 20
    pq = [(0, start_grid)]
    came_from = {}
    cost_so_far = {tuple(start_grid): 0}
    
    while pq:
        _, current = heapq.heappop(pq)
        cur_ix, cur_iy = current
        
        if current == goal_grid:
            break
            
        for dx, dy in [(-1,0), (1,0), (0,-1), (0,1), (-1,-1), (1,1), (-1,1), (1,-1)]:
            neighbor = (cur_ix + dx, cur_iy + dy)
            if 0 <= neighbor[0] < rows and 0 <= neighbor[1] < cols:
                new_cost = cost_so_far[tuple(current)] + get_grid_cost(neighbor[0], neighbor[1])
                if neighbor not in cost_so_far or new_cost < cost_so_far[neighbor]:
                    cost_so_far[neighbor] = new_cost
                    # Heuristic = Euclidean to goal
                    priority = new_cost + np.linalg.norm(np.array(neighbor) - np.array(goal_grid))
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
    for drone in world.drones:
        # If scanning and no path, find next patrol waypoints
        if drone.status == "SCANNING" and not drone.trajectory:
            # Plan new patrol for assigned zone (unscanned biased)
            z_x1, z_y1, z_x2, z_y2 = drone.assigned_zone
            # Find an unscanned cell in the zone
            candidates = []
            for ix in range(z_x1, z_x2):
                for iy in range(z_y1, z_y2):
                    if world.zone_coverage[ix, iy] < 0.1:
                        candidates.append((ix, iy))
            
            if candidates:
                # Simple nearest neighbor heuristic for patrol
                cur_ix, cur_iy = int((drone.pos[0] + 50) / 5), int((drone.pos[2] + 50) / 5)
                # Clamp locally
                cur_ix, cur_iy = min(19, max(0, cur_ix)), min(19, max(0, cur_iy))
                
                target = random.choice(candidates)
                grid_path = a_star((cur_ix, cur_iy), target)
                
                # Convert grid to world
                path_world = []
                for ix, iy in grid_path:
                    # z = terrain_height + clearance (let's use constant 20m for now)
                    path_world.append([ix * 5 - 50, 20.0, iy * 5 - 50])
                
                drone.trajectory = [np.array(p) for p in path_world]
                if drone.trajectory:
                    drone.current_target = drone.trajectory.pop(0)

            # Mark current grid pos as scanned
            cur_ix, cur_iy = int((drone.pos[0] + 50) / 5), int((drone.pos[2] + 50) / 5)
            if 0 <= cur_ix < 20 and 0 <= cur_iy < 20:
                world.zone_coverage[cur_ix, cur_iy] = 1.0



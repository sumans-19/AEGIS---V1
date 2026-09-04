import heapq
import numpy as np
from typing import List, Tuple


class AStarPlanner:
    def __init__(
        self, terrain_grid: np.ndarray, grid_size: float = 5.0, offset: float = 250.0
    ):
        self.terrain_grid = terrain_grid
        self.grid_size = grid_size
        self.offset = offset
        if self.terrain_grid is not None:
            self.max_x, self.max_y = self.terrain_grid.shape
        else:
            self.max_x, self.max_y = 100, 100

    def world_to_grid(self, x: float, z: float) -> Tuple[int, int]:
        ix = int((x + self.offset) / self.grid_size)
        iy = int((z + self.offset) / self.grid_size)
        return (max(0, min(self.max_x - 1, ix)), max(0, min(self.max_y - 1, iy)))

    def grid_to_world(self, ix: int, iy: int) -> Tuple[float, float]:
        x = (ix * self.grid_size) - self.offset
        z = (iy * self.grid_size) - self.offset
        return (x, z)

    def plan(
        self,
        start_world: Tuple[float, float],
        goal_world: Tuple[float, float],
        altitude: float,
    ) -> List[Tuple[float, float, float]]:
        if self.terrain_grid is None:
            # Fallback to direct path
            return [(goal_world[0], altitude, goal_world[1])]

        start = self.world_to_grid(start_world[0], start_world[1])
        goal = self.world_to_grid(goal_world[0], goal_world[1])

        open_set = []
        heapq.heappush(open_set, (0, start))
        came_from = {}

        g_score = {start: 0}
        f_score = {start: self.heuristic(start, goal)}

        while open_set:
            _, current = heapq.heappop(open_set)

            if current == goal:
                return self.reconstruct_path(came_from, current, altitude, goal_world)

            for neighbor in self.get_neighbors(current):
                # High cost for buildings/obstacles (>0.7)
                obstacle_cost = self.terrain_grid[neighbor[0], neighbor[1]]
                # If it's a building and we are flying low, huge penalty or impassable
                if obstacle_cost > 0.7 and altitude < 45.0:
                    cost_to_move = 100.0  # highly penalize
                else:
                    cost_to_move = 1.0 + (obstacle_cost * 2.0)

                # Diagonal distance check
                dist = (
                    1.414
                    if (neighbor[0] != current[0] and neighbor[1] != current[1])
                    else 1.0
                )
                tentative_g_score = g_score[current] + cost_to_move * dist

                if neighbor not in g_score or tentative_g_score < g_score[neighbor]:
                    came_from[neighbor] = current
                    g_score[neighbor] = tentative_g_score
                    f = tentative_g_score + self.heuristic(neighbor, goal)
                    f_score[neighbor] = f
                    heapq.heappush(open_set, (f, neighbor))

        # Fallback to direct if no path
        return [(goal_world[0], altitude, goal_world[1])]

    def get_neighbors(self, node: Tuple[int, int]) -> List[Tuple[int, int]]:
        neighbors = []
        for dx in [-1, 0, 1]:
            for dy in [-1, 0, 1]:
                if dx == 0 and dy == 0:
                    continue
                nx, ny = node[0] + dx, node[1] + dy
                if 0 <= nx < self.max_x and 0 <= ny < self.max_y:
                    neighbors.append((nx, ny))
        return neighbors

    def heuristic(self, a: Tuple[int, int], b: Tuple[int, int]) -> float:
        # Euclidean distance
        return ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) ** 0.5

    def reconstruct_path(
        self,
        came_from: dict,
        current: Tuple[int, int],
        altitude: float,
        exact_goal: Tuple[float, float],
    ) -> List[Tuple[float, float, float]]:
        path_grid = [current]
        while current in came_from:
            current = came_from[current]
            path_grid.append(current)
        path_grid.reverse()

        waypoints = []
        for idx, (ix, iy) in enumerate(path_grid):
            # Take every 3rd point to avoid too many tiny waypoints, but always include start and end
            if idx == 0 or idx == len(path_grid) - 1 or idx % 3 == 0:
                x, z = self.grid_to_world(ix, iy)
                waypoints.append((x, altitude, z))

        # Ensure exact goal is reached
        waypoints[-1] = (exact_goal[0], altitude, exact_goal[1])

        return waypoints

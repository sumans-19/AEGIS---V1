from typing import List, Tuple
from core.domain.mission import SearchArea
import numpy as np


class GridPlanner:
    """
    Deterministic grid-search planner for AEGIS.
    Generates a zig-zag path inside a bounding box.
    """

    @staticmethod
    def generate_waypoints(area: SearchArea) -> List[Tuple[float, float, float]]:
        """
        Takes a SearchArea and generates an ordered list of waypoints (x, y, z)
        where x is latitude, y is altitude, z is longitude.
        Since we are using simplified local coordinates for the simulation demo,
        we'll treat the area's boundaries as local Cartesian coords for now.
        """
        # For simplicity, extract bounding box from the polygon
        lats = [pt[0] for pt in area.boundaries]
        lons = [pt[1] for pt in area.boundaries]

        min_lat, max_lat = min(lats), max(lats)
        min_lon, max_lon = min(lons), max(lons)

        spacing = area.grid_spacing
        # The frontend/simulation uses local Cartesian coordinates (meters)
        # We no longer need to convert to degrees.
        deg_spacing = spacing

        waypoints = []

        current_lat = min_lat
        direction = 1  # 1 for moving right (increasing lon), -1 for moving left

        while current_lat <= max_lat + 0.001:  # small epsilon for float precision
            if direction == 1:
                # Left to right
                lon_seq = list(np.arange(min_lon, max_lon, deg_spacing))
                if not lon_seq or lon_seq[-1] < max_lon - 0.001:
                    lon_seq.append(max_lon)
            else:
                # Right to left
                lon_seq = list(np.arange(max_lon, min_lon, -deg_spacing))
                if not lon_seq or lon_seq[-1] > min_lon + 0.001:
                    lon_seq.append(min_lon)

            for lon in lon_seq:
                waypoints.append((current_lat, area.search_altitude, lon))

            current_lat += deg_spacing
            direction *= -1

        # Ensure exit point is last if defined
        if area.exit_point:
            waypoints.append(
                (area.exit_point[0], area.search_altitude, area.exit_point[1])
            )

        return waypoints

import numpy as np


def find_nearest_drone(drone, drones):

    nearest = None
    nearest_distance = float("inf")

    for other in drones:

        if other.id == drone.id:
            continue

        distance = np.linalg.norm(drone.pos - other.pos)

        if distance < nearest_distance:

            nearest_distance = distance
            nearest = other

    return nearest


def request_nearest_sensor(drone, drones):

    nearest = find_nearest_drone(drone, drones)

    if nearest:

        drone.nearby_drone_id = nearest.id

        drone.recent_events.append(f"THERMAL_SHARED_BY_DRONE_{nearest.id}")
        nearest.recent_events.append(f"ASSISTING_DRONE_{drone.id}_THERMAL")

        return nearest.id

    return None

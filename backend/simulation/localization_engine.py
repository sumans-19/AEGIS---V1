import numpy as np
from simulation.world_state import world, LogEntry


def is_in_gps_shadow(pos, shadow_zones):
    """Check if the position is inside any GPS shadow zone."""
    px, py, pz = pos
    for zone in shadow_zones:
        zx, zz = zone["center"]
        radius = zone["radius"]
        dist = np.sqrt((px - zx) ** 2 + (pz - zz) ** 2)
        if dist < radius:
            return True
    return False


def tick_localization(drone, dt):
    """Update drone GPS status and dead reckoning uncertainty."""
    in_shadow = is_in_gps_shadow(drone.pos, world.gps_shadow_zones)

    if in_shadow and drone.gps_status:
        # Just lost GPS
        drone.gps_status = False
        drone.recent_events.append("GPS SIGNAL LOST - DEAD RECKONING ACTIVE")
        world.event_log.append(
            LogEntry(
                world.sim_time,
                drone.id,
                "warning",
                f"GPS SIGNAL LOST FOR {drone.callsign} — ENTERING DEAD RECKONING",
            )
        )
    elif not in_shadow and not drone.gps_status:
        # Just regained GPS
        drone.gps_status = True
        drone.pos_uncertainty = 0.0
        drone.recent_events.append("GPS SIGNAL RESTORED")
        world.event_log.append(
            LogEntry(
                world.sim_time,
                drone.id,
                "system",
                f"GPS SIGNAL RESTORED FOR {drone.callsign}",
            )
        )
    elif not in_shadow and drone.gps_status:
        # Nominal GPS
        drone.pos_uncertainty = 0.0

    # Drift accumulation (Dead Reckoning error)
    if not drone.gps_status:
        # Error grows proportional to velocity and time (simulating IMU drift)
        speed = np.linalg.norm(drone.vel)
        drift_rate = 0.5 + 0.1 * speed  # base drift + speed-dependent drift
        drone.pos_uncertainty += drift_rate * dt
        # Max uncertainty cap
        if drone.pos_uncertainty > 25.0:
            drone.pos_uncertainty = 25.0

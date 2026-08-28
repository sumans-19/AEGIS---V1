import numpy as np
import random
from simulation.world_state import world, DroneState, LogEntry

MAX_SPEED_H = 15.0 # m/s
MAX_SPEED_V = 5.0  # m/s

def tick_all(dt: float):
    if not world.running:
        return
        
    for drone in world.drones:
        # 1. Physics & Movement
        if drone.current_target is not None:
            # Proportional velocity toward target
            diff = drone.current_target - drone.pos
            dist = np.linalg.norm(diff)
            
            if dist < 1.0:
                # Reached waypoint
                drone.current_target = None
                if drone.status == "RETURNING":
                    # Dock at charging station
                    drone.status = "CHARGING"
            else:
                direction = diff / dist
                # Lerp velocity toward desired
                dt_factor = min(1.0, 0.1 * world.speed)
                desired_vel = direction * np.array([MAX_SPEED_H, MAX_SPEED_V, MAX_SPEED_H])
                drone.vel = drone.vel * (1 - dt_factor) + desired_vel * dt_factor
                # Apply velocity
                drone.pos += drone.vel * dt
                # Micro-turbulence
                drone.pos += np.random.normal(0, 0.02, 3)
                # Heading: angle of velocity in XZ plane
                drone.heading = np.degrees(np.arctan2(drone.vel[0], drone.vel[2]))
        else:
            # If idle and scanning, wait for new trajectory from planner
            drone.vel *= 0.9 # slowly come to halt

        # 2. Battery Model
        if drone.status == "SCANNING":
            drone.battery -= 0.008 * world.speed
        elif drone.status == "SEARCHING":
            drone.battery -= 0.010 * world.speed
        elif drone.status == "RETURNING":
            drone.battery -= 0.006 * world.speed
        elif drone.status == "CHARGING":
            drone.battery = min(100.0, drone.battery + 0.020 * world.speed)
        
        # Scenario penalties (flood humidity)
        if world.scenario == "flood":
             drone.battery -= 0.004 * world.speed # +0.5x penalty approx
        
        # 3. Status Transitions
        if drone.battery < 15.0 and drone.status in ["SCANNING", "SEARCHING"]:
            drone.status = "RETURNING"
            # Charging stations at 4 corners + center. Let's say:
            stations = [[45,0,45], [-45,0,45], [45,0,-45], [-45,0,-45], [0,0,0]]
            nearest = min(stations, key=lambda s: np.linalg.norm(np.array(s) - drone.pos))
            drone.current_target = np.array([nearest[0], 25, nearest[2]])
            world.event_log.append(LogEntry(world.sim_time, drone.id, "warning", f"Battery low: {drone.battery:.1f}%. Initializing automated RTS."))
            
        if drone.status == "CHARGING" and drone.battery > 95.0:
            drone.status = "SCANNING"
            world.event_log.append(LogEntry(world.sim_time, drone.id, "system", f"Maintenance complete. Re-deploying to active sector."))

        # 4. Trail data
        if world.tick % 5 == 0:
            drone.trail.append(drone.pos.copy())
            if len(drone.trail) > 200:
                drone.trail.pop(0)

        # 5. Visual Framing (Thermal/Camera) - every 5 ticks
        if world.tick % 5 == 0:
            from simulation.thermal_engine import generate_thermal_frame, generate_camera_frame
            drone.thermal_frame = generate_thermal_frame(drone, world)
            drone.camera_frame = generate_camera_frame(drone, world)

def assign_drone_target(drone_id: int, target: np.ndarray):
    for d in world.drones:
        if d.id == drone_id:
            d.current_target = target
            d.status = "SEARCHING"
            break

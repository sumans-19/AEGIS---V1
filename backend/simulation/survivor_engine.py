import numpy as np
import random
from simulation.world_state import world, Survivor, LogEntry

def place_survivors(world):
    # Rule for 4 scenarios
    count = 8 if world.scenario == "earthquake" else 6
    if world.scenario == "wildfire": count = 5
    if world.scenario == "flood": count = 7
    
    for i in range(count):
        # Coordinates in world grid (~ -50m to 50m)
        s_id = i + 1
        pos = np.array([random.uniform(-40, 40), 0.5, random.uniform(-40, 40)])
        
        # Real coords mapping center of scenario
        lat_base, lng_base = 37.1, 36.9
        from simulation.scenario_loader import SCENARIO_COORDS
        if world.scenario in SCENARIO_COORDS:
            lat_base = SCENARIO_COORDS[world.scenario]["lat"]
            lng_base = SCENARIO_COORDS[world.scenario]["lng"]
            
        real_coords = (lat_base + pos[0]/10000, lng_base + pos[2]/10000)
        
        moving = False
        body_temp = random.uniform(36.5, 38.0)
        
        if world.scenario == "earthquake":
            # Some clustered in blocks, some isolated
            # Place in/near collapsed building
            ix, iy = random.randint(0, 19), random.randint(0, 19)
            while world.terrain_grid[ix, iy] < 0.7:
                 ix, iy = random.randint(0, 19), random.randint(0, 19)
            pos = np.array([ix * 5 - 50 + random.uniform(-2, 2), 0.5, iy * 5 - 50 + random.uniform(-2, 2)])
            
        elif world.scenario == "tsunami":
            # Rooftop placement (z = 8-12)
            # Never in deep water zone x < 4 (grid < 8)
            ix, iy = random.randint(8, 19), random.randint(0, 19)
            pos = np.array([ix * 5 - 50, 10.0, iy * 5 - 50])
            moving = (random.random() < 0.3) # Some walking to higher ground
            
        elif world.scenario == "wildfire":
            # Place in non-burning for now
            ix, iy = random.randint(0, 19), random.randint(0, 19)
            while world.terrain_grid[ix, iy] > 0.4:
                ix, iy = random.randint(0, 19), random.randint(0, 19)
            pos = np.array([ix * 5 - 50, 0.5, iy * 5 - 50])
            
        elif world.scenario == "flood":
            # Rooftop placement
            ix, iy = random.randint(0, 19), random.randint(0, 19)
            pos = np.array([ix * 5 - 50, 8.0, iy * 5 - 50])

        s = Survivor(
            id=s_id,
            pos=pos,
            body_temp=body_temp,
            real_coords=real_coords,
            moving=moving
        )
        world.survivors.append(s)

def update_survivors(world, dt):
    for s in world.survivors:
        if not s.alive: continue
        
        # 1. Movement logic (walking to high ground)
        if s.moving:
            # Simple move toward +X (higher/safer)
            s.pos[0] += 1.2 * dt 
            # Clamp in world
            s.pos[0] = min(50, s.pos[0])
            
        # 2. Hazard check
        gx, gy = int((s.pos[0] + 50) / 5), int((s.pos[2] + 50) / 5)
        # Clamp locally
        gx, gy = min(19, max(0, gx)), min(19, max(0, gy))
        
        if world.scenario == "wildfire":
            # Burn intensity at survivor grid pos
            if world.terrain_grid[gx, gy] > 0.7:
                 s.alive = False
                 world.event_log.append(LogEntry(world.sim_time, None, "critical", f"Survivor #{s.id} lost in burn zone expansion."))
                 
        elif world.scenario == "flood":
            # Water level rising endangers ground
            if world.water_level > s.pos[1] - 0.5:
                # Endangered warning
                if world.tick % 400 == 0:
                     world.event_log.append(LogEntry(world.sim_time, None, "warning", f"SURVIVOR #{s.id} AT RISK — WATER RISING"))
            if world.water_level > s.pos[1] + 1.5:
                 s.alive = False
                 world.event_log.append(LogEntry(world.sim_time, None, "critical", f"Survivor #{s.id} swept away in flood surge."))

def check_detections(world):
    dt = 0.05 * world.speed # simulate tick prob
    for drone in world.drones:
        if drone.status not in ["SCANNING", "SEARCHING"]:
            continue
            
        for s in world.survivors:
            if s.detected or not s.alive:
                continue
                
            dist_2d = np.linalg.norm(drone.pos[:2] - s.pos[:2])
            if dist_2d < drone.scan_radius:
                # Probability increases centered in scan cone
                detection_prob = 1.0 - (dist_2d / drone.scan_radius)
                
                # Scenario noise factor
                noise = 0.0
                if world.scenario == "wildfire": noise = 0.3 # thermal noise
                
                # Check randomized detection probability each tick
                if random.random() < (detection_prob * (1 - noise)) * 0.1: # scale prob down for tick frequency
                    s.detected = True
                    s.detected_by = drone.id
                    s.detected_at = world.sim_time
                    s.confidence = detection_prob
                    world.detected_survivors.append(s.id)
                    world.event_log.append(LogEntry(world.sim_time, drone.id, "survivor", 
                        f"Survivor #{s.id} detected at grid sector. Confidence {detection_prob:.0%}. Thermal {s.body_temp:.1f}°C."))

def inject_test_survivor(world, pos_world_2d):
    # pos_world_2d = [x, y] in world units
    # Calculate id
    new_id = len(world.survivors) + 1
    lat_base, lng_base = 37.1, 36.9 # Default earthquake Турции
    real_coords = (lat_base + pos_world_2d[0]/10000, lng_base + pos_world_2d[1]/10000)
    
    s = Survivor(
        id=new_id,
        pos=np.array([pos_world_2d[0], 0.5, pos_world_2d[1]]),
        body_temp=37.1,
        real_coords=real_coords
    )
    world.survivors.append(s)
    world.event_log.append(LogEntry(world.sim_time, None, "system", f"Manual survivor seeding at world [{pos_world_2d[0]:.0f}, {pos_world_2d[1]:.0f}]. Awaiting detection."))
    return s

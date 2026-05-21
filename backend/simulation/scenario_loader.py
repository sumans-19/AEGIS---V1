import numpy as np
import random
from simulation.world_state import world, DroneState, LogEntry

SCENARIO_COORDS = {
    "earthquake": {"lat": 37.1, "lng": 36.9, "name": "EARTHQUAKE — TÜRKIYE/SYRIA BORDER"},
    "tsunami": {"lat": -0.895, "lng": 119.840, "name": "TSUNAMI — SULAWESI, INDONESIA"},
    "wildfire": {"lat": 20.87, "lng": -156.65, "name": "WILDFIRE — MAUI, HAWAII"},
    "flood": {"lat": 26.0, "lng": 68.3, "name": "FLOOD — PAKISTAN SINDH PROVINCE"},
}

CALLSIGNS = ["FALCON", "HAWK", "OSPREY", "KESTREL", "MERLIN"]

def load_scenario(name: str):
    world.reset(name)
    coords = SCENARIO_COORDS.get(name, SCENARIO_COORDS["earthquake"])
    
    # Initialize Drones
    # 5 Drones with specific orbit params for consistent movement
    params = [
        {"radius": 45, "phaseOffset": 0, "orbitSpeed": 1.1},
        {"radius": 32, "phaseOffset": 0.78, "orbitSpeed": 0.9},
        {"radius": 28, "phaseOffset": 1.57, "orbitSpeed": 1.3},
        {"radius": 38, "phaseOffset": 3.14, "orbitSpeed": 0.75},
        {"radius": 50, "phaseOffset": 1.5, "orbitSpeed": 1.0},
    ]
    start_positions = [
        [0, 25, 0], [10, 18, 10], [-10, 30, -5], [-15, 22, 15], [20, 2, -20]
    ]
    for i, callsign in enumerate(CALLSIGNS):
        p = params[i]
        drone = DroneState(
            id=i+1,
            callsign=callsign,
            status="SCANNING" if i < 4 else "CHARGING",
            pos=np.array(start_positions[i], dtype=float),
            battery=100.0,
            radius=float(p["radius"]),
            phaseOffset=float(p["phaseOffset"]),
            orbitSpeed=float(p["orbitSpeed"]),
            assigned_zone=get_initial_zone(i)
        )
        world.drones.append(drone)

    if name == "earthquake":
        world.ambient_temp = 12.0 # winter, night
        # Damage Grid: ~20% cells collapsed (was 0.4)
        for i in range(20):
            for j in range(20):
                if random.random() < 0.2:
                    world.terrain_grid[i, j] = random.uniform(0.8, 1.0)
                else:
                    world.terrain_grid[i, j] = random.uniform(0.0, 0.4)
        
        # Hazard zones: 3 gas leaks
        world.hazard_zones = [
            {"center": [5, 5], "radius": 15, "type": "gas_leak"},
            {"center": [12, -8], "radius": 10, "type": "gas_leak"},
            {"center": [-15, 15], "radius": 12, "type": "gas_leak"},
        ]
        
    elif name == "tsunami":
        world.ambient_temp = 28.0 # tropical
        # Coastal cells (x < 8) damage 1.0, others decreasing
        for i in range(20):
            for j in range(20):
                if i < 8:
                    world.terrain_grid[i, j] = 1.0
                else:
                    world.terrain_grid[i, j] = max(0, 1.0 - (i - 7) * 0.1)
        # Deep water x < 4 (z=-2), flooded x < 6 (z=0)
        # Managed via water plane / terrain height logic elsewhere

    elif name == "wildfire":
        world.ambient_temp = 35.0
        world.wind_vector = np.array([1.2, 0.3])
        # Initial fires (damage grid = burn intensity)
        for _ in range(5):
            x, y = random.randint(0, 19), random.randint(0, 19)
            world.terrain_grid[x, y] = 0.9

    elif name == "flood":
        world.ambient_temp = 38.0
        world.water_level = 0.1 # starts rising

    # Now place survivors via survivor engine
    from simulation.survivor_engine import place_survivors
    place_survivors(world)
    
    world.event_log.append(LogEntry(0.0, None, "system", f"Scenario {name.upper()} initiated. Deployment sequence active."))

def get_initial_zone(index: int) -> tuple:
    # Divide 20x20 grid (0..19, 0..19) into 5 longitudinal zones
    width = 4
    x1 = index * width
    x2 = (index + 1) * width
    return (x1, 0, x2, 20)

def handle_scenario_events():
    t = world.sim_time
    if world.scenario == "earthquake":
        # Random aftershocks at t=90 and t=240
        if abs(t - 90) < 0.1 or abs(t - 240) < 0.1:
            world.event_log.append(LogEntry(t, None, "critical", "SEISMIC AFTERSHOCK DETECTED. ALL DRONES SCATTERING."))
            for drone in world.drones:
                drone.vel += np.random.normal(0, 5.0, 3) # Briefly scatter
            # Increase damage in 5 cells
            for _ in range(5):
                ix, iy = random.randint(0, 19), random.randint(0, 19)
                world.terrain_grid[ix, iy] = min(1.0, world.terrain_grid[ix, iy] + 0.3)
    
    elif world.scenario == "tsunami":
        # Water level rise logic
        if world.sim_time < 300: # Rise for first 5 mins
            world.water_level = min(15.0, world.water_level + 0.005 * world.speed)
            if world.tick % 400 == 0:
                world.event_log.append(LogEntry(world.sim_time, None, "warning", f"COASTAL WATER LEVEL RISING: {world.water_level:.1f}m"))
    
    elif world.scenario == "flood":
        # Water level rise logic for flood
        if world.sim_time < 450: 
            world.water_level = min(12.0, world.water_level + 0.0035 * world.speed)
            if world.tick % 500 == 0:
                world.event_log.append(LogEntry(world.sim_time, None, "warning", f"FLOOD LEVEL INCREASING: {world.water_level:.1f}m. EMERGENCY EVACUATION ACTIVE."))
    
    elif world.scenario == "wildfire":
        # Fire spread every 30s
        if world.tick % 600 == 0: # 30s at 20Hz
            to_burn = []
            for i in range(20):
                for j in range(20):
                    if world.terrain_grid[i, j] > 0.6:
                        # Spread to adjacent
                        for di, dj in [(-1,0), (1,0), (0,-1), (0,1)]:
                            ni, nj = i+di, j+dj
                            if 0 <= ni < 20 and 0 <= nj < 20 and world.terrain_grid[ni, nj] < 0.3:
                                if random.random() < 0.4:
                                    to_burn.append((ni, nj))
            for i, j in to_burn:
                world.terrain_grid[i, j] = 0.7
            world.ambient_temp += 0.05

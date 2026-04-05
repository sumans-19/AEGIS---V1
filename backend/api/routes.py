from fastapi import APIRouter, WebSocket, Response, Request
from fastapi.responses import StreamingResponse, JSONResponse
from api.api_websocket import hub
from simulation.world_state import world
from simulation.scenario_loader import load_scenario
from simulation.survivor_engine import inject_test_survivor
from simulation.drone_engine import assign_drone_target
from simulation.export_engine import export_mission_json, export_mission_csv, generate_mission_report, merge_mission_data
import json
import numpy as np

router = APIRouter()

@router.get("/api/pathfinding")
async def get_pathfinding_data():
    """Returns live grid cost map, drone grid positions, and planned A* paths."""
    import heapq
    
    GRID_SIZE = 20
    
    # Build cost grid from world state
    cost_grid = []
    for r in range(GRID_SIZE):
        row = []
        for c in range(GRID_SIZE):
            cost = 1.0
            damage = world.terrain_grid[r, c] if hasattr(world, 'terrain_grid') else 0
            if damage > 0.8:
                cost = 3.0
            elif damage > 0.4:
                cost = 2.0
            # Add hazard cost
            for hazard in (world.hazard_zones or []):
                hx, hy = hazard.get("center", [0, 0])
                ghx, ghy = int((hx + 50) / 5), int((hy + 50) / 5)
                dist = ((r - ghx) ** 2 + (c - ghy) ** 2) ** 0.5
                if dist < hazard.get("radius", 10) / 5:
                    cost = 3.0
            row.append(round(cost, 2))
        cost_grid.append(row)
    
    # Drone positions in grid coords
    drone_grid_positions = []
    for drone in world.drones:
        gx = int((drone.pos[0] + 50) / 5)
        gz = int((drone.pos[2] + 50) / 5)
        gx = max(0, min(GRID_SIZE - 1, gx))
        gz = max(0, min(GRID_SIZE - 1, gz))
        
        # Get planned path waypoints (first 10) in grid coords
        path_nodes = []
        for wp in (drone.trajectory or [])[:10]:
            wgx = int((wp[0] + 50) / 5)
            wgz = int((wp[2] + 50) / 5)
            path_nodes.append([max(0, min(19, wgx)), max(0, min(19, wgz))])
        
        drone_grid_positions.append({
            "id": drone.id,
            "callsign": drone.callsign,
            "grid_pos": [gx, gz],
            "status": drone.status,
            "battery": round(float(drone.battery), 1),
            "path_nodes": path_nodes,
        })
    
    return {
        "scenario": world.scenario,
        "grid_size": GRID_SIZE,
        "cost_grid": cost_grid,
        "drones": drone_grid_positions,
        "tick": world.tick,
        "sim_time": round(world.sim_time, 1),
    }



@router.get("/api/coordination")
async def get_coordination_data():
    """Returns live multi-drone coordination state."""
    GRID_SIZE = 20
    COLLISION_THRESHOLD = 8.0  # metres

    # ── Zone coverage per drone ──
    zone_pcts = []
    zone_coverage_grid = world.zone_coverage.tolist() if hasattr(world.zone_coverage, 'tolist') else []
    for drone in world.drones:
        x1, y1, x2, y2 = drone.assigned_zone
        total = max(1, (x2 - x1) * (y2 - y1))
        scanned = sum(
            1 for r in range(y1, min(y2, GRID_SIZE))
            for c in range(x1, min(x2, GRID_SIZE))
            if world.zone_coverage[r, c] > 0.5
        )
        zone_pcts.append(round(scanned / total * 100, 1))

    # ── Pairwise collision separations ──
    current_separations = []
    collision_events = []
    for i, d1 in enumerate(world.drones):
        for d2 in world.drones[i+1:]:
            diff = d1.pos - d2.pos
            sep = float(np.linalg.norm(diff))
            status = "correcting" if sep < COLLISION_THRESHOLD else "nominal"
            current_separations.append({
                "pair": [d1.callsign, d2.callsign],
                "separation": round(sep, 2),
                "status": status,
            })
            if sep < COLLISION_THRESHOLD:
                collision_events.append({
                    "time": round(world.sim_time, 1),
                    "pair": [d1.callsign, d2.callsign],
                    "separation": round(sep, 2),
                })

    # ── Rebalance events from event log ──
    rebalance_events = [
        {
            "time": e.time,
            "drone": e.message.split()[0] if e.message else "?",
            "new_zone": e.message.split()[-1] if e.message else "?",
        }
        for e in world.event_log
        if "reassign" in e.message.lower() or "rebalanc" in e.message.lower()
    ][-5:]

    # ── Survivor responses ──
    survivor_responses = [
        {
            "survivor_id": s.id,
            "detected_by": s.detected_by,
            "confidence": round(float(s.confidence), 2),
            "detected_at": round(float(s.detected_at), 1),
        }
        for s in world.survivors if s.detected
    ]

    # ── Totals ──
    total_collisions_avoided = sum(
        1 for e in world.event_log
        if "collision" in e.message.lower() or "separation" in e.message.lower()
    )
    total_rebalances = len([
        e for e in world.event_log
        if "reassign" in e.message.lower() or "rebalanc" in e.message.lower()
    ])

    return {
        "scenario": world.scenario,
        "sim_time": round(world.sim_time, 1),
        "zone_pcts": zone_pcts,
        "zone_coverage_grid": zone_coverage_grid,
        "current_separations": current_separations,
        "collision_events": collision_events,
        "rebalance_events": rebalance_events,
        "survivor_responses": survivor_responses,
        "total_collisions_avoided": total_collisions_avoided,
        "total_rebalances": total_rebalances,
        "drones": [
            {
                "id": d.id,
                "callsign": d.callsign,
                "status": d.status,
                "battery": round(float(d.battery), 1),
                "assigned_zone": list(d.assigned_zone),
                "pos": d.pos.tolist(),
            }
            for d in world.drones
        ],
    }


@router.get("/api/health")
async def health():
    return {"status": "ok", "scenario": world.scenario, "tick": world.tick}


@router.post("/api/simulation/start")
async def start_sim(data: dict):
    scenario = data.get("scenario", "earthquake")
    load_scenario(scenario)
    world.running = True
    return {"status": "started", "scenario": scenario}

@router.post("/api/simulation/stop")
async def stop_sim():
    world.running = False
    return {"status": "stopped"}

@router.post("/api/simulation/pause")
async def pause_sim():
    world.running = False
    return {"status": "paused"}

@router.post("/api/simulation/resume")
async def resume_sim():
    world.running = True
    return {"status": "resumed"}

@router.post("/api/simulation/speed")
async def set_speed(data: dict):
    world.speed = float(data.get("speed", 1.0))
    return {"speed": world.speed}

@router.get("/api/drone/{id}/camera")
async def get_camera(id: int):
    drone = next((d for d in world.drones if d.id == id), None)
    if drone and drone.camera_frame:
        return Response(content=drone.camera_frame, media_type="image/jpeg")
    return Response(status_code=404)

@router.get("/api/drone/{id}/thermal")
async def get_thermal(id: int):
    drone = next((d for d in world.drones if d.id == id), None)
    if drone and drone.thermal_frame:
        return Response(content=drone.thermal_frame, media_type="image/jpeg")
    return Response(status_code=404)

@router.get("/api/drone/{id}/trajectory")
async def get_trajectory(id: int):
    drone = next((d for d in world.drones if d.id == id), None)
    if drone:
        # Simplified GeoJSON convert
        coords = []
        # Trail + future waypoints
        for p in drone.trail[-100:] + drone.trajectory:
            lat = 37.1 + p[0]/10000
            lng = 36.9 + p[2]/10000
            coords.append([lng, lat])
            
        return {
            "type": "Feature",
            "geometry": {"type": "LineString", "coordinates": coords},
            "properties": {"drone": drone.callsign}
        }
@router.post("/api/drone/command")
async def drone_command(data: dict):
    drone_id = data.get("drone_id")
    action = data.get("action")
    drone = next((d for d in world.drones if d.id == drone_id), None)
    
    if not drone:
        return Response(status_code=404)
        
    world.event_log.append(
        LogEntry(world.sim_time, drone.id, "system", f"{drone.callsign} received command: {action.replace('_', ' ').upper()}")
    )
    
    if action == "hold_position":
        drone.status = "HOVER"
    elif action == "extend_scan":
        drone.scan_radius += 5.0
        drone.battery = max(0, drone.battery - 10.0)
    elif action == "emergency_return":
        drone.status = "RETURNING"
    elif action == "relay_boost":
        drone.battery = max(0, drone.battery - 5.0)
    elif action == "divert_survivor":
        drone.status = "SEARCHING"
        
    return {"status": "ok", "action": action}

@router.post("/api/survivor/seed")
async def seed_survivor(data: dict):
    # expect x, y world pos
    x, y = data.get("x"), data.get("y")
    s = inject_test_survivor(world, [x, y])
    return {"id": s.id, "pos": s.pos.tolist()}

@router.get("/api/export/json")
async def get_export_json():
    return JSONResponse(content=export_mission_json(world))

@router.get("/api/export/csv")
async def get_export_csv():
    return Response(content=export_mission_csv(world), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=mission_data.csv"})

@router.get("/api/export/report")
async def get_export_report():
    return Response(content=generate_mission_report(world), media_type="text/plain")

@router.post("/api/export/merge")
async def merge_missions(data: dict):
    missions = data.get("missions", [])
    merged = merge_mission_data(missions)
    return JSONResponse(content=merged)

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await hub.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            if msg["type"] == "command":
                action = msg["action"]
                if action in ["start_simulation", "resume", "start"]:
                    scenario = msg.get("scenario", world.scenario)
                    if action == "start_simulation": load_scenario(scenario)
                    world.running = True
                elif action in ["pause", "stop"]:
                    world.running = False
                elif action == "set_speed":
                    world.speed = float(msg.get("value", 1.0))
                elif action == "seed_survivor":
                    pos = msg.get("pos")
                    inject_test_survivor(world, pos)
                elif action == "assign_drone":
                    d_id = msg.get("drone_id")
                    target = msg.get("target")
                    assign_drone_target(d_id, np.array([target[0], 25, target[1]]))
    except:
        hub.disconnect(websocket)

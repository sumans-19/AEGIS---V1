from backend.simulation.world_state import LogEntry
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
@router.post("/api/simulation/edge-case")
async def trigger_edge_case(data: dict):
    from backend.simulation.world_state import LogEntry
    scenario = data.get("scenario")
    import random
    
    if scenario == "battery_critical":
        drone = next((d for d in world.drones if d.callsign == "FALCON"), world.drones[0])
        drone.battery = 8.0
        drone.status = "RETURNING"
        world.event_log.append(LogEntry(world.sim_time, drone.id, "critical", f"CRITICAL BATTERY FAILURE ON {drone.callsign} -> FORCED RTB"))
    
    elif scenario == "imminent_collision":
        if len(world.drones) >= 3:
            d1 = world.drones[1] # Hawk
            d2 = world.drones[2] # Osprey
            # Force them onto a collision course rapidly
            import numpy as np
            midpoint = (d1.pos + d2.pos) / 2
            d1.vel = (midpoint - d1.pos) * 0.5
            d2.vel = (midpoint - d2.pos) * 0.5
            # place them close together
            d1.pos = midpoint + np.array([-3., 0., 0.])
            d2.pos = midpoint + np.array([3., 0., 0.])
            world.event_log.append(LogEntry(world.sim_time, "system", "warning", f"COLLISION IMMINENT: {d1.callsign} & {d2.callsign}. INJECTED!"))
            
    elif scenario == "wind_disturbance":
        for drone in world.drones:
            import numpy as np
            wind = np.array([15.0, 0, -15.0]) # huge crosswind
            drone.vel += wind
        world.event_log.append(LogEntry(world.sim_time, "system", "warning", "HEAVY WIND SHEAR DETECTED. APPLYING CROSSWIND VECTORS."))
            
    elif scenario == "comms_loss":
        drone = next((d for d in world.drones if d.callsign == "MERLIN"), world.drones[-1])
        drone.status = "HOVER"
        drone.battery -= 5.0 # penalty
        # Stop its velocity so it visually hovers
        import numpy as np
        drone.vel = np.array([0., 0., 0.])
        world.event_log.append(LogEntry(world.sim_time, drone.id, "critical", f"COMMS LOSS ON {drone.callsign}. ENTERING AUTONOMOUS LOITER."))
        
    return {"status": "injected", "scenario": scenario}

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


# ==============================================================================
# SENSOR DATA ARCHITECTURE & 2-MINUTE WINDOW ENDPOINTS
# ==============================================================================
from db import mongo
from simulation.sensor_manager import sensor_manager


def _serialize_mongo(obj):
    """Helper to convert datetime / ObjectIds to JSON-serializable types."""
    if isinstance(obj, list):
        return [_serialize_mongo(i) for i in obj]
    if isinstance(obj, dict):
        return {k: _serialize_mongo(v) for k, v in obj.items()}
    if hasattr(obj, "isoformat"):
        return obj.isoformat()
    return obj


@router.get("/api/sensors")
async def get_all_sensors():
    """List all registered sensors along with active collection window and latest consolidated window."""
    registry = mongo.get_sensor_registry()
    result = []
    for s in registry:
        s_id = s.get("sensor_id")
        collector = sensor_manager.get_collector(s_id)
        status_summary = collector.get_status_summary() if collector else {}
        result.append({
            **_serialize_mongo(s),
            "telemetry": _serialize_mongo(status_summary)
        })
    return JSONResponse(content=_serialize_mongo(result))


@router.get("/api/sensors/{sensor_id}/latest")
async def get_sensor_latest(sensor_id: str):
    """Returns real-time telemetry and 2-minute window progress for a specific sensor."""
    collector = sensor_manager.get_collector(sensor_id)
    if not collector:
        return JSONResponse(status_code=404, content={"error": f"Sensor '{sensor_id}' not found"})
    summary = collector.get_status_summary()
    return JSONResponse(content=_serialize_mongo(summary))


@router.get("/api/sensors/{sensor_id}/windows")
async def get_sensor_windows(sensor_id: str, limit: int = 20):
    """Query historical 2-minute consolidated windows from MongoDB."""
    collector = sensor_manager.get_collector(sensor_id)
    actual_id = collector.sensor_id if collector else sensor_id
    windows = mongo.get_sensor_windows(actual_id, limit=limit)
    return JSONResponse(content=_serialize_mongo(windows))


@router.get("/api/sensors/{sensor_id}/snapshots")
async def get_sensor_snapshots(sensor_id: str, limit: int = 20):
    """Query manual snapshots captured by operators from MongoDB."""
    collector = sensor_manager.get_collector(sensor_id)
    actual_id = collector.sensor_id if collector else sensor_id
    snapshots = mongo.get_sensor_snapshots(actual_id, limit=limit)
    return JSONResponse(content=_serialize_mongo(snapshots))


@router.post("/api/sensors/{sensor_id}/snapshot")
async def capture_sensor_snapshot(sensor_id: str):
    """Execute an instantaneous manual snapshot capture into MongoDB."""
    collector = sensor_manager.get_collector(sensor_id)
    if not collector:
        return JSONResponse(status_code=404, content={"error": f"Sensor '{sensor_id}' not found"})
    snapshot_doc = collector.capture_manual_snapshot()
    return JSONResponse(content={
        "status": "CAPTURED",
        "message": f"Manual snapshot saved to MongoDB collection 'sensor_snapshots'",
        "snapshot": _serialize_mongo(snapshot_doc)
    })


@router.post("/api/sensors/{sensor_id}/freeze")
async def freeze_sensor_ui(sensor_id: str):
    """Locks visual telemetry value on card without interrupting background collection."""
    collector = sensor_manager.get_collector(sensor_id)
    if not collector:
        return JSONResponse(status_code=404, content={"error": f"Sensor '{sensor_id}' not found"})
    res = collector.freeze_ui()
    return JSONResponse(content=_serialize_mongo(res))


@router.post("/api/sensors/{sensor_id}/unfreeze")
async def unfreeze_sensor_ui(sensor_id: str):
    """Unlocks visual telemetry and returns to live data display."""
    collector = sensor_manager.get_collector(sensor_id)
    if not collector:
        return JSONResponse(status_code=404, content={"error": f"Sensor '{sensor_id}' not found"})
    res = collector.unfreeze_ui()
    return JSONResponse(content=_serialize_mongo(res))


@router.post("/api/sensors/raw")
async def ingest_raw_sensor_data(request: Request):
    """Ingests raw sensor readings from external hardware (Arduino, ESP32, Serial)."""
    try:
        data = await request.json()
        sensor_id = data.get("sensor_id")
        measurements = data.get("measurements", {})
        source = data.get("source", {"interface": "SERIAL", "port": "COM9"})
        is_valid = data.get("is_valid", True)
        
        collector = sensor_manager.get_collector(sensor_id)
        if collector:
            collector.record_reading(measurements, source, is_valid=is_valid)
            return JSONResponse(content={"status": "ingested", "sensor_id": collector.sensor_id})
        else:
            return JSONResponse(status_code=404, content={"error": f"Sensor {sensor_id} not registered"})
    except Exception as e:
        return JSONResponse(status_code=400, content={"error": str(e)})

# ==============================================================================
# AI DECISION GROQ ENDPOINT
# ==============================================================================
import os
from groq import Groq

# Load Groq API key from environment variable (set in .env or system env)
_groq_api_key = os.getenv("GROQ_API_KEY", "")
if _groq_api_key:
    os.environ["GROQ_API_KEY"] = _groq_api_key
groq_client = Groq(api_key=_groq_api_key or None)

@router.post("/api/ai/analyze")
async def ai_analyze_telemetry(request: Request):
    """Uses Groq API to analyze 2-minute sensor window and return drone instructions."""
    try:
        data = await request.json()
        
        # Build prompt from sensor data
        drone = data.get("droneName", "Unknown Unit")
        sensors = data.get("sensors", {})
        
        prompt = f"""
You are AEGIS, an advanced autonomous drone fleet commander.
Analyze the following sensor data from {drone}.

SENSOR TELEMETRY:
- Environmental (DHT11): {sensors.get('dht11', 'N/A')}
- Power (INA219): {sensors.get('ina219', 'N/A')}
- Proximity (Radar): {sensors.get('radar', 'N/A')}
- Reconnaissance (Camera): {sensors.get('cam', 'N/A')}

RULES:
- If Camera targets > 0 and Radar is close, take evasive or backtrack action.
- If Temp is > 30°C, mark as danger zone/fire hazard and warn other drones.
- Your response must contain exactly two sections.
- First section must start with "DETAILS:" followed by your analysis.
- Second section must start with "ACTION:" followed by your military directive.
- Do not include markdown like ** or ```.
"""

        completion = groq_client.chat.completions.create(
            model="qwen/qwen3.8-27b",
            messages=[
                {"role": "system", "content": "You are a tactical military drone AI."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=150,
        )
        
        raw_response = completion.choices[0].message.content.strip()
        
        details = "N/A"
        action = raw_response
        
        if "DETAILS:" in raw_response and "ACTION:" in raw_response:
            parts = raw_response.split("ACTION:")
            details_part = parts[0].replace("DETAILS:", "").strip()
            action_part = parts[1].strip()
            details = details_part
            action = action_part
        elif "ACTION:" in raw_response:
            parts = raw_response.split("ACTION:")
            action = parts[1].strip()
            details = parts[0].strip()

        return JSONResponse(content={"status": "success", "details": details, "action": action})
        
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e), "instruction": "AI OFFLINE: CONNECTION TO COMMAND NODE FAILED."})

# ==============================================================================
# SENSOR DATA PUSH TO DB ENDPOINT
# ==============================================================================
@router.post("/api/sensors/push")
async def push_sensor_data_to_db(request: Request):
    """Saves parsed consolidated sensor data windows to dedicated MongoDB collections."""
    try:
        data = await request.json()
        import uuid
        import datetime
        
        # Parse Timestamps
        ts_str = data.get("timestamp", "")
        start_time, end_time = ts_str, ts_str
        if "-" in ts_str:
            parts = ts_str.split("-")
            start_time = parts[0].strip()
            end_time = parts[1].strip()

        drone = data.get("droneName", "Unknown")
        sensors = data.get("sensors", {})
        
        # 1. Parse DHT11
        dht11_str = sensors.get("dht11", "")
        temp = hum = air = None
        if "|" in dht11_str:
            try:
                temp = float(dht11_str.split("|")[0].replace("°C", "").strip())
                hum = float(dht11_str.split("|")[1].replace("%", "").strip())
                air = float(dht11_str.split("|")[2].replace("Air Dens:", "").replace("kg/m³", "").strip())
            except Exception: pass
            
        doc_dht11 = {
            "window_id": str(uuid.uuid4()),
            "drone_name": drone, 
            "window_start": start_time, 
            "window_end": end_time,
            "measurements": {"temperature_c": temp, "humidity_pct": hum, "air_density": air},
            "raw_string": dht11_str,
            "pushed_at": datetime.datetime.utcnow().isoformat()
        }

        # 2. Parse INA219
        ina_str = sensors.get("ina219", "")
        volt = curr = power = None
        if "|" in ina_str:
            try:
                volt = float(ina_str.split("|")[0].replace("V", "").strip())
                curr = float(ina_str.split("|")[1].replace("mA", "").strip())
                power = float(ina_str.split("|")[2].replace("Pow:", "").replace("W", "").strip())
            except Exception: pass

        doc_ina219 = {
            "window_id": str(uuid.uuid4()),
            "drone_name": drone, 
            "window_start": start_time, 
            "window_end": end_time,
            "measurements": {"bus_voltage_v": volt, "current_ma": curr, "power_w": power},
            "raw_string": ina_str,
            "pushed_at": datetime.datetime.utcnow().isoformat()
        }

        # 3. Parse Radar
        radar_str = sensors.get("radar", "")
        dist = zone = None
        if "cm" in radar_str:
            try:
                dist = float(radar_str.split("cm")[0].strip())
                if "(" in radar_str:
                    zone = radar_str.split("(")[1].replace(")", "").strip()
            except Exception: pass

        doc_radar = {
            "window_id": str(uuid.uuid4()),
            "drone_name": drone, 
            "window_start": start_time, 
            "window_end": end_time,
            "measurements": {"distance_cm": dist}, "zone": zone,
            "raw_string": radar_str,
            "pushed_at": datetime.datetime.utcnow().isoformat()
        }

        # 4. Parse Camera
        cam_str = sensors.get("cam", "")
        targets = lock = None
        if "TARGET" in cam_str:
            try:
                targets_part = cam_str.split("TARGET")[0].strip()
                if "S" in targets_part:
                    targets_part = targets_part.replace("S", "").strip()
                targets = int(targets_part)
                if "(" in cam_str:
                    lock = float(cam_str.split("(")[1].replace("% LOCK)", "").strip())
            except Exception: pass

        doc_cam = {
            "window_id": str(uuid.uuid4()),
            "drone_name": drone, 
            "window_start": start_time, 
            "window_end": end_time,
            "measurements": {"detected_targets": targets, "confidence_pct": lock},
            "raw_string": cam_str,
            "pushed_at": datetime.datetime.utcnow().isoformat()
        }

        # Dispatch to 4 separate collections
        collection_map = {
            "dht11_environmental_windows": doc_dht11,
            "ina219_power_windows": doc_ina219,
            "hcsr04_radar_windows": doc_radar,
            "esp32_camera_windows": doc_cam
        }
        mongo.insert_split_sensor_docs(collection_map)
        
        return JSONResponse(content={"status": "success"})
        
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

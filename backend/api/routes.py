from backend.simulation.world_state import LogEntry
from fastapi import APIRouter, WebSocket, Response, Request
from fastapi.responses import StreamingResponse, JSONResponse
from api.api_websocket import hub

import json
import numpy as np

from core.runtime import aegis_runtime

router = APIRouter()


@router.get("/api/pathfinding")
async def get_pathfinding_data():
    """Returns live grid cost map, drone grid positions, and planned A* paths."""

    GRID_SIZE = 20

    # Build cost grid from world state
    cost_grid = []
    for r in range(GRID_SIZE):
        row = []
        for c in range(GRID_SIZE):
            cost = 1.0
            row.append(round(cost, 2))
        cost_grid.append(row)

    # Drone positions in grid coords
    drone_grid_positions = []
    state = aegis_runtime.world_manager.current_state
    for d_id, drone in state.drones.items():
        gx = int((drone.position[0] + 50) / 5) if drone.position else 0
        gz = int((drone.position[2] + 50) / 5) if drone.position else 0
        gx = max(0, min(GRID_SIZE - 1, gx))
        gz = max(0, min(GRID_SIZE - 1, gz))

        drone_grid_positions.append(
            {
                "id": drone.drone_id,
                "callsign": f"DRONE-{drone.drone_id}",
                "grid_pos": [gx, gz],
                "status": drone.status,
                "battery": round(drone.battery_percentage, 1),
                "path_nodes": [],
            }
        )

    return {
        "scenario": "aegis_core",
        "grid_size": GRID_SIZE,
        "cost_grid": cost_grid,
        "drones": drone_grid_positions,
        "tick": aegis_runtime.tick_count,
        "sim_time": round(aegis_runtime.sim_time, 1),
    }


@router.get("/api/coordination")
async def get_coordination_data():
    """Returns live multi-drone coordination state."""
    COLLISION_THRESHOLD = 8.0  # metres

    # ── Simplified coordination response for AEGIS Core ──
    state = aegis_runtime.world_manager.current_state
    drones = []
    zone_pcts = []
    for d_id, d in state.drones.items():
        pos = d.pos if d.pos else None
        if hasattr(pos, "x"):
            pos_list = [pos.x, pos.y, pos.z]
        else:
            pos_list = [0.0, 0.0, 0.0]

        drones.append(
            {
                "id": getattr(d, "id", str(d_id)),
                "callsign": getattr(d, "callsign", f"DRONE-{d_id}"),
                "status": d.status,
                "battery": round(
                    d.battery.percentage if hasattr(d, "battery") else 100.0, 1
                ),
                "assigned_zone": getattr(d, "assigned_zone", [0, 0, 20, 20]),
                "pos": pos_list,
            }
        )
        zone_pcts.append(0.0)

    survivor_responses = [
        {
            "survivor_id": s.survivor_id,
            "detected_by": "unknown",
            "confidence": round(float(s.confidence), 2),
            "detected_at": 0.0,
        }
        for s_id, s in state.survivors.items()
        if s.status != "UNKNOWN"
    ]

    return {
        "scenario": "aegis_core",
        "sim_time": round(aegis_runtime.sim_time, 1),
        "zone_pcts": zone_pcts,
        "zone_coverage_grid": [],
        "current_separations": [],
        "collision_events": [],
        "rebalance_events": [],
        "survivor_responses": survivor_responses,
        "total_collisions_avoided": 0,
        "total_rebalances": 0,
        "drones": drones,
    }


@router.get("/api/health")
async def health():
    return aegis_runtime.get_health()


@router.get("/api/state")
async def get_state():
    """Live drone positions, survivor status, and mission phase. Polled by frontend every 200ms."""
    return JSONResponse(content=aegis_runtime.get_api_state())


@router.post("/api/simulation/start")
async def start_sim(data: dict):
    """
    Starts the mission engine with the user-selected region and seeded survivors.
    Body: { searchRegion: {x1, z1, x2, z2}, survivors: [{pos: [x,y,z]}, ...] }
    """
    from core.domain.mission import Mission, SearchArea
    import asyncio

    # --- 1. Parse the user-selected search region ---
    region = data.get("searchRegion") or {}
    x1 = float(region.get("x1", -50))
    z1 = float(region.get("z1", -50))
    x2 = float(region.get("x2", 50))
    z2 = float(region.get("z2", 50))

    # Ensure correct ordering
    min_x, max_x = min(x1, x2), max(x1, x2)
    min_z, max_z = min(z1, z2), max(z1, z2)

    search_area = SearchArea(
        boundaries=[
            (min_x, min_z),
            (max_x, min_z),
            (max_x, max_z),
            (min_x, max_z),
        ],
        min_altitude=10.0,
        max_altitude=80.0,
        search_altitude=45.0,  # Above all buildings in the scene (~33m)
        grid_spacing=12.0,
        entry_point=(min_x, min_z),
        exit_point=(max_x, max_z),
    )

    mission = Mission(
        assigned_drones=["1", "2", "3", "4", "5"],
        search_area=search_area,
        home_location=(-180.0, 0.0, -180.0),
    )

    # --- 2. Seed survivors into the WorldManager ---
    frontend_survivors = data.get("survivors", [])
    if frontend_survivors:
        aegis_runtime.seed_survivors(frontend_survivors)

    # --- 3. Start runtime and mission ---
    await aegis_runtime.start()
    asyncio.create_task(aegis_runtime.mission_engine.start_mission(mission))
    return {
        "status": "started",
        "region": {"x1": min_x, "z1": min_z, "x2": max_x, "z2": max_z},
        "survivors_seeded": len(frontend_survivors),
    }


@router.post("/api/simulation/stop")
async def stop_sim():
    # Trigger RTH on Mission Engine instead of terminating the physics loop
    if aegis_runtime.mission_engine and aegis_runtime.mission_engine.active_mission:
        await aegis_runtime.mission_engine.abort_mission()
    return {"status": "stopped"}


@router.post("/api/simulation/pause")
async def pause_sim():
    return {"status": "paused"}


@router.post("/api/simulation/resume")
async def resume_sim():
    return {"status": "resumed"}


@router.post("/api/simulation/speed")
async def set_speed(data: dict):
    return {"speed": data.get("speed", 1.0)}


@router.get("/api/drone/{id}/camera")
async def get_camera(id: int):
    return Response(status_code=404)


@router.get("/api/swarm-insights")
async def get_swarm_insights():
    from core.runtime import aegis_runtime

    state = aegis_runtime.world_manager.current_state
    active_drones = len(
        [d for d in state.drones.values() if d.status not in ("RETURNING", "CHARGING")]
    )
    total_drones = len(state.drones)
    survivors_found = len(state.survivors)

    return {
        "insight": f"Swarm is operating in Phase 9 Core Runtime mode. {active_drones}/{total_drones} active. {survivors_found} survivors detected."
    }


@router.post("/api/simulate-failure")
async def simulate_failure(request: Request):
    data = await request.json()
    drone_id = data.get("drone_id")

    from core.runtime import aegis_runtime

    # Inject actual fault to force the drone to RTH
    if hasattr(aegis_runtime, "fault_manager") and aegis_runtime.fault_manager:
        aegis_runtime.fault_manager.report_fault(
            drone_id=str(drone_id),
            fault_type="BATTERY_FAILURE",
            severity="CRITICAL",
            description="Manual failure injection via API",
            detected_by="API",
        )

    # Broadcast distress message over the mesh network
    router_instance = aegis_runtime.message_routers.get(str(drone_id))
    if router_instance:
        from core.communication.models import NetworkMessage, MessagePriority

        distress_msg = NetworkMessage(
            source_id=str(drone_id),
            destination_id="BROADCAST",
            message_type="DISTRESS",
            priority=MessagePriority.CRITICAL,
            payload={
                "event_type": "DistressReceivedEvent",
                "distress_drone_id": str(drone_id),
                "fault": {
                    "fault_type": "BATTERY_FAILURE",
                    "severity": "CRITICAL",
                    "description": "Manual failure injection via API",
                },
            },
        )
        router_instance.send_message(distress_msg)

    return {
        "scenario": f"Drone {drone_id} Failure",
        "replacement": None,
        "recommended_action": "Awaiting Mesh Network Propagation...",
        "mission_delay_sec": 0.0,
        "energy_impact_pct": 0.0,
        "risk_change_pct": 0.0,
        "status": "CONTINUABLE",
        "commander_assessment": "Failure injected locally. Waiting for distress signal to propagate over the decentralized mesh network.",
        "trade_offs": "Decentralized model requires physical propagation of signal.",
    }


@router.get("/api/drone/{id}/thermal")
async def get_thermal(id: int):
    # Cameras moved to runtime
    return Response(status_code=404)


@router.get("/api/drone/{id}/trajectory")
async def get_trajectory(id: int):
    state = aegis_runtime.world_manager._state
    drone = state.drones.get(str(id))
    if drone:
        return {
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": [[drone.pos.z, drone.pos.x]],
            },
            "properties": {"drone": drone.callsign},
        }
    return Response(status_code=404)


@router.post("/api/simulation/edge-case")
async def trigger_edge_case(data: dict):
    scenario = data.get("scenario")
    return {
        "status": "injected",
        "scenario": scenario,
        "note": "Edge cases moved to Core Events",
    }


@router.post("/api/swarm/rebalance")
async def manual_rebalance():
    return {"status": "rebalanced"}


@router.post("/api/drone/command")
async def drone_command(data: dict):
    # Route to Core FlightCommand later
    return {"status": "ok", "action": data.get("action")}


@router.post("/api/survivor/seed")
async def seed_survivor(data: dict):
    return {"id": "seeded-1", "pos": [data.get("x", 0), data.get("y", 0), 0]}


@router.get("/api/export/json")
async def get_export_json():
    return JSONResponse(content={"status": "Export disabled in Core Runtime"})


@router.get("/api/export/csv")
async def get_export_csv():
    return Response(content="Export disabled in Core Runtime", media_type="text/csv")


@router.get("/api/export/report")
async def get_export_report():
    return Response(content="Export disabled in Core Runtime", media_type="text/plain")


@router.post("/api/export/merge")
async def merge_missions(data: dict):
    return JSONResponse(content={"status": "Export disabled in Core Runtime"})




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

# --- Phase 10: Fault & Observability Endpoints ---


@router.get("/api/faults")
async def get_faults():
    """Returns active faults and recent fault history."""
    from core.runtime import aegis_runtime

    fm = aegis_runtime.fault_manager
    active = [f.model_dump() for f in fm.active_faults.values()]
    history = [f.model_dump() for f in fm.fault_history[-50:]]
    return {"active_faults": active, "history": history}


@router.get("/api/drones/{drone_id}/health")
async def get_drone_health(drone_id: str):
    """Returns component health state for a specific drone."""
    from core.runtime import aegis_runtime

    hm = aegis_runtime.health_monitor
    components = [
        c.model_dump() for key, c in hm.components.items() if key[0] == drone_id
    ]
    faults = [
        f.model_dump()
        for f in aegis_runtime.fault_manager.get_faults_for_drone(drone_id)
    ]
    return {"components": components, "faults": faults}


@router.get("/api/system/status")
async def get_system_status():
    """Returns overall system status including health roll-ups."""
    from core.runtime import aegis_runtime

    return aegis_runtime.get_health()

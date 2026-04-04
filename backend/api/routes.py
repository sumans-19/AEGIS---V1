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
    return Response(status_code=404)

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

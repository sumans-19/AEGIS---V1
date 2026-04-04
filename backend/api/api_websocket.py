from fastapi import WebSocket
import asyncio
import json
import numpy as np

class WebSocketHub:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, world):
        if not self.active_connections:
            return
            
        def to_val(x):
            if isinstance(x, np.ndarray): return x.tolist()
            return x

        state = {
            "type": "state",
            "tick": world.tick,
            "sim_time": world.sim_time,
            "running": world.running,
            "drones": [
                {
                    "id": d.id,
                    "callsign": d.callsign,
                    "status": d.status,
                    "pos": to_val(d.pos),
                    "vel": to_val(d.vel),
                    "battery": d.battery,
                    "heading": d.heading,
                    "trail": [to_val(p) for p in d.trail[-80:]],
                    "trajectory": [to_val(p) for p in d.trajectory[:20]],
                    "scan_radius": d.scan_radius,
                    "assigned_zone": d.assigned_zone,
                    "thermal_url": f"/api/drone/{d.id}/thermal",
                    "camera_url": f"/api/drone/{d.id}/camera"
                } for d in world.drones
            ],
            "survivors": [
                {
                    "id": s.id,
                    "pos": to_val(s.pos),
                    "detected": s.detected,
                    "confidence": s.confidence,
                    "body_temp": s.body_temp,
                    "real_coords": s.real_coords,
                    "rescued": s.rescued,
                    "alive": s.alive
                } for s in world.survivors if s.detected or s.id in world.detected_survivors
            ],
            "detected_count": len(world.detected_survivors),
            "zone_coverage_pct": float(np.mean(world.zone_coverage) * 100),
            "new_events": [
                {
                    "time": l.time,
                    "drone_id": l.drone_id,
                    "category": l.category,
                    "message": l.message
                } for l in world.event_log[-5:] # only broadcast recent events
            ],
            "terrain_changed": (world.tick % 600 == 0), # notify terrain changes every 30s
            "water_level": world.water_level
        }
        
        message = json.dumps(state)
        # Concurrent broadcast
        tasks = [conn.send_text(message) for conn in self.active_connections]
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

hub = WebSocketHub()

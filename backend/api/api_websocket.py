from fastapi import WebSocket
import asyncio
import json


class WebSocketHub:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self):
        if not self.active_connections:
            return

        from core.runtime import aegis_runtime

        payload = aegis_runtime.get_legacy_state_payload()
        message = json.dumps(payload)

        # Concurrent broadcast
        tasks = [conn.send_text(message) for conn in self.active_connections]
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)


hub = WebSocketHub()

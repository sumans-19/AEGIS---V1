import asyncio
import logging
from typing import Dict, Callable
from datetime import datetime, timezone
from core.communication.models import NetworkMessage, MessagePriority

logger = logging.getLogger("link_manager")


class LinkManager:
    def __init__(
        self,
        node_id: str,
        send_callback: Callable[[NetworkMessage], None],
        heartbeat_interval: float = 1.0,
        timeout: float = 3.0,
    ):
        self.node_id = node_id
        self.send_callback = send_callback
        self.heartbeat_interval = heartbeat_interval
        self.timeout = timeout

        # peer_id -> last_received_timestamp
        self.last_seen: Dict[str, datetime] = {}
        self.connected_peers = set()

        self.on_link_lost: Callable[[str], None] = None
        self.on_link_restored: Callable[[str], None] = None

        self._running = False

    def start(self):
        if not self._running:
            self._running = True
            asyncio.create_task(self._heartbeat_loop())
            asyncio.create_task(self._monitor_loop())

    def stop(self):
        self._running = False

    def process_heartbeat(self, source_id: str):
        now = datetime.now(timezone.utc)
        self.last_seen[source_id] = now

        if source_id not in self.connected_peers:
            self.connected_peers.add(source_id)
            if self.on_link_restored:
                self.on_link_restored(source_id)

    async def _heartbeat_loop(self):
        while self._running:
            # Broadcast heartbeat
            msg = NetworkMessage(
                source_id=self.node_id,
                destination_id="BROADCAST",
                message_type="HEARTBEAT",
                payload={"status": "ALIVE"},
                priority=MessagePriority.LOW,
                ttl=2.0,  # short ttl for heartbeats
            )
            self.send_callback(msg)
            await asyncio.sleep(self.heartbeat_interval)

    async def _monitor_loop(self):
        while self._running:
            now = datetime.now(timezone.utc)
            lost_peers = []

            for peer, last_time in self.last_seen.items():
                if peer in self.connected_peers:
                    elapsed = (now - last_time).total_seconds()
                    if elapsed > self.timeout:
                        lost_peers.append(peer)

            for peer in lost_peers:
                self.connected_peers.remove(peer)
                if self.on_link_lost:
                    self.on_link_lost(peer)

            await asyncio.sleep(0.5)

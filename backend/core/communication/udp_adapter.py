import asyncio
import logging
import os
import socket
from typing import Dict, Optional

from core.communication.interfaces import CommunicationInterface
from core.communication.models import NetworkMessage

logger = logging.getLogger("udp_adapter")


class UdpCommunicationAdapter(CommunicationInterface):
    """
    Real UDP socket-based communication adapter.
    Implements the core CommunicationInterface for Phase 8 architecture.
    """

    def __init__(self, node_id: str):
        self.node_id = node_id

        # In a real companion computer, each drone would have its own IP or
        # a unique port on localhost for local multi-agent testing.
        self.host = os.getenv(f"UDP_HOST_{node_id}", "127.0.0.1")

        # Base port 5000 + hash/int mapping or just default to 5000 if single
        # For simulation/mocking on same machine, we dynamically assign ports
        try:
            base_port = int(node_id)
        except ValueError:
            base_port = hash(node_id) % 1000

        self.port = int(os.getenv(f"UDP_PORT_{node_id}", 5000 + base_port))

        # Dictionary mapping neighbor node_ids to (ip, port)
        self.peers: Dict[str, tuple] = {}

        self.socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.socket.setblocking(False)

        self._receive_task: Optional[asyncio.Task] = None
        self._router_callback = None
        self.is_running = False

        self._bind()

    def _bind(self):
        try:
            self.socket.bind((self.host, self.port))
            logger.info(
                f"UDP Adapter for {self.node_id} bound to {self.host}:{self.port}"
            )
        except Exception as e:
            logger.error(f"Failed to bind UDP socket for {self.node_id}: {e}")

    def register_peer(self, target_id: str, host: str, port: int):
        """Register a known neighbor for routing."""
        self.peers[target_id] = (host, port)

    def set_receive_callback(self, callback):
        """Register the router's callback for incoming messages."""
        self._router_callback = callback
        if not self.is_running:
            self.is_running = True
            self._receive_task = asyncio.create_task(self._receive_loop())

    async def send(self, message: NetworkMessage) -> bool:
        target_id = message.destination_id
        if target_id == "BROADCAST":
            # For this simplified adapter, broadcast is sent to all known peers
            success = True
            for peer_id in self.peers.keys():
                if not await self._send_to_peer(
                    peer_id, message.model_dump_json().encode("utf-8")
                ):
                    success = False
            return success

        if target_id not in self.peers:
            logger.debug(f"UDP: Cannot send to {target_id}, peer unknown.")
            return False

        payload = message.model_dump_json().encode("utf-8")
        return await self._send_to_peer(target_id, payload)

    async def _send_to_peer(self, target_id: str, payload: bytes) -> bool:
        target_addr = self.peers[target_id]
        try:
            loop = asyncio.get_running_loop()
            await loop.sock_sendto(self.socket, payload, target_addr)
            return True
        except Exception as e:
            logger.error(f"UDP send error to {target_id}: {e}")
            return False

    def get_link_status(self) -> list:
        from core.communication.models import LinkState

        links = []
        for peer_id in self.peers.keys():
            links.append(
                LinkState(
                    target=peer_id, latency=0.01, bandwidth=10.0, reliability=0.99
                )
            )
        return links

    async def _receive_loop(self):
        loop = asyncio.get_running_loop()
        while self.is_running:
            try:
                # 65535 is max UDP packet size
                data, addr = await loop.sock_recvfrom(self.socket, 65535)

                if self._router_callback:
                    try:
                        msg_dict = __import__("json").loads(data.decode("utf-8"))
                        msg = NetworkMessage(**msg_dict)
                        # We must call it, it might be sync or async
                        res = self._router_callback(msg)
                        if asyncio.iscoroutine(res):
                            await res
                    except Exception as e:
                        logger.error(f"Failed to parse UDP payload: {e}")

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"UDP receive loop error: {e}")
                await asyncio.sleep(0.1)

    async def close(self):
        self.is_running = False
        if self._receive_task:
            self._receive_task.cancel()
        self.socket.close()

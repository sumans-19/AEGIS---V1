import asyncio
import random
import logging
from typing import Dict, List, Tuple
from datetime import datetime, timezone
from core.communication.models import NetworkMessage, LinkState

logger = logging.getLogger("sim_network")


class SimNetwork:
    _instance = None

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = SimNetwork(seed=42)
        return cls._instance

    @classmethod
    def reset(cls):
        cls._instance = None

    def __init__(self, seed: int = 42):
        self.rng = random.Random(seed)
        self.nodes = {}  # node_id -> SimCommunicationAdapter

        # Link configuration: (src, dest) -> (latency, loss, quality, active)
        # By default, assume all nodes can talk to all nodes with perfect quality
        self.links: Dict[Tuple[str, str], Dict] = {}

    def register_node(self, node_id: str, adapter):
        self.nodes[node_id] = adapter

    def set_link(
        self,
        src: str,
        dest: str,
        latency: float = 0.05,
        packet_loss: float = 0.0,
        quality: float = 100.0,
        active: bool = True,
    ):
        self.links[(src, dest)] = {
            "latency": latency,
            "packet_loss": packet_loss,
            "quality": quality,
            "active": active,
        }
        self.links[(dest, src)] = {
            "latency": latency,
            "packet_loss": packet_loss,
            "quality": quality,
            "active": active,
        }

    def partition_network(self, group_a: List[str], group_b: List[str]):
        """Cuts all links between group A and group B."""
        for a in group_a:
            for b in group_b:
                if (a, b) in self.links:
                    self.links[(a, b)]["active"] = False
                if (b, a) in self.links:
                    self.links[(b, a)]["active"] = False

    def heal_partition(self, group_a: List[str], group_b: List[str]):
        for a in group_a:
            for b in group_b:
                if (a, b) in self.links:
                    self.links[(a, b)]["active"] = True
                if (b, a) in self.links:
                    self.links[(b, a)]["active"] = True

    def get_local_links(self, node_id: str) -> List[LinkState]:
        states = []
        for (src, dest), config in self.links.items():
            if src == node_id and config["active"]:
                states.append(
                    LinkState(
                        source_id=src,
                        destination_id=dest,
                        connected=True,
                        link_quality=config["quality"],
                        latency=config["latency"],
                        packet_loss=config["packet_loss"],
                        last_seen=datetime.now(timezone.utc),
                    )
                )
        return states

    async def transmit(self, src: str, message: NetworkMessage) -> bool:
        # Check TTL
        if message.is_expired:
            logger.debug(
                f"[SimNetwork] Dropped expired message {message.message_id} from {src}"
            )
            return False

        destinations = []
        if message.destination_id in ("BROADCAST", "SWARM"):
            destinations = [d for d in self.nodes.keys() if d != src]
        else:
            if message.destination_id in self.nodes:
                destinations = [message.destination_id]

        delivered_any = False
        for dest in destinations:
            # Check link
            link_config = self.links.get((src, dest))
            if not link_config:
                # Default link (perfect) if not explicitly set but nodes exist
                link_config = {
                    "active": True,
                    "latency": 0.05,
                    "packet_loss": 0.0,
                    "quality": 100.0,
                }

            if not link_config["active"]:
                continue

            if self.rng.random() < link_config["packet_loss"]:
                logger.debug(
                    f"[SimNetwork] Dropped message {message.message_id} from {src} to {dest} (packet loss)"
                )
                continue

            # Schedule delivery based on latency
            asyncio.create_task(
                self._deliver(
                    dest, message.model_copy(deep=True), link_config["latency"]
                )
            )
            delivered_any = True

        return delivered_any

    async def _deliver(self, dest: str, message: NetworkMessage, latency: float):
        if latency > 0:
            await asyncio.sleep(latency)
        if dest in self.nodes:
            self.nodes[dest].receive_from_sim(message)

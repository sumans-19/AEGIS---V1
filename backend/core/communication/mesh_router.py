import logging
import heapq
from typing import Dict, Optional, Tuple
from core.communication.models import LinkState

logger = logging.getLogger("mesh_router")


class MeshRouter:
    def __init__(self, node_id: str):
        self.node_id = node_id
        # neighbor_id -> (latency, packet_loss)
        # Note: A real mesh router would exchange link state advertisements (LSA).
        # For this simulation, we'll build a simplified graph from local links and LSAs received.
        self.graph: Dict[str, Dict[str, LinkState]] = {}
        # dest -> (next_hop, total_cost, total_hops)
        self.routing_table: Dict[str, Tuple[str, float, int]] = {}

    def update_link_state(self, source: str, link: LinkState):
        if source not in self.graph:
            self.graph[source] = {}
        self.graph[source][link.destination_id] = link
        self._recalculate_routes()

    def remove_link(self, source: str, destination: str):
        if source in self.graph and destination in self.graph[source]:
            del self.graph[source][destination]
            self._recalculate_routes()

    def get_next_hop(self, destination: str) -> Optional[str]:
        if destination in self.routing_table:
            return self.routing_table[destination][0]
        return None

    def _calculate_link_cost(self, link: LinkState) -> float:
        # Base cost of 1 hop
        # Penalize packet loss heavily
        # Penalize latency
        if not link.connected:
            return float("inf")
        loss_penalty = 1.0 + (link.packet_loss * 10.0)
        latency_penalty = link.latency
        return 1.0 * loss_penalty + latency_penalty

    def _recalculate_routes(self):
        """Dijkstra's Algorithm to find optimal deterministic route."""
        distances = {node: float("inf") for node in self.graph}
        distances[self.node_id] = 0
        previous_nodes = {node: None for node in self.graph}
        hop_counts = {node: 0 for node in self.graph}

        # Add destinations that might only exist on the RHS of links
        for src, links in self.graph.items():
            for dest in links:
                if dest not in distances:
                    distances[dest] = float("inf")
                    previous_nodes[dest] = None
                    hop_counts[dest] = 0

        if self.node_id not in distances:
            self.routing_table = {}
            return

        pq = [(0, self.node_id)]

        while pq:
            current_distance, current_node = heapq.heappop(pq)

            if current_distance > distances[current_node]:
                continue

            if current_node in self.graph:
                for neighbor, link in self.graph[current_node].items():
                    if not link.connected:
                        continue

                    cost = self._calculate_link_cost(link)
                    distance = current_distance + cost

                    if distance < distances[neighbor]:
                        distances[neighbor] = distance
                        previous_nodes[neighbor] = current_node
                        hop_counts[neighbor] = hop_counts[current_node] + 1
                        heapq.heappush(pq, (distance, neighbor))

        # Build routing table (destination -> next_hop)
        new_routing_table = {}
        for node in distances:
            if node != self.node_id and distances[node] != float("inf"):
                # backtrack to find the next hop
                curr = node
                while (
                    previous_nodes[curr] != self.node_id
                    and previous_nodes[curr] is not None
                ):
                    curr = previous_nodes[curr]
                if previous_nodes[curr] == self.node_id:
                    new_routing_table[node] = (curr, distances[node], hop_counts[node])

        self.routing_table = new_routing_table

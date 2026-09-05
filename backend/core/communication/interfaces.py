from abc import ABC, abstractmethod
from typing import List, Callable, Optional
from core.communication.models import NetworkMessage, LinkState


class CommunicationInterface(ABC):
    @abstractmethod
    async def send(self, message: NetworkMessage) -> bool:
        """Transmit a message to the physical medium."""

    @abstractmethod
    def set_receive_callback(self, callback: Callable[[NetworkMessage], None]) -> None:
        """Register a callback for incoming messages from the medium."""

    @abstractmethod
    def get_link_status(self) -> List[LinkState]:
        """Returns the current raw link status detected by the hardware."""


class SimCommunicationAdapter(CommunicationInterface):
    def __init__(self, node_id: str):
        self.node_id = node_id
        self._callback: Optional[Callable[[NetworkMessage], None]] = None
        # We must register with the global simulation network
        from simulation.sim_network import SimNetwork

        SimNetwork.get_instance().register_node(self.node_id, self)

    async def send(self, message: NetworkMessage) -> bool:
        from simulation.sim_network import SimNetwork

        return await SimNetwork.get_instance().transmit(self.node_id, message)

    def set_receive_callback(self, callback: Callable[[NetworkMessage], None]) -> None:
        self._callback = callback

    def receive_from_sim(self, message: NetworkMessage) -> None:
        """Called by SimNetwork when a message arrives."""
        if self._callback:
            self._callback(message)

    def get_link_status(self) -> List[LinkState]:
        from simulation.sim_network import SimNetwork

        return SimNetwork.get_instance().get_local_links(self.node_id)

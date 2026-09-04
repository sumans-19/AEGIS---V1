import asyncio
import logging
from typing import Any
import collections

from core.communication.models import NetworkMessage, MessagePriority
from core.communication.interfaces import CommunicationInterface
from core.communication.mesh_router import MeshRouter
from core.communication.store_forward import StoreAndForwardQueue
from core.communication.reliability import AckTracker
from core.communication.link_manager import LinkManager

logger = logging.getLogger("message_router")


class MessageRouter:
    def __init__(self, node_id: str, adapter: CommunicationInterface, event_bus: Any):
        self.node_id = node_id
        self.adapter = adapter
        self.event_bus = event_bus  # Local MessageBus

        self.mesh_router = MeshRouter(node_id)
        self.store_and_forward = StoreAndForwardQueue(max_messages=1000)
        self.ack_tracker = AckTracker()
        self.link_manager = LinkManager(node_id, self._send_raw)

        # Deduplication cache: LRU logic
        self._processed_messages = collections.OrderedDict()
        self.MAX_CACHE_SIZE = 5000

        # Setup callbacks
        self.adapter.set_receive_callback(self._on_message_received)
        self.link_manager.on_link_lost = self._on_link_lost
        self.link_manager.on_link_restored = self._on_link_restored

        self._running = False

    def start(self):
        if not self._running:
            self._running = True
            self.link_manager.start()
            asyncio.create_task(self._process_queue_loop())
            asyncio.create_task(self._link_status_updater())

    def stop(self):
        self._running = False
        self.link_manager.stop()

    async def _link_status_updater(self):
        while self._running:
            raw_links = self.adapter.get_link_status()
            for link in raw_links:
                self.mesh_router.update_link_state(self.node_id, link)
            await asyncio.sleep(1.0)

    def _on_link_lost(self, peer_id: str):
        logger.warning(f"[{self.node_id}] Link lost to {peer_id}")
        self.mesh_router.remove_link(self.node_id, peer_id)

        # Publish event locally
        from core.domain.events import DroneCommunicationLostEvent

        evt = DroneCommunicationLostEvent(source_id="comm", drone_id=peer_id)
        asyncio.create_task(self.event_bus.publish(f"comm.lost.{peer_id}", evt))

    def _on_link_restored(self, peer_id: str):
        logger.info(f"[{self.node_id}] Link restored to {peer_id}")

        # Publish event locally
        from core.domain.events import DroneCommunicationRestoredEvent

        evt = DroneCommunicationRestoredEvent(source_id="comm", drone_id=peer_id)
        asyncio.create_task(self.event_bus.publish(f"comm.restored.{peer_id}", evt))

    def _is_duplicate(self, message_id: str) -> bool:
        if message_id in self._processed_messages:
            return True
        self._processed_messages[message_id] = True
        if len(self._processed_messages) > self.MAX_CACHE_SIZE:
            self._processed_messages.popitem(last=False)
        return False

    def send_message(self, message: NetworkMessage):
        """Called by local components to send a message out to the swarm."""
        if message.destination_id == self.node_id:
            # Self-addressed
            self._process_local(message)
            return

        self._route_or_queue(message)

    def _send_raw(self, message: NetworkMessage):
        """Send unconditionally, used by LinkManager for heartbeats."""
        asyncio.create_task(self.adapter.send(message))

    def _route_or_queue(self, message: NetworkMessage):
        if message.is_expired:
            return

        if message.destination_id in ("BROADCAST", "SWARM"):
            # Send everywhere we can
            asyncio.create_task(self.adapter.send(message))
            if message.requires_ack:
                self.ack_tracker.track(
                    message, self._route_or_queue, self._on_delivery_failure
                )
            return

        next_hop = self.mesh_router.get_next_hop(message.destination_id)

        if next_hop:
            # Forward directly
            asyncio.create_task(
                self.adapter.send(message)
            )  # Simulation adapter ignores exact next_hop for broadcast, but in reality we'd address the frame
            if message.requires_ack:
                self.ack_tracker.track(
                    message, self._route_or_queue, self._on_delivery_failure
                )
        else:
            # Partitioned! Store and Forward
            logger.debug(
                f"[{self.node_id}] No route to {message.destination_id}, queueing message {message.message_id}"
            )
            self.store_and_forward.enqueue(message)

    def _on_delivery_failure(self, message: NetworkMessage):
        logger.error(
            f"[{self.node_id}] Failed to deliver {message.message_id} to {message.destination_id}"
        )
        # Could queue it, but if max retries failed, it's really dead.
        # Alternatively, queue it if it's critical.
        if message.priority.value <= MessagePriority.CRITICAL.value:
            self.store_and_forward.enqueue(message)

    def _on_message_received(self, message: NetworkMessage):
        if message.is_expired:
            return

        if message.message_type == "HEARTBEAT":
            self.link_manager.process_heartbeat(message.source_id)
            return

        if message.message_type == "ACK":
            ack_id = message.payload.get("ack_message_id")
            self.ack_tracker.receive_ack(ack_id)
            return

        if self._is_duplicate(message.message_id):
            # Send ACK if it was required, just in case
            if message.requires_ack and message.destination_id == self.node_id:
                self._send_ack(message)
            return

        # Is it for me?
        if message.destination_id == self.node_id or message.destination_id in (
            "BROADCAST",
            "SWARM",
        ):
            if message.requires_ack and message.destination_id == self.node_id:
                self._send_ack(message)
            self._process_local(message)

        # Should I forward it?
        if message.destination_id not in (self.node_id, "BROADCAST", "SWARM"):
            if message.hop_count >= message.max_hops:
                logger.warning(
                    f"[{self.node_id}] Dropping {message.message_id} (Max hops exceeded)"
                )
                return
            # Forward
            message.hop_count += 1
            self._route_or_queue(message)

    def _send_ack(self, message: NetworkMessage):
        ack = NetworkMessage(
            source_id=self.node_id,
            destination_id=message.source_id,
            message_type="ACK",
            payload={"ack_message_id": message.message_id},
            priority=MessagePriority.HIGH,
        )
        self._route_or_queue(ack)

    def _process_local(self, message: NetworkMessage):
        # Convert to local DomainEvent and publish to EventBus
        logger.debug(
            f"[{self.node_id}] Processing local message: {message.message_type}"
        )
        # In reality, we'd use a mapping to reconstruct the specific event class
        # For simulation, we can just pass the payload directly if it's already an event dump,
        # or we dynamically reconstruct it.
        # We will assume `payload` is dict and has `event_type`.
        event_type = message.payload.get("event_type")
        if not event_type:
            return

        # Dynamic reconstruction
        import core.domain.events as events_module

        cls = getattr(events_module, event_type, None)
        if cls:
            try:
                payload_copy = dict(message.payload)
                if event_type == "DistressReceivedEvent":
                    payload_copy["receiver_drone_id"] = self.node_id

                event = cls(**payload_copy)
                asyncio.create_task(
                    self.event_bus.publish(
                        (
                            f"network.distress_received"
                            if event_type == "DistressReceivedEvent"
                            else f"network.{event_type}"
                        ),
                        event,
                    )
                )
            except Exception as e:
                logger.error(f"Failed to reconstruct {event_type}: {e}")

    async def _process_queue_loop(self):
        while self._running:
            queued = self.store_and_forward.dequeue_all()
            for msg in queued:
                # Attempt to route again
                next_hop = self.mesh_router.get_next_hop(msg.destination_id)
                if next_hop or msg.destination_id in ("BROADCAST", "SWARM"):
                    logger.info(
                        f"[{self.node_id}] Forwarding stored message {msg.message_id}"
                    )
                    self.store_and_forward.record_forwarded()
                    self._route_or_queue(msg)
                else:
                    # Still no route, put it back
                    self.store_and_forward.enqueue(msg)
            await asyncio.sleep(1.0)

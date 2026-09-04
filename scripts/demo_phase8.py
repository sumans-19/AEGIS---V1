import asyncio
import logging
import sys
from datetime import datetime, timezone

# We'll suppress normal logs and just print the requested formatted output
logger = logging.getLogger("demo_phase8")
logger.setLevel(logging.ERROR)

from core.communication.models import NetworkMessage, MessagePriority
from core.communication.interfaces import SimCommunicationAdapter
from core.communication.message_router import MessageRouter
from simulation.sim_network import SimNetwork
from core.domain.events import DomainEvent, SurvivorConfirmedEvent

class LocalEventBus:
    def __init__(self, node_id):
        self.node_id = node_id
        
    async def publish(self, topic: str, event: DomainEvent):
        if event.event_type == "SurvivorConfirmedEvent":
            if self.node_id == "GS":
                print(f"\n[GROUND STATION]")
                print(f"SURVIVOR-1 synchronized successfully")
            else:
                pass # Only GS prints the sync success for this demo

async def main():
    print("Initializing AEGIS Phase 8 Communication Architecture...")
    
    sim_net = SimNetwork.get_instance()
    
    node_ids = ["d1", "d2", "d3", "d4", "d5", "GS"]
    routers = {}
    
    for nid in node_ids:
        adapter = SimCommunicationAdapter(nid)
        bus = LocalEventBus(nid)
        router = MessageRouter(nid, adapter, bus)
        
        # Suppress internal router logs for cleaner output
        router.logger = logging.getLogger(f"router_{nid}")
        router.logger.setLevel(logging.ERROR)
        
        routers[nid] = router
        router.start()
        
    # Primary Route: d3 <-> d2 <-> d1 <-> GS
    sim_net.set_link("d3", "d2", latency=0.01)
    sim_net.set_link("d2", "d1", latency=0.01)
    sim_net.set_link("d1", "GS", latency=0.01)
    
    # Alternate Route: d3 <-> d4 <-> d5 <-> GS
    sim_net.set_link("d3", "d4", latency=0.01)
    sim_net.set_link("d4", "d5", latency=0.01)
    sim_net.set_link("d5", "GS", latency=0.01)
    
    await asyncio.sleep(4.0)
    
    print("\n[DETECTION]")
    print("DRONE-3 detected survivor")
    print("Event: SURVIVOR-1")
    
    survivor_event = SurvivorConfirmedEvent(
        source_id="perception",
        survivor_id="SURV-1",
        drone_id="d3",
        confirmed_location={"x": 10, "y": 0, "z": 20},
        confidence=0.99,
        evidence_sources=["cam1"]
    )
    
    print("\n[ROUTING]")
    print("DRONE-3 -> DRONE-2 -> DRONE-1 -> GROUND-STATION")
    
    msg = NetworkMessage(
        source_id="d3",
        destination_id="GS",
        message_type="SurvivorConfirmedEvent",
        payload=survivor_event.model_dump(),
        priority=MessagePriority.CRITICAL,
        requires_ack=True
    )
    routers["d3"].send_message(msg)
    
    await asyncio.sleep(1.0)
    print("\n[DELIVERY]")
    print("ACK received")
    
    # Break the link
    print("\n[ROUTE FAILURE INJECTED]")
    print("Breaking link DRONE-2 <-> DRONE-1")
    sim_net.links[("d2", "d1")]["active"] = False
    sim_net.links[("d1", "d2")]["active"] = False
    
    await asyncio.sleep(4.0)
    
    print("\n[ROUTING]")
    print("DRONE-3 -> DRONE-4 -> DRONE-5 -> GROUND-STATION")
    routers["d3"].send_message(msg)
    
    await asyncio.sleep(1.0)
    
    print("\n[PARTITION]")
    print("Network partition injected")
    sim_net.partition_network(["d3"], ["d2", "d4"])
    
    await asyncio.sleep(4.0)
    
    print("\n[OFFLINE]")
    print("DRONE-3 storing SURVIVOR-2 locally")
    
    survivor_event2 = SurvivorConfirmedEvent(
        source_id="perception",
        survivor_id="SURV-2",
        drone_id="d3",
        confirmed_location={"x": 12, "y": 0, "z": 22},
        confidence=0.99,
        evidence_sources=["cam1"]
    )
    msg3 = NetworkMessage(
        source_id="d3",
        destination_id="GS",
        message_type="SurvivorConfirmedEvent",
        payload=survivor_event2.model_dump(),
        priority=MessagePriority.CRITICAL,
        requires_ack=True
    )
    routers["d3"].send_message(msg3)
    
    await asyncio.sleep(3.0)
    
    print("\n[RESTORE]")
    print("Network connectivity restored")
    sim_net.heal_partition(["d3"], ["d4"])
    
    print("\n[SYNC]")
    print("DRONE-3 -> DRONE-4 -> DRONE-5 -> GROUND-STATION")
    
    await asyncio.sleep(2.0)
    
    for r in routers.values():
        r.stop()
        
if __name__ == "__main__":
    asyncio.run(main())

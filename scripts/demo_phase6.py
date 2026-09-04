import asyncio
import logging
import numpy as np
from datetime import datetime, timezone

from core.domain.mission import Mission, SearchArea
from core.domain.events import DomainEvent
from core.domain.world_manager import WorldManager
from core.flight.safety import SafetyValidator
from core.mission.engine import MissionEngine
from core.hardware.sim_adapters import SimFlightController
from simulation.world_state import DroneState as LegacyDroneState

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("demo_phase6")

class DummyBus:
    def __init__(self):
        self.subs = {}
        
    def subscribe(self, topic, callback):
        self.subs[topic] = callback
        
    async def publish(self, topic, event: DomainEvent):
        logger.info(f"[BUS] {topic}: {event.event_type} - {event.model_dump_json(exclude_none=True)}")
        if topic in self.subs:
            await self.subs[topic](event)

async def main():
    logger.info("Initializing Phase 6 Simulation Demo")
    
    # 1. Setup Architecture
    wm = WorldManager()
    safety = SafetyValidator()
    
    legacy_drone = LegacyDroneState(id=1, callsign="D1", status="IDLE", pos=np.array([10.0, 10.0, 10.0]))
    fc = SimFlightController(legacy_drone)
    
    bus = DummyBus()
    engine = MissionEngine(wm, safety, fc, bus)
    
    # Register Drone in WorldManager
    from core.domain.events import DroneRegistered, DroneTelemetryUpdated
    reg = DroneRegistered(source_id="demo", drone_id="drone_1", callsign="D1")
    await wm.apply_event(reg)
    
    # Provide initial telemetry to pass pre-flight
    tel = DroneTelemetryUpdated(
        source_id="demo",
        drone_id="drone_1",
        pos={"x": 34.0, "y": 0.0, "z": -118.0},
        vel={"vx": 0.0, "vy": 0.0, "vz": 0.0, "heading": 0.0},
        localization={"confidence": 0.9, "method": "GPS"}
    )
    await wm.apply_event(tel)
    
    # Start telemetry pump so it doesn't go stale
    async def telemetry_pump():
        while True:
            tel.timestamp = datetime.now(timezone.utc)
            await wm.apply_event(tel)
            await asyncio.sleep(1.0)
            
    pump_task = asyncio.create_task(telemetry_pump())
    
    # 2. Define Mission
    area = SearchArea(
        boundaries=[(34.0, -118.0), (34.0001, -118.0), (34.0001, -118.0001), (34.0, -118.0001)],
        min_altitude=5.0,
        max_altitude=50.0,
        search_altitude=20.0,
        grid_spacing=5.0,
        entry_point=(34.0, -118.0),
        exit_point=(34.0, -118.0)
    )
    
    mission = Mission(
        mission_id="mission_demo_1",
        mission_type="SEARCH_AND_RESCUE",
        search_area=area,
        home_location=(34.0, -118.0, 0.0),
        assigned_drones=["drone_1"]
    )
    
    # 3. Start Mission
    logger.info("Starting Mission Engine...")
    await engine.start_mission(mission)
    
    # Wait for takeoff and transit
    await asyncio.sleep(4)
    
    # Provide updated telemetry showing it reached search altitude
    tel.pos.y = 20.0
    await wm.apply_event(tel)
    logger.info("Drone reached search altitude.")
    
    await asyncio.sleep(3)
    
    # 4. Simulate Survivor Detection during SEARCHING
    logger.info("Simulating Object Detection Event...")
    from core.domain.events import ObjectDetectedEvent
    det = ObjectDetectedEvent(
        source_id="perception",
        detection_id="det1",
        drone_id="drone_1",
        sensor_id="cam1",
        frame_id="f1",
        class_name="person",
        confidence=0.85,
        bounding_box={"x1": 0, "y1": 0, "x2": 100, "y2": 100},
        source="yolo"
    )
    await wm.apply_event(det) # This publishes PotentialSurvivorEvent internally
    
    # Wait for investigation and confirmation
    await asyncio.sleep(6)
    
    # 5. Finish
    logger.info("Demo complete. Mission status: " + engine.active_mission.status)

if __name__ == "__main__":
    asyncio.run(main())

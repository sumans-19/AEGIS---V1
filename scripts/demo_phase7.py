import asyncio
import logging
import sys
import math

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("demo_phase7")

from core.domain.world_manager import WorldManager
from core.flight.safety import SafetyValidator
from core.mission.engine import MissionEngine
from core.hardware.sim_adapters import SimFlightController
from core.domain.mission import Mission, SearchArea
from core.domain.events import DroneRegistered, DroneTelemetryUpdated, BatteryUpdated, DroneFailed

class MockMessageBus:
    def __init__(self, wm: WorldManager):
        self.subscribers = {}
        self.wm = wm
        
    def subscribe(self, topic, callback):
        if topic not in self.subscribers:
            self.subscribers[topic] = []
        self.subscribers[topic].append(callback)
        
    async def publish(self, topic, event):
        logger.info(f"Bus [Topic: {topic}]: {event.event_type} - {event.model_dump()}")
        # Pass to WM
        await self.wm.apply_event(event)
        
        # Notify subscribers
        if topic in self.subscribers:
            for cb in self.subscribers[topic]:
                asyncio.create_task(cb(event))

async def main():
    logger.info("Initializing AEGIS Phase 7 Swarm Architecture...")
    
    wm = WorldManager()
    bus = MockMessageBus(wm)
    wm.bus = bus
    safety = SafetyValidator()
    
    # 1. Create 5 Simulated Drones
    fcs = {}
    drone_ids = [f"d{i}" for i in range(1, 6)]
    
    from simulation.world_state import DroneState as LegacyDroneState
    import numpy as np

    for i, d_id in enumerate(drone_ids):
        d_x = i * 20.0
        legacy_drone = LegacyDroneState(id=i, callsign=f"Swarm-{i+1}", status="IDLE", pos=np.array([d_x, 0.0, 0.0]))
        fc = SimFlightController(legacy_drone)
        fc.bus = bus
        fcs[d_id] = fc
        await wm.apply_event(DroneRegistered(source_id="demo", drone_id=d_id, callsign=f"Swarm-{i+1}"))
        # Set initial positions in a line
        d_x = i * 20.0
        fc.pos_x = d_x
        fc.pos_z = 0.0
        
        # We also need to send an initial telemetry/battery so they are valid
        from core.domain.state import PositionState, VelocityState, LocalizationState, BatteryState
        await wm.apply_event(DroneTelemetryUpdated(
            source_id="demo", drone_id=d_id,
            pos=PositionState(x=d_x, y=0.0, z=0.0),
            vel=VelocityState(), localization=LocalizationState()
        ))
        await wm.apply_event(BatteryUpdated(source_id="demo", drone_id=d_id, battery=BatteryState(voltage=15.0, percentage=100.0, current=1.0)))
        
    engine = MissionEngine(world_manager=wm, safety_validator=safety, flight_controllers=fcs, bus=bus)
    
    # 2. Create Mission
    area = SearchArea(
        boundaries=[(0.0, 0.0), (100.0, 0.0), (100.0, 100.0), (0.0, 100.0)],
        entry_point=(0.0, 0.0),
        exit_point=(100.0, 100.0),
        min_altitude=10.0, max_altitude=50.0, search_altitude=20.0, grid_spacing=20.0
    )
    
    mission = Mission(
        mission_type="SEARCH_AND_RESCUE",
        priority=1,
        search_area=area,
        home_location=(0.0, 0.0, 0.0),
        assigned_drones=drone_ids
    )
    
    logger.info("Starting Mission Engine...")
    await engine.start_mission(mission)
    
    # Let swarm organize and start flying
    await asyncio.sleep(5.0)
    
    # 3. Inject Failure: Drone 3 fails
    logger.critical(">>> INJECTING FAILURE: DRONE d3 FAILS <<<")
    await wm.apply_event(DroneFailed(source_id="demo", drone_id="d3", reason="Motor Overheat"))
    
    await asyncio.sleep(5.0)
    
    # 4. Inject Failure: Drone 4 Low Battery
    logger.critical(">>> INJECTING SENSOR CHANGE: DRONE d4 LOW BATTERY <<<")
    await wm.apply_event(BatteryUpdated(source_id="demo", drone_id="d4", battery=BatteryState(voltage=13.0, percentage=12.0, current=5.0)))
    
    await asyncio.sleep(10.0)
    
    logger.info("Demo complete.")
    engine._running = False
    for fc in fcs.values():
        fc._running = False

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Exiting demo...")

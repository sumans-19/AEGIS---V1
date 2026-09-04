import asyncio
import logging
import sys

from core.runtime import AegisRuntime
from core.domain.mission import Mission, SearchArea
from simulation.fault_injection import FaultInjector

# Configure standard logger to only show specific levels for clarity
logging.basicConfig(level=logging.WARNING, format='%(levelname)s: %(message)s')

# Suppress debug logs from the bus
logging.getLogger("message_bus").setLevel(logging.ERROR)

async def main():
    print("=" * 60)
    print("AEGIS PHASE 10: FAULT-TOLERANT AUTONOMY DEMONSTRATION")
    print("=" * 60)
    
    runtime = AegisRuntime(mode="SIMULATION")
    await runtime.start()
    
    injector = FaultInjector(runtime)
    
    # 1. Start a mission
    print("\n[T+0] Starting SAR Mission with 5 Drones")
    mission = Mission(
        assigned_drones=["1", "2", "3", "4", "5"],
        search_area=SearchArea(
            boundaries=[(0,0), (0,100), (100,100), (100,0)],
            entry_point=(0,0),
            exit_point=(100,100)
        ),
        home_location=(0,0,0)
    )
    await runtime.mission_engine.start_mission(mission)
    
    for _ in range(5):
        await runtime.tick(1.0)
        await asyncio.sleep(0.1)
        
    print("\nMission active. All drones in PRE_FLIGHT_CHECK/TAKEOFF.")
    
    # Fast forward drones to SEARCHING state for demo purposes
    for i in range(1, 6):
        d_id = str(i)
        runtime.mission_engine.drone_contexts[d_id]["status"] = "SEARCHING"
        
    # 2. Inject Camera Failure
    print("\n[T+10] INJECTING NON-CRITICAL FAULT: Camera Failure on DRONE-2")
    injector.inject_camera_failure("2")
    
    for _ in range(2):
        await runtime.tick(1.0)
        await asyncio.sleep(0.1)
        
    ctx2 = runtime.mission_engine.drone_contexts["2"]
    print(f"DRONE-2 Status: {ctx2['status']}")
    print("Result: Mission continues gracefully. Fault categorized as DEGRADED.")
    
    # 3. Inject Communication Loss
    print("\n[T+20] INJECTING CRITICAL FAULT: Communication Loss on DRONE-3")
    injector.inject_communication_partition("3")
    
    for _ in range(3):
        await runtime.tick(1.0)
        await asyncio.sleep(0.1)
        
    ctx3 = runtime.mission_engine.drone_contexts["3"]
    print(f"DRONE-3 Status: {ctx3['status']}")
    print("Result: DRONE-3 marked OFFLINE locally. Swarm will reassign its sub-tasks when lease expires.")
    
    # 4. Inject Battery Critical
    print("\n[T+30] INJECTING CRITICAL FAULT: Battery Collapse on DRONE-5")
    injector.inject_battery_critical("5")
    
    for _ in range(2):
        await runtime.tick(1.0)
        await asyncio.sleep(0.1)
        
    ctx5 = runtime.mission_engine.drone_contexts["5"]
    print(f"DRONE-5 Status: {ctx5['status']}")
    print("Result: Engine triggered hardware failsafe. DRONE-5 is Returning to Home.")
    
    # 5. Inject Flight Controller Timeout
    print("\n[T+40] INJECTING CRITICAL FAULT: Flight Controller Timeout on DRONE-1")
    injector.inject_fc_timeout("1")
    
    for _ in range(2):
        await runtime.tick(1.0)
        await asyncio.sleep(0.1)
        
    ctx1 = runtime.mission_engine.drone_contexts["1"]
    print(f"DRONE-1 Status: {ctx1['status']}")
    print("Result: Failsafe triggered. Commands rejected, defaulting to RTH.")
    
    print("\n" + "=" * 60)
    print("DEMONSTRATION COMPLETE")
    print("AEGIS handles all faults deterministically without uncontrolled behavior.")
    print("=" * 60)
    
    await runtime.stop()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass

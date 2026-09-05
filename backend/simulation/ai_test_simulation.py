"""
AEGIS AI intelligence demo — run from backend/:
  python simulation/ai_test_simulation.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import numpy as np

from simulation.world_state import world, DroneState
from simulation.decision_engine import evaluate_drone
from simulation.ai_actions import apply_ai_decision
from simulation.ai_logging import log_system

drones = [
    DroneState(id=1, callsign="FALCON", status="ACTIVE", pos=np.array([0, 0, 20])),
    DroneState(id=2, callsign="HAWK", status="ACTIVE", pos=np.array([10, 5, 20])),
    DroneState(id=3, callsign="OSPREY", status="ACTIVE", pos=np.array([20, 10, 20])),
    DroneState(id=4, callsign="KESTREL", status="ACTIVE", pos=np.array([30, 15, 20])),
    DroneState(id=5, callsign="MERLIN", status="ACTIVE", pos=np.array([40, 20, 20])),
]

# Test scenarios (do not call update_telemetry — preserve injected faults)
drones[0].battery = 10
drones[1].thermal_status = False
drones[2].obstacle_distance = 0.5
drones[3].signal_strength = 10
drones[4].cpu_temperature = 95

log_system("========== AEGIS AI TEST ==========")
print()

for drone in drones:
    print(f"--- Drone {drone.id} ({drone.callsign}) ---")

    decision = evaluate_drone(drone)
    apply_ai_decision(drone, decision, drones, verbose=True)

    print(f"Status: {drone.status}")
    print(f"Autonomous Mode: {drone.autonomous_mode}")
    print(f"Nearby Drone: {drone.nearby_drone_id}")
    print()

log_system("========== TEST COMPLETE ==========")


def run_simulation_step():
    if not world.drones:
        # initialize real drones once
        for i in range(5):
            drone = DroneState(
                id=i + 1,
                callsign=["FALCON", "HAWK", "OSPREY", "KESTREL", "MERLIN"][i],
                status="ACTIVE",
                pos=np.array([0.0, 0.0, 20.0]),
            )
            world.drones.append(drone)

    results = []

    for drone in world.drones:
        drone.update_telemetry()  # real simulation

        decision = evaluate_drone(drone)

        results.append(
            {
                "id": drone.id,
                "battery": drone.battery,
                "signal": drone.signal_strength,
                "cpu_temp": drone.cpu_temperature,
                "motor_temp": drone.motor_temperature,
                "propeller": drone.propeller_health,
                "status": drone.status,
                "action": str(decision),
            }
        )

    return {"drones": results}

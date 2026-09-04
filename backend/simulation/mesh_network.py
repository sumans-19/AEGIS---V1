import numpy as np
import random
from simulation.world_state import LogEntry

# Base station is assumed to be at (0, 0, 0)
BASE_STATION_POS = np.array([0.0, 0.0, 0.0])
MAX_RANGE = 75.0  # Max distance for direct comms before needing relay


def compute_mesh_network(world_state):
    """
    Computes a simple BFS shortest-path tree from the base station to all drones.
    A drone is 'connected' if it is within MAX_RANGE of the base, OR within MAX_RANGE
    of another connected drone.
    Updates `drone.relay_chain`, `drone.mesh_connected`, and `drone.signal_strength`.
    """
    # Reset mesh state
    for drone in world_state.drones:
        drone.mesh_connected = False
        drone.relay_chain = []
        drone.signal_strength = 0.0

    # Queue for BFS: (drone, distance_from_base_in_hops)
    # We treat base station as a virtual node 0
    connected_nodes = {0: {"pos": BASE_STATION_POS, "chain": []}}

    # Simple BFS
    changed = True
    while changed:
        changed = False
        for drone in world_state.drones:
            if drone.mesh_connected:
                continue

            # Find the best (shortest chain) connected node in range
            best_parent_id = None
            best_chain_len = 999

            for parent_id, parent_data in connected_nodes.items():
                dist = np.linalg.norm(drone.pos - parent_data["pos"])
                if dist <= MAX_RANGE:
                    if len(parent_data["chain"]) < best_chain_len:
                        best_parent_id = parent_id
                        best_chain_len = len(parent_data["chain"])

            if best_parent_id is not None:
                drone.mesh_connected = True
                parent_chain = connected_nodes[best_parent_id]["chain"]
                if best_parent_id == 0:
                    drone.relay_chain = []
                else:
                    drone.relay_chain = parent_chain + [best_parent_id]

                connected_nodes[drone.id] = {
                    "pos": drone.pos,
                    "chain": drone.relay_chain,
                }
                changed = True

    # Update signal strength based on hops and distance to last node
    for drone in world_state.drones:
        if drone.mesh_connected:
            hops = len(drone.relay_chain)
            # Find parent pos
            if hops == 0:
                parent_pos = BASE_STATION_POS
            else:
                parent = next(
                    (d for d in world_state.drones if d.id == drone.relay_chain[-1]),
                    None,
                )
                parent_pos = parent.pos if parent else BASE_STATION_POS

            dist_to_parent = np.linalg.norm(drone.pos - parent_pos)
            # base signal minus hop penalty minus distance penalty
            signal = 100.0 - (hops * 15.0) - (dist_to_parent / MAX_RANGE * 20.0)
            # add some noise
            signal += random.uniform(-2, 2)
            drone.signal_strength = max(0, min(100, signal))

            if drone.status == "HOVER" and "COMMS" in " ".join(drone.recent_events):
                # We regained comms?
                pass
        else:
            drone.signal_strength = random.uniform(0, 5)
            if drone.status in ("SCANNING", "SEARCHING") and random.random() < 0.1:
                world_state.event_log.append(
                    LogEntry(
                        world_state.sim_time,
                        drone.id,
                        "warning",
                        f"COMMS ISOLATION: {drone.callsign} HAS NO RELAY TO BASE",
                    )
                )

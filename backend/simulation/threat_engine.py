import numpy as np
import random
from simulation.world_state import LogEntry, Threat


def place_threats(world_state):
    """Place threats based on the scenario."""
    world_state.threats = []

    if world_state.scenario == "earthquake":
        world_state.threats.append(
            Threat(id=1, pos=np.array([5, 0.5, 5]), type="gas_leak", severity="high")
        )
        world_state.threats.append(
            Threat(
                id=2, pos=np.array([-15, 0.5, 15]), type="gas_leak", severity="critical"
            )
        )
    elif world_state.scenario == "wildfire":
        world_state.threats.append(
            Threat(
                id=1, pos=np.array([0, 0.5, 0]), type="wildfire", severity="critical"
            )
        )
        world_state.threats.append(
            Threat(id=2, pos=np.array([10, 0.5, -20]), type="wildfire", severity="high")
        )
        world_state.threats.append(
            Threat(
                id=3, pos=np.array([-25, 0.5, 10]), type="wildfire", severity="medium"
            )
        )
    elif world_state.scenario == "tsunami":
        world_state.threats.append(
            Threat(id=1, pos=np.array([0, 0.5, 0]), type="debris", severity="medium")
        )
    elif world_state.scenario == "flood":
        world_state.threats.append(
            Threat(
                id=1, pos=np.array([-10, 0.5, -10]), type="debris", severity="medium"
            )
        )
    elif world_state.scenario == "war_zone":
        world_state.threats.append(
            Threat(
                id=1,
                pos=np.array([12, 0.5, 12]),
                type="unexploded_ordnance",
                severity="critical",
            )
        )
        world_state.threats.append(
            Threat(
                id=2, pos=np.array([-18, 0.5, 5]), type="armed_group", severity="high"
            )
        )
        world_state.threats.append(
            Threat(id=3, pos=np.array([5, 15, -10]), type="sniper", severity="critical")
        )


def check_threats(world_state):
    """Detect threats similar to survivors."""
    for drone in world_state.drones:
        if drone.status not in ["SCANNING", "SEARCHING"]:
            continue

        for t in world_state.threats:
            if t.detected:
                continue

            dist_2d = np.linalg.norm(drone.pos[:2] - t.pos[:2])
            if dist_2d < drone.scan_radius:
                # Detection prob increases as you get closer to center of scan cone
                detection_prob = 1.0 - (dist_2d / drone.scan_radius)

                if (
                    random.random() < detection_prob * 0.15
                ):  # 15% chance per tick when in range
                    t.detected = True
                    t.detected_by = drone.id
                    t.detected_at = world_state.sim_time

                    # Randomize confidence based on severity and distance
                    base_conf = 0.6 if t.severity in ["low", "medium"] else 0.8
                    t.classification_confidence = min(
                        0.99,
                        base_conf
                        + (1.0 - dist_2d / drone.scan_radius) * 0.2
                        + random.uniform(-0.05, 0.05),
                    )

                    world_state.detected_threats.append(t.id)
                    world_state.event_log.append(
                        LogEntry(
                            world_state.sim_time,
                            drone.id,
                            "critical",
                            f"THREAT DETECTED: {t.type.upper()} ({t.severity.upper()}) at [{t.pos[0]:.0f}, {t.pos[2]:.0f}]. Confidence {t.classification_confidence:.0%}.",
                        )
                    )

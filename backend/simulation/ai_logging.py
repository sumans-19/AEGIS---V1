"""Structured console and event-log helpers for the AI intelligence layer."""

from simulation.world_state import LogEntry


def log_ai_brain(drone_id: int, action: str, reason: str) -> None:
    print(f"[AI BRAIN] Drone {drone_id} -> {action}")
    if reason:
        print(f"Reason: {reason}")


def log_failover(helper_id: int, drone_id: int) -> None:
    print(f"[FAILOVER] Drone {helper_id} assisting Drone {drone_id}")


def log_rl(drone_id: int, reward: float, total: float) -> None:
    sign = "+" if reward >= 0 else ""
    print(f"[RL] Drone {drone_id} Reward {sign}{reward:.0f} (total: {total:.1f})")


def log_telemetry(drone_id: int, battery: float, signal: float, thermal: bool) -> None:
    thermal_label = "OK" if thermal else "FAIL"
    print(
        f"[TELEMETRY] Drone {drone_id} | "
        f"Battery={battery:.1f}% Signal={signal:.1f}% Thermal={thermal_label}"
    )


def log_warning(message: str) -> None:
    print(f"[WARNING] {message}")


def log_system(message: str) -> None:
    print(f"[SYSTEM] {message}")


def make_ai_log_entry(
    sim_time: float, drone_id: int, action: str, reason: str
) -> LogEntry:
    return LogEntry(
        time=sim_time,
        drone_id=drone_id,
        category="ai",
        message=f"[AI BRAIN] {action} — {reason}",
    )


def make_failover_log_entry(sim_time: float, drone_id: int, helper_id: int) -> LogEntry:
    return LogEntry(
        time=sim_time,
        drone_id=drone_id,
        category="failover",
        message=f"[FAILOVER] Drone {helper_id} assisting Drone {drone_id}",
    )

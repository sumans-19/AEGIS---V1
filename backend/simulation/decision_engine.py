import joblib
import pandas as pd
import numpy as np
from pathlib import Path
import random

# -------------------------
# LOAD TRAINED ML MODEL
# -------------------------

_MODEL_CANDIDATES = [
    Path(__file__).resolve().parent / "drone_decision_model.pkl",
    Path(__file__).resolve().parent.parent / "drone_decision_model.pkl",
]


def _load_model():
    for path in _MODEL_CANDIDATES:
        if path.is_file():
            return joblib.load(path)
    raise FileNotFoundError(
        "drone_decision_model.pkl not found. Run: python simulation/train_model.py"
    )


model = _load_model()


# -------------------------
# SAFE PYTORCH DQN MODEL LOAD
# -------------------------

RL_AVAILABLE = False
rl_model = None

try:
    import torch
    from rl.dqn_model import DQN

    rl_model = DQN()

    # STEP 7: Look for model in rl/ directory
    possible_paths = [
        Path(__file__).resolve().parent.parent / "rl" / "dqn_model.pth",
        Path(__file__).resolve().parent.parent / "dqn_model.pth",
        Path("rl/dqn_model.pth"),
        Path("dqn_model.pth"),
    ]

    for p in possible_paths:
        if p.is_file():
            rl_model.load_state_dict(torch.load(p, map_location=torch.device("cpu")))
            rl_model.eval()
            RL_AVAILABLE = True  # Enabled with phase guard
            print(f"[DQN] RL model loaded from {p} (Phase guard active)")
            break

    if not RL_AVAILABLE:
        print("[DQN] No dqn_model.pth found - RL disabled, using rule-based fallback")
except ImportError:
    print("[DQN] PyTorch not installed - RL disabled")
except Exception as e:
    print(f"[DQN] PyTorch model load failed: {e}")


# -------------------------
# RL DECIDE FUNCTION
# -------------------------


def rl_decide(state):
    """STEP 8: RL decision with epsilon-greedy exploration."""
    if not RL_AVAILABLE or rl_model is None:
        return None

    actions = [
        "CONTINUE_MISSION",
        "RETURN_TO_BASE",
        "REQUEST_NEAREST_SENSOR",
        "REROUTE",
    ]

    # Exploration (Epsilon-greedy with epsilon = 0.1)
    epsilon = 0.1
    if random.random() < epsilon:
        return random.choice(actions)

    # Exploitation: Forward pass through DQN
    try:
        import torch

        # STEP 4: Model input normalization
        s = torch.tensor(
            [
                state["battery"] / 100.0,
                state["signal"] / 100.0,
                state["cpu"] / 100.0,
                float(state["thermal"]),
                state["obstacle"] / 10.0,
            ],
            dtype=torch.float32,
        )

        with torch.no_grad():
            q_values = rl_model(s)

        action_idx = torch.argmax(q_values).item()
        return actions[action_idx]
    except Exception:
        return "CONTINUE_MISSION"


# -------------------------
# AI HYBRID DECISION FUNCTION
# -------------------------


def get_val(obj, key, default):
    if isinstance(obj, dict):
        return obj.get(key, default)
    try:
        return getattr(obj, key, default)
    except AttributeError:
        return default


def evaluate_drone(drone):
    battery = get_val(drone, "battery", 100.0)

    # Get signal (supporting both signal_strength and signal)
    signal = get_val(drone, "signal_strength", None)
    if signal is None:
        signal = get_val(drone, "signal", 100.0)

    # Get thermal (supporting both thermal_status and thermal)
    thermal = get_val(drone, "thermal_status", None)
    if thermal is None:
        thermal = get_val(drone, "thermal", True)

    # Get obstacle (supporting both obstacle_distance and obstacle)
    obstacle = get_val(drone, "obstacle_distance", 10.0)

    # Determine if any critical safety rules are triggered
    safety_triggered = (
        (battery < 30) or (signal < 25) or (thermal is False) or (obstacle < 1)
    )

    status = get_val(drone, "status", "IDLE")
    critical_phases = ["DEPLOYING", "SEARCHING", "RETURNING"]

    # STEP 9: Hybrid decision system — RL only when safe
    if RL_AVAILABLE and not safety_triggered:
        state = {
            "battery": battery,
            "signal": signal,
            "cpu": get_val(drone, "cpu_temperature", 40.0),
            "thermal": thermal,
            "obstacle": obstacle,
        }
        rl_action = rl_decide(state)

        if rl_action:
            if status in critical_phases and rl_action in ["RETURN_TO_BASE", "REROUTE"]:
                # print(f"[RL] RL decision '{rl_action}' overridden (Phase: {status})")
                rl_action = "RL_ADVISORY"

            if rl_action != "CONTINUE_MISSION":
                # print(f"[RL] RL decision used: {rl_action}")
                return {
                    "action": rl_action,
                    "reason": (
                        "RL Optimized Decision"
                        if rl_action != "RL_ADVISORY"
                        else f"RL Advises: {rl_action}"
                    ),
                }

    # Rule-Based / Fallback Decisions if safety is triggered or RL is not yet available

    # 0. Task Constraints check
    if getattr(drone, "current_task_id", None):
        from simulation.world_state import world

        task = world.task_queue.get(drone.current_task_id)
        if task:
            if battery < task.required_battery:
                world.trigger_commander_assessment("DRONE_FAILURE: Low Battery")
                return {
                    "action": "RETURN_TO_BASE",
                    "reason": f"Battery below task req ({task.required_battery}%)",
                }
            for req_sensor in task.required_sensors:
                if req_sensor == "thermal" and not thermal:
                    world.trigger_commander_assessment("DRONE_FAILURE: Sensor Lost")
                    return {
                        "action": "REQUEST_NEAREST_SENSOR",
                        "reason": "Required thermal sensor failed",
                    }

    # 1. Battery critically low
    if battery < 30:
        from simulation.world_state import world

        world.trigger_commander_assessment("DRONE_FAILURE: Critical Battery")
        return {"action": "RETURN_TO_BASE", "reason": "Battery critically low"}

    # 2. Weak signal
    if signal < 25:
        return {"action": "REROUTE", "reason": "Weak signal"}

    # 3. Thermal sensor failure
    if thermal is False:
        return {"action": "REQUEST_NEAREST_SENSOR", "reason": "Thermal sensor failure"}

    # 4. Obstacle too close
    if obstacle < 1:
        return {"action": "AVOID_OBSTACLE", "reason": "Obstacle too close"}

    # fallback to traditional ML model evaluation
    input_data = pd.DataFrame(
        [
            {
                "battery": battery,
                "propeller_health": get_val(drone, "propeller_health", 100.0),
                "cpu_temperature": get_val(drone, "cpu_temperature", 40.0),
                "signal_strength": signal,
                "thermal_status": int(thermal),
                "lidar_status": int(get_val(drone, "lidar_status", True)),
                "obstacle_distance": obstacle,
                "moisture_level": get_val(drone, "moisture_level", 0.0),
                "smoke_density": get_val(drone, "smoke_density", 0.0),
                "altitude": get_val(drone, "altitude", 20.0),
                "speed": (
                    np.linalg.norm(get_val(drone, "vel", np.zeros(3)))
                    if not isinstance(get_val(drone, "vel", None), (int, float))
                    else get_val(drone, "vel", 0.0)
                ),
            }
        ]
    )

    try:
        action = model.predict(input_data)[0]
    except Exception:
        action = "CONTINUE_MISSION"

    reason = "AI autonomous decision"

    if action == "RETURN_TO_BASE":
        reason = "Battery critically low"
    elif action == "REROUTE":
        reason = "Obstacle detected"
    elif action == "AUTONOMOUS_MODE":
        reason = "Weak signal"
    elif action == "REQUEST_NEAREST_SENSOR":
        reason = "Thermal sensor failure"
    elif action == "LOW_POWER_MODE":
        reason = "CPU overheating"
    elif action == "REDUCE_SPEED":
        reason = "Propeller degraded"
    elif action == "INCREASE_ALTITUDE":
        reason = "High moisture — climbing"
    elif action == "CONTINUE_MISSION":
        reason = "All systems nominal"

    return {
        "action": action,
        "reason": reason,
    }

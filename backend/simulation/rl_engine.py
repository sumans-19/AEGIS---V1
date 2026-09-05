"""Reinforcement learning reward calculation for AI drone decisions."""


def get_val(obj, key, default):
    if isinstance(obj, dict):
        return obj.get(key, default)
    try:
        return getattr(obj, key, default)
    except AttributeError:
        return default


def calculate_reward(drone, decision):
    if isinstance(decision, dict):
        action = decision.get("action", "CONTINUE_MISSION")
    else:
        action = str(decision)

    # Use get_val to safely handle both object and dict drones
    battery = get_val(drone, "battery", 100.0)

    signal = get_val(drone, "signal_strength", None)
    if signal is None:
        signal = get_val(drone, "signal", 100.0)

    thermal = get_val(drone, "thermal_status", None)
    if thermal is None:
        thermal = get_val(drone, "thermal", True)

    obstacle = get_val(drone, "obstacle_distance", None)
    if obstacle is None:
        obstacle = get_val(drone, "obstacle", 10.0)

    # Calculate reward
    reward = 0

    # -----------------------------
    # CRITICAL FAILURE CASES
    # -----------------------------
    # Battery critical
    if battery < 20:
        if action == "RETURN_TO_BASE":
            reward = 10
        else:
            reward = -5

    # Signal weak
    elif signal < 30:
        if action == "REROUTE":
            reward = 5
        else:
            reward = -3

    # Thermal failure
    elif not thermal:
        if action == "REQUEST_NEAREST_SENSOR":
            reward = 7
        else:
            reward = -4

    # Obstacle very close
    elif obstacle < 2:
        if action == "REROUTE":
            reward = 6
        else:
            reward = -4

    # -----------------------------
    # NORMAL SAFE STATE
    # -----------------------------
    elif action == "CONTINUE_MISSION":
        reward = 1  # small positive reward

    # -----------------------------
    # UNNECESSARY ACTION PENALTY
    # -----------------------------
    else:
        reward = -1

    get_val(drone, "id", "?")
    # print(f"[REWARD] Drone {drone_id} | Action: {action} | Reward: {reward}")
    return float(reward)

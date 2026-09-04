from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Body
import numpy as np
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio
from datetime import datetime
from simulation.world_state import world, DroneState
from api.routes import router
from api.api_websocket import hub
from simulation.decision_engine import evaluate_drone
from simulation.ai_actions import apply_ai_decision
from db.mongo import insert_experience, MONGO_AVAILABLE
from simulation.rl_engine import calculate_reward
import threading

CALLSIGNS = ["FALCON", "HAWK", "OSPREY", "KESTREL", "MERLIN"]

# DQN RL State Transition History Tracker
DRONE_PREVIOUS_TRANSITIONS = {}


def record_drone_experience(
    drone_id: int, current_drone, action_str: str, reward_val: float
):
    """Store (s, a, r, s') transition in MongoDB for DQN training."""
    if not MONGO_AVAILABLE:
        return

    try:

        def get_val(obj, key, default):
            if isinstance(obj, dict):
                return obj.get(key, default)
            try:
                return getattr(obj, key, default)
            except AttributeError:
                return default

        def get_normalized_state(obj):
            battery = float(get_val(obj, "battery", 100.0))

            signal = get_val(obj, "signal_strength", None)
            if signal is None:
                signal = get_val(obj, "signal", 100.0)
            signal = float(signal)

            cpu = get_val(obj, "cpu_temperature", None)
            if cpu is None:
                cpu = get_val(obj, "cpu", 40.0)
            cpu = float(cpu)

            thermal = get_val(obj, "thermal_status", None)
            if thermal is None:
                thermal = get_val(obj, "thermal", True)

            obstacle = get_val(obj, "obstacle_distance", None)
            if obstacle is None:
                obstacle = get_val(obj, "obstacle", 10.0)
            obstacle = float(obstacle)

            return {
                "battery": battery,
                "signal": signal,
                "cpu": cpu,
                "thermal": int(thermal),
                "obstacle": obstacle,
            }

        # 1. Compute normalized state s'
        next_state = get_normalized_state(current_drone)

        # 2. If previous transition exists for this drone, store transition in Mongo
        if drone_id in DRONE_PREVIOUS_TRANSITIONS:
            prev = DRONE_PREVIOUS_TRANSITIONS[drone_id]

            action_map = {
                "CONTINUE_MISSION": 0,
                "RETURN_TO_BASE": 1,
                "REQUEST_NEAREST_SENSOR": 2,
                "REROUTE": 3,
            }

            experience = {
                "drone_id": drone_id,
                "episode_id": getattr(world, "scenario", "earthquake"),
                "state": prev["state"],
                "action": action_map.get(prev["action"], 0),
                "reward": prev["reward"],
                "next_state": next_state,
                "done": False,
                "timestamp": datetime.utcnow(),
            }

            insert_experience(experience)
            # print(f"[EXP] Storing experience | Drone {drone_id} | Action: {prev['action']} | Reward: {prev['reward']}")

        # 3. Save current normalized state & action as previous transition
        DRONE_PREVIOUS_TRANSITIONS[drone_id] = {
            "state": next_state,
            "action": action_str,
            "reward": reward_val,
        }
    except Exception as e:
        print(f"Failed to record drone experience transition: {e}")


def ensure_world_drones():
    if world.drones:
        return
    for i in range(5):
        world.drones.append(
            DroneState(
                id=i + 1,
                callsign=CALLSIGNS[i],
                status="ACTIVE",
                pos=np.array([float(i * 15), 0.0, 20.0]),
            )
        )


@asynccontextmanager
async def lifespan(app):
    from core.runtime import aegis_runtime

    await aegis_runtime.start()

    # Start runtime loop as background task
    loop_task = asyncio.create_task(runtime_loop())
    yield
    loop_task.cancel()
    await aegis_runtime.stop()


app = FastAPI(lifespan=lifespan)

# Allow CORS for dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


async def runtime_loop():
    from core.runtime import aegis_runtime

    while True:
        try:
            if aegis_runtime.is_running:
                dt = 0.05
                await aegis_runtime.tick(dt)

                # Broadcast state via WS
                await hub.broadcast()

            # Delta time wait (20Hz base)
            await asyncio.sleep(0.05)
        except Exception as e:
            print(f"Runtime Error: {e}")
            await asyncio.sleep(0.1)


def run_simulation_step():
    ensure_world_drones()
    results = []
    for drone in world.drones:
        # Skip evaluation if this drone was manually simulated
        if getattr(drone, "isSimulated", False):
            # Use existing fields directly, assuming action already set
            action_field = (
                drone.action if hasattr(drone, "action") else drone.last_decision
            )
            # Ensure action is a plain string for UI consistency
            if isinstance(action_field, dict):
                action_str = action_field.get("action", "CONTINUE_MISSION")
            else:
                action_str = str(action_field)
            reason_str = (
                action_field.get("reason", "") if isinstance(action_field, dict) else ""
            )
        else:
            decision = evaluate_drone(drone)
            apply_ai_decision(drone, decision, world.drones, verbose=False)
            # Flatten action to a plain string and extract reason separately
            raw_last = getattr(drone, "last_decision", "CONTINUE_MISSION")
            if isinstance(raw_last, dict):
                action_str = raw_last.get("action", "CONTINUE_MISSION")
            else:
                action_str = str(raw_last)
            reason_str = (
                decision.get("reason", "") if isinstance(decision, dict) else ""
            )

            # Record experience transition for organic simulation ticks
            reward_val = calculate_reward(drone, decision)
            record_drone_experience(drone.id, drone, action_str, reward_val)

        cpu_temp = getattr(drone, "cpu_temperature", 0)
        signal = getattr(drone, "signal_strength", 0)
        propeller = getattr(drone, "propeller_health", 100)
        results.append(
            {
                "id": drone.id,
                "callsign": getattr(drone, "callsign", f"DRONE-{drone.id}"),
                "battery": round(getattr(drone, "battery", 100.0), 1),
                "signal": round(signal, 1),
                "cpu": round(cpu_temp, 1),
                "propeller": round(propeller, 1),
                "action": action_str,
                "reason": reason_str,
                "status": getattr(drone, "status", "ACTIVE"),
                "nearby": getattr(drone, "nearby_drone_id", None),
            }
        )
    return {"drones": results}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await hub.connect(websocket)
    try:
        while True:
            # Keep connection open and listen for commands from client
            await websocket.receive_text()
            # We can handle commands here if needed later
    except WebSocketDisconnect:
        print("Client disconnected")
    finally:
        hub.disconnect(websocket)
        print("WebSocket closed safely")


@app.post("/override")
def override(data: dict):
    try:
        drone_id = data.get("id")

        for drone in world.drones:
            if drone.id == drone_id:
                drone.battery = data.get("battery", drone.battery)
                drone.signal_strength = data.get("signal", drone.signal_strength)
                drone.cpu_temperature = data.get("cpu", drone.cpu_temperature)
                drone.obstacle_distance = data.get("obstacle", drone.obstacle_distance)
                drone.thermal_status = data.get("thermal", drone.thermal_status)

        # Apply to Phase 9 Core Runtime if running
        from core.runtime import aegis_runtime

        if aegis_runtime.is_running:
            state = aegis_runtime.world_manager._state
            str_id = str(drone_id)
            if str_id in state.drones:
                d = state.drones[str_id]

                if "battery" in data:
                    d.battery.percentage = float(data["battery"])
                    # MUST also update the flight controller which is the physical source of truth
                    fc = aegis_runtime.flight_controllers.get(str_id)
                    if fc and hasattr(fc, "battery"):
                        fc.battery = float(data["battery"])

                if "signal" in data:
                    d.comms.signal_strength = float(data["signal"])

                if "cpu" in data:
                    d.health.cpu_temperature = float(data["cpu"])

                if "thermal" in data:
                    d.sensors.thermal_healthy = bool(data["thermal"])

        return {"status": "ok"}

    except Exception as e:
        print("Override Error:", str(e))
        return {"error": str(e)}


@app.post("/simulate")
def simulate_drone(data: dict = Body(...)):
    from simulation.decision_engine import evaluate_drone
    from simulation.ai_actions import apply_ai_decision

    ensure_world_drones()
    drone_id = data.get("id")
    target_drone = None
    for drone in world.drones:
        if drone.id == drone_id:
            target_drone = drone
            break

    if not target_drone:
        return {"error": f"Drone with ID {drone_id} not found."}

    target_drone.battery = float(data["battery"])
    target_drone.thermal_status = bool(data["thermal"])
    target_drone.obstacle_distance = float(data["obstacle"])
    target_drone.signal_strength = float(data["signal"])
    target_drone.cpu_temperature = float(data["cpu"])
    target_drone.propeller_health = float(
        data.get("propeller", target_drone.propeller_health)
    )
    target_drone.isSimulated = True

    # Evaluate decision using the real evaluate_drone
    result = evaluate_drone(target_drone)

    # Apply AI decision (e.g. cooperative assists, etc.)
    apply_ai_decision(target_drone, result, world.drones, verbose=False)

    # Set last_decision and action
    target_drone.last_decision = result
    target_drone.action = result

    # Record experience transition for simulated/manual interventions
    action_str = (
        result.get("action", "CONTINUE_MISSION")
        if isinstance(result, dict)
        else str(result)
    )
    reward_val = calculate_reward(target_drone, result)
    record_drone_experience(target_drone.id, target_drone, action_str, reward_val)

    return {
        "drone_id": target_drone.id,
        "action": result,
        "status": getattr(target_drone, "status", "UNKNOWN"),
        "nearby_drone_id": getattr(target_drone, "nearby_drone_id", None),
    }


# --------------------------------------------------
# STEP 3: TRAINING ENDPOINT
# --------------------------------------------------


@app.post("/train-rl")
def train_rl():
    """Trigger DQN training from stored MongoDB experiences."""
    import subprocess

    try:
        print("[TRAIN] Training started via /train-rl endpoint")
        result = subprocess.run(
            ["python", "rl/train_dqn.py"], capture_output=True, text=True, timeout=120
        )
        print(result.stdout)
        if result.returncode != 0:
            print(result.stderr)
            return {"status": "error", "detail": result.stderr}
        return {"status": "training_complete", "output": result.stdout}
    except Exception as e:
        return {"error": str(e)}


# --------------------------------------------------
# STEP 10: AUTO TRAIN AFTER MISSION
# --------------------------------------------------


def background_train():
    """Run DQN training in a background thread."""
    import subprocess

    print("[TRAIN] Background training started")
    try:
        result = subprocess.run(
            ["python", "rl/train_dqn.py"], capture_output=True, text=True, timeout=120
        )
        print(result.stdout)
        if result.returncode != 0:
            print(f"Training error: {result.stderr}")
        else:
            print("[TRAIN] Background training complete - model updated")
    except Exception as e:
        print(f"Background training failed: {e}")


@app.post("/end-mission")
def end_mission():
    """End the current mission and trigger background RL training."""
    threading.Thread(target=background_train, daemon=True).start()
    return {"status": "mission_ended", "training": "started_in_background"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

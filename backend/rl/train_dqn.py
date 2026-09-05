"""Offline DQN training from MongoDB replay buffer."""

import torch
import sys
import os

# Add parent dir to path so db/rl imports work when run standalone
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from db.mongo import fetch_experiences, MONGO_AVAILABLE
from rl.dqn_model import DQN


def train():
    print("[TRAIN] Training started")

    if not MONGO_AVAILABLE:
        print(
            "[ERROR] MongoDB connection is unavailable. Cannot load training experiences."
        )
        sys.exit(1)

    # STEP 5: Fetch experiences using safe helper
    data = fetch_experiences(2000)

    if len(data) < 5:
        print(f"[WARN] Found {len(data)} experiences. Need at least 5 to train.")
        print("Run drone simulations in the UI first to generate experience data.")
        sys.exit(0)

    action_map = {
        "CONTINUE_MISSION": 0,
        "RETURN_TO_BASE": 1,
        "REQUEST_NEAREST_SENSOR": 2,
        "REROUTE": 3,
    }

    states = []
    actions = []
    rewards = []
    next_states = []

    for d in data:
        s = d["state"]
        ns = d["next_state"]

        # STEP 4: Normalized inputs
        states.append(
            [
                s["battery"] / 100.0,
                s["signal"] / 100.0,
                s["cpu"] / 100.0,
                float(s["thermal"]),
                s["obstacle"] / 10.0,
            ]
        )

        next_states.append(
            [
                ns["battery"] / 100.0,
                ns["signal"] / 100.0,
                ns["cpu"] / 100.0,
                float(ns["thermal"]),
                ns["obstacle"] / 10.0,
            ]
        )

        act = d["action"]
        if isinstance(act, str):
            act_idx = action_map.get(act, 0)
        else:
            act_idx = int(act)
        actions.append(act_idx)

        rewards.append(float(d["reward"]))

    # Convert lists to PyTorch Tensors
    states = torch.tensor(states, dtype=torch.float32)
    actions = torch.tensor(actions, dtype=torch.long)
    rewards = torch.tensor(rewards, dtype=torch.float32)
    next_states = torch.tensor(next_states, dtype=torch.float32)

    model = DQN()

    # STEP 6: Save to rl/dqn_model.pth
    model_path = os.path.join(os.path.dirname(__file__), "dqn_model.pth")

    # Load existing model weights if available to resume training
    if os.path.exists(model_path):
        try:
            model.load_state_dict(torch.load(model_path, map_location="cpu"))
            print("[TRAIN] Loaded existing dqn_model.pth to resume training.")
        except Exception as e:
            print(
                f"[WARN] Could not load existing model weights ({e}). Starting fresh."
            )

    optimizer = torch.optim.Adam(model.parameters(), lr=0.001)
    gamma = 0.95

    print(f"[TRAIN] Training DQN model on {len(data)} transitions...")

    for epoch in range(50):
        # STEP 3: Correct DQN training logic

        # 1. Forward pass: compute current Q-values
        q_values = model(states)

        # 2. Gather Q-values for actions taken
        q_selected = q_values.gather(1, actions.unsqueeze(1)).squeeze(1)

        # 3. Compute max Q-value for next states (detached)
        with torch.no_grad():
            next_q_values = model(next_states)
            max_next_q = next_q_values.max(1)[0]

        # 4. Bellman equation target
        target = rewards + gamma * max_next_q

        # 5. MSE loss
        loss = ((q_selected - target) ** 2).mean()

        # 6. Optimize
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()

        if (epoch + 1) % 10 == 0:
            print(f"  Epoch {epoch + 1}/50 -- Loss: {loss.item():.5f}")

    torch.save(model.state_dict(), model_path)
    print(f"[TRAIN] MODEL TRAINED SUCCESSFULLY -- Saved to {model_path}")


if __name__ == "__main__":
    train()

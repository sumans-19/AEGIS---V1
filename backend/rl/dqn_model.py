import torch.nn as nn


class DQN(nn.Module):
    """
    Deep Q-Network for AEGIS Drone Action Selection.

    Inputs (5):
      - battery (normalized: battery_level / 100)
      - signal (normalized: signal_strength / 100)
      - cpu (normalized: cpu_temperature / 100)
      - thermal (normalized: 1 for True/nominal, 0 for False/failure)
      - obstacle (normalized: obstacle_distance / 10)

    Outputs (4):
      Q-values for each of the 4 actions:
      - 0: CONTINUE_MISSION
      - 1: RETURN_TO_BASE
      - 2: REQUEST_NEAREST_SENSOR
      - 3: REROUTE
    """

    def __init__(self):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(5, 64), nn.ReLU(), nn.Linear(64, 64), nn.ReLU(), nn.Linear(64, 4)
        )

    def forward(self, x):
        return self.net(x)

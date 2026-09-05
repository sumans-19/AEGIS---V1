import csv
import random

rows = []

for _ in range(10000):

    battery = random.uniform(0, 100)
    propeller = random.uniform(0, 100)
    cpu_temp = random.uniform(30, 100)

    signal = random.uniform(0, 100)

    thermal = random.choice([0, 1])
    lidar = random.choice([0, 1])

    obstacle = random.uniform(0.2, 15)

    smoke = random.uniform(0, 100)
    moisture = random.uniform(0, 100)

    altitude = random.uniform(5, 100)
    speed = random.uniform(1, 20)

    # -------------------------
    # ACTION LABELS
    # -------------------------

    if battery < 15:
        action = "RETURN_TO_BASE"

    elif signal < 20:
        action = "AUTONOMOUS_MODE"

    elif thermal == 0:
        action = "REQUEST_NEAREST_SENSOR"

    elif propeller < 40:
        action = "REDUCE_SPEED"

    elif obstacle < 1:
        action = "REROUTE"

    elif cpu_temp > 85:
        action = "LOW_POWER_MODE"

    elif moisture > 85:
        action = "INCREASE_ALTITUDE"

    else:
        action = "CONTINUE_MISSION"

    rows.append(
        [
            battery,
            propeller,
            cpu_temp,
            signal,
            thermal,
            lidar,
            obstacle,
            moisture,
            smoke,
            altitude,
            speed,
            action,
        ]
    )

# -------------------------
# SAVE CSV
# -------------------------

with open("drone_dataset.csv", "w", newline="") as f:

    writer = csv.writer(f)

    writer.writerow(
        [
            "battery",
            "propeller_health",
            "cpu_temperature",
            "signal_strength",
            "thermal_status",
            "lidar_status",
            "obstacle_distance",
            "moisture_level",
            "smoke_density",
            "altitude",
            "speed",
            "action",
        ]
    )

    writer.writerows(rows)

print("Dataset generated successfully.")

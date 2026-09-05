import numpy as np
import random
import math


def tick_sensors(drone, world, dt: float):
    """
    Simulates high-fidelity virtual hardware sensors adding physical noise
    to mathematical state vectors.
    """
    if not hasattr(drone, "sensors") or drone.sensors is None:
        drone.sensors = {}

    # Initialize last velocity if not present
    if not hasattr(drone, "_last_vel"):
        drone._last_vel = np.copy(drone.vel)

    # -----------------------------
    # 1. IMU (Accelerometer & Gyro)
    # -----------------------------
    # Accel = dv/dt + gravity + noise
    if dt > 0:
        accel_linear = (drone.vel - drone._last_vel) / dt
    else:
        accel_linear = np.zeros(3)

    # Add gravity to Z axis (approx 9.81 m/s^2)
    accel_raw = accel_linear + np.array([0, 9.81, 0])
    # Add gaussian white noise
    accel_noise = np.random.normal(0, 0.2, 3)
    accel_reading = accel_raw + accel_noise

    # Gyro (very simplified based on heading changes)
    if not hasattr(drone, "_last_heading"):
        drone._last_heading = drone.heading

    heading_delta = drone.heading - drone._last_heading
    # Normalize between -180 and 180
    heading_delta = (heading_delta + 180) % 360 - 180

    if dt > 0:
        yaw_rate = math.radians(heading_delta) / dt
    else:
        yaw_rate = 0.0

    gyro_noise = np.random.normal(0, 0.05, 3)
    # Assume pitch/roll rates are proportional to linear acceleration
    gyro_reading = (
        np.array(
            [
                accel_linear[2] * 0.1,  # Pitch relates to forward accel (Z)
                accel_linear[0] * 0.1,  # Roll relates to lateral accel (X)
                yaw_rate,
            ]
        )
        + gyro_noise
    )

    drone.sensors["imu_accel"] = accel_reading.tolist()
    drone.sensors["imu_gyro"] = gyro_reading.tolist()

    drone._last_vel = np.copy(drone.vel)
    drone._last_heading = drone.heading

    # -----------------------------
    # 2. Barometer (Altitude to hPa)
    # -----------------------------
    # Standard pressure at sea level = 1013.25 hPa
    # Drops approx 0.12 hPa per meter
    base_pressure = 1013.25
    alt_m = drone.pos[1]
    pressure_ideal = base_pressure - (alt_m * 0.12)
    # Sensor noise (approx +/- 0.5 hPa)
    pressure_noise = random.gauss(0, 0.5)
    drone.sensors["baro_hpa"] = pressure_ideal + pressure_noise

    # -----------------------------
    # 3. Downward LiDAR (Distance to terrain)
    # -----------------------------
    # We will assume a flat ground at y=0 for now, but add noise based on altitude
    # If the terrain_grid was 3D we would raycast here.
    true_dist = max(0.0, drone.pos[1])
    # Noise increases with distance (1% error)
    lidar_noise = random.gauss(0, true_dist * 0.01 + 0.05)
    drone.sensors["lidar_dist"] = max(0.0, true_dist + lidar_noise)

    # -----------------------------
    # 4. Air Quality (Gas/Smoke proximity)
    # -----------------------------
    # Ambient CO2 is ~400ppm
    co2_ppm = 400.0 + random.gauss(0, 5.0)

    # Check proximity to threats (e.g. wildfire or gas leak)
    for t in world.threats:
        if t.type in ["wildfire", "gas_leak"]:
            dist = np.linalg.norm(drone.pos - t.pos)
            if dist < 50.0:
                # Spike CO2 exponentially as we get closer
                spike = 2000.0 * math.exp(-dist / 15.0)
                co2_ppm += spike
                break  # Only consider nearest threat for simplicity

    drone.sensors["co2_ppm"] = co2_ppm

    # -----------------------------
    # 5. Smart Battery Model (Voltage Sag)
    # -----------------------------
    # 4S LiPo: 100% = 16.8V, 0% = 13.0V (approx)
    cap_pct = max(0.0, min(100.0, drone.battery))
    ideal_voltage = 13.0 + (cap_pct / 100.0) * 3.8

    # Voltage sag based on current draw (proportional to total acceleration and speed)
    speed = np.linalg.norm(drone.vel)
    load = speed * 0.05 + np.linalg.norm(accel_linear) * 0.1
    # Max sag of ~0.8V under heavy load
    sag = min(0.8, load)

    drone.sensors["battery_voltage"] = ideal_voltage - sag + random.gauss(0, 0.02)

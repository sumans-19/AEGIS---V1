import numpy as np
import random
from datetime import datetime, timezone, timedelta
from typing import Any

from core.hardware.interfaces import (
    GPSInterface,
    IMUInterface,
    BatteryInterface,
    FlightControllerInterface,
    GPSReading,
    IMUReading,
    BatteryReading,
)
from simulation.world_state import DroneState


class SimSensorBase:
    def __init__(self, drone_state: DroneState, sensor_id: str, seed: int = None):
        self.drone = drone_state
        self.sensor_id = sensor_id
        self.rng = random.Random(seed)
        self.sequence_number = 0
        self.latency_ms = 0

    def _create_base_reading(self, **kwargs) -> dict:
        self.sequence_number += 1
        now = datetime.now(timezone.utc)
        latency = timedelta(milliseconds=self.latency_ms + self.rng.uniform(0, 10))
        return {
            "sensor_id": self.sensor_id,
            "drone_id": str(self.drone.id),
            "timestamp": now - latency,
            "received_timestamp": now,
            "sequence_number": self.sequence_number,
            **kwargs,
        }


class SimGPS(GPSInterface, SimSensorBase):
    def __init__(
        self, drone_state: DroneState, sensor_id: str = "gps_1", seed: int = None
    ):
        SimSensorBase.__init__(self, drone_state, sensor_id, seed)
        self.latency_ms = 100

    def health_check(self) -> bool:
        return self.drone.gps_status

    async def get_position(self) -> GPSReading:
        is_healthy = self.health_check()

        # Determine status and noise
        if is_healthy:
            status = "GOOD"
            noise_std = 0.5  # 0.5m standard deviation
            confidence = 0.95
            satellites = 12
        else:
            status = "DEGRADED"
            noise_std = 15.0  # Large uncertainty during dropout/jamming
            confidence = 0.1
            satellites = 3

        noise_x = self.rng.gauss(0, noise_std)
        noise_y = self.rng.gauss(0, noise_std)
        noise_z = self.rng.gauss(0, noise_std)

        base_lat, base_lon = 34.0, -118.0
        lat = base_lat + (self.drone.pos[0] + noise_x) * 0.00001
        lon = base_lon + (self.drone.pos[2] + noise_z) * 0.00001
        alt = self.drone.pos[1] + noise_y

        # Sometimes totally drop out
        if not is_healthy and self.rng.random() < 0.1:
            status = "INVALID"
            confidence = 0.0

        base = self._create_base_reading(
            valid=(status != "INVALID"), confidence=confidence, status=status
        )
        return GPSReading(
            **base, latitude=lat, longitude=lon, altitude=alt, satellites=satellites
        )


class SimIMU(IMUInterface, SimSensorBase):
    def __init__(
        self, drone_state: DroneState, sensor_id: str = "imu_1", seed: int = None
    ):
        SimSensorBase.__init__(self, drone_state, sensor_id, seed)
        self.latency_ms = 5
        self.drift_bias = 0.0

    def health_check(self) -> bool:
        return True

    async def get_imu_data(self) -> IMUReading:
        # Simulate drift over time
        self.drift_bias += self.rng.gauss(0, 0.001)

        noise_x = self.rng.gauss(0, 0.1)
        noise_y = self.rng.gauss(0, 0.1)
        noise_z = self.rng.gauss(0, 0.1)

        # Derive fake IMU from current velocity/heading (ignoring real kinematics for now)
        heading_rad = np.radians(self.drone.heading + self.drift_bias)
        mag = (np.cos(heading_rad) + noise_x, 0, np.sin(heading_rad) + noise_z)

        base = self._create_base_reading(valid=True, confidence=0.99, status="GOOD")
        return IMUReading(
            **base, accel=(noise_x, noise_y, noise_z), gyro=(0.0, 0.0, 0.0), mag=mag
        )


class SimBattery(BatteryInterface, SimSensorBase):
    def __init__(
        self, drone_state: DroneState, sensor_id: str = "batt_1", seed: int = None
    ):
        SimSensorBase.__init__(self, drone_state, sensor_id, seed)
        self.latency_ms = 200

    def health_check(self) -> bool:
        return True

    async def get_battery_state(self) -> BatteryReading:
        # Ground truth drone state has the exact percentage
        # We model the sensor reading logic
        current_draw = 15.0 if self.drone.status not in ("IDLE", "CHARGING") else 1.0

        status = "GOOD"
        if self.drone.battery < 20:
            status = "LOW"
        if self.drone.battery < 5:
            status = "CRITICAL"

        voltage = 14.8 * (self.drone.battery / 100.0) + self.rng.gauss(0, 0.05)

        base = self._create_base_reading(valid=True, confidence=1.0, status=status)
        return BatteryReading(
            **base, voltage=voltage, percentage=self.drone.battery, current=current_draw
        )


class SimFlightController(FlightControllerInterface):
    def __init__(self, drone_id: str):
        self.drone_id = drone_id
        # internal sim state
        self.battery = 100.0
        self.pos = np.array([0.0, 0.0, 0.0])
        self.vel = np.array([0.0, 0.0, 0.0])
        self.status = "IDLE"
        self.gps_status = True
        self.propeller_health = 100
        self.armed = False

    async def process_command(
        self, command: Any
    ) -> Any:  # Any used here temporarily, will be fixed by import later
        from core.domain.commands import (
            CommandResult,
            TakeoffCommand,
            GotoCommand,
            LandCommand,
            HoldCommand,
            ReturnToHomeCommand,
            EmergencyStopCommand,
        )

        # Flight controller also does its own low-level sanity check
        if self.battery <= 2.0:
            return CommandResult(
                command_id=command.command_id,
                drone_id=command.drone_id,
                status="REJECTED",
                reason="BATTERY_DEPLETED",
            )

        if isinstance(command, TakeoffCommand):
            if not self.armed:
                self.armed = True
            self.current_target = np.array(
                [self.pos[0], command.target_altitude, self.pos[2]]
            )
            self.status = "SEARCHING"
            return CommandResult(
                command_id=command.command_id,
                drone_id=command.drone_id,
                status="ACCEPTED",
            )

        elif isinstance(command, GotoCommand):
            if not self.armed:
                return CommandResult(
                    command_id=command.command_id,
                    drone_id=command.drone_id,
                    status="REJECTED",
                    reason="NOT_ARMED",
                )

            # Commands are in scene coordinates (x, y, z) — use directly
            self.current_target = np.array(
                [command.target_x, command.target_y, command.target_z]
            )
            self.status = "SEARCHING"  # Mark as active for perception
            return CommandResult(
                command_id=command.command_id,
                drone_id=command.drone_id,
                status="ACCEPTED",
            )

        elif isinstance(command, ReturnToHomeCommand):
            # Return to base pad position at safe altitude
            self.current_target = np.array(
                [self.pos[0], 50.0, self.pos[2]]
            )  # First gain altitude
            self.status = "RETURNING_HOME"
            return CommandResult(
                command_id=command.command_id,
                drone_id=command.drone_id,
                status="ACCEPTED",
            )

        elif isinstance(command, HoldCommand):
            self.current_target = self.pos.copy()
            return CommandResult(
                command_id=command.command_id,
                drone_id=command.drone_id,
                status="ACCEPTED",
            )

        elif isinstance(command, LandCommand):
            self.current_target = np.array([self.pos[0], 0.0, self.pos[2]])
            self.status = "LANDING"
            return CommandResult(
                command_id=command.command_id,
                drone_id=command.drone_id,
                status="ACCEPTED",
            )

        elif isinstance(command, EmergencyStopCommand):
            self.vel = np.zeros(3)
            self.current_target = self.pos.copy()
            self.status = "IDLE"
            self.armed = False
            return CommandResult(
                command_id=command.command_id,
                drone_id=command.drone_id,
                status="ACCEPTED",
            )

        return CommandResult(
            command_id=command.command_id,
            drone_id=command.drone_id,
            status="REJECTED",
            reason="UNKNOWN_COMMAND",
        )

    def step_physics(self, dt: float, flight_controllers: dict = None):
        if not hasattr(self, "current_target"):
            return

        target = self.current_target
        direction = target - self.pos
        dist = np.linalg.norm(direction)

        repulsive_vector = np.zeros(3)

        # 1. Drone-to-Drone Collision Avoidance (Artificial Potential Field)
        if flight_controllers:
            for other_id, other_fc in flight_controllers.items():
                if str(other_id) != str(self.drone_id):
                    diff = self.pos - other_fc.pos
                    d = np.linalg.norm(diff)

                    if 0.1 < d < 15.0:
                        # Enforce horizontal separation so they don't stack perfectly vertically
                        diff_hz = np.array([diff[0], 0.0, diff[2]])
                        d_hz = np.linalg.norm(diff_hz)

                        if d_hz < 10.0:
                            if d_hz < 0.1:
                                # Perfectly stacked (d_hz ~ 0), apply deterministic outward push based on IDs
                                import hashlib

                                hash_val = int(
                                    hashlib.md5(
                                        str(self.drone_id).encode()
                                    ).hexdigest(),
                                    16,
                                )
                                angle = (hash_val % 360) * (np.pi / 180.0)
                                diff_hz = np.array([np.cos(angle), 0.0, np.sin(angle)])
                                d_hz = 1.0

                            repulsion_mag = 15.0 / max(1.0, d_hz**2)
                            repulsive_vector += (diff_hz / d_hz) * repulsion_mag

                        # Also keep vertical repulsion if they get too close in 3D
                        if d < 8.0:
                            repulsive_vector += (diff / d) * (5.0 / d**2)

        # 2. Obstacle Avoidance (Buildings/Fires via terrain_grid)
        from simulation.world_state import world

        if hasattr(world, "terrain_grid"):
            # Check a few points ahead in the current direction
            if dist > 0.1:
                forward_dir = direction / dist
                for lookahead in [5.0, 10.0]:
                    look_pos = self.pos + forward_dir * lookahead
                    # Convert to grid coordinates (100x100 grid spanning -250 to 250)
                    ix = int((look_pos[0] + 250) / 5)
                    iy = int((look_pos[2] + 250) / 5)

                    if 0 <= ix < 100 and 0 <= iy < 100:
                        cell_val = world.terrain_grid[ix, iy]
                        # If building (>0.7) or fire/hazard, and we are below 40m altitude
                        if cell_val > 0.7 and self.pos[1] < 45.0:
                            # Apply strong lateral/upward repulsion
                            # Compute a perpendicular escape vector
                            left_vector = np.array(
                                [-forward_dir[2], 0.0, forward_dir[0]]
                            )
                            # Push up and away
                            repulsive_vector += left_vector * 15.0
                            repulsive_vector[1] += 5.0  # Push upwards slightly
                            break

        if dist > 0.1:
            speed = 12.0  # m/s

            # Blend desired velocity with repulsive forces
            desired_vel = (direction / dist) * speed
            final_vel = desired_vel + repulsive_vector

            # Cap speed
            vel_mag = np.linalg.norm(final_vel)
            if vel_mag > speed * 1.5:
                final_vel = (final_vel / vel_mag) * (speed * 1.5)

            step = final_vel * dt
            # Prevent overshooting the target if we are very close and no repulsion is active
            if np.linalg.norm(repulsive_vector) < 0.1 and np.linalg.norm(step) > dist:
                step = direction

            self.vel = final_vel
            self.pos += step
        else:
            self.vel = np.zeros(3)

        # Drain battery slightly
        if self.status != "IDLE":
            self.battery = max(0.0, self.battery - (0.01 * dt))

    async def get_state(self) -> Any:
        from core.domain.commands import FlightControllerState

        mode = "HOLD" if self.status == "IDLE" else "AUTO"
        return FlightControllerState(
            drone_id=str(self.drone_id),
            armed=self.armed,
            flight_mode=mode,
            altitude=self.pos[1],
            battery_percentage=self.battery,
            gps_locked=self.gps_status,
            health_ok=self.propeller_health > 50,
        )


from core.hardware.interfaces import CameraInterface, Frame


class SimCamera(CameraInterface):
    def __init__(self, drone_id: str):
        self.drone_id = drone_id
        self.camera_id = f"sim_cam_{drone_id}"
        self.sequence_number = 0

    def health_check(self) -> bool:
        return True

    async def get_frame(self) -> Frame:
        self.sequence_number += 1
        now = datetime.now(timezone.utc)
        return Frame(
            camera_id=self.camera_id,
            drone_id=self.drone_id,
            timestamp=now,
            sequence_number=self.sequence_number,
            width=640,
            height=480,
            channels=3,
            data=b"sim_jpeg_data",
            status="GOOD",
        )

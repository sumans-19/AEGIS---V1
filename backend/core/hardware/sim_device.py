import asyncio
from core.bus.message_bus import MessageBus
from core.hardware.sim_adapters import SimGPS, SimIMU, SimBattery
from core.domain.events import DroneTelemetryUpdated, BatteryUpdated
from core.domain.state import (
    PositionState,
    VelocityState,
    LocalizationState,
    BatteryState,
)
from simulation.world_state import DroneState


class SimDevice:
    """
    Virtual firmware for a simulated drone.
    It runs an internal event loop that polls its SimAdapters and publishes
    DomainEvents to the MessageBus.
    """

    def __init__(self, drone_state: DroneState, bus: MessageBus, seed: int = None):
        self.drone_id = str(drone_state.id)
        self.bus = bus
        self.gps = SimGPS(drone_state, seed=seed)
        self.imu = SimIMU(drone_state, seed=seed)
        self.battery = SimBattery(drone_state, seed=seed)
        self._running = False
        self._task = None

    def start(self):
        if not self._running:
            self._running = True
            self._task = asyncio.create_task(self._poll_sensors())

    def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()

    async def _poll_sensors(self):
        try:
            while self._running:
                # Poll sensors concurrently
                gps_reading, imu_reading, batt_reading = await asyncio.gather(
                    self.gps.get_position(),
                    self.imu.get_imu_data(),
                    self.battery.get_battery_state(),
                )

                # Process Battery
                batt_event = BatteryUpdated(
                    source_id=self.drone_id,
                    drone_id=self.drone_id,
                    timestamp=batt_reading.timestamp,
                    battery=BatteryState(
                        voltage=batt_reading.voltage,
                        percentage=batt_reading.percentage,
                        current=batt_reading.current,
                    ),
                )
                await self.bus.publish("telemetry.battery", batt_event)

                # Process Telemetry/Localization (combining GPS & IMU)
                # If GPS is invalid, confidence drops and method changes
                loc_method = "GPS"
                loc_confidence = gps_reading.confidence
                if not gps_reading.valid:
                    loc_method = "DEAD_RECKONING"
                    loc_confidence *= 0.1  # heavily degrade

                # We need to map lat/lon back to World coordinates for the engine DomainState
                # (In a real system, WorldStateDomain would likely use EPSG/LatLon natively, but we keep this adapter)
                x = (gps_reading.latitude - 34.0) / 0.00001
                z = (gps_reading.longitude + 118.0) / 0.00001
                y = gps_reading.altitude

                telemetry_event = DroneTelemetryUpdated(
                    source_id=self.drone_id,
                    drone_id=self.drone_id,
                    timestamp=gps_reading.timestamp,
                    pos=PositionState(x=x, y=y, z=z),
                    vel=VelocityState(
                        heading=np.degrees(
                            np.arctan2(imu_reading.mag[2], imu_reading.mag[0])
                        )
                    ),
                    localization=LocalizationState(
                        method=loc_method,
                        confidence=loc_confidence,
                        last_update=gps_reading.timestamp,
                    ),
                )
                await self.bus.publish("telemetry.position", telemetry_event)

                # Wait for next tick (e.g. 5Hz sensor polling)
                await asyncio.sleep(0.2)

        except asyncio.CancelledError:
            pass
        except Exception as e:
            print(f"SimDevice {self.drone_id} crashed: {e}")

import random
import logging
from core.runtime import AegisRuntime

logger = logging.getLogger("fault_injector")


class FaultInjector:
    """
    Deterministic fault injection framework for simulation.
    """

    def __init__(self, runtime: AegisRuntime, seed: int = 42):
        self.runtime = runtime
        self.rng = random.Random(seed)

    def inject_gps_failure(self, drone_id: str):
        """Simulate GPS dropout (confidence goes to 0)."""
        logger.warning(f"[INJECT] GPS Failure on {drone_id}")
        state = self.runtime.world_manager.current_state
        if drone_id in state.drones:
            drone = state.drones[drone_id]
            drone.localization.confidence = 0.1
            self.runtime.health_monitor.heartbeat(
                drone_id, "GPS", state="FAILED", error="Lost satellite lock"
            )

    def inject_communication_partition(self, drone_id: str):
        """Simulate drone losing connection to the mesh."""
        logger.warning(f"[INJECT] Communication partition on {drone_id}")
        state = self.runtime.world_manager.current_state
        if drone_id in state.drones:
            drone = state.drones[drone_id]
            drone.comms.mesh_connected = False
            drone.comms.packet_loss = 1.0
            drone.comms.signal_strength = 0.0
            self.runtime.health_monitor.heartbeat(
                drone_id, "COMM", state="FAILED", error="No heartbeats received"
            )

    def inject_battery_critical(self, drone_id: str):
        """Simulate battery suddenly collapsing to critical levels."""
        logger.warning(f"[INJECT] Battery collapse on {drone_id}")
        state = self.runtime.world_manager.current_state
        if drone_id in state.drones:
            drone = state.drones[drone_id]
            drone.battery.percentage = 4.0  # Critical
            self.runtime.health_monitor.heartbeat(
                drone_id, "BATT", state="FAILED", error="Voltage drop"
            )

    def inject_camera_failure(self, drone_id: str):
        """Simulate camera sensor breaking."""
        logger.warning(f"[INJECT] Camera failure on {drone_id}")
        state = self.runtime.world_manager.current_state
        if drone_id in state.drones:
            drone = state.drones[drone_id]
            drone.capabilities.rgb_camera = False
            drone.capabilities.thermal_camera = False
            self.runtime.health_monitor.heartbeat(
                drone_id, "CAM", state="DEGRADED", error="Hardware disconnected"
            )

    def inject_fc_timeout(self, drone_id: str):
        """Simulate flight controller connection timeout."""
        logger.warning(f"[INJECT] Flight controller timeout on {drone_id}")
        self.runtime.health_monitor.heartbeat(
            drone_id, "FC", state="FAILED", error="Command ACK timeout"
        )

    def inject_process_stall(self, component_id: str):
        """Simulate a background loop freezing by skipping its heartbeat for a timeout period."""
        logger.warning(f"[INJECT] Process stall on {component_id}")
        # In a test, we can just forcefully set the last_update back to trigger watchdog
        import datetime

        for key, comp in self.runtime.health_monitor.components.items():
            if key[1] == component_id:
                comp.last_update = datetime.datetime.now(
                    datetime.timezone.utc
                ) - datetime.timedelta(seconds=20)
        self.runtime.health_monitor.check_timeouts()

    def restore_gps(self, drone_id: str):
        logger.info(f"[RESTORE] GPS on {drone_id}")
        state = self.runtime.world_manager.current_state
        if drone_id in state.drones:
            drone = state.drones[drone_id]
            drone.localization.confidence = 0.95
            self.runtime.health_monitor.heartbeat(drone_id, "GPS", state="HEALTHY")

    def restore_communication(self, drone_id: str):
        logger.info(f"[RESTORE] Communication on {drone_id}")
        state = self.runtime.world_manager.current_state
        if drone_id in state.drones:
            drone = state.drones[drone_id]
            drone.comms.mesh_connected = True
            drone.comms.packet_loss = 0.01
            drone.comms.signal_strength = 95.0
            self.runtime.health_monitor.heartbeat(drone_id, "COMM", state="HEALTHY")

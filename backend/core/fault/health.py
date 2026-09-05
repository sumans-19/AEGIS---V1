import logging
from typing import Dict
from datetime import datetime, timezone
from core.fault.models import ComponentHealth, HealthState
from core.fault.manager import FaultManager

logger = logging.getLogger("health_monitor")


class HealthMonitor:
    """
    Monitors component heartbeats and updates, detecting staleness and failures.
    """

    def __init__(self, fault_manager: FaultManager):
        self.fault_manager = fault_manager
        # (drone_id, component_id) -> ComponentHealth
        self.components: Dict[tuple, ComponentHealth] = {}
        # (drone_id, component_id) -> timeout_seconds
        self.timeouts: Dict[tuple, float] = {}

    def register_component(
        self, drone_id: str, component_id: str, timeout: float = 5.0
    ):
        key = (drone_id, component_id)
        if key not in self.components:
            self.components[key] = ComponentHealth(
                component_id=component_id, state="UNKNOWN"
            )
            self.timeouts[key] = timeout

    def heartbeat(
        self,
        drone_id: str,
        component_id: str,
        state: HealthState = "HEALTHY",
        error: str = "",
    ):
        key = (drone_id, component_id)
        if key not in self.components:
            self.register_component(drone_id, component_id)

        comp = self.components[key]
        now = datetime.now(timezone.utc)
        comp.latency = (now - comp.last_update).total_seconds()
        comp.last_update = now

        if state == "HEALTHY":
            if comp.state != "HEALTHY":
                comp.recovery_count += 1
                comp.consecutive_failures = 0
                self.fault_manager.resolve_fault(
                    drone_id,
                    self._map_component_to_fault_type(component_id),
                    component_id,
                )
            comp.state = "HEALTHY"
            comp.last_error = ""
        else:
            comp.state = state
            comp.consecutive_failures += 1
            comp.failure_count += 1
            comp.last_error = error
            self._report_health_fault(drone_id, component_id, comp)

    def check_timeouts(self):
        """Called periodically by a watchdog or runtime tick to find stale components."""
        now = datetime.now(timezone.utc)
        for (drone_id, component_id), comp in self.components.items():
            timeout = self.timeouts.get((drone_id, component_id), 5.0)
            elapsed = (now - comp.last_update).total_seconds()

            if elapsed > timeout and comp.state != "FAILED":
                comp.state = "FAILED"
                comp.last_error = "TIMEOUT"
                comp.consecutive_failures += 1
                self._report_health_fault(drone_id, component_id, comp, is_timeout=True)

    def _map_component_to_fault_type(self, component_id: str) -> str:
        cid = component_id.upper()
        if "GPS" in cid:
            return "GPS_FAILURE"
        if "IMU" in cid:
            return "IMU_FAILURE"
        if "BATT" in cid:
            return "BATTERY_FAILURE"
        if "CAM" in cid:
            return "CAMERA_FAILURE"
        if "PERCEPTION" in cid:
            return "PERCEPTION_FAILURE"
        if "COMM" in cid:
            return "COMMUNICATION_FAILURE"
        if "FC" in cid:
            return "FLIGHT_CONTROLLER_FAILURE"
        if "MISSION" in cid:
            return "PROCESS_FAILURE"
        return "UNKNOWN_FAILURE"

    def _report_health_fault(
        self,
        drone_id: str,
        component_id: str,
        comp: ComponentHealth,
        is_timeout: bool = False,
    ):
        fault_type = self._map_component_to_fault_type(component_id)

        if is_timeout:
            desc = f"Component {component_id} timed out after {comp.latency:.2f}s"
            severity = "CRITICAL"
        else:
            desc = f"Component {component_id} reported {comp.state}: {comp.last_error}"
            severity = "CRITICAL" if comp.state == "FAILED" else "DEGRADED"

        self.fault_manager.report_fault(
            drone_id=drone_id,
            fault_type=fault_type,
            severity=severity,
            description=desc,
            detected_by="HealthMonitor",
            component_id=component_id,
        )

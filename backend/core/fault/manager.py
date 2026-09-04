import logging
from typing import Dict, List, Optional
from datetime import datetime, timezone
from core.fault.models import (
    Fault,
    FaultSeverity,
    FaultType,
    RecoveryAction,
)

logger = logging.getLogger("fault_manager")


class FaultManager:
    """
    Central manager for detecting, tracking, and escalating system faults deterministically.
    """

    def __init__(self, bus=None):
        self.bus = bus
        # Map fault_id -> Fault
        self.active_faults: Dict[str, Fault] = {}
        # Fault history
        self.fault_history: List[Fault] = []

        # simple deduplication mapping: (drone_id, type) -> fault_id
        self._fault_map: Dict[tuple, str] = {}

    def report_fault(
        self,
        drone_id: str,
        fault_type: FaultType,
        severity: FaultSeverity,
        description: str,
        detected_by: str,
        component_id: Optional[str] = None,
    ) -> Fault:
        """
        Reports a fault. If a fault of the same type for the same drone/component already exists,
        it may escalate the severity or just update the timestamp.
        """
        dedup_key = (drone_id, fault_type, component_id)

        if dedup_key in self._fault_map:
            existing_fault = self.active_faults[self._fault_map[dedup_key]]
            existing_fault.timestamp = datetime.now(timezone.utc)
            # Escalate if new severity is higher
            severity_levels = {
                "INFO": 0,
                "WARNING": 1,
                "DEGRADED": 2,
                "CRITICAL": 3,
                "EMERGENCY": 4,
            }
            if severity_levels[severity] > severity_levels[existing_fault.severity]:
                existing_fault.severity = severity
                existing_fault.description = f"ESCALATED: {description}"
                existing_fault.recovery_action = self._determine_recovery_action(
                    existing_fault
                )
                self._publish_event("fault.escalated", existing_fault)
                logger.warning(
                    f"Fault escalated: {existing_fault.type} for {drone_id} to {severity}"
                )
            return existing_fault

        # Create new fault
        new_fault = Fault(
            drone_id=drone_id,
            component_id=component_id,
            severity=severity,
            type=fault_type,
            description=description,
            detected_by=detected_by,
            recovery_action=self._determine_recovery_action_from_params(
                fault_type, severity
            ),
        )
        self.active_faults[new_fault.fault_id] = new_fault
        self._fault_map[dedup_key] = new_fault.fault_id
        self.fault_history.append(new_fault)

        self._publish_event("fault.detected", new_fault)
        logger.error(
            f"Fault detected: {new_fault.type} for {drone_id}. Recovery: {new_fault.recovery_action}"
        )
        return new_fault

    def resolve_fault(
        self, drone_id: str, fault_type: FaultType, component_id: Optional[str] = None
    ):
        """Resolves a specific fault if it exists."""
        dedup_key = (drone_id, fault_type, component_id)
        if dedup_key in self._fault_map:
            fault_id = self._fault_map.pop(dedup_key)
            fault = self.active_faults.pop(fault_id)
            fault.status = "RESOLVED"
            self._publish_event("fault.recovered", fault)
            logger.info(f"Fault resolved: {fault.type} for {drone_id}")

    def get_faults_for_drone(self, drone_id: str) -> List[Fault]:
        return [f for f in self.active_faults.values() if f.drone_id == drone_id]

    def _determine_recovery_action_from_params(
        self, fault_type: FaultType, severity: FaultSeverity
    ) -> RecoveryAction:
        if severity == "EMERGENCY":
            if fault_type in ["FLIGHT_CONTROLLER_FAILURE", "IMU_FAILURE"]:
                return "EMERGENCY_STOP"
            return "LAND"
        if severity == "CRITICAL":
            if fault_type == "BATTERY_FAILURE":
                return "RTH"
            if fault_type == "COMMUNICATION_FAILURE":
                # Will depend on local safety logic, but from manager perspective:
                return "REASSIGN_TASK"
            if fault_type == "GPS_FAILURE":
                return "HOLD"
            return "RTH"
        if severity == "DEGRADED":
            if fault_type == "CAMERA_FAILURE" or fault_type == "PERCEPTION_FAILURE":
                return "NONE"  # Mission continues if policy allows
            return "HOLD"
        return "NONE"

    def _determine_recovery_action(self, fault: Fault) -> RecoveryAction:
        return self._determine_recovery_action_from_params(fault.type, fault.severity)

    def _publish_event(self, topic: str, fault: Fault):
        if self.bus:
            import asyncio
            from core.domain.events import (
                FaultDetectedEvent,
                FaultEscalatedEvent,
                FaultRecoveredEvent,
            )

            event = None
            if topic == "fault.detected":
                event = FaultDetectedEvent(
                    source_id="FaultManager", fault=fault.model_dump()
                )
            elif topic == "fault.escalated":
                event = FaultEscalatedEvent(
                    source_id="FaultManager", fault=fault.model_dump()
                )
            elif topic == "fault.recovered":
                event = FaultRecoveredEvent(
                    source_id="FaultManager", fault=fault.model_dump()
                )

            if event:
                # Fire and forget if loop is running
                try:
                    loop = asyncio.get_running_loop()
                    loop.create_task(self.bus.publish(topic, event))
                except RuntimeError:
                    pass

import asyncio
import logging
import math
from typing import Dict, Any, List

from core.domain.world_manager import WorldManager
from core.mission.engine import MissionEngine
from core.swarm.allocator import SwarmTaskAllocator
from core.flight.safety import SafetyValidator
from core.domain.state import WorldStateDomain
from core.fault.manager import FaultManager
from core.fault.health import HealthMonitor

from core.hardware.interfaces import (
    FlightControllerInterface,
    CommunicationInterface,
    CameraInterface,
)

logger = logging.getLogger("aegis_runtime")

# Base pad positions matching the Three.js frontend scene
BASE_PADS = [
    (-190.0, 2.0, -190.0),
    (-170.0, 2.0, -190.0),
    (-190.0, 2.0, -170.0),
    (-170.0, 2.0, -170.0),
    (-180.0, 2.0, -180.0),
]

DRONE_CALLSIGNS = ["Falcon", "Eagle", "Hawk", "Raven", "Owl"]


class LegacyStateAdapter:
    """
    Translates WorldStateDomain into the JSON payload expected by the React frontend.
    Uses correct DroneState field names: drone.id, drone.pos.x/y/z, drone.battery.percentage.
    """

    @staticmethod
    def to_frontend_payload(
        state: WorldStateDomain, tick: int, sim_time: float
    ) -> dict:
        drones_payload = []
        for d_id, drone in state.drones.items():
            pos = [drone.pos.x, drone.pos.y, drone.pos.z]
            vel = [drone.vel.vx, drone.vel.vy, drone.vel.vz]

            drones_payload.append(
                {
                    "id": drone.id,
                    "callsign": drone.callsign,
                    "status": drone.status,
                    "pos": pos,
                    "vel": vel,
                    "battery": round(drone.battery.percentage, 1),
                    "heading": drone.vel.heading,
                    "trail": [],
                    "trajectory": [],
                    "scan_radius": 20.0,
                    "assigned_zone": [0, 0, 20, 20],
                    "thermal_url": f"/api/drone/{drone.id}/thermal",
                    "camera_url": f"/api/drone/{drone.id}/camera",
                    "autonomous_mode": True,
                    "last_decision": drone.mission_state,
                    "nearby_drone_id": None,
                    "reward_score": 0.0,
                    "requesting_support": False,
                    "gps_status": drone.sensors.gps_healthy,
                    "pos_uncertainty": 0.5,
                    "mesh_connected": drone.comms.mesh_connected,
                    "signal": drone.comms.signal_strength,
                    "obstacle_distance": 10.0,  # LiDAR placeholder
                    "relay_chain": [],
                    "sensors": {
                        "rgb_camera": drone.capabilities.rgb_camera,
                        "thermal_camera": drone.capabilities.thermal_camera,
                        "lidar": drone.capabilities.lidar,
                    },
                }
            )

        survivors_payload = []
        for s_id, surv in state.survivors.items():
            survivors_payload.append(
                {
                    "id": s_id,
                    "pos": [surv.pos.x, surv.pos.y, surv.pos.z],
                    "detected": surv.status in ("TRACKED", "RESCUED"),
                    "status": surv.status,
                    "confidence": (
                        round(surv.confidence * 100)
                        if surv.confidence <= 1.0
                        else int(surv.confidence)
                    ),
                    "body_temp": 37.2,
                    "real_coords": [surv.pos.x, surv.pos.y, surv.pos.z],
                    "rescued": surv.status == "RESCUED",
                    "alive": True,
                }
            )

        mission_phase = "IDLE"
        if hasattr(state, "mission"):
            mission_phase = state.mission.status

        return {
            "type": "state",
            "tick": tick,
            "sim_time": round(sim_time, 1),
            "running": True,
            "mission_phase": mission_phase,
            "drones": drones_payload,
            "survivors": survivors_payload,
            "threats": [],
            "detected_count": sum(
                1
                for s in state.survivors.values()
                if s.status in ("TRACKED", "RESCUED")
            ),
            "zone_coverage_pct": 0.0,
            "new_events": [],
            "terrain_changed": False,
            "water_level": 0.0,
        }


class AegisRuntime:
    """
    The Single Authoritative Runtime Composition Root.
    Manages the full lifecycle of an AEGIS mission.
    """

    def __init__(self, mode: str = "SIMULATION"):
        self.mode = mode.upper()
        logger.info(f"Initializing AEGIS Runtime in {self.mode} mode")

        from core.bus.message_bus import InMemoryAsyncMessageBus

        self.bus = InMemoryAsyncMessageBus()
        self.world_manager = WorldManager(self.bus)
        self.safety_validator = SafetyValidator(mode=self.mode)
        self.allocator = SwarmTaskAllocator(self.bus)

        self.fault_manager = FaultManager(self.bus)
        self.health_monitor = HealthMonitor(self.fault_manager)

        # Hardware registries
        self.flight_controllers: Dict[str, FlightControllerInterface] = {}
        self.communication_nodes: Dict[str, CommunicationInterface] = {}
        self.cameras: Dict[str, CameraInterface] = {}
        self.perception_adapters = {}
        self.message_routers: Dict[str, Any] = {}

        self.mission_engine = MissionEngine(
            self.world_manager, self.safety_validator, self.flight_controllers, self.bus
        )

        self.is_running = False
        self.tick_count = 0
        self.sim_time = 0.0

        # Detection radius for simulated perception (scene units)
        self.DETECTION_RADIUS = 22.0

        self._load_adapters()

    def _load_adapters(self):
        """Injects hardware vs sim adapters based on runtime mode."""
        if self.mode == "SIMULATION":
            from core.hardware.sim_adapters import SimFlightController
            from core.communication.interfaces import SimCommunicationAdapter
            from core.perception.mock_adapter import MockPerceptionAdapter

            for i, pad in enumerate(BASE_PADS):
                drone_id = str(i + 1)
                DRONE_CALLSIGNS[i]

                fc = SimFlightController(drone_id)
                # Start drones at base pad positions
                import numpy as np

                fc.pos = np.array([pad[0], pad[1], pad[2]])
                fc.vel = np.zeros(3)

                self.flight_controllers[drone_id] = fc
                self.communication_nodes[drone_id] = SimCommunicationAdapter(drone_id)
                from core.communication.message_router import MessageRouter

                self.message_routers[drone_id] = MessageRouter(
                    drone_id, self.communication_nodes[drone_id], self.bus
                )
                # SimCamera requires a DroneState + WorldState — use a lightweight wrapper for runtime
                self.cameras[drone_id] = None  # Cameras wired separately if needed
                self.perception_adapters[drone_id] = MockPerceptionAdapter()

        elif self.mode == "COMPANION":
            drone_id = "1"
            try:
                from core.hardware.mavlink.mavlink_adapter import (
                    MavlinkFlightControllerAdapter,
                )

                self.flight_controllers[drone_id] = MavlinkFlightControllerAdapter(
                    drone_id
                )
            except ImportError:
                logger.error(
                    "MavlinkFlightControllerAdapter not found. Falling back to Simulation."
                )

            try:
                from core.communication.udp_adapter import UdpCommunicationAdapter

                self.communication_nodes[drone_id] = UdpCommunicationAdapter(drone_id)
            except ImportError:
                logger.error("UdpCommunicationAdapter not found.")

            try:
                from core.hardware.camera.camera_adapter import OpenCVCameraAdapter

                self.cameras[drone_id] = OpenCVCameraAdapter(drone_id)
            except ImportError:
                logger.error("OpenCVCameraAdapter not found.")
        else:
            raise ValueError(f"Unknown runtime mode: {self.mode}")

    async def _register_drones(self):
        """Publishes DroneRegistered events so WorldManager creates DroneState entries."""
        from core.domain.events import DroneRegistered

        for i, pad in enumerate(BASE_PADS):
            drone_id = str(i + 1)
            callsign = DRONE_CALLSIGNS[i]
            event = DroneRegistered(
                source_id="AegisRuntime", drone_id=drone_id, callsign=callsign
            )
            await self.world_manager.apply_event(event)

            # Set initial position in WorldManager state directly (fast path)
            if drone_id in self.world_manager._state.drones:
                from core.domain.state import (
                    PositionState,
                    BatteryState,
                    LocalizationState,
                )

                drone = self.world_manager._state.drones[drone_id]
                drone.pos = PositionState(x=pad[0], y=pad[1], z=pad[2])
                drone.battery = BatteryState(percentage=100.0)
                drone.localization = LocalizationState(confidence=0.99)
                drone.capabilities.rgb_camera = True
                drone.capabilities.thermal_camera = True
                drone.capabilities.lidar = True

        logger.info(f"Registered {len(BASE_PADS)} drones in WorldManager")

    def seed_survivors(self, positions: List[dict]) -> List[str]:
        """
        Seeds survivors into WorldManager from user-placed positions.
        Positions should be list of {"x": float, "z": float} dicts in scene coords.
        """
        ids = []
        for p in positions:
            x = float(
                p.get(
                    "x",
                    p.get("pos", [0, 0, 0])[0] if isinstance(p.get("pos"), list) else 0,
                )
            )
            z = float(
                p.get(
                    "z",
                    p.get("pos", [0, 0, 0])[2] if isinstance(p.get("pos"), list) else 0,
                )
            )
            sid = self.world_manager.seed_survivor(x, z)
            ids.append(sid)
        logger.info(f"Seeded {len(ids)} survivors")
        return ids

    async def start(self):
        if self.is_running:
            return
        self.is_running = True
        if hasattr(self.bus, "start"):
            self.bus.start()

        # Register drones in WorldManager BEFORE starting the loop
        await self._register_drones()

        # Start all message routers
        for router in self.message_routers.values():
            router.start()

        # Start the runtime physics loop
        asyncio.create_task(self._run_loop())
        logger.info("AEGIS Runtime Started.")

    async def _run_loop(self):
        """Background loop that steps physics and publishes telemetry at 10Hz."""
        while self.is_running:
            await self.tick(0.1)
            await asyncio.sleep(0.1)

    async def stop(self):
        self.is_running = False
        if hasattr(self.bus, "stop"):
            self.bus.stop()
        for router in self.message_routers.values():
            router.stop()
        logger.info("AEGIS Runtime Stopped.")

    async def tick(self, dt: float):
        """Central loop tick: step physics, publish telemetry, run perception."""
        if not self.is_running:
            return

        self.tick_count += 1
        self.sim_time += dt

        # 1. Component health watchdog
        self.health_monitor.check_timeouts()
        self.health_monitor.heartbeat("SYSTEM", "RUNTIME", state="HEALTHY")

        # 2. Step physics for each simulated flight controller + publish telemetry
        from core.domain.events import DroneTelemetryEvent

        for drone_id, fc in self.flight_controllers.items():
            if hasattr(fc, "step_physics"):
                fc.step_physics(dt, self.flight_controllers)

            if hasattr(fc, "pos"):
                # Create and dispatch telemetry event
                event = DroneTelemetryEvent(
                    source_id=f"fc_{drone_id}",
                    drone_id=drone_id,
                    position=fc.pos.tolist(),
                    velocity=fc.vel.tolist(),
                    heading=0.0,
                    altitude=float(fc.pos[1]),
                    battery=float(fc.battery),
                    status=fc.status,
                )
                await self.bus.publish("drone.telemetry", event)

                # Also update WorldManager directly (immediate consistency)
                if drone_id in self.world_manager._state.drones:
                    import datetime as dt_mod

                    drone = self.world_manager._state.drones[drone_id]
                    from core.domain.state import (
                        PositionState,
                        VelocityState,
                        BatteryState,
                    )

                    drone.pos = PositionState(x=fc.pos[0], y=fc.pos[1], z=fc.pos[2])
                    drone.vel = VelocityState(vx=fc.vel[0], vy=fc.vel[1], vz=fc.vel[2])
                    drone.battery = BatteryState(percentage=float(fc.battery))
                    drone.status = fc.status
                    drone.last_heartbeat = dt_mod.datetime.now(dt_mod.timezone.utc)

        # 3. Simulated perception — check drone proximity to seeded survivors
        await self._run_perception(dt)

    async def _run_perception(self, dt: float):
        """
        Simulated sensor sweep: checks each SEARCHING drone against undetected survivors.
        If within detection radius, marks the survivor as TRACKED.
        """
        state = self.world_manager._state
        undetected = [
            (sid, s) for sid, s in state.survivors.items() if s.status == "UNVERIFIED"
        ]
        if not undetected:
            return

        from core.domain.events import SurvivorDetected

        for drone_id, drone in state.drones.items():
            # Only searching drones detect survivors
            if drone.status not in ("SEARCHING", "SCANNING"):
                continue

            for sid, survivor in undetected:
                dx = drone.pos.x - survivor.pos.x
                dz = drone.pos.z - survivor.pos.z
                dist = math.sqrt(dx * dx + dz * dz)

                # Altitude-adjusted detection: better at lower altitude
                alt_factor = max(0.5, 1.0 - (drone.pos.y / 100.0))
                effective_radius = self.DETECTION_RADIUS * alt_factor

                if dist < effective_radius:
                    # Sensor Fusion Logic
                    base_confidence = min(
                        0.99, 0.7 + (1.0 - dist / effective_radius) * 0.2
                    )
                    has_thermal = drone.capabilities.thermal_camera
                    has_rgb = drone.capabilities.rgb_camera

                    evidence_sources = []
                    if has_thermal:
                        evidence_sources.append("THERMAL_CAMERA")
                        base_confidence += (
                            0.15  # Thermal is highly effective for human heat
                        )
                    if has_rgb:
                        evidence_sources.append("RGB_CAMERA")
                        base_confidence += 0.05

                    confidence = min(0.99, base_confidence)
                    logger.info(
                        f"[{drone_id}] Detected survivor {sid} at dist={dist:.1f}m conf={confidence:.2f} sources={evidence_sources}"
                    )

                    event = SurvivorDetected(
                        source_id=f"perception_{drone_id}",
                        drone_id=drone_id,
                        survivor_id=sid,
                        pos=survivor.pos,
                        confidence=confidence,
                        detection_source=",".join(evidence_sources),
                    )
                    await self.world_manager.apply_event(event)

    def get_state(self) -> WorldStateDomain:
        """Returns authoritative internal domain state."""
        return self.world_manager.current_state

    def get_legacy_state_payload(self) -> dict:
        """Translates current state for legacy React frontend."""
        state = self.world_manager.current_state
        return LegacyStateAdapter.to_frontend_payload(
            state, self.tick_count, self.sim_time
        )

    def get_api_state(self) -> dict:
        """
        Returns clean state snapshot for the /api/state polling endpoint.
        The frontend reads this every 200ms to sync drone positions and survivor status.
        """
        state = (
            self.world_manager._state
        )  # Direct access — no deep copy for performance

        drones = []
        import random

        for drone_id, drone in state.drones.items():
            drones.append(
                {
                    "id": drone.id,
                    "callsign": drone.callsign,
                    "status": drone.status,
                    "mission_state": drone.mission_state,
                    "pos": [drone.pos.x, drone.pos.y, drone.pos.z],
                    "vel": [drone.vel.vx, drone.vel.vy, drone.vel.vz],
                    "battery": round(drone.battery.percentage, 1),
                    "gps_healthy": drone.sensors.gps_healthy,
                    "mesh_connected": drone.comms.mesh_connected,
                    "signal": drone.comms.signal_strength,
                    "obstacle_distance": max(1.5, 10.0 + random.uniform(-1.0, 1.0)),
                    "sensors": {
                        "imu_accel": [
                            random.uniform(-0.1, 0.1),
                            random.uniform(-0.1, 0.1),
                            9.81 + random.uniform(-0.2, 0.2),
                        ],
                        "imu_gyro": [
                            random.uniform(-0.05, 0.05),
                            random.uniform(-0.05, 0.05),
                            random.uniform(-0.02, 0.02),
                        ],
                        "baro_hpa": 1013.25
                        - (drone.pos.y * 0.12)
                        + random.uniform(-0.1, 0.1),
                        "lidar_dist": max(0, drone.pos.y + random.uniform(-0.1, 0.1)),
                        "co2_ppm": 410.0 + random.uniform(-5.0, 5.0),
                        "battery_voltage": max(
                            12.0, 16.8 * (max(0.1, drone.battery.percentage) / 100.0)
                        )
                        + random.uniform(-0.05, 0.05),
                    },
                }
            )

        survivors = []
        for sid, surv in state.survivors.items():
            survivors.append(
                {
                    "id": sid,
                    "pos": [surv.pos.x, surv.pos.y, surv.pos.z],
                    "status": surv.status,
                    "detected": surv.status in ("TRACKED", "RESCUED"),
                    "confidence": (
                        round(surv.confidence * 100)
                        if surv.confidence <= 1.0
                        else int(surv.confidence)
                    ),
                    "body_temp": 37.2,
                }
            )

        return {
            "tick": self.tick_count,
            "sim_time": round(self.sim_time, 1),
            "running": self.is_running,
            "drones": drones,
            "survivors": survivors,
            "mission_phase": (
                state.mission.status if hasattr(state, "mission") else "IDLE"
            ),
        }

    def get_health(self) -> dict:
        return {
            "runtime_mode": self.mode,
            "drones_active": len(self.world_manager._state.drones),
            "mission_state": "ACTIVE" if self.is_running else "STOPPED",
            "tick": self.tick_count,
            "components": {
                "FlightController": "HEALTHY" if self.flight_controllers else "MISSING",
                "Communication": "HEALTHY" if self.communication_nodes else "MISSING",
                "Camera": "HEALTHY" if self.cameras else "MISSING",
                "Perception": "HEALTHY",
            },
        }


# Global Runtime Singleton
aegis_runtime = AegisRuntime(mode="SIMULATION")

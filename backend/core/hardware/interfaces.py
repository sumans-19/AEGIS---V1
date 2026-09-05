from abc import ABC, abstractmethod
from typing import Tuple, Any
from pydantic import BaseModel, Field
from datetime import datetime, timezone
import uuid
from core.domain.commands import FlightCommand, CommandResult, FlightControllerState

# ---------------------------------------------------------
# SENSOR DATA MODELS
# ---------------------------------------------------------


class SensorReading(BaseModel):
    reading_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sensor_id: str
    drone_id: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    received_timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    sequence_number: int = 0
    valid: bool = True
    confidence: float = 1.0
    status: str = "GOOD"  # EXCELLENT, GOOD, DEGRADED, POOR, INVALID


class GPSReading(SensorReading):
    latitude: float
    longitude: float
    altitude: float
    satellites: int = 0


class IMUReading(SensorReading):
    accel: Tuple[float, float, float]
    gyro: Tuple[float, float, float]
    mag: Tuple[float, float, float]


class BatteryReading(SensorReading):
    voltage: float
    percentage: float
    current: float = 0.0


class Frame(BaseModel):
    frame_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    camera_id: str
    drone_id: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    sequence_number: int = 0
    width: int
    height: int
    channels: int
    data: bytes
    status: str = "GOOD"  # GOOD, CORRUPTED, DROPPED


# ---------------------------------------------------------
# INTERFACES
# ---------------------------------------------------------


class SensorInterface(ABC):
    @abstractmethod
    def health_check(self) -> bool:
        pass


class GPSInterface(SensorInterface):
    @abstractmethod
    async def get_position(self) -> GPSReading:
        pass


class IMUInterface(SensorInterface):
    @abstractmethod
    async def get_imu_data(self) -> IMUReading:
        pass


class BatteryInterface(SensorInterface):
    @abstractmethod
    async def get_battery_state(self) -> BatteryReading:
        pass


class CameraInterface(SensorInterface):
    @abstractmethod
    async def get_frame(self) -> Frame:
        pass


class ThermalCameraInterface(CameraInterface):
    pass


class LiDARInterface(SensorInterface):
    @abstractmethod
    async def get_point_cloud(self) -> Any:
        pass


class FlightControllerInterface(ABC):
    """
    Hardware-agnostic interface for executing high-level flight commands.
    Must never be used to directly command motors.
    """

    @abstractmethod
    async def process_command(self, command: "FlightCommand") -> "CommandResult":
        """
        Submits a command to the flight controller (or adapter).
        Returns immediate ACKs, but execution happens asynchronously.
        """

    @abstractmethod
    async def get_state(self) -> "FlightControllerState":
        """Returns the current structured hardware state of the flight controller."""


class CommunicationInterface(ABC):
    @abstractmethod
    async def send_message(self, target_id: str, payload: bytes) -> bool:
        pass

    @abstractmethod
    def get_link_quality(self, target_id: str) -> float:
        pass


class LocalizationInterface(ABC):
    @abstractmethod
    async def get_local_position(self) -> Tuple[float, float, float, float]:
        """Returns x, y, z, and confidence"""

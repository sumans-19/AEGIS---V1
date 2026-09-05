from enum import Enum
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional
from datetime import datetime, timezone
import uuid


class MessagePriority(int, Enum):
    EMERGENCY = 1
    CRITICAL = 2
    HIGH = 3
    NORMAL = 4
    LOW = 5


class NetworkMessage(BaseModel):
    message_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    source_id: str
    destination_id: str  # "BROADCAST", "SWARM", or specific node_id
    message_type: str
    payload: Dict[str, Any]
    priority: MessagePriority = MessagePriority.NORMAL
    sequence_number: int = 0
    hop_count: int = 0
    max_hops: int = 5
    requires_ack: bool = False
    created_timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    ttl: float = 60.0  # seconds
    expiry_timestamp: Optional[datetime] = None

    # Security/Ready Fields
    protocol_version: str = "1.0"
    authentication_metadata: Optional[Dict[str, Any]] = None
    authentication_signature: Optional[str] = None  # ECDSA/Ed25519 signature
    encrypted: bool = False  # Flag for TLS/DTLS encapsulation
    replay_nonce: str = Field(default_factory=lambda: str(uuid.uuid4()))

    def model_post_init(self, __context):
        if self.expiry_timestamp is None:
            self.expiry_timestamp = self.created_timestamp.replace(microsecond=0)
            from datetime import timedelta

            self.expiry_timestamp += timedelta(seconds=self.ttl)

    @property
    def is_expired(self) -> bool:
        return datetime.now(timezone.utc) > self.expiry_timestamp


class LinkState(BaseModel):
    source_id: str
    destination_id: str
    connected: bool = True
    link_quality: float = 100.0  # 0 to 100
    latency: float = 0.0  # seconds
    packet_loss: float = 0.0  # 0 to 1
    last_seen: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

from pydantic import BaseModel, Field, ConfigDict
from typing import Any, Dict, Optional
from datetime import datetime, timezone
import uuid


class Message(BaseModel):
    """
    Base message schema for all AEGIS inter-module and inter-drone communications.
    Enforces standard metadata for observability, tracing, and routing.
    """

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    topic: str
    source_id: str
    target_id: Optional[str] = None
    payload: Dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(arbitrary_types_allowed=True)

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, List, Literal, Union

from pydantic import BaseModel, Field, conint


class Envelope(BaseModel):
    """Typed message envelope used on the internal communication bus."""

    message_id: uuid.UUID = Field(default_factory=uuid.uuid4)
    ts: datetime = Field(default_factory=datetime.utcnow)
    sender: str = Field(..., description="Unique identifier of the sending agent")
    recipient: Union[str, List[str], Literal["broadcast"]] = Field(
        ..., description="Intended recipient(s). 'broadcast' delivers to everyone."
    )
    priority: conint(ge=1, le=5) = Field(3, description="1=highest, 5=lowest priority")
    kind: Literal["request", "response", "notification", "command"]
    content: Dict[str, Any] = Field(
        default_factory=dict,
        description="Arbitrary payload – must be JSON-serialisable",
    )

    class Config:
        json_encoders = {uuid.UUID: str, datetime: lambda v: v.isoformat()}
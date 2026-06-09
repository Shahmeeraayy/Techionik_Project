from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class NotificationResponse(BaseModel):
    id: UUID
    recipient_role: str
    event_type: str
    title: str
    message: str
    payload: Optional[dict[str, Any]] = None
    is_read: bool
    read_at: Optional[datetime] = None
    created_at: datetime
    delivered_at: Optional[datetime] = None
    status: str

    model_config = ConfigDict(from_attributes=True)


class NotificationUnreadCountResponse(BaseModel):
    unread_count: int = Field(default=0, ge=0)


class NotificationMarkAllReadResponse(BaseModel):
    updated_count: int = Field(default=0, ge=0)
    unread_count: int = Field(default=0, ge=0)

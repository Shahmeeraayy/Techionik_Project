from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, validator


class ChatAttachmentPayload(BaseModel):
    id: Optional[str] = None
    name: str = Field(..., min_length=1, max_length=255)
    mime_type: str = Field(..., min_length=1, max_length=128)
    size_bytes: int = Field(..., ge=1, le=10 * 1024 * 1024)
    data_url: str = Field(..., min_length=1)

    @validator("name", "mime_type", "data_url")
    def validate_non_blank(cls, value: str):
        normalized = value.strip()
        if not normalized:
            raise ValueError("value must not be blank")
        return normalized


class ChatAttachmentResponse(BaseModel):
    id: str
    name: str
    mime_type: str
    size_bytes: int
    data_url: str


class ChatMessageCreateRequest(BaseModel):
    text: Optional[str] = None
    attachments: List[ChatAttachmentPayload] = Field(default_factory=list)

    @validator("text")
    def validate_text(cls, value: Optional[str]):
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None

    @validator("attachments")
    def validate_attachments(cls, value: List[ChatAttachmentPayload]):
        if len(value) > 5:
            raise ValueError("attachments cannot exceed 5 files")
        return value

    @validator("attachments", always=True)
    def validate_has_content(cls, value: List[ChatAttachmentPayload], values):
        text = values.get("text")
        if not text and not value:
            raise ValueError("text or attachments are required")
        return value


class ChatMessageResponse(BaseModel):
    id: UUID
    technician_id: UUID
    sender_role: str
    sender_id: UUID
    text: Optional[str] = None
    attachments: List[ChatAttachmentResponse] = Field(default_factory=list)
    is_broadcast: bool = False
    created_at: datetime
    delivered_at: Optional[datetime] = None
    read_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AdminChatConversationSummaryResponse(BaseModel):
    technician_id: UUID
    technician_name: str
    technician_email: str
    technician_phone: Optional[str] = None
    technician_avatar: Optional[str] = None
    technician_status: str
    current_jobs_count: int = 0
    unread_count: int = 0
    last_message_preview: Optional[str] = None
    last_message_at: Optional[datetime] = None


class AdminChatUnreadCountResponse(BaseModel):
    unread_count: int

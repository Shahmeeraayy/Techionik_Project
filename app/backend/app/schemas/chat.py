from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from ..core.config import (
    CHAT_MAX_ATTACHMENTS_PER_MESSAGE,
    CHAT_MAX_ATTACHMENT_BYTES,
    CHAT_MAX_TEXT_LENGTH,
    CHAT_MAX_VOICE_DURATION_SECONDS,
)


class ChatAttachmentPayload(BaseModel):
    id: Optional[str] = None
    name: str = Field(..., min_length=1, max_length=255)
    mime_type: str = Field(..., min_length=1, max_length=128)
    size_bytes: int = Field(..., ge=1, le=CHAT_MAX_ATTACHMENT_BYTES)
    data_url: str = Field(..., min_length=1)
    duration_seconds: Optional[int] = Field(default=None, ge=1, le=CHAT_MAX_VOICE_DURATION_SECONDS)

    @field_validator("name", "mime_type", "data_url")
    @classmethod
    def validate_non_blank(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("value must not be blank")
        return normalized


class ChatAttachmentResponse(BaseModel):
    id: str
    name: str
    mime_type: str
    size_bytes: int
    attachment_type: str
    duration_seconds: Optional[int] = None
    preview_url: Optional[str] = None
    download_url: Optional[str] = None
    data_url: Optional[str] = None


class ChatMessageCreateRequest(BaseModel):
    text: Optional[str] = Field(default=None, max_length=CHAT_MAX_TEXT_LENGTH)
    attachments: List[ChatAttachmentPayload] = Field(default_factory=list)

    @field_validator("text")
    @classmethod
    def validate_text(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            return None
        if len(normalized) > CHAT_MAX_TEXT_LENGTH:
            raise ValueError("text exceeds message length limit")
        return normalized

    @field_validator("attachments")
    @classmethod
    def validate_attachments(cls, value: List[ChatAttachmentPayload]) -> List[ChatAttachmentPayload]:
        if len(value) > CHAT_MAX_ATTACHMENTS_PER_MESSAGE:
            raise ValueError(f"attachments cannot exceed {CHAT_MAX_ATTACHMENTS_PER_MESSAGE} files")
        return value

    @model_validator(mode="after")
    def validate_has_content(self) -> "ChatMessageCreateRequest":
        if not self.text and not self.attachments:
            raise ValueError("text or attachments are required")
        return self


class ChatMessageResponse(BaseModel):
    id: UUID
    conversation_id: UUID
    conversation_type: str
    technician_id: UUID
    job_id: Optional[UUID] = None
    sender_role: str
    sender_id: UUID
    text: Optional[str] = None
    message_type: str
    attachments: List[ChatAttachmentResponse] = Field(default_factory=list)
    is_broadcast: bool = False
    is_pinned: bool = False
    pinned_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    read_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ChatConversationSummaryResponse(BaseModel):
    id: UUID
    conversation_type: str
    channel_kind: str
    title: str
    technician_id: UUID
    technician_name: str
    technician_email: str
    technician_phone: Optional[str] = None
    technician_avatar: Optional[str] = None
    technician_status: Optional[str] = None
    current_jobs_count: int = 0
    job_id: Optional[UUID] = None
    job_code: Optional[str] = None
    job_status: Optional[str] = None
    unread_count: int = 0
    pinned_count: int = 0
    member_count: int = 1
    member_ids: List[UUID] = Field(default_factory=list)
    member_names: List[str] = Field(default_factory=list)
    last_message_preview: Optional[str] = None
    last_message_at: Optional[datetime] = None


class AdminChatConversationSummaryResponse(ChatConversationSummaryResponse):
    pass


class TechnicianChatConversationSummaryResponse(ChatConversationSummaryResponse):
    pass


class ChatConversationResolveResponse(BaseModel):
    conversation: ChatConversationSummaryResponse


class ChatGroupUpsertRequest(BaseModel):
    title: str = Field(..., min_length=2, max_length=160)
    technician_ids: List[UUID] = Field(..., min_length=2)

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        normalized = value.strip()
        if len(normalized) < 2:
            raise ValueError("title must contain at least 2 characters")
        return normalized

    @field_validator("technician_ids")
    @classmethod
    def validate_technician_ids(cls, value: List[UUID]) -> List[UUID]:
        unique_ids = list(dict.fromkeys(value))
        if len(unique_ids) < 2:
            raise ValueError("group chats must include at least 2 technicians")
        return unique_ids


class ChatPinnedMessagesResponse(BaseModel):
    items: List[ChatMessageResponse] = Field(default_factory=list)


class AdminChatUnreadCountResponse(BaseModel):
    unread_count: int


class ChatAuditLogResponse(BaseModel):
    id: UUID
    actor_role: str
    actor_id: UUID
    action: str
    entity_type: str
    entity_id: UUID
    created_at: datetime
    metadata: Optional[dict] = None

from uuid import uuid4

from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Integer, JSON, String, Text, Uuid
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from .base import Base, TenantScopedMixin


class ChatAttachment(TenantScopedMixin, Base):
    __tablename__ = "chat_attachments"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    conversation_id = Column(Uuid(as_uuid=True), ForeignKey("chat_conversations.id"), nullable=False, index=True)
    message_id = Column(Uuid(as_uuid=True), ForeignKey("chat_conversation_messages.id"), nullable=False, index=True)
    original_name = Column(String(255), nullable=False)
    mime_type = Column(String(128), nullable=False)
    size_bytes = Column(Integer, nullable=False)
    attachment_type = Column(String(20), nullable=False)
    storage_path = Column(Text, nullable=False)
    sha256_hash = Column(String(64), nullable=False)
    duration_seconds = Column(Integer, nullable=True)
    metadata_json = Column("metadata", JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)

    message = relationship("ChatConversationMessage", back_populates="attachments")
    conversation = relationship("ChatConversation")

    __table_args__ = (
        CheckConstraint(
            "attachment_type IN ('image','document','voice')",
            name="chat_attachments_type_chk",
        ),
    )

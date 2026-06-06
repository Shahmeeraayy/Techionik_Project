from uuid import uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    JSON,
    String,
    Text,
    Uuid,
    text,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from .base import Base, TenantScopedMixin


class ChatConversationMessage(TenantScopedMixin, Base):
    __tablename__ = "chat_conversation_messages"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    conversation_id = Column(Uuid(as_uuid=True), ForeignKey("chat_conversations.id"), nullable=False, index=True)
    technician_id = Column(Uuid(as_uuid=True), ForeignKey("technicians.id"), nullable=False, index=True)
    sender_role = Column(String(20), nullable=False)
    sender_id = Column(Uuid(as_uuid=True), nullable=False, index=True)
    body = Column(Text, nullable=True)
    message_type = Column(String(20), nullable=False, server_default=text("'text'"))
    is_broadcast = Column(Boolean, nullable=False, server_default=text("false"))
    delivered_at = Column(DateTime(timezone=True), nullable=True)
    read_at = Column(DateTime(timezone=True), nullable=True)
    pinned_at = Column(DateTime(timezone=True), nullable=True, index=True)
    pinned_by_role = Column(String(20), nullable=True)
    pinned_by_id = Column(Uuid(as_uuid=True), nullable=True)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    metadata_json = Column("metadata", JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    conversation = relationship("ChatConversation", back_populates="messages")
    technician = relationship("Technician")
    attachments = relationship(
        "ChatAttachment",
        back_populates="message",
        cascade="all, delete-orphan",
        order_by="ChatAttachment.created_at.asc()",
    )
    receipts = relationship(
        "ChatMessageReceipt",
        back_populates="message",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        CheckConstraint(
            "sender_role IN ('admin','technician')",
            name="chat_conversation_messages_sender_role_chk",
        ),
        CheckConstraint(
            "message_type IN ('text','attachment','voice','mixed')",
            name="chat_conversation_messages_message_type_chk",
        ),
        CheckConstraint(
            "pinned_by_role IS NULL OR pinned_by_role IN ('admin','technician')",
            name="chat_conversation_messages_pinned_by_role_chk",
        ),
    )

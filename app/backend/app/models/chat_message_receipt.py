from uuid import uuid4

from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, String, Uuid, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from .base import Base, TenantScopedMixin


class ChatMessageReceipt(TenantScopedMixin, Base):
    __tablename__ = "chat_message_receipts"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    conversation_id = Column(Uuid(as_uuid=True), ForeignKey("chat_conversations.id"), nullable=False, index=True)
    message_id = Column(Uuid(as_uuid=True), ForeignKey("chat_conversation_messages.id"), nullable=False, index=True)
    recipient_role = Column(String(20), nullable=False)
    recipient_user_id = Column(Uuid(as_uuid=True), nullable=False, index=True)
    delivered_at = Column(DateTime(timezone=True), nullable=True)
    read_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    message = relationship("ChatConversationMessage", back_populates="receipts")

    __table_args__ = (
        UniqueConstraint(
            "message_id",
            "recipient_role",
            "recipient_user_id",
            name="chat_message_receipts_message_recipient_uniq",
        ),
        CheckConstraint(
            "recipient_role IN ('admin','technician')",
            name="chat_message_receipts_role_chk",
        ),
    )

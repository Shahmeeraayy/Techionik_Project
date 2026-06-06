from uuid import uuid4

from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, String, Text, Uuid, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from .base import Base, TenantScopedMixin


class ChatConversation(TenantScopedMixin, Base):
    __tablename__ = "chat_conversations"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    conversation_key = Column(String(255), nullable=False)
    conversation_type = Column(String(20), nullable=False)
    technician_id = Column(Uuid(as_uuid=True), ForeignKey("technicians.id"), nullable=False, index=True)
    job_id = Column(Uuid(as_uuid=True), ForeignKey("jobs.id"), nullable=True, index=True)
    title = Column(Text, nullable=True)
    created_by_role = Column(String(20), nullable=False)
    created_by_id = Column(Uuid(as_uuid=True), nullable=False)
    last_message_at = Column(DateTime(timezone=True), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    technician = relationship("Technician")
    job = relationship("Job")
    messages = relationship(
        "ChatConversationMessage",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="ChatConversationMessage.created_at.asc()",
    )
    attachments = relationship(
        "ChatAttachment",
        back_populates="conversation",
        cascade="all, delete-orphan",
    )
    members = relationship(
        "ChatConversationMember",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="ChatConversationMember.created_at.asc()",
    )

    __table_args__ = (
        UniqueConstraint("tenant_id", "conversation_key", name="chat_conversations_tenant_key_uniq"),
        CheckConstraint(
            "conversation_type IN ('direct','job')",
            name="chat_conversations_type_chk",
        ),
        CheckConstraint(
            "created_by_role IN ('admin','technician')",
            name="chat_conversations_created_by_role_chk",
        ),
    )

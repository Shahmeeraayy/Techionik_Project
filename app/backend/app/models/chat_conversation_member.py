from uuid import uuid4

from sqlalchemy import Column, DateTime, ForeignKey, UniqueConstraint, Uuid
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from .base import Base, TenantScopedMixin


class ChatConversationMember(TenantScopedMixin, Base):
    __tablename__ = "chat_conversation_members"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    conversation_id = Column(Uuid(as_uuid=True), ForeignKey("chat_conversations.id"), nullable=False, index=True)
    technician_id = Column(Uuid(as_uuid=True), ForeignKey("technicians.id"), nullable=False, index=True)
    added_by_id = Column(Uuid(as_uuid=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)

    conversation = relationship("ChatConversation", back_populates="members")
    technician = relationship("Technician")

    __table_args__ = (
        UniqueConstraint("conversation_id", "technician_id", name="chat_conversation_members_conversation_technician_uniq"),
    )

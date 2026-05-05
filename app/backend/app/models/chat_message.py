from uuid import uuid4

from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, ForeignKey, JSON, String, Text, Uuid, text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from .base import Base


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    technician_id = Column(Uuid(as_uuid=True), ForeignKey("technicians.id"), nullable=False, index=True)
    sender_role = Column(String(20), nullable=False)
    sender_id = Column(Uuid(as_uuid=True), nullable=False)
    body = Column(Text, nullable=True)
    attachments = Column(JSON, nullable=False, server_default=text("'[]'"))
    is_broadcast = Column(Boolean, nullable=False, server_default=text("false"))
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)
    delivered_at = Column(DateTime(timezone=True), nullable=True)
    read_at = Column(DateTime(timezone=True), nullable=True)

    technician = relationship("Technician", back_populates="chat_messages")

    __table_args__ = (
        CheckConstraint("sender_role IN ('admin','technician')", name="chat_messages_sender_role_chk"),
    )

from uuid import uuid4

from sqlalchemy import Column, DateTime, String, Text, Uuid, text
from sqlalchemy.sql import func

from .base import Base, TenantScopedMixin


class EmailOutbox(TenantScopedMixin, Base):
    __tablename__ = "email_outbox"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    recipient_email = Column(String(255), nullable=False)
    sender_email = Column(String(255), nullable=True)
    reply_to_email = Column(String(255), nullable=True)
    subject = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    message_type = Column(String(64), nullable=False)
    related_entity_type = Column(String(64), nullable=True)
    related_entity_id = Column(String(64), nullable=True)
    status = Column(String(32), nullable=False, server_default=text("'queued'"))
    error_message = Column(Text, nullable=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

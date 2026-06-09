from uuid import uuid4

from sqlalchemy import JSON, Boolean, CheckConstraint, Column, DateTime, Index, String, Text, Uuid, text
from sqlalchemy.sql import func

from .base import Base, TenantScopedMixin


class Notification(TenantScopedMixin, Base):
    __tablename__ = "notifications"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    recipient_user_id = Column(Uuid(as_uuid=True), nullable=True, index=True)
    recipient_role = Column(String(32), nullable=False, index=True)
    event_type = Column(String(64), nullable=False, server_default=text("'legacy'"))
    title = Column(String(160), nullable=False, server_default=text("'Notification'"))
    message = Column(Text, nullable=False)
    payload = Column(JSON, nullable=True)
    is_read = Column(Boolean, nullable=False, server_default=text("false"), index=True)
    read_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)
    delivered_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(32), nullable=False, server_default=text("'delivered'"))

    __table_args__ = (
        CheckConstraint(
            "recipient_role IN ('admin','technician')",
            name="notifications_recipient_role_chk",
        ),
        CheckConstraint(
            "status IN ('created','delivered','read')",
            name="notifications_status_chk",
        ),
        Index(
            "ix_notifications_recipient_lookup",
            "tenant_id",
            "recipient_role",
            "recipient_user_id",
            "created_at",
        ),
        Index(
            "ix_notifications_unread_lookup",
            "tenant_id",
            "recipient_role",
            "recipient_user_id",
            "is_read",
            "created_at",
        ),
    )

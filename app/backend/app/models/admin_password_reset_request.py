from uuid import uuid4

from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, String, Text, Uuid, text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from .base import Base, TenantScopedMixin


class AdminPasswordResetRequest(TenantScopedMixin, Base):
    __tablename__ = "admin_password_reset_requests"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    admin_user_id = Column(Uuid(as_uuid=True), ForeignKey("admin_users.id", ondelete="CASCADE"), nullable=False)
    requested_email = Column(String(255), nullable=False)
    status = Column(String(20), nullable=False, server_default=text("'PENDING'"))
    requested_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    reviewed_by = Column(Uuid(as_uuid=True), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    remarks = Column(Text, nullable=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    admin_user = relationship("AdminUser", back_populates="password_reset_requests")

    __table_args__ = (
        CheckConstraint(
            "status IN ('PENDING','RESOLVED')",
            name="admin_password_reset_requests_status_chk",
        ),
    )

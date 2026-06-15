from uuid import uuid4

from sqlalchemy import CheckConstraint, Column, DateTime, String, UniqueConstraint, Uuid, text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from .base import Base, TenantScopedMixin


class AdminUser(TenantScopedMixin, Base):
    __tablename__ = "admin_users"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False, index=True)
    password_hash = Column(String(512), nullable=False)
    tenant_role = Column(String(32), nullable=False, server_default=text("'owner'"))
    status = Column(String(16), nullable=False, server_default=text("'active'"))
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    password_changed_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    password_reset_requests = relationship(
        "AdminPasswordResetRequest",
        back_populates="admin_user",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        UniqueConstraint("tenant_id", "email", name="admin_users_tenant_email_uq"),
        CheckConstraint(
            "tenant_role IN ('owner','admin','dispatcher','viewer')",
            name="admin_users_tenant_role_chk",
        ),
        CheckConstraint(
            "status IN ('active','deactivated')",
            name="admin_users_status_chk",
        ),
    )

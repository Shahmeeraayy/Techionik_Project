from uuid import uuid4

from sqlalchemy import CheckConstraint, Column, DateTime, String, UniqueConstraint, Uuid, text
from sqlalchemy.sql import func

from .base import Base


class PlatformUser(Base):
    __tablename__ = "platform_users"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False, index=True)
    password_hash = Column(String(512), nullable=False)
    platform_role = Column(String(64), nullable=False, server_default=text("'super_admin'"))
    status = Column(String(16), nullable=False, server_default=text("'active'"))
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    password_changed_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("email", name="platform_users_email_uq"),
        CheckConstraint(
            "platform_role IN ('super_admin','platform_support','billing_admin','security_admin','read_only_auditor')",
            name="platform_users_platform_role_chk",
        ),
        CheckConstraint(
            "status IN ('active','deactivated')",
            name="platform_users_status_chk",
        ),
    )

from uuid import uuid4

from sqlalchemy import CheckConstraint, Column, DateTime, Integer, String, UniqueConstraint, Uuid, text
from sqlalchemy.sql import func

from .base import Base


class AuthLoginState(Base):
    __tablename__ = "auth_login_states"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    identity_type = Column(String(32), nullable=False)
    email = Column(String(255), nullable=False)
    failed_attempts = Column(Integer, nullable=False, server_default=text("0"))
    last_failed_at = Column(DateTime(timezone=True), nullable=True)
    locked_until = Column(DateTime(timezone=True), nullable=True)
    last_success_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("identity_type", "email", name="auth_login_states_identity_type_email_uq"),
        CheckConstraint(
            "identity_type IN ('admin','super_admin','technician')",
            name="auth_login_states_identity_type_chk",
        ),
    )

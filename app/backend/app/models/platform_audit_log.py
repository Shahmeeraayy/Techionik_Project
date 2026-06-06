from uuid import uuid4

from sqlalchemy import CheckConstraint, Column, DateTime, JSON, String, Text, Uuid, text
from sqlalchemy.sql import func

from .base import Base


class PlatformAuditLog(Base):
    __tablename__ = "platform_audit_logs"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    actor_user_id = Column(Uuid(as_uuid=True), nullable=False, index=True)
    actor_name = Column(String(255), nullable=False)
    actor_role = Column(String(64), nullable=False)
    tenant_id = Column(Uuid(as_uuid=True), nullable=True, index=True)
    action = Column(String(128), nullable=False)
    module = Column(String(64), nullable=False)
    resource_id = Column(String(128), nullable=True)
    status = Column(String(16), nullable=False, server_default=text("'success'"))
    ip_address = Column(String(64), nullable=True)
    user_agent = Column(Text, nullable=True)
    reason = Column(Text, nullable=True)
    before_value = Column(JSON, nullable=True)
    after_value = Column(JSON, nullable=True)
    metadata_json = Column("metadata", JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        CheckConstraint(
            "actor_role IN ('super_admin','platform_support','billing_admin','security_admin','read_only_auditor')",
            name="platform_audit_logs_actor_role_chk",
        ),
        CheckConstraint(
            "status IN ('success','failed')",
            name="platform_audit_logs_status_chk",
        ),
    )

from uuid import uuid4

from sqlalchemy import BigInteger, Boolean, CheckConstraint, Column, DateTime, Integer, JSON, String, Text, Uuid, text
from sqlalchemy.sql import func

from .base import Base


class Tenant(Base):
    __tablename__ = "tenants"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    slug = Column(String(96), nullable=False, unique=True, index=True)
    name = Column(String(255), nullable=False)
    plan = Column(String(32), nullable=False, server_default=text("'growth'"))
    status = Column(String(16), nullable=False, server_default=text("'active'"))
    industry_type = Column(String(64), nullable=False, server_default=text("'general_services'"))
    platform_status = Column(String(32), nullable=False, server_default=text("'trial'"))
    subscription_plan = Column(String(32), nullable=False, server_default=text("'pro'"))
    subscription_status = Column(String(32), nullable=False, server_default=text("'trial'"))
    payment_failures_count = Column(Integer, nullable=False, server_default=text("0"))
    trial_ends_at = Column(DateTime(timezone=True), nullable=True)
    subscription_renewal_at = Column(DateTime(timezone=True), nullable=True)
    suspended_at = Column(DateTime(timezone=True), nullable=True)
    archived_at = Column(DateTime(timezone=True), nullable=True)
    estimated_response_time_message = Column(Text, nullable=True)
    feature_flags = Column(JSON, nullable=False, server_default=text("'{}'"))
    rate_limit_config = Column(JSON, nullable=False, server_default=text("'{}'"))
    cache_prefix = Column(String(128), nullable=False, server_default=text("'tenant'"))
    email_domain = Column(String(255), nullable=True)
    support_email = Column(String(255), nullable=True)
    billing_email = Column(String(255), nullable=True)
    invoice_email = Column(String(255), nullable=True)
    notification_email = Column(String(255), nullable=True)
    email_verified = Column(Boolean, nullable=False, server_default=text("false"))
    email_sending_status = Column(String(32), nullable=False, server_default=text("'demo'"))
    storage_quota_bytes = Column(BigInteger, nullable=False, server_default=text("1073741824"))
    jobs_quota_per_day = Column(BigInteger, nullable=False, server_default=text("10000"))
    status_lookup_enabled = Column(Boolean, nullable=False, server_default=text("false"))
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint("plan IN ('starter','growth','enterprise')", name="tenants_plan_chk"),
        CheckConstraint("status IN ('active','suspended')", name="tenants_status_chk"),
    )


class TenantMembership(Base):
    __tablename__ = "tenant_memberships"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id = Column(Uuid(as_uuid=True), nullable=False, index=True)
    auth_user_id = Column(Uuid(as_uuid=True), nullable=False, index=True)
    role = Column(String(32), nullable=False)
    is_active = Column(Boolean, nullable=False, server_default=text("true"))
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint(
            "role IN ('owner','admin','dispatcher','technician','viewer')",
            name="tenant_memberships_role_chk",
        ),
    )

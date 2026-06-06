from uuid import uuid4

from sqlalchemy import Boolean, Column, DateTime, String, Text, UniqueConstraint, Uuid
from sqlalchemy.sql import func

from .base import Base


class TenantFeatureOverride(Base):
    __tablename__ = "tenant_feature_overrides"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id = Column(Uuid(as_uuid=True), nullable=False, index=True)
    feature_key = Column(String(64), nullable=False)
    is_enabled = Column(Boolean, nullable=False)
    reason = Column(Text, nullable=True)
    updated_by_user_id = Column(Uuid(as_uuid=True), nullable=True)
    updated_by_role = Column(String(64), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("tenant_id", "feature_key", name="tenant_feature_overrides_tenant_feature_uq"),
    )

from uuid import uuid4

from sqlalchemy import Column, DateTime, JSON, String, Text, Uuid
from sqlalchemy.sql import func

from .base import Base


class PlatformSettings(Base):
    __tablename__ = "platform_settings"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    key = Column(String(64), nullable=False, unique=True, index=True)
    payload = Column(JSON, nullable=False, default=dict)
    updated_by_user_id = Column(Uuid(as_uuid=True), nullable=True)
    updated_by_role = Column(String(64), nullable=True)
    last_change_reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

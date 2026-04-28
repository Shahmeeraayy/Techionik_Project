from uuid import uuid4

from sqlalchemy import Boolean, Column, DateTime, String, Text, Uuid, UniqueConstraint, text
from sqlalchemy.sql import func

from .base import Base


class QuickBooksTaxCode(Base):
    __tablename__ = "quickbooks_tax_codes"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    realm_id = Column(String(64), nullable=False, index=True)
    qb_tax_code_id = Column(String(64), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    active = Column(Boolean, nullable=False, server_default=text("true"))
    internal_tax_code = Column(String(32), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("realm_id", "qb_tax_code_id", name="quickbooks_tax_codes_realm_qb_tax_code_id_uq"),
    )

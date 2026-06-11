from uuid import uuid4

from sqlalchemy import CheckConstraint, Column, Date, DateTime, ForeignKey, String, Text, Uuid
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from .base import Base, TenantScopedMixin


class TechnicianDocument(TenantScopedMixin, Base):
    __tablename__ = "technician_documents"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    technician_id = Column(
        Uuid(as_uuid=True),
        ForeignKey("technicians.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    document_name = Column(String(255), nullable=False)
    document_type = Column(String(64), nullable=False)
    license_number = Column(String(128), nullable=True)
    expiry_date = Column(Date, nullable=True)
    file_url = Column(Text, nullable=True)
    uploaded_file_id = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    technician = relationship("Technician", back_populates="documents")

    __table_args__ = (
        CheckConstraint(
            "document_type IN ('license','certification','insurance','background_check','other')",
            name="technician_documents_type_chk",
        ),
    )

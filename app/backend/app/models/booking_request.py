from uuid import uuid4

from sqlalchemy import CheckConstraint, Column, Date, DateTime, ForeignKey, String, Text, Uuid, text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from .base import Base


class BookingRequest(Base):
    __tablename__ = "booking_requests"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    reference_number = Column(String(32), unique=True, nullable=False)
    customer_full_name = Column(String(255), nullable=False)
    phone_number = Column(String(64), nullable=False)
    email_address = Column(String(255), nullable=False)
    service_catalog_id = Column(Uuid(as_uuid=True), ForeignKey("service_catalog.id"), nullable=True)
    service_name = Column(String(255), nullable=False)
    asset_details = Column(Text, nullable=False)
    preferred_date = Column(Date, nullable=True)
    preferred_time_of_day = Column(String(32), nullable=False, server_default=text("'no_preference'"))
    additional_notes = Column(Text, nullable=True)
    status = Column(String(32), nullable=False, server_default=text("'RECEIVED'"))
    assigned_technician_first_name = Column(String(64), nullable=True)
    estimated_completion_date = Column(Date, nullable=True)
    source = Column(String(64), nullable=False, server_default=text("'Booking Portal'"))
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    service_catalog = relationship("ServiceCatalog")

    __table_args__ = (
        CheckConstraint(
            "preferred_time_of_day IN ('morning','afternoon','evening','no_preference')",
            name="booking_requests_preferred_time_of_day_chk",
        ),
        CheckConstraint(
            "status IN ('RECEIVED','UNDER_REVIEW','JOB_SCHEDULED','IN_PROGRESS','COMPLETED')",
            name="booking_requests_status_chk",
        ),
    )

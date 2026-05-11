from sqlalchemy import Boolean, Column, DateTime, JSON, String, Text, text
from sqlalchemy.sql import func

from .base import Base


class BookingPortalSettings(Base):
    __tablename__ = "booking_portal_settings"

    key = Column(String(32), primary_key=True, default="default")
    is_enabled = Column(Boolean, nullable=False, server_default=text("false"))
    estimated_response_time_message = Column(
        Text,
        nullable=False,
        server_default=text("'We will contact you within 2 business hours.'"),
    )
    confirmation_email_body = Column(
        Text,
        nullable=False,
        server_default=text(
            "'Thanks for contacting {company_name}. Your booking request {reference_number} has been received.'"
        ),
    )
    visible_service_ids = Column(JSON, nullable=True)
    status_lookup_enabled = Column(Boolean, nullable=False, server_default=text("false"))
    industry_type = Column(String(32), nullable=False, server_default=text("'automotive'"))
    details_field_label = Column(String(128), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

from uuid import uuid4

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, JSON, String, Text, UniqueConstraint, Uuid, text
from sqlalchemy.sql import func

from .base import Base, TenantScopedMixin


class TechnicianAttendanceSession(TenantScopedMixin, Base):
    __tablename__ = "technician_attendance_sessions"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    technician_id = Column(Uuid(as_uuid=True), ForeignKey("technicians.id"), nullable=False, index=True)
    clock_in_at = Column(DateTime(timezone=True), nullable=False)
    clock_out_at = Column(DateTime(timezone=True), nullable=True)
    total_minutes = Column(Integer, nullable=False, server_default=text("0"))
    active_work_minutes = Column(Integer, nullable=False, server_default=text("0"))
    break_minutes = Column(Integer, nullable=False, server_default=text("0"))
    status = Column(String(32), nullable=False, server_default=text("'clocked_in'"))
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class TechnicianAttendanceEvent(TenantScopedMixin, Base):
    __tablename__ = "technician_attendance_events"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    technician_id = Column(Uuid(as_uuid=True), ForeignKey("technicians.id"), nullable=False, index=True)
    attendance_session_id = Column(Uuid(as_uuid=True), ForeignKey("technician_attendance_sessions.id"), nullable=False, index=True)
    event_type = Column(String(32), nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    accuracy = Column(Float, nullable=True)
    device_log_id = Column(Uuid(as_uuid=True), nullable=True)
    geo_fence_validation_id = Column(Uuid(as_uuid=True), nullable=True)
    occurred_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class TechnicianLocation(TenantScopedMixin, Base):
    __tablename__ = "technician_locations"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    technician_id = Column(Uuid(as_uuid=True), ForeignKey("technicians.id"), nullable=False, index=True)
    job_id = Column(Uuid(as_uuid=True), ForeignKey("jobs.id"), nullable=True, index=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    accuracy = Column(Float, nullable=True)
    tracking_status = Column(String(32), nullable=False, server_default=text("'offline'"))
    availability_status = Column(String(32), nullable=False, server_default=text("'Offline'"))
    location_permission_status = Column(String(32), nullable=False, server_default=text("'unknown'"))
    location_consent_given_at = Column(DateTime(timezone=True), nullable=True)
    last_seen_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("tenant_id", "technician_id", name="technician_locations_tenant_technician_uniq"),
    )


class TechnicianLocationEvent(TenantScopedMixin, Base):
    __tablename__ = "technician_location_events"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    technician_id = Column(Uuid(as_uuid=True), ForeignKey("technicians.id"), nullable=False, index=True)
    job_id = Column(Uuid(as_uuid=True), ForeignKey("jobs.id"), nullable=True, index=True)
    attendance_event_id = Column(Uuid(as_uuid=True), ForeignKey("technician_attendance_events.id"), nullable=True)
    event_type = Column(String(64), nullable=False)
    job_status = Column(String(64), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    accuracy = Column(Float, nullable=True)
    captured_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class TechnicianDeviceLog(TenantScopedMixin, Base):
    __tablename__ = "technician_device_logs"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    technician_id = Column(Uuid(as_uuid=True), ForeignKey("technicians.id"), nullable=False, index=True)
    event_type = Column(String(64), nullable=False)
    job_id = Column(Uuid(as_uuid=True), ForeignKey("jobs.id"), nullable=True)
    attendance_event_id = Column(Uuid(as_uuid=True), nullable=True)
    location_event_id = Column(Uuid(as_uuid=True), nullable=True)
    device_type = Column(String(64), nullable=True)
    browser_name = Column(String(128), nullable=True)
    browser_version = Column(String(64), nullable=True)
    operating_system = Column(String(128), nullable=True)
    ip_address = Column(String(64), nullable=True)
    user_agent = Column(Text, nullable=True)
    session_id = Column(String(128), nullable=True)
    app_version = Column(String(64), nullable=True)
    captured_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class GeoFenceRule(TenantScopedMixin, Base):
    __tablename__ = "geo_fence_rules"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String(255), nullable=False)
    geo_fence_type = Column(String(64), nullable=False)
    job_id = Column(Uuid(as_uuid=True), ForeignKey("jobs.id"), nullable=True)
    branch_id = Column(Uuid(as_uuid=True), nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    radius_meters = Column(Integer, nullable=False, server_default=text("200"))
    mode = Column(String(32), nullable=False, server_default=text("'warning'"))
    is_active = Column(Boolean, nullable=False, server_default=text("true"))
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class GeoFenceValidationLog(TenantScopedMixin, Base):
    __tablename__ = "geo_fence_validation_logs"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    technician_id = Column(Uuid(as_uuid=True), ForeignKey("technicians.id"), nullable=False, index=True)
    job_id = Column(Uuid(as_uuid=True), ForeignKey("jobs.id"), nullable=True)
    action_type = Column(String(64), nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    accuracy = Column(Float, nullable=True)
    target_latitude = Column(Float, nullable=True)
    target_longitude = Column(Float, nullable=True)
    allowed_radius_meters = Column(Integer, nullable=True)
    distance_from_target_meters = Column(Float, nullable=True)
    geo_fence_status = Column(String(32), nullable=False)
    geo_fence_mode = Column(String(32), nullable=True)
    validated_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class ChatterLocationRequest(TenantScopedMixin, Base):
    __tablename__ = "chatter_location_requests"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    conversation_id = Column(Uuid(as_uuid=True), nullable=True, index=True)
    message_id = Column(Uuid(as_uuid=True), nullable=True)
    admin_id = Column(Uuid(as_uuid=True), nullable=False, index=True)
    technician_id = Column(Uuid(as_uuid=True), ForeignKey("technicians.id"), nullable=False, index=True)
    status = Column(String(32), nullable=False, server_default=text("'pending'"))
    requested_at = Column(DateTime(timezone=True), nullable=False)
    responded_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class ChatterSharedLocation(TenantScopedMixin, Base):
    __tablename__ = "chatter_shared_locations"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    request_id = Column(Uuid(as_uuid=True), ForeignKey("chatter_location_requests.id"), nullable=False, index=True)
    conversation_id = Column(Uuid(as_uuid=True), nullable=True)
    technician_id = Column(Uuid(as_uuid=True), ForeignKey("technicians.id"), nullable=False, index=True)
    admin_id = Column(Uuid(as_uuid=True), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    accuracy = Column(Float, nullable=True)
    device_log_id = Column(Uuid(as_uuid=True), nullable=True)
    shared_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class AttendanceAuditLog(TenantScopedMixin, Base):
    __tablename__ = "attendance_audit_logs"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    actor_id = Column(Uuid(as_uuid=True), nullable=False)
    actor_role = Column(String(32), nullable=False)
    technician_id = Column(Uuid(as_uuid=True), nullable=True, index=True)
    job_id = Column(Uuid(as_uuid=True), nullable=True)
    attendance_event_id = Column(Uuid(as_uuid=True), nullable=True)
    location_event_id = Column(Uuid(as_uuid=True), nullable=True)
    conversation_id = Column(Uuid(as_uuid=True), nullable=True)
    request_id = Column(Uuid(as_uuid=True), nullable=True)
    action = Column(String(100), nullable=False)
    metadata_json = Column("metadata", JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

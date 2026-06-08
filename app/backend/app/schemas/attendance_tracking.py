from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class DeviceLogPayload(BaseModel):
    device_type: str | None = None
    browser_name: str | None = None
    browser_version: str | None = None
    operating_system: str | None = None
    user_agent: str | None = None
    session_id: str | None = None
    app_version: str | None = None


class LocationPayload(BaseModel):
    latitude: float | None = None
    longitude: float | None = None
    accuracy: float | None = None


class TechnicianLocationConsentRequest(BaseModel):
    status: str = Field(pattern="^(granted|denied|prompt|unknown)$")
    device: DeviceLogPayload | None = None


class AttendanceActionRequest(LocationPayload):
    device: DeviceLogPayload | None = None
    job_id: UUID | None = None


class LocationUpdateRequest(LocationPayload):
    job_id: UUID | None = None
    availability_status: str | None = None
    tracking_status: str | None = None
    device: DeviceLogPayload | None = None


class LocationCheckpointRequest(LocationPayload):
    event_type: str
    job_id: UUID | None = None
    job_status: str | None = None
    attendance_event_id: UUID | None = None
    device: DeviceLogPayload | None = None


class GeoFenceRuleCreateRequest(BaseModel):
    name: str
    geo_fence_type: str
    latitude: float
    longitude: float
    radius_meters: int = Field(default=200, ge=1)
    mode: str = Field(default="warning", pattern="^(warning|strict)$")
    job_id: UUID | None = None
    branch_id: UUID | None = None
    is_active: bool = True


class GeoFenceRuleResponse(GeoFenceRuleCreateRequest):
    id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class GeoFenceValidationResponse(BaseModel):
    id: UUID
    geo_fence_status: str
    geo_fence_mode: str | None = None
    distance_from_target_meters: float | None = None
    allowed_radius_meters: int | None = None
    blocked: bool = False
    message: str | None = None


class DeviceLogResponse(DeviceLogPayload):
    id: UUID
    ip_address: str | None = None
    captured_at: datetime

    class Config:
        from_attributes = True


class AttendanceEventResponse(BaseModel):
    id: UUID
    attendance_session_id: UUID
    event_type: str
    latitude: float | None = None
    longitude: float | None = None
    accuracy: float | None = None
    device_log_id: UUID | None = None
    geo_fence_validation_id: UUID | None = None
    occurred_at: datetime

    class Config:
        from_attributes = True


class AttendanceSessionResponse(BaseModel):
    id: UUID
    technician_id: UUID
    clock_in_at: datetime
    clock_out_at: datetime | None = None
    total_minutes: int
    active_work_minutes: int
    break_minutes: int
    status: str
    events: list[AttendanceEventResponse] = []

    class Config:
        from_attributes = True


class LocationCheckpointResponse(BaseModel):
    id: UUID
    technician_id: UUID
    job_id: UUID | None = None
    attendance_event_id: UUID | None = None
    event_type: str
    job_status: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    accuracy: float | None = None
    captured_at: datetime

    class Config:
        from_attributes = True


class LatestLocationResponse(BaseModel):
    id: UUID
    technician_id: UUID
    technician_name: str | None = None
    job_id: UUID | None = None
    latitude: float | None = None
    longitude: float | None = None
    accuracy: float | None = None
    tracking_status: str
    availability_status: str
    location_permission_status: str
    location_consent_given_at: datetime | None = None
    last_seen_at: datetime | None = None
    location_state: str = "offline"
    active_job_reference: str | None = None
    attendance_status: str | None = None

    class Config:
        from_attributes = True


class AttendanceSummaryResponse(BaseModel):
    total_technicians: int
    active_technicians: int
    on_break: int
    offline: int
    total_work_minutes: int
    total_break_minutes: int
    geo_fence_warnings: int


class AttendanceReportRow(BaseModel):
    technician_id: UUID
    technician_name: str
    total_minutes: int
    active_work_minutes: int
    break_minutes: int
    clock_ins: int
    first_clock_in_at: datetime | None = None
    last_clock_out_at: datetime | None = None
    missed_clock_out: bool
    geo_fence_violations: int


class AttendanceDashboardResponse(BaseModel):
    summary: AttendanceSummaryResponse
    locations: list[LatestLocationResponse]
    reports: list[AttendanceReportRow]
    checkpoints: list[LocationCheckpointResponse]


class ChatterLocationRequestCreate(BaseModel):
    technician_id: UUID
    conversation_id: UUID | None = None
    message_id: UUID | None = None


class ChatterLocationRequestResponse(BaseModel):
    id: UUID
    conversation_id: UUID | None = None
    message_id: UUID | None = None
    admin_id: UUID
    technician_id: UUID
    status: str
    requested_at: datetime
    responded_at: datetime | None = None
    expires_at: datetime

    class Config:
        from_attributes = True


class ChatterLocationShareRequest(LocationPayload):
    device: DeviceLogPayload | None = None


class ChatterSharedLocationResponse(BaseModel):
    id: UUID
    request_id: UUID
    conversation_id: UUID | None = None
    technician_id: UUID
    admin_id: UUID
    latitude: float
    longitude: float
    accuracy: float | None = None
    device_log_id: UUID | None = None
    shared_at: datetime

    class Config:
        from_attributes = True

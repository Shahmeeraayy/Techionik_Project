from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from ...api import deps
from ...core.enums import UserRole
from ...core.security import AuthenticatedUser
from ...schemas.attendance_tracking import (
    AttendanceActionRequest,
    AttendanceDashboardResponse,
    AttendanceSessionResponse,
    ChatterLocationRequestCreate,
    ChatterLocationRequestResponse,
    ChatterLocationShareRequest,
    ChatterSharedLocationResponse,
    GeoFenceRuleCreateRequest,
    GeoFenceRuleResponse,
    LatestLocationResponse,
    LocationCheckpointRequest,
    LocationCheckpointResponse,
    LocationUpdateRequest,
    TechnicianLocationConsentRequest,
)
from ...services.attendance_tracking_service import AttendanceTrackingService

technician_router = APIRouter(prefix="/technician", tags=["technician-attendance-tracking"])
admin_router = APIRouter(prefix="/admin", tags=["admin-attendance-tracking"])
chatter_router = APIRouter(prefix="/chatter", tags=["chatter-location"])


def technician_service(
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.TECHNICIAN)),
) -> AttendanceTrackingService:
    return AttendanceTrackingService(db, current_user, request)


def admin_service(
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.ADMIN)),
) -> AttendanceTrackingService:
    return AttendanceTrackingService(db, current_user, request)


@technician_router.post("/location/consent", response_model=LatestLocationResponse)
def save_location_consent(
    payload: TechnicianLocationConsentRequest,
    service: AttendanceTrackingService = Depends(technician_service),
):
    return service.save_consent(payload)


@technician_router.post("/location/update", response_model=LatestLocationResponse)
def update_latest_location(
    payload: LocationUpdateRequest,
    service: AttendanceTrackingService = Depends(technician_service),
):
    return service.update_location(payload)


@technician_router.post("/location/checkpoint", response_model=LocationCheckpointResponse, status_code=status.HTTP_201_CREATED)
def create_location_checkpoint(
    payload: LocationCheckpointRequest,
    service: AttendanceTrackingService = Depends(technician_service),
):
    return service.create_checkpoint(payload)


@technician_router.get("/attendance/current", response_model=AttendanceSessionResponse | None)
def get_current_attendance(
    service: AttendanceTrackingService = Depends(technician_service),
):
    return service.current_attendance(service.current_user.user_id)


@technician_router.get("/attendance/history", response_model=List[AttendanceSessionResponse])
def get_attendance_history(
    service: AttendanceTrackingService = Depends(technician_service),
):
    return service.attendance_history(service.current_user.user_id)


@technician_router.post("/attendance/clock-in", response_model=AttendanceSessionResponse, status_code=status.HTTP_201_CREATED)
def clock_in(
    payload: AttendanceActionRequest,
    service: AttendanceTrackingService = Depends(technician_service),
):
    return service.attendance_action("clock_in", payload)


@technician_router.post("/attendance/clock-out", response_model=AttendanceSessionResponse)
def clock_out(
    payload: AttendanceActionRequest,
    service: AttendanceTrackingService = Depends(technician_service),
):
    return service.attendance_action("clock_out", payload)


@technician_router.post("/attendance/break/start", response_model=AttendanceSessionResponse)
def start_break(
    payload: AttendanceActionRequest,
    service: AttendanceTrackingService = Depends(technician_service),
):
    return service.attendance_action("break_start", payload)


@technician_router.post("/attendance/break/end", response_model=AttendanceSessionResponse)
def end_break(
    payload: AttendanceActionRequest,
    service: AttendanceTrackingService = Depends(technician_service),
):
    return service.attendance_action("break_end", payload)


@admin_router.get("/attendance/dashboard", response_model=AttendanceDashboardResponse)
def get_attendance_dashboard(
    service: AttendanceTrackingService = Depends(admin_service),
):
    return service.admin_dashboard()


@admin_router.get("/technicians/locations", response_model=List[LatestLocationResponse])
def get_technician_locations(
    service: AttendanceTrackingService = Depends(admin_service),
):
    return service.admin_dashboard()["locations"]


@admin_router.get("/geo-fence-rules", response_model=List[GeoFenceRuleResponse])
def list_geo_fence_rules(
    service: AttendanceTrackingService = Depends(admin_service),
):
    return service.list_geo_fence_rules()


@admin_router.post("/geo-fence-rules", response_model=GeoFenceRuleResponse, status_code=status.HTTP_201_CREATED)
def create_geo_fence_rule(
    payload: GeoFenceRuleCreateRequest,
    service: AttendanceTrackingService = Depends(admin_service),
):
    return service.create_geo_fence_rule(payload)


@chatter_router.post("/location-request", response_model=ChatterLocationRequestResponse, status_code=status.HTTP_201_CREATED)
def create_chatter_location_request(
    payload: ChatterLocationRequestCreate,
    service: AttendanceTrackingService = Depends(admin_service),
):
    return service.create_location_request(payload)


@chatter_router.get("/location-requests/pending", response_model=List[ChatterLocationRequestResponse])
def list_pending_chatter_location_requests(
    service: AttendanceTrackingService = Depends(technician_service),
):
    return service.pending_location_requests_for_technician()


@chatter_router.post("/location-request/{request_id}/share", response_model=ChatterSharedLocationResponse)
def share_chatter_location_request(
    request_id: UUID,
    payload: ChatterLocationShareRequest,
    service: AttendanceTrackingService = Depends(technician_service),
):
    return service.share_location_request(request_id, payload)


@chatter_router.post("/location-request/{request_id}/decline", response_model=ChatterLocationRequestResponse)
def decline_chatter_location_request(
    request_id: UUID,
    service: AttendanceTrackingService = Depends(technician_service),
):
    return service.decline_location_request(request_id)

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ...api import deps
from ...core.enums import UserRole
from ...core.security import AuthenticatedUser
from ...schemas.booking_portal import (
    BookingPortalPublicConfigResponse,
    BookingPortalSettingsPayload,
    BookingPortalSettingsResponse,
    BookingPortalStatusLookupRequest,
    BookingPortalStatusLookupResponse,
    BookingPortalSubmissionRequest,
    BookingPortalSubmissionResponse,
    BookingRequestAdminResponse,
    BookingRequestAdminUpdatePayload,
)
from ...services.booking_portal_service import BookingPortalService

public_router = APIRouter(prefix="/booking-portal", tags=["booking-portal"])
admin_router = APIRouter(prefix="/admin/booking-portal", tags=["admin-booking-portal"])


@public_router.get("/config", response_model=BookingPortalPublicConfigResponse)
def get_booking_portal_config(
    db: Session = Depends(deps.get_db),
):
    return BookingPortalService(db).get_public_config()


@public_router.post("/submit", response_model=BookingPortalSubmissionResponse, status_code=201)
def submit_booking_portal_request(
    payload: BookingPortalSubmissionRequest,
    db: Session = Depends(deps.get_db),
):
    return BookingPortalService(db).submit_booking(payload)


@public_router.post("/status-lookup", response_model=BookingPortalStatusLookupResponse)
def lookup_booking_portal_status(
    payload: BookingPortalStatusLookupRequest,
    db: Session = Depends(deps.get_db),
):
    return BookingPortalService(db).lookup_status(payload)


@admin_router.get("/settings", response_model=BookingPortalSettingsResponse)
def get_admin_booking_portal_settings(
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.ADMIN)),
):
    _ = current_user
    return BookingPortalService(db).get_admin_settings()


@admin_router.put("/settings", response_model=BookingPortalSettingsResponse)
def update_admin_booking_portal_settings(
    payload: BookingPortalSettingsPayload,
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.ADMIN)),
):
    _ = current_user
    return BookingPortalService(db).update_admin_settings(payload)


@admin_router.get("/requests", response_model=list[BookingRequestAdminResponse])
def list_admin_booking_requests(
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.ADMIN)),
):
    _ = current_user
    return BookingPortalService(db).list_admin_bookings()


@admin_router.patch("/requests/{booking_id}", response_model=BookingRequestAdminResponse)
def update_admin_booking_request(
    booking_id: UUID,
    payload: BookingRequestAdminUpdatePayload,
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.ADMIN)),
):
    _ = current_user
    return BookingPortalService(db).update_admin_booking(booking_id, payload)

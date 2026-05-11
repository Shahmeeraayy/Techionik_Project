from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ...api import deps
from ...core.enums import UserRole
from ...core.security import AuthenticatedUser
from ...schemas.technician_password_reset_request import (
    TechnicianPasswordResetCompleteRequest,
    TechnicianPasswordResetCompleteResponse,
    TechnicianPasswordResetRequestCreate,
    TechnicianPasswordResetRequestIssueRequest,
    TechnicianPasswordResetLinkIssueResponse,
    TechnicianPasswordResetLinkValidationResponse,
    TechnicianPasswordResetRequestNotificationResponse,
    TechnicianPasswordResetRequestResponse,
    TechnicianPasswordResetRequestReviewRequest,
    TechnicianPasswordResetRequestStatus,
)
from ...services.technician_password_reset_request_service import (
    AdminTechnicianPasswordResetRequestService,
    TechnicianPasswordResetRequestService,
)

public_router = APIRouter(prefix="/auth", tags=["auth-technician-password-reset-requests"])
admin_router = APIRouter(prefix="/admin/technician-password-reset-requests", tags=["admin-technician-password-reset-requests"])


@public_router.post(
    "/technician-password-reset-request",
    response_model=TechnicianPasswordResetRequestNotificationResponse,
    status_code=202,
)
def create_technician_password_reset_request(
    payload: TechnicianPasswordResetRequestCreate,
    db: Session = Depends(deps.get_db),
):
    return TechnicianPasswordResetRequestService(db).create_request(payload)


@public_router.get(
    "/technician-password-reset-request/{request_id}",
    response_model=TechnicianPasswordResetLinkValidationResponse,
)
def validate_technician_password_reset_request(
    request_id: UUID,
    db: Session = Depends(deps.get_db),
):
    return TechnicianPasswordResetRequestService(db).validate_request_link(request_id)


@public_router.post(
    "/technician-password-reset-request/{request_id}/complete",
    response_model=TechnicianPasswordResetCompleteResponse,
)
def complete_technician_password_reset_request(
    request_id: UUID,
    payload: TechnicianPasswordResetCompleteRequest,
    db: Session = Depends(deps.get_db),
):
    return TechnicianPasswordResetRequestService(db).complete_request(request_id, payload)


@admin_router.get("", response_model=List[TechnicianPasswordResetRequestResponse])
def list_technician_password_reset_requests(
    status: Optional[TechnicianPasswordResetRequestStatus] = Query(default=TechnicianPasswordResetRequestStatus.PENDING),
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.ADMIN)),
):
    return AdminTechnicianPasswordResetRequestService(db, current_user).list_requests(status)


@admin_router.post("/issue", response_model=TechnicianPasswordResetLinkIssueResponse)
def issue_technician_password_reset_request(
    payload: TechnicianPasswordResetRequestIssueRequest,
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.ADMIN)),
):
    return TechnicianPasswordResetRequestService(db).issue_request_for_admin(payload)


@admin_router.post("/{request_id}/resolve", response_model=TechnicianPasswordResetRequestResponse)
def resolve_technician_password_reset_request(
    request_id: UUID,
    payload: TechnicianPasswordResetRequestReviewRequest,
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.ADMIN)),
):
    return AdminTechnicianPasswordResetRequestService(db, current_user).resolve_request(request_id, payload)

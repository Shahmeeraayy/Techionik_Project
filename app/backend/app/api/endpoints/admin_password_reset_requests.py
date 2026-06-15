from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from ...api import deps
from ...schemas.admin_password_reset_request import (
    AdminPasswordResetCompleteRequest,
    AdminPasswordResetCompleteResponse,
    AdminPasswordResetLinkValidationResponse,
    AdminPasswordResetRequestCreate,
    AdminPasswordResetRequestNotificationResponse,
)
from ...services.admin_password_reset_request_service import AdminPasswordResetRequestService


router = APIRouter(prefix="/auth", tags=["auth-admin-password-reset"])


@router.post(
    "/admin-password-reset-request",
    response_model=AdminPasswordResetRequestNotificationResponse,
    status_code=202,
)
def create_admin_password_reset_request(
    payload: AdminPasswordResetRequestCreate,
    request: Request,
    db: Session = Depends(deps.get_db),
):
    return AdminPasswordResetRequestService(db).create_request(payload, request_origin=request.headers.get("origin"))


@router.get(
    "/admin-password-reset-request/{request_id}",
    response_model=AdminPasswordResetLinkValidationResponse,
)
def validate_admin_password_reset_request(
    request_id: UUID,
    db: Session = Depends(deps.get_db),
):
    return AdminPasswordResetRequestService(db).validate_request_link(request_id)


@router.post(
    "/admin-password-reset-request/{request_id}/complete",
    response_model=AdminPasswordResetCompleteResponse,
)
def complete_admin_password_reset_request(
    request_id: UUID,
    payload: AdminPasswordResetCompleteRequest,
    db: Session = Depends(deps.get_db),
):
    return AdminPasswordResetRequestService(db).complete_request(request_id, payload)

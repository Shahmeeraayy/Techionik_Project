from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ...api import deps
from ...core.enums import UserRole
from ...core.security import AuthenticatedUser
from ...schemas.notification import (
    NotificationMarkAllReadResponse,
    NotificationResponse,
    NotificationUnreadCountResponse,
)
from ...services.notification_service import NotificationService

router = APIRouter(
    prefix="/notifications",
    tags=["notifications"],
)


@router.get("", response_model=list[NotificationResponse])
def list_notifications(
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.ADMIN, UserRole.TECHNICIAN)),
):
    return NotificationService(db).list_notifications(current_user=current_user, limit=limit)


@router.get("/unread-count", response_model=NotificationUnreadCountResponse)
def get_unread_count(
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.ADMIN, UserRole.TECHNICIAN)),
):
    return NotificationUnreadCountResponse(
        unread_count=NotificationService(db).get_unread_count(current_user=current_user),
    )


@router.patch("/read-all", response_model=NotificationMarkAllReadResponse)
def mark_all_notifications_read(
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.ADMIN, UserRole.TECHNICIAN)),
):
    service = NotificationService(db)
    updated_count = service.mark_all_read(current_user=current_user)
    return NotificationMarkAllReadResponse(
        updated_count=updated_count,
        unread_count=service.get_unread_count(current_user=current_user),
    )


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
def mark_notification_read(
    notification_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.ADMIN, UserRole.TECHNICIAN)),
):
    return NotificationService(db).mark_read(current_user=current_user, notification_id=notification_id)

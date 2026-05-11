import json
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from ..core.enums import AuditEntityType, UserRole
from ..core.security import AuthenticatedUser
from ..repositories.technician_repository import TechnicianRepository
from ..schemas.technician_password_reset_request import (
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
from .audit_service import AuditService


class TechnicianPasswordResetRequestService:
    RESET_LINK_TTL_HOURS = 24

    def __init__(self, db: Session):
        self.db = db
        self.repo = TechnicianRepository(db)

    def _to_response(self, request_row) -> TechnicianPasswordResetRequestResponse:
        technician = self.repo.get_technician_by_id(request_row.technician_id)
        technician_name = None
        technician_email = request_row.requested_email
        technician_phone = None
        if technician is not None:
            technician_name = technician.full_name or technician.name
            technician_email = technician.email
            technician_phone = technician.phone
        return TechnicianPasswordResetRequestResponse(
            id=request_row.id,
            technician_id=request_row.technician_id,
            technician_name=technician_name,
            technician_email=technician_email,
            technician_phone=technician_phone,
            status=request_row.status,
            requested_at=request_row.requested_at,
            reviewed_by=request_row.reviewed_by,
            reviewed_at=request_row.reviewed_at,
            remarks=request_row.remarks,
            updated_at=request_row.updated_at,
        )

    def _build_reset_url(self, request_id: UUID) -> str:
        return f"/tech/reset-password/{request_id}"

    def _require_active_request(self, request_id: UUID):
        row = self.repo.get_password_reset_request_by_id(request_id)
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Password reset request not found")
        if row.status != TechnicianPasswordResetRequestStatus.PENDING.value:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Password reset link has already been used")
        requested_at = row.requested_at
        if requested_at.tzinfo is None:
            requested_at = requested_at.replace(tzinfo=timezone.utc)
        expires_at = requested_at + timedelta(hours=self.RESET_LINK_TTL_HOURS)
        now = datetime.now(timezone.utc)
        if expires_at <= now:
            raise HTTPException(status_code=status.HTTP_410_GONE, detail="Password reset link has expired")
        technician = self.repo.get_technician_by_id(row.technician_id)
        if technician is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Technician account not found")
        return row, technician, expires_at

    def create_request(
        self,
        payload: TechnicianPasswordResetRequestCreate,
    ) -> TechnicianPasswordResetRequestNotificationResponse:
        message = "If an account exists for that email, the admin team has been notified."
        technician = self.repo.get_technician_by_email(payload.email)
        if technician is None:
            return TechnicianPasswordResetRequestNotificationResponse(message=message)

        now = datetime.now(timezone.utc)
        pending = self.repo.get_pending_password_reset_request(technician.id)
        if pending is None:
            row = self.repo.create_password_reset_request(
                technician_id=technician.id,
                requested_email=payload.email,
            )
        else:
            row = self.repo.refresh_password_reset_request(
                pending,
                requested_email=payload.email,
                now=now,
            )

        AuditService.log_event(
            self.db,
            actor_role=UserRole.TECHNICIAN,
            actor_id=technician.id,
            action="technician.password_reset.requested",
            entity_type=AuditEntityType.TECHNICIAN_PASSWORD_RESET_REQUEST.value,
            entity_id=row.id,
            metadata={
                "technician_id": str(technician.id),
                "email": technician.email,
            },
        )

        try:
            self.repo.create_admin_notification_if_supported(
                {
                    "message": f"Technician {technician.full_name or technician.name} requested a password reset",
                    "metadata_json": json.dumps(
                        {
                            "technician_id": str(technician.id),
                            "password_reset_request_id": str(row.id),
                            "email": technician.email,
                        }
                    ),
                }
            )
        except Exception:
            pass

        self.db.commit()
        return TechnicianPasswordResetRequestNotificationResponse(message=message)

    def issue_request_for_admin(
        self,
        payload: TechnicianPasswordResetRequestIssueRequest,
    ) -> TechnicianPasswordResetLinkIssueResponse:
        technician = self.repo.get_technician_by_id(payload.technician_id)
        if technician is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Technician not found")

        now = datetime.now(timezone.utc)
        pending = self.repo.get_pending_password_reset_request(technician.id)
        if pending is None:
            row = self.repo.create_password_reset_request(
                technician_id=technician.id,
                requested_email=technician.email,
            )
        else:
            row = self.repo.refresh_password_reset_request(
                pending,
                requested_email=technician.email,
                now=now,
            )

        self.db.commit()
        self.db.refresh(row)
        return TechnicianPasswordResetLinkIssueResponse(
            request=self._to_response(row),
            reset_url=self._build_reset_url(row.id),
        )

    def validate_request_link(
        self,
        request_id: UUID,
    ) -> TechnicianPasswordResetLinkValidationResponse:
        row, technician, expires_at = self._require_active_request(request_id)
        return TechnicianPasswordResetLinkValidationResponse(
            request_id=row.id,
            technician_name=technician.full_name or technician.name,
            technician_email=technician.email,
            expires_at=expires_at,
        )

    def complete_request(
        self,
        request_id: UUID,
        payload: TechnicianPasswordResetCompleteRequest,
    ) -> TechnicianPasswordResetCompleteResponse:
        row, technician, _ = self._require_active_request(request_id)

        self.repo.update_technician_fields(
            technician.id,
            {
                "password": payload.new_password,
            },
        )

        now = datetime.now(timezone.utc)
        self.repo.mark_password_reset_request_resolved(
            row,
            reviewer_id=None,
            remarks="Resolved via technician reset link.",
            now=now,
        )

        AuditService.log_event(
            self.db,
            actor_role=UserRole.TECHNICIAN,
            actor_id=technician.id,
            action="technician.password_reset.completed",
            entity_type=AuditEntityType.TECHNICIAN_PASSWORD_RESET_REQUEST.value,
            entity_id=row.id,
            metadata={
                "technician_id": str(technician.id),
            },
        )

        self.db.commit()
        return TechnicianPasswordResetCompleteResponse(
            message="Your password has been reset. You can sign in with the new password now."
        )


class AdminTechnicianPasswordResetRequestService:
    def __init__(self, db: Session, current_user: AuthenticatedUser):
        self.db = db
        self.current_user = current_user
        self.repo = TechnicianRepository(db)

    def _to_response(self, request_row) -> TechnicianPasswordResetRequestResponse:
        technician = self.repo.get_technician_by_id(request_row.technician_id)
        technician_name = None
        technician_email = request_row.requested_email
        technician_phone = None
        if technician is not None:
            technician_name = technician.full_name or technician.name
            technician_email = technician.email
            technician_phone = technician.phone
        return TechnicianPasswordResetRequestResponse(
            id=request_row.id,
            technician_id=request_row.technician_id,
            technician_name=technician_name,
            technician_email=technician_email,
            technician_phone=technician_phone,
            status=request_row.status,
            requested_at=request_row.requested_at,
            reviewed_by=request_row.reviewed_by,
            reviewed_at=request_row.reviewed_at,
            remarks=request_row.remarks,
            updated_at=request_row.updated_at,
        )

    def list_requests(
        self,
        status_filter: Optional[TechnicianPasswordResetRequestStatus] = None,
    ) -> List[TechnicianPasswordResetRequestResponse]:
        status_value = status_filter.value if status_filter else None
        rows = self.repo.list_password_reset_requests(status=status_value)
        return [self._to_response(row) for row in rows]

    def resolve_request(
        self,
        request_id: UUID,
        payload: TechnicianPasswordResetRequestReviewRequest,
    ) -> TechnicianPasswordResetRequestResponse:
        row = self.repo.get_password_reset_request_by_id(request_id)
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Password reset request not found")
        if row.status != TechnicianPasswordResetRequestStatus.PENDING.value:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Password reset request is already resolved")

        now = datetime.now(timezone.utc)
        self.repo.mark_password_reset_request_resolved(
            row,
            reviewer_id=self.current_user.user_id,
            remarks=payload.remarks,
            now=now,
        )

        AuditService.log_event(
            self.db,
            actor_role=UserRole.ADMIN,
            actor_id=self.current_user.user_id,
            action="admin.technician.password_reset.resolved",
            entity_type=AuditEntityType.TECHNICIAN_PASSWORD_RESET_REQUEST.value,
            entity_id=row.id,
            metadata={
                "technician_id": str(row.technician_id),
                "remarks": payload.remarks,
            },
        )
        self.db.commit()
        self.db.refresh(row)
        return self._to_response(row)

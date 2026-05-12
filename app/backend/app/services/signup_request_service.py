import json
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import inspect, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..core.enums import AuditEntityType, TechnicianStatus, UserRole
from ..core.security import AuthenticatedUser
from ..models.admin_credential_settings import AdminCredentialSettings
from ..repositories.signup_request_repository import SignupRequestRepository
from ..repositories.technician_repository import TechnicianRepository
from ..schemas.signup_request import (
    TechnicianSignupRequestCreate,
    TechnicianSignupRequestResponse,
)
from .audit_service import AuditService


class SignupRequestService:
    APPROVER_TENANT_ROLES = {"owner", "admin", "dispatcher"}

    def __init__(self, db: Session):
        self.db = db
        self.repo = SignupRequestRepository(db)
        self.technician_repo = TechnicianRepository(db)

    def _notifications_table_exists(self) -> bool:
        bind = self.db.get_bind()
        return bool(bind is not None and inspect(bind).has_table("notifications"))

    def _create_admin_notification(self, *, message: str, metadata_json: str) -> None:
        if not self._notifications_table_exists():
            return

        self.db.execute(
            text(
                """
                INSERT INTO notifications (recipient_role, message, metadata, created_at)
                VALUES (:recipient_role, :message, :metadata, CURRENT_TIMESTAMP)
                """
            ),
            {
                "recipient_role": "admin",
                "message": message,
                "metadata": metadata_json,
            },
        )

    def _resolve_approval_recipient_emails(self) -> list[str]:
        reviewers = self.repo.list_active_signup_reviewers()
        recipient_emails: list[str] = []
        seen: set[str] = set()

        for reviewer in reviewers:
            normalized_email = reviewer.email.strip().lower()
            if not normalized_email or normalized_email in seen:
                continue
            seen.add(normalized_email)
            recipient_emails.append(normalized_email)

        if recipient_emails:
            return recipient_emails

        fallback_settings = self.db.query(AdminCredentialSettings).first()
        if fallback_settings and fallback_settings.admin_email:
            return [fallback_settings.admin_email.strip().lower()]
        return []

    def _notify_signup_reviewers(self, row) -> None:
        recipient_emails = self._resolve_approval_recipient_emails()
        if not recipient_emails:
            return

        subject = f"Technician signup approval needed: {row.name}"
        body = (
            "A new technician signup request needs approval.\n\n"
            f"Name: {row.name}\n"
            f"Email: {row.email}\n"
            f"Phone: {row.phone or 'Not provided'}\n"
            f"Request ID: {row.id}\n"
            "Review this request from your tenant dashboard."
        )

        for recipient_email in recipient_emails:
            self.repo.queue_approval_email(
                recipient_email=recipient_email,
                subject=subject,
                body=body,
                request_id=row.id,
            )

        self._create_admin_notification(
            message=f"Technician signup request from {row.name} is waiting for approval",
            metadata_json=json.dumps(
                {
                    "signup_request_id": str(row.id),
                    "email": row.email,
                    "recipient_emails": recipient_emails,
                    "source": "technician_signup_request",
                }
            ),
        )

    def _require_signup_reviewer(self, current_user: AuthenticatedUser) -> None:
        normalized_tenant_role = (current_user.tenant_role or "").strip().lower()
        if normalized_tenant_role not in self.APPROVER_TENANT_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only tenant owners, admins, or dispatchers can review technician signup requests",
            )

    def create_request(self, payload: TechnicianSignupRequestCreate) -> TechnicianSignupRequestResponse:
        existing = self.repo.get_by_email(payload.email)
        now = datetime.now(timezone.utc)

        if existing is not None:
            if existing.status == "pending":
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Signup request already pending")
            if existing.status == "approved":
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Account already approved")
            row = self.repo.reset_as_pending(
                existing,
                name=payload.name,
                email=payload.email,
                phone=payload.phone,
                password=payload.password,
                now=now,
            )
        else:
            try:
                row = self.repo.create_request(
                    name=payload.name,
                    email=payload.email,
                    phone=payload.phone,
                    password=payload.password,
                )
            except IntegrityError as exc:
                self.db.rollback()
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists") from exc

        self._notify_signup_reviewers(row)
        self.db.commit()
        return TechnicianSignupRequestResponse.model_validate(row)

    def list_requests(
        self,
        status_filter: Optional[str] = None,
        current_user: AuthenticatedUser | None = None,
    ) -> List[TechnicianSignupRequestResponse]:
        if current_user is not None:
            self._require_signup_reviewer(current_user)
        rows = self.repo.list_requests(status_filter)
        return [TechnicianSignupRequestResponse.model_validate(row) for row in rows]

    def approve_request(self, request_id: UUID, current_user: AuthenticatedUser) -> TechnicianSignupRequestResponse:
        self._require_signup_reviewer(current_user)
        row = self.repo.get_by_id(request_id)
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Signup request not found")
        if row.status != "pending":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Signup request is not pending")

        if self.technician_repo.email_exists(row.email):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Technician email already exists")

        now = datetime.now(timezone.utc)
        technician = self.technician_repo.create_technician(
            name=row.name,
            email=row.email.lower(),
            phone=row.phone,
            password=row.password,
            status=TechnicianStatus.ACTIVE.value,
            manual_availability=True,
        )
        self.repo.mark_approved(row, technician.id, now)

        AuditService.log_event(
            self.db,
            actor_role=UserRole.ADMIN,
            actor_id=current_user.user_id,
            action="admin.technician_signup_request.approved",
            entity_type=AuditEntityType.TECHNICIAN.value,
            entity_id=technician.id,
            metadata={"signup_request_id": str(row.id), "email": row.email},
        )
        self.db.commit()
        return TechnicianSignupRequestResponse.model_validate(row)

    def reject_request(
        self,
        request_id: UUID,
        *,
        current_user: AuthenticatedUser,
        reason: Optional[str] = None,
    ) -> TechnicianSignupRequestResponse:
        self._require_signup_reviewer(current_user)
        row = self.repo.get_by_id(request_id)
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Signup request not found")
        if row.status != "pending":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Signup request is not pending")

        now = datetime.now(timezone.utc)
        self.repo.mark_rejected(row, reason.strip() if reason else None, now)
        AuditService.log_event(
            self.db,
            actor_role=UserRole.ADMIN,
            actor_id=current_user.user_id,
            action="admin.technician_signup_request.rejected",
            entity_type=AuditEntityType.TECHNICIAN.value,
            entity_id=row.id,
            metadata={"email": row.email, "reason": reason},
        )
        self.db.commit()
        return TechnicianSignupRequestResponse.model_validate(row)

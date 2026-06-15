from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from ..core.config import COMPANY_WEBSITE
from ..core.passwords import hash_password
from ..models.admin_password_reset_request import AdminPasswordResetRequest
from ..models.admin_user import AdminUser
from ..schemas.admin_password_reset_request import (
    AdminPasswordResetCompleteRequest,
    AdminPasswordResetCompleteResponse,
    AdminPasswordResetLinkValidationResponse,
    AdminPasswordResetRequestCreate,
    AdminPasswordResetRequestNotificationResponse,
)
from .admin_credential_settings_service import AdminCredentialSettingsService
from .auth_security_service import AuthSecurityService
from .email_service import send_email


class AdminPasswordResetRequestService:
    RESET_LINK_TTL_HOURS = 24

    def __init__(self, db: Session):
        self.db = db
        self.admin_service = AdminCredentialSettingsService(db)

    def _build_reset_url(self, request_id: UUID, origin: str | None = None) -> str:
        base_url = (origin or COMPANY_WEBSITE or "").strip().rstrip("/")
        if not base_url:
            return f"/admin/reset-password/{request_id}"
        return f"{base_url}/admin/reset-password/{request_id}"

    def _get_pending_request(self, admin_user_id: UUID) -> AdminPasswordResetRequest | None:
        return (
            self.db.query(AdminPasswordResetRequest)
            .filter(
                AdminPasswordResetRequest.admin_user_id == admin_user_id,
                AdminPasswordResetRequest.status == "PENDING",
            )
            .order_by(AdminPasswordResetRequest.requested_at.desc())
            .first()
        )

    def _get_request(self, request_id: UUID) -> AdminPasswordResetRequest | None:
        return (
            self.db.query(AdminPasswordResetRequest)
            .filter(AdminPasswordResetRequest.id == request_id)
            .first()
        )

    def _require_active_request(self, request_id: UUID):
        row = self._get_request(request_id)
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Password reset request not found")
        if row.status != "PENDING":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Password reset link has already been used")
        requested_at = row.requested_at
        if requested_at.tzinfo is None:
            requested_at = requested_at.replace(tzinfo=timezone.utc)
        expires_at = requested_at + timedelta(hours=self.RESET_LINK_TTL_HOURS)
        now = datetime.now(timezone.utc)
        if expires_at <= now:
            raise HTTPException(status_code=status.HTTP_410_GONE, detail="Password reset link has expired")

        admin_user = self.db.query(AdminUser).execution_options(skip_tenant_scope=True).filter(AdminUser.id == row.admin_user_id).first()
        if admin_user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Admin account not found")
        if admin_user.status != "active":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin account is not active")
        return row, admin_user, expires_at

    def create_request(
        self,
        payload: AdminPasswordResetRequestCreate,
        *,
        request_origin: str | None = None,
    ) -> AdminPasswordResetRequestNotificationResponse:
        message = "If an account exists for that email, a reset link has been sent."
        self.admin_service._ensure_admin_user_exists()
        admin_user = self.admin_service._get_admin_user_by_email(payload.email.strip().lower())
        if admin_user is None:
            return AdminPasswordResetRequestNotificationResponse(message=message)
        if admin_user.status != "active":
            return AdminPasswordResetRequestNotificationResponse(message=message)

        now = datetime.now(timezone.utc)
        pending = self._get_pending_request(admin_user.id)
        if pending is None:
            row = AdminPasswordResetRequest(
                admin_user_id=admin_user.id,
                requested_email=admin_user.email,
                status="PENDING",
            )
            self.db.add(row)
            self.db.flush()
            self.db.refresh(row)
        else:
            row = pending
            row.requested_email = admin_user.email
            row.status = "PENDING"
            row.requested_at = now
            row.reviewed_by = None
            row.reviewed_at = None
            row.remarks = None
            row.updated_at = now
            self.db.flush()
            self.db.refresh(row)

        reset_url = self._build_reset_url(row.id, request_origin)
        send_email(
            to=admin_user.email,
            subject="Reset your NexusOps admin password",
            body=(
                "We received a request to reset your NexusOps admin password.\n\n"
                f"Reset your password here: {reset_url}\n\n"
                "This link expires in 24 hours. If you did not request this, you can ignore this email."
            ),
            html_body=(
                "<p>We received a request to reset your NexusOps admin password.</p>"
                f"<p><a href=\"{reset_url}\">Reset your password</a></p>"
                "<p>This link expires in 24 hours. If you did not request this, you can ignore this email.</p>"
            ),
        )

        self.db.commit()
        return AdminPasswordResetRequestNotificationResponse(message=message)

    def validate_request_link(
        self,
        request_id: UUID,
    ) -> AdminPasswordResetLinkValidationResponse:
        row, admin_user, expires_at = self._require_active_request(request_id)
        return AdminPasswordResetLinkValidationResponse(
            request_id=row.id,
            admin_name=admin_user.full_name,
            admin_email=admin_user.email,
            expires_at=expires_at,
        )

    def complete_request(
        self,
        request_id: UUID,
        payload: AdminPasswordResetCompleteRequest,
    ) -> AdminPasswordResetCompleteResponse:
        row, admin_user, _ = self._require_active_request(request_id)

        admin_user.password_hash = hash_password(payload.new_password)
        admin_user.password_changed_at = datetime.now(timezone.utc)
        row.status = "RESOLVED"
        row.reviewed_by = None
        row.reviewed_at = datetime.now(timezone.utc)
        row.remarks = "Resolved via admin reset link."
        row.updated_at = datetime.now(timezone.utc)

        AuthSecurityService(self.db).clear_state(identity_type="admin", email=admin_user.email)

        self.db.commit()
        return AdminPasswordResetCompleteResponse(
            message="Your password has been reset. You can sign in with the new password now."
        )

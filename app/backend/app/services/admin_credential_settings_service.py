from __future__ import annotations

from datetime import datetime, timezone
import re

from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import case, text
from uuid import UUID

from ..core.config import ADMIN_DEFAULT_PASSWORD, ADMIN_EMAIL, DATABASE_URL, DEFAULT_TENANT_ID, EMAIL_ENABLED
from ..core.passwords import hash_password, verify_password
from ..core.security import AuthenticatedUser
from ..models.admin_credential_settings import AdminCredentialSettings
from ..models.admin_user import AdminUser
from ..models.tenant import Tenant, TenantMembership
from .tenant_email_identity import (
    build_email_identity_for_slug,
    ensure_tenant_email_columns,
    get_tenant_email_identity as resolve_tenant_email_identity,
)


ADMIN_CREDENTIAL_SETTINGS_KEY = "default"
WORKSPACE_SLUG_PATTERN = re.compile(r"[^a-z0-9]+")


class AdminCredentialSettingsService:
    def __init__(self, db: Session):
        self.db = db

    @property
    def tenant_id(self) -> UUID:
        raw_tenant_id = self.db.info.get("tenant_id")
        if isinstance(raw_tenant_id, UUID):
            return raw_tenant_id
        return UUID(DEFAULT_TENANT_ID)

    def _get_or_create_settings_row(self) -> AdminCredentialSettings:
        row = (
            self.db.query(AdminCredentialSettings)
            .filter(AdminCredentialSettings.key == ADMIN_CREDENTIAL_SETTINGS_KEY)
            .first()
        )
        if row is not None:
            return row

        row = AdminCredentialSettings(
            key=ADMIN_CREDENTIAL_SETTINGS_KEY,
            admin_email=ADMIN_EMAIL,
            password_hash=hash_password(ADMIN_DEFAULT_PASSWORD),
        )
        self.db.add(row)
        self.db.flush()
        return row

    def _sync_settings_row_from_admin(self, admin_user: AdminUser) -> None:
        if admin_user.tenant_id and admin_user.tenant_id != UUID(DEFAULT_TENANT_ID):
            return
        row = self._get_or_create_settings_row()
        row.admin_email = admin_user.email
        row.password_hash = admin_user.password_hash
        row.password_changed_at = admin_user.password_changed_at

    def _get_admin_user_by_id(self, admin_user_id: UUID) -> AdminUser | None:
        return self.db.query(AdminUser).filter(AdminUser.id == admin_user_id).first()

    def _get_admin_user_by_email(self, email: str) -> AdminUser | None:
        return (
            self.db.query(AdminUser)
            .execution_options(skip_tenant_scope=True)
            .filter(AdminUser.email == email.strip().lower())
            .first()
        )

    def _get_tenant_by_slug(self, slug: str) -> Tenant | None:
        ensure_tenant_email_columns(self.db)
        return (
            self.db.query(Tenant)
            .filter(Tenant.slug == slug.strip().lower())
            .first()
        )

    def _normalize_workspace_slug(self, value: str) -> str:
        normalized = WORKSPACE_SLUG_PATTERN.sub("-", value.strip().lower()).strip("-")
        normalized = re.sub(r"-{2,}", "-", normalized)
        if len(normalized) < 3:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Workspace URL must be at least 3 characters",
            )
        if len(normalized) > 96:
            normalized = normalized[:96].rstrip("-")
        if normalized in {"admin", "api", "app", "book", "www", "tech"}:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="That workspace URL is reserved",
            )
        return normalized

    def _email_identity_for_slug(self, slug: str) -> dict[str, str]:
        return build_email_identity_for_slug(slug)

    def _bootstrap_owner_from_legacy_settings(self) -> AdminUser:
        settings_row = self._get_or_create_settings_row()
        owner = self._get_admin_user_by_email(settings_row.admin_email)
        if owner is not None:
            return owner

        owner = AdminUser(
            full_name="Primary Admin",
            email=settings_row.admin_email,
            password_hash=settings_row.password_hash,
            tenant_role="owner",
            status="active",
            password_changed_at=settings_row.password_changed_at,
        )
        self.db.add(owner)
        self.db.commit()
        self.db.refresh(owner)
        return owner

    def _ensure_admin_user_exists(self) -> AdminUser:
        existing = (
            self.db.query(AdminUser)
            .order_by(
                AdminUser.created_at.asc(),
                AdminUser.email.asc(),
            )
            .first()
        )
        if existing is not None:
            return existing
        return self._bootstrap_owner_from_legacy_settings()

    def verify_admin_credentials(self, email: str, password: str) -> AdminUser | None:
        normalized_email = email.strip().lower()
        normalized_password = password.strip()
        if not normalized_email or not normalized_password:
            return None

        self._ensure_admin_user_exists()
        user = self._get_admin_user_by_email(normalized_email)
        if user is None or user.status != "active":
            return None
        if not verify_password(normalized_password, user.password_hash):
            return None

        last_login_at = datetime.now(timezone.utc)
        tenant_db = Session(bind=self.db.get_bind())
        tenant_db.info["tenant_id"] = user.tenant_id
        try:
            if not DATABASE_URL.startswith("sqlite"):
                tenant_db.execute(
                    text("SELECT set_config('app.current_tenant_id', :tenant_id, true)"),
                    {"tenant_id": str(user.tenant_id)},
                )
            tenant_user = (
                tenant_db.query(AdminUser)
                .execution_options(skip_tenant_scope=True)
                .filter(AdminUser.id == user.id)
                .first()
            )
            if tenant_user is None:
                return None
            tenant_user.last_login_at = last_login_at
            self._sync_settings_row_from_admin(tenant_user)
            tenant_db.commit()
        except Exception:
            tenant_db.rollback()
            raise
        finally:
            tenant_db.close()

        user.last_login_at = last_login_at
        return user

    def signup_owner_account(
        self,
        *,
        company_name: str,
        workspace_slug: str,
        full_name: str,
        email: str,
        password: str,
    ) -> AdminUser:
        normalized_company_name = company_name.strip()
        normalized_workspace_slug = self._normalize_workspace_slug(workspace_slug)
        normalized_full_name = full_name.strip()
        normalized_email = email.strip().lower()
        normalized_password = password.strip()

        if not normalized_company_name:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Company name is required",
            )
        if not normalized_full_name:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Full name is required",
            )
        if len(normalized_password) < 6:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Password must be at least 6 characters",
            )

        ensure_tenant_email_columns(self.db)
        if self._get_admin_user_by_email(normalized_email) is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An admin account already exists with this email",
            )
        if self._get_tenant_by_slug(normalized_workspace_slug) is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="That workspace URL is already taken",
            )

        tenant = Tenant(
            slug=normalized_workspace_slug,
            name=normalized_company_name,
            cache_prefix=f"tenant:{normalized_workspace_slug}",
            **self._email_identity_for_slug(normalized_workspace_slug),
            email_verified=False,
            email_sending_status="enabled" if EMAIL_ENABLED else "disabled",
            estimated_response_time_message="We will contact you within 2 business hours.",
            feature_flags={
                "booking_portal": False,
                "status_lookup": False,
            },
        )
        self.db.add(tenant)
        self.db.flush()

        previous_tenant_id = self.db.info.get("tenant_id")
        self.db.info["tenant_id"] = tenant.id
        try:
            if not DATABASE_URL.startswith("sqlite"):
                self.db.execute(
                    text("SELECT set_config('app.current_tenant_id', :tenant_id, true)"),
                    {"tenant_id": str(tenant.id)},
                )
            owner = AdminUser(
                full_name=normalized_full_name,
                email=normalized_email,
                password_hash=hash_password(normalized_password),
                tenant_role="owner",
                status="active",
            )
            self.db.add(owner)
            self.db.flush()

            membership = TenantMembership(
                tenant_id=tenant.id,
                auth_user_id=owner.id,
                role="owner",
                is_active=True,
            )
            self.db.add(membership)
            self._sync_settings_row_from_admin(owner)
            self.db.commit()
            self.db.refresh(owner)
            return owner
        except Exception:
            self.db.rollback()
            raise
        finally:
            self.db.info["tenant_id"] = previous_tenant_id
            if not DATABASE_URL.startswith("sqlite"):
                self.db.execute(
                    text("SELECT set_config('app.current_tenant_id', :tenant_id, true)"),
                    {"tenant_id": str(previous_tenant_id or UUID(DEFAULT_TENANT_ID))},
                )

    def _serialize_admin(self, admin_user: AdminUser) -> dict[str, object]:
        return {
            "id": str(admin_user.id),
            "full_name": admin_user.full_name,
            "admin_email": admin_user.email,
            "email": admin_user.email,
            "tenant_role": admin_user.tenant_role,
            "status": admin_user.status,
            "last_login_at": admin_user.last_login_at.isoformat() if admin_user.last_login_at else None,
            "password_changed_at": admin_user.password_changed_at.isoformat(),
            "created_at": admin_user.created_at.isoformat(),
            "updated_at": admin_user.updated_at.isoformat(),
        }

    def get_settings(self, current_user: AuthenticatedUser) -> dict[str, object]:
        admin_user = self._get_admin_user_by_id(current_user.user_id)
        if admin_user is None:
            admin_user = self._ensure_admin_user_exists()
        return self._serialize_admin(admin_user)

    def list_admin_users(self) -> list[dict[str, object]]:
        self._ensure_admin_user_exists()
        rows = (
            self.db.query(AdminUser)
            .order_by(
                case((AdminUser.tenant_role == "owner", 0), else_=1),
                AdminUser.full_name.asc(),
                AdminUser.email.asc(),
            )
            .all()
        )
        return [self._serialize_admin(row) for row in rows]

    def _require_owner(self, current_user: AuthenticatedUser, target_user: AdminUser | None = None) -> AdminUser:
        actor = self._get_admin_user_by_id(current_user.user_id)
        if actor is None:
            actor = self._ensure_admin_user_exists()

        if actor.tenant_role != "owner":
            if target_user is None or target_user.id != actor.id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only tenant owners can manage other admin accounts")
        return actor

    def create_admin_user(
        self,
        *,
        current_user: AuthenticatedUser,
        full_name: str,
        email: str,
        password: str,
        tenant_role: str,
    ) -> dict[str, object]:
        actor = self._require_owner(current_user)
        normalized_email = email.strip().lower()
        if self._get_admin_user_by_email(normalized_email) is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An admin account already exists with this email")

        if actor.tenant_role != "owner" and tenant_role == "owner":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only owners can create another owner account")

        row = AdminUser(
            full_name=full_name.strip(),
            email=normalized_email,
            password_hash=hash_password(password),
            tenant_role=tenant_role,
            status="active",
        )
        self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        return self._serialize_admin(row)

    def update_credentials(
        self,
        *,
        current_user: AuthenticatedUser,
        current_password: str,
        admin_email: str,
        new_password: str | None = None,
        full_name: str | None = None,
    ) -> dict[str, object]:
        normalized_current = current_password.strip()
        normalized_admin_email = admin_email.strip().lower()
        normalized_new_password = new_password.strip() if new_password is not None else None

        if not normalized_current:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Current password is required")
        if not normalized_admin_email:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Admin email is required")
        if normalized_new_password is not None and len(normalized_new_password) < 6:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="New password must be at least 6 characters")

        admin_user = self._get_admin_user_by_id(current_user.user_id)
        if admin_user is None:
            admin_user = self._ensure_admin_user_exists()

        if not verify_password(normalized_current, admin_user.password_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Current password is incorrect")

        duplicate = self._get_admin_user_by_email(normalized_admin_email)
        if duplicate is not None and duplicate.id != admin_user.id:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Another admin account already uses this email")

        admin_user.email = normalized_admin_email
        if full_name is not None and full_name.strip():
            admin_user.full_name = full_name.strip()

        if normalized_new_password:
            if verify_password(normalized_new_password, admin_user.password_hash):
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="New password must be different from the current password")
            admin_user.password_hash = hash_password(normalized_new_password)
            admin_user.password_changed_at = datetime.now(timezone.utc)

        self._sync_settings_row_from_admin(admin_user)
        self.db.commit()
        self.db.refresh(admin_user)
        return self._serialize_admin(admin_user)

    def change_password(self, current_user: AuthenticatedUser, current_password: str, new_password: str) -> dict[str, str]:
        updated = self.update_credentials(
            current_user=current_user,
            current_password=current_password,
            admin_email=self.get_settings(current_user)["admin_email"],  # type: ignore[index]
            new_password=new_password,
        )
        return {
            "status": "ok",
            "admin_email": str(updated["admin_email"]),
            "password_changed_at": str(updated["password_changed_at"]),
        }

    def get_tenant_email_identity(self, current_user: AuthenticatedUser) -> dict[str, object]:
        if current_user.tenant_id is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
        identity = resolve_tenant_email_identity(self.db, current_user.tenant_id)
        if identity is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
        return identity

    def update_admin_user(
        self,
        *,
        current_user: AuthenticatedUser,
        admin_user_id: UUID,
        full_name: str | None = None,
        email: str | None = None,
        password: str | None = None,
        tenant_role: str | None = None,
        status_value: str | None = None,
    ) -> dict[str, object]:
        target = self._get_admin_user_by_id(admin_user_id)
        if target is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Admin user not found")

        actor = self._require_owner(current_user, target)

        if email is not None:
            normalized_email = email.strip().lower()
            duplicate = self._get_admin_user_by_email(normalized_email)
            if duplicate is not None and duplicate.id != target.id:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Another admin account already uses this email")
            target.email = normalized_email

        if full_name is not None:
            target.full_name = full_name.strip()

        if password is not None:
            target.password_hash = hash_password(password)
            target.password_changed_at = datetime.now(timezone.utc)

        if tenant_role is not None:
            if actor.tenant_role != "owner":
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only owners can change admin roles")
            if target.id == actor.id and tenant_role != "owner":
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="The current owner cannot demote themselves")
            target.tenant_role = tenant_role

        if status_value is not None:
            if target.id == actor.id and status_value != "active":
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="You cannot deactivate your own account")
            target.status = status_value

        owner_count = (
            self.db.query(AdminUser)
            .filter(AdminUser.tenant_role == "owner", AdminUser.status == "active")
            .count()
        )
        if target.tenant_role != "owner" and owner_count == 0:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Each tenant must keep at least one active owner")

        self._sync_settings_row_from_admin(
            target if target.tenant_role == "owner" and target.status == "active" else actor
        )
        self.db.commit()
        self.db.refresh(target)
        return self._serialize_admin(target)

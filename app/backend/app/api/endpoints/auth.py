from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ...api import deps
from ...core.config import APP_ENV, DEFAULT_TENANT_ID, DEFAULT_TENANT_NAME, DEFAULT_TENANT_SLUG
from ...core.enums import UserRole
from ...core.passwords import is_password_hash, verify_password
from ...core.security import AuthenticatedUser, create_access_token
from ...models.tenant import Tenant
from ...repositories.technician_repository import TechnicianRepository
from ...services.admin_credential_settings_service import AdminCredentialSettingsService
from ...services.access_policy_service import AccessPolicyService
from ...services.super_admin_service import SuperAdminService

router = APIRouter(prefix="/auth", tags=["auth"])


class DevTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: datetime
    role: UserRole
    tenant_id: UUID | None = None
    user_id: UUID
    user_name: str
    user_email: str
    tenant_role: str | None = None
    platform_role: str | None = None


class PlatformSessionResponse(BaseModel):
    role: UserRole
    tenant_id: UUID | None = None
    user_id: UUID
    user_name: str
    user_email: str
    tenant_role: str | None = None
    platform_role: str | None = None


class DevTechnicianTokenRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=1, max_length=255)


class DevAdminTokenRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=1, max_length=255)


class AdminTokenRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=1, max_length=255)


class SuperAdminTokenRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=1, max_length=255)


class AdminSignupRequest(BaseModel):
    company_name: str = Field(..., min_length=1, max_length=255)
    workspace_slug: str = Field(..., min_length=3, max_length=96)
    full_name: str = Field(..., min_length=1, max_length=255)
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=6, max_length=255)


def _assert_tenant_accessible(db: Session, tenant_id: UUID | None) -> None:
    if tenant_id is None:
        return
    tenant = (
        db.query(Tenant)
        .execution_options(skip_tenant_scope=True)
        .filter(Tenant.id == tenant_id)
        .first()
    )
    if tenant is None and str(tenant_id) == DEFAULT_TENANT_ID:
        tenant = Tenant(
            id=tenant_id,
            slug=DEFAULT_TENANT_SLUG,
            name=DEFAULT_TENANT_NAME,
            status="active",
            platform_status="active",
            subscription_plan="pro",
            subscription_status="paid",
        )
        db.add(tenant)
        db.commit()
        db.refresh(tenant)
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
    tenant_status = getattr(tenant, "platform_status", None) or getattr(tenant, "status", None)
    if not AccessPolicyService.is_tenant_accessible(tenant_status):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tenant access is currently restricted")


def _verify_technician_credentials(*, email: str, password: str, db: Session):
    normalized_email = email.strip().lower()
    normalized_password = password.strip()
    repo = TechnicianRepository(db)
    technician = repo.get_technician_by_email_global(normalized_email)
    if technician is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid technician credentials")
    if technician.status != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Technician account is suspended")
    _assert_tenant_accessible(db, technician.tenant_id)

    stored_password = (technician.password or "").strip()
    if not stored_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Technician password is not configured. Contact admin.",
        )
    if not verify_password(normalized_password, stored_password, allow_plaintext_fallback=True):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid technician credentials")

    if not is_password_hash(stored_password):
        repo.update_technician_fields(
            technician.id,
            {
                "password": normalized_password,
            },
        )
        db.commit()

    return technician


def _issue_admin_token(*, email: str, password: str, db: Session) -> DevTokenResponse:
    admin_user = AdminCredentialSettingsService(db).verify_admin_credentials(email, password)
    if admin_user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin credentials")

    tenant_id = admin_user.tenant_id or UUID(DEFAULT_TENANT_ID)
    _assert_tenant_accessible(db, tenant_id)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=8)
    token = create_access_token(
        user_id=admin_user.id,
        role=UserRole.ADMIN,
        expires_at=expires_at,
        tenant_id=tenant_id,
        tenant_role=admin_user.tenant_role,
    )
    return DevTokenResponse(
        access_token=token,
        expires_at=expires_at,
        role=UserRole.ADMIN,
        tenant_id=tenant_id,
        user_id=admin_user.id,
        user_name=admin_user.full_name,
        user_email=admin_user.email,
        tenant_role=admin_user.tenant_role,
        platform_role=None,
    )


def _issue_super_admin_token(*, email: str, password: str, db: Session) -> DevTokenResponse:
    platform_user = SuperAdminService(db).verify_platform_credentials(email, password)
    if platform_user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid super admin credentials")

    expires_at = datetime.now(timezone.utc) + timedelta(hours=8)
    token = create_access_token(
        user_id=platform_user.id,
        role=UserRole.SUPER_ADMIN,
        expires_at=expires_at,
        platform_role=platform_user.platform_role,
    )
    return DevTokenResponse(
        access_token=token,
        expires_at=expires_at,
        role=UserRole.SUPER_ADMIN,
        tenant_id=None,
        user_id=platform_user.id,
        user_name=platform_user.full_name,
        user_email=platform_user.email,
        tenant_role=None,
        platform_role=platform_user.platform_role,
    )


@router.post("/admin-token", response_model=DevTokenResponse)
def create_admin_token(
    payload: AdminTokenRequest,
    db: Session = Depends(deps.get_db),
):
    return _issue_admin_token(email=payload.email, password=payload.password, db=db)


@router.post("/super-admin-token", response_model=DevTokenResponse)
def create_super_admin_token(
    payload: SuperAdminTokenRequest,
    db: Session = Depends(deps.get_platform_db),
):
    return _issue_super_admin_token(email=payload.email, password=payload.password, db=db)


@router.get("/super-admin-session", response_model=PlatformSessionResponse)
def get_super_admin_session(
    db: Session = Depends(deps.get_platform_db),
    current_user: AuthenticatedUser = Depends(deps.require_super_admin()),
):
    platform_user = SuperAdminService(db).get_platform_session_user(current_user)
    return PlatformSessionResponse(
        role=UserRole.SUPER_ADMIN,
        tenant_id=None,
        user_id=platform_user.id,
        user_name=platform_user.full_name,
        user_email=platform_user.email,
        tenant_role=None,
        platform_role=platform_user.platform_role,
    )


@router.post("/admin-signup", response_model=DevTokenResponse, status_code=status.HTTP_201_CREATED)
def create_admin_signup(
    payload: AdminSignupRequest,
    db: Session = Depends(deps.get_db),
):
    service = AdminCredentialSettingsService(db)
    admin_user = service.signup_owner_account(
        company_name=payload.company_name,
        workspace_slug=payload.workspace_slug,
        full_name=payload.full_name,
        email=payload.email,
        password=payload.password,
    )

    tenant_id = admin_user.tenant_id or UUID(DEFAULT_TENANT_ID)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=8)
    token = create_access_token(
        user_id=admin_user.id,
        role=UserRole.ADMIN,
        expires_at=expires_at,
        tenant_id=tenant_id,
        tenant_role=admin_user.tenant_role,
    )
    return DevTokenResponse(
        access_token=token,
        expires_at=expires_at,
        role=UserRole.ADMIN,
        tenant_id=tenant_id,
        user_id=admin_user.id,
        user_name=admin_user.full_name,
        user_email=admin_user.email,
        tenant_role=admin_user.tenant_role,
        platform_role=None,
    )


@router.post("/dev/admin-token", response_model=DevTokenResponse)
def create_dev_admin_token(
    payload: DevAdminTokenRequest,
    db: Session = Depends(deps.get_db),
):
    if APP_ENV != "development":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not found",
        )

    return _issue_admin_token(email=payload.email, password=payload.password, db=db)


@router.post("/dev/technician-token", response_model=DevTokenResponse)
def create_dev_technician_token(
    payload: DevTechnicianTokenRequest,
    db: Session = Depends(deps.get_db),
):
    if APP_ENV != "development":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not found",
        )

    technician = _verify_technician_credentials(email=payload.email, password=payload.password, db=db)

    expires_at = datetime.now(timezone.utc) + timedelta(hours=8)
    token = create_access_token(
        user_id=technician.id,
        role=UserRole.TECHNICIAN,
        expires_at=expires_at,
        tenant_id=technician.tenant_id or UUID(DEFAULT_TENANT_ID),
        tenant_role=UserRole.TECHNICIAN.value,
    )
    return DevTokenResponse(
        access_token=token,
        expires_at=expires_at,
        role=UserRole.TECHNICIAN,
        tenant_id=technician.tenant_id or UUID(DEFAULT_TENANT_ID),
        user_id=technician.id,
        user_name=technician.full_name or technician.name,
        user_email=technician.email,
        tenant_role=UserRole.TECHNICIAN.value,
        platform_role=None,
    )


@router.post("/technician-token", response_model=DevTokenResponse)
def create_technician_token(
    payload: DevTechnicianTokenRequest,
    db: Session = Depends(deps.get_db),
):
    technician = _verify_technician_credentials(email=payload.email, password=payload.password, db=db)

    expires_at = datetime.now(timezone.utc) + timedelta(hours=8)
    token = create_access_token(
        user_id=technician.id,
        role=UserRole.TECHNICIAN,
        expires_at=expires_at,
        tenant_id=technician.tenant_id or UUID(DEFAULT_TENANT_ID),
        tenant_role=UserRole.TECHNICIAN.value,
    )
    return DevTokenResponse(
        access_token=token,
        expires_at=expires_at,
        role=UserRole.TECHNICIAN,
        tenant_id=technician.tenant_id or UUID(DEFAULT_TENANT_ID),
        user_id=technician.id,
        user_name=technician.full_name or technician.name,
        user_email=technician.email,
        tenant_role=UserRole.TECHNICIAN.value,
        platform_role=None,
    )

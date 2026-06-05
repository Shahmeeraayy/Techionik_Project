from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ...api import deps
from ...core.config import APP_ENV, DEFAULT_TENANT_ID
from ...core.enums import UserRole
from ...core.passwords import is_password_hash, verify_password
from ...core.security import create_access_token
from ...repositories.technician_repository import TechnicianRepository
from ...services.admin_credential_settings_service import AdminCredentialSettingsService

router = APIRouter(prefix="/auth", tags=["auth"])


class DevTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: datetime
    role: UserRole
    tenant_id: UUID
    user_id: UUID
    user_name: str
    user_email: str
    tenant_role: str


class DevTechnicianTokenRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=1, max_length=255)


class DevAdminTokenRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=1, max_length=255)


class AdminTokenRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=1, max_length=255)


class AdminSignupRequest(BaseModel):
    company_name: str = Field(..., min_length=1, max_length=255)
    workspace_slug: str = Field(..., min_length=3, max_length=96)
    full_name: str = Field(..., min_length=1, max_length=255)
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=6, max_length=255)


def _verify_technician_credentials(*, email: str, password: str, db: Session):
    normalized_email = email.strip().lower()
    normalized_password = password.strip()
    repo = TechnicianRepository(db)
    technician = repo.get_technician_by_email_global(normalized_email)
    if technician is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid technician credentials")
    if technician.status != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Technician account is deactivated")

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
    )


@router.post("/admin-token", response_model=DevTokenResponse)
def create_admin_token(
    payload: AdminTokenRequest,
    db: Session = Depends(deps.get_db),
):
    return _issue_admin_token(email=payload.email, password=payload.password, db=db)


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
    )

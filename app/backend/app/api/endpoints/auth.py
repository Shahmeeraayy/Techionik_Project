from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ...api import deps
from ...core.config import APP_ENV, DEFAULT_TENANT_ID
from ...core.enums import UserRole
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


class DevTechnicianTokenRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=1, max_length=255)


class DevAdminTokenRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=1, max_length=255)


class AdminTokenRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=1, max_length=255)


def _issue_admin_token(*, email: str, password: str, db: Session) -> DevTokenResponse:
    if not AdminCredentialSettingsService(db).verify_admin_credentials(email, password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin credentials")

    tenant_id = UUID(DEFAULT_TENANT_ID)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=8)
    token = create_access_token(
        user_id=uuid4(),
        role=UserRole.ADMIN,
        expires_at=expires_at,
        tenant_id=tenant_id,
        tenant_role=UserRole.ADMIN.value,
    )
    return DevTokenResponse(
        access_token=token,
        expires_at=expires_at,
        role=UserRole.ADMIN,
        tenant_id=tenant_id,
    )


@router.post("/admin-token", response_model=DevTokenResponse)
def create_admin_token(
    payload: AdminTokenRequest,
    db: Session = Depends(deps.get_db),
):
    return _issue_admin_token(email=payload.email, password=payload.password, db=db)


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

    normalized_email = payload.email.strip().lower()
    normalized_password = payload.password.strip()
    repo = TechnicianRepository(db)
    technician = repo.get_technician_by_email(normalized_email)
    if technician is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid technician credentials")
    if technician.status != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Technician account is deactivated")

    stored_password = (technician.password or "").strip()
    if stored_password:
        if normalized_password != stored_password:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid technician credentials")
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Technician password is not configured. Contact admin.",
        )

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
    )


@router.post("/technician-token", response_model=DevTokenResponse)
def create_technician_token(
    payload: DevTechnicianTokenRequest,
    db: Session = Depends(deps.get_db),
):
    normalized_email = payload.email.strip().lower()
    normalized_password = payload.password.strip()
    repo = TechnicianRepository(db)
    technician = repo.get_technician_by_email(normalized_email)
    if technician is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid technician credentials")
    if technician.status != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Technician account is deactivated")

    stored_password = (technician.password or "").strip()
    if stored_password:
        if normalized_password != stored_password:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid technician credentials")
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Technician password is not configured. Contact admin.",
        )

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
    )

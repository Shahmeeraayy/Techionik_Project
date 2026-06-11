from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from ...api import deps
from ...core.enums import UserRole
from ...core.security import AuthenticatedUser
from ...schemas.settings import (
    AdminCredentialSettingsResponse,
    AdminCredentialSettingsUpdatePayload,
    AdminPasswordChangePayload,
    AdminPasswordChangeResponse,
    AdminUserCreatePayload,
    AdminUserResponse,
    AdminUserUpdatePayload,
    InvoiceBrandingSettingsPayload,
    InvoiceBrandingSettingsResponse,
    PriorityRuleCreatePayload,
    PriorityRuleResponse,
    PriorityRuleUpdatePayload,
    TenantEmailIdentityUpdatePayload,
    TenantEmailIdentityResponse,
)
from ...services.admin_credential_settings_service import AdminCredentialSettingsService
from ...services.email_service import send_email_or_raise, smtp_config_summary
from ...services.invoice_branding_settings_service import InvoiceBrandingSettingsService
from ...services.priority_rules_service import PriorityRulesService


class TestEmailPayload(BaseModel):
    to: str

router = APIRouter(prefix="/admin/settings", tags=["admin-settings"])


@router.get("/admin-credentials", response_model=AdminCredentialSettingsResponse)
def get_admin_credentials_settings(
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.ADMIN)),
):
    return AdminCredentialSettingsService(db).get_settings(current_user)


@router.get("/invoice-branding", response_model=InvoiceBrandingSettingsResponse)
def get_invoice_branding_settings(
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.ADMIN)),
):
    _ = current_user
    return InvoiceBrandingSettingsService(db).get_invoice_branding()


@router.get("/email-identity", response_model=TenantEmailIdentityResponse)
def get_tenant_email_identity(
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.ADMIN)),
):
    return AdminCredentialSettingsService(db).get_tenant_email_identity(current_user)


@router.put("/email-identity", response_model=TenantEmailIdentityResponse)
def update_tenant_email_identity(
    payload: TenantEmailIdentityUpdatePayload,
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.ADMIN)),
):
    return AdminCredentialSettingsService(db).update_tenant_email_identity(
        current_user=current_user,
        payload=payload.model_dump(exclude_none=True),
    )


@router.put("/invoice-branding", response_model=InvoiceBrandingSettingsResponse)
def update_invoice_branding_settings(
    payload: InvoiceBrandingSettingsPayload,
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.ADMIN)),
):
    _ = current_user
    return InvoiceBrandingSettingsService(db).upsert_invoice_branding(payload)


@router.post("/admin-password", response_model=AdminPasswordChangeResponse)
def change_admin_password(
    payload: AdminPasswordChangePayload,
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.ADMIN)),
):
    return AdminCredentialSettingsService(db).change_password(
        current_user=current_user,
        current_password=payload.current_password,
        new_password=payload.new_password,
    )


@router.put("/admin-credentials", response_model=AdminCredentialSettingsResponse)
def update_admin_credentials_settings(
    payload: AdminCredentialSettingsUpdatePayload,
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.ADMIN)),
):
    return AdminCredentialSettingsService(db).update_credentials(
        current_user=current_user,
        current_password=payload.current_password,
        admin_email=payload.admin_email,
        new_password=payload.new_password,
        full_name=payload.full_name,
    )


@router.get("/admin-users", response_model=List[AdminUserResponse])
def list_admin_users(
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.ADMIN)),
):
    _ = current_user
    return AdminCredentialSettingsService(db).list_admin_users()


@router.post("/admin-users", response_model=AdminUserResponse, status_code=201)
def create_admin_user(
    payload: AdminUserCreatePayload,
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.ADMIN)),
):
    return AdminCredentialSettingsService(db).create_admin_user(
        current_user=current_user,
        full_name=payload.full_name,
        email=payload.email,
        password=payload.password,
        tenant_role=payload.tenant_role,
    )


@router.patch("/admin-users/{admin_user_id}", response_model=AdminUserResponse)
def update_admin_user(
    admin_user_id: UUID,
    payload: AdminUserUpdatePayload,
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.ADMIN)),
):
    return AdminCredentialSettingsService(db).update_admin_user(
        current_user=current_user,
        admin_user_id=admin_user_id,
        full_name=payload.full_name,
        email=payload.email,
        password=payload.password,
        tenant_role=payload.tenant_role,
        status_value=payload.status,
    )


@router.get("/priority-rules", response_model=List[PriorityRuleResponse])
def list_priority_rules(
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.ADMIN)),
):
    return PriorityRulesService(db, current_user).list_rules()


@router.post("/priority-rules", response_model=PriorityRuleResponse, status_code=201)
def create_priority_rule(
    payload: PriorityRuleCreatePayload,
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.ADMIN)),
):
    return PriorityRulesService(db, current_user).create_rule(payload)


@router.patch("/priority-rules/{rule_id}", response_model=PriorityRuleResponse)
def update_priority_rule(
    rule_id: UUID,
    payload: PriorityRuleUpdatePayload,
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.ADMIN)),
):
    return PriorityRulesService(db, current_user).update_rule(rule_id, payload)


@router.delete("/priority-rules/{rule_id}")
def delete_priority_rule(
    rule_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.ADMIN)),
):
    _ = current_user
    return PriorityRulesService(db, current_user).delete_rule(rule_id)


@router.get("/email-config")
def get_email_config(
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.ADMIN)),
):
    """Returns which SMTP env vars are loaded (passwords masked)."""
    _ = current_user
    return smtp_config_summary()


@router.post("/test-email")
def send_test_email(
    payload: TestEmailPayload,
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.ADMIN)),
):
    """Send a test email to verify SMTP configuration."""
    _ = current_user
    try:
        send_email_or_raise(
            to=payload.to,
            subject="NexusOps — SMTP test",
            body="This is a test email from NexusOps. SMTP is configured correctly.",
        )
        return {"status": "sent", "to": payload.to}
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

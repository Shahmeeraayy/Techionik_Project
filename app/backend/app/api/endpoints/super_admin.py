from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from ...api import deps
from ...core.security import AuthenticatedUser
from ...schemas.super_admin import (
    SuperAdminAccessValidationPayload,
    SuperAdminBreakGlassPayload,
    SuperAdminPlatformSettingsUpdatePayload,
    SuperAdminTenantFeatureUpdatePayload,
    SuperAdminTenantPlanUpdatePayload,
    SuperAdminTenantProfileUpdatePayload,
    SuperAdminTenantStatusUpdatePayload,
)
from ...services.super_admin_service import SuperAdminService

router = APIRouter(prefix="/super-admin", tags=["super-admin"])


@router.get("/dashboard")
def get_super_admin_dashboard(
    db: Session = Depends(deps.get_platform_db),
    current_user: AuthenticatedUser = Depends(deps.require_super_admin()),
):
    return SuperAdminService(db).get_dashboard_overview(current_user)


@router.get("/tenants")
def list_super_admin_tenants(
    search: str | None = Query(default=None),
    platform_status: str | None = Query(default=None),
    subscription_plan: str | None = Query(default=None),
    subscription_status: str | None = Query(default=None),
    db: Session = Depends(deps.get_platform_db),
    current_user: AuthenticatedUser = Depends(deps.require_super_admin()),
):
    return SuperAdminService(db).list_tenants(
        current_user=current_user,
        search=search,
        platform_status=platform_status,
        subscription_plan=subscription_plan,
        subscription_status=subscription_status,
    )


@router.get("/tenants/{tenant_id}")
def get_super_admin_tenant_detail(
    tenant_id: UUID,
    db: Session = Depends(deps.get_platform_db),
    current_user: AuthenticatedUser = Depends(deps.require_super_admin()),
):
    return SuperAdminService(db).get_tenant_detail(current_user=current_user, tenant_id=tenant_id)


@router.patch("/tenants/{tenant_id}/profile")
def update_super_admin_tenant_profile(
    tenant_id: UUID,
    payload: SuperAdminTenantProfileUpdatePayload,
    request: Request,
    db: Session = Depends(deps.get_platform_db),
    current_user: AuthenticatedUser = Depends(deps.require_super_admin()),
):
    return SuperAdminService(db).update_tenant_profile(
        current_user=current_user,
        tenant_id=tenant_id,
        payload=payload.model_dump(exclude_none=True),
        request=request,
    )


@router.post("/tenants/{tenant_id}/status")
def update_super_admin_tenant_status(
    tenant_id: UUID,
    payload: SuperAdminTenantStatusUpdatePayload,
    request: Request,
    db: Session = Depends(deps.get_platform_db),
    current_user: AuthenticatedUser = Depends(deps.require_super_admin()),
):
    return SuperAdminService(db).change_tenant_status(
        current_user=current_user,
        tenant_id=tenant_id,
        status_value=payload.status,
        reason=payload.reason,
        request=request,
    )


@router.post("/tenants/{tenant_id}/plan")
def update_super_admin_tenant_plan(
    tenant_id: UUID,
    payload: SuperAdminTenantPlanUpdatePayload,
    request: Request,
    db: Session = Depends(deps.get_platform_db),
    current_user: AuthenticatedUser = Depends(deps.require_super_admin()),
):
    return SuperAdminService(db).change_tenant_plan(
        current_user=current_user,
        tenant_id=tenant_id,
        subscription_plan=payload.subscription_plan,
        subscription_status=payload.subscription_status,
        reason=payload.reason,
        request=request,
    )


@router.put("/tenants/{tenant_id}/features")
def update_super_admin_tenant_features(
    tenant_id: UUID,
    payload: SuperAdminTenantFeatureUpdatePayload,
    request: Request,
    db: Session = Depends(deps.get_platform_db),
    current_user: AuthenticatedUser = Depends(deps.require_super_admin()),
):
    return SuperAdminService(db).update_tenant_feature_overrides(
        current_user=current_user,
        tenant_id=tenant_id,
        entries=[entry.model_dump(exclude_none=True) for entry in payload.entries],
        reason=payload.reason,
        request=request,
    )


@router.post("/tenants/{tenant_id}/break-glass-access")
def break_glass_access_tenant_data(
    tenant_id: UUID,
    payload: SuperAdminBreakGlassPayload,
    request: Request,
    db: Session = Depends(deps.get_platform_db),
    current_user: AuthenticatedUser = Depends(deps.require_super_admin()),
):
    return SuperAdminService(db).get_break_glass_tenant_access(
        current_user=current_user,
        tenant_id=tenant_id,
        reason=payload.reason,
        request=request,
    )


@router.get("/audit-logs")
def list_super_admin_audit_logs(
    tenant_id: UUID | None = Query(default=None),
    module: str | None = Query(default=None),
    status_value: str | None = Query(default=None, alias="status"),
    search: str | None = Query(default=None),
    db: Session = Depends(deps.get_platform_db),
    current_user: AuthenticatedUser = Depends(deps.require_super_admin()),
):
    return SuperAdminService(db).list_platform_audit_logs(
        current_user=current_user,
        tenant_id=tenant_id,
        module=module,
        status_value=status_value,
        query=search,
    )


@router.get("/access-policies")
def get_super_admin_access_policies(
    db: Session = Depends(deps.get_platform_db),
    current_user: AuthenticatedUser = Depends(deps.require_super_admin()),
):
    return SuperAdminService(db).get_access_policy_catalog(current_user=current_user)


@router.get("/platform-settings")
def get_super_admin_platform_settings(
    db: Session = Depends(deps.get_platform_db),
    current_user: AuthenticatedUser = Depends(deps.require_super_admin("super_admin")),
):
    return SuperAdminService(db).get_platform_settings(current_user=current_user)


@router.put("/platform-settings")
def update_super_admin_platform_settings(
    payload: SuperAdminPlatformSettingsUpdatePayload,
    request: Request,
    db: Session = Depends(deps.get_platform_db),
    current_user: AuthenticatedUser = Depends(deps.require_super_admin("super_admin")),
):
    return SuperAdminService(db).update_platform_settings(
        current_user=current_user,
        payload=payload.settings,
        reason=payload.reason,
        sensitive_confirmation=payload.sensitive_confirmation,
        request=request,
    )


@router.post("/tenants/{tenant_id}/access-check")
def validate_super_admin_access_policy(
    tenant_id: UUID,
    payload: SuperAdminAccessValidationPayload,
    db: Session = Depends(deps.get_platform_db),
    current_user: AuthenticatedUser = Depends(deps.require_super_admin()),
):
    return SuperAdminService(db).validate_access_scenario(
        current_user=current_user,
        tenant_id=tenant_id,
        payload=payload.model_dump(exclude_none=True),
    )

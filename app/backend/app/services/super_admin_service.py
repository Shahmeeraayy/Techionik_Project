from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from fastapi import HTTPException, Request, status
from sqlalchemy import case, func, or_
from sqlalchemy.orm import Session

from ..core.config import SUPER_ADMIN_DEFAULT_PASSWORD, SUPER_ADMIN_EMAIL, SUPER_ADMIN_FULL_NAME
from ..core.passwords import hash_password, verify_password
from ..core.security import AuthenticatedUser
from ..models.admin_user import AdminUser
from ..models.audit_log import AuditLog
from ..models.platform_audit_log import PlatformAuditLog
from ..models.platform_settings import PlatformSettings
from ..models.platform_user import PlatformUser
from ..models.technician import Technician
from ..models.tenant import Tenant
from ..models.tenant_feature_override import TenantFeatureOverride
from .access_policy_service import AccessPolicyService, PLAN_FEATURE_MATRIX


PLATFORM_SETTINGS_KEY = "global"
SENSITIVE_PLATFORM_SETTINGS_SECTIONS = {"security", "integrations", "maintenance"}

DEFAULT_PLATFORM_SETTINGS: dict[str, Any] = {
    "general": {
        "platform_name": "NexusOps",
        "support_email": "support@nexusops.com",
        "default_timezone": "America/New_York",
        "default_currency": "USD",
        "default_language": "en",
        "contact_phone": "",
        "contact_address": "",
        "terms_url": "https://nexusops.com/terms",
        "privacy_url": "https://nexusops.com/privacy",
        "support_url": "https://nexusops.com/support",
        "environment_label": "Production",
    },
    "branding": {
        "logo_url": "",
        "favicon_url": "",
        "primary_brand_color": "#155e75",
        "login_page_branding": "NexusOps",
        "super_admin_branding": "NexusOps Super Admin",
        "default_email_branding": "NexusOps",
        "default_invoice_template": "standard",
        "customer_portal_branding": "NexusOps Customer Portal",
    },
    "organization_defaults": {
        "default_plan": "pro",
        "trial_duration_days": 14,
        "default_enabled_modules": ["jobs", "scheduling", "technicians", "customers", "invoicing"],
        "default_user_roles": ["owner", "admin", "dispatcher", "technician"],
        "default_job_statuses": ["new", "assigned", "in_progress", "completed", "cancelled"],
        "default_invoice_prefix": "NX",
        "default_timezone": "America/New_York",
        "default_currency": "USD",
        "default_technician_limit": 25,
        "default_storage_limit_gb": 20,
    },
    "billing": {
        "trial_period_days": 14,
        "grace_period_days": 7,
        "default_billing_cycle": "monthly",
        "supported_currencies": ["USD"],
        "tax_vat_placeholder": "Not configured",
        "payment_gateway_enabled": False,
        "stripe_connection_status": "not_connected",
        "payment_failure_handling": "notify_and_grace_period",
        "downgrade_behavior": "keep_until_cycle_end",
        "auto_suspend_unpaid_organizations": True,
    },
    "feature_defaults": {
        "jobs": {"enabled_by_default": True, "available_by_plan": True, "manual_override_allowed": True, "enterprise_only": False},
        "scheduling": {"enabled_by_default": True, "available_by_plan": True, "manual_override_allowed": True, "enterprise_only": False},
        "technicians": {"enabled_by_default": True, "available_by_plan": True, "manual_override_allowed": True, "enterprise_only": False},
        "customers": {"enabled_by_default": True, "available_by_plan": True, "manual_override_allowed": True, "enterprise_only": False},
        "invoicing": {"enabled_by_default": True, "available_by_plan": True, "manual_override_allowed": True, "enterprise_only": False},
        "payment_collection": {"enabled_by_default": False, "available_by_plan": True, "manual_override_allowed": True, "enterprise_only": False},
        "chatter": {"enabled_by_default": False, "available_by_plan": True, "manual_override_allowed": True, "enterprise_only": False},
        "voice_messages": {"enabled_by_default": False, "available_by_plan": True, "manual_override_allowed": True, "enterprise_only": False},
        "reports": {"enabled_by_default": False, "available_by_plan": True, "manual_override_allowed": True, "enterprise_only": False},
        "notifications": {"enabled_by_default": True, "available_by_plan": True, "manual_override_allowed": True, "enterprise_only": False},
        "integrations": {"enabled_by_default": False, "available_by_plan": True, "manual_override_allowed": True, "enterprise_only": True},
        "api_access": {"enabled_by_default": False, "available_by_plan": True, "manual_override_allowed": True, "enterprise_only": True},
        "custom_branding": {"enabled_by_default": False, "available_by_plan": True, "manual_override_allowed": True, "enterprise_only": True},
    },
    "security": {
        "password_min_length": 12,
        "password_complexity": "upper_lower_number_symbol",
        "session_timeout_minutes": 60,
        "login_attempt_limit": 5,
        "account_lockout_minutes": 30,
        "two_factor_authentication": "planned",
        "ip_restriction": "not_configured",
        "break_glass_reason_required": True,
        "audit_log_retention_days": 365,
        "api_rate_limit_per_minute": 120,
        "file_upload_security": "extension_and_size_validation",
    },
    "email_notifications": {
        "default_sender_name": "NexusOps",
        "default_sender_email": "no-reply@nexusops.com",
        "support_email": "support@nexusops.com",
        "billing_email": "billing@nexusops.com",
        "provider_status": "not_connected",
        "template_defaults": "standard",
        "notification_rules": "critical_and_billing",
        "system_announcement_enabled": False,
        "failed_email_retry_count": 3,
        "enabled_email_types": ["welcome", "invite_user", "password_reset", "invoice", "payment_failed", "organization_suspended", "security_alert"],
    },
    "files_storage": {
        "maximum_upload_size_mb": 25,
        "allowed_file_types": ["pdf", "png", "jpg", "jpeg", "webp", "docx", "xlsx", "mp3", "wav"],
        "blocked_file_types": ["exe", "bat", "cmd", "js", "vbs"],
        "storage_limit_per_organization_gb": 20,
        "attachment_rules": "allow_safe_common_files",
        "voice_message_file_limit_mb": 15,
        "file_retention_days": 365,
        "malware_scan": "planned",
        "secure_file_preview": True,
    },
    "integrations": {
        "stripe_status": "not_connected",
        "square_status": "not_connected",
        "authorize_net_status": "not_connected",
        "email_provider_status": "not_connected",
        "sms_provider_status": "not_connected",
        "push_provider_status": "not_connected",
        "google_maps_status": "not_connected",
        "calendar_status": "not_connected",
        "webhooks_status": "disabled",
        "api_key_preview": "************",
    },
    "maintenance": {
        "maintenance_mode": False,
        "read_only_mode": False,
        "announcement_banner": "",
        "force_logout_requested": False,
        "cache_status": "warm",
        "search_index_status": "ready",
        "backup_status": "not_configured",
        "system_health_url": "/health",
        "version_label": "local-dev",
    },
}


class SuperAdminService:
    def __init__(self, db: Session):
        self.db = db

    def _get_platform_user_by_email(self, email: str) -> PlatformUser | None:
        return (
            self.db.query(PlatformUser)
            .filter(PlatformUser.email == email.strip().lower())
            .first()
        )

    def _get_platform_user_by_id(self, user_id: UUID) -> PlatformUser | None:
        return self.db.query(PlatformUser).filter(PlatformUser.id == user_id).first()

    def ensure_platform_user_exists(self) -> PlatformUser:
        existing = self._get_platform_user_by_email(SUPER_ADMIN_EMAIL)
        if existing is not None:
            return existing

        row = PlatformUser(
            full_name=SUPER_ADMIN_FULL_NAME,
            email=SUPER_ADMIN_EMAIL,
            password_hash=hash_password(SUPER_ADMIN_DEFAULT_PASSWORD),
            platform_role="super_admin",
            status="active",
        )
        self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        return row

    def get_platform_session_user(self, current_user: AuthenticatedUser) -> PlatformUser:
        actor = self._get_platform_user_by_id(current_user.user_id)
        if actor is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Platform user not found")
        if actor.status != "active":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Platform user is not active")
        return actor

    def verify_platform_credentials(self, email: str, password: str) -> PlatformUser | None:
        normalized_email = email.strip().lower()
        normalized_password = password.strip()
        if not normalized_email or not normalized_password:
            return None

        self.ensure_platform_user_exists()
        row = self._get_platform_user_by_email(normalized_email)
        if row is None or row.status != "active":
            return None
        if not verify_password(normalized_password, row.password_hash):
            return None

        row.last_login_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(row)
        return row

    def _require_platform_permission(self, current_user: AuthenticatedUser, permission: str) -> PlatformUser:
        AccessPolicyService.ensure_permission(current_user, permission)
        actor = self._get_platform_user_by_id(current_user.user_id)
        if actor is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Platform user not found")
        return actor

    def _get_tenant(self, tenant_id: UUID) -> Tenant:
        tenant = self.db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if tenant is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
        return tenant

    def _list_tenant_feature_overrides(self, tenant_id: UUID) -> list[TenantFeatureOverride]:
        return (
            self.db.query(TenantFeatureOverride)
            .filter(TenantFeatureOverride.tenant_id == tenant_id)
            .order_by(TenantFeatureOverride.feature_key.asc())
            .all()
        )

    def _platform_actor_payload(self, current_user: AuthenticatedUser) -> tuple[PlatformUser, str]:
        actor = self._get_platform_user_by_id(current_user.user_id)
        if actor is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Platform user not found")
        actor_role = actor.platform_role or current_user.platform_role or "super_admin"
        return actor, actor_role

    def _write_platform_audit_log(
        self,
        *,
        current_user: AuthenticatedUser,
        request: Request | None,
        action: str,
        module: str,
        status_value: str = "success",
        tenant_id: UUID | None = None,
        resource_id: str | None = None,
        reason: str | None = None,
        before_value: Any = None,
        after_value: Any = None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        actor, actor_role = self._platform_actor_payload(current_user)
        self.db.add(
            PlatformAuditLog(
                actor_user_id=actor.id,
                actor_name=actor.full_name,
                actor_role=actor_role,
                tenant_id=tenant_id,
                action=action,
                module=module,
                resource_id=resource_id,
                status=status_value,
                ip_address=(request.client.host if request and request.client else None),
                user_agent=(request.headers.get("user-agent") if request else None),
                reason=reason,
                before_value=before_value,
                after_value=after_value,
                metadata_json=metadata,
            )
        )

    def _merged_platform_settings(self, payload: dict[str, Any] | None) -> dict[str, Any]:
        merged = deepcopy(DEFAULT_PLATFORM_SETTINGS)
        if not payload:
            return merged

        for section_key, section_value in payload.items():
            if isinstance(section_value, dict) and isinstance(merged.get(section_key), dict):
                merged[section_key].update(section_value)
            else:
                merged[section_key] = section_value
        return merged

    def _get_or_create_platform_settings_row(self) -> PlatformSettings:
        row = self.db.query(PlatformSettings).filter(PlatformSettings.key == PLATFORM_SETTINGS_KEY).first()
        if row is not None:
            return row

        row = PlatformSettings(key=PLATFORM_SETTINGS_KEY, payload=deepcopy(DEFAULT_PLATFORM_SETTINGS))
        self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        return row

    def get_platform_settings(self, *, current_user: AuthenticatedUser) -> dict[str, Any]:
        self._require_platform_permission(current_user, "security.manage.platform")
        row = self._get_or_create_platform_settings_row()
        return {
            "settings": self._merged_platform_settings(row.payload),
            "updated_at": row.updated_at,
            "updated_by_role": row.updated_by_role,
            "last_change_reason": row.last_change_reason,
            "sensitive_sections": sorted(SENSITIVE_PLATFORM_SETTINGS_SECTIONS),
        }

    def update_platform_settings(
        self,
        *,
        current_user: AuthenticatedUser,
        payload: dict[str, Any],
        reason: str | None,
        sensitive_confirmation: str | None,
        request: Request | None,
    ) -> dict[str, Any]:
        self._require_platform_permission(current_user, "security.manage.platform")
        if (current_user.platform_role or "").strip().lower() != "super_admin":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Super Admin users can update platform settings")

        row = self._get_or_create_platform_settings_row()
        before = self._merged_platform_settings(row.payload)
        after = self._merged_platform_settings(payload)
        changed_sections = {
            section_key
            for section_key in set(before.keys()) | set(after.keys())
            if before.get(section_key) != after.get(section_key)
        }
        sensitive_changed = sorted(changed_sections & SENSITIVE_PLATFORM_SETTINGS_SECTIONS)
        if sensitive_changed and not (sensitive_confirmation or "").strip():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Sensitive settings confirmation is required for: {', '.join(sensitive_changed)}",
            )

        row.payload = after
        row.updated_by_user_id = current_user.user_id
        row.updated_by_role = current_user.platform_role
        row.last_change_reason = reason.strip() if reason else None

        self._write_platform_audit_log(
            current_user=current_user,
            request=request,
            action="platform_settings_updated",
            module="platform_settings",
            resource_id=PLATFORM_SETTINGS_KEY,
            reason=reason.strip() if reason else sensitive_confirmation,
            before_value=before,
            after_value=after,
            metadata={"changed_sections": sorted(changed_sections), "sensitive_sections": sensitive_changed},
        )
        self.db.commit()
        self.db.refresh(row)
        return self.get_platform_settings(current_user=current_user)

    def _owner_lookup(self, tenant_ids: list[UUID]) -> dict[UUID, AdminUser]:
        if not tenant_ids:
            return {}
        rows = (
            self.db.query(AdminUser)
            .execution_options(skip_tenant_scope=True)
            .filter(AdminUser.tenant_id.in_(tenant_ids))
            .order_by(
                AdminUser.tenant_id.asc(),
                case((AdminUser.tenant_role == "owner", 0), else_=1),
                case((AdminUser.status == "active", 0), else_=1),
                AdminUser.created_at.asc(),
            )
            .all()
        )
        result: dict[UUID, AdminUser] = {}
        for row in rows:
            if row.tenant_id not in result:
                result[row.tenant_id] = row
        return result

    def _admin_counts(self, tenant_ids: list[UUID]) -> dict[UUID, int]:
        if not tenant_ids:
            return {}
        rows = (
            self.db.query(AdminUser.tenant_id, func.count(AdminUser.id))
            .execution_options(skip_tenant_scope=True)
            .filter(AdminUser.tenant_id.in_(tenant_ids))
            .group_by(AdminUser.tenant_id)
            .all()
        )
        return {tenant_id: int(count or 0) for tenant_id, count in rows}

    def _technician_counts(self, tenant_ids: list[UUID]) -> dict[UUID, int]:
        if not tenant_ids:
            return {}
        rows = (
            self.db.query(Technician.tenant_id, func.count(Technician.id))
            .execution_options(skip_tenant_scope=True)
            .filter(Technician.tenant_id.in_(tenant_ids))
            .group_by(Technician.tenant_id)
            .all()
        )
        return {tenant_id: int(count or 0) for tenant_id, count in rows}

    def _admin_last_login_map(self, tenant_ids: list[UUID]) -> dict[UUID, datetime | None]:
        if not tenant_ids:
            return {}
        rows = (
            self.db.query(AdminUser.tenant_id, func.max(AdminUser.last_login_at))
            .execution_options(skip_tenant_scope=True)
            .filter(AdminUser.tenant_id.in_(tenant_ids))
            .group_by(AdminUser.tenant_id)
            .all()
        )
        return {tenant_id: last_login for tenant_id, last_login in rows}

    def _serialize_tenant_summary(self, tenant: Tenant, owner_lookup: dict[UUID, AdminUser], admin_counts: dict[UUID, int], technician_counts: dict[UUID, int], last_login_map: dict[UUID, datetime | None]) -> dict[str, Any]:
        owner = owner_lookup.get(tenant.id)
        technicians_count = technician_counts.get(tenant.id, 0)
        admins_count = admin_counts.get(tenant.id, 0)
        return {
            "id": str(tenant.id),
            "name": tenant.name,
            "slug": tenant.slug,
            "industry_type": getattr(tenant, "industry_type", "general_services"),
            "platform_status": getattr(tenant, "platform_status", tenant.status),
            "subscription_plan": AccessPolicyService.normalize_subscription_plan(
                getattr(tenant, "subscription_plan", None) or getattr(tenant, "plan", None)
            ),
            "subscription_status": getattr(tenant, "subscription_status", "trial"),
            "owner_name": owner.full_name if owner is not None else None,
            "owner_email": owner.email if owner is not None else None,
            "users_count": admins_count + technicians_count,
            "technicians_count": technicians_count,
            "payment_failures_count": int(getattr(tenant, "payment_failures_count", 0) or 0),
            "created_at": tenant.created_at,
            "updated_at": tenant.updated_at,
            "last_login_at": last_login_map.get(tenant.id),
        }

    def get_dashboard_overview(self, current_user: AuthenticatedUser) -> dict[str, Any]:
        self._require_platform_permission(current_user, "tenant.view.all")
        tenants = self.db.query(Tenant).order_by(Tenant.updated_at.desc()).all()
        tenant_ids = [tenant.id for tenant in tenants]
        owner_lookup = self._owner_lookup(tenant_ids)
        admin_counts = self._admin_counts(tenant_ids)
        technician_counts = self._technician_counts(tenant_ids)
        last_login_map = self._admin_last_login_map(tenant_ids)

        platform_user_count = self.db.query(func.count(PlatformUser.id)).scalar() or 0
        admin_user_count = self.db.query(func.count(AdminUser.id)).execution_options(skip_tenant_scope=True).scalar() or 0
        technician_user_count = self.db.query(func.count(Technician.id)).execution_options(skip_tenant_scope=True).scalar() or 0
        audit_alert_count = (
            self.db.query(func.count(PlatformAuditLog.id))
            .filter(PlatformAuditLog.status == "failed")
            .scalar()
            or 0
        )

        metrics = {
            "total_tenants": len(tenants),
            "active_tenants": sum(1 for tenant in tenants if getattr(tenant, "platform_status", "active") == "active"),
            "suspended_tenants": sum(1 for tenant in tenants if getattr(tenant, "platform_status", "") == "suspended"),
            "trial_tenants": sum(1 for tenant in tenants if getattr(tenant, "subscription_status", "") == "trial"),
            "paid_tenants": sum(1 for tenant in tenants if getattr(tenant, "subscription_status", "") == "paid"),
            "payment_failures": sum(int(getattr(tenant, "payment_failures_count", 0) or 0) for tenant in tenants),
            "total_platform_users": int(platform_user_count + admin_user_count + technician_user_count),
            "security_alerts": int(audit_alert_count),
        }

        recent_tenant_activity = [
            self._serialize_tenant_summary(tenant, owner_lookup, admin_counts, technician_counts, last_login_map)
            for tenant in tenants[:8]
        ]

        recent_security_alerts = [
            {
                "id": str(row.id),
                "severity": row.status,
                "title": row.action.replace("_", " ").title(),
                "message": row.reason or row.module.replace("_", " ").title(),
                "tenant_id": str(row.tenant_id) if row.tenant_id else None,
                "created_at": row.created_at,
            }
            for row in (
                self.db.query(PlatformAuditLog)
                .order_by(PlatformAuditLog.created_at.desc())
                .limit(8)
                .all()
            )
        ]

        if not recent_security_alerts:
            recent_security_alerts = [
                {
                    "id": f"tenant-{tenant.id}",
                    "severity": "warning" if getattr(tenant, "payment_failures_count", 0) else "success",
                    "title": f"{tenant.name} status",
                    "message": f"{getattr(tenant, 'platform_status', 'active').replace('_', ' ').title()} / {getattr(tenant, 'subscription_status', 'trial').replace('_', ' ').title()}",
                    "tenant_id": str(tenant.id),
                    "created_at": tenant.updated_at,
                }
                for tenant in tenants[:4]
            ]

        system_health = {
            "status": "warning" if metrics["security_alerts"] or metrics["payment_failures"] else "healthy",
            "database": "connected",
            "tenant_scope": "enforced",
            "audit_pipeline": "enabled",
            "active_platform_users": int(
                self.db.query(func.count(PlatformUser.id))
                .filter(PlatformUser.status == "active")
                .scalar()
                or 0
            ),
        }

        return {
            "metrics": metrics,
            "recent_tenant_activity": recent_tenant_activity,
            "recent_security_alerts": recent_security_alerts,
            "system_health": system_health,
        }

    def list_tenants(
        self,
        *,
        current_user: AuthenticatedUser,
        search: str | None = None,
        platform_status: str | None = None,
        subscription_plan: str | None = None,
        subscription_status: str | None = None,
    ) -> list[dict[str, Any]]:
        self._require_platform_permission(current_user, "tenant.view.all")
        query = self.db.query(Tenant)
        if search:
            pattern = f"%{search.strip()}%"
            query = query.filter(or_(Tenant.name.ilike(pattern), Tenant.slug.ilike(pattern)))
        if platform_status:
            query = query.filter(Tenant.platform_status == platform_status.strip().lower())
        if subscription_plan:
            normalized_plan = AccessPolicyService.normalize_subscription_plan(subscription_plan)
            query = query.filter(Tenant.subscription_plan == normalized_plan)
        if subscription_status:
            query = query.filter(Tenant.subscription_status == subscription_status.strip().lower())

        tenants = query.order_by(Tenant.created_at.desc()).all()
        tenant_ids = [tenant.id for tenant in tenants]
        owner_lookup = self._owner_lookup(tenant_ids)
        admin_counts = self._admin_counts(tenant_ids)
        technician_counts = self._technician_counts(tenant_ids)
        last_login_map = self._admin_last_login_map(tenant_ids)
        return [
            self._serialize_tenant_summary(tenant, owner_lookup, admin_counts, technician_counts, last_login_map)
            for tenant in tenants
        ]

    def get_tenant_detail(self, *, current_user: AuthenticatedUser, tenant_id: UUID) -> dict[str, Any]:
        self._require_platform_permission(current_user, "tenant.view.all")
        tenant = self._get_tenant(tenant_id)
        owner_lookup = self._owner_lookup([tenant_id])
        admin_counts = self._admin_counts([tenant_id])
        technician_counts = self._technician_counts([tenant_id])
        last_login_map = self._admin_last_login_map([tenant_id])
        feature_overrides = self._list_tenant_feature_overrides(tenant_id)

        summary = self._serialize_tenant_summary(tenant, owner_lookup, admin_counts, technician_counts, last_login_map)
        summary.update(
            {
                "support_email": tenant.support_email,
                "billing_email": tenant.billing_email,
                "invoice_email": tenant.invoice_email,
                "notification_email": tenant.notification_email,
                "email_domain": tenant.email_domain,
                "status_lookup_enabled": tenant.status_lookup_enabled,
                "trial_ends_at": getattr(tenant, "trial_ends_at", None),
                "subscription_renewal_at": getattr(tenant, "subscription_renewal_at", None),
            }
        )

        return {
            "tenant": summary,
            "subscription": {
                "plan": summary["subscription_plan"],
                "legacy_plan": AccessPolicyService.legacy_plan_from_subscription_plan(summary["subscription_plan"]),
                "status": summary["subscription_status"],
                "payment_failures_count": summary["payment_failures_count"],
                "trial_ends_at": getattr(tenant, "trial_ends_at", None),
                "subscription_renewal_at": getattr(tenant, "subscription_renewal_at", None),
            },
            "features": AccessPolicyService.build_feature_access_map(tenant=tenant, overrides=feature_overrides),
            "break_glass_required": True,
        }

    def get_break_glass_tenant_access(
        self,
        *,
        current_user: AuthenticatedUser,
        tenant_id: UUID,
        reason: str,
        request: Request | None,
    ) -> dict[str, Any]:
        self._require_platform_permission(current_user, "breakglass.access.platform")
        tenant = self._get_tenant(tenant_id)
        normalized_reason = reason.strip()
        if not normalized_reason:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Access reason is required")

        self._write_platform_audit_log(
            current_user=current_user,
            request=request,
            action="super_admin_accessed_tenant_data",
            module="security",
            tenant_id=tenant.id,
            resource_id=str(tenant.id),
            reason=normalized_reason,
            metadata={"break_glass": True},
        )
        self.db.commit()

        admin_users = (
            self.db.query(AdminUser)
            .execution_options(skip_tenant_scope=True)
            .filter(AdminUser.tenant_id == tenant.id)
            .order_by(case((AdminUser.tenant_role == "owner", 0), else_=1), AdminUser.full_name.asc())
            .all()
        )
        technicians = (
            self.db.query(Technician)
            .execution_options(skip_tenant_scope=True)
            .filter(Technician.tenant_id == tenant.id)
            .order_by(Technician.name.asc())
            .all()
        )
        platform_logs = (
            self.db.query(PlatformAuditLog)
            .filter(PlatformAuditLog.tenant_id == tenant.id)
            .order_by(PlatformAuditLog.created_at.desc())
            .limit(25)
            .all()
        )
        tenant_logs = (
            self.db.query(AuditLog)
            .execution_options(skip_tenant_scope=True)
            .filter(AuditLog.tenant_id == tenant.id)
            .order_by(AuditLog.created_at.desc())
            .limit(25)
            .all()
        )

        return {
            "tenant_users": [
                {
                    "id": str(row.id),
                    "kind": "admin",
                    "name": row.full_name,
                    "email": row.email,
                    "role": row.tenant_role,
                    "status": row.status,
                    "last_login_at": row.last_login_at,
                    "created_at": row.created_at,
                }
                for row in admin_users
            ] + [
                {
                    "id": str(row.id),
                    "kind": "technician",
                    "name": row.full_name or row.name,
                    "email": row.email,
                    "role": "technician",
                    "status": row.status,
                    "last_login_at": row.updated_at,
                    "created_at": row.created_at,
                }
                for row in technicians
            ],
            "billing_status": {
                "plan": AccessPolicyService.normalize_subscription_plan(getattr(tenant, "subscription_plan", None) or tenant.plan),
                "status": getattr(tenant, "subscription_status", "trial"),
                "payment_failures_count": int(getattr(tenant, "payment_failures_count", 0) or 0),
                "billing_email": tenant.billing_email,
                "invoice_email": tenant.invoice_email,
                "trial_ends_at": getattr(tenant, "trial_ends_at", None),
                "subscription_renewal_at": getattr(tenant, "subscription_renewal_at", None),
            },
            "audit_logs": [
                {
                    "id": str(row.id),
                    "source": "platform",
                    "actor": row.actor_name,
                    "role": row.actor_role,
                    "action": row.action,
                    "module": row.module,
                    "status": row.status,
                    "reason": row.reason,
                    "created_at": row.created_at,
                }
                for row in platform_logs
            ] + [
                {
                    "id": str(row.id),
                    "source": "tenant",
                    "actor": str(row.actor_id),
                    "role": row.actor_role,
                    "action": row.action,
                    "module": row.entity_type,
                    "status": "success",
                    "reason": None,
                    "created_at": row.created_at,
                }
                for row in tenant_logs
            ],
            "security_activity": [
                {
                    "id": str(row.id),
                    "title": row.action.replace("_", " ").title(),
                    "severity": row.status,
                    "message": row.reason or row.module.replace("_", " ").title(),
                    "created_at": row.created_at,
                }
                for row in platform_logs[:10]
            ],
        }

    def update_tenant_profile(
        self,
        *,
        current_user: AuthenticatedUser,
        tenant_id: UUID,
        payload: dict[str, Any],
        request: Request | None,
    ) -> dict[str, Any]:
        self._require_platform_permission(current_user, "tenant.update.platform")
        tenant = self._get_tenant(tenant_id)
        before = {
            "name": tenant.name,
            "industry_type": getattr(tenant, "industry_type", None),
            "support_email": tenant.support_email,
            "billing_email": tenant.billing_email,
            "invoice_email": tenant.invoice_email,
            "notification_email": tenant.notification_email,
        }

        if payload.get("name"):
            tenant.name = str(payload["name"]).strip()
        if payload.get("industry_type"):
            tenant.industry_type = str(payload["industry_type"]).strip().lower()
        for field_name in ("support_email", "billing_email", "invoice_email", "notification_email"):
            if field_name in payload:
                value = payload.get(field_name)
                setattr(tenant, field_name, str(value).strip().lower() if value else None)

        self._write_platform_audit_log(
            current_user=current_user,
            request=request,
            action="tenant_profile_updated",
            module="tenant_management",
            tenant_id=tenant.id,
            resource_id=str(tenant.id),
            before_value=before,
            after_value={
                "name": tenant.name,
                "industry_type": tenant.industry_type,
                "support_email": tenant.support_email,
                "billing_email": tenant.billing_email,
                "invoice_email": tenant.invoice_email,
                "notification_email": tenant.notification_email,
            },
        )
        self.db.commit()
        return self.get_tenant_detail(current_user=current_user, tenant_id=tenant_id)

    def change_tenant_status(
        self,
        *,
        current_user: AuthenticatedUser,
        tenant_id: UUID,
        status_value: str,
        reason: str | None,
        request: Request | None,
    ) -> dict[str, Any]:
        normalized_status = AccessPolicyService.normalize_tenant_status(status_value)
        if normalized_status == "archived":
            self._require_platform_permission(current_user, "tenant.archive.platform")
        elif normalized_status in {"suspended", "blocked"}:
            self._require_platform_permission(current_user, "tenant.suspend.platform")
        else:
            self._require_platform_permission(current_user, "tenant.update.platform")

        tenant = self._get_tenant(tenant_id)
        before = {
            "platform_status": getattr(tenant, "platform_status", None),
            "status": tenant.status,
        }
        tenant.platform_status = normalized_status
        tenant.status = "suspended" if normalized_status in {"suspended", "archived", "blocked"} else "active"
        now = datetime.now(timezone.utc)
        tenant.suspended_at = now if normalized_status in {"suspended", "blocked"} else None
        tenant.archived_at = now if normalized_status == "archived" else None

        self._write_platform_audit_log(
            current_user=current_user,
            request=request,
            action=f"tenant_{normalized_status}",
            module="tenant_management",
            tenant_id=tenant.id,
            resource_id=str(tenant.id),
            reason=reason.strip() if reason else None,
            before_value=before,
            after_value={"platform_status": tenant.platform_status, "status": tenant.status},
        )
        self.db.commit()
        return self.get_tenant_detail(current_user=current_user, tenant_id=tenant_id)

    def change_tenant_plan(
        self,
        *,
        current_user: AuthenticatedUser,
        tenant_id: UUID,
        subscription_plan: str,
        subscription_status: str | None,
        reason: str | None,
        request: Request | None,
    ) -> dict[str, Any]:
        self._require_platform_permission(current_user, "billing.manage.platform")
        tenant = self._get_tenant(tenant_id)
        normalized_plan = AccessPolicyService.normalize_subscription_plan(subscription_plan)
        normalized_status = (subscription_status or getattr(tenant, "subscription_status", "trial")).strip().lower()
        before = {
            "subscription_plan": getattr(tenant, "subscription_plan", None),
            "subscription_status": getattr(tenant, "subscription_status", None),
            "plan": tenant.plan,
        }
        tenant.subscription_plan = normalized_plan
        tenant.subscription_status = normalized_status
        tenant.plan = AccessPolicyService.legacy_plan_from_subscription_plan(normalized_plan)
        self._write_platform_audit_log(
            current_user=current_user,
            request=request,
            action="tenant_plan_changed",
            module="billing",
            tenant_id=tenant.id,
            resource_id=str(tenant.id),
            reason=reason.strip() if reason else None,
            before_value=before,
            after_value={
                "subscription_plan": tenant.subscription_plan,
                "subscription_status": tenant.subscription_status,
                "plan": tenant.plan,
            },
        )
        self.db.commit()
        return self.get_tenant_detail(current_user=current_user, tenant_id=tenant_id)

    def update_tenant_feature_overrides(
        self,
        *,
        current_user: AuthenticatedUser,
        tenant_id: UUID,
        entries: list[dict[str, Any]],
        reason: str | None,
        request: Request | None,
    ) -> dict[str, Any]:
        self._require_platform_permission(current_user, "features.manage.platform")
        tenant = self._get_tenant(tenant_id)
        existing = {row.feature_key: row for row in self._list_tenant_feature_overrides(tenant_id)}
        normalized_reason = reason.strip() if reason else None
        updated_rows: list[dict[str, Any]] = []
        for entry in entries:
            feature_key = str(entry.get("feature_key", "")).strip().lower()
            if not feature_key:
                continue
            row = existing.get(feature_key)
            enabled = bool(entry.get("is_enabled"))
            entry_reason = str(entry.get("reason")).strip() if entry.get("reason") else normalized_reason
            if row is None:
                row = TenantFeatureOverride(
                    tenant_id=tenant.id,
                    feature_key=feature_key,
                    is_enabled=enabled,
                    reason=entry_reason,
                    updated_by_user_id=current_user.user_id,
                    updated_by_role=current_user.platform_role,
                )
                self.db.add(row)
            else:
                row.is_enabled = enabled
                row.reason = entry_reason
                row.updated_by_user_id = current_user.user_id
                row.updated_by_role = current_user.platform_role
            updated_rows.append({"feature_key": feature_key, "is_enabled": enabled, "reason": entry_reason})

        self._write_platform_audit_log(
            current_user=current_user,
            request=request,
            action="tenant_features_updated",
            module="feature_access",
            tenant_id=tenant.id,
            resource_id=str(tenant.id),
            reason=normalized_reason,
            after_value={"entries": updated_rows},
        )
        self.db.commit()
        return {
            "tenant_id": str(tenant.id),
            "features": AccessPolicyService.build_feature_access_map(
                tenant=tenant,
                overrides=self._list_tenant_feature_overrides(tenant.id),
            ),
        }

    def list_platform_audit_logs(
        self,
        *,
        current_user: AuthenticatedUser,
        tenant_id: UUID | None = None,
        module: str | None = None,
        status_value: str | None = None,
        query: str | None = None,
    ) -> list[dict[str, Any]]:
        self._require_platform_permission(current_user, "audit.view.platform")
        rows = self.db.query(PlatformAuditLog)
        if tenant_id is not None:
            rows = rows.filter(PlatformAuditLog.tenant_id == tenant_id)
        if module:
            rows = rows.filter(PlatformAuditLog.module == module.strip().lower())
        if status_value:
            rows = rows.filter(PlatformAuditLog.status == status_value.strip().lower())
        if query:
            pattern = f"%{query.strip()}%"
            rows = rows.filter(
                or_(
                    PlatformAuditLog.action.ilike(pattern),
                    PlatformAuditLog.actor_name.ilike(pattern),
                    PlatformAuditLog.reason.ilike(pattern),
                )
            )
        result = rows.order_by(PlatformAuditLog.created_at.desc()).limit(200).all()
        return [
            {
                "id": str(row.id),
                "actor_name": row.actor_name,
                "actor_role": row.actor_role,
                "tenant_id": str(row.tenant_id) if row.tenant_id else None,
                "action": row.action,
                "module": row.module,
                "status": row.status,
                "reason": row.reason,
                "resource_id": row.resource_id,
                "created_at": row.created_at,
            }
            for row in result
        ]

    def get_access_policy_catalog(self, *, current_user: AuthenticatedUser) -> dict[str, Any]:
        self._require_platform_permission(current_user, "audit.view.platform")
        return {
            "feature_catalog": AccessPolicyService.feature_catalog(),
            "plan_matrix": {
                plan: sorted(features)
                for plan, features in PLAN_FEATURE_MATRIX.items()
            },
            "platform_roles": AccessPolicyService.platform_permissions_payload(),
            "tenant_roles": AccessPolicyService.tenant_permissions_payload(),
            "validation_flow": [
                "User is authenticated.",
                "User account is active.",
                "Tenant is active.",
                "User belongs to the requested tenant.",
                "User role is valid.",
                "User has required permission.",
                "Tenant has required feature enabled.",
                "User owns or is allowed to access the requested resource.",
                "Sensitive actions are logged.",
            ],
            "default_access": "denied",
        }

    def validate_access_scenario(
        self,
        *,
        current_user: AuthenticatedUser,
        tenant_id: UUID,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        self._require_platform_permission(current_user, "audit.view.platform")
        tenant = self._get_tenant(tenant_id)
        overrides = self._list_tenant_feature_overrides(tenant_id)
        requested_tenant_id = payload.get("requested_tenant_id")
        resource_tenant_id = payload.get("resource_tenant_id")
        requested_user_id = str(payload.get("requested_user_id") or "")
        resource_owner_user_id = str(payload.get("resource_owner_user_id") or "")
        feature_key = str(payload.get("feature_key") or "").strip().lower()
        tenant_role = str(payload.get("tenant_role") or "").strip().lower()
        permission = str(payload.get("permission") or "").strip()

        permissions = AccessPolicyService.get_tenant_permissions(tenant_role)
        steps = [
            {"label": "User authenticated", "allowed": True},
            {"label": "Tenant active", "allowed": AccessPolicyService.is_tenant_accessible(getattr(tenant, "platform_status", None) or tenant.status)},
            {"label": "Tenant match", "allowed": not requested_tenant_id or not resource_tenant_id or requested_tenant_id == resource_tenant_id},
            {"label": "Role valid", "allowed": bool(tenant_role and permissions)},
            {"label": "Permission granted", "allowed": bool(permission and permission in permissions)},
            {"label": "Feature enabled", "allowed": bool(not feature_key or AccessPolicyService.feature_is_enabled(tenant=tenant, feature_key=feature_key, overrides=overrides))},
            {"label": "Resource ownership", "allowed": bool(not resource_owner_user_id or not requested_user_id or resource_owner_user_id == requested_user_id)},
        ]
        return {
            "allowed": all(step["allowed"] for step in steps),
            "steps": steps,
            "tenant_status": getattr(tenant, "platform_status", tenant.status),
            "effective_features": AccessPolicyService.build_feature_access_map(tenant=tenant, overrides=overrides),
        }

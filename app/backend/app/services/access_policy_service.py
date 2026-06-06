from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from fastapi import HTTPException, status

from ..core.enums import UserRole
from ..core.security import AuthenticatedUser


FEATURE_CATALOG: list[dict[str, str]] = [
    {"key": "dashboard", "label": "Dashboard", "description": "Tenant-level operational overview."},
    {"key": "customer_requests", "label": "Customer Requests", "description": "Public intake, booking, and request queue access."},
    {"key": "jobs_work_orders", "label": "Jobs / Work Orders", "description": "Dispatch jobs, work orders, and execution workflow."},
    {"key": "scheduling", "label": "Scheduling", "description": "Shift planning, job scheduling, and availability tooling."},
    {"key": "technicians", "label": "Technicians", "description": "Technician roster, assignment, and management workflows."},
    {"key": "customers", "label": "Customers", "description": "Customer and location records."},
    {"key": "invoicing", "label": "Invoicing", "description": "Invoice creation, approvals, and ledger management."},
    {"key": "payment_collection", "label": "Payment Collection", "description": "Payment capture and receivables operations."},
    {"key": "chatter", "label": "Chatter", "description": "Internal messaging and collaboration workflows."},
    {"key": "voice_messages", "label": "Voice Messages", "description": "Voice-note messaging features."},
    {"key": "notifications", "label": "Notifications", "description": "Operational alerts and outbound notifications."},
    {"key": "reports", "label": "Reports", "description": "Analytics, KPIs, and reporting surfaces."},
    {"key": "integrations", "label": "Integrations", "description": "Third-party system integrations."},
    {"key": "api_access", "label": "API Access", "description": "Programmatic API and webhook access."},
    {"key": "custom_branding", "label": "Custom Branding", "description": "White-label branding and identity customization."},
]

PLAN_FEATURE_MATRIX: dict[str, set[str]] = {
    "basic": {
        "dashboard",
        "customer_requests",
        "jobs_work_orders",
        "technicians",
        "customers",
        "invoicing",
    },
    "pro": {
        "dashboard",
        "customer_requests",
        "jobs_work_orders",
        "scheduling",
        "technicians",
        "customers",
        "invoicing",
        "payment_collection",
        "chatter",
        "voice_messages",
        "notifications",
        "reports",
    },
    "enterprise": {item["key"] for item in FEATURE_CATALOG},
}

PLATFORM_ROLE_PERMISSIONS: dict[str, set[str]] = {
    "super_admin": {
        "tenant.view.all",
        "tenant.create.platform",
        "tenant.update.platform",
        "tenant.suspend.platform",
        "tenant.archive.platform",
        "users.view.platform",
        "users.manage.platform",
        "roles.manage.platform",
        "features.manage.platform",
        "billing.manage.platform",
        "security.manage.platform",
        "audit.view.platform",
        "breakglass.access.platform",
    },
    "platform_support": {
        "tenant.view.all",
        "tenant.update.platform",
        "users.view.platform",
        "features.manage.platform",
    },
    "billing_admin": {
        "tenant.view.all",
        "billing.manage.platform",
        "audit.view.platform",
    },
    "security_admin": {
        "tenant.view.all",
        "security.manage.platform",
        "audit.view.platform",
        "breakglass.access.platform",
    },
    "read_only_auditor": {
        "tenant.view.all",
        "audit.view.platform",
    },
}

TENANT_ROLE_PERMISSIONS: dict[str, set[str]] = {
    "owner": {
        "tenant.view.tenant",
        "tenant.update.tenant",
        "users.view.tenant",
        "users.create.tenant",
        "users.update.tenant",
        "users.delete.tenant",
        "roles.assign.tenant",
        "jobs.view.tenant",
        "jobs.create.tenant",
        "jobs.update.tenant",
        "jobs.assign.tenant",
        "jobs.delete.tenant",
        "technicians.view.tenant",
        "technicians.create.tenant",
        "technicians.update.tenant",
        "technicians.delete.tenant",
        "invoices.view.tenant",
        "invoices.create.tenant",
        "invoices.update.tenant",
        "payments.view.tenant",
        "payments.refund.tenant",
        "chatter.view.tenant",
        "chatter.send.tenant",
        "chatter.moderate.tenant",
        "audit.view.tenant",
    },
    "admin": {
        "tenant.view.tenant",
        "users.view.tenant",
        "users.create.tenant",
        "users.update.tenant",
        "jobs.view.tenant",
        "jobs.create.tenant",
        "jobs.update.tenant",
        "jobs.assign.tenant",
        "technicians.view.tenant",
        "technicians.update.tenant",
        "invoices.view.tenant",
        "invoices.create.tenant",
        "invoices.update.tenant",
        "payments.view.tenant",
        "chatter.view.tenant",
        "chatter.send.tenant",
        "audit.view.tenant",
    },
    "dispatcher": {
        "tenant.view.tenant",
        "jobs.view.tenant",
        "jobs.create.tenant",
        "jobs.update.tenant",
        "jobs.assign.tenant",
        "technicians.view.tenant",
        "chatter.view.tenant",
        "chatter.send.tenant",
    },
    "technician": {
        "jobs.view.own",
        "jobs.update.own",
        "chatter.view.tenant",
        "chatter.send.tenant",
        "technicians.view.self",
    },
    "accountant": {
        "invoices.view.tenant",
        "invoices.create.tenant",
        "invoices.update.tenant",
        "payments.view.tenant",
        "payments.refund.tenant",
    },
    "customer_support": {
        "customer_requests.view.tenant",
        "customer_requests.update.tenant",
        "chatter.view.tenant",
        "chatter.send.tenant",
        "customers.view.tenant",
    },
    "customer": {
        "customer_requests.view.own",
        "jobs.view.own",
        "invoices.view.own",
        "chatter.view.own",
    },
    "viewer": {
        "tenant.view.tenant",
        "jobs.view.tenant",
        "technicians.view.tenant",
        "invoices.view.tenant",
        "audit.view.tenant",
    },
}

ALLOWED_TENANT_ACCESS_STATUSES = {"active", "trial", "payment_pending"}
BLOCKED_TENANT_ACCESS_STATUSES = {"suspended", "archived", "blocked"}

LEGACY_PLAN_TO_SUBSCRIPTION_PLAN = {
    "starter": "basic",
    "growth": "pro",
    "enterprise": "enterprise",
    "basic": "basic",
    "pro": "pro",
}

SUBSCRIPTION_PLAN_TO_LEGACY_PLAN = {
    "basic": "starter",
    "pro": "growth",
    "enterprise": "enterprise",
}


class AccessPolicyService:
    @staticmethod
    def normalize_subscription_plan(value: str | None) -> str:
        raw = (value or "").strip().lower()
        return LEGACY_PLAN_TO_SUBSCRIPTION_PLAN.get(raw, "pro")

    @staticmethod
    def legacy_plan_from_subscription_plan(value: str | None) -> str:
        normalized = AccessPolicyService.normalize_subscription_plan(value)
        return SUBSCRIPTION_PLAN_TO_LEGACY_PLAN.get(normalized, "growth")

    @staticmethod
    def normalize_tenant_status(value: str | None) -> str:
        normalized = (value or "").strip().lower()
        if normalized in ALLOWED_TENANT_ACCESS_STATUSES or normalized in BLOCKED_TENANT_ACCESS_STATUSES:
            return normalized
        if normalized == "active":
            return "active"
        if normalized == "suspended":
            return "suspended"
        return "active"

    @staticmethod
    def is_tenant_accessible(status_value: str | None) -> bool:
        return AccessPolicyService.normalize_tenant_status(status_value) in ALLOWED_TENANT_ACCESS_STATUSES

    @staticmethod
    def feature_catalog() -> list[dict[str, str]]:
        return [dict(item) for item in FEATURE_CATALOG]

    @staticmethod
    def get_plan_features(subscription_plan: str | None) -> set[str]:
        normalized = AccessPolicyService.normalize_subscription_plan(subscription_plan)
        return set(PLAN_FEATURE_MATRIX.get(normalized, PLAN_FEATURE_MATRIX["pro"]))

    @staticmethod
    def get_platform_permissions(platform_role: str | None) -> set[str]:
        normalized = (platform_role or "").strip().lower()
        return set(PLATFORM_ROLE_PERMISSIONS.get(normalized, set()))

    @staticmethod
    def get_tenant_permissions(tenant_role: str | None) -> set[str]:
        normalized = (tenant_role or "").strip().lower()
        return set(TENANT_ROLE_PERMISSIONS.get(normalized, set()))

    @staticmethod
    def get_user_permissions(current_user: AuthenticatedUser) -> set[str]:
        if current_user.role == UserRole.SUPER_ADMIN:
            return AccessPolicyService.get_platform_permissions(current_user.platform_role)
        if current_user.role == UserRole.ADMIN:
            return AccessPolicyService.get_tenant_permissions(current_user.tenant_role)
        if current_user.role == UserRole.TECHNICIAN:
            return AccessPolicyService.get_tenant_permissions("technician")
        return set()

    @staticmethod
    def ensure_permission(current_user: AuthenticatedUser, permission: str) -> None:
        permissions = AccessPolicyService.get_user_permissions(current_user)
        if permission not in permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions for this resource",
            )

    @staticmethod
    def build_feature_access_map(
        *,
        tenant: Any,
        overrides: Iterable[Any] | None = None,
    ) -> list[dict[str, Any]]:
        override_lookup = {
            str(getattr(item, "feature_key", "")).strip().lower(): item
            for item in (overrides or [])
            if getattr(item, "feature_key", None)
        }
        tenant_flags = getattr(tenant, "feature_flags", None)
        tenant_flags = tenant_flags if isinstance(tenant_flags, dict) else {}
        plan = AccessPolicyService.normalize_subscription_plan(
            getattr(tenant, "subscription_plan", None) or getattr(tenant, "plan", None)
        )
        plan_features = AccessPolicyService.get_plan_features(plan)
        rows: list[dict[str, Any]] = []
        for feature in FEATURE_CATALOG:
            key = feature["key"]
            included_by_plan = key in plan_features
            tenant_flag = tenant_flags.get(key)
            if isinstance(tenant_flag, bool):
                enabled = tenant_flag
                source = "tenant_flag"
            else:
                enabled = included_by_plan
                source = "plan"

            override = override_lookup.get(key)
            if override is not None:
                enabled = bool(getattr(override, "is_enabled", False))
                source = "manual_override"

            rows.append(
                {
                    "key": key,
                    "label": feature["label"],
                    "description": feature["description"],
                    "included_by_plan": included_by_plan,
                    "enabled": enabled,
                    "source": source,
                    "override": (
                        {
                            "is_enabled": bool(getattr(override, "is_enabled", False)),
                            "reason": getattr(override, "reason", None),
                            "updated_at": getattr(override, "updated_at", None),
                        }
                        if override is not None
                        else None
                    ),
                }
            )
        return rows

    @staticmethod
    def feature_is_enabled(
        *,
        tenant: Any,
        feature_key: str,
        overrides: Iterable[Any] | None = None,
    ) -> bool:
        normalized_key = feature_key.strip().lower()
        for row in AccessPolicyService.build_feature_access_map(tenant=tenant, overrides=overrides):
            if row["key"] == normalized_key:
                return bool(row["enabled"])
        return False

    @staticmethod
    def platform_permissions_payload() -> list[dict[str, Any]]:
        return [
            {"role": role, "permissions": sorted(permissions)}
            for role, permissions in PLATFORM_ROLE_PERMISSIONS.items()
        ]

    @staticmethod
    def tenant_permissions_payload() -> list[dict[str, Any]]:
        return [
            {"role": role, "permissions": sorted(permissions)}
            for role, permissions in TENANT_ROLE_PERMISSIONS.items()
        ]


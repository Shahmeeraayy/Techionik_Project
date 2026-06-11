from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

from ..services.tenant_email_identity import normalize_email_address, normalize_email_domain


class SuperAdminTenantProfileUpdatePayload(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    industry_type: str | None = Field(default=None, min_length=2, max_length=64)
    email_domain: str | None = Field(default=None, max_length=255)
    support_email: EmailStr | None = None
    billing_email: EmailStr | None = None
    invoice_email: EmailStr | None = None
    notification_email: EmailStr | None = None

    @field_validator("name", "industry_type")
    @classmethod
    def _normalize_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None

    @field_validator("email_domain")
    @classmethod
    def _normalize_email_domain(cls, value: str | None) -> str | None:
        return normalize_email_domain(value)

    @field_validator("support_email", "billing_email", "invoice_email", "notification_email")
    @classmethod
    def _normalize_optional_email(cls, value: EmailStr | None) -> str | None:
        if value is None:
            return None
        return normalize_email_address(str(value))


class SuperAdminTenantNotificationSettingsPayload(BaseModel):
    email_notifications_enabled: bool = True
    in_app_notifications_enabled: bool = True
    browser_push_notifications_enabled: bool = True
    invoice_notifications_enabled: bool = True
    reason: str | None = Field(default=None, max_length=1000)

    @field_validator("reason")
    @classmethod
    def _normalize_reason(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class SuperAdminTenantNotificationSettingsResponse(BaseModel):
    tenant_id: str
    email_notifications_enabled: bool
    in_app_notifications_enabled: bool
    browser_push_notifications_enabled: bool
    invoice_notifications_enabled: bool


class SuperAdminTenantStatusUpdatePayload(BaseModel):
    status: Literal["active", "trial", "payment_pending", "suspended", "archived", "blocked"]
    reason: str | None = Field(default=None, max_length=1000)

    @field_validator("reason")
    @classmethod
    def _normalize_reason(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class SuperAdminTenantPlanUpdatePayload(BaseModel):
    subscription_plan: Literal["basic", "pro", "enterprise"]
    subscription_status: Literal["trial", "paid", "payment_pending", "past_due", "cancelled", "failed"] | None = None
    reason: str | None = Field(default=None, max_length=1000)

    @field_validator("reason")
    @classmethod
    def _normalize_reason(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class SuperAdminFeatureOverrideEntryPayload(BaseModel):
    feature_key: str = Field(..., min_length=2, max_length=64)
    is_enabled: bool
    reason: str | None = Field(default=None, max_length=1000)

    @field_validator("feature_key")
    @classmethod
    def _normalize_feature_key(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not normalized:
            raise ValueError("feature_key cannot be blank")
        return normalized

    @field_validator("reason")
    @classmethod
    def _normalize_reason(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class SuperAdminTenantFeatureUpdatePayload(BaseModel):
    entries: list[SuperAdminFeatureOverrideEntryPayload]
    reason: str | None = Field(default=None, max_length=1000)

    @field_validator("reason")
    @classmethod
    def _normalize_reason(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class SuperAdminBreakGlassPayload(BaseModel):
    reason: str = Field(..., min_length=3, max_length=1000)

    @field_validator("reason")
    @classmethod
    def _normalize_reason(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("reason cannot be blank")
        return normalized


class SuperAdminAccessValidationPayload(BaseModel):
    requested_tenant_id: str | None = None
    resource_tenant_id: str | None = None
    requested_user_id: str | None = None
    resource_owner_user_id: str | None = None
    tenant_role: str = Field(..., min_length=2, max_length=64)
    permission: str = Field(..., min_length=2, max_length=128)
    feature_key: str | None = Field(default=None, max_length=64)

    @field_validator("tenant_role", "permission", "feature_key", "requested_tenant_id", "resource_tenant_id", "requested_user_id", "resource_owner_user_id")
    @classmethod
    def _normalize_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip().lower()
        return normalized or None


class SuperAdminPlatformSettingsUpdatePayload(BaseModel):
    settings: dict[str, Any]
    reason: str | None = Field(default=None, max_length=1000)
    sensitive_confirmation: str | None = Field(default=None, max_length=1000)

    @field_validator("reason", "sensitive_confirmation")
    @classmethod
    def _normalize_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None

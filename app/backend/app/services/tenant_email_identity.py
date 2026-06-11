from __future__ import annotations

from urllib.parse import urlparse
from uuid import UUID

from sqlalchemy import inspect, text
from sqlalchemy.orm import Session
from pydantic import EmailStr, TypeAdapter

from ..core.config import EMAIL_ENABLED, EMAIL_FROM_DOMAIN
from ..models.tenant import Tenant


_EMAIL_ADDRESS_ADAPTER = TypeAdapter(EmailStr)

TENANT_EMAIL_COLUMNS = {
    "email_domain": "VARCHAR(255)",
    "support_email": "VARCHAR(255)",
    "billing_email": "VARCHAR(255)",
    "invoice_email": "VARCHAR(255)",
    "notification_email": "VARCHAR(255)",
    "email_verified": "BOOLEAN DEFAULT false NOT NULL",
    "email_sending_status": "VARCHAR(32) DEFAULT 'demo' NOT NULL",
}


def _default_email_domain_for_slug(slug: str) -> str:
    return f"{slug.strip().lower()}.{EMAIL_FROM_DOMAIN.strip().lower() or 'nexusops.app'}"


def normalize_email_domain(value: str | None) -> str | None:
    if value is None:
        return None

    normalized = value.strip().lower()
    if not normalized:
        return None

    if "://" in normalized:
        parsed = urlparse(normalized)
        normalized = parsed.hostname or ""
    else:
        normalized = normalized.split("/", 1)[0]
        normalized = normalized.split("?", 1)[0]
        normalized = normalized.split("#", 1)[0]

    normalized = normalized.strip().strip(".")
    if normalized.startswith("www."):
        normalized = normalized[4:]
    if not normalized:
        raise ValueError("Email domain cannot be blank")

    try:
        _EMAIL_ADDRESS_ADAPTER.validate_python(f"tenant@{normalized}")
    except Exception as exc:  # pragma: no cover - defensive validation guard
        raise ValueError("Email domain is invalid") from exc
    return normalized


def normalize_email_address(value: str | None) -> str | None:
    if value is None:
        return None

    normalized = value.strip().lower()
    if not normalized:
        return None
    return str(_EMAIL_ADDRESS_ADAPTER.validate_python(normalized)).lower()


def ensure_tenant_email_columns(db: Session) -> None:
    bind = db.get_bind()
    existing_columns = {column["name"] for column in inspect(bind).get_columns("tenants")}
    missing = [(name, definition) for name, definition in TENANT_EMAIL_COLUMNS.items() if name not in existing_columns]
    if not missing:
        return

    for column_name, column_definition in missing:
        db.execute(text(f"ALTER TABLE tenants ADD COLUMN {column_name} {column_definition}"))
    db.commit()


def build_email_identity_for_slug(slug: str, email_domain: str | None = None) -> dict[str, str]:
    domain = normalize_email_domain(email_domain) or _default_email_domain_for_slug(slug)
    return {
        "email_domain": domain,
        "support_email": f"support@{domain}",
        "billing_email": f"billing@{domain}",
        "invoice_email": f"invoices@{domain}",
        "notification_email": f"notifications@{domain}",
    }


def ensure_tenant_email_identity(db: Session, tenant: Tenant) -> Tenant:
    try:
        identity = build_email_identity_for_slug(tenant.slug, tenant.email_domain)
    except ValueError:
        identity = build_email_identity_for_slug(tenant.slug)
    changed = False
    for key, value in identity.items():
        if not getattr(tenant, key, None):
            setattr(tenant, key, value)
            changed = True
    if not getattr(tenant, "email_sending_status", None):
        tenant.email_sending_status = "enabled" if EMAIL_ENABLED else "disabled"
        changed = True
    if changed:
        db.flush()
    return tenant


def load_tenant_email_identity(db: Session, tenant_id: UUID) -> Tenant | None:
    ensure_tenant_email_columns(db)
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if tenant is None:
        return None
    ensure_tenant_email_identity(db, tenant)
    return tenant


def serialize_tenant_email_identity(tenant: Tenant) -> dict[str, object]:
    return {
        "tenant_id": str(tenant.id),
        "company_name": tenant.name,
        "tenant_slug": tenant.slug,
        "support_email": tenant.support_email,
        "billing_email": tenant.billing_email,
        "invoice_email": tenant.invoice_email,
        "notification_email": tenant.notification_email,
        "email_domain": tenant.email_domain,
        "email_sending_status": tenant.email_sending_status,
        "email_verified": bool(tenant.email_verified),
    }


def apply_tenant_email_identity_update(
    tenant: Tenant,
    payload: dict[str, object],
) -> tuple[dict[str, object], dict[str, object]]:
    before = serialize_tenant_email_identity(tenant)
    try:
        previous_domain = normalize_email_domain(str(before["email_domain"]) if before["email_domain"] else None)
    except ValueError:
        previous_domain = None
    previous_domain = previous_domain or _default_email_domain_for_slug(tenant.slug)
    before_generated = build_email_identity_for_slug(tenant.slug, previous_domain)

    domain_changed = False
    if "email_domain" in payload:
        next_domain = normalize_email_domain(payload.get("email_domain") if isinstance(payload.get("email_domain"), str) else None)
        tenant.email_domain = next_domain
        domain_changed = next_domain != previous_domain

    try:
        current_domain = normalize_email_domain(tenant.email_domain)
    except ValueError:
        current_domain = None
    generated_after = build_email_identity_for_slug(
        tenant.slug,
        tenant.email_domain if domain_changed else current_domain,
    )
    for field_name in ("support_email", "billing_email", "invoice_email", "notification_email"):
        if field_name in payload:
            raw_value = payload.get(field_name)
            normalized_value = normalize_email_address(raw_value if isinstance(raw_value, str) else None)
            if domain_changed and normalized_value == before_generated[field_name]:
                normalized_value = generated_after[field_name]
            setattr(tenant, field_name, normalized_value)
        elif domain_changed:
            current_value = getattr(tenant, field_name, None)
            if not current_value or current_value == before_generated[field_name]:
                setattr(tenant, field_name, generated_after[field_name])

    after = serialize_tenant_email_identity(tenant)
    return before, after


def get_tenant_email_identity(db: Session, tenant_id: UUID) -> dict[str, object] | None:
    tenant = load_tenant_email_identity(db, tenant_id)
    if tenant is None:
        return None
    db.commit()
    db.refresh(tenant)
    return serialize_tenant_email_identity(tenant)

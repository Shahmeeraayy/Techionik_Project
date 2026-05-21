from __future__ import annotations

from uuid import UUID

from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from ..core.config import EMAIL_ENABLED, EMAIL_FROM_DOMAIN
from ..models.tenant import Tenant


TENANT_EMAIL_COLUMNS = {
    "email_domain": "VARCHAR(255)",
    "support_email": "VARCHAR(255)",
    "billing_email": "VARCHAR(255)",
    "invoice_email": "VARCHAR(255)",
    "notification_email": "VARCHAR(255)",
    "email_verified": "BOOLEAN DEFAULT false NOT NULL",
    "email_sending_status": "VARCHAR(32) DEFAULT 'demo' NOT NULL",
}


def ensure_tenant_email_columns(db: Session) -> None:
    bind = db.get_bind()
    existing_columns = {column["name"] for column in inspect(bind).get_columns("tenants")}
    missing = [(name, definition) for name, definition in TENANT_EMAIL_COLUMNS.items() if name not in existing_columns]
    if not missing:
        return

    for column_name, column_definition in missing:
        db.execute(text(f"ALTER TABLE tenants ADD COLUMN {column_name} {column_definition}"))
    db.commit()


def build_email_identity_for_slug(slug: str) -> dict[str, str]:
    domain = f"{slug.strip().lower()}.{EMAIL_FROM_DOMAIN.strip().lower() or 'nexusops.app'}"
    return {
        "email_domain": domain,
        "support_email": f"support@{domain}",
        "billing_email": f"billing@{domain}",
        "invoice_email": f"invoices@{domain}",
        "notification_email": f"notifications@{domain}",
    }


def ensure_tenant_email_identity(db: Session, tenant: Tenant) -> Tenant:
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


def get_tenant_email_identity(db: Session, tenant_id: UUID) -> dict[str, object] | None:
    ensure_tenant_email_columns(db)
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if tenant is None:
        return None
    ensure_tenant_email_identity(db, tenant)
    db.commit()
    db.refresh(tenant)
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

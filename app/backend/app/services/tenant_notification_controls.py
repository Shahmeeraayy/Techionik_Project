from __future__ import annotations

from uuid import UUID

from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from ..models.tenant import Tenant


TENANT_NOTIFICATION_COLUMNS = {
    "email_notifications_enabled": "BOOLEAN DEFAULT true NOT NULL",
    "in_app_notifications_enabled": "BOOLEAN DEFAULT true NOT NULL",
    "browser_push_notifications_enabled": "BOOLEAN DEFAULT true NOT NULL",
    "invoice_notifications_enabled": "BOOLEAN DEFAULT true NOT NULL",
}


def ensure_tenant_notification_columns(db: Session) -> None:
    bind = db.get_bind()
    if bind is None:
        return

    existing_columns = {column["name"] for column in inspect(bind).get_columns("tenants")}
    missing = [(name, definition) for name, definition in TENANT_NOTIFICATION_COLUMNS.items() if name not in existing_columns]
    if not missing:
        return

    for column_name, column_definition in missing:
        db.execute(text(f"ALTER TABLE tenants ADD COLUMN {column_name} {column_definition}"))
    db.commit()


def load_tenant_notification_settings(db: Session, tenant_id: UUID) -> Tenant | None:
    ensure_tenant_notification_columns(db)
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if tenant is None:
        return None
    changed = False
    for field_name in TENANT_NOTIFICATION_COLUMNS:
        if getattr(tenant, field_name, None) is None:
            setattr(tenant, field_name, True)
            changed = True
    if changed:
        db.flush()
    return tenant


def serialize_tenant_notification_settings(tenant: Tenant) -> dict[str, bool]:
    return {
        field_name: bool(getattr(tenant, field_name, True))
        for field_name in TENANT_NOTIFICATION_COLUMNS
    }


def get_tenant_notification_settings(db: Session, tenant_id: UUID) -> dict[str, object] | None:
    tenant = load_tenant_notification_settings(db, tenant_id)
    if tenant is None:
        return None
    db.commit()
    db.refresh(tenant)
    return {
        "tenant_id": str(tenant.id),
        **serialize_tenant_notification_settings(tenant),
    }


def is_tenant_notification_delivery_allowed(
    db: Session,
    tenant_id: UUID | None,
    *,
    channel: str,
    notification_kind: str = "standard",
) -> bool:
    if tenant_id is None:
        return True

    tenant = load_tenant_notification_settings(db, tenant_id)
    if tenant is None:
        return False

    normalized_channel = channel.strip().lower()
    normalized_kind = notification_kind.strip().lower() or "standard"

    if normalized_kind == "invoice" and not bool(getattr(tenant, "invoice_notifications_enabled", True)):
        return False

    if normalized_channel == "email":
        return bool(getattr(tenant, "email_notifications_enabled", True))
    if normalized_channel == "in_app":
        return bool(getattr(tenant, "in_app_notifications_enabled", True))
    if normalized_channel == "browser_push":
        return bool(getattr(tenant, "browser_push_notifications_enabled", True))

    return True

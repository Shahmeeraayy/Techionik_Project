from __future__ import annotations

from contextvars import ContextVar
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from fastapi import Request


@dataclass(frozen=True)
class TenantContext:
    tenant_id: UUID | None = None
    tenant_slug: str | None = None
    user_id: UUID | None = None
    role: str | None = None
    tenant_role: str | None = None


_tenant_context: ContextVar[TenantContext] = ContextVar("tenant_context", default=TenantContext())


def get_current_tenant_context() -> TenantContext:
    return _tenant_context.get()


def set_current_tenant_context(context: TenantContext):
    return _tenant_context.set(context)


def reset_current_tenant_context(token) -> None:
    _tenant_context.reset(token)


def get_context_tenant_id() -> UUID | None:
    return get_current_tenant_context().tenant_id


def parse_tenant_slug_from_host(host: str | None) -> str | None:
    if not host:
        return None
    hostname = host.split(":", 1)[0].strip().lower()
    parts = [part for part in hostname.split(".") if part]
    if len(parts) >= 3 and parts[0] == "book":
        return parts[1]
    return None


def extract_request_tenant_metadata(request: Request) -> dict[str, Any]:
    explicit_slug = request.headers.get("x-tenant-slug") or request.query_params.get("tenant")
    explicit_id = request.headers.get("x-tenant-id") or request.query_params.get("tenant_id")
    host_slug = parse_tenant_slug_from_host(request.headers.get("host"))
    return {
        "tenant_slug": (explicit_slug or host_slug or "").strip().lower() or None,
        "tenant_id": (explicit_id or "").strip() or None,
    }

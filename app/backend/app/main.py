from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import OperationalError
import logging

from .api import deps
from .api.endpoints import (
    admin_chat,
    admin_jobs,
    attendance_tracking,
    chat_assets,
    admin_dealerships,
    admin_email_change_requests,
    admin_reports,
    admin_services,
    admin_settings,
    admin_password_reset_requests,
    admin_technicians,
    auth,
    booking_portal,
    invoices,
    notifications,
    signup_requests,
    super_admin,
    technician_password_reset_requests,
    technician_chat,
    technician_profile,
    technician_time_off,
)
from .core.config import APP_ENV, CORS_ALLOW_ORIGINS, CORS_ALLOW_ORIGIN_REGEX, DATABASE_BACKEND, IS_SQLITE
from .core.security import decode_access_token
from .core.tenant import (
    TenantContext,
    extract_request_tenant_metadata,
    reset_current_tenant_context,
    set_current_tenant_context,
)


logger = logging.getLogger(__name__)

app = FastAPI(
    title="NexusOps Technician API",
    description="Backend APIs for admin technician profile, scheduling, and availability.",
    version="2.0.0",
)


def _build_database_health_payload() -> dict[str, str]:
    payload = {
        "database": DATABASE_BACKEND,
        "status": "connected",
        "environment": APP_ENV,
    }
    if IS_SQLITE:
        payload["mode"] = "local_development_only"
    return payload


def _assert_database_connection() -> None:
    with deps.engine.connect() as conn:
        conn.execute(text("SELECT 1"))


@app.on_event("startup")
def validate_runtime_database() -> None:
    _assert_database_connection()


app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOW_ORIGINS,
    allow_origin_regex=CORS_ALLOW_ORIGIN_REGEX or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def inject_tenant_context(request: Request, call_next):
    bearer_token = request.headers.get("authorization", "").strip()
    authenticated_user = None
    if bearer_token.lower().startswith("bearer "):
        try:
            authenticated_user = decode_access_token(bearer_token[7:].strip())
        except Exception:
            authenticated_user = None

    request_tenant = extract_request_tenant_metadata(request)
    context = TenantContext(
        tenant_id=authenticated_user.tenant_id if authenticated_user else request_tenant["tenant_id"],
        tenant_slug=request_tenant["tenant_slug"],
        user_id=authenticated_user.user_id if authenticated_user else None,
        role=authenticated_user.role.value if authenticated_user else None,
        tenant_role=authenticated_user.tenant_role if authenticated_user else None,
    )
    if isinstance(context.tenant_id, str):
        from uuid import UUID

        context = TenantContext(
            tenant_id=UUID(context.tenant_id),
            tenant_slug=context.tenant_slug,
            user_id=context.user_id,
            role=context.role,
            tenant_role=context.tenant_role,
        )

    request.state.tenant_context = context
    token = set_current_tenant_context(context)
    try:
        return await call_next(request)
    finally:
        reset_current_tenant_context(token)

app.include_router(admin_technicians.router)
app.include_router(attendance_tracking.technician_router)
app.include_router(attendance_tracking.admin_router)
app.include_router(attendance_tracking.chatter_router)
app.include_router(admin_chat.router)
app.include_router(chat_assets.router)
app.include_router(admin_jobs.router)
app.include_router(booking_portal.public_router)
app.include_router(booking_portal.admin_router)
app.include_router(admin_dealerships.router)
app.include_router(admin_email_change_requests.router)
app.include_router(admin_reports.router)
app.include_router(admin_services.router)
app.include_router(admin_services.catalog_router)
app.include_router(admin_settings.router)
app.include_router(admin_password_reset_requests.router)
app.include_router(notifications.router)
app.include_router(technician_profile.router)
app.include_router(technician_chat.router)
app.include_router(technician_time_off.router)
app.include_router(auth.router)
app.include_router(invoices.router)
app.include_router(signup_requests.public_router)
app.include_router(signup_requests.admin_router)
app.include_router(super_admin.router)
app.include_router(technician_password_reset_requests.public_router)
app.include_router(technician_password_reset_requests.admin_router)


@app.exception_handler(OperationalError)
def handle_database_operational_error(_: Request, __: OperationalError):
    return JSONResponse(
        status_code=503,
        content={"detail": "Database connection failed. Check DATABASE_URL and database settings."},
    )


@app.get("/")
def root():
    return {"message": "NexusOps technician profile APIs are active."}


@app.get("/health")
def health():
    _assert_database_connection()
    payload = _build_database_health_payload()
    return {
        "status": "ok",
        "database": payload["database"],
        "database_status": payload["status"],
        "environment": payload["environment"],
        **({"mode": payload["mode"]} if "mode" in payload else {}),
    }


@app.get("/health/db")
def health_db():
    _assert_database_connection()
    return _build_database_health_payload()

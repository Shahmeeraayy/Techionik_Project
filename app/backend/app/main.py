from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import inspect
from sqlalchemy.exc import OperationalError
import logging

from .api import deps
from .api.endpoints import (
    admin_chat,
    admin_jobs,
    admin_dealerships,
    admin_email_change_requests,
    admin_reports,
    admin_services,
    admin_settings,
    admin_technicians,
    auth,
    booking_portal,
    integrations_make_jobs,
    invoices,
    signup_requests,
    technician_password_reset_requests,
    technician_chat,
    technician_profile,
    technician_time_off,
)
from .core.config import CORS_ALLOW_ORIGINS
from .core.security import decode_access_token
from .core.tenant import (
    TenantContext,
    extract_request_tenant_metadata,
    reset_current_tenant_context,
    set_current_tenant_context,
)
from .models.job import Job
from .models.base import Base
from .services.job_services_service import JobServicesService


logger = logging.getLogger(__name__)

app = FastAPI(
    title="SM2 electronics Technician API",
    description="Backend APIs for admin technician profile, scheduling, and availability.",
    version="2.0.0",
)


@app.on_event("startup")
def ensure_runtime_schema() -> None:
    with deps.engine.begin() as conn:
        Base.metadata.create_all(bind=conn)
        invoice_columns = {column["name"] for column in inspect(conn).get_columns("invoices")}
        if invoice_columns and "approval_note" not in invoice_columns:
            conn.exec_driver_sql("ALTER TABLE invoices ADD COLUMN approval_note TEXT")

        job_service_columns = {column["name"] for column in inspect(conn).get_columns("job_services")}
        if job_service_columns and "quantity" not in job_service_columns:
            conn.exec_driver_sql("ALTER TABLE job_services ADD COLUMN quantity NUMERIC(10,2) DEFAULT 1 NOT NULL")
        if job_service_columns and "unit_price" not in job_service_columns:
            conn.exec_driver_sql("ALTER TABLE job_services ADD COLUMN unit_price NUMERIC(12,2) DEFAULT 0 NOT NULL")

        service_catalog_columns = {column["name"] for column in inspect(conn).get_columns("service_catalog")}
        if service_catalog_columns and "sku" not in service_catalog_columns:
            conn.exec_driver_sql("ALTER TABLE service_catalog ADD COLUMN sku VARCHAR(128)")
        if service_catalog_columns and "description" not in service_catalog_columns:
            conn.exec_driver_sql("ALTER TABLE service_catalog ADD COLUMN description TEXT")

    with deps.SessionLocal() as session:
        service = JobServicesService(session)
        changed = False
        for row in session.query(Job).all():
            changed = service.backfill_job(row) or changed
        if changed:
            session.commit()


app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOW_ORIGINS,
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
app.include_router(admin_chat.router)
app.include_router(admin_jobs.router)
app.include_router(booking_portal.public_router)
app.include_router(booking_portal.admin_router)
app.include_router(admin_dealerships.router)
app.include_router(admin_email_change_requests.router)
app.include_router(admin_reports.router)
app.include_router(admin_services.router)
app.include_router(admin_services.catalog_router)
app.include_router(admin_settings.router)
app.include_router(technician_profile.router)
app.include_router(technician_chat.router)
app.include_router(technician_time_off.router)
app.include_router(auth.router)
app.include_router(invoices.router)
app.include_router(integrations_make_jobs.router)
app.include_router(signup_requests.public_router)
app.include_router(signup_requests.admin_router)
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
    return {"message": "SM2 electronics technician profile APIs are active."}

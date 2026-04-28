from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import inspect
from sqlalchemy.exc import OperationalError
import logging
from threading import Event, Thread

from .api import deps
from .api.endpoints import (
    admin_quickbooks,
    admin_jobs,
    admin_dealerships,
    admin_email_change_requests,
    admin_reports,
    admin_services,
    admin_settings,
    admin_technicians,
    auth,
    integrations_make_jobs,
    integrations_quickbooks_oauth,
    integrations_quickbooks_webhooks,
    invoices,
    signup_requests,
    technician_password_reset_requests,
    technician_profile,
    technician_time_off,
)
from .core.config import CORS_ALLOW_ORIGINS, QUICKBOOKS_ITEMS_SYNC_INTERVAL_SECONDS
from .models.job import Job
from .models.base import Base
from .services.job_services_service import JobServicesService
from .services.quickbooks_connection_service import QuickBooksConnectionService
from .services.quickbooks_customer_sync_service import QuickBooksCustomerSyncService
from .services.quickbooks_item_sync_service import QuickBooksItemSyncService
from .services.quickbooks_tax_code_sync_service import QuickBooksTaxCodeSyncService


logger = logging.getLogger(__name__)
_quickbooks_sync_stop_event: Event | None = None
_quickbooks_sync_thread: Thread | None = None

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
        if invoice_columns and "qb_invoice_id" not in invoice_columns:
            conn.exec_driver_sql("ALTER TABLE invoices ADD COLUMN qb_invoice_id VARCHAR(64)")
        if invoice_columns and "qb_customer_id" not in invoice_columns:
            conn.exec_driver_sql("ALTER TABLE invoices ADD COLUMN qb_customer_id VARCHAR(64)")
        if invoice_columns and "qb_sync_status" not in invoice_columns:
            conn.exec_driver_sql("ALTER TABLE invoices ADD COLUMN qb_sync_status VARCHAR(16) DEFAULT 'pending' NOT NULL")
        if invoice_columns and "qb_sync_error" not in invoice_columns:
            conn.exec_driver_sql("ALTER TABLE invoices ADD COLUMN qb_sync_error TEXT")

        invoice_line_item_columns = {column["name"] for column in inspect(conn).get_columns("invoice_line_items")}
        if invoice_line_item_columns and "qb_item_id" not in invoice_line_item_columns:
            conn.exec_driver_sql("ALTER TABLE invoice_line_items ADD COLUMN qb_item_id VARCHAR(64)")

        job_service_columns = {column["name"] for column in inspect(conn).get_columns("job_services")}
        if job_service_columns and "quantity" not in job_service_columns:
            conn.exec_driver_sql("ALTER TABLE job_services ADD COLUMN quantity NUMERIC(10,2) DEFAULT 1 NOT NULL")
        if job_service_columns and "unit_price" not in job_service_columns:
            conn.exec_driver_sql("ALTER TABLE job_services ADD COLUMN unit_price NUMERIC(12,2) DEFAULT 0 NOT NULL")

        service_catalog_columns = {column["name"] for column in inspect(conn).get_columns("service_catalog")}
        if service_catalog_columns and "qb_item_id" not in service_catalog_columns:
            conn.exec_driver_sql("ALTER TABLE service_catalog ADD COLUMN qb_item_id VARCHAR(64)")
        if service_catalog_columns and "sku" not in service_catalog_columns:
            conn.exec_driver_sql("ALTER TABLE service_catalog ADD COLUMN sku VARCHAR(128)")
        if service_catalog_columns and "description" not in service_catalog_columns:
            conn.exec_driver_sql("ALTER TABLE service_catalog ADD COLUMN description TEXT")
        if service_catalog_columns and "qb_type" not in service_catalog_columns:
            conn.exec_driver_sql("ALTER TABLE service_catalog ADD COLUMN qb_type VARCHAR(64)")
        dealership_columns = {column["name"] for column in inspect(conn).get_columns("dealerships")}
        if dealership_columns and "qb_customer_id" not in dealership_columns:
            conn.exec_driver_sql("ALTER TABLE dealerships ADD COLUMN qb_customer_id VARCHAR(64)")
    with deps.SessionLocal() as session:
        service = JobServicesService(session)
        changed = False
        for row in session.query(Job).all():
            changed = service.backfill_job(row) or changed
        if changed:
            session.commit()

    _sync_quickbooks_once()
    _start_quickbooks_sync_worker()


@app.on_event("shutdown")
def stop_quickbooks_sync_worker() -> None:
    global _quickbooks_sync_stop_event, _quickbooks_sync_thread
    if _quickbooks_sync_stop_event is not None:
        _quickbooks_sync_stop_event.set()
    if _quickbooks_sync_thread is not None and _quickbooks_sync_thread.is_alive():
        _quickbooks_sync_thread.join(timeout=2)
    _quickbooks_sync_stop_event = None
    _quickbooks_sync_thread = None


def _sync_quickbooks_once() -> None:
    try:
        with deps.SessionLocal() as db:
            connection_status = QuickBooksConnectionService(db).get_status()
            if not bool(connection_status.get("connected")):
                return
            item_result = QuickBooksItemSyncService(db).sync_items()
            customer_result = QuickBooksCustomerSyncService(db).sync_customers()
            tax_code_result = QuickBooksTaxCodeSyncService(db).sync_tax_codes()
            logger.info(
                "QuickBooks auto-sync completed: items synced=%s created=%s updated=%s archived=%s; customers synced=%s created=%s updated=%s inactive=%s; tax_codes synced=%s created=%s updated=%s active=%s mapped=%s sales_tax_enabled=%s",
                item_result.synced_count,
                item_result.created_count,
                item_result.updated_count,
                item_result.archived_count,
                customer_result.synced_count,
                customer_result.created_count,
                customer_result.updated_count,
                customer_result.inactive_count,
                tax_code_result.synced_count,
                tax_code_result.created_count,
                tax_code_result.updated_count,
                tax_code_result.active_count,
                tax_code_result.mapped_count,
                tax_code_result.sales_tax_enabled,
            )
    except Exception:
        logger.exception("QuickBooks auto-sync failed.")


def _quickbooks_sync_worker(stop_event: Event, interval_seconds: int) -> None:
    while not stop_event.wait(interval_seconds):
        _sync_quickbooks_once()


def _start_quickbooks_sync_worker() -> None:
    global _quickbooks_sync_stop_event, _quickbooks_sync_thread

    if QUICKBOOKS_ITEMS_SYNC_INTERVAL_SECONDS <= 0:
        return
    if _quickbooks_sync_thread is not None and _quickbooks_sync_thread.is_alive():
        return

    _quickbooks_sync_stop_event = Event()
    _quickbooks_sync_thread = Thread(
        target=_quickbooks_sync_worker,
        args=(_quickbooks_sync_stop_event, QUICKBOOKS_ITEMS_SYNC_INTERVAL_SECONDS),
        daemon=True,
        name="quickbooks-item-sync-worker",
    )
    _quickbooks_sync_thread.start()

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOW_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin_technicians.router)
app.include_router(admin_quickbooks.router)
app.include_router(admin_jobs.router)
app.include_router(admin_dealerships.router)
app.include_router(admin_email_change_requests.router)
app.include_router(admin_reports.router)
app.include_router(admin_services.router)
app.include_router(admin_services.catalog_router)
app.include_router(admin_settings.router)
app.include_router(technician_profile.router)
app.include_router(technician_time_off.router)
app.include_router(auth.router)
app.include_router(invoices.router)
app.include_router(invoices.quickbooks_router)
app.include_router(integrations_make_jobs.router)
app.include_router(integrations_quickbooks_oauth.router)
app.include_router(integrations_quickbooks_webhooks.router)
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

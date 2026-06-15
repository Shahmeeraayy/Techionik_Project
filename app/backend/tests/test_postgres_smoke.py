import os
import subprocess
import sys
import unittest
from contextlib import contextmanager
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path
from uuid import UUID, uuid4

from sqlalchemy import create_engine, text


BACKEND_ROOT = Path(__file__).resolve().parents[1]


def _load_env_value(name: str) -> str:
    direct = os.environ.get(name, "").strip()
    if direct:
        return direct

    env_file = BACKEND_ROOT / ".env"
    if not env_file.exists():
        return ""

    for raw_line in env_file.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        if key.strip() == name:
            return value.strip().strip('"').strip("'")
    return ""


TEST_DATABASE_URL = _load_env_value("TEST_DATABASE_URL")

if not TEST_DATABASE_URL:
    raise RuntimeError("TEST_DATABASE_URL is required for PostgreSQL smoke tests.")

os.environ["APP_ENV"] = "development"
os.environ.pop("ALLOW_SQLITE_FOR_TESTS", None)
os.environ["DATABASE_URL"] = TEST_DATABASE_URL

from fastapi.testclient import TestClient

from app.api.deps import SessionLocal, engine
from app.main import app
from app.models.job import Job
from app.models.service_catalog import ServiceCatalog
from app.models.technician import Technician


def _reset_postgres_test_database() -> None:
    engine.dispose()
    reset_engine = create_engine(TEST_DATABASE_URL, isolation_level="AUTOCOMMIT", pool_pre_ping=True)
    try:
        with reset_engine.connect() as conn:
            conn.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
            conn.execute(text("CREATE SCHEMA public"))
            conn.execute(text("GRANT ALL ON SCHEMA public TO CURRENT_USER"))
            conn.execute(text("GRANT ALL ON SCHEMA public TO PUBLIC"))
    finally:
        reset_engine.dispose()

    env = os.environ.copy()
    env["DATABASE_URL"] = TEST_DATABASE_URL
    subprocess.run(
        [sys.executable, "scripts/migrate.py"],
        cwd=BACKEND_ROOT,
        env=env,
        check=True,
        capture_output=True,
        text=True,
    )
    engine.dispose()


class PostgresSmokeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if engine.dialect.name != "postgresql":
            raise unittest.SkipTest("PostgreSQL smoke tests require a PostgreSQL engine")
        _reset_postgres_test_database()
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        cls.client.close()
        engine.dispose()

    @staticmethod
    def _unique(prefix: str) -> str:
        return f"{prefix}-{uuid4().hex[:8]}"

    @contextmanager
    def _tenant_db(self, tenant_id: str):
        db = SessionLocal()
        tenant_uuid = UUID(tenant_id)
        db.info["tenant_id"] = tenant_uuid
        db.execute(
            text("SELECT set_config('app.current_tenant_id', :tenant_id, true)"),
            {"tenant_id": str(tenant_uuid)},
        )
        try:
            yield db
        finally:
            db.close()

    def _signup_admin(self, *, company_name: str, workspace_slug: str, full_name: str, email: str, password: str) -> dict:
        response = self.client.post(
            "/auth/admin-signup",
            json={
                "company_name": company_name,
                "workspace_slug": workspace_slug,
                "full_name": full_name,
                "email": email,
                "password": password,
            },
        )
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    def _login_admin(self, *, email: str, password: str) -> dict[str, str]:
        response = self.client.post(
            "/auth/admin-token",
            json={"email": email, "password": password},
        )
        self.assertEqual(response.status_code, 200, response.text)
        return {"Authorization": f"Bearer {response.json()['access_token']}"}

    def _login_technician(self, *, email: str, password: str) -> dict[str, str]:
        response = self.client.post(
            "/auth/dev/technician-token",
            json={"email": email, "password": password},
        )
        self.assertEqual(response.status_code, 200, response.text)
        return {"Authorization": f"Bearer {response.json()['access_token']}"}

    def _seed_service_catalog(self, *, tenant_id: str) -> list[str]:
        with self._tenant_db(tenant_id) as db:
            rows = [
                ServiceCatalog(
                    id=uuid4(),
                    code=self._unique("PG-SVC-1").upper(),
                    name="Window Tint",
                    category="Automotive",
                    default_price=Decimal("125.00"),
                    approval_required=False,
                    status="active",
                    updated_by="postgres_smoke",
                ),
                ServiceCatalog(
                    id=uuid4(),
                    code=self._unique("PG-SVC-2").upper(),
                    name="Ceramic Coating",
                    category="Automotive",
                    default_price=Decimal("75.00"),
                    approval_required=False,
                    status="active",
                    updated_by="postgres_smoke",
                ),
            ]
            db.add_all(rows)
            db.commit()
            return [str(row.id) for row in rows]

    def _seed_technician(self, *, tenant_id: str, email: str, full_name: str) -> str:
        with self._tenant_db(tenant_id) as db:
            row = Technician(
                id=uuid4(),
                tenant_id=UUID(tenant_id),
                name=full_name,
                full_name=full_name,
                email=email.lower(),
                phone="+1-415-555-0101",
                status="active",
                password="tech123",
                manual_availability=True,
            )
            db.add(row)
            db.commit()
            db.refresh(row)
            return str(row.id)

    def _load_job(self, *, tenant_id: str, reference_number: str) -> Job:
        with self._tenant_db(tenant_id) as db:
            row = (
                db.query(Job)
                .execution_options(skip_tenant_scope=True)
                .filter(Job.tenant_id == UUID(tenant_id))
                .filter(Job.job_code == reference_number)
                .first()
            )
            self.assertIsNotNone(row)
            return row

    def test_health_reports_postgresql(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(
            response.json(),
            {
                "status": "ok",
                "database": "postgresql",
                "database_status": "connected",
                "environment": "development",
            },
        )

        db_response = self.client.get("/health/db")
        self.assertEqual(db_response.status_code, 200, db_response.text)
        self.assertEqual(
            db_response.json(),
            {
                "database": "postgresql",
                "status": "connected",
                "environment": "development",
            },
        )

    def test_core_postgresql_tenant_flows(self):
        tenant_one_slug = self._unique("tenant-one")
        tenant_two_slug = self._unique("tenant-two")
        owner_one_email = f"{tenant_one_slug}@nexusops.local"
        owner_two_email = f"{tenant_two_slug}@nexusops.local"

        tenant_one = self._signup_admin(
            company_name="Tenant One Automotive",
            workspace_slug=tenant_one_slug,
            full_name="Owner One",
            email=owner_one_email,
            password="NexusOps!Admin2026",
        )
        tenant_two = self._signup_admin(
            company_name="Tenant Two Automotive",
            workspace_slug=tenant_two_slug,
            full_name="Owner Two",
            email=owner_two_email,
            password="NexusOps!Admin2026",
        )

        admin_one_headers = self._login_admin(email=owner_one_email, password="NexusOps!Admin2026")
        admin_two_headers = self._login_admin(email=owner_two_email, password="NexusOps!Admin2026")

        super_admin_token = self.client.post(
            "/auth/super-admin-token",
            json={"email": "root@nexusops.com", "password": "NexusOps!Root2026"},
        )
        self.assertEqual(super_admin_token.status_code, 200, super_admin_token.text)
        super_admin_headers = {"Authorization": f"Bearer {super_admin_token.json()['access_token']}"}

        service_ids = self._seed_service_catalog(tenant_id=tenant_one["tenant_id"])
        tech_one_email = f"tech-one-{uuid4().hex[:8]}@nexusops.local"
        tech_two_email = f"tech-two-{uuid4().hex[:8]}@nexusops.local"
        tech_one_id = self._seed_technician(
            tenant_id=tenant_one["tenant_id"],
            email=tech_one_email,
            full_name="Taylor Field",
        )
        self._seed_technician(
            tenant_id=tenant_two["tenant_id"],
            email=tech_two_email,
            full_name="Jordan Cross",
        )
        tech_one_headers = self._login_technician(email=tech_one_email, password="tech123")
        tech_two_headers = self._login_technician(email=tech_two_email, password="tech123")

        public_headers = {"x-tenant-slug": tenant_one_slug}
        update_settings = self.client.put(
            "/admin/booking-portal/settings",
            headers=admin_one_headers,
            json={
                "is_enabled": True,
                "estimated_response_time_message": "We will contact you within 2 business hours.",
                "confirmation_email_body": (
                    "Hello ${customer_name}, your ref is ${reference_number}.\n"
                    "Booking form: ${booking_portal_url}\n"
                    "Track: ${booking_status_url}"
                ),
                "visible_service_ids": service_ids,
                "status_lookup_enabled": True,
                "industry_type": "automotive",
                "details_field_label": "Vehicle details",
            },
        )
        self.assertEqual(update_settings.status_code, 200, update_settings.text)

        config_response = self.client.get("/booking-portal/config", headers=public_headers)
        self.assertEqual(config_response.status_code, 200, config_response.text)
        self.assertEqual(config_response.json()["tenant_slug"], tenant_one_slug)
        self.assertEqual(len(config_response.json()["services"]), 2)

        submit_response = self.client.post(
            "/booking-portal/submit",
            headers=public_headers,
            json={
                "customer_full_name": "Alex Client",
                "phone_number": "+1-415-555-0113",
                "email_address": "alex.client@example.com",
                "service_location_address": "123 Customer Road",
                "service_location_city": "Detroit",
                "service_location_state": "MI",
                "service_location_zip_code": "48201",
                "service_catalog_ids": service_ids,
                "asset_details": "2024 Ford F-150 with front window damage.",
                "preferred_date": str(date.today() + timedelta(days=2)),
                "preferred_time_of_day": "morning",
                "additional_notes": "Please call before arrival.",
            },
        )
        self.assertEqual(submit_response.status_code, 201, submit_response.text)
        reference_number = submit_response.json()["reference_number"]

        lookup_response = self.client.post(
            "/booking-portal/status-lookup",
            headers=public_headers,
            json={
                "reference_number": reference_number,
                "email_address": "alex.client@example.com",
            },
        )
        self.assertEqual(lookup_response.status_code, 200, lookup_response.text)
        self.assertEqual(lookup_response.json()["status"], "Received")

        admin_one_bookings = self.client.get("/admin/booking-portal/requests", headers=admin_one_headers)
        self.assertEqual(admin_one_bookings.status_code, 200, admin_one_bookings.text)
        self.assertEqual(len(admin_one_bookings.json()), 1)
        booking_id = admin_one_bookings.json()[0]["id"]

        admin_two_bookings = self.client.get("/admin/booking-portal/requests", headers=admin_two_headers)
        self.assertEqual(admin_two_bookings.status_code, 200, admin_two_bookings.text)
        self.assertEqual(admin_two_bookings.json(), [])

        update_booking = self.client.patch(
            f"/admin/booking-portal/requests/{booking_id}",
            headers=admin_one_headers,
            json={
                "status": "COMPLETED",
                "assigned_technician_id": tech_one_id,
                "estimated_completion_date": str(date.today() + timedelta(days=3)),
            },
        )
        self.assertEqual(update_booking.status_code, 200, update_booking.text)
        self.assertEqual(update_booking.json()["status"], "COMPLETED")

        booking_job = self._load_job(
            tenant_id=tenant_one["tenant_id"],
            reference_number=reference_number,
        )
        self.assertEqual(str(booking_job.assigned_tech_id), tech_one_id)

        clock_in = self.client.post(
            "/technician/attendance/clock-in",
            headers=tech_one_headers,
            json={"latitude": 42.3314, "longitude": -83.0458, "accuracy": 10},
        )
        self.assertEqual(clock_in.status_code, 201, clock_in.text)
        self.assertEqual(clock_in.json()["status"], "clocked_in")

        clock_out = self.client.post(
            "/technician/attendance/clock-out",
            headers=tech_one_headers,
            json={"latitude": 42.3314, "longitude": -83.0458, "accuracy": 10},
        )
        self.assertEqual(clock_out.status_code, 200, clock_out.text)
        self.assertEqual(clock_out.json()["status"], "clocked_out")

        dashboard = self.client.get("/admin/attendance/dashboard", headers=admin_one_headers)
        self.assertEqual(dashboard.status_code, 200, dashboard.text)
        self.assertTrue(any(row["technician_name"] == "Taylor Field" for row in dashboard.json()["reports"]))

        resolve_admin_thread = self.client.get(
            f"/admin/chat/jobs/{booking_job.id}/conversation",
            headers=admin_one_headers,
        )
        self.assertEqual(resolve_admin_thread.status_code, 200, resolve_admin_thread.text)
        conversation_id = resolve_admin_thread.json()["conversation"]["id"]

        send_message = self.client.post(
            f"/admin/chat/threads/{conversation_id}/messages",
            headers=admin_one_headers,
            json={"text": "Please confirm arrival before heading to the customer."},
        )
        self.assertEqual(send_message.status_code, 201, send_message.text)
        self.assertEqual(send_message.json()["message_type"], "text")

        tech_conversation = self.client.get(
            f"/technicians/me/chat/jobs/{booking_job.id}/conversation",
            headers=tech_one_headers,
        )
        self.assertEqual(tech_conversation.status_code, 200, tech_conversation.text)
        self.assertEqual(tech_conversation.json()["conversation"]["id"], conversation_id)

        tech_messages = self.client.get(
            f"/technicians/me/chat/threads/{conversation_id}/messages",
            headers=tech_one_headers,
        )
        self.assertEqual(tech_messages.status_code, 200, tech_messages.text)
        self.assertEqual(
            tech_messages.json()[-1]["text"],
            "Please confirm arrival before heading to the customer.",
        )

        cross_tenant = self.client.get(
            f"/technicians/me/chat/jobs/{booking_job.id}/conversation",
            headers=tech_two_headers,
        )
        self.assertIn(cross_tenant.status_code, {403, 404}, cross_tenant.text)

        pending_approvals = self.client.get("/invoices/pending-approvals", headers=admin_one_headers)
        self.assertEqual(pending_approvals.status_code, 200, pending_approvals.text)
        matching_pending = next(
            (row for row in pending_approvals.json() if row["job_id"] == str(booking_job.id)),
            None,
        )
        self.assertIsNotNone(matching_pending)
        self.assertEqual(matching_pending["estimated_total"], "200.00")

        create_invoice = self.client.post(
            "/invoices",
            headers=admin_one_headers,
            json={
                "dispatch_job_ids": [str(booking_job.id)],
                "terms": "NET_15",
                "shipping": "0.00",
                "approval_note": "PostgreSQL smoke invoice",
                "status": "sent",
            },
        )
        self.assertEqual(create_invoice.status_code, 201, create_invoice.text)
        created_invoice = create_invoice.json()
        self.assertEqual(created_invoice["subtotal"], "200.00")
        self.assertEqual(created_invoice["total"], "200.00")
        self.assertEqual(created_invoice["approval_note"], "PostgreSQL smoke invoice")

        mark_paid = self.client.post(
            f"/invoices/{created_invoice['id']}/mark-paid",
            headers=admin_one_headers,
            json={},
        )
        self.assertEqual(mark_paid.status_code, 200, mark_paid.text)
        self.assertEqual(mark_paid.json()["status"], "paid")

        super_admin_dashboard = self.client.get("/super-admin/dashboard", headers=super_admin_headers)
        self.assertEqual(super_admin_dashboard.status_code, 200, super_admin_dashboard.text)
        self.assertGreaterEqual(super_admin_dashboard.json()["metrics"]["total_tenants"], 2)

        super_admin_tenants = self.client.get("/super-admin/tenants", headers=super_admin_headers)
        self.assertEqual(super_admin_tenants.status_code, 200, super_admin_tenants.text)
        tenant_slugs = {row["slug"] for row in super_admin_tenants.json()}
        self.assertIn(tenant_one_slug, tenant_slugs)
        self.assertIn(tenant_two_slug, tenant_slugs)


if __name__ == "__main__":
    unittest.main()

import os
import unittest
from decimal import Decimal
from uuid import UUID
from uuid import uuid4

from fastapi.testclient import TestClient

_TEST_DB_FILE = os.path.join(os.path.dirname(__file__), "notifications_api_test.sqlite3")
if os.path.exists(_TEST_DB_FILE):
    os.remove(_TEST_DB_FILE)

os.environ["APP_ENV"] = "development"
os.environ["ALLOW_SQLITE_FOR_TESTS"] = "1"
os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_DB_FILE.replace(os.sep, '/')}"

from app.api.deps import SessionLocal, engine
from app.main import app
from app.models.base import Base
from app.models.booking_portal_settings import BookingPortalSettings
from app.models.booking_request import BookingRequest
from app.models.email_outbox import EmailOutbox
from app.models.job import Job
from app.models.notification import Notification
from app.models.service_catalog import ServiceCatalog
from app.models.technician import Technician


class NotificationsApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)
        cls.client = TestClient(app)

        unique_suffix = uuid4().hex[:8]
        unique_code_suffix = unique_suffix.upper()
        cls.tenant_one_slug = f"tenant-one-{unique_suffix}"
        cls.tenant_two_slug = f"tenant-two-{unique_suffix}"
        cls.owner_one_email = f"owner1-{unique_suffix}@nexusops.local"
        cls.owner_two_email = f"owner2-{unique_suffix}@nexusops.local"
        cls.tech_one_email = f"taylor.tech-{unique_suffix}@nexusops.local"
        cls.tech_other_email = f"jordan.other-{unique_suffix}@nexusops.local"

        tenant_one_signup = cls.client.post(
            "/auth/admin-signup",
            json={
                "company_name": f"Tenant One {unique_suffix}",
                "workspace_slug": cls.tenant_one_slug,
                "full_name": "Owner One",
                "email": cls.owner_one_email,
                "password": "NexusOps!Admin2026",
            },
        )
        assert tenant_one_signup.status_code == 201, tenant_one_signup.text
        tenant_one_payload = tenant_one_signup.json()
        cls.admin_one_token = tenant_one_payload["access_token"]
        cls.admin_one_headers = {"Authorization": f"Bearer {cls.admin_one_token}"}
        cls.tenant_one_id = tenant_one_payload["tenant_id"]

        tenant_two_signup = cls.client.post(
            "/auth/admin-signup",
            json={
                "company_name": f"Tenant Two {unique_suffix}",
                "workspace_slug": cls.tenant_two_slug,
                "full_name": "Owner Two",
                "email": cls.owner_two_email,
                "password": "NexusOps!Admin2026",
            },
        )
        assert tenant_two_signup.status_code == 201, tenant_two_signup.text
        tenant_two_payload = tenant_two_signup.json()
        cls.admin_two_token = tenant_two_payload["access_token"]
        cls.admin_two_headers = {"Authorization": f"Bearer {cls.admin_two_token}"}
        cls.tenant_two_id = tenant_two_payload["tenant_id"]

        tenant_one_uuid = UUID(cls.tenant_one_id)
        tenant_two_uuid = UUID(cls.tenant_two_id)

        with SessionLocal() as db:
            db.info["tenant_id"] = tenant_one_uuid
            technician_one = Technician(
                name="Taylor Tech",
                full_name="Taylor Tech",
                email=cls.tech_one_email,
                password="tech123",
                status="active",
                manual_availability=True,
            )
            db.add(technician_one)
            db.flush()

            job_one = Job(
                job_code=f"NOTIFY-JOB-001-{unique_code_suffix}",
                status="pending",
                source_system="admin_ui",
            )
            db.add(job_one)

            service = ServiceCatalog(
                code=f"WIN-TINT-{unique_code_suffix}",
                name="Window Tint",
                category="Automotive",
                default_price=Decimal("0"),
                approval_required=False,
                status="active",
                updated_by="test",
            )
            db.add(service)
            db.flush()

            db.info["tenant_id"] = tenant_two_uuid
            technician_other = Technician(
                name="Jordan Other",
                full_name="Jordan Other",
                email=cls.tech_other_email,
                password="tech123",
                status="active",
                manual_availability=True,
            )
            db.add(technician_other)
            db.commit()

            cls.tech_one_id = str(technician_one.id)
            cls.tech_other_id = str(technician_other.id)
            cls.job_one_id = str(job_one.id)
            cls.service_id = str(service.id)

        cls.tech_one_headers = {"Authorization": f"Bearer {cls._technician_token(cls.tech_one_email)}"}
        cls.tech_other_headers = {"Authorization": f"Bearer {cls._technician_token(cls.tech_other_email)}"}

    @classmethod
    def tearDownClass(cls):
        engine.dispose()
        if os.path.exists(_TEST_DB_FILE):
            os.remove(_TEST_DB_FILE)

    @classmethod
    def _technician_token(cls, email: str) -> str:
        response = cls.client.post(
            "/auth/dev/technician-token",
            json={"email": email, "password": "tech123"},
        )
        assert response.status_code == 200, response.text
        return response.json()["access_token"]

    def setUp(self):
        with SessionLocal() as db:
            db.query(Notification).delete()
            db.query(BookingRequest).delete()
            db.query(EmailOutbox).delete()
            db.query(BookingPortalSettings).delete()
            job_row = db.query(Job).filter(Job.id == UUID(self.job_one_id)).first()
            if job_row is not None:
                job_row.assigned_tech_id = None
                job_row.pre_assigned_technician_id = None
            db.commit()

    def test_job_assignment_notification_persists_and_read_access_is_scoped(self):
        assignment = self.client.patch(
            f"/admin/jobs/{self.job_one_id}/assignment",
            headers=self.admin_one_headers,
            json={"assigned_technician_id": self.tech_one_id},
        )
        self.assertEqual(assignment.status_code, 200, assignment.text)

        unread = self.client.get("/notifications/unread-count", headers=self.tech_one_headers)
        self.assertEqual(unread.status_code, 200, unread.text)
        self.assertEqual(unread.json()["unread_count"], 1)

        listing = self.client.get("/notifications", headers=self.tech_one_headers)
        self.assertEqual(listing.status_code, 200, listing.text)
        payload = listing.json()
        self.assertEqual(len(payload), 1)
        self.assertEqual(payload[0]["event_type"], "job_assigned")
        self.assertEqual(payload[0]["payload"]["job_id"], self.job_one_id)
        self.assertIn("current-job", payload[0]["payload"]["href"])

        unauthorized = self.client.patch(
            f"/notifications/{payload[0]['id']}/read",
            headers=self.tech_other_headers,
        )
        self.assertEqual(unauthorized.status_code, 404, unauthorized.text)

        marked = self.client.patch(
            f"/notifications/{payload[0]['id']}/read",
            headers=self.tech_one_headers,
        )
        self.assertEqual(marked.status_code, 200, marked.text)
        self.assertTrue(marked.json()["is_read"])

        unread_after = self.client.get("/notifications/unread-count", headers=self.tech_one_headers)
        self.assertEqual(unread_after.status_code, 200, unread_after.text)
        self.assertEqual(unread_after.json()["unread_count"], 0)

    def test_chat_notifications_only_hit_the_receiver_role(self):
        admin_send = self.client.post(
            f"/admin/chat/conversations/{self.tech_one_id}/messages",
            headers=self.admin_one_headers,
            json={"text": "Please review the new assignment."},
        )
        self.assertEqual(admin_send.status_code, 201, admin_send.text)

        technician_notifications = self.client.get("/notifications", headers=self.tech_one_headers)
        self.assertEqual(technician_notifications.status_code, 200, technician_notifications.text)
        tech_payload = technician_notifications.json()
        self.assertEqual(len(tech_payload), 1)
        self.assertEqual(tech_payload[0]["event_type"], "new_message")
        self.assertIn("conversationId=", tech_payload[0]["payload"]["href"])

        admin_notifications_after_admin_send = self.client.get("/notifications", headers=self.admin_one_headers)
        self.assertEqual(admin_notifications_after_admin_send.status_code, 200, admin_notifications_after_admin_send.text)
        self.assertEqual(admin_notifications_after_admin_send.json(), [])

        technician_send = self.client.post(
            "/technicians/me/chat/messages",
            headers=self.tech_one_headers,
            json={"text": "Confirmed. Heading there now."},
        )
        self.assertEqual(technician_send.status_code, 201, technician_send.text)

        admin_notifications = self.client.get("/notifications", headers=self.admin_one_headers)
        self.assertEqual(admin_notifications.status_code, 200, admin_notifications.text)
        admin_payload = admin_notifications.json()
        self.assertEqual(len(admin_payload), 1)
        self.assertEqual(admin_payload[0]["event_type"], "new_message")
        self.assertIn("conversationId=", admin_payload[0]["payload"]["href"])

    def test_new_customer_request_notification_and_mark_all_read(self):
        settings = self.client.put(
            "/admin/booking-portal/settings",
            headers=self.admin_one_headers,
            json={
                "is_enabled": True,
                "estimated_response_time_message": "We will contact you within 2 business hours.",
                "confirmation_email_body": (
                    "Hello ${customer_name}, your ref is ${reference_number}.\n"
                    "Booking form: ${booking_portal_url}\n"
                    "Track: ${booking_status_url}"
                ),
                "visible_service_ids": [self.service_id],
                "status_lookup_enabled": True,
                "industry_type": "automotive",
                "details_field_label": "Vehicle details",
            },
        )
        self.assertEqual(settings.status_code, 200, settings.text)

        submit = self.client.post(
            "/booking-portal/submit",
            headers={"x-tenant-slug": self.tenant_one_slug},
            json={
                "customer_full_name": "Alex Client",
                "phone_number": "+1 (586) 555-0101",
                "email_address": "alex.client@example.com",
                "service_location_address": "123 Customer Road",
                "service_location_city": "Detroit",
                "service_location_state": "MI",
                "service_location_zip_code": "48201",
                "service_catalog_ids": [self.service_id],
                "asset_details": "2024 Ford F-150 with front glass damage.",
                "preferred_date": "2026-06-10",
                "preferred_time_of_day": "morning",
                "additional_notes": "Please call before arrival.",
            },
        )
        self.assertEqual(submit.status_code, 201, submit.text)

        listing = self.client.get("/notifications", headers=self.admin_one_headers)
        self.assertEqual(listing.status_code, 200, listing.text)
        payload = listing.json()
        self.assertEqual(len(payload), 1)
        self.assertEqual(payload[0]["event_type"], "new_customer_request")
        self.assertTrue(payload[0]["payload"]["href"].startswith("/admin/intake?bookingId="))

        unread = self.client.get("/notifications/unread-count", headers=self.admin_one_headers)
        self.assertEqual(unread.status_code, 200, unread.text)
        self.assertEqual(unread.json()["unread_count"], 1)

        mark_all = self.client.patch("/notifications/read-all", headers=self.admin_one_headers)
        self.assertEqual(mark_all.status_code, 200, mark_all.text)
        self.assertEqual(mark_all.json()["updated_count"], 1)
        self.assertEqual(mark_all.json()["unread_count"], 0)

    def test_notifications_are_tenant_safe(self):
        assignment = self.client.patch(
            f"/admin/jobs/{self.job_one_id}/assignment",
            headers=self.admin_one_headers,
            json={"assigned_technician_id": self.tech_one_id},
        )
        self.assertEqual(assignment.status_code, 200, assignment.text)

        other_tenant_admin = self.client.get("/notifications", headers=self.admin_two_headers)
        self.assertEqual(other_tenant_admin.status_code, 200, other_tenant_admin.text)
        self.assertEqual(other_tenant_admin.json(), [])

        other_tenant_technician = self.client.get("/notifications", headers=self.tech_other_headers)
        self.assertEqual(other_tenant_technician.status_code, 200, other_tenant_technician.text)
        self.assertEqual(other_tenant_technician.json(), [])


if __name__ == "__main__":
    unittest.main()

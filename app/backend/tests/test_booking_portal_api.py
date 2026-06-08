import os
import unittest
from decimal import Decimal
from uuid import uuid4

from fastapi.testclient import TestClient

_TEST_DB_FILE = os.path.join(os.path.dirname(__file__), "booking_portal_test.sqlite3")
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
from app.models.service_catalog import ServiceCatalog


class BookingPortalApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)
        cls.client = TestClient(app)
        admin_token_response = cls.client.post(
            "/auth/dev/admin-token",
            json={"email": "admin@nexusops.com", "password": "admin123"},
        )
        assert admin_token_response.status_code == 200
        cls.admin_auth_header = {"Authorization": f"Bearer {admin_token_response.json()['access_token']}"}

    @classmethod
    def tearDownClass(cls):
        engine.dispose()
        if os.path.exists(_TEST_DB_FILE):
            os.remove(_TEST_DB_FILE)

    def setUp(self):
        with SessionLocal() as db:
            db.query(EmailOutbox).delete()
            db.query(BookingRequest).delete()
            db.query(BookingPortalSettings).delete()
            db.query(ServiceCatalog).delete()
            db.commit()

            db.add(
                ServiceCatalog(
                    id=uuid4(),
                    code="WIN-TINT",
                    name="Window Tint",
                    category="Automotive",
                    default_price=Decimal("0"),
                    approval_required=False,
                    status="active",
                    updated_by="test",
                )
            )
            db.add(
                ServiceCatalog(
                    id=uuid4(),
                    code="CER-COAT",
                    name="Ceramic Coating",
                    category="Automotive",
                    default_price=Decimal("0"),
                    approval_required=False,
                    status="active",
                    updated_by="test",
                )
            )
            db.commit()

    def _service_ids(self) -> list[str]:
        with SessionLocal() as db:
            rows = db.query(ServiceCatalog).order_by(ServiceCatalog.name.asc()).all()
            return [str(row.id) for row in rows]

    def test_public_config_and_submission_and_lookup_flow(self):
        service_ids = self._service_ids()

        update_response = self.client.put(
            "/admin/booking-portal/settings",
            headers=self.admin_auth_header,
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
        self.assertEqual(update_response.status_code, 200, update_response.text)

        config_response = self.client.get("/booking-portal/config")
        self.assertEqual(config_response.status_code, 200, config_response.text)
        config_payload = config_response.json()
        self.assertTrue(config_payload["is_enabled"])
        self.assertEqual(len(config_payload["services"]), 2)

        submit_response = self.client.post(
            "/booking-portal/submit",
            json={
                "customer_full_name": "Alex Client",
                "phone_number": "+1(586) 556-0113",
                "email_address": "alex@example.com",
                "service_location_address": "123 Customer Road",
                "service_location_city": "Detroit",
                "service_location_state": "MI",
                "service_location_zip_code": "48201",
                "service_catalog_ids": service_ids,
                "asset_details": "2024 Ford F-150 with front window damage.",
                "preferred_date": "2026-05-12",
                "preferred_time_of_day": "morning",
                "additional_notes": "Please call before arrival.",
            },
        )
        self.assertEqual(submit_response.status_code, 201, submit_response.text)
        reference_number = submit_response.json()["reference_number"]
        self.assertTrue(reference_number.startswith("NXS"))

        lookup_response = self.client.post(
            "/booking-portal/status-lookup",
            json={
                "reference_number": reference_number,
                "email_address": "alex@example.com",
            },
        )
        self.assertEqual(lookup_response.status_code, 200, lookup_response.text)
        self.assertEqual(lookup_response.json()["status"], "Received")

        with SessionLocal() as db:
            booking_rows = db.query(BookingRequest).all()
            self.assertEqual(len(booking_rows), 1)
            self.assertEqual(booking_rows[0].service_names, ["Ceramic Coating", "Window Tint"])
            email_rows = db.query(EmailOutbox).all()
            self.assertEqual(len(email_rows), 2)
            customer_email = next(row for row in email_rows if row.recipient_email == "alex@example.com")
            self.assertIn("/book", customer_email.body)
            self.assertIn("/book/default/status?reference=", customer_email.body)
            self.assertIn("email=alex%40example.com", customer_email.body)

    def test_admin_can_update_booking_status(self):
        service_ids = self._service_ids()
        self.client.put(
            "/admin/booking-portal/settings",
            headers=self.admin_auth_header,
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
        submit_response = self.client.post(
            "/booking-portal/submit",
            json={
                "customer_full_name": "Alex Client",
                "phone_number": "+1(586) 556-0113",
                "email_address": "alex@example.com",
                "service_location_address": "123 Customer Road",
                "service_catalog_ids": [service_ids[0]],
                "asset_details": "Vehicle details here",
                "preferred_time_of_day": "afternoon",
            },
        )
        self.assertEqual(submit_response.status_code, 201, submit_response.text)

        list_response = self.client.get("/admin/booking-portal/requests", headers=self.admin_auth_header)
        self.assertEqual(list_response.status_code, 200, list_response.text)
        rows = list_response.json()
        self.assertEqual(len(rows), 1)

        update_response = self.client.patch(
            f"/admin/booking-portal/requests/{rows[0]['id']}",
            headers=self.admin_auth_header,
            json={
                "status": "JOB_SCHEDULED",
                "assigned_technician_first_name": "Mia",
                "estimated_completion_date": "2026-05-15",
            },
        )
        self.assertEqual(update_response.status_code, 200, update_response.text)
        self.assertEqual(update_response.json()["status"], "JOB_SCHEDULED")

        lookup_response = self.client.post(
            "/booking-portal/status-lookup",
            json={
                "reference_number": rows[0]["reference_number"],
                "email_address": rows[0]["email_address"],
            },
        )
        self.assertEqual(lookup_response.status_code, 200, lookup_response.text)
        self.assertEqual(lookup_response.json()["status"], "Job Scheduled")
        self.assertEqual(lookup_response.json()["assigned_technician_first_name"], "Mia")


if __name__ == "__main__":
    unittest.main()

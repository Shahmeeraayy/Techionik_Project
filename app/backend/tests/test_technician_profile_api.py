import os
import unittest
from datetime import date, timedelta
from uuid import uuid4

from fastapi.testclient import TestClient
from pydantic import ValidationError

_TEST_DB_FILE = os.path.join(os.path.dirname(__file__), "technician_profile_test.sqlite3")
if os.path.exists(_TEST_DB_FILE):
    os.remove(_TEST_DB_FILE)

os.environ["APP_ENV"] = "development"
os.environ["ALLOW_SQLITE_FOR_TESTS"] = "1"
os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_DB_FILE.replace(os.sep, '/')}"

from app.api.deps import SessionLocal, engine
from app.core.passwords import is_password_hash, verify_password
from app.main import app
from app.models.base import Base
from app.models.invoice import Invoice, InvoiceLineItem
from app.models.job import Job
from app.models.signup_request import SignupRequest
from app.models.technician import Technician
from app.models.technician_document import TechnicianDocument
from app.models.technician_email_change_request import TechnicianEmailChangeRequest
from app.models.technician_password_reset_request import TechnicianPasswordResetRequest
from app.models.time_off import TimeOff
from app.models.working_hours import WorkingHours
from app.schemas.technician_profile import TechnicianAvailabilityUpdateRequest


class TechnicianProfileApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)
        cls.client = TestClient(app)
        admin_token_response = cls.client.post(
            "/auth/dev/admin-token",
            json={"email": "admin@nexusops.com", "password": "NexusOps!Admin2026"},
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
            db.query(InvoiceLineItem).delete()
            db.query(Invoice).delete()
            db.query(Job).delete()
            db.query(SignupRequest).delete()
            db.query(TechnicianEmailChangeRequest).delete()
            db.query(TechnicianPasswordResetRequest).delete()
            db.query(TechnicianDocument).delete()
            db.query(TimeOff).delete()
            db.query(WorkingHours).delete()
            db.query(Technician).delete()
            db.commit()

    def _seed_technician(self, *, name: str, email: str, password: str = "tech123") -> Technician:
        with SessionLocal() as db:
            row = Technician(
                id=uuid4(),
                name=name,
                full_name=name,
                email=email.lower(),
                phone="+1-418-555-0101",
                status="active",
                password=password,
                manual_availability=True,
            )
            db.add(row)
            db.commit()
            db.refresh(row)
            return row

    def _technician_auth_header(self, *, email: str, password: str = "tech123") -> dict[str, str]:
        token_res = self.client.post(
            "/auth/dev/technician-token",
            json={"email": email, "password": password},
        )
        self.assertEqual(token_res.status_code, 200, token_res.text)
        return {"Authorization": f"Bearer {token_res.json()['access_token']}"}

    def test_dev_login_migrates_legacy_plaintext_password(self):
        tech = self._seed_technician(name="Legacy Tech", email="legacy@nexusops.com")

        self._technician_auth_header(email=tech.email, password="tech123")

        with SessionLocal() as db:
            row = db.query(Technician).filter(Technician.id == tech.id).first()
            self.assertIsNotNone(row)
            self.assertTrue(is_password_hash(row.password))
            self.assertNotEqual(row.password, "tech123")
            self.assertTrue(verify_password("tech123", row.password))

    def test_technician_can_change_password_and_store_hashed_secret(self):
        tech = self._seed_technician(name="Morgan", email="morgan@nexusops.com")
        tech_auth = self._technician_auth_header(email=tech.email)

        response = self.client.post(
            "/technicians/me/password",
            json={"current_password": "tech123", "new_password": "fresh-pass-789"},
            headers=tech_auth,
        )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["status"], "updated")

        new_auth = self._technician_auth_header(email=tech.email, password="fresh-pass-789")
        self.assertIn("Authorization", new_auth)

        with SessionLocal() as db:
            row = db.query(Technician).filter(Technician.id == tech.id).first()
            self.assertIsNotNone(row)
            self.assertTrue(is_password_hash(row.password))
            self.assertNotEqual(row.password, "fresh-pass-789")
            self.assertTrue(verify_password("fresh-pass-789", row.password))

    def test_availability_validation_rules(self):
        with self.assertRaises(ValidationError):
            TechnicianAvailabilityUpdateRequest(
                working_days=[],
                working_hours_start="08:00",
                working_hours_end="17:00",
                after_hours_enabled=False,
                out_of_office_ranges=[],
            )

        with self.assertRaises(ValidationError):
            TechnicianAvailabilityUpdateRequest(
                working_days=[0, 1],
                working_hours_start="17:00",
                working_hours_end="08:00",
                after_hours_enabled=False,
                out_of_office_ranges=[],
            )

        with self.assertRaises(ValidationError):
            TechnicianAvailabilityUpdateRequest(
                working_days=[0, 1],
                working_hours_start="08:00",
                working_hours_end="17:00",
                after_hours_enabled=False,
                out_of_office_ranges=[
                    {"start_date": str(date.today()), "end_date": str(date.today() + timedelta(days=2))},
                    {"start_date": str(date.today() + timedelta(days=1)), "end_date": str(date.today() + timedelta(days=3))},
                ],
            )

    def test_email_change_request_creates_pending_record(self):
        tech = self._seed_technician(name="Jolianne", email="jolianne@nexusops.com")
        tech_auth = self._technician_auth_header(email=tech.email)

        res = self.client.post(
            "/technicians/me/email-change-request",
            json={"requested_email": "jolianne.updated@nexusops.com"},
            headers=tech_auth,
        )
        self.assertEqual(res.status_code, 201, res.text)
        payload = res.json()
        self.assertEqual(payload["status"], "PENDING")
        self.assertEqual(payload["current_email"], "jolianne@nexusops.com")
        self.assertEqual(payload["requested_email"], "jolianne.updated@nexusops.com")

        me_res = self.client.get("/technicians/me", headers=tech_auth)
        self.assertEqual(me_res.status_code, 200, me_res.text)
        me_payload = me_res.json()
        self.assertEqual(me_payload["email"], "jolianne@nexusops.com")
        self.assertTrue(me_payload["has_pending_email_change_request"])

    def test_admin_approve_updates_email(self):
        tech = self._seed_technician(name="Victor", email="victor@nexusops.com")
        tech_auth = self._technician_auth_header(email=tech.email)

        request_res = self.client.post(
            "/technicians/me/email-change-request",
            json={"requested_email": "victor.new@nexusops.com"},
            headers=tech_auth,
        )
        self.assertEqual(request_res.status_code, 201, request_res.text)
        request_id = request_res.json()["id"]

        approve_res = self.client.post(
            f"/admin/email-change-requests/{request_id}/approve",
            json={"remarks": "Verified"},
            headers=self.admin_auth_header,
        )
        self.assertEqual(approve_res.status_code, 200, approve_res.text)
        self.assertEqual(approve_res.json()["status"], "APPROVED")

        me_res = self.client.get("/technicians/me", headers=tech_auth)
        self.assertEqual(me_res.status_code, 200, me_res.text)
        self.assertEqual(me_res.json()["email"], "victor.new@nexusops.com")

    def test_admin_reject_does_not_update_email(self):
        tech = self._seed_technician(name="Maxime", email="maxime@nexusops.com")
        tech_auth = self._technician_auth_header(email=tech.email)

        request_res = self.client.post(
            "/technicians/me/email-change-request",
            json={"requested_email": "maxime.new@nexusops.com"},
            headers=tech_auth,
        )
        self.assertEqual(request_res.status_code, 201, request_res.text)
        request_id = request_res.json()["id"]

        reject_res = self.client.post(
            f"/admin/email-change-requests/{request_id}/reject",
            json={"remarks": "Not approved"},
            headers=self.admin_auth_header,
        )
        self.assertEqual(reject_res.status_code, 200, reject_res.text)
        self.assertEqual(reject_res.json()["status"], "REJECTED")

        me_res = self.client.get("/technicians/me", headers=tech_auth)
        self.assertEqual(me_res.status_code, 200, me_res.text)
        self.assertEqual(me_res.json()["email"], "maxime@nexusops.com")

    def test_integration_availability_and_email_request_visible_to_admin(self):
        tech = self._seed_technician(name="Dany", email="dany@nexusops.com")
        tech_auth = self._technician_auth_header(email=tech.email)

        availability_res = self.client.put(
            "/technicians/me/availability",
            json={
                "working_days": [1, 2, 3, 4, 5],
                "working_hours_start": "08:00",
                "working_hours_end": "16:30",
                "after_hours_enabled": True,
                "out_of_office_ranges": [
                    {
                        "start_date": str(date.today() + timedelta(days=3)),
                        "end_date": str(date.today() + timedelta(days=4)),
                        "note": "Vacation",
                    }
                ],
            },
            headers=tech_auth,
        )
        self.assertEqual(availability_res.status_code, 200, availability_res.text)
        self.assertEqual(availability_res.json()["working_days"], [1, 2, 3, 4, 5])
        self.assertTrue(availability_res.json()["after_hours_enabled"])

        list_res = self.client.get("/admin/technicians", headers=self.admin_auth_header)
        self.assertEqual(list_res.status_code, 200, list_res.text)
        technician_row = next((row for row in list_res.json() if row["id"] == str(tech.id)), None)
        self.assertIsNotNone(technician_row)
        self.assertEqual(technician_row["working_days"], [1, 2, 3, 4, 5])
        self.assertTrue(technician_row["after_hours_enabled"])

        request_res = self.client.post(
            "/technicians/me/email-change-request",
            json={"requested_email": "dany.new@nexusops.com"},
            headers=tech_auth,
        )
        self.assertEqual(request_res.status_code, 201, request_res.text)
        request_id = request_res.json()["id"]

        list_with_pending_res = self.client.get("/admin/technicians", headers=self.admin_auth_header)
        self.assertEqual(list_with_pending_res.status_code, 200, list_with_pending_res.text)
        pending_row = next((row for row in list_with_pending_res.json() if row["id"] == str(tech.id)), None)
        self.assertIsNotNone(pending_row)
        self.assertTrue(pending_row["has_pending_email_change_request"])
        self.assertEqual(pending_row["pending_email_change_requested_email"], "dany.new@nexusops.com")

        approve_res = self.client.post(
            f"/admin/email-change-requests/{request_id}/approve",
            json={},
            headers=self.admin_auth_header,
        )
        self.assertEqual(approve_res.status_code, 200, approve_res.text)

        list_after_approve_res = self.client.get("/admin/technicians", headers=self.admin_auth_header)
        self.assertEqual(list_after_approve_res.status_code, 200, list_after_approve_res.text)
        approved_row = next((row for row in list_after_approve_res.json() if row["id"] == str(tech.id)), None)
        self.assertIsNotNone(approved_row)
        self.assertFalse(approved_row["has_pending_email_change_request"])
        self.assertEqual(approved_row["email"], "dany.new@nexusops.com")

    def test_admin_can_update_v1_profile_fields(self):
        tech = self._seed_technician(name="Robin", email="robin@nexusops.com")

        update_res = self.client.put(
            f"/admin/technicians/{tech.id}",
            json={
                "emergency_contact_name": "Casey Robin",
                "emergency_contact_phone": "+14185550123",
                "emergency_contact_relationship": "Sibling",
                "employment_status": "part_time",
            },
            headers=self.admin_auth_header,
        )
        self.assertEqual(update_res.status_code, 200, update_res.text)
        payload = update_res.json()
        self.assertEqual(payload["emergency_contact_name"], "Casey Robin")
        self.assertEqual(payload["emergency_contact_phone"], "+14185550123")
        self.assertEqual(payload["emergency_contact_relationship"], "Sibling")
        self.assertEqual(payload["employment_status"], "part_time")

        profile_res = self.client.get(f"/admin/technicians/{tech.id}", headers=self.admin_auth_header)
        self.assertEqual(profile_res.status_code, 200, profile_res.text)
        profile_payload = profile_res.json()
        self.assertEqual(profile_payload["emergency_contact_name"], "Casey Robin")
        self.assertEqual(profile_payload["employment_status"], "part_time")

        invalid_res = self.client.put(
            f"/admin/technicians/{tech.id}",
            json={"employment_status": "seasonal"},
            headers=self.admin_auth_header,
        )
        self.assertEqual(invalid_res.status_code, 422, invalid_res.text)

    def test_admin_can_manage_technician_documents(self):
        tech = self._seed_technician(name="License Tech", email="license-tech@nexusops.com")

        create_res = self.client.post(
            f"/admin/technicians/{tech.id}/documents",
            json={
                "document_name": "Roadside Assistance License",
                "document_type": "license",
                "license_number": "LIC-2026-001",
                "expiry_date": str(date.today() + timedelta(days=365)),
                "file_url": "https://example.com/licenses/LIC-2026-001.pdf",
            },
            headers=self.admin_auth_header,
        )
        self.assertEqual(create_res.status_code, 201, create_res.text)
        document_payload = create_res.json()
        self.assertEqual(document_payload["document_name"], "Roadside Assistance License")
        self.assertEqual(document_payload["document_type"], "license")
        self.assertEqual(document_payload["license_number"], "LIC-2026-001")

        list_res = self.client.get(f"/admin/technicians/{tech.id}/documents", headers=self.admin_auth_header)
        self.assertEqual(list_res.status_code, 200, list_res.text)
        self.assertEqual(len(list_res.json()), 1)

        profile_res = self.client.get(f"/admin/technicians/{tech.id}", headers=self.admin_auth_header)
        self.assertEqual(profile_res.status_code, 200, profile_res.text)
        self.assertEqual(profile_res.json()["documents"][0]["id"], document_payload["id"])

        update_res = self.client.put(
            f"/admin/technicians/{tech.id}/documents/{document_payload['id']}",
            json={"document_type": "certification", "license_number": "CERT-2026-002"},
            headers=self.admin_auth_header,
        )
        self.assertEqual(update_res.status_code, 200, update_res.text)
        self.assertEqual(update_res.json()["document_type"], "certification")
        self.assertEqual(update_res.json()["license_number"], "CERT-2026-002")

        delete_res = self.client.delete(
            f"/admin/technicians/{tech.id}/documents/{document_payload['id']}",
            headers=self.admin_auth_header,
        )
        self.assertEqual(delete_res.status_code, 200, delete_res.text)

        empty_res = self.client.get(f"/admin/technicians/{tech.id}/documents", headers=self.admin_auth_header)
        self.assertEqual(empty_res.status_code, 200, empty_res.text)
        self.assertEqual(empty_res.json(), [])


if __name__ == "__main__":
    unittest.main()

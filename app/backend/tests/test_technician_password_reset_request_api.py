import os
import unittest
from uuid import uuid4

from fastapi.testclient import TestClient

_TEST_DB_FILE = os.path.join(os.path.dirname(__file__), "technician_password_reset_request_test.sqlite3")
if os.path.exists(_TEST_DB_FILE):
    os.remove(_TEST_DB_FILE)

os.environ["APP_ENV"] = "development"
os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_DB_FILE.replace(os.sep, '/')}"

from app.api.deps import SessionLocal, engine
from app.main import app
from app.models.base import Base
from app.models.technician import Technician
from app.models.technician_password_reset_request import TechnicianPasswordResetRequest


class TechnicianPasswordResetRequestApiTests(unittest.TestCase):
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
            db.query(TechnicianPasswordResetRequest).delete()
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

    def test_public_request_creates_pending_admin_item(self):
        tech = self._seed_technician(name="Dany", email="dany@nexusops.com")

        response = self.client.post(
            "/auth/technician-password-reset-request",
            json={"email": tech.email},
        )

        self.assertEqual(response.status_code, 202, response.text)
        self.assertEqual(
            response.json()["message"],
            "If an account exists for that email, the admin team has been notified.",
        )

        with SessionLocal() as db:
            rows = db.query(TechnicianPasswordResetRequest).all()
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0].technician_id, tech.id)
            self.assertEqual(rows[0].requested_email, tech.email)
            self.assertEqual(rows[0].status, "PENDING")

    def test_repeated_request_refreshes_existing_pending_row(self):
        tech = self._seed_technician(name="Maxime", email="maxime@nexusops.com")

        first_response = self.client.post(
            "/auth/technician-password-reset-request",
            json={"email": tech.email},
        )
        self.assertEqual(first_response.status_code, 202, first_response.text)

        second_response = self.client.post(
            "/auth/technician-password-reset-request",
            json={"email": tech.email.upper()},
        )
        self.assertEqual(second_response.status_code, 202, second_response.text)

        with SessionLocal() as db:
            rows = db.query(TechnicianPasswordResetRequest).all()
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0].requested_email, tech.email)

    def test_admin_can_list_and_resolve_request(self):
        tech = self._seed_technician(name="Victor", email="victor@nexusops.com")
        create_response = self.client.post(
            "/auth/technician-password-reset-request",
            json={"email": tech.email},
        )
        self.assertEqual(create_response.status_code, 202, create_response.text)

        list_response = self.client.get(
            "/admin/technician-password-reset-requests",
            headers=self.admin_auth_header,
        )
        self.assertEqual(list_response.status_code, 200, list_response.text)
        rows = list_response.json()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["technician_email"], tech.email)
        self.assertEqual(rows[0]["status"], "PENDING")

        resolve_response = self.client.post(
            f"/admin/technician-password-reset-requests/{rows[0]['id']}/resolve",
            headers=self.admin_auth_header,
            json={"remarks": "Password updated by admin."},
        )
        self.assertEqual(resolve_response.status_code, 200, resolve_response.text)
        self.assertEqual(resolve_response.json()["status"], "RESOLVED")
        self.assertEqual(resolve_response.json()["remarks"], "Password updated by admin.")

        pending_after_response = self.client.get(
            "/admin/technician-password-reset-requests",
            headers=self.admin_auth_header,
        )
        self.assertEqual(pending_after_response.status_code, 200, pending_after_response.text)
        self.assertEqual(pending_after_response.json(), [])

    def test_admin_can_issue_reset_link_and_technician_can_complete_reset(self):
        tech = self._seed_technician(name="Alex", email="alex@nexusops.com", password="old-pass-123")

        issue_response = self.client.post(
            "/admin/technician-password-reset-requests/issue",
            headers=self.admin_auth_header,
            json={"technician_id": str(tech.id)},
        )
        self.assertEqual(issue_response.status_code, 200, issue_response.text)
        issued = issue_response.json()
        self.assertEqual(issued["request"]["technician_email"], tech.email)
        self.assertTrue(issued["reset_url"].endswith(issued["request"]["id"]))

        validate_response = self.client.get(
            f"/auth/technician-password-reset-request/{issued['request']['id']}",
        )
        self.assertEqual(validate_response.status_code, 200, validate_response.text)
        self.assertEqual(validate_response.json()["technician_email"], tech.email)

        complete_response = self.client.post(
            f"/auth/technician-password-reset-request/{issued['request']['id']}/complete",
            json={"new_password": "new-pass-789"},
        )
        self.assertEqual(complete_response.status_code, 200, complete_response.text)
        self.assertEqual(
            complete_response.json()["message"],
            "Your password has been reset. You can sign in with the new password now.",
        )

        login_response = self.client.post(
            "/auth/technician-token",
            json={"email": tech.email, "password": "new-pass-789"},
        )
        self.assertEqual(login_response.status_code, 200, login_response.text)

        with SessionLocal() as db:
            row = db.query(TechnicianPasswordResetRequest).first()
            self.assertIsNotNone(row)
            self.assertEqual(row.status, "RESOLVED")
            self.assertEqual(row.remarks, "Resolved via technician reset link.")

    def test_admin_password_update_auto_resolves_pending_request(self):
        tech = self._seed_technician(name="Jolianne", email="jolianne@nexusops.com")
        create_response = self.client.post(
            "/auth/technician-password-reset-request",
            json={"email": tech.email},
        )
        self.assertEqual(create_response.status_code, 202, create_response.text)

        update_response = self.client.put(
            f"/admin/technicians/{tech.id}",
            headers=self.admin_auth_header,
            json={
                "name": "Jolianne",
                "email": tech.email,
                "phone": "+1-418-555-0101",
                "password": "new-pass-456",
                "status": "active",
            },
        )
        self.assertEqual(update_response.status_code, 200, update_response.text)

        pending_after_response = self.client.get(
            "/admin/technician-password-reset-requests",
            headers=self.admin_auth_header,
        )
        self.assertEqual(pending_after_response.status_code, 200, pending_after_response.text)
        self.assertEqual(pending_after_response.json(), [])

        resolved_response = self.client.get(
            "/admin/technician-password-reset-requests?status=RESOLVED",
            headers=self.admin_auth_header,
        )
        self.assertEqual(resolved_response.status_code, 200, resolved_response.text)
        rows = resolved_response.json()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["status"], "RESOLVED")
        self.assertEqual(rows[0]["remarks"], "Resolved when admin updated technician password.")


if __name__ == "__main__":
    unittest.main()


import os
import unittest

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

_TEST_DB_FILE = os.path.join(os.path.dirname(__file__), "signup_request_routing_test.sqlite3")
if os.path.exists(_TEST_DB_FILE):
    os.remove(_TEST_DB_FILE)

os.environ["APP_ENV"] = "development"
os.environ["ALLOW_SQLITE_FOR_TESTS"] = "1"
os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_DB_FILE.replace(os.sep, '/')}"

from app.api.deps import engine
from app.main import app
from app.models.admin_credential_settings import AdminCredentialSettings
from app.models.admin_user import AdminUser
from app.models.base import Base
from app.models.email_outbox import EmailOutbox
from app.models.signup_request import SignupRequest
from app.models.tenant import Tenant, TenantMembership
from app.models.technician import Technician


class SignupRequestRoutingApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        engine.dispose()
        if os.path.exists(_TEST_DB_FILE):
            os.remove(_TEST_DB_FILE)

    def setUp(self):
        with engine.begin() as conn:
            conn.execute(TenantMembership.__table__.delete())
            conn.execute(EmailOutbox.__table__.delete())
            conn.execute(SignupRequest.__table__.delete())
            conn.execute(Technician.__table__.delete())
            conn.execute(AdminUser.__table__.delete())
            conn.execute(AdminCredentialSettings.__table__.delete())
            conn.execute(Tenant.__table__.delete())

    def _signup_owner(self) -> dict:
        response = self.client.post(
            "/auth/admin-signup",
            json={
                "company_name": "Ehtix Dispatch",
                "workspace_slug": "ehtix-dispatch",
                "full_name": "Ehtisham Imtiaz",
                "email": "ehtix@gmail.com",
                "password": "family0011",
            },
        )
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    def test_public_technician_self_signup_is_disabled(self):
        self._signup_owner()

        create_response = self.client.post(
            "/auth/technician-signup-request",
            json={
                "name": "Field Tech One",
                "admin_email": "ehtix@gmail.com",
                "email": "tech1@example.com",
                "phone": "+15550001111",
                "password": "secret123",
            },
        )

        self.assertEqual(create_response.status_code, 403, create_response.text)
        self.assertIn("self-signup is disabled", create_response.json()["detail"])

    def test_admin_can_create_technician_account_directly(self):
        owner_signup = self._signup_owner()
        owner_token = owner_signup["access_token"]

        create_response = self.client.post(
            "/admin/technicians",
            headers={"Authorization": f"Bearer {owner_token}"},
            json={
                "name": "Field Tech Two",
                "email": "tech2@example.com",
                "phone": "+15550002222",
                "password": "secret123",
                "status": "active",
                "manual_availability": True,
            },
        )

        self.assertEqual(create_response.status_code, 201, create_response.text)
        payload = create_response.json()
        self.assertEqual(payload["name"], "Field Tech Two")
        self.assertEqual(payload["email"], "tech2@example.com")
        self.assertEqual(payload["status"], "active")

    def test_admin_created_technician_can_log_in(self):
        owner_signup = self._signup_owner()
        owner_token = owner_signup["access_token"]

        create_response = self.client.post(
            "/admin/technicians",
            headers={"Authorization": f"Bearer {owner_token}"},
            json={
                "name": "Field Tech Login",
                "email": "tech-login@example.com",
                "phone": "+15550003333",
                "password": "secret123",
                "status": "active",
                "manual_availability": True,
            },
        )
        self.assertEqual(create_response.status_code, 201, create_response.text)

        login_response = self.client.post(
            "/auth/technician-token",
            json={"email": "tech-login@example.com", "password": "secret123"},
        )
        self.assertEqual(login_response.status_code, 200, login_response.text)
        payload = login_response.json()
        self.assertEqual(payload["role"], "technician")
        self.assertEqual(payload["user_email"], "tech-login@example.com")
        self.assertEqual(payload["tenant_id"], owner_signup["tenant_id"])

    def test_admin_can_create_technician_with_v1_profile_fields(self):
        owner_signup = self._signup_owner()
        owner_token = owner_signup["access_token"]

        create_response = self.client.post(
            "/admin/technicians",
            headers={"Authorization": f"Bearer {owner_token}"},
            json={
                "name": "Field Tech Complete",
                "email": "tech-complete@example.com",
                "phone": "+15550004444",
                "password": "secret123",
                "status": "active",
                "manual_availability": True,
                "emergency_contact_name": "Avery Complete",
                "emergency_contact_phone": "+15550004555",
                "emergency_contact_relationship": "Spouse",
                "employment_status": "contractor",
            },
        )

        self.assertEqual(create_response.status_code, 201, create_response.text)
        payload = create_response.json()
        self.assertEqual(payload["status"], "active")
        self.assertEqual(payload["emergency_contact_name"], "Avery Complete")
        self.assertEqual(payload["emergency_contact_phone"], "+15550004555")
        self.assertEqual(payload["emergency_contact_relationship"], "Spouse")
        self.assertEqual(payload["employment_status"], "contractor")

        profile_response = self.client.get(
            f"/admin/technicians/{payload['id']}",
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        self.assertEqual(profile_response.status_code, 200, profile_response.text)
        profile_payload = profile_response.json()
        self.assertEqual(profile_payload["emergency_contact_name"], "Avery Complete")
        self.assertEqual(profile_payload["employment_status"], "contractor")
        self.assertEqual(profile_payload["documents"], [])

    def test_suspended_status_blocks_login_and_legacy_deactivated_maps(self):
        owner_signup = self._signup_owner()
        owner_token = owner_signup["access_token"]

        create_response = self.client.post(
            "/admin/technicians",
            headers={"Authorization": f"Bearer {owner_token}"},
            json={
                "name": "Field Tech Suspended",
                "email": "tech-suspended@example.com",
                "phone": "+15550006666",
                "password": "secret123",
                "status": "active",
                "manual_availability": True,
            },
        )
        self.assertEqual(create_response.status_code, 201, create_response.text)
        technician_id = create_response.json()["id"]

        suspend_response = self.client.put(
            f"/admin/technicians/{technician_id}",
            headers={"Authorization": f"Bearer {owner_token}"},
            json={"status": "deactivated"},
        )
        self.assertEqual(suspend_response.status_code, 200, suspend_response.text)
        self.assertEqual(suspend_response.json()["status"], "suspended")

        blocked_login = self.client.post(
            "/auth/technician-token",
            json={"email": "tech-suspended@example.com", "password": "secret123"},
        )
        self.assertEqual(blocked_login.status_code, 403, blocked_login.text)
        self.assertIn("suspended", blocked_login.json()["detail"])

        activate_response = self.client.put(
            f"/admin/technicians/{technician_id}",
            headers={"Authorization": f"Bearer {owner_token}"},
            json={"status": "active"},
        )
        self.assertEqual(activate_response.status_code, 200, activate_response.text)
        self.assertEqual(activate_response.json()["status"], "active")

        login_response = self.client.post(
            "/auth/technician-token",
            json={"email": "tech-suspended@example.com", "password": "secret123"},
        )
        self.assertEqual(login_response.status_code, 200, login_response.text)


if __name__ == "__main__":
    unittest.main()

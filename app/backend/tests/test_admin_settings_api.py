import os
import unittest

from fastapi.testclient import TestClient

_TEST_DB_FILE = os.path.join(os.path.dirname(__file__), "admin_settings_test.sqlite3")
if os.path.exists(_TEST_DB_FILE):
    os.remove(_TEST_DB_FILE)

os.environ["APP_ENV"] = "development"
os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_DB_FILE.replace(os.sep, '/')}"

from app.api.deps import engine
from app.main import app
from app.models.admin_credential_settings import AdminCredentialSettings
from app.models.admin_user import AdminUser
from app.models.base import Base
from app.models.tenant import Tenant, TenantMembership


class AdminSettingsApiTests(unittest.TestCase):
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
            conn.execute(AdminUser.__table__.delete())
            conn.execute(AdminCredentialSettings.__table__.delete())
            conn.execute(Tenant.__table__.delete())

    def _admin_token(self, email: str = "admin@nexusops.com", password: str = "admin123") -> str:
        response = self.client.post(
            "/auth/admin-token",
            json={"email": email, "password": password},
        )
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()["access_token"]

    def test_admin_credentials_settings_updates_admin_email_and_password(self):
        token = self._admin_token()

        response = self.client.get(
            "/admin/settings/admin-credentials",
            headers={"Authorization": f"Bearer {token}"},
        )

        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertEqual(payload["admin_email"], "admin@nexusops.com")
        self.assertEqual(payload["tenant_role"], "owner")
        self.assertIn("password_changed_at", payload)
        self.assertIn("updated_at", payload)

        update_response = self.client.put(
            "/admin/settings/admin-credentials",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "admin_email": "owner@nexusops.com",
                "current_password": "admin123",
                "new_password": "newpass123",
            },
        )

        self.assertEqual(update_response.status_code, 200, update_response.text)
        updated_payload = update_response.json()
        self.assertEqual(updated_payload["admin_email"], "owner@nexusops.com")
        self.assertIn("password_changed_at", updated_payload)
        self.assertIn("updated_at", updated_payload)

        refreshed_response = self.client.get(
            "/admin/settings/admin-credentials",
            headers={"Authorization": f"Bearer {token}"},
        )
        self.assertEqual(refreshed_response.status_code, 200, refreshed_response.text)
        refreshed_payload = refreshed_response.json()
        self.assertEqual(refreshed_payload["admin_email"], "owner@nexusops.com")
        self.assertIn("password_changed_at", refreshed_payload)
        self.assertIn("updated_at", refreshed_payload)

        new_login_response = self.client.post(
            "/auth/admin-token",
            json={"email": "owner@nexusops.com", "password": "newpass123"},
        )
        self.assertEqual(new_login_response.status_code, 200, new_login_response.text)

    def test_owner_can_create_second_admin_and_new_admin_can_login(self):
        token = self._admin_token()

        create_response = self.client.post(
            "/admin/settings/admin-users",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "full_name": "Dispatch Manager",
                "email": "manager@nexusops.com",
                "password": "manager123",
                "tenant_role": "admin",
            },
        )
        self.assertEqual(create_response.status_code, 201, create_response.text)
        created_payload = create_response.json()
        self.assertEqual(created_payload["email"], "manager@nexusops.com")
        self.assertEqual(created_payload["tenant_role"], "admin")

        list_response = self.client.get(
            "/admin/settings/admin-users",
            headers={"Authorization": f"Bearer {token}"},
        )
        self.assertEqual(list_response.status_code, 200, list_response.text)
        rows = list_response.json()
        self.assertEqual(len(rows), 2)

        login_response = self.client.post(
            "/auth/admin-token",
            json={"email": "manager@nexusops.com", "password": "manager123"},
        )
        self.assertEqual(login_response.status_code, 200, login_response.text)

    def test_dev_admin_token_stays_development_only(self):
        response = self.client.post(
            "/auth/dev/admin-token",
            json={"email": "admin@nexusops.com", "password": "admin123"},
        )
        self.assertNotEqual(response.status_code, 404, response.text)

    def test_public_admin_signup_creates_owner_tenant_and_can_login(self):
        signup_response = self.client.post(
            "/auth/admin-signup",
            json={
                "company_name": "Northstar Dispatch",
                "workspace_slug": "northstar-dispatch",
                "full_name": "Avery Stone",
                "email": "avery@northstar.com",
                "password": "owner123",
            },
        )

        self.assertEqual(signup_response.status_code, 201, signup_response.text)
        payload = signup_response.json()
        self.assertEqual(payload["role"], "admin")
        self.assertEqual(payload["tenant_role"], "owner")
        self.assertEqual(payload["user_email"], "avery@northstar.com")

        login_response = self.client.post(
            "/auth/admin-token",
            json={"email": "avery@northstar.com", "password": "owner123"},
        )
        self.assertEqual(login_response.status_code, 200, login_response.text)

    def test_public_admin_signup_rejects_duplicate_email_and_workspace_slug(self):
        first_signup = self.client.post(
            "/auth/admin-signup",
            json={
                "company_name": "Northstar Dispatch",
                "workspace_slug": "northstar-dispatch",
                "full_name": "Avery Stone",
                "email": "avery@northstar.com",
                "password": "owner123",
            },
        )
        self.assertEqual(first_signup.status_code, 201, first_signup.text)

        duplicate_email = self.client.post(
            "/auth/admin-signup",
            json={
                "company_name": "Other Dispatch",
                "workspace_slug": "other-dispatch",
                "full_name": "Avery Stone",
                "email": "avery@northstar.com",
                "password": "owner123",
            },
        )
        self.assertEqual(duplicate_email.status_code, 409, duplicate_email.text)

        duplicate_slug = self.client.post(
            "/auth/admin-signup",
            json={
                "company_name": "Other Dispatch",
                "workspace_slug": "northstar-dispatch",
                "full_name": "Casey Harper",
                "email": "casey@other.com",
                "password": "owner123",
            },
        )
        self.assertEqual(duplicate_slug.status_code, 409, duplicate_slug.text)


if __name__ == "__main__":
    unittest.main()


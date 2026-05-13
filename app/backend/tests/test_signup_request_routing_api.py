import os
import unittest

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

_TEST_DB_FILE = os.path.join(os.path.dirname(__file__), "signup_request_routing_test.sqlite3")
if os.path.exists(_TEST_DB_FILE):
    os.remove(_TEST_DB_FILE)

os.environ["APP_ENV"] = "development"
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

    def _default_admin_token(self) -> str:
        response = self.client.post(
            "/auth/admin-token",
            json={"email": "admin@nexusops.com", "password": "admin123"},
        )
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()["access_token"]

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

    def test_signup_request_routes_to_tenant_owner_and_not_default_admin(self):
        owner_signup = self._signup_owner()
        owner_token = owner_signup["access_token"]

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
        self.assertEqual(create_response.status_code, 201, create_response.text)
        created_request = create_response.json()

        owner_list = self.client.get(
            "/admin/technician-signup-requests?status=pending",
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        self.assertEqual(owner_list.status_code, 200, owner_list.text)
        owner_rows = owner_list.json()
        self.assertEqual(len(owner_rows), 1)
        self.assertEqual(owner_rows[0]["id"], created_request["id"])

        default_admin_list = self.client.get(
            "/admin/technician-signup-requests?status=pending",
            headers={"Authorization": f"Bearer {self._default_admin_token()}"},
        )
        self.assertEqual(default_admin_list.status_code, 200, default_admin_list.text)
        self.assertEqual(default_admin_list.json(), [])

        with Session(engine) as session:
            queued_emails = (
                session.query(EmailOutbox)
                .filter(EmailOutbox.related_entity_id == created_request["id"])
                .order_by(EmailOutbox.recipient_email.asc())
                .all()
            )

        self.assertEqual(len(queued_emails), 1)
        self.assertEqual(queued_emails[0].recipient_email, "ehtix@gmail.com")
        self.assertNotEqual(queued_emails[0].recipient_email, "admin@nexusops.com")

    def test_viewer_cannot_review_signup_requests(self):
        owner_signup = self._signup_owner()
        owner_token = owner_signup["access_token"]

        create_response = self.client.post(
            "/auth/technician-signup-request",
            json={
                "name": "Field Tech Two",
                "admin_email": "ehtix@gmail.com",
                "email": "tech2@example.com",
                "phone": "+15550002222",
                "password": "secret123",
            },
        )
        self.assertEqual(create_response.status_code, 201, create_response.text)
        request_id = create_response.json()["id"]

        create_viewer = self.client.post(
            "/admin/settings/admin-users",
            headers={"Authorization": f"Bearer {owner_token}"},
            json={
                "full_name": "Read Only User",
                "email": "viewer@ehtix.com",
                "password": "viewer123",
                "tenant_role": "viewer",
            },
        )
        self.assertEqual(create_viewer.status_code, 201, create_viewer.text)

        viewer_login = self.client.post(
            "/auth/admin-token",
            json={"email": "viewer@ehtix.com", "password": "viewer123"},
        )
        self.assertEqual(viewer_login.status_code, 200, viewer_login.text)
        viewer_token = viewer_login.json()["access_token"]

        list_response = self.client.get(
            "/admin/technician-signup-requests?status=pending",
            headers={"Authorization": f"Bearer {viewer_token}"},
        )
        self.assertEqual(list_response.status_code, 403, list_response.text)

        approve_response = self.client.post(
            f"/admin/technician-signup-requests/{request_id}/approve",
            headers={"Authorization": f"Bearer {viewer_token}"},
        )
        self.assertEqual(approve_response.status_code, 403, approve_response.text)

    def test_approved_technician_can_log_in_after_tenant_routed_signup(self):
        owner_signup = self._signup_owner()
        owner_token = owner_signup["access_token"]

        create_response = self.client.post(
            "/auth/technician-signup-request",
            json={
                "name": "Field Tech Login",
                "admin_email": "ehtix@gmail.com",
                "email": "tech-login@example.com",
                "phone": "+15550003333",
                "password": "secret123",
            },
        )
        self.assertEqual(create_response.status_code, 201, create_response.text)
        request_id = create_response.json()["id"]

        approve_response = self.client.post(
            f"/admin/technician-signup-requests/{request_id}/approve",
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        self.assertEqual(approve_response.status_code, 200, approve_response.text)

        login_response = self.client.post(
            "/auth/technician-token",
            json={"email": "tech-login@example.com", "password": "secret123"},
        )
        self.assertEqual(login_response.status_code, 200, login_response.text)
        payload = login_response.json()
        self.assertEqual(payload["role"], "technician")
        self.assertEqual(payload["user_email"], "tech-login@example.com")
        self.assertEqual(payload["tenant_id"], owner_signup["tenant_id"])


if __name__ == "__main__":
    unittest.main()


import os
import unittest
from uuid import UUID, uuid4

from fastapi.testclient import TestClient

_TEST_DB_FILE = os.path.join(os.path.dirname(__file__), "super_admin_test.sqlite3")
if os.path.exists(_TEST_DB_FILE):
    os.remove(_TEST_DB_FILE)

os.environ["APP_ENV"] = "development"
os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_DB_FILE.replace(os.sep, '/')}"

from app.api.deps import SessionLocal, engine
from app.main import app
from app.models.admin_user import AdminUser
from app.models.audit_log import AuditLog
from app.models.base import Base
from app.models.platform_audit_log import PlatformAuditLog
from app.models.platform_settings import PlatformSettings
from app.models.platform_user import PlatformUser
from app.models.technician import Technician
from app.models.tenant import Tenant, TenantMembership
from app.models.tenant_feature_override import TenantFeatureOverride


class SuperAdminApiTests(unittest.TestCase):
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
            conn.execute(TenantFeatureOverride.__table__.delete())
            conn.execute(PlatformSettings.__table__.delete())
            conn.execute(PlatformAuditLog.__table__.delete())
            conn.execute(AuditLog.__table__.delete())
            conn.execute(TenantMembership.__table__.delete())
            conn.execute(Technician.__table__.delete())
            conn.execute(AdminUser.__table__.delete())
            conn.execute(PlatformUser.__table__.delete())
            conn.execute(Tenant.__table__.delete())

    def _signup_tenant_owner(self, workspace_slug: str = "northstar-platform", email: str = "owner@northstar.com"):
        response = self.client.post(
            "/auth/admin-signup",
            json={
                "company_name": "Northstar Platform",
                "workspace_slug": workspace_slug,
                "full_name": "Avery Stone",
                "email": email,
                "password": "owner123",
            },
        )
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    def _super_admin_token(self) -> str:
        response = self.client.post(
            "/auth/super-admin-token",
            json={
                "email": "root@nexusops.com",
                "password": "superadmin123",
            },
        )
        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertEqual(payload["role"], "super_admin")
        self.assertEqual(payload["platform_role"], "super_admin")
        return payload["access_token"]

    def _seed_technician(
        self,
        *,
        tenant_id: str,
        name: str = "Taylor Field",
        email: str = "tech@northstar.com",
        password: str = "tech123",
    ) -> Technician:
        with SessionLocal() as db:
            row = Technician(
                id=uuid4(),
                tenant_id=UUID(tenant_id),
                name=name,
                full_name=name,
                email=email.lower(),
                phone="+1-415-555-0111",
                status="active",
                password=password,
                manual_availability=True,
            )
            db.add(row)
            db.commit()
            db.refresh(row)
            return row

    def _technician_token(self, *, email: str, password: str = "tech123") -> str:
        response = self.client.post(
            "/auth/dev/technician-token",
            json={"email": email, "password": password},
        )
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()["access_token"]

    def test_super_admin_can_authenticate_and_view_platform_dashboard(self):
        signup_payload = self._signup_tenant_owner()
        token = self._super_admin_token()

        dashboard_response = self.client.get(
            "/super-admin/dashboard",
            headers={"Authorization": f"Bearer {token}"},
        )
        self.assertEqual(dashboard_response.status_code, 200, dashboard_response.text)
        dashboard_payload = dashboard_response.json()
        self.assertEqual(dashboard_payload["metrics"]["total_tenants"], 1)
        self.assertEqual(dashboard_payload["metrics"]["trial_tenants"], 1)

        tenants_response = self.client.get(
            "/super-admin/tenants",
            headers={"Authorization": f"Bearer {token}"},
        )
        self.assertEqual(tenants_response.status_code, 200, tenants_response.text)
        tenants_payload = tenants_response.json()
        self.assertEqual(len(tenants_payload), 1)
        self.assertEqual(tenants_payload[0]["owner_email"], signup_payload["user_email"])

    def test_super_admin_session_endpoint_returns_platform_identity(self):
        token = self._super_admin_token()

        session_response = self.client.get(
            "/auth/super-admin-session",
            headers={"Authorization": f"Bearer {token}"},
        )
        self.assertEqual(session_response.status_code, 200, session_response.text)
        payload = session_response.json()
        self.assertEqual(payload["role"], "super_admin")
        self.assertEqual(payload["platform_role"], "super_admin")
        self.assertEqual(payload["user_email"], "root@nexusops.com")

    def test_super_admin_login_rejects_tenant_credentials(self):
        self._signup_tenant_owner(workspace_slug="not-platform", email="owner@notplatform.com")

        login_response = self.client.post(
            "/auth/super-admin-token",
            json={
                "email": "owner@notplatform.com",
                "password": "owner123",
            },
        )
        self.assertEqual(login_response.status_code, 401, login_response.text)

    def test_suspending_tenant_blocks_tenant_admin_login(self):
        signup_payload = self._signup_tenant_owner(workspace_slug="suspend-me", email="owner@suspendme.com")
        token = self._super_admin_token()

        suspend_response = self.client.post(
            f"/super-admin/tenants/{signup_payload['tenant_id']}/status",
            headers={"Authorization": f"Bearer {token}"},
            json={"status": "suspended", "reason": "Failed payment review"},
        )
        self.assertEqual(suspend_response.status_code, 200, suspend_response.text)
        self.assertEqual(suspend_response.json()["tenant"]["platform_status"], "suspended")

        login_response = self.client.post(
            "/auth/admin-token",
            json={"email": "owner@suspendme.com", "password": "owner123"},
        )
        self.assertEqual(login_response.status_code, 403, login_response.text)

    def test_tenant_admin_is_blocked_from_super_admin_endpoints(self):
        signup_payload = self._signup_tenant_owner(workspace_slug="admin-blocked", email="owner@blocked.com")

        dashboard_response = self.client.get(
            "/super-admin/dashboard",
            headers={"Authorization": f"Bearer {signup_payload['access_token']}"},
        )
        self.assertEqual(dashboard_response.status_code, 403, dashboard_response.text)
        self.assertIn("Super Admin access is required", dashboard_response.text)

    def test_super_admin_can_update_platform_settings_with_audit_log(self):
        token = self._super_admin_token()

        get_response = self.client.get(
            "/super-admin/platform-settings",
            headers={"Authorization": f"Bearer {token}"},
        )
        self.assertEqual(get_response.status_code, 200, get_response.text)
        settings_payload = get_response.json()["settings"]
        self.assertEqual(settings_payload["general"]["platform_name"], "NexusOps")

        settings_payload["general"]["platform_name"] = "NexusOps Command"
        settings_payload["security"]["session_timeout_minutes"] = 45

        rejected_response = self.client.put(
            "/super-admin/platform-settings",
            headers={"Authorization": f"Bearer {token}"},
            json={"settings": settings_payload, "reason": "Updating global platform defaults."},
        )
        self.assertEqual(rejected_response.status_code, 422, rejected_response.text)

        update_response = self.client.put(
            "/super-admin/platform-settings",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "settings": settings_payload,
                "reason": "Updating global platform defaults.",
                "sensitive_confirmation": "Security timeout reviewed by platform owner.",
            },
        )
        self.assertEqual(update_response.status_code, 200, update_response.text)
        updated_payload = update_response.json()
        self.assertEqual(updated_payload["settings"]["general"]["platform_name"], "NexusOps Command")
        self.assertEqual(updated_payload["settings"]["security"]["session_timeout_minutes"], 45)

        with SessionLocal() as db:
            audit_row = (
                db.query(PlatformAuditLog)
                .filter(PlatformAuditLog.module == "platform_settings")
                .order_by(PlatformAuditLog.created_at.desc())
                .first()
            )
            self.assertIsNotNone(audit_row)
            self.assertEqual(audit_row.action, "platform_settings_updated")
            self.assertEqual(audit_row.reason, "Updating global platform defaults.")
            self.assertIn("security", audit_row.metadata_json["sensitive_sections"])

    def test_break_glass_access_requires_reason_and_returns_sensitive_sections(self):
        signup_payload = self._signup_tenant_owner(workspace_slug="audit-me", email="owner@auditme.com")
        token = self._super_admin_token()

        invalid_response = self.client.post(
            f"/super-admin/tenants/{signup_payload['tenant_id']}/break-glass-access",
            headers={"Authorization": f"Bearer {token}"},
            json={"reason": "no"},
        )
        self.assertEqual(invalid_response.status_code, 422, invalid_response.text)

        valid_response = self.client.post(
            f"/super-admin/tenants/{signup_payload['tenant_id']}/break-glass-access",
            headers={"Authorization": f"Bearer {token}"},
            json={"reason": "Investigating a tenant security escalation."},
        )
        self.assertEqual(valid_response.status_code, 200, valid_response.text)
        payload = valid_response.json()
        self.assertGreaterEqual(len(payload["tenant_users"]), 1)
        self.assertIn("billing_status", payload)
        self.assertIn("audit_logs", payload)

        with SessionLocal() as db:
            audit_row = (
                db.query(PlatformAuditLog)
                .filter(PlatformAuditLog.tenant_id == UUID(signup_payload["tenant_id"]))
                .order_by(PlatformAuditLog.created_at.desc())
                .first()
            )
            self.assertIsNotNone(audit_row)
            self.assertEqual(audit_row.action, "super_admin_accessed_tenant_data")
            self.assertEqual(audit_row.reason, "Investigating a tenant security escalation.")
            self.assertEqual(audit_row.status, "success")

    def test_feature_overrides_block_admin_and_technician_routes(self):
        signup_payload = self._signup_tenant_owner(workspace_slug="feature-lock", email="owner@featurelock.com")
        super_admin_token = self._super_admin_token()
        technician = self._seed_technician(
            tenant_id=signup_payload["tenant_id"],
            email="tech@featurelock.com",
        )
        technician_token = self._technician_token(email=technician.email)

        admin_headers = {"Authorization": f"Bearer {signup_payload['access_token']}"}
        technician_headers = {"Authorization": f"Bearer {technician_token}"}

        baseline_admin = self.client.get("/admin/technicians", headers=admin_headers)
        self.assertEqual(baseline_admin.status_code, 200, baseline_admin.text)

        baseline_technician = self.client.get("/technicians/me/jobs-feed", headers=technician_headers)
        self.assertEqual(baseline_technician.status_code, 200, baseline_technician.text)

        update_response = self.client.put(
            f"/super-admin/tenants/{signup_payload['tenant_id']}/features",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={
                "reason": "Validating tenant feature lockout behavior.",
                "entries": [
                    {"feature_key": "technicians", "is_enabled": False},
                    {"feature_key": "jobs_work_orders", "is_enabled": False},
                ],
            },
        )
        self.assertEqual(update_response.status_code, 200, update_response.text)

        blocked_admin = self.client.get("/admin/technicians", headers=admin_headers)
        self.assertEqual(blocked_admin.status_code, 403, blocked_admin.text)
        self.assertIn("technicians", blocked_admin.text)

        blocked_technician = self.client.get("/technicians/me/jobs-feed", headers=technician_headers)
        self.assertEqual(blocked_technician.status_code, 403, blocked_technician.text)
        self.assertIn("jobs_work_orders", blocked_technician.text)


if __name__ == "__main__":
    unittest.main()

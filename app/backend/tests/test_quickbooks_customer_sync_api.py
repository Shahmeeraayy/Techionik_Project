import os
import unittest
from datetime import UTC, datetime, timedelta
from unittest.mock import Mock, patch
from uuid import uuid4

from fastapi.testclient import TestClient

_TEST_DB_FILE = os.path.join(os.path.dirname(__file__), "quickbooks_customer_sync_test.sqlite3")
if os.path.exists(_TEST_DB_FILE):
    os.remove(_TEST_DB_FILE)

os.environ["APP_ENV"] = "development"
os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_DB_FILE.replace(os.sep, '/')}"
os.environ["QB_CLIENT_ID"] = "qb-client-id"
os.environ["QB_CLIENT_SECRET"] = "qb-client-secret"
os.environ["QB_REDIRECT_URI"] = "http://localhost:8000/integrations/quickbooks/callback"

from app.api import deps
from app.api.deps import SessionLocal, engine
from app.core.enums import UserRole
from app.core.security import AuthenticatedUser
from app.main import app
from app.models.base import Base
from app.models.dealership import Dealership
from app.models.quickbooks_connection import QuickBooksConnection


class QuickBooksCustomerSyncApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)

        def override_current_user():
            return AuthenticatedUser(user_id=uuid4(), role=UserRole.ADMIN)

        app.dependency_overrides[deps.get_current_user] = override_current_user
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.clear()
        engine.dispose()
        if os.path.exists(_TEST_DB_FILE):
            os.remove(_TEST_DB_FILE)

    def tearDown(self):
        db = SessionLocal()
        try:
            db.query(Dealership).delete()
            db.query(QuickBooksConnection).delete()
            db.commit()
        finally:
            db.close()

    def _seed_connection(self):
        db = SessionLocal()
        try:
            db.add(
                QuickBooksConnection(
                    realm_id="9341456520395836",
                    access_token="access-token",
                    refresh_token="refresh-token",
                    token_type="bearer",
                    scope="com.intuit.quickbooks.accounting",
                    expires_at=datetime.now(UTC) + timedelta(hours=1),
                    refresh_expires_at=datetime.now(UTC) + timedelta(days=30),
                    environment="sandbox",
                    is_active=True,
                )
            )
            db.commit()
        finally:
            db.close()

    def test_sync_customers_creates_and_updates_dealership_rows(self):
        self._seed_connection()

        db = SessionLocal()
        try:
            db.add(
                Dealership(
                    code="D-001",
                    name="Audi Levis",
                    phone="111",
                    email=None,
                    address=None,
                    city=None,
                    postal_code=None,
                    status="active",
                    notes=None,
                )
            )
            db.commit()
        finally:
            db.close()

        mocked_query_response = Mock()
        mocked_query_response.ok = True
        mocked_query_response.json.return_value = {
            "QueryResponse": {
                "Customer": [
                    {
                        "Id": "114",
                        "DisplayName": "Audi Levis",
                        "CompanyName": "Audi Levis",
                        "PrimaryPhone": {"FreeFormNumber": "14186558309"},
                        "PrimaryEmailAddr": {"Address": "billing@audilevis.example"},
                        "BillAddr": {
                            "Line1": "6000 rue des Moissons",
                            "City": "Levis",
                            "PostalCode": "G6Y 0Z6",
                        },
                        "Active": True,
                    },
                    {
                        "Id": "200",
                        "DisplayName": "New Customer",
                        "CompanyName": "New Customer",
                        "PrimaryPhone": {"FreeFormNumber": "555-2000"},
                        "Active": False,
                    },
                ]
            }
        }

        with patch("app.services.quickbooks_customer_sync_service.requests.post", return_value=mocked_query_response):
            response = self.client.post("/admin/quickbooks/sync-customers")

        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        self.assertEqual(body["synced_count"], 2)
        self.assertEqual(body["created_count"], 1)
        self.assertEqual(body["updated_count"], 1)
        self.assertEqual(body["inactive_count"], 0)

        db = SessionLocal()
        try:
            audi = db.query(Dealership).filter(Dealership.qb_customer_id == "114").first()
            new_customer = db.query(Dealership).filter(Dealership.qb_customer_id == "200").first()
            self.assertIsNotNone(audi)
            self.assertEqual(audi.qb_customer_id, "114")
            self.assertEqual(audi.phone, "14186558309")
            self.assertEqual(audi.city, "Levis")

            self.assertIsNotNone(new_customer)
            self.assertRegex(new_customer.code, r"^D-\d{3}$")
            self.assertEqual(new_customer.status, "active")
        finally:
            db.close()


if __name__ == "__main__":
    unittest.main()

import os
import unittest
from datetime import UTC, datetime, timedelta
from unittest.mock import Mock, patch
from uuid import uuid4

from fastapi.testclient import TestClient

_TEST_DB_FILE = os.path.join(os.path.dirname(__file__), "quickbooks_tax_code_sync_test.sqlite3")
if os.path.exists(_TEST_DB_FILE):
    os.remove(_TEST_DB_FILE)

os.environ["APP_ENV"] = "development"
os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_DB_FILE.replace(os.sep, '/')}"
os.environ["QB_CLIENT_ID"] = "qb-client-id"
os.environ["QB_CLIENT_SECRET"] = "qb-client-secret"
os.environ["QB_REDIRECT_URI"] = "http://localhost:8000/integrations/quickbooks/callback"
os.environ["QB_ENV"] = "sandbox"

from app.api import deps
from app.api.deps import SessionLocal, engine
from app.core.enums import UserRole
from app.core.security import AuthenticatedUser
from app.main import app
from app.models.base import Base
from app.models.quickbooks_connection import QuickBooksConnection
from app.models.quickbooks_tax_code import QuickBooksTaxCode


class QuickBooksTaxCodeSyncApiTests(unittest.TestCase):
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
            db.query(QuickBooksTaxCode).delete()
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

    def test_sync_tax_codes_stores_rows_and_maps_internal_codes(self):
        self._seed_connection()

        preferences_response = Mock()
        preferences_response.ok = True
        preferences_response.json.return_value = {"QueryResponse": {"Preferences": {"TaxPrefs": {"UsingSalesTax": True}}}}

        tax_code_response = Mock()
        tax_code_response.ok = True
        tax_code_response.json.return_value = {
            "QueryResponse": {
                "TaxCode": [
                    {"Id": "1", "Name": "Non taxable", "Description": "No tax", "Active": True},
                    {"Id": "2", "Name": "GST", "Description": "TPS 5%", "Active": True},
                    {"Id": "3", "Name": "GST + QST", "Description": "TPS + TVQ", "Active": True},
                ]
            }
        }

        with patch(
            "app.services.quickbooks_tax_code_sync_service.requests.post",
            side_effect=[preferences_response, tax_code_response],
        ):
            response = self.client.post("/admin/quickbooks/sync-tax-codes")

        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        self.assertEqual(body["synced_count"], 3)
        self.assertEqual(body["created_count"], 3)
        self.assertEqual(body["updated_count"], 0)
        self.assertEqual(body["active_count"], 3)
        self.assertEqual(body["mapped_count"], 3)
        self.assertTrue(body["sales_tax_enabled"])

        db = SessionLocal()
        try:
            exempt = db.query(QuickBooksTaxCode).filter(QuickBooksTaxCode.qb_tax_code_id == "1").first()
            gst = db.query(QuickBooksTaxCode).filter(QuickBooksTaxCode.qb_tax_code_id == "2").first()
            gst_qst = db.query(QuickBooksTaxCode).filter(QuickBooksTaxCode.qb_tax_code_id == "3").first()
            self.assertEqual(exempt.internal_tax_code, "EXEMPT")
            self.assertEqual(gst.internal_tax_code, "GST")
            self.assertEqual(gst_qst.internal_tax_code, "GST_QST")
        finally:
            db.close()

    def test_sync_tax_codes_maps_french_exempt_labels(self):
        self._seed_connection()

        preferences_response = Mock()
        preferences_response.ok = True
        preferences_response.json.return_value = {"QueryResponse": {"Preferences": {"TaxPrefs": {"UsingSalesTax": True}}}}

        tax_code_response = Mock()
        tax_code_response.ok = True
        tax_code_response.json.return_value = {
            "QueryResponse": {
                "TaxCode": [
                    {"Id": "10", "Name": "Détaxé", "Description": "Sans taxe", "Active": True},
                    {"Id": "11", "Name": "TPS + TVQ", "Description": "Taxe combinée", "Active": True},
                ]
            }
        }

        with patch(
            "app.services.quickbooks_tax_code_sync_service.requests.post",
            side_effect=[preferences_response, tax_code_response],
        ):
            response = self.client.post("/admin/quickbooks/sync-tax-codes")

        self.assertEqual(response.status_code, 200, response.text)

        db = SessionLocal()
        try:
            exempt = db.query(QuickBooksTaxCode).filter(QuickBooksTaxCode.qb_tax_code_id == "10").first()
            self.assertEqual(exempt.internal_tax_code, "EXEMPT")
        finally:
            db.close()

    def test_missing_exempt_mapping_self_repairs_from_existing_synced_row(self):
        self._seed_connection()

        db = SessionLocal()
        try:
            db.add(
                QuickBooksTaxCode(
                    realm_id="9341456520395836",
                    qb_tax_code_id="QB-TAX-NONTAX",
                    name="Non taxable",
                    description="No tax",
                    active=True,
                    internal_tax_code=None,
                )
            )
            db.commit()

            from app.services.quickbooks_tax_code_sync_service import QuickBooksTaxCodeSyncService

            service = QuickBooksTaxCodeSyncService(db)
            resolved_id = service.get_tax_code_id_for_internal_code("EXEMPT", realm_id="9341456520395836")
            self.assertEqual(resolved_id, "QB-TAX-NONTAX")

            row = db.query(QuickBooksTaxCode).filter(QuickBooksTaxCode.qb_tax_code_id == "QB-TAX-NONTAX").first()
            self.assertEqual(row.internal_tax_code, "EXEMPT")
        finally:
            db.close()

    def test_missing_exempt_mapping_self_repairs_from_hors_champ_row(self):
        self._seed_connection()

        db = SessionLocal()
        try:
            db.add(
                QuickBooksTaxCode(
                    realm_id="9341456520395836",
                    qb_tax_code_id="QB-TAX-HORS-CHAMP",
                    name="Hors champ",
                    description="",
                    active=True,
                    internal_tax_code=None,
                )
            )
            db.commit()

            from app.services.quickbooks_tax_code_sync_service import QuickBooksTaxCodeSyncService

            service = QuickBooksTaxCodeSyncService(db)
            resolved_id = service.get_tax_code_id_for_internal_code("EXEMPT", realm_id="9341456520395836")
            self.assertEqual(resolved_id, "QB-TAX-HORS-CHAMP")

            row = db.query(QuickBooksTaxCode).filter(QuickBooksTaxCode.qb_tax_code_id == "QB-TAX-HORS-CHAMP").first()
            self.assertEqual(row.internal_tax_code, "EXEMPT")
        finally:
            db.close()


if __name__ == "__main__":
    unittest.main()

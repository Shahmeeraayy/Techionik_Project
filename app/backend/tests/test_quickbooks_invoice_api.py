import os
import unittest
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from unittest.mock import Mock, patch
from uuid import uuid4

from fastapi.testclient import TestClient

_TEST_DB_FILE = os.path.join(os.path.dirname(__file__), "quickbooks_invoice_test.sqlite3")
if os.path.exists(_TEST_DB_FILE):
    os.remove(_TEST_DB_FILE)

os.environ["APP_ENV"] = "development"
os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_DB_FILE.replace(os.sep, '/')}"
os.environ["QB_CLIENT_ID"] = "qb-client-id"
os.environ["QB_CLIENT_SECRET"] = "qb-client-secret"
os.environ["QB_REDIRECT_URI"] = "http://localhost:8000/integrations/quickbooks/callback"
os.environ["QB_ENV"] = "sandbox"

from app.api.deps import SessionLocal, engine
from app.main import app
from app.models.base import Base
from app.models.dealership import Dealership
from app.models.invoice import Invoice, InvoiceLineItem
from app.models.job import Job
from app.models.job_service import JobService
from app.models.priority_rule import PriorityRule
from app.models.quickbooks_connection import QuickBooksConnection
from app.models.quickbooks_tax_code import QuickBooksTaxCode
from app.models.service_catalog import ServiceCatalog
from app.models.technician import Technician
from app.models.technician_password_reset_request import TechnicianPasswordResetRequest
from app.services.quickbooks_invoice_service import QuickBooksInvoiceService


class QuickBooksInvoiceApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)
        cls.client = TestClient(app)
        token_response = cls.client.post(
            "/auth/dev/admin-token",
            json={"email": "admin@sm2dispatch.com", "password": "admin123"},
        )
        assert token_response.status_code == 200
        cls.auth_header = {"Authorization": f"Bearer {token_response.json()['access_token']}"}

    @classmethod
    def tearDownClass(cls):
        engine.dispose()
        if os.path.exists(_TEST_DB_FILE):
            os.remove(_TEST_DB_FILE)

    def setUp(self):
        with SessionLocal() as db:
            db.query(InvoiceLineItem).delete()
            db.query(JobService).delete()
            db.query(Job).update({"invoice_id": None}, synchronize_session=False)
            db.query(Invoice).delete()
            db.query(ServiceCatalog).delete()
            db.query(QuickBooksTaxCode).delete()
            db.query(QuickBooksConnection).delete()
            db.query(PriorityRule).delete()
            db.query(Job).delete()
            db.query(TechnicianPasswordResetRequest).delete()
            db.query(Technician).delete()
            db.query(Dealership).delete()
            db.commit()

    def _seed_qb_connection(self) -> None:
        with SessionLocal() as db:
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

    def _seed_tax_codes(self) -> None:
        with SessionLocal() as db:
            db.add_all(
                [
                    QuickBooksTaxCode(
                        realm_id="9341456520395836",
                        qb_tax_code_id="QB-TAX-EXEMPT",
                        name="Non taxable",
                        active=True,
                        internal_tax_code="EXEMPT",
                    ),
                    QuickBooksTaxCode(
                        realm_id="9341456520395836",
                        qb_tax_code_id="QB-TAX-GSTQST",
                        name="TPS + TVQ",
                        active=True,
                        internal_tax_code="GST_QST",
                    ),
                ]
            )
            db.commit()

    def _preferences_response(self, enabled: bool = True) -> Mock:
        response = Mock()
        response.ok = True
        response.json.return_value = {"QueryResponse": {"Preferences": {"TaxPrefs": {"UsingSalesTax": enabled}}}}
        return response

    def _tax_code_query_response(self) -> Mock:
        response = Mock()
        response.ok = True
        response.json.return_value = {
            "QueryResponse": {
                "TaxCode": [
                    {"Id": "QB-TAX-EXEMPT", "Name": "Non taxable", "Description": "No tax", "Active": True},
                    {"Id": "QB-TAX-GSTQST", "Name": "TPS + TVQ", "Description": "TPS + TVQ", "Active": True},
                ]
            }
        }
        return response

    def _invoice_lookup_empty_response(self) -> Mock:
        response = Mock()
        response.ok = True
        response.json.return_value = {"QueryResponse": {}}
        return response

    def _seed_dealership(self) -> Dealership:
        with SessionLocal() as db:
            row = Dealership(
                id=uuid4(),
                qb_customer_id="QB-CUST-100",
                code="D-900",
                name="Audi Levis",
                phone="+1-418-555-2200",
                email="service@audilevis.example",
                address="6000 rue des Moissons",
                city="Levis",
                postal_code="G6Y 0Z6",
                status="active",
            )
            db.add(row)
            db.commit()
            db.refresh(row)
            return row

    def _seed_job_with_service_catalog(self, dealership: Dealership) -> str:
        with SessionLocal() as db:
            service_catalog = ServiceCatalog(
                id=uuid4(),
                qb_item_id="QB-ITEM-200",
                code="PPF-001",
                name="PPF ailes complètes (2)",
                category="PPF",
                qb_type="Service",
                default_price=Decimal("400.00"),
                approval_required=False,
                status="active",
            )
            db.add(service_catalog)
            db.flush()

            job = Job(
                id=uuid4(),
                job_code="SM2-20231124-1234",
                status="COMPLETED",
                dealership_id=dealership.id,
                customer_name=dealership.name,
                customer_address=dealership.address,
                customer_city=dealership.city,
                customer_state="QC",
                customer_zip_code=dealership.postal_code,
                service_type=service_catalog.name,
                vehicle="audi a3 2026",
                location="Levis",
                tax_code="GST_QST",
            )
            db.add(job)
            db.flush()

            db.add(
                JobService(
                    job_id=job.id,
                    service_catalog_id=service_catalog.id,
                    service_name_snapshot=service_catalog.name,
                    source="dealership",
                    quantity=Decimal("1.00"),
                    unit_price=Decimal("400.00"),
                    sort_order=0,
                )
            )
            db.commit()
            return str(job.id)

    def test_create_invoice_syncs_to_quickbooks_and_stores_ids(self):
        self._seed_qb_connection()
        self._seed_tax_codes()
        dealership = self._seed_dealership()
        job_id = self._seed_job_with_service_catalog(dealership)

        sync_preferences_response = self._preferences_response(True)
        sync_tax_code_response = self._tax_code_query_response()
        invoice_preferences_response = self._preferences_response(True)
        mocked_response = Mock()
        mocked_response.ok = True
        mocked_response.json.return_value = {
            "Invoice": {
                "Id": "QB-INV-500",
                "CustomerRef": {"value": "QB-CUST-100"},
            }
        }

        with patch(
            "app.services.quickbooks_invoice_service.requests.post",
            side_effect=[
                sync_preferences_response,
                sync_tax_code_response,
                invoice_preferences_response,
                self._invoice_lookup_empty_response(),
                mocked_response,
            ],
        ) as mocked_post:
            create_res = self.client.post(
                "/invoices",
                json={
                    "dispatch_job_ids": [job_id],
                    "terms": "NET_15",
                    "shipping": "0.00",
                    "status": "sent",
                },
                headers=self.auth_header,
            )

        self.assertEqual(create_res.status_code, 201, create_res.text)
        created = create_res.json()
        self.assertEqual(created["qb_invoice_id"], "QB-INV-500")
        self.assertEqual(created["qb_customer_id"], "QB-CUST-100")
        self.assertEqual(created["qb_sync_status"], "synced")
        self.assertIsNone(created["qb_sync_error"])
        self.assertEqual(created["line_items"][0]["qb_item_id"], "QB-ITEM-200")
        sent_payload = mocked_post.call_args_list[-1].kwargs["json"]
        self.assertEqual(sent_payload["Line"][0]["SalesItemLineDetail"]["TaxCodeRef"]["value"], "QB-TAX-GSTQST")
        self.assertEqual(sent_payload["TxnTaxDetail"]["TxnTaxCodeRef"]["value"], "QB-TAX-GSTQST")

    def test_humanize_sync_error_for_duplicate_doc_number(self):
        message = QuickBooksInvoiceService.humanize_sync_error(
            {
                "message": "QuickBooks invoice creation failed.",
                "provider_status": 400,
                "provider_response": {
                    "Fault": {
                        "Error": [
                            {
                                "Message": "Numéro de document en double",
                                "Detail": (
                                    "Numéro de document en double : Vous devez indiquer un nombre différent. "
                                    "Ce numéro a déjà été utilisé. DocNumber=INV-0002 is assigned to TxnType=Facture with TxnId=2137"
                                ),
                                "code": "6140",
                                "element": "",
                            }
                        ],
                        "type": "ValidationFault",
                    },
                    "time": "2026-03-12T07:19:05.137-07:00",
                },
            }
        )

        self.assertEqual(
            message,
            "QuickBooks rejected this invoice because the invoice number is already in use. "
            "Use a different invoice number and try again.",
        )

    def test_humanize_sync_error_for_tax_mapping_problem(self):
        message = QuickBooksInvoiceService.humanize_sync_error(
            {
                "message": "QuickBooks invoice creation failed.",
                "provider_status": 400,
                "provider_response": {
                    "Fault": {
                        "Error": [
                            {
                                "Message": "Validation de l'entreprise",
                                "Detail": "Assurez-vous que toutes vos opérations comprennent un taux de TPS/TVH avant d'enregistrer.",
                                "code": "6000",
                                "element": "",
                            }
                        ],
                        "type": "ValidationFault",
                    },
                },
            }
        )

        self.assertEqual(
            message,
            "QuickBooks rejected this invoice because a required tax code is missing or not mapped. "
            "Sync QuickBooks tax codes and verify the invoice tax setup.",
        )

    def test_create_invoice_keeps_local_record_when_quickbooks_sync_fails(self):
        self._seed_qb_connection()
        self._seed_tax_codes()
        dealership = self._seed_dealership()
        job_id = self._seed_job_with_service_catalog(dealership)

        sync_preferences_response = self._preferences_response(True)
        sync_tax_code_response = self._tax_code_query_response()
        invoice_preferences_response = self._preferences_response(True)
        mocked_response = Mock()
        mocked_response.ok = False
        mocked_response.status_code = 400
        mocked_response.json.return_value = {"Fault": {"Error": [{"Message": "Bad request"}]}}

        with patch(
            "app.services.quickbooks_invoice_service.requests.post",
            side_effect=[
                sync_preferences_response,
                sync_tax_code_response,
                invoice_preferences_response,
                self._invoice_lookup_empty_response(),
                mocked_response,
            ],
        ):
            create_res = self.client.post(
                "/invoices",
                json={
                    "dispatch_job_ids": [job_id],
                    "terms": "NET_15",
                    "shipping": "0.00",
                    "status": "sent",
                },
                headers=self.auth_header,
            )

        self.assertEqual(create_res.status_code, 201, create_res.text)
        created = create_res.json()
        self.assertIsNone(created["qb_invoice_id"])
        self.assertEqual(created["qb_customer_id"], "QB-CUST-100")
        self.assertEqual(created["qb_sync_status"], "failed")
        self.assertIsNotNone(created["qb_sync_error"])

    def test_manual_quickbooks_invoice_sync_endpoint_retries_failed_invoice(self):
        self._seed_qb_connection()
        self._seed_tax_codes()
        dealership = self._seed_dealership()
        job_id = self._seed_job_with_service_catalog(dealership)

        create_sync_preferences_response = self._preferences_response(True)
        create_sync_tax_code_response = self._tax_code_query_response()
        create_invoice_preferences_response = self._preferences_response(True)
        failing_response = Mock()
        failing_response.ok = False
        failing_response.status_code = 400
        failing_response.json.return_value = {"Fault": {"Error": [{"Message": "Bad request"}]}}

        with patch(
            "app.services.quickbooks_invoice_service.requests.post",
            side_effect=[
                create_sync_preferences_response,
                create_sync_tax_code_response,
                create_invoice_preferences_response,
                self._invoice_lookup_empty_response(),
                failing_response,
            ],
        ):
            create_res = self.client.post(
                "/invoices",
                json={
                    "dispatch_job_ids": [job_id],
                    "terms": "NET_15",
                    "shipping": "0.00",
                    "status": "sent",
                },
                headers=self.auth_header,
            )
        self.assertEqual(create_res.status_code, 201, create_res.text)
        invoice_id = create_res.json()["id"]

        retry_sync_preferences_response = self._preferences_response(True)
        retry_sync_tax_code_response = self._tax_code_query_response()
        retry_invoice_preferences_response = self._preferences_response(True)
        success_response = Mock()
        success_response.ok = True
        success_response.json.return_value = {"Invoice": {"Id": "QB-INV-777"}}

        with patch(
            "app.services.quickbooks_invoice_service.requests.post",
            side_effect=[
                retry_sync_preferences_response,
                retry_sync_tax_code_response,
                retry_invoice_preferences_response,
                self._invoice_lookup_empty_response(),
                success_response,
            ],
        ):
            sync_res = self.client.post(f"/quickbooks/invoices/{invoice_id}", headers=self.auth_header)

        self.assertEqual(sync_res.status_code, 200, sync_res.text)
        synced = sync_res.json()
        self.assertEqual(synced["qb_invoice_id"], "QB-INV-777")
        self.assertEqual(synced["qb_sync_status"], "synced")
        self.assertIsNone(synced["qb_sync_error"])

    def test_update_invoice_resyncs_existing_quickbooks_invoice(self):
        self._seed_qb_connection()
        self._seed_tax_codes()
        dealership = self._seed_dealership()
        job_id = self._seed_job_with_service_catalog(dealership)

        create_sync_preferences_response = self._preferences_response(True)
        create_sync_tax_code_response = self._tax_code_query_response()
        create_invoice_preferences_response = self._preferences_response(True)
        create_response = Mock()
        create_response.ok = True
        create_response.json.return_value = {"Invoice": {"Id": "QB-INV-500"}}

        with patch(
            "app.services.quickbooks_invoice_service.requests.post",
            side_effect=[
                create_sync_preferences_response,
                create_sync_tax_code_response,
                create_invoice_preferences_response,
                self._invoice_lookup_empty_response(),
                create_response,
            ],
        ):
            create_res = self.client.post(
                "/invoices",
                json={
                    "dispatch_job_ids": [job_id],
                    "terms": "NET_15",
                    "shipping": "0.00",
                    "status": "sent",
                },
                headers=self.auth_header,
            )

        self.assertEqual(create_res.status_code, 201, create_res.text)
        invoice_id = create_res.json()["id"]

        fetch_response = Mock()
        fetch_response.ok = True
        fetch_response.json.return_value = {"Invoice": {"Id": "QB-INV-500", "SyncToken": "3"}}
        update_sync_preferences_response = self._preferences_response(True)
        update_sync_tax_code_response = self._tax_code_query_response()
        update_invoice_preferences_response = self._preferences_response(True)
        update_response = Mock()
        update_response.ok = True
        update_response.json.return_value = {"Invoice": {"Id": "QB-INV-500", "SyncToken": "4"}}

        with patch("app.services.quickbooks_invoice_service.requests.get", return_value=fetch_response) as mocked_get, patch(
            "app.services.quickbooks_invoice_service.requests.post",
            side_effect=[update_sync_preferences_response, update_sync_tax_code_response, update_invoice_preferences_response, update_response],
        ) as mocked_post:
            update_res = self.client.put(
                f"/invoices/{invoice_id}",
                json={
                    "shipping": "25.00",
                    "status": "sent",
                },
                headers=self.auth_header,
            )

        self.assertEqual(update_res.status_code, 200, update_res.text)
        updated = update_res.json()
        self.assertEqual(updated["qb_invoice_id"], "QB-INV-500")
        self.assertEqual(updated["qb_sync_status"], "synced")
        mocked_get.assert_called_once()
        self.assertEqual(mocked_post.call_count, 4)
        sent_payload = mocked_post.call_args_list[-1].kwargs["json"]
        self.assertEqual(sent_payload["Id"], "QB-INV-500")
        self.assertEqual(sent_payload["SyncToken"], "3")
        self.assertTrue(sent_payload["sparse"])

    def test_update_invoice_retries_quickbooks_sync_for_failed_invoice(self):
        self._seed_qb_connection()
        self._seed_tax_codes()
        dealership = self._seed_dealership()
        job_id = self._seed_job_with_service_catalog(dealership)

        create_sync_preferences_response = self._preferences_response(True)
        create_sync_tax_code_response = self._tax_code_query_response()
        create_invoice_preferences_response = self._preferences_response(True)
        failing_response = Mock()
        failing_response.ok = False
        failing_response.status_code = 400
        failing_response.json.return_value = {"Fault": {"Error": [{"Message": "Bad request"}]}}

        with patch(
            "app.services.quickbooks_invoice_service.requests.post",
            side_effect=[
                create_sync_preferences_response,
                create_sync_tax_code_response,
                create_invoice_preferences_response,
                self._invoice_lookup_empty_response(),
                failing_response,
            ],
        ):
            create_res = self.client.post(
                "/invoices",
                json={
                    "dispatch_job_ids": [job_id],
                    "terms": "NET_15",
                    "shipping": "0.00",
                    "status": "sent",
                },
                headers=self.auth_header,
            )

        self.assertEqual(create_res.status_code, 201, create_res.text)
        invoice_id = create_res.json()["id"]

        update_sync_preferences_response = self._preferences_response(True)
        update_sync_tax_code_response = self._tax_code_query_response()
        update_invoice_preferences_response = self._preferences_response(True)
        success_response = Mock()
        success_response.ok = True
        success_response.json.return_value = {"Invoice": {"Id": "QB-INV-888"}}

        with patch(
            "app.services.quickbooks_invoice_service.requests.post",
            side_effect=[
                update_sync_preferences_response,
                update_sync_tax_code_response,
                update_invoice_preferences_response,
                self._invoice_lookup_empty_response(),
                success_response,
            ],
        ):
            update_res = self.client.put(
                f"/invoices/{invoice_id}",
                json={
                    "approval_note": "Retry after edit",
                    "status": "sent",
                },
                headers=self.auth_header,
            )

        self.assertEqual(update_res.status_code, 200, update_res.text)
        updated = update_res.json()
        self.assertEqual(updated["qb_invoice_id"], "QB-INV-888")
        self.assertEqual(updated["qb_sync_status"], "synced")
        self.assertIsNone(updated["qb_sync_error"])

    def test_create_invoice_links_existing_quickbooks_invoice_when_doc_number_already_exists(self):
        self._seed_qb_connection()
        self._seed_tax_codes()
        dealership = self._seed_dealership()
        job_id = self._seed_job_with_service_catalog(dealership)

        lookup_response = Mock()
        lookup_response.ok = True
        lookup_response.json.return_value = {
            "QueryResponse": {
                "Invoice": {
                    "Id": "QB-INV-EXISTING-2137",
                    "DocNumber": "INV-0001",
                    "CustomerRef": {"value": "QB-CUST-100"},
                }
            }
        }
        fetch_response = Mock()
        fetch_response.ok = True
        fetch_response.json.return_value = {"Invoice": {"Id": "QB-INV-EXISTING-2137", "SyncToken": "7"}}
        update_response = Mock()
        update_response.ok = True
        update_response.json.return_value = {"Invoice": {"Id": "QB-INV-EXISTING-2137", "SyncToken": "8"}}

        with patch(
            "app.services.quickbooks_invoice_service.requests.post",
            side_effect=[
                self._preferences_response(True),
                self._tax_code_query_response(),
                self._preferences_response(True),
                lookup_response,
                update_response,
            ],
        ) as mocked_post, patch(
            "app.services.quickbooks_invoice_service.requests.get",
            return_value=fetch_response,
        ) as mocked_get:
            create_res = self.client.post(
                "/invoices",
                json={
                    "dispatch_job_ids": [job_id],
                    "terms": "NET_15",
                    "shipping": "0.00",
                    "status": "sent",
                },
                headers=self.auth_header,
            )

        self.assertEqual(create_res.status_code, 201, create_res.text)
        created = create_res.json()
        self.assertEqual(created["qb_invoice_id"], "QB-INV-EXISTING-2137")
        self.assertEqual(created["qb_sync_status"], "synced")
        mocked_get.assert_called_once()
        sent_payload = mocked_post.call_args_list[-1].kwargs["json"]
        self.assertEqual(sent_payload["Id"], "QB-INV-EXISTING-2137")
        self.assertEqual(sent_payload["DocNumber"], created["invoice_number"])

    def test_create_invoice_fails_quickbooks_sync_when_sales_tax_disabled(self):
        self._seed_qb_connection()
        self._seed_tax_codes()
        dealership = self._seed_dealership()
        job_id = self._seed_job_with_service_catalog(dealership)

        sync_preferences_response = self._preferences_response(True)
        sync_tax_code_response = self._tax_code_query_response()
        invoice_preferences_response = self._preferences_response(False)

        with patch(
            "app.services.quickbooks_invoice_service.requests.post",
            side_effect=[sync_preferences_response, sync_tax_code_response, invoice_preferences_response],
        ):
            create_res = self.client.post(
                "/invoices",
                json={
                    "dispatch_job_ids": [job_id],
                    "terms": "NET_15",
                    "shipping": "0.00",
                    "status": "sent",
                },
                headers=self.auth_header,
            )

        self.assertEqual(create_res.status_code, 201, create_res.text)
        created = create_res.json()
        self.assertEqual(created["qb_sync_status"], "failed")
        self.assertIn("UsingSalesTax", created["qb_sync_error"])


if __name__ == "__main__":
    unittest.main()

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Any
from uuid import UUID

import requests
from fastapi import HTTPException, status
from sqlalchemy.orm import Session, selectinload

from ..core.config import QB_ENV
from ..models.invoice import Invoice
from ..services.quickbooks_connection_service import QuickBooksConnectionService
from ..services.quickbooks_tax_code_sync_service import QuickBooksTaxCodeSyncService


@dataclass(frozen=True)
class QuickBooksInvoiceSyncResult:
    qb_invoice_id: str
    payload: dict[str, Any]
    provider_response: dict[str, Any]


class QuickBooksInvoiceService:
    def __init__(self, db: Session):
        self.db = db
        self.connection_service = QuickBooksConnectionService(db)
        self.tax_code_service = QuickBooksTaxCodeSyncService(db)

    def sync_invoice(self, invoice_id: UUID) -> QuickBooksInvoiceSyncResult:
        invoice = (
            self.db.query(Invoice)
            .options(selectinload(Invoice.line_items))
            .filter(Invoice.id == invoice_id)
            .first()
        )
        if invoice is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
        return self.sync_invoice_row(invoice)

    def sync_invoice_row(self, invoice: Invoice) -> QuickBooksInvoiceSyncResult:
        connection = self.connection_service.get_active_connection_or_raise(refresh_if_needed=True)
        # TaxCode has no QuickBooks webhook/CDC support, so refresh it before every invoice sync.
        self.tax_code_service.sync_tax_codes()
        payload = self.build_payload(
            invoice,
            realm_id=connection.realm_id,
            access_token=connection.access_token,
        )
        qb_invoice_id = str(invoice.qb_invoice_id or "").strip()
        if qb_invoice_id:
            response_payload = self._update_invoice(
                realm_id=connection.realm_id,
                access_token=connection.access_token,
                qb_invoice_id=qb_invoice_id,
                payload=payload,
            )
        else:
            existing_invoice = self._find_invoice_by_doc_number(
                realm_id=connection.realm_id,
                access_token=connection.access_token,
                doc_number=str(payload.get("DocNumber") or "").strip(),
            )
            if existing_invoice is not None:
                existing_qb_invoice_id = str(existing_invoice.get("Id") or "").strip()
                existing_customer_id = str(((existing_invoice.get("CustomerRef") or {}).get("value")) or "").strip()
                requested_customer_id = str(((payload.get("CustomerRef") or {}).get("value")) or "").strip()
                if existing_customer_id and requested_customer_id and existing_customer_id != requested_customer_id:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=(
                            f"QuickBooks invoice number '{payload.get('DocNumber')}' already exists for a different customer "
                            f"(QuickBooks invoice Id {existing_qb_invoice_id})."
                        ),
                    )
                response_payload = self._update_invoice(
                    realm_id=connection.realm_id,
                    access_token=connection.access_token,
                    qb_invoice_id=existing_qb_invoice_id,
                    payload=payload,
                )
            else:
                try:
                    response_payload = self._post_invoice(
                        realm_id=connection.realm_id,
                        access_token=connection.access_token,
                        payload=payload,
                    )
                except HTTPException as exc:
                    if not self._is_duplicate_doc_number_error(exc):
                        raise
                    existing_invoice = self._find_invoice_by_doc_number(
                        realm_id=connection.realm_id,
                        access_token=connection.access_token,
                        doc_number=str(payload.get("DocNumber") or "").strip(),
                    )
                    if existing_invoice is None:
                        raise
                    existing_qb_invoice_id = str(existing_invoice.get("Id") or "").strip()
                    existing_customer_id = str(((existing_invoice.get("CustomerRef") or {}).get("value")) or "").strip()
                    requested_customer_id = str(((payload.get("CustomerRef") or {}).get("value")) or "").strip()
                    if existing_customer_id and requested_customer_id and existing_customer_id != requested_customer_id:
                        raise HTTPException(
                            status_code=status.HTTP_409_CONFLICT,
                            detail=(
                                f"QuickBooks invoice number '{payload.get('DocNumber')}' already exists for a different customer "
                                f"(QuickBooks invoice Id {existing_qb_invoice_id})."
                            ),
                        ) from exc
                    response_payload = self._update_invoice(
                        realm_id=connection.realm_id,
                        access_token=connection.access_token,
                        qb_invoice_id=existing_qb_invoice_id,
                        payload=payload,
                    )

        invoice_payload = response_payload.get("Invoice") if isinstance(response_payload, dict) else None
        resolved_qb_invoice_id = str((invoice_payload or {}).get("Id") or qb_invoice_id).strip()
        if not resolved_qb_invoice_id:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="QuickBooks invoice response did not include an invoice Id.",
            )

        return QuickBooksInvoiceSyncResult(
            qb_invoice_id=resolved_qb_invoice_id,
            payload=payload,
            provider_response=response_payload,
        )

    def build_payload(self, invoice: Invoice, *, realm_id: str, access_token: str) -> dict[str, Any]:
        qb_customer_id = str(invoice.qb_customer_id or "").strip()
        if not qb_customer_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Invoice is missing qb_customer_id and cannot be synced to QuickBooks.",
            )
        if not invoice.line_items:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Invoice has no line items to sync to QuickBooks.",
            )
        if not self.tax_code_service.verify_sales_tax_enabled(realm_id=realm_id, access_token=access_token):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="QuickBooks sales tax is disabled in Preferences.TaxPrefs.UsingSalesTax.",
            )

        lines: list[dict[str, Any]] = []
        tax_code_ids: set[str] = set()
        for item in invoice.line_items:
            qb_item_id = str(item.qb_item_id or "").strip()
            if not qb_item_id:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Invoice line '{item.product_service}' is missing qb_item_id.",
                )

            quantity = Decimal(str(item.quantity))
            rate = Decimal(str(item.rate))
            amount = Decimal(str(item.amount))
            internal_tax_code = str(item.tax_code or "EXEMPT").strip().upper()
            qb_tax_code_id = self.tax_code_service.get_tax_code_id_for_internal_code(
                internal_tax_code,
                realm_id=realm_id,
            )
            tax_code_ids.add(qb_tax_code_id)
            lines.append(
                {
                    "Amount": float(amount),
                    "Description": item.description or item.product_service,
                    "DetailType": "SalesItemLineDetail",
                    "SalesItemLineDetail": {
                        "ItemRef": {"value": qb_item_id},
                        "Qty": float(quantity),
                        "UnitPrice": float(rate),
                        "TaxCodeRef": {"value": qb_tax_code_id},
                    },
                }
            )

        payload: dict[str, Any] = {
            "DocNumber": invoice.invoice_number,
            "TxnDate": invoice.invoice_date.isoformat(),
            "DueDate": invoice.due_date.isoformat(),
            "CustomerRef": {"value": qb_customer_id},
            "Line": lines,
        }
        if len(tax_code_ids) == 1:
            payload["TxnTaxDetail"] = {"TxnTaxCodeRef": {"value": next(iter(tax_code_ids))}}
        if invoice.customer_message:
            payload["CustomerMemo"] = {"value": invoice.customer_message}
        return payload

    def _post_invoice(self, *, realm_id: str, access_token: str, payload: dict[str, Any]) -> dict[str, Any]:
        response = requests.post(
            f"{self._company_api_base()}/company/{realm_id}/invoice",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            params={"minorversion": 75},
            json=payload,
            timeout=30,
        )
        try:
            response_payload = response.json()
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="QuickBooks invoice response was not valid JSON.",
            ) from exc

        if not response.ok:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail={
                    "message": "QuickBooks invoice creation failed.",
                    "provider_status": response.status_code,
                    "provider_response": response_payload,
                },
            )
        return response_payload

    def _update_invoice(
        self,
        *,
        realm_id: str,
        access_token: str,
        qb_invoice_id: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        existing_invoice = self._get_existing_invoice(
            realm_id=realm_id,
            access_token=access_token,
            qb_invoice_id=qb_invoice_id,
        )
        sync_token = str(((existing_invoice.get("Invoice") or {}).get("SyncToken")) or "").strip()
        if not sync_token:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="QuickBooks invoice update response did not include SyncToken.",
            )

        update_payload = {
            **payload,
            "Id": qb_invoice_id,
            "SyncToken": sync_token,
            "sparse": True,
        }
        return self._post_invoice(
            realm_id=realm_id,
            access_token=access_token,
            payload=update_payload,
        )

    def _get_existing_invoice(self, *, realm_id: str, access_token: str, qb_invoice_id: str) -> dict[str, Any]:
        response = requests.get(
            f"{self._company_api_base()}/company/{realm_id}/invoice/{qb_invoice_id}",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/json",
            },
            params={"minorversion": 75},
            timeout=30,
        )
        try:
            response_payload = response.json()
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="QuickBooks invoice fetch response was not valid JSON.",
            ) from exc

        if not response.ok:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail={
                    "message": "QuickBooks invoice fetch failed.",
                    "provider_status": response.status_code,
                    "provider_response": response_payload,
                },
            )
        return response_payload

    def _find_invoice_by_doc_number(
        self,
        *,
        realm_id: str,
        access_token: str,
        doc_number: str,
    ) -> dict[str, Any] | None:
        if not doc_number:
            return None
        escaped_doc_number = doc_number.replace("\\", "\\\\").replace("'", "\\'")
        response = requests.post(
            f"{self._company_api_base()}/company/{realm_id}/query",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/json",
                "Content-Type": "application/text",
            },
            params={"minorversion": 75},
            data=f"SELECT * FROM Invoice WHERE DocNumber = '{escaped_doc_number}' MAXRESULTS 2",
            timeout=30,
        )
        try:
            payload = response.json()
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="QuickBooks invoice query response was not valid JSON.",
            ) from exc

        if not response.ok:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail={
                    "message": "QuickBooks invoice lookup failed.",
                    "provider_status": response.status_code,
                    "provider_response": payload,
                },
            )

        query_response = payload.get("QueryResponse") if isinstance(payload, dict) else None
        invoices = query_response.get("Invoice") if isinstance(query_response, dict) else None
        if isinstance(invoices, list):
            return next((row for row in invoices if isinstance(row, dict)), None)
        if isinstance(invoices, dict):
            return invoices
        return None

    @classmethod
    def humanize_sync_error(cls, detail: Any) -> str:
        if isinstance(detail, str):
            normalized = detail.strip()
            if normalized:
                return normalized
            return "QuickBooks sync failed. Please try again."

        if not isinstance(detail, dict):
            return "QuickBooks sync failed. Please try again."

        provider_response = detail.get("provider_response")
        fault = provider_response.get("Fault") if isinstance(provider_response, dict) else None
        errors = fault.get("Error") if isinstance(fault, dict) else None
        if isinstance(errors, dict):
            errors = [errors]

        provider_status = detail.get("provider_status")
        if isinstance(errors, list):
            for error in errors:
                if not isinstance(error, dict):
                    continue
                code = str(error.get("code") or "").strip()
                message = str(error.get("Message") or "").strip()
                detail_text = str(error.get("Detail") or "").strip()
                combined = f"{message} {detail_text}".lower()

                if code == "6140" or "document en double" in combined or "duplicate" in combined:
                    return (
                        "QuickBooks rejected this invoice because the invoice number is already in use. "
                        "Use a different invoice number and try again."
                    )
                if code == "6000" or "tps/tvh" in combined or "tax code" in combined:
                    return (
                        "QuickBooks rejected this invoice because a required tax code is missing or not mapped. "
                        "Sync QuickBooks tax codes and verify the invoice tax setup."
                    )
                if "validation" in combined:
                    return (
                        "QuickBooks rejected this invoice because some required invoice details are invalid or missing. "
                        "Review the invoice details and try again."
                    )

        raw_message = str(detail.get("message") or "").strip().lower()
        if "creation failed" in raw_message:
            return (
                f"QuickBooks could not create the invoice{f' (HTTP {provider_status})' if provider_status else ''}. "
                "Please review the invoice details and try again."
            )
        if "lookup failed" in raw_message:
            return "QuickBooks lookup failed while preparing the invoice sync. Please try again."
        if "fetch failed" in raw_message:
            return "QuickBooks could not load the existing invoice during sync. Please try again."

        return "QuickBooks sync failed. Please review the invoice setup and try again."

    @staticmethod
    def _is_duplicate_doc_number_error(exc: HTTPException) -> bool:
        detail = exc.detail
        if not isinstance(detail, dict):
            return False
        provider_response = detail.get("provider_response")
        if not isinstance(provider_response, dict):
            return False
        fault = provider_response.get("Fault")
        if not isinstance(fault, dict):
            return False
        errors = fault.get("Error")
        if isinstance(errors, dict):
            errors = [errors]
        if not isinstance(errors, list):
            return False
        for error in errors:
            if not isinstance(error, dict):
                continue
            code = str(error.get("code") or "").strip()
            message = f"{error.get('Message') or ''} {error.get('Detail') or ''}".lower()
            if code == "6140":
                return True
            if "duplicate" in message or "document en double" in message:
                return True
        return False

    @staticmethod
    def _company_api_base() -> str:
        if QB_ENV == "production":
            return "https://quickbooks.api.intuit.com/v3"
        return "https://sandbox-quickbooks.api.intuit.com/v3"

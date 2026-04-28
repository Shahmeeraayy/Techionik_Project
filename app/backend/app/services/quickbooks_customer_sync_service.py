from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from typing import Any

import requests
from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..core.config import QB_ENV
from ..models.dealership import Dealership
from .quickbooks_connection_service import QuickBooksConnectionService


QUERY_PAGE_SIZE = 1000


@dataclass(frozen=True)
class QuickBooksCustomerSyncResult:
    synced_count: int
    created_count: int
    updated_count: int
    inactive_count: int


class QuickBooksCustomerSyncService:
    def __init__(self, db: Session):
        self.db = db
        self.connection_service = QuickBooksConnectionService(db)

    def sync_customers(self) -> QuickBooksCustomerSyncResult:
        connection = self.connection_service.get_active_connection_or_raise(refresh_if_needed=True)
        customers = self._fetch_all_customers(realm_id=connection.realm_id, access_token=connection.access_token)

        created_count = 0
        updated_count = 0
        inactive_count = 0
        synced_count = 0

        for customer in customers:
            row, created = self._upsert_customer(customer)
            synced_count += 1
            if created:
                created_count += 1
            else:
                updated_count += 1
            if row.status == "inactive":
                inactive_count += 1

        return QuickBooksCustomerSyncResult(
            synced_count=synced_count,
            created_count=created_count,
            updated_count=updated_count,
            inactive_count=inactive_count,
        )

    def _fetch_all_customers(self, *, realm_id: str, access_token: str) -> list[dict[str, Any]]:
        base_url = self._company_api_base()
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/json",
            "Content-Type": "application/text",
        }

        customers: list[dict[str, Any]] = []
        start_position = 1
        while True:
            query = (
                "SELECT * FROM Customer "
                "WHERE Active IN (true,false) "
                f"STARTPOSITION {start_position} MAXRESULTS {QUERY_PAGE_SIZE}"
            )
            response = requests.post(
                f"{base_url}/company/{realm_id}/query",
                headers=headers,
                params={"minorversion": 75},
                data=query,
                timeout=30,
            )
            try:
                payload = response.json()
            except ValueError as exc:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="QuickBooks customer query returned invalid JSON.",
                ) from exc

            if not response.ok:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail={
                        "message": "QuickBooks customer query failed.",
                        "provider_status": response.status_code,
                        "provider_response": payload,
                    },
                )

            query_response = payload.get("QueryResponse") if isinstance(payload, dict) else None
            page_customers = query_response.get("Customer") if isinstance(query_response, dict) else []
            normalized_page_customers = page_customers if isinstance(page_customers, list) else ([page_customers] if page_customers else [])

            for raw in normalized_page_customers:
                if isinstance(raw, dict):
                    customers.append(raw)

            if len(normalized_page_customers) < QUERY_PAGE_SIZE:
                break
            start_position += QUERY_PAGE_SIZE

        return customers

    def _upsert_customer(self, customer: dict[str, Any]) -> tuple[Dealership, bool]:
        qb_customer_id = str(customer.get("Id") or "").strip()
        name = self._resolve_name(customer)
        if not qb_customer_id or not name:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="QuickBooks returned a customer without Id or name.",
            )

        row = (
            self.db.query(Dealership)
            .filter(Dealership.qb_customer_id == qb_customer_id)
            .first()
        )
        created = False
        if row is None:
            normalized_name = self._normalize_name(name)
            if normalized_name:
                row = next(
                    (
                        candidate
                        for candidate in self.db.query(Dealership).order_by(Dealership.code.asc()).all()
                        if self._normalize_name(candidate.name) == normalized_name
                    ),
                    None,
                )

        phone = self._extract_phone(customer)
        email = self._extract_email(customer)
        address, city, postal_code = self._extract_address(customer)

        if row is None:
            row = Dealership(
                qb_customer_id=qb_customer_id,
                code=self._generate_next_code(),
                name=name,
                phone=phone,
                email=email,
                address=address,
                city=city,
                postal_code=postal_code,
                status="active",
                notes="Synced from QuickBooks",
            )
            self.db.add(row)
            created = True
        else:
            row.qb_customer_id = qb_customer_id
            row.name = name
            row.phone = phone
            row.email = email
            row.address = address
            row.city = city
            row.postal_code = postal_code
            if not (row.notes or "").strip():
                row.notes = "Synced from QuickBooks"

        try:
            self.db.flush()
        except IntegrityError as exc:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Unable to sync QuickBooks customer '{name}' due to a dealership uniqueness conflict.",
            ) from exc

        self.db.commit()
        self.db.refresh(row)
        return row, created

    def _generate_next_code(self) -> str:
        max_number = 0
        for row in self.db.query(Dealership.code).all():
            code = str(row[0] or "").strip().upper()
            match = re.match(r"^D-(\d+)$", code, re.IGNORECASE)
            if not match:
                continue
            max_number = max(max_number, int(match.group(1)))
        return f"D-{max_number + 1:03d}"

    @staticmethod
    def _resolve_name(customer: dict[str, Any]) -> str:
        for key in ("CompanyName", "DisplayName", "PrintOnCheckName", "FullyQualifiedName"):
            value = str(customer.get(key) or "").strip()
            if value:
                return value
        return ""

    @staticmethod
    def _extract_phone(customer: dict[str, Any]) -> str | None:
        for key in ("PrimaryPhone", "Mobile"):
            payload = customer.get(key)
            if isinstance(payload, dict):
                value = str(payload.get("FreeFormNumber") or "").strip()
                if value:
                    return value
        return None

    @staticmethod
    def _extract_email(customer: dict[str, Any]) -> str | None:
        payload = customer.get("PrimaryEmailAddr")
        if isinstance(payload, dict):
            value = str(payload.get("Address") or "").strip()
            if value:
                return value
        return None

    @staticmethod
    def _extract_address(customer: dict[str, Any]) -> tuple[str | None, str | None, str | None]:
        for key in ("BillAddr", "ShipAddr"):
            payload = customer.get(key)
            if not isinstance(payload, dict):
                continue
            lines = []
            for line_key in ("Line1", "Line2", "Line3", "Line4", "Line5"):
                value = str(payload.get(line_key) or "").strip()
                if value:
                    lines.append(value)
            address = ", ".join(lines) or None
            city = str(payload.get("City") or "").strip() or None
            postal_code = str(payload.get("PostalCode") or "").strip() or None
            if address or city or postal_code:
                return address, city, postal_code
        return None, None, None

    @staticmethod
    def _normalize_name(value: str | None) -> str:
        if not value:
            return ""
        normalized = unicodedata.normalize("NFD", value.strip().lower())
        normalized = "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")
        return " ".join(normalized.split())

    @staticmethod
    def _company_api_base() -> str:
        if QB_ENV == "production":
            return "https://quickbooks.api.intuit.com/v3"
        return "https://sandbox-quickbooks.api.intuit.com/v3"

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from typing import Any

import requests
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from ..core.config import QB_ENV
from ..models.quickbooks_tax_code import QuickBooksTaxCode
from .quickbooks_connection_service import QuickBooksConnectionService

QUERY_PAGE_SIZE = 1000
SUPPORTED_INTERNAL_TAX_CODES = ("EXEMPT", "GST", "GST_QST")


@dataclass(frozen=True)
class QuickBooksTaxCodeSyncResult:
    synced_count: int
    created_count: int
    updated_count: int
    active_count: int
    mapped_count: int
    sales_tax_enabled: bool


class QuickBooksTaxCodeSyncService:
    def __init__(self, db: Session):
        self.db = db
        self.connection_service = QuickBooksConnectionService(db)

    def sync_tax_codes(self) -> QuickBooksTaxCodeSyncResult:
        connection = self.connection_service.get_active_connection_or_raise(refresh_if_needed=True)
        sales_tax_enabled = self.verify_sales_tax_enabled(
            realm_id=connection.realm_id,
            access_token=connection.access_token,
        )
        tax_codes = self._fetch_all_tax_codes(
            realm_id=connection.realm_id,
            access_token=connection.access_token,
        )

        created_count = 0
        updated_count = 0
        active_count = 0
        synced_count = 0

        for tax_code in tax_codes:
            row, created = self._upsert_tax_code(connection.realm_id, tax_code)
            synced_count += 1
            if created:
                created_count += 1
            else:
                updated_count += 1
            if row.active:
                active_count += 1

        mapped_count = (
            self.db.query(QuickBooksTaxCode)
            .filter(
                QuickBooksTaxCode.realm_id == connection.realm_id,
                QuickBooksTaxCode.internal_tax_code.in_(SUPPORTED_INTERNAL_TAX_CODES),
                QuickBooksTaxCode.active.is_(True),
            )
            .count()
        )

        return QuickBooksTaxCodeSyncResult(
            synced_count=synced_count,
            created_count=created_count,
            updated_count=updated_count,
            active_count=active_count,
            mapped_count=mapped_count,
            sales_tax_enabled=sales_tax_enabled,
        )

    def verify_sales_tax_enabled(self, *, realm_id: str, access_token: str) -> bool:
        preferences = self._fetch_preferences(realm_id=realm_id, access_token=access_token)
        return bool(((preferences.get("TaxPrefs") or {}).get("UsingSalesTax")))

    def get_tax_code_id_for_internal_code(self, internal_tax_code: str, *, realm_id: str | None = None) -> str:
        resolved_realm_id = realm_id
        if not resolved_realm_id:
            connection = self.connection_service.get_active_connection_or_raise(refresh_if_needed=True)
            resolved_realm_id = connection.realm_id
        normalized = internal_tax_code.strip().upper()
        row = (
            self.db.query(QuickBooksTaxCode)
            .filter(
                QuickBooksTaxCode.realm_id == resolved_realm_id,
                QuickBooksTaxCode.internal_tax_code == normalized,
                QuickBooksTaxCode.active.is_(True),
            )
            .order_by(QuickBooksTaxCode.updated_at.desc())
            .first()
        )
        if row is None:
            row = self._repair_missing_internal_mapping(
                realm_id=resolved_realm_id,
                internal_tax_code=normalized,
            )
        if row is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    f"QuickBooks TaxCode mapping is missing for internal tax code '{normalized}'. "
                    "Run the QuickBooks tax code sync and verify the mapping."
                ),
            )
        return str(row.qb_tax_code_id)

    def _repair_missing_internal_mapping(
        self,
        *,
        realm_id: str,
        internal_tax_code: str,
    ) -> QuickBooksTaxCode | None:
        active_rows = (
            self.db.query(QuickBooksTaxCode)
            .filter(
                QuickBooksTaxCode.realm_id == realm_id,
                QuickBooksTaxCode.active.is_(True),
            )
            .order_by(QuickBooksTaxCode.updated_at.desc())
            .all()
        )
        candidates: list[QuickBooksTaxCode] = []
        for row in active_rows:
            inferred = self._infer_internal_tax_code(
                name=row.name,
                description=row.description,
                tax_code={},
            )
            if inferred == internal_tax_code:
                candidates.append(row)

        if len(candidates) != 1:
            return None

        row = candidates[0]
        if row.internal_tax_code != internal_tax_code:
            row.internal_tax_code = internal_tax_code
            self.db.commit()
            self.db.refresh(row)
        return row

    def _fetch_all_tax_codes(self, *, realm_id: str, access_token: str) -> list[dict[str, Any]]:
        base_url = self._company_api_base()
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/json",
            "Content-Type": "application/text",
        }

        tax_codes: list[dict[str, Any]] = []
        start_position = 1
        while True:
            query = (
                "SELECT * FROM TaxCode "
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
                    detail="QuickBooks tax code query returned invalid JSON.",
                ) from exc

            if not response.ok:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail={
                        "message": "QuickBooks tax code query failed.",
                        "provider_status": response.status_code,
                        "provider_response": payload,
                    },
                )

            query_response = payload.get("QueryResponse") if isinstance(payload, dict) else None
            page_tax_codes = query_response.get("TaxCode") if isinstance(query_response, dict) else []
            normalized_page_tax_codes = page_tax_codes if isinstance(page_tax_codes, list) else ([page_tax_codes] if page_tax_codes else [])

            for raw in normalized_page_tax_codes:
                if isinstance(raw, dict):
                    tax_codes.append(raw)

            if len(normalized_page_tax_codes) < QUERY_PAGE_SIZE:
                break
            start_position += QUERY_PAGE_SIZE

        return tax_codes

    def _fetch_preferences(self, *, realm_id: str, access_token: str) -> dict[str, Any]:
        response = requests.post(
            f"{self._company_api_base()}/company/{realm_id}/query",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/json",
                "Content-Type": "application/text",
            },
            params={"minorversion": 75},
            data="SELECT * FROM Preferences",
            timeout=30,
        )
        try:
            payload = response.json()
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="QuickBooks preferences query returned invalid JSON.",
            ) from exc

        if not response.ok:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail={
                    "message": "QuickBooks preferences query failed.",
                    "provider_status": response.status_code,
                    "provider_response": payload,
                },
            )

        query_response = payload.get("QueryResponse") if isinstance(payload, dict) else None
        preferences = query_response.get("Preferences") if isinstance(query_response, dict) else None
        if isinstance(preferences, list):
            return next((row for row in preferences if isinstance(row, dict)), {})
        if isinstance(preferences, dict):
            return preferences
        return {}

    def _upsert_tax_code(self, realm_id: str, tax_code: dict[str, Any]) -> tuple[QuickBooksTaxCode, bool]:
        qb_tax_code_id = str(tax_code.get("Id") or "").strip()
        name = str(tax_code.get("Name") or "").strip()
        if not qb_tax_code_id or not name:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="QuickBooks returned a tax code without Id or Name.",
            )

        description = str(tax_code.get("Description") or "").strip() or None
        active = bool(tax_code.get("Active", True))
        internal_tax_code = self._infer_internal_tax_code(name=name, description=description, tax_code=tax_code)

        row = (
            self.db.query(QuickBooksTaxCode)
            .filter(
                QuickBooksTaxCode.realm_id == realm_id,
                QuickBooksTaxCode.qb_tax_code_id == qb_tax_code_id,
            )
            .first()
        )
        created = False
        if row is None:
            row = QuickBooksTaxCode(
                realm_id=realm_id,
                qb_tax_code_id=qb_tax_code_id,
                name=name,
                description=description,
                active=active,
                internal_tax_code=internal_tax_code,
            )
            self.db.add(row)
            created = True
        else:
            row.name = name
            row.description = description
            row.active = active
            row.internal_tax_code = internal_tax_code

        self.db.flush()
        self.db.commit()
        self.db.refresh(row)
        return row, created

    def _infer_internal_tax_code(
        self,
        *,
        name: str,
        description: str | None,
        tax_code: dict[str, Any],
    ) -> str | None:
        normalized_name = self._normalize_text(name)
        normalized_description = self._normalize_text(description or "")
        combined = f"{normalized_name} {normalized_description}".strip()

        if self._looks_exempt(combined):
            return "EXEMPT"
        if self._looks_gst_qst(combined):
            return "GST_QST"
        if self._looks_gst(combined, tax_code):
            return "GST"
        return None

    @staticmethod
    def _looks_exempt(value: str) -> bool:
        return any(
            token in value
            for token in (
                "exempt",
                "exempte",
                "exonere",
                "exoneration",
                "zero rated",
                "zero rate",
                "zero-rated",
                "detaxe",
                "detaxe",
                "sans taxe",
                "hors taxe",
                "hors champ",
                "notax",
                "no tax",
                "non taxable",
                "non-taxable",
                "non imposable",
                "non tax",
                "tax exempt",
                "out of scope",
            )
        )

    @staticmethod
    def _looks_gst_qst(value: str) -> bool:
        has_gst = any(token in value for token in ("gst", "tps", "hst", "tvh"))
        has_qst = any(token in value for token in ("qst", "tvq"))
        return has_gst and has_qst

    def _looks_gst(self, value: str, tax_code: dict[str, Any]) -> bool:
        if self._looks_gst_qst(value):
            return False
        if any(token in value for token in ("gst", "tps", "hst", "tvh")):
            return True

        names = " ".join(self._extract_tax_rate_names(tax_code))
        normalized_names = self._normalize_text(names)
        return any(token in normalized_names for token in ("gst", "tps", "hst", "tvh"))

    def _extract_tax_rate_names(self, tax_code: dict[str, Any]) -> list[str]:
        rate_names: list[str] = []
        sales_tax_rate_list = tax_code.get("SalesTaxRateList")
        if not isinstance(sales_tax_rate_list, dict):
            return rate_names
        tax_rate_details = sales_tax_rate_list.get("TaxRateDetail")
        details = tax_rate_details if isinstance(tax_rate_details, list) else ([tax_rate_details] if tax_rate_details else [])
        for detail in details:
            if not isinstance(detail, dict):
                continue
            rate_ref = detail.get("TaxRateRef")
            if isinstance(rate_ref, dict):
                value = str(rate_ref.get("name") or rate_ref.get("value") or "").strip()
                if value:
                    rate_names.append(value)
        return rate_names

    @staticmethod
    def _normalize_text(value: str) -> str:
        lowered = unicodedata.normalize("NFKD", value.strip().lower())
        lowered = "".join(char for char in lowered if not unicodedata.combining(char))
        return re.sub(r"[^a-z0-9]+", " ", lowered).strip()

    @staticmethod
    def _company_api_base() -> str:
        if QB_ENV == "production":
            return "https://quickbooks.api.intuit.com/v3"
        return "https://sandbox-quickbooks.api.intuit.com/v3"

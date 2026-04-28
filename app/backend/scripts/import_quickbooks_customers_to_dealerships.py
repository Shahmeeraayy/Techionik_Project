from __future__ import annotations

import base64
import os
import re
import unicodedata
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import requests
from sqlalchemy import create_engine, text


ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT / ".env"
TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer"
QUERY_PAGE_SIZE = 1000


def load_env_file(path: Path) -> None:
    if not path.exists():
        return

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def normalize_database_url(value: str) -> str:
    normalized = value.strip()
    if normalized.startswith("postgres://"):
        return "postgresql+psycopg://" + normalized[len("postgres://") :]
    if normalized.startswith("postgresql://") and "+psycopg" not in normalized.split("://", 1)[0]:
        return "postgresql+psycopg://" + normalized[len("postgresql://") :]
    return normalized


def normalize_name(value: str | None) -> str:
    if not value:
        return ""
    normalized = unicodedata.normalize("NFD", value.strip().lower())
    normalized = "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")
    normalized = re.sub(r"\s+", " ", normalized)
    return normalized


def extract_customer_name(customer: dict[str, Any]) -> str:
    candidates = [
        customer.get("CompanyName"),
        customer.get("DisplayName"),
        customer.get("PrintOnCheckName"),
        customer.get("FullyQualifiedName"),
    ]
    for candidate in candidates:
        value = str(candidate or "").strip()
        if value:
            return value
    return ""


def extract_primary_phone(customer: dict[str, Any]) -> str | None:
    for key in ("PrimaryPhone", "Mobile"):
        payload = customer.get(key)
        if isinstance(payload, dict):
            value = str(payload.get("FreeFormNumber") or "").strip()
            if value:
                return value
    return None


def extract_primary_email(customer: dict[str, Any]) -> str | None:
    payload = customer.get("PrimaryEmailAddr")
    if isinstance(payload, dict):
        value = str(payload.get("Address") or "").strip()
        if value:
            return value
    return None


def extract_address(customer: dict[str, Any]) -> tuple[str | None, str | None, str | None]:
    payload = customer.get("BillAddr")
    if not isinstance(payload, dict):
        payload = customer.get("ShipAddr")
    if not isinstance(payload, dict):
        return None, None, None

    line_values = []
    for key in ("Line1", "Line2", "Line3", "Line4", "Line5"):
        value = str(payload.get(key) or "").strip()
        if value:
            line_values.append(value)
    address = ", ".join(line_values) or None
    city = str(payload.get("City") or "").strip() or None
    postal_code = str(payload.get("PostalCode") or "").strip() or None
    return address, city, postal_code


def build_import_note(customer_id: str) -> str:
    imported_at = datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%SZ")
    return f"Imported from QuickBooks customer {customer_id} on {imported_at}"


@dataclass
class QuickBooksConnectionRow:
    id: str
    realm_id: str
    access_token: str
    refresh_token: str
    expires_at: datetime | None
    refresh_expires_at: datetime | None
    environment: str


class QuickBooksCustomerImporter:
    def __init__(self) -> None:
        load_env_file(ENV_PATH)
        self.database_url = normalize_database_url(os.environ["DATABASE_URL"])
        self.qb_client_id = os.environ.get("QB_CLIENT_ID", "").strip()
        self.qb_client_secret = os.environ.get("QB_CLIENT_SECRET", "").strip()
        self.engine = create_engine(self.database_url)

    @staticmethod
    def _to_utc(value: datetime | None) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)

    def _get_active_connection(self) -> QuickBooksConnectionRow:
        with self.engine.connect() as conn:
            row = conn.execute(
                text(
                    """
                    SELECT id, realm_id, access_token, refresh_token, expires_at, refresh_expires_at, environment
                    FROM quickbooks_connections
                    WHERE is_active = true
                    ORDER BY updated_at DESC
                    LIMIT 1
                    """
                )
            ).mappings().first()

        if row is None:
            raise RuntimeError("No active QuickBooks connection found.")

        return QuickBooksConnectionRow(
            id=str(row["id"]),
            realm_id=str(row["realm_id"]),
            access_token=str(row["access_token"]),
            refresh_token=str(row["refresh_token"]),
            expires_at=self._to_utc(row["expires_at"]),
            refresh_expires_at=self._to_utc(row["refresh_expires_at"]),
            environment=str(row["environment"] or "production").strip().lower() or "production",
        )

    def _refresh_access_token(self, connection: QuickBooksConnectionRow) -> QuickBooksConnectionRow:
        if not self.qb_client_id or not self.qb_client_secret:
            return connection

        now = datetime.now(UTC)
        if connection.refresh_expires_at is not None and connection.refresh_expires_at <= now:
            return connection

        auth = base64.b64encode(f"{self.qb_client_id}:{self.qb_client_secret}".encode("utf-8")).decode("utf-8")
        response = requests.post(
            TOKEN_URL,
            headers={
                "Authorization": f"Basic {auth}",
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "application/json",
            },
            data={
                "grant_type": "refresh_token",
                "refresh_token": connection.refresh_token,
            },
            timeout=30,
        )
        payload = response.json()
        if not response.ok:
            return connection

        refreshed = QuickBooksConnectionRow(
            id=connection.id,
            realm_id=connection.realm_id,
            access_token=str(payload.get("access_token") or connection.access_token),
            refresh_token=str(payload.get("refresh_token") or connection.refresh_token),
            expires_at=now + timedelta(seconds=int(payload.get("expires_in", 0) or 0)),
            refresh_expires_at=now + timedelta(seconds=int(payload.get("x_refresh_token_expires_in", 0) or 0)),
            environment=connection.environment,
        )

        with self.engine.begin() as conn:
            conn.execute(
                text(
                    """
                    UPDATE quickbooks_connections
                    SET access_token = :access_token,
                        refresh_token = :refresh_token,
                        token_type = :token_type,
                        scope = :scope,
                        expires_at = :expires_at,
                        refresh_expires_at = :refresh_expires_at,
                        environment = :environment,
                        refresh_error = NULL,
                        updated_at = NOW()
                    WHERE id = :id
                    """
                ),
                {
                    "access_token": refreshed.access_token,
                    "refresh_token": refreshed.refresh_token,
                    "token_type": str(payload.get("token_type") or "") or None,
                    "scope": str(payload.get("scope") or "") or None,
                    "expires_at": refreshed.expires_at,
                    "refresh_expires_at": refreshed.refresh_expires_at,
                    "environment": refreshed.environment,
                    "id": refreshed.id,
                },
            )

        return refreshed

    def _fetch_active_customers(self, connection: QuickBooksConnectionRow) -> list[dict[str, Any]]:
        maybe_refreshed = connection
        now = datetime.now(UTC)
        if maybe_refreshed.expires_at is None or maybe_refreshed.expires_at <= now + timedelta(minutes=5):
            maybe_refreshed = self._refresh_access_token(maybe_refreshed)

        base_url = (
            "https://quickbooks.api.intuit.com/v3"
            if maybe_refreshed.environment == "production"
            else "https://sandbox-quickbooks.api.intuit.com/v3"
        )
        headers = {
            "Authorization": f"Bearer {maybe_refreshed.access_token}",
            "Accept": "application/json",
            "Content-Type": "application/text",
        }

        customers: list[dict[str, Any]] = []
        start_position = 1
        while True:
            query = (
                "SELECT * FROM Customer "
                "WHERE Active = true "
                f"STARTPOSITION {start_position} MAXRESULTS {QUERY_PAGE_SIZE}"
            )
            response = requests.post(
                f"{base_url}/company/{maybe_refreshed.realm_id}/query",
                headers=headers,
                params={"minorversion": 75},
                data=query,
                timeout=30,
            )
            payload = response.json()
            if not response.ok:
                raise RuntimeError(f"QuickBooks customer query failed: {payload}")

            query_response = payload.get("QueryResponse") if isinstance(payload, dict) else None
            page_customers = query_response.get("Customer") if isinstance(query_response, dict) else []
            if isinstance(page_customers, dict):
                page_customers = [page_customers]
            if not isinstance(page_customers, list):
                page_customers = []

            customers.extend(customer for customer in page_customers if isinstance(customer, dict))
            if len(page_customers) < QUERY_PAGE_SIZE:
                break
            start_position += QUERY_PAGE_SIZE

        return customers

    def _upsert_dealerships(self, customers: list[dict[str, Any]]) -> tuple[int, int]:
        created = 0
        updated = 0

        with self.engine.begin() as conn:
            existing_rows = conn.execute(
                text(
                    """
                    SELECT id, code, name, phone, email, address, city, postal_code, status, notes
                    FROM dealerships
                    ORDER BY code ASC
                    """
                )
            ).mappings().all()
            by_name = {normalize_name(str(row["name"])): row for row in existing_rows if row["name"]}
            max_code_number = 0
            for row in existing_rows:
                match = re.match(r"^D-(\d+)$", str(row["code"] or "").strip(), re.IGNORECASE)
                if match:
                    max_code_number = max(max_code_number, int(match.group(1)))

            for customer in customers:
                customer_id = str(customer.get("Id") or "").strip()
                name = extract_customer_name(customer)
                if not name:
                    continue

                phone = extract_primary_phone(customer)
                email = extract_primary_email(customer)
                address, city, postal_code = extract_address(customer)
                status = "active"
                import_note = build_import_note(customer_id)

                existing = by_name.get(normalize_name(name))
                if existing is not None:
                    next_notes = str(existing["notes"] or "").strip()
                    if not next_notes:
                        next_notes = import_note
                    elif f"customer {customer_id}" not in next_notes.lower():
                        next_notes = f"{next_notes}\n{import_note}"

                    conn.execute(
                        text(
                            """
                            UPDATE dealerships
                            SET name = :name,
                                phone = :phone,
                                email = :email,
                                address = :address,
                                city = :city,
                                postal_code = :postal_code,
                                status = :status,
                                notes = :notes,
                                updated_at = NOW()
                            WHERE id = :id
                            """
                        ),
                        {
                            "id": existing["id"],
                            "name": name,
                            "phone": phone,
                            "email": email,
                            "address": address,
                            "city": city,
                            "postal_code": postal_code,
                            "status": status,
                            "notes": next_notes,
                        },
                    )
                    updated += 1
                    continue

                max_code_number += 1
                code = f"D-{max_code_number:03d}"
                conn.execute(
                    text(
                        """
                        INSERT INTO dealerships (
                            id, code, name, phone, email, address, city, postal_code, status, notes, created_at, updated_at
                        )
                        VALUES (
                            gen_random_uuid(), :code, :name, :phone, :email, :address, :city, :postal_code, :status, :notes, NOW(), NOW()
                        )
                        """
                    ),
                    {
                        "code": code,
                        "name": name,
                        "phone": phone,
                        "email": email,
                        "address": address,
                        "city": city,
                        "postal_code": postal_code,
                        "status": status,
                        "notes": import_note,
                    },
                )
                by_name[normalize_name(name)] = {"code": code, "name": name}
                created += 1

        return created, updated

    def run(self) -> tuple[int, int, int]:
        connection = self._get_active_connection()
        customers = self._fetch_active_customers(connection)
        created, updated = self._upsert_dealerships(customers)
        return len(customers), created, updated


if __name__ == "__main__":
    importer = QuickBooksCustomerImporter()
    total, created, updated = importer.run()
    print(f"quickbooks_active_customers={total}")
    print(f"dealerships_created={created}")
    print(f"dealerships_updated={updated}")

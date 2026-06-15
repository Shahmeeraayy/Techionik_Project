from __future__ import annotations

from datetime import datetime, timedelta, timezone
import math

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from ..models.auth_login_state import AuthLoginState


DEFAULT_LOGIN_ATTEMPT_LIMIT = 5
DEFAULT_ACCOUNT_LOCKOUT_MINUTES = 30
SUPPORTED_IDENTITY_TYPES = {"admin", "super_admin", "technician"}


class AuthSecurityService:
    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def _normalize_email(email: str) -> str:
        return email.strip().lower()

    def _normalize_identity_type(self, identity_type: str) -> str:
        normalized = identity_type.strip().lower()
        if normalized not in SUPPORTED_IDENTITY_TYPES:
            raise ValueError(f"Unsupported identity type: {identity_type}")
        return normalized

    @staticmethod
    def _as_utc(value: datetime | None) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)

    def _get_state_row(self, identity_type: str, email: str) -> AuthLoginState | None:
        return (
            self.db.query(AuthLoginState)
            .filter(
                AuthLoginState.identity_type == self._normalize_identity_type(identity_type),
                AuthLoginState.email == self._normalize_email(email),
            )
            .first()
        )

    def _get_or_create_state_row(self, identity_type: str, email: str) -> AuthLoginState:
        normalized_identity = self._normalize_identity_type(identity_type)
        normalized_email = self._normalize_email(email)
        row = self._get_state_row(normalized_identity, normalized_email)
        if row is not None:
            return row

        row = AuthLoginState(
            identity_type=normalized_identity,
            email=normalized_email,
            failed_attempts=0,
        )
        self.db.add(row)
        self.db.flush()
        self.db.refresh(row)
        return row

    def _remaining_minutes(self, locked_until: datetime) -> int:
        locked_until = self._as_utc(locked_until) or datetime.now(timezone.utc)
        now = datetime.now(timezone.utc)
        delta = locked_until - now
        if delta.total_seconds() <= 0:
            return 0
        return max(1, math.ceil(delta.total_seconds() / 60))

    def ensure_login_allowed(
        self,
        *,
        identity_type: str,
        email: str,
    ) -> None:
        row = self._get_state_row(identity_type, email)
        if row is None or row.locked_until is None:
            return

        now = datetime.now(timezone.utc)
        locked_until = self._as_utc(row.locked_until)
        if locked_until is not None and locked_until <= now:
            row.failed_attempts = 0
            row.locked_until = None
            row.last_failed_at = None
            self.db.commit()
            return

        remaining_minutes = self._remaining_minutes(locked_until)
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=(
                "Too many failed sign-in attempts. "
                f"Try again in {remaining_minutes} minute{'s' if remaining_minutes != 1 else ''}."
            ),
        )

    def record_failed_attempt(
        self,
        *,
        identity_type: str,
        email: str,
        attempt_limit: int = DEFAULT_LOGIN_ATTEMPT_LIMIT,
        lockout_minutes: int = DEFAULT_ACCOUNT_LOCKOUT_MINUTES,
    ) -> AuthLoginState:
        row = self._get_or_create_state_row(identity_type, email)
        now = datetime.now(timezone.utc)

        locked_until = self._as_utc(row.locked_until)
        if locked_until is not None and locked_until > now:
            remaining_minutes = self._remaining_minutes(locked_until)
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail=(
                    "Too many failed sign-in attempts. "
                    f"Try again in {remaining_minutes} minute{'s' if remaining_minutes != 1 else ''}."
                ),
            )

        if locked_until is not None and locked_until <= now:
            row.failed_attempts = 0
            row.locked_until = None
            row.last_failed_at = None

        row.failed_attempts = int(row.failed_attempts or 0) + 1
        row.last_failed_at = now
        if row.failed_attempts >= attempt_limit:
            row.failed_attempts = attempt_limit
            row.locked_until = now + timedelta(minutes=lockout_minutes)

        self.db.commit()
        self.db.refresh(row)
        locked_until = self._as_utc(row.locked_until)
        if locked_until is not None and locked_until > now:
            remaining_minutes = self._remaining_minutes(locked_until)
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail=(
                    "Too many failed sign-in attempts. "
                    f"Try again in {remaining_minutes} minute{'s' if remaining_minutes != 1 else ''}."
                ),
            )
        return row

    def record_success(
        self,
        *,
        identity_type: str,
        email: str,
    ) -> None:
        row = self._get_state_row(identity_type, email)
        if row is None:
            return

        row.failed_attempts = 0
        row.last_failed_at = None
        row.locked_until = None
        row.last_success_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(row)

    def clear_state(
        self,
        *,
        identity_type: str,
        email: str,
    ) -> None:
        row = self._get_state_row(identity_type, email)
        if row is None:
            return

        row.failed_attempts = 0
        row.last_failed_at = None
        row.locked_until = None
        self.db.commit()
        self.db.refresh(row)

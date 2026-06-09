from datetime import datetime, timezone
from typing import Any, Iterable, Sequence
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from ..core.enums import UserRole
from ..core.security import AuthenticatedUser
from ..models.admin_user import AdminUser
from ..models.notification import Notification


class NotificationService:
    def __init__(self, db: Session):
        self.db = db

    @property
    def tenant_id(self) -> UUID | None:
        tenant_id = self.db.info.get("tenant_id")
        if tenant_id is None:
            return None
        return UUID(str(tenant_id))

    @staticmethod
    def _normalize_payload(payload: dict[str, Any] | None) -> dict[str, Any] | None:
        if not payload:
            return None
        return {key: value for key, value in payload.items() if value is not None}

    @staticmethod
    def _dedupe_recipient_ids(recipient_user_ids: Sequence[UUID | str | None]) -> list[UUID]:
        normalized: list[UUID] = []
        seen: set[UUID] = set()
        for item in recipient_user_ids:
            if item is None:
                continue
            candidate = UUID(str(item))
            if candidate in seen:
                continue
            seen.add(candidate)
            normalized.append(candidate)
        return normalized

    def _require_supported_role(self, current_user: AuthenticatedUser) -> None:
        if current_user.role not in {UserRole.ADMIN, UserRole.TECHNICIAN}:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Notifications are only available for admins and technicians",
            )

    def list_active_admin_user_ids(self, tenant_id: UUID | None = None) -> list[UUID]:
        effective_tenant_id = tenant_id or self.tenant_id
        if effective_tenant_id is None:
            return []
        rows = (
            self.db.query(AdminUser.id)
            .execution_options(skip_tenant_scope=True)
            .filter(
                AdminUser.tenant_id == effective_tenant_id,
                AdminUser.status == "active",
            )
            .order_by(AdminUser.created_at.asc(), AdminUser.id.asc())
            .all()
        )
        return [row[0] for row in rows]

    def create_notification(
        self,
        *,
        recipient_user_id: UUID,
        recipient_role: str,
        event_type: str,
        title: str,
        message: str,
        payload: dict[str, Any] | None = None,
        tenant_id: UUID | None = None,
    ) -> Notification:
        now = datetime.now(timezone.utc)
        row = Notification(
            tenant_id=tenant_id or self.tenant_id,
            recipient_user_id=recipient_user_id,
            recipient_role=recipient_role.strip().lower(),
            event_type=event_type.strip().lower(),
            title=title.strip(),
            message=message.strip(),
            payload=self._normalize_payload(payload),
            is_read=False,
            delivered_at=now,
            status="delivered",
        )
        self.db.add(row)
        self.db.flush()
        self.db.refresh(row)
        return row

    def create_notifications(
        self,
        *,
        recipient_role: str,
        recipient_user_ids: Sequence[UUID | str | None],
        event_type: str,
        title: str,
        message: str,
        payload: dict[str, Any] | None = None,
        tenant_id: UUID | None = None,
    ) -> list[Notification]:
        rows: list[Notification] = []
        for recipient_user_id in self._dedupe_recipient_ids(recipient_user_ids):
            rows.append(
                self.create_notification(
                    recipient_user_id=recipient_user_id,
                    recipient_role=recipient_role,
                    event_type=event_type,
                    title=title,
                    message=message,
                    payload=payload,
                    tenant_id=tenant_id,
                )
            )
        return rows

    def create_admin_notifications(
        self,
        *,
        event_type: str,
        title: str,
        message: str,
        payload: dict[str, Any] | None = None,
        tenant_id: UUID | None = None,
        exclude_user_ids: Iterable[UUID | str | None] | None = None,
    ) -> list[Notification]:
        excluded = {
            UUID(str(item))
            for item in (exclude_user_ids or [])
            if item is not None
        }
        recipient_user_ids = [
            admin_user_id
            for admin_user_id in self.list_active_admin_user_ids(tenant_id)
            if admin_user_id not in excluded
        ]
        return self.create_notifications(
            recipient_role="admin",
            recipient_user_ids=recipient_user_ids,
            event_type=event_type,
            title=title,
            message=message,
            payload=payload,
            tenant_id=tenant_id,
        )

    def list_notifications(
        self,
        *,
        current_user: AuthenticatedUser,
        limit: int = 20,
    ) -> list[Notification]:
        self._require_supported_role(current_user)
        return (
            self.db.query(Notification)
            .filter(
                Notification.recipient_role == current_user.role.value,
                Notification.recipient_user_id == current_user.user_id,
            )
            .order_by(Notification.created_at.desc(), Notification.id.desc())
            .limit(limit)
            .all()
        )

    def get_unread_count(self, *, current_user: AuthenticatedUser) -> int:
        self._require_supported_role(current_user)
        return int(
            self.db.query(Notification.id)
            .filter(
                Notification.recipient_role == current_user.role.value,
                Notification.recipient_user_id == current_user.user_id,
                Notification.is_read.is_(False),
            )
            .count()
        )

    def mark_read(
        self,
        *,
        current_user: AuthenticatedUser,
        notification_id: UUID,
    ) -> Notification:
        self._require_supported_role(current_user)
        row = (
            self.db.query(Notification)
            .filter(
                Notification.id == notification_id,
                Notification.recipient_role == current_user.role.value,
                Notification.recipient_user_id == current_user.user_id,
            )
            .first()
        )
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
        if not row.is_read:
            now = datetime.now(timezone.utc)
            row.is_read = True
            row.read_at = now
            row.delivered_at = row.delivered_at or now
            row.status = "read"
            self.db.commit()
            self.db.refresh(row)
        return row

    def mark_all_read(self, *, current_user: AuthenticatedUser) -> int:
        self._require_supported_role(current_user)
        rows = (
            self.db.query(Notification)
            .filter(
                Notification.recipient_role == current_user.role.value,
                Notification.recipient_user_id == current_user.user_id,
                Notification.is_read.is_(False),
            )
            .all()
        )
        if not rows:
            return 0
        now = datetime.now(timezone.utc)
        for row in rows:
            row.is_read = True
            row.read_at = now
            row.delivered_at = row.delivered_at or now
            row.status = "read"
        self.db.commit()
        return len(rows)

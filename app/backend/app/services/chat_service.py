from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from ..core.enums import AuditEntityType, UserRole
from ..core.security import AuthenticatedUser
from ..repositories.chat_repository import ChatRepository
from ..repositories.technician_repository import TechnicianRepository
from ..schemas.chat import (
    AdminChatConversationSummaryResponse,
    AdminChatUnreadCountResponse,
    ChatAttachmentResponse,
    ChatMessageCreateRequest,
    ChatMessageResponse,
)
from .audit_service import AuditService
from .availability_service import AvailabilityService


class ChatService:
    def __init__(self, db: Session, current_user: AuthenticatedUser):
        self.db = db
        self.current_user = current_user
        self.repo = ChatRepository(db)
        self.technician_repo = TechnicianRepository(db)
        self.availability_service = AvailabilityService(db, repository=self.technician_repo)

    def _require_technician(self, technician_id: UUID):
        technician = self.repo.get_technician_by_id(technician_id)
        if technician is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Technician not found")
        return technician

    def _attachment_response(self, attachments: Optional[list]) -> List[ChatAttachmentResponse]:
        output: List[ChatAttachmentResponse] = []
        for item in attachments or []:
            output.append(
                ChatAttachmentResponse(
                    id=str(item.get("id") or ""),
                    name=str(item.get("name") or "attachment"),
                    mime_type=str(item.get("mime_type") or "application/octet-stream"),
                    size_bytes=int(item.get("size_bytes") or 0),
                    data_url=str(item.get("data_url") or ""),
                )
            )
        return output

    def _message_response(self, row) -> ChatMessageResponse:
        return ChatMessageResponse(
            id=row.id,
            technician_id=row.technician_id,
            sender_role=row.sender_role,
            sender_id=row.sender_id,
            text=row.body,
            attachments=self._attachment_response(row.attachments),
            is_broadcast=bool(row.is_broadcast),
            created_at=row.created_at,
            delivered_at=row.delivered_at,
            read_at=row.read_at,
        )

    def _technician_status_label(self, technician_id: UUID, technician_status: str, current_jobs_count: int) -> str:
        if technician_status != "active":
            return "Offline"
        if self.availability_service.is_on_leave_now(technician_id):
            return "Out of Office"
        if current_jobs_count > 0:
            return "In Progress"
        if self.availability_service.compute_effective_availability(technician_id):
            return "Available"
        return "Offline"

    def list_admin_conversations(self, search: Optional[str] = None) -> List[AdminChatConversationSummaryResponse]:
        technicians = self.repo.list_technicians()
        query = search.strip().lower() if search else ""
        results: List[AdminChatConversationSummaryResponse] = []

        for technician in technicians:
            display_name = technician.full_name or technician.name
            if query and query not in display_name.lower():
                continue

            current_jobs_count = self.technician_repo.get_current_jobs_count(technician.id)
            latest = self.repo.get_latest_message(technician.id)
            results.append(
                AdminChatConversationSummaryResponse(
                    technician_id=technician.id,
                    technician_name=display_name,
                    technician_email=technician.email,
                    technician_phone=technician.phone,
                    technician_avatar=technician.profile_picture_url,
                    technician_status=self._technician_status_label(technician.id, technician.status, current_jobs_count),
                    current_jobs_count=current_jobs_count,
                    unread_count=self.repo.get_unread_count_for_admin(technician.id),
                    last_message_preview=latest.body if latest and latest.body else (
                        latest.attachments[0]["name"] if latest and latest.attachments else None
                    ),
                    last_message_at=latest.created_at if latest else None,
                )
            )

        results.sort(key=lambda item: item.last_message_at or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
        return results

    def list_admin_messages(self, technician_id: UUID) -> List[ChatMessageResponse]:
        self._require_technician(technician_id)
        now = datetime.now(timezone.utc)
        self.repo.mark_delivered(technician_id=technician_id, recipient_role="admin", now=now)
        rows = self.repo.list_messages(technician_id)
        self.db.commit()
        return [self._message_response(row) for row in rows]

    def send_admin_message(self, technician_id: UUID, payload: ChatMessageCreateRequest) -> ChatMessageResponse:
        self._require_technician(technician_id)
        row = self.repo.create_message(
            technician_id=technician_id,
            sender_role="admin",
            sender_id=self.current_user.user_id,
            body=payload.text,
            attachments=[attachment.dict() for attachment in payload.attachments],
        )
        AuditService.log_event(
            self.db,
            actor_role=UserRole.ADMIN,
            actor_id=self.current_user.user_id,
            action="admin.chat.message_sent",
            entity_type=AuditEntityType.CHAT_MESSAGE.value,
            entity_id=row.id,
            metadata={"technician_id": str(technician_id), "is_broadcast": False},
        )
        self.db.commit()
        return self._message_response(row)

    def broadcast_admin_message(self, payload: ChatMessageCreateRequest) -> List[ChatMessageResponse]:
        technicians = self.repo.list_technicians()
        if not technicians:
            return []

        rows = []
        for technician in technicians:
            row = self.repo.create_message(
                technician_id=technician.id,
                sender_role="admin",
                sender_id=self.current_user.user_id,
                body=payload.text,
                attachments=[attachment.dict() for attachment in payload.attachments],
                is_broadcast=True,
            )
            rows.append(row)
            AuditService.log_event(
                self.db,
                actor_role=UserRole.ADMIN,
                actor_id=self.current_user.user_id,
                action="admin.chat.broadcast_sent",
                entity_type=AuditEntityType.CHAT_MESSAGE.value,
                entity_id=row.id,
                metadata={"technician_id": str(technician.id), "is_broadcast": True},
            )

        self.db.commit()
        return [self._message_response(row) for row in rows]

    def mark_admin_conversation_read(self, technician_id: UUID) -> AdminChatUnreadCountResponse:
        self._require_technician(technician_id)
        now = datetime.now(timezone.utc)
        self.repo.mark_read(technician_id=technician_id, recipient_role="admin", now=now)
        self.db.commit()
        return AdminChatUnreadCountResponse(unread_count=self.repo.get_total_unread_count_for_admin())

    def get_admin_unread_count(self) -> AdminChatUnreadCountResponse:
        return AdminChatUnreadCountResponse(unread_count=self.repo.get_total_unread_count_for_admin())

    def list_technician_messages(self) -> List[ChatMessageResponse]:
        technician_id = self.current_user.user_id
        self._require_technician(technician_id)
        now = datetime.now(timezone.utc)
        self.repo.mark_delivered(technician_id=technician_id, recipient_role="technician", now=now)
        rows = self.repo.list_messages(technician_id)
        self.db.commit()
        return [self._message_response(row) for row in rows]

    def send_technician_message(self, payload: ChatMessageCreateRequest) -> ChatMessageResponse:
        technician_id = self.current_user.user_id
        self._require_technician(technician_id)
        row = self.repo.create_message(
            technician_id=technician_id,
            sender_role="technician",
            sender_id=self.current_user.user_id,
            body=payload.text,
            attachments=[attachment.dict() for attachment in payload.attachments],
        )
        AuditService.log_event(
            self.db,
            actor_role=UserRole.TECHNICIAN,
            actor_id=self.current_user.user_id,
            action="technician.chat.message_sent",
            entity_type=AuditEntityType.CHAT_MESSAGE.value,
            entity_id=row.id,
            metadata={"technician_id": str(technician_id)},
        )
        self.db.commit()
        return self._message_response(row)

    def mark_technician_conversation_read(self) -> dict:
        technician_id = self.current_user.user_id
        self._require_technician(technician_id)
        now = datetime.now(timezone.utc)
        self.repo.mark_read(technician_id=technician_id, recipient_role="technician", now=now)
        self.db.commit()
        return {"status": "ok"}

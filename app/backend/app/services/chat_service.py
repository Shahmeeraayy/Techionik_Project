from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from ..core.enums import AuditEntityType, UserRole
from ..core.security import AuthenticatedUser
from ..models.chat_attachment import ChatAttachment
from ..models.chat_conversation import ChatConversation
from ..models.chat_conversation_message import ChatConversationMessage
from ..repositories.chat_repository import ChatRepository
from ..repositories.technician_repository import TechnicianRepository
from ..schemas.chat import (
    AdminChatConversationSummaryResponse,
    AdminChatUnreadCountResponse,
    ChatAttachmentResponse,
    ChatAuditLogResponse,
    ChatGroupUpsertRequest,
    ChatConversationResolveResponse,
    ChatConversationSummaryResponse,
    ChatMessageCreateRequest,
    ChatMessageResponse,
    ChatPinnedMessagesResponse,
    TechnicianChatConversationSummaryResponse,
)
from .audit_service import AuditService
from .availability_service import AvailabilityService
from .chat_storage_service import ChatStorageService


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

    def _require_job(self, job_id: UUID):
        job = self.repo.get_job_by_id(job_id)
        if job is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
        return job

    def _conversation_title(self, conversation: ChatConversation) -> str:
        if conversation.conversation_type == "job" and conversation.job is not None:
            return f"Job {conversation.job.job_code}"
        members = self.repo.list_conversation_members(conversation.id)
        if len(members) > 1:
            return (conversation.title or "Technician Group").strip() or "Technician Group"
        technician = conversation.technician
        if technician is None and members:
            technician = members[0].technician
        technician_name = (
            (technician.full_name or technician.name)
            if technician is not None
            else "Technician"
        )
        return f"Dispatch with {technician_name}"

    def _conversation_members(self, conversation: ChatConversation):
        members = list(conversation.members or [])
        if members:
            return members
        return self.repo.list_conversation_members(conversation.id)

    def _conversation_channel_kind(self, conversation: ChatConversation) -> str:
        if conversation.conversation_type == "job":
            return "job"
        if len(self._conversation_members(conversation)) > 1:
            return "group"
        return "direct"

    def _sync_conversation_members(self, conversation: ChatConversation, technician_ids: List[UUID]) -> ChatConversation:
        normalized_ids = list(dict.fromkeys(technician_ids))
        if not normalized_ids:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one technician is required")
        self.repo.replace_conversation_members(
            conversation_id=conversation.id,
            technician_ids=normalized_ids,
            added_by_id=self.current_user.user_id,
        )
        conversation.technician_id = normalized_ids[0]
        self.db.flush()
        return self.repo.get_conversation_by_id(conversation.id) or conversation

    def _attachment_response(self, attachment: ChatAttachment) -> ChatAttachmentResponse:
        secure_url = f"/chat/attachments/{attachment.id}/content"
        return ChatAttachmentResponse(
            id=str(attachment.id),
            name=attachment.original_name,
            mime_type=attachment.mime_type,
            size_bytes=attachment.size_bytes,
            attachment_type=attachment.attachment_type,
            duration_seconds=attachment.duration_seconds,
            preview_url=f"{secure_url}?disposition=inline",
            download_url=f"{secure_url}?disposition=attachment",
            data_url=None,
        )

    def _message_response(self, conversation: ChatConversation, row: ChatConversationMessage) -> ChatMessageResponse:
        return ChatMessageResponse(
            id=row.id,
            conversation_id=conversation.id,
            conversation_type=conversation.conversation_type,
            technician_id=conversation.technician_id,
            job_id=conversation.job_id,
            sender_role=row.sender_role,
            sender_id=row.sender_id,
            text=row.body,
            message_type=row.message_type,
            attachments=[self._attachment_response(item) for item in row.attachments],
            is_broadcast=False,
            is_pinned=row.pinned_at is not None,
            pinned_at=row.pinned_at,
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

    def _conversation_summary(
        self,
        conversation: ChatConversation,
        *,
        unread_count: int,
    ) -> ChatConversationSummaryResponse:
        members = self._conversation_members(conversation)
        technician = conversation.technician or (members[0].technician if members else None) or self._require_technician(conversation.technician_id)
        current_jobs_count = self.technician_repo.get_current_jobs_count(technician.id)
        latest_rows = self.repo.list_messages(conversation.id)
        latest = latest_rows[-1] if latest_rows else None
        pinned_count = len(self.repo.list_pinned_messages(conversation.id))
        member_names = [
            (member.technician.full_name or member.technician.name)
            for member in members
            if member.technician is not None
        ]
        member_ids = [member.technician_id for member in members]

        preview = None
        if latest is not None:
            if latest.body:
                preview = latest.body
            elif latest.attachments:
                preview = latest.attachments[0].original_name

        return ChatConversationSummaryResponse(
            id=conversation.id,
            conversation_type=conversation.conversation_type,
            channel_kind=self._conversation_channel_kind(conversation),
            title=self._conversation_title(conversation),
            technician_id=technician.id,
            technician_name=technician.full_name or technician.name,
            technician_email=technician.email,
            technician_phone=technician.phone,
            technician_avatar=technician.profile_picture_url,
            technician_status=self._technician_status_label(technician.id, technician.status, current_jobs_count),
            current_jobs_count=current_jobs_count,
            job_id=conversation.job_id,
            job_code=conversation.job.job_code if conversation.job is not None else None,
            job_status=conversation.job.status if conversation.job is not None else None,
            unread_count=unread_count,
            pinned_count=pinned_count,
            member_count=max(len(member_ids), 1),
            member_ids=member_ids or [technician.id],
            member_names=member_names or [technician.full_name or technician.name],
            last_message_preview=preview,
            last_message_at=latest.created_at if latest is not None else conversation.last_message_at,
        )

    def _build_direct_conversation_key(self, technician_id: UUID) -> str:
        return f"direct:{technician_id}"

    def _build_job_conversation_key(self, job_id: UUID, technician_id: UUID) -> str:
        return f"job:{job_id}:{technician_id}"

    def _get_or_create_direct_conversation(self, technician_id: UUID) -> ChatConversation:
        technician = self._require_technician(technician_id)
        conversation_key = self._build_direct_conversation_key(technician.id)
        row = self.repo.get_conversation_by_key(conversation_key)
        if row is not None:
            refreshed = self.repo.get_conversation_by_id(row.id) or row
            return self._sync_conversation_members(refreshed, [technician.id])
        row = self.repo.create_conversation(
            conversation_key=conversation_key,
            conversation_type="direct",
            technician_id=technician.id,
            job_id=None,
            title=f"Dispatch with {technician.full_name or technician.name}",
            created_by_role=self.current_user.role.value,
            created_by_id=self.current_user.user_id,
        )
        return self._sync_conversation_members(row, [technician.id])

    def _get_or_create_job_conversation(self, job_id: UUID) -> ChatConversation:
        job = self._require_job(job_id)
        if job.assigned_tech_id is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Job must be assigned before opening job chat",
            )
        technician = self._require_technician(job.assigned_tech_id)
        conversation_key = self._build_job_conversation_key(job.id, technician.id)
        row = self.repo.get_conversation_by_key(conversation_key)
        if row is not None:
            refreshed = self.repo.get_conversation_by_id(row.id) or row
            return self._sync_conversation_members(refreshed, [technician.id])
        row = self.repo.create_conversation(
            conversation_key=conversation_key,
            conversation_type="job",
            technician_id=technician.id,
            job_id=job.id,
            title=f"Job {job.job_code}",
            created_by_role=self.current_user.role.value,
            created_by_id=self.current_user.user_id,
        )
        return self._sync_conversation_members(row, [technician.id])

    def create_group_conversation(self, payload: ChatGroupUpsertRequest) -> ChatConversationResolveResponse:
        if self.current_user.role != UserRole.ADMIN:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can create technician groups")
        technicians = [self._require_technician(technician_id) for technician_id in payload.technician_ids]
        conversation = self.repo.create_conversation(
            conversation_key=f"group:{uuid4()}",
            conversation_type="direct",
            technician_id=technicians[0].id,
            job_id=None,
            title=payload.title,
            created_by_role=self.current_user.role.value,
            created_by_id=self.current_user.user_id,
        )
        conversation = self._sync_conversation_members(conversation, [technician.id for technician in technicians])
        AuditService.log_event(
            self.db,
            actor_role=self.current_user.role,
            actor_id=self.current_user.user_id,
            action="chat.group.created",
            entity_type=AuditEntityType.CHAT_CONVERSATION.value,
            entity_id=conversation.id,
            metadata={
                "conversation_id": str(conversation.id),
                "member_ids": [str(technician.id) for technician in technicians],
                "member_count": len(technicians),
                "title": payload.title,
            },
        )
        self.db.commit()
        return ChatConversationResolveResponse(
            conversation=self._conversation_summary(
                self.repo.get_conversation_by_id(conversation.id) or conversation,
                unread_count=0,
            )
        )

    def update_group_conversation(self, conversation_id: UUID, payload: ChatGroupUpsertRequest) -> ChatConversationResolveResponse:
        if self.current_user.role != UserRole.ADMIN:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can manage technician groups")
        conversation = self._require_admin_conversation_access(conversation_id)
        if self._conversation_channel_kind(conversation) != "group":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Conversation is not a technician group")

        previous_members = {member.technician_id for member in self._conversation_members(conversation)}
        technicians = [self._require_technician(technician_id) for technician_id in payload.technician_ids]
        conversation.title = payload.title
        conversation = self._sync_conversation_members(conversation, [technician.id for technician in technicians])
        current_members = {technician.id for technician in technicians}

        AuditService.log_event(
            self.db,
            actor_role=self.current_user.role,
            actor_id=self.current_user.user_id,
            action="chat.group.updated",
            entity_type=AuditEntityType.CHAT_CONVERSATION.value,
            entity_id=conversation.id,
            metadata={
                "conversation_id": str(conversation.id),
                "title": payload.title,
                "added_member_ids": [str(item) for item in sorted(current_members - previous_members)],
                "removed_member_ids": [str(item) for item in sorted(previous_members - current_members)],
                "member_count": len(current_members),
            },
        )
        self.db.commit()
        return ChatConversationResolveResponse(
            conversation=self._conversation_summary(
                self.repo.get_conversation_by_id(conversation.id) or conversation,
                unread_count=self.repo.count_unread_messages(
                    conversation_id=conversation.id,
                    recipient_role="admin",
                    recipient_user_id=self.current_user.user_id,
                ),
            )
        )

    def _record_access_denied(
        self,
        *,
        action: str,
        entity_type: AuditEntityType,
        entity_id: UUID,
        metadata: Optional[dict] = None,
        detail: str = "You do not have access to this chat resource",
    ) -> None:
        AuditService.log_event(
            self.db,
            actor_role=self.current_user.role,
            actor_id=self.current_user.user_id,
            action=action,
            entity_type=entity_type.value,
            entity_id=entity_id,
            metadata=metadata,
        )
        self.db.commit()
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)

    def _require_admin_conversation_access(self, conversation_id: UUID) -> ChatConversation:
        row = self.repo.get_conversation_by_id(conversation_id)
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
        return row

    def _require_technician_conversation_access(self, conversation_id: UUID) -> ChatConversation:
        row = self.repo.get_conversation_by_id(conversation_id)
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
        member_ids = {member.technician_id for member in self._conversation_members(row)}
        if self.current_user.user_id not in member_ids:
            self._record_access_denied(
                action="chat.access.denied",
                entity_type=AuditEntityType.CHAT_CONVERSATION,
                entity_id=row.id,
                metadata={"conversation_id": str(row.id), "reason": "technician_not_participant"},
                detail="Conversation does not belong to current technician",
            )
        if row.conversation_type == "job":
            job = self._require_job(row.job_id)
            if job.assigned_tech_id != self.current_user.user_id and self.current_user.user_id not in member_ids:
                self._record_access_denied(
                    action="chat.access.denied",
                    entity_type=AuditEntityType.CHAT_CONVERSATION,
                    entity_id=row.id,
                    metadata={
                        "conversation_id": str(row.id),
                        "job_id": str(job.id),
                        "reason": "job_not_assigned_to_current_technician",
                    },
                    detail="Job chat is not assigned to current technician",
                )
        return row

    def _require_conversation_access(self, conversation_id: UUID) -> ChatConversation:
        if self.current_user.role == UserRole.ADMIN:
            return self._require_admin_conversation_access(conversation_id)
        return self._require_technician_conversation_access(conversation_id)

    def _require_job_access_for_technician(self, job_id: UUID):
        job = self._require_job(job_id)
        if job.assigned_tech_id != self.current_user.user_id:
            self._record_access_denied(
                action="chat.access.denied",
                entity_type=AuditEntityType.JOB,
                entity_id=job.id,
                metadata={"job_id": str(job.id), "reason": "job_not_assigned_to_current_technician"},
                detail="Job is not assigned to current technician",
            )
        return job

    def _filter_rows_by_search(
        self,
        rows: List[ChatConversationMessage],
        search: Optional[str],
    ) -> List[ChatConversationMessage]:
        query = (search or "").strip().lower()
        if not query:
            return rows
        results: List[ChatConversationMessage] = []
        for row in rows:
            text = (row.body or "").lower()
            attachment_names = [attachment.original_name.lower() for attachment in row.attachments]
            if query in text or any(query in name for name in attachment_names):
                results.append(row)
        return results

    def _resolve_message_type(self, *, text: Optional[str], attachments: List[ChatAttachment]) -> str:
        if attachments and text:
            return "mixed"
        if attachments:
            if all(attachment.attachment_type == "voice" for attachment in attachments):
                return "voice"
            return "attachment"
        return "text"

    def _store_attachments(
        self,
        *,
        conversation: ChatConversation,
        message: ChatConversationMessage,
        payload: ChatMessageCreateRequest,
    ) -> List[ChatAttachment]:
        stored_items: List[ChatAttachment] = []
        for item in payload.attachments:
            stored = ChatStorageService.parse_and_store(
                tenant_id=self.current_user.tenant_id,
                conversation_id=conversation.id,
                message_id=message.id,
                original_name=item.name,
                claimed_mime_type=item.mime_type,
                size_bytes=item.size_bytes,
                data_url=item.data_url,
                duration_seconds=item.duration_seconds,
            )
            row = self.repo.add_attachment(
                attachment_id=stored.attachment_id,
                conversation_id=conversation.id,
                message_id=message.id,
                original_name=stored.original_name,
                mime_type=stored.mime_type,
                size_bytes=stored.size_bytes,
                attachment_type=stored.attachment_type,
                storage_path=stored.storage_path,
                sha256_hash=stored.sha256_hash,
                duration_seconds=stored.duration_seconds,
                metadata_json={"source": "chat_upload"},
            )
            stored_items.append(row)
        return stored_items

    def _log_message_events(self, *, conversation: ChatConversation, message: ChatConversationMessage) -> None:
        AuditService.log_event(
            self.db,
            actor_role=self.current_user.role,
            actor_id=self.current_user.user_id,
            action="chat.message.sent",
            entity_type=AuditEntityType.CHAT_MESSAGE.value,
            entity_id=message.id,
            metadata={
                "conversation_id": str(conversation.id),
                "conversation_type": conversation.conversation_type,
                "technician_id": str(conversation.technician_id),
                "job_id": str(conversation.job_id) if conversation.job_id else None,
                "message_type": message.message_type,
            },
        )
        for attachment in message.attachments:
            AuditService.log_event(
                self.db,
                actor_role=self.current_user.role,
                actor_id=self.current_user.user_id,
                action="chat.voice_uploaded" if attachment.attachment_type == "voice" else "chat.attachment.uploaded",
                entity_type=AuditEntityType.CHAT_ATTACHMENT.value,
                entity_id=attachment.id,
                metadata={
                    "conversation_id": str(conversation.id),
                    "message_id": str(message.id),
                    "attachment_type": attachment.attachment_type,
                    "mime_type": attachment.mime_type,
                    "size_bytes": attachment.size_bytes,
                    "duration_seconds": attachment.duration_seconds,
                },
            )

    def list_admin_conversations(self, search: Optional[str] = None) -> List[AdminChatConversationSummaryResponse]:
        for technician in self.repo.list_technicians():
            self._get_or_create_direct_conversation(technician.id)
        rows = self.repo.list_admin_conversations(search=search)
        self.db.flush()
        return [
            AdminChatConversationSummaryResponse(**self._conversation_summary(
                row,
                unread_count=self.repo.count_unread_messages(
                    conversation_id=row.id,
                    recipient_role="admin",
                    recipient_user_id=self.current_user.user_id,
                ),
            ).model_dump())
            for row in rows
        ]

    def list_technician_conversations(self, search: Optional[str] = None) -> List[TechnicianChatConversationSummaryResponse]:
        technician_id = self.current_user.user_id
        self._get_or_create_direct_conversation(technician_id)
        rows = self.repo.list_technician_conversations(technician_id=technician_id, search=search)
        self.db.flush()
        return [
            TechnicianChatConversationSummaryResponse(**self._conversation_summary(
                row,
                unread_count=self.repo.count_unread_messages(
                    conversation_id=row.id,
                    recipient_role="technician",
                    recipient_user_id=technician_id,
                ),
            ).model_dump())
            for row in rows
        ]

    def list_conversation_messages(self, conversation_id: UUID, search: Optional[str] = None) -> List[ChatMessageResponse]:
        conversation = self._require_conversation_access(conversation_id)
        now = datetime.now(timezone.utc)
        self.repo.mark_delivered(
            conversation_id=conversation.id,
            recipient_role=self.current_user.role.value,
            recipient_user_id=self.current_user.user_id,
            now=now,
        )
        rows = self._filter_rows_by_search(self.repo.list_messages(conversation.id), search)
        self.db.commit()
        return [self._message_response(conversation, row) for row in rows]

    def send_conversation_message(self, conversation_id: UUID, payload: ChatMessageCreateRequest) -> ChatMessageResponse:
        conversation = self._require_conversation_access(conversation_id)
        message = self.repo.create_message(
            conversation_id=conversation.id,
            technician_id=conversation.technician_id,
            sender_role=self.current_user.role.value,
            sender_id=self.current_user.user_id,
            body=payload.text,
            message_type="text",
            metadata_json={"conversation_type": conversation.conversation_type},
        )
        stored_attachments = self._store_attachments(conversation=conversation, message=message, payload=payload)
        message.attachments = stored_attachments
        message.message_type = self._resolve_message_type(text=payload.text, attachments=stored_attachments)
        self.db.flush()
        self._log_message_events(conversation=conversation, message=message)
        self.db.commit()
        conversation = self.repo.get_conversation_by_id(conversation.id) or conversation
        message = self.repo.get_message_by_id(message.id) or message
        return self._message_response(conversation, message)

    def mark_conversation_read(self, conversation_id: UUID) -> AdminChatUnreadCountResponse:
        conversation = self._require_conversation_access(conversation_id)
        now = datetime.now(timezone.utc)
        changed = self.repo.mark_read(
            conversation_id=conversation.id,
            recipient_role=self.current_user.role.value,
            recipient_user_id=self.current_user.user_id,
            now=now,
        )
        if changed > 0:
            AuditService.log_event(
                self.db,
                actor_role=self.current_user.role,
                actor_id=self.current_user.user_id,
                action="chat.message.read",
                entity_type=AuditEntityType.CHAT_CONVERSATION.value,
                entity_id=conversation.id,
                metadata={"conversation_id": str(conversation.id), "count": changed},
            )
        self.db.commit()
        if self.current_user.role == UserRole.ADMIN:
            return self.get_admin_unread_count()
        unread = self.repo.count_total_unread_messages(
            conversation_ids=[item.id for item in self.repo.list_technician_conversations(technician_id=self.current_user.user_id)],
            recipient_role="technician",
            recipient_user_id=self.current_user.user_id,
        )
        return AdminChatUnreadCountResponse(unread_count=unread)

    def get_admin_unread_count(self) -> AdminChatUnreadCountResponse:
        rows = self.repo.list_admin_conversations()
        unread_count = self.repo.count_total_unread_messages(
            conversation_ids=[row.id for row in rows],
            recipient_role="admin",
            recipient_user_id=self.current_user.user_id,
        )
        return AdminChatUnreadCountResponse(unread_count=unread_count)

    def resolve_admin_job_conversation(self, job_id: UUID) -> ChatConversationResolveResponse:
        conversation = self._get_or_create_job_conversation(job_id)
        summary = self._conversation_summary(
            self.repo.get_conversation_by_id(conversation.id) or conversation,
            unread_count=self.repo.count_unread_messages(
                conversation_id=conversation.id,
                recipient_role="admin",
                recipient_user_id=self.current_user.user_id,
            ),
        )
        self.db.commit()
        return ChatConversationResolveResponse(conversation=summary)

    def resolve_technician_job_conversation(self, job_id: UUID) -> ChatConversationResolveResponse:
        self._require_job_access_for_technician(job_id)
        conversation = self._get_or_create_job_conversation(job_id)
        summary = self._conversation_summary(
            self.repo.get_conversation_by_id(conversation.id) or conversation,
            unread_count=self.repo.count_unread_messages(
                conversation_id=conversation.id,
                recipient_role="technician",
                recipient_user_id=self.current_user.user_id,
            ),
        )
        self.db.commit()
        return ChatConversationResolveResponse(conversation=summary)

    def pin_admin_message(self, message_id: UUID) -> ChatMessageResponse:
        row = self.repo.get_message_by_id(message_id)
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
        conversation = self._require_admin_conversation_access(row.conversation_id)
        now = datetime.now(timezone.utc)
        row = self.repo.pin_message(
            message_id=message_id,
            pinned_by_role="admin",
            pinned_by_id=self.current_user.user_id,
            now=now,
        )
        AuditService.log_event(
            self.db,
            actor_role=UserRole.ADMIN,
            actor_id=self.current_user.user_id,
            action="chat.message.pinned",
            entity_type=AuditEntityType.CHAT_MESSAGE.value,
            entity_id=row.id,
            metadata={"conversation_id": str(conversation.id), "message_id": str(row.id)},
        )
        self.db.commit()
        return self._message_response(conversation, self.repo.get_message_by_id(message_id) or row)

    def unpin_admin_message(self, message_id: UUID) -> ChatMessageResponse:
        row = self.repo.get_message_by_id(message_id)
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
        conversation = self._require_admin_conversation_access(row.conversation_id)
        row = self.repo.unpin_message(message_id)
        AuditService.log_event(
            self.db,
            actor_role=UserRole.ADMIN,
            actor_id=self.current_user.user_id,
            action="chat.message.unpinned",
            entity_type=AuditEntityType.CHAT_MESSAGE.value,
            entity_id=row.id,
            metadata={"conversation_id": str(conversation.id), "message_id": str(row.id)},
        )
        self.db.commit()
        return self._message_response(conversation, self.repo.get_message_by_id(message_id) or row)

    def list_pinned_messages(self, conversation_id: UUID) -> ChatPinnedMessagesResponse:
        conversation = self._require_conversation_access(conversation_id)
        rows = self.repo.list_pinned_messages(conversation.id)
        return ChatPinnedMessagesResponse(items=[self._message_response(conversation, row) for row in rows])

    def list_admin_conversation_audit_logs(self, conversation_id: UUID) -> List[ChatAuditLogResponse]:
        self._require_admin_conversation_access(conversation_id)
        rows = self.repo.list_conversation_admin_audit_logs(conversation_id)
        return [
            ChatAuditLogResponse(
                id=row.id,
                actor_role=row.actor_role,
                actor_id=row.actor_id,
                action=row.action,
                entity_type=row.entity_type,
                entity_id=row.entity_id,
                created_at=row.created_at,
                metadata=row.metadata_json if isinstance(row.metadata_json, dict) else None,
            )
            for row in rows
        ]

    def get_attachment_for_current_user(self, attachment_id: UUID) -> ChatAttachment:
        attachment = self.repo.get_attachment_by_id(attachment_id)
        if attachment is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found")
        self._require_conversation_access(attachment.conversation_id)
        return attachment

    def record_attachment_download(self, attachment: ChatAttachment) -> None:
        AuditService.log_event(
            self.db,
            actor_role=self.current_user.role,
            actor_id=self.current_user.user_id,
            action="chat.attachment.downloaded",
            entity_type=AuditEntityType.CHAT_ATTACHMENT.value,
            entity_id=attachment.id,
            metadata={
                "conversation_id": str(attachment.conversation_id),
                "message_id": str(attachment.message_id),
                "mime_type": attachment.mime_type,
            },
        )
        self.db.commit()

    # Backward-compatible direct-conversation methods
    def list_admin_messages(self, technician_id: UUID) -> List[ChatMessageResponse]:
        conversation = self._get_or_create_direct_conversation(technician_id)
        return self.list_conversation_messages(conversation.id)

    def send_admin_message(self, technician_id: UUID, payload: ChatMessageCreateRequest) -> ChatMessageResponse:
        conversation = self._get_or_create_direct_conversation(technician_id)
        return self.send_conversation_message(conversation.id, payload)

    def mark_admin_conversation_read(self, technician_id: UUID) -> AdminChatUnreadCountResponse:
        conversation = self._get_or_create_direct_conversation(technician_id)
        return self.mark_conversation_read(conversation.id)

    def list_technician_messages(self) -> List[ChatMessageResponse]:
        conversation = self._get_or_create_direct_conversation(self.current_user.user_id)
        return self.list_conversation_messages(conversation.id)

    def send_technician_message(self, payload: ChatMessageCreateRequest) -> ChatMessageResponse:
        conversation = self._get_or_create_direct_conversation(self.current_user.user_id)
        return self.send_conversation_message(conversation.id, payload)

    def mark_technician_conversation_read(self) -> dict:
        conversation = self._get_or_create_direct_conversation(self.current_user.user_id)
        self.mark_conversation_read(conversation.id)
        return {"status": "ok"}

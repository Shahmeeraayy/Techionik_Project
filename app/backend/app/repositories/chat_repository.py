import json
from datetime import datetime
from typing import Iterable, List, Optional
from uuid import UUID

from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from ..models.audit_log import AuditLog
from ..models.chat_attachment import ChatAttachment
from ..models.chat_conversation import ChatConversation
from ..models.chat_conversation_member import ChatConversationMember
from ..models.chat_conversation_message import ChatConversationMessage
from ..models.chat_message_receipt import ChatMessageReceipt
from ..models.job import Job
from ..models.technician import Technician


class ChatRepository:
    def __init__(self, db: Session):
        self.db = db

    @property
    def tenant_id(self):
        return self.db.info.get("tenant_id")

    def get_technician_by_id(self, technician_id: UUID) -> Optional[Technician]:
        return self.db.query(Technician).filter(Technician.id == technician_id).first()

    def get_job_by_id(self, job_id: UUID) -> Optional[Job]:
        return self.db.query(Job).filter(Job.id == job_id).first()

    def list_technicians(self) -> List[Technician]:
        return self.db.query(Technician).order_by(Technician.name.asc()).all()

    def get_conversation_by_id(self, conversation_id: UUID) -> Optional[ChatConversation]:
        return (
            self.db.query(ChatConversation)
            .options(
                joinedload(ChatConversation.technician),
                joinedload(ChatConversation.job),
                joinedload(ChatConversation.members).joinedload(ChatConversationMember.technician),
            )
            .filter(ChatConversation.id == conversation_id)
            .first()
        )

    def get_direct_conversation_for_technician(self, technician_id: UUID) -> Optional[ChatConversation]:
        return (
            self.db.query(ChatConversation)
            .join(ChatConversationMember, ChatConversationMember.conversation_id == ChatConversation.id)
            .filter(
                ChatConversationMember.technician_id == technician_id,
                ChatConversation.conversation_type == "direct",
            )
            .first()
        )

    def get_conversation_by_key(self, conversation_key: str) -> Optional[ChatConversation]:
        return (
            self.db.query(ChatConversation)
            .options(
                joinedload(ChatConversation.technician),
                joinedload(ChatConversation.job),
                joinedload(ChatConversation.members).joinedload(ChatConversationMember.technician),
            )
            .filter(ChatConversation.conversation_key == conversation_key)
            .first()
        )

    def create_conversation(
        self,
        *,
        conversation_key: str,
        conversation_type: str,
        technician_id: UUID,
        job_id: UUID | None,
        title: str | None,
        created_by_role: str,
        created_by_id: UUID,
    ) -> ChatConversation:
        row = ChatConversation(
            conversation_key=conversation_key,
            conversation_type=conversation_type,
            technician_id=technician_id,
            job_id=job_id,
            title=title,
            created_by_role=created_by_role,
            created_by_id=created_by_id,
        )
        self.db.add(row)
        self.db.flush()
        self.db.refresh(row)
        return row

    def list_admin_conversations(self, *, search: str | None = None) -> List[ChatConversation]:
        query = (
            self.db.query(ChatConversation)
            .options(
                joinedload(ChatConversation.technician),
                joinedload(ChatConversation.job),
                joinedload(ChatConversation.members).joinedload(ChatConversationMember.technician),
            )
        )
        if search:
            pattern = f"%{search.strip().lower()}%"
            query = query.outerjoin(ChatConversationMember, ChatConversationMember.conversation_id == ChatConversation.id).outerjoin(
                Technician,
                Technician.id == ChatConversationMember.technician_id,
            ).outerjoin(
                Job,
                Job.id == ChatConversation.job_id,
            ).filter(
                or_(
                    func.lower(Technician.name).like(pattern),
                    func.lower(func.coalesce(Technician.full_name, Technician.name)).like(pattern),
                    func.lower(Technician.email).like(pattern),
                    func.lower(func.coalesce(Job.job_code, "")).like(pattern),
                    func.lower(func.coalesce(ChatConversation.title, "")).like(pattern),
                )
            ).distinct()
        return query.order_by(
            ChatConversation.last_message_at.desc(),
            ChatConversation.created_at.desc(),
        ).all()

    def list_technician_conversations(self, *, technician_id: UUID, search: str | None = None) -> List[ChatConversation]:
        query = (
            self.db.query(ChatConversation)
            .options(
                joinedload(ChatConversation.technician),
                joinedload(ChatConversation.job),
                joinedload(ChatConversation.members).joinedload(ChatConversationMember.technician),
            )
            .join(ChatConversationMember, ChatConversationMember.conversation_id == ChatConversation.id)
            .filter(ChatConversationMember.technician_id == technician_id)
        )
        if search:
            pattern = f"%{search.strip().lower()}%"
            query = query.outerjoin(Job, Job.id == ChatConversation.job_id).outerjoin(
                Technician,
                Technician.id == ChatConversationMember.technician_id,
            ).filter(
                or_(
                    func.lower(func.coalesce(Job.job_code, "")).like(pattern),
                    func.lower(func.coalesce(ChatConversation.title, "")).like(pattern),
                    func.lower(func.coalesce(Technician.name, "")).like(pattern),
                    func.lower(func.coalesce(Technician.full_name, Technician.name, "")).like(pattern),
                )
            ).distinct()
        return query.order_by(
            ChatConversation.last_message_at.desc(),
            ChatConversation.created_at.desc(),
        ).all()

    def list_conversation_members(self, conversation_id: UUID) -> List[ChatConversationMember]:
        return (
            self.db.query(ChatConversationMember)
            .options(joinedload(ChatConversationMember.technician))
            .filter(ChatConversationMember.conversation_id == conversation_id)
            .order_by(ChatConversationMember.created_at.asc(), ChatConversationMember.id.asc())
            .all()
        )

    def get_conversation_member(self, *, conversation_id: UUID, technician_id: UUID) -> Optional[ChatConversationMember]:
        return (
            self.db.query(ChatConversationMember)
            .filter(
                ChatConversationMember.conversation_id == conversation_id,
                ChatConversationMember.technician_id == technician_id,
            )
            .first()
        )

    def add_conversation_member(
        self,
        *,
        conversation_id: UUID,
        technician_id: UUID,
        added_by_id: UUID | None,
    ) -> ChatConversationMember:
        existing = self.get_conversation_member(conversation_id=conversation_id, technician_id=technician_id)
        if existing is not None:
            return existing
        row = ChatConversationMember(
            conversation_id=conversation_id,
            technician_id=technician_id,
            added_by_id=added_by_id,
        )
        self.db.add(row)
        self.db.flush()
        self.db.refresh(row)
        return row

    def replace_conversation_members(
        self,
        *,
        conversation_id: UUID,
        technician_ids: list[UUID],
        added_by_id: UUID | None,
    ) -> List[ChatConversationMember]:
        normalized_ids = list(dict.fromkeys(technician_ids))
        existing = self.list_conversation_members(conversation_id)
        existing_ids = {row.technician_id for row in existing}

        for row in existing:
            if row.technician_id not in normalized_ids:
                self.db.delete(row)

        for technician_id in normalized_ids:
            if technician_id not in existing_ids:
                self.add_conversation_member(
                    conversation_id=conversation_id,
                    technician_id=technician_id,
                    added_by_id=added_by_id,
                )

        self.db.flush()
        return self.list_conversation_members(conversation_id)

    def list_messages(self, conversation_id: UUID, *, search: str | None = None) -> List[ChatConversationMessage]:
        query = (
            self.db.query(ChatConversationMessage)
            .options(joinedload(ChatConversationMessage.attachments), joinedload(ChatConversationMessage.receipts))
            .filter(
                ChatConversationMessage.conversation_id == conversation_id,
                ChatConversationMessage.deleted_at.is_(None),
            )
        )
        rows = query.order_by(ChatConversationMessage.created_at.asc(), ChatConversationMessage.id.asc()).all()
        if not search:
            return rows

        query_text = search.strip().lower()
        filtered_rows: List[ChatConversationMessage] = []
        for row in rows:
            attachment_names = [attachment.original_name.lower() for attachment in row.attachments]
            metadata_text = json.dumps(row.metadata_json, sort_keys=True, default=str).lower() if isinstance(row.metadata_json, dict) else ""
            body = (row.body or "").lower()
            if query_text in body or any(query_text in name for name in attachment_names) or query_text in metadata_text:
                filtered_rows.append(row)
        return filtered_rows

    def create_message(
        self,
        *,
        conversation_id: UUID,
        technician_id: UUID,
        sender_role: str,
        sender_id: UUID,
        body: str | None,
        message_type: str,
        metadata_json: dict | None = None,
        is_broadcast: bool = False,
    ) -> ChatConversationMessage:
        row = ChatConversationMessage(
            conversation_id=conversation_id,
            technician_id=technician_id,
            sender_role=sender_role,
            sender_id=sender_id,
            body=body,
            message_type=message_type,
            metadata_json=metadata_json,
            is_broadcast=is_broadcast,
        )
        self.db.add(row)
        self.db.flush()
        self.db.refresh(row)
        self.touch_conversation(conversation_id, row.created_at)
        return row

    def add_attachment(
        self,
        *,
        attachment_id: UUID,
        conversation_id: UUID,
        message_id: UUID,
        original_name: str,
        mime_type: str,
        size_bytes: int,
        attachment_type: str,
        storage_path: str,
        sha256_hash: str,
        duration_seconds: int | None,
        metadata_json: dict | None = None,
    ) -> ChatAttachment:
        row = ChatAttachment(
            id=attachment_id,
            conversation_id=conversation_id,
            message_id=message_id,
            original_name=original_name,
            mime_type=mime_type,
            size_bytes=size_bytes,
            attachment_type=attachment_type,
            storage_path=storage_path,
            sha256_hash=sha256_hash,
            duration_seconds=duration_seconds,
            metadata_json=metadata_json,
        )
        self.db.add(row)
        self.db.flush()
        self.db.refresh(row)
        return row

    def get_attachment_by_id(self, attachment_id: UUID) -> Optional[ChatAttachment]:
        return (
            self.db.query(ChatAttachment)
            .options(joinedload(ChatAttachment.message), joinedload(ChatAttachment.conversation))
            .filter(ChatAttachment.id == attachment_id)
            .first()
        )

    def get_message_by_id(self, message_id: UUID) -> Optional[ChatConversationMessage]:
        return (
            self.db.query(ChatConversationMessage)
            .options(joinedload(ChatConversationMessage.attachments), joinedload(ChatConversationMessage.receipts))
            .filter(ChatConversationMessage.id == message_id)
            .first()
        )

    def touch_conversation(self, conversation_id: UUID, timestamp: datetime) -> None:
        conversation = self.get_conversation_by_id(conversation_id)
        if conversation is None:
            return
        conversation.last_message_at = timestamp
        self.db.flush()

    def get_receipt(
        self,
        *,
        message_id: UUID,
        recipient_role: str,
        recipient_user_id: UUID,
    ) -> Optional[ChatMessageReceipt]:
        return (
            self.db.query(ChatMessageReceipt)
            .filter(
                ChatMessageReceipt.message_id == message_id,
                ChatMessageReceipt.recipient_role == recipient_role,
                ChatMessageReceipt.recipient_user_id == recipient_user_id,
            )
            .first()
        )

    def upsert_receipt(
        self,
        *,
        conversation_id: UUID,
        message_id: UUID,
        recipient_role: str,
        recipient_user_id: UUID,
        delivered_at: datetime | None = None,
        read_at: datetime | None = None,
    ) -> ChatMessageReceipt:
        row = self.get_receipt(
            message_id=message_id,
            recipient_role=recipient_role,
            recipient_user_id=recipient_user_id,
        )
        if row is None:
            row = ChatMessageReceipt(
                conversation_id=conversation_id,
                message_id=message_id,
                recipient_role=recipient_role,
                recipient_user_id=recipient_user_id,
                delivered_at=delivered_at,
                read_at=read_at,
            )
            self.db.add(row)
        else:
            if delivered_at and row.delivered_at is None:
                row.delivered_at = delivered_at
            if read_at and row.read_at is None:
                row.read_at = read_at
            if row.read_at and row.delivered_at is None:
                row.delivered_at = row.read_at
        self.db.flush()
        self._refresh_message_status_cache(message_id)
        return row

    def mark_delivered(
        self,
        *,
        conversation_id: UUID,
        recipient_role: str,
        recipient_user_id: UUID,
        now: datetime,
    ) -> int:
        sender_role = "technician" if recipient_role == "admin" else "admin"
        rows = (
            self.db.query(ChatConversationMessage)
            .filter(
                ChatConversationMessage.conversation_id == conversation_id,
                ChatConversationMessage.sender_role == sender_role,
                ChatConversationMessage.deleted_at.is_(None),
            )
            .all()
        )
        changed = 0
        for row in rows:
            receipt = self.get_receipt(
                message_id=row.id,
                recipient_role=recipient_role,
                recipient_user_id=recipient_user_id,
            )
            if receipt is None or receipt.delivered_at is None:
                self.upsert_receipt(
                    conversation_id=conversation_id,
                    message_id=row.id,
                    recipient_role=recipient_role,
                    recipient_user_id=recipient_user_id,
                    delivered_at=now,
                )
                changed += 1
        self.db.flush()
        return changed

    def mark_read(
        self,
        *,
        conversation_id: UUID,
        recipient_role: str,
        recipient_user_id: UUID,
        now: datetime,
    ) -> int:
        sender_role = "technician" if recipient_role == "admin" else "admin"
        rows = (
            self.db.query(ChatConversationMessage)
            .filter(
                ChatConversationMessage.conversation_id == conversation_id,
                ChatConversationMessage.sender_role == sender_role,
                ChatConversationMessage.deleted_at.is_(None),
            )
            .all()
        )
        changed = 0
        for row in rows:
            receipt = self.get_receipt(
                message_id=row.id,
                recipient_role=recipient_role,
                recipient_user_id=recipient_user_id,
            )
            if receipt is None or receipt.read_at is None:
                self.upsert_receipt(
                    conversation_id=conversation_id,
                    message_id=row.id,
                    recipient_role=recipient_role,
                    recipient_user_id=recipient_user_id,
                    delivered_at=now,
                    read_at=now,
                )
                changed += 1
        self.db.flush()
        return changed

    def count_unread_messages(
        self,
        *,
        conversation_id: UUID,
        recipient_role: str,
        recipient_user_id: UUID,
    ) -> int:
        sender_role = "technician" if recipient_role == "admin" else "admin"
        rows = (
            self.db.query(ChatConversationMessage)
            .filter(
                ChatConversationMessage.conversation_id == conversation_id,
                ChatConversationMessage.sender_role == sender_role,
                ChatConversationMessage.deleted_at.is_(None),
            )
            .all()
        )
        unread_count = 0
        for row in rows:
            receipt = self.get_receipt(
                message_id=row.id,
                recipient_role=recipient_role,
                recipient_user_id=recipient_user_id,
            )
            if receipt is None or receipt.read_at is None:
                unread_count += 1
        return unread_count

    def count_total_unread_messages(
        self,
        *,
        conversation_ids: Iterable[UUID],
        recipient_role: str,
        recipient_user_id: UUID,
    ) -> int:
        return sum(
            self.count_unread_messages(
                conversation_id=conversation_id,
                recipient_role=recipient_role,
                recipient_user_id=recipient_user_id,
            )
            for conversation_id in conversation_ids
        )

    def pin_message(self, message_id: UUID, *, pinned_by_role: str, pinned_by_id: UUID, now: datetime) -> ChatConversationMessage:
        row = self.get_message_by_id(message_id)
        if row is None:
            raise ValueError("Message not found")
        row.pinned_at = now
        row.pinned_by_role = pinned_by_role
        row.pinned_by_id = pinned_by_id
        self.db.flush()
        self.db.refresh(row)
        return row

    def unpin_message(self, message_id: UUID) -> ChatConversationMessage:
        row = self.get_message_by_id(message_id)
        if row is None:
            raise ValueError("Message not found")
        row.pinned_at = None
        row.pinned_by_role = None
        row.pinned_by_id = None
        self.db.flush()
        self.db.refresh(row)
        return row

    def list_pinned_messages(self, conversation_id: UUID) -> List[ChatConversationMessage]:
        return (
            self.db.query(ChatConversationMessage)
            .options(joinedload(ChatConversationMessage.attachments), joinedload(ChatConversationMessage.receipts))
            .filter(
                ChatConversationMessage.conversation_id == conversation_id,
                ChatConversationMessage.deleted_at.is_(None),
                ChatConversationMessage.pinned_at.is_not(None),
            )
            .order_by(ChatConversationMessage.pinned_at.desc(), ChatConversationMessage.created_at.desc())
            .all()
        )

    def list_conversation_admin_audit_logs(self, conversation_id: UUID, *, limit: int = 100) -> List[AuditLog]:
        rows = (
            self.db.query(AuditLog)
            .order_by(AuditLog.created_at.desc())
            .limit(max(limit * 3, limit))
            .all()
        )
        result: List[AuditLog] = []
        target = str(conversation_id)
        for row in rows:
            payload = row.metadata_json if isinstance(row.metadata_json, dict) else {}
            if payload.get("conversation_id") == target:
                result.append(row)
            if len(result) >= limit:
                break
        return result

    def _refresh_message_status_cache(self, message_id: UUID) -> None:
        row = self.get_message_by_id(message_id)
        if row is None:
            return

        delivered_at_values = [receipt.delivered_at for receipt in row.receipts if receipt.delivered_at is not None]
        read_at_values = [receipt.read_at for receipt in row.receipts if receipt.read_at is not None]
        row.delivered_at = min(delivered_at_values) if delivered_at_values else None
        row.read_at = min(read_at_values) if read_at_values else None
        self.db.flush()

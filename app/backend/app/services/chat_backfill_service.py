from sqlalchemy.orm import Session

from ..models.chat_attachment import ChatAttachment
from ..models.chat_conversation import ChatConversation
from ..models.chat_conversation_member import ChatConversationMember
from ..models.chat_conversation_message import ChatConversationMessage
from ..models.chat_message import ChatMessage
from ..services.chat_storage_service import ChatStorageService


class ChatBackfillService:
    def __init__(self, db: Session):
        self.db = db

    def ensure_conversation_members(self) -> bool:
        changed = False
        rows = self.db.query(ChatConversation).all()
        for conversation in rows:
            existing = (
                self.db.query(ChatConversationMember.id)
                .filter(
                    ChatConversationMember.conversation_id == conversation.id,
                    ChatConversationMember.technician_id == conversation.technician_id,
                )
                .first()
            )
            if existing is not None:
                continue
            self.db.add(
                ChatConversationMember(
                    conversation_id=conversation.id,
                    technician_id=conversation.technician_id,
                    added_by_id=conversation.created_by_id,
                    tenant_id=conversation.tenant_id,
                )
            )
            changed = True

        if changed:
            self.db.commit()
        return changed

    def migrate_legacy_messages(self) -> bool:
        changed = False
        legacy_rows = self.db.query(ChatMessage).order_by(ChatMessage.created_at.asc(), ChatMessage.id.asc()).all()

        for legacy in legacy_rows:
            existing = self.db.query(ChatConversationMessage.id).filter(ChatConversationMessage.id == legacy.id).first()
            if existing is not None:
                continue

            conversation_key = f"direct:{legacy.technician_id}"
            conversation = (
                self.db.query(ChatConversation)
                .filter(ChatConversation.conversation_key == conversation_key)
                .first()
            )
            if conversation is None:
                conversation = ChatConversation(
                    conversation_key=conversation_key,
                    conversation_type="direct",
                    technician_id=legacy.technician_id,
                    job_id=None,
                    title="Legacy dispatch chat",
                    created_by_role=legacy.sender_role,
                    created_by_id=legacy.sender_id,
                    created_at=legacy.created_at,
                    updated_at=legacy.created_at,
                    last_message_at=legacy.created_at,
                    tenant_id=legacy.tenant_id,
                )
                self.db.add(conversation)
                self.db.flush()
                self.db.add(
                    ChatConversationMember(
                        conversation_id=conversation.id,
                        technician_id=legacy.technician_id,
                        added_by_id=legacy.sender_id,
                        tenant_id=legacy.tenant_id,
                    )
                )

            message = ChatConversationMessage(
                id=legacy.id,
                conversation_id=conversation.id,
                technician_id=legacy.technician_id,
                sender_role=legacy.sender_role,
                sender_id=legacy.sender_id,
                body=legacy.body,
                message_type="text",
                delivered_at=legacy.delivered_at,
                read_at=legacy.read_at,
                created_at=legacy.created_at,
                updated_at=legacy.created_at,
                metadata_json={"legacy_import": True},
                tenant_id=legacy.tenant_id,
            )
            self.db.add(message)
            self.db.flush()

            attachment_type = "text"
            for raw_attachment in legacy.attachments or []:
                data_url = str(raw_attachment.get("data_url") or "").strip()
                if not data_url:
                    continue
                try:
                    stored = ChatStorageService.parse_and_store(
                        tenant_id=legacy.tenant_id,
                        conversation_id=conversation.id,
                        message_id=message.id,
                        original_name=str(raw_attachment.get("name") or "attachment"),
                        claimed_mime_type=str(raw_attachment.get("mime_type") or "application/octet-stream"),
                        size_bytes=int(raw_attachment.get("size_bytes") or 0),
                        data_url=data_url,
                        duration_seconds=None,
                    )
                except Exception:
                    continue
                self.db.add(
                    ChatAttachment(
                        id=stored.attachment_id,
                        conversation_id=conversation.id,
                        message_id=message.id,
                        original_name=stored.original_name,
                        mime_type=stored.mime_type,
                        size_bytes=stored.size_bytes,
                        attachment_type=stored.attachment_type,
                        storage_path=stored.storage_path,
                        sha256_hash=stored.sha256_hash,
                        duration_seconds=stored.duration_seconds,
                        metadata_json={"legacy_import": True},
                        tenant_id=legacy.tenant_id,
                    )
                )
                attachment_type = stored.attachment_type

            if attachment_type == "voice" and legacy.body:
                message.message_type = "mixed"
            elif attachment_type == "voice":
                message.message_type = "voice"
            elif attachment_type != "text" and legacy.body:
                message.message_type = "mixed"
            elif attachment_type != "text":
                message.message_type = "attachment"

            conversation.last_message_at = legacy.created_at
            changed = True

        if changed:
            self.db.commit()
        return changed

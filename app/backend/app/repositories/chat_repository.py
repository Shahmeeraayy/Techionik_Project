from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from ..models.chat_message import ChatMessage
from ..models.technician import Technician


class ChatRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_technician_by_id(self, technician_id: UUID) -> Optional[Technician]:
        return self.db.query(Technician).filter(Technician.id == technician_id).first()

    def list_technicians(self) -> List[Technician]:
        return self.db.query(Technician).order_by(Technician.name.asc()).all()

    def list_messages(self, technician_id: UUID) -> List[ChatMessage]:
        return (
            self.db.query(ChatMessage)
            .filter(ChatMessage.technician_id == technician_id)
            .order_by(ChatMessage.created_at.asc(), ChatMessage.id.asc())
            .all()
        )

    def create_message(
        self,
        *,
        technician_id: UUID,
        sender_role: str,
        sender_id: UUID,
        body: Optional[str],
        attachments: List[Dict[str, Any]],
        is_broadcast: bool = False,
    ) -> ChatMessage:
        row = ChatMessage(
            technician_id=technician_id,
            sender_role=sender_role,
            sender_id=sender_id,
            body=body,
            attachments=attachments,
            is_broadcast=is_broadcast,
        )
        self.db.add(row)
        self.db.flush()
        self.db.refresh(row)
        return row

    def mark_delivered(
        self,
        *,
        technician_id: UUID,
        recipient_role: str,
        now: datetime,
    ) -> int:
        sender_role = "technician" if recipient_role == "admin" else "admin"
        rows = (
            self.db.query(ChatMessage)
            .filter(
                ChatMessage.technician_id == technician_id,
                ChatMessage.sender_role == sender_role,
                ChatMessage.delivered_at.is_(None),
            )
            .all()
        )
        for row in rows:
            row.delivered_at = now
        self.db.flush()
        return len(rows)

    def mark_read(
        self,
        *,
        technician_id: UUID,
        recipient_role: str,
        now: datetime,
    ) -> int:
        sender_role = "technician" if recipient_role == "admin" else "admin"
        rows = (
            self.db.query(ChatMessage)
            .filter(
                ChatMessage.technician_id == technician_id,
                ChatMessage.sender_role == sender_role,
                ChatMessage.read_at.is_(None),
            )
            .all()
        )
        for row in rows:
            if row.delivered_at is None:
                row.delivered_at = now
            row.read_at = now
        self.db.flush()
        return len(rows)

    def get_unread_count_for_admin(self, technician_id: UUID) -> int:
        row = (
            self.db.query(func.count(ChatMessage.id))
            .filter(
                ChatMessage.technician_id == technician_id,
                ChatMessage.sender_role == "technician",
                ChatMessage.read_at.is_(None),
            )
            .first()
        )
        return int(row[0] if row and row[0] is not None else 0)

    def get_total_unread_count_for_admin(self) -> int:
        row = (
            self.db.query(func.count(ChatMessage.id))
            .filter(
                ChatMessage.sender_role == "technician",
                ChatMessage.read_at.is_(None),
            )
            .first()
        )
        return int(row[0] if row and row[0] is not None else 0)

    def get_latest_message(self, technician_id: UUID) -> Optional[ChatMessage]:
        return (
            self.db.query(ChatMessage)
            .filter(ChatMessage.technician_id == technician_id)
            .order_by(ChatMessage.created_at.desc(), ChatMessage.id.desc())
            .first()
        )

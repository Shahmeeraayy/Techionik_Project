from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from ...api import deps
from ...core.enums import UserRole
from ...core.security import AuthenticatedUser
from ...schemas.chat import (
    AdminChatConversationSummaryResponse,
    AdminChatUnreadCountResponse,
    ChatMessageCreateRequest,
    ChatMessageResponse,
)
from ...services.chat_service import ChatService

router = APIRouter(prefix="/admin/chat", tags=["admin-chat"])


@router.get("/conversations", response_model=List[AdminChatConversationSummaryResponse])
def list_conversations(
    search: Optional[str] = Query(default=None),
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.ADMIN)),
):
    return ChatService(db, current_user).list_admin_conversations(search)


@router.get("/conversations/{technician_id}/messages", response_model=List[ChatMessageResponse])
def list_conversation_messages(
    technician_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.ADMIN)),
):
    return ChatService(db, current_user).list_admin_messages(technician_id)


@router.post(
    "/conversations/{technician_id}/messages",
    response_model=ChatMessageResponse,
    status_code=status.HTTP_201_CREATED,
)
def send_conversation_message(
    technician_id: UUID,
    payload: ChatMessageCreateRequest,
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.ADMIN)),
):
    return ChatService(db, current_user).send_admin_message(technician_id, payload)


@router.post("/broadcast", response_model=List[ChatMessageResponse], status_code=status.HTTP_201_CREATED)
def broadcast_message(
    payload: ChatMessageCreateRequest,
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.ADMIN)),
):
    return ChatService(db, current_user).broadcast_admin_message(payload)


@router.post("/conversations/{technician_id}/read", response_model=AdminChatUnreadCountResponse)
def mark_conversation_read(
    technician_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.ADMIN)),
):
    return ChatService(db, current_user).mark_admin_conversation_read(technician_id)


@router.get("/unread-count", response_model=AdminChatUnreadCountResponse)
def get_unread_count(
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.ADMIN)),
):
    return ChatService(db, current_user).get_admin_unread_count()

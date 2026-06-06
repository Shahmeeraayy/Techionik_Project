from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from ...api import deps
from ...core.enums import UserRole
from ...core.security import AuthenticatedUser
from ...schemas.chat import (
    AdminChatUnreadCountResponse,
    ChatConversationResolveResponse,
    ChatMessageCreateRequest,
    ChatMessageResponse,
    ChatPinnedMessagesResponse,
    TechnicianChatConversationSummaryResponse,
)
from ...services.chat_service import ChatService

router = APIRouter(
    prefix="/technicians/me/chat",
    tags=["technician-chat"],
    dependencies=[Depends(deps.require_tenant_feature("chatter"))],
)


@router.get("/conversations", response_model=List[TechnicianChatConversationSummaryResponse])
def list_my_conversations(
    search: Optional[str] = Query(default=None),
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.TECHNICIAN)),
):
    return ChatService(db, current_user).list_technician_conversations(search)


@router.get("/threads/{conversation_id}/messages", response_model=List[ChatMessageResponse])
def list_thread_messages(
    conversation_id: UUID,
    search: Optional[str] = Query(default=None),
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.TECHNICIAN)),
):
    return ChatService(db, current_user).list_conversation_messages(conversation_id, search)


@router.post("/threads/{conversation_id}/messages", response_model=ChatMessageResponse, status_code=status.HTTP_201_CREATED)
def send_thread_message(
    conversation_id: UUID,
    payload: ChatMessageCreateRequest,
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.TECHNICIAN)),
):
    return ChatService(db, current_user).send_conversation_message(conversation_id, payload)


@router.post("/threads/{conversation_id}/read", response_model=AdminChatUnreadCountResponse)
def mark_thread_read(
    conversation_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.TECHNICIAN)),
):
    return ChatService(db, current_user).mark_conversation_read(conversation_id)


@router.get("/jobs/{job_id}/conversation", response_model=ChatConversationResolveResponse)
def resolve_job_conversation(
    job_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.TECHNICIAN)),
):
    return ChatService(db, current_user).resolve_technician_job_conversation(job_id)


@router.get("/threads/{conversation_id}/pinned", response_model=ChatPinnedMessagesResponse)
def list_pinned_messages(
    conversation_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.TECHNICIAN)),
):
    return ChatService(db, current_user).list_pinned_messages(conversation_id)


# Backward-compatible direct chat routes
@router.get("/messages", response_model=List[ChatMessageResponse])
def list_my_chat_messages(
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.TECHNICIAN)),
):
    return ChatService(db, current_user).list_technician_messages()


@router.post("/messages", response_model=ChatMessageResponse, status_code=status.HTTP_201_CREATED)
def send_my_chat_message(
    payload: ChatMessageCreateRequest,
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.TECHNICIAN)),
):
    return ChatService(db, current_user).send_technician_message(payload)


@router.post("/read")
def mark_my_chat_read(
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.TECHNICIAN)),
):
    return ChatService(db, current_user).mark_technician_conversation_read()

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
    ChatAuditLogResponse,
    ChatBroadcastCreateRequest,
    ChatGroupUpsertRequest,
    ChatConversationResolveResponse,
    ChatMessageCreateRequest,
    ChatMessageResponse,
    ChatPinnedMessagesResponse,
    ChatTypingStatusRequest,
    ChatTypingStatusResponse,
)
from ...services.chat_service import ChatService

router = APIRouter(
    prefix="/admin/chat",
    tags=["admin-chat"],
    dependencies=[Depends(deps.require_tenant_feature("chatter"))],
)


@router.get("/conversations", response_model=List[AdminChatConversationSummaryResponse])
def list_conversations(
    search: Optional[str] = Query(default=None),
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.ADMIN)),
):
    return ChatService(db, current_user).list_admin_conversations(search)


@router.get("/threads/{conversation_id}/messages", response_model=List[ChatMessageResponse])
def list_thread_messages(
    conversation_id: UUID,
    search: Optional[str] = Query(default=None),
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.ADMIN)),
):
    return ChatService(db, current_user).list_conversation_messages(conversation_id, search)


@router.post(
    "/threads/{conversation_id}/messages",
    response_model=ChatMessageResponse,
    status_code=status.HTTP_201_CREATED,
)
def send_thread_message(
    conversation_id: UUID,
    payload: ChatMessageCreateRequest,
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.ADMIN)),
):
    return ChatService(db, current_user).send_conversation_message(conversation_id, payload)


@router.post("/threads/{conversation_id}/read", response_model=AdminChatUnreadCountResponse)
def mark_thread_read(
    conversation_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.ADMIN)),
):
    return ChatService(db, current_user).mark_conversation_read(conversation_id)


@router.get("/jobs/{job_id}/conversation", response_model=ChatConversationResolveResponse)
def resolve_job_conversation(
    job_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.ADMIN)),
):
    return ChatService(db, current_user).resolve_admin_job_conversation(job_id)


@router.post("/groups", response_model=ChatConversationResolveResponse, status_code=status.HTTP_201_CREATED)
def create_group_conversation(
    payload: ChatGroupUpsertRequest,
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.ADMIN)),
):
    return ChatService(db, current_user).create_group_conversation(payload)


@router.put("/groups/{conversation_id}", response_model=ChatConversationResolveResponse)
def update_group_conversation(
    conversation_id: UUID,
    payload: ChatGroupUpsertRequest,
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.ADMIN)),
):
    return ChatService(db, current_user).update_group_conversation(conversation_id, payload)


@router.post("/messages/{message_id}/pin", response_model=ChatMessageResponse)
def pin_message(
    message_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.ADMIN)),
):
    return ChatService(db, current_user).pin_admin_message(message_id)


@router.delete("/messages/{message_id}/pin", response_model=ChatMessageResponse)
def unpin_message(
    message_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.ADMIN)),
):
    return ChatService(db, current_user).unpin_admin_message(message_id)


@router.get("/threads/{conversation_id}/pinned", response_model=ChatPinnedMessagesResponse)
def list_pinned_messages(
    conversation_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.ADMIN)),
):
    return ChatService(db, current_user).list_pinned_messages(conversation_id)


@router.get("/threads/{conversation_id}/audit-logs", response_model=List[ChatAuditLogResponse])
def list_conversation_audit_logs(
    conversation_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.ADMIN)),
):
    return ChatService(db, current_user).list_admin_conversation_audit_logs(conversation_id)


# Backward-compatible direct chat routes
@router.get("/conversations/{technician_id}/messages", response_model=List[ChatMessageResponse])
def list_direct_conversation_messages(
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
def send_direct_conversation_message(
    technician_id: UUID,
    payload: ChatMessageCreateRequest,
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.ADMIN)),
):
    return ChatService(db, current_user).send_admin_message(technician_id, payload)


@router.post("/conversations/{technician_id}/read", response_model=AdminChatUnreadCountResponse)
def mark_direct_conversation_read(
    technician_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.ADMIN)),
):
    return ChatService(db, current_user).mark_admin_conversation_read(technician_id)


@router.post("/broadcast", response_model=List[ChatMessageResponse], status_code=status.HTTP_201_CREATED)
def broadcast_message(
    payload: ChatBroadcastCreateRequest,
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.ADMIN)),
):
    return ChatService(db, current_user).send_broadcast_message(payload)


@router.get("/threads/{conversation_id}/typing", response_model=ChatTypingStatusResponse)
def get_thread_typing_status(
    conversation_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.ADMIN)),
):
    return ChatService(db, current_user).get_typing_status(conversation_id)


@router.post("/threads/{conversation_id}/typing", response_model=ChatTypingStatusResponse)
def update_thread_typing_status(
    conversation_id: UUID,
    payload: ChatTypingStatusRequest,
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.ADMIN)),
):
    return ChatService(db, current_user).update_typing_status(conversation_id, payload.is_typing)


@router.get("/unread-count", response_model=AdminChatUnreadCountResponse)
def get_unread_count(
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.ADMIN)),
):
    return ChatService(db, current_user).get_admin_unread_count()

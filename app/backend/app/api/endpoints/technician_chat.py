from typing import List

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from ...api import deps
from ...core.enums import UserRole
from ...core.security import AuthenticatedUser
from ...schemas.chat import ChatMessageCreateRequest, ChatMessageResponse
from ...services.chat_service import ChatService

router = APIRouter(prefix="/technicians/me/chat", tags=["technician-chat"])


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

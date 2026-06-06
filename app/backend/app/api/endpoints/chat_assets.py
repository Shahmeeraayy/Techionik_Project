from urllib.parse import quote
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from ...api import deps
from ...core.enums import UserRole
from ...core.security import AuthenticatedUser
from ...services.chat_service import ChatService
from ...services.chat_storage_service import ChatStorageService

router = APIRouter(prefix="/chat", tags=["chat-assets"])


@router.get("/attachments/{attachment_id}/content")
def get_attachment_content(
    attachment_id: UUID,
    disposition: str = Query(default="inline"),
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.ADMIN, UserRole.TECHNICIAN)),
):
    if disposition not in {"inline", "attachment"}:
        disposition = "attachment"

    service = ChatService(db, current_user)
    attachment = service.get_attachment_for_current_user(attachment_id)
    content = ChatStorageService.read_content(attachment.storage_path)
    service.record_attachment_download(attachment)

    safe_name = quote(attachment.original_name)
    headers = {
        "Content-Disposition": f"{disposition}; filename*=UTF-8''{safe_name}",
        "Cache-Control": "private, no-store",
    }
    return Response(
        content=content,
        status_code=status.HTTP_200_OK,
        media_type=attachment.mime_type,
        headers=headers,
    )

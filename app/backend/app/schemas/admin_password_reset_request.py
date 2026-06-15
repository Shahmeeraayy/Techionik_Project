from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, validator

from ..core.passwords import validate_strong_password


class AdminPasswordResetRequestCreate(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)

    @validator("email")
    def validate_email(cls, email: str):
        normalized = email.strip().lower()
        if "@" not in normalized or normalized.startswith("@") or normalized.endswith("@"):
            raise ValueError("email must be valid")
        return normalized


class AdminPasswordResetRequestNotificationResponse(BaseModel):
    message: str


class AdminPasswordResetLinkValidationResponse(BaseModel):
    request_id: UUID
    admin_name: Optional[str] = None
    admin_email: str
    expires_at: datetime


class AdminPasswordResetCompleteRequest(BaseModel):
    new_password: str = Field(..., min_length=12, max_length=255)

    @validator("new_password")
    def validate_new_password(cls, value: str):
        return validate_strong_password(value)


class AdminPasswordResetCompleteResponse(BaseModel):
    message: str

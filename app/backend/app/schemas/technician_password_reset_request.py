from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, validator


class TechnicianPasswordResetRequestStatus(str, Enum):
    PENDING = "PENDING"
    RESOLVED = "RESOLVED"


class TechnicianPasswordResetRequestCreate(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)

    @validator("email")
    def validate_email(cls, email: str):
        normalized = email.strip().lower()
        if "@" not in normalized or normalized.startswith("@") or normalized.endswith("@"):
            raise ValueError("email must be valid")
        return normalized


class TechnicianPasswordResetRequestReviewRequest(BaseModel):
    remarks: Optional[str] = Field(default=None, max_length=500)

    @validator("remarks")
    def validate_remarks(cls, remarks: Optional[str]):
        if remarks is None:
            return None
        normalized = remarks.strip()
        return normalized or None


class TechnicianPasswordResetRequestNotificationResponse(BaseModel):
    message: str


class TechnicianPasswordResetRequestIssueRequest(BaseModel):
    technician_id: UUID


class TechnicianPasswordResetLinkValidationResponse(BaseModel):
    request_id: UUID
    technician_name: Optional[str] = None
    technician_email: str
    expires_at: datetime


class TechnicianPasswordResetCompleteRequest(BaseModel):
    new_password: str = Field(..., min_length=6, max_length=255)

    @validator("new_password")
    def validate_new_password(cls, value: str):
        normalized = value.strip()
        if len(normalized) < 6:
            raise ValueError("new_password must be at least 6 characters")
        return normalized


class TechnicianPasswordResetCompleteResponse(BaseModel):
    message: str


class TechnicianPasswordResetRequestResponse(BaseModel):
    id: UUID
    technician_id: UUID
    technician_name: Optional[str] = None
    technician_email: str
    technician_phone: Optional[str] = None
    status: TechnicianPasswordResetRequestStatus
    requested_at: datetime
    reviewed_by: Optional[UUID] = None
    reviewed_at: Optional[datetime] = None
    remarks: Optional[str] = None
    updated_at: datetime

    class Config:
        from_attributes = True


class TechnicianPasswordResetLinkIssueResponse(BaseModel):
    request: TechnicianPasswordResetRequestResponse
    reset_url: str

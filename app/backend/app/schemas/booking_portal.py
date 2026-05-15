from datetime import date, datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, TypeAdapter, field_validator


_EMAIL_ADAPTER = TypeAdapter(EmailStr)


class BookingPortalSettingsPayload(BaseModel):
    is_enabled: bool = False
    estimated_response_time_message: str = Field(..., min_length=1, max_length=500)
    confirmation_email_body: str = Field(..., min_length=1, max_length=5000)
    visible_service_ids: list[UUID] = Field(default_factory=list)
    status_lookup_enabled: bool = False
    industry_type: Literal["automotive", "property", "general"] = "automotive"
    details_field_label: Optional[str] = Field(default=None, max_length=128)

    @field_validator("estimated_response_time_message", "confirmation_email_body")
    @classmethod
    def _normalize_required_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("value cannot be blank")
        return normalized

    @field_validator("details_field_label")
    @classmethod
    def _normalize_optional_label(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class BookingPortalSettingsResponse(BookingPortalSettingsPayload):
    company_name: str
    company_logo_url: Optional[str] = None
    admin_contact_email: str
    admin_contact_phone: str


class BookingPortalServiceOption(BaseModel):
    id: UUID
    name: str
    category: str


class BookingPortalPublicConfigResponse(BaseModel):
    is_enabled: bool
    company_name: str
    company_logo_url: Optional[str] = None
    admin_contact_email: str
    admin_contact_phone: str
    estimated_response_time_message: str
    status_lookup_enabled: bool
    industry_type: Literal["automotive", "property", "general"]
    details_field_label: str
    services: list[BookingPortalServiceOption]


class BookingPortalSubmissionRequest(BaseModel):
    customer_full_name: str = Field(..., min_length=1, max_length=255)
    phone_number: str = Field(..., min_length=7, max_length=64)
    email_address: str = Field(..., min_length=3, max_length=255)
    service_location_address: str = Field(..., min_length=1, max_length=1000)
    service_location_city: Optional[str] = Field(default=None, max_length=128)
    service_location_state: Optional[str] = Field(default=None, max_length=128)
    service_location_zip_code: Optional[str] = Field(default=None, max_length=32)
    service_catalog_ids: list[UUID] = Field(..., min_length=1)
    asset_details: str = Field(..., min_length=1, max_length=5000)
    preferred_date: Optional[date] = None
    preferred_time_of_day: Literal["morning", "afternoon", "evening", "no_preference"] = "no_preference"
    additional_notes: Optional[str] = Field(default=None, max_length=5000)

    @field_validator("customer_full_name", "asset_details", "service_location_address")
    @classmethod
    def _normalize_required_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("value cannot be blank")
        return normalized

    @field_validator("phone_number")
    @classmethod
    def _normalize_phone_number(cls, value: str) -> str:
        normalized = value.strip()
        digits = "".join(ch for ch in normalized if ch.isdigit())
        if len(digits) < 10:
            raise ValueError("phone_number must contain at least 10 digits")
        return normalized

    @field_validator("email_address")
    @classmethod
    def _normalize_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        return str(_EMAIL_ADAPTER.validate_python(normalized)).lower()

    @field_validator("additional_notes")
    @classmethod
    def _normalize_optional_notes(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None

    @field_validator("service_location_city", "service_location_state", "service_location_zip_code")
    @classmethod
    def _normalize_optional_location_text(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None

    @field_validator("service_catalog_ids")
    @classmethod
    def _normalize_service_ids(cls, value: list[UUID]) -> list[UUID]:
        unique: list[UUID] = []
        seen: set[UUID] = set()
        for item in value:
            if item in seen:
                continue
            seen.add(item)
            unique.append(item)
        if not unique:
            raise ValueError("Select at least one service.")
        return unique


class BookingPortalSubmissionResponse(BaseModel):
    reference_number: str
    estimated_response_time_message: str


class BookingPortalStatusLookupRequest(BaseModel):
    reference_number: str = Field(..., min_length=3, max_length=32)
    email_address: str = Field(..., min_length=3, max_length=255)

    @field_validator("reference_number")
    @classmethod
    def _normalize_reference_number(cls, value: str) -> str:
        normalized = value.strip().upper()
        if not normalized:
            raise ValueError("value cannot be blank")
        return normalized

    @field_validator("email_address")
    @classmethod
    def _normalize_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        return str(_EMAIL_ADAPTER.validate_python(normalized)).lower()


class BookingPortalStatusLookupResponse(BaseModel):
    reference_number: str
    status: Literal["Received", "Under Review", "Job Scheduled", "In Progress", "Completed"]
    assigned_technician_id: Optional[UUID] = None
    assigned_technician_first_name: Optional[str] = None
    estimated_completion_date: Optional[date] = None


class BookingRequestAdminResponse(BaseModel):
    id: UUID
    reference_number: str
    customer_full_name: str
    phone_number: str
    email_address: str
    service_location_address: Optional[str] = None
    service_location_city: Optional[str] = None
    service_location_state: Optional[str] = None
    service_location_zip_code: Optional[str] = None
    service_catalog_id: Optional[UUID] = None
    service_name: str
    service_catalog_ids: list[UUID] = Field(default_factory=list)
    service_names: list[str] = Field(default_factory=list)
    asset_details: str
    preferred_date: Optional[date] = None
    preferred_time_of_day: Literal["morning", "afternoon", "evening", "no_preference"]
    additional_notes: Optional[str] = None
    status: Literal["RECEIVED", "UNDER_REVIEW", "JOB_SCHEDULED", "IN_PROGRESS", "COMPLETED"]
    assigned_technician_id: Optional[UUID] = None
    assigned_technician_first_name: Optional[str] = None
    estimated_completion_date: Optional[date] = None
    source: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BookingRequestAdminUpdatePayload(BaseModel):
    status: Optional[Literal["RECEIVED", "UNDER_REVIEW", "JOB_SCHEDULED", "IN_PROGRESS", "COMPLETED"]] = None
    assigned_technician_id: Optional[UUID] = None
    assigned_technician_first_name: Optional[str] = Field(default=None, max_length=64)
    estimated_completion_date: Optional[date] = None

    @field_validator("assigned_technician_first_name")
    @classmethod
    def _normalize_optional_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None

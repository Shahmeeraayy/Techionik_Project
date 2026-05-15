from __future__ import annotations

from datetime import datetime, timezone
from string import Template
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import case, inspect, text
from sqlalchemy.orm import Session

from urllib.parse import quote

from ..core.config import COMPANY_EMAIL, COMPANY_LOGO_URL, COMPANY_NAME, COMPANY_PHONE, COMPANY_WEBSITE, CUSTOMER_PORTAL_BASE_URL, DEFAULT_TENANT_ID
from ..core.job_status import DispatchJobStatus, db_status_from_dispatch_status
from .email_service import send_email
from ..core.security import AuthenticatedUser
from ..models.admin_credential_settings import AdminCredentialSettings
from ..models.admin_user import AdminUser
from ..models.booking_portal_settings import BookingPortalSettings
from ..models.booking_request import BookingRequest
from ..models.email_outbox import EmailOutbox
from ..models.job import Job
from ..models.invoice_branding_settings import InvoiceBrandingSettings
from ..models.service_catalog import ServiceCatalog
from ..models.technician import Technician
from ..schemas.booking_portal import (
    BookingPortalPublicConfigResponse,
    BookingPortalServiceOption,
    BookingPortalSettingsPayload,
    BookingPortalSettingsResponse,
    BookingPortalStatusLookupRequest,
    BookingPortalStatusLookupResponse,
    BookingPortalSubmissionRequest,
    BookingPortalSubmissionResponse,
    BookingRequestAdminResponse,
    BookingRequestAdminUpdatePayload,
)
from .job_services_service import JobServicesService


BOOKING_PORTAL_SETTINGS_KEY = "default"


class BookingPortalService:
    STATUS_PUBLIC_LABELS = {
        "RECEIVED": "Received",
        "UNDER_REVIEW": "Under Review",
        "JOB_SCHEDULED": "Job Scheduled",
        "IN_PROGRESS": "In Progress",
        "COMPLETED": "Completed",
    }

    def __init__(self, db: Session, current_user: AuthenticatedUser | None = None):
        self.db = db
        self.current_user = current_user

    def _get_settings_row(self) -> BookingPortalSettings | None:
        # skip_tenant_scope: booking_portal_settings has a unique key per
        # system, not per tenant. Without this, a public (unauthenticated)
        # request scoped to DEFAULT_TENANT_ID would miss rows saved under the
        # real admin tenant, causing a duplicate-key INSERT on next save.
        return (
            self.db.query(BookingPortalSettings)
            .execution_options(skip_tenant_scope=True)
            .filter(BookingPortalSettings.key == BOOKING_PORTAL_SETTINGS_KEY)
            .first()
        )

    def _get_owner_tenant_id(self) -> UUID:
        """Return the tenant that owns the booking portal settings row."""
        row = self._get_settings_row()
        if row is not None and row.tenant_id is not None:
            return row.tenant_id
        return UUID(DEFAULT_TENANT_ID)

    def _set_session_tenant(self, tenant_id: UUID | None) -> None:
        self.db.info["tenant_id"] = tenant_id
        if tenant_id is not None:
            self.db.execute(
                text("SELECT set_config('app.current_tenant_id', :tenant_id, true)"),
                {"tenant_id": str(tenant_id)},
            )

    def _booking_status_to_job_status(self, booking_status: str) -> str:
        if booking_status == "IN_PROGRESS":
            return db_status_from_dispatch_status(DispatchJobStatus.IN_PROGRESS)
        if booking_status == "COMPLETED":
            return db_status_from_dispatch_status(DispatchJobStatus.COMPLETED)
        if booking_status == "JOB_SCHEDULED":
            return db_status_from_dispatch_status(DispatchJobStatus.SCHEDULED)
        return db_status_from_dispatch_status(DispatchJobStatus.PENDING)

    def _render_status_update_email(
        self,
        *,
        row: BookingRequest,
        company_name: str,
    ) -> tuple[str, str]:
        public_status = self.STATUS_PUBLIC_LABELS.get(row.status, row.status.replace("_", " ").title())
        subject = f"{company_name} booking update {row.reference_number}"
        lines = [
            f"Hello {row.customer_full_name},",
            "",
            f"Your booking request {row.reference_number} has been updated.",
            "",
            f"Status: {public_status}",
        ]
        if row.assigned_technician_first_name:
            lines.append(f"Assigned technician: {row.assigned_technician_first_name}")
        if row.estimated_completion_date:
            lines.append(f"Estimated completion date: {row.estimated_completion_date}")
        location = self._format_service_location(row)
        if location:
            lines.extend(["", f"Service location:\n{location}"])
        lines.extend(
            [
                "",
                f"Track your request: {self._booking_status_url(row.reference_number, row.email_address)}",
                "",
                f"Thank you,",
                company_name,
            ]
        )
        return subject, "\n".join(lines)

    @staticmethod
    def _format_service_location(row: BookingRequest) -> str:
        city_line = ", ".join(
            item for item in [row.service_location_city, row.service_location_state] if item
        )
        tail = " ".join(item for item in [city_line, row.service_location_zip_code] if item)
        return "\n".join(item for item in [row.service_location_address, tail] if item)

    def _find_job_for_booking(self, row: BookingRequest) -> Job | None:
        candidates = (
            self.db.query(Job)
            .execution_options(skip_tenant_scope=True)
            .filter(Job.source_system == "booking_portal")
            .all()
        )
        for job in candidates:
            metadata = job.source_metadata if isinstance(job.source_metadata, dict) else {}
            if metadata.get("booking_request_id") == str(row.id):
                return job
        return (
            self.db.query(Job)
            .execution_options(skip_tenant_scope=True)
            .filter(Job.job_code == row.reference_number)
            .first()
        )

    def _sync_booking_job(self, row: BookingRequest, technician: Technician | None) -> None:
        job_row = self._find_job_for_booking(row)
        if technician is None:
            if job_row is not None:
                self._set_session_tenant(job_row.tenant_id)
                job_row.assigned_tech_id = None
                job_row.pre_assigned_technician_id = None
                job_row.pre_assignment_reason = None
                if row.status != "COMPLETED":
                    job_row.status = db_status_from_dispatch_status(DispatchJobStatus.PENDING)
            return

        metadata = dict(job_row.source_metadata) if job_row is not None and isinstance(job_row.source_metadata, dict) else {}
        metadata.update(
            {
                "source": "booking_portal",
                "booking_request_id": str(row.id),
                "booking_reference_number": row.reference_number,
                "customer_email": row.email_address,
                "customer_phone": row.phone_number,
            }
        )

        service_names = row.service_names or ([row.service_name] if row.service_name else [])
        if job_row is None:
            job_row = Job(
                job_code=row.reference_number,
                source_system="booking_portal",
                source_metadata=metadata,
            )
            self.db.add(job_row)

        self._set_session_tenant(technician.tenant_id)
        job_row.tenant_id = technician.tenant_id
        job_row.status = self._booking_status_to_job_status(row.status)
        job_row.assigned_tech_id = technician.id
        job_row.pre_assigned_technician_id = technician.id
        job_row.pre_assignment_reason = "booking_request_assignment"
        job_row.customer_name = row.customer_full_name
        job_row.customer_address = row.service_location_address
        job_row.customer_city = row.service_location_city
        job_row.customer_state = row.service_location_state
        job_row.customer_zip_code = row.service_location_zip_code
        job_row.service_type = service_names[0] if service_names else row.service_name
        job_row.vehicle = row.asset_details
        job_row.location = self._format_service_location(row) or row.service_location_address
        job_row.requested_service_date = row.preferred_date or row.estimated_completion_date
        job_row.source_system = "booking_portal"
        job_row.source_metadata = metadata
        JobServicesService(self.db).replace_services(
            job=job_row,
            service_names=service_names or ["Booking request"],
            source="admin",
        )

    def _get_admin_contact(self) -> tuple[str, str, str, Optional[str]]:
        branding = (
            self.db.query(InvoiceBrandingSettings)
            .execution_options(skip_tenant_scope=True)
            .filter(InvoiceBrandingSettings.key == "default")
            .first()
        )
        primary_admin_user = (
            self.db.query(AdminUser)
            .execution_options(skip_tenant_scope=True)
            .filter(AdminUser.status == "active")
            .order_by(
                case((AdminUser.tenant_role == "owner", 0), else_=1),
                AdminUser.created_at.asc(),
            )
            .first()
        )
        admin_settings = (
            self.db.query(AdminCredentialSettings)
            .execution_options(skip_tenant_scope=True)
            .first()
        )
        company_name = branding.name if branding is not None else COMPANY_NAME
        admin_email = (
            (primary_admin_user.email if primary_admin_user is not None else None)
            or
            (admin_settings.admin_email if admin_settings is not None else None)
            or (branding.email if branding is not None else None)
            or COMPANY_EMAIL
        )
        admin_phone = (branding.phone if branding is not None else None) or COMPANY_PHONE
        logo_url = branding.logo_url if branding is not None else (COMPANY_LOGO_URL or None)
        return company_name, admin_email, admin_phone, logo_url

    def _get_default_settings_payload(self) -> BookingPortalSettingsPayload:
        return BookingPortalSettingsPayload(
            is_enabled=True,
            estimated_response_time_message="We will contact you within 2 business hours.",
            confirmation_email_body=(
                "Hello ${customer_name},\n\n"
                "Thanks for contacting ${company_name}. We received your service request ${reference_number}.\n\n"
                "Service location:\n${service_location}\n\n"
                "${estimated_response_time_message}\n\n"
                "Booking form: ${booking_portal_url}\n"
                "Track your request: ${booking_status_url}\n\n"
                "If you need help, reply to ${admin_contact_email}."
            ),
            visible_service_ids=[],
            status_lookup_enabled=False,
            industry_type="automotive",
            details_field_label=None,
        )

    def _resolve_details_field_label(self, industry_type: str, explicit_label: Optional[str]) -> str:
        if explicit_label:
            return explicit_label
        if industry_type == "property":
            return "Property details"
        if industry_type == "general":
            return "Service details"
        return "Vehicle details"

    def _load_settings_payload(self) -> BookingPortalSettingsPayload:
        row = self._get_settings_row()
        if row is None:
            return self._get_default_settings_payload()
        return BookingPortalSettingsPayload(
            is_enabled=bool(row.is_enabled),
            estimated_response_time_message=row.estimated_response_time_message,
            confirmation_email_body=row.confirmation_email_body,
            visible_service_ids=[
                UUID(str(item)) for item in (row.visible_service_ids or []) if str(item).strip()
            ],
            status_lookup_enabled=bool(row.status_lookup_enabled),
            industry_type=row.industry_type if row.industry_type in {"automotive", "property", "general"} else "automotive",
            details_field_label=row.details_field_label,
        )

    def _list_visible_service_rows(
        self,
        payload: BookingPortalSettingsPayload,
        owner_tenant_id: UUID | None = None,
    ) -> list[ServiceCatalog]:
        query = self.db.query(ServiceCatalog)
        if owner_tenant_id is not None:
            # Public context: skip tenant scope and explicitly filter by the
            # owner tenant so we see the same services the admin configured.
            query = (
                query
                .execution_options(skip_tenant_scope=True)
                .filter(ServiceCatalog.tenant_id == owner_tenant_id)
            )
        query = query.filter(ServiceCatalog.status == "active").order_by(ServiceCatalog.name.asc())
        rows = query.all()
        if not payload.visible_service_ids:
            return rows
        visible_ids = {str(item) for item in payload.visible_service_ids}
        filtered = [row for row in rows if str(row.id) in visible_ids]
        return filtered

    def get_admin_settings(self) -> BookingPortalSettingsResponse:
        payload = self._load_settings_payload()
        company_name, admin_email, admin_phone, logo_url = self._get_admin_contact()
        return BookingPortalSettingsResponse(
            **payload.model_dump(),
            company_name=company_name,
            company_logo_url=logo_url,
            admin_contact_email=admin_email,
            admin_contact_phone=admin_phone,
        )

    def update_admin_settings(self, payload: BookingPortalSettingsPayload) -> BookingPortalSettingsResponse:
        row = self._get_settings_row()
        service_ids = [str(item) for item in payload.visible_service_ids]
        if row is None:
            row = BookingPortalSettings(
                key=BOOKING_PORTAL_SETTINGS_KEY,
                is_enabled=payload.is_enabled,
                estimated_response_time_message=payload.estimated_response_time_message,
                confirmation_email_body=payload.confirmation_email_body,
                visible_service_ids=service_ids,
                status_lookup_enabled=payload.status_lookup_enabled,
                industry_type=payload.industry_type,
                details_field_label=payload.details_field_label,
            )
            self.db.add(row)
        else:
            row.is_enabled = payload.is_enabled
            row.estimated_response_time_message = payload.estimated_response_time_message
            row.confirmation_email_body = payload.confirmation_email_body
            row.visible_service_ids = service_ids
            row.status_lookup_enabled = payload.status_lookup_enabled
            row.industry_type = payload.industry_type
            row.details_field_label = payload.details_field_label

        self.db.commit()
        self.db.refresh(row)
        return self.get_admin_settings()

    def get_public_config(self) -> BookingPortalPublicConfigResponse:
        payload = self._load_settings_payload()
        owner_tenant_id = self._get_owner_tenant_id()
        company_name, admin_email, admin_phone, logo_url = self._get_admin_contact()
        service_rows = self._list_visible_service_rows(payload, owner_tenant_id=owner_tenant_id)
        return BookingPortalPublicConfigResponse(
            is_enabled=payload.is_enabled,
            company_name=company_name,
            company_logo_url=logo_url,
            admin_contact_email=admin_email,
            admin_contact_phone=admin_phone,
            estimated_response_time_message=payload.estimated_response_time_message,
            status_lookup_enabled=payload.status_lookup_enabled,
            industry_type=payload.industry_type,
            details_field_label=self._resolve_details_field_label(payload.industry_type, payload.details_field_label),
            services=[
                BookingPortalServiceOption(id=row.id, name=row.name, category=row.category)
                for row in service_rows
            ],
        )

    def _render_confirmation_email(
        self,
        *,
        template_body: str,
        customer_name: str,
        company_name: str,
        reference_number: str,
        estimated_response_time_message: str,
        admin_contact_email: str,
        booking_portal_url: str,
        booking_status_url: str,
        service_location: str,
    ) -> str:
        return Template(template_body).safe_substitute(
            customer_name=customer_name,
            company_name=company_name,
            reference_number=reference_number,
            estimated_response_time_message=estimated_response_time_message,
            admin_contact_email=admin_contact_email,
            booking_portal_url=booking_portal_url,
            booking_status_url=booking_status_url,
            service_location=service_location,
        )

    def _normalize_customer_portal_base_url(self) -> str:
        base_url = (CUSTOMER_PORTAL_BASE_URL or COMPANY_WEBSITE or "").strip().rstrip("/")
        if not base_url:
            return "http://127.0.0.1:5173"
        return base_url

    def _booking_portal_url(self) -> str:
        return f"{self._normalize_customer_portal_base_url()}/book"

    def _booking_status_url(self, reference_number: str, email_address: str) -> str:
        base_url = self._normalize_customer_portal_base_url()
        return (
            f"{base_url}/book/status"
            f"?reference={quote(reference_number)}&email={quote(email_address.lower())}"
        )

    def _next_reference_number(self) -> str:
        prefix = datetime.now(timezone.utc).strftime("BK%y%m%d")
        latest = (
            self.db.query(BookingRequest)
            .filter(BookingRequest.reference_number.like(f"{prefix}%"))
            .order_by(BookingRequest.reference_number.desc())
            .first()
        )
        if latest is None:
            return f"{prefix}001"
        try:
            sequence = int(latest.reference_number[-3:]) + 1
        except Exception:
            sequence = 1
        return f"{prefix}{sequence:03d}"

    def _notifications_table_exists(self) -> bool:
        bind = self.db.get_bind()
        return bool(bind is not None and inspect(bind).has_table("notifications"))

    def _create_admin_notification(self, message: str, metadata_json: str) -> None:
        if not self._notifications_table_exists():
            return
        self.db.execute(
            text(
                """
                INSERT INTO notifications (recipient_role, message, metadata, created_at)
                VALUES (:recipient_role, :message, :metadata, CURRENT_TIMESTAMP)
                """
            ),
            {
                "recipient_role": "admin",
                "message": message,
                "metadata": metadata_json,
            },
        )

    def submit_booking(self, payload: BookingPortalSubmissionRequest) -> BookingPortalSubmissionResponse:
        settings = self._load_settings_payload()
        if not settings.is_enabled:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Booking portal is currently disabled")

        # Resolve the tenant that owns this portal so the booking is saved
        # under the same tenant as the admin (not the public DEFAULT_TENANT_ID).
        owner_tenant_id = self._get_owner_tenant_id()

        visible_service_rows = self._list_visible_service_rows(settings, owner_tenant_id=owner_tenant_id)
        service_by_id = {str(row.id): row for row in visible_service_rows}
        selected_service_rows = [service_by_id.get(str(service_id)) for service_id in payload.service_catalog_ids]
        if any(row is None for row in selected_service_rows):
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="One or more selected services are not available")
        resolved_service_rows = [row for row in selected_service_rows if row is not None]
        primary_service_row = resolved_service_rows[0]
        selected_service_names = [row.name for row in resolved_service_rows]
        selected_service_ids = [str(row.id) for row in resolved_service_rows]

        company_name, admin_email, admin_phone, _ = self._get_admin_contact()
        reference_number = self._next_reference_number()

        # Temporarily set session tenant to the owner so BookingRequest and
        # EmailOutbox are written under the correct tenant without a cross-tenant error.
        original_tenant_id = self.db.info.get("tenant_id")
        self._set_session_tenant(owner_tenant_id)

        row = BookingRequest(
            reference_number=reference_number,
            customer_full_name=payload.customer_full_name,
            phone_number=payload.phone_number,
            email_address=payload.email_address,
            service_location_address=payload.service_location_address,
            service_location_city=payload.service_location_city,
            service_location_state=payload.service_location_state,
            service_location_zip_code=payload.service_location_zip_code,
            service_catalog_id=primary_service_row.id,
            service_name=primary_service_row.name,
            service_catalog_ids=selected_service_ids,
            service_names=selected_service_names,
            asset_details=payload.asset_details,
            preferred_date=payload.preferred_date,
            preferred_time_of_day=payload.preferred_time_of_day,
            additional_notes=payload.additional_notes,
            status="RECEIVED",
            source="Booking Portal",
        )
        self.db.add(row)
        self.db.flush()
        self.db.refresh(row)

        confirmation_body = self._render_confirmation_email(
            template_body=settings.confirmation_email_body,
            customer_name=row.customer_full_name,
            company_name=company_name,
            reference_number=row.reference_number,
            estimated_response_time_message=settings.estimated_response_time_message,
            admin_contact_email=admin_email,
            booking_portal_url=self._booking_portal_url(),
            booking_status_url=self._booking_status_url(row.reference_number, row.email_address),
            service_location=self._format_service_location(row) or "Not provided",
        )

        customer_subject = f"{company_name} booking confirmation {row.reference_number}"
        admin_subject = f"New booking request {row.reference_number}"
        admin_body = (
            f"New booking request received.\n\n"
            f"Reference: {row.reference_number}\n"
            f"Customer: {row.customer_full_name}\n"
            f"Phone: {row.phone_number}\n"
            f"Email: {row.email_address}\n"
            f"Location: {self._format_service_location(row) or 'Not provided'}\n"
            f"Services: {', '.join(selected_service_names)}\n"
            f"Preferred date: {row.preferred_date or 'Not set'}\n"
            f"Preferred time: {row.preferred_time_of_day}\n"
            f"Details: {row.asset_details}\n"
            f"Notes: {row.additional_notes or 'None'}\n"
            f"Admin contact phone: {admin_phone}\n"
        )

        customer_outbox = EmailOutbox(
            recipient_email=row.email_address,
            subject=customer_subject,
            body=confirmation_body,
            message_type="booking_confirmation_customer",
            related_entity_type="booking_request",
            related_entity_id=str(row.id),
        )
        admin_outbox = EmailOutbox(
            recipient_email=admin_email,
            subject=admin_subject,
            body=admin_body,
            message_type="booking_notification_admin",
            related_entity_type="booking_request",
            related_entity_id=str(row.id),
        )
        self.db.add(customer_outbox)
        self.db.add(admin_outbox)

        self._create_admin_notification(
            f"New booking request {row.reference_number} from {row.customer_full_name}",
            (
                "{"
                f"\"booking_request_id\":\"{row.id}\","
                f"\"reference_number\":\"{row.reference_number}\","
                f"\"source\":\"Booking Portal\""
                "}"
            ),
        )

        self.db.commit()
        # Restore the original tenant scope so subsequent queries in the same
        # request are not inadvertently scoped to the owner tenant.
        self._set_session_tenant(original_tenant_id)

        # Send emails immediately after commit. Failures are logged but do not
        # surface as HTTP errors — the booking is already saved.
        customer_sent = send_email(
            to=row.email_address,
            subject=customer_subject,
            body=confirmation_body,
        )
        send_email(
            to=admin_email,
            subject=admin_subject,
            body=admin_body,
        )

        # Update outbox status so we have a record of delivery attempts.
        customer_status = "sent" if customer_sent else "failed"
        try:
            self.db.execute(
                text("UPDATE email_outbox SET status = :status WHERE id = :id"),
                {"status": customer_status, "id": str(customer_outbox.id)},
            )
            self.db.commit()
        except Exception:
            pass

        return BookingPortalSubmissionResponse(
            reference_number=row.reference_number,
            estimated_response_time_message=settings.estimated_response_time_message,
        )

    def lookup_status(self, payload: BookingPortalStatusLookupRequest) -> BookingPortalStatusLookupResponse:
        settings = self._load_settings_payload()
        if not settings.status_lookup_enabled:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Booking status lookup is disabled")

        row = (
            self.db.query(BookingRequest)
            .execution_options(skip_tenant_scope=True)
            .filter(BookingRequest.reference_number == payload.reference_number)
            .filter(BookingRequest.email_address == payload.email_address)
            .first()
        )
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking reference not found")

        return BookingPortalStatusLookupResponse(
            reference_number=row.reference_number,
            status=self.STATUS_PUBLIC_LABELS[row.status],
            assigned_technician_id=row.assigned_technician_id,
            assigned_technician_first_name=row.assigned_technician_first_name,
            estimated_completion_date=row.estimated_completion_date,
        )

    def list_admin_bookings(self) -> list[BookingRequestAdminResponse]:
        owner_tenant_id = self._get_owner_tenant_id()
        rows = (
            self.db.query(BookingRequest)
            .execution_options(skip_tenant_scope=True)
            .filter(BookingRequest.tenant_id == owner_tenant_id)
            .order_by(BookingRequest.created_at.desc())
            .all()
        )
        payload: list[BookingRequestAdminResponse] = []
        for row in rows:
            payload.append(
                self._to_admin_booking_response(row)
            )
        return payload

    def update_admin_booking(self, booking_id: UUID, payload: BookingRequestAdminUpdatePayload) -> BookingRequestAdminResponse:
        row = (
            self.db.query(BookingRequest)
            .execution_options(skip_tenant_scope=True)
            .filter(BookingRequest.id == booking_id)
            .first()
        )
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking request not found")

        original_tenant_id = self.db.info.get("tenant_id")
        self._set_session_tenant(row.tenant_id)
        updates = payload.model_dump(exclude_unset=True)
        try:
            assigned_technician = None
            if "assigned_technician_id" in updates and updates["assigned_technician_id"] is not None:
                assigned_technician = (
                    self.db.query(Technician)
                    .execution_options(skip_tenant_scope=True)
                    .filter(Technician.id == updates["assigned_technician_id"])
                    .first()
                )
                if assigned_technician is None:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Technician not found")
                if assigned_technician.status != "active":
                    raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Technician is not active")
                updates["assigned_technician_first_name"] = (assigned_technician.name or assigned_technician.full_name or "").split(" ")[0] or None
            elif "assigned_technician_id" in updates:
                updates["assigned_technician_first_name"] = None

            for key, value in updates.items():
                setattr(row, key, value)

            if assigned_technician is None and row.assigned_technician_id is not None:
                assigned_technician = (
                    self.db.query(Technician)
                    .execution_options(skip_tenant_scope=True)
                    .filter(Technician.id == row.assigned_technician_id)
                    .first()
                )
            self.db.flush()
            self.db.refresh(row)
            company_name, _, _, _ = self._get_admin_contact()
            email_subject, email_body = self._render_status_update_email(row=row, company_name=company_name)
            self._set_session_tenant(row.tenant_id)
            self.db.add(
                EmailOutbox(
                    recipient_email=row.email_address,
                    subject=email_subject,
                    body=email_body,
                    message_type="booking_status_update_customer",
                    related_entity_type="booking_request",
                    related_entity_id=str(row.id),
                )
            )
            self._sync_booking_job(row, assigned_technician)

            self.db.commit()
            self.db.refresh(row)
            response = self._to_admin_booking_response(row)
        except Exception:
            self.db.rollback()
            self._set_session_tenant(original_tenant_id)
            raise
        self._set_session_tenant(original_tenant_id)
        send_email(to=row.email_address, subject=email_subject, body=email_body)
        return response

    @staticmethod
    def _to_admin_booking_response(row: BookingRequest) -> BookingRequestAdminResponse:
        return BookingRequestAdminResponse.model_validate(
            {
                "id": row.id,
                "reference_number": row.reference_number,
                "customer_full_name": row.customer_full_name,
                "phone_number": row.phone_number,
                "email_address": row.email_address,
                "service_location_address": row.service_location_address,
                "service_location_city": row.service_location_city,
                "service_location_state": row.service_location_state,
                "service_location_zip_code": row.service_location_zip_code,
                "service_catalog_id": row.service_catalog_id,
                "service_name": row.service_name,
                "service_catalog_ids": row.service_catalog_ids or ([row.service_catalog_id] if row.service_catalog_id else []),
                "service_names": row.service_names or ([row.service_name] if row.service_name else []),
                "asset_details": row.asset_details,
                "preferred_date": row.preferred_date,
                "preferred_time_of_day": row.preferred_time_of_day,
                "additional_notes": row.additional_notes,
                "status": row.status,
                "assigned_technician_id": row.assigned_technician_id,
                "assigned_technician_first_name": row.assigned_technician_first_name,
                "estimated_completion_date": row.estimated_completion_date,
                "source": row.source,
                "created_at": row.created_at,
                "updated_at": row.updated_at,
            }
        )

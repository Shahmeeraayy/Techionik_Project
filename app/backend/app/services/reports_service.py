from __future__ import annotations

from collections import defaultdict
from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal, InvalidOperation
from typing import Iterable, Optional

from sqlalchemy.orm import Session

from ..models.booking_request import BookingRequest
from ..models.dealership import Dealership
from ..models.invoice import Invoice
from ..models.job import Job
from ..models.job_rejection import JobRejection
from ..models.service_catalog import ServiceCatalog
from ..models.technician import Technician
from ..models.technician_tracking import TechnicianAttendanceSession
from ..schemas.reporting import (
    AttendanceDailyRow,
    AttendanceMetrics,
    AttendanceTechnicianRow,
    CapacityPlanningMetrics,
    CapacityUtilizationRow,
    CustomerRequestAnalyticsMetrics,
    CustomerRequestCategoryRow,
    DealershipPerformanceRow,
    DispatchOverviewMetrics,
    DispatchStatusRow,
    IntakeAnalyticsMetrics,
    IntakeChannelRow,
    IntakeDismissedReasonRow,
    InvoiceBlockedReasonRow,
    InvoicePerformanceMetrics,
    InvoiceStatusRow,
    InvoicingDetailRow,
    JobCompletionMetrics,
    PaymentBreakdownRow,
    PaymentMethodRow,
    PaymentMetrics,
    PaymentStatusRow,
    PeakDemandWindowRow,
    ReportKpis,
    ReportsOverviewResponse,
    RevenueByCategoryRow,
    RevenueByDateRow,
    RevenueMetrics,
    ServiceCategoryAnalyticsMetrics,
    ServiceCategoryAnalyticsRow,
    TechnicianPerformanceRow,
    UnderstaffedPeriodRow,
)


TAX_CODE_RATES: dict[str, Decimal] = {
    "EXEMPT": Decimal("0"),
    "ZERO": Decimal("0"),
    "GST": Decimal("0.05"),
    "QST": Decimal("0.09975"),
    "GST_QST": Decimal("0.14975"),
}

REQUEST_NEW_STATUSES = {"received", "under_review"}
REQUEST_CONVERTED_STATUSES = {"job_scheduled", "in_progress", "completed"}
ACTIVE_ATTENDANCE_STATUSES = {"clocked_in", "on_break"}
PENDING_PAYMENT_STATES = {"draft", "sent", "overdue"}


def _to_utc_start(value: date) -> datetime:
    return datetime.combine(value, time.min, tzinfo=UTC)


def _to_utc_end(value: date) -> datetime:
    return datetime.combine(value, time.max, tzinfo=UTC)


def _ensure_utc(value: Optional[datetime]) -> Optional[datetime]:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def _job_completion_timestamp(row: Job) -> Optional[datetime]:
    if row.completed_at is not None:
        return _ensure_utc(row.completed_at)
    if _normalize_job_status(row.status) == "Completed":
        return _ensure_utc(row.updated_at)
    return None


def _duration_label(minutes: float) -> str:
    rounded = int(round(max(minutes, 0)))
    if rounded <= 0:
        return "0m"
    if rounded < 60:
        return f"{rounded}m"
    hours = rounded // 60
    remainder = rounded % 60
    return f"{hours}h {remainder}m" if remainder > 0 else f"{hours}h"


def _hours_label(minutes: int) -> float:
    return round(max(minutes, 0) / 60, 2)


def _normalize_job_status(value: Optional[str]) -> str:
    status = (value or "").strip().lower()
    mapping = {
        "admin_review": "Admin Preview",
        "admin_preview": "Admin Preview",
        "ready_for_tech": "Pending",
        "pending_admin_confirmation": "Pending Admin Confirmation",
        "pending_review": "Pending Review",
        "pending": "Pending",
        "scheduled": "Scheduled",
        "in_progress": "In Progress",
        "completed": "Completed",
        "delayed": "Delayed",
        "cancelled": "Cancelled",
        "ready_for_tech_acceptance": "Pending",
        "assigned": "In Progress",
    }
    return mapping.get(status, "Unknown")


def _normalize_invoice_state(value: Optional[str]) -> str:
    status = (value or "").strip().lower()
    mapping = {
        "draft": "Draft",
        "sent": "Sent",
        "paid": "Paid",
        "overdue": "Overdue",
        "cancelled": "Cancelled",
    }
    return mapping.get(status, "Draft")


def _normalize_request_status(value: Optional[str]) -> str:
    return (value or "").strip().lower()


def _normalize_attendance_status(value: Optional[str]) -> str:
    status = (value or "").strip().lower()
    mapping = {
        "clocked_in": "Clocked In",
        "on_break": "On Break",
        "clocked_out": "Clocked Out",
    }
    return mapping.get(status, "Clocked Out")


def _metadata_text(row: Job, *keys: str, default: str = "") -> str:
    metadata = row.source_metadata if isinstance(row.source_metadata, dict) else {}
    for key in keys:
        value = metadata.get(key)
        if value is not None and str(value).strip():
            return str(value).strip()
    return default


def _job_urgency(row: Job) -> str:
    value = _metadata_text(row, "urgency", "urgency_level", "priority", default="Medium")
    normalized = value.strip().lower().replace("_", " ")
    mapping = {
        "low": "Low",
        "normal": "Medium",
        "medium": "Medium",
        "high": "High",
        "critical": "Critical",
    }
    return mapping.get(normalized, value.title() if value else "Medium")


def _job_source_channel(row: Job) -> str:
    source = (row.source_system or _metadata_text(row, "source", "source_channel", default="Admin UI")).strip()
    if not source:
        return "Admin UI"
    if source.lower() in {"admin_ui", "admin"}:
        return "Admin UI"
    return source


def _primary_job_by_invoice_id(db: Session, invoice_ids: Iterable) -> dict:
    ids = [invoice_id for invoice_id in invoice_ids if invoice_id is not None]
    if not ids:
        return {}

    jobs = (
        db.query(Job)
        .filter(Job.invoice_id.in_(ids))
        .order_by(Job.invoice_id.asc(), Job.created_at.asc())
        .all()
    )

    by_invoice_id = {}
    for row in jobs:
        if row.invoice_id not in by_invoice_id:
            by_invoice_id[row.invoice_id] = row
    return by_invoice_id


def _is_pending_approval_eligible(job: Job, dealership: Optional[Dealership]) -> bool:
    try:
        quantity = Decimal(str(job.hours_worked if job.hours_worked is not None else "1"))
        rate = Decimal(str(job.rate if job.rate is not None else "0"))
    except (InvalidOperation, TypeError, ValueError):
        return False

    if quantity <= 0 or rate < 0:
        return False

    tax_code = str(job.tax_code or "EXEMPT").strip().upper()
    if tax_code == "CUSTOM":
        try:
            if job.tax_rate is None:
                return False
            tax_rate = Decimal(str(job.tax_rate))
        except (InvalidOperation, TypeError, ValueError):
            return False
        if tax_rate < 0:
            return False
    elif tax_code not in TAX_CODE_RATES:
        return False

    bill_to_name = (job.customer_name or (dealership.name if dealership else None) or "").strip()
    bill_to_street = (job.customer_address or (dealership.address if dealership else None) or "").strip()
    if not bill_to_name or not bill_to_street:
        return False

    return True


def _percent_int(count: int, total: int) -> int:
    return int(round((count / total) * 100)) if total else 0


def _iter_dates(from_date: date, to_date: date) -> list[date]:
    days = []
    cursor = from_date
    while cursor <= to_date:
        days.append(cursor)
        cursor += timedelta(days=1)
    return days


def _service_category_from_name(
    service_name: Optional[str],
    service_category_by_name: dict[str, str],
) -> str:
    normalized = (service_name or "").strip().lower()
    if not normalized:
        return "Uncategorized"
    return service_category_by_name.get(normalized, "Uncategorized")


def _request_service_category(
    row: BookingRequest,
    service_catalog_by_id: dict,
    service_category_by_name: dict[str, str],
) -> str:
    if row.service_catalog_id in service_catalog_by_id:
        return service_catalog_by_id[row.service_catalog_id].category or "Uncategorized"
    return _service_category_from_name(row.service_name, service_category_by_name)


class ReportsService:
    def __init__(self, db: Session):
        self.db = db

    def get_overview(self, *, from_date: date, to_date: date) -> ReportsOverviewResponse:
        if from_date > to_date:
            raise ValueError("from_date cannot be later than to_date")

        start_dt = _to_utc_start(from_date)
        end_dt = _to_utc_end(to_date)
        previous_start = start_dt - (end_dt - start_dt) - timedelta(microseconds=1)
        previous_end = start_dt - timedelta(microseconds=1)

        all_techs = self.db.query(Technician).order_by(Technician.name.asc()).all()
        tech_by_id = {row.id: row for row in all_techs}
        all_dealerships = self.db.query(Dealership).order_by(Dealership.name.asc()).all()
        all_service_catalog = self.db.query(ServiceCatalog).all()
        service_catalog_by_id = {row.id: row for row in all_service_catalog}
        service_category_by_name = {
            (row.name or "").strip().lower(): (row.category or "Uncategorized")
            for row in all_service_catalog
            if (row.name or "").strip()
        }

        all_jobs = self.db.query(Job).all()
        jobs_in_range = [
            row
            for row in all_jobs
            if (created_at := _ensure_utc(row.created_at)) is not None and start_dt <= created_at <= end_dt
        ]
        completed_jobs_in_range = [
            row
            for row in all_jobs
            if (
                (completed_at := _job_completion_timestamp(row)) is not None
                and start_dt <= completed_at <= end_dt
            )
        ]

        pending_approval_rows = (
            self.db.query(Job, Dealership)
            .outerjoin(Dealership, Job.dealership_id == Dealership.id)
            .filter(Job.invoice_id.is_(None))
            .all()
        )
        pending_approval_jobs = sum(
            1
            for job, dealership in pending_approval_rows
            if (
                _normalize_job_status(job.status) == "Completed"
                and (completed_at := _job_completion_timestamp(job)) is not None
                and start_dt <= completed_at <= end_dt
                and _is_pending_approval_eligible(job, dealership)
            )
        )

        active_techs = [
            row for row in all_techs if (row.status or "").strip().lower() not in {"deactivated", "inactive"}
        ]
        busy_tech_ids = {
            row.assigned_tech_id
            for row in all_jobs
            if row.assigned_tech_id is not None
            and (row.status or "").strip().lower() in {"assigned", "in_progress", "delayed"}
        }
        technician_utilization = int(round((len(busy_tech_ids) / len(active_techs)) * 100)) if active_techs else 0

        completion_minutes = []
        for row in completed_jobs_in_range:
            completed_at = _ensure_utc(row.completed_at or row.updated_at)
            created_at = _ensure_utc(row.created_at)
            if created_at and completed_at and completed_at >= created_at:
                completion_minutes.append((completed_at - created_at).total_seconds() / 60)
        avg_completion_minutes = float(sum(completion_minutes) / len(completion_minutes)) if completion_minutes else 0.0

        assignment_minutes = []
        for row in jobs_in_range:
            if row.assigned_tech_id is None:
                continue
            created_at = _ensure_utc(row.created_at)
            assigned_at = _ensure_utc(row.updated_at)
            if created_at and assigned_at and assigned_at >= created_at:
                assignment_minutes.append((assigned_at - created_at).total_seconds() / 60)
        avg_assignment_minutes = float(sum(assignment_minutes) / len(assignment_minutes)) if assignment_minutes else 0.0

        invoices_in_range = (
            self.db.query(Invoice)
            .filter(Invoice.created_at >= start_dt, Invoice.created_at <= end_dt)
            .all()
        )
        invoices_previous_period = (
            self.db.query(Invoice)
            .filter(Invoice.created_at >= previous_start, Invoice.created_at <= previous_end)
            .all()
        )

        invoice_total = float(sum(float(row.total or 0) for row in invoices_in_range))
        previous_invoice_total = float(sum(float(row.total or 0) for row in invoices_previous_period))
        revenue_delta = invoice_total - previous_invoice_total

        kpis = ReportKpis(
            jobs_created=len(jobs_in_range),
            jobs_completed=len(completed_jobs_in_range),
            avg_completion_minutes=round(avg_completion_minutes, 2),
            technician_utilization=technician_utilization,
            invoice_total=round(invoice_total, 2),
            pending_approvals=pending_approval_jobs,
        )

        status_counts: dict[str, int] = defaultdict(int)
        urgency_counts: dict[str, int] = defaultdict(int)
        source_counts: dict[str, int] = defaultdict(int)
        jobs_by_category_counts: dict[str, int] = defaultdict(int)
        for row in jobs_in_range:
            status_counts[_normalize_job_status(row.status)] += 1
            urgency_counts[_job_urgency(row)] += 1
            source_counts[_job_source_channel(row)] += 1
            jobs_by_category_counts[_service_category_from_name(row.service_type, service_category_by_name)] += 1

        dispatch_total = len(jobs_in_range)
        dispatch_performance = [
            DispatchStatusRow(
                status=key,
                count=value,
                percentage=_percent_int(value, dispatch_total),
            )
            for key, value in sorted(status_counts.items(), key=lambda item: item[1], reverse=True)
        ]
        jobs_by_urgency = [
            DispatchStatusRow(
                status=key,
                count=value,
                percentage=_percent_int(value, dispatch_total),
            )
            for key, value in sorted(urgency_counts.items(), key=lambda item: item[1], reverse=True)
        ]

        invoice_state_totals: dict[str, dict[str, float]] = defaultdict(lambda: {"count": 0, "amount": 0.0})
        for row in invoices_in_range:
            state = _normalize_invoice_state(row.status)
            invoice_state_totals[state]["count"] += 1
            invoice_state_totals[state]["amount"] += float(row.total or 0)
        if pending_approval_jobs > 0:
            invoice_state_totals["Pending Approval"]["count"] += pending_approval_jobs
        invoice_performance = [
            InvoiceStatusRow(
                state=key,
                count=int(value["count"]),
                total_amount=round(float(value["amount"]), 2),
                is_critical=key.lower() in {"overdue", "failed", "pending approval"},
            )
            for key, value in sorted(invoice_state_totals.items(), key=lambda item: item[1]["count"], reverse=True)
        ]

        blocked_reasons = []
        if pending_approval_jobs > 0:
            blocked_reasons.append(
                InvoiceBlockedReasonRow(
                    reason="Pending admin approval or validation",
                    count=pending_approval_jobs,
                    percentage=100.0,
                )
            )
        invoice_metrics = InvoicePerformanceMetrics(
            total_invoice_value=round(invoice_total, 2),
            average_approval_turnaround_time="0m",
            blocked_reasons=blocked_reasons,
        )

        rejections_in_range = (
            self.db.query(JobRejection)
            .filter(JobRejection.rejected_at >= start_dt, JobRejection.rejected_at <= end_dt)
            .all()
        )
        rejection_count_by_tech: dict = defaultdict(int)
        for row in rejections_in_range:
            tech_id = getattr(row, "tech_id", None)
            if tech_id is not None:
                rejection_count_by_tech[tech_id] += 1

        refused_total = len(rejections_in_range)
        accepted_total = len(
            [
                row
                for row in jobs_in_range
                if row.assigned_tech_id is not None
                or _normalize_job_status(row.status) in {"In Progress", "Completed", "Delayed"}
            ]
        )
        acceptance_denominator = accepted_total + refused_total
        dispatch_overview = DispatchOverviewMetrics(
            average_time_to_assignment=_duration_label(avg_assignment_minutes),
            average_time_to_completion=_duration_label(avg_completion_minutes),
            accepted_rate=round((accepted_total / acceptance_denominator) * 100, 1) if acceptance_denominator else 0.0,
            refused_rate=round((refused_total / acceptance_denominator) * 100, 1) if acceptance_denominator else 0.0,
            jobs_by_urgency=jobs_by_urgency,
        )

        total_intake_records = len(jobs_in_range)
        intake_analytics = IntakeAnalyticsMetrics(
            total_intake_records=total_intake_records,
            conversion_rate=100.0 if total_intake_records else 0.0,
            average_time_to_job_creation="0m",
            source_channels=[
                IntakeChannelRow(
                    source_channel=key,
                    intake_records=value,
                    converted_jobs=value,
                    conversion_rate=100.0 if value else 0.0,
                )
                for key, value in sorted(source_counts.items(), key=lambda item: item[1], reverse=True)
            ],
            dismissed_reasons=[],
        )

        primary_jobs_by_invoice = _primary_job_by_invoice_id(self.db, [row.id for row in invoices_in_range])
        revenue_by_tech: dict = defaultdict(float)
        revenue_by_dealership: dict = defaultdict(float)
        invoice_totals_by_tech: dict = defaultdict(list)
        revenue_by_date: dict[date, float] = defaultdict(float)
        completed_revenue_by_date: dict[date, float] = defaultdict(float)
        revenue_by_category: dict[str, float] = defaultdict(float)
        completed_jobs_by_category_counts: dict[str, int] = defaultdict(int)
        completed_job_revenue = 0.0

        for row in completed_jobs_in_range:
            completed_jobs_by_category_counts[_service_category_from_name(row.service_type, service_category_by_name)] += 1

        for invoice in invoices_in_range:
            invoice_amount = float(invoice.total or 0)
            created_at = _ensure_utc(invoice.created_at)
            if created_at is not None:
                revenue_by_date[created_at.date()] += invoice_amount

            primary_job = primary_jobs_by_invoice.get(invoice.id)
            if primary_job is None:
                continue

            category = _service_category_from_name(primary_job.service_type, service_category_by_name)
            revenue_by_category[category] += invoice_amount
            if _normalize_job_status(primary_job.status) == "Completed":
                completed_job_revenue += invoice_amount
                if created_at is not None:
                    completed_revenue_by_date[created_at.date()] += invoice_amount
            if primary_job.assigned_tech_id is not None:
                revenue_by_tech[primary_job.assigned_tech_id] += invoice_amount
                invoice_totals_by_tech[primary_job.assigned_tech_id].append(invoice_amount)
            if primary_job.dealership_id is not None:
                revenue_by_dealership[primary_job.dealership_id] += invoice_amount

        jobs_by_tech: dict = defaultdict(list)
        for row in jobs_in_range:
            if row.assigned_tech_id is not None:
                jobs_by_tech[row.assigned_tech_id].append(row)

        completed_jobs_by_tech: dict = defaultdict(list)
        for row in completed_jobs_in_range:
            if row.assigned_tech_id is not None:
                completed_jobs_by_tech[row.assigned_tech_id].append(row)

        tech_rows: list[TechnicianPerformanceRow] = []
        for row in all_techs:
            tech_jobs = jobs_by_tech.get(row.id, [])
            completed = completed_jobs_by_tech.get(row.id, [])
            durations = []
            for item in completed:
                completed_at = _job_completion_timestamp(item)
                created_at = _ensure_utc(item.created_at)
                if created_at and completed_at and completed_at >= created_at:
                    durations.append((completed_at - created_at).total_seconds() / 60)
            avg_minutes = float(sum(durations) / len(durations)) if durations else 0.0
            delays = len([item for item in tech_jobs if (item.status or "").strip().lower() == "delayed"])
            refusals = rejection_count_by_tech.get(row.id, 0)
            total_actions = len(tech_jobs) + refusals
            refusal_rate = round((refusals / total_actions) * 100, 1) if total_actions else 0.0
            completion_rate = round((len(completed) / len(tech_jobs)) * 100, 1) if tech_jobs else 0.0
            tech_revenue = round(float(revenue_by_tech.get(row.id, 0.0)), 2)
            tech_work_minutes = sum(
                int(attendance.active_work_minutes or 0)
                for attendance in self.db.query(TechnicianAttendanceSession)
                .filter(
                    TechnicianAttendanceSession.technician_id == row.id,
                    TechnicianAttendanceSession.clock_in_at >= start_dt,
                    TechnicianAttendanceSession.clock_in_at <= end_dt,
                )
                .all()
            )
            tech_work_hours = round(_hours_label(tech_work_minutes), 2)

            tech_rows.append(
                TechnicianPerformanceRow(
                    id=str(row.id),
                    name=row.name,
                    jobs_assigned=len(tech_jobs),
                    jobs_completed=len(completed),
                    avg_completion_time=_duration_label(avg_minutes),
                    delays_count=delays,
                    refusals_count=refusals,
                    revenue_generated=tech_revenue,
                    refusal_rate=refusal_rate,
                    on_time_rate=completion_rate,
                    total_service_line_value=tech_revenue,
                    work_hours=tech_work_hours,
                )
            )
        tech_rows.sort(key=lambda item: item.name.lower())

        jobs_by_dealership: dict = defaultdict(list)
        for row in jobs_in_range:
            if row.dealership_id is not None:
                jobs_by_dealership[row.dealership_id].append(row)

        completed_jobs_by_dealership: dict = defaultdict(list)
        for row in completed_jobs_in_range:
            if row.dealership_id is not None:
                completed_jobs_by_dealership[row.dealership_id].append(row)

        dealership_rows: list[DealershipPerformanceRow] = []
        for row in all_dealerships:
            dealership_jobs = jobs_by_dealership.get(row.id, [])
            completed = completed_jobs_by_dealership.get(row.id, [])
            durations = []
            for item in completed:
                completed_at = _job_completion_timestamp(item)
                created_at = _ensure_utc(item.created_at)
                if created_at and completed_at and completed_at >= created_at:
                    durations.append((completed_at - created_at).total_seconds() / 60)
            avg_minutes = float(sum(durations) / len(durations)) if durations else 0.0
            service_counts: dict[str, int] = defaultdict(int)
            for item in dealership_jobs:
                service_counts[(item.service_type or "Unspecified").strip() or "Unspecified"] += 1
            top_services = [name for name, _ in sorted(service_counts.items(), key=lambda item: item[1], reverse=True)[:3]]
            delayed_count = len([item for item in dealership_jobs if (item.status or "").strip().lower() == "delayed"])
            sla_compliance = round(((len(completed) - delayed_count) / len(completed)) * 100, 1) if completed else 0.0

            dealership_rows.append(
                DealershipPerformanceRow(
                    id=str(row.id),
                    name=row.name,
                    jobs_created=len(dealership_jobs),
                    jobs_completed=len(completed),
                    avg_resolution_time=_duration_label(avg_minutes),
                    invoice_total=round(float(revenue_by_dealership.get(row.id, 0.0)), 2),
                    attention_flags=0,
                    job_volume=len(dealership_jobs),
                    most_requested_service_types=top_services,
                    avg_job_completion_time=_duration_label(avg_minutes),
                    sla_compliance_rate=sla_compliance,
                )
            )
        dealership_rows.sort(key=lambda item: item.invoice_total, reverse=True)

        active_tech_count = len(active_techs)
        jobs_by_weekday: dict[int, int] = defaultdict(int)
        jobs_by_hour: dict[int, int] = defaultdict(int)
        for row in jobs_in_range:
            created_at = _ensure_utc(row.created_at)
            if created_at is None:
                continue
            jobs_by_weekday[created_at.weekday()] += 1
            jobs_by_hour[created_at.hour] += 1
        weekday_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        utilization_by_day = [
            CapacityUtilizationRow(
                day_of_week=weekday_names[index],
                jobs_count=jobs_by_weekday.get(index, 0),
                technician_utilization=round((jobs_by_weekday.get(index, 0) / active_tech_count) * 100, 1) if active_tech_count else 0.0,
                jobs_per_technician=round(jobs_by_weekday.get(index, 0) / active_tech_count, 2) if active_tech_count else 0.0,
            )
            for index in range(7)
        ]
        capacity_planning = CapacityPlanningMetrics(
            utilization_by_day=utilization_by_day,
            peak_demand_windows=[
                PeakDemandWindowRow(hour=f"{hour:02d}:00", jobs_count=count)
                for hour, count in sorted(jobs_by_hour.items(), key=lambda item: item[1], reverse=True)[:6]
            ],
            jobs_per_technician_trend=utilization_by_day,
            understaffed_periods=[
                UnderstaffedPeriodRow(
                    period=row.day_of_week,
                    jobs_count=row.jobs_count,
                    technicians_available=active_tech_count,
                    gap=max(0, row.jobs_count - active_tech_count),
                )
                for row in utilization_by_day
                if active_tech_count and row.jobs_count > active_tech_count
            ],
        )

        previous_primary_jobs = _primary_job_by_invoice_id(self.db, [row.id for row in invoices_previous_period])
        previous_revenue_by_tech: dict = defaultdict(float)
        for invoice in invoices_previous_period:
            primary_job = previous_primary_jobs.get(invoice.id)
            if primary_job is None or primary_job.assigned_tech_id is None:
                continue
            previous_revenue_by_tech[primary_job.assigned_tech_id] += float(invoice.total or 0)

        invoicing_detail_rows: list[InvoicingDetailRow] = []
        for tech_id, approved_amount in revenue_by_tech.items():
            invoices_for_tech = invoice_totals_by_tech.get(tech_id, [])
            average_invoice = (sum(invoices_for_tech) / len(invoices_for_tech)) if invoices_for_tech else 0.0
            previous_amount = previous_revenue_by_tech.get(tech_id, 0.0)
            growth_percentage = None
            if previous_amount > 0:
                growth_percentage = ((approved_amount - previous_amount) / previous_amount) * 100
            elif approved_amount > 0:
                growth_percentage = 100.0

            tech_name = tech_by_id.get(tech_id).name if tech_id in tech_by_id else "Unassigned"
            invoicing_detail_rows.append(
                InvoicingDetailRow(
                    technician=tech_name,
                    approved_amount=round(float(approved_amount), 2),
                    average_invoice=round(float(average_invoice), 2),
                    growth_percentage=round(float(growth_percentage), 2) if growth_percentage is not None else None,
                )
            )
        invoicing_detail_rows.sort(key=lambda item: item.approved_amount, reverse=True)

        revenue_metrics = RevenueMetrics(
            total_revenue=round(invoice_total, 2),
            revenue_from_completed_jobs=round(completed_job_revenue, 2),
            pending_revenue_from_unpaid_invoices=round(
                sum(
                    float(row.total or 0)
                    for row in invoices_in_range
                    if _normalize_invoice_state(row.status).lower() in PENDING_PAYMENT_STATES
                ),
                2,
            ),
            revenue_by_date=[
                RevenueByDateRow(
                    date=cursor.isoformat(),
                    total_revenue=round(revenue_by_date.get(cursor, 0.0), 2),
                    completed_job_revenue=round(completed_revenue_by_date.get(cursor, 0.0), 2),
                )
                for cursor in _iter_dates(from_date, to_date)
            ],
            revenue_by_service_category=[
                RevenueByCategoryRow(
                    category=category,
                    revenue=round(amount, 2),
                    completed_jobs=completed_jobs_by_category_counts.get(category, 0),
                )
                for category, amount in sorted(revenue_by_category.items(), key=lambda item: item[1], reverse=True)
            ],
        )

        job_completion_analytics = JobCompletionMetrics(
            total_jobs=len(jobs_in_range),
            completed_jobs=status_counts.get("Completed", 0),
            pending_jobs=sum(status_counts.get(key, 0) for key in ["Pending", "Pending Review", "Pending Admin Confirmation", "Scheduled"]),
            in_progress_jobs=status_counts.get("In Progress", 0) + status_counts.get("Delayed", 0),
            cancelled_jobs=status_counts.get("Cancelled", 0),
            average_job_completion_time=_duration_label(avg_completion_minutes),
            status_breakdown=dispatch_performance,
        )

        booking_requests_in_range = (
            self.db.query(BookingRequest)
            .filter(BookingRequest.created_at >= start_dt, BookingRequest.created_at <= end_dt)
            .all()
        )
        request_category_counts: dict[str, dict[str, int]] = defaultdict(lambda: {"total": 0, "converted": 0})
        converted_request_count = 0
        new_request_count = 0
        cancelled_or_rejected_count = 0
        for row in booking_requests_in_range:
            normalized_status = _normalize_request_status(row.status)
            category = _request_service_category(row, service_catalog_by_id, service_category_by_name)
            request_category_counts[category]["total"] += 1
            if normalized_status in REQUEST_NEW_STATUSES:
                new_request_count += 1
            if normalized_status in REQUEST_CONVERTED_STATUSES:
                converted_request_count += 1
                request_category_counts[category]["converted"] += 1
            if normalized_status in {"cancelled", "rejected"}:
                cancelled_or_rejected_count += 1

        customer_request_analytics = CustomerRequestAnalyticsMetrics(
            total_customer_requests=len(booking_requests_in_range),
            new_requests=new_request_count,
            converted_requests=converted_request_count,
            cancelled_or_rejected_requests=cancelled_or_rejected_count,
            requests_by_service_category=[
                CustomerRequestCategoryRow(
                    category=category,
                    total_requests=counts["total"],
                    converted_requests=counts["converted"],
                )
                for category, counts in sorted(
                    request_category_counts.items(),
                    key=lambda item: (item[1]["total"], item[1]["converted"]),
                    reverse=True,
                )
            ],
        )

        attendance_sessions_in_range = (
            self.db.query(TechnicianAttendanceSession)
            .filter(TechnicianAttendanceSession.clock_in_at >= start_dt, TechnicianAttendanceSession.clock_in_at <= end_dt)
            .all()
        )
        current_attendance_sessions = {
            row.technician_id: row
            for row in self.db.query(TechnicianAttendanceSession)
            .filter(TechnicianAttendanceSession.status.in_(list(ACTIVE_ATTENDANCE_STATUSES)))
            .all()
        }

        attendance_by_date_agg: dict[date, dict[str, float]] = defaultdict(
            lambda: {"clock_ins": 0, "clock_outs": 0, "work_minutes": 0.0, "break_minutes": 0.0}
        )
        attendance_by_tech: dict = defaultdict(
            lambda: {"clock_ins": 0, "clock_outs": 0, "work_minutes": 0.0, "break_minutes": 0.0}
        )
        for row in attendance_sessions_in_range:
            clock_in_at = _ensure_utc(row.clock_in_at)
            if clock_in_at is None:
                continue
            day = clock_in_at.date()
            attendance_by_date_agg[day]["clock_ins"] += 1
            attendance_by_date_agg[day]["work_minutes"] += float(row.active_work_minutes or 0)
            attendance_by_date_agg[day]["break_minutes"] += float(row.break_minutes or 0)
            if row.clock_out_at is not None:
                attendance_by_date_agg[day]["clock_outs"] += 1

            attendance_by_tech[row.technician_id]["clock_ins"] += 1
            attendance_by_tech[row.technician_id]["work_minutes"] += float(row.active_work_minutes or 0)
            attendance_by_tech[row.technician_id]["break_minutes"] += float(row.break_minutes or 0)
            if row.clock_out_at is not None:
                attendance_by_tech[row.technician_id]["clock_outs"] += 1

        technician_attendance_rows: list[AttendanceTechnicianRow] = []
        attendance_status_counts: dict[str, int] = defaultdict(int)
        for tech_id, metrics in attendance_by_tech.items():
            technician = tech_by_id.get(tech_id)
            status = _normalize_attendance_status(
                current_attendance_sessions.get(tech_id).status if tech_id in current_attendance_sessions else "clocked_out"
            )
            attendance_status_counts[status] += 1
            technician_attendance_rows.append(
                AttendanceTechnicianRow(
                    technician_id=str(tech_id),
                    technician_name=(technician.name if technician is not None else "Unknown Technician"),
                    clock_in_records=int(metrics["clock_ins"]),
                    clock_out_records=int(metrics["clock_outs"]),
                    total_working_hours=_hours_label(int(metrics["work_minutes"])),
                    break_duration_hours=_hours_label(int(metrics["break_minutes"])),
                    attendance_status=status,
                )
            )
        technician_attendance_rows.sort(key=lambda item: item.technician_name.lower())

        attendance_metrics = AttendanceMetrics(
            clock_in_records=len(attendance_sessions_in_range),
            clock_out_records=sum(1 for row in attendance_sessions_in_range if row.clock_out_at is not None),
            total_working_hours=_hours_label(sum(int(row.active_work_minutes or 0) for row in attendance_sessions_in_range)),
            break_duration_hours=_hours_label(sum(int(row.break_minutes or 0) for row in attendance_sessions_in_range)),
            attendance_status_breakdown=[
                DispatchStatusRow(
                    status=status,
                    count=count,
                    percentage=_percent_int(count, len(technician_attendance_rows)),
                )
                for status, count in sorted(attendance_status_counts.items(), key=lambda item: item[1], reverse=True)
            ],
            attendance_by_date=[
                AttendanceDailyRow(
                    date=cursor.isoformat(),
                    clock_ins=int(attendance_by_date_agg.get(cursor, {}).get("clock_ins", 0)),
                    clock_outs=int(attendance_by_date_agg.get(cursor, {}).get("clock_outs", 0)),
                    total_working_hours=_hours_label(int(attendance_by_date_agg.get(cursor, {}).get("work_minutes", 0))),
                    break_duration_hours=_hours_label(int(attendance_by_date_agg.get(cursor, {}).get("break_minutes", 0))),
                )
                for cursor in _iter_dates(from_date, to_date)
            ],
            technician_attendance=technician_attendance_rows,
        )

        service_category_rows: list[ServiceCategoryAnalyticsRow] = []
        all_service_categories = set(jobs_by_category_counts) | set(request_category_counts) | set(revenue_by_category)
        for category in all_service_categories:
            service_category_rows.append(
                ServiceCategoryAnalyticsRow(
                    category=category,
                    jobs_count=jobs_by_category_counts.get(category, 0),
                    completed_jobs_count=completed_jobs_by_category_counts.get(category, 0),
                    requests_count=request_category_counts.get(category, {}).get("total", 0),
                    revenue=round(revenue_by_category.get(category, 0.0), 2),
                )
            )
        service_category_rows.sort(key=lambda item: (item.revenue, item.jobs_count, item.requests_count), reverse=True)
        service_category_analytics = ServiceCategoryAnalyticsMetrics(categories=service_category_rows)

        payment_status_rows: list[PaymentStatusRow] = [
            PaymentStatusRow(
                status=state,
                count=int(values["count"]),
                amount=round(float(values["amount"]), 2),
            )
            for state, values in sorted(invoice_state_totals.items(), key=lambda item: item[1]["amount"], reverse=True)
            if state != "Pending Approval"
        ]
        total_paid_amount = round(
            sum(float(row.total or 0) for row in invoices_in_range if _normalize_invoice_state(row.status) == "Paid"),
            2,
        )
        pending_amount = round(
            sum(
                float(row.total or 0)
                for row in invoices_in_range
                if _normalize_invoice_state(row.status).lower() in PENDING_PAYMENT_STATES
            ),
            2,
        )
        failed_amount = round(
            sum(float(row.total or 0) for row in invoices_in_range if _normalize_invoice_state(row.status) == "Cancelled"),
            2,
        )
        payment_breakdown = [
            PaymentBreakdownRow(label="Paid", count=sum(1 for row in invoices_in_range if _normalize_invoice_state(row.status) == "Paid"), amount=total_paid_amount, kind="status"),
            PaymentBreakdownRow(label="Pending", count=sum(1 for row in invoices_in_range if _normalize_invoice_state(row.status).lower() in PENDING_PAYMENT_STATES), amount=pending_amount, kind="status"),
            PaymentBreakdownRow(label="Failed / Cancelled", count=sum(1 for row in invoices_in_range if _normalize_invoice_state(row.status) == "Cancelled"), amount=failed_amount, kind="status"),
        ]
        payment_metrics = PaymentMetrics(
            total_payments_received=sum(1 for row in invoices_in_range if _normalize_invoice_state(row.status) == "Paid"),
            total_paid_amount=total_paid_amount,
            pending_payments=sum(
                1 for row in invoices_in_range if _normalize_invoice_state(row.status).lower() in PENDING_PAYMENT_STATES
            ),
            failed_payments=sum(1 for row in invoices_in_range if _normalize_invoice_state(row.status) == "Cancelled"),
            payment_amount_by_method=[
                PaymentMethodRow(method="Unspecified", amount=total_paid_amount)
            ] if total_paid_amount > 0 else [],
            payment_status=payment_status_rows,
            payment_breakdown=payment_breakdown,
        )

        return ReportsOverviewResponse(
            generated_at=datetime.now(UTC),
            from_date=start_dt,
            to_date=end_dt,
            current_period_invoice_count=len(invoices_in_range),
            revenue_delta=round(revenue_delta, 2),
            kpis=kpis,
            dispatch_overview=dispatch_overview,
            intake_analytics=intake_analytics,
            invoice_metrics=invoice_metrics,
            dispatch_performance=dispatch_performance,
            invoice_performance=invoice_performance,
            technician_performance=tech_rows,
            dealership_performance=dealership_rows,
            capacity_planning=capacity_planning,
            invoicing_detail_rows=invoicing_detail_rows,
            revenue_metrics=revenue_metrics,
            job_completion_analytics=job_completion_analytics,
            attendance_metrics=attendance_metrics,
            customer_request_analytics=customer_request_analytics,
            service_category_analytics=service_category_analytics,
            payment_metrics=payment_metrics,
        )

from __future__ import annotations

from collections import defaultdict
from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal, InvalidOperation
from typing import Iterable, Optional

from sqlalchemy.orm import Session

from ..models.dealership import Dealership
from ..models.invoice import Invoice
from ..models.job import Job
from ..models.job_rejection import JobRejection
from ..models.technician import Technician
from ..schemas.reporting import (
    CapacityPlanningMetrics,
    CapacityUtilizationRow,
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
    PeakDemandWindowRow,
    ReportKpis,
    ReportsOverviewResponse,
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
        jobs_in_range = (
            self.db.query(Job)
            .filter(Job.created_at >= start_dt, Job.created_at <= end_dt)
            .all()
        )
        completed_jobs_in_range = [
            row
            for row in self.db.query(Job).all()
            if (
                (completed_at := _job_completion_timestamp(row)) is not None
                and completed_at >= start_dt
                and completed_at <= end_dt
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
                and completed_at >= start_dt
                and completed_at <= end_dt
                and _is_pending_approval_eligible(job, dealership)
            )
        )

        active_techs = [
            row for row in all_techs if (row.status or "").strip().lower() not in {"deactivated", "inactive"}
        ]
        busy_tech_ids = {
            row.assigned_tech_id
            for row in self.db.query(Job)
            .filter(Job.assigned_tech_id.is_not(None))
            .filter(Job.status.in_(["ASSIGNED", "IN_PROGRESS", "DELAYED", "assigned", "in_progress", "delayed"]))
            .all()
            if row.assigned_tech_id is not None
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
        for row in jobs_in_range:
            status_counts[_normalize_job_status(row.status)] += 1
        dispatch_total = len(jobs_in_range)
        dispatch_performance = [
            DispatchStatusRow(
                status=key,
                count=value,
                percentage=int(round((value / dispatch_total) * 100)) if dispatch_total else 0,
            )
            for key, value in sorted(status_counts.items(), key=lambda item: item[1], reverse=True)
        ]

        urgency_counts: dict[str, int] = defaultdict(int)
        source_counts: dict[str, int] = defaultdict(int)
        for row in jobs_in_range:
            urgency_counts[_job_urgency(row)] += 1
            source_counts[_job_source_channel(row)] += 1

        jobs_by_urgency = [
            DispatchStatusRow(
                status=key,
                count=value,
                percentage=int(round((value / dispatch_total) * 100)) if dispatch_total else 0,
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
        for invoice in invoices_in_range:
            primary_job = primary_jobs_by_invoice.get(invoice.id)
            if primary_job is None:
                continue
            amount = float(invoice.total or 0)
            if primary_job.assigned_tech_id is not None:
                revenue_by_tech[primary_job.assigned_tech_id] += amount
                invoice_totals_by_tech[primary_job.assigned_tech_id].append(amount)
            if primary_job.dealership_id is not None:
                revenue_by_dealership[primary_job.dealership_id] += amount

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
            on_time_rate = round(((len(completed) - delays) / len(completed)) * 100, 1) if completed else 0.0
            tech_revenue = round(float(revenue_by_tech.get(row.id, 0.0)), 2)

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
                    on_time_rate=on_time_rate,
                    total_service_line_value=tech_revenue,
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
        )

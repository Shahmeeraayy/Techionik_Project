from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class ReportKpis(BaseModel):
    jobs_created: int
    jobs_completed: int
    avg_completion_minutes: float
    technician_utilization: int
    invoice_total: float
    pending_approvals: int


class DispatchStatusRow(BaseModel):
    status: str
    count: int
    percentage: int


class DispatchOverviewMetrics(BaseModel):
    average_time_to_assignment: str
    average_time_to_completion: str
    accepted_rate: float
    refused_rate: float
    jobs_by_urgency: List[DispatchStatusRow]


class IntakeChannelRow(BaseModel):
    source_channel: str
    intake_records: int
    converted_jobs: int
    conversion_rate: float


class IntakeDismissedReasonRow(BaseModel):
    reason: str
    count: int
    percentage: float


class IntakeAnalyticsMetrics(BaseModel):
    total_intake_records: int
    conversion_rate: float
    average_time_to_job_creation: str
    source_channels: List[IntakeChannelRow]
    dismissed_reasons: List[IntakeDismissedReasonRow]


class InvoiceStatusRow(BaseModel):
    state: str
    count: int
    total_amount: float
    is_critical: bool = False


class InvoiceBlockedReasonRow(BaseModel):
    reason: str
    count: int
    percentage: float


class InvoicePerformanceMetrics(BaseModel):
    total_invoice_value: float
    average_approval_turnaround_time: str
    blocked_reasons: List[InvoiceBlockedReasonRow]


class TechnicianPerformanceRow(BaseModel):
    id: str
    name: str
    jobs_assigned: int
    jobs_completed: int
    avg_completion_time: str
    delays_count: int
    refusals_count: int
    revenue_generated: float
    refusal_rate: float = 0
    on_time_rate: float = 0
    total_service_line_value: float = 0


class DealershipPerformanceRow(BaseModel):
    id: str
    name: str
    jobs_created: int
    jobs_completed: int
    avg_resolution_time: str
    invoice_total: float
    attention_flags: int
    job_volume: int = 0
    most_requested_service_types: List[str] = []
    avg_job_completion_time: str = "0m"
    sla_compliance_rate: float = 0


class CapacityUtilizationRow(BaseModel):
    day_of_week: str
    jobs_count: int
    technician_utilization: float
    jobs_per_technician: float


class PeakDemandWindowRow(BaseModel):
    hour: str
    jobs_count: int


class UnderstaffedPeriodRow(BaseModel):
    period: str
    jobs_count: int
    technicians_available: int
    gap: int


class CapacityPlanningMetrics(BaseModel):
    utilization_by_day: List[CapacityUtilizationRow]
    peak_demand_windows: List[PeakDemandWindowRow]
    jobs_per_technician_trend: List[CapacityUtilizationRow]
    understaffed_periods: List[UnderstaffedPeriodRow]


class InvoicingDetailRow(BaseModel):
    technician: str
    approved_amount: float
    average_invoice: float
    growth_percentage: Optional[float] = None


class ReportsOverviewResponse(BaseModel):
    generated_at: datetime
    from_date: datetime
    to_date: datetime
    current_period_invoice_count: int
    revenue_delta: float
    kpis: ReportKpis
    dispatch_overview: DispatchOverviewMetrics
    intake_analytics: IntakeAnalyticsMetrics
    invoice_metrics: InvoicePerformanceMetrics
    dispatch_performance: List[DispatchStatusRow]
    invoice_performance: List[InvoiceStatusRow]
    technician_performance: List[TechnicianPerformanceRow]
    dealership_performance: List[DealershipPerformanceRow]
    capacity_planning: CapacityPlanningMetrics
    invoicing_detail_rows: List[InvoicingDetailRow]

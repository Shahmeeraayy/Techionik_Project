from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


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
    jobs_by_urgency: List[DispatchStatusRow] = Field(default_factory=list)


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
    source_channels: List[IntakeChannelRow] = Field(default_factory=list)
    dismissed_reasons: List[IntakeDismissedReasonRow] = Field(default_factory=list)


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
    blocked_reasons: List[InvoiceBlockedReasonRow] = Field(default_factory=list)


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
    work_hours: float = 0


class DealershipPerformanceRow(BaseModel):
    id: str
    name: str
    jobs_created: int
    jobs_completed: int
    avg_resolution_time: str
    invoice_total: float
    attention_flags: int
    job_volume: int = 0
    most_requested_service_types: List[str] = Field(default_factory=list)
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
    utilization_by_day: List[CapacityUtilizationRow] = Field(default_factory=list)
    peak_demand_windows: List[PeakDemandWindowRow] = Field(default_factory=list)
    jobs_per_technician_trend: List[CapacityUtilizationRow] = Field(default_factory=list)
    understaffed_periods: List[UnderstaffedPeriodRow] = Field(default_factory=list)


class InvoicingDetailRow(BaseModel):
    technician: str
    approved_amount: float
    average_invoice: float
    growth_percentage: Optional[float] = None


class RevenueByDateRow(BaseModel):
    date: str
    total_revenue: float
    completed_job_revenue: float


class RevenueByCategoryRow(BaseModel):
    category: str
    revenue: float
    completed_jobs: int = 0


class RevenueMetrics(BaseModel):
    total_revenue: float
    revenue_from_completed_jobs: float
    pending_revenue_from_unpaid_invoices: float
    revenue_by_date: List[RevenueByDateRow] = Field(default_factory=list)
    revenue_by_service_category: List[RevenueByCategoryRow] = Field(default_factory=list)


class JobCompletionMetrics(BaseModel):
    total_jobs: int
    completed_jobs: int
    pending_jobs: int
    in_progress_jobs: int
    cancelled_jobs: int
    average_job_completion_time: str
    status_breakdown: List[DispatchStatusRow] = Field(default_factory=list)


class AttendanceDailyRow(BaseModel):
    date: str
    clock_ins: int
    clock_outs: int
    total_working_hours: float
    break_duration_hours: float


class AttendanceTechnicianRow(BaseModel):
    technician_id: str
    technician_name: str
    clock_in_records: int
    clock_out_records: int
    total_working_hours: float
    break_duration_hours: float
    attendance_status: str


class AttendanceMetrics(BaseModel):
    clock_in_records: int
    clock_out_records: int
    total_working_hours: float
    break_duration_hours: float
    attendance_status_breakdown: List[DispatchStatusRow] = Field(default_factory=list)
    attendance_by_date: List[AttendanceDailyRow] = Field(default_factory=list)
    technician_attendance: List[AttendanceTechnicianRow] = Field(default_factory=list)


class CustomerRequestCategoryRow(BaseModel):
    category: str
    total_requests: int
    converted_requests: int


class CustomerRequestAnalyticsMetrics(BaseModel):
    total_customer_requests: int
    new_requests: int
    converted_requests: int
    cancelled_or_rejected_requests: int
    requests_by_service_category: List[CustomerRequestCategoryRow] = Field(default_factory=list)


class ServiceCategoryAnalyticsRow(BaseModel):
    category: str
    jobs_count: int
    completed_jobs_count: int
    requests_count: int
    revenue: float


class ServiceCategoryAnalyticsMetrics(BaseModel):
    categories: List[ServiceCategoryAnalyticsRow] = Field(default_factory=list)


class PaymentMethodRow(BaseModel):
    method: str
    amount: float


class PaymentBreakdownRow(BaseModel):
    label: str
    count: int
    amount: float
    kind: str = "status"


class PaymentStatusRow(BaseModel):
    status: str
    count: int
    amount: float


class PaymentMetrics(BaseModel):
    total_payments_received: int
    total_paid_amount: float
    pending_payments: int
    failed_payments: int
    payment_amount_by_method: List[PaymentMethodRow] = Field(default_factory=list)
    payment_status: List[PaymentStatusRow] = Field(default_factory=list)
    payment_breakdown: List[PaymentBreakdownRow] = Field(default_factory=list)


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
    dispatch_performance: List[DispatchStatusRow] = Field(default_factory=list)
    invoice_performance: List[InvoiceStatusRow] = Field(default_factory=list)
    technician_performance: List[TechnicianPerformanceRow] = Field(default_factory=list)
    dealership_performance: List[DealershipPerformanceRow] = Field(default_factory=list)
    capacity_planning: CapacityPlanningMetrics
    invoicing_detail_rows: List[InvoicingDetailRow] = Field(default_factory=list)
    revenue_metrics: RevenueMetrics
    job_completion_analytics: JobCompletionMetrics
    attendance_metrics: AttendanceMetrics
    customer_request_analytics: CustomerRequestAnalyticsMetrics
    service_category_analytics: ServiceCategoryAnalyticsMetrics
    payment_metrics: PaymentMetrics

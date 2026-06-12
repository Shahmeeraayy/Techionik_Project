import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import {
  Activity,
  Calendar,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  CreditCard,
  Download,
  FileBarChart,
  ReceiptText,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { exportArrayData, type ExportFormat, type ExportRow } from '@/lib/export';
import {
  fetchAdminReportsOverview,
  getStoredAdminToken,
  type BackendDispatchStatusRow,
  type BackendInvoiceStatusRow,
  type BackendPaymentBreakdownRow,
  type BackendReportsOverview,
  type BackendServiceCategoryAnalyticsRow,
  type BackendTechnicianPerformanceRow,
} from '@/lib/backend-api';
import { cn } from '@/lib/utils';

type QuickRange = 'today' | 'this_week' | 'this_month' | 'last_month' | 'this_quarter' | 'this_year';
type ReportTab =
  | 'overview'
  | 'revenue'
  | 'jobs'
  | 'technicians'
  | 'attendance'
  | 'invoices'
  | 'requests'
  | 'services'
  | 'payments';

const ADMIN_REFRESH_EVENT = 'sm-dispatch:admin-refresh';
const QUICK_RANGE_LABEL: Record<QuickRange, string> = {
  today: 'Today',
  this_week: 'This Week',
  this_month: 'This Month',
  last_month: 'Last Month',
  this_quarter: 'This Quarter',
  this_year: 'This Year',
};
const EXPORT_FORMAT_LABEL: Record<ExportFormat, string> = {
  csv: 'CSV',
  excel: 'Excel',
  pdf: 'PDF',
};
const CHART_COLORS = ['#06b6d4', '#22c55e', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6', '#f97316'];

const numberFmt = new Intl.NumberFormat('en-US');
const percentFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const currencyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const hourFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const sectionCardClass =
  'overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,24,39,0.96),rgba(6,17,29,0.96))] shadow-[0_24px_80px_rgba(0,0,0,0.28)]';
const sectionHeaderClass =
  'border-b border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0))] p-6';
const reportDarkInputStyle: CSSProperties = {
  background: '#0b1424',
  backgroundImage: 'none',
  color: '#f8fbff',
};

function metricCardClass(tone: 'cyan' | 'emerald' | 'amber' | 'violet' | 'rose' | 'slate'): string {
  return cn(
    'overflow-hidden rounded-[24px] border shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
    tone === 'cyan' && 'border-cyan-400/15 bg-[linear-gradient(180deg,rgba(12,36,55,0.96),rgba(8,24,39,0.96))]',
    tone === 'emerald' && 'border-emerald-400/15 bg-[linear-gradient(180deg,rgba(10,37,45,0.96),rgba(7,25,31,0.96))]',
    tone === 'amber' && 'border-amber-400/15 bg-[linear-gradient(180deg,rgba(41,28,15,0.94),rgba(27,18,10,0.96))]',
    tone === 'violet' && 'border-violet-400/15 bg-[linear-gradient(180deg,rgba(30,23,49,0.96),rgba(18,16,33,0.96))]',
    tone === 'rose' && 'border-rose-400/15 bg-[linear-gradient(180deg,rgba(42,16,25,0.96),rgba(28,15,23,0.96))]',
    tone === 'slate' && 'border-white/10 bg-[linear-gradient(180deg,rgba(18,28,43,0.96),rgba(11,18,30,0.96))]',
  );
}

function metricIconClass(tone: 'cyan' | 'emerald' | 'amber' | 'violet' | 'rose' | 'slate'): string {
  return cn(
    'rounded-2xl border p-3',
    tone === 'cyan' && 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100',
    tone === 'emerald' && 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100',
    tone === 'amber' && 'border-amber-300/20 bg-amber-300/10 text-amber-100',
    tone === 'violet' && 'border-violet-300/20 bg-violet-300/10 text-violet-100',
    tone === 'rose' && 'border-rose-300/20 bg-rose-300/10 text-rose-100',
    tone === 'slate' && 'border-white/10 bg-white/[0.06] text-slate-100',
  );
}

function toDateInputValue(value: Date): string {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDateInput(value: string): Date {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function resolveQuickRange(range: QuickRange): { fromDate: string; toDate: string } {
  const now = new Date();
  const to = new Date(now);
  to.setHours(0, 0, 0, 0);

  const from = new Date(to);
  if (range === 'today') {
    return { fromDate: toDateInputValue(from), toDate: toDateInputValue(to) };
  }
  if (range === 'this_week') {
    const day = from.getDay() || 7;
    from.setDate(from.getDate() - day + 1);
  } else if (range === 'this_month') {
    from.setDate(1);
  } else if (range === 'last_month') {
    from.setMonth(from.getMonth() - 1, 1);
    to.setDate(0);
  } else if (range === 'this_quarter') {
    const quarterStartMonth = Math.floor(from.getMonth() / 3) * 3;
    from.setMonth(quarterStartMonth, 1);
  } else if (range === 'this_year') {
    from.setMonth(0, 1);
  }

  return {
    fromDate: toDateInputValue(from),
    toDate: toDateInputValue(to),
  };
}

function formatShortDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function statusBadgeTone(row: BackendInvoiceStatusRow): string {
  if (row.is_critical) {
    return 'border-orange-300/20 bg-orange-300/10 text-orange-100';
  }
  if (row.state.toLowerCase() === 'paid') {
    return 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100';
  }
  if (row.state.toLowerCase() === 'sent') {
    return 'border-blue-300/20 bg-blue-300/10 text-blue-100';
  }
  return 'border-white/10 bg-[rgba(255,255,255,0.04)] text-slate-100';
}

function dispatchBadgeTone(row: BackendDispatchStatusRow): string {
  const normalized = row.status.toLowerCase();
  if (normalized === 'completed' || normalized === 'clocked in') {
    return 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100';
  }
  if (normalized === 'delayed' || normalized === 'on break') {
    return 'border-orange-300/20 bg-orange-300/10 text-orange-100';
  }
  if (normalized === 'cancelled') {
    return 'border-red-300/20 bg-red-300/10 text-red-100';
  }
  return 'border-white/10 bg-[rgba(255,255,255,0.04)] text-slate-100';
}

function EmptyReportState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-[rgba(255,255,255,0.025)] px-4 py-4">
      <div className="flex items-start gap-3">
        <div className="rounded-xl border border-cyan-300/15 bg-cyan-300/10 p-2 text-cyan-100">
          <Search className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>
          {action ? <div className="mt-3 flex flex-wrap gap-2">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}

function ChartPanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card className={sectionCardClass}>
      <div className={sectionHeaderClass}>
        <h2 className="text-base font-semibold text-slate-950 dark:text-white">{title}</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{description}</p>
      </div>
      <div className="p-6 pt-5">{children}</div>
    </Card>
  );
}

function MetricCard({
  label,
  value,
  supporting,
  tone,
  icon: Icon,
  loading,
}: {
  label: string;
  value: string;
  supporting: string;
  tone: 'cyan' | 'emerald' | 'amber' | 'violet' | 'rose' | 'slate';
  icon: typeof Activity;
  loading: boolean;
}) {
  return (
    <Card className={metricCardClass(tone)}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{label}</p>
            {loading ? (
              <Skeleton className="mt-3 h-8 w-28 bg-white/10" />
            ) : (
              <div className="mt-3 text-[2.05rem] font-semibold leading-none tracking-[-0.06em] text-white">{value}</div>
            )}
            <p className="text-sm text-slate-300">{supporting}</p>
          </div>
          <div className={metricIconClass(tone)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function ReportsPage() {
  const [activeReportTab, setActiveReportTab] = useState<ReportTab>('overview');
  const [quickRange, setQuickRange] = useState<QuickRange>('this_week');
  const [fromDate, setFromDate] = useState<string>(() => resolveQuickRange('this_week').fromDate);
  const [toDate, setToDate] = useState<string>(() => resolveQuickRange('this_week').toDate);
  const [technicianFilter, setTechnicianFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [requestFilter, setRequestFilter] = useState('');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('excel');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [overview, setOverview] = useState<BackendReportsOverview | null>(null);

  const fetchOverview = async (params: { fromDate: string; toDate: string }) => {
    setLoading(true);
    setError(null);
    try {
      const adminToken = getStoredAdminToken();
      if (!adminToken) {
        setOverview(null);
        setError('Admin session missing. Please login again.');
        return;
      }

      const payload = await fetchAdminReportsOverview(adminToken, {
        from_date: params.fromDate,
        to_date: params.toDate,
      });
      setOverview(payload);
      setLastUpdated(new Date());
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load reports.');
      setOverview(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchOverview({ fromDate, toDate });
  }, []);

  const canRunRange = useMemo(() => {
    if (!fromDate || !toDate) return false;
    return parseDateInput(fromDate).getTime() <= parseDateInput(toDate).getTime();
  }, [fromDate, toDate]);

  const activeRangeLabel = useMemo(() => {
    if (!fromDate || !toDate) return '--';
    const from = parseDateInput(fromDate);
    const to = parseDateInput(toDate);
    return `${from.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - ${to.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }, [fromDate, toDate]);

  const handleQuickRangeChange = (next: QuickRange) => {
    setQuickRange(next);
    const resolved = resolveQuickRange(next);
    setFromDate(resolved.fromDate);
    setToDate(resolved.toDate);
    void fetchOverview(resolved);
  };

  const handleRefresh = () => {
    if (!canRunRange) {
      setError('Start date must be on or before end date.');
      return;
    }
    void fetchOverview({ fromDate, toDate });
  };

  useEffect(() => {
    const handleAdminRefresh = () => {
      if (!canRunRange) return;
      void fetchOverview({ fromDate, toDate });
    };
    window.addEventListener(ADMIN_REFRESH_EVENT, handleAdminRefresh);
    return () => window.removeEventListener(ADMIN_REFRESH_EVENT, handleAdminRefresh);
  }, [fromDate, toDate, canRunRange]);

  const filteredTechnicianRows = useMemo(() => {
    const rows = overview?.technician_performance ?? [];
    const query = technicianFilter.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) => row.name.toLowerCase().includes(query));
  }, [overview, technicianFilter]);

  const filteredServiceRows = useMemo(() => {
    const rows = overview?.service_category_analytics.categories ?? [];
    const query = categoryFilter.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) => row.category.toLowerCase().includes(query));
  }, [overview, categoryFilter]);

  const filteredRequestRows = useMemo(() => {
    const rows = overview?.customer_request_analytics.requests_by_service_category ?? [];
    const query = requestFilter.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) => row.category.toLowerCase().includes(query));
  }, [overview, requestFilter]);

  const revenueTrendData = useMemo(
    () =>
      (overview?.revenue_metrics.revenue_by_date ?? []).map((row) => ({
        date: formatShortDate(row.date),
        total: row.total_revenue,
        completed: row.completed_job_revenue,
      })),
    [overview],
  );

  const jobStatusData = useMemo(
    () =>
      (overview?.job_completion_analytics.status_breakdown ?? []).map((row) => ({
        status: row.status,
        count: row.count,
      })),
    [overview],
  );

  const technicianChartData = useMemo(
    () =>
      filteredTechnicianRows.slice(0, 6).map((row) => ({
        technician: row.name,
        completed: row.jobs_completed,
        assigned: row.jobs_assigned,
      })),
    [filteredTechnicianRows],
  );

  const attendanceTrendData = useMemo(
    () =>
      (overview?.attendance_metrics.attendance_by_date ?? []).map((row) => ({
        date: formatShortDate(row.date),
        hours: row.total_working_hours,
        breaks: row.break_duration_hours,
      })),
    [overview],
  );

  const invoiceStatusData = useMemo(
    () =>
      (overview?.invoice_performance ?? []).map((row) => ({
        name: row.state,
        count: row.count,
        amount: row.total_amount,
      })),
    [overview],
  );

  const requestCategoryData = useMemo(
    () =>
      filteredRequestRows.map((row) => ({
        category: row.category,
        total: row.total_requests,
        converted: row.converted_requests,
      })),
    [filteredRequestRows],
  );

  const serviceCategoryData = useMemo(
    () =>
      filteredServiceRows.map((row) => ({
        category: row.category,
        revenue: row.revenue,
        jobs: row.jobs_count,
        requests: row.requests_count,
      })),
    [filteredServiceRows],
  );

  const paymentStatusData = useMemo(
    () =>
      (overview?.payment_metrics.payment_status ?? []).map((row) => ({
        status: row.status,
        count: row.count,
        amount: row.amount,
      })),
    [overview],
  );

  const overviewExportRows = useMemo<ExportRow[]>(() => {
    if (!overview) return [];
    return [
      { metric: 'Total revenue', value: overview.revenue_metrics.total_revenue },
      { metric: 'Revenue from completed jobs', value: overview.revenue_metrics.revenue_from_completed_jobs },
      { metric: 'Pending revenue from unpaid invoices', value: overview.revenue_metrics.pending_revenue_from_unpaid_invoices },
      { metric: 'Total jobs', value: overview.job_completion_analytics.total_jobs },
      { metric: 'Completed jobs', value: overview.job_completion_analytics.completed_jobs },
      { metric: 'Attendance working hours', value: overview.attendance_metrics.total_working_hours },
      { metric: 'Total invoices', value: overview.current_period_invoice_count },
      { metric: 'Total customer requests', value: overview.customer_request_analytics.total_customer_requests },
      { metric: 'Total payments received', value: overview.payment_metrics.total_payments_received },
    ];
  }, [overview]);

  const activeExportRows = useMemo<ExportRow[]>(() => {
    if (!overview) return [];
    if (activeReportTab === 'overview') return overviewExportRows;
    if (activeReportTab === 'revenue') {
      return [
        ...overview.revenue_metrics.revenue_by_date.map((row) => ({
          section: 'Revenue by date',
          date: row.date,
          total_revenue: row.total_revenue,
          completed_job_revenue: row.completed_job_revenue,
        })),
        ...overview.revenue_metrics.revenue_by_service_category.map((row) => ({
          section: 'Revenue by service category',
          category: row.category,
          revenue: row.revenue,
          completed_jobs: row.completed_jobs,
        })),
      ];
    }
    if (activeReportTab === 'jobs') {
      return overview.job_completion_analytics.status_breakdown.map((row) => ({
        status: row.status,
        count: row.count,
        percentage: row.percentage,
      }));
    }
    if (activeReportTab === 'technicians') {
      return filteredTechnicianRows.map((row: BackendTechnicianPerformanceRow) => ({
        technician: row.name,
        jobs_assigned: row.jobs_assigned,
        jobs_completed: row.jobs_completed,
        completion_rate: row.on_time_rate ?? 0,
        average_job_duration: row.avg_completion_time,
        refusal_rate: row.refusal_rate ?? 0,
        service_value: row.total_service_line_value ?? row.revenue_generated,
        work_hours: row.work_hours ?? 0,
      }));
    }
    if (activeReportTab === 'attendance') {
      return overview.attendance_metrics.technician_attendance.map((row) => ({
        technician: row.technician_name,
        clock_in_records: row.clock_in_records,
        clock_out_records: row.clock_out_records,
        total_working_hours: row.total_working_hours,
        break_duration_hours: row.break_duration_hours,
        attendance_status: row.attendance_status,
      }));
    }
    if (activeReportTab === 'invoices') {
      return overview.invoice_performance.map((row) => ({
        status: row.state,
        count: row.count,
        amount: row.total_amount,
      }));
    }
    if (activeReportTab === 'requests') {
      return filteredRequestRows.map((row) => ({
        category: row.category,
        total_requests: row.total_requests,
        converted_requests: row.converted_requests,
      }));
    }
    if (activeReportTab === 'services') {
      return filteredServiceRows.map((row: BackendServiceCategoryAnalyticsRow) => ({
        category: row.category,
        jobs_count: row.jobs_count,
        completed_jobs_count: row.completed_jobs_count,
        requests_count: row.requests_count,
        revenue: row.revenue,
      }));
    }
    return [
      ...overview.payment_metrics.payment_status.map((row) => ({
        section: 'Payment status',
        status: row.status,
        count: row.count,
        amount: row.amount,
      })),
      ...overview.payment_metrics.payment_breakdown?.map((row: BackendPaymentBreakdownRow) => ({
        section: 'Payment breakdown',
        label: row.label,
        count: row.count,
        amount: row.amount,
      })) ?? [],
      ...overview.payment_metrics.payment_amount_by_method.map((row) => ({
        section: 'Payment method',
        method: row.method,
        amount: row.amount,
      })),
    ];
  }, [activeReportTab, filteredRequestRows, filteredServiceRows, filteredTechnicianRows, overview, overviewExportRows]);

  const handleExport = () => {
    if (!overview || activeExportRows.length === 0) return;
    exportArrayData(activeExportRows, `reports_${activeReportTab}_${fromDate}_${toDate}`, exportFormat);
  };

  const completionRate = overview?.job_completion_analytics.total_jobs
    ? (overview.job_completion_analytics.completed_jobs / overview.job_completion_analytics.total_jobs) * 100
    : 0;

  const paidInvoiceTotal = overview?.invoice_performance
    ?.filter((row) => row.state.toLowerCase() === 'paid')
    .reduce((sum, row) => sum + row.total_amount, 0) ?? 0;

  return (
    <div className="relative w-full pb-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[380px] rounded-[34px] bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),rgba(34,211,238,0)_34%),radial-gradient(circle_at_top_right,rgba(52,211,153,0.08),rgba(52,211,153,0)_30%)]" />
      <div className="pointer-events-none absolute left-8 top-8 h-40 w-40 rounded-full bg-cyan-400/8 blur-3xl" />
      <div className="pointer-events-none absolute right-10 top-20 h-48 w-48 rounded-full bg-emerald-400/8 blur-3xl" />

      <div className="relative space-y-6">
        <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(7,25,42,0.98),rgba(6,18,32,0.98))] shadow-[0_34px_120px_rgba(0,0,0,0.34)]">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:120px_120px] opacity-20" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/70 to-transparent" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(47,142,146,0.14),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.12),transparent_26%)]" />
          <div className="relative flex flex-col gap-5 p-6 xl:flex-row xl:items-start xl:justify-between xl:p-8">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-100">
                <FileBarChart className="h-3.5 w-3.5" />
                Reporting And Analytics
              </div>
              <h1 className="mt-5 text-[2.35rem] font-semibold leading-none tracking-[-0.06em] text-white md:text-[2.8rem]">
                Reporting Dashboard
              </h1>
            </div>
            <div className="w-full max-w-[1120px] xl:self-stretch">
              <div className="flex h-full flex-col gap-4 xl:items-end xl:justify-between">
                <div className="flex flex-wrap items-center gap-3 xl:justify-end">
                  <Badge variant="outline" className="border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-cyan-100">
                    {QUICK_RANGE_LABEL[quickRange]}
                  </Badge>
                  <span className="rounded-full border border-white/10 bg-[rgba(255,255,255,0.04)] px-3 py-2 text-xs text-slate-300">
                    Range: {activeRangeLabel}
                  </span>
                  <span className="rounded-full border border-white/10 bg-[rgba(255,255,255,0.04)] px-3 py-2 text-xs text-slate-300">
                    Last updated: {lastUpdated ? lastUpdated.toLocaleTimeString() : '--'}
                  </span>
                </div>

                <div className="grid w-full grid-cols-1 gap-4 xl:grid-cols-[220px_minmax(320px,440px)_190px_auto] xl:items-end">
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Quick Range</p>
                    <Select value={quickRange} onValueChange={(value) => handleQuickRangeChange(value as QuickRange)}>
                      <SelectTrigger className="h-11 rounded-2xl border-white/10 bg-[#0b1424] text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                        <SelectValue placeholder="Range" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(QUICK_RANGE_LABEL).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Custom Range</p>
                    <div className="grid min-h-11 grid-cols-1 items-center gap-2 rounded-2xl border border-white/10 bg-[#0b1424] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:grid-cols-[minmax(135px,1fr)_auto_minmax(135px,1fr)]">
                      <Input
                        type="date"
                        value={fromDate}
                        onChange={(event) => setFromDate(event.target.value)}
                        style={reportDarkInputStyle}
                        className="h-8 min-w-0 border-0 px-1 text-xs text-slate-100 shadow-none focus-visible:ring-0"
                      />
                      <span className="hidden items-center gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 sm:flex">
                        <Calendar className="h-3.5 w-3.5" />
                        to
                      </span>
                      <Input
                        type="date"
                        value={toDate}
                        onChange={(event) => setToDate(event.target.value)}
                        style={reportDarkInputStyle}
                        className="h-8 min-w-0 border-0 px-1 text-xs text-slate-100 shadow-none focus-visible:ring-0"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Export Format</p>
                    <Select value={exportFormat} onValueChange={(value) => setExportFormat(value as ExportFormat)}>
                      <SelectTrigger className="h-11 rounded-2xl border-white/10 bg-[#0b1424] text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                        <SelectValue placeholder="Format" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(EXPORT_FORMAT_LABEL).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-wrap items-center justify-start gap-2 xl:justify-end">
                    <Button
                      size="sm"
                      className="h-11 rounded-full bg-slate-950 px-5 text-white shadow-[0_12px_30px_rgba(15,23,42,0.18)] hover:bg-slate-800 dark:bg-[#2F8E92] dark:shadow-[0_12px_30px_rgba(47,142,146,0.28)] dark:hover:bg-[#267276]"
                      onClick={handleRefresh}
                      disabled={!canRunRange || loading}
                    >
                      {loading ? 'Applying...' : 'Apply Filters'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-11 gap-2 rounded-full border-white/10 bg-[rgba(255,255,255,0.03)] text-slate-100 shadow-sm hover:bg-[rgba(255,255,255,0.08)]"
                      onClick={handleExport}
                      disabled={!overview || loading || activeExportRows.length === 0}
                    >
                      <Download className="h-4 w-4" />
                      Export {EXPORT_FORMAT_LABEL[exportFormat]}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-11 gap-2 rounded-full border-white/10 bg-[rgba(255,255,255,0.03)] text-slate-100 shadow-sm hover:bg-[rgba(255,255,255,0.08)]"
                      onClick={handleRefresh}
                      disabled={!canRunRange || loading}
                    >
                      <RefreshCw className={cn('h-4 w-4 text-cyan-200', loading && 'animate-spin')} />
                      Refresh
                    </Button>
                  </div>
                </div>

                {!canRunRange ? (
                  <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200">
                    Start date must be on or before end date.
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        {error ? (
          <Card className="rounded-[24px] border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-200">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>{error}</span>
              <Button
                variant="outline"
                size="sm"
                className="border-rose-300/20 bg-transparent text-rose-100 hover:bg-rose-400/10 hover:text-white"
                onClick={handleRefresh}
              >
                Retry
              </Button>
            </div>
          </Card>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Revenue"
            value={currencyFmt.format(overview?.revenue_metrics.total_revenue ?? 0)}
            supporting={`${currencyFmt.format(overview?.revenue_metrics.pending_revenue_from_unpaid_invoices ?? 0)} pending`}
            tone="amber"
            icon={CircleDollarSign}
            loading={loading}
          />
          <MetricCard
            label="Job Completion"
            value={`${percentFmt.format(completionRate)}%`}
            supporting={`${numberFmt.format(overview?.job_completion_analytics.completed_jobs ?? 0)} of ${numberFmt.format(overview?.job_completion_analytics.total_jobs ?? 0)} jobs completed`}
            tone="emerald"
            icon={CheckCircle2}
            loading={loading}
          />
          <MetricCard
            label="Technician Productivity"
            value={numberFmt.format(
              (overview?.technician_performance ?? []).reduce((sum, row) => sum + row.jobs_completed, 0),
            )}
            supporting={`${numberFmt.format((overview?.technician_performance ?? []).length)} technicians in report`}
            tone="violet"
            icon={Users}
            loading={loading}
          />
          <MetricCard
            label="Attendance Hours"
            value={hourFmt.format(overview?.attendance_metrics.total_working_hours ?? 0)}
            supporting={`${hourFmt.format(overview?.attendance_metrics.break_duration_hours ?? 0)} break hours`}
            tone="cyan"
            icon={Clock3}
            loading={loading}
          />
          <MetricCard
            label="Invoice Performance"
            value={currencyFmt.format(overview?.kpis.invoice_total ?? 0)}
            supporting={`${currencyFmt.format(paidInvoiceTotal)} paid in selected range`}
            tone="slate"
            icon={ReceiptText}
            loading={loading}
          />
          <MetricCard
            label="Customer Requests"
            value={numberFmt.format(overview?.customer_request_analytics.total_customer_requests ?? 0)}
            supporting={`${numberFmt.format(overview?.customer_request_analytics.converted_requests ?? 0)} converted requests`}
            tone="rose"
            icon={FileBarChart}
            loading={loading}
          />
          <MetricCard
            label="Service Categories"
            value={numberFmt.format(overview?.service_category_analytics.categories.length ?? 0)}
            supporting="Categories with jobs, requests, or revenue"
            tone="slate"
            icon={Activity}
            loading={loading}
          />
          <MetricCard
            label="Payments Received"
            value={numberFmt.format(overview?.payment_metrics.total_payments_received ?? 0)}
            supporting={`${currencyFmt.format(overview?.payment_metrics.total_paid_amount ?? 0)} recorded as paid`}
            tone="emerald"
            icon={CreditCard}
            loading={loading}
          />
        </div>

        <Tabs value={activeReportTab} onValueChange={(value) => setActiveReportTab(value as ReportTab)} className="gap-5">
          <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1 shadow-sm dark:border-white/10 dark:bg-[#0b1424] sm:w-fit">
            {[
              ['overview', 'Overview'],
              ['revenue', 'Revenue'],
              ['jobs', 'Jobs'],
              ['technicians', 'Technicians'],
              ['attendance', 'Attendance'],
              ['invoices', 'Invoices'],
              ['requests', 'Requests'],
              ['services', 'Services'],
              ['payments', 'Payments'],
            ].map(([value, label]) => (
              <TabsTrigger
                key={value}
                value={value}
                className="rounded-xl px-4 py-2 text-slate-600 data-[state=active]:bg-cyan-50 data-[state=active]:text-cyan-800 dark:text-slate-300 dark:data-[state=active]:bg-cyan-500/15 dark:data-[state=active]:text-cyan-100"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-2">
              <ChartPanel title="Revenue Trend" description="Total revenue and completed-job revenue across the selected date range.">
                {loading ? (
                  <Skeleton className="h-[300px] w-full bg-white/10" />
                ) : revenueTrendData.length ? (
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={revenueTrendData}>
                        <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                        <XAxis dataKey="date" stroke="#94a3b8" tickLine={false} axisLine={false} />
                        <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="total" name="Total revenue" stroke="#06b6d4" strokeWidth={3} dot={false} />
                        <Line type="monotone" dataKey="completed" name="Completed job revenue" stroke="#22c55e" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyReportState title="No revenue trend yet" description="No revenue data exists for the selected range." />
                )}
              </ChartPanel>

              <ChartPanel title="Reporting Categories" description="Quick operational totals across the V1 reporting categories.">
                {loading ? (
                  <Skeleton className="h-[300px] w-full bg-white/10" />
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      ['Revenue', currencyFmt.format(overview?.revenue_metrics.total_revenue ?? 0)],
                      ['Jobs', numberFmt.format(overview?.job_completion_analytics.total_jobs ?? 0)],
                      ['Technicians', numberFmt.format(overview?.technician_performance.length ?? 0)],
                      ['Attendance', `${hourFmt.format(overview?.attendance_metrics.total_working_hours ?? 0)} hrs`],
                      ['Invoices', numberFmt.format(overview?.current_period_invoice_count ?? 0)],
                      ['Requests', numberFmt.format(overview?.customer_request_analytics.total_customer_requests ?? 0)],
                      ['Services', numberFmt.format(overview?.service_category_analytics.categories.length ?? 0)],
                      ['Payments', numberFmt.format(overview?.payment_metrics.total_payments_received ?? 0)],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-2xl border border-white/8 bg-[rgba(255,255,255,0.03)] p-4">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{label}</p>
                        <p className="mt-2 text-xl font-semibold text-white">{value}</p>
                      </div>
                    ))}
                  </div>
                )}
              </ChartPanel>
            </div>
          </TabsContent>

          <TabsContent value="revenue" className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-2">
              <ChartPanel title="Revenue By Date" description="Revenue performance by day within the selected range.">
                {loading ? (
                  <Skeleton className="h-[300px] w-full bg-white/10" />
                ) : revenueTrendData.length ? (
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={revenueTrendData}>
                        <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                        <XAxis dataKey="date" stroke="#94a3b8" tickLine={false} axisLine={false} />
                        <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="total" name="Total revenue" fill="#06b6d4" radius={[8, 8, 0, 0]} />
                        <Bar dataKey="completed" name="Completed job revenue" fill="#22c55e" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyReportState title="No revenue records found" description="Try selecting a wider date range." />
                )}
              </ChartPanel>

              <ChartPanel title="Revenue By Service Category" description="Revenue and completed jobs by service category.">
                {loading ? (
                  <Skeleton className="h-[300px] w-full bg-white/10" />
                ) : overview?.revenue_metrics.revenue_by_service_category.length ? (
                  <div className="space-y-3">
                    {overview.revenue_metrics.revenue_by_service_category.map((row) => (
                      <div key={row.category} className="rounded-2xl border border-white/8 bg-[rgba(255,255,255,0.03)] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">{row.category}</p>
                            <p className="mt-1 text-xs text-slate-400">{row.completed_jobs} completed jobs</p>
                          </div>
                          <div className="text-right text-sm font-semibold text-white">{currencyFmt.format(row.revenue)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyReportState title="No service revenue found" description="No category revenue exists in this range." />
                )}
              </ChartPanel>
            </div>
          </TabsContent>

          <TabsContent value="jobs" className="space-y-6">
            <ChartPanel title="Job Completion Analytics" description="Job volume, lifecycle status, and completion trend.">
              {loading ? (
                <Skeleton className="h-[320px] w-full bg-white/10" />
              ) : jobStatusData.length ? (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
                    <div className="rounded-2xl border border-white/8 bg-[rgba(255,255,255,0.03)] p-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Total</p>
                      <p className="mt-2 text-xl font-semibold text-white">{overview?.job_completion_analytics.total_jobs ?? 0}</p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-[rgba(255,255,255,0.03)] p-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Completed</p>
                      <p className="mt-2 text-xl font-semibold text-white">{overview?.job_completion_analytics.completed_jobs ?? 0}</p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-[rgba(255,255,255,0.03)] p-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Pending</p>
                      <p className="mt-2 text-xl font-semibold text-white">{overview?.job_completion_analytics.pending_jobs ?? 0}</p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-[rgba(255,255,255,0.03)] p-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">In Progress</p>
                      <p className="mt-2 text-xl font-semibold text-white">{overview?.job_completion_analytics.in_progress_jobs ?? 0}</p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-[rgba(255,255,255,0.03)] p-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Avg Completion</p>
                      <p className="mt-2 text-xl font-semibold text-white">{overview?.job_completion_analytics.average_job_completion_time ?? '0m'}</p>
                    </div>
                  </div>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={jobStatusData}>
                        <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                        <XAxis dataKey="status" stroke="#94a3b8" tickLine={false} axisLine={false} />
                        <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#14b8a6" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <EmptyReportState title="No job analytics yet" description="No jobs were created in the selected range." />
              )}
            </ChartPanel>
          </TabsContent>

          <TabsContent value="technicians" className="space-y-6">
            <ChartPanel title="Technician Productivity" description="Assigned jobs, completed jobs, average duration, and completion performance by technician.">
              <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs text-slate-400">
                    Showing {numberFmt.format(filteredTechnicianRows.length)} of {numberFmt.format(overview?.technician_performance.length ?? 0)}
                  </p>
                </div>
                <Input
                  value={technicianFilter}
                  onChange={(event) => setTechnicianFilter(event.target.value)}
                  placeholder="Filter technician..."
                  style={reportDarkInputStyle}
                  className="h-10 rounded-full border-white/10 text-slate-100 placeholder:text-slate-500 lg:w-72"
                />
              </div>

              {loading ? (
                <Skeleton className="h-[320px] w-full bg-white/10" />
              ) : filteredTechnicianRows.length ? (
                <div className="space-y-5">
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={technicianChartData}>
                        <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                        <XAxis dataKey="technician" stroke="#94a3b8" tickLine={false} axisLine={false} hide={technicianChartData.length > 4} />
                        <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="assigned" name="Assigned" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                        <Bar dataKey="completed" name="Completed" fill="#22c55e" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="overflow-hidden rounded-[20px] border border-white/8 bg-black/10 shadow-sm">
                    <Table>
                      <TableHeader className="border-b border-white/10 bg-[linear-gradient(180deg,rgba(11,25,42,0.98),rgba(10,20,35,0.92))]">
                        <TableRow className="border-white/0 hover:bg-transparent">
                          <TableHead className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Technician</TableHead>
                          <TableHead className="text-right text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Assigned</TableHead>
                          <TableHead className="text-right text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Completed</TableHead>
                          <TableHead className="text-right text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Avg Duration</TableHead>
                          <TableHead className="text-right text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Work Hours</TableHead>
                          <TableHead className="text-right text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Completion Rate</TableHead>
                          <TableHead className="text-right text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Work Value</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredTechnicianRows.map((row, index) => (
                          <TableRow key={row.id} className={cn('border-b border-white/6', index % 2 === 1 && 'bg-[rgba(255,255,255,0.015)]')}>
                            <TableCell className="font-medium text-white">{row.name}</TableCell>
                            <TableCell className="text-right text-slate-200">{numberFmt.format(row.jobs_assigned)}</TableCell>
                            <TableCell className="text-right text-slate-200">{numberFmt.format(row.jobs_completed)}</TableCell>
                            <TableCell className="text-right text-slate-200">{row.avg_completion_time}</TableCell>
                            <TableCell className="text-right text-slate-200">{hourFmt.format(row.work_hours ?? 0)}</TableCell>
                            <TableCell className="text-right text-slate-200">{percentFmt.format(row.on_time_rate ?? 0)}%</TableCell>
                            <TableCell className="text-right font-medium text-white">{currencyFmt.format(row.total_service_line_value ?? row.revenue_generated)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : (
                <EmptyReportState title="No technician rows match this filter" description="Clear the filter or widen the date range." />
              )}
            </ChartPanel>
          </TabsContent>

          <TabsContent value="attendance" className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-2">
              <ChartPanel title="Attendance Metrics" description="Clock-ins, clock-outs, working hours, and break duration across the selected period.">
                {loading ? (
                  <Skeleton className="h-[300px] w-full bg-white/10" />
                ) : attendanceTrendData.length ? (
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-white/8 bg-[rgba(255,255,255,0.03)] p-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Clock-ins</p>
                        <p className="mt-2 text-xl font-semibold text-white">{overview?.attendance_metrics.clock_in_records ?? 0}</p>
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-[rgba(255,255,255,0.03)] p-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Clock-outs</p>
                        <p className="mt-2 text-xl font-semibold text-white">{overview?.attendance_metrics.clock_out_records ?? 0}</p>
                      </div>
                    </div>
                    <div className="h-[240px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={attendanceTrendData}>
                          <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                          <XAxis dataKey="date" stroke="#94a3b8" tickLine={false} axisLine={false} />
                          <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="hours" name="Working hours" stroke="#22c55e" strokeWidth={3} dot={false} />
                          <Line type="monotone" dataKey="breaks" name="Break hours" stroke="#f59e0b" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ) : (
                  <EmptyReportState title="No attendance sessions found" description="No technician attendance was recorded in this range." />
                )}
              </ChartPanel>

              <ChartPanel title="Attendance Status And Technician Detail" description="Current attendance status and technician-level work-hour totals.">
                {loading ? (
                  <Skeleton className="h-[300px] w-full bg-white/10" />
                ) : overview?.attendance_metrics.technician_attendance.length ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      {overview.attendance_metrics.attendance_status_breakdown.map((row) => (
                        <Badge key={row.status} variant="outline" className={cn(dispatchBadgeTone(row), 'border text-xs')}>
                          {row.status}: {row.count}
                        </Badge>
                      ))}
                    </div>
                    <div className="space-y-2">
                      {overview.attendance_metrics.technician_attendance.map((row) => (
                        <div key={row.technician_id} className="rounded-2xl border border-white/8 bg-[rgba(255,255,255,0.03)] p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-white">{row.technician_name}</p>
                              <p className="mt-1 text-xs text-slate-400">{row.attendance_status}</p>
                            </div>
                            <div className="text-right text-sm text-slate-200">
                              <div>{hourFmt.format(row.total_working_hours)} working hrs</div>
                              <div>{hourFmt.format(row.break_duration_hours)} break hrs</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <EmptyReportState title="No technician attendance detail" description="Attendance detail appears here when sessions exist." />
                )}
              </ChartPanel>
            </div>
          </TabsContent>

          <TabsContent value="invoices" className="space-y-6">
            <ChartPanel title="Invoice Performance" description="Invoice lifecycle counts, billed totals, pending value, and current invoice mix.">
              {loading ? (
                <Skeleton className="h-[320px] w-full bg-white/10" />
              ) : invoiceStatusData.length ? (
                <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={invoiceStatusData} dataKey="count" nameKey="name" outerRadius={95} innerRadius={54}>
                          {invoiceStatusData.map((entry, index) => (
                            <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-3">
                    {(overview?.invoice_performance ?? []).map((row) => (
                      <div key={row.state} className="rounded-2xl border border-white/8 bg-[rgba(255,255,255,0.03)] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <Badge variant="outline" className={cn(statusBadgeTone(row), 'border text-xs')}>
                            {row.state}
                          </Badge>
                          <div className="text-right">
                            <div className="text-sm font-semibold text-white">{currencyFmt.format(row.total_amount)}</div>
                            <div className="text-xs text-slate-400">{numberFmt.format(row.count)} invoices</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyReportState title="No invoice performance in this period" description="No invoice activity exists for the selected range." />
              )}
            </ChartPanel>
          </TabsContent>

          <TabsContent value="requests" className="space-y-6">
            <ChartPanel title="Customer Request Analytics" description="New requests, converted requests, and request volume by service category.">
              <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap gap-3 text-sm text-slate-300">
                  <span>Total: {numberFmt.format(overview?.customer_request_analytics.total_customer_requests ?? 0)}</span>
                  <span>New: {numberFmt.format(overview?.customer_request_analytics.new_requests ?? 0)}</span>
                  <span>Converted: {numberFmt.format(overview?.customer_request_analytics.converted_requests ?? 0)}</span>
                  <span>Cancelled / Rejected: {numberFmt.format(overview?.customer_request_analytics.cancelled_or_rejected_requests ?? 0)}</span>
                </div>
                <Input
                  value={requestFilter}
                  onChange={(event) => setRequestFilter(event.target.value)}
                  placeholder="Filter request category..."
                  style={reportDarkInputStyle}
                  className="h-10 rounded-full border-white/10 text-slate-100 placeholder:text-slate-500 lg:w-72"
                />
              </div>

              {loading ? (
                <Skeleton className="h-[320px] w-full bg-white/10" />
              ) : requestCategoryData.length ? (
                <div className="space-y-5">
                  <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={requestCategoryData}>
                        <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                        <XAxis dataKey="category" stroke="#94a3b8" tickLine={false} axisLine={false} hide={requestCategoryData.length > 4} />
                        <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="total" name="Total requests" fill="#06b6d4" radius={[8, 8, 0, 0]} />
                        <Bar dataKey="converted" name="Converted requests" fill="#22c55e" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="overflow-hidden rounded-[20px] border border-white/8 bg-black/10 shadow-sm">
                    <Table>
                      <TableHeader className="border-b border-white/10 bg-[linear-gradient(180deg,rgba(11,25,42,0.98),rgba(10,20,35,0.92))]">
                        <TableRow className="border-white/0 hover:bg-transparent">
                          <TableHead className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Category</TableHead>
                          <TableHead className="text-right text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Total Requests</TableHead>
                          <TableHead className="text-right text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Converted</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredRequestRows.map((row, index) => (
                          <TableRow key={row.category} className={cn('border-b border-white/6', index % 2 === 1 && 'bg-[rgba(255,255,255,0.015)]')}>
                            <TableCell className="font-medium text-white">{row.category}</TableCell>
                            <TableCell className="text-right text-slate-200">{numberFmt.format(row.total_requests)}</TableCell>
                            <TableCell className="text-right text-slate-200">{numberFmt.format(row.converted_requests)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : (
                <EmptyReportState title="No customer request analytics yet" description="No request activity exists in the selected period." />
              )}
            </ChartPanel>
          </TabsContent>

          <TabsContent value="services" className="space-y-6">
            <ChartPanel title="Service Category Analytics" description="Jobs, completed jobs, revenue, and requests grouped by service category.">
              <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <p className="text-xs text-slate-400">
                  Showing {numberFmt.format(filteredServiceRows.length)} of {numberFmt.format(overview?.service_category_analytics.categories.length ?? 0)}
                </p>
                <Input
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                  placeholder="Filter service category..."
                  style={reportDarkInputStyle}
                  className="h-10 rounded-full border-white/10 text-slate-100 placeholder:text-slate-500 lg:w-72"
                />
              </div>

              {loading ? (
                <Skeleton className="h-[320px] w-full bg-white/10" />
              ) : serviceCategoryData.length ? (
                <div className="space-y-5">
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={serviceCategoryData}>
                        <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                        <XAxis dataKey="category" stroke="#94a3b8" tickLine={false} axisLine={false} hide={serviceCategoryData.length > 4} />
                        <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="revenue" name="Revenue" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                        <Bar dataKey="jobs" name="Jobs" fill="#06b6d4" radius={[8, 8, 0, 0]} />
                        <Bar dataKey="requests" name="Requests" fill="#22c55e" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="overflow-hidden rounded-[20px] border border-white/8 bg-black/10 shadow-sm">
                    <Table>
                      <TableHeader className="border-b border-white/10 bg-[linear-gradient(180deg,rgba(11,25,42,0.98),rgba(10,20,35,0.92))]">
                        <TableRow className="border-white/0 hover:bg-transparent">
                          <TableHead className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Category</TableHead>
                          <TableHead className="text-right text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Jobs</TableHead>
                          <TableHead className="text-right text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Completed</TableHead>
                          <TableHead className="text-right text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Requests</TableHead>
                          <TableHead className="text-right text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Revenue</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredServiceRows.map((row, index) => (
                          <TableRow key={row.category} className={cn('border-b border-white/6', index % 2 === 1 && 'bg-[rgba(255,255,255,0.015)]')}>
                            <TableCell className="font-medium text-white">{row.category}</TableCell>
                            <TableCell className="text-right text-slate-200">{numberFmt.format(row.jobs_count)}</TableCell>
                            <TableCell className="text-right text-slate-200">{numberFmt.format(row.completed_jobs_count)}</TableCell>
                            <TableCell className="text-right text-slate-200">{numberFmt.format(row.requests_count)}</TableCell>
                            <TableCell className="text-right font-medium text-white">{currencyFmt.format(row.revenue)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : (
                <EmptyReportState title="No service-category analytics found" description="No service categories have activity in this range." />
              )}
            </ChartPanel>
          </TabsContent>

          <TabsContent value="payments" className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-2">
              <ChartPanel title="Payment Metrics" description="Paid totals, pending payment counts, and payment status mix from invoices.">
                {loading ? (
                  <Skeleton className="h-[300px] w-full bg-white/10" />
                ) : paymentStatusData.length ? (
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-white/8 bg-[rgba(255,255,255,0.03)] p-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Payments Received</p>
                        <p className="mt-2 text-xl font-semibold text-white">{overview?.payment_metrics.total_payments_received ?? 0}</p>
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-[rgba(255,255,255,0.03)] p-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Pending Payments</p>
                        <p className="mt-2 text-xl font-semibold text-white">{overview?.payment_metrics.pending_payments ?? 0}</p>
                      </div>
                    </div>
                    <div className="h-[240px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={paymentStatusData}>
                          <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                          <XAxis dataKey="status" stroke="#94a3b8" tickLine={false} axisLine={false} />
                          <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="amount" name="Amount" fill="#22c55e" radius={[8, 8, 0, 0]} />
                          <Bar dataKey="count" name="Count" fill="#06b6d4" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ) : (
                  <EmptyReportState title="No payment metrics yet" description="No invoice payment activity exists in the selected range." />
                )}
              </ChartPanel>

              <ChartPanel title="Payment Amount By Method" description="Current paid amount grouped by payment method data available in the system, plus a status-based breakdown for pending and failed activity.">
                {loading ? (
                  <Skeleton className="h-[300px] w-full bg-white/10" />
                ) : (
                  <div className="space-y-4">
                    {(overview?.payment_metrics?.payment_breakdown ?? []).length ? (
                      <div className="space-y-2">
                        {(overview?.payment_metrics?.payment_breakdown ?? []).map((row) => (
                          <div key={row.label} className="rounded-2xl border border-white/8 bg-[rgba(255,255,255,0.03)] p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-white">{row.label}</p>
                                <p className="mt-1 text-xs text-slate-400">{numberFmt.format(row.count)} records</p>
                              </div>
                              <div className="text-right text-sm font-semibold text-white">{currencyFmt.format(row.amount)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {(overview?.payment_metrics?.payment_amount_by_method ?? []).length ? (
                      <div className="space-y-2">
                        {(overview?.payment_metrics?.payment_amount_by_method ?? []).map((row) => (
                          <div key={row.method} className="rounded-2xl border border-white/8 bg-[rgba(255,255,255,0.03)] p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-white">{row.method}</p>
                                <p className="mt-1 text-xs text-slate-400">Paid amount recorded under this method label</p>
                              </div>
                              <div className="text-right text-sm font-semibold text-white">{currencyFmt.format(row.amount)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyReportState title="No payment method data yet" description="No paid invoices were found in the selected range." />
                    )}
                  </div>
                )}
              </ChartPanel>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

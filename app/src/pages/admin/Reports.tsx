import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import {
  Calendar,
  Download,
  Briefcase,
  CheckCircle2,
  Users,
  DollarSign,
  RefreshCw,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { exportArrayData } from '@/lib/export';
import {
  fetchAdminReportsOverview,
  getStoredAdminToken,
  type BackendDispatchStatusRow,
  type BackendInvoiceStatusRow,
  type BackendReportsOverview,
} from '@/lib/backend-api';

type QuickRange = 'today' | 'this_week' | 'this_month' | 'last_month' | 'this_quarter' | 'this_year';
type ReportTab = 'overview' | 'operations' | 'invoices' | 'technicians' | 'locations';
const ADMIN_REFRESH_EVENT = 'sm-dispatch:admin-refresh';

const QUICK_RANGE_LABEL: Record<QuickRange, string> = {
  today: 'Today',
  this_week: 'This Week',
  this_month: 'This Month',
  last_month: 'Last Month',
  this_quarter: 'This Quarter',
  this_year: 'This Year',
};

const numberFmt = new Intl.NumberFormat('en-US');
const percentFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const currencyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const sectionCardClass = 'overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,24,39,0.96),rgba(6,17,29,0.96))] shadow-[0_24px_80px_rgba(0,0,0,0.28)]';
const sectionHeaderClass = 'border-b border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0))] p-6';
const reportDarkInputStyle: CSSProperties = {
  background: '#0b1424',
  backgroundImage: 'none',
  color: '#f8fbff',
};

function metricCardClass(tone: 'cyan' | 'emerald' | 'amber' | 'violet' | 'rose'): string {
  return cn(
    'overflow-hidden rounded-[24px] border shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
    tone === 'cyan' && 'border-cyan-400/15 bg-[linear-gradient(180deg,rgba(12,36,55,0.96),rgba(8,24,39,0.96))]',
    tone === 'emerald' && 'border-emerald-400/15 bg-[linear-gradient(180deg,rgba(10,37,45,0.96),rgba(7,25,31,0.96))]',
    tone === 'amber' && 'border-amber-400/15 bg-[linear-gradient(180deg,rgba(41,28,15,0.94),rgba(27,18,10,0.96))]',
    tone === 'violet' && 'border-violet-400/15 bg-[linear-gradient(180deg,rgba(30,23,49,0.96),rgba(18,16,33,0.96))]',
    tone === 'rose' && 'border-rose-400/15 bg-[linear-gradient(180deg,rgba(42,16,25,0.96),rgba(28,15,23,0.96))]',
  );
}

function metricIconClass(tone: 'cyan' | 'emerald' | 'amber' | 'violet' | 'rose'): string {
  return cn(
    'rounded-2xl border p-3',
    tone === 'cyan' && 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100',
    tone === 'emerald' && 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100',
    tone === 'amber' && 'border-amber-300/20 bg-amber-300/10 text-amber-100',
    tone === 'violet' && 'border-violet-300/20 bg-violet-300/10 text-violet-100',
    tone === 'rose' && 'border-rose-300/20 bg-rose-300/10 text-rose-100',
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
    // already today
  } else if (range === 'this_week') {
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

function statusBadgeTone(row: BackendInvoiceStatusRow): string {
  if (row.is_critical) {
    return 'border-orange-300/20 bg-orange-300/10 text-orange-100';
  }
  if (row.state.toLowerCase() === 'paid' || row.state.toLowerCase() === 'verified') {
    return 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100';
  }
  if (row.state.toLowerCase() === 'sent') {
    return 'border-blue-300/20 bg-blue-300/10 text-blue-100';
  }
  return 'border-white/10 bg-[rgba(255,255,255,0.04)] text-slate-100';
}

function dispatchBadgeTone(row: BackendDispatchStatusRow): string {
  if (row.status.toLowerCase() === 'completed') {
    return 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100';
  }
  if (row.status.toLowerCase() === 'delayed') {
    return 'border-orange-300/20 bg-orange-300/10 text-orange-100';
  }
  if (row.status.toLowerCase() === 'cancelled') {
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

export default function ReportsPage() {
  const [activeReportTab, setActiveReportTab] = useState<ReportTab>('overview');
  const [exportConfirmOpen, setExportConfirmOpen] = useState(false);
  const [quickRange, setQuickRange] = useState<QuickRange>('this_week');
  const [fromDate, setFromDate] = useState<string>(() => resolveQuickRange('this_week').fromDate);
  const [toDate, setToDate] = useState<string>(() => resolveQuickRange('this_week').toDate);
  const [technicianFilter, setTechnicianFilter] = useState('');
  const [dealershipFilter, setDealershipFilter] = useState('');

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
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load reports.';
      setError(message);
      setOverview(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchOverview({ fromDate, toDate });
  }, []);

  const handleQuickRangeChange = (next: QuickRange) => {
    setQuickRange(next);
    const resolved = resolveQuickRange(next);
    setFromDate(resolved.fromDate);
    setToDate(resolved.toDate);
    void fetchOverview(resolved);
  };

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

  const handleRefresh = () => {
    if (!canRunRange) {
      setError('Start date must be on or before end date.');
      return;
    }
    void fetchOverview({ fromDate, toDate });
  };

  useEffect(() => {
    const handleAdminRefresh = () => {
      if (!canRunRange) {
        setError('Start date must be on or before end date.');
        return;
      }
      void fetchOverview({ fromDate, toDate });
    };

    window.addEventListener(ADMIN_REFRESH_EVENT, handleAdminRefresh);
    return () => {
      window.removeEventListener(ADMIN_REFRESH_EVENT, handleAdminRefresh);
    };
  }, [fromDate, toDate, canRunRange]);

  const handleConfirmedExport = () => {
    if (!overview) return;

    const prefix = `reports_${fromDate}_${toDate}`;
    exportArrayData([
      { metric: 'Average time to assignment', value: overview.dispatch_overview?.average_time_to_assignment ?? '0m' },
      { metric: 'Average time to completion', value: overview.dispatch_overview?.average_time_to_completion ?? '0m' },
      { metric: 'Accepted rate', value: `${overview.dispatch_overview?.accepted_rate ?? 0}%` },
      { metric: 'Refused rate', value: `${overview.dispatch_overview?.refused_rate ?? 0}%` },
      ...overview.dispatch_performance.map((row) => ({ metric: `Status: ${row.status}`, value: row.count, percentage: `${row.percentage}%` })),
      ...(overview.dispatch_overview?.jobs_by_urgency ?? []).map((row) => ({ metric: `Urgency: ${row.status}`, value: row.count, percentage: `${row.percentage}%` })),
    ], `${prefix}_dispatch_overview`, 'excel');
    exportArrayData([
      { metric: 'Total intake records', value: overview.intake_analytics?.total_intake_records ?? 0 },
      { metric: 'Conversion rate', value: `${overview.intake_analytics?.conversion_rate ?? 0}%` },
      { metric: 'Average intake to job creation', value: overview.intake_analytics?.average_time_to_job_creation ?? '0m' },
      ...(overview.intake_analytics?.source_channels ?? []).map((row) => ({ source_channel: row.source_channel, intake_records: row.intake_records, converted_jobs: row.converted_jobs, conversion_rate: `${row.conversion_rate}%` })),
      ...(overview.intake_analytics?.dismissed_reasons ?? []).map((row) => ({ dismissed_reason: row.reason, count: row.count, percentage: `${row.percentage}%` })),
    ], `${prefix}_intake_analytics`, 'excel');
    exportArrayData([
      { metric: 'Total invoice value', value: overview.invoice_metrics?.total_invoice_value ?? overview.kpis.invoice_total },
      { metric: 'Average approval turnaround', value: overview.invoice_metrics?.average_approval_turnaround_time ?? '0m' },
      ...overview.invoice_performance.map((row) => ({ status: row.state, count: row.count, total_amount: row.total_amount })),
      ...(overview.invoice_metrics?.blocked_reasons ?? []).map((row) => ({ blocked_reason: row.reason, count: row.count, percentage: `${row.percentage}%` })),
    ], `${prefix}_invoice_performance`, 'excel');
    exportArrayData(overview.technician_performance.map((row) => ({
      technician: row.name,
      jobs_completed: row.jobs_completed,
      average_completion_time: row.avg_completion_time,
      refusal_rate: `${row.refusal_rate ?? 0}%`,
      on_time_rate: `${row.on_time_rate ?? 0}%`,
      total_service_line_value: row.total_service_line_value ?? row.revenue_generated,
    })), `${prefix}_technician_performance`, 'excel');
    exportArrayData(overview.dealership_performance.map((row) => ({
      location: row.name,
      job_volume: row.job_volume ?? row.jobs_created,
      invoice_value: row.invoice_total,
      most_requested_service_types: (row.most_requested_service_types ?? []).join('; '),
      average_job_completion_time: row.avg_job_completion_time ?? row.avg_resolution_time,
      sla_compliance_rate: `${row.sla_compliance_rate ?? 0}%`,
    })), `${prefix}_location_performance`, 'excel');
    exportArrayData([
      ...capacityUtilizationRows.map((row) => ({ section: 'Utilization by day', day: row.day_of_week, jobs: row.jobs_count, utilization: `${row.technician_utilization}%`, jobs_per_technician: row.jobs_per_technician })),
      ...peakDemandRows.map((row) => ({ section: 'Peak demand window', hour: row.hour, jobs: row.jobs_count })),
      ...understaffedRows.map((row) => ({ section: 'Understaffed period', period: row.period, jobs: row.jobs_count, technicians_available: row.technicians_available, gap: row.gap })),
    ], `${prefix}_capacity_planning`, 'excel');
    setExportConfirmOpen(false);
  };

  const filteredTechnicianRows = useMemo(() => {
    const rows = overview?.technician_performance ?? [];
    const query = technicianFilter.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) => row.name.toLowerCase().includes(query));
  }, [overview, technicianFilter]);

  const filteredDealershipRows = useMemo(() => {
    const rows = overview?.dealership_performance ?? [];
    const query = dealershipFilter.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) => row.name.toLowerCase().includes(query));
  }, [overview, dealershipFilter]);

  const kpis = overview?.kpis;
  const capacityUtilizationRows = overview?.capacity_planning?.utilization_by_day ?? [];
  const peakDemandRows = overview?.capacity_planning?.peak_demand_windows ?? [];
  const understaffedRows = overview?.capacity_planning?.understaffed_periods ?? [];
  const invoicePaidTotal = overview?.invoice_performance
    .filter((row) => row.state.toLowerCase() === 'paid')
    .reduce((sum, row) => sum + Number(row.total_amount || 0), 0) ?? 0;
  const invoiceSentTotal = overview?.invoice_performance
    .filter((row) => row.state.toLowerCase() === 'sent')
    .reduce((sum, row) => sum + Number(row.total_amount || 0), 0) ?? 0;
  const invoicePendingCount = overview?.invoice_performance
    .filter((row) => ['draft', 'pending', 'pending approval', 'overdue'].includes(row.state.toLowerCase()))
    .reduce((sum, row) => sum + Number(row.count || 0), 0) ?? 0;
  const hasReportActivity = Boolean(
    (kpis?.jobs_created ?? 0) ||
    (kpis?.jobs_completed ?? 0) ||
    (kpis?.invoice_total ?? 0) ||
    (kpis?.pending_approvals ?? 0)
  );

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
          <div className="relative flex flex-col gap-5 p-6 xl:flex-row xl:items-end xl:justify-between xl:p-8">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-100">
                <Briefcase className="h-3.5 w-3.5" />
                Operational Analytics
              </div>
              <h1 className="mt-5 text-[2.35rem] font-semibold leading-none tracking-[-0.06em] text-white md:text-[2.8rem]">
                Reports
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-[15px]">
                Track operations and financial performance.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
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
          </div>
        </section>

        <Card className={sectionCardClass}>
          <div className={sectionHeaderClass}>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[220px_minmax(320px,440px)_auto] xl:items-end">
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Quick Range</p>
                <Select value={quickRange} onValueChange={(value) => handleQuickRangeChange(value as QuickRange)}>
                  <SelectTrigger className="h-11 rounded-2xl border-white/10 bg-[#0b1424] text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    <SelectValue placeholder="Range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">{QUICK_RANGE_LABEL.today}</SelectItem>
                    <SelectItem value="this_week">{QUICK_RANGE_LABEL.this_week}</SelectItem>
                    <SelectItem value="this_month">{QUICK_RANGE_LABEL.this_month}</SelectItem>
                    <SelectItem value="last_month">{QUICK_RANGE_LABEL.last_month}</SelectItem>
                    <SelectItem value="this_quarter">{QUICK_RANGE_LABEL.this_quarter}</SelectItem>
                    <SelectItem value="this_year">{QUICK_RANGE_LABEL.this_year}</SelectItem>
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

              <div className="flex flex-wrap items-center justify-start gap-2 xl:justify-end">
                <Button
                  size="sm"
                  className="h-11 rounded-full bg-slate-950 px-5 text-white shadow-[0_12px_30px_rgba(15,23,42,0.18)] hover:bg-slate-800 dark:bg-[#2F8E92] dark:shadow-[0_12px_30px_rgba(47,142,146,0.28)] dark:hover:bg-[#267276]"
                  onClick={handleRefresh}
                  disabled={!canRunRange || loading}
                >
                  {loading ? 'Applying...' : 'Apply Filters'}
                </Button>

                <Button variant="outline" size="sm" className="h-11 gap-2 rounded-full border-white/10 bg-[rgba(255,255,255,0.03)] text-slate-100 shadow-sm hover:bg-[rgba(255,255,255,0.08)]" onClick={() => setExportConfirmOpen(true)} disabled={!overview || loading}>
                  <Download className="w-4 h-4" /> Export Excel
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="h-11 gap-2 rounded-full border-white/10 bg-[rgba(255,255,255,0.03)] text-slate-100 shadow-sm hover:bg-[rgba(255,255,255,0.08)]"
                  onClick={handleRefresh}
                  disabled={!canRunRange || loading}
                  title="Refresh"
                >
                  <RefreshCw className={cn('w-4 h-4 text-blue-600 dark:text-cyan-200', loading && 'animate-spin')} />
                  Refresh
                </Button>
              </div>
            </div>

            {!canRunRange ? (
              <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200">
                Start date must be on or before end date.
              </p>
            ) : null}
          </div>
        </Card>

        {error ? (
          <Card className="rounded-[24px] border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-200">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>{error}</span>
              <Button variant="outline" size="sm" className="border-rose-300/20 bg-transparent text-rose-100 hover:bg-rose-400/10 hover:text-white" onClick={handleRefresh}>
                Retry
              </Button>
            </div>
          </Card>
        ) : null}

        {overview && !loading ? (
          <Card className="rounded-[24px] border border-white/10 bg-[rgba(255,255,255,0.035)] p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100">Report Summary</p>
                <p className="mt-2 text-sm leading-7 text-slate-300">
                  {hasReportActivity
                    ? `Selected range: ${numberFmt.format(kpis?.jobs_created ?? 0)} jobs, ${numberFmt.format(kpis?.jobs_completed ?? 0)} completed jobs, ${currencyFmt.format(kpis?.invoice_total ?? 0)} invoice total, and ${numberFmt.format(kpis?.pending_approvals ?? 0)} pending approvals.`
                    : 'No activity in this range.'}
                </p>
              </div>
              {!hasReportActivity ? (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" className="rounded-full border-white/10 bg-white/[0.04] text-slate-100 hover:bg-white/[0.08]" onClick={() => handleQuickRangeChange('this_month')}>
                    View This Month
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-full border-white/10 bg-white/[0.04] text-slate-100 hover:bg-white/[0.08]" onClick={handleRefresh}>
                    Refresh Data
                  </Button>
                </div>
              ) : null}
            </div>
          </Card>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className={metricCardClass('cyan')}>
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Jobs Created</p>
                  {loading ? <Skeleton className="mt-3 h-8 w-20 bg-white/10" /> : <div className="mt-3 text-[2.15rem] font-semibold leading-none tracking-[-0.06em] text-white">{numberFmt.format(kpis?.jobs_created ?? 0)}</div>}
                  <p className="text-sm text-slate-300">{(kpis?.jobs_created ?? 0) > 0 ? 'New work orders in range' : 'No jobs created in selected range'}</p>
                </div>
                <div className={metricIconClass('cyan')}>
                  <Briefcase className="w-5 h-5" />
                </div>
              </div>
            </div>
          </Card>

          <Card className={metricCardClass('emerald')}>
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Jobs Completed</p>
                  {loading ? <Skeleton className="mt-3 h-8 w-20 bg-white/10" /> : <div className="mt-3 text-[2.15rem] font-semibold leading-none tracking-[-0.06em] text-white">{numberFmt.format(kpis?.jobs_completed ?? 0)}</div>}
                  <p className="text-sm text-slate-300">{(kpis?.jobs_completed ?? 0) > 0 ? 'Closed successfully in range' : 'No completed jobs in selected range'}</p>
                </div>
                <div className={metricIconClass('emerald')}>
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>
            </div>
          </Card>

          <Card className={metricCardClass('violet')}>
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Technician Utilization</p>
                  {loading ? <Skeleton className="mt-3 h-8 w-20 bg-white/10" /> : <div className="mt-3 text-[2.15rem] font-semibold leading-none tracking-[-0.06em] text-white">{percentFmt.format(kpis?.technician_utilization ?? 0)}%</div>}
                  <p className="text-sm text-slate-300">{(kpis?.technician_utilization ?? 0) > 0 ? 'Field capacity actively used' : 'No utilization recorded yet'}</p>
                </div>
                <div className={metricIconClass('violet')}>
                  <Users className="w-5 h-5" />
                </div>
              </div>
            </div>
          </Card>

          <Card className={metricCardClass('amber')}>
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Invoice Total</p>
                  {loading ? <Skeleton className="mt-3 h-8 w-20 bg-white/10" /> : <div className="mt-3 text-[2.15rem] font-semibold leading-none tracking-[-0.06em] text-white">{currencyFmt.format(kpis?.invoice_total ?? 0)}</div>}
                  <p className="text-sm text-slate-300">
                    {(kpis?.invoice_total ?? 0) > 0
                      ? `${currencyFmt.format(invoicePaidTotal)} paid, ${currencyFmt.format(invoiceSentTotal)} sent`
                      : 'No invoice value in selected range'}
                  </p>
                </div>
                <div className={metricIconClass('amber')}>
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
            </div>
          </Card>
        </div>

        <Tabs value={activeReportTab} onValueChange={(value) => setActiveReportTab(value as ReportTab)} className="gap-5">
          <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1 shadow-sm dark:border-white/10 dark:bg-[#0b1424] sm:w-fit">
            {[
              ['overview', 'Overview'],
              ['operations', 'Operations'],
              ['invoices', 'Invoices'],
              ['technicians', 'Technicians'],
              ['locations', 'Locations'],
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
            <Card className={sectionCardClass}>
              <div className={sectionHeaderClass}>
                <h2 className="text-base font-semibold text-slate-950 dark:text-white">Overview</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Selected range: {numberFmt.format(kpis?.jobs_created ?? 0)} jobs created, {numberFmt.format(kpis?.jobs_completed ?? 0)} completed, {currencyFmt.format(kpis?.invoice_total ?? 0)} invoiced, and {numberFmt.format(kpis?.pending_approvals ?? 0)} pending approvals.
                </p>
              </div>
              <div className="grid gap-5 p-6 pt-5 xl:grid-cols-2">
                <div className="space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Job Status Breakdown</p>
                  {loading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-10 w-full bg-white/10" />
                      <Skeleton className="h-10 w-full bg-white/10" />
                    </div>
                  ) : overview?.dispatch_performance.length ? (
                    overview.dispatch_performance.slice(0, 5).map((row) => (
                      <div key={row.status} className="space-y-2 rounded-2xl border border-white/8 bg-[rgba(255,255,255,0.03)] p-3">
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <Badge variant="outline" className={cn(dispatchBadgeTone(row), 'border text-xs')}>{row.status}</Badge>
                          <span className="font-semibold text-slate-950 dark:text-white">{numberFmt.format(row.count)} · {percentFmt.format(row.percentage)}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-white/10">
                          <div className="h-full rounded-full bg-[#2F8E92]" style={{ width: `${Math.max(3, Math.min(100, row.percentage))}%` }} />
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyReportState title="No job status data" description="Try selecting a wider date range." />
                  )}
                </div>

                <div className="space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Invoice Status</p>
                  {loading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-10 w-full bg-white/10" />
                      <Skeleton className="h-10 w-full bg-white/10" />
                    </div>
                  ) : overview?.invoice_performance.length ? (
                    overview.invoice_performance.slice(0, 5).map((row) => {
                      const maxAmount = Math.max(...overview.invoice_performance.map((item) => Number(item.total_amount || 0)), 1);
                      const width = (Number(row.total_amount || 0) / maxAmount) * 100;
                      return (
                        <div key={row.state} className="space-y-2 rounded-2xl border border-white/8 bg-[rgba(255,255,255,0.03)] p-3">
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <Badge variant="outline" className={cn(statusBadgeTone(row), 'border text-xs')}>{row.state}</Badge>
                            <span className="font-semibold text-slate-950 dark:text-white">{currencyFmt.format(row.total_amount)}</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-white/10">
                            <div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.max(3, Math.min(100, width))}%` }} />
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <EmptyReportState title="No invoice status data" description="Try selecting a wider date range." />
                  )}
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="operations" className="space-y-6">
        <div className="pt-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-700 dark:text-cyan-100">Operational Performance</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Operational metrics.</p>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Card className={sectionCardClass}>
            <div className={sectionHeaderClass}>
              <h2 className="text-base font-semibold text-slate-950 dark:text-white">Dispatch Overview</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Speed, acceptance, and urgency.</p>
            </div>
            <div className="space-y-4 p-6 pt-5">
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Avg assignment', overview?.dispatch_overview?.average_time_to_assignment ?? '0m'],
                  ['Avg completion', overview?.dispatch_overview?.average_time_to_completion ?? '0m'],
                  ['Accepted', `${overview?.dispatch_overview?.accepted_rate ?? 0}%`],
                  ['Refused', `${overview?.dispatch_overview?.refused_rate ?? 0}%`],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-white/8 bg-[rgba(255,255,255,0.03)] p-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{label}</p>
                    <p className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">{value}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Jobs by urgency</p>
                {(overview?.dispatch_overview?.jobs_by_urgency ?? []).length ? (
                  overview?.dispatch_overview?.jobs_by_urgency.map((row) => (
                    <div key={row.status} className="flex items-center justify-between rounded-xl border border-white/8 bg-[rgba(255,255,255,0.03)] px-3 py-2 text-sm">
                      <span className="text-slate-700 dark:text-slate-300">{row.status}</span>
                      <span className="font-semibold text-slate-950 dark:text-white">{row.count} ({row.percentage}%)</span>
                    </div>
                  ))
                ) : (
                  <EmptyReportState
                    title="No urgency mix yet"
                    description="No urgency data in this range."
                    action={<Button size="sm" variant="outline" className="rounded-full border-white/10 bg-white/[0.04] text-slate-100 hover:bg-white/[0.08]" onClick={() => handleQuickRangeChange('this_month')}>View This Month</Button>}
                  />
                )}
              </div>
            </div>
          </Card>

          <Card className={sectionCardClass}>
            <div className={sectionHeaderClass}>
              <h2 className="text-base font-semibold text-slate-950 dark:text-white">Intake Analytics</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Sources, conversion, and timing.</p>
            </div>
            <div className="space-y-4 p-6 pt-5">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-white/8 bg-[rgba(255,255,255,0.03)] p-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Records</p>
                  <p className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">{overview?.intake_analytics?.total_intake_records ?? 0}</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-[rgba(255,255,255,0.03)] p-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Convert</p>
                  <p className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">{overview?.intake_analytics?.conversion_rate ?? 0}%</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-[rgba(255,255,255,0.03)] p-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">To job</p>
                  <p className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">{overview?.intake_analytics?.average_time_to_job_creation ?? '0m'}</p>
                </div>
              </div>
              {(overview?.intake_analytics?.source_channels ?? []).length ? (
                overview?.intake_analytics?.source_channels.map((row) => (
                  <div key={row.source_channel} className="rounded-xl border border-white/8 bg-[rgba(255,255,255,0.03)] px-3 py-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-700 dark:text-slate-300">{row.source_channel}</span>
                      <span className="font-semibold text-slate-950 dark:text-white">{row.converted_jobs}/{row.intake_records}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{row.conversion_rate}% conversion</p>
                  </div>
                ))
              ) : (
                <EmptyReportState
                  title="No intake records found"
                  description="No intake records in this range."
                  action={<Button size="sm" variant="outline" className="rounded-full border-white/10 bg-white/[0.04] text-slate-100 hover:bg-white/[0.08]" onClick={handleRefresh}>Refresh Data</Button>}
                />
              )}
              <p className="text-xs text-slate-500">
                Dismissed reason tracking appears here when intake records are dismissed before job conversion.
              </p>
            </div>
          </Card>

          <Card className={cn(sectionCardClass, 'xl:col-span-2')}>
            <div className={sectionHeaderClass}>
              <h2 className="text-base font-semibold text-slate-950 dark:text-white">Capacity Planning</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Utilization and demand windows.</p>
            </div>
            <div className="space-y-4 p-6 pt-5">
              <div className="space-y-2">
                {capacityUtilizationRows.length ? capacityUtilizationRows.map((row) => (
                  <div key={row.day_of_week} className="rounded-xl border border-white/8 bg-[rgba(255,255,255,0.03)] px-3 py-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-700 dark:text-slate-300">{row.day_of_week}</span>
                      <span className="font-semibold text-slate-950 dark:text-white">{row.jobs_count} jobs</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{row.jobs_per_technician} jobs/tech - {row.technician_utilization}% utilization</p>
                  </div>
                )) : (
                  <EmptyReportState
                    title="No capacity data yet"
                    description="No capacity data in this range."
                    action={<Button size="sm" variant="outline" className="rounded-full border-white/10 bg-white/[0.04] text-slate-100 hover:bg-white/[0.08]" onClick={() => handleQuickRangeChange('this_month')}>View This Month</Button>}
                  />
                )}
              </div>
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Peak windows</p>
                <div className="flex flex-wrap gap-2">
                  {peakDemandRows.length ? peakDemandRows.map((row) => (
                    <Badge key={row.hour} variant="outline" className="border-white/10 bg-[rgba(255,255,255,0.04)] text-slate-300">
                      {row.hour} - {row.jobs_count}
                    </Badge>
                  )) : <span className="text-sm text-slate-500 dark:text-slate-400">No peak windows yet.</span>}
                </div>
              </div>
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Understaffed periods</p>
                <div className="flex flex-wrap gap-2">
                  {understaffedRows.length ? understaffedRows.map((row) => (
                    <Badge key={row.period} variant="outline" className="border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-100">
                      {row.period} - gap {row.gap}
                    </Badge>
                  )) : <span className="text-sm text-slate-500 dark:text-slate-400">No understaffed periods detected.</span>}
                </div>
              </div>
            </div>
          </Card>
        </div>

          </TabsContent>

          <TabsContent value="invoices" className="space-y-6">
        <div className="pt-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-700 dark:text-cyan-100">Invoice Performance</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Billing totals and invoice lifecycle.</p>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <Card className={sectionCardClass}>
            <div className={sectionHeaderClass}>
              <h2 className="text-base font-semibold text-slate-950 dark:text-white">Invoice Performance</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Invoice states and blockers.</p>
            </div>
            <div className="p-6 pt-5">
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full bg-white/10" />
                  <Skeleton className="h-10 w-full bg-white/10" />
                  <Skeleton className="h-10 w-full bg-white/10" />
                </div>
              ) : overview?.invoice_performance.length ? (
                <div className="overflow-hidden rounded-[20px] border border-white/8 bg-black/10 shadow-sm">
                  <div className="flex items-start justify-between gap-3 border-b border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0))] px-5 py-4">
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Invoice States</div>
                      <div className="text-sm text-slate-600 dark:text-slate-200">Lifecycle counts and billed totals for the selected report window.</div>
                    </div>
                  <Badge variant="outline" className="rounded-full border-white/10 bg-[rgba(255,255,255,0.04)] px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-300">
                      {overview.invoice_performance.length} states
                    </Badge>
                  </div>
                  <Table>
                    <TableHeader className="sticky top-0 z-10 border-b border-white/10 bg-[linear-gradient(180deg,rgba(11,25,42,0.98),rgba(10,20,35,0.92))] backdrop-blur-xl">
                      <TableRow className="border-white/0 hover:bg-transparent">
                        <TableHead className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">State</TableHead>
                        <TableHead className="text-right text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Count</TableHead>
                        <TableHead className="text-right text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {overview.invoice_performance.map((row, index) => (
                        <TableRow key={row.state} className={cn('border-b border-white/6', index % 2 === 1 && 'bg-[rgba(255,255,255,0.015)]')}>
                          <TableCell>
                            <Badge variant="outline" className={cn(statusBadgeTone(row), 'border text-xs')}>{row.state}</Badge>
                          </TableCell>
                          <TableCell className="text-right text-slate-700 dark:text-slate-200">{numberFmt.format(row.count)}</TableCell>
                          <TableCell className="text-right font-medium text-slate-950 dark:text-white">{currencyFmt.format(row.total_amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {(overview.invoice_metrics?.blocked_reasons ?? []).length ? (
                    <div className="border-t border-white/8 px-5 py-4">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Blocked reasons</p>
                      <div className="flex flex-wrap gap-2">
                        {overview.invoice_metrics?.blocked_reasons.map((row) => (
                          <Badge key={row.reason} variant="outline" className="border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-100">
                            {row.reason}: {row.count}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <EmptyReportState
                  title="No invoice records in this period"
                  description="No invoice activity in this range."
                  action={<Button size="sm" variant="outline" className="rounded-full border-white/10 bg-white/[0.04] text-slate-100 hover:bg-white/[0.08]" onClick={() => handleQuickRangeChange('this_month')}>View This Month</Button>}
                />
              )}
            </div>
          </Card>
        </div>

          </TabsContent>

          <TabsContent value="technicians" className="space-y-6">
        <div className="pt-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-700 dark:text-cyan-100">Team Performance</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Technician activity.</p>
        </div>

        <Card className={sectionCardClass}>
          <div className={cn(sectionHeaderClass, 'flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between')}>
            <div>
              <h2 className="text-base font-semibold text-slate-950 dark:text-white">Technician Performance</h2>
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
          <div className="p-6 pt-5">
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full bg-white/10" />
                <Skeleton className="h-10 w-full bg-white/10" />
                <Skeleton className="h-10 w-full bg-white/10" />
              </div>
            ) : filteredTechnicianRows.length ? (
              <div className="overflow-hidden rounded-[20px] border border-white/8 bg-black/10 shadow-sm">
                <div className="flex items-start justify-between gap-3 border-b border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0))] px-5 py-4">
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Technician Performance Board</div>
                    <div className="text-sm text-slate-600 dark:text-slate-200">Assignment, completion, delay, and revenue metrics by technician.</div>
                  </div>
                  <Badge variant="outline" className="rounded-full border-white/10 bg-[rgba(255,255,255,0.04)] px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-300">
                    {filteredTechnicianRows.length} visible
                  </Badge>
                </div>
                <Table>
                  <TableHeader className="sticky top-0 z-10 border-b border-white/10 bg-[linear-gradient(180deg,rgba(11,25,42,0.98),rgba(10,20,35,0.92))] backdrop-blur-xl">
                    <TableRow className="border-white/0 hover:bg-transparent">
                      <TableHead className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Technician</TableHead>
                      <TableHead className="text-right text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Assigned</TableHead>
                      <TableHead className="text-right text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Completed</TableHead>
                      <TableHead className="text-right text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Avg Time</TableHead>
                      <TableHead className="text-right text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Delays</TableHead>
                      <TableHead className="text-right text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Refusals</TableHead>
                      <TableHead className="text-right text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Refusal Rate</TableHead>
                      <TableHead className="text-right text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">On-Time Rate</TableHead>
                      <TableHead className="text-right text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Service Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTechnicianRows.map((row, index) => (
                      <TableRow key={row.id} className={cn('border-b border-white/6', index % 2 === 1 && 'bg-[rgba(255,255,255,0.015)]')}>
                        <TableCell className="font-medium text-slate-950 dark:text-white">{row.name}</TableCell>
                        <TableCell className="text-right text-slate-700 dark:text-slate-200">{numberFmt.format(row.jobs_assigned)}</TableCell>
                        <TableCell className="text-right text-slate-700 dark:text-slate-200">{numberFmt.format(row.jobs_completed)}</TableCell>
                        <TableCell className="text-right text-slate-700 dark:text-slate-200">{row.avg_completion_time}</TableCell>
                        <TableCell className="text-right text-slate-700 dark:text-slate-200">{numberFmt.format(row.delays_count)}</TableCell>
                        <TableCell className="text-right text-slate-700 dark:text-slate-200">{numberFmt.format(row.refusals_count)}</TableCell>
                        <TableCell className="text-right text-slate-700 dark:text-slate-200">{percentFmt.format(row.refusal_rate ?? 0)}%</TableCell>
                        <TableCell className="text-right text-slate-700 dark:text-slate-200">{percentFmt.format(row.on_time_rate ?? 0)}%</TableCell>
                        <TableCell className="text-right font-medium text-slate-950 dark:text-white">{currencyFmt.format(row.total_service_line_value ?? row.revenue_generated)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : overview?.technician_performance.length ? (
              <EmptyReportState
                title="No technicians match this filter"
                description="Clear the search to view rows."
                action={<Button size="sm" variant="outline" className="rounded-full border-white/10 bg-white/[0.04] text-slate-100 hover:bg-white/[0.08]" onClick={() => setTechnicianFilter('')}>Clear Filter</Button>}
              />
            ) : (
              <EmptyReportState
                title="No technician performance yet"
                description="No technician activity in this range."
                action={<Button size="sm" variant="outline" className="rounded-full border-white/10 bg-white/[0.04] text-slate-100 hover:bg-white/[0.08]" onClick={() => handleQuickRangeChange('this_month')}>View This Month</Button>}
              />
            )}
          </div>
        </Card>

          </TabsContent>

          <TabsContent value="locations" className="space-y-6">
        <div className="pt-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-700 dark:text-cyan-100">Location Performance</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Location activity.</p>
        </div>

        <Card className={sectionCardClass}>
          <div className={cn(sectionHeaderClass, 'flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between')}>
            <div>
              <h2 className="text-base font-semibold text-slate-950 dark:text-white">Location Performance</h2>
              <p className="text-xs text-slate-400">
                Showing {numberFmt.format(filteredDealershipRows.length)} of {numberFmt.format(overview?.dealership_performance.length ?? 0)}
              </p>
            </div>
            <Input
              value={dealershipFilter}
              onChange={(event) => setDealershipFilter(event.target.value)}
              placeholder="Filter dealership..."
              style={reportDarkInputStyle}
              className="h-10 rounded-full border-white/10 text-slate-100 placeholder:text-slate-500 lg:w-72"
            />
          </div>
          <div className="p-6 pt-5">
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full bg-white/10" />
                <Skeleton className="h-10 w-full bg-white/10" />
                <Skeleton className="h-10 w-full bg-white/10" />
              </div>
            ) : filteredDealershipRows.length ? (
              <div className="overflow-hidden rounded-[20px] border border-white/8 bg-black/10 shadow-sm">
                <div className="flex items-start justify-between gap-3 border-b border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0))] px-5 py-4">
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Location Performance Board</div>
                    <div className="text-sm text-slate-600 dark:text-slate-200">Job volume, invoice value, requested services, completion time, and SLA compliance.</div>
                  </div>
                  <Badge variant="outline" className="rounded-full border-white/10 bg-[rgba(255,255,255,0.04)] px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-300">
                    {filteredDealershipRows.length} visible
                  </Badge>
                </div>
                <Table>
                  <TableHeader className="sticky top-0 z-10 border-b border-white/10 bg-[linear-gradient(180deg,rgba(11,25,42,0.98),rgba(10,20,35,0.92))] backdrop-blur-xl">
                    <TableRow className="border-white/0 hover:bg-transparent">
                      <TableHead className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Dealership</TableHead>
                      <TableHead className="text-right text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Job Volume</TableHead>
                      <TableHead className="text-right text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Completed</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Top Services</TableHead>
                      <TableHead className="text-right text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Avg Completion</TableHead>
                      <TableHead className="text-right text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">SLA</TableHead>
                      <TableHead className="text-right text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Total Invoiced</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDealershipRows.map((row, index) => (
                      <TableRow key={row.id} className={cn('border-b border-white/6', index % 2 === 1 && 'bg-[rgba(255,255,255,0.015)]')}>
                        <TableCell className="font-medium text-slate-950 dark:text-white">{row.name}</TableCell>
                        <TableCell className="text-right text-slate-700 dark:text-slate-200">{numberFmt.format(row.job_volume ?? row.jobs_created)}</TableCell>
                        <TableCell className="text-right text-slate-700 dark:text-slate-200">{numberFmt.format(row.jobs_completed)}</TableCell>
                        <TableCell className="text-slate-700 dark:text-slate-200">{(row.most_requested_service_types ?? []).join(', ') || 'No services'}</TableCell>
                        <TableCell className="text-right text-slate-700 dark:text-slate-200">{row.avg_job_completion_time ?? row.avg_resolution_time}</TableCell>
                        <TableCell className="text-right text-slate-700 dark:text-slate-200">{percentFmt.format(row.sla_compliance_rate ?? 0)}%</TableCell>
                        <TableCell className="text-right font-medium text-slate-950 dark:text-white">{currencyFmt.format(row.invoice_total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : overview?.dealership_performance.length ? (
              <EmptyReportState
                title="No locations match this filter"
                description="Clear the search to view rows."
                action={<Button size="sm" variant="outline" className="rounded-full border-white/10 bg-white/[0.04] text-slate-100 hover:bg-white/[0.08]" onClick={() => setDealershipFilter('')}>Clear Filter</Button>}
              />
            ) : (
              <EmptyReportState
                title="No location performance yet"
                description="No location activity in this range."
                action={<Button size="sm" variant="outline" className="rounded-full border-white/10 bg-white/[0.04] text-slate-100 hover:bg-white/[0.08]" onClick={() => handleQuickRangeChange('this_month')}>View This Month</Button>}
              />
            )}
          </div>
        </Card>
          </TabsContent>
        </Tabs>
      </div>
      <Dialog open={exportConfirmOpen} onOpenChange={setExportConfirmOpen}>
        <DialogContent className="w-[calc(100%-1.5rem)] max-w-[32rem] overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,24,39,0.98),rgba(6,17,29,0.98))] p-0 text-white shadow-[0_32px_110px_rgba(0,0,0,0.4)]">
          <DialogHeader className="border-b border-white/10 px-6 pt-6 pb-5">
            <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-100">
              <Download className="h-3.5 w-3.5" />
              Export Setup
            </div>
            <DialogTitle className="text-xl font-semibold text-white">Export reports</DialogTitle>
            <DialogDescription className="text-sm leading-6 text-slate-300">
              This will download Excel files for the selected reporting range.
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 py-5">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-200">
              {activeRangeLabel}
            </div>
          </div>

          <DialogFooter className="border-t border-white/10 px-6 py-4">
            <Button type="button" variant="ghost" className="h-10 rounded-2xl border border-white/10 !bg-[#0b1424] !text-slate-100 hover:!bg-[#122039] hover:!text-white" onClick={() => setExportConfirmOpen(false)}>
              Cancel
            </Button>
            <Button type="button" className="h-10 rounded-2xl bg-gradient-to-r from-[#0ca6a6] to-[#149fcb] px-5 text-white shadow-[0_18px_44px_rgba(12,166,166,0.22)] hover:from-[#11b5b5] hover:to-[#1aaedf]" onClick={handleConfirmedExport}>
              <Download className="mr-2 h-4 w-4" />
              Download Excel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

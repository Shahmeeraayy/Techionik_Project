import { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Download,
  Briefcase,
  CheckCircle2,
  Users,
  DollarSign,
  FileWarning,
  RefreshCw,
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
import { cn } from '@/lib/utils';
import { exportArrayData } from '@/lib/export';
import {
  fetchAdminReportsOverview,
  getStoredAdminToken,
  type BackendDispatchStatusRow,
  type BackendInvoiceStatusRow,
  type BackendReportsOverview,
} from '@/lib/backend-api';

type QuickRange = 'last_7_days' | 'last_30_days' | 'this_month';
const ADMIN_REFRESH_EVENT = 'sm-dispatch:admin-refresh';

const QUICK_RANGE_LABEL: Record<QuickRange, string> = {
  last_7_days: 'Last Week',
  last_30_days: 'Last 30 Days',
  this_month: 'This Month',
};

const numberFmt = new Intl.NumberFormat('en-US');
const percentFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const currencyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const sectionCardClass = 'overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,24,39,0.96),rgba(6,17,29,0.96))] shadow-[0_24px_80px_rgba(0,0,0,0.28)]';
const sectionHeaderClass = 'border-b border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0))] p-6';

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
  if (range === 'last_7_days') {
    from.setDate(to.getDate() - 7);
  } else if (range === 'last_30_days') {
    from.setDate(to.getDate() - 30);
  } else {
    from.setDate(1);
  }

  return {
    fromDate: toDateInputValue(from),
    toDate: toDateInputValue(to),
  };
}

function statusBadgeTone(row: BackendInvoiceStatusRow): string {
  if (row.is_critical) {
    return 'bg-orange-50 border-orange-200 text-orange-700';
  }
  if (row.state.toLowerCase() === 'paid' || row.state.toLowerCase() === 'verified') {
    return 'bg-emerald-50 border-emerald-200 text-emerald-700';
  }
  if (row.state.toLowerCase() === 'sent') {
    return 'bg-blue-50 border-blue-200 text-blue-700';
  }
  return 'bg-gray-50 border-gray-200 text-gray-700';
}

function dispatchBadgeTone(row: BackendDispatchStatusRow): string {
  if (row.status.toLowerCase() === 'completed') {
    return 'bg-emerald-50 border-emerald-200 text-emerald-700';
  }
  if (row.status.toLowerCase() === 'delayed') {
    return 'bg-orange-50 border-orange-200 text-orange-700';
  }
  if (row.status.toLowerCase() === 'cancelled') {
    return 'bg-red-50 border-red-200 text-red-700';
  }
  return 'bg-slate-50 border-slate-200 text-slate-700';
}

export default function ReportsPage() {
  const [quickRange, setQuickRange] = useState<QuickRange>('last_7_days');
  const [fromDate, setFromDate] = useState<string>(() => resolveQuickRange('last_7_days').fromDate);
  const [toDate, setToDate] = useState<string>(() => resolveQuickRange('last_7_days').toDate);
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

  const handleExport = () => {
    if (!overview) return;

    const rows = [
      ...overview.dispatch_performance.map((row) => ({
        section: 'Dispatch Performance',
        label: row.status,
        count: row.count,
        amount: '',
        percentage: `${row.percentage}%`,
      })),
      ...overview.invoice_performance.map((row) => ({
        section: 'Invoice Performance',
        label: row.state,
        count: row.count,
        amount: row.total_amount,
        percentage: '',
      })),
      ...overview.technician_performance.map((row) => ({
        section: 'Technician Performance',
        label: row.name,
        count: row.jobs_completed,
        amount: row.revenue_generated,
        percentage: '',
      })),
      ...overview.dealership_performance.map((row) => ({
        section: 'Dealership Performance',
        label: row.name,
        count: row.jobs_completed,
        amount: row.invoice_total,
        percentage: '',
      })),
    ];

    exportArrayData(rows, `reports_${fromDate}_${toDate}`, 'csv');
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
                <span className="block bg-gradient-to-r from-white via-cyan-100 to-emerald-100 bg-clip-text text-transparent">
                  command deck
                </span>
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-[15px]">
                Monitor dispatch throughput, technician utilization, invoicing performance, and partner activity from one centralized reporting surface.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="outline" className="border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-cyan-100">
                {QUICK_RANGE_LABEL[quickRange]}
              </Badge>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-300">
                Range: {activeRangeLabel}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-300">
                Last updated: {lastUpdated ? lastUpdated.toLocaleTimeString() : '--'}
              </span>
            </div>
          </div>
        </section>

        <Card className={sectionCardClass}>
          <div className={sectionHeaderClass}>
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-[180px_1fr_auto_auto_auto] xl:items-end">
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Quick Range</p>
                <Select value={quickRange} onValueChange={(value) => handleQuickRangeChange(value as QuickRange)}>
                  <SelectTrigger className="h-10 border-white/10 bg-white/[0.04] text-slate-100">
                    <SelectValue placeholder="Range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="last_7_days">{QUICK_RANGE_LABEL.last_7_days}</SelectItem>
                    <SelectItem value="last_30_days">{QUICK_RANGE_LABEL.last_30_days}</SelectItem>
                    <SelectItem value="this_month">{QUICK_RANGE_LABEL.this_month}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Custom Range</p>
                <div className="flex min-h-10 flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  <Input
                    type="date"
                    value={fromDate}
                    onChange={(event) => setFromDate(event.target.value)}
                    className="h-7 min-w-[130px] border-0 bg-transparent px-1 text-xs text-slate-100 shadow-none focus-visible:ring-0"
                  />
                  <span className="text-xs text-slate-400">to</span>
                  <Input
                    type="date"
                    value={toDate}
                    onChange={(event) => setToDate(event.target.value)}
                    className="h-7 min-w-[130px] border-0 bg-transparent px-1 text-xs text-slate-100 shadow-none focus-visible:ring-0"
                  />
                </div>
              </div>

              <Button
                size="sm"
                className="h-10 rounded-full bg-[#2F8E92] px-5 text-white shadow-[0_12px_30px_rgba(47,142,146,0.28)] hover:bg-[#267276]"
                onClick={handleRefresh}
                disabled={!canRunRange || loading}
              >
                {loading ? 'Applying...' : 'Apply Filters'}
              </Button>

              <Button variant="outline" size="sm" className="h-10 gap-2 rounded-full border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]" onClick={handleExport} disabled={!overview || loading}>
                <Download className="w-4 h-4" /> Export CSV
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="h-10 gap-2 rounded-full border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]"
                onClick={handleRefresh}
                disabled={!canRunRange || loading}
                title="Refresh"
              >
                <RefreshCw className={cn('w-4 h-4 text-cyan-200', loading && 'animate-spin')} />
                Refresh
              </Button>
            </div>

            {!canRunRange ? (
              <p className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-xs text-rose-200">
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Card className={metricCardClass('cyan')}>
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Jobs Created</p>
                  {loading ? <Skeleton className="mt-3 h-8 w-20 bg-white/10" /> : <div className="mt-3 text-[2.15rem] font-semibold leading-none tracking-[-0.06em] text-white">{numberFmt.format(kpis?.jobs_created ?? 0)}</div>}
                  <p className="text-sm text-slate-300">New work orders in range</p>
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
                  <p className="text-sm text-slate-300">Closed successfully in range</p>
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
                  <p className="text-sm text-slate-300">Field capacity actively used</p>
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
                  <p className="text-sm text-slate-300">Gross invoiced in selected range</p>
                </div>
                <div className={metricIconClass('amber')}>
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
            </div>
          </Card>

          <Card className={metricCardClass('rose')}>
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Pending Approvals</p>
                  {loading ? <Skeleton className="mt-3 h-8 w-20 bg-white/10" /> : <div className="mt-3 text-[2.15rem] font-semibold leading-none tracking-[-0.06em] text-white">{numberFmt.format(kpis?.pending_approvals ?? 0)}</div>}
                  <p className="text-sm text-slate-300">Invoices still requiring action</p>
                </div>
                <div className={metricIconClass('rose')}>
                  <FileWarning className="w-5 h-5" />
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Card className={sectionCardClass}>
            <div className={sectionHeaderClass}>
              <h2 className="text-base font-semibold text-white">Dispatch Performance</h2>
              <p className="mt-1 text-sm text-slate-300">Job status distribution for selected range</p>
            </div>
            <div className="p-6 pt-5">
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full bg-white/10" />
                  <Skeleton className="h-10 w-full bg-white/10" />
                  <Skeleton className="h-10 w-full bg-white/10" />
                </div>
              ) : overview?.dispatch_performance.length ? (
                <div className="space-y-3">
                  {overview.dispatch_performance.map((row) => (
                    <div key={row.status} className="space-y-2 rounded-[20px] border border-white/8 bg-white/[0.03] p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={cn(dispatchBadgeTone(row), 'border text-xs dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100')}>{row.status}</Badge>
                          <span className="text-sm text-slate-400">{numberFmt.format(row.count)} jobs</span>
                        </div>
                        <span className="text-sm font-semibold text-white">{percentFmt.format(row.percentage)}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-[#2F8E92]"
                          style={{ width: `${Math.max(3, Math.min(100, row.percentage))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">No dispatch records in selected period.</p>
              )}
            </div>
          </Card>

          <Card className={sectionCardClass}>
            <div className={sectionHeaderClass}>
              <h2 className="text-base font-semibold text-white">Invoice Performance</h2>
              <p className="mt-1 text-sm text-slate-300">Invoicing lifecycle states</p>
            </div>
            <div className="p-6 pt-5">
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full bg-white/10" />
                  <Skeleton className="h-10 w-full bg-white/10" />
                  <Skeleton className="h-10 w-full bg-white/10" />
                </div>
              ) : overview?.invoice_performance.length ? (
                <div className="overflow-hidden rounded-[20px] border border-white/8 bg-black/10">
                  <div className="flex items-start justify-between gap-3 border-b border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0))] px-5 py-4">
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Invoice States</div>
                      <div className="text-sm text-slate-200">Lifecycle counts and billed totals for the selected report window.</div>
                    </div>
                    <Badge variant="outline" className="rounded-full border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-300">
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
                        <TableRow key={row.state} className={cn('border-b border-white/6', index % 2 === 1 && 'bg-white/[0.015]')}>
                          <TableCell>
                            <Badge variant="outline" className={cn(statusBadgeTone(row), 'border text-xs dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100')}>{row.state}</Badge>
                          </TableCell>
                          <TableCell className="text-right text-slate-200">{numberFmt.format(row.count)}</TableCell>
                          <TableCell className="text-right font-medium text-white">{currencyFmt.format(row.total_amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-slate-400">No invoice records in selected period.</p>
              )}
            </div>
          </Card>
        </div>

        <Card className={sectionCardClass}>
          <div className={cn(sectionHeaderClass, 'flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between')}>
            <div>
              <h2 className="text-base font-semibold text-white">Technician Performance</h2>
              <p className="text-xs text-slate-400">
                Showing {numberFmt.format(filteredTechnicianRows.length)} of {numberFmt.format(overview?.technician_performance.length ?? 0)}
              </p>
            </div>
            <Input
              value={technicianFilter}
              onChange={(event) => setTechnicianFilter(event.target.value)}
              placeholder="Filter technician..."
              className="h-10 rounded-full border-white/10 bg-white/[0.04] text-slate-100 placeholder:text-slate-500 lg:w-72"
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
              <div className="overflow-hidden rounded-[20px] border border-white/8 bg-black/10">
                <div className="flex items-start justify-between gap-3 border-b border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0))] px-5 py-4">
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Technician Performance Board</div>
                    <div className="text-sm text-slate-200">Assignment, completion, delay, and revenue metrics by technician.</div>
                  </div>
                  <Badge variant="outline" className="rounded-full border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-300">
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
                      <TableHead className="text-right text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTechnicianRows.map((row, index) => (
                      <TableRow key={row.id} className={cn('border-b border-white/6', index % 2 === 1 && 'bg-white/[0.015]')}>
                        <TableCell className="font-medium text-white">{row.name}</TableCell>
                        <TableCell className="text-right text-slate-200">{numberFmt.format(row.jobs_assigned)}</TableCell>
                        <TableCell className="text-right text-slate-200">{numberFmt.format(row.jobs_completed)}</TableCell>
                        <TableCell className="text-right text-slate-200">{row.avg_completion_time}</TableCell>
                        <TableCell className="text-right text-slate-200">{numberFmt.format(row.delays_count)}</TableCell>
                        <TableCell className="text-right text-slate-200">{numberFmt.format(row.refusals_count)}</TableCell>
                        <TableCell className="text-right font-medium text-white">{currencyFmt.format(row.revenue_generated)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : overview?.technician_performance.length ? (
              <p className="text-sm text-slate-400">No technicians match the current filter.</p>
            ) : (
              <p className="text-sm text-slate-400">No technician records found.</p>
            )}
          </div>
        </Card>

        <Card className={sectionCardClass}>
          <div className={cn(sectionHeaderClass, 'flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between')}>
            <div>
              <h2 className="text-base font-semibold text-white">Dealership Overview</h2>
              <p className="text-xs text-slate-400">
                Showing {numberFmt.format(filteredDealershipRows.length)} of {numberFmt.format(overview?.dealership_performance.length ?? 0)}
              </p>
            </div>
            <Input
              value={dealershipFilter}
              onChange={(event) => setDealershipFilter(event.target.value)}
              placeholder="Filter dealership..."
              className="h-10 rounded-full border-white/10 bg-white/[0.04] text-slate-100 placeholder:text-slate-500 lg:w-72"
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
              <div className="overflow-hidden rounded-[20px] border border-white/8 bg-black/10">
                <div className="flex items-start justify-between gap-3 border-b border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0))] px-5 py-4">
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Dealership Performance Board</div>
                    <div className="text-sm text-slate-200">Created, completed, flagged, and invoiced volume by dealership.</div>
                  </div>
                  <Badge variant="outline" className="rounded-full border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-300">
                    {filteredDealershipRows.length} visible
                  </Badge>
                </div>
                <Table>
                  <TableHeader className="sticky top-0 z-10 border-b border-white/10 bg-[linear-gradient(180deg,rgba(11,25,42,0.98),rgba(10,20,35,0.92))] backdrop-blur-xl">
                    <TableRow className="border-white/0 hover:bg-transparent">
                      <TableHead className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Dealership</TableHead>
                      <TableHead className="text-right text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Created</TableHead>
                      <TableHead className="text-right text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Completed</TableHead>
                      <TableHead className="text-right text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Avg Res. Time</TableHead>
                      <TableHead className="text-right text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Flags</TableHead>
                      <TableHead className="text-right text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Total Invoiced</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDealershipRows.map((row, index) => (
                      <TableRow key={row.id} className={cn('border-b border-white/6', index % 2 === 1 && 'bg-white/[0.015]')}>
                        <TableCell className="font-medium text-white">{row.name}</TableCell>
                        <TableCell className="text-right text-slate-200">{numberFmt.format(row.jobs_created)}</TableCell>
                        <TableCell className="text-right text-slate-200">{numberFmt.format(row.jobs_completed)}</TableCell>
                        <TableCell className="text-right text-slate-200">{row.avg_resolution_time}</TableCell>
                        <TableCell className="text-right text-slate-200">{numberFmt.format(row.attention_flags)}</TableCell>
                        <TableCell className="text-right font-medium text-white">{currencyFmt.format(row.invoice_total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : overview?.dealership_performance.length ? (
              <p className="text-sm text-slate-400">No dealerships match the current filter.</p>
            ) : (
              <p className="text-sm text-slate-400">No dealership records found.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

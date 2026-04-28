import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Briefcase,
  Building2,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileCheck,
  FileClock,
  FileText,
  PlayCircle,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  fetchAdminDealerships,
  fetchAdminJobs,
  fetchAdminReportsOverview,
  fetchAdminTechnicians,
  fetchInvoices,
  getStoredAdminToken,
  type BackendAdminJob,
  type BackendDealership,
  type BackendInvoice,
  type BackendReportsOverview,
  type BackendTechnicianListItem,
} from '@/lib/backend-api';

type DashboardCardTone = 'green' | 'blue' | 'orange' | 'red';

type DashboardCard = {
  id: string;
  label: string;
  value: number;
  icon: React.ElementType;
  tone: DashboardCardTone;
  navigateTo: string;
};

type DashboardAlert = {
  id: string;
  title: string;
  description: string;
  tone: 'warning' | 'critical' | 'info';
};

type ActivityRow = {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  badge: string;
  tone: 'info' | 'success' | 'warning';
};

type DashboardSnapshot = {
  cards: DashboardCard[];
  alerts: DashboardAlert[];
  activity: ActivityRow[];
  stats: {
    jobs: number;
    technicians: number;
    dealerships: number;
    invoices: number;
  };
};

const ADMIN_REFRESH_EVENT = 'sm-dispatch:admin-refresh';
const displayFontStyle: CSSProperties = {
  fontFamily: '"Space Grotesk", "Sora", system-ui, sans-serif',
};
const bodyFontStyle: CSSProperties = {
  fontFamily: '"Manrope", "Inter", system-ui, sans-serif',
};

function toDateInputValue(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function timeAgo(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Unknown';
  }

  const diffMs = Date.now() - parsed.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function titleCaseStatus(status: string): string {
  return status
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function metricCardClasses(tone: DashboardCardTone): string {
  return cn(
    'group relative overflow-hidden rounded-[24px] border px-5 py-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_60px_rgba(0,0,0,0.28)]',
    tone === 'green' && 'border-emerald-400/20 bg-[linear-gradient(180deg,rgba(8,34,30,0.96),rgba(7,24,25,0.96))] hover:border-emerald-300/35',
    tone === 'orange' && 'border-amber-400/20 bg-[linear-gradient(180deg,rgba(36,24,14,0.96),rgba(24,18,14,0.96))] hover:border-amber-300/35',
    tone === 'red' && 'border-rose-400/20 bg-[linear-gradient(180deg,rgba(42,16,25,0.96),rgba(28,15,23,0.96))] hover:border-rose-300/35',
    tone === 'blue' && 'border-cyan-400/20 bg-[linear-gradient(180deg,rgba(9,29,48,0.96),rgba(8,20,38,0.96))] hover:border-cyan-300/35',
  );
}

function metricTopLineClasses(tone: DashboardCardTone): string {
  if (tone === 'green') return 'via-emerald-300/80';
  if (tone === 'orange') return 'via-amber-300/80';
  if (tone === 'red') return 'via-rose-300/80';
  return 'via-cyan-300/80';
}

function metricIconClasses(tone: DashboardCardTone): string {
  if (tone === 'green') return 'border border-emerald-300/20 bg-emerald-300/12 text-emerald-100';
  if (tone === 'orange') return 'border border-amber-300/20 bg-amber-300/12 text-amber-100';
  if (tone === 'red') return 'border border-rose-300/20 bg-rose-300/12 text-rose-100';
  return 'border border-cyan-300/20 bg-cyan-300/12 text-cyan-100';
}

function metricValueClasses(tone: DashboardCardTone): string {
  if (tone === 'green') return 'text-emerald-50';
  if (tone === 'orange') return 'text-amber-50';
  if (tone === 'red') return 'text-rose-50';
  return 'text-white';
}

function metricQueueClasses(tone: DashboardCardTone): string {
  if (tone === 'green') return 'text-emerald-200/80';
  if (tone === 'orange') return 'text-amber-200/80';
  if (tone === 'red') return 'text-rose-200/80';
  return 'text-cyan-200/80';
}

function alertPanelClasses(tone: DashboardAlert['tone']): string {
  return cn(
    'rounded-[22px] border px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
    tone === 'critical' && 'border-rose-400/20 bg-rose-400/10',
    tone === 'warning' && 'border-amber-400/20 bg-amber-400/10',
    tone === 'info' && 'border-emerald-400/20 bg-emerald-400/10',
  );
}

function alertIconClasses(tone: DashboardAlert['tone']): string {
  if (tone === 'critical') return 'text-rose-200';
  if (tone === 'warning') return 'text-amber-200';
  return 'text-emerald-200';
}

function activityBadgeClasses(tone: ActivityRow['tone']): string {
  return cn(
    'border text-[11px] font-semibold uppercase tracking-[0.18em]',
    tone === 'success' && 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100',
    tone === 'warning' && 'border-amber-300/20 bg-amber-300/10 text-amber-100',
    tone === 'info' && 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100',
  );
}

function activityDotClasses(tone: ActivityRow['tone']): string {
  if (tone === 'success') return 'bg-emerald-300 shadow-[0_0_0_6px_rgba(52,211,153,0.12)]';
  if (tone === 'warning') return 'bg-amber-300 shadow-[0_0_0_6px_rgba(251,191,36,0.12)]';
  return 'bg-cyan-300 shadow-[0_0_0_6px_rgba(34,211,238,0.12)]';
}

function buildSnapshot(input: {
  reports: BackendReportsOverview;
  jobs: BackendAdminJob[];
  invoices: BackendInvoice[];
  technicians: BackendTechnicianListItem[];
  dealerships: BackendDealership[];
}): DashboardSnapshot {
  const { reports, jobs, invoices, technicians, dealerships } = input;
  const pendingReviewCount = jobs.filter((job) => (
    ['admin_preview', 'pending_admin_confirmation', 'pending_review'].includes(job.status)
  )).length;
  const awaitingTechAcceptanceCount = jobs.filter((job) => job.status === 'pending').length;
  const inProgressCount = jobs.filter((job) => job.status === 'in_progress').length;
  const delayedCount = jobs.filter((job) => job.status === 'delayed').length;
  const overdueInvoices = invoices.filter((invoice) => invoice.status === 'overdue').length;
  const draftInvoices = invoices.filter((invoice) => invoice.status === 'draft').length;
  const createdInvoices = invoices.filter((invoice) => invoice.status !== 'draft' && invoice.status !== 'cancelled').length;
  const attentionRequiredCount = pendingReviewCount + delayedCount + overdueInvoices;

  const cards: DashboardCard[] = [
    { id: 'jobs-today', label: 'Jobs Today', value: reports.kpis.jobs_created, icon: ClipboardList, tone: 'blue', navigateTo: '/admin/jobs?status=today' },
    { id: 'pending-review', label: 'Pending Review', value: pendingReviewCount, icon: FileCheck, tone: 'orange', navigateTo: '/admin/jobs?status=pending_review' },
    { id: 'awaiting-tech', label: 'Awaiting Tech Acceptance', value: awaitingTechAcceptanceCount, icon: Users, tone: 'orange', navigateTo: '/admin/jobs?status=awaiting_tech' },
    { id: 'in-progress', label: 'In Progress', value: inProgressCount, icon: PlayCircle, tone: 'blue', navigateTo: '/admin/jobs?status=in_progress' },
    { id: 'completed-today', label: 'Completed Today', value: reports.kpis.jobs_completed, icon: CheckCircle2, tone: 'green', navigateTo: '/admin/jobs?status=completed' },
    { id: 'approval-required', label: 'Invoice Approval Required', value: reports.kpis.pending_approvals, icon: ShieldAlert, tone: 'orange', navigateTo: '/admin/invoice-approvals' },
    { id: 'invoice-creating', label: 'Invoice Creating', value: draftInvoices, icon: FileClock, tone: 'blue', navigateTo: '/admin/invoice-history' },
    { id: 'invoice-created', label: 'Invoice Created', value: createdInvoices, icon: FileText, tone: 'green', navigateTo: '/admin/invoice-history' },
    { id: 'attention-required', label: 'Attention Required', value: attentionRequiredCount, icon: AlertTriangle, tone: attentionRequiredCount > 0 ? 'red' : 'green', navigateTo: '/admin/jobs?status=attention_required' },
  ];

  const alerts: DashboardAlert[] = [];
  if (pendingReviewCount > 0) {
    alerts.push({
      id: 'pending-review',
      title: 'Jobs are waiting for admin review',
      description: `${pendingReviewCount} job(s) are still in the admin preview or review pipeline.`,
      tone: 'warning',
    });
  }
  if (reports.kpis.pending_approvals > 0) {
    alerts.push({
      id: 'invoice-approvals',
      title: 'Invoices need approval',
      description: `${reports.kpis.pending_approvals} completed job(s) are ready for invoice approval.`,
      tone: 'warning',
    });
  }
  if (overdueInvoices > 0) {
    alerts.push({
      id: 'overdue-invoices',
      title: 'Overdue invoices detected',
      description: `${overdueInvoices} invoice(s) are currently overdue and need attention.`,
      tone: 'critical',
    });
  }
  if (alerts.length === 0) {
    alerts.push({
      id: 'all-clear',
      title: 'Operational queue looks clean',
      description: 'No overdue invoices or review bottlenecks are currently blocking the dashboard.',
      tone: 'info',
    });
  }
  const activity = jobs
    .slice()
    .sort((left, right) => (
      new Date(right.updated_at || right.created_at).getTime() - new Date(left.updated_at || left.created_at).getTime()
    ))
    .slice(0, 10)
    .map((job) => {
      const statusLabel = titleCaseStatus(job.status);
      const isCompleted = job.status === 'completed';
      const isWarning = ['pending_review', 'delayed', 'cancelled'].includes(job.status);
      return {
        id: job.id,
        title: `${statusLabel}: ${job.job_code}`,
        description: `${job.dealership_name || 'Unknown dealership'}${job.service_type ? ` • ${job.service_type}` : ''}${job.vehicle ? ` • ${job.vehicle}` : ''}`,
        timestamp: timeAgo(job.updated_at || job.created_at),
        badge: statusLabel,
        tone: isCompleted ? 'success' : (isWarning ? 'warning' : 'info'),
      } satisfies ActivityRow;
    });

  return {
    cards,
    alerts,
    activity,
    stats: {
      jobs: jobs.length,
      technicians: technicians.length,
      dealerships: dealerships.length,
      invoices: invoices.length,
    },
  };
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-[280px] w-full rounded-[30px]" />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5 gap-4">
        {Array.from({ length: 9 }).map((_, index) => (
          <Skeleton key={index} className="h-40 w-full rounded-[24px]" />
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-[1.65fr_1fr] gap-6">
        <Skeleton className="h-[540px] w-full rounded-[28px]" />
        <div className="space-y-6">
          <Skeleton className="h-[260px] w-full rounded-[28px]" />
          <Skeleton className="h-[260px] w-full rounded-[28px]" />
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);

  const todayRange = useMemo(() => {
    const today = toDateInputValue(new Date());
    return { fromDate: today, toDate: today };
  }, []);

  const loadDashboard = useCallback(async (options?: { background?: boolean }) => {
    const background = options?.background ?? false;
    if (background) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    const token = getStoredAdminToken();
    if (!token) {
      setError('Admin session missing. Please sign in again.');
      setSnapshot(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setError(null);

    try {
      const [reports, jobs, invoices, technicians, dealerships] = await Promise.all([
        fetchAdminReportsOverview(token, {
          from_date: todayRange.fromDate,
          to_date: todayRange.toDate,
        }),
        fetchAdminJobs(token),
        fetchInvoices(token),
        fetchAdminTechnicians(token),
        fetchAdminDealerships(token),
      ]);

      setSnapshot(buildSnapshot({ reports, jobs, invoices, technicians, dealerships }));
      setLastUpdated(new Date());
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load dashboard data.');
      setSnapshot(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [todayRange.fromDate, todayRange.toDate]);

  useEffect(() => {
    void loadDashboard();

    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') {
        void loadDashboard({ background: true });
      }
    }, 30000);

    const handleFocus = () => {
      void loadDashboard({ background: true });
    };
    const handleRefresh = () => {
      void loadDashboard({ background: true });
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener(ADMIN_REFRESH_EVENT, handleRefresh);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener(ADMIN_REFRESH_EVENT, handleRefresh);
    };
  }, [loadDashboard]);

  const leadMetrics = useMemo(() => {
    if (!snapshot) {
      return [];
    }

    const lookup = new Map(snapshot.cards.map((card) => [card.id, card]));
    return [
      lookup.get('completed-today'),
      lookup.get('pending-review'),
      lookup.get('approval-required'),
    ].filter((item): item is DashboardCard => Boolean(item));
  }, [snapshot]);

  const overviewTiles = useMemo(() => {
    if (!snapshot) {
      return [];
    }

    return [
      {
        id: 'jobs',
        label: 'Jobs in System',
        value: snapshot.stats.jobs,
        description: 'Live dispatch records across the backend.',
        icon: Briefcase,
      },
      {
        id: 'technicians',
        label: 'Technician Roster',
        value: snapshot.stats.technicians,
        description: 'Active field operators currently on file.',
        icon: Users,
      },
      {
        id: 'dealerships',
        label: 'Dealership Coverage',
        value: snapshot.stats.dealerships,
        description: 'Partner locations wired into operations.',
        icon: Building2,
      },
      {
        id: 'invoices',
        label: 'Invoice Ledger',
        value: snapshot.stats.invoices,
        description: 'Tracked invoices available in the backend.',
        icon: FileText,
      },
    ];
  }, [snapshot]);

  const quickActions = useMemo(() => ([
    {
      id: 'jobs',
      label: 'View All Jobs',
      description: 'Open the dispatch board, status queues, and live scheduling.',
      icon: Briefcase,
      onClick: () => navigate('/admin/jobs'),
    },
    {
      id: 'approvals',
      label: 'Invoice Approvals',
      description: 'Review completed jobs that are waiting for invoice approval.',
      icon: ShieldAlert,
      onClick: () => navigate('/admin/invoice-approvals'),
    },
    {
      id: 'technicians',
      label: 'Technician Roster',
      description: 'Manage field staff coverage, status, and account readiness.',
      icon: Users,
      onClick: () => navigate('/admin/technicians'),
    },
    {
      id: 'dealerships',
      label: 'Dealership Directory',
      description: 'Review partner locations and sync operational details.',
      icon: Building2,
      onClick: () => navigate('/admin/dealerships'),
    },
  ]), [navigate]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="relative w-full pb-10" style={bodyFontStyle}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] rounded-[34px] bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),rgba(34,211,238,0)_34%),radial-gradient(circle_at_top_right,rgba(52,211,153,0.1),rgba(52,211,153,0)_28%)]" />
      <div className="pointer-events-none absolute left-10 top-10 h-48 w-48 rounded-full bg-cyan-400/8 blur-3xl" />
      <div className="pointer-events-none absolute right-10 top-20 h-56 w-56 rounded-full bg-emerald-400/8 blur-3xl" />

      <div className="relative space-y-6">
        <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(7,25,42,0.98),rgba(6,18,32,0.98))] shadow-[0_34px_120px_rgba(0,0,0,0.34)]">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:120px_120px] opacity-20" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/70 to-transparent" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(47,142,146,0.14),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.12),transparent_26%)]" />

          <div className="relative grid gap-6 p-6 xl:grid-cols-[1.2fr_0.85fr] xl:p-8">
            <div>
              <div
                className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-100"
                style={displayFontStyle}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Operations Pulse
              </div>

              <h1
                className="mt-5 text-[clamp(2.1rem,4vw,4.2rem)] font-semibold leading-[0.92] tracking-[-0.07em] text-white"
                style={displayFontStyle}
              >
                Dispatch
                <span className="block bg-gradient-to-r from-white via-cyan-100 to-emerald-100 bg-clip-text text-transparent">
                  command dashboard
                </span>
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-[15px]">
                Live operational metrics from the Neon-backed admin APIs, styled like a real control room instead of a generic table wall.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                {leadMetrics.map((metric) => (
                  <div
                    key={metric.id}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                  >
                    <span className="text-slate-400">{metric.label}</span>
                    <span className="ml-2 font-semibold text-white">{metric.value}</span>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-300">
                  <Clock3 className="h-4 w-4 text-cyan-200" />
                  Last sync {lastUpdated ? lastUpdated.toLocaleTimeString() : '--'}
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm text-emerald-100">
                  <Activity className="h-4 w-4" />
                  Live backend session
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {overviewTiles.map((tile) => (
                <div
                  key={tile.id}
                  className="relative overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,31,48,0.94),rgba(8,23,37,0.94))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                        {tile.label}
                      </p>
                      <div className="mt-3 text-[2.15rem] font-semibold leading-none tracking-[-0.06em] text-white" style={displayFontStyle}>
                        {tile.value}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/10 p-2.5 text-cyan-100">
                      <tile.icon className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-400">{tile.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative border-t border-white/10 px-6 py-5 xl:px-8">
            {error ? (
              <div className="rounded-[22px] border border-rose-400/20 bg-rose-400/10 px-4 py-4 text-sm text-rose-100">
                {error}
              </div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-3">
                {snapshot?.alerts.map((alert) => (
                  <div key={alert.id} className={alertPanelClasses(alert.tone)}>
                    <div className="flex items-start gap-3">
                      {alert.tone === 'critical' ? <AlertCircle className={cn('mt-0.5 h-5 w-5', alertIconClasses(alert.tone))} /> : null}
                      {alert.tone === 'warning' ? <AlertTriangle className={cn('mt-0.5 h-5 w-5', alertIconClasses(alert.tone))} /> : null}
                      {alert.tone === 'info' ? <CheckCircle2 className={cn('mt-0.5 h-5 w-5', alertIconClasses(alert.tone))} /> : null}
                      <div>
                        <p className="text-sm font-semibold text-white">{alert.title}</p>
                        <p className="mt-1 text-sm leading-6 text-slate-300">{alert.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-white" style={displayFontStyle}>
                Live queue
              </h2>
              <p className="text-sm text-slate-400">
                Fast entry points into the operational states that matter most right now.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-10 gap-2 rounded-full border-white/10 bg-white/[0.03] px-4 text-slate-200 hover:bg-white/[0.08] hover:text-white"
              onClick={() => void loadDashboard({ background: true })}
              title="Refresh dashboard"
              disabled={refreshing}
            >
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
              Refresh dashboard
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5 gap-4">
            {snapshot?.cards.map((card) => (
              <button
                key={card.id}
                type="button"
                className={metricCardClasses(card.tone)}
                onClick={() => navigate(card.navigateTo)}
              >
                <div className={cn('pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent', metricTopLineClasses(card.tone))} />
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                      {card.label}
                    </p>
                    <div
                      className={cn('mt-4 text-[2.8rem] font-semibold leading-none tracking-[-0.07em]', metricValueClasses(card.tone))}
                      style={displayFontStyle}
                    >
                      {card.value}
                    </div>
                  </div>
                  <div className={cn('rounded-2xl p-2.5', metricIconClasses(card.tone))}>
                    <card.icon className="h-4 w-4" />
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between">
                  <span className={cn('text-sm font-medium', metricQueueClasses(card.tone))}>
                    Open queue
                  </span>
                  <ArrowRight className="h-4 w-4 text-white/55 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-white" />
                </div>
              </button>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 2xl:grid-cols-[1.6fr_1fr] gap-6">
          <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,23,38,0.98),rgba(7,18,31,0.98))] shadow-[0_28px_90px_rgba(0,0,0,0.3)]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/60 to-transparent" />
            <div className="flex items-center justify-between px-6 pb-4 pt-6">
              <div>
                <h2 className="text-xl font-semibold text-white" style={displayFontStyle}>
                  Recent activity
                </h2>
                <p className="text-sm text-slate-400">
                  Latest job movement coming in from the backend session.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 rounded-full text-cyan-200 hover:bg-white/[0.05] hover:text-white"
                onClick={() => navigate('/admin/jobs')}
              >
                View jobs
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>

            <ScrollArea className="h-[560px]">
              <div className="px-6 pb-6">
                {snapshot?.activity.length ? (
                  <div className="space-y-4">
                    {snapshot.activity.map((event) => (
                      <div
                        key={event.id}
                        className="rounded-[22px] border border-white/10 bg-white/[0.03] px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                      >
                        <div className="flex items-start gap-4">
                          <div className={cn('mt-1 h-2.5 w-2.5 rounded-full', activityDotClasses(event.tone))} />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-white">{event.title}</p>
                                <p className="mt-2 text-sm leading-6 text-slate-400">{event.description}</p>
                              </div>
                              <Badge variant="outline" className={activityBadgeClasses(event.tone)}>
                                {event.badge}
                              </Badge>
                            </div>
                            <div className="mt-4 text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
                              {event.timestamp}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[22px] border border-white/10 bg-white/[0.03] px-5 py-6 text-sm text-slate-400">
                    No recent activity found.
                  </div>
                )}
              </div>
            </ScrollArea>
          </section>

          <div className="space-y-6">
            <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,23,38,0.98),rgba(7,18,31,0.98))] p-6 shadow-[0_28px_90px_rgba(0,0,0,0.3)]">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/60 to-transparent" />
              <div>
                <h2 className="text-xl font-semibold text-white" style={displayFontStyle}>
                  Quick actions
                </h2>
                <p className="text-sm text-slate-400">
                  Jump directly into the operational screens you use the most.
                </p>
              </div>

              <div className="mt-5 space-y-3">
                {quickActions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    onClick={action.onClick}
                    className="group flex w-full items-start gap-4 rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-4 text-left transition-all duration-200 hover:border-cyan-300/25 hover:bg-white/[0.06]"
                  >
                    <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/10 p-2.5 text-cyan-100">
                      <action.icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-white">{action.label}</p>
                        <ArrowRight className="h-4 w-4 text-white/45 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-white" />
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-400">{action.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,23,38,0.98),rgba(7,18,31,0.98))] p-6 shadow-[0_28px_90px_rgba(0,0,0,0.3)]">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-200/60 to-transparent" />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-white" style={displayFontStyle}>
                    System health
                  </h2>
                  <p className="text-sm text-slate-400">
                    Backend counts and dispatch surface readiness at a glance.
                  </p>
                </div>
                <div className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-100">
                  Live
                </div>
              </div>

              <div className="mt-5 rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                {[
                  { label: 'Jobs in DB', value: snapshot?.stats.jobs ?? 0 },
                  { label: 'Technicians', value: snapshot?.stats.technicians ?? 0 },
                  { label: 'Dealerships', value: snapshot?.stats.dealerships ?? 0 },
                  { label: 'Invoices', value: snapshot?.stats.invoices ?? 0 },
                ].map((item, index) => (
                  <div
                    key={item.label}
                    className={cn(
                      'flex items-center justify-between py-3 text-sm',
                      index !== 0 && 'border-t border-white/8',
                    )}
                  >
                    <span className="text-slate-400">{item.label}</span>
                    <span className="font-semibold text-white">{item.value}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                    Sync status
                  </p>
                  <p className="mt-2 text-sm text-slate-300">
                    Dashboard is reading from the active admin backend session.
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="border-emerald-300/20 bg-emerald-300/10 text-emerald-100"
                >
                  Backend live
                </Badge>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

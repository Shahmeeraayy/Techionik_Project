import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
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
  FileCheck,
  FileClock,
  FileText,
  PlayCircle,
  Plus,
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
  tone: 'info' | 'success' | 'warning' | 'critical';
};

type DashboardSnapshot = {
  cards: DashboardCard[];
  alerts: DashboardAlert[];
  activity: ActivityRow[];
  technicians: BackendTechnicianListItem[];
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
    'group relative overflow-hidden rounded-[24px] border px-5 py-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_60px_rgba(15,23,42,0.08)] dark:hover:shadow-[0_24px_60px_rgba(0,0,0,0.28)]',
    tone === 'green' && 'border-emerald-200 bg-[linear-gradient(180deg,#ffffff,#f7fcfa)] hover:border-emerald-300 dark:border-emerald-400/20 dark:bg-[linear-gradient(180deg,rgba(8,34,30,0.96),rgba(7,24,25,0.96))] dark:hover:border-emerald-300/35',
    tone === 'orange' && 'border-amber-200 bg-[linear-gradient(180deg,#ffffff,#fdf9f4)] hover:border-amber-300 dark:border-amber-400/20 dark:bg-[linear-gradient(180deg,rgba(36,24,14,0.96),rgba(24,18,14,0.96))] dark:hover:border-amber-300/35',
    tone === 'red' && 'border-rose-200 bg-[linear-gradient(180deg,#ffffff,#fdf7f8)] hover:border-rose-300 dark:border-rose-400/20 dark:bg-[linear-gradient(180deg,rgba(42,16,25,0.96),rgba(28,15,23,0.96))] dark:hover:border-rose-300/35',
    tone === 'blue' && 'border-slate-200 bg-[linear-gradient(180deg,#ffffff,#f8fafc)] hover:border-slate-300 dark:border-cyan-400/20 dark:bg-[linear-gradient(180deg,rgba(9,29,48,0.96),rgba(8,20,38,0.96))] dark:hover:border-cyan-300/35',
  );
}

function metricTopLineClasses(tone: DashboardCardTone): string {
  if (tone === 'green') return 'via-emerald-400/55 dark:via-emerald-300/80';
  if (tone === 'orange') return 'via-amber-400/55 dark:via-amber-300/80';
  if (tone === 'red') return 'via-rose-400/55 dark:via-rose-300/80';
  return 'via-slate-900/35 dark:via-cyan-300/80';
}

function metricIconClasses(tone: DashboardCardTone): string {
  if (tone === 'green') return 'border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-300/20 dark:bg-emerald-300/12 dark:text-emerald-100';
  if (tone === 'orange') return 'border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-300/20 dark:bg-amber-300/12 dark:text-amber-100';
  if (tone === 'red') return 'border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-300/20 dark:bg-rose-300/12 dark:text-rose-100';
  return 'border border-slate-200 bg-slate-100 text-slate-700 dark:border-cyan-300/20 dark:bg-cyan-300/12 dark:text-cyan-100';
}

function metricValueClasses(tone: DashboardCardTone): string {
  if (tone === 'green') return 'text-emerald-950 dark:text-emerald-50';
  if (tone === 'orange') return 'text-amber-950 dark:text-amber-50';
  if (tone === 'red') return 'text-rose-950 dark:text-rose-50';
  return 'text-slate-900 dark:text-white';
}

function metricQueueClasses(tone: DashboardCardTone): string {
  if (tone === 'green') return 'text-emerald-700 dark:text-emerald-200/80';
  if (tone === 'orange') return 'text-amber-700 dark:text-amber-200/80';
  if (tone === 'red') return 'text-rose-700 dark:text-rose-200/80';
  return 'text-slate-600 dark:text-cyan-200/80';
}

function activityBadgeClasses(tone: ActivityRow['tone']): string {
  return cn(
    'border text-[11px] font-semibold uppercase tracking-[0.18em]',
    tone === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-300/20 dark:bg-emerald-300/10 dark:text-emerald-100',
    tone === 'warning' && 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-100',
    tone === 'info' && 'border-slate-200 bg-slate-50 text-slate-700 dark:border-cyan-300/20 dark:bg-cyan-300/10 dark:text-cyan-100',
  );
}

function activityDotColor(tone: ActivityRow['tone']): string {
  if (tone === 'success') return '#34d399';
  if (tone === 'warning') return '#fbbf24';
  if (tone === 'critical') return '#f87171';
  return '#22d3ee';
}

function buildSnapshot(input: {
  reports: BackendReportsOverview;
  jobs: BackendAdminJob[];
  invoices: BackendInvoice[];
  technicians: BackendTechnicianListItem[];
  dealerships: BackendDealership[];
}): DashboardSnapshot {
  const { reports, jobs, invoices, technicians, dealerships } = input;
  const jobsInProgressCount = jobs.filter((job) => ['in_progress', 'accepted', 'started'].includes(job.status)).length;
  const jobsRequiringAttentionCount = jobs.filter((job) => (
    ['admin_preview', 'pending_admin_confirmation', 'delayed', 'cancelled'].includes(job.status)
  )).length;
  const blockedInvoicesCount = invoices.filter((invoice) => invoice.status === 'overdue').length;
  const techniciansOnlineCount = technicians.filter((tech) => tech.effective_availability && !tech.on_leave_now).length;
  const activeLocationsCount = dealerships.filter((dealer) => dealer.status === 'active').length;

  const cards: DashboardCard[] = [
    { id: 'jobs-created-today', label: 'Jobs Created Today', value: reports.kpis.jobs_created, icon: ClipboardList, tone: 'blue', navigateTo: '/admin/jobs?status=today' },
    { id: 'jobs-in-progress', label: 'Jobs In Progress', value: jobsInProgressCount, icon: PlayCircle, tone: 'blue', navigateTo: '/admin/jobs?status=in_progress' },
    { id: 'jobs-completed-today', label: 'Jobs Completed Today', value: reports.kpis.jobs_completed, icon: CheckCircle2, tone: 'green', navigateTo: '/admin/jobs?status=completed' },
    { id: 'pending-invoice-approvals', label: 'Pending Invoice Approvals', value: reports.kpis.pending_approvals, icon: ShieldAlert, tone: 'orange', navigateTo: '/admin/invoice-approvals' },
    { id: 'blocked-invoices', label: 'Blocked Invoices', value: blockedInvoicesCount, icon: AlertTriangle, tone: blockedInvoicesCount > 0 ? 'red' : 'blue', navigateTo: '/admin/invoice-history' },
    { id: 'technicians-online', label: 'Technicians Online', value: techniciansOnlineCount, icon: Users, tone: 'green', navigateTo: '/admin/technicians' },
    { id: 'jobs-attention', label: 'Jobs Requiring Attention', value: jobsRequiringAttentionCount, icon: AlertCircle, tone: jobsRequiringAttentionCount > 0 ? 'red' : 'blue', navigateTo: '/admin/jobs?status=attention_required' },
    { id: 'active-locations', label: 'Active Locations', value: activeLocationsCount, icon: Building2, tone: 'blue', navigateTo: '/admin/dealerships' },
  ];

  const alerts: DashboardAlert[] = [];

  const activity = jobs
    .slice()
    .sort((left, right) => (
      new Date(right.updated_at || right.created_at).getTime() - new Date(left.updated_at || left.created_at).getTime()
    ))
    .slice(0, 10)
    .map((job) => {
      const labels: Record<string, { title: string; badge: string; tone: ActivityRow['tone'] }> = {
        completed: { title: 'Job completed', badge: 'Completed', tone: 'success' },
        in_progress: { title: 'Technician accepted job', badge: 'Accepted', tone: 'info' },
        scheduled: { title: 'Job assigned', badge: 'Assigned', tone: 'info' },
        admin_preview: { title: 'Job needs review', badge: 'Review', tone: 'warning' },
        pending_admin_confirmation: { title: 'Awaiting approval', badge: 'Approval', tone: 'warning' },
        pending: { title: 'New job intake', badge: 'New', tone: 'info' },
        cancelled: { title: 'Job refused', badge: 'Refused', tone: 'critical' },
      };

      const meta = labels[job.status] ?? { title: titleCaseStatus(job.status), badge: titleCaseStatus(job.status), tone: 'info' };
      return {
        id: job.id,
        title: `${meta.title}: ${job.job_code}`,
        description: `${job.dealership_name || 'Unknown dealership'}${job.service_type ? ` • ${job.service_type}` : ''}${job.vehicle ? ` • ${job.vehicle}` : ''}`,
        timestamp: timeAgo(job.updated_at || job.created_at),
        badge: meta.badge,
        tone: meta.tone,
      } satisfies ActivityRow;
    });

  return {
    cards,
    alerts,
    activity,
    technicians,
    stats: {
      jobs: jobs.length,
      technicians: technicians.length,
      dealerships: dealerships.length,
      invoices: invoices.length,
    },
  };
}

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const start = prev.current;
    const end = value;
    prev.current = value;
    if (start === end) return;
    const duration = 700;
    const startTime = Date.now();
    const tick = () => {
      const p = Math.min((Date.now() - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(start + (end - start) * eased));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value]);
  return <>{display}</>;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-[280px] w-full rounded-[30px]" />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
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
    }, 60000);

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
      lookup.get('jobs-completed-today'),
      lookup.get('pending-invoice-approvals'),
      lookup.get('technicians-online'),
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
        description: 'Live job records across the backend.',
        icon: Briefcase,
      },
      {
        id: 'technicians',
        label: 'Technician Roster',
        value: snapshot.stats.technicians,
        description: 'Field operators on file.',
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
      id: 'create-new-job',
      label: 'Create New Job',
      description: 'Open the job intake workflow and manually create a dispatch job.',
      icon: Plus,
      onClick: () => navigate('/admin/jobs'),
    },
    {
      id: 'open-intake-inbox',
      label: 'Open Intake Inbox',
      description: 'Review new intake records and convert them into jobs.',
      icon: ClipboardList,
      onClick: () => navigate('/admin/intake'),
    },
    {
      id: 'invoice-approvals',
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
  ]), [navigate]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="relative w-full pb-10" style={bodyFontStyle}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] rounded-[34px] bg-[radial-gradient(circle_at_top_left,rgba(15,23,42,0.05),rgba(15,23,42,0)_34%),radial-gradient(circle_at_top_right,rgba(15,23,42,0.03),rgba(15,23,42,0)_28%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),rgba(34,211,238,0)_34%),radial-gradient(circle_at_top_right,rgba(52,211,153,0.1),rgba(52,211,153,0)_28%)]" />
      <div className="pointer-events-none absolute left-10 top-10 h-48 w-48 rounded-full bg-slate-900/5 blur-3xl dark:bg-cyan-400/8" />
      <div className="pointer-events-none absolute right-10 top-20 h-56 w-56 rounded-full bg-slate-900/4 blur-3xl dark:bg-emerald-400/8" />

      <div className="relative space-y-6">
        <section className="relative overflow-hidden rounded-[32px] border border-black/8 bg-[linear-gradient(135deg,#ffffff,#fbfbfb)] shadow-[0_34px_120px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(7,25,42,0.98),rgba(6,18,32,0.98))] dark:shadow-[0_34px_120px_rgba(0,0,0,0.34)]" style={{ animation: 'fade-in 0.6s ease both' }}>
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.03)_1px,transparent_1px)] bg-[size:120px_120px] opacity-20 dark:bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-900/20 to-transparent dark:via-cyan-200/70" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(15,23,42,0.04),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(15,23,42,0.03),transparent_26%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(47,142,146,0.14),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.12),transparent_26%)]" />

          <div className="relative grid gap-6 p-6 xl:grid-cols-[1.2fr_0.85fr] xl:p-8">
            <div>
              <div
                className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-700 dark:border-cyan-300/20 dark:bg-cyan-300/10 dark:text-cyan-100"
                style={displayFontStyle}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Operations Pulse
              </div>

              <h1
                className="mt-5 text-[clamp(2.1rem,4vw,4.2rem)] font-semibold leading-[0.92] tracking-[-0.07em] text-slate-900 dark:text-white"
                style={displayFontStyle}
              >
                Overview
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-300 sm:text-[15px]">
                Track jobs, technicians, invoices, and blockers.
              </p>

              <div className="mt-6 grid max-w-2xl grid-cols-1 gap-2.5 sm:grid-cols-3">
                {leadMetrics.map((metric) => (
                  <div
                    key={metric.id}
                    className="group rounded-2xl border border-black/8 bg-white/90 px-4 py-3 text-sm text-slate-700 shadow-[0_12px_28px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.9)] transition-transform hover:-translate-y-0.5 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                  >
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                      {metric.label}
                    </div>
                    <div className="mt-2 flex items-end justify-between gap-3">
                      <span className="text-2xl font-semibold leading-none tracking-[-0.04em] text-slate-950 dark:text-white">
                        {metric.value}
                      </span>
                      <span className="h-1.5 w-8 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 opacity-70 transition-opacity group-hover:opacity-100" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {overviewTiles.map((tile, i) => (
                <div
                  key={tile.id}
                  className="relative overflow-hidden rounded-[24px] border border-black/8 bg-[linear-gradient(180deg,#ffffff,#fafafa)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(10,31,48,0.94),rgba(8,23,37,0.94))] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                  style={{ animation: 'fade-in-up 0.5s ease both', animationDelay: `${100 + i * 80}ms` }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                        {tile.label}
                      </p>
                      <div className="mt-3 text-[2.15rem] font-semibold leading-none tracking-[-0.06em] text-slate-900 dark:text-white" style={displayFontStyle}>
                        {tile.value}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-black/8 bg-slate-100 p-2.5 text-slate-700 dark:border-cyan-300/15 dark:bg-cyan-300/10 dark:text-cyan-100">
                      <tile.icon className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-500 dark:text-slate-400">{tile.description}</p>
                </div>
              ))}
            </div>
          </div>

          {error ? (
            <div className="relative border-t border-white/10 px-6 py-5 xl:px-8">
              <div className="rounded-[22px] border border-rose-400/20 bg-rose-400/10 px-4 py-4 text-sm text-rose-100">
                {error}
              </div>
            </div>
          ) : null}
        </section>

        <section>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white" style={displayFontStyle}>
                Live queue
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Open key queues.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-10 gap-2 rounded-full border-black/8 bg-white px-4 text-slate-700 hover:bg-slate-50 hover:text-slate-900 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200 dark:hover:bg-white/[0.08] dark:hover:text-white"
              onClick={() => void loadDashboard({ background: true })}
              title="Refresh"
              disabled={refreshing}
            >
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
              Refresh
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {snapshot?.cards.map((card, i) => (
              <button
                key={card.id}
                type="button"
                className={metricCardClasses(card.tone)}
                onClick={() => navigate(card.navigateTo)}
                style={{ animation: `fade-in-up 0.5s ease both`, animationDelay: `${i * 70}ms` }}
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
                      <AnimatedNumber value={card.value} />
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
          <section className="relative overflow-hidden rounded-[28px] border border-black/8 bg-[linear-gradient(180deg,#ffffff,#fafafa)] shadow-[0_28px_90px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(8,23,38,0.98),rgba(7,18,31,0.98))] dark:shadow-[0_28px_90px_rgba(0,0,0,0.3)]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-900/20 to-transparent dark:via-cyan-200/60" />
            <div className="flex items-center justify-between px-6 pb-4 pt-6">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white" style={displayFontStyle}>
                  Recent activity
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Latest job updates.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 rounded-full text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-cyan-200 dark:hover:bg-white/[0.05] dark:hover:text-white"
                onClick={() => navigate('/admin/jobs')}
              >
                View jobs
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="relative">
            <ScrollArea className="h-[560px]">
              <div className="px-6 pb-6">
                {snapshot?.activity.length ? (
                  <div className="space-y-4">
                    {snapshot.activity.map((event, i) => (
                      <div
                        key={event.id}
                        className="rounded-[22px] border border-black/8 bg-white px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)] dark:border-white/10 dark:bg-white/[0.03] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                        style={{ animation: 'slide-in-right 0.4s ease both', animationDelay: `${i * 50}ms` }}
                      >
                        <div className="flex items-start gap-4">
                          <span className="relative mt-1.5 flex h-4 w-4 shrink-0">
                            <span className="absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: activityDotColor(event.tone), animation: 'live-ping 1.4s ease-out infinite', animationDelay: `${i * 200}ms` }} />
                            <span className="relative inline-flex h-4 w-4 rounded-full" style={{ backgroundColor: activityDotColor(event.tone), boxShadow: `0 0 8px 3px ${activityDotColor(event.tone)}99` }} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{event.title}</p>
                                <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{event.description}</p>
                              </div>
                              <Badge variant="outline" className={activityBadgeClasses(event.tone)}>
                                {event.badge}
                              </Badge>
                            </div>
                            <div className="mt-4 text-xs font-medium uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                              {event.timestamp}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[22px] border border-black/8 bg-white px-5 py-6 text-sm text-slate-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400">
                    No recent activity found.
                  </div>
                )}
              </div>
            </ScrollArea>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 rounded-b-[28px] bg-gradient-to-t from-[rgba(7,18,31,0.95)] to-transparent" />
            </div>
          </section>

          <div className="space-y-6">
            <section className="relative overflow-hidden rounded-[28px] border border-black/8 bg-[linear-gradient(180deg,#ffffff,#fafafa)] p-6 shadow-[0_28px_90px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(8,23,38,0.98),rgba(7,18,31,0.98))] dark:shadow-[0_28px_90px_rgba(0,0,0,0.3)]">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-900/20 to-transparent dark:via-cyan-200/60" />
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white" style={displayFontStyle}>
                  Quick actions
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Common shortcuts.
                </p>
              </div>

              <div className="mt-5 space-y-3">
                {quickActions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    onClick={action.onClick}
                    className="group flex w-full items-start gap-4 rounded-[22px] border border-black/8 bg-white px-4 py-4 text-left transition-all duration-200 hover:border-black/12 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-cyan-300/25 dark:hover:bg-white/[0.06]"
                  >
                    <div className="rounded-2xl border border-black/8 bg-slate-100 p-2.5 text-slate-700 dark:border-cyan-300/15 dark:bg-cyan-300/10 dark:text-cyan-100">
                      <action.icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{action.label}</p>
                        <ArrowRight className="h-4 w-4 text-slate-400 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-slate-900 dark:text-white/45 dark:group-hover:text-white" />
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{action.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="relative overflow-hidden rounded-[28px] border border-black/8 bg-[linear-gradient(180deg,#ffffff,#fafafa)] p-6 shadow-[0_28px_90px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(8,23,38,0.98),rgba(7,18,31,0.98))] dark:shadow-[0_28px_90px_rgba(0,0,0,0.3)]">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-900/20 to-transparent dark:via-cyan-200/60" />
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white" style={displayFontStyle}>
                  Technicians
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Current field status.
                </p>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {(snapshot?.technicians ?? []).slice(0, 6).map((tech) => {
                  const statusLabel = tech.on_leave_now
                    ? 'Out of Office'
                    : tech.current_jobs_count > 0
                      ? 'In Progress'
                      : tech.effective_availability
                        ? 'Available'
                        : 'Offline';
                  const statusClasses = tech.on_leave_now
                    ? 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-600/30 dark:bg-slate-800 dark:text-slate-200'
                    : tech.current_jobs_count > 0
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-300/20 dark:bg-emerald-400/10 dark:text-emerald-100'
                      : tech.effective_availability
                        ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-cyan-300/20 dark:bg-cyan-400/10 dark:text-cyan-100'
                        : 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-600/30 dark:bg-slate-700 dark:text-slate-300';

                  return (
                    <div key={tech.id} className="rounded-[22px] border border-black/8 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
                      <div className="flex flex-col gap-3 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{tech.name}</p>
                          <p className="mt-1 truncate text-xs uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">{tech.email}</p>
                        </div>
                        <span className={cn('inline-flex shrink-0 items-center justify-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]', statusClasses)}>
                          {statusLabel}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 flex items-center justify-between rounded-[22px] border border-black/8 bg-white px-4 py-4 text-sm text-slate-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400">
                <span>{snapshot?.technicians.length ?? 0} technicians total</span>
                <Button variant="ghost" size="sm" onClick={() => navigate('/admin/technicians')}>
                  View all technicians
                </Button>
              </div>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Building2,
  CreditCard,
  RefreshCw,
  ShieldAlert,
  UserRound,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  fetchSuperAdminDashboard,
  getStoredSuperAdminToken,
  type BackendSuperAdminDashboard,
} from '@/lib/backend-api';
import { toOrganizationTerminology } from '@/lib/super-admin-terminology';
import { cn } from '@/lib/utils';

function formatDateTime(value?: string | null) {
  if (!value) return 'No activity yet';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'No activity yet';
  return parsed.toLocaleString();
}

const metricMeta = [
  { key: 'total_tenants', label: 'Total Organizations', icon: Building2, tone: 'slate' },
  { key: 'active_tenants', label: 'Active Organizations', icon: Activity, tone: 'emerald' },
  { key: 'suspended_tenants', label: 'Suspended Organizations', icon: ShieldAlert, tone: 'rose' },
  { key: 'trial_tenants', label: 'Trial Accounts', icon: CreditCard, tone: 'amber' },
  { key: 'paid_tenants', label: 'Paid Accounts', icon: Wallet, tone: 'cyan' },
  { key: 'payment_failures', label: 'Failed Payments', icon: AlertTriangle, tone: 'rose' },
  { key: 'total_platform_users', label: 'Total Users', icon: UserRound, tone: 'slate' },
  { key: 'security_alerts', label: 'Security Alerts', icon: ShieldAlert, tone: 'amber' },
] as const;

function toneClasses(tone: 'slate' | 'emerald' | 'rose' | 'amber' | 'cyan') {
  if (tone === 'emerald') return 'border-emerald-200/80 bg-emerald-50/80 text-emerald-950';
  if (tone === 'rose') return 'border-rose-200/80 bg-rose-50/80 text-rose-950';
  if (tone === 'amber') return 'border-amber-200/80 bg-amber-50/80 text-amber-950';
  if (tone === 'cyan') return 'border-cyan-200/80 bg-cyan-50/80 text-cyan-950';
  return 'border-slate-200/80 bg-white/85 text-slate-950';
}

function statusTone(value: string) {
  const normalized = value.toLowerCase();
  if (normalized === 'healthy') return 'bg-emerald-100 text-emerald-800';
  if (normalized === 'warning') return 'bg-amber-100 text-amber-800';
  if (normalized === 'failed') return 'bg-rose-100 text-rose-800';
  return 'bg-slate-200 text-slate-700';
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-[220px] w-full rounded-[2rem]" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-40 w-full rounded-[1.7rem]" />
        ))}
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.18fr)_minmax(19rem,0.82fr)]">
        <Skeleton className="h-[420px] rounded-[2rem]" />
        <Skeleton className="h-[420px] rounded-[2rem]" />
      </div>
    </div>
  );
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="rounded-[1.35rem] border border-dashed border-slate-900/15 bg-[#faf6ef] px-4 py-6 text-sm text-slate-600">
      {message}
    </div>
  );
}

export default function SuperAdminDashboardPage() {
  const [dashboard, setDashboard] = useState<BackendSuperAdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = async (background = false) => {
    const token = getStoredSuperAdminToken();
    if (!token) {
      setError('Super Admin session missing. Please sign in again.');
      setDashboard(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (background) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const next = await fetchSuperAdminDashboard(token);
      setDashboard(next);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load platform dashboard.');
      if (!background) {
        setDashboard(null);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') {
        void loadDashboard(true);
      }
    }, 45000);
    return () => window.clearInterval(intervalId);
  }, []);

  const metrics = useMemo(() => {
    if (!dashboard) return [];
    return metricMeta.map((item) => ({
      ...item,
      value: dashboard.metrics[item.key],
    }));
  }, [dashboard]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (!dashboard) {
    return (
      <div className="space-y-4">
        <div className="rounded-[1.6rem] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
          {error ?? 'The platform dashboard is unavailable right now.'}
        </div>
        <Button onClick={() => void loadDashboard()} className="rounded-full bg-[linear-gradient(135deg,#0f172a,#155e75)] text-white hover:brightness-105">
          Retry dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-slate-900/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.95),rgba(246,238,227,0.92))] p-6 shadow-[0_28px_100px_rgba(15,23,42,0.1)] sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(15,23,42,0.08),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(8,145,178,0.09),transparent_28%)]" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-900/10 bg-white/75 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-600">
              <ShieldAlert className="h-3.5 w-3.5 text-cyan-800" />
              Platform pulse
            </div>
            <h2 className="mt-5 text-[clamp(2rem,4vw,3.4rem)] font-semibold leading-[0.94] tracking-[-0.06em] text-slate-950" style={{ fontFamily: '"Space Grotesk", "Sora", system-ui, sans-serif' }}>
              Cross-organization operational visibility
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-700 sm:text-[15px]">
              Watch subscription health, security pressure, organization movement, and overall platform activity from one command surface.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Badge className={cn('rounded-full px-4 py-2 text-sm font-semibold', statusTone(dashboard.system_health.status ?? 'healthy'))}>
              System {dashboard.system_health.status ?? 'healthy'}
            </Badge>
            <Button
              onClick={() => void loadDashboard(true)}
              className="rounded-full bg-[linear-gradient(135deg,#0f172a,#155e75)] px-5 text-white hover:brightness-105"
            >
              <RefreshCw className={cn('mr-2 h-4 w-4', refreshing && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-[1.6rem] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.key} className={cn('rounded-[1.7rem] border px-0 py-0', toneClasses(metric.tone))}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{metric.label}</p>
                    <div className="mt-4 text-[2.4rem] font-semibold leading-none tracking-[-0.06em]" style={{ fontFamily: '"Space Grotesk", "Sora", system-ui, sans-serif' }}>
                      {metric.value}
                    </div>
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-[1rem] border border-slate-900/10 bg-white/70">
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-[2rem] border-slate-900/10 bg-white/85">
          <CardHeader>
            <CardTitle className="text-2xl tracking-[-0.04em]" style={{ fontFamily: '"Space Grotesk", "Sora", system-ui, sans-serif' }}>
              Recent Organization Activity
            </CardTitle>
            <CardDescription>Latest platform-wide organization movement.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {dashboard.recent_tenant_activity.length === 0 ? (
              <EmptyPanel message="No organization activity has been recorded yet." />
            ) : (
              dashboard.recent_tenant_activity.map((tenant) => (
                <div key={tenant.id} className="rounded-[1.35rem] border border-slate-900/10 bg-[#fbf7f0] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-base font-semibold text-slate-950">{toOrganizationTerminology(tenant.name)}</p>
                      <p className="mt-1 text-sm text-slate-600">{toOrganizationTerminology(tenant.slug)} | {tenant.owner_email ?? 'Owner email not set'}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="rounded-full bg-slate-900 text-white">{tenant.subscription_plan}</Badge>
                      <Badge variant="outline" className="rounded-full border-slate-300 bg-white text-slate-700">
                        {tenant.platform_status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
                    <span>{tenant.users_count} users</span>
                    <span>{tenant.technicians_count} technicians</span>
                    <span>Last login: {formatDateTime(tenant.last_login_at)}</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-[2rem] border-slate-900/10 bg-white/85">
            <CardHeader>
              <CardTitle className="text-2xl tracking-[-0.04em]" style={{ fontFamily: '"Space Grotesk", "Sora", system-ui, sans-serif' }}>
                Security Alerts
              </CardTitle>
              <CardDescription>Recent platform security signals and failures.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {dashboard.recent_security_alerts.length === 0 ? (
                <EmptyPanel message="No recent platform security alerts." />
              ) : (
                dashboard.recent_security_alerts.map((alert) => (
                  <div key={alert.id} className="rounded-[1.35rem] border border-slate-900/10 bg-[#faf5ee] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">{toOrganizationTerminology(alert.title)}</p>
                        <p className="mt-1 text-sm leading-6 text-slate-600">{toOrganizationTerminology(alert.message)}</p>
                      </div>
                      <Badge className={cn('rounded-full px-3 py-1 text-xs font-semibold', statusTone(alert.severity))}>
                        {alert.severity}
                      </Badge>
                    </div>
                    <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">{formatDateTime(alert.created_at)}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[2rem] border-slate-900/10 bg-white/85">
            <CardHeader>
              <CardTitle className="text-2xl tracking-[-0.04em]" style={{ fontFamily: '"Space Grotesk", "Sora", system-ui, sans-serif' }}>
                System Health
              </CardTitle>
              <CardDescription>Core platform readiness signals.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {Object.entries(dashboard.system_health).map(([key, value]) => (
                <div key={key} className="rounded-[1.2rem] border border-slate-900/10 bg-[#faf6ef] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{key.replace(/_/g, ' ')}</p>
                  <p className="mt-3 text-lg font-semibold capitalize text-slate-950">{String(value)}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

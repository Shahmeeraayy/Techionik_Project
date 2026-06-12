import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, RefreshCw, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { SectionCard } from '@/components/settings/SectionCard';
import { FormField } from '@/components/settings/FormField';
import { useSettingsWorkspace } from '@/components/settings/WorkspaceProvider';
import { settingsControlButtonClass, settingsSelectTriggerClass } from '@/components/settings/visual';
import {
  fetchAdminBillingSettings,
  getStoredAdminToken,
  updateAdminBillingSettings,
  type BackendAdminBillingSettings,
} from '@/lib/backend-api';
import { cn } from '@/lib/utils';
import { safeParseJSON, safeSetItem } from '@/lib/storage';

const BILLING_CACHE_KEY = 'sm_dispatch_settings_billing_cache';
const BILLING_STATUSES: BackendAdminBillingSettings['subscription_status'][] = [
  'trial',
  'paid',
  'payment_pending',
  'past_due',
  'cancelled',
  'failed',
];

const DEFAULT_BILLING_SETTINGS: BackendAdminBillingSettings = {
  plan_name: 'NexusOps Growth',
  monthly_price: '$149/mo',
  renewal_date: '2026-07-01',
  subscription_status: 'paid',
  technician_limit: 25,
  location_limit: 50,
  billing_provider: 'Stripe',
  manage_url: null,
  updated_at: null,
};

function isBillingStatus(value: unknown): value is BackendAdminBillingSettings['subscription_status'] {
  return typeof value === 'string' && BILLING_STATUSES.includes(value as BackendAdminBillingSettings['subscription_status']);
}

function toNumber(value: unknown, fallback: number): number {
  const next = Number(value);
  return Number.isFinite(next) && next > 0 ? next : fallback;
}

function normalizeBillingSettings(
  value: Partial<BackendAdminBillingSettings> | null | undefined,
  fallback: BackendAdminBillingSettings,
): BackendAdminBillingSettings {
  return {
    plan_name: typeof value?.plan_name === 'string' && value.plan_name.trim() ? value.plan_name : fallback.plan_name,
    monthly_price: typeof value?.monthly_price === 'string' && value.monthly_price.trim() ? value.monthly_price : fallback.monthly_price,
    renewal_date: typeof value?.renewal_date === 'string' && value.renewal_date.trim() ? value.renewal_date : fallback.renewal_date,
    subscription_status: isBillingStatus(value?.subscription_status) ? value.subscription_status : fallback.subscription_status,
    technician_limit: toNumber(value?.technician_limit, fallback.technician_limit),
    location_limit: toNumber(value?.location_limit, fallback.location_limit),
    billing_provider: typeof value?.billing_provider === 'string' && value.billing_provider.trim()
      ? value.billing_provider
      : fallback.billing_provider,
    manage_url: typeof value?.manage_url === 'string' ? value.manage_url : fallback.manage_url,
    updated_at: typeof value?.updated_at === 'string' ? value.updated_at : fallback.updated_at,
  };
}

function createFallbackBillingSettings(workspace: ReturnType<typeof useSettingsWorkspace>): BackendAdminBillingSettings {
  return {
    ...DEFAULT_BILLING_SETTINGS,
    plan_name: workspace.billingSubscription.planName,
    monthly_price: workspace.billingSubscription.monthlyPrice,
    renewal_date: workspace.billingSubscription.renewalDate,
    technician_limit: workspace.billingSubscription.technicianLimit,
    location_limit: workspace.billingSubscription.locationLimit,
    updated_at: workspace.lastRefreshedAt,
  };
}

function formatDateLabel(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value || 'Not configured';
  }
  return new Intl.DateTimeFormat([], { month: 'short', day: 'numeric', year: 'numeric' }).format(parsed);
}

function statusTone(status: BackendAdminBillingSettings['subscription_status']) {
  switch (status) {
    case 'paid':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
    case 'trial':
      return 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300';
    case 'payment_pending':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
    case 'past_due':
    case 'failed':
      return 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300';
    case 'cancelled':
      return 'border-slate-400/40 bg-muted/30 text-muted-foreground';
    default:
      return 'border-border/70 bg-muted/30 text-muted-foreground';
  }
}

function SummaryCard({
  label,
  value,
  helper,
  className,
}: {
  label: string;
  value: string;
  helper: string;
  className: string;
}) {
  return (
    <div className={cn('rounded-[28px] p-5 text-white shadow-[0_20px_60px_rgba(15,23,42,0.14)]', className)}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-white/65">{label}</p>
      <p className="mt-4 text-3xl font-semibold tracking-[-0.05em]">{value}</p>
      <p className="mt-3 text-sm leading-6 text-white/75">{helper}</p>
    </div>
  );
}

function UsageBar({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  const percentage = total > 0 ? Math.min((value / total) * 100, 100) : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground">
          {value}/{total}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div
          className="h-2 rounded-full bg-[linear-gradient(135deg,#0f172a,#155e75)]"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">{Math.round(percentage)}% of the current plan used.</p>
    </div>
  );
}

export default function SettingsBillingPage() {
  const workspace = useSettingsWorkspace();
  const [settings, setSettings] = useState<BackendAdminBillingSettings | null>(null);
  const [savedSettings, setSavedSettings] = useState<BackendAdminBillingSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connectionState, setConnectionState] = useState<'backend' | 'cache'>('cache');
  const [error, setError] = useState<string | null>(null);

  const fallbackSettings = useMemo(
    () => createFallbackBillingSettings(workspace),
    [
      workspace.billingSubscription.locationLimit,
      workspace.billingSubscription.monthlyPrice,
      workspace.billingSubscription.planName,
      workspace.billingSubscription.renewalDate,
      workspace.billingSubscription.technicianLimit,
      workspace.lastRefreshedAt,
    ],
  );

  const loadSettings = async () => {
    if (workspace.loading) {
      return;
    }

    setLoading(true);
    setError(null);

    const cachedSettings = safeParseJSON<BackendAdminBillingSettings | null>(BILLING_CACHE_KEY, null);
    const cachedOrFallback = normalizeBillingSettings(cachedSettings, fallbackSettings);
    setSettings(cachedOrFallback);
    setSavedSettings(cachedOrFallback);
    setConnectionState(cachedSettings ? 'cache' : 'backend');

    const token = getStoredAdminToken();
    if (!workspace.canUseBackend || !token) {
      setConnectionState('cache');
      setLoading(false);
      return;
    }

    try {
      const response = await fetchAdminBillingSettings(token);
      const normalized = normalizeBillingSettings(response, cachedOrFallback);
      setSettings(normalized);
      setSavedSettings(normalized);
      setConnectionState('backend');
      safeSetItem(BILLING_CACHE_KEY, JSON.stringify(normalized));
    } catch (loadError) {
      setConnectionState('cache');
      setError(loadError instanceof Error ? loadError.message : 'Failed to load billing settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.canUseBackend, workspace.loading, workspace.lastRefreshedAt]);

  const currentSettings = settings ?? fallbackSettings;
  const renewalLabel = formatDateLabel(currentSettings.renewal_date);
  const technicianUsage = workspace.billingSubscription.technicianLimit > 0
    ? Math.min(Math.round((workspace.technicianCount / workspace.billingSubscription.technicianLimit) * 100), 100)
    : 0;
  const locationUsage = workspace.billingSubscription.locationLimit > 0
    ? Math.min(Math.round((workspace.dealerships.length / workspace.billingSubscription.locationLimit) * 100), 100)
    : 0;

  const handleReset = () => {
    if (!savedSettings) {
      return;
    }
    setSettings(savedSettings);
    setError(null);
  };

  const handleSave = async () => {
    if (!settings) {
      return;
    }

    const nextSettings = normalizeBillingSettings(settings, fallbackSettings);
    setSaving(true);
    setError(null);

    const token = getStoredAdminToken();
    if (workspace.canUseBackend && token) {
      try {
        const response = await updateAdminBillingSettings(token, nextSettings);
        const normalized = normalizeBillingSettings(response, nextSettings);
        setSettings(normalized);
        setSavedSettings(normalized);
        setConnectionState('backend');
        safeSetItem(BILLING_CACHE_KEY, JSON.stringify(normalized));
        toast.success('Billing settings saved.');
      } catch (saveError) {
        safeSetItem(BILLING_CACHE_KEY, JSON.stringify(nextSettings));
        setSettings(nextSettings);
        setSavedSettings(nextSettings);
        setConnectionState('cache');
        const message = saveError instanceof Error ? saveError.message : 'Failed to save billing settings.';
        setError(message);
        toast.error(message);
      } finally {
        setSaving(false);
      }
      return;
    }

    safeSetItem(BILLING_CACHE_KEY, JSON.stringify(nextSettings));
    setSettings(nextSettings);
    setSavedSettings(nextSettings);
    setConnectionState('cache');
    setSaving(false);
    toast.success('Billing settings saved locally.');
  };

  const openBillingPortal = () => {
    if (!currentSettings.manage_url?.trim()) {
      toast.error('No billing portal URL is configured yet.');
      return;
    }

    window.open(currentSettings.manage_url, '_blank', 'noopener,noreferrer');
  };

  if (workspace.loading || loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-[168px] rounded-[28px]" />
          <Skeleton className="h-[168px] rounded-[28px]" />
          <Skeleton className="h-[168px] rounded-[28px]" />
        </div>
        <Skeleton className="h-[420px] rounded-[28px]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          label="Current plan"
          value={currentSettings.plan_name}
          helper={currentSettings.monthly_price}
          className="bg-[linear-gradient(135deg,#0f172a,#1e293b)]"
        />
        <SummaryCard
          label="Renewal date"
          value={renewalLabel}
          helper="Billing renews automatically unless the plan is paused."
          className="bg-[linear-gradient(135deg,#0f766e,#14b8a6)]"
        />
        <SummaryCard
          label="Usage"
          value={`${workspace.technicianCount + workspace.dealerships.length}`}
          helper="Combined active technicians and locations."
          className="bg-[linear-gradient(135deg,#1d4ed8,#60a5fa)]"
        />
      </div>

      {error ? (
        <div className="rounded-[1.4rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard
          title="Plan details"
          description="Edit the active billing plan, renewal cadence, and plan limits."
          action={
            <Badge variant="outline" className="rounded-full">
              {connectionState === 'backend' ? 'Live API' : 'Cached copy'}
            </Badge>
          }
          footer={
            <div className="flex w-full flex-wrap items-center justify-end gap-2">
              <Button type="button" variant="ghost" className={`rounded-full ${settingsControlButtonClass}`} onClick={() => void loadSettings()} disabled={saving}>
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
              <Button type="button" variant="ghost" className={`rounded-full ${settingsControlButtonClass}`} onClick={handleReset} disabled={saving}>
                Reset
              </Button>
              <Button type="button" className="rounded-full" onClick={() => void handleSave()} disabled={saving}>
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save changes'}
              </Button>
            </div>
          }
        >
          <div className="grid gap-5 md:grid-cols-2">
            <FormField label="Current plan" description="The active subscription tier.">
              <Input
                value={currentSettings.plan_name}
                onChange={(event) => setSettings((current) => current ? { ...current, plan_name: event.target.value } : current)}
              />
            </FormField>
            <FormField label="Monthly price" description="Displayed on the billing summary.">
              <Input
                value={currentSettings.monthly_price}
                onChange={(event) => setSettings((current) => current ? { ...current, monthly_price: event.target.value } : current)}
              />
            </FormField>
            <FormField label="Renewal date">
              <Input
                type="date"
                value={currentSettings.renewal_date}
                onChange={(event) => setSettings((current) => current ? { ...current, renewal_date: event.target.value } : current)}
              />
            </FormField>
            <FormField label="Subscription status">
              <Select
                value={currentSettings.subscription_status}
                onValueChange={(value) => setSettings((current) => current ? { ...current, subscription_status: value as BackendAdminBillingSettings['subscription_status'] } : current)}
              >
                <SelectTrigger className={settingsSelectTriggerClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BILLING_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status.replace(/_/g, ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Technician limit" description="How many technicians the plan supports.">
              <Input
                type="number"
                min={1}
                value={currentSettings.technician_limit}
                onChange={(event) => setSettings((current) => current ? { ...current, technician_limit: Number(event.target.value || 0) } : current)}
              />
            </FormField>
            <FormField label="Location limit" description="How many locations the plan supports.">
              <Input
                type="number"
                min={1}
                value={currentSettings.location_limit}
                onChange={(event) => setSettings((current) => current ? { ...current, location_limit: Number(event.target.value || 0) } : current)}
              />
            </FormField>
            <FormField label="Billing provider" className="md:col-span-2">
              <Input
                value={currentSettings.billing_provider ?? ''}
                onChange={(event) => setSettings((current) => current ? { ...current, billing_provider: event.target.value } : current)}
                placeholder="Stripe, QuickBooks, or another provider"
              />
            </FormField>
          </div>
        </SectionCard>

        <div className="space-y-4">
          <SectionCard title="Usage" description="See how the current plan is being consumed right now.">
            <div className="space-y-5">
              <UsageBar
                label="Technicians"
                value={workspace.technicianCount}
                total={currentSettings.technician_limit}
              />
              <UsageBar
                label="Locations"
                value={workspace.dealerships.length}
                total={currentSettings.location_limit}
              />
              <div className="rounded-[24px] border border-border/70 bg-muted/20 p-4">
                <p className="text-sm font-medium text-foreground">Live usage source</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Usage is calculated from the active workspace roster, so it stays aligned with the rest of the admin settings.
                </p>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Billing portal" description="Quick access to the external billing experience.">
            <div className="space-y-4">
              <div className="rounded-[24px] border border-border/70 bg-background/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Portal URL</p>
                <p className="mt-2 break-all text-sm font-medium text-foreground">
                  {currentSettings.manage_url?.trim() || 'Not configured yet'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="ghost" className={`rounded-full ${settingsControlButtonClass}`} onClick={openBillingPortal} disabled={!currentSettings.manage_url?.trim()}>
                  <ExternalLink className="h-4 w-4" />
                  Open portal
                </Button>
                <Button type="button" variant="ghost" className={`rounded-full ${settingsControlButtonClass}`} onClick={() => void loadSettings()}>
                  <RefreshCw className="h-4 w-4" />
                  Sync
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className={cn('rounded-full', statusTone(currentSettings.subscription_status))}>
                  {currentSettings.subscription_status.replace(/_/g, ' ')}
                </Badge>
                <Badge variant="outline" className="rounded-full">
                  {currentSettings.billing_provider ?? 'No provider set'}
                </Badge>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                Billing values are now fetched through the admin API when available, with a cached fallback so the page stays usable if the backend is warming up.
              </p>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

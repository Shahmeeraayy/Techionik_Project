import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Lock, RefreshCw, Save, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  fetchSuperAdminBreakGlassAccess,
  fetchSuperAdminTenantDetail,
  fetchSuperAdminTenantNotificationSettings,
  getStoredSuperAdminToken,
  runSuperAdminAccessCheck,
  updateSuperAdminTenantNotificationSettings,
  updateSuperAdminTenantFeatures,
  updateSuperAdminTenantPlan,
  updateSuperAdminTenantProfile,
  updateSuperAdminTenantStatus,
  type BackendSuperAdminAccessCheck,
  type BackendSuperAdminBreakGlassAccess,
  type BackendSuperAdminTenantDetail,
  type BackendSuperAdminTenantNotificationSettings,
} from '@/lib/backend-api';
import { toOrganizationTerminology } from '@/lib/super-admin-terminology';

type NotificationSettingKey = Exclude<keyof BackendSuperAdminTenantNotificationSettings, 'tenant_id'>;

const NOTIFICATION_CONTROL_ROWS: Array<{
  key: NotificationSettingKey;
  label: string;
  description: string;
}> = [
  {
    key: 'email_notifications_enabled',
    label: 'Email notifications',
    description: 'Allow organization-wide email delivery for booking updates, chat follow-ups, job alerts, and other outbound notices.',
  },
  {
    key: 'in_app_notifications_enabled',
    label: 'In-app notifications',
    description: 'Show notification items inside the in-app notification center for admins and technicians.',
  },
  {
    key: 'browser_push_notifications_enabled',
    label: 'Browser push notifications',
    description: 'Allow browser notification permission prompts and push subscription registration for this organization.',
  },
  {
    key: 'invoice_notifications_enabled',
    label: 'Invoice notifications',
    description: 'Allow invoice approved, paid, sent, overdue, rejected, and payment-failed notifications.',
  },
];

const DEFAULT_NOTIFICATION_SETTINGS: BackendSuperAdminTenantNotificationSettings = {
  tenant_id: '',
  email_notifications_enabled: true,
  in_app_notifications_enabled: true,
  browser_push_notifications_enabled: true,
  invoice_notifications_enabled: true,
};

function prettyLabel(value: string) {
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString();
}

function platformStatusBadgeClass(status: BackendSuperAdminTenantDetail['tenant']['platform_status']) {
  if (status === 'active') return 'bg-emerald-100 text-emerald-800';
  if (status === 'trial') return 'bg-cyan-100 text-cyan-800';
  if (status === 'payment_pending') return 'bg-amber-100 text-amber-800';
  if (status === 'suspended' || status === 'blocked') return 'bg-rose-100 text-rose-800';
  return 'bg-slate-200 text-slate-700';
}

function billingStatusBadgeClass(status: BackendSuperAdminTenantDetail['subscription']['status']) {
  if (status === 'paid') return 'bg-emerald-100 text-emerald-800';
  if (status === 'trial') return 'bg-cyan-100 text-cyan-800';
  if (status === 'payment_pending' || status === 'past_due') return 'bg-amber-100 text-amber-800';
  if (status === 'failed' || status === 'cancelled') return 'bg-rose-100 text-rose-800';
  return 'bg-slate-200 text-slate-700';
}

function auditStatusBadgeClass(status: string) {
  return status === 'failed' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800';
}

function securitySeverityBadgeClass(severity: string) {
  return severity === 'failed' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800';
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-[1.35rem] border border-dashed border-slate-900/15 bg-[#faf6ef] px-4 py-6 text-sm text-slate-600">
      {message}
    </div>
  );
}

export default function SuperAdminTenantDetailPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const [detail, setDetail] = useState<BackendSuperAdminTenantDetail | null>(null);
  const [sensitiveAccess, setSensitiveAccess] = useState<BackendSuperAdminBreakGlassAccess | null>(null);
  const [accessCheck, setAccessCheck] = useState<BackendSuperAdminAccessCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingFeatures, setSavingFeatures] = useState(false);
  const [savingNotificationSettings, setSavingNotificationSettings] = useState(false);
  const [unlockingSensitive, setUnlockingSensitive] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [breakGlassOpen, setBreakGlassOpen] = useState(false);
  const [breakGlassReason, setBreakGlassReason] = useState('');
  const [confirmStatusOpen, setConfirmStatusOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: '',
    industry_type: '',
    email_domain: '',
    support_email: '',
    billing_email: '',
    invoice_email: '',
    notification_email: '',
  });
  const [subscriptionPlan, setSubscriptionPlan] = useState<'basic' | 'pro' | 'enterprise'>('pro');
  const [subscriptionStatus, setSubscriptionStatus] = useState<'trial' | 'paid' | 'payment_pending' | 'past_due' | 'cancelled' | 'failed'>('trial');
  const [platformStatus, setPlatformStatus] = useState<'active' | 'trial' | 'payment_pending' | 'suspended' | 'archived' | 'blocked'>('trial');
  const [changeReason, setChangeReason] = useState('');
  const [featureDrafts, setFeatureDrafts] = useState<Record<string, { is_enabled: boolean; reason: string }>>({});
  const [notificationSettings, setNotificationSettings] = useState<BackendSuperAdminTenantNotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);

  const token = getStoredSuperAdminToken();

  const loadDetail = async (background = false) => {
    if (!tenantId) {
      setError('Organization ID is missing.');
      setLoading(false);
      return;
    }
    if (!token) {
      setError('Super Admin session missing. Please sign in again.');
      setLoading(false);
      return;
    }

    if (background) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const [nextDetail, nextNotificationSettings] = await Promise.all([
        fetchSuperAdminTenantDetail(token, tenantId),
        fetchSuperAdminTenantNotificationSettings(token, tenantId),
      ]);
      setDetail(nextDetail);
      setNotificationSettings(nextNotificationSettings);
      setProfileForm({
        name: nextDetail.tenant.name ?? '',
        industry_type: nextDetail.tenant.industry_type ?? '',
        email_domain: nextDetail.tenant.email_domain ?? '',
        support_email: nextDetail.tenant.support_email ?? '',
        billing_email: nextDetail.tenant.billing_email ?? '',
        invoice_email: nextDetail.tenant.invoice_email ?? '',
        notification_email: nextDetail.tenant.notification_email ?? '',
      });
      setSubscriptionPlan(nextDetail.subscription.plan);
      setSubscriptionStatus(nextDetail.subscription.status);
      setPlatformStatus(nextDetail.tenant.platform_status);
      setFeatureDrafts(
        Object.fromEntries(
          nextDetail.features.map((feature) => [
            feature.key,
            { is_enabled: feature.enabled, reason: feature.override?.reason ?? '' },
          ]),
        ),
      );
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load organization detail.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadDetail();
  }, [tenantId]);

  const effectiveFeatureRows = useMemo(() => {
    if (!detail) return [];
    return detail.features.map((feature) => ({
      ...feature,
      draft: featureDrafts[feature.key] ?? { is_enabled: feature.enabled, reason: feature.override?.reason ?? '' },
    }));
  }, [detail, featureDrafts]);

  const statusChangeRequiresConfirmation = Boolean(
    detail
    && platformStatus !== detail.tenant.platform_status
    && ['suspended', 'blocked', 'archived'].includes(platformStatus),
  );

  const saveProfile = async () => {
    if (!token || !tenantId) return;
    setSavingProfile(true);
    setError(null);
    try {
      const next = await updateSuperAdminTenantProfile(token, tenantId, {
        name: profileForm.name.trim() || undefined,
        industry_type: profileForm.industry_type.trim() || undefined,
        email_domain: profileForm.email_domain.trim() || undefined,
        support_email: profileForm.support_email.trim() || undefined,
        billing_email: profileForm.billing_email.trim() || undefined,
        invoice_email: profileForm.invoice_email.trim() || undefined,
        notification_email: profileForm.notification_email.trim() || undefined,
      });
      setDetail(next);
      toast.success('Organization profile saved.');
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Failed to save organization profile.';
      setError(message);
      toast.error(message);
    } finally {
      setSavingProfile(false);
    }
  };

  const savePlan = async () => {
    if (!token || !tenantId) return;
    setSavingPlan(true);
    setError(null);
    try {
      const next = await updateSuperAdminTenantPlan(token, tenantId, {
        subscription_plan: subscriptionPlan,
        subscription_status: subscriptionStatus,
        reason: changeReason || undefined,
      });
      setDetail(next);
      setChangeReason('');
      toast.success('Subscription settings updated.');
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Failed to update subscription plan.';
      setError(message);
      toast.error(message);
    } finally {
      setSavingPlan(false);
    }
  };

  const saveStatus = async (skipConfirmation = false) => {
    if (!token || !tenantId) return;
    if (!skipConfirmation && statusChangeRequiresConfirmation) {
      setConfirmStatusOpen(true);
      return;
    }

    setSavingStatus(true);
    setError(null);
    try {
      const next = await updateSuperAdminTenantStatus(token, tenantId, {
        status: platformStatus,
        reason: changeReason || undefined,
      });
      setDetail(next);
      setChangeReason('');
      setConfirmStatusOpen(false);
      toast.success(`Organization status updated to ${prettyLabel(platformStatus)}.`);
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Failed to update organization status.';
      setError(message);
      toast.error(message);
    } finally {
      setSavingStatus(false);
    }
  };

  const saveFeatures = async () => {
    if (!token || !tenantId || !detail) return;
    setSavingFeatures(true);
    setError(null);
    try {
      const response = await updateSuperAdminTenantFeatures(token, tenantId, {
        reason: changeReason || undefined,
        entries: effectiveFeatureRows.map((feature) => ({
          feature_key: feature.key,
          is_enabled: feature.draft.is_enabled,
          reason: feature.draft.reason || undefined,
        })),
      });
      setDetail({
        ...detail,
        features: response.features,
      });
      setChangeReason('');
      toast.success('Feature overrides saved.');
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Failed to save feature overrides.';
      setError(message);
      toast.error(message);
    } finally {
      setSavingFeatures(false);
    }
  };

  const saveNotificationSettings = async () => {
    if (!token || !tenantId) return;
    setSavingNotificationSettings(true);
    setError(null);
    try {
      const next = await updateSuperAdminTenantNotificationSettings(token, tenantId, {
        email_notifications_enabled: notificationSettings.email_notifications_enabled,
        in_app_notifications_enabled: notificationSettings.in_app_notifications_enabled,
        browser_push_notifications_enabled: notificationSettings.browser_push_notifications_enabled,
        invoice_notifications_enabled: notificationSettings.invoice_notifications_enabled,
      });
      setNotificationSettings(next);
      toast.success('Organization notification controls saved.');
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Failed to save organization notification controls.';
      setError(message);
      toast.error(message);
    } finally {
      setSavingNotificationSettings(false);
    }
  };

  const unlockSensitiveData = async () => {
    if (!token || !tenantId) return;
    setUnlockingSensitive(true);
    setError(null);
    try {
      const [access, validation] = await Promise.all([
        fetchSuperAdminBreakGlassAccess(token, tenantId, breakGlassReason),
        runSuperAdminAccessCheck(token, tenantId, {
          tenant_role: 'admin',
          permission: 'users.view.tenant',
          feature_key: 'technicians',
          requested_tenant_id: tenantId,
          resource_tenant_id: tenantId,
        }),
      ]);
      setSensitiveAccess(access);
      setAccessCheck(validation);
      setBreakGlassOpen(false);
      setBreakGlassReason('');
      toast.success('Sensitive organization data unlocked. Break-glass access has been logged.');
    } catch (unlockError) {
      const message = unlockError instanceof Error ? unlockError.message : 'Failed to unlock sensitive organization data.';
      setError(message);
      toast.error(message);
    } finally {
      setUnlockingSensitive(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-[2rem] border border-slate-900/10 bg-white/85 px-6 py-8 text-sm text-slate-600">
        Loading organization detail...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="rounded-[2rem] border border-rose-200 bg-rose-50 px-6 py-8 text-sm text-rose-700">
        {error ?? 'Organization detail is unavailable.'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-900/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.95),rgba(246,238,227,0.92))] p-6 shadow-[0_28px_100px_rgba(15,23,42,0.1)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-900/10 bg-white/75 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-600">
              <ShieldAlert className="h-3.5 w-3.5 text-cyan-800" />
              Organization Control
            </div>
            <h1
              className="mt-5 text-[clamp(2rem,4vw,3.2rem)] font-semibold leading-[0.94] tracking-[-0.06em] text-slate-950"
              style={{ fontFamily: '"Space Grotesk", "Sora", system-ui, sans-serif' }}
            >
              {toOrganizationTerminology(detail.tenant.name)}
            </h1>
            <p className="mt-3 text-sm leading-7 text-slate-700">
              {toOrganizationTerminology(detail.tenant.slug)} | {prettyLabel(detail.tenant.industry_type)} | Created {formatDateTime(detail.tenant.created_at)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge className="rounded-full bg-slate-900 px-4 py-2 text-sm text-white">{detail.subscription.plan}</Badge>
            <Badge className={`rounded-full px-4 py-2 text-sm ${billingStatusBadgeClass(detail.subscription.status)}`}>
              {prettyLabel(detail.subscription.status)}
            </Badge>
            <Badge variant="outline" className={`rounded-full border-slate-300 bg-white px-4 py-2 text-sm ${platformStatusBadgeClass(detail.tenant.platform_status)}`}>
              {prettyLabel(detail.tenant.platform_status)}
            </Badge>
            <Button onClick={() => void loadDetail(true)} className="rounded-full bg-[linear-gradient(135deg,#0f172a,#155e75)] text-white hover:brightness-105">
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-[1.4rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(21rem,0.95fr)]">
        <Card className="h-full rounded-[2rem] border-slate-900/10 bg-white/85">
          <CardHeader>
            <CardTitle className="text-2xl tracking-[-0.04em]" style={{ fontFamily: '"Space Grotesk", "Sora", system-ui, sans-serif' }}>
              Business Profile
            </CardTitle>
            <CardDescription>Update organization identity and contact channels.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="tenant-name">Business Name</Label>
              <Input id="tenant-name" value={profileForm.name} onChange={(event) => setProfileForm((prev) => ({ ...prev, name: event.target.value }))} className="h-12 rounded-[1rem] border-slate-900/10 bg-[#faf6ef]" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenant-industry">Industry Type</Label>
              <Input id="tenant-industry" value={profileForm.industry_type} onChange={(event) => setProfileForm((prev) => ({ ...prev, industry_type: event.target.value }))} className="h-12 rounded-[1rem] border-slate-900/10 bg-[#faf6ef]" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenant-email-domain">Custom Domain</Label>
              <Input id="tenant-email-domain" value={profileForm.email_domain} onChange={(event) => setProfileForm((prev) => ({ ...prev, email_domain: event.target.value }))} className="h-12 rounded-[1rem] border-slate-900/10 bg-[#faf6ef]" placeholder="techionik.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenant-support-email">Support Email</Label>
              <Input id="tenant-support-email" value={profileForm.support_email} onChange={(event) => setProfileForm((prev) => ({ ...prev, support_email: event.target.value }))} className="h-12 rounded-[1rem] border-slate-900/10 bg-[#faf6ef]" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenant-billing-email">Billing Email</Label>
              <Input id="tenant-billing-email" value={profileForm.billing_email} onChange={(event) => setProfileForm((prev) => ({ ...prev, billing_email: event.target.value }))} className="h-12 rounded-[1rem] border-slate-900/10 bg-[#faf6ef]" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenant-invoice-email">Invoice Email</Label>
              <Input id="tenant-invoice-email" value={profileForm.invoice_email} onChange={(event) => setProfileForm((prev) => ({ ...prev, invoice_email: event.target.value }))} className="h-12 rounded-[1rem] border-slate-900/10 bg-[#faf6ef]" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="tenant-notification-email">Notification Email</Label>
              <Input id="tenant-notification-email" value={profileForm.notification_email} onChange={(event) => setProfileForm((prev) => ({ ...prev, notification_email: event.target.value }))} className="h-12 rounded-[1rem] border-slate-900/10 bg-[#faf6ef]" />
            </div>
            <div className="md:col-span-2">
              <Button onClick={saveProfile} disabled={savingProfile} className="rounded-full bg-[linear-gradient(135deg,#0f172a,#155e75)] text-white hover:brightness-105">
                <Save className="mr-2 h-4 w-4" />
                {savingProfile ? 'Saving profile...' : 'Save profile'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="h-full rounded-[2rem] border-slate-900/10 bg-white/85">
          <CardHeader>
            <CardTitle className="text-2xl tracking-[-0.04em]" style={{ fontFamily: '"Space Grotesk", "Sora", system-ui, sans-serif' }}>
              Subscription and Lifecycle
            </CardTitle>
            <CardDescription>Adjust plan, billing state, and access posture.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tenant-plan">Subscription Plan</Label>
                <select id="tenant-plan" value={subscriptionPlan} onChange={(event) => setSubscriptionPlan(event.target.value as typeof subscriptionPlan)} className="h-12 w-full rounded-[1rem] border border-slate-900/10 bg-[#faf6ef] px-4 text-sm text-slate-900">
                  <option value="basic">Basic</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tenant-subscription-status">Billing Status</Label>
                <select id="tenant-subscription-status" value={subscriptionStatus} onChange={(event) => setSubscriptionStatus(event.target.value as typeof subscriptionStatus)} className="h-12 w-full rounded-[1rem] border border-slate-900/10 bg-[#faf6ef] px-4 text-sm text-slate-900">
                  <option value="trial">Trial</option>
                  <option value="paid">Paid</option>
                  <option value="payment_pending">Payment Pending</option>
                  <option value="past_due">Past Due</option>
                  <option value="failed">Failed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="tenant-platform-status">Organization Status</Label>
                <select id="tenant-platform-status" value={platformStatus} onChange={(event) => setPlatformStatus(event.target.value as typeof platformStatus)} className="h-12 w-full rounded-[1rem] border border-slate-900/10 bg-[#faf6ef] px-4 text-sm text-slate-900">
                  <option value="active">Active</option>
                  <option value="trial">Trial</option>
                  <option value="payment_pending">Payment Pending</option>
                  <option value="suspended">Suspended</option>
                  <option value="archived">Archived</option>
                  <option value="blocked">Blocked</option>
                </select>
              </div>
            </div>

            <div className="rounded-[1.35rem] border border-slate-900/10 bg-[#faf6ef] px-4 py-3 text-sm text-slate-600">
              High-risk status changes require an explicit confirmation step. Add a reason to keep the audit trail clear.
            </div>

            <div className="space-y-2">
              <Label htmlFor="change-reason">Change Reason</Label>
              <Textarea id="change-reason" value={changeReason} onChange={(event) => setChangeReason(event.target.value)} placeholder="Recommended for plan, status, and feature changes." className="min-h-28 rounded-[1rem] border-slate-900/10 bg-[#faf6ef]" />
            </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={savePlan} disabled={savingPlan} className="rounded-full bg-[linear-gradient(135deg,#0f172a,#155e75)] text-white hover:brightness-105">
                {savingPlan ? 'Saving plan...' : 'Save plan'}
              </Button>
              <Button onClick={() => void saveStatus()} disabled={savingStatus} variant="outline" className="rounded-full border-slate-900/10 bg-white text-slate-900">
                {savingStatus ? 'Saving status...' : 'Save status'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[2rem] border-slate-900/10 bg-white/85">
        <CardHeader>
          <CardTitle className="text-2xl tracking-[-0.04em]" style={{ fontFamily: '"Space Grotesk", "Sora", system-ui, sans-serif' }}>
            Notification Controls
          </CardTitle>
          <CardDescription>Set organization-wide delivery controls for email, in-app, browser push, and invoice notifications.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {NOTIFICATION_CONTROL_ROWS.map((row) => (
              <div key={row.key} className="flex items-start justify-between gap-4 rounded-[1.35rem] border border-slate-900/10 bg-[#faf6ef] p-4">
                <div>
                  <p className="text-sm font-semibold text-slate-950">{row.label}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{row.description}</p>
                </div>
                <Switch
                  checked={notificationSettings[row.key]}
                  onCheckedChange={(checked) => setNotificationSettings((prev) => ({
                    ...prev,
                    [row.key]: checked,
                  }))}
                />
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={saveNotificationSettings} disabled={savingNotificationSettings} className="rounded-full bg-[linear-gradient(135deg,#0f172a,#155e75)] text-white hover:brightness-105">
              {savingNotificationSettings ? 'Saving controls...' : 'Save notification controls'}
            </Button>
            <Badge variant="outline" className="rounded-full border-slate-300 bg-white px-4 py-2 text-slate-700">
              {NOTIFICATION_CONTROL_ROWS.filter((row) => notificationSettings[row.key]).length} enabled channels
            </Badge>
          </div>

          <p className="text-sm leading-7 text-slate-600">
            These controls are enforced before notifications are created or sent. Browser push is blocked at subscription time, and invoice notifications stop invoice-related delivery across email and in-app channels.
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-[2rem] border-slate-900/10 bg-white/85">
        <CardHeader>
          <CardTitle className="text-2xl tracking-[-0.04em]" style={{ fontFamily: '"Space Grotesk", "Sora", system-ui, sans-serif' }}>
            Feature Access
          </CardTitle>
          <CardDescription>Override plan-based access and control what the organization can actually reach.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {effectiveFeatureRows.length === 0 ? (
            <EmptyState message="No feature metadata is available for this organization yet." />
          ) : (
            <div className="grid auto-rows-fr gap-4 lg:grid-cols-2">
              {effectiveFeatureRows.map((feature) => (
                <div key={feature.key} className="flex h-full flex-col rounded-[1.4rem] border border-slate-900/10 bg-[#fbf7f0] p-4">
                  <div className="flex flex-1 items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-950">{feature.label}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{feature.description}</p>
                      <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                        Plan: {feature.included_by_plan ? 'Included' : 'Not included'} | Source: {prettyLabel(feature.source)}
                      </p>
                    </div>
                    <Switch
                      checked={feature.draft.is_enabled}
                      onCheckedChange={(checked) => setFeatureDrafts((prev) => ({
                        ...prev,
                        [feature.key]: {
                          ...(prev[feature.key] ?? { reason: '' }),
                          is_enabled: checked,
                        },
                      }))}
                    />
                  </div>
                  <Input
                    value={feature.draft.reason}
                    onChange={(event) => setFeatureDrafts((prev) => ({
                      ...prev,
                      [feature.key]: {
                        ...(prev[feature.key] ?? { is_enabled: feature.enabled }),
                        reason: event.target.value,
                      },
                    }))}
                    placeholder="Optional override reason"
                    className="mt-4 h-11 rounded-[1rem] border-slate-900/10 bg-white"
                  />
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Button onClick={saveFeatures} disabled={savingFeatures} className="rounded-full bg-[linear-gradient(135deg,#0f172a,#155e75)] text-white hover:brightness-105">
              {savingFeatures ? 'Saving features...' : 'Save feature overrides'}
            </Button>
            <Badge variant="outline" className="rounded-full border-slate-300 bg-white px-4 py-2 text-slate-700">
              {effectiveFeatureRows.filter((feature) => feature.draft.is_enabled).length} enabled modules
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[2rem] border-slate-900/10 bg-white/85">
        <CardHeader>
          <CardTitle className="text-2xl tracking-[-0.04em]" style={{ fontFamily: '"Space Grotesk", "Sora", system-ui, sans-serif' }}>
            Sensitive Organization Data
          </CardTitle>
          <CardDescription>Break-glass access is required before viewing users, billing detail, audit history, or security activity.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => setBreakGlassOpen(true)} className="rounded-full bg-[linear-gradient(135deg,#7c2d12,#b45309)] text-white hover:brightness-105">
              <Lock className="mr-2 h-4 w-4" />
              Unlock sensitive data
            </Button>
            {accessCheck ? (
              <Badge className={`rounded-full px-4 py-2 ${accessCheck.allowed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                Access policy {accessCheck.allowed ? 'passed' : 'flagged'}
              </Badge>
            ) : null}
          </div>

          {accessCheck ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {accessCheck.steps.map((step) => (
                <div key={step.label} className="rounded-[1.2rem] border border-slate-900/10 bg-[#faf6ef] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{toOrganizationTerminology(step.label)}</p>
                  <p className={`mt-3 text-sm font-semibold ${step.allowed ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {step.allowed ? 'Allowed' : 'Blocked'}
                  </p>
                </div>
              ))}
            </div>
          ) : null}

          {sensitiveAccess ? (
            <Tabs defaultValue="users" className="space-y-4">
              <TabsList className="rounded-full bg-[#f4ede3] p-1">
                <TabsTrigger value="users" className="rounded-full">Organization Users</TabsTrigger>
                <TabsTrigger value="billing" className="rounded-full">Billing Status</TabsTrigger>
                <TabsTrigger value="audit" className="rounded-full">Audit Logs</TabsTrigger>
                <TabsTrigger value="security" className="rounded-full">Security Activity</TabsTrigger>
              </TabsList>

              <TabsContent value="users" className="space-y-3">
                {sensitiveAccess.tenant_users.length === 0 ? (
                  <EmptyState message="No organization users were returned for this workspace." />
                ) : (
                  sensitiveAccess.tenant_users.map((userRow) => (
                    <div key={userRow.id} className="rounded-[1.35rem] border border-slate-900/10 bg-[#fbf7f0] p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-950">{userRow.name}</p>
                          <p className="mt-1 text-sm text-slate-600">{userRow.email}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge className="rounded-full bg-slate-900 text-white">{prettyLabel(userRow.role)}</Badge>
                          <Badge variant="outline" className="rounded-full border-slate-300 bg-white text-slate-700">{prettyLabel(userRow.status)}</Badge>
                        </div>
                      </div>
                      <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">Last seen {formatDateTime(userRow.last_login_at)}</p>
                    </div>
                  ))
                )}
              </TabsContent>

              <TabsContent value="billing" className="grid gap-4 md:grid-cols-2">
                {Object.entries(sensitiveAccess.billing_status).length === 0 ? (
                  <EmptyState message="No billing fields were returned for this organization." />
                ) : (
                  Object.entries(sensitiveAccess.billing_status).map(([key, value]) => (
                    <div key={key} className="rounded-[1.35rem] border border-slate-900/10 bg-[#fbf7f0] p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{key.replace(/_/g, ' ')}</p>
                      <p className="mt-3 text-base font-semibold text-slate-950">{String(value ?? '-')}</p>
                    </div>
                  ))
                )}
              </TabsContent>

              <TabsContent value="audit" className="space-y-3">
                {sensitiveAccess.audit_logs.length === 0 ? (
                  <EmptyState message="No audit activity is available for this organization yet." />
                ) : (
                  sensitiveAccess.audit_logs.map((logRow) => (
                    <div key={logRow.id} className="rounded-[1.35rem] border border-slate-900/10 bg-[#fbf7f0] p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-950">{toOrganizationTerminology(prettyLabel(logRow.action))}</p>
                          <p className="mt-1 text-sm text-slate-600">{logRow.actor} | {toOrganizationTerminology(prettyLabel(logRow.module))}</p>
                        </div>
                        <Badge className={`rounded-full ${auditStatusBadgeClass(logRow.status)}`}>
                          {prettyLabel(logRow.status)}
                        </Badge>
                      </div>
                      <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">{formatDateTime(logRow.created_at)}</p>
                    </div>
                  ))
                )}
              </TabsContent>

              <TabsContent value="security" className="space-y-3">
                {sensitiveAccess.security_activity.length === 0 ? (
                  <EmptyState message="No security activity was returned for this organization." />
                ) : (
                  sensitiveAccess.security_activity.map((alert) => (
                    <div key={alert.id} className="rounded-[1.35rem] border border-slate-900/10 bg-[#fbf7f0] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-950">{alert.title}</p>
                          <p className="mt-1 text-sm leading-6 text-slate-600">{alert.message}</p>
                        </div>
                        <Badge className={`rounded-full ${securitySeverityBadgeClass(alert.severity)}`}>
                          {prettyLabel(alert.severity)}
                        </Badge>
                      </div>
                      <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">{formatDateTime(alert.created_at)}</p>
                    </div>
                  ))
                )}
              </TabsContent>
            </Tabs>
          ) : (
            <EmptyState message="Sensitive data is locked. Provide an access reason to open organization users, billing status, audit logs, and security activity." />
          )}
        </CardContent>
      </Card>

      <Dialog open={breakGlassOpen} onOpenChange={setBreakGlassOpen}>
        <DialogContent className="border-slate-900/10 bg-white">
          <DialogHeader>
            <DialogTitle>Break-glass access</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm leading-6 text-slate-600">
              Enter the reason for accessing sensitive organization data. This action is logged with your identity, timestamp, and request context.
            </p>
            <Textarea value={breakGlassReason} onChange={(event) => setBreakGlassReason(event.target.value)} placeholder="Example: Investigating a security alert raised by billing failures across this organization." className="min-h-32 rounded-[1rem] border-slate-900/10 bg-[#faf6ef]" />
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-full border-slate-900/10 bg-white text-slate-900" onClick={() => setBreakGlassOpen(false)}>
              Cancel
            </Button>
            <Button onClick={unlockSensitiveData} disabled={unlockingSensitive || breakGlassReason.trim().length < 3} className="rounded-full bg-[linear-gradient(135deg,#7c2d12,#b45309)] text-white hover:brightness-105">
              {unlockingSensitive ? 'Unlocking...' : 'Unlock organization data'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmStatusOpen} onOpenChange={setConfirmStatusOpen}>
        <AlertDialogContent className="border-slate-900/10 bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm organization status change</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to change this organization to {prettyLabel(platformStatus)}. This can immediately restrict access for organization users and will be captured in the audit trail.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-[1.2rem] border border-slate-900/10 bg-[#faf6ef] px-4 py-3 text-sm text-slate-600">
            {changeReason.trim() ? `Reason: ${changeReason.trim()}` : 'No reason added yet. Adding one is strongly recommended for sensitive lifecycle changes.'}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full border-slate-900/10 bg-white text-slate-900">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void saveStatus(true)} className="rounded-full bg-[linear-gradient(135deg,#7f1d1d,#b91c1c)] text-white hover:brightness-105">
              Confirm status change
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Brush,
  Building2,
  CreditCard,
  Database,
  FileArchive,
  Globe2,
  Link2,
  Lock,
  RefreshCw,
  Save,
  ServerCog,
  ShieldAlert,
  SlidersHorizontal,
} from 'lucide-react';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  fetchSuperAdminPlatformSettings,
  getStoredSuperAdminToken,
  updateSuperAdminPlatformSettings,
  type BackendPlatformFeatureDefault,
  type BackendSuperAdminPlatformSettings,
} from '@/lib/backend-api';
import { cn } from '@/lib/utils';

type SettingsSectionKey = keyof BackendSuperAdminPlatformSettings;

type TextFieldConfig = {
  key: string;
  label: string;
  type?: 'text' | 'email' | 'url' | 'number' | 'color' | 'textarea' | 'select' | 'csv';
  options?: string[];
  placeholder?: string;
};

const sectionTabs: Array<{
  key: SettingsSectionKey;
  label: string;
  shortLabel: string;
  description: string;
  icon: typeof Globe2;
  sensitive?: boolean;
}> = [
  { key: 'general', label: 'General Platform Settings', shortLabel: 'General', description: 'Platform identity, locale defaults, and public support links.', icon: Globe2 },
  { key: 'branding', label: 'Branding Settings', shortLabel: 'Branding', description: 'Global branding defaults that organizations can override where allowed.', icon: Brush },
  { key: 'organization_defaults', label: 'Organization Defaults', shortLabel: 'Defaults', description: 'Default configuration applied to newly created organizations.', icon: Building2 },
  { key: 'billing', label: 'Subscription & Billing Settings', shortLabel: 'Billing', description: 'Global subscription, failed payment, and billing-cycle behavior.', icon: CreditCard },
  { key: 'feature_defaults', label: 'Feature Defaults', shortLabel: 'Features', description: 'Default feature availability, plan behavior, and override rules.', icon: SlidersHorizontal },
  { key: 'security', label: 'Security Settings', shortLabel: 'Security', description: 'Global password, session, audit, and access-control policies.', icon: Lock, sensitive: true },
  { key: 'email_notifications', label: 'Email & Notification Settings', shortLabel: 'Email', description: 'Global sender identity, templates, and notification defaults.', icon: Bell },
  { key: 'files_storage', label: 'File & Storage Settings', shortLabel: 'Files', description: 'Platform upload, attachment, retention, and file safety rules.', icon: FileArchive },
  { key: 'integrations', label: 'Integration Settings', shortLabel: 'Integrations', description: 'Connection status and masked integration configuration.', icon: Link2, sensitive: true },
  { key: 'maintenance', label: 'Maintenance & System Controls', shortLabel: 'Maintenance', description: 'Operational controls, announcement banner, and system status.', icon: ServerCog, sensitive: true },
];

const textFields: Partial<Record<SettingsSectionKey, TextFieldConfig[]>> = {
  general: [
    { key: 'platform_name', label: 'Platform Name' },
    { key: 'support_email', label: 'Platform Support Email', type: 'email' },
    { key: 'default_timezone', label: 'Default Timezone' },
    { key: 'default_currency', label: 'Default Currency' },
    { key: 'default_language', label: 'Default Language' },
    { key: 'contact_phone', label: 'Contact Phone' },
    { key: 'contact_address', label: 'Platform Contact Information', type: 'textarea' },
    { key: 'terms_url', label: 'Terms Link', type: 'url' },
    { key: 'privacy_url', label: 'Privacy Link', type: 'url' },
    { key: 'support_url', label: 'Public Support URL', type: 'url' },
    { key: 'environment_label', label: 'Environment Label', type: 'select', options: ['Production', 'Staging'] },
  ],
  branding: [
    { key: 'logo_url', label: 'NexusOps Logo URL', type: 'url' },
    { key: 'favicon_url', label: 'Favicon URL', type: 'url' },
    { key: 'primary_brand_color', label: 'Primary Brand Color', type: 'color' },
    { key: 'login_page_branding', label: 'Login Page Branding' },
    { key: 'super_admin_branding', label: 'Super Admin Branding' },
    { key: 'default_email_branding', label: 'Default Email Branding' },
    { key: 'default_invoice_template', label: 'Default Invoice Branding Template', type: 'select', options: ['standard', 'compact', 'premium'] },
    { key: 'customer_portal_branding', label: 'Default Customer Portal Branding' },
  ],
  organization_defaults: [
    { key: 'default_plan', label: 'Default Plan', type: 'select', options: ['basic', 'pro', 'enterprise'] },
    { key: 'trial_duration_days', label: 'Trial Duration', type: 'number' },
    { key: 'default_enabled_modules', label: 'Default Enabled Modules', type: 'csv' },
    { key: 'default_user_roles', label: 'Default User Roles', type: 'csv' },
    { key: 'default_job_statuses', label: 'Default Job Statuses', type: 'csv' },
    { key: 'default_invoice_prefix', label: 'Default Invoice Prefix' },
    { key: 'default_timezone', label: 'Default Timezone' },
    { key: 'default_currency', label: 'Default Currency' },
    { key: 'default_technician_limit', label: 'Default Technician Limit', type: 'number' },
    { key: 'default_storage_limit_gb', label: 'Default Storage Limit (GB)', type: 'number' },
  ],
  billing: [
    { key: 'trial_period_days', label: 'Trial Period Duration', type: 'number' },
    { key: 'grace_period_days', label: 'Payment Failure Grace Period', type: 'number' },
    { key: 'default_billing_cycle', label: 'Default Billing Cycle', type: 'select', options: ['monthly', 'annual'] },
    { key: 'supported_currencies', label: 'Supported Currencies', type: 'csv' },
    { key: 'tax_vat_placeholder', label: 'Tax/VAT Placeholder' },
    { key: 'stripe_connection_status', label: 'Stripe Connection Status', type: 'select', options: ['not_connected', 'connected', 'error'] },
    { key: 'payment_failure_handling', label: 'Payment Failure Handling', type: 'select', options: ['notify_only', 'notify_and_grace_period', 'auto_suspend'] },
    { key: 'downgrade_behavior', label: 'Subscription Downgrade Behavior', type: 'select', options: ['immediate', 'keep_until_cycle_end', 'manual_review'] },
  ],
  security: [
    { key: 'password_min_length', label: 'Password Minimum Length', type: 'number' },
    { key: 'password_complexity', label: 'Password Complexity Rules', type: 'select', options: ['basic', 'upper_lower_number', 'upper_lower_number_symbol'] },
    { key: 'session_timeout_minutes', label: 'Session Timeout (Minutes)', type: 'number' },
    { key: 'login_attempt_limit', label: 'Login Attempt Limit', type: 'number' },
    { key: 'account_lockout_minutes', label: 'Account Lockout Duration', type: 'number' },
    { key: 'two_factor_authentication', label: 'Two-Factor Authentication', type: 'select', options: ['planned', 'optional', 'required'] },
    { key: 'ip_restriction', label: 'IP Restriction', type: 'select', options: ['not_configured', 'allowlist_enabled'] },
    { key: 'audit_log_retention_days', label: 'Audit Log Retention', type: 'number' },
    { key: 'api_rate_limit_per_minute', label: 'API Rate Limit Per Minute', type: 'number' },
    { key: 'file_upload_security', label: 'File Upload Security Rules' },
  ],
  email_notifications: [
    { key: 'default_sender_name', label: 'Default Sender Name' },
    { key: 'default_sender_email', label: 'Default Sender Email', type: 'email' },
    { key: 'support_email', label: 'Support Email', type: 'email' },
    { key: 'billing_email', label: 'Billing Email', type: 'email' },
    { key: 'provider_status', label: 'SMTP / Provider Status', type: 'select', options: ['not_connected', 'connected', 'error'] },
    { key: 'template_defaults', label: 'Email Template Defaults' },
    { key: 'notification_rules', label: 'Notification Rules' },
    { key: 'failed_email_retry_count', label: 'Failed Email Retry Count', type: 'number' },
    { key: 'enabled_email_types', label: 'Enabled Email Types', type: 'csv' },
  ],
  files_storage: [
    { key: 'maximum_upload_size_mb', label: 'Maximum Upload Size (MB)', type: 'number' },
    { key: 'allowed_file_types', label: 'Allowed File Types', type: 'csv' },
    { key: 'blocked_file_types', label: 'Blocked File Types', type: 'csv' },
    { key: 'storage_limit_per_organization_gb', label: 'Storage Limit Per Organization (GB)', type: 'number' },
    { key: 'attachment_rules', label: 'Attachment Rules' },
    { key: 'voice_message_file_limit_mb', label: 'Voice Message File Limit (MB)', type: 'number' },
    { key: 'file_retention_days', label: 'File Retention Period', type: 'number' },
    { key: 'malware_scan', label: 'Malware Scan', type: 'select', options: ['planned', 'enabled', 'disabled'] },
  ],
  integrations: [
    { key: 'stripe_status', label: 'Stripe', type: 'select', options: ['not_connected', 'connected', 'error'] },
    { key: 'square_status', label: 'Square', type: 'select', options: ['not_connected', 'connected', 'error'] },
    { key: 'authorize_net_status', label: 'Authorize.net', type: 'select', options: ['not_connected', 'connected', 'error'] },
    { key: 'email_provider_status', label: 'Email Provider', type: 'select', options: ['not_connected', 'connected', 'error'] },
    { key: 'sms_provider_status', label: 'SMS Provider', type: 'select', options: ['not_connected', 'connected', 'error'] },
    { key: 'push_provider_status', label: 'Push Notification Provider', type: 'select', options: ['not_connected', 'connected', 'error'] },
    { key: 'google_maps_status', label: 'Google Maps', type: 'select', options: ['not_connected', 'connected', 'error'] },
    { key: 'calendar_status', label: 'Calendar Integration', type: 'select', options: ['not_connected', 'connected', 'error'] },
    { key: 'webhooks_status', label: 'Webhooks', type: 'select', options: ['disabled', 'enabled'] },
    { key: 'api_key_preview', label: 'API Keys' },
  ],
  maintenance: [
    { key: 'announcement_banner', label: 'System Announcement Banner', type: 'textarea' },
    { key: 'cache_status', label: 'Cache Status' },
    { key: 'search_index_status', label: 'Search Index Status' },
    { key: 'backup_status', label: 'Backup Status' },
    { key: 'system_health_url', label: 'System Health Link', type: 'url' },
    { key: 'version_label', label: 'Version / Build Information' },
  ],
};

const booleanFields: Partial<Record<SettingsSectionKey, Array<{ key: string; label: string; description: string }>>> = {
  billing: [
    { key: 'payment_gateway_enabled', label: 'Payment Gateway Enabled', description: 'Allow payment capture once a gateway is connected.' },
    { key: 'auto_suspend_unpaid_organizations', label: 'Auto-Suspend Unpaid Organizations', description: 'Restrict access after the configured grace period.' },
  ],
  security: [
    { key: 'break_glass_reason_required', label: 'Break-Glass Reason Required', description: 'Keep sensitive access tied to a required audit reason.' },
  ],
  email_notifications: [
    { key: 'system_announcement_enabled', label: 'System Announcements Enabled', description: 'Allow platform-wide announcement messages.' },
  ],
  files_storage: [
    { key: 'secure_file_preview', label: 'Secure File Preview', description: 'Require safe preview handling for uploaded files.' },
  ],
  maintenance: [
    { key: 'maintenance_mode', label: 'Maintenance Mode', description: 'Show users a platform maintenance message.' },
    { key: 'read_only_mode', label: 'Read-Only Mode', description: 'Allow viewing while blocking write operations.' },
    { key: 'force_logout_requested', label: 'Force Logout All Users', description: 'Queue a platform-wide logout action.' },
  ],
};

const featureLabels: Record<string, string> = {
  jobs: 'Jobs',
  scheduling: 'Scheduling',
  technicians: 'Technicians',
  customers: 'Customers',
  invoicing: 'Invoicing',
  payment_collection: 'Payment Collection',
  chatter: 'Chatter',
  voice_messages: 'Voice Messages',
  reports: 'Reports',
  notifications: 'Notifications',
  integrations: 'Integrations',
  api_access: 'API Access',
  custom_branding: 'Custom Branding',
};

function splitCsv(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function formatUpdatedAt(value?: string | null) {
  if (!value) return 'Not saved yet';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'Not saved yet' : parsed.toLocaleString();
}

export default function SuperAdminPlatformSettingsPage() {
  const [settings, setSettings] = useState<BackendSuperAdminPlatformSettings | null>(null);
  const [savedSettings, setSavedSettings] = useState<BackendSuperAdminPlatformSettings | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [lastReason, setLastReason] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SettingsSectionKey>('general');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [changeReason, setChangeReason] = useState('');
  const [sensitiveConfirmation, setSensitiveConfirmation] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const activeMeta = useMemo(() => sectionTabs.find((section) => section.key === activeSection) ?? sectionTabs[0], [activeSection]);
  const isSensitiveSection = Boolean(activeMeta.sensitive);

  const loadSettings = async () => {
    const token = getStoredSuperAdminToken();
    if (!token) {
      setError('Super Admin session missing. Please sign in again.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetchSuperAdminPlatformSettings(token);
      setSettings(response.settings);
      setSavedSettings(response.settings);
      setUpdatedAt(response.updated_at ?? null);
      setLastReason(response.last_change_reason ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load platform settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSettings();
  }, []);

  const updateSectionValue = (section: SettingsSectionKey, key: string, value: string | number | boolean | string[]) => {
    setSettings((current) => {
      if (!current) return current;
      return {
        ...current,
        [section]: {
          ...(current[section] as Record<string, unknown>),
          [key]: value,
        },
      };
    });
  };

  const updateFeatureValue = (featureKey: string, key: keyof BackendPlatformFeatureDefault, value: boolean) => {
    setSettings((current) => {
      if (!current) return current;
      return {
        ...current,
        feature_defaults: {
          ...current.feature_defaults,
          [featureKey]: {
            ...current.feature_defaults[featureKey],
            [key]: value,
          },
        },
      };
    });
  };

  const saveSettings = async () => {
    if (!settings) return;
    const token = getStoredSuperAdminToken();
    if (!token) {
      setError('Super Admin session missing. Please sign in again.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await updateSuperAdminPlatformSettings(token, {
        settings,
        reason: changeReason || undefined,
        sensitive_confirmation: sensitiveConfirmation || undefined,
      });
      setSettings(response.settings);
      setSavedSettings(response.settings);
      setUpdatedAt(response.updated_at ?? null);
      setLastReason(response.last_change_reason ?? null);
      setChangeReason('');
      setSensitiveConfirmation('');
      setConfirmOpen(false);
      toast.success('Platform settings saved.');
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Failed to save platform settings.';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    if (isSensitiveSection && !sensitiveConfirmation.trim()) {
      setConfirmOpen(true);
      return;
    }
    void saveSettings();
  };

  const resetSection = () => {
    if (!savedSettings) return;
    setSettings((current) => {
      if (!current) return current;
      return {
        ...current,
        [activeSection]: savedSettings[activeSection],
      };
    });
    setChangeReason('');
    setSensitiveConfirmation('');
  };

  const renderTextFields = (section: SettingsSectionKey) => {
    const sectionValues = (settings?.[section] ?? {}) as Record<string, unknown>;
    return (textFields[section] ?? []).map((field) => {
      const rawValue = sectionValues[field.key];
      const value = Array.isArray(rawValue) ? rawValue.join(', ') : String(rawValue ?? '');

      if (field.type === 'select') {
        return (
          <div key={field.key} className="space-y-2">
            <Label htmlFor={`${section}-${field.key}`}>{field.label}</Label>
            <select
              id={`${section}-${field.key}`}
              value={value}
              onChange={(event) => updateSectionValue(section, field.key, event.target.value)}
              className="h-11 w-full rounded-lg border border-slate-900/10 bg-[#faf6ef] px-3 text-sm text-slate-900"
            >
              {(field.options ?? []).map((option) => (
                <option key={option} value={option}>{option.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
        );
      }

      if (field.type === 'textarea') {
        return (
          <div key={field.key} className="space-y-2 md:col-span-2">
            <Label htmlFor={`${section}-${field.key}`}>{field.label}</Label>
            <Textarea
              id={`${section}-${field.key}`}
              value={value}
              onChange={(event) => updateSectionValue(section, field.key, event.target.value)}
              placeholder={field.placeholder}
              className="min-h-24 rounded-lg border-slate-900/10 bg-[#faf6ef]"
            />
          </div>
        );
      }

      return (
        <div key={field.key} className="space-y-2">
          <Label htmlFor={`${section}-${field.key}`}>{field.label}</Label>
          <Input
            id={`${section}-${field.key}`}
            type={field.type === 'number' ? 'number' : field.type === 'color' ? 'color' : field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'}
            value={value}
            onChange={(event) => {
              const nextValue = field.type === 'number'
                ? Number(event.target.value || 0)
                : field.type === 'csv'
                  ? splitCsv(event.target.value)
                  : event.target.value;
              updateSectionValue(section, field.key, nextValue);
            }}
            className={cn('h-11 rounded-lg border-slate-900/10 bg-[#faf6ef]', field.type === 'color' && 'p-1')}
          />
          {field.type === 'csv' ? <p className="text-xs text-slate-500">Separate values with commas.</p> : null}
        </div>
      );
    });
  };

  const renderBooleans = (section: SettingsSectionKey) => {
    const sectionValues = (settings?.[section] ?? {}) as Record<string, unknown>;
    return (booleanFields[section] ?? []).map((field) => (
      <div key={field.key} className="flex items-start justify-between gap-4 rounded-lg border border-slate-900/10 bg-[#faf6ef] p-4">
        <div>
          <p className="text-sm font-semibold text-slate-950">{field.label}</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">{field.description}</p>
        </div>
        <Switch
          checked={Boolean(sectionValues[field.key])}
          onCheckedChange={(checked) => updateSectionValue(section, field.key, checked)}
        />
      </div>
    ));
  };

  const renderFeatureDefaults = () => {
    if (!settings) return null;
    return (
      <div className="grid gap-3">
        {Object.entries(settings.feature_defaults).map(([featureKey, feature]) => (
          <div key={featureKey} className="rounded-lg border border-slate-900/10 bg-[#faf6ef] p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-950">{featureLabels[featureKey] ?? featureKey}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">{featureKey}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {([
                  ['enabled_by_default', 'Default On'],
                  ['available_by_plan', 'Plan Based'],
                  ['manual_override_allowed', 'Allow Override'],
                  ['enterprise_only', 'Enterprise Only'],
                ] as Array<[keyof BackendPlatformFeatureDefault, string]>).map(([key, label]) => (
                  <label key={key} className="flex items-center justify-between gap-3 rounded-lg border border-slate-900/10 bg-white px-3 py-2 text-sm text-slate-700">
                    <span>{label}</span>
                    <Switch checked={feature[key]} onCheckedChange={(checked) => updateFeatureValue(featureKey, key, checked)} />
                  </label>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-36 rounded-[2rem]" />
        <Skeleton className="h-[520px] rounded-[2rem]" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="space-y-4">
        <div className="rounded-[1.4rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error ?? 'Platform settings are unavailable.'}
        </div>
        <Button onClick={() => void loadSettings()} className="rounded-full bg-[linear-gradient(135deg,#0f172a,#155e75)] text-white hover:brightness-105">
          Retry
        </Button>
      </div>
    );
  }

  const ActiveIcon = activeMeta.icon;

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-900/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.95),rgba(246,238,227,0.92))] p-6 shadow-[0_28px_100px_rgba(15,23,42,0.1)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-900/10 bg-white/75 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-600">
              <Database className="h-3.5 w-3.5 text-cyan-800" />
              Platform Configuration
            </div>
            <h2 className="mt-5 text-4xl font-semibold leading-tight text-slate-950" style={{ fontFamily: '"Space Grotesk", "Sora", system-ui, sans-serif' }}>
              Platform Settings
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-700">
              Manage global SaaS defaults for branding, organizations, subscriptions, security, email, files, integrations, and operations.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="rounded-full border-slate-300 bg-white px-4 py-2 text-slate-700">
              Last updated: {formatUpdatedAt(updatedAt)}
            </Badge>
            <Button onClick={() => void loadSettings()} variant="outline" className="rounded-full border-slate-900/10 bg-white text-slate-900">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-[1.4rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}

      <Tabs value={activeSection} onValueChange={(value) => setActiveSection(value as SettingsSectionKey)} className="space-y-5">
        <TabsList className="grid h-auto grid-cols-2 gap-2 rounded-[1.4rem] bg-[#eee5d9] p-2 md:grid-cols-5">
          {sectionTabs.map((section) => {
            const Icon = section.icon;
            return (
              <TabsTrigger key={section.key} value={section.key} className="min-h-11 rounded-xl px-3 text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-slate-950">
                <Icon className="mr-2 h-4 w-4" />
                {section.shortLabel}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {sectionTabs.map((section) => (
          <TabsContent key={section.key} value={section.key} className="space-y-5">
            <Card className="rounded-[2rem] border-slate-900/10 bg-white/85">
              <CardHeader>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex items-start gap-4">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0f172a,#155e75)] text-white">
                      <ActiveIcon className="h-5 w-5" />
                    </span>
                    <div>
                      <CardTitle className="text-2xl tracking-normal text-slate-950" style={{ fontFamily: '"Space Grotesk", "Sora", system-ui, sans-serif' }}>
                        {section.label}
                      </CardTitle>
                      <CardDescription className="mt-2 text-sm leading-6">{section.description}</CardDescription>
                    </div>
                  </div>
                  {section.sensitive ? (
                    <Badge className="w-fit rounded-full bg-amber-100 px-4 py-2 text-amber-900">
                      <ShieldAlert className="mr-2 h-4 w-4" />
                      Confirmation required
                    </Badge>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {section.key === 'feature_defaults' ? (
                  renderFeatureDefaults()
                ) : (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">{renderTextFields(section.key)}</div>
                    {renderBooleans(section.key).length > 0 ? (
                      <div className="grid gap-3 md:grid-cols-2">{renderBooleans(section.key)}</div>
                    ) : null}
                  </>
                )}

                <div className="grid gap-4 border-t border-slate-900/10 pt-5 md:grid-cols-[minmax(0,1fr)_minmax(16rem,0.75fr)]">
                  <div className="space-y-2">
                    <Label htmlFor="platform-settings-reason">Change Reason</Label>
                    <Textarea
                      id="platform-settings-reason"
                      value={changeReason}
                      onChange={(event) => setChangeReason(event.target.value)}
                      placeholder="Summarize why this platform configuration is changing."
                      className="min-h-24 rounded-lg border-slate-900/10 bg-[#faf6ef]"
                    />
                    {lastReason ? <p className="text-xs text-slate-500">Previous reason: {lastReason}</p> : null}
                  </div>
                  {isSensitiveSection ? (
                    <div className="space-y-2">
                      <Label htmlFor="platform-settings-sensitive-confirmation">Sensitive Change Confirmation</Label>
                      <Textarea
                        id="platform-settings-sensitive-confirmation"
                        value={sensitiveConfirmation}
                        onChange={(event) => setSensitiveConfirmation(event.target.value)}
                        placeholder="Required for security, integration, and maintenance changes."
                        className="min-h-24 rounded-lg border-amber-200 bg-amber-50"
                      />
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button onClick={handleSave} disabled={saving} className="rounded-full bg-[linear-gradient(135deg,#0f172a,#155e75)] text-white hover:brightness-105">
                    <Save className="mr-2 h-4 w-4" />
                    {saving ? 'Saving...' : 'Save settings'}
                  </Button>
                  <Button onClick={resetSection} disabled={saving} variant="outline" className="rounded-full border-slate-900/10 bg-white text-slate-900">
                    Reset section
                  </Button>
                  <Button asChild variant="ghost" className="rounded-full text-slate-700">
                    <a href="/super-admin/audit-logs?module=platform_settings">View audit log</a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="border-slate-900/10 bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm sensitive platform change</AlertDialogTitle>
            <AlertDialogDescription>
              Security, integration, and maintenance settings affect the entire platform. Add a confirmation reason before saving this section.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={sensitiveConfirmation}
            onChange={(event) => setSensitiveConfirmation(event.target.value)}
            placeholder="Example: Updating session timeout after security review."
            className="min-h-28 rounded-lg border-amber-200 bg-amber-50"
          />
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full border-slate-900/10 bg-white text-slate-900">Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!sensitiveConfirmation.trim()}
              onClick={() => void saveSettings()}
              className="rounded-full bg-[linear-gradient(135deg,#7f1d1d,#b91c1c)] text-white hover:brightness-105"
            >
              Save sensitive settings
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

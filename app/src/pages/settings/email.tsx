import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, RotateCcw, Save, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { SectionCard } from '@/components/settings/SectionCard';
import { FormField } from '@/components/settings/FormField';
import { useSettingsWorkspace } from '@/components/settings/WorkspaceProvider';
import { EMAIL_IDENTITY_STORAGE_KEY } from '@/components/settings/storage';
import { settingsControlButtonClass } from '@/components/settings/visual';
import {
  fetchAdminTenantEmailIdentity,
  getStoredAdminToken,
  updateAdminTenantEmailIdentity,
  type BackendTenantEmailIdentity,
  type BackendTenantEmailIdentityUpdatePayload,
} from '@/lib/backend-api';
import { cn } from '@/lib/utils';
import { safeParseJSON, safeSetItem } from '@/lib/storage';

type EmailIdentityDraft = {
  email_domain: string;
  support_email: string;
  billing_email: string;
  invoice_email: string;
  notification_email: string;
  invoice_email_subject: string;
  invoice_email_body: string;
};

const EMPTY_DRAFT: EmailIdentityDraft = {
  email_domain: '',
  support_email: '',
  billing_email: '',
  invoice_email: '',
  notification_email: '',
  invoice_email_subject: '',
  invoice_email_body: '',
};

const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_INVOICE_EMAIL_SUBJECT = 'Invoice ${invoice_number} from ${company_name}';
const DEFAULT_INVOICE_EMAIL_BODY = [
  'Hello ${customer_name},',
  '',
  'Your invoice ${invoice_number} from ${company_name} is ready.',
  '',
  'Invoice date: ${invoice_date}',
  'Due date: ${due_date}',
  'Total due: ${invoice_total}',
  '',
  'Bill to:',
  '${billing_address}',
  '',
  'Line items:',
  '${line_items_summary}',
  '',
  'A PDF copy is attached to this email.',
  '',
  'Questions? Reply to ${reply_to_email} or ${billing_email}.',
  '',
  'Thank you,',
  '${company_name}',
].join('\n');

function createDraftFromIdentity(identity: BackendTenantEmailIdentity): EmailIdentityDraft {
  return {
    email_domain: identity.email_domain ?? '',
    support_email: identity.support_email ?? '',
    billing_email: identity.billing_email ?? '',
    invoice_email: identity.invoice_email ?? '',
    notification_email: identity.notification_email ?? '',
    invoice_email_subject: identity.invoice_email_subject ?? DEFAULT_INVOICE_EMAIL_SUBJECT,
    invoice_email_body: identity.invoice_email_body ?? DEFAULT_INVOICE_EMAIL_BODY,
  };
}

function buildPayloadFromDraft(draft: EmailIdentityDraft): BackendTenantEmailIdentityUpdatePayload {
  return {
    email_domain: draft.email_domain.trim() || null,
    support_email: draft.support_email.trim() || null,
    billing_email: draft.billing_email.trim() || null,
    invoice_email: draft.invoice_email.trim() || null,
    notification_email: draft.notification_email.trim() || null,
    invoice_email_subject: draft.invoice_email_subject.trim(),
    invoice_email_body: draft.invoice_email_body.trim(),
  };
}

function buildLocalIdentityFromDraft(
  draft: EmailIdentityDraft,
  fallback: BackendTenantEmailIdentity,
): BackendTenantEmailIdentity {
  return {
    ...fallback,
    email_domain: draft.email_domain.trim(),
    support_email: draft.support_email.trim(),
    billing_email: draft.billing_email.trim(),
    invoice_email: draft.invoice_email.trim(),
    notification_email: draft.notification_email.trim(),
    invoice_email_subject: draft.invoice_email_subject.trim(),
    invoice_email_body: draft.invoice_email_body.trim(),
  };
}

function normalizeEmailIdentity(
  value: Partial<BackendTenantEmailIdentity> | null | undefined,
  fallback: BackendTenantEmailIdentity,
): BackendTenantEmailIdentity {
  return {
    tenant_id: typeof value?.tenant_id === 'string' ? value.tenant_id : fallback.tenant_id,
    company_name: typeof value?.company_name === 'string' ? value.company_name : fallback.company_name,
    tenant_slug: typeof value?.tenant_slug === 'string' ? value.tenant_slug : fallback.tenant_slug,
    support_email: typeof value?.support_email === 'string' ? value.support_email : fallback.support_email,
    billing_email: typeof value?.billing_email === 'string' ? value.billing_email : fallback.billing_email,
    invoice_email: typeof value?.invoice_email === 'string' ? value.invoice_email : fallback.invoice_email,
    notification_email: typeof value?.notification_email === 'string' ? value.notification_email : fallback.notification_email,
    invoice_email_subject: typeof value?.invoice_email_subject === 'string'
      ? value.invoice_email_subject
      : fallback.invoice_email_subject,
    invoice_email_body: typeof value?.invoice_email_body === 'string'
      ? value.invoice_email_body
      : fallback.invoice_email_body,
    email_domain: typeof value?.email_domain === 'string' ? value.email_domain : fallback.email_domain,
    email_sending_status: typeof value?.email_sending_status === 'string' ? value.email_sending_status : fallback.email_sending_status,
    email_verified: typeof value?.email_verified === 'boolean' ? value.email_verified : fallback.email_verified,
  };
}

function validateDraft(draft: EmailIdentityDraft): Partial<Record<keyof EmailIdentityDraft, string>> {
  const errors: Partial<Record<keyof EmailIdentityDraft, string>> = {};

  for (const key of ['support_email', 'billing_email', 'invoice_email', 'notification_email'] as const) {
    const value = draft[key].trim();
    if (value && !EMAIL_ADDRESS_PATTERN.test(value)) {
      errors[key] = 'Enter a valid email address or leave this blank.';
    }
  }

  if (!draft.invoice_email_subject.trim()) {
    errors.invoice_email_subject = 'Invoice email subject is required.';
  } else if (draft.invoice_email_subject.trim().length > 255) {
    errors.invoice_email_subject = 'Keep the invoice subject under 255 characters.';
  }

  if (!draft.invoice_email_body.trim()) {
    errors.invoice_email_body = 'Invoice email body is required.';
  } else if (draft.invoice_email_body.trim().length > 5000) {
    errors.invoice_email_body = 'Keep the invoice body under 5000 characters.';
  }

  return errors;
}

function createFallbackEmailIdentity(workspace: ReturnType<typeof useSettingsWorkspace>): BackendTenantEmailIdentity {
  const current = workspace.emailIdentity;
  const sharedEmail = workspace.invoiceBranding.email || '';

  return {
    tenant_id: current?.tenant_id || 'workspace',
    company_name: current?.company_name || workspace.invoiceBranding.name || 'NexusOps',
    tenant_slug: current?.tenant_slug || 'workspace',
    support_email: current?.support_email || sharedEmail,
    billing_email: current?.billing_email || sharedEmail,
    invoice_email: current?.invoice_email || sharedEmail,
    notification_email: current?.notification_email || sharedEmail,
    invoice_email_subject: current?.invoice_email_subject || DEFAULT_INVOICE_EMAIL_SUBJECT,
    invoice_email_body: current?.invoice_email_body || DEFAULT_INVOICE_EMAIL_BODY,
    email_domain: current?.email_domain || '',
    email_sending_status: current?.email_sending_status || 'not configured',
    email_verified: current?.email_verified ?? false,
  };
}

export default function SettingsEmailPage() {
  const workspace = useSettingsWorkspace();
  const [settings, setSettings] = useState<BackendTenantEmailIdentity | null>(null);
  const [savedSettings, setSavedSettings] = useState<BackendTenantEmailIdentity | null>(null);
  const [draft, setDraft] = useState<EmailIdentityDraft>(EMPTY_DRAFT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connectionState, setConnectionState] = useState<'backend' | 'cache'>('cache');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof EmailIdentityDraft, string>>>({});

  const fallbackSettings = useMemo(
    () => createFallbackEmailIdentity(workspace),
    [workspace.emailIdentity, workspace.invoiceBranding.email, workspace.invoiceBranding.name],
  );

  const currentSettings = settings ?? fallbackSettings;
  const isLive = connectionState === 'backend';

  const statusBadge = useMemo(() => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge
        variant="outline"
        className={cn(
          'rounded-full',
          isLive
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
            : 'border-slate-400/40 bg-muted/30 text-muted-foreground',
        )}
      >
        {isLive ? 'Live API' : 'Cached copy'}
      </Badge>
      <Badge variant="outline" className="rounded-full">
        {currentSettings.email_sending_status}
      </Badge>
      <Badge variant="outline" className="rounded-full">
        {currentSettings.email_verified ? 'Verified' : 'Unverified'}
      </Badge>
    </div>
  ), [currentSettings.email_sending_status, currentSettings.email_verified, isLive]);

  const loadSettings = async () => {
    if (workspace.loading) {
      return;
    }

    setLoading(true);
    setError(null);
    setFieldErrors({});

    const cachedSettings = safeParseJSON<BackendTenantEmailIdentity | null>(EMAIL_IDENTITY_STORAGE_KEY, null);
    const cachedOrFallback = normalizeEmailIdentity(cachedSettings, fallbackSettings);
    setSettings(cachedOrFallback);
    setSavedSettings(cachedOrFallback);
    setDraft(createDraftFromIdentity(cachedOrFallback));
    setConnectionState(workspace.canUseBackend && !cachedSettings ? 'backend' : 'cache');

    const token = getStoredAdminToken();
    if (!workspace.canUseBackend || !token) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetchAdminTenantEmailIdentity(token);
      const normalized = normalizeEmailIdentity(response, cachedOrFallback);
      setSettings(normalized);
      setSavedSettings(normalized);
      setDraft(createDraftFromIdentity(normalized));
      setConnectionState('backend');
      safeSetItem(EMAIL_IDENTITY_STORAGE_KEY, JSON.stringify(normalized));
    } catch (loadError) {
      setConnectionState('cache');
      setError(loadError instanceof Error ? loadError.message : 'Failed to load email settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.canUseBackend, workspace.loading, workspace.lastRefreshedAt]);

  const handleReset = () => {
    if (!savedSettings) {
      return;
    }

    setDraft(createDraftFromIdentity(savedSettings));
    setFieldErrors({});
    setError(null);
    toast.success('Email draft reset.');
  };

  const handleGenerateInvoiceTemplate = () => {
    setDraft((current) => ({
      ...current,
      invoice_email_subject: DEFAULT_INVOICE_EMAIL_SUBJECT,
      invoice_email_body: DEFAULT_INVOICE_EMAIL_BODY,
    }));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next.invoice_email_subject;
      delete next.invoice_email_body;
      return next;
    });
    setError(null);
    toast.success('Invoice email template generated.');
  };

  const handleResetInvoiceTemplate = () => {
    if (!savedSettings) {
      return;
    }

    setDraft((current) => ({
      ...current,
      invoice_email_subject: savedSettings.invoice_email_subject ?? DEFAULT_INVOICE_EMAIL_SUBJECT,
      invoice_email_body: savedSettings.invoice_email_body ?? DEFAULT_INVOICE_EMAIL_BODY,
    }));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next.invoice_email_subject;
      delete next.invoice_email_body;
      return next;
    });
    setError(null);
    toast.success('Invoice template reset.');
  };

  const handleSave = async () => {
    const nextFieldErrors = validateDraft(draft);
    setFieldErrors(nextFieldErrors);
    if (Object.keys(nextFieldErrors).length > 0) {
      toast.error('Please fix the highlighted email fields.');
      return;
    }

    const nextPayload = buildPayloadFromDraft(draft);
    const nextLocalIdentity = buildLocalIdentityFromDraft(draft, currentSettings);

    setSaving(true);
    setError(null);

    const token = getStoredAdminToken();
    if (workspace.canUseBackend && token) {
      try {
        const response = await updateAdminTenantEmailIdentity(token, nextPayload);
        const normalized = normalizeEmailIdentity(response, nextLocalIdentity);
        safeSetItem(EMAIL_IDENTITY_STORAGE_KEY, JSON.stringify(normalized));
        setSettings(normalized);
        setSavedSettings(normalized);
        setDraft(createDraftFromIdentity(normalized));
        setConnectionState('backend');
        void workspace.refresh();
        toast.success('Email settings saved.');
      } catch (saveError) {
        const normalized = nextLocalIdentity;
        safeSetItem(EMAIL_IDENTITY_STORAGE_KEY, JSON.stringify(normalized));
        setSettings(normalized);
        setSavedSettings(normalized);
        setDraft(createDraftFromIdentity(normalized));
        setConnectionState('cache');
        void workspace.refresh();
        const message = saveError instanceof Error ? saveError.message : 'Failed to save email settings.';
        setError(message);
        toast.error(message);
      } finally {
        setSaving(false);
      }
      return;
    }

    safeSetItem(EMAIL_IDENTITY_STORAGE_KEY, JSON.stringify(nextLocalIdentity));
    setSettings(nextLocalIdentity);
    setSavedSettings(nextLocalIdentity);
    setDraft(createDraftFromIdentity(nextLocalIdentity));
    setConnectionState('cache');
    void workspace.refresh();
    setSaving(false);
    toast.success('Email settings saved locally.');
  };

  if (workspace.loading || loading) {
    return (
      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4">
          <SectionCard title="Loading email settings..." description="Syncing routing inboxes and the invoice template.">
            <div className="space-y-4">
              <Skeleton className="h-12 rounded-2xl" />
              <div className="grid gap-3 sm:grid-cols-2">
                <Skeleton className="h-24 rounded-[24px]" />
                <Skeleton className="h-24 rounded-[24px]" />
                <Skeleton className="h-24 rounded-[24px]" />
                <Skeleton className="h-24 rounded-[24px]" />
              </div>
            </div>
          </SectionCard>
          <Skeleton className="h-[360px] rounded-[28px]" />
          <Skeleton className="h-[520px] rounded-[28px]" />
        </div>
        <Skeleton className="h-[560px] rounded-[28px]" />
      </div>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
      <div className="space-y-4">
        {error ? (
          <div className="rounded-[1.4rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <SectionCard
          title="Email addresses"
          description="Route support, billing, invoice, and notification mail to the right inbox."
          footer={
            <div className="flex w-full flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                className={cn('rounded-full', settingsControlButtonClass)}
                onClick={() => void loadSettings()}
                disabled={saving}
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
              <Button
                type="button"
                variant="ghost"
                className={cn('rounded-full', settingsControlButtonClass)}
                onClick={handleReset}
                disabled={saving}
              >
                Reset
              </Button>
              <Button type="button" className="rounded-full" onClick={() => void handleSave()} disabled={saving}>
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save email settings'}
              </Button>
            </div>
          }
        >
          <div className="grid gap-5 md:grid-cols-2">
            <FormField label="Support email" description="Shared support inbox for customer requests." error={fieldErrors.support_email}>
              <Input
                type="email"
                value={draft.support_email}
                onChange={(e) => setDraft((current) => ({ ...current, support_email: e.target.value }))}
                placeholder="support@nexusops.com"
                aria-invalid={Boolean(fieldErrors.support_email)}
              />
            </FormField>
            <FormField label="Billing email" description="Used for invoices and payment notices." error={fieldErrors.billing_email}>
              <Input
                type="email"
                value={draft.billing_email}
                onChange={(e) => setDraft((current) => ({ ...current, billing_email: e.target.value }))}
                placeholder="billing@nexusops.com"
                aria-invalid={Boolean(fieldErrors.billing_email)}
              />
            </FormField>
            <FormField label="Invoice email" description="Copies invoice receipts to this inbox." error={fieldErrors.invoice_email}>
              <Input
                type="email"
                value={draft.invoice_email}
                onChange={(e) => setDraft((current) => ({ ...current, invoice_email: e.target.value }))}
                placeholder="invoice@nexusops.com"
                aria-invalid={Boolean(fieldErrors.invoice_email)}
              />
            </FormField>
            <FormField label="Notification email" description="Receives deliverability and system updates." error={fieldErrors.notification_email}>
              <Input
                type="email"
                value={draft.notification_email}
                onChange={(e) => setDraft((current) => ({ ...current, notification_email: e.target.value }))}
                placeholder="notifications@nexusops.com"
                aria-invalid={Boolean(fieldErrors.notification_email)}
              />
            </FormField>
          </div>
        </SectionCard>

        <SectionCard
          title="Invoice email template"
          description="Generate and edit the subject and body used when invoice emails are sent."
          action={
            <Badge variant="outline" className="rounded-full">
              <Wand2 className="mr-1.5 h-3.5 w-3.5" />
              Editable draft
            </Badge>
          }
          footer={
            <div className="flex w-full flex-wrap items-center justify-between gap-3">
              <p className="text-xs leading-5 text-muted-foreground">
                Template changes are saved with the email settings action above.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  className={cn('rounded-full', settingsControlButtonClass)}
                  onClick={handleGenerateInvoiceTemplate}
                  disabled={saving}
                >
                  <Wand2 className="h-4 w-4" />
                  Generate template
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className={cn('rounded-full', settingsControlButtonClass)}
                  onClick={handleResetInvoiceTemplate}
                  disabled={saving}
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset template
                </Button>
                <Button type="button" className="rounded-full" onClick={() => void handleSave()} disabled={saving}>
                  <Save className="h-4 w-4" />
                  {saving ? 'Saving...' : 'Save template'}
                </Button>
              </div>
            </div>
          }
        >
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
            <div className="space-y-5">
              <FormField
                label="Template subject"
                description="Used as the email subject line when an invoice is sent."
                error={fieldErrors.invoice_email_subject}
              >
                <Input
                  value={draft.invoice_email_subject}
                  onChange={(e) => setDraft((current) => ({ ...current, invoice_email_subject: e.target.value }))}
                  placeholder="Invoice ${invoice_number} from ${company_name}"
                  maxLength={255}
                  aria-invalid={Boolean(fieldErrors.invoice_email_subject)}
                />
              </FormField>

              <FormField
                label="Template body"
                description="Write the invoice message with placeholder tags for invoice and customer data."
                error={fieldErrors.invoice_email_body}
              >
                <Textarea
                  value={draft.invoice_email_body}
                  onChange={(e) => setDraft((current) => ({ ...current, invoice_email_body: e.target.value }))}
                  placeholder="Hello ${customer_name},"
                  className="min-h-80 rounded-[22px] font-mono text-sm leading-6"
                  maxLength={5000}
                  aria-invalid={Boolean(fieldErrors.invoice_email_body)}
                />
              </FormField>

              <p className="text-xs leading-5 text-muted-foreground">
                Available tags: <code>${'{customer_name}'}</code>, <code>${'{company_name}'}</code>, <code>${'{invoice_number}'}</code>, <code>${'{invoice_date}'}</code>, <code>${'{due_date}'}</code>, <code>${'{invoice_total}'}</code>, <code>${'{billing_address}'}</code>, <code>${'{line_items_summary}'}</code>, <code>${'{reply_to_email}'}</code>, <code>${'{billing_email}'}</code>
              </p>
            </div>

            <div className="space-y-4">
              <div className="rounded-[24px] border border-border/70 bg-background/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Preview</p>
                <div className="mt-3 rounded-[20px] border border-border/60 bg-muted/20 p-4">
                  <p className="text-sm font-semibold text-foreground">{draft.invoice_email_subject || 'Invoice subject preview'}</p>
                  <div className="mt-4 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                    {draft.invoice_email_body || 'Your invoice template body appears here.'}
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-border/70 bg-[linear-gradient(180deg,rgba(15,23,42,0.95),rgba(9,17,31,0.98))] p-4 text-white">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/55">Template scope</p>
                <p className="mt-2 text-sm leading-6 text-white/75">
                  This template is rendered by the invoice send flow, so the final email can be personalized with invoice numbers, totals, due dates, and customer details.
                </p>
                <div className="mt-4 grid gap-2 text-xs text-white/70">
                  <div className="flex items-center justify-between gap-3">
                    <span>Subject line</span>
                    <span className="font-medium text-white">Enabled</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Body editor</span>
                    <span className="font-medium text-white">Enabled</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Invoice send flow</span>
                    <span className="font-medium text-emerald-300">Connected</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Sending status"
        description="Review the current state of the email pipeline and routing inboxes."
      >
        <div className="space-y-4">
          <div className="rounded-[24px] border border-border/70 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(9,17,31,0.98))] p-5 text-white">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/60">
              Current status
            </p>
            <p className="mt-2 text-3xl font-semibold tracking-[-0.05em]">
              {currentSettings.email_sending_status}
            </p>
            <p className="mt-2 text-sm leading-6 text-white/70">
              Outbound email identity is tied to the selected routing inboxes.
            </p>
          </div>

          <div className="grid gap-3 rounded-[24px] border border-border/70 bg-background/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">Support route</span>
              <span className="text-sm font-medium text-foreground">{draft.support_email || 'Not set'}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">Billing route</span>
              <span className="text-sm font-medium text-foreground">{draft.billing_email || 'Not set'}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">Invoice route</span>
              <span className="text-sm font-medium text-foreground">{draft.invoice_email || 'Not set'}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">Notification route</span>
              <span className="text-sm font-medium text-foreground">{draft.notification_email || 'Not set'}</span>
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

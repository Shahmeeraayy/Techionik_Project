import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SectionCard } from '@/components/settings/SectionCard';
import { FormField } from '@/components/settings/FormField';
import { useSettingsWorkspace } from '@/components/settings/WorkspaceProvider';
import { getStoredAdminToken, updateAdminTenantEmailIdentity } from '@/lib/backend-api';

type EmailIdentityDraft = {
  email_domain: string;
  support_email: string;
  billing_email: string;
  invoice_email: string;
  notification_email: string;
};

const DEFAULT_DRAFT: EmailIdentityDraft = {
  email_domain: '',
  support_email: '',
  billing_email: '',
  invoice_email: '',
  notification_email: '',
};

export default function SettingsEmailPage() {
  const workspace = useSettingsWorkspace();
  const [draft, setDraft] = useState<EmailIdentityDraft>(DEFAULT_DRAFT);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (workspace.loading) {
      return;
    }

    setDraft({
      email_domain: workspace.emailIdentity?.email_domain ?? '',
      support_email: workspace.emailIdentity?.support_email ?? '',
      billing_email: workspace.emailIdentity?.billing_email ?? '',
      invoice_email: workspace.emailIdentity?.invoice_email ?? '',
      notification_email: workspace.emailIdentity?.notification_email ?? '',
    });
  }, [workspace.emailIdentity, workspace.loading, workspace.lastRefreshedAt]);

  const statusBadge = useMemo(() => {
    const sendingStatus = workspace.emailIdentity?.email_sending_status ?? 'not configured';
    const verified = workspace.emailIdentity?.email_verified ?? false;

    return (
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant="outline"
          className="rounded-full"
        >
          {sendingStatus}
        </Badge>
        <Badge
          variant="outline"
          className="rounded-full"
        >
          {verified ? 'Verified' : 'Unverified'}
        </Badge>
      </div>
    );
  }, [workspace.emailIdentity]);

  const handleSave = async () => {
    if (!draft.email_domain.trim()) {
      toast.error('Email domain is required.');
      return;
    }

    if (!workspace.canUseBackend) {
      toast.error('Connect an admin token to save email settings.');
      return;
    }

    const token = getStoredAdminToken();
    if (!token) {
      toast.error('Admin token not found.');
      return;
    }

    setSaving(true);
    try {
      await updateAdminTenantEmailIdentity(token, {
        email_domain: draft.email_domain.trim(),
        support_email: draft.support_email.trim() || null,
        billing_email: draft.billing_email.trim() || null,
        invoice_email: draft.invoice_email.trim() || null,
        notification_email: draft.notification_email.trim() || null,
      });
      await workspace.refresh();
      toast.success('Email settings saved.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save email settings.');
    } finally {
      setSaving(false);
    }
  };

  if (workspace.loading) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Loading email settings..." description="Please wait while the email identity is loaded.">
          <div className="space-y-3">
            <div className="h-14 animate-pulse rounded-2xl bg-muted" />
            <div className="h-14 animate-pulse rounded-2xl bg-muted" />
          </div>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <div className="space-y-4">
        <SectionCard
          title="Domain setup"
          description="Configure the domain that your outbound mail will use."
          action={statusBadge}
        >
          <FormField
            label="Email domain"
            description="Example: mail.nexusops.com"
          >
            <Input
              value={draft.email_domain}
              onChange={(e) => setDraft((current) => ({ ...current, email_domain: e.target.value }))}
              placeholder="mail.nexusops.com"
            />
          </FormField>

          <div className="grid gap-3 rounded-[24px] border border-border/70 bg-muted/20 p-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Tenant</p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {workspace.emailIdentity?.tenant_slug || 'workspace'}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Company</p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {workspace.emailIdentity?.company_name || workspace.invoiceBranding.name}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Sending</p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {workspace.emailIdentity?.email_sending_status || 'Not configured'}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Verified</p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {workspace.emailIdentity?.email_verified ? 'Yes' : 'No'}
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Email addresses"
          description="Route support, billing, invoice, and notification mail to the right inbox."
          footer={
            <div className="flex w-full items-center justify-end gap-2">
              <Button type="button" variant="outline" className="rounded-full" onClick={() => setDraft({
                email_domain: workspace.emailIdentity?.email_domain ?? '',
                support_email: workspace.emailIdentity?.support_email ?? '',
                billing_email: workspace.emailIdentity?.billing_email ?? '',
                invoice_email: workspace.emailIdentity?.invoice_email ?? '',
                notification_email: workspace.emailIdentity?.notification_email ?? '',
              })} disabled={saving}>
                Reset
              </Button>
              <Button type="button" className="rounded-full" onClick={() => void handleSave()} disabled={saving || !workspace.canUseBackend}>
                {saving ? 'Saving...' : 'Save email settings'}
              </Button>
            </div>
          }
        >
          <div className="grid gap-5 md:grid-cols-2">
            <FormField label="Support email">
              <Input value={draft.support_email} onChange={(e) => setDraft((current) => ({ ...current, support_email: e.target.value }))} placeholder="support@nexusops.com" />
            </FormField>
            <FormField label="Billing email">
              <Input value={draft.billing_email} onChange={(e) => setDraft((current) => ({ ...current, billing_email: e.target.value }))} placeholder="billing@nexusops.com" />
            </FormField>
            <FormField label="Invoice email">
              <Input value={draft.invoice_email} onChange={(e) => setDraft((current) => ({ ...current, invoice_email: e.target.value }))} placeholder="invoice@nexusops.com" />
            </FormField>
            <FormField label="Notification email">
              <Input value={draft.notification_email} onChange={(e) => setDraft((current) => ({ ...current, notification_email: e.target.value }))} placeholder="notifications@nexusops.com" />
            </FormField>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Sending status"
        description="Review the current state of the email pipeline and domain trust."
      >
        <div className="space-y-4">
          <div className="rounded-[24px] border border-border/70 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(9,17,31,0.98))] p-5 text-white">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/60">
              Current status
            </p>
            <p className="mt-2 text-3xl font-semibold tracking-[-0.05em]">
              {workspace.emailIdentity?.email_sending_status || 'Not configured'}
            </p>
            <p className="mt-2 text-sm leading-6 text-white/70">
              Outbound email identity is tied to the chosen domain and routing inboxes.
            </p>
          </div>

          <div className="grid gap-3 rounded-[24px] border border-border/70 bg-background/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">Domain</span>
              <span className="text-sm font-medium text-foreground">{draft.email_domain || 'Not set'}</span>
            </div>
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


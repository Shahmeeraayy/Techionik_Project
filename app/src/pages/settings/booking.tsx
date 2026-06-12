import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Copy, Link2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { SectionCard } from '@/components/settings/SectionCard';
import { FormField } from '@/components/settings/FormField';
import { ToggleSwitch } from '@/components/settings/ToggleSwitch';
import { useSettingsWorkspace } from '@/components/settings/WorkspaceProvider';
import { getStoredAdminToken, updateAdminBookingPortalSettings } from '@/lib/backend-api';

type BookingPortalDraft = {
  enabled: boolean;
  statusLookupEnabled: boolean;
  industryType: 'automotive' | 'property' | 'general';
  responseTimeMessage: string;
  confirmationEmailBody: string;
  visibleServiceIds: string[];
  detailsFieldLabel: string;
};

const DEFAULT_DRAFT: BookingPortalDraft = {
  enabled: false,
  statusLookupEnabled: false,
  industryType: 'automotive',
  responseTimeMessage: '',
  confirmationEmailBody: '',
  visibleServiceIds: [],
  detailsFieldLabel: '',
};

const copyText = async (value: string, label: string) => {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied.`);
  } catch {
    toast.error(`Unable to copy ${label.toLowerCase()}.`);
  }
};

export default function SettingsBookingPage() {
  const workspace = useSettingsWorkspace();
  const [draft, setDraft] = useState<BookingPortalDraft>(DEFAULT_DRAFT);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (workspace.loading) {
      return;
    }

    setDraft({
      enabled: workspace.bookingPortalSettings.is_enabled,
      statusLookupEnabled: workspace.bookingPortalSettings.status_lookup_enabled,
      industryType: workspace.bookingPortalSettings.industry_type,
      responseTimeMessage: workspace.bookingPortalSettings.estimated_response_time_message,
      confirmationEmailBody: workspace.bookingPortalSettings.confirmation_email_body,
      visibleServiceIds: workspace.bookingPortalSettings.visible_service_ids,
      detailsFieldLabel: workspace.bookingPortalSettings.details_field_label ?? '',
    });
  }, [workspace.bookingPortalSettings, workspace.loading, workspace.lastRefreshedAt]);

  const bookingTenantSlug = workspace.bookingPortalSettings.tenant_slug || workspace.emailIdentity?.tenant_slug || 'workspace';
  const bookingUrl = workspace.bookingPortalSettings.public_booking_url || (typeof window !== 'undefined' ? `${window.location.origin}/book/${bookingTenantSlug}` : `/book/${bookingTenantSlug}`);
  const bookingStatusUrl = workspace.bookingPortalSettings.status_lookup_url || `${bookingUrl}/status`;
  const visibleServices = useMemo(
    () => workspace.services.filter((service) => service.status === 'active' && draft.visibleServiceIds.includes(service.id)),
    [draft.visibleServiceIds, workspace.services],
  );

  const handleSave = async () => {
    if (!workspace.canUseBackend) {
      toast.error('Connect an admin token to save booking settings.');
      return;
    }

    const token = getStoredAdminToken();
    if (!token) {
      toast.error('Admin token not found.');
      return;
    }

    if (!draft.responseTimeMessage.trim()) {
      toast.error('Please add a response time message.');
      return;
    }

    if (!draft.confirmationEmailBody.trim()) {
      toast.error('Please add a confirmation email body.');
      return;
    }

    setSaving(true);
    try {
      await updateAdminBookingPortalSettings(token, {
        is_enabled: draft.enabled,
        estimated_response_time_message: draft.responseTimeMessage.trim(),
        confirmation_email_body: draft.confirmationEmailBody.trim(),
        visible_service_ids: draft.visibleServiceIds,
        status_lookup_enabled: draft.statusLookupEnabled,
        industry_type: draft.industryType,
        details_field_label: draft.detailsFieldLabel.trim() || null,
      });
      await workspace.refresh();
      toast.success('Booking portal saved.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save booking portal settings.');
    } finally {
      setSaving(false);
    }
  };

  if (workspace.loading) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Loading booking portal..." description="The portal settings are being prepared.">
          <div className="space-y-3">
            <div className="h-16 animate-pulse rounded-2xl bg-muted" />
            <div className="h-16 animate-pulse rounded-2xl bg-muted" />
          </div>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_0.95fr]">
      <div className="space-y-4">
        <SectionCard
          title="Portal controls"
          description="Enable the booking portal, pick the industry preset, and tune response messaging."
          action={
            <Badge variant="outline" className="rounded-full">
              {draft.enabled ? 'Online' : 'Offline'}
            </Badge>
          }
          footer={
            <div className="flex w-full items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={() =>
                  setDraft({
                    enabled: workspace.bookingPortalSettings.is_enabled,
                    statusLookupEnabled: workspace.bookingPortalSettings.status_lookup_enabled,
                    industryType: workspace.bookingPortalSettings.industry_type,
                    responseTimeMessage: workspace.bookingPortalSettings.estimated_response_time_message,
                    confirmationEmailBody: workspace.bookingPortalSettings.confirmation_email_body,
                    visibleServiceIds: workspace.bookingPortalSettings.visible_service_ids,
                    detailsFieldLabel: workspace.bookingPortalSettings.details_field_label ?? '',
                  })
                }
                disabled={saving}
              >
                Reset
              </Button>
              <Button type="button" className="rounded-full" onClick={() => void handleSave()} disabled={saving || !workspace.canUseBackend}>
                {saving ? 'Saving...' : 'Save portal'}
              </Button>
            </div>
          }
        >
          <ToggleSwitch
            title="Enable booking portal"
            description="Turn the public request form on or off."
            checked={draft.enabled}
            onCheckedChange={(checked) => setDraft((current) => ({ ...current, enabled: checked }))}
          />
          <ToggleSwitch
            title="Status lookup"
            description="Allow customers to look up request status from the public portal."
            checked={draft.statusLookupEnabled}
            onCheckedChange={(checked) => setDraft((current) => ({ ...current, statusLookupEnabled: checked }))}
          />

          <div className="grid gap-5 md:grid-cols-2">
            <FormField label="Industry">
              <Select
                value={draft.industryType}
                onValueChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    industryType: value as BookingPortalDraft['industryType'],
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an industry" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="automotive">Automotive</SelectItem>
                  <SelectItem value="property">Property</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Details field label" description="Optional custom label for the details field.">
              <Input
                value={draft.detailsFieldLabel}
                onChange={(e) => setDraft((current) => ({ ...current, detailsFieldLabel: e.target.value }))}
                placeholder="Leave blank to use the default label"
              />
            </FormField>
          </div>

          <FormField label="Response time message" description="Shown on the booking form and confirmation email.">
            <Input
              value={draft.responseTimeMessage}
              onChange={(e) => setDraft((current) => ({ ...current, responseTimeMessage: e.target.value }))}
              placeholder="We will contact you within 2 business hours."
            />
          </FormField>
        </SectionCard>

        <SectionCard
          title="Confirmation email"
          description="Edit the body used when a customer submits a request."
        >
          <FormField label="Email body">
            <Textarea
              value={draft.confirmationEmailBody}
              onChange={(e) => setDraft((current) => ({ ...current, confirmationEmailBody: e.target.value }))}
              className="min-h-72 rounded-[22px]"
            />
          </FormField>
          <p className="text-xs leading-5 text-muted-foreground">
            Available tags: <code>${'{customer_name}'}</code>, <code>${'{company_name}'}</code>, <code>${'{reference_number}'}</code>, <code>${'{estimated_response_time_message}'}</code>, <code>${'{booking_portal_url}'}</code>, <code>${'{booking_status_url}'}</code>, <code>${'{admin_contact_email}'}</code>
          </p>
        </SectionCard>
      </div>

      <div className="space-y-4">
        <SectionCard
          title="Booking URLs"
          description="Copy the public booking link and the status lookup URL."
          action={
            <Badge variant="outline" className="rounded-full">
              <Link2 className="mr-1.5 h-3.5 w-3.5" />
              Live links
            </Badge>
          }
        >
          <div className="space-y-4">
            <div className="rounded-[24px] border border-border/70 bg-background/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Public booking URL</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{bookingUrl}</p>
                <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => void copyText(bookingUrl, 'Booking URL')}>
                  <Copy className="h-4 w-4" />
                  Copy
                </Button>
                <Button type="button" variant="ghost" size="sm" className="rounded-full" asChild>
                  <a href={bookingUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    Open
                  </a>
                </Button>
              </div>
            </div>

            <div className="rounded-[24px] border border-border/70 bg-background/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Status lookup URL</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{bookingStatusUrl}</p>
                <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => void copyText(bookingStatusUrl, 'Status URL')}>
                  <Copy className="h-4 w-4" />
                  Copy
                </Button>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Service visibility"
          description="Choose which services can be requested from the booking form."
          action={
            <Badge variant="outline" className="rounded-full">
          {visibleServices.length}/{workspace.services.filter((service) => service.status === 'active').length || 0} on
            </Badge>
          }
        >
          <div className="space-y-3">
            {workspace.services.length > 0 ? (
              workspace.services.map((service) => (
                <ToggleSwitch
                  key={service.id}
                  title={service.name}
                  description={service.category}
                  checked={draft.visibleServiceIds.includes(service.id)}
                  onCheckedChange={(checked) =>
                    setDraft((current) => ({
                      ...current,
                      visibleServiceIds: checked
                        ? [...current.visibleServiceIds, service.id]
                        : current.visibleServiceIds.filter((id) => id !== service.id),
                    }))
                  }
                />
              ))
            ) : (
              <div className="rounded-[24px] border border-dashed border-border/70 bg-muted/20 p-5 text-sm text-muted-foreground">
                No active services were found.
              </div>
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

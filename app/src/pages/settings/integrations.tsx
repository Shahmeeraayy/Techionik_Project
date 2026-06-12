import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Pencil, RefreshCw, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { DataTable } from '@/components/settings/DataTable';
import { FormField } from '@/components/settings/FormField';
import { SectionCard } from '@/components/settings/SectionCard';
import { useSettingsWorkspace } from '@/components/settings/WorkspaceProvider';
import { settingsControlButtonClass, settingsSelectTriggerClass } from '@/components/settings/visual';
import {
  fetchAdminIntegrationSettings,
  getStoredAdminToken,
  updateAdminIntegrationSettings,
  type BackendAdminIntegrationPartner,
  type BackendAdminIntegrationSettings,
  type BackendAdminIntegrationSettingsItem,
} from '@/lib/backend-api';
import { cn } from '@/lib/utils';
import { safeParseJSON, safeSetItem } from '@/lib/storage';

const INTEGRATIONS_CACHE_KEY = 'sm_dispatch_settings_integrations_cache';
const INTEGRATION_STATUSES: BackendAdminIntegrationSettingsItem['status'][] = [
  'connected',
  'available',
  'planned',
  'error',
  'disabled',
];

const DEFAULT_INTEGRATIONS: BackendAdminIntegrationSettingsItem[] = [
  {
    key: 'google_calendar',
    name: 'Google Calendar',
    description: 'Sync booking appointments and technician availability.',
    status: 'connected',
    provider: 'Google',
    manage_url: 'https://calendar.google.com',
    last_synced_at: null,
  },
  {
    key: 'microsoft_outlook',
    name: 'Microsoft Outlook',
    description: 'Mirror dispatch updates into Microsoft 365 mailboxes.',
    status: 'available',
    provider: 'Microsoft',
    manage_url: 'https://outlook.office.com',
    last_synced_at: null,
  },
  {
    key: 'slack',
    name: 'Slack',
    description: 'Send escalations and manager notifications to Slack channels.',
    status: 'available',
    provider: 'Slack',
    manage_url: 'https://slack.com/apps',
    last_synced_at: null,
  },
  {
    key: 'twilio_sms',
    name: 'Twilio SMS',
    description: 'Customer alerts and technician notifications via text message.',
    status: 'connected',
    provider: 'Twilio',
    manage_url: 'https://console.twilio.com',
    last_synced_at: null,
  },
  {
    key: 'zapier',
    name: 'Zapier',
    description: 'Automate handoffs into other operations tools.',
    status: 'planned',
    provider: 'Zapier',
    manage_url: 'https://zapier.com/apps',
    last_synced_at: null,
  },
  {
    key: 'quickbooks',
    name: 'QuickBooks',
    description: 'Sync invoices, payments, and billing records.',
    status: 'planned',
    provider: 'Intuit',
    manage_url: 'https://quickbooks.intuit.com',
    last_synced_at: null,
  },
];

const PARTNER_STATUS_OPTIONS: BackendAdminIntegrationPartner['status'][] = ['active', 'inactive', 'pending'];

function isIntegrationStatus(value: unknown): value is BackendAdminIntegrationSettingsItem['status'] {
  return typeof value === 'string' && INTEGRATION_STATUSES.includes(value as BackendAdminIntegrationSettingsItem['status']);
}

function normalizeIntegrationItem(
  item: Partial<BackendAdminIntegrationSettingsItem> | null | undefined,
  fallback: BackendAdminIntegrationSettingsItem,
): BackendAdminIntegrationSettingsItem {
  return {
    key: typeof item?.key === 'string' && item.key.trim() ? item.key : fallback.key,
    name: typeof item?.name === 'string' && item.name.trim() ? item.name : fallback.name,
    description: typeof item?.description === 'string' && item.description.trim() ? item.description : fallback.description,
    status: isIntegrationStatus(item?.status) ? item.status : fallback.status,
    provider: typeof item?.provider === 'string' && item.provider.trim() ? item.provider : fallback.provider,
    manage_url: typeof item?.manage_url === 'string' ? item.manage_url : fallback.manage_url,
    last_synced_at: typeof item?.last_synced_at === 'string' ? item.last_synced_at : fallback.last_synced_at,
  };
}

function normalizePartner(
  item: Partial<BackendAdminIntegrationPartner> | null | undefined,
  fallback: BackendAdminIntegrationPartner,
): BackendAdminIntegrationPartner {
  return {
    id: typeof item?.id === 'string' && item.id.trim() ? item.id : fallback.id,
    name: typeof item?.name === 'string' && item.name.trim() ? item.name : fallback.name,
    status: PARTNER_STATUS_OPTIONS.includes(item?.status as BackendAdminIntegrationPartner['status'])
      ? (item?.status as BackendAdminIntegrationPartner['status'])
      : fallback.status,
    category: typeof item?.category === 'string' && item.category.trim() ? item.category : fallback.category,
    notes: typeof item?.notes === 'string' && item.notes.trim() ? item.notes : fallback.notes,
  };
}

function normalizeIntegrationSettings(
  value: Partial<BackendAdminIntegrationSettings> | null | undefined,
  fallback: BackendAdminIntegrationSettings,
): BackendAdminIntegrationSettings {
  const fallbackByKey = new Map(fallback.integrations.map((item) => [item.key, item]));
  const integrations = Array.isArray(value?.integrations) && value.integrations.length > 0
    ? value.integrations.map((item, index) => {
      const rawKey = typeof item?.key === 'string' ? item.key : '';
      const fallbackItem = fallbackByKey.get(rawKey) ?? fallback.integrations[index] ?? fallback.integrations[0];
      return normalizeIntegrationItem(item, fallbackItem);
    })
    : fallback.integrations;

  const partners = Array.isArray(value?.partners) && value.partners.length > 0
    ? value.partners.map((item, index) => normalizePartner(
      item,
      fallback.partners[index] ?? fallback.partners[0] ?? {
        id: 'partner-fallback',
        name: 'Partner',
        status: 'active',
        category: null,
        notes: null,
      },
    ))
    : fallback.partners;

  return {
    integrations,
    partners,
    updated_at: typeof value?.updated_at === 'string' ? value.updated_at : fallback.updated_at,
  };
}

function buildFallbackIntegrationSettings(workspace: ReturnType<typeof useSettingsWorkspace>): BackendAdminIntegrationSettings {
  return {
    integrations: DEFAULT_INTEGRATIONS,
    partners: workspace.dealerships.map((location) => ({
      id: location.id,
      name: location.name,
      status: location.status === 'active' ? 'active' : 'inactive',
      category: location.code || 'Location',
      notes: location.notes ?? null,
    })),
    updated_at: workspace.lastRefreshedAt,
  };
}

function formatDateLabel(value?: string | null) {
  if (!value) {
    return 'Not synced yet';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat([], { month: 'short', day: 'numeric', year: 'numeric' }).format(parsed);
}

function statusTone(status: BackendAdminIntegrationSettingsItem['status']) {
  switch (status) {
    case 'connected':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
    case 'available':
      return 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300';
    case 'planned':
      return 'border-slate-400/40 bg-muted/30 text-muted-foreground';
    case 'error':
      return 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300';
    case 'disabled':
      return 'border-border/70 bg-muted/20 text-muted-foreground';
    default:
      return 'border-border/70 bg-muted/20 text-muted-foreground';
  }
}

function partnerTone(status: BackendAdminIntegrationPartner['status']) {
  switch (status) {
    case 'active':
      return 'border-emerald-500/30 text-emerald-700 dark:text-emerald-300';
    case 'pending':
      return 'border-amber-500/30 text-amber-700 dark:text-amber-300';
    case 'inactive':
      return 'border-slate-400/40 text-muted-foreground';
    default:
      return 'border-border/70 text-muted-foreground';
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

export default function SettingsIntegrationsPage() {
  const workspace = useSettingsWorkspace();
  const [settings, setSettings] = useState<BackendAdminIntegrationSettings | null>(null);
  const [savedSettings, setSavedSettings] = useState<BackendAdminIntegrationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connectionState, setConnectionState] = useState<'backend' | 'cache'>('cache');
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'services' | 'partners'>('services');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorDraft, setEditorDraft] = useState<BackendAdminIntegrationSettingsItem | null>(null);

  const fallbackSettings = useMemo(
    () => buildFallbackIntegrationSettings(workspace),
    [workspace.dealerships, workspace.lastRefreshedAt],
  );

  const currentSettings = settings ?? fallbackSettings;
  const connectedCount = currentSettings.integrations.filter((item) => item.status === 'connected').length;
  const availableCount = currentSettings.integrations.filter((item) => item.status === 'available').length;
  const activePartnerCount = currentSettings.partners.filter((item) => item.status === 'active').length;

  const loadSettings = async () => {
    if (workspace.loading) {
      return;
    }

    setLoading(true);
    setError(null);

    const cachedSettings = safeParseJSON<BackendAdminIntegrationSettings | null>(INTEGRATIONS_CACHE_KEY, null);
    const cachedOrFallback = normalizeIntegrationSettings(cachedSettings, fallbackSettings);
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
      const response = await fetchAdminIntegrationSettings(token);
      const normalized = normalizeIntegrationSettings(response, cachedOrFallback);
      setSettings(normalized);
      setSavedSettings(normalized);
      setConnectionState('backend');
      safeSetItem(INTEGRATIONS_CACHE_KEY, JSON.stringify(normalized));
    } catch (loadError) {
      setConnectionState('cache');
      setError(loadError instanceof Error ? loadError.message : 'Failed to load integrations.');
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
    setSettings(savedSettings);
    setError(null);
    toast.success('Integration draft reset.');
  };

  const openEditor = (key: string) => {
    const nextItem = currentSettings.integrations.find((item) => item.key === key);
    if (!nextItem) {
      return;
    }
    setEditorDraft(nextItem);
    setEditorOpen(true);
  };

  const handleEditorSave = () => {
    if (!editorDraft) {
      return;
    }

    setSettings((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        integrations: current.integrations.map((item) => (
          item.key === editorDraft.key
            ? normalizeIntegrationItem(editorDraft, item)
            : item
        )),
      };
    });

    setEditorOpen(false);
    setEditorDraft(null);
    toast.success('Integration draft updated. Save changes to sync it.');
  };

  const handleSave = async () => {
    if (!settings) {
      return;
    }

    const nextSettings = normalizeIntegrationSettings(settings, fallbackSettings);
    setSaving(true);
    setError(null);

    const token = getStoredAdminToken();
    if (workspace.canUseBackend && token) {
      try {
        const response = await updateAdminIntegrationSettings(token, nextSettings);
        const normalized = normalizeIntegrationSettings(response, nextSettings);
        setSettings(normalized);
        setSavedSettings(normalized);
        setConnectionState('backend');
        safeSetItem(INTEGRATIONS_CACHE_KEY, JSON.stringify(normalized));
        toast.success('Integration settings saved.');
      } catch (saveError) {
        safeSetItem(INTEGRATIONS_CACHE_KEY, JSON.stringify(nextSettings));
        setSettings(nextSettings);
        setSavedSettings(nextSettings);
        setConnectionState('cache');
        const message = saveError instanceof Error ? saveError.message : 'Failed to save integrations.';
        setError(message);
        toast.error(message);
      } finally {
        setSaving(false);
      }
      return;
    }

    safeSetItem(INTEGRATIONS_CACHE_KEY, JSON.stringify(nextSettings));
    setSettings(nextSettings);
    setSavedSettings(nextSettings);
    setConnectionState('cache');
    setSaving(false);
    toast.success('Integration settings saved locally.');
  };

  const openManageUrl = (item: BackendAdminIntegrationSettingsItem) => {
    if (!item.manage_url?.trim()) {
      openEditor(item.key);
      return;
    }

    window.open(item.manage_url, '_blank', 'noopener,noreferrer');
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
          label="Connected services"
          value={String(connectedCount)}
          helper="Integrations already linked to the workspace."
          className="bg-[linear-gradient(135deg,#0f172a,#1e293b)]"
        />
        <SummaryCard
          label="Available services"
          value={String(availableCount)}
          helper="Integrations ready to be connected next."
          className="bg-[linear-gradient(135deg,#0f766e,#14b8a6)]"
        />
        <SummaryCard
          label="Active partners"
          value={String(activePartnerCount)}
          helper="Partner locations participating in the workspace."
          className="bg-[linear-gradient(135deg,#1d4ed8,#60a5fa)]"
        />
      </div>

      {error ? (
        <div className="rounded-[1.4rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <SectionCard
        title="External services and partners"
        description="Manage connected tools, queue upcoming integrations, and review partner locations."
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
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'services' | 'partners')} className="space-y-4">
          <TabsList className="grid h-auto grid-cols-2 gap-2 rounded-[1.4rem] bg-muted/40 p-2">
            <TabsTrigger value="services" className="min-h-11 rounded-xl px-3 text-xs font-semibold data-[state=active]:bg-background data-[state=active]:text-foreground">
              Services
            </TabsTrigger>
            <TabsTrigger value="partners" className="min-h-11 rounded-xl px-3 text-xs font-semibold data-[state=active]:bg-background data-[state=active]:text-foreground">
              Partners
            </TabsTrigger>
          </TabsList>

          <TabsContent value="services" className="space-y-4">
            <DataTable
              columns={[
                { key: 'service', label: 'Service' },
                { key: 'status', label: 'Status', align: 'center' },
                { key: 'provider', label: 'Provider' },
                { key: 'sync', label: 'Last sync', align: 'center' },
                { key: 'actions', label: 'Actions', align: 'right' },
              ]}
            >
              {currentSettings.integrations.length > 0 ? (
                currentSettings.integrations.map((item) => (
                  <tr key={item.key} className="border-b border-border/60 hover:bg-muted/20">
                    <td className="px-4 py-4">
                      <div className="space-y-1">
                        <p className="font-semibold text-foreground">{item.name}</p>
                        <p className="text-sm leading-6 text-muted-foreground">{item.description}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <Badge variant="outline" className={cn('rounded-full', statusTone(item.status))}>
                        {item.status.replace(/_/g, ' ')}
                      </Badge>
                    </td>
                    <td className="px-4 py-4 text-sm text-foreground">
                      {item.provider ?? 'Not configured'}
                    </td>
                    <td className="px-4 py-4 text-center text-sm text-muted-foreground">
                      {formatDateLabel(item.last_synced_at)}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className={`rounded-full ${settingsControlButtonClass}`}
                          onClick={() => openEditor(item.key)}
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className={`rounded-full ${settingsControlButtonClass}`}
                          onClick={() => openManageUrl(item)}
                        >
                          <ExternalLink className="h-4 w-4" />
                          {item.manage_url?.trim() ? 'Open' : 'Connect'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No integration records are available yet.
                  </td>
                </tr>
              )}
            </DataTable>

            <div className="rounded-[24px] border border-border/70 bg-muted/20 p-4 text-sm leading-6 text-muted-foreground">
              Edit a service to change its status, provider label, or management URL. Changes are saved through the admin API when it is reachable.
            </div>
          </TabsContent>

          <TabsContent value="partners" className="space-y-4">
            <DataTable
              columns={[
                { key: 'partner', label: 'Partner' },
                { key: 'category', label: 'Category' },
                { key: 'status', label: 'Status', align: 'center' },
                { key: 'notes', label: 'Notes' },
              ]}
            >
              {currentSettings.partners.length > 0 ? (
                currentSettings.partners.map((partner) => (
                  <tr key={partner.id} className="border-b border-border/60 hover:bg-muted/20">
                    <td className="px-4 py-4">
                      <p className="font-semibold text-foreground">{partner.name}</p>
                    </td>
                    <td className="px-4 py-4 text-sm text-muted-foreground">
                      {partner.category ?? 'Partner'}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <Badge variant="outline" className={cn('rounded-full', partnerTone(partner.status))}>
                        {partner.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-4 text-sm text-muted-foreground">
                      {partner.notes ?? 'No notes'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No partner records are available yet.
                  </td>
                </tr>
              )}
            </DataTable>
          </TabsContent>
        </Tabs>
      </SectionCard>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-2xl rounded-[28px]">
          <DialogHeader>
            <DialogTitle>Edit integration</DialogTitle>
          </DialogHeader>

          {editorDraft ? (
            <div className="space-y-5">
              <div className="rounded-[24px] border border-border/70 bg-muted/20 p-4">
                <p className="text-sm font-semibold text-foreground">{editorDraft.name}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{editorDraft.description}</p>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <FormField label="Status">
                  <Select
                    value={editorDraft.status}
                    onValueChange={(value) => setEditorDraft((current) => current ? { ...current, status: value as BackendAdminIntegrationSettingsItem['status'] } : current)}
                  >
                    <SelectTrigger className={settingsSelectTriggerClass}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INTEGRATION_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status.replace(/_/g, ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="Provider">
                  <Input
                    value={editorDraft.provider ?? ''}
                    onChange={(event) => setEditorDraft((current) => current ? { ...current, provider: event.target.value } : current)}
                    placeholder="Provider label"
                  />
                </FormField>
                <FormField label="Manage URL" className="md:col-span-2">
                  <Input
                    value={editorDraft.manage_url ?? ''}
                    onChange={(event) => setEditorDraft((current) => current ? { ...current, manage_url: event.target.value } : current)}
                    placeholder="https://..."
                  />
                </FormField>
                <FormField label="Last synced" className="md:col-span-2">
                  <Input value={formatDateLabel(editorDraft.last_synced_at)} readOnly />
                </FormField>
                <FormField label="Description" className="md:col-span-2">
                  <Textarea
                    value={editorDraft.description}
                    onChange={(event) => setEditorDraft((current) => current ? { ...current, description: event.target.value } : current)}
                    className="min-h-28 rounded-[20px]"
                  />
                </FormField>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="ghost" className={`rounded-full ${settingsControlButtonClass}`} onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
            <Button type="button" className="rounded-full" onClick={handleEditorSave}>
              Save draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

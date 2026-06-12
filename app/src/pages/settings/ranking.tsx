import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable } from '@/components/settings/DataTable';
import { FormField } from '@/components/settings/FormField';
import { SectionCard } from '@/components/settings/SectionCard';
import { useSettingsWorkspace } from '@/components/settings/WorkspaceProvider';
import {
  createAdminPriorityRule,
  deleteAdminPriorityRule,
  getStoredAdminToken,
  updateAdminPriorityRule,
  type BackendPriorityRule,
} from '@/lib/backend-api';
import { cn } from '@/lib/utils';

type RuleDraft = {
  id?: string;
  description: string;
  dealershipId: string;
  serviceId: string;
  targetUrgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  rankingScore: number;
  isActive: boolean;
};

const EMPTY_RULE: RuleDraft = {
  description: '',
  dealershipId: '',
  serviceId: '',
  targetUrgency: 'HIGH',
  rankingScore: 10,
  isActive: true,
};

const toDraft = (rule: BackendPriorityRule): RuleDraft => ({
  id: rule.id,
  description: rule.description,
  dealershipId: rule.dealership_id,
  serviceId: rule.service_id ?? '',
  targetUrgency: rule.target_urgency,
  rankingScore: rule.ranking_score,
  isActive: rule.is_active,
});

function statusTone(isActive: boolean) {
  return isActive
    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
    : 'border-slate-400/40 bg-muted/30 text-muted-foreground';
}

export default function SettingsRankingPage() {
  const workspace = useSettingsWorkspace();
  const [rules, setRules] = useState<BackendPriorityRule[]>([]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<RuleDraft>(EMPTY_RULE);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (workspace.loading) {
      return;
    }
    setRules(workspace.priorityRules);
  }, [workspace.loading, workspace.lastRefreshedAt, workspace.priorityRules]);

  const metrics = useMemo(() => {
    const active = rules.filter((rule) => rule.is_active);
    return {
      total: rules.length,
      active: active.length,
      impact: active.reduce((sum, rule) => sum + Number(rule.ranking_score || 0), 0),
    };
  }, [rules]);

  const openCreate = () => {
    setDraft(EMPTY_RULE);
    setOpen(true);
  };

  const openEdit = (rule: BackendPriorityRule) => {
    setDraft(toDraft(rule));
    setOpen(true);
  };

  const handleSave = async () => {
    if (!workspace.canUseBackend) {
      toast.error('Connect an admin token to manage ranking rules.');
      return;
    }

    const token = getStoredAdminToken();
    if (!token) {
      toast.error('Admin token not found.');
      return;
    }

    if (!draft.description.trim()) {
      toast.error('Rule name is required.');
      return;
    }

    if (!draft.dealershipId.trim()) {
      toast.error('Target location is required.');
      return;
    }

    setSaving(true);
    try {
      if (draft.id) {
        await updateAdminPriorityRule(token, draft.id, {
          description: draft.description.trim(),
          dealership_id: draft.dealershipId,
          service_id: draft.serviceId.trim() || null,
          target_urgency: draft.targetUrgency,
          ranking_score: draft.rankingScore,
          is_active: draft.isActive,
        });
        toast.success('Ranking rule updated.');
      } else {
        await createAdminPriorityRule(token, {
          description: draft.description.trim(),
          dealership_id: draft.dealershipId,
          service_id: draft.serviceId.trim() || null,
          target_urgency: draft.targetUrgency,
          ranking_score: draft.rankingScore,
          is_active: draft.isActive,
        });
        toast.success('Ranking rule created.');
      }

      await workspace.refresh();
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save ranking rule.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (rule: BackendPriorityRule) => {
    if (!workspace.canUseBackend) {
      toast.error('Connect an admin token to manage ranking rules.');
      return;
    }

    const token = getStoredAdminToken();
    if (!token) {
      toast.error('Admin token not found.');
      return;
    }

    setSaving(true);
    try {
      await deleteAdminPriorityRule(token, rule.id);
      await workspace.refresh();
      toast.success('Ranking rule deleted.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete ranking rule.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (rule: BackendPriorityRule) => {
    if (!workspace.canUseBackend) {
      toast.error('Connect an admin token to manage ranking rules.');
      return;
    }

    const token = getStoredAdminToken();
    if (!token) {
      toast.error('Admin token not found.');
      return;
    }

    setSaving(true);
    try {
      await updateAdminPriorityRule(token, rule.id, { is_active: !rule.is_active });
      await workspace.refresh();
      toast.success(rule.is_active ? 'Rule paused.' : 'Rule activated.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update rule status.');
    } finally {
      setSaving(false);
    }
  };

  if (workspace.loading) {
    return (
      <SectionCard title="Loading ranking rules..." description="Ranking data is being synced.">
        <div className="h-64 animate-pulse rounded-2xl bg-muted" />
      </SectionCard>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <SectionCard title="Rule count" description="All ranking rules in the workspace.">
          <div className="text-4xl font-semibold tracking-[-0.05em] text-foreground">{metrics.total}</div>
        </SectionCard>
        <SectionCard title="Active rules" description="Enabled ranking rules currently applied.">
          <div className="text-4xl font-semibold tracking-[-0.05em] text-foreground">{metrics.active}</div>
        </SectionCard>
        <SectionCard title="Impact" description="Sum of all enabled scoring weights.">
          <div className="text-4xl font-semibold tracking-[-0.05em] text-foreground">+{metrics.impact} pts</div>
        </SectionCard>
      </div>

      <SectionCard
        title="Ranking rules"
        description="Use scoring rules to shape the order jobs appear in the queue."
        action={
          <Button type="button" className="rounded-full" onClick={openCreate}>
            Add rule
          </Button>
        }
      >
        <DataTable
          columns={[
            { key: 'rule', label: 'Rule name' },
            { key: 'target', label: 'Target' },
            { key: 'impact', label: 'Impact', align: 'center' },
            { key: 'status', label: 'Status', align: 'center' },
            { key: 'actions', label: 'Actions', align: 'right' },
          ]}
        >
          {rules.length > 0 ? (
            rules.map((rule) => {
              const dealership = workspace.dealerships.find((item) => item.id === rule.dealership_id);
              const service = workspace.services.find((item) => item.id === rule.service_id);

              return (
                <tr key={rule.id} className="border-b border-border/60 hover:bg-muted/20">
                  <td className="px-4 py-4">
                    <div className="space-y-1">
                      <p className="font-semibold text-foreground">{rule.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {dealership?.name || 'Unknown location'} rule
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="space-y-1 text-sm">
                      <p className="font-medium text-foreground">{dealership?.name || 'Any location'}</p>
                      <p className="text-muted-foreground">{service?.name || 'Any service'}</p>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="font-mono text-sm font-semibold text-cyan-700 dark:text-cyan-300">
                      +{rule.ranking_score} pts
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <button
                      type="button"
                      onClick={() => void toggleActive(rule)}
                      className={cn('rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] transition-colors', statusTone(rule.is_active))}
                      disabled={saving}
                    >
                      {rule.is_active ? 'Active' : 'Paused'}
                    </button>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="inline-flex items-center gap-1">
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(rule)} title="Edit rule">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => void handleDelete(rule)} title="Delete rule" disabled={saving}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                No ranking rules configured yet.
              </td>
            </tr>
          )}
        </DataTable>
      </SectionCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl rounded-[28px]">
          <DialogHeader>
            <DialogTitle>{draft.id ? 'Edit ranking rule' : 'Add ranking rule'}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-5 md:grid-cols-2">
            <FormField label="Rule name" className="md:col-span-2">
              <Input value={draft.description} onChange={(e) => setDraft((current) => ({ ...current, description: e.target.value }))} />
            </FormField>
            <FormField label="Location">
              <Select value={draft.dealershipId} onValueChange={(value) => setDraft((current) => ({ ...current, dealershipId: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a location" />
                </SelectTrigger>
                <SelectContent>
                  {workspace.dealerships.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Service">
              <Select
                value={draft.serviceId || 'any'}
                onValueChange={(value) => setDraft((current) => ({ ...current, serviceId: value === 'any' ? '' : value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Any service" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any service</SelectItem>
                  {workspace.services.map((service) => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Target urgency">
              <Select value={draft.targetUrgency} onValueChange={(value) => setDraft((current) => ({ ...current, targetUrgency: value as RuleDraft['targetUrgency'] }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="CRITICAL">Critical</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Impact score">
              <Input
                type="number"
                value={draft.rankingScore}
                onChange={(e) => setDraft((current) => ({ ...current, rankingScore: Number(e.target.value) }))}
              />
            </FormField>
          </div>

          <div className="grid gap-3 rounded-[24px] border border-border/70 bg-muted/20 p-4">
            <button
              type="button"
              onClick={() => setDraft((current) => ({ ...current, isActive: !current.isActive }))}
              className={cn(
                'flex items-center justify-between gap-3 rounded-2xl border px-4 py-4 text-left transition-colors',
                draft.isActive
                  ? 'border-emerald-500/30 bg-emerald-500/10'
                  : 'border-border/70 bg-background/70',
              )}
            >
              <span>
                <span className="block text-sm font-semibold text-foreground">Rule enabled</span>
                <span className="block text-sm text-muted-foreground">Toggle to pause this rule without deleting it.</span>
              </span>
              <Badge variant="outline" className="rounded-full">
                {draft.isActive ? 'Active' : 'Paused'}
              </Badge>
            </button>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-full" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" className="rounded-full" onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'Saving...' : 'Save rule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

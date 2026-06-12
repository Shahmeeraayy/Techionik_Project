import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable } from '@/components/settings/DataTable';
import { FormField } from '@/components/settings/FormField';
import { SectionCard } from '@/components/settings/SectionCard';
import { useSettingsWorkspace } from '@/components/settings/WorkspaceProvider';
import {
  createAdminDealership,
  getStoredAdminToken,
  updateAdminDealership,
  updateAdminDealershipStatus,
  type BackendDealership,
} from '@/lib/backend-api';
import { cn } from '@/lib/utils';

type LocationDraft = {
  id?: string;
  code: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  postalCode: string;
  notes: string;
  status: 'active' | 'inactive';
};

const EMPTY_DRAFT: LocationDraft = {
  code: '',
  name: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  postalCode: '',
  notes: '',
  status: 'active',
};

const toDraft = (location: BackendDealership): LocationDraft => ({
  id: location.id,
  code: location.code,
  name: location.name,
  phone: location.phone ?? '',
  email: location.email ?? '',
  address: location.address ?? '',
  city: location.city ?? '',
  postalCode: location.postal_code ?? '',
  notes: location.notes ?? '',
  status: location.status,
});

export default function SettingsLocationsPage() {
  const workspace = useSettingsWorkspace();
  const [locations, setLocations] = useState<BackendDealership[]>([]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<LocationDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (workspace.loading) {
      return;
    }
    setLocations(workspace.dealerships);
  }, [workspace.dealerships, workspace.loading, workspace.lastRefreshedAt]);

  const metrics = useMemo(() => {
    const active = locations.filter((location) => location.status === 'active').length;
    return {
      total: locations.length,
      active,
      inactive: Math.max(locations.length - active, 0),
    };
  }, [locations]);

  const openCreate = () => {
    setDraft(EMPTY_DRAFT);
    setOpen(true);
  };

  const openEdit = (location: BackendDealership) => {
    setDraft(toDraft(location));
    setOpen(true);
  };

  const handleSave = async () => {
    if (!draft.name.trim()) {
      toast.error('Location name is required.');
      return;
    }

    if (!workspace.canUseBackend) {
      toast.error('Connect an admin token to manage locations.');
      return;
    }

    const token = getStoredAdminToken();
    if (!token) {
      toast.error('Admin token not found.');
      return;
    }

    setSaving(true);
    try {
      if (draft.id) {
        await updateAdminDealership(token, draft.id, {
          name: draft.name.trim(),
          phone: draft.phone.trim() || undefined,
          email: draft.email.trim() || undefined,
          address: draft.address.trim() || undefined,
          city: draft.city.trim() || undefined,
          postal_code: draft.postalCode.trim() || undefined,
          notes: draft.notes.trim() || undefined,
          status: draft.status,
        });
        toast.success('Location updated.');
      } else {
        await createAdminDealership(token, {
          code: draft.code.trim() || undefined,
          name: draft.name.trim(),
          phone: draft.phone.trim() || undefined,
          email: draft.email.trim() || undefined,
          address: draft.address.trim() || undefined,
          city: draft.city.trim() || undefined,
          postal_code: draft.postalCode.trim() || undefined,
          notes: draft.notes.trim() || undefined,
        });
        toast.success('Location created.');
      }

      await workspace.refresh();
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save location.');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (location: BackendDealership) => {
    if (!workspace.canUseBackend) {
      toast.error('Connect an admin token to manage locations.');
      return;
    }

    const token = getStoredAdminToken();
    if (!token) {
      toast.error('Admin token not found.');
      return;
    }

    const nextStatus = location.status === 'active' ? 'inactive' : 'active';
    setSaving(true);
    try {
      await updateAdminDealershipStatus(token, location.id, nextStatus);
      await workspace.refresh();
      toast.success(nextStatus === 'active' ? 'Location restored.' : 'Location archived.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update location status.');
    } finally {
      setSaving(false);
    }
  };

  if (workspace.loading) {
    return (
      <SectionCard title="Loading locations..." description="Locations are syncing from the backend.">
        <div className="h-64 animate-pulse rounded-2xl bg-muted" />
      </SectionCard>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <SectionCard title="Total locations" description="All location records in the workspace.">
          <div className="text-4xl font-semibold tracking-[-0.05em] text-foreground">{metrics.total}</div>
        </SectionCard>
        <SectionCard title="Active locations" description="Locations currently accepting work.">
          <div className="text-4xl font-semibold tracking-[-0.05em] text-foreground">{metrics.active}</div>
        </SectionCard>
        <SectionCard title="Inactive locations" description="Archived or paused records.">
          <div className="text-4xl font-semibold tracking-[-0.05em] text-foreground">{metrics.inactive}</div>
        </SectionCard>
      </div>

      <SectionCard
        title="Locations"
        description="Create, edit, or archive dealership and location records."
        action={
          <Button type="button" className="rounded-full" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add location
          </Button>
        }
      >
        <DataTable
          columns={[
            { key: 'name', label: 'Location' },
            { key: 'contact', label: 'Contact' },
            { key: 'status', label: 'Status', align: 'center' },
            { key: 'activity', label: 'Recent activity' },
            { key: 'actions', label: 'Actions', align: 'right' },
          ]}
        >
          {locations.length > 0 ? (
            locations.map((location) => (
              <tr key={location.id} className="border-b border-border/60 hover:bg-muted/20">
                <td className="px-4 py-4">
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground">{location.name}</p>
                    <p className="text-xs text-muted-foreground">{location.address || location.code}</p>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="space-y-1 text-sm">
                    <p className="font-medium text-foreground">{location.email || 'No email'}</p>
                    <p className="text-muted-foreground">{location.phone || 'No phone'}</p>
                  </div>
                </td>
                <td className="px-4 py-4 text-center">
                  <Badge
                    variant="outline"
                    className={cn(
                      'rounded-full',
                      location.status === 'active' ? 'border-emerald-500/30 text-emerald-700 dark:text-emerald-300' : 'border-slate-400/40 text-muted-foreground',
                    )}
                  >
                    {location.status}
                  </Badge>
                </td>
                <td className="px-4 py-4 text-sm text-muted-foreground">
                  {location.last_job_at ? new Date(location.last_job_at).toLocaleDateString() : 'No recent jobs'}
                </td>
                <td className="px-4 py-4 text-right">
                  <div className="inline-flex items-center gap-1">
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(location)} title="Edit location">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => void handleArchive(location)}
                      title={location.status === 'active' ? 'Archive location' : 'Restore location'}
                      disabled={saving}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                No locations yet.
              </td>
            </tr>
          )}
        </DataTable>
      </SectionCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl rounded-[28px]">
          <DialogHeader>
            <DialogTitle>{draft.id ? 'Edit location' : 'Add location'}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-5 md:grid-cols-2">
            <FormField label="Location name">
              <Input value={draft.name} onChange={(e) => setDraft((current) => ({ ...current, name: e.target.value }))} />
            </FormField>
            <FormField label="Code">
              <Input value={draft.code} onChange={(e) => setDraft((current) => ({ ...current, code: e.target.value }))} placeholder="Optional code" />
            </FormField>
            <FormField label="Phone">
              <Input value={draft.phone} onChange={(e) => setDraft((current) => ({ ...current, phone: e.target.value }))} />
            </FormField>
            <FormField label="Email">
              <Input type="email" value={draft.email} onChange={(e) => setDraft((current) => ({ ...current, email: e.target.value }))} />
            </FormField>
            <FormField label="Address" className="md:col-span-2">
              <Input value={draft.address} onChange={(e) => setDraft((current) => ({ ...current, address: e.target.value }))} />
            </FormField>
            <FormField label="City">
              <Input value={draft.city} onChange={(e) => setDraft((current) => ({ ...current, city: e.target.value }))} />
            </FormField>
            <FormField label="Postal code">
              <Input value={draft.postalCode} onChange={(e) => setDraft((current) => ({ ...current, postalCode: e.target.value }))} />
            </FormField>
            <FormField label="Status">
              <Select value={draft.status} onValueChange={(value) => setDraft((current) => ({ ...current, status: value as LocationDraft['status'] }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Notes" className="md:col-span-2">
              <Textarea
                value={draft.notes}
                onChange={(e) => setDraft((current) => ({ ...current, notes: e.target.value }))}
                className="min-h-28 rounded-[20px]"
              />
            </FormField>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-full" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" className="rounded-full" onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'Saving...' : 'Save location'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

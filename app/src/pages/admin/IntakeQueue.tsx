import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, ClipboardList, Mail, Pencil, Phone, RefreshCw, Search, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  fetchAdminBookingRequests,
  getStoredAdminToken,
  updateAdminBookingRequest,
  type BackendBookingRequest,
} from '@/lib/backend-api';
import { cn } from '@/lib/utils';

const sectionCardClass = 'overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,24,39,0.96),rgba(6,17,29,0.96))] shadow-[0_24px_80px_rgba(0,0,0,0.28)]';
const sectionHeaderClass = 'border-b border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0))] p-6';

const statusOptions = [
  { value: 'RECEIVED', label: 'Received' },
  { value: 'UNDER_REVIEW', label: 'Under Review' },
  { value: 'JOB_SCHEDULED', label: 'Job Scheduled' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'COMPLETED', label: 'Completed' },
] as const;

type BookingStatus = typeof statusOptions[number]['value'];

const formatDateTime = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
};

const statusBadgeClass = (status: BookingStatus) => cn(
  'border',
  status === 'RECEIVED' && 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100',
  status === 'UNDER_REVIEW' && 'border-amber-300/20 bg-amber-300/10 text-amber-100',
  status === 'JOB_SCHEDULED' && 'border-blue-300/20 bg-blue-300/10 text-blue-100',
  status === 'IN_PROGRESS' && 'border-violet-300/20 bg-violet-300/10 text-violet-100',
  status === 'COMPLETED' && 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100',
);

const ROW_COLS = 'grid-cols-[13%_21%_1fr_13%_18%_7%]';

export default function IntakeQueuePage() {
  const [rows, setRows] = useState<BackendBookingRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [editingRow, setEditingRow] = useState<BackendBookingRequest | null>(null);
  const [editStatus, setEditStatus] = useState<BookingStatus>('RECEIVED');
  const [editTechnician, setEditTechnician] = useState('');
  const [editEta, setEditEta] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const refreshRows = useCallback(async () => {
    const token = getStoredAdminToken();
    if (!token) {
      setRows([]);
      return;
    }

    setIsRefreshing(true);
    try {
      const next = await fetchAdminBookingRequests(token);
      setRows(next);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refreshRows();
  }, [refreshRows]);

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return rows;
    }
    return rows.filter((row) =>
      row.reference_number.toLowerCase().includes(query)
      || row.customer_full_name.toLowerCase().includes(query)
      || row.email_address.toLowerCase().includes(query)
      || row.service_name.toLowerCase().includes(query)
      || (row.service_names ?? []).some((serviceName) => serviceName.toLowerCase().includes(query))
    );
  }, [rows, searchQuery]);

  const openEditDialog = (row: BackendBookingRequest) => {
    setEditingRow(row);
    setEditStatus(row.status);
    setEditTechnician(row.assigned_technician_first_name ?? '');
    setEditEta(row.estimated_completion_date ?? '');
  };

  const handleSave = async () => {
    if (!editingRow) {
      return;
    }
    const token = getStoredAdminToken();
    if (!token) {
      return;
    }

    setIsSaving(true);
    try {
      await updateAdminBookingRequest(token, editingRow.id, {
        status: editStatus,
        assigned_technician_first_name: editTechnician.trim() || null,
        estimated_completion_date: editEta || null,
      });
      setEditingRow(null);
      await refreshRows();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="relative w-full space-y-6 pb-10">
      <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(7,25,42,0.98),rgba(6,18,32,0.98))] shadow-[0_34px_120px_rgba(0,0,0,0.34)]">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:120px_120px] opacity-20" />
        <div className="relative flex flex-col gap-5 p-6 xl:flex-row xl:items-end xl:justify-between xl:p-8">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-100">
              <ClipboardList className="h-3.5 w-3.5" />
              Intake Queue
            </div>
            <h1 className="mt-5 text-[2.35rem] font-semibold leading-none tracking-[-0.06em] text-white md:text-[2.8rem]">
              Booking requests
              <span className="block bg-gradient-to-r from-white via-cyan-100 to-emerald-100 bg-clip-text text-transparent">
                ready for review
              </span>
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-[15px]">
              Public booking portal requests arrive here tagged with source Booking Portal, ready for admin review and customer status updates.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline" className="border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-cyan-100">
              {rows.length} total requests
            </Badge>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => { void refreshRows(); }}
              disabled={isRefreshing}
              className="h-10 gap-2 rounded-full border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]"
            >
              <RefreshCw className={cn('h-4 w-4 text-cyan-200', isRefreshing && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        </div>
      </section>

      <Card className={sectionCardClass}>
        <div className={sectionHeaderClass}>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search by reference, customer, email, or service"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="h-11 rounded-full border-white/10 bg-white/[0.04] pl-9 text-slate-100 placeholder:text-slate-500"
            />
          </div>
        </div>

        <div>
          {/* Header row */}
          <div className={cn('grid border-b border-white/10 bg-[linear-gradient(180deg,rgba(11,25,42,0.98),rgba(10,20,35,0.92))]', ROW_COLS)}>
            <div className="py-3 pl-6 text-[11px] uppercase tracking-[0.24em] text-slate-400">Reference</div>
            <div className="py-3 text-[11px] uppercase tracking-[0.24em] text-slate-400">Customer</div>
            <div className="py-3 text-[11px] uppercase tracking-[0.24em] text-slate-400">Service</div>
            <div className="py-3 text-[11px] uppercase tracking-[0.24em] text-slate-400">Status</div>
            <div className="py-3 text-[11px] uppercase tracking-[0.24em] text-slate-400">Created</div>
            <div className="py-3 pr-6 text-right text-[11px] uppercase tracking-[0.24em] text-slate-400">Actions</div>
          </div>

          {/* Data rows */}
          <div className="divide-y divide-white/[0.06]">
            {filteredRows.length === 0 ? (
              <div className="flex h-28 items-center justify-center text-sm text-slate-400">
                No booking requests found.
              </div>
            ) : filteredRows.map((row) => (
              <div key={row.id} className={cn('grid items-start py-4 hover:bg-white/[0.045]', ROW_COLS)}>
                <div className="pl-6">
                  <p className="font-semibold text-white">{row.reference_number}</p>
                  <p className="text-xs text-slate-500">{row.source}</p>
                </div>
                <div className="min-w-0 pr-3">
                  <p className="truncate font-medium text-slate-200">{row.customer_full_name}</p>
                  <div className="flex min-w-0 items-center gap-1.5 text-xs text-slate-400">
                    <Mail className="h-3 w-3 shrink-0" />
                    <span className="truncate">{row.email_address}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Phone className="h-3 w-3 shrink-0" />
                    <span>{row.phone_number}</span>
                  </div>
                </div>
                <div className="min-w-0 pr-3">
                  <div className="flex min-w-0 items-start gap-1.5">
                    <Wrench className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
                    <span className="break-words text-sm text-slate-200">
                      {(row.service_names && row.service_names.length > 0 ? row.service_names : [row.service_name]).join(', ')}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-slate-400">{row.asset_details}</p>
                </div>
                <div className="pt-0.5">
                  <Badge variant="outline" className={statusBadgeClass(row.status)}>
                    {statusOptions.find((option) => option.value === row.status)?.label ?? row.status}
                  </Badge>
                </div>
                <div className="text-xs text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                    <span>{formatDateTime(row.created_at)}</span>
                  </div>
                </div>
                <div className="flex justify-end pr-6 pt-0.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEditDialog(row)}
                    className="border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Dialog open={Boolean(editingRow)} onOpenChange={(open) => { if (!open) setEditingRow(null); }}>
        <DialogContent className="sm:max-w-lg border-white/10 bg-[linear-gradient(180deg,rgba(9,24,39,0.98),rgba(6,17,29,0.98))] text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-white">Update booking request</DialogTitle>
            <DialogDescription className="text-slate-300">
              Control the customer-facing status view for {editingRow?.reference_number}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-slate-200">Status</Label>
              <Select value={editStatus} onValueChange={(value) => setEditStatus(value as BookingStatus)}>
                <SelectTrigger className="h-12 rounded-2xl border-white/10 bg-[linear-gradient(180deg,rgba(10,18,32,0.96),rgba(8,14,26,0.96))] text-white focus:border-[#7db0ff]/45 focus:ring-[#7db0ff]/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="admin-dark-scrollbar rounded-2xl border-white/10 bg-[linear-gradient(180deg,rgba(14,23,40,0.98),rgba(8,12,20,0.98))] text-slate-100 shadow-[0_24px_60px_rgba(0,0,0,0.34)]">
                  {statusOptions.map((option) => (
                    <SelectItem className="rounded-xl text-slate-200 focus:bg-white/[0.08] focus:text-white" key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="booking-tech" className="text-slate-200">Assigned technician first name</Label>
              <Input
                id="booking-tech"
                value={editTechnician}
                onChange={(event) => setEditTechnician(event.target.value)}
                className="h-12 rounded-2xl border-white/10 bg-[linear-gradient(180deg,rgba(10,18,32,0.96),rgba(8,14,26,0.96))] text-white placeholder:text-slate-500"
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="booking-eta" className="text-slate-200">Estimated completion date</Label>
              <Input
                id="booking-eta"
                type="date"
                value={editEta}
                onChange={(event) => setEditEta(event.target.value)}
                className="h-12 rounded-2xl border-white/10 bg-[linear-gradient(180deg,rgba(10,18,32,0.96),rgba(8,14,26,0.96))] text-white [color-scheme:dark]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="h-11 rounded-2xl border-white/10 bg-[linear-gradient(180deg,rgba(14,23,40,0.98),rgba(8,12,20,0.98))] px-5 text-slate-100 shadow-[0_14px_34px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.055)] hover:bg-[linear-gradient(180deg,rgba(24,38,64,0.98),rgba(12,20,34,0.98))] hover:text-white"
              onClick={() => setEditingRow(null)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => { void handleSave(); }}
              disabled={isSaving}
              className="h-11 rounded-2xl border border-[#7db0ff]/40 bg-[linear-gradient(135deg,#4f7cff,#22d3ee)] px-5 text-white shadow-[0_16px_34px_rgba(79,124,255,0.22)] hover:brightness-105"
            >
              {isSaving ? 'Saving...' : 'Save updates'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

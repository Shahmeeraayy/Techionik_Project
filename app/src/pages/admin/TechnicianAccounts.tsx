import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Search,
  RefreshCw,
  UserCog,
  Mail,
  Phone,
  ShieldCheck,
  ShieldOff,
  Calendar,
  Pencil,
  Power,
  CheckCircle2,
  KeyRound,
  Send,
} from 'lucide-react';
import {
  useAuth,
  type TechnicianAccountSummary,
  type TechnicianPasswordResetRequestSummary,
} from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { formatPhoneForDisplay, formatUsPhoneInput } from '@/lib/phone';
import { cn } from '@/lib/utils';
import { createAdminTechnician, getStoredAdminToken, issueAdminTechnicianPasswordResetLink } from '@/lib/backend-api';

type EditFormState = {
  name: string;
  email: string;
  phone: string;
};

type CreateFormState = {
  name: string;
  email: string;
  phone: string;
  password: string;
};

const formatDateTime = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
};

const sectionCardClass = 'overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,24,39,0.96),rgba(6,17,29,0.96))] shadow-[0_24px_80px_rgba(0,0,0,0.28)]';
const sectionHeaderClass = 'border-b border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0))] p-6';

function metricCardClass(tone: 'cyan' | 'emerald' | 'amber' | 'rose'): string {
  return cn(
    'overflow-hidden rounded-[24px] border shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
    tone === 'cyan' && 'border-cyan-400/15 bg-[linear-gradient(180deg,rgba(12,36,55,0.96),rgba(8,24,39,0.96))]',
    tone === 'emerald' && 'border-emerald-400/15 bg-[linear-gradient(180deg,rgba(10,37,45,0.96),rgba(7,25,31,0.96))]',
    tone === 'amber' && 'border-amber-400/15 bg-[linear-gradient(180deg,rgba(41,28,15,0.94),rgba(27,18,10,0.96))]',
    tone === 'rose' && 'border-rose-400/15 bg-[linear-gradient(180deg,rgba(42,16,25,0.96),rgba(28,15,23,0.96))]',
  );
}

function metricIconClass(tone: 'cyan' | 'emerald' | 'amber' | 'rose'): string {
  return cn(
    'rounded-2xl border p-3',
    tone === 'cyan' && 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100',
    tone === 'emerald' && 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100',
    tone === 'amber' && 'border-amber-300/20 bg-amber-300/10 text-amber-100',
    tone === 'rose' && 'border-rose-300/20 bg-rose-300/10 text-rose-100',
  );
}

export default function TechnicianAccountsPage() {
  const {
    technicianAccounts,
    pendingTechnicianPasswordResetRequests,
    syncAdminData,
    updateTechnicianAccount,
    setTechnicianAccountActive,
    resolveTechnicianPasswordResetRequest,
  } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<TechnicianAccountSummary | null>(null);
  const [form, setForm] = useState<EditFormState>({
    name: '',
    email: '',
    phone: '',
  });
  const [createForm, setCreateForm] = useState<CreateFormState>({
    name: '',
    email: '',
    phone: '',
    password: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSendingResetLinkFor, setIsSendingResetLinkFor] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const runSync = useCallback(async () => {
    setIsRefreshing(true);
    setSyncError(null);
    try {
      await syncAdminData();
      setLastSyncedAt(new Date().toLocaleTimeString());
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Unable to refresh technician account data.');
    } finally {
      setIsRefreshing(false);
    }
  }, [syncAdminData]);

  useEffect(() => {
    void runSync();
  }, [runSync]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleAdminRefresh = () => {
      void runSync();
    };

    window.addEventListener('sm-dispatch:admin-refresh', handleAdminRefresh);
    return () => {
      window.removeEventListener('sm-dispatch:admin-refresh', handleAdminRefresh);
    };
  }, [runSync]);

  const activeCount = technicianAccounts.filter((item) => item.isActive).length;
  const inactiveCount = technicianAccounts.filter((item) => !item.isActive).length;
  const pendingPasswordResetCount = pendingTechnicianPasswordResetRequests.length;
  const hasSearchQuery = searchQuery.trim().length > 0;

  const filteredAccounts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return technicianAccounts;
    }

    return technicianAccounts.filter((account) =>
      account.name.toLowerCase().includes(query)
      || account.email.toLowerCase().includes(query)
      || (account.phone ?? '').toLowerCase().includes(query)
    );
  }, [searchQuery, technicianAccounts]);

  const filteredPendingPasswordResetRequests = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return pendingTechnicianPasswordResetRequests;
    }

    return pendingTechnicianPasswordResetRequests.filter((request) =>
      (request.technicianName ?? '').toLowerCase().includes(query)
      || request.technicianEmail.toLowerCase().includes(query)
      || (request.technicianPhone ?? '').toLowerCase().includes(query)
    );
  }, [pendingTechnicianPasswordResetRequests, searchQuery]);

  const openEditDialog = (account: TechnicianAccountSummary) => {
    setSelectedAccount(account);
    setForm({
      name: account.name,
      email: account.email,
      phone: account.phone ?? '',
    });
    setFormError(null);
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedAccount) {
      return;
    }

    setFormError(null);
    setIsSaving(true);

    try {
      await updateTechnicianAccount(selectedAccount.id, {
        name: form.name,
        email: form.email,
        phone: form.phone,
      });
      await runSync();
      setEditDialogOpen(false);
      setSelectedAccount(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to save account changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (account: TechnicianAccountSummary) => {
    const nextState = !account.isActive;
    const message = nextState
      ? `Activate ${account.name}'s account?`
      : `Suspend ${account.name}'s account?`;

    if (!window.confirm(message)) {
      return;
    }

    try {
      await setTechnicianAccountActive(account.id, nextState);
      await runSync();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Unable to update account status.');
    }
  };

  const handleCreateTechnician = async () => {
    const adminToken = getStoredAdminToken();
    if (!adminToken) {
      setCreateError('Admin session is required to create technician accounts.');
      return;
    }

    const name = createForm.name.trim();
    const email = createForm.email.trim().toLowerCase();
    const phone = createForm.phone.trim();
    const password = createForm.password.trim();

    if (!name || !email || !password) {
      setCreateError('Name, email, and temporary password are required.');
      return;
    }

    setCreateError(null);
    setIsCreating(true);
    try {
      await createAdminTechnician(adminToken, {
        name,
        email,
        phone: phone || undefined,
        password,
        status: 'active',
        manual_availability: true,
      });

      const subject = encodeURIComponent('Your NexusOps technician account');
      const body = encodeURIComponent(
        `Hello ${name},\n\nYour technician account has been created in NexusOps.\n\nSign in here:\n${window.location.origin}/tech/login\n\nEmail: ${email}\nTemporary password: ${password}\n\nPlease sign in and change your password after your first login.\n`
      );
      window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;

      setCreateForm({
        name: '',
        email: '',
        phone: '',
        password: '',
      });
      setCreateDialogOpen(false);
      await runSync();
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Unable to create technician account.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleSendResetLink = async (payload: { technicianId: string; email: string; name: string }) => {
    const adminToken = getStoredAdminToken();
    if (!adminToken) {
      window.alert('Admin session is required to send password reset links.');
      return;
    }

    setIsSendingResetLinkFor(payload.technicianId);
    try {
      const issued = await issueAdminTechnicianPasswordResetLink(adminToken, payload.technicianId);
      const resetLink = `${window.location.origin}${issued.reset_url}`;
      const subject = encodeURIComponent('NexusOps technician password reset');
      const body = encodeURIComponent(
        `Hello ${payload.name},\n\nThis is your technician account password reset message from NexusOps.\n\nReset your password here:\n${resetLink}\n\nThis link expires in 24 hours. If you did not request this, please contact support.\n`
      );
      window.location.href = `mailto:${payload.email}?subject=${subject}&body=${body}`;
      await runSync();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Unable to issue password reset link.');
    } finally {
      setIsSendingResetLinkFor(null);
    }
  };

  const handleResolvePasswordResetRequest = async (request: TechnicianPasswordResetRequestSummary) => {
    const label = request.technicianName ?? request.technicianEmail;
    if (!window.confirm(`Mark password reset request for ${label} as handled?`)) {
      return;
    }

    try {
      await resolveTechnicianPasswordResetRequest(request.id);
      await runSync();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Unable to resolve password reset request.');
    }
  };

  return (
    <div className="relative w-full pb-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[380px] rounded-[34px] bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),rgba(34,211,238,0)_34%),radial-gradient(circle_at_top_right,rgba(52,211,153,0.08),rgba(52,211,153,0)_30%)]" />
      <div className="pointer-events-none absolute left-8 top-8 h-40 w-40 rounded-full bg-cyan-400/8 blur-3xl" />
      <div className="pointer-events-none absolute right-10 top-20 h-48 w-48 rounded-full bg-emerald-400/8 blur-3xl" />

      <div className="relative space-y-6">
        <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(7,25,42,0.98),rgba(6,18,32,0.98))] shadow-[0_34px_120px_rgba(0,0,0,0.34)]">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:120px_120px] opacity-20" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/70 to-transparent" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(47,142,146,0.14),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.12),transparent_26%)]" />
          <div className="relative flex flex-col gap-5 p-6 xl:flex-row xl:items-end xl:justify-between xl:p-8">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-100">
                <UserCog className="h-3.5 w-3.5" />
                Access Controls
              </div>
              <h1 className="mt-5 text-[2.35rem] font-semibold leading-none tracking-[-0.06em] text-white md:text-[2.8rem]">
                Accounts
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-[15px]">
                Manage technician access.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="outline" className={cn(
                'px-3 py-1 text-xs',
                isRefreshing
                  ? 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100'
                  : syncError
                    ? 'border-rose-300/20 bg-rose-300/10 text-rose-100'
                    : 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
              )}>
                {isRefreshing ? 'Syncing data...' : syncError ? 'Sync failed' : 'Data synced'}
              </Badge>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setCreateError(null);
                  setCreateForm({
                    name: '',
                    email: '',
                    phone: '',
                    password: '',
                  });
                  setCreateDialogOpen(true);
                }}
                className="h-10 gap-2 rounded-full border border-[#7db0ff]/40 bg-[linear-gradient(135deg,#4f7cff,#22d3ee)] text-white shadow-[0_16px_34px_rgba(79,124,255,0.22)] hover:brightness-105"
              >
                <Power className="h-4 w-4" />
                Create Technician
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => { void runSync(); }}
                disabled={isRefreshing}
                className="h-10 gap-2 rounded-full border-slate-300 bg-white text-slate-900 hover:bg-slate-50 hover:text-slate-950 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-100 dark:hover:bg-white/[0.08] dark:hover:text-white"
              >
                <RefreshCw className={cn('w-4 h-4 text-blue-600 dark:text-cyan-200', isRefreshing && 'animate-spin')} />
                Refresh
              </Button>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Card className={metricCardClass('emerald')}>
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Active</p>
                  <p className="mt-3 text-[2.15rem] font-semibold leading-none tracking-[-0.06em] text-white">{activeCount}</p>
                  <p className="text-sm text-slate-300">Can sign in</p>
                </div>
                <div className={metricIconClass('emerald')}>
                  <ShieldCheck className="w-5 h-5" />
                </div>
              </div>
            </div>
          </Card>
          <Card className={metricCardClass('amber')}>
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Suspended</p>
                  <p className="mt-3 text-[2.15rem] font-semibold leading-none tracking-[-0.06em] text-white">{inactiveCount}</p>
                  <p className="text-sm text-slate-300">Blocked accounts</p>
                </div>
                <div className={metricIconClass('amber')}>
                  <ShieldOff className="w-5 h-5" />
                </div>
              </div>
            </div>
          </Card>
          <Card className={metricCardClass('rose')}>
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Password Resets</p>
                  <p className="mt-3 text-[2.15rem] font-semibold leading-none tracking-[-0.06em] text-white">{pendingPasswordResetCount}</p>
                  <p className="text-sm text-slate-300">Requests awaiting manual handling</p>
                </div>
                <div className={metricIconClass('rose')}>
                  <KeyRound className="w-5 h-5" />
                </div>
              </div>
            </div>
          </Card>
        </div>

      <Card className={sectionCardClass}>
        <div className={sectionHeaderClass}>
        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search by name, email, or phone"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="h-11 rounded-full border-white/10 bg-white/[0.04] pl-9 text-slate-100 placeholder:text-slate-500"
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={
              isRefreshing
                ? 'border-blue-200 text-blue-700 bg-blue-50'
                : syncError
                  ? 'border-red-200 text-red-700 bg-red-50'
                  : 'border-emerald-200 text-emerald-700 bg-emerald-50'
            }
          >
            {isRefreshing ? 'Syncing data...' : syncError ? 'Sync failed' : 'Data synced'}
          </Badge>
          <Badge variant="outline" className="border-white/10 bg-white/[0.04] text-slate-300">
            Showing {filteredAccounts.length} accounts | {inactiveCount} suspended | {filteredPendingPasswordResetRequests.length} reset pending
          </Badge>
          {hasSearchQuery ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSearchQuery('')}
              className="h-7 px-2 text-slate-400 hover:text-slate-200"
            >
              Clear Search
            </Button>
          ) : null}
          {syncError ? (
            <>
              <span className="text-xs text-rose-300">{syncError}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => { void runSync(); }}
                disabled={isRefreshing}
                className="h-7 px-2 border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]"
              >
                Retry Sync
              </Button>
            </>
          ) : null}
        </div>
        </div>
      </Card>

      <Card className={sectionCardClass}>
        <div className="overflow-hidden rounded-[20px] border border-white/8 bg-black/10">
          <div className="border-b border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.025),rgba(255,255,255,0))] px-6 py-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <KeyRound className="h-4 w-4 text-rose-300" />
                  Password Reset Requests
                  <Badge variant="secondary" className="border border-rose-300/20 bg-rose-300/10 text-rose-100">
                    {filteredPendingPasswordResetRequests.length}
                  </Badge>
                </div>
              </div>
              <Badge variant="outline" className="w-fit rounded-full border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-300">
                {filteredPendingPasswordResetRequests.length} reset pending
              </Badge>
            </div>
            <div className="mt-4 overflow-hidden rounded-2xl border border-white/8 bg-black/10">
              <Table>
                <TableHeader className="border-b border-white/10 bg-[linear-gradient(180deg,rgba(11,25,42,0.98),rgba(10,20,35,0.92))] backdrop-blur-xl">
                  <TableRow className="border-white/0 hover:bg-transparent">
                    <TableHead className="pl-6 w-[220px] text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Technician</TableHead>
                    <TableHead className="w-[260px] text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Contact</TableHead>
                    <TableHead className="w-[220px] text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Requested At</TableHead>
                    <TableHead className="text-right pr-6 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPendingPasswordResetRequests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-sm text-slate-400">
                        {hasSearchQuery ? 'No password reset requests match your search.' : 'No pending password reset requests.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPendingPasswordResetRequests.map((request) => (
                      <TableRow key={request.id} className="border-white/6 hover:bg-white/[0.045]">
                        <TableCell className="pl-6">
                          <div>
                            <p className="font-semibold text-white">{request.technicianName ?? 'Technician'}</p>
                            <p className="text-xs text-slate-500 font-mono">{request.id}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="text-sm text-slate-200 flex items-center gap-2">
                              <Mail className="w-3.5 h-3.5 text-slate-500" />
                              <span>{request.technicianEmail}</span>
                            </div>
                            <div className="text-sm text-slate-400 flex items-center gap-2">
                              <Phone className="w-3.5 h-3.5 text-slate-500" />
                              <span>{request.technicianPhone ? formatPhoneForDisplay(request.technicianPhone) : 'Not set'}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-slate-300 flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-slate-500" />
                            <span>{formatDateTime(request.requestedAt)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="pr-6">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => { void handleSendResetLink({
                                technicianId: request.technicianId,
                                email: request.technicianEmail,
                                name: request.technicianName ?? 'Technician',
                              }); }}
                              disabled={isRefreshing || isSendingResetLinkFor === request.technicianId}
                              className="border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]"
                            >
                              <Send className="w-4 h-4 mr-1" />
                              {isSendingResetLinkFor === request.technicianId ? 'Sending...' : 'Send Reset Link'}
                            </Button>
                            <Button
                              size="sm"
                              className="bg-rose-600 hover:bg-rose-700"
                              onClick={() => handleResolvePasswordResetRequest(request)}
                              disabled={isRefreshing}
                            >
                              <CheckCircle2 className="w-4 h-4 mr-1" />
                              Mark Handled
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
          <div className="flex items-start justify-between gap-3 border-b border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0))] px-6 py-5">
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Account Board</div>
            </div>
            <Badge variant="outline" className="rounded-full border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-300">
              {filteredAccounts.length} visible
            </Badge>
          </div>
          <Table>
            <TableHeader className="sticky top-0 z-10 border-b border-white/10 bg-[linear-gradient(180deg,rgba(11,25,42,0.98),rgba(10,20,35,0.92))] backdrop-blur-xl">
              <TableRow className="border-white/0 hover:bg-transparent">
                <TableHead className="pl-6 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Name</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Email</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Phone</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Account Status</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Signup Date</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Last Login</TableHead>
                <TableHead className="pr-6 text-right text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAccounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-40 text-center text-sm text-slate-400">
                    {hasSearchQuery ? 'No technician accounts match your search.' : 'No technician accounts available yet.'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredAccounts.map((account) => (
                  <TableRow key={account.id} className="border-white/6 hover:bg-white/[0.045]">
                    <TableCell className="pl-6">
                      <div>
                        <p className="font-semibold text-white">{account.name}</p>
                        <p className="text-xs text-slate-500 font-mono">{account.id}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-200">{account.email}</TableCell>
                    <TableCell className="text-slate-400">{account.phone ? formatPhoneForDisplay(account.phone) : 'Not set'}</TableCell>
                    <TableCell>
                      {account.isActive ? (
                        <Badge className="border border-emerald-300/20 bg-emerald-300/12 text-emerald-100 hover:bg-emerald-300/12">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="border-white/10 bg-white/[0.03] text-slate-400">Suspended</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-300">{formatDateTime(account.createdAt)}</TableCell>
                    <TableCell className="text-slate-400">{account.lastLoginAt ? formatDateTime(account.lastLoginAt) : 'No login recorded'}</TableCell>
                    <TableCell className="pr-6">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEditDialog(account)} className="border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]">
                          <Pencil className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant={account.isActive ? 'destructive' : 'default'}
                          onClick={() => handleToggleActive(account)}
                          className={!account.isActive ? 'bg-emerald-600 hover:bg-emerald-700' : undefined}
                          disabled={isRefreshing}
                        >
                          {account.isActive ? <ShieldOff className="w-4 h-4 mr-1" /> : <ShieldCheck className="w-4 h-4 mr-1" />}
                          {account.isActive ? 'Suspend' : 'Activate'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-lg border-white/10 bg-[linear-gradient(180deg,rgba(9,24,39,0.98),rgba(6,17,29,0.98))] text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Technician Account</DialogTitle>
            <DialogDescription className="text-slate-300">Update profile details for this account.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="tech-account-name" className="text-slate-200">Full Name</Label>
              <Input
                id="tech-account-name"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                className="h-12 rounded-2xl border-white/10 bg-[linear-gradient(180deg,rgba(10,18,32,0.96),rgba(8,14,26,0.96))] text-white placeholder:text-slate-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tech-account-email" className="text-slate-200">Email</Label>
              <Input
                id="tech-account-email"
                type="email"
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                className="h-12 rounded-2xl border-white/10 bg-[linear-gradient(180deg,rgba(10,18,32,0.96),rgba(8,14,26,0.96))] text-white placeholder:text-slate-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tech-account-phone" className="text-slate-200">Phone</Label>
              <Input
                id="tech-account-phone"
                value={form.phone}
                onChange={(event) => setForm((prev) => ({ ...prev, phone: formatUsPhoneInput(event.target.value) }))}
                className="h-12 rounded-2xl border-white/10 bg-[linear-gradient(180deg,rgba(10,18,32,0.96),rgba(8,14,26,0.96))] text-white placeholder:text-slate-500"
              />
            </div>
            {formError && (
              <p className="text-sm text-rose-300">{formError}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" className="h-11 rounded-2xl border border-white/10 !bg-[#0b1424] px-5 !text-slate-100 hover:!bg-[#122039] hover:!text-white" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={isSaving} className="h-11 rounded-2xl border border-[#7db0ff]/40 bg-[linear-gradient(135deg,#4f7cff,#22d3ee)] px-5 text-white shadow-[0_16px_34px_rgba(79,124,255,0.22)] hover:brightness-105">
              <Power className="w-4 h-4 mr-1" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-lg border-white/10 bg-[linear-gradient(180deg,rgba(9,24,39,0.98),rgba(6,17,29,0.98))] text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-white">Create Technician Account</DialogTitle>
            <DialogDescription className="text-slate-300">
              Create the account here, then we will open an invite email draft with the technician's sign-in details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="create-tech-name" className="text-slate-200">Full Name</Label>
              <Input
                id="create-tech-name"
                value={createForm.name}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
                className="h-12 rounded-2xl border-white/10 bg-[linear-gradient(180deg,rgba(10,18,32,0.96),rgba(8,14,26,0.96))] text-white placeholder:text-slate-500"
                placeholder="Technician full name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-tech-email" className="text-slate-200">Email</Label>
              <Input
                id="create-tech-email"
                type="email"
                value={createForm.email}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, email: event.target.value }))}
                className="h-12 rounded-2xl border-white/10 bg-[linear-gradient(180deg,rgba(10,18,32,0.96),rgba(8,14,26,0.96))] text-white placeholder:text-slate-500"
                placeholder="tech@company.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-tech-phone" className="text-slate-200">Phone</Label>
              <Input
                id="create-tech-phone"
                value={createForm.phone}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, phone: formatUsPhoneInput(event.target.value) }))}
                className="h-12 rounded-2xl border-white/10 bg-[linear-gradient(180deg,rgba(10,18,32,0.96),rgba(8,14,26,0.96))] text-white placeholder:text-slate-500"
                placeholder="+1 (555) 555-5555"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-tech-password" className="text-slate-200">Temporary Password</Label>
              <Input
                id="create-tech-password"
                type="text"
                value={createForm.password}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, password: event.target.value }))}
                className="h-12 rounded-2xl border-white/10 bg-[linear-gradient(180deg,rgba(10,18,32,0.96),rgba(8,14,26,0.96))] text-white placeholder:text-slate-500"
                placeholder="Minimum 8 characters"
              />
            </div>
            {createError ? (
              <p className="text-sm text-rose-300">{createError}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="ghost" className="border border-white/10 !bg-[#0b1424] !text-slate-100 hover:!bg-[#122039] hover:!text-white" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => { void handleCreateTechnician(); }} disabled={isCreating} className="bg-[linear-gradient(135deg,#4f7cff,#22d3ee)] text-white hover:brightness-105">
              {isCreating ? 'Creating...' : 'Create Account & Invite'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}

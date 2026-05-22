import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users,
  Clock,
  Coffee,
  LogIn,
  LogOut,
  Activity,
  MapPin,
  RefreshCw,
  Search,
  Download,
  ChevronDown,
  ChevronUp,
  CalendarDays,
  BarChart3,
  ScrollText,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { fetchAdminTechnicians, getStoredAdminToken, type BackendTechnicianListItem } from '@/lib/backend-api';
import {
  buildAdminRecords,
  fmtDuration,
  workedMs,
  breakMs,
  todaySessions,
  allSessions,
  type AdminAttendanceRecord,
  type AttendanceEventKind,
  type AttendanceSession,
} from '@/lib/attendance-store';

// ─── Status helpers ───────────────────────────────────────────────────────────

type DisplayStatus = 'clocked_in' | 'on_break' | 'not_clocked_in' | 'clocked_out';

const STATUS_META: Record<DisplayStatus, { label: string; color: string; dot: string }> = {
  clocked_in: { label: 'Clocked In', color: 'text-emerald-400', dot: '#34d399' },
  on_break: { label: 'On Break', color: 'text-amber-400', dot: '#fbbf24' },
  clocked_out: { label: 'Clocked Out', color: 'text-slate-400', dot: '#475569' },
  not_clocked_in: { label: 'Not Checked In', color: 'text-slate-500', dot: '#334155' },
};

function StatusDot({ status, pulse }: { status: DisplayStatus; pulse?: boolean }) {
  const color = STATUS_META[status].dot;
  return (
    <span className="relative flex h-2.5 w-2.5 shrink-0">
      {pulse && (
        <span
          className="absolute inline-flex h-full w-full rounded-full opacity-75"
          style={{ backgroundColor: color, animation: 'live-ping 1.4s ease-out infinite' }}
        />
      )}
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
    </span>
  );
}

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
}

// ─── Live tick ────────────────────────────────────────────────────────────────

function useLiveTick(ms = 5000) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminAttendancePage() {
  const [technicians, setTechnicians] = useState<BackendTechnicianListItem[]>([]);
  const [records, setRecords] = useState<AdminAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('live');

  useLiveTick(5000);

  const load = useCallback(async () => {
    const token = getStoredAdminToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminTechnicians(token);
      setTechnicians(data);
      setRecords(buildAdminRecords(data.map(t => ({ id: t.id, name: t.full_name ?? t.name }))));
      setLastRefreshed(new Date());
    } catch {
      setError('Failed to load technicians.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Re-derive records from latest localStorage every 5s without re-fetching backend
  useEffect(() => {
    setRecords(buildAdminRecords(technicians.map(t => ({ id: t.id, name: t.full_name ?? t.name }))));
  });

  const filtered = records.filter(r =>
    r.technicianName.toLowerCase().includes(search.toLowerCase()),
  );

  const summary = {
    total: records.length,
    in: records.filter(r => r.status === 'clocked_in').length,
    break: records.filter(r => r.status === 'on_break').length,
    out: records.filter(r => r.status === 'not_clocked_in' || r.status === 'clocked_out').length,
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 p-6">

      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Attendance & Tracking</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Live clock-in status, break tracking, and daily reports.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {lastRefreshed && (
            <span className="text-xs text-slate-600">
              Updated {lastRefreshed.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            disabled={loading}
            onClick={load}
            className="h-9 w-9 rounded-2xl border border-white/10 !bg-[#0d1829] !text-slate-300 hover:!bg-[#122039] hover:!text-white"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total', value: summary.total, icon: Users, color: '#94a3b8' },
          { label: 'Clocked In', value: summary.in, icon: LogIn, color: '#34d399' },
          { label: 'On Break', value: summary.break, icon: Coffee, color: '#fbbf24' },
          { label: 'Not In', value: summary.out, icon: LogOut, color: '#f87171' },
        ].map((card, i) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="rounded-[22px] border border-white/[0.07] bg-[#0d1829] p-4"
              style={{ animation: 'fade-in-up 0.4s ease both', animationDelay: `${i * 60}ms` }}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{card.label}</p>
                <div className="flex h-7 w-7 items-center justify-center rounded-xl" style={{ backgroundColor: card.color + '22' }}>
                  <Icon className="h-3.5 w-3.5" style={{ color: card.color }} />
                </div>
              </div>
              <p className="mt-2 text-3xl font-bold tabular-nums text-white">{card.value}</p>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="w-fit rounded-2xl border border-white/[0.07] bg-[#0d1829] p-1">
            {[
              { value: 'live', label: 'Live Tracking', icon: Activity },
              { value: 'reports', label: 'Reports', icon: BarChart3 },
              { value: 'audit', label: 'Audit Log', icon: ScrollText },
            ].map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-400 data-[state=active]:bg-[#1a2a40] data-[state=active]:text-white"
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="relative w-full sm:max-w-[220px]">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <Input
              placeholder="Search technician…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-9 rounded-2xl pl-8 text-xs"
            />
          </div>
        </div>

        {/* LIVE TRACKING */}
        <TabsContent value="live" className="mt-0 flex-1">
          {loading ? (
            <LoadingSkeleton />
          ) : filtered.length === 0 ? (
            <EmptyState label="No technicians found" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((rec, i) => (
                <TechnicianCard key={rec.technicianId} rec={rec} index={i} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* REPORTS */}
        <TabsContent value="reports" className="mt-0 flex-1">
          <ReportsTab technicians={technicians} search={search} />
        </TabsContent>

        {/* AUDIT LOG */}
        <TabsContent value="audit" className="mt-0 flex-1">
          <AuditLogTab technicians={technicians} search={search} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Technician Live Card ─────────────────────────────────────────────────────

function TechnicianCard({ rec, index }: { rec: AdminAttendanceRecord; index: number }) {
  const now = Date.now();
  const status = rec.status as DisplayStatus;
  const meta = STATUS_META[status];
  const isActive = status === 'clocked_in' || status === 'on_break';
  const tech = rec.session;
  const location = tech?.clockInLocation;

  return (
    <div
      className="rounded-[24px] border border-white/[0.07] bg-[#0d1829] p-4 transition-all duration-200 hover:border-white/[0.12]"
      style={{ animation: 'fade-in-up 0.4s ease both', animationDelay: `${index * 50}ms` }}
    >
      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10 shrink-0 border border-white/10">
          <AvatarFallback className="bg-[#1a2a40] text-sm font-bold text-slate-300">
            {initials(rec.technicianName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold text-white">{rec.technicianName}</p>
            <div className="flex shrink-0 items-center gap-1.5">
              <StatusDot status={status} pulse={isActive} />
              <span className={cn('text-xs font-semibold', meta.color)}>{meta.label}</span>
            </div>
          </div>
          {rec.lastSeen && (
            <p className="mt-0.5 text-xs text-slate-500">
              Last activity {new Date(rec.lastSeen).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </p>
          )}
        </div>
      </div>

      {isActive && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <StatChip
            label="Worked"
            value={fmtDuration(rec.workedToday)}
            color="#34d399"
          />
          <StatChip
            label="Break"
            value={fmtDuration(rec.breakToday)}
            color="#fbbf24"
          />
        </div>
      )}

      {rec.session?.clockedInAt && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/[0.05] bg-white/[0.03] px-3 py-2">
          <Clock className="h-3 w-3 shrink-0 text-slate-500" />
          <span className="text-xs text-slate-400">
            In at {new Date(rec.session.clockedInAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            {rec.session.clockedOutAt && (
              <> · Out at {new Date(rec.session.clockedOutAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</>
            )}
          </span>
        </div>
      )}

      {location && (
        <div className="mt-2 flex items-center gap-2 rounded-xl border border-white/[0.05] bg-white/[0.03] px-3 py-2">
          <MapPin className="h-3 w-3 shrink-0 text-cyan-500" />
          <span className="truncate text-xs text-slate-500">
            {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
          </span>
        </div>
      )}
    </div>
  );
}

function StatChip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-2.5 py-2 text-center">
      <p className="font-mono text-sm font-bold tabular-nums" style={{ color }}>{value}</p>
      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-600">{label}</p>
    </div>
  );
}

// ─── Reports Tab ──────────────────────────────────────────────────────────────

function ReportsTab({ technicians, search }: { technicians: BackendTechnicianListItem[]; search: string }) {
  const now = Date.now();

  const rows = technicians
    .filter(t => (t.full_name ?? t.name).toLowerCase().includes(search.toLowerCase()))
    .map(t => {
      const sessions = todaySessions(t.id);
      const totalWorked = sessions.reduce((acc, s) => acc + workedMs(s, now), 0);
      const totalBreak = sessions.reduce((acc, s) => acc + breakMs(s, now), 0);
      const clockIns = sessions.length;
      const firstIn = sessions[0]?.clockedInAt ?? null;
      const lastOut = sessions.filter(s => s.clockedOutAt).at(-1)?.clockedOutAt ?? null;
      return { id: t.id, name: t.full_name ?? t.name, totalWorked, totalBreak, clockIns, firstIn, lastOut };
    });

  const exportCsv = () => {
    const header = 'Name,Clock-ins,First In,Last Out,Worked,Break\n';
    const body = rows.map(r =>
      [
        r.name,
        r.clockIns,
        r.firstIn ? new Date(r.firstIn).toLocaleTimeString() : '-',
        r.lastOut ? new Date(r.lastOut).toLocaleTimeString() : '-',
        fmtDuration(r.totalWorked),
        fmtDuration(r.totalBreak),
      ].join(',')
    ).join('\n');
    const blob = new Blob([header + body], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 rounded-2xl border border-white/[0.07] bg-[#0d1829] px-3 py-2">
          <CalendarDays className="h-4 w-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-300">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={exportCsv}
          className="h-9 rounded-2xl border border-white/10 !bg-[#0d1829] !text-slate-300 hover:!bg-[#122039] hover:!text-white"
        >
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Export CSV
        </Button>
      </div>

      <div className="overflow-x-auto rounded-[24px] border border-white/[0.07] bg-[#0d1829]">
        <div className="grid min-w-[720px] grid-cols-[1fr_auto_auto_auto_auto_auto] gap-0 border-b border-white/[0.06] px-4 py-3">
          {['Technician', 'Clock-ins', 'First In', 'Last Out', 'Worked', 'Break'].map(h => (
            <p key={h} className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{h}</p>
          ))}
        </div>
        {rows.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">No data for today.</div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {rows.map((row, i) => (
              <div
                key={row.id}
                className="grid min-w-[720px] grid-cols-[1fr_auto_auto_auto_auto_auto] items-center gap-0 px-4 py-3 hover:bg-white/[0.02]"
                style={{ animation: 'fade-in-up 0.35s ease both', animationDelay: `${i * 40}ms` }}
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1a2a40] text-xs font-bold text-slate-300">
                    {initials(row.name)}
                  </div>
                  <span className="text-sm font-medium text-slate-200">{row.name}</span>
                </div>
                <span className="px-3 text-sm tabular-nums text-slate-400">{row.clockIns}</span>
                <span className="px-3 text-sm tabular-nums text-slate-400">
                  {row.firstIn ? new Date(row.firstIn).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—'}
                </span>
                <span className="px-3 text-sm tabular-nums text-slate-400">
                  {row.lastOut ? new Date(row.lastOut).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—'}
                </span>
                <span className="px-3 font-mono text-sm font-semibold tabular-nums text-emerald-400">{fmtDuration(row.totalWorked)}</span>
                <span className="px-3 font-mono text-sm font-semibold tabular-nums text-amber-400">{fmtDuration(row.totalBreak)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Audit Log Tab ────────────────────────────────────────────────────────────

type AuditEntry = {
  techId: string;
  techName: string;
  sessionId: string;
  eventId: string;
  kind: AttendanceEventKind;
  timestamp: string;
  device: string;
  lat: number | null;
  lng: number | null;
};

function AuditLogTab({ technicians, search }: { technicians: BackendTechnicianListItem[]; search: string }) {
  const entries: AuditEntry[] = [];

  technicians.forEach(t => {
    const sessions = allSessions(t.id);
    sessions.forEach(s => {
      s.events.forEach(ev => {
        entries.push({
          techId: t.id,
          techName: t.full_name ?? t.name,
          sessionId: s.id,
          eventId: ev.id,
          kind: ev.kind,
          timestamp: ev.timestamp,
          device: ev.device,
          lat: ev.location?.lat ?? null,
          lng: ev.location?.lng ?? null,
        });
      });
    });
  });

  entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const filtered = entries.filter(e =>
    e.techName.toLowerCase().includes(search.toLowerCase()),
  );

  const EVENT_COLORS: Record<AttendanceEventKind, string> = {
    clock_in: '#34d399',
    clock_out: '#f87171',
    break_start: '#fbbf24',
    break_end: '#34d399',
  };
  const EVENT_LABELS: Record<AttendanceEventKind, string> = {
    clock_in: 'Clock In',
    clock_out: 'Clock Out',
    break_start: 'Break Start',
    break_end: 'Break End',
  };

  return (
    <div className="overflow-x-auto rounded-[24px] border border-white/[0.07] bg-[#0d1829]">
      <div className="grid min-w-[760px] grid-cols-[auto_1fr_auto_auto_auto] border-b border-white/[0.06] px-4 py-3">
        {['Event', 'Technician', 'Time', 'Device', 'GPS'].map(h => (
          <p key={h} className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{h}</p>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div className="py-12 text-center text-sm text-slate-500">No attendance events recorded yet.</div>
      ) : (
        <div className="max-h-[520px] overflow-y-auto divide-y divide-white/[0.04]">
          {filtered.map((entry, i) => {
            const color = EVENT_COLORS[entry.kind];
            return (
              <div
                key={entry.eventId}
                className="grid min-w-[760px] grid-cols-[auto_1fr_auto_auto_auto] items-center gap-0 px-4 py-3 hover:bg-white/[0.02]"
                style={{ animation: 'fade-in-up 0.3s ease both', animationDelay: `${Math.min(i, 20) * 25}ms` }}
              >
                <div className="mr-4 flex items-center gap-2">
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                    style={{ backgroundColor: color + '22', color, border: `1px solid ${color}44` }}
                  >
                    {EVENT_LABELS[entry.kind]}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1a2a40] text-[10px] font-bold text-slate-300">
                    {initials(entry.techName)}
                  </div>
                  <span className="text-sm text-slate-300">{entry.techName}</span>
                </div>
                <span className="px-3 text-xs tabular-nums text-slate-500">
                  {new Date(entry.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}
                </span>
                <span className="px-3 text-xs text-slate-500">{entry.device}</span>
                <span className="px-3 text-xs text-slate-600">
                  {entry.lat !== null ? `${entry.lat.toFixed(3)},${entry.lng!.toFixed(3)}` : '—'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-[140px] animate-pulse rounded-[24px] border border-white/[0.07] bg-[#0d1829]" />
      ))}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[24px] border border-white/[0.07] bg-[#0d1829] py-16">
      <Users className="mb-3 h-8 w-8 text-slate-600" />
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}

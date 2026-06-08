import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Clock,
  MapPin,
  Coffee,
  LogIn,
  LogOut,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import TechnicianBottomNav from '@/components/common/technician-bottom-nav';
import {
  clockIn,
  clockOut,
  startBreak,
  endBreak,
  activeSession,
  todaySessions,
  captureGps,
  workedMs,
  breakMs,
  fmtDuration,
  type AttendanceSession,
  type AttendanceStatus,
  type AttendanceEventKind,
} from '@/lib/attendance-store';
import { useParams } from 'react-router-dom';
import {
  buildDeviceLogPayload,
  createTechnicianLocationCheckpoint,
  fetchTechnicianAttendanceCurrent,
  fetchTechnicianAttendanceHistory,
  getStoredAdminToken,
  getStoredTechnicianToken,
  performTechnicianAttendanceAction,
  saveTechnicianLocationConsent,
  updateTechnicianLocation,
  type BackendAttendanceSession,
} from '@/lib/backend-api';

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<AttendanceStatus, { label: string; color: string; bg: string; ring: string }> = {
  clocked_out: { label: 'Clocked Out', color: '#94a3b8', bg: '#1e293b', ring: '#334155' },
  clocked_in: { label: 'Clocked In', color: '#34d399', bg: '#064e3b', ring: '#059669' },
  on_break: { label: 'On Break', color: '#fbbf24', bg: '#451a03', ring: '#d97706' },
};

// ─── Live timer ───────────────────────────────────────────────────────────────

function useLiveTick(intervalMs = 1000) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}

// ─── Route aware preview helper ───────────────────────────────────────────────

function useTechId(): string | null {
  const { techId } = useParams<{ techId?: string }>();
  const { user } = useAuth();
  return techId ?? user?.id ?? null;
}

function useTechName(): string {
  const { user } = useAuth();
  return user?.name ?? 'Technician';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TechnicianAttendancePage() {
  const techId = useTechId();
  const techName = useTechName();
  const isPreview = !!useParams<{ techId?: string }>().techId && !!getStoredAdminToken();
  const routeBase = isPreview && techId ? `/admin/tech-preview/${techId}` : '/tech';
  useLiveTick();

  const [session, setSession] = useState<AttendanceSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [todayHistory, setTodayHistory] = useState<AttendanceSession[]>([]);
  const [permissionState, setPermissionState] = useState<PermissionState | 'unsupported' | 'unknown'>('unknown');
  const [checkingPermission, setCheckingPermission] = useState(true);

  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loginCheckpointSent = useRef(false);

  const reload = useCallback(async () => {
    if (!techId) return;
    const token = getStoredTechnicianToken();
    if (token && !isPreview) {
      try {
        const [current, history] = await Promise.all([
          fetchTechnicianAttendanceCurrent(token),
          fetchTechnicianAttendanceHistory(token),
        ]);
        setSession(current ? fromBackendSession(current, techName) : null);
        setTodayHistory(history.map(item => fromBackendSession(item, techName)));
        return;
      } catch {
        setError('Backend attendance is unavailable. Showing local device records.');
      }
    }
    setSession(activeSession(techId));
    setTodayHistory(todaySessions(techId));
  }, [isPreview, techId, techName]);

  const refreshPermission = useCallback(async () => {
    if (!('permissions' in navigator) || !navigator.permissions.query) {
      setPermissionState('unsupported');
      setCheckingPermission(false);
      return;
    }
    try {
      const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      setPermissionState(status.state);
      status.onchange = () => setPermissionState(status.state);
    } catch {
      setPermissionState('unknown');
    } finally {
      setCheckingPermission(false);
    }
  }, [techId]);

  useEffect(() => { void refreshPermission(); }, [refreshPermission]);
  useEffect(() => { void reload(); }, [reload]);

  useEffect(() => {
    const token = getStoredTechnicianToken();
    if (!token || permissionState !== 'granted' || loginCheckpointSent.current || isPreview) return;
    loginCheckpointSent.current = true;
    void captureGps().then((gps) => {
      void saveTechnicianLocationConsent(token, { status: 'granted', device: buildDeviceLogPayload() });
      if (gps) {
        void createTechnicianLocationCheckpoint(token, {
          event_type: 'technician_login',
          latitude: gps.lat,
          longitude: gps.lng,
          accuracy: gps.accuracy,
          device: buildDeviceLogPayload(),
        });
      }
    });
  }, [isPreview, permissionState]);

  useEffect(() => {
    const token = getStoredTechnicianToken();
    if (!token || isPreview || permissionState !== 'granted' || !session || session.status === 'clocked_out') return;
    let cancelled = false;
    const ping = async () => {
      const gps = await captureGps();
      if (!gps || cancelled) return;
      await updateTechnicianLocation(token, {
        latitude: gps.lat,
        longitude: gps.lng,
        accuracy: gps.accuracy,
        availability_status: statusToAvailability(session.status),
        tracking_status: 'active',
        device: buildDeviceLogPayload(),
      }).catch(() => undefined);
    };
    void ping();
    const id = setInterval(() => void ping(), 12000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isPreview, permissionState, session]);

  const flash = (msg: string) => {
    setSuccessMsg(msg);
    if (successTimer.current) clearTimeout(successTimer.current);
    successTimer.current = setTimeout(() => setSuccessMsg(null), 3500);
  };

  const requestLocationAccess = async () => {
    setError(null);
    setCheckingPermission(true);
    const token = getStoredTechnicianToken();
    const gps = await captureGps();
    const status = gps ? 'granted' : 'denied';
    setPermissionState(status);
    if (token && !isPreview) {
      await saveTechnicianLocationConsent(token, { status, device: buildDeviceLogPayload() }).catch(() => undefined);
    }
    if (!gps) {
      setError('Location access is required for attendance and live job tracking.');
    }
    setCheckingPermission(false);
  };

  const run = async (localFn: () => Promise<AttendanceSession>, backendAction: 'clock-in' | 'clock-out' | 'break/start' | 'break/end', successText: string) => {
    setError(null);
    setLoading(true);
    try {
      const gps = await captureGps();
      const token = getStoredTechnicianToken();
      if (token && !isPreview) {
        await performTechnicianAttendanceAction(token, backendAction, {
          latitude: gps?.lat ?? null,
          longitude: gps?.lng ?? null,
          accuracy: gps?.accuracy ?? null,
          device: buildDeviceLogPayload(),
        });
      } else {
        await localFn();
      }
      await reload();
      flash(successText);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed.');
    } finally {
      setLoading(false);
    }
  };

  if (!techId) return null;

  const status: AttendanceStatus = session?.status ?? 'clocked_out';
  const cfg = STATUS_CONFIG[status];
  const now = Date.now();
  const worked = session ? workedMs(session, now) : 0;
  const brk = session ? breakMs(session, now) : 0;
  const currentBreak = session?.breaks.find(b => !b.endedAt);
  const currentBreakMs = currentBreak ? now - new Date(currentBreak.startedAt).getTime() : 0;

  if (!isPreview && !checkingPermission && permissionState !== 'granted') {
    return (
      <div className="flex min-h-screen flex-col bg-[#07111f] px-5 py-6 text-white">
        <div className="mx-auto flex min-h-[70vh] w-full max-w-sm flex-col justify-center">
          <div className="rounded-[24px] border border-white/[0.07] bg-[#0d1829] p-5 shadow-[0_24px_48px_rgba(0,0,0,0.45)]">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-400/10">
              <MapPin className="h-5 w-5 text-cyan-300" />
            </div>
            <h1 className="mt-5 text-xl font-bold">Enable Live Location</h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              NexusOps needs your location access so the admin can see your current position during active work.
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Your location is used only for operational tracking inside your company workspace.
            </p>
            {permissionState === 'denied' && (
              <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/10 px-3 py-2.5 text-sm text-red-200">
                Location access is blocked. Enable location permission from your browser settings, then try again.
              </div>
            )}
            <button
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-400/40 bg-cyan-400/15 px-4 py-3 text-sm font-bold text-cyan-200"
              onClick={requestLocationAccess}
            >
              <MapPin className="h-4 w-4" />
              Allow Location Access
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#07111f] pb-28">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
        <div>
          <h1 className="text-base font-bold text-white">Attendance</h1>
          <p className="text-xs text-slate-500">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </p>
        </div>
        {isPreview && (
          <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-400">
            Preview
          </span>
        )}
      </div>

      <div className="mx-auto w-full max-w-sm px-4 pt-6 space-y-5">

        {/* Status pill */}
        <div className="flex justify-center">
          <div
            className="flex items-center gap-2 rounded-full border px-4 py-2"
            style={{ borderColor: cfg.ring + '80', backgroundColor: cfg.bg + 'cc' }}
          >
            <span
              className="relative flex h-2.5 w-2.5"
            >
              {status !== 'clocked_out' && (
                <span
                  className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                  style={{ backgroundColor: cfg.color }}
                />
              )}
              <span
                className="relative inline-flex h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: cfg.color }}
              />
            </span>
            <span className="text-sm font-semibold" style={{ color: cfg.color }}>
              {cfg.label}
            </span>
          </div>
        </div>

        {/* Main timer card */}
        <div className="rounded-[28px] border border-white/[0.07] bg-[#0d1829] p-6 shadow-[0_24px_48px_rgba(0,0,0,0.5)]">
          <div className="flex flex-col items-center gap-1">
            <Clock className="mb-2 h-6 w-6 text-slate-500" />
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              {status === 'on_break' ? 'Break Time' : 'Worked Today'}
            </p>
            <p className="font-mono text-5xl font-bold tabular-nums text-white leading-none">
              {fmtDuration(status === 'on_break' ? currentBreakMs : worked)}
            </p>
            {session && (
              <p className="mt-1 text-xs text-slate-500">
                Clocked in at{' '}
                {new Date(session.clockedInAt).toLocaleTimeString('en-US', {
                  hour: 'numeric', minute: '2-digit',
                })}
              </p>
            )}
          </div>

          {/* Stats row */}
          {session && (
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3 text-center">
                <p className="font-mono text-lg font-bold text-white tabular-nums">{fmtDuration(worked)}</p>
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Worked</p>
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3 text-center">
                <p className="font-mono text-lg font-bold tabular-nums" style={{ color: '#fbbf24' }}>{fmtDuration(brk)}</p>
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Breaks</p>
              </div>
            </div>
          )}

          {/* Location indicator */}
          {session?.clockInLocation && (
            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
              <span className="truncate text-xs text-slate-400">
                {session.clockInLocation.lat.toFixed(5)}, {session.clockInLocation.lng.toFixed(5)}
                <span className="ml-1 text-slate-600">±{Math.round(session.clockInLocation.accuracy)}m</span>
              </span>
            </div>
          )}
        </div>

        {/* Toast messages */}
        {successMsg && (
          <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {successMsg}
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2.5 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Action buttons */}
        {!isPreview && (
          <div className="space-y-3">
            {status === 'clocked_out' && (
              <ActionButton
                label="Clock In"
                icon={<LogIn className="h-5 w-5" />}
                color="#34d399"
                loading={loading}
                onClick={() => run(() => clockIn(techId, techName), 'clock-in', 'Clocked in successfully!')}
              />
            )}

            {status === 'clocked_in' && (
              <>
                <ActionButton
                  label="Start Break"
                  icon={<Coffee className="h-5 w-5" />}
                  color="#fbbf24"
                  loading={loading}
                  onClick={() => run(() => startBreak(techId), 'break/start', 'Break started.')}
                />
                <ActionButton
                  label="Clock Out"
                  icon={<LogOut className="h-5 w-5" />}
                  color="#f87171"
                  loading={loading}
                  onClick={() => run(() => clockOut(techId), 'clock-out', 'Clocked out. Great work!')}
                />
              </>
            )}

            {status === 'on_break' && (
              <>
                <ActionButton
                  label="End Break"
                  icon={<Coffee className="h-5 w-5" />}
                  color="#34d399"
                  loading={loading}
                  onClick={() => run(() => endBreak(techId), 'break/end', 'Break ended. Back to work!')}
                />
                <ActionButton
                  label="Clock Out"
                  icon={<LogOut className="h-5 w-5" />}
                  color="#f87171"
                  loading={loading}
                  onClick={() => run(() => clockOut(techId), 'clock-out', 'Clocked out. Great work!')}
                />
              </>
            )}
          </div>
        )}

        {/* Today's events log */}
        {session && session.events.length > 0 && (
          <div className="rounded-[24px] border border-white/[0.07] bg-[#0d1829] overflow-hidden">
            <button
              className="flex w-full items-center justify-between px-4 py-3.5"
              onClick={() => setShowHistory(v => !v)}
            >
              <span className="text-sm font-semibold text-white">Today's Events</span>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-xs font-semibold text-slate-400">
                  {session.events.length}
                </span>
                {showHistory ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
              </div>
            </button>
            {showHistory && (
              <div className="border-t border-white/[0.06] divide-y divide-white/[0.04]">
                {session.events.map((ev, i) => (
                  <div key={ev.id} className="flex items-start gap-3 px-4 py-3" style={{ animation: `slide-in-right 0.3s ease both`, animationDelay: `${i * 40}ms` }}>
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: eventColor(ev.kind) + '22', border: `1px solid ${eventColor(ev.kind)}44` }}>
                      {eventIcon(ev.kind)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-200">{eventLabel(ev.kind)}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(ev.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}
                        {ev.location && <span className="ml-2 text-slate-600">·  GPS locked</span>}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Previous sessions today */}
        {todayHistory.filter(s => s.id !== session?.id && s.status === 'clocked_out').length > 0 && (
          <div className="rounded-[24px] border border-white/[0.07] bg-[#0d1829] p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Earlier Today</p>
            <div className="space-y-2">
              {todayHistory
                .filter(s => s.id !== session?.id && s.status === 'clocked_out')
                .map(s => (
                  <div key={s.id} className="flex items-center justify-between rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
                    <div>
                      <p className="text-xs font-medium text-slate-300">
                        {new Date(s.clockedInAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        {' – '}
                        {s.clockedOutAt
                          ? new Date(s.clockedOutAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                          : '—'}
                      </p>
                    </div>
                    <p className="font-mono text-xs font-semibold text-emerald-400">{fmtDuration(workedMs(s))}</p>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      <TechnicianBottomNav activeTab="attendance" routeBase={routeBase} />
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ActionButton({
  label,
  icon,
  color,
  loading,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  color: string;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      disabled={loading}
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-center gap-3 rounded-[20px] px-6 py-4 text-base font-bold transition-all duration-200 active:scale-[0.97]',
        'disabled:opacity-50 disabled:cursor-not-allowed',
      )}
      style={{
        backgroundColor: color + '22',
        border: `1.5px solid ${color}55`,
        color,
        boxShadow: `0 8px 24px ${color}22`,
      }}
    >
      {loading ? (
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : icon}
      {label}
    </button>
  );
}

// ─── Event helpers ────────────────────────────────────────────────────────────

function eventColor(kind: AttendanceEventKind): string {
  if (kind === 'clock_in') return '#34d399';
  if (kind === 'clock_out') return '#f87171';
  if (kind === 'break_start') return '#fbbf24';
  return '#34d399';
}

function statusToAvailability(status: AttendanceStatus): string {
  if (status === 'clocked_in') return 'Available';
  if (status === 'on_break') return 'Break';
  return 'Offline';
}

function fromBackendSession(session: BackendAttendanceSession, technicianName: string): AttendanceSession {
  const events = session.events.map(event => ({
    id: event.id,
    kind: event.event_type as AttendanceEventKind,
    timestamp: event.occurred_at,
    location: event.latitude != null && event.longitude != null
      ? { lat: event.latitude, lng: event.longitude, accuracy: event.accuracy ?? 0 }
      : null,
    device: event.device_log_id ? 'Logged device' : 'Browser',
  }));
  const breaks: AttendanceSession['breaks'] = [];
  let openBreak: AttendanceSession['breaks'][number] | null = null;
  events.forEach((event) => {
    if (event.kind === 'break_start') {
      openBreak = { startedAt: event.timestamp, endedAt: null };
      breaks.push(openBreak);
    }
    if (event.kind === 'break_end' && openBreak) {
      openBreak.endedAt = event.timestamp;
      openBreak = null;
    }
  });
  const clockInEvent = events.find(event => event.kind === 'clock_in');
  const clockOutEvent = [...events].reverse().find(event => event.kind === 'clock_out');
  return {
    id: session.id,
    technicianId: session.technician_id,
    technicianName,
    date: session.clock_in_at.slice(0, 10),
    clockedInAt: session.clock_in_at,
    clockedOutAt: session.clock_out_at ?? null,
    status: session.status as AttendanceStatus,
    breaks,
    events,
    clockInLocation: clockInEvent?.location ?? null,
    clockOutLocation: clockOutEvent?.location ?? null,
  };
}

function eventLabel(kind: AttendanceEventKind): string {
  if (kind === 'clock_in') return 'Clocked In';
  if (kind === 'clock_out') return 'Clocked Out';
  if (kind === 'break_start') return 'Break Started';
  return 'Break Ended';
}

function eventIcon(kind: AttendanceEventKind) {
  const color = eventColor(kind);
  if (kind === 'clock_in') return <LogIn className="h-3.5 w-3.5" style={{ color }} />;
  if (kind === 'clock_out') return <LogOut className="h-3.5 w-3.5" style={{ color }} />;
  return <Coffee className="h-3.5 w-3.5" style={{ color }} />;
}

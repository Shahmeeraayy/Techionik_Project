import { safeGetItem, safeSetItem } from '@/lib/storage';

// ─── Types ───────────────────────────────────────────────────────────────────

export type AttendanceStatus = 'clocked_out' | 'clocked_in' | 'on_break';

export type GpsCoords = {
  lat: number;
  lng: number;
  accuracy: number;
};

export type AttendanceEventKind =
  | 'clock_in'
  | 'clock_out'
  | 'break_start'
  | 'break_end';

export type AttendanceEvent = {
  id: string;
  kind: AttendanceEventKind;
  timestamp: string; // ISO
  location: GpsCoords | null;
  device: string;
  note?: string;
};

export type BreakSegment = {
  startedAt: string; // ISO
  endedAt: string | null; // ISO, null while ongoing
};

export type AttendanceSession = {
  id: string;
  technicianId: string;
  technicianName: string;
  date: string; // YYYY-MM-DD local
  clockedInAt: string; // ISO
  clockedOutAt: string | null; // ISO, null while still in
  status: AttendanceStatus;
  breaks: BreakSegment[];
  events: AttendanceEvent[];
  clockInLocation: GpsCoords | null;
  clockOutLocation: GpsCoords | null;
};

export type AttendanceState = {
  sessions: AttendanceSession[];
  activeSessionId: string | null;
};

// ─── Storage keys ────────────────────────────────────────────────────────────

const STORAGE_KEY_PREFIX = 'nexusops_attendance_';

function keyFor(technicianId: string) {
  return `${STORAGE_KEY_PREFIX}${technicianId}`;
}

// ─── Persistence helpers ─────────────────────────────────────────────────────

export function loadAttendanceState(technicianId: string): AttendanceState {
  const raw = safeGetItem(keyFor(technicianId));
  if (!raw) return { sessions: [], activeSessionId: null };
  try {
    return JSON.parse(raw) as AttendanceState;
  } catch {
    return { sessions: [], activeSessionId: null };
  }
}

function persist(technicianId: string, state: AttendanceState) {
  safeSetItem(keyFor(technicianId), JSON.stringify(state));
}

// ─── GPS ─────────────────────────────────────────────────────────────────────

export function captureGps(): Promise<GpsCoords | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    );
  });
}

// ─── Device fingerprint ───────────────────────────────────────────────────────

function deviceLabel(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return 'Android';
  if (/Windows/.test(ua)) return 'Windows PC';
  if (/Mac/.test(ua)) return 'Mac';
  return 'Browser';
}

// ─── Unique ID ────────────────────────────────────────────────────────────────

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Today helper ─────────────────────────────────────────────────────────────

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ─── Actions ─────────────────────────────────────────────────────────────────

export async function clockIn(
  technicianId: string,
  technicianName: string,
): Promise<AttendanceSession> {
  const state = loadAttendanceState(technicianId);
  if (state.activeSessionId) throw new Error('Already clocked in.');

  const location = await captureGps();
  const now = new Date().toISOString();
  const event: AttendanceEvent = {
    id: uid(), kind: 'clock_in', timestamp: now, location, device: deviceLabel(),
  };

  const session: AttendanceSession = {
    id: uid(),
    technicianId,
    technicianName,
    date: todayLocal(),
    clockedInAt: now,
    clockedOutAt: null,
    status: 'clocked_in',
    breaks: [],
    events: [event],
    clockInLocation: location,
    clockOutLocation: null,
  };

  state.sessions.push(session);
  state.activeSessionId = session.id;
  persist(technicianId, state);
  return session;
}

export async function clockOut(technicianId: string): Promise<AttendanceSession> {
  const state = loadAttendanceState(technicianId);
  const session = state.sessions.find(s => s.id === state.activeSessionId);
  if (!session) throw new Error('No active session.');
  if (session.status === 'on_break') {
    await endBreak(technicianId);
    // reload after break end
    const updated = loadAttendanceState(technicianId);
    const s = updated.sessions.find(s => s.id === updated.activeSessionId)!;
    Object.assign(session, s);
  }

  const location = await captureGps();
  const now = new Date().toISOString();
  const event: AttendanceEvent = {
    id: uid(), kind: 'clock_out', timestamp: now, location, device: deviceLabel(),
  };

  session.status = 'clocked_out';
  session.clockedOutAt = now;
  session.clockOutLocation = location;
  session.events.push(event);
  state.activeSessionId = null;

  persist(technicianId, state);
  return session;
}

export async function startBreak(technicianId: string): Promise<AttendanceSession> {
  const state = loadAttendanceState(technicianId);
  const session = state.sessions.find(s => s.id === state.activeSessionId);
  if (!session) throw new Error('No active session.');
  if (session.status !== 'clocked_in') throw new Error('Must be clocked in to start a break.');

  const location = await captureGps();
  const now = new Date().toISOString();
  const event: AttendanceEvent = {
    id: uid(), kind: 'break_start', timestamp: now, location, device: deviceLabel(),
  };

  session.status = 'on_break';
  session.breaks.push({ startedAt: now, endedAt: null });
  session.events.push(event);

  persist(technicianId, state);
  return session;
}

export async function endBreak(technicianId: string): Promise<AttendanceSession> {
  const state = loadAttendanceState(technicianId);
  const session = state.sessions.find(s => s.id === state.activeSessionId);
  if (!session) throw new Error('No active session.');
  if (session.status !== 'on_break') throw new Error('Not currently on break.');

  const location = await captureGps();
  const now = new Date().toISOString();
  const event: AttendanceEvent = {
    id: uid(), kind: 'break_end', timestamp: now, location, device: deviceLabel(),
  };

  const ongoingBreak = session.breaks.find(b => b.endedAt === null);
  if (ongoingBreak) ongoingBreak.endedAt = now;
  session.status = 'clocked_in';
  session.events.push(event);

  persist(technicianId, state);
  return session;
}

// ─── Derived computations ─────────────────────────────────────────────────────

export function activeSession(technicianId: string): AttendanceSession | null {
  const state = loadAttendanceState(technicianId);
  if (!state.activeSessionId) return null;
  return state.sessions.find(s => s.id === state.activeSessionId) ?? null;
}

export function todaySessions(technicianId: string): AttendanceSession[] {
  const state = loadAttendanceState(technicianId);
  const today = todayLocal();
  return state.sessions.filter(s => s.date === today);
}

export function allSessions(technicianId: string): AttendanceSession[] {
  return loadAttendanceState(technicianId).sessions;
}

// Total worked ms for a session (excluding breaks)
export function workedMs(session: AttendanceSession, now = Date.now()): number {
  const end = session.clockedOutAt ? new Date(session.clockedOutAt).getTime() : now;
  const total = end - new Date(session.clockedInAt).getTime();
  const breakMs = session.breaks.reduce((acc, b) => {
    const bEnd = b.endedAt ? new Date(b.endedAt).getTime() : now;
    return acc + (bEnd - new Date(b.startedAt).getTime());
  }, 0);
  return Math.max(0, total - breakMs);
}

// Total break ms for a session
export function breakMs(session: AttendanceSession, now = Date.now()): number {
  return session.breaks.reduce((acc, b) => {
    const bEnd = b.endedAt ? new Date(b.endedAt).getTime() : now;
    return acc + (bEnd - new Date(b.startedAt).getTime());
  }, 0);
}

// Format ms as hh:mm:ss
export function fmtDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ─── Admin-side: load all attendance data for a given tenant ─────────────────
// In production this would be a backend API call. For V1, we query from each
// technician's localStorage key — this only works if accessed on the same device
// or synced via backend. The store intentionally exposes a type-compatible
// interface so the backend can slot in as a drop-in replacement.

export type AdminAttendanceRecord = {
  technicianId: string;
  technicianName: string;
  session: AttendanceSession | null; // null = no session today
  status: AttendanceStatus | 'not_clocked_in';
  workedToday: number; // ms
  breakToday: number; // ms
  lastSeen: string | null; // ISO timestamp of last event
};

export function buildAdminRecords(
  technicians: Array<{ id: string; name: string }>,
): AdminAttendanceRecord[] {
  const now = Date.now();
  return technicians.map((tech) => {
    const sessions = todaySessions(tech.id);
    const active = sessions.find(s => s.status !== 'clocked_out') ?? null;
    const latestClosed = sessions.filter(s => s.status === 'clocked_out').at(-1) ?? null;
    const session = active ?? latestClosed;

    const totalWorked = sessions.reduce((acc, s) => acc + workedMs(s, now), 0);
    const totalBreak = sessions.reduce((acc, s) => acc + breakMs(s, now), 0);

    const lastEvent = session?.events.at(-1);

    return {
      technicianId: tech.id,
      technicianName: tech.name,
      session,
      status: active ? active.status : 'not_clocked_in',
      workedToday: totalWorked,
      breakToday: totalBreak,
      lastSeen: lastEvent?.timestamp ?? null,
    };
  });
}

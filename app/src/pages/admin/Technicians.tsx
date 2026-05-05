import { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Search,
    RefreshCw,
    Plus,
    MoreVertical,
    Clock,
    Calendar,
    MapPin,
    Shield,
    Briefcase,
    X,
    User,
    FileDown,
    Mail,
    ArrowUpRight,
    Route,
    Tag,
    UserCog,
    Loader2,
    Phone,
    Activity,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { exportArrayData, selectColumnsForExport, type ExportFormat } from '@/lib/export';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetFooter,
} from '@/components/ui/sheet';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ColumnExportDialog from '@/components/modals/ColumnExportDialog';
import {
    formatPhoneForDisplay,
    formatUsPhoneInput,
    getPhoneSearchToken,
    phoneExampleFormat,
    toUsPhoneFormat,
} from '@/lib/phone';
import { useAuth, type TechnicianAccountSummary } from '@/contexts/AuthContext';
import {
    assignAdminTechnicianSkill,
    assignAdminTechnicianZone,
    createAdminTechnicianSkillCatalogEntry,
    createAdminTechnicianTimeOff,
    createAdminTechnicianZoneCatalogEntry,
    deleteAdminTechnicianTimeOff,
    fetchAdminTechnicianJobsFeed,
    fetchAdminTechnicianProfile,
    fetchAdminTechnicianSkillCatalog,
    fetchAdminTechnicianTimeOff,
    fetchAdminTechnicianZoneCatalog,
    fetchAdminTechnicians,
    getStoredAdminToken,
    removeAdminTechnicianSkill,
    removeAdminTechnicianZone,
    updateAdminTechnicianWeeklySchedule,
    type BackendTechnicianCatalogEntry,
    type BackendTechnicianJobFeedItem,
    type BackendTechnicianListItem,
    type BackendTechnicianProfile,
} from '@/lib/backend-api';

// --- Types ---

interface TimeOff {
    id: string;
    start: string;
    end: string;
    reason: string;
}

interface WorkingHours {
    day: string; // 'Mon', 'Tue', etc.
    start: string;
    end: string;
    is_closed: boolean;
}

interface Technician {
    id: string;
    name: string;
    full_name?: string;
    tech_code: string; // Unique
    email: string;
    phone: string;
    profile_picture_url?: string;
    status: 'active' | 'deactivated';
    manual_availability: boolean;
    effective_availability: boolean;
    on_leave_now: boolean;
    has_pending_email_change_request?: boolean;
    pending_email_change_requested_email?: string;
    zones: string[];
    zone_records: Array<{ id: string; name: string }>;
    skills: string[];
    skill_records: Array<{ id: string; name: string }>;
    working_hours: WorkingHours[];
    time_off: TimeOff[];
    current_jobs_count: number;
    current_assignments: { id: string; job_code: string; status: string; scheduled_at?: string; dealership_name?: string; vehicle_summary?: string }[];
    allowed_actions: string[];
}

type OperationalStatus = 'available' | 'in_progress' | 'offline' | 'out_of_office';

interface PersistedAuditEvent {
    id: string;
    created_at: string;
    event_type: string;
    actor_type: 'WEB_APP';
    actor_name: string;
    summary: string;
    payload_json: Record<string, any>;
    severity: 'info' | 'warning' | 'critical';
}

const DEFAULT_ACCOUNT_ZONES = ['Unassigned'];
const DEFAULT_ACCOUNT_SKILLS = ['General Service'];
const DEFAULT_ACCOUNT_ACTIONS = ['view_profile', 'edit_tech', 'set_time_off', 'deactivate'];

const persistTechniciansToStorage = (_techs: Technician[]) => {
    // Intentionally no-op: technician data is sourced from backend only.
};

const appendAuditLog = (
    _event_type: string,
    _summary: string,
    _payload_json: Record<string, any>,
    _severity: 'info' | 'warning' | 'critical' = 'info'
) => {
    // Audit logging intentionally disabled.
};

// --- Mock Data ---

const REAL_HOURS_MON_THU = { start: '08:00', end: '17:00', is_closed: false };
const REAL_HOURS_FRI = { start: '08:00', end: '15:00', is_closed: false };
const REAL_HOURS_WEEKEND = { start: '00:00', end: '00:00', is_closed: true };
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

const getRealSchedule = () => [
    { day: 'Mon', ...REAL_HOURS_MON_THU },
    { day: 'Tue', ...REAL_HOURS_MON_THU },
    { day: 'Wed', ...REAL_HOURS_MON_THU },
    { day: 'Thu', ...REAL_HOURS_MON_THU },
    { day: 'Fri', ...REAL_HOURS_FRI },
    { day: 'Sat', ...REAL_HOURS_WEEKEND },
    { day: 'Sun', ...REAL_HOURS_WEEKEND },
];

const parseDateBoundary = (value: string, boundary: 'start' | 'end'): Date => {
    if (!value) return new Date('');
    if (value.includes('T')) return new Date(value);
    return new Date(`${value}T${boundary === 'start' ? '00:00:00' : '23:59:59'}`);
};

const formatDateForUi = (value: string): string => {
    const parsed = parseDateBoundary(value, 'start');
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString();
};

const cloneTech = (tech: Technician): Technician => JSON.parse(JSON.stringify(tech)) as Technician;

const formatTimeValue = (value?: string | null) => (value ? value.slice(0, 5) : '08:00');

const mapWeeklySchedule = (profile?: BackendTechnicianProfile | null): WorkingHours[] => {
    if (!profile?.weekly_schedule?.length) {
        return getRealSchedule();
    }

    return WEEKDAY_LABELS.slice(1)
        .concat(WEEKDAY_LABELS[0])
        .map((day, orderIndex) => {
            const dayOfWeek = (orderIndex + 1) % 7;
            const slot = profile.weekly_schedule.find((entry) => entry.day_of_week === dayOfWeek);
            return {
                day,
                start: formatTimeValue(slot?.start_time),
                end: formatTimeValue(slot?.end_time || slot?.start_time),
                is_closed: slot ? !slot.is_enabled : true,
            };
        });
};

const mapTimeOffEntries = (profile?: BackendTechnicianProfile | null): TimeOff[] => (
    profile?.upcoming_time_off?.map((entry) => ({
        id: entry.id,
        start: entry.start_date,
        end: entry.end_date,
        reason: entry.reason,
    })) ?? []
);

const getOperationalStatus = (tech: Pick<Technician, 'status' | 'manual_availability' | 'effective_availability' | 'on_leave_now' | 'current_jobs_count'>): OperationalStatus => {
    if (tech.on_leave_now) return 'out_of_office';
    if (tech.current_jobs_count > 0) return 'in_progress';
    if (tech.status !== 'active' || !tech.manual_availability || !tech.effective_availability) return 'offline';
    return 'available';
};

const getOperationalStatusLabel = (status: OperationalStatus) => {
    switch (status) {
        case 'available':
            return 'Available';
        case 'in_progress':
            return 'In Progress';
        case 'offline':
            return 'Offline';
        case 'out_of_office':
            return 'Out of Office';
        default:
            return status;
    }
};

const makeAccountTechCode = (accountId: string, usedCodes: Set<string>) => {
    const compact = accountId.replace(/[^a-z0-9]/gi, '').toUpperCase();
    const seed = compact.slice(-4) || '0001';
    let candidate = `ACC-${seed}`;
    let suffix = 1;

    while (usedCodes.has(candidate.toLowerCase())) {
        candidate = `ACC-${seed}-${suffix}`;
        suffix += 1;
    }

    usedCodes.add(candidate.toLowerCase());
    return candidate;
};

const mergeTechniciansWithAccounts = (
    source: Technician[],
    accounts: TechnicianAccountSummary[]
): Technician[] => {
    const byId = new Map<string, Technician>();
    source.forEach((tech) => {
        byId.set(tech.id, {
            ...tech,
            phone: formatPhoneForDisplay(tech.phone),
        });
    });

    const usedCodes = new Set(
        [...byId.values()]
            .map((tech) => tech.tech_code.trim().toLowerCase())
            .filter(Boolean)
    );

    accounts.forEach((account) => {
        const existing = byId.get(account.id);
        const techCode = existing?.tech_code?.trim()
            ? existing.tech_code
            : makeAccountTechCode(account.id, usedCodes);

        const next: Technician = {
            id: account.id,
            name: account.name,
            tech_code: techCode,
            email: account.email,
            phone: formatPhoneForDisplay(account.phone ?? existing?.phone ?? ''),
            status: account.isActive ? 'active' : 'deactivated',
            manual_availability: existing?.manual_availability ?? account.isActive,
            effective_availability: existing?.effective_availability ?? account.isActive,
            on_leave_now: existing?.on_leave_now ?? false,
            zones: existing?.zones?.length ? existing.zones : [...DEFAULT_ACCOUNT_ZONES],
            zone_records: existing?.zone_records ?? [],
            skills: existing?.skills?.length ? existing.skills : [...DEFAULT_ACCOUNT_SKILLS],
            skill_records: existing?.skill_records ?? [],
            working_hours: existing?.working_hours?.length ? existing.working_hours : getRealSchedule(),
            time_off: existing?.time_off ?? [],
            current_jobs_count: existing?.current_jobs_count ?? 0,
            current_assignments: existing?.current_assignments ?? [],
            allowed_actions: existing?.allowed_actions?.length ? existing.allowed_actions : [...DEFAULT_ACCOUNT_ACTIONS],
        };

        byId.set(account.id, next);
    });

    return [...byId.values()];
};

const mapBackendTechnician = (item: BackendTechnicianListItem, index: number): Technician => {
    return {
        id: item.id,
        name: item.full_name || item.name,
        full_name: item.full_name || item.name,
        tech_code: `T-${String(index + 1).padStart(2, '0')}`,
        email: item.email,
        phone: formatPhoneForDisplay(item.phone ?? ''),
        profile_picture_url: item.profile_picture_url ?? undefined,
        status: item.status === 'active' ? 'active' : 'deactivated',
        manual_availability: item.manual_availability,
        effective_availability: item.effective_availability,
        on_leave_now: item.on_leave_now,
        has_pending_email_change_request: item.has_pending_email_change_request ?? false,
        pending_email_change_requested_email: item.pending_email_change_requested_email ?? undefined,
        zones: item.zones.map((zone) => zone.name),
        zone_records: item.zones.map((zone) => ({ id: zone.id, name: zone.name })),
        skills: item.skills.map((skill) => skill.name),
        skill_records: item.skills.map((skill) => ({ id: skill.id, name: skill.name })),
        working_hours: getRealSchedule(),
        time_off: [],
        current_jobs_count: item.current_jobs_count,
        current_assignments: [],
        allowed_actions: [...DEFAULT_ACCOUNT_ACTIONS],
    };
};

// --- Components ---

function StatusBadge({ status }: { status: OperationalStatus }) {
    const label = getOperationalStatusLabel(status);
    const className = {
        available: 'border-emerald-300/20 bg-emerald-300/12 text-emerald-100',
        in_progress: 'border-amber-300/20 bg-amber-300/12 text-amber-100',
        offline: 'border-white/10 bg-white/[0.03] text-slate-300',
        out_of_office: 'border-violet-300/20 bg-violet-300/12 text-violet-100',
    }[status];

    return <Badge className={cn('shadow-none hover:bg-inherit', className)}>{label}</Badge>;
}

function ProfileStat({
    label,
    value,
    hint,
    valueClassName = 'text-white',
}: {
    label: string;
    value: string;
    hint?: string;
    valueClassName?: string;
}) {
    return (
        <div className="rounded-[18px] border border-white/10 bg-white/[0.03] p-3">
            <p className="text-[11px] uppercase tracking-wider text-slate-400">{label}</p>
            <p className={cn('mt-1 text-lg font-semibold leading-none', valueClassName)}>{value}</p>
            {hint ? <p className="mt-1 text-[11px] text-slate-500">{hint}</p> : null}
        </div>
    );
}

const TECHNICIAN_EXPORT_COLUMNS = [
    'Name',
    'Email',
    'Phone',
    'Zones',
    'Skills',
    'CurrentStatus',
    'ActiveJobs',
    'CurrentJob',
    'WorkingHours',
];

export default function TechniciansPage() {
    const navigate = useNavigate();
    const { technicianAccounts, hasBackendAdminToken } = useAuth();
    const [techs, setTechs] = useState<Technician[]>([]);
    const [loading, setLoading] = useState(true);
    const [detailLoading, setDetailLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterZone, setFilterZone] = useState<string>('all');
    const [filterSkill, setFilterSkill] = useState<string>('all');
    const [isBackendSynced, setIsBackendSynced] = useState(false);
    const [zoneCatalog, setZoneCatalog] = useState<BackendTechnicianCatalogEntry[]>([]);
    const [skillCatalog, setSkillCatalog] = useState<BackendTechnicianCatalogEntry[]>([]);
    const [techJobFeed, setTechJobFeed] = useState<BackendTechnicianJobFeedItem[]>([]);

    // Drawers & Modals
    const [selectedTech, setSelectedTech] = useState<Technician | null>(null);
    const [techDraft, setTechDraft] = useState<Technician | null>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [timeOffModalOpen, setTimeOffModalOpen] = useState(false);
    const [addTechModalOpen, setAddTechModalOpen] = useState(false);
    const [editTechModalOpen, setEditTechModalOpen] = useState(false);
    const [confirmDeactivateOpen, setConfirmDeactivateOpen] = useState(false);
    const [exportModalOpen, setExportModalOpen] = useState(false);

    // Form States (for creating new tech or time off)
    const [newTechForm, setNewTechForm] = useState({ name: '', code: '', phone: '', zones: '', skills: '' });
    const [editTechForm, setEditTechForm] = useState({ name: '', code: '', phone: '', zones: '', skills: '' });
    const [timeOffForm, setTimeOffForm] = useState({ start: '', end: '', reason: '' });
    const [newZoneInput, setNewZoneInput] = useState('');
    const [newSkillInput, setNewSkillInput] = useState('');

    // Initial Fetch
    const fetchTechs = useCallback(async () => {
        setLoading(true);
        const adminToken = getStoredAdminToken();

        if (hasBackendAdminToken && adminToken) {
            try {
                const [backendItems, zones, skills] = await Promise.all([
                    fetchAdminTechnicians(adminToken),
                    fetchAdminTechnicianZoneCatalog(adminToken).catch(() => []),
                    fetchAdminTechnicianSkillCatalog(adminToken).catch(() => []),
                ]);
                const mapped = backendItems.map(mapBackendTechnician);
                setTechs(mapped);
                setZoneCatalog(zones);
                setSkillCatalog(skills);
                setIsBackendSynced(true);
                setLoading(false);
                return;
            } catch {
                // Fall through to account snapshot source if backend call fails.
            }
        }

        const merged = mergeTechniciansWithAccounts([], technicianAccounts);
        setTechs(merged);
        setZoneCatalog([]);
        setSkillCatalog([]);
        setIsBackendSynced(false);
        setLoading(false);
    }, [hasBackendAdminToken, technicianAccounts]);

    useEffect(() => {
        void fetchTechs();
    }, [fetchTechs]);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return undefined;
        }

        const handleAdminRefresh = () => {
            void fetchTechs();
        };

        window.addEventListener('sm-dispatch:admin-refresh', handleAdminRefresh);
        return () => {
            window.removeEventListener('sm-dispatch:admin-refresh', handleAdminRefresh);
        };
    }, [fetchTechs]);

    useEffect(() => {
        if (isBackendSynced) {
            return;
        }
        setTechs((prev) => {
            const merged = mergeTechniciansWithAccounts(prev, technicianAccounts);
            if (JSON.stringify(merged) === JSON.stringify(prev)) {
                return prev;
            }
            return merged;
        });
    }, [isBackendSynced, technicianAccounts]);

    const zoneFilterOptions = Array.from(
        new Set(
            techs
                .flatMap((tech) => tech.zones)
                .map((zone) => zone.trim())
                .filter((zone) => zone.length > 0),
        ),
    ).sort((a, b) => a.localeCompare(b));

    const skillFilterOptions = Array.from(
        new Set(
            techs
                .flatMap((tech) => tech.skills)
                .map((skill) => skill.trim())
                .filter((skill) => skill.length > 0),
        ),
    ).sort((a, b) => a.localeCompare(b));

    // Filter Logic
    const filteredTechs = techs.filter(tech => {
        const query = searchQuery.toLowerCase();
        const queryPhoneToken = getPhoneSearchToken(searchQuery);
        const matchesSearch =
            tech.name.toLowerCase().includes(query) ||
            tech.email.toLowerCase().includes(query) ||
            tech.tech_code.toLowerCase().includes(query) ||
            tech.zones.some((zone) => zone.toLowerCase().includes(query)) ||
            tech.phone.includes(searchQuery) ||
            (queryPhoneToken.length > 0 && getPhoneSearchToken(tech.phone).includes(queryPhoneToken));
        const matchesStatus = filterStatus === 'all' || getOperationalStatus(tech) === filterStatus;
        const matchesZone =
            filterZone === 'all' ||
            tech.zones.some((zone) => zone.trim().toLowerCase() === filterZone.toLowerCase());
        const matchesSkill =
            filterSkill === 'all' ||
            tech.skills.some((skill) => skill.trim().toLowerCase() === filterSkill.toLowerCase());
        return matchesSearch && matchesStatus && matchesZone && matchesSkill;
    });
    const totalTechCount = techs.length;
    const availableTechCount = techs.filter((tech) => getOperationalStatus(tech) === 'available').length;
    const offlineTechCount = techs.filter((tech) => getOperationalStatus(tech) === 'offline').length;
    const outOfOfficeCount = techs.filter((tech) => getOperationalStatus(tech) === 'out_of_office').length;
    const assignedJobsCount = techs.reduce((sum, tech) => sum + tech.current_jobs_count, 0);
    const busyTechniciansCount = techs.filter((tech) => getOperationalStatus(tech) === 'in_progress').length;
    const hasActiveFilters =
        searchQuery.trim().length > 0
        || filterStatus !== 'all'
        || filterZone !== 'all'
        || filterSkill !== 'all';
    const clearFilters = () => {
        setSearchQuery('');
        setFilterStatus('all');
        setFilterZone('all');
        setFilterSkill('all');
    };

    // Handlers
    const hasDrawerChanges = useMemo(() => {
        if (!selectedTech || !techDraft) return false;
        return JSON.stringify({
            zones: selectedTech.zones,
            skills: selectedTech.skills,
            working_hours: selectedTech.working_hours,
            time_off: selectedTech.time_off,
        }) !== JSON.stringify({
            zones: techDraft.zones,
            skills: techDraft.skills,
            working_hours: techDraft.working_hours,
            time_off: techDraft.time_off,
        });
    }, [selectedTech, techDraft]);

    const profileSummary = useMemo(() => {
        if (!techDraft) {
            return null;
        }

        const openDaysCount = techDraft.working_hours.filter((row) => !row.is_closed).length;
        return {
            activeJobs: techDraft.current_jobs_count,
            zonesCount: techDraft.zones.length,
            skillsCount: techDraft.skills.length,
            openDaysCount,
            timeOffCount: techDraft.time_off.length,
        };
    }, [techDraft]);

    const updateDraft = (updater: (draft: Technician) => Technician) => {
        setTechDraft((prev) => (prev ? updater(prev) : prev));
    };

    const mergeProfileIntoTechnician = (tech: Technician, profile: BackendTechnicianProfile, jobsFeed?: BackendTechnicianJobFeedItem[]): Technician => ({
        ...tech,
        name: profile.full_name || profile.name,
        full_name: profile.full_name || profile.name,
        email: profile.email,
        phone: formatPhoneForDisplay(profile.phone ?? tech.phone ?? ''),
        profile_picture_url: profile.profile_picture_url ?? tech.profile_picture_url,
        status: profile.status,
        manual_availability: profile.manual_availability,
        effective_availability: profile.effective_availability,
        on_leave_now: profile.on_leave_now,
        has_pending_email_change_request: profile.has_pending_email_change_request ?? tech.has_pending_email_change_request,
        pending_email_change_requested_email: profile.pending_email_change_requested_email ?? tech.pending_email_change_requested_email,
        zones: profile.zones.map((zone) => zone.name),
        zone_records: profile.zones.map((zone) => ({ id: zone.id, name: zone.name })),
        skills: profile.skills.map((skill) => skill.name),
        skill_records: profile.skills.map((skill) => ({ id: skill.id, name: skill.name })),
        working_hours: mapWeeklySchedule(profile),
        time_off: mapTimeOffEntries(profile),
        current_jobs_count: jobsFeed ? jobsFeed.length : tech.current_jobs_count,
        current_assignments: jobsFeed
            ? jobsFeed.map((job) => ({
                id: job.id,
                job_code: job.job_code,
                status: job.status,
                scheduled_at: job.requested_service_date ?? undefined,
                dealership_name: job.dealership_name ?? undefined,
                vehicle_summary: job.vehicle_summary ?? undefined,
            }))
            : tech.current_assignments,
    });

    const handleOpenProfile = async (tech: Technician) => {
        const snapshot = cloneTech(tech);
        setSelectedTech(snapshot);
        setTechDraft(cloneTech(snapshot));
        setTechJobFeed(snapshot.current_assignments.map((job) => ({
            id: job.id,
            job_code: job.job_code,
            status: job.status,
            dealership_name: job.dealership_name ?? null,
            service_name: null,
            service_names: [],
            service_entries: [],
            vehicle_summary: job.vehicle_summary ?? null,
            zone_name: null,
            requested_service_date: job.scheduled_at ?? null,
            requested_service_time: null,
            created_at: job.scheduled_at ?? '',
            updated_at: job.scheduled_at ?? '',
        })));
        setNewZoneInput('');
        setNewSkillInput('');
        setTimeOffForm({ start: '', end: '', reason: '' });
        setDrawerOpen(true);

        const adminToken = getStoredAdminToken();
        if (!hasBackendAdminToken || !adminToken) {
            return;
        }

        try {
            setDetailLoading(true);
            const [profile, jobsFeed, timeOff] = await Promise.all([
                fetchAdminTechnicianProfile(adminToken, tech.id),
                fetchAdminTechnicianJobsFeed(adminToken, tech.id),
                fetchAdminTechnicianTimeOff(adminToken, tech.id).catch(() => []),
            ]);
            const merged = mergeProfileIntoTechnician(tech, {
                ...profile,
                upcoming_time_off: profile.upcoming_time_off?.length
                    ? profile.upcoming_time_off
                    : timeOff.map((entry) => ({
                        id: entry.id,
                        technician_id: tech.id,
                        entry_type: 'OUT_OF_OFFICE',
                        start_date: entry.start_date,
                        end_date: entry.end_date,
                        reason: entry.reason,
                        created_at: entry.created_at,
                        cancelled_at: null,
                    })),
            }, jobsFeed.my_jobs);
            setSelectedTech(cloneTech(merged));
            setTechDraft(cloneTech(merged));
            setTechJobFeed(jobsFeed.my_jobs);
            setTechs((prev) => prev.map((item) => (item.id === merged.id ? merged : item)));
        } finally {
            setDetailLoading(false);
        }
    };

    const handleCancelDrawerChanges = () => {
        if (!selectedTech) return;
        setTechDraft(cloneTech(selectedTech));
        setNewZoneInput('');
        setNewSkillInput('');
        setTimeOffForm({ start: '', end: '', reason: '' });
        setTimeOffModalOpen(false);
    };

    const handleSaveDrawerChanges = async () => {
        if (!selectedTech || !techDraft || !hasDrawerChanges) return;

        const beforeSnapshot = {
            zones: selectedTech.zones,
            skills: selectedTech.skills,
            working_hours: selectedTech.working_hours,
            time_off: selectedTech.time_off,
        };
        const afterSnapshot = {
            zones: techDraft.zones,
            skills: techDraft.skills,
            working_hours: techDraft.working_hours,
            time_off: techDraft.time_off,
        };

        const adminToken = getStoredAdminToken();
        const saved = cloneTech(techDraft);

        if (hasBackendAdminToken && adminToken) {
            const nextZones = techDraft.zone_records;
            const previousZoneIds = new Set(selectedTech.zone_records.map((entry) => entry.id));
            const nextZoneIds = new Set(nextZones.map((entry) => entry.id));
            const zonesToAdd = nextZones.filter((entry) => !previousZoneIds.has(entry.id));
            const zonesToRemove = selectedTech.zone_records.filter((entry) => !nextZoneIds.has(entry.id));

            const nextSkills = techDraft.skill_records;
            const previousSkillIds = new Set(selectedTech.skill_records.map((entry) => entry.id));
            const nextSkillIds = new Set(nextSkills.map((entry) => entry.id));
            const skillsToAdd = nextSkills.filter((entry) => !previousSkillIds.has(entry.id));
            const skillsToRemove = selectedTech.skill_records.filter((entry) => !nextSkillIds.has(entry.id));

            await Promise.all([
                ...zonesToAdd.map((entry) => assignAdminTechnicianZone(adminToken, selectedTech.id, entry.id)),
                ...zonesToRemove.map((entry) => removeAdminTechnicianZone(adminToken, selectedTech.id, entry.id)),
                ...skillsToAdd.map((entry) => assignAdminTechnicianSkill(adminToken, selectedTech.id, entry.id)),
                ...skillsToRemove.map((entry) => removeAdminTechnicianSkill(adminToken, selectedTech.id, entry.id)),
            ]);

            await updateAdminTechnicianWeeklySchedule(
                adminToken,
                selectedTech.id,
                techDraft.working_hours.map((entry, index) => ({
                    day_of_week: (index + 1) % 7,
                    is_enabled: !entry.is_closed,
                    start_time: entry.start,
                    end_time: entry.end,
                })),
            );

            const previousTimeOffIds = new Set(selectedTech.time_off.map((entry) => entry.id));
            const nextTimeOffIds = new Set(techDraft.time_off.map((entry) => entry.id));
            const createdTimeOff = techDraft.time_off.filter((entry) => !previousTimeOffIds.has(entry.id));
            const deletedTimeOff = selectedTech.time_off.filter((entry) => !nextTimeOffIds.has(entry.id));

            await Promise.all([
                ...createdTimeOff.map((entry) => createAdminTechnicianTimeOff(adminToken, selectedTech.id, {
                    start_date: entry.start,
                    end_date: entry.end,
                    reason: entry.reason,
                })),
                ...deletedTimeOff.map((entry) => deleteAdminTechnicianTimeOff(adminToken, selectedTech.id, entry.id)),
            ]);
        }

        setTechs(prev => {
            const next = prev.map(t => t.id === saved.id ? saved : t);
            persistTechniciansToStorage(next);
            return next;
        });
        setSelectedTech(saved);
        setTechDraft(cloneTech(saved));
        appendAuditLog(
            'technician.profile_updated',
            `Technician ${saved.name} profile updated`,
            {
                tech_id: saved.id,
                tech_code: saved.tech_code,
                before: beforeSnapshot,
                after: afterSnapshot,
            }
        );
    };

    const handleDrawerOpenChange = (open: boolean) => {
        if (!open && hasDrawerChanges) {
            const discard = window.confirm('Discard unsaved technician changes?');
            if (!discard) return;
        }

        setDrawerOpen(open);
        if (!open) {
            setSelectedTech(null);
            setTechDraft(null);
            setNewZoneInput('');
            setNewSkillInput('');
            setTimeOffForm({ start: '', end: '', reason: '' });
            setTimeOffModalOpen(false);
        }
    };

    const handleAddZone = async () => {
        if (!techDraft) return;
        const zone = newZoneInput.trim();
        if (!zone) return;

        if (techDraft.zones.some(z => z.toLowerCase() === zone.toLowerCase())) {
            alert('Zone already assigned.');
            return;
        }

        const adminToken = getStoredAdminToken();
        let zoneRecord = zoneCatalog.find((entry) => entry.name.trim().toLowerCase() === zone.toLowerCase());
        if (!zoneRecord && hasBackendAdminToken && adminToken) {
            zoneRecord = await createAdminTechnicianZoneCatalogEntry(adminToken, zone);
            setZoneCatalog((prev) => [...prev, zoneRecord as BackendTechnicianCatalogEntry]);
        }

        updateDraft((draft) => ({
            ...draft,
            zones: [...draft.zones, zone],
            zone_records: zoneRecord ? [...draft.zone_records, zoneRecord] : draft.zone_records,
        }));
        setNewZoneInput('');
    };

    const handleRemoveZone = (zone: string) => {
        if (!techDraft) return;
        if (techDraft.zones.length <= 1) {
            alert('Technician must have at least one zone.');
            return;
        }

        updateDraft((draft) => ({
            ...draft,
            zones: draft.zones.filter(z => z !== zone),
            zone_records: draft.zone_records.filter((entry) => entry.name !== zone),
        }));
    };

    const handleAddSkill = async () => {
        if (!techDraft) return;
        const skill = newSkillInput.trim();
        if (!skill) return;

        if (techDraft.skills.some(s => s.toLowerCase() === skill.toLowerCase())) {
            alert('Skill already assigned.');
            return;
        }

        const adminToken = getStoredAdminToken();
        let skillRecord = skillCatalog.find((entry) => entry.name.trim().toLowerCase() === skill.toLowerCase());
        if (!skillRecord && hasBackendAdminToken && adminToken) {
            skillRecord = await createAdminTechnicianSkillCatalogEntry(adminToken, skill);
            setSkillCatalog((prev) => [...prev, skillRecord as BackendTechnicianCatalogEntry]);
        }

        updateDraft((draft) => ({
            ...draft,
            skills: [...draft.skills, skill],
            skill_records: skillRecord ? [...draft.skill_records, skillRecord] : draft.skill_records,
        }));
        setNewSkillInput('');
    };

    const handleRemoveSkill = (skill: string) => {
        if (!techDraft) return;
        if (techDraft.skills.length <= 1) {
            alert('Technician must have at least one skill.');
            return;
        }

        updateDraft((draft) => ({
            ...draft,
            skills: draft.skills.filter(s => s !== skill),
            skill_records: draft.skill_records.filter((entry) => entry.name !== skill),
        }));
    };

    const handleWorkingHoursTimeChange = (index: number, field: 'start' | 'end', value: string) => {
        if (!techDraft || !value) return;

        updateDraft((draft) => ({
            ...draft,
            working_hours: draft.working_hours.map((wh, i) =>
                i === index ? { ...wh, [field]: value, is_closed: false } : wh
            ),
        }));
    };

    const handleToggleWorkingDay = (index: number, isOpen: boolean) => {
        if (!techDraft || !techDraft.working_hours[index]) return;

        updateDraft((draft) => ({
            ...draft,
            working_hours: draft.working_hours.map((wh, i) => {
                if (i !== index) return wh;
                if (!isOpen) return { ...wh, is_closed: true };
                return {
                    ...wh,
                    is_closed: false,
                    start: wh.start === '00:00' ? '08:00' : wh.start,
                    end: wh.end === '00:00' ? '17:00' : wh.end,
                };
            }),
        }));
    };

    const handleRemoveTimeOff = (timeOffId: string) => {
        if (!techDraft) return;

        updateDraft((draft) => {
            const nextTimeOff = draft.time_off.filter((entry) => entry.id !== timeOffId);
            return {
                ...draft,
                time_off: nextTimeOff,
            };
        });
    };

    const handleSaveTimeOff = () => {
        if (!techDraft) return;
        const start = timeOffForm.start.trim();
        const end = timeOffForm.end.trim();
        const reason = timeOffForm.reason.trim();

        if (!start || !end || !reason) {
            alert('Start date, end date, and reason are required.');
            return;
        }

        const startBoundary = parseDateBoundary(start, 'start');
        const endBoundary = parseDateBoundary(end, 'end');
        if (Number.isNaN(startBoundary.getTime()) || Number.isNaN(endBoundary.getTime())) {
            alert('Please select valid time off dates.');
            return;
        }
        if (startBoundary > endBoundary) {
            alert('End date must be on or after start date.');
            return;
        }

        const hasOverlap = techDraft.time_off.some((entry) => {
            const existingStart = parseDateBoundary(entry.start, 'start');
            const existingEnd = parseDateBoundary(entry.end, 'end');
            if (Number.isNaN(existingStart.getTime()) || Number.isNaN(existingEnd.getTime())) return false;
            return startBoundary <= existingEnd && endBoundary >= existingStart;
        });
        if (hasOverlap) {
            alert('Time off overlaps an existing entry.');
            return;
        }

        const newTimeOff: TimeOff = {
            id: `to-${Date.now()}`,
            start,
            end,
            reason
        };
        const now = new Date();
        const isCurrentWindow = startBoundary <= now && endBoundary >= now;

        updateDraft((draft) => ({
            ...draft,
            time_off: [...draft.time_off, newTimeOff],
            on_leave_now: isCurrentWindow ? true : draft.on_leave_now,
            effective_availability: isCurrentWindow ? false : draft.effective_availability,
        }));
        setTimeOffModalOpen(false);
        setTimeOffForm({ start: '', end: '', reason: '' });
    };

    const handleAddTech = () => {
        const name = newTechForm.name.trim();
        const code = newTechForm.code.trim();
        const phone = toUsPhoneFormat(newTechForm.phone);
        const zones = newTechForm.zones.split(',').map(s => s.trim()).filter(Boolean);
        const skills = newTechForm.skills.split(',').map(s => s.trim()).filter(Boolean);

        if (!name || !code || !phone) {
            alert("Name, tech code, and phone are required.");
            return;
        }
        if (phone !== newTechForm.phone.trim()) {
            alert(`Phone must be in this format: ${phoneExampleFormat}.`);
            return;
        }
        if (techs.some(t => t.tech_code.toLowerCase() === code.toLowerCase())) {
            alert("Tech code already exists.");
            return;
        }
        if (techs.some(t => toUsPhoneFormat(t.phone) === phone)) {
            alert("Phone already exists.");
            return;
        }

        const newTech: Technician = {
            id: `t-${Date.now()}`,
            name,
            tech_code: code,
            email: `${code.toLowerCase()}@pending.local`,
            phone,
            status: 'active',
            manual_availability: true,
            effective_availability: true,
            on_leave_now: false,
            zones,
            zone_records: zones.map((name) => ({ id: name, name })),
            skills,
            skill_records: skills.map((name) => ({ id: name, name })),
            working_hours: getRealSchedule(),
            time_off: [],
            current_jobs_count: 0,
            current_assignments: [],
            allowed_actions: ['view_profile', 'edit_tech', 'set_time_off', 'deactivate']
        };

        setTechs(prev => {
            const next = [...prev, newTech];
            persistTechniciansToStorage(next);
            return next;
        });
        appendAuditLog(
            'technician.created',
            `Technician ${newTech.name} (${newTech.tech_code}) created`,
            {
                tech_id: newTech.id,
                tech_code: newTech.tech_code,
                phone: newTech.phone,
                zones: newTech.zones,
                skills: newTech.skills
            }
        );
        setAddTechModalOpen(false);
        setNewTechForm({ name: '', code: '', phone: '', zones: '', skills: '' });

        // Open drawer for the new tech
        setTimeout(() => handleOpenProfile(newTech), 300);
    };

    const openEditTechModal = (tech: Technician) => {
        if (hasDrawerChanges) {
            alert('Save or cancel pending profile changes before opening full edit.');
            return;
        }
        setSelectedTech(tech);
        setEditTechForm({
            name: tech.name,
            code: tech.tech_code,
            phone: formatPhoneForDisplay(tech.phone),
            zones: tech.zones.join(', '),
            skills: tech.skills.join(', ')
        });
        setEditTechModalOpen(true);
    };

    const handleSaveTechEdit = () => {
        if (!selectedTech) return;

        const name = editTechForm.name.trim();
        const code = editTechForm.code.trim();
        const phone = toUsPhoneFormat(editTechForm.phone);
        const zones = editTechForm.zones.split(',').map(s => s.trim()).filter(Boolean);
        const skills = editTechForm.skills.split(',').map(s => s.trim()).filter(Boolean);

        if (!name || !code || !phone) {
            alert("Name, tech code, and phone are required.");
            return;
        }
        if (phone !== editTechForm.phone.trim()) {
            alert(`Phone must be in this format: ${phoneExampleFormat}.`);
            return;
        }
        if (techs.some(t => t.id !== selectedTech.id && t.tech_code.toLowerCase() === code.toLowerCase())) {
            alert("Tech code already exists.");
            return;
        }
        if (techs.some(t => t.id !== selectedTech.id && toUsPhoneFormat(t.phone) === phone)) {
            alert("Phone already exists.");
            return;
        }

        const updatedTech: Technician = {
            ...selectedTech,
            name,
            tech_code: code,
            phone,
            zones,
            zone_records: zones.map((name) => selectedTech.zone_records.find((entry) => entry.name === name) ?? { id: name, name }),
            skills,
            skill_records: skills.map((name) => selectedTech.skill_records.find((entry) => entry.name === name) ?? { id: name, name }),
        };

        setTechs(prev => {
            const next = prev.map(t => t.id === updatedTech.id ? updatedTech : t);
            persistTechniciansToStorage(next);
            return next;
        });
        setSelectedTech(updatedTech);
        setTechDraft(cloneTech(updatedTech));
        appendAuditLog(
            'technician.updated',
            `Technician ${updatedTech.name} (${updatedTech.tech_code}) updated`,
            {
                tech_id: updatedTech.id,
                tech_code: updatedTech.tech_code,
                phone: updatedTech.phone,
                zones: updatedTech.zones,
                skills: updatedTech.skills
            }
        );
        setEditTechModalOpen(false);
    };

    const handleToggleStatus = () => {
        if (!selectedTech) return;
        if (hasDrawerChanges) {
            alert('Save or cancel pending profile changes before changing status.');
            return;
        }
        if (selectedTech.status === 'active') {
            // Check for active jobs
            if (selectedTech.current_jobs_count > 0) {
                alert("Cannot deactivate technician with active assigned jobs.");
                return;
            }
            // Open confirmation for deactivation
            setConfirmDeactivateOpen(true);
        } else {
            // Activate immediately
            const updated = { ...selectedTech, status: 'active' as const };
            setTechs(prev => {
                const next = prev.map(t => t.id === updated.id ? updated : t);
                persistTechniciansToStorage(next);
                return next;
            });
            setSelectedTech(updated);
            setTechDraft(cloneTech(updated));
            appendAuditLog(
                'technician.status_changed',
                `Technician ${updated.name} activated`,
                { tech_id: updated.id, tech_code: updated.tech_code, new_status: 'active' }
            );
        }
    };

    const confirmDeactivate = () => {
        if (!selectedTech) return;
        const updated = { ...selectedTech, status: 'deactivated' as const };
        setTechs(prev => {
            const next = prev.map(t => t.id === updated.id ? updated : t);
            persistTechniciansToStorage(next);
            return next;
        });
        setSelectedTech(updated);
        setTechDraft(cloneTech(updated));
        appendAuditLog(
            'technician.status_changed',
            `Technician ${updated.name} deactivated`,
            { tech_id: updated.id, tech_code: updated.tech_code, new_status: 'inactive' },
            'warning'
        );
        setConfirmDeactivateOpen(false);
    };

    const getTechnicianExportRows = () => techs.map(t => ({
            Name: t.name,
            Email: t.email,
            Phone: t.phone,
            Zones: t.zones.join('; '),
            Skills: t.skills.join('; '),
            CurrentStatus: getOperationalStatusLabel(getOperationalStatus(t)),
            ActiveJobs: t.current_jobs_count,
            CurrentJob: t.current_assignments[0]?.job_code ?? '',
            WorkingHours: JSON.stringify(t.working_hours) // Simplify for CSV
        }));

    const handleExport = (selectedColumns: string[], format: ExportFormat = 'csv') => {
        const exportData = selectColumnsForExport(getTechnicianExportRows(), selectedColumns);
        exportArrayData(exportData, 'technicians_export', format);
    };

    const sectionCardClass = 'overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,24,39,0.96),rgba(6,17,29,0.96))] shadow-[0_24px_80px_rgba(0,0,0,0.28)]';
    const sectionHeaderClass = 'border-b border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0))] p-6';

    return (
        <div className="relative w-full pb-10">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[380px] rounded-[34px] bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),rgba(34,211,238,0)_34%),radial-gradient(circle_at_top_right,rgba(52,211,153,0.08),rgba(52,211,153,0)_30%)]" />
            <div className="pointer-events-none absolute left-8 top-8 h-40 w-40 rounded-full bg-cyan-400/8 blur-3xl" />
            <div className="pointer-events-none absolute right-10 top-20 h-48 w-48 rounded-full bg-emerald-400/8 blur-3xl" />

            <div className="relative space-y-6">

            {/* 1. Header */}
            <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(7,25,42,0.98),rgba(6,18,32,0.98))] shadow-[0_34px_120px_rgba(0,0,0,0.34)]">
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:120px_120px] opacity-20" />
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/70 to-transparent" />
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(47,142,146,0.14),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.12),transparent_26%)]" />
                <div className="relative flex flex-col gap-5 p-6 xl:flex-row xl:items-end xl:justify-between xl:p-8">
                    <div className="max-w-3xl">
                        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-100">
                            <User className="h-3.5 w-3.5" />
                            Field Workforce
                        </div>
                        <h1 className="mt-5 text-[2.35rem] font-semibold leading-none tracking-[-0.06em] text-white md:text-[2.8rem]">
                            Technicians
                            <span className="block bg-gradient-to-r from-white via-cyan-100 to-emerald-100 bg-clip-text text-transparent">
                                workforce board
                            </span>
                        </h1>
                        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-[15px]">
                            Manage technician profiles, schedules, zones, skills, and availability across the active dispatch network.
                        </p>
                        <div className="mt-5 flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-cyan-100">
                                {totalTechCount} technicians
                            </Badge>
                            <Badge variant="outline" className="border-amber-300/20 bg-amber-300/10 px-3 py-1 text-amber-100">
                                {busyTechniciansCount} busy now
                            </Badge>
                            <Badge variant="outline" className="border-white/10 bg-white/[0.04] px-3 py-1 text-slate-300">
                                {zoneFilterOptions.length} zones
                            </Badge>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-3">
                    <Button variant="outline" size="sm" onClick={() => void fetchTechs()} className="h-10 gap-2 rounded-full border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]" disabled={loading}>
                        <RefreshCw className={cn('w-4 h-4 text-cyan-200', loading && 'animate-spin')} /> Refresh
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setExportModalOpen(true)} className="h-10 gap-2 rounded-full border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]">
                        <FileDown className="w-4 h-4" /> Export
                    </Button>
                    <Dialog open={addTechModalOpen} onOpenChange={setAddTechModalOpen}>
                        <DialogTrigger asChild>
                            <Button size="sm" className="h-10 gap-2 rounded-full bg-[#2F8E92] px-5 text-white shadow-[0_12px_30px_rgba(47,142,146,0.28)] hover:bg-[#267276]">
                                <Plus className="w-4 h-4" /> Add Technician
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="border-white/10 bg-[linear-gradient(180deg,rgba(9,24,39,0.98),rgba(6,17,29,0.98))] text-slate-100">
                            <DialogHeader>
                                <DialogTitle className="text-white">Add New Technician</DialogTitle>
                                <DialogDescription className="text-slate-300">Create a new technician profile. They will start as active.</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-2">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-slate-200">Full Name</Label>
                                        <Input className="border-white/10 bg-white/[0.04] text-white placeholder:text-slate-500" placeholder="e.g. John Doe" value={newTechForm.name} onChange={e => setNewTechForm({ ...newTechForm, name: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-slate-200">Tech Code</Label>
                                        <Input className="border-white/10 bg-white/[0.04] text-white placeholder:text-slate-500" placeholder="e.g. TECH-999" value={newTechForm.code} onChange={e => setNewTechForm({ ...newTechForm, code: e.target.value })} />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-slate-200">Phone</Label>
                                    <Input
                                        className="border-white/10 bg-white/[0.04] text-white placeholder:text-slate-500"
                                        placeholder={phoneExampleFormat}
                                        value={newTechForm.phone}
                                        onChange={e => setNewTechForm({ ...newTechForm, phone: formatUsPhoneInput(e.target.value) })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-slate-200">Default Zones (comma separated)</Label>
                                    <Input className="border-white/10 bg-white/[0.04] text-white placeholder:text-slate-500" placeholder="North, Downtown" value={newTechForm.zones} onChange={e => setNewTechForm({ ...newTechForm, zones: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-slate-200">Default Skills (comma separated)</Label>
                                    <Input className="border-white/10 bg-white/[0.04] text-white placeholder:text-slate-500" placeholder="Locksmith, Towing" value={newTechForm.skills} onChange={e => setNewTechForm({ ...newTechForm, skills: e.target.value })} />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" className="border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]" onClick={() => setAddTechModalOpen(false)}>Cancel</Button>
                                <Button onClick={handleAddTech} className="bg-[#2F8E92] hover:bg-[#267276]">Create Technician</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                    </div>
                </div>
            </section>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Card className="overflow-hidden rounded-[24px] border border-cyan-400/15 bg-[linear-gradient(180deg,rgba(12,36,55,0.96),rgba(8,24,39,0.96))] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    <div className="p-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Total Technicians</p>
                        <p className="mt-3 text-[2.15rem] font-semibold leading-none tracking-[-0.06em] text-white">{totalTechCount}</p>
                        <p className="mt-2 text-sm text-slate-300">Visible workforce profiles</p>
                    </div>
                </Card>
                <Card className="overflow-hidden rounded-[24px] border border-emerald-400/15 bg-[linear-gradient(180deg,rgba(10,37,45,0.96),rgba(7,25,31,0.96))] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    <div className="p-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Available</p>
                        <p className="mt-3 text-[2.15rem] font-semibold leading-none tracking-[-0.06em] text-white">{availableTechCount}</p>
                        <p className="mt-2 text-sm text-slate-300">Ready for dispatch right now</p>
                    </div>
                </Card>
                <Card className="overflow-hidden rounded-[24px] border border-violet-400/15 bg-[linear-gradient(180deg,rgba(30,23,49,0.96),rgba(18,16,33,0.96))] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    <div className="p-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Out of Office</p>
                        <p className="mt-3 text-[2.15rem] font-semibold leading-none tracking-[-0.06em] text-white">{outOfOfficeCount}</p>
                        <p className="mt-2 text-sm text-slate-300">Temporarily removed from dispatch</p>
                    </div>
                </Card>
                <Card className="overflow-hidden rounded-[24px] border border-amber-400/15 bg-[linear-gradient(180deg,rgba(41,28,15,0.94),rgba(27,18,10,0.96))] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    <div className="p-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">In Progress / Offline</p>
                        <p className="mt-3 text-[2.15rem] font-semibold leading-none tracking-[-0.06em] text-white">{busyTechniciansCount} / {offlineTechCount}</p>
                        <p className="mt-2 text-sm text-slate-300">{assignedJobsCount} active jobs across the roster</p>
                    </div>
                </Card>
            </div>

            {/* 2. Filter Bar */}
            <Card className={sectionCardClass}>
                <div className={sectionHeaderClass}>
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                            <div>
                                <h2 className="text-base font-semibold text-white">Technician Filters</h2>
                                <p className="mt-1 text-sm text-slate-300">Search by name, email, or zone and narrow by readiness, coverage, and skill fit.</p>
                            </div>
                            <Badge variant="outline" className="w-fit border-white/10 bg-white/[0.03] text-slate-300">
                                Showing {filteredTechs.length} of {totalTechCount}
                            </Badge>
                        </div>
                        <div className="flex flex-col lg:flex-row gap-4 items-center">
                            <div className="relative flex-1 w-full lg:w-auto min-w-0 lg:min-w-[300px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <Input
                                    placeholder="Search by name, email, phone, or zone..."
                                    className="h-11 rounded-full border-white/10 bg-white/[0.04] pl-9 text-slate-100 placeholder:text-slate-500 focus:bg-white/[0.06] transition-all"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                                <Select value={filterStatus} onValueChange={setFilterStatus}>
                                    <SelectTrigger className="h-11 w-full sm:w-[140px] border-white/10 bg-white/[0.04] text-slate-100">
                                        <SelectValue placeholder="Status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Statuses</SelectItem>
                                        <SelectItem value="available">Available</SelectItem>
                                        <SelectItem value="in_progress">In Progress</SelectItem>
                                        <SelectItem value="offline">Offline</SelectItem>
                                        <SelectItem value="out_of_office">Out of Office</SelectItem>
                                    </SelectContent>
                                </Select>

                                <Select value={filterZone} onValueChange={setFilterZone}>
                                    <SelectTrigger className="h-11 w-full sm:w-[160px] border-white/10 bg-white/[0.04] text-slate-100">
                                        <div className="flex items-center gap-2">
                                            <MapPin className="w-4 h-4" />
                                            <SelectValue placeholder="Zone" />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Zone</SelectItem>
                                        {zoneFilterOptions.map((zone) => (
                                            <SelectItem key={zone} value={zone}>
                                                {zone}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <Select value={filterSkill} onValueChange={setFilterSkill}>
                                    <SelectTrigger className="h-11 w-full sm:w-[170px] border-white/10 bg-white/[0.04] text-slate-100">
                                        <div className="flex items-center gap-2">
                                            <Briefcase className="w-4 h-4" />
                                            <SelectValue placeholder="Skills" />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Skills</SelectItem>
                                        {skillFilterOptions.map((skill) => (
                                            <SelectItem key={skill} value={skill}>
                                                {skill}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                {hasActiveFilters ? (
                                    <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 px-2 text-slate-400 hover:text-slate-200">
                                        Clear Filters
                                    </Button>
                                ) : null}
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            {/* 3. Technicians Table */}
            <Card className={cn(sectionCardClass, 'flex-1 flex flex-col')}>
                {loading ? (
                    <div className="p-4 space-y-4">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <Skeleton key={i} className="h-12 w-full bg-white/10" />
                        ))}
                    </div>
                ) : filteredTechs.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400">
                        <div className="w-16 h-16 bg-white/[0.05] rounded-full flex items-center justify-center mb-4">
                            <User className="w-8 h-8 text-slate-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-white">No technicians found</h3>
                        <p className="text-sm mt-1">Try adjusting your filters or search query.</p>
                        <Button variant="outline" className="mt-4 border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]" onClick={clearFilters}>Clear Filters</Button>
                    </div>
                ) : (
                    <div className="overflow-hidden">
                        <div className="flex items-start justify-between gap-3 border-b border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0))] px-6 py-5">
                            <div className="space-y-2">
                                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Technician Board</div>
                                <div className="text-sm text-slate-200">Active workforce records with status, routing zones, and current dispatch readiness.</div>
                            </div>
                            <Badge variant="outline" className="rounded-full border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-300">
                                {filteredTechs.length} visible
                            </Badge>
                        </div>
                        <div className="overflow-auto">
                            <Table className="min-w-[1320px]">
                                <TableHeader className="sticky top-0 z-10 border-b border-white/10 bg-[linear-gradient(180deg,rgba(11,25,42,0.98),rgba(10,20,35,0.92))] backdrop-blur-xl">
                                    <TableRow className="border-white/0 hover:bg-transparent">
                                        <TableHead className="pl-6 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Technician Name</TableHead>
                                        <TableHead className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Email</TableHead>
                                        <TableHead className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Phone</TableHead>
                                        <TableHead className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Assigned Zones</TableHead>
                                        <TableHead className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Skill Tags</TableHead>
                                        <TableHead className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Current Status</TableHead>
                                        <TableHead className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Active Job Count</TableHead>
                                        <TableHead className="w-[64px] pr-6 text-right text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Open</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredTechs.map((tech, index) => (
                                        <TableRow
                                            key={tech.id}
                                            className={cn(
                                                'group cursor-pointer border-b border-white/6 transition-colors hover:bg-white/[0.045]',
                                                index % 2 === 1 && 'bg-white/[0.015]',
                                            )}
                                            onClick={() => handleOpenProfile(tech)}
                                        >
                                            <TableCell className="pl-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-300/18 bg-cyan-300/[0.08] text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-100">
                                                        {tech.name.substring(0, 2)}
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <div className="text-sm font-semibold tracking-[-0.03em] text-white transition-colors group-hover:text-cyan-100">
                                                            {tech.name}
                                                        </div>
                                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                                            <span className="font-mono">{tech.tech_code}</span>
                                                            <span>&bull;</span>
                                                            <span>{tech.current_assignments[0]?.job_code ?? 'No active assignment'}</span>
                                                        </div>
                                                        {tech.has_pending_email_change_request ? (
                                                            <Badge
                                                                variant="outline"
                                                                className="w-fit border-amber-300/20 bg-amber-300/10 px-2 py-0.5 text-[10px] text-amber-100"
                                                            >
                                                                Pending Email Change
                                                            </Badge>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-4">
                                                <div className="text-sm text-slate-200">{tech.email}</div>
                                            </TableCell>
                                            <TableCell className="py-4">
                                                <div className="text-sm text-slate-300">{formatPhoneForDisplay(tech.phone) || 'Not set'}</div>
                                            </TableCell>
                                            <TableCell className="py-4">
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    {tech.zones.slice(0, 2).map((zone) => (
                                                        <Badge key={zone} variant="secondary" className="h-5 border border-white/10 bg-white/[0.04] px-2 py-0 text-[10px] text-slate-300">
                                                            {zone}
                                                        </Badge>
                                                    ))}
                                                    {tech.zones.length > 2 ? <span className="text-[10px] text-slate-500">+{tech.zones.length - 2}</span> : null}
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-4">
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    {tech.skills.slice(0, 2).map((skill) => (
                                                        <Badge key={skill} variant="secondary" className="h-5 border border-cyan-300/20 bg-cyan-300/10 px-2 py-0 text-[10px] text-cyan-100">
                                                            {skill}
                                                        </Badge>
                                                    ))}
                                                    {tech.skills.length > 2 ? <span className="text-[10px] text-slate-500">+{tech.skills.length - 2}</span> : null}
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-4">
                                                <StatusBadge status={getOperationalStatus(tech)} />
                                            </TableCell>
                                            <TableCell className="py-4">
                                                <Badge
                                                    variant="outline"
                                                    className={cn(
                                                        'min-w-8 justify-center rounded-full px-2.5 py-1 text-[10px] shadow-none',
                                                        tech.current_jobs_count > 0
                                                            ? 'border-amber-300/20 bg-amber-300/10 text-amber-100'
                                                            : 'border-white/10 bg-white/[0.03] text-slate-400',
                                                    )}
                                                >
                                                    {tech.current_jobs_count}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="pr-6 text-right">
                                                <div onClick={(e) => e.stopPropagation()}>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl border border-white/10 bg-white/[0.03] text-slate-300 opacity-0 transition-all hover:bg-white/[0.08] hover:text-white group-hover:opacity-100">
                                                                <MoreVertical className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="border-white/10 bg-[#091827] text-slate-100">
                                                            <DropdownMenuItem onClick={() => handleOpenProfile(tech)}>View Profile</DropdownMenuItem>
                                                            {tech.current_assignments[0] ? (
                                                                <DropdownMenuItem onClick={() => navigate(`/admin/jobs/${tech.current_assignments[0].id}`)}>
                                                                    View Current Job
                                                                </DropdownMenuItem>
                                                            ) : null}
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem onClick={() => navigate('/admin/technician-accounts')}>
                                                                Open Technician Accounts
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                )}
            </Card>

            {/* 5. Technician Profile Drawer */}
            <Sheet open={drawerOpen} onOpenChange={handleDrawerOpenChange}>
                <SheetContent className="w-full sm:max-w-2xl lg:max-w-3xl p-0 flex flex-col gap-0 border-white/10 bg-[linear-gradient(180deg,rgba(7,21,37,0.99),rgba(4,13,24,1))] text-slate-100">
                    {selectedTech && techDraft && (
                        <>
                            <div className="bg-white/[0.03] border-b border-white/10 sticky top-0 z-10">
                                <div className="px-6 pt-5 pb-4 pr-14">
                                    <div className="flex flex-col gap-4">
                                        <div className="flex flex-col gap-1.5">
                                            <div className="flex items-center gap-2">
                                                <h2 className="text-xl font-bold text-white">{selectedTech.name}</h2>
                                                <StatusBadge status={getOperationalStatus(selectedTech)} />
                                            </div>
                                            <div className="flex items-center gap-2 text-sm text-slate-400">
                                                <span className="font-mono">{selectedTech.tech_code}</span>
                                                <span>|</span>
                                                <span>{selectedTech.email}</span>
                                                <span>|</span>
                                                <span>{formatPhoneForDisplay(selectedTech.phone) || 'No phone on file'}</span>
                                            </div>
                                            {selectedTech.has_pending_email_change_request ? (
                                                <div className="pt-0.5">
                                                    <Badge
                                                        variant="outline"
                                                        className="text-[10px] h-5 px-2 border-amber-300/20 bg-amber-300/10 text-amber-100"
                                                    >
                                                        Pending Email Change: {selectedTech.pending_email_change_requested_email || 'Review required'}
                                                    </Badge>
                                                </div>
                                            ) : null}
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setTimeOffModalOpen(true)}
                                                className="border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]"
                                            >
                                                Mark Out of Office
                                            </Button>
                                            {selectedTech.current_assignments[0] ? (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => navigate(`/admin/jobs/${selectedTech.current_assignments[0].id}`)}
                                                    className="border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]"
                                                >
                                                    View Current Job
                                                </Button>
                                            ) : null}
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => navigate('/admin/technician-accounts')}
                                                className="border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]"
                                            >
                                                Technician Accounts
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                disabled={!hasDrawerChanges}
                                                onClick={handleCancelDrawerChanges}
                                                className="border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]"
                                            >
                                                Cancel
                                            </Button>
                                            <Button
                                                size="sm"
                                                disabled={!hasDrawerChanges}
                                                className="bg-[#2F8E92] hover:bg-[#267276]"
                                                onClick={handleSaveDrawerChanges}
                                            >
                                                Save Changes
                                            </Button>
                                        </div>

                                        {profileSummary ? (
                                            <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
                                                <ProfileStat
                                                    label="Active Jobs"
                                                    value={String(profileSummary.activeJobs)}
                                                    valueClassName={profileSummary.activeJobs > 0 ? 'text-amber-100' : 'text-slate-100'}
                                                />
                                                <ProfileStat label="Zones" value={String(profileSummary.zonesCount)} />
                                                <ProfileStat label="Skills" value={String(profileSummary.skillsCount)} />
                                                <ProfileStat label="Open Days" value={String(profileSummary.openDaysCount)} hint="Per week" />
                                                <ProfileStat label="Time Off" value={String(profileSummary.timeOffCount)} hint="Upcoming entries" />
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 min-h-0 overflow-y-auto">
                                <div className="p-6 space-y-6">

                                    <Card className="p-4 border-white/10 bg-white/[0.03] shadow-none">
                                        <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-white">
                                            <Activity className="h-4 w-4" /> Technician Profile
                                        </h3>
                                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                            <ProfileStat label="Email" value={selectedTech.email} valueClassName="text-sm text-white" />
                                            <ProfileStat label="Phone" value={formatPhoneForDisplay(selectedTech.phone) || 'Not set'} valueClassName="text-sm text-white" />
                                            <ProfileStat label="Availability" value={selectedTech.effective_availability ? 'Dispatch Ready' : 'Unavailable'} valueClassName={selectedTech.effective_availability ? 'text-emerald-100' : 'text-slate-300'} />
                                            <ProfileStat label="Account Control" value="Tech Accounts" hint="Activate, deactivate, approve, and reset there" valueClassName="text-sm text-white" />
                                        </div>
                                    </Card>

                                    <Card className="p-4 border-white/10 bg-white/[0.03] shadow-none">
                                        <div className="mb-4 flex items-center justify-between gap-3">
                                            <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                                                <Route className="h-4 w-4" /> Active Jobs & History Summary
                                            </h3>
                                            <Badge variant="outline" className="border-white/10 bg-white/[0.03] text-slate-300">
                                                {techJobFeed.length} active
                                            </Badge>
                                        </div>
                                        {detailLoading ? (
                                            <div className="flex items-center gap-2 text-sm text-slate-400">
                                                <Loader2 className="h-4 w-4 animate-spin" /> Loading live technician workload...
                                            </div>
                                        ) : techJobFeed.length === 0 ? (
                                            <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-5 text-sm text-slate-400">
                                                No active jobs are currently assigned. This technician will appear in the dispatch queue based on zone, skill, and availability rules.
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {techJobFeed.map((job) => (
                                                    <button
                                                        key={job.id}
                                                        type="button"
                                                        onClick={() => navigate(`/admin/jobs/${job.id}`)}
                                                        className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition hover:bg-white/[0.06]"
                                                    >
                                                        <div className="space-y-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm font-semibold text-white">{job.job_code}</span>
                                                                <Badge variant="outline" className="border-white/10 bg-white/[0.02] text-slate-300">{job.status}</Badge>
                                                            </div>
                                                            <div className="text-xs text-slate-400">
                                                                {(job.dealership_name || 'Unknown location')} · {(job.vehicle_summary || 'Vehicle not specified')}
                                                            </div>
                                                        </div>
                                                        <ArrowUpRight className="h-4 w-4 text-slate-400" />
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </Card>

                                    {/* B) Skills & Zones */}
                                    <Card className="p-4 border-white/10 bg-white/[0.03] shadow-none">
                                        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                                            <Briefcase className="w-4 h-4" /> Skills & Zones
                                        </h3>
                                        <div className="space-y-4">
                                            <div>
                                                <Label className="text-xs text-slate-400 uppercase tracking-wider mb-2 block">Assigned Zones</Label>
                                                <div className="flex flex-wrap gap-2">
                                                    {techDraft.zones.map(z => (
                                                        <Badge key={z} variant="secondary" className="border border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08] pr-1">
                                                            <span>{z}</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveZone(z)}
                                                                aria-label={`Remove zone ${z}`}
                                                                className="ml-1 rounded-full p-0.5 hover:bg-white/[0.08] text-slate-500 hover:text-slate-200"
                                                            >
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                        </Badge>
                                                    ))}
                                                </div>
                                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-2">
                                                    <Input
                                                        value={newZoneInput}
                                                        onChange={(e) => setNewZoneInput(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                handleAddZone();
                                                            }
                                                        }}
                                                        placeholder="Add zone (e.g. Quebec)"
                                                        className="h-8 text-xs border-white/10 bg-white/[0.04] text-white placeholder:text-slate-500"
                                                    />
                                                    <Button variant="outline" size="sm" className="h-8 text-xs border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08] sm:w-auto" onClick={handleAddZone}>
                                                        + Add Zone
                                                    </Button>
                                                </div>
                                            </div>
                                            <Separator className="bg-white/10" />
                                            <div>
                                                <Label className="text-xs text-slate-400 uppercase tracking-wider mb-2 block">Technical Skills</Label>
                                                <div className="flex flex-wrap gap-2">
                                                    {techDraft.skills.map(s => (
                                                        <Badge key={s} variant="secondary" className="border border-cyan-300/20 bg-cyan-300/10 text-cyan-100 hover:bg-cyan-300/15 pr-1">
                                                            <span>{s}</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveSkill(s)}
                                                                aria-label={`Remove skill ${s}`}
                                                                className="ml-1 rounded-full p-0.5 hover:bg-cyan-300/15 text-cyan-300 hover:text-cyan-100"
                                                            >
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                        </Badge>
                                                    ))}
                                                </div>
                                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-2">
                                                    <Input
                                                        value={newSkillInput}
                                                        onChange={(e) => setNewSkillInput(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                handleAddSkill();
                                                            }
                                                        }}
                                                        placeholder="Add skill (e.g. Towing)"
                                                        className="h-8 text-xs border-white/10 bg-white/[0.04] text-white placeholder:text-slate-500"
                                                    />
                                                    <Button variant="outline" size="sm" className="h-8 text-xs border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08] sm:w-auto" onClick={handleAddSkill}>
                                                        + Add Skill
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </Card>

                                    {/* D) Working Hours */}
                                    <Card className="p-4 border-white/10 bg-white/[0.03] shadow-none">
                                        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                                            <Clock className="w-4 h-4" /> Weekly Schedule
                                        </h3>
                                        <div className="space-y-2">
                                            {techDraft.working_hours.map((wh, idx) => (
                                                <div key={idx} className="flex items-center justify-between text-sm py-1.5 gap-3">
                                                    <span className={cn("w-10 font-medium", wh.is_closed ? "text-slate-500" : "text-slate-200")}>{wh.day}</span>
                                                    <div className="flex items-center gap-2 flex-1 justify-end">
                                                        <Switch
                                                            checked={!wh.is_closed}
                                                            onCheckedChange={(checked) => handleToggleWorkingDay(idx, checked)}
                                                        />
                                                        {!wh.is_closed ? (
                                                            <>
                                                                <Input
                                                                    type="time"
                                                                    value={wh.start}
                                                                    onChange={(e) => handleWorkingHoursTimeChange(idx, 'start', e.target.value)}
                                                                    className="h-7 w-[96px] text-xs font-mono border-white/10 bg-white/[0.04] text-white"
                                                                />
                                                                <span className="text-slate-500">-</span>
                                                                <Input
                                                                    type="time"
                                                                    value={wh.end}
                                                                    onChange={(e) => handleWorkingHoursTimeChange(idx, 'end', e.target.value)}
                                                                    className="h-7 w-[96px] text-xs font-mono border-white/10 bg-white/[0.04] text-white"
                                                                />
                                                            </>
                                                        ) : (
                                                            <span className="text-slate-500 italic text-xs w-[120px] text-right">Closed</span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-[11px] text-slate-400 mt-3">
                                            Overnight shifts are supported by setting end time earlier than start time.
                                        </p>
                                    </Card>

                                    {/* E) Time Off */}
                                    <Card className="p-4 border-white/10 bg-white/[0.03] shadow-none">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                                <Calendar className="w-4 h-4" /> Out of Office
                                            </h3>
                                            <Button variant="outline" size="sm" className="h-7 border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]" onClick={() => setTimeOffModalOpen(true)}>+ Mark Out of Office</Button>
                                        </div>
                                        {techDraft.time_off.length === 0 ? (
                                            <div className="text-center py-6 text-slate-500 text-sm italic bg-white/[0.02] rounded-lg border border-dashed border-white/10">
                                                No upcoming time off scheduled.
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {techDraft.time_off.map(to => (
                                                    <div key={to.id} className="flex flex-col text-sm bg-amber-300/10 p-3 rounded-md border border-amber-300/20">
                                                        <div className="flex justify-between font-medium text-amber-100">
                                                            <span>{to.reason}</span>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-5 w-5 p-0 hover:bg-amber-300/15 text-amber-200"
                                                                onClick={() => handleRemoveTimeOff(to.id)}
                                                            >
                                                                <X className="w-3 h-3" />
                                                            </Button>
                                                        </div>
                                                        <div className="text-xs text-amber-200 mt-1">
                                                            {formatDateForUi(to.start)} - {formatDateForUi(to.end)}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </Card>

                                </div>
                            </div>
                        </>
                    )}
                </SheetContent>
            </Sheet>

            {/* 6. Edit Technician Modal */}
            <Dialog open={editTechModalOpen} onOpenChange={setEditTechModalOpen}>
                <DialogContent className="border-white/10 bg-[linear-gradient(180deg,rgba(9,24,39,0.98),rgba(6,17,29,0.98))] text-slate-100">
                    <DialogHeader>
                        <DialogTitle className="text-white">Edit Technician</DialogTitle>
                        <DialogDescription className="text-slate-300">Update technician profile details.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-slate-200">Full Name</Label>
                                <Input className="border-white/10 bg-white/[0.04] text-white placeholder:text-slate-500" value={editTechForm.name} onChange={e => setEditTechForm({ ...editTechForm, name: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-slate-200">Tech Code</Label>
                                <Input className="border-white/10 bg-white/[0.04] text-white placeholder:text-slate-500" value={editTechForm.code} onChange={e => setEditTechForm({ ...editTechForm, code: e.target.value })} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-slate-200">Phone</Label>
                            <Input
                                className="border-white/10 bg-white/[0.04] text-white placeholder:text-slate-500"
                                placeholder={phoneExampleFormat}
                                value={editTechForm.phone}
                                onChange={e => setEditTechForm({ ...editTechForm, phone: formatUsPhoneInput(e.target.value) })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-slate-200">Zones (comma separated)</Label>
                            <Input className="border-white/10 bg-white/[0.04] text-white placeholder:text-slate-500" value={editTechForm.zones} onChange={e => setEditTechForm({ ...editTechForm, zones: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-slate-200">Skills (comma separated)</Label>
                            <Input className="border-white/10 bg-white/[0.04] text-white placeholder:text-slate-500" value={editTechForm.skills} onChange={e => setEditTechForm({ ...editTechForm, skills: e.target.value })} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" className="border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]" onClick={() => setEditTechModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveTechEdit} className="bg-[#2F8E92] hover:bg-[#267276]">Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 7. Set Time Off Modal */}
            <Dialog open={timeOffModalOpen} onOpenChange={setTimeOffModalOpen}>
                <DialogContent className="border-white/10 bg-[linear-gradient(180deg,rgba(9,24,39,0.98),rgba(6,17,29,0.98))] text-slate-100">
                    <DialogHeader>
                        <DialogTitle className="text-white">Mark Technician Out of Office</DialogTitle>
                        <DialogDescription className="text-slate-300">
                            Set the out-of-office window for {selectedTech?.name}. A return date is required before they leave the dispatch queue.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-slate-200">Start Date</Label>
                                <Input className="border-white/10 bg-white/[0.04] text-white" type="date" value={timeOffForm.start} onChange={e => setTimeOffForm({ ...timeOffForm, start: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-slate-200">Return Date</Label>
                                <Input className="border-white/10 bg-white/[0.04] text-white" type="date" value={timeOffForm.end} onChange={e => setTimeOffForm({ ...timeOffForm, end: e.target.value })} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-slate-200">Reason</Label>
                            <Input className="border-white/10 bg-white/[0.04] text-white placeholder:text-slate-500" placeholder="e.g. Vacation, Sick Leave" value={timeOffForm.reason} onChange={e => setTimeOffForm({ ...timeOffForm, reason: e.target.value })} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" className="border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]" onClick={() => setTimeOffModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveTimeOff} className="bg-[#2F8E92] hover:bg-[#267276]">Save Out of Office</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ColumnExportDialog
                open={exportModalOpen}
                onOpenChange={setExportModalOpen}
                title="Export Technicians"
                description="Select the technician columns you want in your CSV."
                availableColumns={TECHNICIAN_EXPORT_COLUMNS}
                onConfirm={handleExport}
            />

            {/* 8. Deactivate Confirmation Modal */}
            <Dialog open={confirmDeactivateOpen} onOpenChange={setConfirmDeactivateOpen}>
                <DialogContent className="border-white/10 bg-[linear-gradient(180deg,rgba(9,24,39,0.98),rgba(6,17,29,0.98))] text-slate-100">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-rose-200">
                            <Shield className="w-5 h-5" /> Deactivate Technician?
                        </DialogTitle>
                        <DialogDescription className="text-slate-300">
                            Are you sure you want to deactivate <strong>{selectedTech?.name}</strong>?
                            They will no longer be eligible for dispatch assignments.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" className="border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]" onClick={() => setConfirmDeactivateOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={confirmDeactivate}>Yes, Deactivate</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            </div>
        </div>
    );
}

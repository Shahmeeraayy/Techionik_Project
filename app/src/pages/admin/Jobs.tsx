import { useState, useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    Activity,
    Search,
    Download,
    RefreshCw,
    MoreHorizontal,
    ArrowUpDown,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    ChevronsLeft,
    ChevronsRight,
    AlertCircle,
    Clock,
    Truck,
    User,
    Calendar,
    X,
    SlidersHorizontal,
    ArrowUp,
    ArrowDown,
    Plus,
    MoreVertical,
    Car,
    MapPin,
    History,
    Building2,
    Users,
    ClipboardList,
    TrendingUp,
    ShieldCheck,
    Sparkles,
    Trash2,
    Check,
    ChevronsUpDown
} from 'lucide-react';
import { calculateJobRanking } from '@/lib/priority';
import { exportArrayData, selectColumnsForExport, type ExportFormat } from '@/lib/export';
import { toast } from 'sonner';

import type { PriorityRule, UrgencyLevel } from '@/types';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import OverflowText from '@/components/common/overflow-text';
import { Checkbox } from '@/components/ui/checkbox';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import ColumnExportDialog from '@/components/modals/ColumnExportDialog';
import { useAuth } from '@/contexts/AuthContext';
import { DISPATCH_JOB_STATUS, normalizeDispatchJobStatus } from '@/lib/job-status';
import {
    confirmAdminJob,
    createAdminJob,
    deleteAdminJob,
    fetchAdminDealerships,
    fetchAdminPriorityRules,
    fetchAdminServices,
    fetchAdminJobs,
    fetchAdminTechnicians,
    getStoredAdminToken,
    updateAdminJobAssignment,
    type BackendAdminJob,
    type BackendDealership,
    type BackendPriorityRule,
    type BackendServiceCatalogItem,
    type BackendTechnicianListItem,
} from '@/lib/backend-api';

// --- Types ---

type JobStatus = 'admin_preview' | 'pending_admin_confirmation' | 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'unknown';
type InvoiceState = 'draft' | 'pending_approval' | 'approved' | 'synced' | 'failed' | 'void';
type Urgency = 'low' | 'normal' | 'high' | 'critical';

interface Job {
    job_id: string;
    job_code: string;
    dealership_code?: string | null;
    dealership_name: string;
    service_name: string;
    service_names: string[];
    vehicle_summary: string;
    urgency: Urgency;
    assigned_technician_name: string | null;
    job_status: JobStatus;
    invoice_state: InvoiceState;
    attention_flag: boolean;
    created_at: string;
    updated_at: string;
    source_system?: string | null;
    source_metadata?: Record<string, unknown> | null;
    allowed_actions: string[];
    ranking_score?: number;
    applied_rules?: string[];
    requires_admin_confirmation?: boolean;
    admin_confirmed_at?: string | null;
    pending_assigned_technician_name?: string | null;
    pending_push_to_available?: boolean;
    last_refused_at?: string | null;
    last_refused_by_technician_name?: string | null;
    last_refusal_reason?: string | null;
    last_refusal_comment?: string | null;
}



interface PaginationState {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
}

interface NewJobFormState {
    dealership_name: string;
    service_name: string;
    vehicle_summary: string;
    urgency: Urgency;
    assigned_technician_name: string;
    push_to_available: boolean;
}

type TechnicianOption = {
    id: string;
    name: string;
    zones: string[];
    skills: string[];
    isActive: boolean;
};

type QuickFilterCounts = {
    pendingReview: number;
    awaitingTechAcceptance: number;
    attentionRequired: number;
    needsReassignment: number;
};

type QuickFilterKey =
    | 'pending_review'
    | 'awaiting_tech_acceptance'
    | 'attention_required'
    | 'needs_reassignment';

type JobSortMode = 'rank' | 'created_newest' | 'created_oldest' | 'urgency' | 'status' | 'job_id';
type StatusFilterKey =
    | 'all'
    | 'unassigned'
    | 'assigned'
    | 'accepted'
    | 'in_progress'
    | 'delayed'
    | 'completed'
    | 'refused';

type DealershipOption = {
    id: string;
    backendId: string;
    code: string;
    name: string;
    city: string;
};

type SearchableSelectOption = {
    value: string;
    label: string;
};

// --- Reference Data ---

const ADMIN_JOBS_STORAGE_KEY = 'sm_dispatch_admin_jobs';
const JOB_EXPORT_COLUMNS = [
    'JobId',
    'JobCode',
    'Dealership',
    'Location',
    'Service',
    'Vehicle',
    'Urgency',
    'Technician',
    'RankingScore',
    'JobStatus',
    'CreatedDate',
    'CreatedTime',
    'LastUpdatedDate',
    'LastUpdatedTime',
];
const ADMIN_REFRESH_EVENT = 'sm-dispatch:admin-refresh';
const displayFontStyle: CSSProperties = {
    fontFamily: '"Space Grotesk", "Sora", system-ui, sans-serif',
};
const bodyFontStyle: CSSProperties = {
    fontFamily: '"Manrope", "Inter", system-ui, sans-serif',
};

type JobsMetricTone = 'cyan' | 'violet' | 'blue' | 'amber';

function jobsMetricCardClasses(tone: JobsMetricTone): string {
    return cn(
        'group relative overflow-hidden rounded-[22px] border px-5 py-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(15,23,42,0.08)] dark:hover:shadow-[0_18px_40px_rgba(0,0,0,0.22)]',
        tone === 'cyan' && 'border-slate-200 bg-[linear-gradient(180deg,#ffffff,#f8fafc)] hover:border-slate-300 dark:border-cyan-400/14 dark:bg-[linear-gradient(180deg,rgba(9,28,41,0.98),rgba(8,21,32,0.98))] dark:hover:border-cyan-300/24',
        tone === 'violet' && 'border-violet-200 bg-[linear-gradient(180deg,#ffffff,#faf7fd)] hover:border-violet-300 dark:border-violet-400/14 dark:bg-[linear-gradient(180deg,rgba(25,21,40,0.98),rgba(20,18,32,0.98))] dark:hover:border-violet-300/24',
        tone === 'blue' && 'border-blue-200 bg-[linear-gradient(180deg,#ffffff,#f8fbff)] hover:border-blue-300 dark:border-blue-400/14 dark:bg-[linear-gradient(180deg,rgba(10,24,43,0.98),rgba(8,19,33,0.98))] dark:hover:border-blue-300/24',
        tone === 'amber' && 'border-amber-200 bg-[linear-gradient(180deg,#ffffff,#fffaf0)] hover:border-amber-300 dark:border-amber-400/14 dark:bg-[linear-gradient(180deg,rgba(39,25,10,0.98),rgba(28,20,12,0.98))] dark:hover:border-amber-300/24',
    );
}

function jobsMetricTopLineClasses(tone: JobsMetricTone): string {
    if (tone === 'violet') return 'via-violet-400/55 dark:via-violet-300/80';
    if (tone === 'blue') return 'via-blue-400/55 dark:via-blue-300/80';
    if (tone === 'amber') return 'via-amber-400/55 dark:via-amber-300/80';
    return 'via-slate-900/35 dark:via-cyan-300/80';
}

function jobsMetricIconClasses(tone: JobsMetricTone): string {
    if (tone === 'violet') return 'border border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-300/14 dark:bg-violet-300/10 dark:text-violet-100';
    if (tone === 'blue') return 'border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-300/14 dark:bg-blue-300/10 dark:text-blue-100';
    if (tone === 'amber') return 'border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-300/14 dark:bg-amber-300/10 dark:text-amber-100';
    return 'border border-slate-200 bg-slate-100 text-slate-700 dark:border-cyan-300/14 dark:bg-cyan-300/10 dark:text-cyan-100';
}

const getStoredAdminJobsSnapshot = () => {
    try {
        return localStorage.getItem(ADMIN_JOBS_STORAGE_KEY);
    } catch {
        return null;
    }
};

const setStoredAdminJobsSnapshot = (jobs: Job[]) => {
    try {
        localStorage.setItem(ADMIN_JOBS_STORAGE_KEY, JSON.stringify(jobs));
    } catch {
        // Ignore storage failures so the live jobs page can still render from backend data.
    }
};

const EMPTY_QUICK_FILTER_COUNTS: QuickFilterCounts = {
    pendingReview: 0,
    awaitingTechAcceptance: 0,
    attentionRequired: 0,
    needsReassignment: 0,
};

const normalizeText = (value: string) =>
    value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const textTokens = (value: string) =>
    normalizeText(value)
        .split(' ')
        .filter((token) => token.length >= 3);

const parseServiceNames = (value: string) =>
    Array.from(
        new Set(
            value
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean),
        ),
    );

const JOB_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
});

const JOB_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
});

const UUID_V4ISH_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const mapBackendPriorityRule = (row: BackendPriorityRule): PriorityRule => ({
    id: row.id,
    description: row.description,
    dealershipId: row.dealership_id,
    serviceId: row.service_id ?? undefined,
    targetUrgency: row.target_urgency,
    rankingScore: row.ranking_score,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
});

const mapBackendDealershipOption = (row: BackendDealership): DealershipOption => ({
    id: row.code,
    backendId: row.id,
    code: row.code,
    name: (row.name || '').trim(),
    city: (row.city || '').trim(),
});

const formatJobDate = (value: string) => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? 'N/A' : JOB_DATE_FORMATTER.format(parsed);
};

const formatJobTime = (value: string) => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? 'N/A' : JOB_TIME_FORMATTER.format(parsed);
};

const getSortableTimestamp = (value: string) => {
    const timestamp = new Date(value).getTime();
    return Number.isNaN(timestamp) ? 0 : timestamp;
};

const normalizeSourceSystem = (value: string | null | undefined) => (value || '').trim().toLowerCase();

const getBackendJobSourceSystem = (row: BackendAdminJob) => {
    const directSource = normalizeSourceSystem(row.source_system);
    if (directSource) {
        return directSource;
    }

    const metadataSource = row.source_metadata && typeof row.source_metadata === 'object'
        && typeof row.source_metadata.source === 'string'
        ? normalizeSourceSystem(String(row.source_metadata.source))
        : '';

    return metadataSource;
};

const isMakeIntakeJob = (row: BackendAdminJob) => getBackendJobSourceSystem(row).includes('make');

const formatNewMakeJobsDescription = (jobs: BackendAdminJob[]) => {
    const preview = jobs
        .slice(0, 2)
        .map((job) => `${job.job_code} · ${(job.dealership_name || 'Unknown Dealership').trim()}`)
        .join(' | ');

    const remaining = jobs.length - Math.min(jobs.length, 2);
    if (remaining <= 0) {
        return preview;
    }

    return `${preview} | +${remaining} more`;
};

const toLocalDateFilterValue = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return '';
    }

    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const isBackendPersistedJobId = (jobId: string) => UUID_V4ISH_PATTERN.test(jobId);

const mapBackendStatusToUiJobStatus = (status: string): JobStatus => {
    switch (normalizeDispatchJobStatus(status)) {
        case DISPATCH_JOB_STATUS.ADMIN_PREVIEW:
            return 'admin_preview';
        case DISPATCH_JOB_STATUS.PENDING_ADMIN_CONFIRMATION:
            return 'pending_admin_confirmation';
        case DISPATCH_JOB_STATUS.PENDING:
            return 'pending';
        case DISPATCH_JOB_STATUS.SCHEDULED:
            return 'scheduled';
        case DISPATCH_JOB_STATUS.IN_PROGRESS:
            return 'in_progress';
        case DISPATCH_JOB_STATUS.COMPLETED:
            return 'completed';
        case DISPATCH_JOB_STATUS.CANCELLED:
            return 'cancelled';
        case DISPATCH_JOB_STATUS.UNKNOWN:
            return 'unknown';
        default:
            return 'unknown';
    }
};

const deriveUrgencyFromBackendJob = (row: BackendAdminJob): Urgency => {
    const metadata = row.source_metadata;
    if (metadata && typeof metadata === 'object') {
        const urgent = (metadata as Record<string, unknown>).urgent;
        if (urgent === true || urgent === 'true') {
            return 'high';
        }
    }
    return 'normal';
};

const urgencyToPriorityMap: Record<Urgency, UrgencyLevel> = {
    low: 'LOW',
    normal: 'MEDIUM',
    high: 'HIGH',
    critical: 'CRITICAL',
};

const priorityToUrgencyMap: Record<UrgencyLevel, Urgency> = {
    LOW: 'low',
    MEDIUM: 'normal',
    HIGH: 'high',
    CRITICAL: 'critical',
};

const extractVehicleMake = (vehicleSummary: string): string => {
    const tokens = vehicleSummary.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return '';
    const token = /^\d{4}$/.test(tokens[0]) ? (tokens[1] || '') : tokens[0];
    if (!token) return '';
    return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
};

const resolveDealershipRuleId = (
    dealershipName: string,
    dealershipCode: string | null | undefined,
    dealershipOptions: DealershipOption[],
): string => {
    const normalizedName = normalizeText(dealershipName);
    const directMatch = dealershipOptions.find((row) => normalizeText(row.name) === normalizedName);
    return dealershipCode || directMatch?.code || dealershipName.trim();
};

const resolveServiceRuleId = (
    serviceNames: string[],
    primaryServiceName: string,
    serviceCatalog: Array<{ id: string; name: string }>,
): string => {
    const normalizedCandidates = new Set(
        [primaryServiceName, ...serviceNames]
            .map((value) => normalizeText(value))
            .filter(Boolean),
    );
    const matched = serviceCatalog.find((row) => normalizedCandidates.has(normalizeText(row.name)));
    return matched?.id || '';
};

const getJobLocationLabel = (
    job: Pick<Job, 'dealership_code' | 'dealership_name'>,
    dealershipOptions: DealershipOption[],
) => {
    const normalizedName = normalizeText(job.dealership_name);
    const matchedDealership = dealershipOptions.find((row) => (
        row.code === (job.dealership_code || '')
        || normalizeText(row.name) === normalizedName
    ));

    return matchedDealership?.city?.trim() || 'Location not specified';
};

const applyDispatchRankingToJob = (
    job: Job,
    dealershipOptions: DealershipOption[],
    serviceCatalog: Array<{ id: string; name: string }>,
    dispatchRankingRules: PriorityRule[],
): Job => {
    const dealershipRuleId = resolveDealershipRuleId(job.dealership_name, job.dealership_code, dealershipOptions);
    const serviceRuleId = resolveServiceRuleId(job.service_names, job.service_name, serviceCatalog);
    const priorityResult = calculateJobRanking(
        {
            dealershipId: dealershipRuleId,
            serviceId: serviceRuleId,
            urgency: urgencyToPriorityMap[job.urgency],
            vehicleMake: extractVehicleMake(job.vehicle_summary),
        },
        dispatchRankingRules,
    );

    return {
        ...job,
        urgency: priorityToUrgencyMap[priorityResult.finalUrgency] || job.urgency,
        ranking_score: priorityResult.score,
        applied_rules: priorityResult.appliedRules,
    };
};

const getBackendDisplayDateTimeIso = (row: BackendAdminJob): string => {
    const datePart = row.requested_service_date?.trim();
    if (!datePart) {
        return row.created_at;
    }

    const rawTime = row.requested_service_time?.trim() || '00:00:00';
    const normalizedTime = rawTime.length === 5 ? `${rawTime}:00` : rawTime.slice(0, 8);
    const localDateTime = `${datePart}T${normalizedTime}`;
    const parsed = new Date(localDateTime);
    return Number.isNaN(parsed.getTime()) ? row.created_at : localDateTime;
};

const mapBackendJobToUiJob = (
    row: BackendAdminJob,
    dealershipOptions: DealershipOption[],
    serviceCatalog: Array<{ id: string; name: string }>,
    dispatchRankingRules: PriorityRule[],
): Job => {
    const normalizedServiceNames = Array.from(
        new Set(
            (row.service_names ?? [])
                .map((value) => value.trim())
                .filter(Boolean),
        ),
    );
    const primaryServiceName = normalizedServiceNames[0] || row.service_type?.trim() || 'Service Request';

    const uiStatus = mapBackendStatusToUiJobStatus(row.status);
    const backendTechName = row.assigned_technician_name?.trim() || null;
    const pendingTaggedTechName =
        row.pre_assigned_technician_name?.trim()
        || row.assigned_technician_name?.trim()
        || null;
    const previewTechName =
        uiStatus === 'admin_preview' || uiStatus === 'pending_admin_confirmation'
            ? pendingTaggedTechName
            : null;
    const assignedTechName =
        uiStatus === 'admin_preview' || uiStatus === 'pending_admin_confirmation'
            ? null
            : backendTechName;
    const displayDateTime = getBackendDisplayDateTimeIso(row);

    const baseJob: Job = {
        job_id: row.id,
        job_code: row.job_code,
        dealership_code: row.dealership_id ?? null,
        dealership_name: row.dealership_name?.trim() || 'Unknown Dealership',
        service_name: primaryServiceName,
        service_names: normalizedServiceNames.length > 0 ? normalizedServiceNames : [primaryServiceName],
        vehicle_summary: row.vehicle?.trim() || 'Vehicle not provided',
        urgency: deriveUrgencyFromBackendJob(row),
        assigned_technician_name: assignedTechName,
        pending_assigned_technician_name: previewTechName,
        job_status: uiStatus,
        invoice_state: 'draft',
        attention_flag: false,
        created_at: displayDateTime,
        updated_at: row.updated_at || row.created_at,
        source_system: getBackendJobSourceSystem(row) || null,
        source_metadata: row.source_metadata ?? null,
        allowed_actions: (uiStatus === 'admin_preview' || uiStatus === 'pending_admin_confirmation')
            ? ['view', 'edit', 'cancel', 'assign', 'confirm']
            : ['view', 'edit', 'cancel', 'assign'],
        ranking_score: 0,
        applied_rules: [],
        requires_admin_confirmation: uiStatus === 'admin_preview' || uiStatus === 'pending_admin_confirmation',
        admin_confirmed_at:
            (uiStatus === 'admin_preview' || uiStatus === 'pending_admin_confirmation')
                ? null
                : (row.updated_at || row.created_at),
        pending_push_to_available: false,
        last_refused_at: row.last_refused_at ?? null,
        last_refused_by_technician_name: row.last_refused_by_technician_name ?? null,
        last_refusal_reason: row.last_refusal_reason ?? null,
        last_refusal_comment: row.last_refusal_comment ?? null,
    };

    return applyDispatchRankingToJob(baseJob, dealershipOptions, serviceCatalog, dispatchRankingRules);
};

const mergeBackendJobsIntoLocalStore = (
    backendRows: BackendAdminJob[],
    dealershipOptions: DealershipOption[],
    serviceCatalog: Array<{ id: string; name: string }>,
    dispatchRankingRules: PriorityRule[],
) => {
    const localJobs = loadPersistedJobs();
    const localByCode = new Map(localJobs.map((job) => [job.job_code, job]));
    const nextJobs = backendRows.map((row) => {
        const incoming = mapBackendJobToUiJob(row, dealershipOptions, serviceCatalog, dispatchRankingRules);
        const existing = localByCode.get(incoming.job_code);
        if (!existing) {
            return incoming;
        }

        // Keep UI-only decorations, but make backend rows authoritative.
        return {
            ...existing,
            ...incoming,
            invoice_state: existing.invoice_state ?? incoming.invoice_state,
            attention_flag: existing.attention_flag ?? incoming.attention_flag,
            allowed_actions: existing.allowed_actions?.length ? existing.allowed_actions : incoming.allowed_actions,
        };
    });

    persistJobs(nextJobs);
    return true;
};

const normalizeAssignedTechnicianStatus = (job: Job): Job => {
    if (job.assigned_technician_name && job.job_status === 'pending') {
        return { ...job, job_status: 'scheduled' };
    }
    return job;
};

const loadPersistedJobs = (): Job[] => {
    try {
        const raw = getStoredAdminJobsSnapshot();
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            return [];
        }

        const jobs = parsed as Job[];
        let didNormalize = false;
        const normalizedJobs = jobs.map((job) => {
            const normalized = normalizeAssignedTechnicianStatus(job);
            if (normalized !== job) {
                didNormalize = true;
            }
            return normalized;
        });

        if (didNormalize) {
            setStoredAdminJobsSnapshot(normalizedJobs);
        }

        return normalizedJobs;
    } catch {
        return [];
    }
};

const persistJobs = (jobs: Job[]) => {
    setStoredAdminJobsSnapshot(jobs);
};

const isPendingReviewJob = (job: Job) =>
    job.job_status === 'admin_preview'
    || job.job_status === 'pending_admin_confirmation'
    || (job.requires_admin_confirmation === true && !job.admin_confirmed_at);

const isAwaitingTechAcceptanceJob = (job: Job) => job.job_status === 'pending' && hasAnyTechnicianAssignment(job);

const isAttentionRequiredJob = (job: Job) => job.attention_flag;

const isTerminalJob = (job: Job) => job.job_status === 'completed' || job.job_status === 'cancelled';

const isAssignableJob = (job: Job) => !isTerminalJob(job);

const hasAssignedTechnician = (job: Job) => Boolean(job.assigned_technician_name?.trim());

const hasPendingAssignedTechnician = (job: Job) => Boolean(job.pending_assigned_technician_name?.trim());

const hasAnyTechnicianAssignment = (job: Job) => hasAssignedTechnician(job) || hasPendingAssignedTechnician(job);

const hasTechnicianRefusalEvent = (job: Job) => Boolean(
    job.last_refused_at
    || job.last_refused_by_technician_name?.trim()
    || job.last_refusal_reason?.trim()
    || job.last_refusal_comment?.trim()
);

const isAwaitingReassignmentJob = (job: Job) =>
    hasTechnicianRefusalEvent(job)
    && !hasAnyTechnicianAssignment(job)
    && (job.job_status === 'pending' || job.job_status === 'cancelled');

const matchesQuickFilter = (job: Job, filter: QuickFilterKey) => {
    switch (filter) {
        case 'pending_review':
            return isPendingReviewJob(job);
        case 'awaiting_tech_acceptance':
            return isAwaitingTechAcceptanceJob(job);
        case 'attention_required':
            return isAttentionRequiredJob(job);
        case 'needs_reassignment':
            return isAwaitingReassignmentJob(job);
        default:
            return true;
    }
};

const matchesStatusFilter = (job: Job, filter: StatusFilterKey) => {
    switch (filter) {
        case 'all':
            return true;
        case 'unassigned':
            return !hasAnyTechnicianAssignment(job);
        case 'assigned':
            return hasAnyTechnicianAssignment(job);
        case 'accepted':
            return hasAssignedTechnician(job) && job.job_status === 'scheduled';
        case 'in_progress':
            return job.job_status === 'in_progress';
        case 'delayed':
            return job.attention_flag;
        case 'completed':
            return job.job_status === 'completed';
        case 'refused':
            return isAwaitingReassignmentJob(job);
        default:
            return true;
    }
};

const calculateQuickFilterCounts = (jobs: Job[]): QuickFilterCounts => (
    jobs.reduce<QuickFilterCounts>((counts, job) => {
        const needsAdminReview = isPendingReviewJob(job);
        const awaitingTechAcceptance = isAwaitingTechAcceptanceJob(job);
        const needsAttention = isAttentionRequiredJob(job);
        const needsReassignment = isAwaitingReassignmentJob(job);

        if (needsAdminReview) counts.pendingReview += 1;
        if (awaitingTechAcceptance) counts.awaitingTechAcceptance += 1;
        if (needsAttention) counts.attentionRequired += 1;
        if (needsReassignment) counts.needsReassignment += 1;

        return counts;
    }, { ...EMPTY_QUICK_FILTER_COUNTS })
);

const appendAuditLog = (
    _event_type: string,
    _summary: string,
    _payload_json: Record<string, unknown>,
    _severity: 'info' | 'warning' | 'critical' = 'info'
) => {
    // Audit logging intentionally disabled.
};

// --- Components ---

function StatusBadge({ status, type }: { status: string; type: 'job' | 'invoice' | 'urgency' }) {
    const styles: Record<string, string> = {
        // Job Status
        admin_preview: 'border-violet-300/20 bg-[linear-gradient(135deg,rgba(167,139,250,0.15),rgba(76,29,149,0.18))] text-violet-50 shadow-[0_10px_24px_rgba(76,29,149,0.18)]',
        pending_admin_confirmation: 'border-fuchsia-300/20 bg-[linear-gradient(135deg,rgba(217,70,239,0.15),rgba(112,26,117,0.18))] text-fuchsia-50 shadow-[0_10px_24px_rgba(112,26,117,0.18)]',
        pending: 'border-indigo-300/20 bg-[linear-gradient(135deg,rgba(99,102,241,0.16),rgba(49,46,129,0.18))] text-indigo-50 shadow-[0_10px_24px_rgba(49,46,129,0.16)]',
        scheduled: 'border-blue-300/20 bg-[linear-gradient(135deg,rgba(56,189,248,0.16),rgba(30,64,175,0.18))] text-blue-50 shadow-[0_10px_24px_rgba(30,64,175,0.16)]',
        in_progress: 'border-amber-300/20 bg-[linear-gradient(135deg,rgba(251,191,36,0.16),rgba(146,64,14,0.18))] text-amber-50 shadow-[0_10px_24px_rgba(146,64,14,0.16)]',
        completed: 'border-emerald-300/20 bg-[linear-gradient(135deg,rgba(52,211,153,0.16),rgba(6,95,70,0.18))] text-emerald-50 shadow-[0_10px_24px_rgba(6,95,70,0.16)]',
        cancelled: 'border-slate-300/20 bg-[linear-gradient(135deg,rgba(148,163,184,0.12),rgba(51,65,85,0.18))] text-slate-200 font-medium',
        needs_reassignment: 'border-amber-300/25 bg-[linear-gradient(135deg,rgba(251,191,36,0.16),rgba(120,53,15,0.22))] text-amber-50 shadow-[0_10px_24px_rgba(120,53,15,0.18)]',
        unknown: 'border-zinc-300/20 bg-[linear-gradient(135deg,rgba(161,161,170,0.12),rgba(39,39,42,0.18))] text-zinc-100',

        // Invoice State
        draft: 'border-slate-300/20 bg-[linear-gradient(135deg,rgba(148,163,184,0.12),rgba(51,65,85,0.18))] text-slate-200',
        pending_approval: 'border-orange-300/20 bg-[linear-gradient(135deg,rgba(251,146,60,0.15),rgba(124,45,18,0.18))] text-orange-50',
        approved: 'border-blue-300/20 bg-[linear-gradient(135deg,rgba(96,165,250,0.15),rgba(30,58,138,0.18))] text-blue-50',
        synced: 'border-green-300/20 bg-[linear-gradient(135deg,rgba(74,222,128,0.15),rgba(20,83,45,0.18))] text-green-50',
        failed: 'border-red-300/20 bg-[linear-gradient(135deg,rgba(248,113,113,0.15),rgba(127,29,29,0.18))] text-red-50',
        void: 'border-slate-300/20 bg-[linear-gradient(135deg,rgba(148,163,184,0.12),rgba(51,65,85,0.18))] text-slate-400 line-through',

        // Urgency
        low: 'border-slate-300/20 bg-[linear-gradient(135deg,rgba(148,163,184,0.12),rgba(51,65,85,0.18))] text-slate-200',
        normal: 'border-blue-300/20 bg-[linear-gradient(135deg,rgba(96,165,250,0.15),rgba(30,58,138,0.18))] text-blue-50',
        high: 'border-orange-300/20 bg-[linear-gradient(135deg,rgba(251,146,60,0.15),rgba(124,45,18,0.18))] text-orange-50',
        critical: 'border-red-300/20 bg-[linear-gradient(135deg,rgba(248,113,113,0.15),rgba(127,29,29,0.18))] text-red-50 animate-pulse',

    };

    const labels: Record<string, string> = {
        admin_preview: 'Admin Preview',
        pending_admin_confirmation: 'Pending Admin Confirmation',
        pending: 'Pending', scheduled: 'Scheduled', in_progress: 'In Progress', completed: 'Completed', cancelled: 'Cancelled', needs_reassignment: 'Needs Reassignment', unknown: 'Unknown',
        draft: 'Draft', pending_approval: 'Needs Approval', approved: 'Approved', synced: 'Synced', failed: 'Failed', void: 'Void',
        low: 'Low', normal: 'Medium', high: 'High', critical: 'Critical'
    };

    return (
        <Badge variant="outline" className={cn('h-8 rounded-full px-3 capitalize font-medium border shadow-sm backdrop-blur-md', styles[status] || 'border-white/10 bg-white/[0.05] text-white')}>
            {labels[status] || status.replace('_', ' ')}
        </Badge>
    );
}

function SearchableSelect({
    value,
    onChange,
    options,
    placeholder,
    searchPlaceholder,
    emptyLabel,
    disabled = false,
    variant = 'default',
}: {
    value: string;
    onChange: (value: string) => void;
    options: SearchableSelectOption[];
    placeholder: string;
    searchPlaceholder: string;
    emptyLabel: string;
    disabled?: boolean;
    variant?: 'default' | 'admin-dark';
}) {
    const [open, setOpen] = useState(false);
    const selectedOption = options.find((option) => option.value === value) ?? null;
    const isAdminDark = variant === 'admin-dark';

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    disabled={disabled}
                    className={cn(
                        'w-full min-w-0 justify-between overflow-hidden font-normal',
                        isAdminDark && 'h-14 rounded-[20px] border-white/10 bg-[linear-gradient(180deg,rgba(10,18,32,0.96),rgba(8,14,26,0.96))] px-4 text-left text-white shadow-none hover:bg-[linear-gradient(180deg,rgba(14,23,40,0.98),rgba(8,12,20,0.98))] hover:text-white'
                    )}
                >
                    <span className="min-w-0 flex-1 truncate pr-2 text-left" title={selectedOption?.label || placeholder}>
                        {selectedOption?.label || placeholder}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className={cn(
                    'w-[--radix-popover-trigger-width] max-w-[min(32rem,calc(100vw-2rem))] p-0',
                    isAdminDark && 'border-white/10 bg-[linear-gradient(180deg,rgba(14,23,40,0.98),rgba(8,12,20,0.98))] text-slate-100 shadow-[0_24px_60px_rgba(0,0,0,0.34)]'
                )}
                align="start"
            >
                <Command className={cn(isAdminDark && 'bg-transparent text-slate-100')}>
                    <CommandInput
                        placeholder={searchPlaceholder}
                        className={cn(isAdminDark && 'text-slate-100 placeholder:text-slate-500')}
                    />
                    <CommandList className={cn(isAdminDark && 'admin-dark-scrollbar')}>
                        <CommandEmpty>{emptyLabel}</CommandEmpty>
                        <CommandGroup>
                            {options.map((option) => (
                                <CommandItem
                                    key={option.value}
                                    value={`${option.label} ${option.value}`}
                                    className={cn(
                                        'gap-2',
                                        isAdminDark && 'rounded-xl text-slate-200 data-[selected=true]:bg-white/[0.08] data-[selected=true]:text-white'
                                    )}
                                    onSelect={() => {
                                        onChange(option.value);
                                        setOpen(false);
                                    }}
                                >
                                    <Check className={cn('h-4 w-4 shrink-0', value === option.value ? 'opacity-100' : 'opacity-0')} />
                                    <span className="min-w-0 flex-1 truncate" title={option.label}>{option.label}</span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

export default function JobsPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const { technicianAccounts } = useAuth();
    const [backendTechnicianRows, setBackendTechnicianRows] = useState<BackendTechnicianListItem[]>([]);
    const [technicianDetailsById, setTechnicianDetailsById] = useState<Record<string, { zones: string[]; skills: string[] }>>({});
    const technicianOptions = useMemo<TechnicianOption[]>(
        () => {
            if (backendTechnicianRows.length > 0) {
                return backendTechnicianRows.map((tech) => ({
                    id: tech.id,
                    name: tech.name,
                    zones: tech.zones.map((zone) => zone.name),
                    skills: tech.skills.map((skill) => skill.name),
                    isActive: tech.status === 'active',
                }));
            }

            return technicianAccounts.map((tech) => ({
                id: tech.id,
                name: tech.name,
                zones: technicianDetailsById[tech.id]?.zones ?? [],
                skills: technicianDetailsById[tech.id]?.skills ?? [],
                isActive: tech.isActive,
            }));
        },
        [backendTechnicianRows, technicianAccounts, technicianDetailsById],
    );
    const [serviceCatalog, setServiceCatalog] = useState<Array<{ id: string; name: string }>>([]);
    const [dealershipOptions, setDealershipOptions] = useState<DealershipOption[]>([]);
    const [dispatchRankingRules, setDispatchRankingRules] = useState<PriorityRule[]>([]);
    const dealershipNames = useMemo(
        () => dealershipOptions.map((entry) => entry.name),
        [dealershipOptions],
    );
    const serviceNames = useMemo(
        () => serviceCatalog.map((entry) => entry.name),
        [serviceCatalog],
    );
    const dealershipSelectOptions = useMemo<SearchableSelectOption[]>(
        () => dealershipNames.map((name) => ({ value: name, label: name })),
        [dealershipNames],
    );
    const serviceSelectOptions = useMemo<SearchableSelectOption[]>(
        () => serviceNames.map((name) => ({ value: name, label: name })),
        [serviceNames],
    );
    const technicianSelectOptions = useMemo<SearchableSelectOption[]>(
        () => [
            { value: 'unassigned', label: 'Unassigned' },
            ...technicianOptions.map((tech) => ({
                value: tech.name,
                label: tech.isActive ? tech.name : `${tech.name} (Inactive)`,
            })),
        ],
        [technicianOptions],
    );
    const initialNewJobForm: NewJobFormState = {
        dealership_name: dealershipNames[0] ?? '',
        service_name: serviceNames[0] ?? '',
        vehicle_summary: '2024 Ford F-150',
        urgency: 'normal',
        assigned_technician_name: 'unassigned',
        push_to_available: true,
    };

    // State
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<Job[]>([]);
    const [pagination, setPagination] = useState<PaginationState>({ page: 1, pageSize: 25, total: 0, totalPages: 0 });
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [createJobOpen, setCreateJobOpen] = useState(false);
    const [exportModalOpen, setExportModalOpen] = useState(false);
    const [assignSidebarOpen, setAssignSidebarOpen] = useState(false);
    const [jobToAssign, setJobToAssign] = useState<Job | null>(null);
    const [bulkAssignJobIds, setBulkAssignJobIds] = useState<string[]>([]);
    const [selectedTechnicianName, setSelectedTechnicianName] = useState<string>('unassigned');
    const [newJobForm, setNewJobForm] = useState<NewJobFormState>(initialNewJobForm);
    const [quickFilterCounts, setQuickFilterCounts] = useState<QuickFilterCounts>(EMPTY_QUICK_FILTER_COUNTS);
    const [activeQuickFilter, setActiveQuickFilter] = useState<QuickFilterKey | null>(null);
    const [jobSortMode, setJobSortMode] = useState<JobSortMode>('rank');
    const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const refreshInFlightRef = useRef(false);
    const lastRefreshStartedAtRef = useRef(0);
    const hasCompletedInitialBackendSyncRef = useRef(false);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [urgencyFilter, setUrgencyFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<StatusFilterKey>('all');
    const [dateFilter, setDateFilter] = useState('');

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const locationQuery = params.get('location');
        if (locationQuery) {
            setSearchQuery(locationQuery);
        }
    }, [location.search]);

    const assignJobZone = useMemo(() => {
        if (!jobToAssign) return '';
        return dealershipOptions.find((dealership) => dealership.name === jobToAssign.dealership_name)?.city ?? '';
    }, [dealershipOptions, jobToAssign]);

    const eligibleTechnicianIds = useMemo(() => {
        if (!jobToAssign) return new Set<string>();
        if (bulkAssignJobIds.length > 1) return new Set<string>();

        const requiredZone = normalizeText(assignJobZone);
        const service = normalizeText(jobToAssign.service_name);
        const serviceWords = textTokens(jobToAssign.service_name);

        return new Set(
            technicianOptions
                .filter((tech) => {
                    const hasZone =
                        requiredZone.length > 0 &&
                        tech.zones.some((zone) => normalizeText(zone) === requiredZone);
                    if (!hasZone) return false;

                    const hasSkill = tech.skills.some((skill) => {
                        const normalizedSkill = normalizeText(skill);
                        if (!normalizedSkill) return false;
                        if (service.includes(normalizedSkill) || normalizedSkill.includes(service)) return true;

                        const skillWords = textTokens(skill);
                        return skillWords.some((word) => serviceWords.includes(word));
                    });

                    return hasSkill;
                })
                .map((tech) => tech.id),
        );
    }, [assignJobZone, bulkAssignJobIds.length, jobToAssign, technicianOptions]);

    useEffect(() => {
        const token = getStoredAdminToken();
        if (!token) {
            setBackendTechnicianRows([]);
            setTechnicianDetailsById({});
            return;
        }

        let cancelled = false;
        const loadTechnicianDetails = async () => {
            try {
                const backendRows = await fetchAdminTechnicians(token);
                if (cancelled) {
                    return;
                }

                setBackendTechnicianRows(backendRows);
                const nextDetails: Record<string, { zones: string[]; skills: string[] }> = {};
                backendRows.forEach((row) => {
                    nextDetails[row.id] = {
                        zones: row.zones.map((zone) => zone.name),
                        skills: row.skills.map((skill) => skill.name),
                    };
                });
                setTechnicianDetailsById(nextDetails);
            } catch {
                if (!cancelled) {
                    setBackendTechnicianRows([]);
                    setTechnicianDetailsById({});
                }
            }
        };

        void loadTechnicianDetails();
        return () => {
            cancelled = true;
        };
    }, [technicianAccounts]);

    useEffect(() => {
        const token = getStoredAdminToken();
        if (!token) {
            setDealershipOptions([]);
            return;
        }

        let cancelled = false;
        const loadDealershipOptions = async () => {
            try {
                const rows = await fetchAdminDealerships(token);
                if (cancelled) {
                    return;
                }

                setDealershipOptions(
                    rows
                        .map(mapBackendDealershipOption)
                        .filter((row) => row.name.length > 0),
                );
            } catch {
                if (!cancelled) {
                    setDealershipOptions([]);
                }
            }
        };

        void loadDealershipOptions();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const token = getStoredAdminToken();
        if (!token) {
            setServiceCatalog([]);
            return;
        }

        let cancelled = false;
        const loadServiceCatalog = async () => {
            try {
                const rows = await fetchAdminServices(token, false);
                if (cancelled) return;
                const next = rows.map((row: BackendServiceCatalogItem) => ({
                    id: row.id,
                    name: (row.name || '').trim(),
                })).filter((row) => row.name.length > 0);
                setServiceCatalog(next);
            } catch {
                if (!cancelled) setServiceCatalog([]);
            }
        };

        void loadServiceCatalog();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const token = getStoredAdminToken();
        if (!token) {
            setDispatchRankingRules([]);
            return;
        }

        let cancelled = false;
        const loadPriorityRules = async () => {
            try {
                const rows = await fetchAdminPriorityRules(token);
                if (cancelled) return;
                setDispatchRankingRules(rows.map(mapBackendPriorityRule));
            } catch {
                if (!cancelled) setDispatchRankingRules([]);
            }
        };

        void loadPriorityRules();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (dealershipNames.length === 0) return;
        setNewJobForm((prev) => {
            if (prev.dealership_name) return prev;
            return { ...prev, dealership_name: dealershipNames[0] ?? '' };
        });
    }, [dealershipNames]);

    useEffect(() => {
        if (serviceNames.length === 0) return;
        setNewJobForm((prev) => {
            if (prev.service_name) return prev;
            return { ...prev, service_name: serviceNames[0] ?? '' };
        });
    }, [serviceNames]);

    const syncLegacyConfirmedLocalJobsToBackend = async (
        token: string,
        backendRows: BackendAdminJob[],
    ): Promise<BackendAdminJob[]> => {
        const backendCodes = new Set(backendRows.map((row) => row.job_code));
        const legacyScheduledJobs = loadPersistedJobs().filter((job) => (
            !isBackendPersistedJobId(job.job_id)
            && !backendCodes.has(job.job_code)
            && job.job_status === 'scheduled'
            && Boolean(job.assigned_technician_name?.trim())
        ));

        if (legacyScheduledJobs.length === 0) {
            return backendRows;
        }

        let syncedAny = false;
        for (const localJob of legacyScheduledJobs) {
            const assignedName = localJob.assigned_technician_name?.trim();
            if (!assignedName) continue;

            const assignedTech = technicianOptions.find((tech) => tech.name === assignedName);
            if (!assignedTech) continue;

            try {
                const created = await createAdminJob(token, {
                    job_code: localJob.job_code,
                    dealership_name: localJob.dealership_name,
                    service_name: localJob.service_name,
                    service_names: localJob.service_names,
                    vehicle_summary: localJob.vehicle_summary,
                    pre_assigned_technician_id: assignedTech.id,
                });
                const confirmed = await confirmAdminJob(token, created.id);
                reconcilePersistedJobIdByCode(localJob.job_code, confirmed.id);
                syncedAny = true;
            } catch (error) {
                console.warn('Failed to backfill local confirmed job to backend', localJob.job_code, error);
            }
        }

        if (!syncedAny) {
            return backendRows;
        }

        return fetchAdminJobs(token);
    };

    const syncBackendJobsFromApi = async (showErrorToast = false) => {
        const token = getStoredAdminToken();
        if (!token) {
            return false;
        }

        try {
            const existingJobCodes = new Set(loadPersistedJobs().map((job) => job.job_code));
            const backendJobs = await fetchAdminJobs(token);
            const syncedBackendJobs = await syncLegacyConfirmedLocalJobsToBackend(token, backendJobs);
            const newMakeJobs = hasCompletedInitialBackendSyncRef.current
                ? syncedBackendJobs.filter((row) => isMakeIntakeJob(row) && !existingJobCodes.has(row.job_code))
                : [];
            const didMerge = mergeBackendJobsIntoLocalStore(
                syncedBackendJobs,
                dealershipOptions,
                serviceCatalog,
                dispatchRankingRules,
            );
            if (didMerge) {
                if (newMakeJobs.length > 0) {
                    toast.info(
                        newMakeJobs.length === 1 ? 'New Make.com job received' : `${newMakeJobs.length} new Make.com jobs received`,
                        {
                            description: formatNewMakeJobsDescription(newMakeJobs),
                            duration: 10000,
                        },
                    );
                }
                hasCompletedInitialBackendSyncRef.current = true;
            }
            return didMerge;
        } catch (error) {
            if (showErrorToast) {
                const message = error instanceof Error ? error.message : 'Failed to refresh jobs from backend';
                toast.error(message);
            }
            return false;
        }
    };

    const fetchData = ({ background = false }: { background?: boolean } = {}) => {
        if (fetchTimerRef.current) {
            clearTimeout(fetchTimerRef.current);
            fetchTimerRef.current = null;
        }

        if (!background || data.length === 0) {
            setLoading(true);
        }

        // Simulate API Latency and Server-Side Filtering
        fetchTimerRef.current = setTimeout(() => {
            const allJobs = [...loadPersistedJobs()];
            setQuickFilterCounts(calculateQuickFilterCounts(allJobs));

            let filtered = [...allJobs];

            // Filter logic (simulating backend)
            if (searchQuery) {
                const lower = searchQuery.toLowerCase();
                filtered = filtered.filter(j =>
                    j.job_code.toLowerCase().includes(lower)
                    || j.job_id.toLowerCase().includes(lower)
                    || j.dealership_name.toLowerCase().includes(lower)
                    || j.service_name.toLowerCase().includes(lower)
                    || j.service_names.join(' ').toLowerCase().includes(lower)
                    || (j.assigned_technician_name ?? '').toLowerCase().includes(lower)
                    || (j.pending_assigned_technician_name ?? '').toLowerCase().includes(lower)
                    || j.vehicle_summary.toLowerCase().includes(lower)
                );
            }
            if (urgencyFilter !== 'all') filtered = filtered.filter(j => j.urgency === urgencyFilter);
            if (statusFilter !== 'all') filtered = filtered.filter(j => matchesStatusFilter(j, statusFilter));
            if (dateFilter) filtered = filtered.filter(j => toLocalDateFilterValue(j.created_at) === dateFilter);
            if (activeQuickFilter) filtered = filtered.filter(j => matchesQuickFilter(j, activeQuickFilter));

            if (jobSortMode === 'created_newest') {
                filtered = [...filtered].sort((a, b) => getSortableTimestamp(b.created_at) - getSortableTimestamp(a.created_at));
            } else if (jobSortMode === 'created_oldest') {
                filtered = [...filtered].sort((a, b) => getSortableTimestamp(a.created_at) - getSortableTimestamp(b.created_at));
            } else if (jobSortMode === 'urgency') {
                const urgencyRank: Record<Urgency, number> = { critical: 4, high: 3, normal: 2, low: 1 };
                filtered = [...filtered].sort((a, b) => urgencyRank[b.urgency] - urgencyRank[a.urgency]);
            } else if (jobSortMode === 'status') {
                const statusOrder: Record<JobStatus, number> = {
                    admin_preview: 1,
                    pending_admin_confirmation: 2,
                    pending: 3,
                    scheduled: 4,
                    in_progress: 5,
                    completed: 6,
                    cancelled: 7,
                    unknown: 8,
                };
                filtered = [...filtered].sort((a, b) => statusOrder[a.job_status] - statusOrder[b.job_status]);
            } else if (jobSortMode === 'job_id') {
                filtered = [...filtered].sort((a, b) => a.job_id.localeCompare(b.job_id));
            } else {
                filtered = [...filtered].sort((a, b) => {
                    const rankingDelta = (b.ranking_score || 0) - (a.ranking_score || 0);
                    if (rankingDelta !== 0) {
                        return rankingDelta;
                    }
                    return getSortableTimestamp(b.created_at) - getSortableTimestamp(a.created_at);
                });
            }

            const total = filtered.length;
            const computedTotalPages = Math.ceil(total / pagination.pageSize);
            const totalPages = total === 0 ? 1 : computedTotalPages;
            const nextPage = total === 0 ? 1 : Math.min(pagination.page, totalPages);
            const start = (nextPage - 1) * pagination.pageSize;
            const paginatedData = filtered.slice(start, start + pagination.pageSize);

            setData(paginatedData);
            setPagination(prev => ({ ...prev, page: nextPage, total, totalPages }));
            setLoading(false);
            fetchTimerRef.current = null;
        }, 600);
    };

    const refreshJobs = ({
        showErrorToast = false,
        background = true,
    }: {
        showErrorToast?: boolean;
        background?: boolean;
    } = {}) => {
        if (refreshInFlightRef.current) {
            return;
        }

        refreshInFlightRef.current = true;
        lastRefreshStartedAtRef.current = Date.now();
        void (async () => {
            try {
                await syncBackendJobsFromApi(showErrorToast);
                fetchData({ background });
            } finally {
                refreshInFlightRef.current = false;
            }
        })();
    };

    useEffect(() => {
        fetchData();
    }, [pagination.page, pagination.pageSize, searchQuery, urgencyFilter, statusFilter, dateFilter, activeQuickFilter, jobSortMode]);

    useEffect(() => {
        refreshJobs({ background: false });
    }, []);

    useEffect(() => {
        if (dealershipOptions.length === 0 || dispatchRankingRules.length === 0) {
            return;
        }
        refreshJobs({ background: true });
    }, [dealershipOptions, serviceCatalog, dispatchRankingRules]);

    useEffect(() => {
        const maybeRefreshInBackground = () => {
            if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
                return;
            }
            refreshJobs({ background: true });
        };

        const intervalId = window.setInterval(() => {
            maybeRefreshInBackground();
        }, 30000);
        const onFocus = () => {
            if (Date.now() - lastRefreshStartedAtRef.current < 15000) {
                return;
            }
            maybeRefreshInBackground();
        };
        const onHeaderRefresh = () => {
            refreshJobs({ showErrorToast: true, background: false });
        };
        window.addEventListener('focus', onFocus);
        window.addEventListener(ADMIN_REFRESH_EVENT, onHeaderRefresh);
        return () => {
            window.clearInterval(intervalId);
            window.removeEventListener('focus', onFocus);
            window.removeEventListener(ADMIN_REFRESH_EVENT, onHeaderRefresh);
        };
    }, []);

    useEffect(() => {
        return () => {
            if (fetchTimerRef.current) {
                clearTimeout(fetchTimerRef.current);
                fetchTimerRef.current = null;
            }
        };
    }, []);

    // Handlers
    const handleSelectAll = (checked: boolean | 'indeterminate') => {
        const visibleJobIds = data.map((job) => job.job_id);
        setSelectedRows((prev) => {
            const next = new Set(prev);
            if (checked === true) {
                visibleJobIds.forEach((id) => next.add(id));
                return next;
            }
            visibleJobIds.forEach((id) => next.delete(id));
            return next;
        });
    };

    const handleSelectRow = (id: string, checked: boolean) => {
        const newSelected = new Set(selectedRows);
        if (checked) newSelected.add(id);
        else newSelected.delete(id);
        setSelectedRows(newSelected);
    };

    const clearFilters = () => {
        setSearchQuery('');
        setUrgencyFilter('all');
        setStatusFilter('all');
        setDateFilter('');
        setActiveQuickFilter(null);
        setPagination(p => ({ ...p, page: 1 }));
    };

    const handleQuickFilterChipClick = (filterKey: QuickFilterKey) => {
        setPagination((prev) => ({ ...prev, page: 1 }));
        setActiveQuickFilter((prev) => (prev === filterKey ? null : filterKey));
    };

    const handleSortModeChange = (mode: JobSortMode) => {
        setPagination((prev) => ({ ...prev, page: 1 }));
        setJobSortMode(mode);
    };

    const handleCreateJob = async () => {
        const dealershipName = newJobForm.dealership_name.trim();
        const serviceNamesInput = parseServiceNames(newJobForm.service_name);
        const serviceName = serviceNamesInput[0] ?? '';
        const vehicleSummary = newJobForm.vehicle_summary.trim();

        if (!dealershipName || !serviceName || !vehicleSummary) {
            alert('Dealership, service, and vehicle are required.');
            return;
        }

        const dealership = dealershipOptions.find((entry) => entry.name === dealershipName);
        const service = serviceCatalog.find((entry) => entry.name === serviceName);
        const vehicleMake = vehicleSummary.split(' ')[1] || '';

        const priorityResult = calculateJobRanking({
            dealershipId: dealership?.code || dealershipName,
            serviceId: service?.id || '',
            urgency: urgencyToPriorityMap[newJobForm.urgency],
            vehicleMake,
        }, dispatchRankingRules);

        const pendingAssignedTechnicianName =
            newJobForm.assigned_technician_name === 'unassigned'
                ? null
                : newJobForm.assigned_technician_name;
        const selectedTechnician =
            pendingAssignedTechnicianName
                ? technicianOptions.find((tech) => tech.name === pendingAssignedTechnicianName) ?? null
                : null;

        if (pendingAssignedTechnicianName && !selectedTechnician) {
            toast.error('Selected technician could not be found. Please refresh and try again.');
            return;
        }

        let createdBackendJob: BackendAdminJob | null = null;
        const token = getStoredAdminToken();
        if (token) {
            try {
                createdBackendJob = await createAdminJob(token, {
                    dealership_name: dealershipName,
                    service_name: serviceName,
                    service_names: serviceNamesInput,
                    vehicle_summary: vehicleSummary,
                    pre_assigned_technician_id: selectedTechnician?.id ?? null,
                });
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Failed to create job';
                toast.error(message);
                return;
            }
        }

        const nowIso = new Date().toISOString();
        const baseUiJob = createdBackendJob
            ? mapBackendJobToUiJob(createdBackendJob, dealershipOptions, serviceCatalog, dispatchRankingRules)
            : ({
                job_id: `job-local-${Date.now()}`,
                job_code: `NEW-${String(Date.now()).slice(-6)}`,
                dealership_code: dealership?.code ?? null,
                dealership_name: dealershipName,
                service_name: serviceName,
                service_names: serviceNamesInput.length > 0 ? serviceNamesInput : [serviceName],
                vehicle_summary: vehicleSummary,
                urgency: priorityToUrgencyMap[priorityResult.finalUrgency] || newJobForm.urgency,
                assigned_technician_name: null,
                pending_assigned_technician_name: pendingAssignedTechnicianName,
                job_status: 'admin_preview',
                invoice_state: 'draft',
                attention_flag: false,
                created_at: nowIso,
                updated_at: nowIso,
                source_system: 'admin_ui',
                source_metadata: {
                    source: 'admin_ui',
                    manual_entry: true,
                    dealership_name_input: dealershipName,
                    created_by_role: 'admin',
                },
                allowed_actions: ['view', 'edit', 'cancel', 'assign', 'confirm'],
                ranking_score: priorityResult.score,
                applied_rules: priorityResult.appliedRules,
                requires_admin_confirmation: true,
                admin_confirmed_at: null,
                pending_push_to_available: Boolean(newJobForm.push_to_available),
            } as Job);

        const newJob: Job = {
            ...baseUiJob,
            urgency: priorityToUrgencyMap[priorityResult.finalUrgency] || baseUiJob.urgency,
            ranking_score: priorityResult.score,
            applied_rules: priorityResult.appliedRules,
            pending_push_to_available: Boolean(newJobForm.push_to_available),
        };

        const nextPersisted = [
            newJob,
            ...loadPersistedJobs().filter((row) => row.job_code !== newJob.job_code),
        ];
        persistJobs(nextPersisted);

        appendAuditLog(
            'job.created',
            `Job ${newJob.job_code} created and sent to admin preview`,
            {
                job_id: newJob.job_id,
                job_code: newJob.job_code,
                dealership_name: newJob.dealership_name,
                service_name: newJob.service_name,
                status: newJob.job_status,
                pushed_to_available_queue_after_confirmation: newJobForm.push_to_available,
                persisted_to_backend: Boolean(createdBackendJob),
            }
        );

        setCreateJobOpen(false);
        setNewJobForm(initialNewJobForm);
        setPagination((prev) => ({ ...prev, page: 1 }));
        refreshJobs({ showErrorToast: true, background: false });
    };

    const updatePersistedJob = (jobId: string, updater: (job: Job) => Job) => {
        const current = loadPersistedJobs();
        const next = current.map((job) => (job.job_id === jobId ? updater(job) : job));
        persistJobs(next);
        return next.find((job) => job.job_id === jobId) ?? null;
    };

    const reconcilePersistedJobIdByCode = (jobCode: string, nextJobId: string) => {
        const current = loadPersistedJobs();
        const next = current.map((row) => {
            if (row.job_code !== jobCode) return row;
            return { ...row, job_id: nextJobId };
        });
        persistJobs(next);
    };

    const handleConfirmJob = async (job: Job) => {
        if (job.job_status !== 'admin_preview' && job.job_status !== 'pending_admin_confirmation') {
            toast.info('Only jobs pending admin confirmation can be confirmed.');
            return;
        }
        const taggedTechnicianName =
            job.pending_assigned_technician_name?.trim()
            || job.assigned_technician_name?.trim()
            || '';
        if (!taggedTechnicianName) {
            toast.warning('Assign a technician before confirming this job.');
            return;
        }

        if (!window.confirm(`Confirm ${job.job_code} and send it to technician portal?`)) {
            return;
        }

        let confirmedJobId = job.job_id;
        let confirmedBackendJob: BackendAdminJob | null = null;
        const token = getStoredAdminToken();
        if (isBackendPersistedJobId(job.job_id) && !token) {
            toast.error('Admin session is required to confirm synced jobs.');
            return;
        }
        if (token) {
            try {
                const backendRows = await fetchAdminJobs(token);
                let backendJob = backendRows.find((row) => row.job_code === job.job_code);
                if (!backendJob && !isBackendPersistedJobId(job.job_id)) {
                    const selectedTechnician =
                        taggedTechnicianName
                            ? technicianOptions.find((tech) => tech.name === taggedTechnicianName) ?? null
                            : null;
                    if (taggedTechnicianName && !selectedTechnician) {
                        toast.error('Assigned technician was not found. Please re-assign and confirm again.');
                        return;
                    }

                    backendJob = await createAdminJob(token, {
                        job_code: job.job_code,
                        dealership_name: job.dealership_name,
                        service_name: job.service_name,
                        service_names: job.service_names,
                        vehicle_summary: job.vehicle_summary,
                        pre_assigned_technician_id: selectedTechnician?.id ?? null,
                    });
                }
                if (backendJob) {
                    confirmedBackendJob = await confirmAdminJob(token, backendJob.id);
                    confirmedJobId = backendJob.id;
                    reconcilePersistedJobIdByCode(job.job_code, backendJob.id);
                } else if (isBackendPersistedJobId(job.job_id)) {
                    toast.error('Job not found in backend. Please refresh jobs.');
                    fetchData();
                    return;
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Failed to confirm job';
                toast.error(message);
                return;
            }
        }

        if (confirmedBackendJob) {
            const mapped = mapBackendJobToUiJob(
                confirmedBackendJob,
                dealershipOptions,
                serviceCatalog,
                dispatchRankingRules,
            );
            updatePersistedJob(confirmedJobId, (current) => ({
                ...current,
                ...mapped,
                invoice_state: current.invoice_state ?? mapped.invoice_state,
                attention_flag: current.attention_flag ?? mapped.attention_flag,
            }));
        } else {
            const nowIso = new Date().toISOString();
            const nextPendingAssignedName =
                job.pending_assigned_technician_name
                ?? job.assigned_technician_name
                ?? null;
            updatePersistedJob(confirmedJobId, (current) => ({
                ...current,
                assigned_technician_name: nextPendingAssignedName,
                pending_assigned_technician_name: null,
                job_status: nextPendingAssignedName ? 'scheduled' : 'pending',
                requires_admin_confirmation: false,
                admin_confirmed_at: nowIso,
                pending_push_to_available: false,
                updated_at: nowIso,
                allowed_actions: ['view', 'edit', 'cancel', 'assign'],
            }));
        }

        appendAuditLog(
            'job.confirmed',
            `Job ${job.job_code} confirmed and pushed to technician queue`,
            {
                job_id: confirmedJobId,
                job_code: job.job_code,
                assigned_technician_name:
                    confirmedBackendJob?.assigned_technician_name
                    ?? job.pending_assigned_technician_name
                    ?? job.assigned_technician_name
                    ?? null,
            },
        );
        toast.success(`${job.job_code} confirmed and sent to technician portal`);
        refreshJobs({ showErrorToast: true, background: false });
    };

    const handleAssignTechnician = (job: Job) => {
        if (!isAssignableJob(job)) {
            toast.warning('Completed or cancelled jobs cannot be assigned.');
            return;
        }
        setBulkAssignJobIds([]);
        setJobToAssign(job);
        setSelectedTechnicianName(job.assigned_technician_name ?? job.pending_assigned_technician_name ?? 'unassigned');
        setAssignSidebarOpen(true);
    };

    const handleBulkAssignTechnician = () => {
        if (selectedRows.size === 0) {
            toast.info('Select at least one job to assign a technician.');
            return;
        }

        const selectedJobs = loadPersistedJobs()
            .filter((job) => selectedRows.has(job.job_id))
            .filter((job) => isAssignableJob(job));

        if (selectedJobs.length === 0) {
            toast.warning('Selected jobs cannot be assigned because they are completed or cancelled.');
            return;
        }

        const anchorJob = selectedJobs[0];
        setBulkAssignJobIds(selectedJobs.map((job) => job.job_id));
        setJobToAssign(anchorJob);
        setSelectedTechnicianName(anchorJob.assigned_technician_name ?? anchorJob.pending_assigned_technician_name ?? 'unassigned');
        setAssignSidebarOpen(true);
    };

    const submitTechnicianAssignment = async () => {
        const targetJobIds = bulkAssignJobIds.length > 0
            ? bulkAssignJobIds
            : (jobToAssign ? [jobToAssign.job_id] : []);

        if (targetJobIds.length === 0) {
            toast.info('No jobs selected for assignment.');
            return;
        }

        let nextAssignedName: string | null = null;
        let nextAssignedId: string | null = null;
        if (selectedTechnicianName !== 'unassigned') {
            const found = technicianOptions.find((tech) => tech.name === selectedTechnicianName);
            if (!found) {
                window.alert('Invalid technician selected.');
                return;
            }
            if (!found.isActive) {
                toast.error('Selected technician is inactive. Choose an active technician.');
                return;
            }
            nextAssignedName = found.name;
            nextAssignedId = found.id;
        }

        const targetJobIdSet = new Set(targetJobIds);
        const current = loadPersistedJobs();
        const candidateJobs = current.filter((job) => targetJobIdSet.has(job.job_id) && isAssignableJob(job));
        if (candidateJobs.length === 0) {
            toast.warning('No selected jobs could be updated.');
            return;
        }

        const backendJobs = candidateJobs.filter((job) => isBackendPersistedJobId(job.job_id));
        let successfulBackendJobIds = new Set<string>();
        let failedBackendCount = 0;
        let failedBackendReasons: string[] = [];
        if (backendJobs.length > 0) {
            const token = getStoredAdminToken();
            if (!token) {
                toast.error('Admin session is missing. Please sign in again and retry.');
                return;
            }
            if (nextAssignedId && !UUID_V4ISH_PATTERN.test(nextAssignedId)) {
                toast.error('Technician list is not synced with backend yet. Refresh and try again.');
                return;
            }

            const results = await Promise.allSettled(
                backendJobs.map((job) =>
                    updateAdminJobAssignment(token, job.job_id, { assigned_technician_id: nextAssignedId }),
                ),
            );
            successfulBackendJobIds = new Set(
                backendJobs
                    .filter((_, index) => results[index]?.status === 'fulfilled')
                    .map((job) => job.job_id),
            );
            failedBackendCount = results.filter((result) => result.status === 'rejected').length;
            failedBackendReasons = results
                .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
                .map((result) => result.reason instanceof Error ? result.reason.message : 'Backend assignment update failed');
        }

        const applyUpdateToJobIds = new Set(
            candidateJobs
                .filter((job) => !isBackendPersistedJobId(job.job_id) || successfulBackendJobIds.has(job.job_id))
                .map((job) => job.job_id),
        );
        if (applyUpdateToJobIds.size === 0) {
            toast.error(failedBackendReasons[0] ?? 'Assignment could not be saved. Please try again.');
            return;
        }

        const nowIso = new Date().toISOString();
        const updatedJobCodes: string[] = [];
        const updatedJobIds: string[] = [];
        const next = current.map((job) => {
            if (!applyUpdateToJobIds.has(job.job_id)) {
                return job;
            }

            updatedJobCodes.push(job.job_code);
            updatedJobIds.push(job.job_id);
            const nextJobStatus: JobStatus =
                nextAssignedName
                    ? (job.job_status === 'pending' ? 'scheduled' : job.job_status)
                    : (job.job_status === 'scheduled' ? 'pending' : job.job_status);
            return {
                ...job,
                assigned_technician_name: nextAssignedName,
                pending_assigned_technician_name: null,
                job_status: nextJobStatus,
                updated_at: nowIso,
            };
        });

        persistJobs(next);

        appendAuditLog(
            updatedJobIds.length > 1 ? 'job.assigned.bulk' : 'job.assigned',
            updatedJobIds.length > 1
                ? `Technician assignment updated for ${updatedJobIds.length} jobs`
                : `Technician assignment updated for ${updatedJobCodes[0]}`,
            {
                job_ids: updatedJobIds,
                job_codes: updatedJobCodes,
                assigned_technician_name: nextAssignedName,
            },
        );

        if (failedBackendCount > 0) {
            const firstBackendError = failedBackendReasons[0];
            toast.warning(
                firstBackendError
                    ? `Saved ${updatedJobIds.length} assignment(s), but ${failedBackendCount} backend update(s) failed: ${firstBackendError}`
                    : `Saved ${updatedJobIds.length} assignment(s), but ${failedBackendCount} backend update(s) failed.`,
            );
        } else {
            toast.success(
                updatedJobIds.length > 1
                    ? `Assigned technician to ${updatedJobIds.length} jobs`
                    : `Assignment saved for ${updatedJobCodes[0]}`,
            );
        }

        setAssignSidebarOpen(false);
        setJobToAssign(null);
        setBulkAssignJobIds([]);
        setSelectedTechnicianName('unassigned');
        setSelectedRows((prev) => {
            const nextSelection = new Set(prev);
            updatedJobIds.forEach((id) => nextSelection.delete(id));
            return nextSelection;
        });
        refreshJobs({ showErrorToast: true, background: true });
    };

    const handleBulkRemoveJobs = async () => {
        if (selectedRows.size === 0) {
            toast.info('Select at least one job to remove.');
            return;
        }

        const selectedJobIdSet = new Set(selectedRows);
        const currentJobs = loadPersistedJobs();
        const jobsToRemove = currentJobs.filter((job) => selectedJobIdSet.has(job.job_id));

        if (jobsToRemove.length === 0) {
            toast.warning('No selected jobs were found.');
            return;
        }

        const confirmMessage = jobsToRemove.length === 1
            ? `Remove job ${jobsToRemove[0].job_code}?`
            : `Remove ${jobsToRemove.length} selected jobs?`;

        if (!window.confirm(`${confirmMessage} This cannot be undone.`)) {
            return;
        }

        const backendJobsToRemove = jobsToRemove.filter((job) => isBackendPersistedJobId(job.job_id));
        const localOnlyJobsToRemove = jobsToRemove.filter((job) => !isBackendPersistedJobId(job.job_id));

        const backendDeletedJobIds = new Set<string>();
        const backendDeleteFailures: Array<{ job_id: string; job_code: string; reason: string }> = [];

        if (backendJobsToRemove.length > 0) {
            const token = getStoredAdminToken();
            if (!token) {
                toast.error('Admin session is required to remove synced jobs.');
                return;
            }

            const deleteResults = await Promise.allSettled(
                backendJobsToRemove.map(async (job) => {
                    await deleteAdminJob(token, job.job_id);
                    return job;
                }),
            );

            deleteResults.forEach((result, index) => {
                const job = backendJobsToRemove[index];
                if (result.status === 'fulfilled') {
                    backendDeletedJobIds.add(job.job_id);
                    return;
                }

                backendDeleteFailures.push({
                    job_id: job.job_id,
                    job_code: job.job_code,
                    reason: result.reason instanceof Error ? result.reason.message : 'Delete failed',
                });
            });
        }

        const successfullyRemovedJobs = [
            ...localOnlyJobsToRemove,
            ...backendJobsToRemove.filter((job) => backendDeletedJobIds.has(job.job_id)),
        ];

        if (successfullyRemovedJobs.length === 0) {
            toast.error(
                backendDeleteFailures.length > 0
                    ? backendDeleteFailures[0].reason
                    : 'No selected jobs could be removed.',
            );
            return;
        }

        const removedJobIds = successfullyRemovedJobs.map((job) => job.job_id);
        const removedJobCodes = successfullyRemovedJobs.map((job) => job.job_code);
        const removedJobIdSet = new Set(removedJobIds);

        const nextJobs = currentJobs.filter((job) => !removedJobIdSet.has(job.job_id));
        persistJobs(nextJobs);
        appendAuditLog(
            removedJobIds.length > 1 ? 'job.removed.bulk' : 'job.removed',
            removedJobIds.length > 1
                ? `${removedJobIds.length} jobs removed`
                : `Job ${removedJobCodes[0]} removed`,
            {
                job_ids: removedJobIds,
                job_codes: removedJobCodes,
            },
            'warning',
        );

        if (jobToAssign && removedJobIdSet.has(jobToAssign.job_id)) {
            setAssignSidebarOpen(false);
            setJobToAssign(null);
            setBulkAssignJobIds([]);
            setSelectedTechnicianName('unassigned');
        }

        setSelectedRows(new Set());
        setPagination((prev) => ({ ...prev, page: 1 }));
        toast.success(
            removedJobIds.length > 1
                ? `${removedJobIds.length} jobs removed`
                : `${removedJobCodes[0]} removed`,
        );
        if (backendDeleteFailures.length > 0) {
            toast.warning(
                backendDeleteFailures.length > 1
                    ? `${backendDeleteFailures.length} jobs could not be removed`
                    : `${backendDeleteFailures[0].job_code} could not be removed`,
            );
        }
        refreshJobs({ showErrorToast: true, background: false });
    };
    const getJobsForExport = () => (
        selectedRows.size > 0
            ? loadPersistedJobs().filter((job) => selectedRows.has(job.job_id))
            : data
    );

    const getJobExportRows = (jobsToExport: Job[]) => jobsToExport.map((job) => ({
        JobId: job.job_id,
        JobCode: job.job_code,
        Dealership: job.dealership_name,
        Location: getJobLocationLabel(job, dealershipOptions),
        Service: job.service_name,
        Vehicle: job.vehicle_summary,
        Urgency: job.urgency,
        Technician: job.assigned_technician_name || '',
        RankingScore: job.ranking_score ?? 0,
        JobStatus: job.job_status,
        CreatedDate: formatJobDate(job.created_at),
        CreatedTime: formatJobTime(job.created_at),
        LastUpdatedDate: formatJobDate(job.updated_at),
        LastUpdatedTime: formatJobTime(job.updated_at),
    }));

    const handleExport = (selectedColumns: string[], format: ExportFormat = 'csv') => {
        const exportRows = getJobExportRows(getJobsForExport());
        const exportData = selectColumnsForExport(exportRows, selectedColumns);
        const filename = selectedRows.size > 0 ? 'jobs_selected_export' : 'jobs_export';
        exportArrayData(exportData, filename, format);
    };

    const isBulkAssignMode = bulkAssignJobIds.length > 0;
    const bulkAssignSelectionCount = bulkAssignJobIds.length;
    const footerStart = pagination.total === 0 ? 0 : ((pagination.page - 1) * pagination.pageSize) + 1;
    const footerEnd = pagination.total === 0 ? 0 : Math.min(pagination.page * pagination.pageSize, pagination.total);
    const visibleSelectedCount = data.filter((job) => selectedRows.has(job.job_id)).length;
    const headerCheckboxState: boolean | 'indeterminate' = data.length === 0
        ? false
        : visibleSelectedCount === data.length
            ? true
            : visibleSelectedCount > 0
                ? 'indeterminate'
                : false;
    const activeFilterCount = [
        Boolean(searchQuery.trim()),
        urgencyFilter !== 'all',
        statusFilter !== 'all',
        Boolean(dateFilter),
        activeQuickFilter !== null,
    ].filter(Boolean).length;
    const jobSortBadgeLabel =
        jobSortMode === 'created_newest'
            ? 'Created newest first'
            : jobSortMode === 'created_oldest'
                ? 'Created oldest first'
                : jobSortMode === 'urgency'
                    ? 'Sorted by urgency'
                    : jobSortMode === 'status'
                        ? 'Sorted by status'
                        : jobSortMode === 'job_id'
                            ? 'Sorted by job ID'
                            : 'Sorted by rank';
    const JobDetailsSortIcon =
        jobSortMode === 'created_newest'
            ? ArrowDown
            : jobSortMode === 'created_oldest'
                ? ArrowUp
                : ArrowUpDown;
    const statusFilterOptions = [
        { key: 'all' as const, label: 'All' },
        { key: 'unassigned' as const, label: 'Unassigned' },
        { key: 'assigned' as const, label: 'Assigned' },
        { key: 'accepted' as const, label: 'Accepted' },
        { key: 'in_progress' as const, label: 'In Progress' },
        { key: 'delayed' as const, label: 'Delayed' },
        { key: 'completed' as const, label: 'Completed' },
        { key: 'refused' as const, label: 'Refused' },
    ] as const;

    return (
        <div className="relative flex h-full flex-col space-y-6" style={bodyFontStyle}>

            <section className="relative overflow-hidden rounded-[26px] border border-black/8 bg-[linear-gradient(135deg,#ffffff,#fbfbfb)] shadow-[0_22px_72px_rgba(15,23,42,0.08)] dark:border-white/8 dark:bg-[linear-gradient(135deg,rgba(8,24,39,0.985),rgba(7,18,31,0.985))] dark:shadow-[0_22px_72px_rgba(0,0,0,0.28)]">
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.03)_1px,transparent_1px)] bg-[size:120px_120px] opacity-16 dark:bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)]" />
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-900/20 to-transparent dark:via-cyan-200/70" />
                <div className="pointer-events-none absolute left-8 top-8 h-36 w-36 rounded-full bg-slate-200/80 blur-3xl dark:bg-cyan-400/8" />
                <div className="pointer-events-none absolute right-10 top-10 h-40 w-40 rounded-full bg-slate-100 blur-3xl dark:bg-blue-400/6" />
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(15,23,42,0.05),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(15,23,42,0.03),transparent_22%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(47,142,146,0.10),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.08),transparent_22%)]" />

                <div className="relative flex flex-col gap-6 p-6 xl:flex-row xl:items-end xl:justify-between xl:p-7">
                    <div>
                        <div
                            className="inline-flex items-center gap-2 rounded-full border border-black/8 bg-slate-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.26em] text-slate-700 dark:border-cyan-300/14 dark:bg-cyan-300/[0.08] dark:text-cyan-100"
                            style={displayFontStyle}
                        >
                            <Sparkles className="h-3.5 w-3.5" />
                            Operations Queue
                        </div>

                        <h1
                            className="mt-4 text-[2.1rem] font-semibold leading-[0.94] tracking-[-0.05em] text-slate-900 dark:text-white md:text-[2.45rem]"
                            style={displayFontStyle}
                        >
                            Jobs
                        </h1>

                        <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-[14px]">
                            Manage jobs and assignments.
                        </p>

                        <div className="mt-5 flex flex-wrap items-center gap-2.5">
                            {selectedRows.size > 0 ? (
                                <Badge variant="outline" className="h-8 rounded-full border-black/8 bg-slate-50 px-4 text-slate-700 dark:border-white/8 dark:bg-white/[0.04] dark:text-white">
                                    <Users className="mr-1.5 h-3.5 w-3.5" />
                                    {selectedRows.size} selected
                                </Badge>
                            ) : null}
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 xl:justify-end">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-10 gap-2 rounded-2xl border-black/8 bg-white px-4 text-slate-700 shadow-none hover:bg-slate-50 hover:text-slate-900 dark:border-white/8 dark:bg-white/[0.04] dark:text-slate-100 dark:hover:bg-white/[0.08] dark:hover:text-white"
                            onClick={() => refreshJobs({ showErrorToast: true, background: false })}
                            disabled={loading}
                        >
                            <RefreshCw className={cn('h-4 w-4 text-slate-500 dark:text-slate-300', loading && 'animate-spin')} />
                            Refresh
                        </Button>
                        <Button
                            size="sm"
                            className="h-10 gap-2 rounded-2xl bg-slate-900 px-4 text-white shadow-[0_14px_32px_rgba(15,23,42,0.16)] hover:bg-slate-800 dark:bg-gradient-to-r dark:from-[#0ca6a6] dark:to-[#149fcb] dark:shadow-[0_14px_32px_rgba(12,166,166,0.2)] dark:hover:from-[#11b5b5] dark:hover:to-[#1aaedf]"
                            onClick={() => setCreateJobOpen(true)}
                        >
                            <Plus className="h-4 w-4" />
                            New Job
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-10 gap-2 rounded-2xl border-black/8 bg-white px-4 text-slate-700 shadow-none hover:bg-slate-50 hover:text-slate-900 dark:border-white/8 dark:bg-white/[0.04] dark:text-slate-100 dark:hover:bg-white/[0.08] dark:hover:text-white"
                            onClick={() => setExportModalOpen(true)}
                        >
                            <Download className="h-4 w-4 text-slate-500 dark:text-slate-300" />
                            Export Excel
                        </Button>
                    </div>
                </div>
            </section>

            <Dialog open={createJobOpen} onOpenChange={setCreateJobOpen}>
                <DialogContent className="border-white/10 bg-[linear-gradient(180deg,rgba(11,20,36,0.99),rgba(8,12,20,1))] text-white shadow-[0_40px_120px_rgba(0,0,0,0.45)] sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle className="text-white">Create New Job</DialogTitle>
                        <DialogDescription className="text-slate-300">
                            Create a preview job for admin review.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-white">Dealership</Label>
                                {dealershipSelectOptions.length > 0 ? (
                                    <SearchableSelect
                                        value={newJobForm.dealership_name}
                                        onChange={(value) => setNewJobForm((prev) => ({ ...prev, dealership_name: value }))}
                                        options={dealershipSelectOptions}
                                        placeholder="Select dealership"
                                        searchPlaceholder="Search dealership..."
                                        emptyLabel="No dealership found."
                                        variant="admin-dark"
                                    />
                                ) : (
                                    <>
                                        <Input
                                            value={newJobForm.dealership_name}
                                            onChange={(event) => setNewJobForm((prev) => ({ ...prev, dealership_name: event.target.value }))}
                                            placeholder="Type dealership name"
                                            className="h-14 rounded-[20px] border-white/10 bg-[linear-gradient(180deg,rgba(10,18,32,0.96),rgba(8,14,26,0.96))] text-white placeholder:text-slate-500"
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Type a dealership name manually.
                                        </p>
                                    </>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label className="text-white">Service</Label>
                                <SearchableSelect
                                    value={newJobForm.service_name}
                                    onChange={(value) => setNewJobForm((prev) => ({ ...prev, service_name: value }))}
                                    options={serviceSelectOptions}
                                    placeholder={serviceNames.length > 0 ? 'Select service' : 'No services available'}
                                    searchPlaceholder="Search service..."
                                    emptyLabel="No service found."
                                    disabled={serviceSelectOptions.length === 0}
                                    variant="admin-dark"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Choose a service.
                                </p>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-white">Vehicle Summary</Label>
                            <Input
                                value={newJobForm.vehicle_summary}
                                onChange={(event) => setNewJobForm((prev) => ({ ...prev, vehicle_summary: event.target.value }))}
                                placeholder="e.g. 2024 Audi A4"
                                className="h-14 rounded-[20px] border-white/10 bg-[linear-gradient(180deg,rgba(10,18,32,0.96),rgba(8,14,26,0.96))] text-white placeholder:text-slate-500"
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-white">Urgency</Label>
                                <Select
                                    value={newJobForm.urgency}
                                    onValueChange={(value) => setNewJobForm((prev) => ({ ...prev, urgency: value as Urgency }))}
                                >
                                    <SelectTrigger className="h-14 rounded-[20px] border-white/10 bg-[linear-gradient(180deg,rgba(10,18,32,0.96),rgba(8,14,26,0.96))] text-white focus:border-[#7db0ff]/45 focus:ring-[#7db0ff]/20">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="admin-dark-scrollbar rounded-2xl border-white/10 bg-[linear-gradient(180deg,rgba(14,23,40,0.98),rgba(8,12,20,0.98))] text-slate-100 shadow-[0_24px_60px_rgba(0,0,0,0.34)]">
                                        <SelectItem className="rounded-xl text-slate-200 focus:bg-white/[0.08] focus:text-white" value="low">Low</SelectItem>
                                        <SelectItem className="rounded-xl text-slate-200 focus:bg-white/[0.08] focus:text-white" value="normal">Normal</SelectItem>
                                        <SelectItem className="rounded-xl text-slate-200 focus:bg-white/[0.08] focus:text-white" value="high">High</SelectItem>
                                        <SelectItem className="rounded-xl text-slate-200 focus:bg-white/[0.08] focus:text-white" value="critical">Critical</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-white">Assigned Technician</Label>
                                <SearchableSelect
                                    value={newJobForm.assigned_technician_name}
                                    onChange={(value) => setNewJobForm((prev) => ({ ...prev, assigned_technician_name: value }))}
                                    options={technicianSelectOptions}
                                    placeholder="Select technician"
                                    searchPlaceholder="Search technician..."
                                    emptyLabel="No technician found."
                                    variant="admin-dark"
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setCreateJobOpen(false);
                                setNewJobForm(initialNewJobForm);
                            }}
                            className="h-11 rounded-2xl border-white/10 bg-[linear-gradient(180deg,rgba(14,23,40,0.98),rgba(8,12,20,0.98))] px-5 text-slate-100 shadow-[0_14px_34px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.055)] hover:bg-[linear-gradient(180deg,rgba(24,38,64,0.98),rgba(12,20,34,0.98))] hover:text-white"
                        >
                            Cancel
                        </Button>
                        <Button className="h-11 rounded-2xl border border-[#7db0ff]/40 bg-[linear-gradient(135deg,#4f7cff,#22d3ee)] px-5 text-white shadow-[0_16px_34px_rgba(79,124,255,0.22)] hover:brightness-105" onClick={handleCreateJob}>
                            Create Job
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Sheet
                open={assignSidebarOpen}
                onOpenChange={(open) => {
                    setAssignSidebarOpen(open);
                    if (!open) {
                        setJobToAssign(null);
                        setBulkAssignJobIds([]);
                        setSelectedTechnicianName('unassigned');
                    }
                }}
            >
                <SheetContent side="right" className="w-full sm:max-w-2xl p-0">
                    <SheetHeader className="border-b px-5 py-4">
                        <SheetTitle>Assign Technician</SheetTitle>
                        <SheetDescription>
                            {isBulkAssignMode
                                ? `Select technician for ${bulkAssignSelectionCount} selected ${bulkAssignSelectionCount === 1 ? 'job' : 'jobs'}`
                                : (jobToAssign ? `Select technician for ${jobToAssign.job_code}` : 'Select technician for this job')}
                        </SheetDescription>
                    </SheetHeader>

                    <div className="px-5 py-4 border-b bg-muted/20">
                        {jobToAssign ? (
                            <div className="space-y-1.5 text-sm">
                                <OverflowText text={jobToAssign.service_name} className="max-w-[28rem] font-semibold text-foreground" />
                                <OverflowText text={jobToAssign.dealership_name} className="max-w-[28rem] text-muted-foreground" />
                                <div className="text-muted-foreground">{jobToAssign.vehicle_summary}</div>
                                <div className="text-xs font-medium text-[#2F8E92]">
                                    Required zone: {assignJobZone || 'Unknown'} | Required skill: {jobToAssign.service_name}
                                </div>
                                {isBulkAssignMode && bulkAssignSelectionCount > 1 ? (
                                    <div className="text-xs text-muted-foreground">
                                        Applying to this job and {bulkAssignSelectionCount - 1} more selected jobs.
                                    </div>
                                ) : null}
                            </div>
                        ) : null}
                    </div>

                    <div className="p-4 space-y-3 overflow-y-auto">
                        <button
                            type="button"
                            onClick={() => setSelectedTechnicianName('unassigned')}
                            className={cn(
                                'w-full text-left rounded-lg border p-3 transition-colors',
                                selectedTechnicianName === 'unassigned'
                                    ? 'border-[#2F8E92] bg-[#2F8E92]/5'
                                    : 'border-border hover:bg-muted/40'
                            )}
                        >
                            <div className="flex items-center justify-between">
                                <div className="font-medium text-sm">Unassigned</div>
                                <Badge variant="outline" className="text-xs">No tech</Badge>
                            </div>
                        </button>

                        {technicianOptions.length === 0 ? (
                            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                                No technicians available.
                            </div>
                        ) : null}

                        {technicianOptions
                            .slice()
                            .sort((a, b) => {
                                const aMatched = eligibleTechnicianIds.has(a.id) ? 1 : 0;
                                const bMatched = eligibleTechnicianIds.has(b.id) ? 1 : 0;
                                return bMatched - aMatched;
                            })
                            .map((tech) => (
                                <button
                                    key={tech.id}
                                    type="button"
                                    onClick={() => {
                                        if (!tech.isActive) {
                                            return;
                                        }
                                        setSelectedTechnicianName(tech.name);
                                    }}
                                    className={cn(
                                        'w-full text-left rounded-lg border p-3 transition-colors',
                                        !tech.isActive && 'cursor-not-allowed opacity-60 border-dashed bg-muted/20',
                                        selectedTechnicianName === tech.name
                                            ? 'border-[#2F8E92] bg-[#2F8E92]/5'
                                            : 'border-border hover:bg-muted/40'
                                    )}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="font-semibold text-sm text-foreground flex items-center gap-2">
                                                {tech.name}
                                                {!tech.isActive ? (
                                                    <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                                                        Inactive
                                                    </Badge>
                                                ) : eligibleTechnicianIds.has(tech.id) ? (
                                                    <Badge className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                        Recommended
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-[10px]">
                                                        Manual assign
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="mt-2 flex flex-wrap gap-1.5">
                                                {tech.zones.map((zone) => (
                                                    <Badge key={`${tech.id}-zone-${zone}`} variant="outline" className="text-[10px]">
                                                        {zone}
                                                    </Badge>
                                                ))}
                                            </div>
                                            <div className="mt-2 flex flex-wrap gap-1.5">
                                                {tech.skills.map((skill) => (
                                                    <Badge key={`${tech.id}-skill-${skill}`} className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200">
                                                        {skill}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="w-5 h-5 rounded-full border flex items-center justify-center mt-0.5">
                                            {selectedTechnicianName === tech.name && tech.isActive && (
                                                <div className="w-2.5 h-2.5 rounded-full bg-[#2F8E92]" />
                                            )}
                                        </div>
                                    </div>
                                </button>
                            ))}
                    </div>

                    <SheetFooter className="border-t px-5 py-4 sm:flex-row sm:justify-end gap-2">
                        <Button variant="ghost" className="h-11 rounded-2xl border border-white/10 !bg-[#0b1424] px-5 !text-slate-100 hover:!bg-[#122039] hover:!text-white" onClick={() => setAssignSidebarOpen(false)}>Cancel</Button>
                        <Button className="bg-[#2F8E92] hover:bg-[#267276]" onClick={submitTechnicianAssignment}>
                            {isBulkAssignMode ? `Apply to ${bulkAssignSelectionCount} Selected` : 'Save Assignment'}
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

            <ColumnExportDialog
                open={exportModalOpen}
                onOpenChange={setExportModalOpen}
                title="Export Jobs"
                description="Choose columns to export."
                availableColumns={JOB_EXPORT_COLUMNS}
                onConfirm={handleExport}
            />

            {/* 2. Filter Bar (Enterprise Grade) */}
            <div className="admin-jobs-filters relative overflow-hidden rounded-[24px] border border-black/8 bg-[linear-gradient(180deg,#ffffff,#fbfbfb)] shadow-[0_20px_60px_rgba(15,23,42,0.08)] dark:border-white/8 dark:bg-[linear-gradient(180deg,rgba(9,22,38,0.985),rgba(7,18,30,0.985))] dark:shadow-[0_20px_60px_rgba(0,0,0,0.24)]">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-900/20 to-transparent dark:via-cyan-200/60" />
                <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-r from-slate-200/50 via-transparent to-slate-100/35 pointer-events-none dark:from-[#2F8E92]/5 dark:to-blue-500/4" />
                <div className="relative space-y-4 p-4 md:p-5">
                    <div className="flex flex-col lg:flex-row gap-4">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[300px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                        <Input
                            placeholder="Search by job ID, dealership, technician name, or service type..."
                            className="h-10 rounded-2xl border-black/8 bg-white pl-9 text-slate-900 placeholder:text-slate-400 transition-all shadow-none focus-visible:border-slate-300 focus-visible:ring-slate-200 dark:border-white/8 dark:bg-white/[0.035] dark:text-white dark:placeholder:text-slate-500 dark:focus-visible:border-cyan-300/30 dark:focus-visible:ring-cyan-300/12"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {/* Filters */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 lg:pb-0">
                        <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
                            <SelectTrigger className="h-10 w-[170px] rounded-2xl border-black/8 bg-white text-slate-900 shadow-none dark:border-white/8 dark:bg-white/[0.035] dark:text-white">
                                <div className="flex items-center gap-2">
                                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                                    <SelectValue placeholder="Urgency" />
                                </div>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Urgency</SelectItem>
                                <SelectItem value="critical">Critical</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="normal">Medium</SelectItem>
                                <SelectItem value="low">Low</SelectItem>
                            </SelectContent>
                        </Select>

                        <div className="relative">
                            <Calendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <Input
                                type="date"
                                value={dateFilter}
                                onChange={(event) => setDateFilter(event.target.value)}
                                className="h-10 w-[180px] rounded-2xl border-black/8 bg-white pl-9 text-slate-900 shadow-none dark:border-white/8 dark:bg-white/[0.035] dark:text-white"
                                aria-label="Filter by date"
                            />
                        </div>

                        {(urgencyFilter !== 'all' || statusFilter !== 'all' || dateFilter || searchQuery || activeQuickFilter !== null) && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={clearFilters}
                                className="h-10 rounded-2xl px-3 text-rose-200 hover:bg-rose-400/10 hover:text-rose-100"
                            >
                                <X className="w-4 h-4 mr-1" /> Clear
                            </Button>
                        )}
                    </div>
                </div>
                    <div className="flex flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                            {statusFilterOptions.map((option) => (
                                <Button
                                    key={option.key}
                                    type="button"
                                    variant={statusFilter === option.key ? 'secondary' : 'outline'}
                                    size="sm"
                                    onClick={() => {
                                        setStatusFilter(option.key);
                                        setPagination((prev) => ({ ...prev, page: 1 }));
                                    }}
                                    className={cn(
                                        'h-9 rounded-2xl px-3 text-slate-200 shadow-none',
                                        statusFilter === option.key ? 'bg-slate-900 border-slate-900 text-white dark:bg-cyan-500/[0.12] dark:border-cyan-300/25 dark:text-cyan-100' : 'border-black/8 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/8 dark:bg-white/[0.03] dark:text-slate-200 dark:hover:bg-white/[0.08]',
                                    )}
                                >
                                    {option.label}
                                </Button>
                            ))}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                            <Select value={jobSortMode} onValueChange={(value) => handleSortModeChange(value as JobSortMode)}>
                                <SelectTrigger className="h-9 w-[180px] rounded-2xl border-black/8 bg-white text-slate-800 shadow-none dark:border-white/8 dark:bg-white/[0.035] dark:text-white">
                                    <div className="flex items-center gap-2 text-sm">
                                        <TrendingUp className="w-3.5 h-3.5 text-slate-400" />
                                        <SelectValue placeholder="Sort by" />
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="rank">Rank</SelectItem>
                                    <SelectItem value="created_newest">Created Date: Newest</SelectItem>
                                    <SelectItem value="created_oldest">Created Date: Oldest</SelectItem>
                                    <SelectItem value="urgency">Urgency</SelectItem>
                                    <SelectItem value="status">Status</SelectItem>
                                    <SelectItem value="job_id">Job ID</SelectItem>
                                </SelectContent>
                            </Select>
                            <Badge variant="outline" className="h-8 rounded-full border-white/10 bg-[#0b1424] px-3 text-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                                {jobSortBadgeLabel}
                            </Badge>
                            {activeFilterCount > 0 ? (
                                <Badge variant="outline" className="h-8 rounded-full border-cyan-300/20 bg-cyan-300/10 px-3 text-cyan-100">
                                    {activeFilterCount} active filter{activeFilterCount === 1 ? '' : 's'}
                                </Badge>
                            ) : null}
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. Jobs Table */}
            <div className="admin-jobs-board relative flex min-h-[620px] flex-1 flex-col overflow-hidden rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(8,22,38,0.985),rgba(6,15,27,0.99))] shadow-[0_24px_72px_rgba(0,0,0,0.28)]">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-900/20 to-transparent dark:via-cyan-300/70" />
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(15,23,42,0.03),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(15,23,42,0.02),transparent_24%)] dark:bg-[radial-gradient(circle_at_top_right,rgba(47,142,146,0.10),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.06),transparent_24%)]" />

                <div className="relative flex flex-col gap-4 border-b border-black/8 px-5 py-5 dark:border-white/8 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3">
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#0b1424] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                            <Activity className="h-3.5 w-3.5 text-cyan-200" />
                            Operations Queue
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-[1.35rem] font-semibold tracking-[-0.03em] text-white" style={displayFontStyle}>
                                Jobs at operational depth
                            </h2>
                            <p className="max-w-2xl text-sm leading-6 text-slate-400" style={bodyFontStyle}>
                                Review jobs and assignments.
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                        <Badge variant="outline" className="h-9 rounded-full border-cyan-300/18 bg-cyan-300/10 px-3 text-cyan-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                            <ClipboardList className="mr-1.5 h-3.5 w-3.5 text-cyan-200" />
                            {pagination.total} total jobs
                        </Badge>
                        {selectedRows.size > 0 ? (
                            <Badge variant="outline" className="h-9 rounded-full border-cyan-200 bg-cyan-50 px-3 text-cyan-700 dark:border-cyan-300/16 dark:bg-cyan-300/[0.08] dark:text-cyan-100">
                                <Users className="mr-1.5 h-3.5 w-3.5" />
                                {selectedRows.size} selected
                            </Badge>
                        ) : null}
                    </div>
                </div>

                {loading ? (
                    <div className="relative flex-1 p-5 md:p-6">
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                            <Skeleton className="h-10 rounded-2xl bg-white/[0.06]" />
                            <Skeleton className="h-10 rounded-2xl bg-white/[0.06]" />
                            <Skeleton className="h-10 rounded-2xl bg-white/[0.06]" />
                        </div>
                        <div className="mt-5 space-y-3">
                            {Array.from({ length: 10 }).map((_, i) => (
                                <Skeleton key={i} className="h-16 w-full rounded-[20px] bg-white/[0.05]" />
                            ))}
                        </div>
                    </div>
                ) : data.length === 0 ? (
                    <div className="relative flex min-h-[420px] flex-1 flex-col items-center justify-center px-6 py-20 text-center">
                        <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-[28px] border border-black/8 bg-slate-50 shadow-[0_18px_44px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                            <Search className="h-8 w-8 text-slate-700 dark:text-cyan-200/80" />
                        </div>
                        <h3 className="text-2xl font-semibold tracking-[-0.03em] text-slate-900 dark:text-white" style={displayFontStyle}>
                            No jobs match this view
                        </h3>
                        <p className="mt-3 max-w-md text-sm leading-6 text-slate-400" style={bodyFontStyle}>
                            No jobs match the current filter set. Adjust the queue filters or reset search criteria to widen the visible range.
                        </p>
                        <Button
                            variant="outline"
                            className="mt-6 h-11 rounded-2xl border-black/8 bg-white px-5 text-slate-700 hover:bg-slate-50 hover:text-slate-900 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-100 dark:hover:bg-white/[0.08] dark:hover:text-white"
                            onClick={clearFilters}
                        >
                            Reset filters
                        </Button>
                    </div>
                ) : (
                    <div className="admin-jobs-table relative flex-1 overflow-x-auto overflow-y-hidden">
                        <Table className="min-w-[1480px] table-fixed">
                            <TableHeader className="sticky top-0 z-10 border-b border-white/10 bg-[linear-gradient(180deg,rgba(9,24,40,0.98),rgba(8,19,33,0.94))] backdrop-blur-xl">
                                <TableRow className="border-white/0 hover:bg-transparent">
                                    <TableHead className="w-[38px] pl-4">
                                        <Checkbox
                                            checked={headerCheckboxState}
                                            onCheckedChange={handleSelectAll}
                                        />
                                    </TableHead>
                                    <TableHead className="w-[11%] text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            type="button"
                                            onClick={() => handleSortModeChange('job_id')}
                                            className="-ml-3 h-9 rounded-2xl px-3 text-[11px] font-semibold uppercase tracking-[0.24em] hover:bg-white/[0.05] hover:text-white text-slate-400"
                                        >
                                            Job ID
                                            <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
                                        </Button>
                                    </TableHead>
                                    <TableHead className="w-[14%] text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Service Type</TableHead>
                                    <TableHead className="w-[16%] text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Dealership / Location</TableHead>
                                    <TableHead className="w-[11%] text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Vehicle</TableHead>
                                    <TableHead className="w-[13%] text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Assigned Tech</TableHead>
                                    <TableHead className="w-[6%] text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Urgency</TableHead>
                                    <TableHead className="w-[7%] text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Rank</TableHead>
                                    <TableHead className="w-[9%] text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Status</TableHead>
                                    <TableHead className="w-[9%] text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Dates</TableHead>
                                    <TableHead className="w-[10%] pr-4 text-right text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.map((job, index) => {
                                    const locationLabel = getJobLocationLabel(job, dealershipOptions);
                                    const needsReassignment = isAwaitingReassignmentJob(job);
                                    const primaryTechnicianName = job.assigned_technician_name?.trim()
                                        ? job.assigned_technician_name
                                        : null;
                                    const pendingTechnicianName = !primaryTechnicianName
                                        && (job.job_status === 'admin_preview' || job.job_status === 'pending_admin_confirmation')
                                        && job.pending_assigned_technician_name?.trim()
                                            ? job.pending_assigned_technician_name
                                            : null;

                                    return (
                                        <TableRow
                                            key={job.job_id}
                                            className={cn(
                                                'group border-b border-white/7 bg-[#07101d]/70 transition-all duration-200 hover:bg-[#0d1a2d]',
                                                index % 2 === 1 && 'bg-[#091321]/78',
                                                job.attention_flag && 'bg-red-400/[0.04] hover:bg-red-400/[0.08]',
                                                needsReassignment && 'bg-amber-400/[0.045] hover:bg-amber-400/[0.08]',
                                            )}
                                        >
                                            <TableCell className="relative pl-4">
                                                {job.attention_flag || needsReassignment ? (
                                                    <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full bg-gradient-to-b from-red-300 via-orange-300 to-red-500" />
                                                ) : null}
                                                <Checkbox
                                                    checked={selectedRows.has(job.job_id)}
                                                    onCheckedChange={(checked) => handleSelectRow(job.job_id, checked as boolean)}
                                                />
                                            </TableCell>
                                            <TableCell className="py-4 align-middle">
                                                <button
                                                    type="button"
                                                    onClick={() => navigate(`/admin/jobs/${job.job_id}`)}
                                                    className="group/id rounded-2xl px-1 py-1 text-left transition-colors"
                                                >
                                                    <div className="text-sm font-semibold text-white transition-colors group-hover:text-cyan-100 group-hover/id:text-cyan-100" style={displayFontStyle}>
                                                        {job.job_code}
                                                    </div>
                                                    <div className="mt-1 max-w-full truncate text-xs text-slate-500">{job.job_id}</div>
                                                </button>
                                            </TableCell>
                                            <TableCell className="py-4 align-middle">
                                                <div className="min-w-0 border-l border-white/10 pl-3">
                                                    <OverflowText text={job.service_name} className="max-w-full text-sm font-semibold text-white" />
                                                    <div className="mt-1 text-xs text-slate-500">
                                                        {job.service_names.length > 1 ? `${job.service_names.length} catalog services linked` : 'Primary service'}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-4 align-middle">
                                                <div className="flex min-w-0 items-start gap-3">
                                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/12 bg-cyan-300/[0.08] text-cyan-100 shadow-[0_14px_24px_rgba(8,145,178,0.12)]">
                                                        <Building2Icon className="h-4 w-4" />
                                                    </div>
                                                    <div className="min-w-0 space-y-1">
                                                        <OverflowText text={job.dealership_name} className="max-w-full text-sm font-semibold text-white" />
                                                        <div className="flex items-center gap-1 text-xs text-slate-500">
                                                            <MapPin className="h-3 w-3" />
                                                            {locationLabel}
                                                        </div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-4 align-middle">
                                                <div className="min-w-0">
                                                    <OverflowText text={job.vehicle_summary} className="max-w-full text-sm font-semibold text-slate-100" />
                                                    <div className="mt-1 text-xs text-slate-500">Vehicle profile</div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-4 align-middle">
                                                {primaryTechnicianName ? (
                                                    <div className="inline-flex w-full max-w-[190px] items-center gap-2 rounded-2xl border border-emerald-300/16 bg-emerald-300/[0.07] px-2.5 py-2">
                                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-300/20 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-100">
                                                            {primaryTechnicianName.substring(0, 2)}
                                                        </div>
                                                        <div className="min-w-0 flex-1 text-left leading-tight">
                                                            <OverflowText text={primaryTechnicianName} className="max-w-full text-sm font-medium text-emerald-50" />
                                                            <div className="truncate text-[11px] text-emerald-200/70">Assigned technician</div>
                                                        </div>
                                                    </div>
                                                ) : pendingTechnicianName ? (
                                                    <div className="inline-flex w-full max-w-[190px] items-center gap-2 rounded-2xl border border-violet-300/18 bg-violet-300/[0.09] px-2.5 py-2">
                                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-300/20 text-[10px] font-semibold uppercase tracking-[0.12em] text-violet-100">
                                                            {pendingTechnicianName.substring(0, 2)}
                                                        </div>
                                                        <div className="min-w-0 flex-1 text-left leading-tight">
                                                            <OverflowText text={pendingTechnicianName} className="max-w-full text-sm font-medium text-violet-50" />
                                                            <div className="truncate text-[11px] text-violet-200/70">Pending admin confirmation</div>
                                                        </div>
                                                    </div>
                                                ) : needsReassignment ? (
                                                    <div className="inline-flex w-full max-w-[190px] items-center gap-2 rounded-2xl border border-amber-300/18 bg-amber-300/[0.08] px-2.5 py-2">
                                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-300/16 text-amber-100">
                                                            <AlertCircle className="h-3.5 w-3.5" />
                                                        </div>
                                                        <div className="min-w-0 flex-1 text-left leading-tight">
                                                            <OverflowText
                                                                text={job.last_refused_by_technician_name?.trim() ? `Refused by ${job.last_refused_by_technician_name}` : 'Technician refused'}
                                                                className="max-w-full text-sm font-medium text-amber-50"
                                                            />
                                                            <div className="truncate text-[11px] text-amber-200/70">Needs reassignment</div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[linear-gradient(135deg,rgba(148,163,184,0.08),rgba(30,41,59,0.18))] px-3 py-2 text-xs font-medium text-slate-300">
                                                        <User className="h-3.5 w-3.5" />
                                                        Unassigned
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell className="py-4 align-middle">
                                                <StatusBadge status={job.urgency} type="urgency" />
                                            </TableCell>
                                            <TableCell className="py-4 align-middle">
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <button
                                                            type="button"
                                                            className="inline-flex h-8 items-center gap-2 rounded-full border border-emerald-300/20 bg-[linear-gradient(135deg,rgba(16,185,129,0.18),rgba(5,150,105,0.08))] px-3 py-1 text-xs font-semibold text-emerald-50 shadow-[0_12px_24px_rgba(16,185,129,0.12)] transition-colors hover:bg-emerald-300/15"
                                                        >
                                                            Score {job.ranking_score ?? 0}
                                                            <ChevronDown className="h-3.5 w-3.5 text-emerald-200" />
                                                        </button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-[240px] bg-slate-950 text-slate-100 p-4 rounded-2xl border border-white/10 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
                                                        <p className="text-sm font-semibold">Ranking details</p>
                                                        <p className="mt-2 text-sm text-slate-300">Total score: <span className="font-semibold text-white">{job.ranking_score ?? 0}</span></p>
                                                        <div className="mt-3 space-y-2 text-sm">
                                                            {job.applied_rules && job.applied_rules.length > 0 ? (
                                                                job.applied_rules.map((rule, idx) => (
                                                                    <div key={`${job.job_id}-rule-${idx}`} className="rounded-xl bg-white/5 px-3 py-2 text-slate-200">
                                                                        • {rule}
                                                                    </div>
                                                                ))
                                                            ) : (
                                                                <div className="rounded-xl bg-white/5 px-3 py-2 text-slate-200">No ranking rules applied.</div>
                                                            )}
                                                        </div>
                                                    </PopoverContent>
                                                </Popover>
                                            </TableCell>
                                            <TableCell className="py-4 align-middle">
                                                <StatusBadge status={needsReassignment ? 'needs_reassignment' : job.job_status} type="job" />
                                            </TableCell>
                                            <TableCell className="py-4 align-middle">
                                                <div className="space-y-2 border-l border-white/10 pl-3">
                                                    <div>
                                                        <div className="text-sm font-semibold text-slate-100">{formatJobDate(job.created_at)}</div>
                                                        <div className="text-[11px] text-slate-500">{formatJobTime(job.created_at)}</div>
                                                    </div>
                                                    <div className="border-t border-white/6 pt-2">
                                                        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Updated</div>
                                                        <div className="mt-0.5 text-[11px] text-slate-400">{formatJobDate(job.updated_at)} · {formatJobTime(job.updated_at)}</div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-4 pr-4 text-right align-middle">
                                                <div className="ml-auto flex max-w-[132px] flex-col items-stretch gap-2">
                                                    {(job.job_status === 'admin_preview' || job.job_status === 'pending_admin_confirmation') && Boolean(
                                                        (job.pending_assigned_technician_name ?? job.assigned_technician_name)?.trim()
                                                    ) ? (
                                                        <Button
                                                            size="sm"
                                                            className="h-8 w-full rounded-2xl bg-[linear-gradient(135deg,#36d6dd,#2d9fe5)] px-2 text-[11px] text-white shadow-[0_16px_28px_rgba(36,196,203,0.28)] hover:brightness-105"
                                                            onClick={() => void handleConfirmJob(job)}
                                                        >
                                                            <Check className="mr-2 h-3.5 w-3.5" />
                                                            Confirm
                                                        </Button>
                                                    ) : null}
                                                    {isAssignableJob(job) ? (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-8 w-full justify-start rounded-2xl border-white/10 bg-[linear-gradient(135deg,rgba(148,163,184,0.10),rgba(30,41,59,0.16))] px-2.5 text-[11px] text-slate-100 hover:bg-white/[0.08] hover:text-white"
                                                            onClick={() => handleAssignTechnician(job)}
                                                        >
                                                            <User className="mr-1.5 h-3.5 w-3.5" />
                                                            {job.job_status === 'scheduled' && Boolean(job.assigned_technician_name?.trim())
                                                                ? 'Reassign'
                                                                : 'Assign'}
                                                        </Button>
                                                    ) : null}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                )}

                {/* Pagination & Footer */}
                <div className="relative flex flex-col gap-4 border-t border-black/8 bg-slate-50 px-5 py-4 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(8,18,31,0.88),rgba(6,15,26,0.96))] lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400" style={bodyFontStyle}>
                        <span>
                            Showing <span className="font-medium text-slate-900 dark:text-white">{footerStart}</span> to <span className="font-medium text-slate-900 dark:text-white">{footerEnd}</span> of <span className="font-medium text-slate-900 dark:text-white">{pagination.total}</span> jobs
                        </span>
                        {selectedRows.size > 0 ? (
                            <Badge variant="outline" className="h-8 rounded-full border-cyan-300/20 bg-cyan-300/10 px-3 text-cyan-100">
                                <Users className="mr-1.5 h-3 w-3" />
                                {selectedRows.size} selected
                            </Badge>
                        ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 md:gap-6">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-500 dark:text-slate-400">Rows per page</span>
                            <Select
                                value={pagination.pageSize.toString()}
                                onValueChange={(val) => setPagination((prev) => ({ ...prev, pageSize: Number(val), page: 1 }))}
                            >
                                <SelectTrigger className="h-9 w-[84px] rounded-2xl border-black/8 bg-white text-slate-900 shadow-none dark:border-white/10 dark:bg-white/[0.04] dark:text-white">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="25">25</SelectItem>
                                    <SelectItem value="50">50</SelectItem>
                                    <SelectItem value="100">100</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-9 w-9 rounded-2xl border-black/8 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:bg-white/[0.08] dark:hover:text-white"
                                disabled={pagination.page === 1}
                                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <div className="rounded-full border border-black/8 bg-white px-4 py-2 text-sm font-medium text-slate-900 dark:border-white/10 dark:bg-white/[0.04] dark:text-white">
                                Page {pagination.page} of {pagination.totalPages}
                            </div>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-9 w-9 rounded-2xl border-black/8 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:bg-white/[0.08] dark:hover:text-white"
                                disabled={pagination.page >= pagination.totalPages}
                                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* 5. Bulk Actions (Floating) */}
            {selectedRows.size > 0 && (
                <div className="fixed bottom-6 left-1/2 z-50 flex w-[calc(100%-1.5rem)] max-w-4xl -translate-x-1/2 items-center gap-4 rounded-[26px] border border-white/10 bg-[linear-gradient(135deg,rgba(8,20,35,0.95),rgba(6,16,29,0.98))] px-4 py-3 text-white shadow-[0_26px_90px_rgba(0,0,0,0.42)] backdrop-blur-xl animate-in slide-in-from-bottom-4 duration-200 sm:px-5">
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent" />
                    <div className="flex shrink-0 items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/12 text-cyan-100">
                            <Users className="h-5 w-5" />
                        </div>
                        <div>
                            <div className="text-sm font-semibold text-white">{selectedRows.size} jobs selected</div>
                            <div className="text-xs text-slate-400">Apply queue actions in one move.</div>
                        </div>
                    </div>
                    <div className="hidden h-10 w-px bg-white/10 lg:block" />
                    <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-10 rounded-2xl border-white/10 bg-white/[0.04] px-4 text-slate-100 hover:bg-white/[0.08] hover:text-white"
                            onClick={handleBulkAssignTechnician}
                        >
                            <User className="mr-2 h-4 w-4" />
                            Assign selected
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-10 rounded-2xl border-white/10 bg-white/[0.04] px-4 text-slate-100 hover:bg-white/[0.08] hover:text-white"
                            onClick={() => setExportModalOpen(true)}
                        >
                            <Download className="mr-2 h-4 w-4" />
                            Export selected
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-10 rounded-2xl border-red-300/20 bg-red-300/10 px-4 text-red-100 hover:bg-red-300/18 hover:text-red-50"
                            onClick={handleBulkRemoveJobs}
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Remove selected
                        </Button>
                        <Button
                            size="icon"
                            variant="ghost"
                            className="h-10 w-10 rounded-2xl text-slate-400 hover:bg-white/[0.08] hover:text-white"
                            onClick={() => setSelectedRows(new Set())}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

// Icon Helper
function Building2Icon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
            <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
            <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
            <path d="M10 6h4" />
            <path d="M10 10h4" />
            <path d="M10 14h4" />
            <path d="M10 18h4" />
        </svg>
    )
}

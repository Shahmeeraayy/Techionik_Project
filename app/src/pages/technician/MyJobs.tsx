import { useState, useEffect } from 'react';
import {
    Calendar,
    Clock,
    User,
    Briefcase,
    MapPin,
    Play,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Loader2,
    X,
    RefreshCw,
    Plus,
    Pencil,
    Trash2,
    Sparkles,
} from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import {
    addTechnicianMyJobService,
    acceptTechnicianMyJob,
    completeTechnicianMyJob,
    delayTechnicianMyJob,
    fetchAdminServices,
    fetchAdminTechnicianJobsFeed,
    fetchServicesCatalog,
    fetchTechnicianJobsFeed,
    getStoredAdminToken,
    getStoredTechnicianToken,
    refuseTechnicianMyJob,
    removeTechnicianMyJobService,
    startTechnicianMyJob,
    updateTechnicianMyJobService,
    type BackendServiceCatalogItem,
    type BackendTechnicianJobFeedItem,
} from '@/lib/backend-api';
import { DISPATCH_JOB_STATUS, normalizeDispatchJobStatus } from '@/lib/job-status';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import OverflowText from '@/components/common/overflow-text';
import TechnicianBottomNav from '@/components/common/technician-bottom-nav';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

// --- Types ---

type JobStatus = 'pending' | 'scheduled' | 'in_progress' | 'delayed' | 'completed' | 'unknown';
type Urgency = 'low' | 'normal' | 'high' | 'critical';

interface MyJob {
    job_id: string;
    job_code: string;
    dealership_name: string;
    service_name: string;
    original_service_name: string;
    service_names: string[];
    service_entries: AddedServiceEntry[];
    job_status: JobStatus;
    urgency?: Urgency;
    scheduled_time?: string;
    zone: string;
    allowed_actions: ('accept' | 'start' | 'done' | 'delay' | 'refuse')[];
}

type AddedServiceEntry = {
    id?: string;
    service_name: string;
    notes?: string;
    source?: string;
};

const mapBackendFeedItemToMyJob = (item: BackendTechnicianJobFeedItem): MyJob | null => {
    const status = normalizeDispatchJobStatus(item.status);
    if (
        status === DISPATCH_JOB_STATUS.CANCELLED
        || status === DISPATCH_JOB_STATUS.ADMIN_PREVIEW
        || status === DISPATCH_JOB_STATUS.PENDING_ADMIN_CONFIRMATION
        || status === DISPATCH_JOB_STATUS.PENDING_REVIEW
        || status === DISPATCH_JOB_STATUS.READY_FOR_TECH
    ) {
        return null;
    }

    const mappedStatus: JobStatus =
        status === DISPATCH_JOB_STATUS.PENDING ? 'pending'
            : status === DISPATCH_JOB_STATUS.SCHEDULED ? 'scheduled'
            : status === DISPATCH_JOB_STATUS.IN_PROGRESS ? 'in_progress'
                : status === DISPATCH_JOB_STATUS.DELAYED ? 'delayed'
                    : status === DISPATCH_JOB_STATUS.COMPLETED ? 'completed'
                        : 'unknown';

    const allowedActions: MyJob['allowed_actions'] =
        mappedStatus === 'pending'
            ? ['accept', 'refuse']
            : mappedStatus === 'in_progress'
            ? ['done', 'delay']
            : mappedStatus === 'delayed'
                ? ['start', 'refuse']
                : mappedStatus === 'completed'
                    ? []
                    : mappedStatus === 'unknown'
                        ? []
                        : ['start', 'delay', 'refuse'];

    const scheduledTime = item.requested_service_date
        ? `${item.requested_service_date}T${(item.requested_service_time || '09:00:00').slice(0, 8)}`
        : undefined;
    const normalizedServiceNames = Array.from(
        new Set(
            (item.service_names ?? [])
                .map((value) => value.trim())
                .filter(Boolean),
        ),
    );
    const primaryServiceName = normalizedServiceNames[0] || item.service_name || 'Service Request';
    const serviceEntries = (item.service_entries ?? []).map((entry) => ({
        id: entry.id,
        service_name: entry.service_name,
        notes: entry.notes || undefined,
        source: entry.source,
    }));

    return {
        job_id: item.id,
        job_code: item.job_code,
        dealership_name: item.dealership_name || 'Unknown Dealership',
        service_name: primaryServiceName,
        original_service_name: primaryServiceName,
        service_names: normalizedServiceNames.length > 0 ? normalizedServiceNames : [primaryServiceName],
        service_entries: serviceEntries,
        job_status: mappedStatus,
        urgency: 'normal',
        scheduled_time: scheduledTime,
        zone: item.zone_name || 'Unspecified',
        allowed_actions: allowedActions,
    };
};

const offlineCurrentJobsKey = (technicianId: string) => `sm2_technician_current_jobs_cache:${technicianId}`;

const readOfflineCurrentJobs = (technicianId: string): MyJob[] => {
    try {
        const raw = window.localStorage.getItem(offlineCurrentJobsKey(technicianId));
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed?.jobs) ? parsed.jobs : [];
    } catch {
        return [];
    }
};

const writeOfflineCurrentJobs = (technicianId: string, jobs: MyJob[]) => {
    try {
        window.localStorage.setItem(offlineCurrentJobsKey(technicianId), JSON.stringify({
            cachedAt: new Date().toISOString(),
            jobs,
        }));
    } catch {
        // Ignore private browsing/storage errors.
    }
};

// --- Components ---

function StatusBadge({ status }: { status: JobStatus }) {
    const styles: Record<JobStatus, string> = {
        pending: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700',
        scheduled: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700',
        in_progress: 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700',
        delayed: 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-700',
        completed: 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600',
        unknown: 'bg-zinc-100 text-zinc-700 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700',
    };

    const labels: Record<JobStatus, string> = {
        pending: 'Pending',
        scheduled: 'Scheduled',
        in_progress: 'In Progress',
        delayed: 'Delayed',
        completed: 'Completed',
        unknown: 'Unknown',
    };

    return (
        <Badge variant="outline" className={cn('font-semibold text-xs px-2.5 py-0.5 border', styles[status])}>
            {labels[status]}
        </Badge>
    );
}

function UrgencyBadge({ urgency }: { urgency: Urgency }) {
    const styles: Record<Urgency, string> = {
        critical: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700',
        high: 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-700',
        normal: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700',
        low: 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600',
    };

    const labels: Record<Urgency, string> = {
        critical: 'Critical',
        high: 'High',
        normal: 'Normal',
        low: 'Low',
    };

    return (
        <Badge
            variant="outline"
            className={cn(
                'font-semibold text-xs px-2.5 py-0.5 border',
                styles[urgency],
                urgency === 'critical' && 'animate-pulse'
            )}
        >
            {labels[urgency]}
        </Badge>
    );
}

function JobCard({
    job,
    serviceOptions,
    selectedServiceName,
    selectedServices,
    addedServices,
    canManageServices,
    onSelectService,
    onOpenAddService,
    onEditAddedService,
    onRemoveAddedService,
    onAccept,
    onStart,
    onDone,
    onDelay,
    onRefuse,
}: {
    job: MyJob;
    serviceOptions: string[];
    selectedServiceName: string;
    selectedServices: string[];
    addedServices: AddedServiceEntry[];
    canManageServices: boolean;
    onSelectService: (jobId: string, serviceName: string) => void;
    onOpenAddService: (jobId: string) => void;
    onEditAddedService: (jobId: string, service: AddedServiceEntry) => void;
    onRemoveAddedService: (jobId: string, service: AddedServiceEntry) => void;
    onAccept: (jobId: string) => void;
    onStart: (jobId: string) => void;
    onDone: (jobId: string) => void;
    onDelay: (jobId: string) => void;
    onRefuse: (jobId: string) => void;
}) {
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const handleAction = async (action: string, handler: (jobId: string) => void) => {
        setActionLoading(action);
        await new Promise(resolve => setTimeout(resolve, 600));
        handler(job.job_id);
        setActionLoading(null);
    };

    const formatScheduledDateTime = (isoString: string): string => {
        const date = new Date(isoString);
        const formattedDate = date.toLocaleDateString('en-US', {
            month: 'short',
            day: '2-digit',
            year: 'numeric',
        });
        const formattedTime = date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
        return `${formattedDate} • ${formattedTime}`;
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="p-5 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">
                            {job.job_code}
                        </h3>
                        <OverflowText text={job.service_name} as="p" className="mt-0.5 max-w-[18rem] text-sm font-medium text-gray-600 dark:text-gray-400" />
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                        <StatusBadge status={job.job_status} />
                        {job.urgency && <UrgencyBadge urgency={job.urgency} />}
                    </div>
                </div>

                {/* Dealership */}
                <div className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                    <OverflowText text={job.dealership_name} className="max-w-[16rem] text-base font-semibold text-gray-900 dark:text-gray-100" />
                </div>

                {/* Zone & Scheduled Time */}
                <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                        <MapPin className="w-4 h-4 text-[#2F8E92] dark:text-teal-400" />
                        <span className="font-medium">{job.zone}</span>
                    </div>
                    {job.scheduled_time && (
                        <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                            <Clock className="w-4 h-4" />
                            <span className="font-medium">{formatScheduledDateTime(job.scheduled_time)}</span>
                        </div>
                    )}
                </div>

                <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-3 dark:border-gray-700 dark:bg-gray-900/40">
                    <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            Service Selection
                        </span>
                        {canManageServices && selectedServiceName !== job.original_service_name && (
                            <span className="text-[11px] font-medium text-[#2F8E92] dark:text-teal-400">
                                Updated by technician
                            </span>
                        )}
                    </div>
                    {canManageServices ? (
                        <Select
                            value={selectedServiceName}
                            onValueChange={(value) => onSelectService(job.job_id, value)}
                        >
                            <SelectTrigger className="h-11 rounded-xl border-gray-200 bg-white text-left dark:border-gray-700 dark:bg-gray-800">
                                <SelectValue placeholder="Select service" />
                            </SelectTrigger>
                            <SelectContent>
                                {serviceOptions.map((serviceName) => (
                                    <SelectItem key={`${job.job_id}-${serviceName}`} value={serviceName}>
                                        {serviceName}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    ) : (
                        <div className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
                            {selectedServiceName}
                        </div>
                    )}
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        Dealership requested: <OverflowText text={job.original_service_name} className="inline max-w-[16rem] font-medium text-gray-700 dark:text-gray-200" />
                    </p>
                    {canManageServices && (
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenAddService(job.job_id)}
                            className="mt-3 h-10 w-full justify-start rounded-xl border-dashed border-[#2F8E92]/40 text-[#2F8E92] hover:bg-[#2F8E92]/5 dark:border-teal-500/40 dark:text-teal-400 dark:hover:bg-teal-500/10"
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            Add Additional Service
                        </Button>
                    )}
                    <div className="mt-3 rounded-xl bg-white/70 p-3 dark:bg-gray-800/60">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            Selected Services
                        </p>
                        <div className="mt-2 space-y-1 text-sm text-gray-700 dark:text-gray-200">
                            {selectedServices.map((serviceName) => (
                                <div key={`${job.job_id}-selected-${serviceName}`} className="flex gap-2">
                                    <span className="text-[#2F8E92] dark:text-teal-400">•</span>
                                    <OverflowText text={serviceName} className="max-w-[16rem]" />
                                </div>
                            ))}
                        </div>
                    </div>
                    {addedServices.length > 0 && (
                        <div className="mt-2 space-y-2">
                            {addedServices.map((service) => (
                                <div
                                    key={service.id ?? `${job.job_id}-added-${service.service_name}`}
                                    className="rounded-lg border border-dashed border-[#2F8E92]/30 bg-[#2F8E92]/5 px-3 py-2 dark:border-teal-500/30 dark:bg-teal-500/5"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                Technician added
                                            </p>
                                            <OverflowText text={service.service_name} as="p" className="max-w-[15rem] text-sm font-medium text-gray-800 dark:text-gray-100" />
                                            {service.notes && (
                                                <OverflowText text={service.notes} as="p" lines={2} className="mt-1 max-w-[15rem] text-xs text-gray-500 dark:text-gray-400" />
                                            )}
                                        </div>
                                        {canManageServices && (
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => onEditAddedService(job.job_id, service)}
                                                    className="h-8 px-2 text-[#2F8E92] hover:bg-[#2F8E92]/10 hover:text-[#267276] dark:text-teal-400 dark:hover:bg-teal-500/10"
                                                >
                                                    <Pencil className="mr-1 h-3.5 w-3.5" />
                                                    Edit
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => onRemoveAddedService(job.job_id, service)}
                                                    className="h-8 px-2 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-500/10"
                                                >
                                                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                                                    Remove
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                {job.allowed_actions.length > 0 && (
                    <div className="pt-2 flex flex-wrap gap-2">
                        {job.allowed_actions.includes('start') && (
                            <Button
                                onClick={() => handleAction('start', onStart)}
                                disabled={!!actionLoading}
                                className={cn(
                                    "flex-1 h-11 text-sm font-semibold rounded-xl",
                                    "bg-[#2F8E92] hover:bg-[#267276] text-white",
                                    "disabled:opacity-50"
                                )}
                            >
                                {actionLoading === 'start' ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <Play className="w-4 h-4 mr-2" />
                                )}
                                START
                            </Button>
                        )}

                        {job.allowed_actions.includes('accept') && (
                            <Button
                                onClick={() => handleAction('accept', onAccept)}
                                disabled={!!actionLoading}
                                className={cn(
                                    "flex-1 h-11 text-sm font-semibold rounded-xl",
                                    "bg-[#2F8E92] hover:bg-[#267276] text-white",
                                    "disabled:opacity-50"
                                )}
                            >
                                {actionLoading === 'accept' ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                )}
                                ACCEPT
                            </Button>
                        )}

                        {job.allowed_actions.includes('done') && (
                            <Button
                                onClick={() => handleAction('done', onDone)}
                                disabled={!!actionLoading}
                                className={cn(
                                    "flex-1 h-11 text-sm font-semibold rounded-xl",
                                    "bg-emerald-600 hover:bg-emerald-700 text-white",
                                    "disabled:opacity-50"
                                )}
                            >
                                {actionLoading === 'done' ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                )}
                                DONE
                            </Button>
                        )}

                        {job.allowed_actions.includes('delay') && (
                            <Button
                                onClick={() => handleAction('delay', onDelay)}
                                disabled={!!actionLoading}
                                variant="outline"
                                className={cn(
                                    "flex-1 h-11 text-sm font-semibold rounded-xl",
                                    "border-2 border-orange-500 text-orange-600 hover:bg-orange-50",
                                    "dark:border-orange-600 dark:text-orange-500 dark:hover:bg-orange-900/20",
                                    "disabled:opacity-50"
                                )}
                            >
                                {actionLoading === 'delay' ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <AlertTriangle className="w-4 h-4 mr-2" />
                                )}
                                DELAY
                            </Button>
                        )}

                        {job.allowed_actions.includes('refuse') && (
                            <Button
                                onClick={() => handleAction('refuse', onRefuse)}
                                disabled={!!actionLoading}
                                variant="outline"
                                className={cn(
                                    "flex-1 h-11 text-sm font-semibold rounded-xl",
                                    "border-2 border-red-500 text-red-600 hover:bg-red-50",
                                    "dark:border-red-600 dark:text-red-500 dark:hover:bg-red-900/20",
                                    "disabled:opacity-50"
                                )}
                            >
                                {actionLoading === 'refuse' ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <XCircle className="w-4 h-4 mr-2" />
                                )}
                                REFUSE
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// --- Main Component ---

export default function MyJobsPage({
    viewMode = 'current',
}: {
    viewMode?: 'current' | 'history';
}) {
    const { techId: previewTechId } = useParams();
    const [searchParams] = useSearchParams();
    const routeBase = previewTechId ? `/admin/tech-preview/${previewTechId}` : '/tech';
    const { user } = useAuth();
    const cacheOwnerId = previewTechId ?? user?.id ?? 'technician';
    const focusedJobId = searchParams.get('jobId');
    const [jobs, setJobs] = useState<MyJob[]>([]);
    const [serviceOptions, setServiceOptions] = useState<string[]>([]);
    const [selectedServicesByJob, setSelectedServicesByJob] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const isHistoryMode = viewMode === 'history';

    // Modals
    const [delayModalOpen, setDelayModalOpen] = useState(false);
    const [refuseModalOpen, setRefuseModalOpen] = useState(false);
    const [doneModalOpen, setDoneModalOpen] = useState(false);
    const [addServiceModalOpen, setAddServiceModalOpen] = useState(false);
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
    const [editingServiceId, setEditingServiceId] = useState<string | null>(null);

    // Delay Modal State
    const [delayMinutes, setDelayMinutes] = useState<string>('15');
    const [delayCustomMinutes, setDelayCustomMinutes] = useState('');
    const [delayNote, setDelayNote] = useState('');

    // Refuse Modal State
    const [refuseReason, setRefuseReason] = useState('');
    const [refuseComment, setRefuseComment] = useState('');
    const [addServiceName, setAddServiceName] = useState('');
    const [addServiceNotes, setAddServiceNotes] = useState('');

    // Action Loading
    const [confirmLoading, setConfirmLoading] = useState(false);
    const [offlineMode, setOfflineMode] = useState(false);

    const applyJobs = (nextJobs: MyJob[], options?: { fromCache?: boolean }) => {
        const orderedJobs = focusedJobId
            ? [...nextJobs].sort((a, b) => Number(b.job_id === focusedJobId) - Number(a.job_id === focusedJobId))
            : nextJobs;
        setJobs(orderedJobs);
        setOfflineMode(Boolean(options?.fromCache));
        if (!options?.fromCache) {
            writeOfflineCurrentJobs(cacheOwnerId, orderedJobs);
        }
        setSelectedServicesByJob((prev) => {
            const next = { ...prev };
            for (const job of orderedJobs) {
                if (!next[job.job_id]) {
                    next[job.job_id] = job.service_name;
                }
            }
            return next;
        });
    };

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        try {
            const raw = window.localStorage.getItem('sm_dispatch_job_service_overrides');
            if (!raw) {
                return;
            }
            const parsed = JSON.parse(raw) as Record<string, string>;
            if (parsed && typeof parsed === 'object') {
                setSelectedServicesByJob(parsed);
            }
        } catch {
            // Ignore invalid local state.
        }
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }
        window.localStorage.setItem('sm_dispatch_job_service_overrides', JSON.stringify(selectedServicesByJob));
    }, [selectedServicesByJob]);

    useEffect(() => {
        applyJobs(readOfflineCurrentJobs(cacheOwnerId), { fromCache: true });
        void fetchJobs();
    }, [previewTechId, user?.id, user?.role, focusedJobId]);

    useEffect(() => {
        void fetchServiceOptions();
    }, [previewTechId, user?.id, user?.role]);

    useEffect(() => {
        if (previewTechId) return;
        const intervalId = setInterval(() => {
            void fetchJobs();
        }, 10000);
        const onFocus = () => { void fetchJobs(); };
        window.addEventListener('focus', onFocus);
        return () => {
            clearInterval(intervalId);
            window.removeEventListener('focus', onFocus);
        };
    }, [previewTechId, user?.id, user?.role]);

    const fetchJobs = async () => {
        setLoading(true);
        if (previewTechId) {
            const adminToken = getStoredAdminToken();
            if (!adminToken) {
                applyJobs(readOfflineCurrentJobs(cacheOwnerId), { fromCache: true });
                setLoading(false);
                return;
            }
            try {
                const feed = await fetchAdminTechnicianJobsFeed(adminToken, previewTechId);
                const mapped = [...feed.available_jobs, ...feed.my_jobs]
                    .map(mapBackendFeedItemToMyJob)
                    .filter((job): job is MyJob => job !== null);
                applyJobs(mapped);
            } catch {
                applyJobs(readOfflineCurrentJobs(cacheOwnerId), { fromCache: true });
            }
            setLoading(false);
            return;
        }

        const token = getStoredTechnicianToken();
        if (!token || user?.role !== 'technician') {
            applyJobs(readOfflineCurrentJobs(cacheOwnerId), { fromCache: true });
            setLoading(false);
            return;
        }

        try {
            const feed = await fetchTechnicianJobsFeed(token);
            const mapped = [...feed.available_jobs, ...feed.my_jobs]
                .map(mapBackendFeedItemToMyJob)
                .filter((job): job is MyJob => job !== null);
            applyJobs(mapped);
        } catch {
            applyJobs(readOfflineCurrentJobs(cacheOwnerId), { fromCache: true });
        }
        setLoading(false);
    };

    const fetchServiceOptions = async () => {
        if (previewTechId) {
            const adminToken = getStoredAdminToken();
            if (!adminToken) {
                setServiceOptions([]);
                return;
            }
            try {
                const rows = await fetchAdminServices(adminToken, true);
                const next = rows
                    .filter((row: BackendServiceCatalogItem) => row.status === 'active')
                    .map((row: BackendServiceCatalogItem) => row.name?.trim() || '')
                    .filter((name, index, list) => name.length > 0 && list.indexOf(name) === index)
                    .sort((a, b) => a.localeCompare(b));
                setServiceOptions(next);
            } catch {
                setServiceOptions([]);
            }
            return;
        }

        const token = getStoredTechnicianToken();
        if (!token) {
            setServiceOptions([]);
            return;
        }

        try {
            const rows = await fetchServicesCatalog(token);
            const next = rows
                .filter((row: BackendServiceCatalogItem) => row.status === 'active')
                .map((row: BackendServiceCatalogItem) => row.name?.trim() || '')
                .filter((name, index, list) => name.length > 0 && list.indexOf(name) === index)
                .sort((a, b) => a.localeCompare(b));
            setServiceOptions(next);
        } catch {
            setServiceOptions([]);
        }
    };

    const getJobSelectedService = (job: MyJob): string => {
        return selectedServicesByJob[job.job_id] || job.service_name;
    };

    const handleSelectService = (jobId: string, serviceName: string) => {
        setSelectedServicesByJob((prev) => ({
            ...prev,
            [jobId]: serviceName,
        }));
    };

    const getSelectedServices = (job: MyJob): string[] => {
        const selected = getJobSelectedService(job);
        const added = job.service_entries.map((entry) => entry.service_name);
        return Array.from(new Set([selected, ...added].filter(Boolean)));
    };

    const getAvailableAdditionalServices = (job: MyJob): string[] => {
        const selected = new Set(getSelectedServices(job).map((value) => value.toLowerCase()));
        return serviceOptions.filter((option) => !selected.has(option.toLowerCase()));
    };

    const handleOpenAddService = (jobId: string) => {
        const targetJob = jobs.find((job) => job.job_id === jobId);
        setSelectedJobId(jobId);
        setEditingServiceId(null);
        setAddServiceNotes('');
        setAddServiceName(targetJob ? getAvailableAdditionalServices(targetJob)[0] ?? '' : '');
        setAddServiceModalOpen(true);
    };

    const handleOpenEditService = (jobId: string, service: AddedServiceEntry) => {
        setSelectedJobId(jobId);
        setEditingServiceId(service.id ?? null);
        setAddServiceName(service.service_name);
        setAddServiceNotes(service.notes ?? '');
        setAddServiceModalOpen(true);
    };

    const closeAddServiceModal = () => {
        setAddServiceModalOpen(false);
        setSelectedJobId(null);
        setEditingServiceId(null);
        setAddServiceName('');
        setAddServiceNotes('');
    };

    const handleConfirmAddService = () => {
        if (!selectedJobId || !addServiceName.trim()) {
            return;
        }

        const serviceName = addServiceName.trim();
        const serviceNotes = addServiceNotes.trim() || undefined;
        const isEditing = Boolean(editingServiceId);

        if (previewTechId) {
            setJobs((prev) => prev.map((job) => (
                job.job_id === selectedJobId
                    ? {
                        ...job,
                        service_entries: isEditing
                            ? job.service_entries.map((entry) => (
                                entry.id === editingServiceId
                                    ? {
                                        ...entry,
                                        service_name: serviceName,
                                        notes: serviceNotes,
                                    }
                                    : entry
                            ))
                            : [
                                ...job.service_entries,
                                {
                                    id: `preview-${Date.now()}`,
                                    service_name: serviceName,
                                    notes: serviceNotes,
                                    source: 'technician',
                                },
                            ],
                        service_names: Array.from(
                            new Set([
                                ...job.service_entries
                                    .filter((entry) => entry.source !== 'technician')
                                    .map((entry) => entry.service_name),
                                getJobSelectedService(job),
                                ...(isEditing
                                    ? job.service_entries.map((entry) => (
                                        entry.id === editingServiceId ? serviceName : entry.service_name
                                    ))
                                    : [...job.service_entries.map((entry) => entry.service_name), serviceName]),
                            ].filter(Boolean)),
                        ),
                    }
                    : job
            )));
            closeAddServiceModal();
            return;
        }

        const token = getStoredTechnicianToken();
        if (!token || user?.role !== 'technician') {
            return;
        }

        const request = isEditing && editingServiceId
            ? updateTechnicianMyJobService(token, selectedJobId, editingServiceId, {
                service_name: serviceName,
                notes: serviceNotes,
            })
            : addTechnicianMyJobService(token, selectedJobId, {
                service_name: serviceName,
                notes: serviceNotes,
            });

        void request
            .then(async () => {
                await fetchJobs();
                closeAddServiceModal();
            })
            .catch((error) => {
                const fallback = isEditing ? 'Failed to update service.' : 'Failed to add service.';
                const message = error instanceof Error ? error.message : fallback;
                toast.error(message);
            });
    };

    const handleRemoveAddedService = (jobId: string, service: AddedServiceEntry) => {
        if (!service.id) {
            return;
        }

        if (previewTechId) {
            setJobs((prev) => prev.map((job) => {
                if (job.job_id !== jobId) {
                    return job;
                }
                const nextEntries = job.service_entries.filter((entry) => entry.id !== service.id);
                return {
                    ...job,
                    service_entries: nextEntries,
                    service_names: Array.from(
                        new Set([
                            getJobSelectedService(job),
                            ...nextEntries.map((entry) => entry.service_name),
                        ].filter(Boolean)),
                    ),
                };
            }));
            return;
        }

        const token = getStoredTechnicianToken();
        if (!token || user?.role !== 'technician') {
            return;
        }

        void removeTechnicianMyJobService(token, jobId, service.id)
            .then(async () => {
                await fetchJobs();
            })
            .catch((error) => {
                const message = error instanceof Error ? error.message : 'Failed to remove service.';
                toast.error(message);
            });
    };

    const activeJobs = jobs.filter(j => ['pending', 'scheduled', 'in_progress', 'delayed', 'unknown'].includes(j.job_status));
    const completedJobs = jobs.filter(j => j.job_status === 'completed');

    // Handlers
    const handleAccept = async (jobId: string) => {
        if (previewTechId) {
            setJobs(prev => prev.map(j =>
                j.job_id === jobId
                    ? { ...j, job_status: 'scheduled' as JobStatus, allowed_actions: ['start', 'delay', 'refuse'] }
                    : j
            ));
            return;
        }

        const token = getStoredTechnicianToken();
        if (!token || user?.role !== 'technician') return;

        try {
            await acceptTechnicianMyJob(token, jobId);
            await fetchJobs();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to accept job.';
            toast.error(message);
        }
    };

    const handleStart = async (jobId: string) => {
        if (previewTechId) {
            setJobs(prev => prev.map(j =>
                j.job_id === jobId
                    ? { ...j, job_status: 'in_progress' as JobStatus, allowed_actions: ['done', 'delay'] }
                    : j
            ));
            return;
        }

        const token = getStoredTechnicianToken();
        if (!token || user?.role !== 'technician') return;

        try {
            await startTechnicianMyJob(token, jobId);
            await fetchJobs();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to start job.';
            toast.error(message);
        }
    };

    const handleDone = (jobId: string) => {
        setSelectedJobId(jobId);
        setDoneModalOpen(true);
    };

    const confirmDone = async () => {
        if (!selectedJobId) return;

        setConfirmLoading(true);
        if (previewTechId) {
            await new Promise(resolve => setTimeout(resolve, 800));
            setJobs(prev => prev.map(j =>
                j.job_id === selectedJobId
                    ? { ...j, job_status: 'completed' as JobStatus, allowed_actions: [] }
                    : j
            ));
        } else {
            const token = getStoredTechnicianToken();
            if (token && user?.role === 'technician') {
                try {
                    await completeTechnicianMyJob(token, selectedJobId);
                    await fetchJobs();
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Failed to complete job.';
                    toast.error(message);
                }
            }
        }

        setConfirmLoading(false);
        setDoneModalOpen(false);
        setSelectedJobId(null);
    };

    const handleDelay = (jobId: string) => {
        setSelectedJobId(jobId);
        setDelayModalOpen(true);
    };

    const confirmDelay = async () => {
        if (!selectedJobId) return;

        const minutes = delayMinutes === 'custom'
            ? parseInt(delayCustomMinutes)
            : parseInt(delayMinutes);

        if (!minutes || minutes <= 0) return;

        setConfirmLoading(true);
        if (previewTechId) {
            await new Promise(resolve => setTimeout(resolve, 800));
            setJobs(prev => prev.map(j =>
                j.job_id === selectedJobId
                    ? { ...j, job_status: 'delayed' as JobStatus }
                    : j
            ));
        } else {
            const token = getStoredTechnicianToken();
            if (token && user?.role === 'technician') {
                try {
                    await delayTechnicianMyJob(token, selectedJobId, {
                        minutes,
                        note: delayNote || undefined,
                    });
                    await fetchJobs();
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Failed to delay job.';
                    toast.error(message);
                }
            }
        }

        // Reset form
        setDelayMinutes('15');
        setDelayCustomMinutes('');
        setDelayNote('');
        setConfirmLoading(false);
        setDelayModalOpen(false);
        setSelectedJobId(null);
    };

    const handleRefuse = (jobId: string) => {
        setSelectedJobId(jobId);
        setRefuseModalOpen(true);
    };

    const confirmRefuse = async () => {
        if (!selectedJobId || !refuseReason) return;

        setConfirmLoading(true);
        if (previewTechId) {
            await new Promise(resolve => setTimeout(resolve, 800));
            setJobs(prev => prev.filter(j => j.job_id !== selectedJobId));
        } else {
            const token = getStoredTechnicianToken();
            if (token && user?.role === 'technician') {
                try {
                    await refuseTechnicianMyJob(token, selectedJobId, {
                        reason: refuseReason,
                        comment: refuseComment || undefined,
                    });
                    await fetchJobs();
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Failed to refuse job.';
                    toast.error(message);
                }
            }
        }

        // Reset form
        setRefuseReason('');
        setRefuseComment('');
        setConfirmLoading(false);
        setRefuseModalOpen(false);
        setSelectedJobId(null);
    };

    const heroEyebrow = isHistoryMode ? 'Field Archive' : 'Field Execution';
    const heroTitle = isHistoryMode ? 'Job history\nwith verified field outcomes.' : 'Current jobs\nwith field-ready control.';
    const heroDescription = isHistoryMode
        ? 'Review completed work, technician-added services, and final field outcomes from one mobile archive surface.'
        : 'Track active assignments, manage service updates, and move jobs from accepted to completed without leaving the field workspace.';
    const metricCards = isHistoryMode
        ? [
            {
                label: 'Completed Jobs',
                value: completedJobs.length,
                description: 'Finished assignments stored in your history.',
                tone: 'border-cyan-400/15 bg-[linear-gradient(180deg,rgba(12,36,55,0.96),rgba(8,24,39,0.96))] text-cyan-100',
                iconTone: 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100',
                icon: CheckCircle2,
            },
            {
                label: 'Active Records',
                value: jobs.length,
                description: 'History records currently loaded in your technician archive.',
                tone: 'border-amber-400/15 bg-[linear-gradient(180deg,rgba(41,28,15,0.94),rgba(27,18,10,0.96))] text-amber-100',
                iconTone: 'border-amber-300/20 bg-amber-300/10 text-amber-100',
                icon: Briefcase,
            },
            {
                label: 'Zones Covered',
                value: new Set(jobs.map((job) => job.zone).filter(Boolean)).size,
                description: 'Dispatch zones represented in your recorded jobs.',
                tone: 'border-emerald-400/15 bg-[linear-gradient(180deg,rgba(10,37,45,0.96),rgba(7,25,31,0.96))] text-emerald-100',
                iconTone: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100',
                icon: MapPin,
            },
        ]
        : [
            {
                label: 'Current Jobs',
                value: activeJobs.length,
                description: 'Assignments currently active in your field queue.',
                tone: 'border-cyan-400/15 bg-[linear-gradient(180deg,rgba(12,36,55,0.96),rgba(8,24,39,0.96))] text-cyan-100',
                iconTone: 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100',
                icon: Calendar,
            },
            {
                label: 'Needs Action',
                value: activeJobs.filter((job) => job.job_status === 'pending' || job.job_status === 'delayed').length,
                description: 'Jobs waiting for acceptance, restart, or delay handling.',
                tone: 'border-amber-400/15 bg-[linear-gradient(180deg,rgba(41,28,15,0.94),rgba(27,18,10,0.96))] text-amber-100',
                iconTone: 'border-amber-300/20 bg-amber-300/10 text-amber-100',
                icon: AlertTriangle,
            },
            {
                label: 'In Progress',
                value: activeJobs.filter((job) => job.job_status === 'in_progress' || job.job_status === 'scheduled').length,
                description: 'Scheduled or actively executing field work.',
                tone: 'border-emerald-400/15 bg-[linear-gradient(180deg,rgba(10,37,45,0.96),rgba(7,25,31,0.96))] text-emerald-100',
                iconTone: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100',
                icon: Play,
            },
        ];
    const boardTitle = isHistoryMode ? 'History Board' : 'Current Job Board';
    const boardDescription = offlineMode
        ? 'Offline cached job details are available on this device.'
        : isHistoryMode
        ? 'Completed technician records with service detail, technician changes, and final field actions.'
        : 'Live assignments currently active for this technician, ready for field updates.';
    const visibleCount = isHistoryMode ? completedJobs.length : activeJobs.length;
    const historyRecordsWithServiceChanges = completedJobs.filter((job) => job.service_entries.some((entry) => entry.source === 'technician')).length;

    return (
        <div className="tech-shell pb-28 text-white">
            <div className="relative w-full pb-8">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-[320px] bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),rgba(34,211,238,0)_32%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.1),rgba(16,185,129,0)_28%)]" />
                <div className="relative mx-auto w-full max-w-[1500px] space-y-6 px-3 pt-4 sm:px-4 lg:px-6">
                    <section className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(135deg,rgba(7,25,42,0.98),rgba(6,18,32,0.98))] shadow-[0_34px_120px_rgba(0,0,0,0.34)]">
                        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:120px_120px] opacity-20" />
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/70 to-transparent" />
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(47,142,146,0.14),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.12),transparent_26%)]" />
                        <div className="relative flex flex-col gap-5 p-5 lg:flex-row lg:items-end lg:justify-between lg:p-7">
                            <div className="max-w-3xl">
                                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-100">
                                    <Sparkles className="h-3.5 w-3.5" />
                                    {heroEyebrow}
                                </div>
                                <h1 className="mt-5 whitespace-pre-line text-[clamp(2rem,3.4vw,3.15rem)] font-semibold leading-[0.94] tracking-[-0.07em] text-white">
                                    {heroTitle}
                                </h1>
                                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-[15px]">
                                    {heroDescription}
                                </p>
                                <div className="mt-5 flex flex-wrap items-center gap-2">
                                    <Badge variant="outline" className="rounded-full border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-cyan-100">
                                        {visibleCount} visible
                                    </Badge>
                                    <Badge variant="outline" className="rounded-full border-amber-300/20 bg-amber-300/10 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-amber-100">
                                        {isHistoryMode ? historyRecordsWithServiceChanges : activeJobs.filter((job) => job.job_status === 'pending' || job.job_status === 'delayed').length} {isHistoryMode ? 'service changes' : 'needs action'}
                                    </Badge>
                                    <Badge variant="outline" className="rounded-full border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-300">
                                        {new Set(jobs.map((job) => job.zone).filter(Boolean)).size} zones
                                    </Badge>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 self-start lg:self-end">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => void fetchJobs()}
                                    className="h-11 gap-2 rounded-2xl border-white/10 bg-white/[0.03] px-4 text-slate-100 hover:bg-white/[0.08]"
                                    disabled={loading}
                                >
                                    <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
                                    Refresh
                                </Button>
                            </div>
                        </div>
                    </section>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {metricCards.map((card) => {
                            const Icon = card.icon;
                            return (
                                <div key={card.label} className={cn('overflow-hidden rounded-[24px] border shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]', card.tone)}>
                                    <div className="flex items-start justify-between p-5">
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{card.label}</p>
                                            <p className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-white">{card.value}</p>
                                            <p className="mt-2 text-sm text-slate-300">{card.description}</p>
                                        </div>
                                        <div className={cn('flex h-11 w-11 items-center justify-center rounded-2xl border', card.iconTone)}>
                                            <Icon className="h-5 w-5" />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,24,39,0.96),rgba(6,17,29,0.96))] shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
                        <div className="border-b border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0))] px-5 py-5">
                            <div className="flex items-start justify-between gap-3">
                                <div className="space-y-2">
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">{boardTitle}</div>
                                    <div className="text-sm text-slate-200">{boardDescription}</div>
                                </div>
                                <Badge variant="outline" className="rounded-full border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-300">
                                    {visibleCount} visible
                                </Badge>
                            </div>
                        </div>
                        <div className="p-4 sm:p-5">
                {loading ? (
                    <div className="space-y-4">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div
                                key={i}
                                className="animate-pulse rounded-[24px] border border-white/10 bg-white/[0.03] p-5"
                            >
                                <div className="mb-3 h-6 w-1/3 rounded bg-white/10"></div>
                                <div className="mb-4 h-4 w-2/3 rounded bg-white/10"></div>
                                <div className="h-12 rounded bg-white/10"></div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <>
                        {isHistoryMode ? (
                            <>
                                {completedJobs.length > 0 ? (
                                    <div className="space-y-3">
                                        {completedJobs.map((job) => (
                                            <JobCard
                                                key={job.job_id}
                                                job={job}
                                                serviceOptions={[
                                                    ...new Set([...job.service_names, ...serviceOptions]),
                                                ]}
                                                selectedServiceName={getJobSelectedService(job)}
                                                selectedServices={getSelectedServices(job)}
                                                addedServices={job.service_entries.filter((entry) => entry.source === 'technician')}
                                                canManageServices={false}
                                                onSelectService={handleSelectService}
                                                onOpenAddService={handleOpenAddService}
                                                onEditAddedService={handleOpenEditService}
                                                onRemoveAddedService={handleRemoveAddedService}
                                                onAccept={handleAccept}
                                                onStart={handleStart}
                                                onDone={handleDone}
                                                onDelay={handleDelay}
                                                onRefuse={handleRefuse}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
                                        <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-white/[0.05]">
                                            <Clock className="h-10 w-10 text-slate-500" />
                                        </div>
                                        <h3 className="mb-2 text-xl font-bold text-white">
                                            No Job History Yet
                                        </h3>
                                        <p className="max-w-sm leading-relaxed text-slate-400">
                                            Completed jobs, service changes, and finished field work will appear here after you close them out.
                                        </p>
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                {/* Active Jobs */}
                                {activeJobs.length > 0 && (
                                    <div className="space-y-3">
                                        {activeJobs.map((job) => (
                                            <JobCard
                                                key={job.job_id}
                                                job={job}
                                                serviceOptions={[
                                                    ...new Set([...job.service_names, ...serviceOptions]),
                                                ]}
                                                selectedServiceName={getJobSelectedService(job)}
                                                selectedServices={getSelectedServices(job)}
                                                addedServices={job.service_entries.filter((entry) => entry.source === 'technician')}
                                                canManageServices={job.job_status !== 'pending'}
                                                onSelectService={handleSelectService}
                                                onOpenAddService={handleOpenAddService}
                                                onEditAddedService={handleOpenEditService}
                                                onRemoveAddedService={handleRemoveAddedService}
                                                onAccept={handleAccept}
                                                onStart={handleStart}
                                                onDone={handleDone}
                                                onDelay={handleDelay}
                                                onRefuse={handleRefuse}
                                            />
                                        ))}
                                    </div>
                                )}

                                {/* Empty State */}
                                {activeJobs.length === 0 && (
                                    <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
                                        <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-white/[0.05]">
                                            <Calendar className="h-10 w-10 text-slate-500" />
                                        </div>
                                        <h3 className="mb-2 text-xl font-bold text-white">
                                            No Current Jobs
                                        </h3>
                                        <p className="max-w-sm leading-relaxed text-slate-400">
                                            New confirmed jobs from admin will appear in the Jobs tab.
                                        </p>
                                    </div>
                                )}
                            </>
                        )}
                    </>
                )}
                        </div>
                    </section>
                </div>
            </div>

            {/* Delay Modal */}
            <Dialog open={addServiceModalOpen} onOpenChange={setAddServiceModalOpen}>
                <DialogContent className="w-[calc(100%-1.5rem)] max-w-md rounded-[24px] border-white/10 bg-[linear-gradient(180deg,rgba(9,24,39,0.98),rgba(6,17,29,0.98))] text-slate-100 sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editingServiceId ? 'Edit Service' : 'Add Service'}</DialogTitle>
                        <DialogDescription>
                            {editingServiceId ? 'Update this technician-added service.' : 'Add an additional service to this job.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="service-type">Service Type</Label>
                            <Select value={addServiceName} onValueChange={setAddServiceName}>
                                <SelectTrigger id="service-type">
                                    <SelectValue placeholder="Select service" />
                                </SelectTrigger>
                                <SelectContent>
                                    {(selectedJobId ? (
                                        editingServiceId
                                            ? Array.from(new Set([
                                                addServiceName,
                                                ...getAvailableAdditionalServices(jobs.find((job) => job.job_id === selectedJobId) || {
                                                    job_id: '',
                                                    job_code: '',
                                                    dealership_name: '',
                                                    service_name: '',
                                                    original_service_name: '',
                                                    service_names: [],
                                                    service_entries: [],
                                                    job_status: 'unknown',
                                                    zone: '',
                                                    allowed_actions: [],
                                                }),
                                            ].filter(Boolean)))
                                            : getAvailableAdditionalServices(jobs.find((job) => job.job_id === selectedJobId) || {
                                        job_id: '',
                                        job_code: '',
                                        dealership_name: '',
                                        service_name: '',
                                        original_service_name: '',
                                        service_names: [],
                                        service_entries: [],
                                        job_status: 'unknown',
                                        zone: '',
                                        allowed_actions: [],
                                    })
                                    ) : []).map((service) => (
                                        <SelectItem key={`add-service-${service}`} value={service}>
                                            {service}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="service-notes">Notes (Optional)</Label>
                            <Textarea
                                id="service-notes"
                                placeholder="Customer requested extra tint for rear window"
                                value={addServiceNotes}
                                onChange={(e) => setAddServiceNotes(e.target.value)}
                                rows={3}
                            />
                        </div>
                    </div>

                    <DialogFooter className="flex-col sm:flex-row gap-2">
                        <Button
                            variant="outline"
                            onClick={closeAddServiceModal}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleConfirmAddService}
                            disabled={!addServiceName.trim()}
                            className="bg-[#2F8E92] hover:bg-[#267276]"
                        >
                            {editingServiceId ? 'Save Service' : 'Add Service'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delay Modal */}
            <Dialog open={delayModalOpen} onOpenChange={setDelayModalOpen}>
                <DialogContent className="w-[calc(100%-1.5rem)] max-w-md rounded-[24px] border-white/10 bg-[linear-gradient(180deg,rgba(9,24,39,0.98),rgba(6,17,29,0.98))] text-slate-100 sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Delay Job</DialogTitle>
                        <DialogDescription>
                            Select delay duration and add an optional note
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="delay-minutes">Delay Duration</Label>
                            <Select value={delayMinutes} onValueChange={setDelayMinutes}>
                                <SelectTrigger id="delay-minutes">
                                    <SelectValue placeholder="Select duration" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="15">15 minutes</SelectItem>
                                    <SelectItem value="30">30 minutes</SelectItem>
                                    <SelectItem value="60">60 minutes</SelectItem>
                                    <SelectItem value="custom">Custom</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {delayMinutes === 'custom' && (
                            <div className="space-y-2">
                                <Label htmlFor="custom-minutes">Custom Minutes</Label>
                                <Input
                                    id="custom-minutes"
                                    type="number"
                                    placeholder="Enter minutes"
                                    value={delayCustomMinutes}
                                    onChange={(e) => setDelayCustomMinutes(e.target.value)}
                                    min="1"
                                />
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="delay-note">Note (Optional)</Label>
                            <Textarea
                                id="delay-note"
                                placeholder="Add a note about the delay..."
                                value={delayNote}
                                onChange={(e) => setDelayNote(e.target.value)}
                                rows={3}
                            />
                        </div>
                    </div>

                    <DialogFooter className="flex-col sm:flex-row gap-2">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setDelayModalOpen(false);
                                setDelayMinutes('15');
                                setDelayCustomMinutes('');
                                setDelayNote('');
                            }}
                            disabled={confirmLoading}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={confirmDelay}
                            disabled={confirmLoading || (delayMinutes === 'custom' && !delayCustomMinutes)}
                            className="bg-orange-600 hover:bg-orange-700"
                        >
                            {confirmLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Confirm Delay
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Refuse Modal */}
            <Dialog open={refuseModalOpen} onOpenChange={setRefuseModalOpen}>
                <DialogContent className="w-[calc(100%-1.5rem)] max-w-md rounded-[24px] border-white/10 bg-[linear-gradient(180deg,rgba(9,24,39,0.98),rgba(6,17,29,0.98))] text-slate-100 sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Refuse Job</DialogTitle>
                        <DialogDescription>
                            Please provide a reason for refusing this job
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="refuse-reason">Reason *</Label>
                            <Select value={refuseReason} onValueChange={setRefuseReason}>
                                <SelectTrigger id="refuse-reason">
                                    <SelectValue placeholder="Select a reason" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="too_far">Too far from location</SelectItem>
                                    <SelectItem value="no_equipment">Don't have required equipment</SelectItem>
                                    <SelectItem value="schedule_conflict">Schedule conflict</SelectItem>
                                    <SelectItem value="vehicle_issue">Vehicle issue</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="refuse-comment">Additional Comment (Optional)</Label>
                            <Textarea
                                id="refuse-comment"
                                placeholder="Add any additional details..."
                                value={refuseComment}
                                onChange={(e) => setRefuseComment(e.target.value)}
                                rows={3}
                            />
                        </div>
                    </div>

                    <DialogFooter className="flex-col sm:flex-row gap-2">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setRefuseModalOpen(false);
                                setRefuseReason('');
                                setRefuseComment('');
                            }}
                            disabled={confirmLoading}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={confirmRefuse}
                            disabled={confirmLoading || !refuseReason}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {confirmLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Confirm Refuse
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Done Confirmation Modal */}
            <Dialog open={doneModalOpen} onOpenChange={setDoneModalOpen}>
                <DialogContent className="w-[calc(100%-1.5rem)] max-w-md rounded-[24px] border-white/10 bg-[linear-gradient(180deg,rgba(9,24,39,0.98),rgba(6,17,29,0.98))] text-slate-100 sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Complete Job</DialogTitle>
                        <DialogDescription>
                            Mark this job as completed?
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            This action will mark the job as completed and move it to your completed jobs list.
                        </p>
                    </div>

                    <DialogFooter className="flex-col sm:flex-row gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setDoneModalOpen(false)}
                            disabled={confirmLoading}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={confirmDone}
                            disabled={confirmLoading}
                            className="bg-emerald-600 hover:bg-emerald-700"
                        >
                            {confirmLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Confirm Complete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Bottom Navigation */}
            <TechnicianBottomNav activeTab={isHistoryMode ? 'history' : 'current-job'} routeBase={routeBase} />
        </div>
    );
}

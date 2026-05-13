import { useState, useEffect, useMemo, useRef, type TouchEvent } from 'react';
import {
    RefreshCw,
    MapPin,
    Clock,
    Briefcase,
    Calendar,
    User,
    AlertCircle,
    ArrowRight,
    Sparkles,
    Send,
    RadioTower,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import OverflowText from '@/components/common/overflow-text';
import TechnicianBottomNav from '@/components/common/technician-bottom-nav';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
    fetchAdminTechnicianJobsFeed,
    fetchTechnicianJobsFeed,
    getStoredAdminToken,
    getStoredTechnicianToken,
    registerTechnicianPushSubscription,
    type BackendTechnicianJobFeedItem,
} from '@/lib/backend-api';
import { DISPATCH_JOB_STATUS, normalizeDispatchJobStatus } from '@/lib/job-status';

// --- Types ---

type Urgency = 'low' | 'normal' | 'high' | 'critical';

interface AvailableJob {
    job_id: string;
    job_code: string;
    dealership_name: string;
    service_name: string;
    urgency: Urgency;
    zone: string;
    created_at: string;
    note_preview?: string;
    status: 'pending' | 'scheduled' | 'in_progress' | 'delayed' | 'unknown';
}

const getJobTimestamp = (value: string) => {
    const timestamp = new Date(value).getTime();
    return Number.isNaN(timestamp) ? 0 : timestamp;
};

const sortJobsByNewest = (jobs: AvailableJob[]) => (
    [...jobs].sort((a, b) => getJobTimestamp(b.created_at) - getJobTimestamp(a.created_at))
);

const offlineJobsKey = (technicianId: string) => `sm2_technician_jobs_cache:${technicianId}`;

const readOfflineJobs = (technicianId: string): AvailableJob[] => {
    try {
        const raw = window.localStorage.getItem(offlineJobsKey(technicianId));
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed?.jobs) ? parsed.jobs : [];
    } catch {
        return [];
    }
};

const writeOfflineJobs = (technicianId: string, jobs: AvailableJob[]) => {
    try {
        window.localStorage.setItem(offlineJobsKey(technicianId), JSON.stringify({
            cachedAt: new Date().toISOString(),
            jobs,
        }));
    } catch {
        // Local storage can be unavailable in private browsing; the service worker still caches shell/API reads.
    }
};

const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = `${base64String}${padding}`.replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
};

const mapBackendPortalJobsItem = (item: BackendTechnicianJobFeedItem): AvailableJob => {
    const normalizedStatus = normalizeDispatchJobStatus(item.status);
    const status: AvailableJob['status'] =
        normalizedStatus === DISPATCH_JOB_STATUS.PENDING ? 'pending'
            : normalizedStatus === DISPATCH_JOB_STATUS.SCHEDULED ? 'scheduled'
                : normalizedStatus === DISPATCH_JOB_STATUS.IN_PROGRESS ? 'in_progress'
                    : normalizedStatus === DISPATCH_JOB_STATUS.DELAYED ? 'delayed'
                        : 'unknown';

    return {
        job_id: item.id,
        job_code: item.job_code,
        dealership_name: item.dealership_name || 'Unknown Dealership',
        service_name: item.service_name || 'Service Request',
        urgency: 'normal',
        zone: item.zone_name || 'Unspecified',
        created_at: item.created_at || item.updated_at,
        status,
    };
};

// --- Components ---

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

function TimeAgo({ timestamp }: { timestamp: string }) {
    const getTimeAgo = (isoString: string): string => {
        const now = new Date();
        const past = new Date(isoString);
        const diffMs = now.getTime() - past.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays}d ago`;
    };

    return (
        <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {getTimeAgo(timestamp)}
        </span>
    );
}

function JobCard({
    job,
    onOpenCurrentJob,
}: {
    job: AvailableJob;
    onOpenCurrentJob: (jobId: string) => void;
}) {
    const statusStyles: Record<AvailableJob['status'], string> = {
        pending: 'bg-amber-100 text-amber-700 border-amber-300',
        scheduled: 'bg-blue-100 text-blue-700 border-blue-300',
        in_progress: 'bg-emerald-100 text-emerald-700 border-emerald-300',
        delayed: 'bg-orange-100 text-orange-700 border-orange-300',
        unknown: 'bg-gray-100 text-gray-700 border-gray-300',
    };
    const statusLabels: Record<AvailableJob['status'], string> = {
        pending: 'Pending',
        scheduled: 'Scheduled',
        in_progress: 'In Progress',
        delayed: 'Delayed',
        unknown: 'Unknown',
    };

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={() => onOpenCurrentJob(job.job_id)}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onOpenCurrentJob(job.job_id);
                }
            }}
            className="cursor-pointer overflow-hidden rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,24,39,0.96),rgba(6,17,29,0.98))] shadow-[0_24px_80px_rgba(0,0,0,0.28)] transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-300/24 hover:shadow-[0_28px_90px_rgba(34,211,238,0.1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/40"
        >
            <div className="p-5 pb-4 space-y-3">
                {/* Job Code & Time */}
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h3 className="text-lg font-bold tracking-tight text-white">
                            {job.job_code}
                        </h3>
                        <OverflowText text={job.service_name} as="p" className="mt-0.5 max-w-[20rem] text-sm font-medium text-slate-400" />
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <Badge variant="outline" className={cn('text-xs font-semibold border', statusStyles[job.status])}>
                            {statusLabels[job.status]}
                        </Badge>
                        <UrgencyBadge urgency={job.urgency} />
                    </div>
                </div>

                {/* Dealership */}
                <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 flex-shrink-0 text-slate-500" />
                    <OverflowText text={job.dealership_name} className="max-w-[18rem] text-base font-semibold text-slate-100" />
                </div>

                {/* Zone & Time */}
                <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1.5 text-slate-400">
                        <MapPin className="h-4 w-4 text-cyan-300" />
                        <span className="font-medium">{job.zone}</span>
                    </div>
                    <TimeAgo timestamp={job.created_at} />
                </div>

                {/* Note Preview (if exists) */}
                {job.note_preview && (
                    <div className="border-t border-white/8 pt-2">
                        <p className="text-sm leading-relaxed text-slate-300">
                            <span className="inline-flex items-center gap-1.5">
                                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 text-amber-400" />
                                <span className="font-medium">Note:</span>
                            </span>{' '}
                            <OverflowText text={job.note_preview} lines={2} className="inline max-w-[18rem]" />
                        </p>
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="px-5 pb-5">
                <div className="grid grid-cols-1 gap-3">
                    <Button
                        onClick={(event) => {
                            event.stopPropagation();
                            onOpenCurrentJob(job.job_id);
                        }}
                        className={cn(
                            "h-12 text-base font-semibold rounded-xl transition-all duration-200",
                            "bg-[#2F8E92] text-white hover:bg-[#267276]",
                            "shadow-sm hover:shadow-md active:scale-[0.98]"
                        )}
                    >
                        <ArrowRight className="w-5 h-5 mr-2" />
                        Open Current Job
                    </Button>
                </div>
            </div>
        </div>
    );
}

// --- Main Component ---

export default function AvailableJobsPage() {
    const [jobs, setJobs] = useState<AvailableJob[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPullRefreshing, setIsPullRefreshing] = useState(false);
    const [offlineMode, setOfflineMode] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const touchStartYRef = useRef<number | null>(null);
    const knownJobIdsRef = useRef<Set<string>>(new Set());
    const { techId: previewTechId } = useParams();
    const { user, technicianAccounts } = useAuth();
    const navigate = useNavigate();
    const technicianDirectory = useMemo(
        () => technicianAccounts.map((tech) => ({
            id: tech.id,
            name: tech.name,
            techCode: tech.id.slice(0, 8).toUpperCase(),
            status: tech.isActive ? 'active' : 'inactive',
        })),
        [technicianAccounts],
    );

    const currentTech = useMemo(() => {
        if (previewTechId) {
            const previewTech = technicianDirectory.find((tech) => tech.id === previewTechId);
            if (previewTech) return previewTech;
            return { id: previewTechId, name: 'Preview Technician', techCode: 'TECH-001', status: 'active' };
        }

        if (user?.role === 'technician') {
            return {
                id: user.id,
                name: user.name,
                techCode: user.id.slice(0, 8).toUpperCase(),
                status: 'active',
            };
        }

        return technicianDirectory[0] ?? { id: 'tech-001', name: 'Technician', techCode: 'TECH-001', status: 'active' };
    }, [previewTechId, technicianDirectory, user]);

    const currentTechId = currentTech.id;
    const currentTechCode = currentTech.techCode ?? currentTech.id;
    const isPreviewMode = Boolean(previewTechId);
    const routeBase = isPreviewMode ? `/admin/tech-preview/${currentTechId}` : '/tech';
    const currentJobPath = `${routeBase}/current-job`;
    const jobsByStatus = useMemo(() => ({
        total: jobs.length,
        pending: jobs.filter((job) => job.status === 'pending').length,
        active: jobs.filter((job) => job.status === 'scheduled' || job.status === 'in_progress' || job.status === 'delayed').length,
        zones: new Set(jobs.map((job) => job.zone).filter(Boolean)).size,
    }), [jobs]);

    const notifyNewAssignments = async (incomingJobs: AvailableJob[]) => {
        const previousIds = knownJobIdsRef.current;
        const newJobs = incomingJobs.filter((job) => !previousIds.has(job.job_id));
        knownJobIdsRef.current = new Set(incomingJobs.map((job) => job.job_id));

        if (!previousIds.size || !newJobs.length || typeof window === 'undefined') return;
        if (!('Notification' in window) || Notification.permission !== 'granted') return;

        const [job] = newJobs;
        const body = `${job.dealership_name} - ${job.service_name}`;
        const url = `${currentJobPath}?jobId=${encodeURIComponent(job.job_id)}`;
        const registration = 'serviceWorker' in navigator ? await navigator.serviceWorker.ready.catch(() => null) : null;

        if (registration?.active) {
            registration.active.postMessage({
                type: 'SM2_SHOW_JOB_NOTIFICATION',
                title: 'New assigned job',
                body,
                url,
            });
            return;
        }

        new Notification('New assigned job', {
            body,
            icon: '/pwa-icon.svg',
        });
    };

    const requestNotificationPermission = async () => {
        if (!('Notification' in window) || Notification.permission !== 'default') return;
        try {
            await Notification.requestPermission();
        } catch {
            // Permission prompts are browser-controlled; ignore if unavailable.
        }
    };

    const registerPushSubscription = async () => {
        const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
        const token = getStoredTechnicianToken();
        if (!vapidPublicKey || !token || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
        if (!('Notification' in window) || Notification.permission !== 'granted') return;

        try {
            const registration = await navigator.serviceWorker.ready;
            const existing = await registration.pushManager.getSubscription();
            const subscription = existing ?? await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
            });
            await registerTechnicianPushSubscription(token, subscription.toJSON());
        } catch {
            // Backend push endpoints or browser push may be unavailable in local/dev; foreground polling still works.
        }
    };

    const applyJobs = (nextJobs: AvailableJob[], options?: { fromCache?: boolean }) => {
        const sortedJobs = sortJobsByNewest(nextJobs);
        setJobs(sortedJobs);
        setOfflineMode(Boolean(options?.fromCache));
        if (!options?.fromCache) {
            writeOfflineJobs(currentTechId, sortedJobs);
            void notifyNewAssignments(sortedJobs);
        } else {
            knownJobIdsRef.current = new Set(sortedJobs.map((job) => job.job_id));
        }
    };

    const fetchJobs = async () => {
        setLoading(true);
        if (isPreviewMode) {
            const adminToken = getStoredAdminToken();
            if (!adminToken) {
                applyJobs(readOfflineJobs(currentTechId), { fromCache: true });
                setLastUpdated(new Date());
                setLoading(false);
                return;
            }
            try {
                const feed = await fetchAdminTechnicianJobsFeed(adminToken, currentTechId);
                const mergedJobs = [...feed.available_jobs, ...feed.my_jobs]
                    .map(mapBackendPortalJobsItem)
                    .filter((job) => job.status !== 'unknown');
                applyJobs(mergedJobs);
            } catch {
                applyJobs(readOfflineJobs(currentTechId), { fromCache: true });
            }
            setLastUpdated(new Date());
            setLoading(false);
            return;
        }

        const token = getStoredTechnicianToken();
        if (!token || user?.role !== 'technician') {
            applyJobs(readOfflineJobs(currentTechId), { fromCache: true });
            setLastUpdated(new Date());
            setLoading(false);
            return;
        }
        try {
            const feed = await fetchTechnicianJobsFeed(token);
            const mergedJobs = [...feed.available_jobs, ...feed.my_jobs]
                .map(mapBackendPortalJobsItem)
                .filter((job) => job.status !== 'unknown');
            applyJobs(mergedJobs);
        } catch {
            applyJobs(readOfflineJobs(currentTechId), { fromCache: true });
        }
        setLastUpdated(new Date());
        setLoading(false);
    };

    useEffect(() => {
        applyJobs(readOfflineJobs(currentTechId), { fromCache: true });
        void fetchJobs();
    }, [currentTechId, isPreviewMode, user?.id, user?.role]);

    useEffect(() => {
        void requestNotificationPermission().then(registerPushSubscription);
    }, []);

    useEffect(() => {
        if (isPreviewMode) return;
        const intervalId = setInterval(() => {
            void fetchJobs();
        }, 10000);
        const onFocus = () => { void fetchJobs(); };
        window.addEventListener('focus', onFocus);
        return () => {
            clearInterval(intervalId);
            window.removeEventListener('focus', onFocus);
        };
    }, [isPreviewMode, currentTechId, user?.id, user?.role]);

    const handleOpenCurrentJob = (jobId: string) => {
        navigate(`${currentJobPath}?jobId=${encodeURIComponent(jobId)}`);
    };

    const handleRefresh = async () => {
        await fetchJobs();
    };

    const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
        if (window.scrollY > 0) return;
        touchStartYRef.current = event.touches[0]?.clientY ?? null;
    };

    const handleTouchEnd = async (event: TouchEvent<HTMLDivElement>) => {
        const startY = touchStartYRef.current;
        touchStartYRef.current = null;
        if (startY === null || loading || isPullRefreshing) return;
        const endY = event.changedTouches[0]?.clientY ?? startY;
        if (endY - startY < 72 || window.scrollY > 4) return;

        setIsPullRefreshing(true);
        await fetchJobs();
        setIsPullRefreshing(false);
    };

    return (
        <div className="tech-shell pb-24 text-white" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
            <div className="relative w-full pb-8">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-[320px] bg-[radial-gradient(circle_at_top_left,rgba(79,124,255,0.08),rgba(79,124,255,0)_32%),radial-gradient(circle_at_top_right,rgba(45,212,191,0.07),rgba(45,212,191,0)_28%)]" />
                <div className="relative mx-auto w-full max-w-[1500px] space-y-6 px-4 pt-4 sm:px-6 lg:px-8">
                    <section className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(135deg,rgba(7,25,42,0.98),rgba(6,18,32,0.98))] shadow-[0_34px_120px_rgba(0,0,0,0.34)]">
                        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:120px_120px] opacity-20" />
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent" />
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(79,124,255,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(148,163,184,0.1),transparent_26%)]" />
                        <div className="relative flex flex-col gap-5 p-5 lg:flex-row lg:items-end lg:justify-between lg:p-7">
                            <div className="max-w-3xl">
                                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-white">
                                    <Sparkles className="h-3.5 w-3.5" />
                                    Technician Queue
                                </div>
                                <h1 className="mt-5 text-[clamp(2rem,3.4vw,3.15rem)] font-semibold leading-[0.94] tracking-[-0.07em] text-white">
                                    Assigned jobs
                                    <br />
                                    with live dispatch context.
                                </h1>
                                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-[15px]">
                                    Review incoming assignments, open your current job, and keep field work moving from one focused technician workspace.
                                </p>
                                <div className="mt-5 flex flex-wrap items-center gap-2">
                                    <Badge variant="outline" className="rounded-full border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white">
                                        {jobsByStatus.total} jobs
                                    </Badge>
                                    <Badge variant="outline" className="rounded-full border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white">
                                        {jobsByStatus.pending} pending
                                    </Badge>
                                    <Badge variant="outline" className="rounded-full border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-300">
                                        {jobsByStatus.zones} zones
                                    </Badge>
                                </div>
                                <p className="mt-3 text-xs font-medium text-white/80">
                                    Viewing as {currentTech.name} ({currentTechCode})
                                </p>
                                {lastUpdated ? (
                                    <p className="mt-1 text-xs text-slate-500">
                                        {offlineMode ? 'Offline cache' : 'Updated'} {lastUpdated.toLocaleTimeString()}
                                    </p>
                                ) : null}
                            </div>
                            <div className="flex items-center gap-3 self-start lg:self-end">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleRefresh}
                                    className="h-11 gap-2 rounded-2xl border border-white/12 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(8,12,20,0.98))] px-4 text-slate-100 shadow-[0_14px_34px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.055)] hover:bg-[linear-gradient(180deg,rgba(24,38,64,0.98),rgba(12,20,34,0.98))] hover:text-white disabled:border-white/10 disabled:bg-[linear-gradient(180deg,rgba(24,34,52,0.88),rgba(12,20,34,0.88))] disabled:text-slate-400 disabled:opacity-100"
                                    disabled={loading}
                                >
                                    <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                                    {isPullRefreshing ? 'Refreshing...' : 'Refresh'}
                                </Button>
                            </div>
                        </div>
                    </section>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        <div className="overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(14,23,40,0.98),rgba(8,12,20,0.98))] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                            <div className="flex items-start justify-between p-5">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Jobs Sent</p>
                                    <p className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-white">{jobsByStatus.total}</p>
                                    <p className="mt-2 text-sm text-slate-300">Admin-confirmed assignments visible to you.</p>
                                </div>
                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white">
                                    <Send className="h-5 w-5" />
                                </div>
                            </div>
                        </div>
                        <div className="overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(14,23,40,0.98),rgba(8,12,20,0.98))] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                            <div className="flex items-start justify-between p-5">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Pending Review</p>
                                    <p className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-white">{jobsByStatus.pending}</p>
                                    <p className="mt-2 text-sm text-slate-300">Jobs waiting for your next action.</p>
                                </div>
                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white">
                                    <RadioTower className="h-5 w-5" />
                                </div>
                            </div>
                        </div>
                        <div className="overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(14,23,40,0.98),rgba(8,12,20,0.98))] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                            <div className="flex items-start justify-between p-5">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Active Pipeline</p>
                                    <p className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-white">{jobsByStatus.active}</p>
                                    <p className="mt-2 text-sm text-slate-300">Scheduled or live field work in progress.</p>
                                </div>
                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white">
                                    <Briefcase className="h-5 w-5" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,24,39,0.96),rgba(6,17,29,0.96))] shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
                        <div className="border-b border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0))] px-5 py-5">
                            <div className="flex items-start justify-between gap-3">
                                <div className="space-y-2">
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Technician Board</div>
                                    <div className="text-sm text-slate-200">
                                        {offlineMode ? 'Offline cached assignments available on this device.' : 'Assignments sent from dispatch and ready for action in the field.'}
                                    </div>
                                </div>
                                <Badge variant="outline" className="rounded-full border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-300">
                                    {jobsByStatus.total} visible
                                </Badge>
                            </div>
                        </div>
                        <div className="p-4 sm:p-5">
                {loading ? (
                    // Loading State
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
                ) : jobs.length === 0 ? (
                    // Empty State
                    <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
                        <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-white/[0.05]">
                            <Briefcase className="h-10 w-10 text-slate-500" />
                        </div>
                        <h3 className="mb-2 text-xl font-bold text-white">
                            No Jobs Sent Yet
                        </h3>
                        <p className="max-w-sm leading-relaxed text-slate-400">
                            Admin-confirmed jobs assigned to this technician will appear here.
                        </p>
                    </div>
                ) : (
                    // Job Cards
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                        {jobs.map((job) => (
                            <JobCard
                                key={job.job_id}
                                job={job}
                                onOpenCurrentJob={handleOpenCurrentJob}
                            />
                        ))}
                    </div>
                )}
                        </div>
                    </section>
                </div>
            </div>

            {/* Bottom Navigation */}
            <TechnicianBottomNav activeTab="jobs" routeBase={routeBase} />
        </div>
    );
}

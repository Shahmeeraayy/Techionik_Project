import { ArrowUpRight, BriefcaseBusiness, Clock3, Image as ImageIcon, MapPin, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { buildGoogleMapsUrl, formatCoordinate, getChatMessageKind, getChatMessageMetadata, isImportantChatMessage } from '@/lib/chat-ui';
import { cn } from '@/lib/utils';
import type { BackendChatConversation, BackendChatMessage } from '@/lib/backend-api';

type ViewerRole = 'admin' | 'technician';
type Tone = 'light' | 'dark';

type StructuredMessageCardProps = {
  message: BackendChatMessage;
  conversation: BackendChatConversation | null;
  viewerRole: ViewerRole;
  tone: Tone;
  onOpenJob: (jobId: string) => void;
  className?: string;
};

function formatIsoDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatIsoTime(value?: string | null) {
  if (!value) return null;
  const date = new Date(`1970-01-01T${value}`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase();
}

function openExternalUrl(url: string) {
  const win = window.open(url, '_blank', 'noopener,noreferrer');
  if (!win) {
    toast.error('Unable to open the secure map preview.');
  }
}

export function StructuredMessageCard({
  message,
  conversation,
  viewerRole,
  tone,
  onOpenJob,
  className,
}: StructuredMessageCardProps) {
  const metadata = getChatMessageMetadata(message);
  const kind = getChatMessageKind(message);
  const important = isImportantChatMessage(message);
  const jobId = typeof metadata.job_id === 'string' && metadata.job_id
    ? metadata.job_id
    : (conversation?.job_id ?? null);
  const jobCode = typeof metadata.job_code === 'string' && metadata.job_code
    ? metadata.job_code
    : (conversation?.job_code ?? null);
  const jobStatus = typeof metadata.job_status === 'string' && metadata.job_status
    ? metadata.job_status
    : (conversation?.job_status ?? null);
  const jobLocation = typeof metadata.job_location === 'string' ? metadata.job_location : null;
  const jobRequestedServiceDate = typeof metadata.job_requested_service_date === 'string'
    ? metadata.job_requested_service_date
    : null;
  const jobRequestedServiceTime = typeof metadata.job_requested_service_time === 'string'
    ? metadata.job_requested_service_time
    : null;
  const latitude = typeof metadata.latitude === 'number' ? metadata.latitude : null;
  const longitude = typeof metadata.longitude === 'number' ? metadata.longitude : null;
  const accuracy = typeof metadata.accuracy === 'number' ? metadata.accuracy : null;
  const mapUrl = typeof metadata.map_url === 'string' && metadata.map_url
    ? metadata.map_url
    : (latitude !== null && longitude !== null ? buildGoogleMapsUrl(latitude, longitude) : null);

  if (!important && !kind) {
    return null;
  }

  const shellClasses = tone === 'light'
    ? 'border-slate-200 bg-slate-50 text-slate-900'
    : 'border-white/10 bg-white/[0.04] text-white';
  const mutedClasses = tone === 'light' ? 'text-slate-500' : 'text-slate-400';
  const subtleClasses = tone === 'light' ? 'text-slate-600' : 'text-slate-300';
  const buttonClasses = tone === 'light'
    ? 'border-slate-200 bg-white text-slate-800 hover:bg-slate-100'
    : 'border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]';

  return (
    <div className={cn('space-y-2', className)}>
      {important ? (
        <Badge className={cn(
          'rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.18em]',
          tone === 'light'
            ? 'bg-amber-100 text-amber-900'
            : 'bg-amber-300/15 text-amber-100',
        )}>
          <Sparkles className="mr-1 h-3 w-3" />
          Important
        </Badge>
      ) : null}

      {kind === 'site_photo' ? (
        <Badge variant="outline" className={cn(
          'h-5 w-fit border-emerald-300/20 px-2 text-[10px]',
          tone === 'light'
            ? 'bg-emerald-50 text-emerald-700'
            : 'bg-emerald-300/10 text-emerald-100',
        )}>
          <ImageIcon className="mr-1 h-3 w-3" />
          Site photo
        </Badge>
      ) : null}

      {kind === 'location_request' ? (
        <div className={cn('rounded-2xl border px-4 py-3', shellClasses)}>
          <div className="flex items-start gap-3">
            <div className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border',
              tone === 'light' ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100',
            )}>
              <MapPin className="h-5 w-5" />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-semibold">Location request sent</p>
              <p className={cn('text-xs leading-5', subtleClasses)}>
                {message.text || (viewerRole === 'technician'
                  ? 'Share your current location from the secure request card above, or decline if needed.'
                  : 'The technician will receive a private location request in Chatter.')}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {kind === 'status_request' ? (
        <div className={cn('rounded-2xl border px-4 py-3', shellClasses)}>
          <div className="flex items-start gap-3">
            <div className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border',
              tone === 'light' ? 'border-violet-200 bg-violet-50 text-violet-700' : 'border-violet-300/20 bg-violet-300/10 text-violet-100',
            )}>
              <Clock3 className="h-5 w-5" />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-semibold">Status update requested</p>
              <p className={cn('text-xs leading-5', subtleClasses)}>
                {message.text || 'Please send a status update when you can.'}
              </p>
              <p className={cn('text-[11px] leading-5', mutedClasses)}>
                {viewerRole === 'technician'
                  ? 'Reply with text, voice, or a secure attachment from the composer below.'
                  : 'Awaiting the technician reply in this thread.'}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {kind === 'live_location' ? (
        <div className={cn('rounded-2xl border px-4 py-3', shellClasses)}>
          <div className="flex items-start gap-3">
            <div className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border',
              tone === 'light' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100',
            )}>
              <MapPin className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div>
                <p className="text-sm font-semibold">Live location shared</p>
                <p className={cn('text-xs leading-5', subtleClasses)}>
                  {message.text || 'Current location shared securely inside this tenant.'}
                </p>
              </div>
              <div className={cn('grid gap-2 text-xs sm:grid-cols-3', mutedClasses)}>
                {latitude !== null && longitude !== null ? (
                  <div className="rounded-xl border border-dashed border-current/15 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-[0.18em]">Coordinates</div>
                    <div className="mt-1 font-medium">
                      {formatCoordinate(latitude)}, {formatCoordinate(longitude)}
                    </div>
                  </div>
                ) : null}
                {accuracy !== null ? (
                  <div className="rounded-xl border border-dashed border-current/15 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-[0.18em]">Accuracy</div>
                    <div className="mt-1 font-medium">{Math.round(accuracy)} m</div>
                  </div>
                ) : null}
                <div className="rounded-xl border border-dashed border-current/15 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-[0.18em]">Shared</div>
                  <div className="mt-1 font-medium">Securely in Chatter</div>
                </div>
              </div>
              {mapUrl ? (
                <div className="pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => openExternalUrl(mapUrl)}
                    className={cn('h-9 gap-2 rounded-full', buttonClasses)}
                  >
                    View map
                    <ArrowUpRight className="h-4 w-4" />
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {kind === 'job_details' ? (
        <div className={cn('rounded-2xl border px-4 py-3', shellClasses)}>
          <div className="flex items-start gap-3">
            <div className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border',
              tone === 'light' ? 'border-cyan-200 bg-cyan-50 text-cyan-700' : 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100',
            )}>
              <BriefcaseBusiness className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <p className="text-sm font-semibold">Job details shared</p>
                <p className={cn('text-xs leading-5', subtleClasses)}>
                  {message.text || 'Relevant job context is attached to this conversation.'}
                </p>
              </div>
              <div className={cn('grid gap-2 text-xs sm:grid-cols-2', mutedClasses)}>
                {jobCode ? (
                  <div className="rounded-xl border border-dashed border-current/15 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-[0.18em]">Job code</div>
                    <div className="mt-1 font-medium">{jobCode}</div>
                  </div>
                ) : null}
                {jobStatus ? (
                  <div className="rounded-xl border border-dashed border-current/15 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-[0.18em]">Status</div>
                    <div className="mt-1 font-medium">{jobStatus}</div>
                  </div>
                ) : null}
                {jobLocation ? (
                  <div className="rounded-xl border border-dashed border-current/15 px-3 py-2 sm:col-span-2">
                    <div className="text-[10px] uppercase tracking-[0.18em]">Location</div>
                    <div className="mt-1 font-medium">{jobLocation}</div>
                  </div>
                ) : null}
                {(jobRequestedServiceDate || jobRequestedServiceTime) ? (
                  <div className="rounded-xl border border-dashed border-current/15 px-3 py-2 sm:col-span-2">
                    <div className="text-[10px] uppercase tracking-[0.18em]">Requested service</div>
                    <div className="mt-1 font-medium">
                      {[formatIsoDate(jobRequestedServiceDate), formatIsoTime(jobRequestedServiceTime)].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                ) : null}
              </div>
              {jobId ? (
                <div className="pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onOpenJob(jobId)}
                    className={cn('h-9 gap-2 rounded-full', buttonClasses)}
                  >
                    Open job
                    <ArrowUpRight className="h-4 w-4" />
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}


import { Star } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type ChatPresenceTone = 'online' | 'busy' | 'away' | 'offline' | 'neutral';

export type ChatListItemProps = {
  title: string;
  preview?: string | null;
  timestamp?: string | null;
  statusLabel?: string | null;
  statusTone?: ChatPresenceTone;
  initials: string;
  avatarUrl?: string | null;
  active?: boolean;
  unreadCount?: number;
  favorite?: boolean;
  onClick: () => void;
  className?: string;
};

export function ChatListItem({
  title,
  preview,
  timestamp,
  statusLabel,
  statusTone = 'neutral',
  initials,
  avatarUrl,
  active = false,
  unreadCount = 0,
  favorite = false,
  onClick,
  className,
}: ChatListItemProps) {
  const statusDotClass = {
    online: 'bg-emerald-400 shadow-[0_0_0_2px_rgba(16,185,129,0.16)]',
    busy: 'bg-amber-400 shadow-[0_0_0_2px_rgba(245,158,11,0.16)]',
    away: 'bg-sky-400 shadow-[0_0_0_2px_rgba(56,189,248,0.16)]',
    offline: 'bg-slate-500 shadow-[0_0_0_2px_rgba(148,163,184,0.14)]',
    neutral: 'bg-slate-400 shadow-[0_0_0_2px_rgba(148,163,184,0.14)]',
  }[statusTone];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex w-full items-start gap-3 rounded-[14px] px-3 py-2.5 text-left transition-colors',
        active
          ? 'bg-sky-500/10 text-white'
          : 'hover:bg-white/[0.04]',
        className,
      )}
    >
      <Avatar className="mt-0.5 h-10 w-10 shrink-0 ring-1 ring-white/8">
        <AvatarImage src={avatarUrl || undefined} alt={title} />
        <AvatarFallback className="bg-white/[0.08] text-slate-100">
          {initials}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className={cn('truncate text-[14px] font-semibold leading-5', active ? 'text-slate-950 dark:text-white' : 'text-slate-900 dark:text-slate-100')}>
                {title}
              </p>
              {favorite ? <Star className="h-3.5 w-3.5 shrink-0 fill-current text-amber-400" /> : null}
            </div>
            {preview ? (
              <p className="mt-0.5 line-clamp-1 text-[13px] leading-5 text-slate-500 dark:text-slate-400">
                {preview}
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-2 pl-2">
            {timestamp ? (
              <span className="text-[11px] text-slate-500 dark:text-slate-500">
                {timestamp}
              </span>
            ) : null}
            {unreadCount > 0 ? (
              <Badge className="h-5 min-w-5 rounded-full bg-sky-500 px-1.5 text-[10px] text-white shadow-none">
                {unreadCount}
              </Badge>
            ) : null}
          </div>
        </div>

        {statusLabel ? (
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-500">
            <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', statusDotClass)} />
            <span className="truncate">{statusLabel}</span>
          </div>
        ) : null}
      </div>
    </button>
  );
}

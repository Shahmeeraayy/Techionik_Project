import { Star } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type ChatListItemProps = {
  title: string;
  preview?: string | null;
  timestamp?: string | null;
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
  initials,
  avatarUrl,
  active = false,
  unreadCount = 0,
  favorite = false,
  onClick,
  className,
}: ChatListItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition',
        active
          ? 'border-cyan-300/25 bg-cyan-300/10 shadow-[0_10px_30px_rgba(34,211,238,0.08)]'
          : 'border-transparent bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.05]',
        className,
      )}
    >
      <Avatar className="h-11 w-11 shrink-0 border border-white/10">
        <AvatarImage src={avatarUrl || undefined} alt={title} />
        <AvatarFallback className="bg-white/[0.06] text-slate-100">
          {initials}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className={cn('truncate text-sm font-semibold', active ? 'text-white' : 'text-slate-100')}>
              {title}
            </p>
            {preview ? (
              <p className="mt-1 line-clamp-1 text-xs leading-5 text-slate-400">
                {preview}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {timestamp ? (
              <span className="text-[11px] text-slate-500">
                {timestamp}
              </span>
            ) : null}
            {favorite ? (
              <Star className="h-4 w-4 fill-current text-amber-300" />
            ) : null}
            {unreadCount > 0 ? (
              <Badge className="h-5 min-w-5 rounded-full bg-cyan-400 px-1.5 text-[10px] text-slate-950">
                {unreadCount}
              </Badge>
            ) : null}
          </div>
        </div>
      </div>
    </button>
  );
}

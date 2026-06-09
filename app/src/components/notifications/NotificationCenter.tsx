import { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  BriefcaseBusiness,
  Inbox,
  KeyRound,
  Loader2,
  MessageSquareText,
  UserPlus,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import {
  fetchNotificationUnreadCount,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type BackendNotification,
} from '@/lib/backend-api';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type NotificationCenterProps = {
  token: string | null;
  buttonClassName: string;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'right' | 'bottom' | 'left';
  contentClassName?: string;
};

const EVENT_ICON_MAP: Record<string, typeof Bell> = {
  job_assigned: BriefcaseBusiness,
  new_message: MessageSquareText,
  new_customer_request: Inbox,
  technician_password_reset_request: KeyRound,
  technician_signup_request: UserPlus,
  technician_time_off_created: BriefcaseBusiness,
};

function formatNotificationTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
}

export function NotificationCenter({
  token,
  buttonClassName,
  align = 'end',
  side = 'bottom',
  contentClassName,
}: NotificationCenterProps) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<BackendNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const loadNotifications = async (silent = false) => {
    if (!token) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    if (!silent) {
      setLoading(true);
    }
    try {
      const [items, unread] = await Promise.all([
        fetchNotifications(token, 12),
        fetchNotificationUnreadCount(token),
      ]);
      setNotifications(items);
      setUnreadCount(unread.unread_count);
    } catch {
      if (!silent) {
        setNotifications([]);
        setUnreadCount(0);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadNotifications();
    if (!token || typeof window === 'undefined') {
      return;
    }
    const handleFocus = () => { void loadNotifications(true); };
    const intervalId = window.setInterval(() => { void loadNotifications(true); }, 15000);
    window.addEventListener('focus', handleFocus);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, [token]);

  const unreadIds = useMemo(
    () => new Set(notifications.filter((item) => !item.is_read).map((item) => item.id)),
    [notifications],
  );

  if (!token) {
    return null;
  }

  const handleOpenNotification = async (notification: BackendNotification) => {
    if (!notification.is_read) {
      try {
        await markNotificationRead(token, notification.id);
      } catch {
        // Navigation still helps the user even if the read write fails.
      }
    }
    await loadNotifications(true);
    const href = typeof notification.payload?.href === 'string' ? notification.payload.href : '';
    if (href) {
      navigate(href);
    }
  };

  const handleMarkOneRead = async (notification: BackendNotification) => {
    if (notification.is_read) {
      return;
    }
    try {
      await markNotificationRead(token, notification.id);
      await loadNotifications(true);
    } catch {
      // Keep the list intact; the next poll/focus refresh will retry.
    }
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      await markAllNotificationsRead(token);
      await loadNotifications(true);
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Open notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
          className={cn('relative', buttonClassName)}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-background bg-blue-500 px-1 text-[10px] font-bold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        side={side}
        className={cn('mt-2 w-[22rem] overflow-hidden p-0', contentClassName)}
      >
        <div className="border-b border-border bg-muted/50 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Notifications</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {unreadCount > 0
                  ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`
                  : 'Everything is up to date'}
              </p>
            </div>
            {unreadIds.size > 0 ? (
              <button
                type="button"
                onClick={() => { void handleMarkAllRead(); }}
                disabled={markingAll}
                className="text-xs font-semibold text-blue-600 transition hover:text-blue-700 disabled:opacity-60 dark:text-cyan-300 dark:hover:text-cyan-200"
              >
                {markingAll ? 'Saving...' : 'Mark all read'}
              </button>
            ) : null}
          </div>
        </div>

        <div className="max-h-[26rem] overflow-y-auto p-2">
          {loading ? (
            <div className="flex items-center justify-center gap-2 px-3 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              No notifications yet.
            </div>
          ) : notifications.map((notification, index) => {
            const Icon = EVENT_ICON_MAP[notification.event_type] ?? Bell;
            return (
              <div key={notification.id}>
                <div className="flex items-start gap-3 rounded-xl px-3 py-3">
                  <button
                    type="button"
                    onClick={() => { void handleOpenNotification(notification); }}
                    className="flex min-w-0 flex-1 items-start gap-3 text-left"
                  >
                    <span className={cn(
                      'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border',
                      notification.is_read
                        ? 'border-border bg-muted text-muted-foreground'
                        : 'border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-cyan-200',
                    )}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn(
                        'block text-sm text-foreground',
                        notification.is_read ? 'font-medium' : 'font-semibold',
                      )}>
                        {notification.title}
                      </span>
                      <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                        {notification.message}
                      </span>
                      <span className="mt-1 block text-[11px] text-muted-foreground/80">
                        {formatNotificationTime(notification.created_at)}
                      </span>
                    </span>
                  </button>
                  {!notification.is_read ? (
                    <button
                      type="button"
                      onClick={() => { void handleMarkOneRead(notification); }}
                      className="mt-1 text-[11px] font-semibold text-blue-600 transition hover:text-blue-700 dark:text-cyan-300 dark:hover:text-cyan-200"
                    >
                      Mark read
                    </button>
                  ) : (
                    <span className="mt-1 h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600" />
                  )}
                </div>
                {index < notifications.length - 1 ? <DropdownMenuSeparator className="mx-3" /> : null}
              </div>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default NotificationCenter;

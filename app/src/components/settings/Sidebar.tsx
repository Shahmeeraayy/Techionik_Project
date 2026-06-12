import type { LucideIcon } from 'lucide-react';
import {
  Bell,
  Building2,
  CalendarClock,
  CreditCard,
  LayoutDashboard,
  Link2,
  ListFilter,
  Mail,
  MapPin,
  Settings2,
  ShieldCheck,
} from 'lucide-react';
import { NavLink, Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSettingsWorkspace } from './WorkspaceProvider';
import { settingsControlButtonClass } from './visual';

type SettingsNavItem = {
  path: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

export const settingsNavItems: SettingsNavItem[] = [
  {
    path: '/settings',
    label: 'General',
    description: 'Workspace summary, ranking health, and theme.',
    icon: LayoutDashboard,
  },
  {
    path: '/settings/profile',
    label: 'Company Profile',
    description: 'Brand identity, contact details, and footer.',
    icon: Building2,
  },
  {
    path: '/settings/notifications',
    label: 'Notifications',
    description: 'Technician, manager, customer, and system alerts.',
    icon: Bell,
  },
  {
    path: '/settings/email',
    label: 'Email Settings',
    description: 'Domain setup, routing, and sending status.',
    icon: Mail,
  },
  {
    path: '/settings/booking',
    label: 'Booking Portal',
    description: 'Public booking URLs and request automation.',
    icon: CalendarClock,
  },
  {
    path: '/settings/billing',
    label: 'Billing',
    description: 'Current plan, renewal date, and usage.',
    icon: CreditCard,
  },
  {
    path: '/settings/locations',
    label: 'Locations',
    description: 'Manage dealership or location records.',
    icon: MapPin,
  },
  {
    path: '/settings/ranking',
    label: 'Ranking Rules',
    description: 'Dispatch prioritization logic and scoring.',
    icon: ListFilter,
  },
  {
    path: '/settings/integrations',
    label: 'Integrations',
    description: 'External services and partner connections.',
    icon: Link2,
  },
];

type SettingsSidebarProps = {
  onNavigate?: () => void;
  className?: string;
};

export function SettingsSidebar({ onNavigate, className }: SettingsSidebarProps) {
  const workspace = useSettingsWorkspace();
  const lastSyncedLabel = workspace.lastRefreshedAt
    ? new Date(workspace.lastRefreshedAt).toLocaleString([], {
        hour: 'numeric',
        minute: '2-digit',
      })
    : 'Not synced yet';

  return (
    <div className={cn('flex h-full flex-col', className)}>
      <div className="border-b border-white/10 px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0f172a,#155e75)] text-white shadow-[0_18px_42px_rgba(15,23,42,0.22)]">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {workspace.invoiceBranding.name || 'NexusOps'}
            </p>
            <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
              Settings console
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2 rounded-2xl border border-border/70 bg-background/70 px-3 py-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Sync status
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {workspace.canUseBackend ? 'Live backend sync' : 'Local mode'}
            </p>
          </div>
          <Badge variant="outline" className="rounded-full border-border/80 bg-background/70">
            {lastSyncedLabel}
          </Badge>
        </div>
      </div>

      <nav className="flex-1 space-y-1.5 overflow-y-auto p-3">
        {settingsNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              end={item.path === '/settings'}
              className={({ isActive }) =>
                cn(
                  'group flex items-start gap-3 rounded-2xl px-4 py-3 text-sm transition-all duration-200',
                  isActive
                    ? 'bg-[#0f172a] text-white shadow-[0_16px_40px_rgba(15,23,42,0.18)] dark:bg-white/10 dark:text-white'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-all duration-200',
                      isActive
                        ? 'border-white/10 bg-white/10 text-white'
                        : 'border-border/70 bg-background/70 text-muted-foreground group-hover:text-foreground',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{item.label}</span>
                    <span
                      className={cn(
                        'mt-0.5 block text-xs leading-5',
                        isActive ? 'text-white/70' : 'text-muted-foreground',
                      )}
                    >
                      {item.description}
                    </span>
                  </span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-4">
        <Button asChild variant="ghost" className={cn('w-full justify-start rounded-2xl', settingsControlButtonClass)}>
          <Link to="/admin" onClick={onNavigate}>
            <Settings2 className="h-4 w-4" />
            Back to dashboard
          </Link>
        </Button>
      </div>
    </div>
  );
}

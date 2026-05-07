import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  ClipboardList,
  FileCheck,
  Users,
  Building2,
  Wrench,
  BarChart3,
  ScrollText,
  Settings,
  Menu,
  X,
  ChevronDown,
  LogOut,
  Shield,
  RefreshCw,
  Bell,
  Eye,
  UserCog,
  Inbox,
  MessageSquareText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { fetchAdminChatUnreadCount, getStoredAdminToken } from '@/lib/backend-api';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { TechnicianPreviewModal } from '@/components/modals/TechnicianPreviewModal';

const navGroups = [
  {
    label: 'Operations',
    items: [
      { path: '/admin', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/admin/jobs', label: 'Jobs', icon: ClipboardList },
      { path: '/admin/intake', label: 'Intake Queue', icon: Inbox },
      { path: '/admin/chat', label: 'Platform Chat', icon: MessageSquareText },
    ],
  },
  {
    label: 'Billing',
    items: [
      { path: '/admin/approvals', label: 'Invoice Approvals', icon: FileCheck },
      { path: '/admin/invoices', label: 'Invoice History', icon: ScrollText },
    ],
  },
  {
    label: 'Workforce',
    items: [
      { path: '/admin/technicians', label: 'Technicians', icon: Users },
      { path: '/admin/accounts', label: 'Technician Accounts', icon: UserCog },
      { path: '/admin/locations', label: 'Locations', icon: Building2 },
      { path: '/admin/services', label: 'Services', icon: Wrench },
    ],
  },
  {
    label: 'Admin',
    items: [
      { path: '/admin/reports', label: 'Reports', icon: BarChart3 },
      { path: '/admin/settings', label: 'Settings', icon: Settings },
    ],
  },
];

const navItems = navGroups.flatMap((group) => group.items);

function Sidebar({
  isOpen,
  onClose,
  pendingPasswordResetCount,
  unreadChatCount,
}: {
  isOpen: boolean;
  onClose: () => void;
  pendingPasswordResetCount: number;
  unreadChatCount: number;
}) {
  const location = useLocation();
  const activeItem = location.pathname;

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'admin-sidebar fixed left-0 top-0 z-50 flex h-screen w-72 flex-col border-r border-border bg-background',
          'transition-transform duration-300 ease-in-out lg:sticky',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className="flex-shrink-0 px-5 pb-5 pt-5">
          <div className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_18px_50px_rgba(15,23,42,0.07)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-[0_18px_50px_rgba(2,6,23,0.24)]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(79,124,255,0.13),transparent_42%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(79,124,255,0.22),transparent_42%)]" />
            <div className="relative flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#111827,#0f172a)] shadow-[0_18px_40px_rgba(15,23,42,0.18)] dark:bg-[linear-gradient(135deg,#4f7cff,#79a1ff)] dark:shadow-[0_18px_40px_rgba(79,124,255,0.28)]">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate font-semibold leading-tight tracking-[-0.03em] text-slate-950 dark:text-white">SM2 electronics</h1>
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Operational Center</p>
              </div>
            </div>
            <div className="relative mt-4 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-white/[0.04]">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.14)]" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Backend live</span>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-6 overflow-y-auto px-4 pb-5">
          {navGroups.map((group) => (
            <div key={group.label} className="space-y-2">
              <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.26em] text-slate-400 dark:text-slate-500">
                {group.label}
              </p>
              <div className="space-y-1.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeItem === item.path || (item.path !== '/admin' && activeItem.startsWith(item.path));

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={onClose}
                      className={cn(
                        'group relative flex w-full items-center gap-3 rounded-[18px] px-3 py-2.5 text-left text-sm font-semibold transition-all duration-200',
                        isActive
                          ? 'bg-[#111827] text-white shadow-[0_18px_34px_rgba(15,23,42,0.14)] dark:bg-[linear-gradient(135deg,rgba(79,124,255,0.22),rgba(12,23,44,0.94))] dark:text-blue-50 dark:shadow-[0_18px_34px_rgba(6,11,24,0.24),inset_0_0_0_1px_rgba(79,124,255,0.26)]'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-slate-100'
                      )}
                    >
                      {isActive ? (
                        <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-white/80 dark:bg-blue-300" />
                      ) : null}
                      <div className={cn(
                        'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl border transition-all duration-200',
                        isActive
                          ? 'border-black/10 bg-white text-[#111827] shadow-sm dark:border-blue-300/20 dark:bg-blue-400/15 dark:text-blue-100'
                          : 'border-slate-200 bg-white text-slate-500 shadow-sm group-hover:border-slate-300 group-hover:bg-white group-hover:text-slate-950 dark:border-white/8 dark:bg-white/[0.04] dark:text-slate-500 dark:group-hover:border-white/12 dark:group-hover:bg-white/[0.08] dark:group-hover:text-slate-200',
                      )}>
                        <Icon className="h-4.5 w-4.5" />
                      </div>
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.path === '/admin/chat' && unreadChatCount > 0 ? (
                        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-[#111827] shadow-sm dark:bg-blue-100 dark:text-blue-700">
                          {unreadChatCount}
                        </span>
                      ) : null}
                      {item.path === '/admin/accounts' && pendingPasswordResetCount > 0 ? (
                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
                          {pendingPasswordResetCount}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="flex-shrink-0 p-4">
          <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_18px_48px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-[0_18px_48px_rgba(2,6,23,0.22)]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-blue-600 dark:border-blue-300/20 dark:bg-blue-400/10 dark:text-blue-100">
                <Bell className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">Control alerts</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {unreadChatCount + pendingPasswordResetCount} needs review
                </p>
              </div>
            </div>
          </div>
        </div>

      </aside>
    </>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-3 p-1.5 pl-3 pr-2 rounded-full border border-black/10 bg-white hover:bg-[#f9fafb] transition-all shadow-[0_14px_34px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] dark:shadow-[0_14px_34px_rgba(2,6,23,0.18)]">
            <Avatar className="w-8 h-8 border border-white/10">
              <AvatarImage src={user?.avatar} alt={user?.name} />
              <AvatarFallback className="bg-muted text-primary text-xs font-bold">
                {user?.name?.split(' ').map(n => n[0]).join('').substring(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="hidden md:block text-left mr-1">
              <p className="text-sm font-medium text-foreground leading-none tracking-wide">ADMIN</p>
            </div>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 mt-1">
          <DropdownMenuItem onClick={() => setPreviewModalOpen(true)} className="cursor-pointer">
            <Eye className="w-4 h-4 mr-2" />
            View as Technician
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10">
            <LogOut className="w-4 h-4 mr-2" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Technician Preview Modal */}
      <TechnicianPreviewModal
        open={previewModalOpen}
        onOpenChange={setPreviewModalOpen}
      />
    </>
  );
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { pendingTechnicianPasswordResetRequests } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('Updated 2 min ago');
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const hideHeaderRefreshControls = location.pathname.startsWith('/admin');

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const syncUnreadCount = async () => {
      const token = getStoredAdminToken();
      if (!token) {
        const raw = window.sessionStorage.getItem('sm_admin_chat_unread_count');
        const next = raw ? Number(raw) : 0;
        setUnreadChatCount(Number.isFinite(next) ? next : 0);
        return;
      }
      try {
        const response = await fetchAdminChatUnreadCount(token);
        setUnreadChatCount(response.unread_count);
        window.sessionStorage.setItem('sm_admin_chat_unread_count', String(response.unread_count));
      } catch {
        const raw = window.sessionStorage.getItem('sm_admin_chat_unread_count');
        const next = raw ? Number(raw) : 0;
        setUnreadChatCount(Number.isFinite(next) ? next : 0);
      }
    };

    void syncUnreadCount();

    const handleUnreadEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ count?: number }>;
      const next = customEvent.detail?.count;
      if (typeof next === 'number' && Number.isFinite(next)) {
        setUnreadChatCount(next);
        return;
      }
      void syncUnreadCount();
    };

    const handleFocus = () => { void syncUnreadCount(); };
    const intervalId = window.setInterval(() => { void syncUnreadCount(); }, 5000);

    window.addEventListener('sm-chat-unread-count', handleUnreadEvent as EventListener);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('sm-chat-unread-count', handleUnreadEvent as EventListener);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const headerTitle = (() => {
    const pathname = location.pathname;
    if (pathname.startsWith('/admin/tech-preview')) {
      return 'Technician Preview';
    }
    const matched = [...navItems]
      .sort((a, b) => b.path.length - a.path.length)
      .find((item) => pathname === item.path || (item.path !== '/admin' && pathname.startsWith(item.path)));
    return matched?.label ?? 'Dashboard';
  })();

  const handleRefresh = () => {
    setLastUpdated('Updated just now');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sm-dispatch:admin-refresh', {
        detail: { source: 'header' },
      }));
    }
  };

  return (
    <div className="admin-shell min-h-screen bg-muted/40">
      <div className="flex">
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          pendingPasswordResetCount={pendingTechnicianPasswordResetRequests.length}
          unreadChatCount={unreadChatCount}
        />

        {/* Main content */}
        <main className="flex-1 min-w-0 flex flex-col min-h-screen lg:p-4">
          {/* Top Header - Sticky */}
          <div className="admin-page-frame flex min-h-screen flex-col overflow-hidden rounded-none lg:rounded-[32px]">
          <header className="admin-topbar sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border px-5 sm:px-8 py-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-4 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>

              <div className="flex flex-col">
                <p className="hidden sm:block text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Dispatch Workspace</p>
                <h1 className="text-xl font-bold text-foreground tracking-[-0.04em]">{headerTitle}</h1>
              </div>
            </div>

            <div className="flex items-center gap-3 sm:gap-6">
              {!hideHeaderRefreshControls && (
                <>
                  <span className="hidden sm:block text-xs font-medium text-muted-foreground bg-white px-3 py-1.5 rounded-full border border-black/10 dark:bg-white/[0.04] dark:border-white/8">
                    {lastUpdated}
                  </span>

                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 rounded-full border-border text-muted-foreground hover:text-primary hover:border-primary hover:bg-muted transition-all"
                    onClick={handleRefresh}
                    title="Refresh Data"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>

                  <div className="h-6 w-px bg-border/60 hidden sm:block"></div>
                </>
              )}

              <UserMenu />
            </div>
          </header>

          <div className="admin-content flex-1 p-4 lg:p-8 overflow-y-auto">
            {children}
          </div>
          </div>
        </main>
      </div>
    </div>
  );
}

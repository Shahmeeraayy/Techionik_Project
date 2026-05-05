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

const navItems = [
  { path: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/admin/jobs', label: 'Jobs', icon: ClipboardList },
  { path: '/admin/intake', label: 'Intake Queue', icon: Inbox },
  { path: '/admin/approvals', label: 'Invoice Approvals', icon: FileCheck },
  { path: '/admin/invoices', label: 'Invoice History', icon: ScrollText },
  { path: '/admin/chat', label: 'Platform Chat', icon: MessageSquareText },
  { path: '/admin/technicians', label: 'Technicians', icon: Users },
  { path: '/admin/accounts', label: 'Technician Accounts', icon: UserCog },
  { path: '/admin/locations', label: 'Locations', icon: Building2 },
  { path: '/admin/services', label: 'Services', icon: Wrench },
  { path: '/admin/reports', label: 'Reports', icon: BarChart3 },
  { path: '/admin/settings', label: 'Settings', icon: Settings },
];

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
          'admin-sidebar fixed lg:sticky top-0 left-0 z-50 h-screen w-72 bg-background border-r border-border',
          'flex flex-col transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-6 border-b border-border flex-shrink-0">
          <div className="w-10 h-10 rounded-2xl bg-[linear-gradient(135deg,#111827,#0f172a)] dark:bg-[linear-gradient(135deg,#4f7cff,#79a1ff)] flex items-center justify-center shadow-[0_18px_40px_rgba(15,23,42,0.18)] dark:shadow-[0_18px_40px_rgba(79,124,255,0.28)]">
            <Shield className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-semibold text-foreground leading-tight tracking-[-0.03em]">SM2 electronics</h1>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-[0.22em]">Operational Center</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeItem === item.path || (item.path !== '/admin' && activeItem.startsWith(item.path));

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all duration-200 w-full text-left group',
                  isActive
                    ? 'bg-[#111827] text-white shadow-[0_18px_34px_rgba(15,23,42,0.12)] dark:bg-[linear-gradient(135deg,rgba(18,32,58,0.92),rgba(12,23,44,0.92))] dark:text-blue-100 dark:shadow-[0_18px_34px_rgba(6,11,24,0.24),inset_0_0_0_1px_rgba(79,124,255,0.24)]'
                    : 'text-muted-foreground hover:bg-[#f3f4f6] hover:text-foreground dark:text-slate-400 dark:hover:bg-white/[0.05] dark:hover:text-slate-100'
                )}
              >
                <div className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-xl border transition-all duration-200',
                  isActive
                    ? 'border-black/10 bg-white text-[#111827] dark:border-blue-300/20 dark:bg-blue-400/10 dark:text-blue-100'
                    : 'border-slate-200 bg-white text-slate-500 group-hover:border-slate-300 group-hover:bg-slate-50 group-hover:text-slate-900 dark:border-white/6 dark:bg-white/[0.03] dark:text-slate-500 dark:group-hover:border-white/10 dark:group-hover:bg-white/[0.06] dark:group-hover:text-slate-200',
                )}>
                  <Icon className="w-4.5 h-4.5" />
                </div>
                <span className="flex-1">{item.label}</span>
                {item.path === '/admin/chat' && unreadChatCount > 0 ? (
                  <span className="rounded-full bg-[#111827] px-2 py-0.5 text-xs font-semibold text-white shadow-[0_10px_20px_rgba(15,23,42,0.16)] dark:bg-blue-100 dark:text-blue-700 dark:shadow-[0_10px_20px_rgba(79,124,255,0.22)]">
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
        </nav>

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

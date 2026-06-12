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
  Eye,
  UserCog,
  Inbox,
  MessageSquareText,
  PanelLeftClose,
  PanelLeftOpen,
  CalendarClock,
  KeyRound,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchAdminChatUnreadCount,
  getStoredAdminToken,
} from '@/lib/backend-api';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';

const navItems = [
  { path: '/admin', label: 'Overview', icon: LayoutDashboard },
  { path: '/admin/jobs', label: 'Operations', icon: ClipboardList },
  { path: '/admin/intake', label: 'Request Queue', icon: Inbox },
  { path: '/admin/approvals', label: 'Approvals', icon: FileCheck },
  { path: '/admin/invoices', label: 'Billing', icon: ScrollText },
  { path: '/admin/chat', label: 'Messages', icon: MessageSquareText },
  { path: '/admin/technicians', label: 'Team', icon: Users },
  { path: '/admin/accounts', label: 'Accounts', icon: UserCog },
  { path: '/admin/locations', label: 'Locations', icon: Building2 },
  { path: '/admin/services', label: 'Services', icon: Wrench },
  { path: '/admin/attendance', label: 'Attendance', icon: CalendarClock },
  { path: '/admin/reports', label: 'Reports', icon: BarChart3 },
];

function Sidebar({
  isOpen,
  onClose,
  isCollapsed,
  onToggleCollapsed,
  pendingPasswordResetCount,
  unreadChatCount,
}: {
  isOpen: boolean;
  onClose: () => void;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
  pendingPasswordResetCount: number;
  unreadChatCount: number;
}) {
  const location = useLocation();
  const activeItem = location.pathname;
  const settingsActive = activeItem.startsWith('/settings') || activeItem === '/admin/settings' || activeItem.startsWith('/admin/settings');

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'admin-sidebar fixed left-0 top-0 z-50 h-dvh bg-background',
          'flex flex-col border border-border shadow-[24px_0_70px_rgba(15,23,42,0.14)]',
          'rounded-r-[28px] lg:fixed lg:left-3 lg:top-3 lg:h-[calc(100vh-1.5rem)] lg:rounded-[28px]',
          'transition-[width,transform,box-shadow,border-radius] duration-300 ease-out will-change-transform',
          isCollapsed ? 'w-[min(18rem,calc(100vw-1.25rem))] lg:w-[92px]' : 'w-[min(18rem,calc(100vw-1.25rem))] lg:w-72',
          isCollapsed && 'lg:overflow-hidden',
          'lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className={cn(
          'flex items-center border-b border-border flex-shrink-0 transition-all duration-300',
          isCollapsed ? 'gap-3 px-5 py-4 lg:justify-center lg:gap-0 lg:px-3 lg:py-3' : 'gap-3 px-5 py-4',
        )}>
          <div className="w-9 h-9 rounded-2xl bg-[linear-gradient(135deg,#111827,#0f172a)] dark:bg-[#111111] flex items-center justify-center shadow-[0_18px_40px_rgba(15,23,42,0.18)] dark:shadow-[0_18px_40px_rgba(0,0,0,0.45),inset_0_0_0_1px_rgba(255,255,255,0.12)]">
            <Shield className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className={cn('min-w-0 transition-all duration-200', isCollapsed && 'lg:hidden')}>
            <h1 className="font-semibold text-foreground leading-tight tracking-[-0.03em]">NexusOps</h1>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-[0.22em]">Operational Center</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto h-9 w-9 rounded-full border border-slate-200 bg-white text-slate-700 shadow-[0_14px_28px_rgba(15,23,42,0.08)] hover:bg-slate-50 dark:border-white/10 dark:bg-[#111111] dark:text-white dark:shadow-[0_14px_28px_rgba(0,0,0,0.42)] dark:hover:bg-[#1d1d1d] lg:hidden"
            onClick={onClose}
            title="Close sidebar"
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className={cn('hidden px-4 py-3 lg:flex', isCollapsed ? 'justify-center px-3 py-2.5' : 'justify-end')}>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full border border-slate-200 bg-white text-slate-700 shadow-[0_16px_34px_rgba(15,23,42,0.08)] hover:bg-slate-50 dark:border-white/10 dark:bg-[#111111] dark:text-white dark:shadow-[0_14px_28px_rgba(0,0,0,0.42)] dark:hover:bg-[#1d1d1d]"
            onClick={onToggleCollapsed}
            title={isCollapsed ? 'Open sidebar' : 'Close sidebar'}
          >
            {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        </div>

        {/* Navigation */}
        <nav className={cn('admin-sidebar-nav flex-1 overflow-y-auto px-3 pb-3 space-y-1.5', isCollapsed && 'lg:overflow-hidden lg:px-2 lg:pb-2 lg:space-y-1')}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeItem === item.path || (item.path !== '/admin' && activeItem.startsWith(item.path));

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                title={isCollapsed ? item.label : undefined}
                className={cn(
                  'relative flex items-center rounded-[18px] text-sm font-medium transition-all duration-200 w-full text-left group',
                  isCollapsed ? 'gap-3 px-3 py-2 lg:justify-center lg:gap-0 lg:px-0 lg:py-1.5' : 'gap-3 px-3 py-2',
                  isActive
                    ? isCollapsed
                      ? 'bg-[#111827] text-white shadow-[0_18px_34px_rgba(15,23,42,0.12)] lg:bg-transparent lg:shadow-none'
                      : 'bg-[#111827] text-white shadow-[0_18px_34px_rgba(15,23,42,0.12)] dark:bg-[#242424] dark:text-white dark:shadow-[0_18px_34px_rgba(0,0,0,0.38),inset_0_0_0_1px_rgba(255,255,255,0.06)]'
                    : 'text-muted-foreground hover:bg-[#f3f4f6] hover:text-foreground dark:text-zinc-300 dark:hover:bg-[#171717] dark:hover:text-white'
                )}
              >
                <div className={cn(
                  'flex items-center justify-center border transition-all duration-200',
                  isCollapsed ? 'h-8 w-8 rounded-xl lg:h-9 lg:w-9 lg:rounded-full' : 'h-8 w-8 rounded-xl',
                  isActive
                    ? isCollapsed
                      ? 'border-black/10 bg-[#111827] text-white shadow-[0_16px_34px_rgba(15,23,42,0.18)] dark:border-white/12 dark:bg-[#2a2a2a] dark:text-white dark:shadow-[0_18px_34px_rgba(0,0,0,0.42)]'
                      : 'border-black/10 bg-white text-[#111827] dark:border-white/12 dark:bg-[#111111] dark:text-white'
                    : 'border-slate-200 bg-white text-slate-500 group-hover:border-slate-300 group-hover:bg-slate-50 group-hover:text-slate-900 dark:border-transparent dark:bg-transparent dark:text-zinc-200 dark:group-hover:border-white/10 dark:group-hover:bg-[#202020] dark:group-hover:text-white',
                )}>
                  <Icon className="w-4.5 h-4.5" />
                </div>
                <span className={cn('flex-1 transition-all duration-200', isCollapsed && 'lg:hidden')}>{item.label}</span>
                {item.path === '/admin/chat' && unreadChatCount > 0 ? (
                  <span className={cn(
                    'rounded-full bg-[#111827] px-2 py-0.5 text-xs font-semibold text-white shadow-[0_10px_20px_rgba(15,23,42,0.16)] dark:bg-[#f472b6] dark:text-white dark:shadow-[0_10px_24px_rgba(244,114,182,0.28)]',
                    isCollapsed && 'lg:absolute lg:right-1 lg:top-1 lg:flex lg:h-5 lg:min-w-5 lg:items-center lg:justify-center lg:p-0 lg:text-[10px]',
                  )}>
                    {unreadChatCount}
                  </span>
                ) : null}
                {item.path === '/admin/accounts' && pendingPasswordResetCount > 0 ? (
                  <span className={cn(
                    'rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700',
                    isCollapsed && 'lg:absolute lg:right-1 lg:top-1 lg:flex lg:h-5 lg:min-w-5 lg:items-center lg:justify-center lg:p-0 lg:text-[10px]',
                  )}>
                    {pendingPasswordResetCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className={cn('mt-auto border-t border-border p-4', isCollapsed ? 'lg:flex lg:justify-center lg:p-2' : '')}>
          <Link
            to="/settings"
            onClick={onClose}
            title="Settings"
            data-sidebar-settings="true"
            data-active={settingsActive ? 'true' : 'false'}
            className={cn(
              'flex items-center rounded-2xl text-sm font-semibold transition-all duration-200',
              isCollapsed ? 'w-full gap-3 px-4 py-3 lg:h-10 lg:w-10 lg:justify-center lg:gap-0 lg:rounded-full lg:p-0' : 'w-full gap-3 px-4 py-3',
              settingsActive
                ? 'bg-[#111827] text-white shadow-[0_18px_34px_rgba(15,23,42,0.12)] dark:bg-[#252525] dark:text-white dark:shadow-[0_18px_34px_rgba(0,0,0,0.28),inset_0_0_0_1px_rgba(255,255,255,0.06)]'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-zinc-300 dark:hover:bg-[#171717] dark:hover:text-white',
            )}
          >
            <Settings className="h-4.5 w-4.5" />
            <span className={cn(isCollapsed && 'lg:hidden')}>Settings</span>
          </Link>
        </div>

      </aside>
    </>
  );
}

function ProfileDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user, updateAdminProfile } = useAuth();
  const [fullName, setFullName] = useState(user?.name ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (open) {
      setFullName(user?.name ?? '');
      setCurrentPassword('');
      setNewPassword('');
      setError('');
      setSuccess(false);
    }
  }, [open, user?.name]);

  const handleSave = async () => {
    setError('');
    setSuccess(false);
    if (!currentPassword) { setError('Current password is required.'); return; }
    setSaving(true);
    try {
      await updateAdminProfile({ fullName, currentPassword, newPassword: newPassword || undefined });
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Profile</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14 border border-white/10">
              <AvatarImage src={user?.avatar} alt={user?.name} />
              <AvatarFallback className="bg-muted text-primary text-lg font-bold">
                {user?.name?.split(' ').map(n => n[0]).join('').substring(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-semibold text-white">{user?.name}</p>
              <p className="text-xs text-slate-400">{user?.email}</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="profile-name">Full Name</Label>
            <Input id="profile-name" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="profile-email">Email</Label>
            <Input id="profile-email" value={user?.email ?? ''} disabled />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="current-password">Current Password <span className="text-rose-400">*</span></Label>
            <Input id="current-password" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="Required to save changes" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-password">New Password <span className="text-slate-400 text-xs">(optional)</span></Label>
            <Input id="new-password" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Leave blank to keep current" />
          </div>

          {error && <p className="text-sm text-rose-400">{error}</p>}
          {success && <p className="text-sm text-emerald-400">Profile updated successfully.</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" className="border border-white/10 !bg-[#0b1424] !text-slate-100 hover:!bg-[#122039] hover:!text-white" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-[linear-gradient(135deg,#4f7cff,#22d3ee)] text-white hover:brightness-105">
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

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
          <DropdownMenuItem onClick={() => setProfileOpen(true)} className="cursor-pointer">
            <UserCog className="w-4 h-4 mr-2" />
            Manage Profile
          </DropdownMenuItem>
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

      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
      <TechnicianPreviewModal open={previewModalOpen} onOpenChange={setPreviewModalOpen} />
    </>
  );
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { pendingTechnicianPasswordResetRequests } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('sm_admin_sidebar_collapsed') === 'true';
  });
  const [lastUpdated, setLastUpdated] = useState('Updated 2 min ago');
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const hideHeaderRefreshControls = location.pathname.startsWith('/admin');
  const isChatRoute = location.pathname.startsWith('/admin/chat');

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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('sm_admin_sidebar_collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSidebarOpen(false);
      }
    };

    if (sidebarOpen) {
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = previousOverflow;
        window.removeEventListener('keydown', handleKeyDown);
      };
    }

    return undefined;
  }, [sidebarOpen]);

  const headerTitle = (() => {
    const pathname = location.pathname;
    if (pathname.startsWith('/admin/tech-preview')) {
      return 'Technician Preview';
    }
    if (pathname.startsWith('/admin/settings')) {
      return 'Settings';
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
          isCollapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
          pendingPasswordResetCount={pendingTechnicianPasswordResetRequests.length}
          unreadChatCount={unreadChatCount}
        />

        {/* Main content */}
        <main
          className={cn(
            'flex-1 min-w-0 max-w-full flex flex-col min-h-screen overflow-x-hidden transition-[margin] duration-300 ease-out lg:p-4',
            sidebarCollapsed ? 'lg:ml-[calc(92px+1.5rem)]' : 'lg:ml-[calc(18rem+1.5rem)]',
          )}
        >
          {/* Top Header - Sticky */}
          <div
            className={cn(
              'admin-page-frame flex min-w-0 max-w-full flex-col overflow-hidden rounded-none lg:rounded-[32px]',
              isChatRoute ? 'min-h-screen lg:h-[calc(100vh-2rem)]' : 'min-h-screen',
            )}
          >
          <header className="admin-topbar sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border px-4 sm:px-8 py-4 flex items-center justify-between gap-3 shadow-sm">
            <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 lg:hidden"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>

              <div className="flex min-w-0 flex-col">
                <p className="hidden sm:block text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">NexusOps</p>
                <h1 className="truncate text-lg font-bold text-foreground tracking-[-0.04em] sm:text-xl">{headerTitle}</h1>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 sm:gap-6">
              {!hideHeaderRefreshControls && (
                <>
                  <span className="hidden sm:block text-xs font-medium text-muted-foreground bg-white px-3 py-1.5 rounded-full border border-black/10 dark:bg-white/[0.04] dark:border-white/8">
                    {lastUpdated}
                  </span>

                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 rounded-full border-slate-300 bg-white text-slate-700 transition-all hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700 dark:border-border dark:bg-white/[0.03] dark:text-muted-foreground dark:hover:border-primary dark:hover:bg-muted dark:hover:text-primary"
                    onClick={handleRefresh}
                    title="Refresh Data"
                  >
                    <RefreshCw className="h-4 w-4 text-current" />
                  </Button>

                  <div className="h-6 w-px bg-border/60 hidden sm:block"></div>
                </>
              )}

              <NotificationCenter
                token={getStoredAdminToken()}
                buttonClassName="relative flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white text-slate-700 shadow-[0_14px_34px_rgba(15,23,42,0.08)] transition-all hover:-translate-y-0.5 hover:bg-[#f9fafb] hover:text-slate-950 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:shadow-[0_14px_34px_rgba(2,6,23,0.18)] dark:hover:bg-white/[0.08] dark:hover:text-white"
              />
              <UserMenu />
            </div>
          </header>

          <div
            className={cn(
              'admin-content min-w-0 max-w-full flex-1 overflow-x-hidden',
              isChatRoute
                ? 'flex min-h-0 flex-col overflow-hidden p-4 lg:p-6'
                : 'overflow-y-auto p-4 lg:p-8',
            )}
          >
            {children}
          </div>
          </div>
        </main>
      </div>
    </div>
  );
}

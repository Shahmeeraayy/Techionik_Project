import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Building2,
  Fingerprint,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  ShieldEllipsis,
  ScrollText,
  X,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const navItems = [
  { path: '/super-admin', label: 'Overview', icon: LayoutDashboard },
  { path: '/super-admin/tenants', label: 'Organizations', icon: Building2 },
  { path: '/super-admin/policies', label: 'Policies', icon: ShieldEllipsis },
  { path: '/super-admin/settings', label: 'Platform Settings', icon: Settings },
  { path: '/super-admin/audit-logs', label: 'Audit Logs', icon: ScrollText },
];

function roleLabel(value?: string) {
  if (!value) return 'Super Admin';
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const headerTitle = useMemo(() => {
    if (location.pathname.startsWith('/super-admin/tenants/')) return 'Organization Control';
    const matched = [...navItems]
      .sort((left, right) => right.path.length - left.path.length)
      .find((item) => location.pathname === item.path || (item.path !== '/super-admin' && location.pathname.startsWith(item.path)));
    return matched?.label ?? 'Super Admin';
  }, [location.pathname]);

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = search.trim();
    if (!normalized) {
      navigate('/super-admin/tenants');
      return;
    }
    navigate(`/super-admin/tenants?q=${encodeURIComponent(normalized)}`);
  };

  return (
    <div className="super-admin-shell min-h-screen bg-[#f3ede2] text-slate-950">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(15,23,42,0.09),transparent_26%),radial-gradient(circle_at_top_right,rgba(8,145,178,0.08),transparent_24%)]" />
      <div className="pointer-events-none fixed inset-0 opacity-30 [background-image:linear-gradient(rgba(15,23,42,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.06)_1px,transparent_1px)] [background-size:96px_96px]" />

      {sidebarOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1700px] gap-4 p-0 lg:p-4">
        <aside
          className={cn(
            'fixed left-0 top-0 z-50 flex h-dvh w-[min(20rem,calc(100vw-1.25rem))] flex-col border-r border-slate-900/10 bg-[rgba(248,244,236,0.96)] px-4 py-5 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl transition-transform duration-300 lg:relative lg:h-auto lg:min-h-[calc(100vh-2rem)] lg:w-80 lg:rounded-[2rem] lg:border lg:translate-x-0',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <Link to="/super-admin" className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-[1.1rem] bg-[linear-gradient(135deg,#0f172a,#155e75)] text-white shadow-[0_18px_40px_rgba(15,23,42,0.18)]">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">NexusOps</p>
                <h1 className="text-lg font-semibold tracking-[-0.04em] text-slate-950">Super Admin</h1>
              </div>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-6 rounded-[1.6rem] border border-slate-900/10 bg-white/75 p-4 shadow-[0_16px_44px_rgba(15,23,42,0.08)]">
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-600">
              <Fingerprint className="h-3.5 w-3.5" />
              Platform scope
            </div>
            <p className="mt-3 text-sm leading-7 text-slate-700">
              Cross-organization controls for subscriptions, feature access, security oversight, and audit review.
            </p>
          </div>

          <nav className="mt-6 flex-1 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path || (item.path !== '/super-admin' && location.pathname.startsWith(item.path));
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'flex items-center gap-3 rounded-[1.2rem] px-4 py-3 text-sm font-semibold transition-all',
                    isActive
                      ? 'bg-[linear-gradient(135deg,#0f172a,#155e75)] text-white shadow-[0_18px_40px_rgba(15,23,42,0.18)]'
                      : 'text-slate-700 hover:bg-white/80 hover:text-slate-950',
                  )}
                >
                  <span className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-[0.95rem] border',
                    isActive ? 'border-white/10 bg-white/10' : 'border-slate-900/10 bg-white/80',
                  )}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-6 rounded-[1.6rem] border border-slate-900/10 bg-white/80 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Session</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">{user?.name}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-cyan-800">{roleLabel(user?.platformRole)}</p>
          </div>
        </aside>

        <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden lg:rounded-[2.2rem] lg:border lg:border-slate-900/10 lg:bg-[rgba(255,252,247,0.86)] lg:shadow-[0_28px_120px_rgba(15,23,42,0.12)] lg:backdrop-blur-xl">
          <header className="sticky top-0 z-30 flex flex-col gap-4 border-b border-slate-900/10 bg-[rgba(255,250,245,0.86)] px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full lg:hidden"
                onClick={() => setSidebarOpen((current) => !current)}
              >
                <Menu className="h-4 w-4" />
              </Button>

              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">NexusOps Platform</p>
                <h1 className="truncate text-2xl font-semibold tracking-[-0.05em] text-slate-950" style={{ fontFamily: '"Space Grotesk", "Sora", system-ui, sans-serif' }}>
                  {headerTitle}
                </h1>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-3 rounded-full border border-slate-900/10 bg-white px-2 py-1.5 shadow-[0_14px_34px_rgba(15,23,42,0.08)]">
                    <Avatar className="h-9 w-9 border border-slate-900/10">
                      <AvatarFallback className="bg-[#0f172a] text-sm font-semibold text-white">
                        {user?.name?.split(' ').map((part) => part[0]).join('').slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden text-left sm:block">
                      <p className="text-sm font-semibold text-slate-900">{user?.name}</p>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{roleLabel(user?.platformRole)}</p>
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuItem className="cursor-default focus:bg-transparent">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-slate-900">{user?.email}</span>
                      <span className="text-xs uppercase tracking-[0.18em] text-slate-500">{roleLabel(user?.platformRole)}</span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={logout} className="text-rose-600 focus:text-rose-700">
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <form onSubmit={handleSearchSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search organizations by workspace or business name"
                  className="h-12 rounded-full border-slate-900/10 bg-white pl-11 text-slate-900 placeholder:text-slate-500"
                />
              </div>
              <Button type="submit" className="h-12 rounded-full bg-[linear-gradient(135deg,#0f172a,#155e75)] px-5 text-white hover:brightness-105">
                Search
              </Button>
            </form>
          </header>

          <div className="super-admin-content flex-1 px-4 py-4 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

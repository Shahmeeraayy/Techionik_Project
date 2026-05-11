import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ClipboardList,
  UserCheck,
  Calendar,
  User,
  Menu,
  X,
  LogOut,
  ChevronDown,
  Wrench,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const navItems = [
  { path: '/tech/jobs', label: 'Jobs', icon: ClipboardList },
  { path: '/tech/current-job', label: 'Current Job', icon: UserCheck },
  { path: '/tech/history', label: 'History', icon: Calendar },
  { path: '/tech/profile', label: 'Profile', icon: User },
];

function DesktopSidebar() {
  const location = useLocation();
  const activeItem = location.pathname;
  const { user, logout } = useAuth();

  return (
    <aside className="tech-sidebar hidden lg:flex flex-col w-64 h-screen sticky top-0 border-r border-white/10 bg-[#050505] shadow-[18px_0_60px_rgba(0,0,0,0.26)]">
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-white/10 px-6 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
          <Wrench className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="font-semibold leading-tight text-white">SM2 electronics</h1>
          <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Technician Portal</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeItem === item.path;

          return (
            <Link
              key={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors w-full text-left ${isActive
                  ? 'border border-white/10 bg-[#242424] text-white shadow-[0_12px_30px_rgba(0,0,0,0.28)]'
                  : 'text-slate-400 hover:bg-white/[0.06] hover:text-white'
                }`}
              to={item.path}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-cyan-100' : 'text-slate-500'}`} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User menu */}
      <div className="border-t border-white/10 p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-3 rounded-xl p-2 transition-colors hover:bg-white/[0.06]">
              <Avatar className="w-9 h-9">
                <AvatarImage src={user?.avatar} alt={user?.name} />
                <AvatarFallback className="bg-cyan-300/10 text-sm text-cyan-100">
                  {user?.name?.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-white">{user?.name}</p>
                <p className="text-xs text-slate-400">Technician</p>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-500" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 border-white/10 bg-[#0b1424] text-slate-100">

            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="cursor-pointer text-rose-600">
              <LogOut className="w-4 h-4 mr-2" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}

function MobileHeader({ onMenuClick }: { onMenuClick: () => void }) {
  const { user } = useAuth();

  return (
    <header className="tech-mobile-topbar sticky top-0 z-30 border-b border-white/10 bg-[#080c14]/95 px-4 py-3 backdrop-blur-xl lg:hidden">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-300/10">
            <Wrench className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-white">SM2 electronics</span>
        </div>
        <div className="flex items-center gap-2">
          <Avatar className="w-8 h-8">
            <AvatarImage src={user?.avatar} alt={user?.name} />
            <AvatarFallback className="bg-cyan-300/10 text-xs text-cyan-100">
              {user?.name?.split(' ').map(n => n[0]).join('')}
            </AvatarFallback>
          </Avatar>
          <Button variant="ghost" size="icon" onClick={onMenuClick}>
            <Menu className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}

function MobileNav() {
  const location = useLocation();
  const activeItem = location.pathname;

  return (
    <nav className="tech-mobile-nav fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#080c14]/95 backdrop-blur-xl lg:hidden">
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeItem === item.path;

          return (
            <Link
              key={item.path}
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors ${isActive ? 'bg-white/[0.06] text-cyan-100' : 'text-slate-500 hover:text-slate-200'
                }`}
              to={item.path}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function MobileMenu({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { logout } = useAuth();

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
      />
      <div className="tech-mobile-menu fixed bottom-0 right-0 top-0 z-50 w-64 border-l border-white/10 bg-[#080c14] p-4 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-semibold text-white">Menu</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="space-y-2">

          <button
            onClick={() => {
              logout();
              onClose();
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-rose-200 hover:bg-rose-400/10"
          >
            <LogOut className="w-5 h-5" />
            Log out
          </button>
        </div>
      </div>
    </>
  );
}

export function TechnicianLayout({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="tech-shell min-h-screen">
      <MobileHeader onMenuClick={() => setMenuOpen(true)} />
      <MobileMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} />

      <div className="flex">
        <DesktopSidebar />

        {/* Main content */}
        <main className="flex-1 min-w-0 pb-20 lg:p-4 lg:pb-4">
          <div className="tech-page-frame min-h-screen overflow-hidden rounded-none lg:min-h-[calc(100vh-2rem)] lg:rounded-[32px]">
            <div className="tech-content min-h-screen p-4 lg:min-h-[calc(100vh-2rem)] lg:p-8">
              {children}
            </div>
          </div>
        </main>
      </div>

      <MobileNav />
    </div>
  );
}

import { Briefcase, Calendar, Clock, MessageSquareText, User, CalendarClock, Sun, Moon, Monitor, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/theme-provider';
import { getStoredTechnicianToken } from '@/lib/backend-api';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';

export type TechnicianBottomNavTab = 'jobs' | 'current-job' | 'history' | 'chat' | 'profile' | 'attendance';

const themeOptions = [
    { value: 'light', label: 'Light Theme', icon: Sun },
    { value: 'dark', label: 'Dark Theme', icon: Moon },
    { value: 'system', label: 'System Theme', icon: Monitor },
] as const;

function TechnicianThemeToggle() {
    const { theme, setTheme } = useTheme();
    const activeOption = themeOptions.find((option) => option.value === theme) ?? themeOptions[1];
    const ActiveIcon = activeOption.icon;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    aria-label="Change technician portal theme"
                    className="tech-theme-toggle pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-[0_18px_42px_rgba(15,23,42,0.14)] transition hover:bg-slate-50 hover:text-slate-950 dark:border-white/10 dark:bg-[#111111] dark:text-white dark:shadow-[0_18px_42px_rgba(0,0,0,0.34)] dark:hover:bg-[#1d1d1d]"
                >
                    <ActiveIcon className="h-5 w-5" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-52">
                {themeOptions.map((option) => {
                    const Icon = option.icon;
                    const active = theme === option.value;

                    return (
                        <DropdownMenuItem
                            key={option.value}
                            onClick={() => setTheme(option.value)}
                            className="cursor-pointer"
                        >
                            <Icon className="mr-2 h-4 w-4" />
                            <span className="flex-1">{option.label}</span>
                            {active ? <CheckCircle2 className="ml-2 h-4 w-4 text-cyan-500 dark:text-cyan-300" /> : null}
                        </DropdownMenuItem>
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export default function TechnicianBottomNav({
    activeTab,
    routeBase,
}: {
    activeTab: TechnicianBottomNavTab;
    routeBase: string;
}) {
    const navigate = useNavigate();
    const notificationToken = routeBase.startsWith('/admin/tech-preview/') ? null : getStoredTechnicianToken();
    const tabs = [
        { id: 'jobs', label: 'Jobs', icon: Briefcase, path: `${routeBase}/jobs` },
        { id: 'current-job', label: 'Current Job', icon: Calendar, path: `${routeBase}/current-job` },
        { id: 'history', label: 'History', icon: Clock, path: `${routeBase}/history` },
        { id: 'attendance', label: 'Attendance', icon: CalendarClock, path: `${routeBase}/attendance` },
        { id: 'chat', label: 'Chat', icon: MessageSquareText, path: `${routeBase}/chat` },
        { id: 'profile', label: 'Profile', icon: User, path: `${routeBase}/profile` },
    ] as const;

    return (
        <div className="safe-area-bottom pointer-events-none fixed bottom-0 left-0 right-0 z-50 px-3 pb-3 pt-2 sm:px-4">
            <div className="mx-auto flex w-full max-w-[760px] justify-end gap-3 px-2 pb-2">
                <NotificationCenter
                    token={notificationToken}
                    side="top"
                    align="end"
                    buttonClassName="tech-theme-toggle pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-[0_18px_42px_rgba(15,23,42,0.14)] transition hover:bg-slate-50 hover:text-slate-950 dark:border-white/10 dark:bg-[#111111] dark:text-white dark:shadow-[0_18px_42px_rgba(0,0,0,0.34)] dark:hover:bg-[#1d1d1d]"
                />
                <TechnicianThemeToggle />
            </div>
            <div className="tech-nav-dock pointer-events-auto mx-auto w-full max-w-[760px] rounded-[28px] border border-slate-200 bg-white px-2 py-2 shadow-[0_18px_42px_rgba(15,23,42,0.14)] dark:border-white/10 dark:bg-[#111111] dark:shadow-[0_20px_70px_rgba(0,0,0,0.34)]">
                <div className="flex items-center justify-around gap-1">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;

                        return (
                            <button
                                key={tab.id}
                                data-active={isActive ? 'true' : 'false'}
                                onClick={() => navigate(tab.path)}
                                className={cn(
                                    'group relative flex min-h-[60px] flex-1 flex-col items-center justify-center gap-1 overflow-hidden rounded-2xl px-2 py-2.5 transition-all duration-200',
                                    isActive
                                        ? 'border border-blue-700 bg-blue-600 text-white shadow-[0_14px_28px_rgba(37,99,235,0.22)] dark:border-white/10 dark:bg-[#252525] dark:shadow-[0_18px_34px_rgba(0,0,0,0.28),inset_0_0_0_1px_rgba(255,255,255,0.05)]'
                                        : 'border border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-500 dark:hover:border-white/8 dark:hover:bg-[#171717] dark:hover:text-slate-200',
                                )}
                            >
                                {isActive ? (
                                    <span className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent" />
                                ) : null}
                                <Icon className={cn('h-5 w-5 transition-transform duration-200 group-hover:-translate-y-0.5', isActive && 'scale-110 text-white')} />
                                <span className={cn('max-w-full truncate text-[10px] font-semibold sm:text-[11px]', isActive && 'font-bold')}>
                                    {tab.label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

import { Briefcase, Calendar, Clock, MessageSquareText, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

export type TechnicianBottomNavTab = 'jobs' | 'current-job' | 'history' | 'chat' | 'profile';

export default function TechnicianBottomNav({
    activeTab,
    routeBase,
}: {
    activeTab: TechnicianBottomNavTab;
    routeBase: string;
}) {
    const navigate = useNavigate();
    const tabs = [
        { id: 'jobs', label: 'Jobs', icon: Briefcase, path: `${routeBase}/jobs` },
        { id: 'current-job', label: 'Current Job', icon: Calendar, path: `${routeBase}/current-job` },
        { id: 'history', label: 'History', icon: Clock, path: `${routeBase}/history` },
        { id: 'chat', label: 'Chat', icon: MessageSquareText, path: `${routeBase}/chat` },
        { id: 'profile', label: 'Profile', icon: User, path: `${routeBase}/profile` },
    ] as const;

    return (
        <div className="safe-area-bottom pointer-events-none fixed bottom-0 left-0 right-0 z-50 px-3 pb-3 pt-2 sm:px-4">
            <div className="tech-nav-dock pointer-events-auto mx-auto w-full max-w-[760px] rounded-[28px] px-2 py-2">
                <div className="flex items-center justify-around gap-1">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;

                        return (
                            <button
                                key={tab.id}
                                onClick={() => navigate(tab.path)}
                                className={cn(
                                    'group relative flex min-h-[60px] flex-1 flex-col items-center justify-center gap-1 overflow-hidden rounded-2xl px-2 py-2.5 transition-all duration-200',
                                    isActive
                                        ? 'border border-white/10 bg-[#252525] text-white shadow-[0_18px_34px_rgba(0,0,0,0.28),inset_0_0_0_1px_rgba(255,255,255,0.05)]'
                                        : 'border border-transparent text-slate-500 hover:border-white/8 hover:bg-[#171717] hover:text-slate-200',
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

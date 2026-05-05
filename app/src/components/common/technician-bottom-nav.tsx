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
        <div className="safe-area-bottom fixed bottom-0 left-0 right-0 z-50 px-3 pb-3 pt-2 sm:px-4">
            <div className="mx-auto w-full max-w-[760px] rounded-[26px] border border-white/10 bg-[#08111f]/88 px-2 py-2 shadow-[0_20px_60px_rgba(0,0,0,0.34)] backdrop-blur-2xl">
                <div className="flex items-center justify-around gap-1">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;

                        return (
                            <button
                                key={tab.id}
                                onClick={() => navigate(tab.path)}
                                className={cn(
                                    'flex min-h-[60px] flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-3 py-2.5 transition-all duration-200',
                                    isActive
                                        ? 'bg-[linear-gradient(135deg,rgba(47,142,146,0.22),rgba(75,102,241,0.16))] text-cyan-100 shadow-[inset_0_0_0_1px_rgba(94,234,212,0.12)]'
                                        : 'text-slate-500 hover:bg-white/[0.04] hover:text-slate-200',
                                )}
                            >
                                <Icon className={cn('h-5 w-5 transition-transform duration-200', isActive && 'scale-110')} />
                                <span className={cn('text-[11px] font-semibold', isActive && 'font-bold')}>
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

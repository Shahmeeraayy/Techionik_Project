import { useEffect, useMemo, useState } from 'react';
import {
    ArrowLeft,
    Briefcase,
    Calendar,
    ChevronRight,
    Clock,
    KeyRound,
    LogOut,
    Plus,
    RefreshCw,
    Save,
    Settings,
    Sparkles,
    Trash2,
    Upload,
    User,
} from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import TechnicianBottomNav from '@/components/common/technician-bottom-nav';
import { useAuth } from '@/contexts/AuthContext';
import {
    fetchAdminTechnicians,
    fetchTechnicianMeProfile,
    getStoredAdminToken,
    getStoredTechnicianToken,
    updateTechnicianMeAvailability,
    updateTechnicianMePassword,
    updateTechnicianMeProfile,
    type BackendTechnicianProfile,
} from '@/lib/backend-api';

const DAY_OPTIONS = [
    { label: 'Monday', value: 0 },
    { label: 'Tuesday', value: 1 },
    { label: 'Wednesday', value: 2 },
    { label: 'Thursday', value: 3 },
    { label: 'Friday', value: 4 },
    { label: 'Saturday', value: 5 },
    { label: 'Sunday', value: 6 },
] as const;

type OutOfOfficeRangeDraft = {
    start_date: string;
    end_date: string;
    note?: string;
};

const TECH_INPUT_CLASS = '!border-white/10 !bg-[linear-gradient(180deg,rgba(15,32,51,0.96),rgba(7,19,33,0.98))] !text-slate-100 !shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:!text-slate-500 focus-visible:!bg-slate-950/80 [color-scheme:dark]';
const TECH_MUTED_INPUT_CLASS = cn(TECH_INPUT_CLASS, 'cursor-not-allowed !text-slate-400');
const TECH_OUTLINE_BUTTON_CLASS = '!border-white/10 !bg-[linear-gradient(180deg,rgba(15,32,51,0.96),rgba(7,19,33,0.98))] !text-slate-100 !shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:!bg-white/[0.08] hover:!text-white disabled:!bg-slate-900/70 disabled:!text-slate-500';

function hasOverlap(ranges: OutOfOfficeRangeDraft[]): boolean {
    const normalized = ranges
        .map((range) => ({
            start: new Date(`${range.start_date}T00:00:00`).getTime(),
            end: new Date(`${range.end_date}T23:59:59`).getTime(),
        }))
        .sort((a, b) => a.start - b.start);

    for (let i = 1; i < normalized.length; i += 1) {
        if (normalized[i].start <= normalized[i - 1].end) {
            return true;
        }
    }
    return false;
}

export default function ProfilePage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { techId: previewTechId } = useParams();
    const { user, logout, technicianAccounts } = useAuth();
    const isPreviewMode = Boolean(previewTechId);
    const routeBase = isPreviewMode ? `/admin/tech-preview/${previewTechId}` : '/tech';
    const settingsRoute = `${routeBase}/profile/settings`;
    const isSettingsRoute = location.pathname.endsWith('/profile/settings');
    const isSettingsView = true;
    const previewTech = useMemo(() => {
        if (!previewTechId) return null;
        return technicianAccounts.find((tech) => tech.id === previewTechId) ?? null;
    }, [previewTechId, technicianAccounts]);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [profile, setProfile] = useState<BackendTechnicianProfile | null>(null);
    const [previewEmail, setPreviewEmail] = useState('');
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [profilePictureUrl, setProfilePictureUrl] = useState('');
    const [workingDays, setWorkingDays] = useState<number[]>([]);
    const [workingHoursStart, setWorkingHoursStart] = useState('08:00');
    const [workingHoursEnd, setWorkingHoursEnd] = useState('17:00');
    const [afterHoursEnabled, setAfterHoursEnabled] = useState(false);
    const [outOfOfficeRanges, setOutOfOfficeRanges] = useState<OutOfOfficeRangeDraft[]>([]);
    const [newRange, setNewRange] = useState<OutOfOfficeRangeDraft>({ start_date: '', end_date: '', note: '' });
    const [savingProfile, setSavingProfile] = useState(false);
    const [savingAvailability, setSavingAvailability] = useState(false);
    const [passwordForm, setPasswordForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });
    const [savingPassword, setSavingPassword] = useState(false);
    const [passwordError, setPasswordError] = useState<string | null>(null);

    const loadBackendData = async () => {
        setLoading(true);
        setError(null);

        if (isPreviewMode) {
            const fallbackName = previewTech?.name || user?.name || '';
            const fallbackPhone = previewTech?.phone || user?.phone || '';
            const fallbackEmail = previewTech?.email || '';
            const adminToken = getStoredAdminToken();
            if (!adminToken || !previewTechId) {
                setFullName(fallbackName);
                setPhone(fallbackPhone);
                setPreviewEmail(fallbackEmail);
                setProfilePictureUrl('');
                setWorkingDays([]);
                setWorkingHoursStart('08:00');
                setWorkingHoursEnd('17:00');
                setAfterHoursEnabled(false);
                setOutOfOfficeRanges([]);
                setLoading(false);
                return;
            }

            try {
                const rows = await fetchAdminTechnicians(adminToken);
                const selected = rows.find((item) => item.id === previewTechId);
                setFullName(selected?.full_name || selected?.name || fallbackName);
                setPhone(selected?.phone || fallbackPhone);
                setPreviewEmail(selected?.email || fallbackEmail);
                setProfilePictureUrl(selected?.profile_picture_url || '');
                setWorkingDays(selected?.working_days || []);
                setWorkingHoursStart((selected?.working_hours_start || '08:00').slice(0, 5));
                setWorkingHoursEnd((selected?.working_hours_end || '17:00').slice(0, 5));
                setAfterHoursEnabled(Boolean(selected?.after_hours_enabled));
                setOutOfOfficeRanges([]);
            } catch (fetchError) {
                setError(fetchError instanceof Error ? fetchError.message : 'Failed to load technician preview settings.');
                setFullName(fallbackName);
                setPhone(fallbackPhone);
                setPreviewEmail(fallbackEmail);
                setProfilePictureUrl('');
                setWorkingDays([]);
                setWorkingHoursStart('08:00');
                setWorkingHoursEnd('17:00');
                setAfterHoursEnabled(false);
                setOutOfOfficeRanges([]);
            } finally {
                setLoading(false);
            }
            return;
        }

        const token = getStoredTechnicianToken();
        if (!token) {
            setError('Technician backend session missing. Please login again.');
            setFullName(user?.name || '');
            setPhone(user?.phone || '');
            setLoading(false);
            return;
        }

        try {
            const profilePayload = await fetchTechnicianMeProfile(token);
            setProfile(profilePayload);
            setPreviewEmail('');
            setFullName(profilePayload.full_name || profilePayload.name);
            setPhone(profilePayload.phone || '');
            setProfilePictureUrl(profilePayload.profile_picture_url || '');
            setWorkingDays(profilePayload.working_days || []);
            setWorkingHoursStart((profilePayload.working_hours_start || '08:00').slice(0, 5));
            setWorkingHoursEnd((profilePayload.working_hours_end || '17:00').slice(0, 5));
            setAfterHoursEnabled(Boolean(profilePayload.after_hours_enabled));
            setOutOfOfficeRanges(
                (profilePayload.upcoming_time_off || []).map((item) => ({
                    start_date: item.start_date,
                    end_date: item.end_date,
                    note: item.reason || '',
                })),
            );
        } catch (fetchError) {
            setError(fetchError instanceof Error ? fetchError.message : 'Failed to load profile data.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadBackendData();
    }, [isPreviewMode, previewTechId, previewTech?.name, previewTech?.phone, user?.name, user?.phone]);

    const handleLogout = () => {
        if (isPreviewMode) {
            navigate('/admin', { replace: true });
            return;
        }
        logout();
        navigate('/tech/login', { replace: true });
    };

    const openSettingsView = () => {
        navigate(settingsRoute);
    };

    const openProfileView = () => {
        navigate(`${routeBase}/profile`);
    };

    const handleProfilePhotoUpload = (file?: File | null) => {
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            window.alert('Please upload an image file.');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                setProfilePictureUrl(reader.result);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleRefresh = async () => {
        await loadBackendData();
    };

    const toggleWorkingDay = (day: number) => {
        setWorkingDays((prev) => (
            prev.includes(day) ? prev.filter((item) => item !== day) : [...prev, day].sort((a, b) => a - b)
        ));
    };

    const addOutOfOfficeRange = () => {
        if (!newRange.start_date || !newRange.end_date) {
            window.alert('Start date and end date are required.');
            return;
        }
        if (newRange.end_date < newRange.start_date) {
            window.alert('End date must be on or after start date.');
            return;
        }
        const next = [...outOfOfficeRanges, newRange];
        if (hasOverlap(next)) {
            window.alert('Out-of-office ranges cannot overlap.');
            return;
        }
        setOutOfOfficeRanges(next);
        setNewRange({ start_date: '', end_date: '', note: '' });
    };

    const saveProfile = async () => {
        if (isPreviewMode) return;
        const token = getStoredTechnicianToken();
        if (!token) {
            window.alert('Technician backend session missing. Please login again.');
            return;
        }
        setSavingProfile(true);
        try {
            const updated = await updateTechnicianMeProfile(token, {
                full_name: fullName,
                phone: phone || null,
                profile_picture_url: profilePictureUrl || null,
            });
            setProfile(updated);
            window.alert('Profile updated successfully.');
        } catch (saveError) {
            window.alert(saveError instanceof Error ? saveError.message : 'Failed to update profile.');
        } finally {
            setSavingProfile(false);
        }
    };

    const savePassword = async () => {
        if (isPreviewMode) return;
        const token = getStoredTechnicianToken();
        if (!token) {
            setPasswordError('Technician backend session missing. Please login again.');
            return;
        }

        const currentPassword = passwordForm.currentPassword.trim();
        const newPassword = passwordForm.newPassword.trim();
        const confirmPassword = passwordForm.confirmPassword.trim();

        if (!currentPassword || !newPassword || !confirmPassword) {
            setPasswordError('All password fields are required.');
            return;
        }
        if (newPassword.length < 6) {
            setPasswordError('New password must be at least 6 characters.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setPasswordError('New password and confirmation do not match.');
            return;
        }

        setSavingPassword(true);
        setPasswordError(null);
        try {
            await updateTechnicianMePassword(token, {
                current_password: currentPassword,
                new_password: newPassword,
            });
            setPasswordForm({
                currentPassword: '',
                newPassword: '',
                confirmPassword: '',
            });
            window.alert('Password updated successfully.');
        } catch (saveError) {
            setPasswordError(saveError instanceof Error ? saveError.message : 'Failed to update password.');
        } finally {
            setSavingPassword(false);
        }
    };

    const saveAvailability = async () => {
        if (isPreviewMode) return;
        if (workingDays.length === 0) {
            window.alert('Select at least one working day.');
            return;
        }
        if (workingHoursStart >= workingHoursEnd) {
            window.alert('Working hours end time must be after start time.');
            return;
        }
        if (hasOverlap(outOfOfficeRanges)) {
            window.alert('Out-of-office ranges cannot overlap.');
            return;
        }
        const token = getStoredTechnicianToken();
        if (!token) {
            window.alert('Technician backend session missing. Please login again.');
            return;
        }
        setSavingAvailability(true);
        try {
            const updated = await updateTechnicianMeAvailability(token, {
                working_days: workingDays,
                working_hours_start: workingHoursStart,
                working_hours_end: workingHoursEnd,
                after_hours_enabled: afterHoursEnabled,
                out_of_office_ranges: outOfOfficeRanges.map((item) => ({
                    start_date: item.start_date,
                    end_date: item.end_date,
                    note: item.note?.trim() || undefined,
                })),
            });
            setProfile(updated);
            window.alert('Availability updated successfully.');
        } catch (saveError) {
            window.alert(saveError instanceof Error ? saveError.message : 'Failed to update availability.');
        } finally {
            setSavingAvailability(false);
        }
    };

    const userName = isPreviewMode
        ? (previewTech?.name ?? 'Preview Technician')
        : (profile?.full_name || profile?.name || user?.name || 'Technician');
    const userEmail = isPreviewMode
        ? (previewEmail || previewTech?.email || 'Not set')
        : (profile?.email || user?.email || 'technician@nexusops.com');
    const initials = userName
        .split(' ')
        .filter(Boolean)
        .map((name) => name[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
    const userPhone = phone || user?.phone || 'Not set';
    const workingDayLabels = DAY_OPTIONS
        .filter((day) => workingDays.includes(day.value))
        .map((day) => day.label)
        .join(', ');
    const heroEyebrow = isSettingsView ? 'Account Settings' : 'Technician Identity';
    const heroTitle = isSettingsView ? 'Profile settings\nfor account control.' : 'Profile\nwith field identity.';
    const heroDescription = isSettingsView
        ? 'Manage your account details, availability settings, and password updates from one mobile-first control surface.'
        : 'Review your technician identity, contact details, and settings access from one field-ready profile workspace.';
    const availabilityLabel = workingDayLabels || 'Not configured';
    const summaryCards = [
        {
            label: 'Account',
            value: isPreviewMode ? 'Preview' : 'Live',
            description: isPreviewMode ? 'Read-only technician preview mode.' : 'Signed-in technician portal account.',
            tone: 'border-white/10 bg-[linear-gradient(180deg,rgba(14,23,40,0.98),rgba(8,12,20,0.98))]',
            iconTone: 'border-white/10 bg-white/[0.04] text-white',
            icon: User,
        },
        {
            label: 'Availability',
            value: afterHoursEnabled ? 'Open' : 'Standard',
            description: afterHoursEnabled ? 'After-hours assignments currently enabled.' : 'Working normal shift settings only.',
            tone: 'border-white/10 bg-[linear-gradient(180deg,rgba(14,23,40,0.98),rgba(8,12,20,0.98))]',
            iconTone: 'border-white/10 bg-white/[0.04] text-white',
            icon: Clock,
        },
        {
            label: 'Work Days',
            value: String(workingDays.length),
            description: availabilityLabel,
            tone: 'border-white/10 bg-[linear-gradient(180deg,rgba(14,23,40,0.98),rgba(8,12,20,0.98))]',
            iconTone: 'border-white/10 bg-white/[0.04] text-white',
            icon: Calendar,
        },
    ] as const;

    return (
        <div className="tech-shell pb-28 text-white">
            <div className="relative w-full pb-8">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-[320px] bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),rgba(34,211,238,0)_32%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.1),rgba(16,185,129,0)_28%)]" />
                <div className="relative mx-auto w-full max-w-[1500px] space-y-6 px-3 pt-5 sm:px-4 sm:pt-6 lg:px-6 lg:pt-8">
                    <section className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(135deg,rgba(7,25,42,0.98),rgba(6,18,32,0.98))] shadow-[0_34px_120px_rgba(0,0,0,0.34)]">
                        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:120px_120px] opacity-20" />
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent" />
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(79,124,255,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(148,163,184,0.1),transparent_26%)]" />
                        <div className="relative flex flex-col gap-5 p-6 lg:flex-row lg:items-end lg:justify-between lg:p-8">
                            <div className="max-w-3xl">
                                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-white">
                                    <Sparkles className="h-3.5 w-3.5" />
                                    {heroEyebrow}
                                </div>
                                <h1
                                    className={cn(
                                        'mt-5 whitespace-pre-line font-semibold text-white',
                                        isSettingsView
                                            ? 'text-[clamp(1.9rem,3vw,2.7rem)] leading-[1.02] tracking-[-0.055em]'
                                            : 'text-[clamp(2rem,3.4vw,3.15rem)] leading-[0.94] tracking-[-0.07em]',
                                    )}
                                >
                                    {heroTitle}
                                </h1>
                                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-[15px]">
                                    {heroDescription}
                                </p>
                                <div className="mt-5 flex flex-wrap items-center gap-2">
                                    <Badge variant="outline" className="rounded-full border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white">
                                        {userName}
                                    </Badge>
                                    <Badge variant="outline" className="rounded-full border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white">
                                        {isPreviewMode ? 'preview mode' : 'technician portal'}
                                    </Badge>
                                    <Badge variant="outline" className="rounded-full border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-300">
                                        {workingDays.length} work days
                                    </Badge>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 self-start lg:self-end">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => void handleRefresh()}
                                    className="h-11 gap-2 rounded-2xl border border-white/12 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(8,12,20,0.98))] px-4 text-slate-100 shadow-[0_14px_34px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.055)] hover:bg-[linear-gradient(180deg,rgba(24,38,64,0.98),rgba(12,20,34,0.98))] hover:text-white disabled:border-white/10 disabled:bg-[linear-gradient(180deg,rgba(24,34,52,0.88),rgba(12,20,34,0.88))] disabled:text-slate-400 disabled:opacity-100"
                                    disabled={loading}
                                >
                                    <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
                                    Refresh
                                </Button>
                            </div>
                        </div>
                    </section>

                    <div className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3', isSettingsView && 'xl:grid-cols-3')}>
                        {summaryCards.map((card) => {
                            const Icon = card.icon;
                            return (
                                <div key={card.label} className={cn('overflow-hidden rounded-[24px] border shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]', card.tone)}>
                                    <div className="flex items-start justify-between p-5">
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{card.label}</p>
                                            <p className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-white">{card.value}</p>
                                            <p className="mt-2 text-sm text-slate-300">{card.description}</p>
                                        </div>
                                        <div className={cn('flex h-11 w-11 items-center justify-center rounded-2xl border', card.iconTone)}>
                                            <Icon className="h-5 w-5" />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="space-y-4">
                {loading ? <Card className="border-white/10 bg-white/[0.03] p-6 text-slate-200">Loading profile...</Card> : null}
                {error ? <Card className="border-red-500/25 bg-red-500/10 p-4 text-sm text-red-100">{error}</Card> : null}

                {isSettingsView ? (
                    <>
                        <div className="flex items-center justify-between gap-3 px-1">
                            {isSettingsRoute ? (
                                <Button type="button" variant="ghost" onClick={openProfileView} className="justify-start px-1 text-slate-300 hover:text-white">
                                    <ArrowLeft className="w-4 h-4 mr-2" /> Back to Profile
                                </Button>
                            ) : (
                                <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Profile workspace</div>
                            )}
                            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Settings workspace</div>
                        </div>

                        <Card className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,24,39,0.96),rgba(6,17,29,0.96))] shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
                            <div className="border-b border-white/10 px-6 py-5">
                                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                                    <User className="h-3.5 w-3.5 text-cyan-200" />
                                    Profile Board
                                </div>
                                <div className="mt-2 text-sm text-slate-300">Keep your technician identity and contact details current for dispatch visibility.</div>
                            </div>
                            <div className="p-6">
                            <div className="flex items-center gap-4 mb-6">
                                {profilePictureUrl ? (
                                    <img src={profilePictureUrl} alt="Profile" className="w-16 h-16 rounded-full object-cover border border-white/10" />
                                ) : (
                                    <div className="w-16 h-16 rounded-full bg-[#2F8E92] flex items-center justify-center text-white text-2xl font-bold">
                                        {initials}
                                    </div>
                                )}
                                <div>
                                    <h2 className="text-lg font-bold text-white">{userName}</h2>
                                    <p className="text-sm text-slate-400">{isPreviewMode ? 'Technician (Preview)' : 'Technician'}</p>
                                </div>
                            </div>

                            {isPreviewMode ? (
                                <div className="space-y-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-slate-400">Full Name</span>
                                        <span className="font-medium text-white">{fullName || userName}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-slate-400">Email</span>
                                        <span className="font-medium text-white">{userEmail}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-slate-400">Phone</span>
                                        <span className="font-medium text-white">{userPhone}</span>
                                    </div>
                                    <p className="text-xs text-slate-400">Preview mode is read-only. Open technician portal to edit these values.</p>
                                </div>
                            ) : (
                                    <div className="space-y-3">
                                    <div className="space-y-3">
                                        <div className="space-y-2">
                                            <Label className="text-slate-300">Profile Photo</Label>
                                            <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-cyan-300/25 bg-cyan-300/5 text-cyan-100 transition hover:bg-cyan-300/10">
                                                <Upload className="mb-1 h-5 w-5" />
                                                <span className="text-[11px] font-semibold">Upload</span>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="sr-only"
                                                    onChange={(event) => handleProfilePhotoUpload(event.target.files?.[0])}
                                                />
                                            </label>
                                        </div>
                                        <p className="text-xs text-slate-500">Upload a photo from this device to update your profile image.</p>
                                    </div>
                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                        <div className="space-y-1">
                                            <Label className="text-slate-300">Full Name</Label>
                                            <Input className={TECH_INPUT_CLASS} value={fullName} onChange={(event) => setFullName(event.target.value)} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-slate-300">Phone</Label>
                                            <Input className={TECH_INPUT_CLASS} value={phone} onChange={(event) => setPhone(event.target.value)} />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-slate-300">Email Address</Label>
                                        <Input className={TECH_MUTED_INPUT_CLASS} value={userEmail} readOnly />
                                        <p className="text-xs text-slate-500">Email changes must be requested through the admin.</p>
                                    </div>
                                    <Button onClick={() => void saveProfile()} className="h-11 w-full bg-[#2F8E92] hover:bg-[#267276]" disabled={savingProfile}>
                                        <Save className="w-4 h-4 mr-2" />
                                        {savingProfile ? 'Saving...' : 'Save Profile'}
                                    </Button>
                                </div>
                            )}
                            </div>
                        </Card>

                        <Card className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,24,39,0.96),rgba(6,17,29,0.96))] shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
                            <div className="border-b border-white/10 px-6 py-5">
                                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                                    <Calendar className="h-3.5 w-3.5 text-cyan-200" />
                                    Availability Board
                                </div>
                                <div className="mt-2 text-sm text-slate-300">Configure work days, shift windows, and out-of-office ranges for field routing.</div>
                            </div>
                            <div className="p-6">
                            {isPreviewMode ? (
                                <div className="space-y-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-slate-400">Working Days</span>
                                        <span className="font-medium text-white">{workingDayLabels || 'Not configured'}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-slate-400">Working Hours</span>
                                        <span className="font-medium text-white">{workingHoursStart} - {workingHoursEnd}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-slate-400">After-hours Availability</span>
                                        <span className={cn('font-medium', afterHoursEnabled ? 'text-emerald-300' : 'text-slate-300')}>
                                            {afterHoursEnabled ? 'Enabled' : 'Disabled'}
                                        </span>
                                    </div>
                                    <div className="border-t border-white/10 pt-1">
                                        <div className="mb-2 text-xs font-medium text-slate-300">Out-of-office ranges</div>
                                        {outOfOfficeRanges.length === 0 ? (
                                            <div className="text-xs text-slate-400">No out-of-office ranges configured.</div>
                                        ) : (
                                            <div className="space-y-2">
                                                {outOfOfficeRanges.map((range, index) => (
                                                    <div key={`${range.start_date}-${range.end_date}-${index}`} className="rounded-md border border-white/10 px-3 py-2">
                                                        <div className="text-xs font-medium text-white">{range.start_date} - {range.end_date}</div>
                                                        <div className="text-xs text-slate-400">{range.note || 'Out of office'}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-400">Preview mode is read-only. Open technician portal to update availability.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div>
                                        <Label className="mb-2 block text-slate-300">Working Days</Label>
                                        <div className="flex flex-wrap gap-2">
                                            {DAY_OPTIONS.map((day) => {
                                                const selected = workingDays.includes(day.value);
                                                return (
                                                    <button
                                                        key={day.value}
                                                        type="button"
                                                        onClick={() => toggleWorkingDay(day.value)}
                                                        className={cn(
                                                            'h-9 px-3 rounded-lg border text-sm font-medium',
                                                            selected
                                                                ? 'bg-[#2F8E92]/10 border-[#2F8E92] text-[#2F8E92]'
                                                                : 'border-white/10 bg-white/[0.03] text-slate-300',
                                                        )}
                                                    >
                                                        {day.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <div className="space-y-1">
                                            <Label className="text-slate-300">Global Start Time</Label>
                                            <Input className={TECH_INPUT_CLASS} type="time" value={workingHoursStart} onChange={(event) => setWorkingHoursStart(event.target.value)} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-slate-300">Global End Time</Label>
                                            <Input className={TECH_INPUT_CLASS} type="time" value={workingHoursEnd} onChange={(event) => setWorkingHoursEnd(event.target.value)} />
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-500">These hours apply to every selected working day.</p>

                                    <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                                        <div>
                                            <div className="text-sm font-medium text-white">After-hours availability</div>
                                            <div className="text-xs text-slate-400">Allow assignment requests after normal shift</div>
                                        </div>
                                        <Switch checked={afterHoursEnabled} onCheckedChange={setAfterHoursEnabled} />
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-slate-300">Out-of-office ranges</Label>
                                        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                                            <Input className={TECH_INPUT_CLASS} type="date" value={newRange.start_date} onChange={(event) => setNewRange((prev) => ({ ...prev, start_date: event.target.value }))} />
                                            <Input className={TECH_INPUT_CLASS} type="date" value={newRange.end_date} onChange={(event) => setNewRange((prev) => ({ ...prev, end_date: event.target.value }))} />
                                            <Input className={TECH_INPUT_CLASS} value={newRange.note || ''} onChange={(event) => setNewRange((prev) => ({ ...prev, note: event.target.value }))} placeholder="Note (optional)" />
                                        </div>
                                        <Button type="button" variant="outline" onClick={addOutOfOfficeRange} className={cn('h-10 w-full', TECH_OUTLINE_BUTTON_CLASS)}>
                                            <Plus className="w-4 h-4 mr-2" /> Add Range
                                        </Button>
                                        <div className="space-y-2">
                                            {outOfOfficeRanges.length === 0 ? (
                                                <div className="text-xs text-slate-400">No out-of-office ranges configured.</div>
                                            ) : outOfOfficeRanges.map((range, index) => (
                                                <div key={`${range.start_date}-${range.end_date}-${index}`} className="flex items-center justify-between rounded-md border border-white/10 px-3 py-2">
                                                    <div className="text-xs">
                                                        <div className="font-medium text-white">{range.start_date} - {range.end_date}</div>
                                                        <div className="text-slate-400">{range.note || 'Out of office'}</div>
                                                    </div>
                                                    <Button type="button" variant="ghost" size="icon" onClick={() => setOutOfOfficeRanges((prev) => prev.filter((_, i) => i !== index))}>
                                                        <Trash2 className="w-4 h-4 text-red-400" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <Button onClick={() => void saveAvailability()} className="h-11 w-full bg-[#2F8E92] hover:bg-[#267276]" disabled={savingAvailability}>
                                        <Save className="w-4 h-4 mr-2" />
                                        {savingAvailability ? 'Saving...' : 'Save Availability'}
                                    </Button>
                                </div>
                            )}
                            </div>
                        </Card>

                        <Card className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,24,39,0.96),rgba(6,17,29,0.96))] shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
                            <div className="border-b border-white/10 px-6 py-5">
                                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                                    <KeyRound className="h-3.5 w-3.5 text-cyan-200" />
                                    Security Board
                                </div>
                                <div className="mt-2 text-sm text-slate-300">Update your password and keep technician account access secure.</div>
                            </div>
                            <div className="p-6">
                            {isPreviewMode ? (
                                <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3 text-xs text-slate-400">
                                    Preview mode is read-only. Open technician portal to update password.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="space-y-1">
                                        <Label htmlFor="technician_current_password" className="text-slate-300">Current Password</Label>
                                        <Input
                                            className={TECH_INPUT_CLASS}
                                            id="technician_current_password"
                                            type="password"
                                            autoComplete="current-password"
                                            value={passwordForm.currentPassword}
                                            onChange={(event) => setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="technician_new_password" className="text-slate-300">New Password</Label>
                                        <Input
                                            className={TECH_INPUT_CLASS}
                                            id="technician_new_password"
                                            type="password"
                                            autoComplete="new-password"
                                            value={passwordForm.newPassword}
                                            onChange={(event) => setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="technician_confirm_password" className="text-slate-300">Confirm New Password</Label>
                                        <Input
                                            className={TECH_INPUT_CLASS}
                                            id="technician_confirm_password"
                                            type="password"
                                            autoComplete="new-password"
                                            value={passwordForm.confirmPassword}
                                            onChange={(event) => setPasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                                        />
                                    </div>
                                    {passwordError ? <p className="text-sm text-red-400">{passwordError}</p> : null}
                                    <Button
                                        onClick={() => void savePassword()}
                                        className="h-11 w-full bg-[#2F8E92] hover:bg-[#267276]"
                                        disabled={savingPassword}
                                    >
                                        <Save className="w-4 h-4 mr-2" />
                                        {savingPassword ? 'Updating...' : 'Update Password'}
                                    </Button>
                                </div>
                            )}
                            </div>
                        </Card>

                        <Card className="overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,24,39,0.92),rgba(6,17,29,0.94))] shadow-[0_20px_70px_rgba(0,0,0,0.22)]">
                            <div className="flex items-center justify-between gap-3 px-6 py-4">
                                <div>
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Session Actions</div>
                                    <div className="mt-1 text-sm text-slate-300">{isPreviewMode ? 'Exit technician preview when finished reviewing.' : 'End this technician session safely.'}</div>
                                </div>
                                <Button
                                    onClick={handleLogout}
                                    variant="ghost"
                                    className="h-11 min-w-[150px] border border-red-400/25 bg-[linear-gradient(180deg,rgba(76,18,28,0.88),rgba(44,12,19,0.92))] text-red-100 shadow-[0_14px_34px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.04)] hover:bg-[linear-gradient(180deg,rgba(96,24,36,0.92),rgba(56,15,24,0.96))] hover:text-white"
                                >
                                    <LogOut className="w-5 h-5 mr-2" />
                                    {isPreviewMode ? 'Exit Preview' : 'Logout'}
                                </Button>
                            </div>
                        </Card>
                    </>
                ) : (
                    <>
                        <Card className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,24,39,0.96),rgba(6,17,29,0.96))] shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
                            <div className="border-b border-white/10 px-6 py-5">
                                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                                    <User className="h-3.5 w-3.5 text-cyan-200" />
                                    Identity Board
                                </div>
                                <div className="mt-2 text-sm text-slate-300">Review your technician identity, contact channel, and workspace access.</div>
                            </div>
                            <div className="p-6">
                            <div className="flex items-center gap-4">
                                {profilePictureUrl ? (
                                    <img src={profilePictureUrl} alt="Profile" className="w-16 h-16 rounded-full object-cover border border-white/10" />
                                ) : (
                                    <div className="w-16 h-16 rounded-full bg-[#2F8E92] flex items-center justify-center text-white text-2xl font-bold">
                                        {initials}
                                    </div>
                                )}
                                <div>
                                    <h2 className="text-lg font-bold text-white">{userName}</h2>
                                    <p className="text-sm text-slate-400">{isPreviewMode ? 'Technician (Preview)' : 'Technician'}</p>
                                </div>
                            </div>

                            <div className="mt-6 divide-y divide-white/10">
                                <div className="flex items-center justify-between py-3 text-sm">
                                    <span className="text-slate-400">Email</span>
                                    <span className="font-medium text-white">{userEmail}</span>
                                </div>
                                <div className="flex items-center justify-between py-3 text-sm">
                                    <span className="text-slate-400">Phone</span>
                                    <span className="font-medium text-white">{userPhone}</span>
                                </div>
                            </div>
                            </div>
                        </Card>

                        <Card className="overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,24,39,0.92),rgba(6,17,29,0.94))] shadow-[0_20px_70px_rgba(0,0,0,0.22)]">
                            <div className="border-b border-white/10 px-6 py-5">
                                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                                    <Settings className="h-3.5 w-3.5 text-cyan-200" />
                                    Settings Access
                                </div>
                                <div className="mt-2 text-sm text-slate-300">Open account settings, availability controls, and password updates.</div>
                            </div>
                            <button
                                type="button"
                                className="flex w-full items-center justify-between px-6 py-5 text-left transition hover:bg-white/[0.04]"
                                onClick={openSettingsView}
                            >
                                <div>
                                    <div className="text-sm font-semibold text-white">Open Settings Workspace</div>
                                    <div className="mt-1 text-sm text-slate-400">Manage profile details, work days, after-hours availability, and security.</div>
                                </div>
                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                                    <ChevronRight className="w-4 h-4 text-slate-300" />
                                </div>
                            </button>
                        </Card>

                        <Card className="overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,24,39,0.92),rgba(6,17,29,0.94))] shadow-[0_20px_70px_rgba(0,0,0,0.22)]">
                            <div className="flex items-center justify-between gap-3 px-6 py-4">
                                <div>
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Session Actions</div>
                                    <div className="mt-1 text-sm text-slate-300">{isPreviewMode ? 'Exit technician preview when finished reviewing.' : 'End this technician session safely.'}</div>
                                </div>
                                <Button
                                    onClick={handleLogout}
                                    variant="ghost"
                                    className="h-11 min-w-[150px] border border-red-400/25 bg-[linear-gradient(180deg,rgba(76,18,28,0.88),rgba(44,12,19,0.92))] text-red-100 shadow-[0_14px_34px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.04)] hover:bg-[linear-gradient(180deg,rgba(96,24,36,0.92),rgba(56,15,24,0.96))] hover:text-white"
                                >
                                    <LogOut className="w-5 h-5 mr-2" />
                                    {isPreviewMode ? 'Exit Preview' : 'Logout'}
                                </Button>
                            </div>
                        </Card>
                    </>
                )}
                    </div>
                </div>
            </div>

            <TechnicianBottomNav activeTab="profile" routeBase={routeBase} />
        </div>
    );
}

import { useCallback, useEffect, useState } from 'react';
import {
    AlertCircle,
    Pencil,
    RefreshCw,
    KeyRound,
    Moon,
    Sun,
    Monitor,
    FileText,
    ListFilter,
    PlusCircle,
    Building2,
    ShieldCheck,
} from 'lucide-react';
import { MOCK_DEALERSHIPS as FALLBACK_DEALERSHIPS } from './Dealerships';
import type { PriorityRule, UrgencyLevel } from '@/types';





import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/theme-provider';
import {
    type InvoiceCompanyProfile,
    loadInvoiceCompanyProfile,
    saveInvoiceCompanyProfile,
} from '@/lib/invoice-company';
import {
    createAdminPriorityRule,
    deleteAdminPriorityRule,
    fetchAdminCredentialSettings,
    fetchAdminDealerships,
    fetchAdminPriorityRules,
    fetchAdminServices,
    fetchAdminInvoiceBrandingSettings,
    getStoredAdminToken,
    updateAdminCredentialSettings,
    updateAdminPriorityRule,
    updateAdminInvoiceBrandingSettings,
    type BackendAdminCredentialSettings,
    type BackendDealership,
    type BackendPriorityRule,
    type BackendServiceCatalogItem,
} from '@/lib/backend-api';
import { useAuth } from '@/contexts/AuthContext';
// --- Mock Data & Types ---

type ThemeMode = 'light' | 'dark' | 'system';

type DealershipOption = {
  id: string;
  backendId: string;
  name: string;
};

// --- Components ---

const normalizeInvoiceCompanyProfile = (profile: InvoiceCompanyProfile): InvoiceCompanyProfile => ({
    logo_url: profile.logo_url?.trim() || undefined,
    name: profile.name.trim(),
    street_address: profile.street_address.trim(),
    city: profile.city.trim(),
    state: profile.state.trim(),
    zip_code: profile.zip_code.trim(),
    phone: profile.phone.trim(),
    email: profile.email.trim(),
    website: profile.website.trim(),
});

const mapBackendPriorityRule = (row: BackendPriorityRule): PriorityRule => ({
    id: row.id,
    description: row.description,
    dealershipId: row.dealership_id,
    serviceId: row.service_id ?? undefined,
    targetUrgency: row.target_urgency,
    rankingScore: row.ranking_score,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
});

const mapBackendDealershipOption = (row: BackendDealership): DealershipOption => ({
    id: row.code,
    backendId: row.id,
    name: row.name?.trim() || '',
});

const getDefaultNewRule = (): Partial<PriorityRule> => ({
    targetUrgency: 'HIGH',
    rankingScore: 10,
    isActive: true,
    dealershipId: '',
    serviceId: '',
    description: ''
});

const ADMIN_REFRESH_EVENT = 'sm-dispatch:admin-refresh';
const DEFAULT_ADMIN_EMAIL = 'admin@sm2dispatch.com';

const getDefaultAdminCredentialValues = () => ({
    adminEmail: DEFAULT_ADMIN_EMAIL,
});

const sectionCardClass = 'overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_22px_70px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(9,24,39,0.96),rgba(6,17,29,0.96))] dark:shadow-[0_24px_80px_rgba(0,0,0,0.28)]';
const sectionHeaderClass = 'border-b border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.88),rgba(255,255,255,0))] pb-5 dark:border-white/8 dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0))]';
const sectionFooterClass = 'border-t border-slate-200 bg-slate-50/80 py-4 dark:border-white/8 dark:bg-white/[0.03]';



export default function SettingsPage() {
    const { hasBackendAdminToken } = useAuth();
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [savedInvoiceCompany, setSavedInvoiceCompany] = useState<InvoiceCompanyProfile>(() => loadInvoiceCompanyProfile());
    const [invoiceCompany, setInvoiceCompany] = useState<InvoiceCompanyProfile>(() => loadInvoiceCompanyProfile());
    const [priorityRules, setPriorityRules] = useState<PriorityRule[]>([]);
    const [dealershipOptions, setDealershipOptions] = useState<DealershipOption[]>([]);
    const [serviceOptions, setServiceOptions] = useState<Array<{ id: string; name: string }>>([]);
    const [isAddingRule, setIsAddingRule] = useState(false);
    const [newRule, setNewRule] = useState<Partial<PriorityRule>>(getDefaultNewRule());
    const [isEditingRule, setIsEditingRule] = useState(false);
    const [editRule, setEditRule] = useState<Partial<PriorityRule> & { id?: string }>(getDefaultNewRule());
    const [savedAdminCredentials, setSavedAdminCredentials] = useState(getDefaultAdminCredentialValues());
    const [adminCredentialForm, setAdminCredentialForm] = useState({
        ...getDefaultAdminCredentialValues(),
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });
    const [adminCredentialError, setAdminCredentialError] = useState<string | null>(null);
    const [isSavingAdminCredentials, setIsSavingAdminCredentials] = useState(false);
    const MOCK_DEALERSHIPS = dealershipOptions.length > 0 ? dealershipOptions : FALLBACK_DEALERSHIPS;

    const { theme, setTheme } = useTheme();
    const refreshSettingsData = useCallback(async () => {
        const localProfile = loadInvoiceCompanyProfile();
        setSavedInvoiceCompany(localProfile);
        setInvoiceCompany(localProfile);

        const adminToken = getStoredAdminToken();
        if (!hasBackendAdminToken || !adminToken) {
            const fallbackValues = getDefaultAdminCredentialValues();
            setSavedAdminCredentials(fallbackValues);
            setAdminCredentialForm((prev) => ({
                ...prev,
                ...fallbackValues,
            }));
            setDealershipOptions([]);
            setServiceOptions([]);
            setPriorityRules([]);
            return;
        }

        setRefreshing(true);
        try {
            const [
                brandingResult,
                credentialsResult,
                dealershipsResult,
                servicesResult,
                rulesResult,
            ] = await Promise.allSettled([
                fetchAdminInvoiceBrandingSettings(adminToken),
                fetchAdminCredentialSettings(adminToken),
                fetchAdminDealerships(adminToken),
                fetchAdminServices(adminToken, true),
                fetchAdminPriorityRules(adminToken),
            ]);

            if (brandingResult.status === 'fulfilled') {
                const backendProfile = normalizeInvoiceCompanyProfile({
                    logo_url: brandingResult.value.logo_url ?? undefined,
                    name: brandingResult.value.name,
                    street_address: brandingResult.value.street_address,
                    city: brandingResult.value.city,
                    state: brandingResult.value.state,
                    zip_code: brandingResult.value.zip_code,
                    phone: brandingResult.value.phone,
                    email: brandingResult.value.email,
                    website: brandingResult.value.website,
                });
                setSavedInvoiceCompany(backendProfile);
                setInvoiceCompany(backendProfile);
                saveInvoiceCompanyProfile(backendProfile);
            }

            if (credentialsResult.status === 'fulfilled') {
                const nextValues = {
                    adminEmail: credentialsResult.value.admin_email,
                };
                setSavedAdminCredentials(nextValues);
                setAdminCredentialForm((prev) => ({
                    ...prev,
                    ...nextValues,
                }));
            } else {
                const fallbackValues = getDefaultAdminCredentialValues();
                setSavedAdminCredentials(fallbackValues);
                setAdminCredentialForm((prev) => ({
                    ...prev,
                    ...fallbackValues,
                }));
            }

            if (dealershipsResult.status === 'fulfilled') {
                setDealershipOptions(
                    dealershipsResult.value
                        .map(mapBackendDealershipOption)
                        .filter((row) => row.name.length > 0),
                );
            } else {
                setDealershipOptions([]);
            }

            if (servicesResult.status === 'fulfilled') {
                const next = servicesResult.value
                    .map((row: BackendServiceCatalogItem) => ({
                        id: row.id,
                        name: row.name?.trim() || '',
                    }))
                    .filter((row) => row.name.length > 0);
                setServiceOptions(next);
            } else {
                setServiceOptions([]);
            }

            if (rulesResult.status === 'fulfilled') {
                setPriorityRules(rulesResult.value.map(mapBackendPriorityRule));
            } else {
                setPriorityRules([]);
            }
        } finally {
            setRefreshing(false);
        }
    }, [hasBackendAdminToken]);

    useEffect(() => {
        void refreshSettingsData();
    }, [refreshSettingsData]);

    useEffect(() => {
        const handleAdminRefresh = () => {
            void refreshSettingsData();
        };

        window.addEventListener(ADMIN_REFRESH_EVENT, handleAdminRefresh);
        return () => {
            window.removeEventListener(ADMIN_REFRESH_EVENT, handleAdminRefresh);
        };
    }, [refreshSettingsData]);

    const saveInvoiceBrandingSettings = async (successMessage: string): Promise<boolean> => {
        const normalizedCompanyProfile: InvoiceCompanyProfile = normalizeInvoiceCompanyProfile(invoiceCompany);

        if (
            !normalizedCompanyProfile.name ||
            !normalizedCompanyProfile.street_address ||
            !normalizedCompanyProfile.city ||
            !normalizedCompanyProfile.state ||
            !normalizedCompanyProfile.zip_code ||
            !normalizedCompanyProfile.phone ||
            !normalizedCompanyProfile.email ||
            !normalizedCompanyProfile.website
        ) {
            alert("Please complete the full invoice company profile (all fields except logo are required).");
            return false;
        }

        setLoading(true);
        try {
            const adminToken = getStoredAdminToken();
            let nextCompanyProfile = normalizedCompanyProfile;

            if (hasBackendAdminToken && adminToken) {
                const backendSavedProfile = await updateAdminInvoiceBrandingSettings(adminToken, normalizedCompanyProfile);
                nextCompanyProfile = normalizeInvoiceCompanyProfile({
                    logo_url: backendSavedProfile.logo_url ?? undefined,
                    name: backendSavedProfile.name,
                    street_address: backendSavedProfile.street_address,
                    city: backendSavedProfile.city,
                    state: backendSavedProfile.state,
                    zip_code: backendSavedProfile.zip_code,
                    phone: backendSavedProfile.phone,
                    email: backendSavedProfile.email,
                    website: backendSavedProfile.website,
                });
            }

            setSavedInvoiceCompany(nextCompanyProfile);
            setInvoiceCompany(nextCompanyProfile);
            saveInvoiceCompanyProfile(nextCompanyProfile);
            alert(successMessage);
            return true;
        } catch (error) {
            const detail = error instanceof Error ? error.message : "Unable to save settings.";
            alert(`Failed to save invoice branding settings: ${detail}`);
            return false;
        } finally {
            setLoading(false);
        }
    };

    const handleSaveInvoiceBranding = async () => {
        await saveInvoiceBrandingSettings("Invoice branding saved successfully.");
    };

    const handleCancelInvoiceBranding = () => {
        setInvoiceCompany({ ...savedInvoiceCompany });
    };

    const handleSaveAdminCredentials = async () => {
        const adminToken = getStoredAdminToken();
        if (!hasBackendAdminToken || !adminToken) {
            setAdminCredentialError('Admin session is required to update access settings.');
            return;
        }

        setAdminCredentialError(null);
        const adminEmail = adminCredentialForm.adminEmail.trim().toLowerCase();
        const currentPassword = adminCredentialForm.currentPassword.trim();
        const newPassword = adminCredentialForm.newPassword.trim();
        const confirmPassword = adminCredentialForm.confirmPassword.trim();

        if (!adminEmail || !currentPassword) {
            setAdminCredentialError('Admin email and current password are required.');
            return;
        }
        if ((newPassword && !confirmPassword) || (!newPassword && confirmPassword)) {
            setAdminCredentialError('Enter and confirm the new password, or leave both fields empty.');
            return;
        }
        if (newPassword && newPassword.length < 6) {
            setAdminCredentialError('New password must be at least 6 characters.');
            return;
        }
        if (newPassword && newPassword !== confirmPassword) {
            setAdminCredentialError('New password and confirmation do not match.');
            return;
        }

        setIsSavingAdminCredentials(true);
        try {
            const updated = await updateAdminCredentialSettings(adminToken, {
                admin_email: adminEmail,
                current_password: currentPassword,
                new_password: newPassword || undefined,
            });
            const nextValues = {
                adminEmail: updated.admin_email,
            };
            setSavedAdminCredentials(nextValues);
            setAdminCredentialForm({
                ...nextValues,
                currentPassword: '',
                newPassword: '',
                confirmPassword: '',
            });
            alert(newPassword ? 'Admin access settings updated successfully.' : 'Admin email updated successfully.');
        } catch (error) {
            setAdminCredentialError(error instanceof Error ? error.message : 'Unable to update admin access settings.');
        } finally {
            setIsSavingAdminCredentials(false);
        }
    };

    const handleThemeChange = (newTheme: ThemeMode) => {
        setTheme(newTheme);
        // In real app: update context, persist to backend, update document class
        // useTheme hook handles document class update
    };

    const handleDeleteRule = async (id: string) => {
        const adminToken = getStoredAdminToken();
        if (!hasBackendAdminToken || !adminToken) {
            alert('Admin session is required to delete rules.');
            return;
        }

        try {
            await deleteAdminPriorityRule(adminToken, id);
            setPriorityRules(prev => prev.filter(r => r.id !== id));
        } catch (error) {
            const detail = error instanceof Error ? error.message : 'Unable to delete priority rule.';
            alert(detail);
        }
    };

    const handleToggleRule = async (id: string) => {
        const adminToken = getStoredAdminToken();
        if (!hasBackendAdminToken || !adminToken) {
            alert('Admin session is required to update rules.');
            return;
        }

        const current = priorityRules.find((rule) => rule.id === id);
        if (!current) {
            return;
        }

        try {
            const updated = await updateAdminPriorityRule(adminToken, id, {
                is_active: !current.isActive,
            });
            setPriorityRules(prev => prev.map(r => r.id === id ? mapBackendPriorityRule(updated) : r));
        } catch (error) {
            const detail = error instanceof Error ? error.message : 'Unable to update priority rule.';
            alert(detail);
        }
    };

    const handleAddRule = async () => {
        const adminToken = getStoredAdminToken();
        if (!hasBackendAdminToken || !adminToken) {
            alert('Admin session is required to create rules.');
            return;
        }

        try {
            const created = await createAdminPriorityRule(adminToken, {
                description: newRule.description || 'New Priority Rule',
                dealership_id: newRule.dealershipId || (dealershipOptions[0]?.id || ''),
                service_id: newRule.serviceId === 'any' ? null : (newRule.serviceId || null),
                target_urgency: newRule.targetUrgency || 'HIGH',
                ranking_score: (newRule.rankingScore !== undefined) ? newRule.rankingScore : 10,
                is_active: true,
            });
            setPriorityRules(prev => [...prev, mapBackendPriorityRule(created)]);
            setIsAddingRule(false);
            setNewRule(getDefaultNewRule());
        } catch (error) {
            const detail = error instanceof Error ? error.message : 'Unable to create priority rule.';
            alert(detail);
        }
    };

    const handleOpenEditRule = (rule: PriorityRule) => {
        setEditRule({
            id: rule.id,
            description: rule.description,
            dealershipId: rule.dealershipId,
            serviceId: rule.serviceId || 'any',
            targetUrgency: rule.targetUrgency,
            rankingScore: rule.rankingScore,
            isActive: rule.isActive,
        });
        setIsEditingRule(true);
    };

    const handleEditRule = async () => {
        const adminToken = getStoredAdminToken();
        if (!hasBackendAdminToken || !adminToken || !editRule.id) {
            alert('Admin session is required to edit rules.');
            return;
        }

        try {
            const updated = await updateAdminPriorityRule(adminToken, editRule.id, {
                description: editRule.description || 'Updated Priority Rule',
                dealership_id: editRule.dealershipId || (dealershipOptions[0]?.id || ''),
                service_id: editRule.serviceId === 'any' ? null : (editRule.serviceId || null),
                target_urgency: editRule.targetUrgency || 'HIGH',
                ranking_score: (editRule.rankingScore !== undefined) ? editRule.rankingScore : 10,
                is_active: editRule.isActive ?? true,
            });
            setPriorityRules((prev) => prev.map((r) => (r.id === editRule.id ? mapBackendPriorityRule(updated) : r)));
            setIsEditingRule(false);
            setEditRule(getDefaultNewRule());
        } catch (error) {
            const detail = error instanceof Error ? error.message : 'Unable to update priority rule.';
            alert(detail);
        }
    };




    return (
        <div className="relative w-full pb-10">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[380px] rounded-[34px] bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),rgba(34,211,238,0)_34%),radial-gradient(circle_at_top_right,rgba(52,211,153,0.08),rgba(52,211,153,0)_30%)]" />
            <div className="pointer-events-none absolute left-8 top-8 h-40 w-40 rounded-full bg-cyan-400/8 blur-3xl" />
            <div className="pointer-events-none absolute right-10 top-20 h-48 w-48 rounded-full bg-emerald-400/8 blur-3xl" />

            <div className="relative space-y-6">
                <section className="relative overflow-hidden rounded-[32px] border border-slate-200 bg-[linear-gradient(135deg,#ffffff,#f7fbff)] shadow-[0_28px_90px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(7,25,42,0.98),rgba(6,18,32,0.98))] dark:shadow-[0_34px_120px_rgba(0,0,0,0.34)]">
                    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.035)_1px,transparent_1px)] bg-[size:120px_120px] opacity-40 dark:bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] dark:opacity-20" />
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent dark:via-cyan-200/70" />
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(79,124,255,0.10),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.10),transparent_26%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(47,142,146,0.14),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.12),transparent_26%)]" />
                    <div className="relative flex flex-col gap-5 p-6 xl:flex-row xl:items-end xl:justify-between xl:p-8">
                        <div className="max-w-3xl">
                            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-700 dark:border-cyan-300/20 dark:bg-cyan-300/10 dark:text-cyan-100">
                                <Monitor className="h-3.5 w-3.5" />
                                Admin Controls
                            </div>
                            <h1 className="mt-5 text-[2.35rem] font-semibold leading-none tracking-[-0.06em] text-slate-950 dark:text-white md:text-[2.8rem]">
                                Settings
                                <span className="block bg-gradient-to-r from-slate-950 via-blue-700 to-cyan-500 bg-clip-text text-transparent dark:from-white dark:via-cyan-100 dark:to-emerald-100">
                                    command center
                                </span>
                            </h1>
                            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-300 sm:text-[15px]">
                                Configure dispatch ranking, invoice branding, admin access, and interface preferences from one operational control surface.
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-10 gap-2 rounded-full border-slate-200 bg-white px-4 text-slate-700 shadow-none hover:bg-slate-50 dark:border-white/12 dark:bg-white/[0.04] dark:text-slate-100 dark:hover:bg-white/[0.08] dark:hover:text-white"
                                onClick={() => void refreshSettingsData()}
                                disabled={refreshing}
                            >
                                <RefreshCw className={cn('w-4 h-4 text-cyan-200', refreshing && 'animate-spin')} />
                                Refresh
                            </Button>
                        </div>
                    </div>
                </section>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <Card className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_18px_54px_rgba(15,23,42,0.07)] dark:border-cyan-400/15 dark:bg-[linear-gradient(180deg,rgba(12,36,55,0.96),rgba(8,24,39,0.96))] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                        <CardContent className="p-5">
                            <div className="flex items-start justify-between gap-3">
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Dispatch Rules</p>
                                    <p className="mt-3 text-[2.15rem] font-semibold leading-none tracking-[-0.06em] text-slate-950 dark:text-white">{priorityRules.length}</p>
                                    <p className="text-sm text-slate-600 dark:text-slate-300">Ranking rules configured</p>
                                </div>
                                <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-3 text-cyan-100">
                                    <ListFilter className="w-5 h-5" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="overflow-hidden rounded-[24px] border border-emerald-200 bg-emerald-50/70 shadow-[0_18px_54px_rgba(15,23,42,0.06)] dark:border-emerald-400/15 dark:bg-[linear-gradient(180deg,rgba(10,37,45,0.96),rgba(7,25,31,0.96))] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                        <CardContent className="p-5">
                            <div className="flex items-start justify-between gap-3">
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700/70 dark:text-slate-400">Active Rules</p>
                                    <p className="mt-3 text-[2.15rem] font-semibold leading-none tracking-[-0.06em] text-emerald-950 dark:text-white">{priorityRules.filter((rule) => rule.isActive).length}</p>
                                    <p className="text-sm text-emerald-800/75 dark:text-slate-300">Rules affecting queue ranking</p>
                                </div>
                                <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-emerald-100">
                                    <ShieldCheck className="w-5 h-5" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="overflow-hidden rounded-[24px] border border-amber-200 bg-amber-50/70 shadow-[0_18px_54px_rgba(15,23,42,0.06)] dark:border-amber-400/15 dark:bg-[linear-gradient(180deg,rgba(41,28,15,0.94),rgba(27,18,10,0.96))] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                        <CardContent className="p-5">
                            <div className="flex items-start justify-between gap-3">
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700/70 dark:text-slate-400">Dealership Coverage</p>
                                    <p className="mt-3 text-[2.15rem] font-semibold leading-none tracking-[-0.06em] text-amber-950 dark:text-white">{dealershipOptions.length}</p>
                                    <p className="text-sm text-amber-800/75 dark:text-slate-300">Partners available for rule targeting</p>
                                </div>
                                <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-3 text-amber-100">
                                    <Building2 className="w-5 h-5" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_18px_54px_rgba(15,23,42,0.07)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(13,24,38,0.96),rgba(8,17,29,0.96))] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                        <CardContent className="p-5">
                            <div className="flex items-start justify-between gap-3">
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">CRM Theme</p>
                                    <p className="mt-3 text-[2.15rem] font-semibold leading-none tracking-[-0.06em] text-slate-950 dark:text-white">
                                        {theme === 'dark' ? 'Dark' : theme === 'light' ? 'Light' : 'System'}
                                    </p>
                                    <p className="text-sm text-slate-600 dark:text-slate-300">Current interface appearance</p>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-3 text-slate-200">
                                    <Monitor className="w-5 h-5" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

            <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">

                <Card className={cn(sectionCardClass, 'xl:row-span-2')}>
                    <CardHeader className={sectionHeaderClass}>
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base font-semibold flex items-center gap-2 text-slate-950 dark:text-white">
                                <span className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-2 text-cyan-100">
                                    <ListFilter className="w-4 h-4" />
                                </span>
                                Dispatch Ranking Rules
                            </CardTitle>

                            <Dialog open={isAddingRule} onOpenChange={setIsAddingRule}>
                                <DialogTrigger asChild>
                                    <Button size="sm" className="h-9 rounded-full bg-[#2F8E92] px-4 text-white shadow-[0_12px_30px_rgba(47,142,146,0.28)] hover:bg-[#267276]">
                                        <PlusCircle className="w-3.5 h-3.5 mr-2" /> Add Rule
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-md">
                                    <DialogHeader>
                                        <DialogTitle>Create New Ranking Rule</DialogTitle>
                                        <DialogDescription>Define logic to automatically escalate job ranking.</DialogDescription>
                                    </DialogHeader>

                                    <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label>Rule Description</Label>
                                            <Input
                                                placeholder="e.g., Prioritize Audi repairs"
                                                value={newRule.description}
                                                onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Dealership</Label>
                                                <Select
                                                    value={newRule.dealershipId}
                                                    onValueChange={(v) => setNewRule({ ...newRule, dealershipId: v })}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select dealer" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {MOCK_DEALERSHIPS.map(d => (
                                                            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Service Type</Label>
                                                <Select
                                                    value={newRule.serviceId}
                                                    onValueChange={(v) => setNewRule({ ...newRule, serviceId: v })}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Any Service" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="any">Any Service</SelectItem>
                                                        {serviceOptions.map(s => (
                                                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Target Urgency</Label>
                                                <Select
                                                    value={newRule.targetUrgency}
                                                    onValueChange={(v) => setNewRule({ ...newRule, targetUrgency: v as UrgencyLevel })}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="LOW">Low</SelectItem>
                                                        <SelectItem value="MEDIUM">Medium</SelectItem>
                                                        <SelectItem value="HIGH">High</SelectItem>
                                                        <SelectItem value="CRITICAL">Critical</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Ranking Score</Label>
                                                <Input
                                                    type="number"
                                                    value={newRule.rankingScore}
                                                    onChange={(e) => setNewRule({ ...newRule, rankingScore: parseInt(e.target.value) })}
                                                />
                                            </div>

                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setIsAddingRule(false)}>Cancel</Button>
                                        <Button className="bg-[#2F8E92] text-white hover:bg-[#267276]" onClick={handleAddRule}>Save Rule</Button>
                                    </DialogFooter>

                                </DialogContent>
                            </Dialog>
                            <Dialog open={isEditingRule} onOpenChange={setIsEditingRule}>
                                <DialogContent className="max-w-md">
                                    <DialogHeader>
                                        <DialogTitle>Edit Ranking Rule</DialogTitle>
                                        <DialogDescription>Update rule logic for dispatch ranking.</DialogDescription>
                                    </DialogHeader>

                                    <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label>Rule Description</Label>
                                            <Input
                                                placeholder="e.g., Prioritize Audi repairs"
                                                value={editRule.description || ''}
                                                onChange={(e) => setEditRule({ ...editRule, description: e.target.value })}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Dealership</Label>
                                                <Select
                                                    value={editRule.dealershipId}
                                                    onValueChange={(v) => setEditRule({ ...editRule, dealershipId: v })}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select dealer" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {MOCK_DEALERSHIPS.map(d => (
                                                            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Service Type</Label>
                                                <Select
                                                    value={editRule.serviceId}
                                                    onValueChange={(v) => setEditRule({ ...editRule, serviceId: v })}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Any Service" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="any">Any Service</SelectItem>
                                                        {serviceOptions.map(s => (
                                                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Target Urgency</Label>
                                                <Select
                                                    value={editRule.targetUrgency}
                                                    onValueChange={(v) => setEditRule({ ...editRule, targetUrgency: v as UrgencyLevel })}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="LOW">Low</SelectItem>
                                                        <SelectItem value="MEDIUM">Medium</SelectItem>
                                                        <SelectItem value="HIGH">High</SelectItem>
                                                        <SelectItem value="CRITICAL">Critical</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Ranking Score</Label>
                                                <Input
                                                    type="number"
                                                    value={editRule.rankingScore}
                                                    onChange={(e) => setEditRule({ ...editRule, rankingScore: parseInt(e.target.value) })}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setIsEditingRule(false)}>Cancel</Button>
                                        <Button className="bg-[#2F8E92] text-white hover:bg-[#267276]" onClick={handleEditRule}>Save Changes</Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>
                        <CardDescription className="text-slate-300">Manage rule-based escalation and sorting for inbound jobs.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="overflow-hidden rounded-[22px] border border-white/8 bg-black/10">
                            <Table>
                                <TableHeader className="bg-white/[0.04]">
                                    <TableRow>
                                        <TableHead className="w-[300px] text-slate-400">Rule & Description</TableHead>
                                        <TableHead className="text-slate-400">Target</TableHead>
                                        <TableHead className="text-slate-400">Ranking</TableHead>
                                        <TableHead className="text-center text-slate-400">Active</TableHead>
                                        <TableHead className="text-right text-slate-400">Actions</TableHead>
                                    </TableRow>

                                </TableHeader>
                                <TableBody>
                                    {priorityRules.map(rule => {
                                        const dealer = MOCK_DEALERSHIPS.find(d => d.id === rule.dealershipId);
                                        return (
                                            <TableRow key={rule.id} className="border-white/6">
                                                <TableCell className="py-3">
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold text-sm text-slate-950 dark:text-white">{rule.description}</span>
                                                        <span className="text-[10px] uppercase text-slate-400">{dealer?.name || 'Global'}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className={cn(
                                                        "font-bold text-[10px]",
                                                        rule.targetUrgency === 'CRITICAL' ? "bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800" :
                                                            rule.targetUrgency === 'HIGH' ? "bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800" :
                                                                "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800"
                                                    )}>
                                                        {rule.targetUrgency}
                                                    </Badge>
                                                </TableCell>

                                                <TableCell className="font-mono text-sm text-slate-100">+{rule.rankingScore}</TableCell>

                                                <TableCell className="text-center">
                                                    <Switch
                                                        checked={rule.isActive}
                                                        onCheckedChange={() => handleToggleRule(rule.id)}
                                                    />
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-slate-400 hover:bg-cyan-400/10 hover:text-cyan-200"
                                                        onClick={() => handleOpenEditRule(rule)}
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-slate-400 hover:bg-rose-400/10 hover:text-rose-200"
                                                        onClick={() => handleDeleteRule(rule.id)}
                                                    >
                                                        <AlertCircle className="w-4 h-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>

                <div className="space-y-6">
                <Card className={sectionCardClass}>
                    <CardHeader className={sectionHeaderClass}>
                        <CardTitle className="text-base font-semibold flex items-center gap-2 text-slate-950 dark:text-white">
                            <span className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-2 text-cyan-100">
                                <FileText className="w-4 h-4" />
                            </span>
                            Invoice Branding
                        </CardTitle>
                        <CardDescription className="text-slate-300">
                            Edit the full company profile shown on generated invoices and PDFs.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="grid sm:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="invoice_company_name" className="text-slate-200">Company Name</Label>
                                <Input
                                    id="invoice_company_name"
                                    className="border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-slate-500"
                                    value={invoiceCompany.name}
                                    onChange={(e) => setInvoiceCompany({ ...invoiceCompany, name: e.target.value })}
                                    placeholder="SM2 electronics"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="invoice_company_email" className="text-slate-200">Billing Email</Label>
                                <Input
                                    id="invoice_company_email"
                                    type="email"
                                    className="border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-slate-500"
                                    value={invoiceCompany.email}
                                    onChange={(e) => setInvoiceCompany({ ...invoiceCompany, email: e.target.value })}
                                    placeholder="billing@sm2dispatch.com"
                                />
                            </div>
                            <div className="space-y-2 sm:col-span-2">
                                <Label htmlFor="invoice_company_street" className="text-slate-200">Street Address</Label>
                                <Input
                                    id="invoice_company_street"
                                    className="border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-slate-500"
                                    value={invoiceCompany.street_address}
                                    onChange={(e) => setInvoiceCompany({ ...invoiceCompany, street_address: e.target.value })}
                                    placeholder="123 Dispatch Ave"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="invoice_company_city" className="text-slate-200">City</Label>
                                <Input
                                    id="invoice_company_city"
                                    className="border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-slate-500"
                                    value={invoiceCompany.city}
                                    onChange={(e) => setInvoiceCompany({ ...invoiceCompany, city: e.target.value })}
                                    placeholder="Quebec"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="invoice_company_state" className="text-slate-200">State / Province</Label>
                                <Input
                                    id="invoice_company_state"
                                    className="border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-slate-500"
                                    value={invoiceCompany.state}
                                    onChange={(e) => setInvoiceCompany({ ...invoiceCompany, state: e.target.value })}
                                    placeholder="QC"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="invoice_company_zip" className="text-slate-200">ZIP / Postal Code</Label>
                                <Input
                                    id="invoice_company_zip"
                                    className="border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-slate-500"
                                    value={invoiceCompany.zip_code}
                                    onChange={(e) => setInvoiceCompany({ ...invoiceCompany, zip_code: e.target.value })}
                                    placeholder="G1A 1A1"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="invoice_company_phone" className="text-slate-200">Phone</Label>
                                <Input
                                    id="invoice_company_phone"
                                    className="border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-slate-500"
                                    value={invoiceCompany.phone}
                                    onChange={(e) => setInvoiceCompany({ ...invoiceCompany, phone: e.target.value })}
                                    placeholder="+1-418-555-0100"
                                />
                            </div>
                            <div className="space-y-2 sm:col-span-2">
                                <Label htmlFor="invoice_company_website" className="text-slate-200">Website</Label>
                                <Input
                                    id="invoice_company_website"
                                    className="border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-slate-500"
                                    value={invoiceCompany.website}
                                    onChange={(e) => setInvoiceCompany({ ...invoiceCompany, website: e.target.value })}
                                    placeholder="https://www.sm2dispatch.com"
                                />
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className={sectionFooterClass}>
                        <div className="ml-auto flex items-center gap-2">
                            <Button size="sm" variant="outline" className="border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]" onClick={handleCancelInvoiceBranding} disabled={loading}>
                                Cancel
                            </Button>
                            <Button size="sm" className="bg-[#2F8E92] text-white shadow-[0_12px_30px_rgba(47,142,146,0.24)] hover:bg-[#267276]" onClick={handleSaveInvoiceBranding} disabled={loading}>
                                {loading && <RefreshCw className="w-3 h-3 mr-2 animate-spin" />}
                                {loading ? 'Saving...' : 'Save Invoice Branding'}
                            </Button>
                        </div>
                    </CardFooter>
                </Card>

                <Card className={sectionCardClass}>
                    <CardHeader className={sectionHeaderClass}>
                        <CardTitle className="text-base font-semibold flex items-center gap-2 text-slate-950 dark:text-white">
                            <span className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-2 text-cyan-100">
                                <KeyRound className="w-4 h-4" />
                            </span>
                            Admin Access
                        </CardTitle>
                        <CardDescription className="text-slate-300">
                            Update the admin sign-in email and password from one place.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="grid sm:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="admin_account_email" className="text-slate-200">Admin Email</Label>
                                <Input
                                    id="admin_account_email"
                                    type="email"
                                    className="border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-slate-500"
                                    value={adminCredentialForm.adminEmail}
                                    onChange={(e) => setAdminCredentialForm((prev) => ({ ...prev, adminEmail: e.target.value }))}
                                    autoComplete="email"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="admin_current_password" className="text-slate-200">Current Password</Label>
                                <Input
                                    id="admin_current_password"
                                    type="password"
                                    className="border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-slate-500"
                                    value={adminCredentialForm.currentPassword}
                                    onChange={(e) => setAdminCredentialForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                                    autoComplete="current-password"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="admin_new_password" className="text-slate-200">New Password (Optional)</Label>
                                <Input
                                    id="admin_new_password"
                                    type="password"
                                    className="border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-slate-500"
                                    value={adminCredentialForm.newPassword}
                                    onChange={(e) => setAdminCredentialForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                                    autoComplete="new-password"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="admin_confirm_password" className="text-slate-200">Confirm New Password</Label>
                                <Input
                                    id="admin_confirm_password"
                                    type="password"
                                    className="border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-slate-500"
                                    value={adminCredentialForm.confirmPassword}
                                    onChange={(e) => setAdminCredentialForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                                    autoComplete="new-password"
                                />
                            </div>
                        </div>
                        {adminCredentialError && (
                            <p className="mt-3 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{adminCredentialError}</p>
                        )}
                    </CardContent>
                    <CardFooter className={sectionFooterClass}>
                        <div className="ml-auto flex items-center gap-2">
                            <Button
                                size="sm"
                                variant="outline"
                                className="border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]"
                                onClick={() => {
                                    setAdminCredentialForm({
                                        ...savedAdminCredentials,
                                        currentPassword: '',
                                        newPassword: '',
                                        confirmPassword: '',
                                    });
                                    setAdminCredentialError(null);
                                }}
                                disabled={isSavingAdminCredentials}
                            >
                                Cancel
                            </Button>
                            <Button size="sm" className="bg-[#2F8E92] text-white shadow-[0_12px_30px_rgba(47,142,146,0.24)] hover:bg-[#267276]" onClick={handleSaveAdminCredentials} disabled={isSavingAdminCredentials}>
                                {isSavingAdminCredentials && <RefreshCw className="w-3 h-3 mr-2 animate-spin" />}
                                {isSavingAdminCredentials ? 'Saving...' : 'Update Admin Access'}
                            </Button>
                        </div>
                    </CardFooter>
                </Card>

                <Card className={sectionCardClass}>
                    <CardHeader className={sectionHeaderClass}>
                        <CardTitle className="text-base font-semibold flex items-center gap-2 text-slate-950 dark:text-white">
                            <span className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-2 text-cyan-100">
                                <Monitor className="w-4 h-4" />
                            </span>
                            Appearance
                        </CardTitle>
                        <CardDescription className="text-slate-600 dark:text-slate-300">Customize your interface theme.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Light Mode */}
                            <button
                                onClick={() => handleThemeChange('light')}
                                className={cn(
                                    "flex flex-col items-start rounded-[22px] border p-4 text-left transition-all",
                                    theme === 'light'
                                        ? "border-blue-300 bg-blue-50 ring-1 ring-blue-200 dark:border-cyan-300/40 dark:bg-cyan-300/10 dark:ring-cyan-300/40"
                                        : "border-slate-200 bg-white hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
                                )}
                            >
                                <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-700 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300">
                                    <Sun className="w-5 h-5" />
                                </div>
                                <span className="font-semibold text-sm text-slate-950 dark:text-white">Light Mode</span>
                                <span className="mt-1 text-xs text-slate-500 dark:text-slate-400">Standard professional light theme</span>
                            </button>

                            {/* Dark Mode */}
                            <button
                                onClick={() => handleThemeChange('dark')}
                                className={cn(
                                    "flex flex-col items-start rounded-[22px] border p-4 text-left transition-all",
                                    theme === 'dark'
                                        ? "border-blue-300 bg-blue-50 ring-1 ring-blue-200 dark:border-cyan-300/40 dark:bg-cyan-300/10 dark:ring-cyan-300/40"
                                        : "border-slate-200 bg-white hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
                                )}
                            >
                                <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-700 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300">
                                    <Moon className="w-5 h-5" />
                                </div>
                                <span className="font-semibold text-sm text-slate-950 dark:text-white">Dark Mode</span>
                                <span className="mt-1 text-xs text-slate-500 dark:text-slate-400">Reduced eye strain for low-light</span>
                            </button>

                            {/* System Mode */}
                            <button
                                onClick={() => handleThemeChange('system')}
                                className={cn(
                                    "flex flex-col items-start rounded-[22px] border p-4 text-left transition-all",
                                    theme === 'system'
                                        ? "border-blue-300 bg-blue-50 ring-1 ring-blue-200 dark:border-cyan-300/40 dark:bg-cyan-300/10 dark:ring-cyan-300/40"
                                        : "border-slate-200 bg-white hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
                                )}
                            >
                                <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-700 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300">
                                    <Monitor className="w-5 h-5" />
                                </div>
                                <span className="font-semibold text-sm text-slate-950 dark:text-white">System Default</span>
                                <span className="mt-1 text-xs text-slate-500 dark:text-slate-400">Sync with device preference</span>
                            </button>
                        </div>
                    </CardContent>
                </Card>
                </div>

            </div>
        </div>
        </div>
    );
}

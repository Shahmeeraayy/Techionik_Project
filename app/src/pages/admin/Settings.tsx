import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import {
    AlertCircle,
    Pencil,
    RefreshCw,
    KeyRound,
    UserCog,
    Moon,
    Sun,
    Monitor,
    ListFilter,
    PlusCircle,
    Building2,
    ShieldCheck,
    Bell,
    CreditCard,
    ExternalLink,
    MapPin,
    Palette,
    RotateCcw,
    Upload,
} from 'lucide-react';
import { Link } from 'react-router-dom';
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
import { Textarea } from '@/components/ui/textarea';
import {
    type InvoiceCompanyProfile,
    loadInvoiceCompanyProfile,
    saveInvoiceCompanyProfile,
} from '@/lib/invoice-company';
import {
    fetchAdminBookingPortalSettings,
    createAdminPriorityRule,
    deleteAdminPriorityRule,
    fetchAdminCredentialSettings,
    fetchAdminUsers,
    fetchAdminDealerships,
    fetchAdminTechnicians,
    fetchAdminPriorityRules,
    fetchAdminServices,
    fetchAdminInvoiceBrandingSettings,
    getStoredAdminToken,
    createAdminUser,
    updateAdminCredentialSettings,
    updateAdminUser,
    updateAdminBookingPortalSettings,
    updateAdminPriorityRule,
    updateAdminInvoiceBrandingSettings,
    type BackendBookingPortalSettings,
    type BackendAdminCredentialSettings,
    type BackendAdminUser,
    type BackendDealership,
    type BackendPriorityRule,
    type BackendServiceCatalogItem,
    type BackendTechnicianListItem,
} from '@/lib/backend-api';
import { useAuth } from '@/contexts/AuthContext';
// --- Mock Data & Types ---

type ThemeMode = 'light' | 'dark' | 'system';

type DealershipOption = {
  id: string;
  backendId: string;
  name: string;
};

type CompanyProfileSettings = {
    industryType: string;
    timezone: string;
    primaryColor: string;
    customFooterText: string;
    logoUrl?: string;
};

type NotificationPreferences = {
    jobAssignedEmail: boolean;
    jobCompletedEmail: boolean;
    invoiceReadyEmail: boolean;
    technicianSignupEmail: boolean;
    chatDigestEmail: boolean;
    technicianSmsAssignments: boolean;
    customerBookingConfirmation: boolean;
    customerCompletionSummary: boolean;
};

type BillingSubscriptionSettings = {
    planName: string;
    monthlyPrice: string;
    renewalDate: string;
    technicianLimit: number;
    locationLimit: number;
};

type BookingPortalSettingsState = {
    isEnabled: boolean;
    estimatedResponseTimeMessage: string;
    confirmationEmailBody: string;
    visibleServiceIds: string[];
    statusLookupEnabled: boolean;
    industryType: 'automotive' | 'property' | 'general';
    detailsFieldLabel: string;
};

type AdminUserState = {
    id: string;
    fullName: string;
    email: string;
    tenantRole: 'owner' | 'admin' | 'dispatcher' | 'viewer';
    status: 'active' | 'deactivated';
    lastLoginAt?: string | null;
    passwordChangedAt: string;
    createdAt: string;
    updatedAt: string;
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
const COMPANY_PROFILE_SETTINGS_STORAGE_KEY = 'sm_dispatch_company_profile_settings';
const NOTIFICATION_PREFERENCES_STORAGE_KEY = 'sm_dispatch_notification_preferences';
const BILLING_SUBSCRIPTION_STORAGE_KEY = 'sm_dispatch_billing_subscription_settings';

const DEFAULT_COMPANY_PROFILE_SETTINGS: CompanyProfileSettings = {
    industryType: 'Automotive',
    timezone: 'America/Toronto',
    primaryColor: '#4f7cff',
    customFooterText: 'Thank you for choosing SM2 electronics.',
};

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
    jobAssignedEmail: true,
    jobCompletedEmail: true,
    invoiceReadyEmail: true,
    technicianSignupEmail: true,
    chatDigestEmail: true,
    technicianSmsAssignments: true,
    customerBookingConfirmation: true,
    customerCompletionSummary: true,
};

const DEFAULT_BILLING_SUBSCRIPTION: BillingSubscriptionSettings = {
    planName: 'DispatchIQ Growth',
    monthlyPrice: '$149/mo',
    renewalDate: '2026-06-01',
    technicianLimit: 25,
    locationLimit: 50,
};

const DEFAULT_BOOKING_PORTAL_SETTINGS: BookingPortalSettingsState = {
    isEnabled: false,
    estimatedResponseTimeMessage: 'We will contact you within 2 business hours.',
    confirmationEmailBody:
        'Hello ${customer_name},\n\nThanks for contacting ${company_name}. We received your service request ${reference_number}.\n\n${estimated_response_time_message}\n\nIf you need help, reply to ${admin_contact_email}.',
    visibleServiceIds: [],
    statusLookupEnabled: false,
    industryType: 'automotive',
    detailsFieldLabel: '',
};

const mapBackendBookingPortalSettings = (row: BackendBookingPortalSettings): BookingPortalSettingsState => ({
    isEnabled: row.is_enabled,
    estimatedResponseTimeMessage: row.estimated_response_time_message,
    confirmationEmailBody: row.confirmation_email_body,
    visibleServiceIds: row.visible_service_ids,
    statusLookupEnabled: row.status_lookup_enabled,
    industryType: row.industry_type,
    detailsFieldLabel: row.details_field_label ?? '',
});

const mapBackendAdminUser = (row: BackendAdminUser): AdminUserState => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    tenantRole: row.tenant_role,
    status: row.status,
    lastLoginAt: row.last_login_at ?? null,
    passwordChangedAt: row.password_changed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
});

const loadStoredObject = <T,>(key: string, fallback: T): T => {
    if (typeof window === 'undefined') return fallback;
    try {
        const raw = window.localStorage.getItem(key);
        if (!raw) return fallback;
        return { ...fallback, ...JSON.parse(raw) } as T;
    } catch {
        return fallback;
    }
};

const saveStoredObject = <T,>(key: string, value: T): void => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(key, JSON.stringify(value));
};

const getDefaultAdminCredentialValues = () => ({
    fullName: 'Primary Admin',
    adminEmail: DEFAULT_ADMIN_EMAIL,
});

const sectionCardClass = 'overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,24,39,0.96),rgba(6,17,29,0.96))] shadow-[0_24px_80px_rgba(0,0,0,0.28)]';
const sectionHeaderClass = 'border-b border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0))] pb-5';
const sectionFooterClass = 'border-t border-white/8 bg-[rgba(255,255,255,0.03)] py-4';
const settingsPrimaryButtonClass = 'bg-[linear-gradient(135deg,#2F8E92,#38a7ae)] text-white shadow-[0_14px_34px_rgba(47,142,146,0.28)] hover:bg-[linear-gradient(135deg,#38a7ae,#4bc0c7)] hover:shadow-[0_18px_40px_rgba(56,167,174,0.34)]';
const settingsSecondaryButtonClass = 'border-cyan-300/18 bg-[linear-gradient(180deg,rgba(18,37,58,0.96),rgba(12,26,43,0.96))] text-slate-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_10px_24px_rgba(2,8,23,0.28)] hover:bg-[linear-gradient(180deg,rgba(27,49,74,0.98),rgba(17,34,56,0.98))] hover:text-white';
const settingsSwitchClass = 'h-6 w-11 border border-white/18 bg-[linear-gradient(180deg,rgba(20,31,50,0.98),rgba(12,19,32,0.98))] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_6px_14px_rgba(2,8,23,0.22)] data-[state=checked]:border-[#7dd3fc]/55 data-[state=checked]:bg-[linear-gradient(135deg,#2F8E92,#38a7ae)] data-[state=unchecked]:border-white/16 data-[state=unchecked]:bg-[linear-gradient(180deg,rgba(18,28,45,0.98),rgba(10,16,28,0.98))] [&_[data-slot=switch-thumb]]:size-[18px] [&_[data-slot=switch-thumb]]:bg-white [&_[data-slot=switch-thumb]]:shadow-[0_3px_12px_rgba(15,23,42,0.48)] [&_[data-slot=switch-thumb][data-state=checked]]:translate-x-[20px] [&_[data-slot=switch-thumb][data-state=unchecked]]:translate-x-[2px]';
const settingsDarkInputStyle: CSSProperties = {
    background: '#0b1424',
    backgroundImage: 'none',
    color: '#f8fbff',
};



export default function SettingsPage() {
    const { hasBackendAdminToken } = useAuth();
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [savedInvoiceCompany, setSavedInvoiceCompany] = useState<InvoiceCompanyProfile>(() => loadInvoiceCompanyProfile());
    const [invoiceCompany, setInvoiceCompany] = useState<InvoiceCompanyProfile>(() => loadInvoiceCompanyProfile());
    const [companyProfileSettings, setCompanyProfileSettings] = useState<CompanyProfileSettings>(() => loadStoredObject(COMPANY_PROFILE_SETTINGS_STORAGE_KEY, DEFAULT_COMPANY_PROFILE_SETTINGS));
    const [savedCompanyProfileSettings, setSavedCompanyProfileSettings] = useState<CompanyProfileSettings>(() => loadStoredObject(COMPANY_PROFILE_SETTINGS_STORAGE_KEY, DEFAULT_COMPANY_PROFILE_SETTINGS));
    const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>(() => loadStoredObject(NOTIFICATION_PREFERENCES_STORAGE_KEY, DEFAULT_NOTIFICATION_PREFERENCES));
    const [billingSubscription, setBillingSubscription] = useState<BillingSubscriptionSettings>(() => loadStoredObject(BILLING_SUBSCRIPTION_STORAGE_KEY, DEFAULT_BILLING_SUBSCRIPTION));
    const [bookingPortalSettings, setBookingPortalSettings] = useState<BookingPortalSettingsState>(DEFAULT_BOOKING_PORTAL_SETTINGS);
    const [savedBookingPortalSettings, setSavedBookingPortalSettings] = useState<BookingPortalSettingsState>(DEFAULT_BOOKING_PORTAL_SETTINGS);
    const [priorityRules, setPriorityRules] = useState<PriorityRule[]>([]);
    const [dealershipOptions, setDealershipOptions] = useState<DealershipOption[]>([]);
    const [technicianCount, setTechnicianCount] = useState(0);
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
    const [adminUsers, setAdminUsers] = useState<AdminUserState[]>([]);
    const [newAdminUserForm, setNewAdminUserForm] = useState({
        fullName: '',
        email: '',
        password: '',
        tenantRole: 'admin' as 'owner' | 'admin' | 'dispatcher' | 'viewer',
    });
    const [newAdminUserError, setNewAdminUserError] = useState<string | null>(null);
    const [isSavingNewAdminUser, setIsSavingNewAdminUser] = useState(false);
    const [editingAdminUserId, setEditingAdminUserId] = useState<string | null>(null);
    const [adminCredentialError, setAdminCredentialError] = useState<string | null>(null);
    const [isSavingAdminCredentials, setIsSavingAdminCredentials] = useState(false);
    const [isSavingBookingPortalSettings, setIsSavingBookingPortalSettings] = useState(false);
    const [bookingServiceSearch, setBookingServiceSearch] = useState('');
    const MOCK_DEALERSHIPS = dealershipOptions.length > 0 ? dealershipOptions : FALLBACK_DEALERSHIPS;
    const activeRules = priorityRules.filter((rule) => rule.isActive);
    const previewJobs = [
        { id: 'Sample Critical', urgency: 'CRITICAL', base: 50 },
        { id: 'Sample High', urgency: 'HIGH', base: 35 },
        { id: 'Sample Medium', urgency: 'MEDIUM', base: 20 },
    ].map((job) => ({
        ...job,
        score: job.base + activeRules.reduce((sum, rule) => sum + (rule.targetUrgency === job.urgency ? rule.rankingScore : 0), 0),
    })).sort((a, b) => b.score - a.score);
    const filteredBookingServiceOptions = serviceOptions.filter((service) =>
        service.name.toLowerCase().includes(bookingServiceSearch.trim().toLowerCase())
    );

    const { theme, setTheme } = useTheme();
    const refreshSettingsData = useCallback(async () => {
        const localProfile = loadInvoiceCompanyProfile();
        setSavedInvoiceCompany(localProfile);
        setInvoiceCompany(localProfile);
        const storedCompanyProfile = loadStoredObject(COMPANY_PROFILE_SETTINGS_STORAGE_KEY, DEFAULT_COMPANY_PROFILE_SETTINGS);
        setSavedCompanyProfileSettings(storedCompanyProfile);
        setCompanyProfileSettings(storedCompanyProfile);
        setNotificationPreferences(loadStoredObject(NOTIFICATION_PREFERENCES_STORAGE_KEY, DEFAULT_NOTIFICATION_PREFERENCES));
        setBillingSubscription(loadStoredObject(BILLING_SUBSCRIPTION_STORAGE_KEY, DEFAULT_BILLING_SUBSCRIPTION));

        const adminToken = getStoredAdminToken();
        if (!hasBackendAdminToken || !adminToken) {
            const fallbackValues = getDefaultAdminCredentialValues();
            setSavedAdminCredentials(fallbackValues);
            setAdminCredentialForm((prev) => ({
                ...prev,
                ...fallbackValues,
            }));
            setDealershipOptions([]);
            setTechnicianCount(0);
            setServiceOptions([]);
            setPriorityRules([]);
            setAdminUsers([]);
            setBookingPortalSettings(DEFAULT_BOOKING_PORTAL_SETTINGS);
            setSavedBookingPortalSettings(DEFAULT_BOOKING_PORTAL_SETTINGS);
            return;
        }

        setRefreshing(true);
        try {
            const [
                brandingResult,
                credentialsResult,
                adminUsersResult,
                dealershipsResult,
                techniciansResult,
                servicesResult,
                rulesResult,
                bookingPortalResult,
            ] = await Promise.allSettled([
                fetchAdminInvoiceBrandingSettings(adminToken),
                fetchAdminCredentialSettings(adminToken),
                fetchAdminUsers(adminToken),
                fetchAdminDealerships(adminToken),
                fetchAdminTechnicians(adminToken),
                fetchAdminServices(adminToken, true),
                fetchAdminPriorityRules(adminToken),
                fetchAdminBookingPortalSettings(adminToken),
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
                    fullName: credentialsResult.value.full_name,
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

            if (adminUsersResult.status === 'fulfilled') {
                setAdminUsers(adminUsersResult.value.map(mapBackendAdminUser));
            } else {
                setAdminUsers([]);
            }

            if (techniciansResult.status === 'fulfilled') {
                setTechnicianCount((techniciansResult.value as BackendTechnicianListItem[]).length);
            } else {
                setTechnicianCount(0);
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

            if (bookingPortalResult.status === 'fulfilled') {
                const nextBookingPortalSettings = mapBackendBookingPortalSettings(bookingPortalResult.value);
                setBookingPortalSettings(nextBookingPortalSettings);
                setSavedBookingPortalSettings(nextBookingPortalSettings);
            } else {
                setBookingPortalSettings(DEFAULT_BOOKING_PORTAL_SETTINGS);
                setSavedBookingPortalSettings(DEFAULT_BOOKING_PORTAL_SETTINGS);
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

    const handleSaveCompanyProfile = async () => {
        const normalizedCompanyProfileSettings: CompanyProfileSettings = {
            ...companyProfileSettings,
            industryType: companyProfileSettings.industryType.trim() || DEFAULT_COMPANY_PROFILE_SETTINGS.industryType,
            timezone: companyProfileSettings.timezone.trim() || DEFAULT_COMPANY_PROFILE_SETTINGS.timezone,
            primaryColor: companyProfileSettings.primaryColor.trim() || DEFAULT_COMPANY_PROFILE_SETTINGS.primaryColor,
            customFooterText: companyProfileSettings.customFooterText.trim(),
            logoUrl: companyProfileSettings.logoUrl?.trim() || undefined,
        };
        saveStoredObject(COMPANY_PROFILE_SETTINGS_STORAGE_KEY, normalizedCompanyProfileSettings);
        setSavedCompanyProfileSettings(normalizedCompanyProfileSettings);
        setCompanyProfileSettings(normalizedCompanyProfileSettings);
        await saveInvoiceBrandingSettings("Company profile and invoice branding saved successfully.");
    };

    const handleLogoUpload = (file?: File) => {
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            alert('Please upload an image file for the logo.');
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            const logoUrl = typeof reader.result === 'string' ? reader.result : undefined;
            setCompanyProfileSettings((prev) => ({ ...prev, logoUrl }));
            setInvoiceCompany((prev) => ({ ...prev, logo_url: logoUrl }));
        };
        reader.readAsDataURL(file);
    };

    const handleSaveNotificationPreferences = () => {
        saveStoredObject(NOTIFICATION_PREFERENCES_STORAGE_KEY, notificationPreferences);
        alert('Notification preferences saved successfully.');
    };

    const handleSaveBillingSubscription = () => {
        saveStoredObject(BILLING_SUBSCRIPTION_STORAGE_KEY, billingSubscription);
        alert('Billing subscription settings saved locally.');
    };

    const handleSaveBookingPortalSettings = async () => {
        const adminToken = getStoredAdminToken();
        if (!hasBackendAdminToken || !adminToken) {
            alert('Admin session is required to save booking portal settings.');
            return;
        }

        if (!bookingPortalSettings.estimatedResponseTimeMessage.trim()) {
            alert('Estimated response time message is required.');
            return;
        }
        if (!bookingPortalSettings.confirmationEmailBody.trim()) {
            alert('Confirmation email body is required.');
            return;
        }

        setIsSavingBookingPortalSettings(true);
        try {
            const saved = await updateAdminBookingPortalSettings(adminToken, {
                is_enabled: bookingPortalSettings.isEnabled,
                estimated_response_time_message: bookingPortalSettings.estimatedResponseTimeMessage.trim(),
                confirmation_email_body: bookingPortalSettings.confirmationEmailBody.trim(),
                visible_service_ids: bookingPortalSettings.visibleServiceIds,
                status_lookup_enabled: bookingPortalSettings.statusLookupEnabled,
                industry_type: bookingPortalSettings.industryType,
                details_field_label: bookingPortalSettings.detailsFieldLabel.trim() || null,
            });
            const next = mapBackendBookingPortalSettings(saved);
            setBookingPortalSettings(next);
            setSavedBookingPortalSettings(next);
            alert('Booking portal settings saved successfully.');
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Unable to save booking portal settings.');
        } finally {
            setIsSavingBookingPortalSettings(false);
        }
    };

    const handleResetPriorityRules = () => {
        setNewRule(getDefaultNewRule());
        alert('Default rule template restored. Existing saved rules were not removed.');
    };

    const handleSaveAdminCredentials = async () => {
        const adminToken = getStoredAdminToken();
        if (!hasBackendAdminToken || !adminToken) {
            setAdminCredentialError('Admin session is required to update access settings.');
            return;
        }

        setAdminCredentialError(null);
        const fullName = adminCredentialForm.fullName.trim();
        const adminEmail = adminCredentialForm.adminEmail.trim().toLowerCase();
        const currentPassword = adminCredentialForm.currentPassword.trim();
        const newPassword = adminCredentialForm.newPassword.trim();
        const confirmPassword = adminCredentialForm.confirmPassword.trim();

        if (!fullName || !adminEmail || !currentPassword) {
            setAdminCredentialError('Admin name, email, and current password are required.');
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
                full_name: fullName,
                admin_email: adminEmail,
                current_password: currentPassword,
                new_password: newPassword || undefined,
            });
            const nextValues = {
                fullName: updated.full_name,
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

    const handleCreateAdminUser = async () => {
        const adminToken = getStoredAdminToken();
        if (!hasBackendAdminToken || !adminToken) {
            setNewAdminUserError('Admin session is required to create admin users.');
            return;
        }

        const fullName = newAdminUserForm.fullName.trim();
        const email = newAdminUserForm.email.trim().toLowerCase();
        const password = newAdminUserForm.password.trim();
        if (!fullName || !email || !password) {
            setNewAdminUserError('Name, email, and password are required.');
            return;
        }

        setNewAdminUserError(null);
        setIsSavingNewAdminUser(true);
        try {
            const created = await createAdminUser(adminToken, {
                full_name: fullName,
                email,
                password,
                tenant_role: newAdminUserForm.tenantRole,
            });
            setAdminUsers((prev) => [...prev, mapBackendAdminUser(created)]);
            setNewAdminUserForm({
                fullName: '',
                email: '',
                password: '',
                tenantRole: 'admin',
            });
            alert('Admin user created successfully.');
        } catch (error) {
            setNewAdminUserError(error instanceof Error ? error.message : 'Unable to create admin user.');
        } finally {
            setIsSavingNewAdminUser(false);
        }
    };

    const handleToggleAdminUserStatus = async (adminUser: AdminUserState) => {
        const adminToken = getStoredAdminToken();
        if (!hasBackendAdminToken || !adminToken) {
            alert('Admin session is required to update admin users.');
            return;
        }

        try {
            const updated = await updateAdminUser(adminToken, adminUser.id, {
                status: adminUser.status === 'active' ? 'deactivated' : 'active',
            });
            setAdminUsers((prev) => prev.map((row) => row.id === adminUser.id ? mapBackendAdminUser(updated) : row));
            if (adminUser.id === editingAdminUserId) {
                setEditingAdminUserId(null);
            }
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Unable to update admin user.');
        }
    };

    const handlePromoteAdminUser = async (adminUser: AdminUserState, nextRole: AdminUserState['tenantRole']) => {
        const adminToken = getStoredAdminToken();
        if (!hasBackendAdminToken || !adminToken) {
            alert('Admin session is required to update admin roles.');
            return;
        }
        try {
            const updated = await updateAdminUser(adminToken, adminUser.id, {
                tenant_role: nextRole,
            });
            setAdminUsers((prev) => prev.map((row) => row.id === adminUser.id ? mapBackendAdminUser(updated) : row));
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Unable to update admin role.');
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
                                className={cn('h-10 gap-2 rounded-full px-4', settingsSecondaryButtonClass)}
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

                <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                    <Card className={sectionCardClass}>
                        <CardHeader className={sectionHeaderClass}>
                            <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-950 dark:text-white">
                                <span className="rounded-xl border border-blue-200 bg-blue-50 p-2 text-blue-700 dark:border-cyan-300/20 dark:bg-cyan-300/10 dark:text-cyan-100">
                                    <Palette className="h-4 w-4" />
                                </span>
                                Company Profile & Branding
                            </CardTitle>
                            <CardDescription className="text-slate-600 dark:text-slate-300">
                                Controls the tenant identity used in portals, PDF invoices, and branded UI elements.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-5 pt-0">
                            <div className="grid gap-4 md:grid-cols-[180px_1fr]">
                                <div className="rounded-[24px] border border-white/10 bg-[rgba(255,255,255,0.03)] p-4">
                                    <div className="flex h-24 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-white/12 bg-black/20">
                                        {companyProfileSettings.logoUrl || invoiceCompany.logo_url ? (
                                            <img src={companyProfileSettings.logoUrl || invoiceCompany.logo_url} alt="Company logo preview" className="max-h-full max-w-full object-contain" />
                                        ) : (
                                            <Upload className="h-7 w-7 text-slate-400" />
                                        )}
                                    </div>
                                    <Label htmlFor="company_logo_upload" className={cn('mt-3 flex h-9 cursor-pointer items-center justify-center rounded-full border text-xs font-semibold transition-colors', settingsSecondaryButtonClass)}>
                                        Upload logo
                                    </Label>
                                    <Input id="company_logo_upload" type="file" accept="image/*" className="hidden" onChange={(event) => handleLogoUpload(event.target.files?.[0])} />
                                </div>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label className="text-slate-700 dark:text-slate-200">Company Name</Label>
                                        <Input style={settingsDarkInputStyle} className="border-white/10 text-white placeholder:text-slate-500" value={invoiceCompany.name} onChange={(e) => setInvoiceCompany({ ...invoiceCompany, name: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-slate-700 dark:text-slate-200">Industry Type</Label>
                                        <Select value={companyProfileSettings.industryType} onValueChange={(value) => setCompanyProfileSettings((prev) => ({ ...prev, industryType: value }))}>
                                            <SelectTrigger className="border-white/10 bg-[#0b1424] text-white">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Automotive">Automotive</SelectItem>
                                                <SelectItem value="HVAC">HVAC</SelectItem>
                                                <SelectItem value="Appliance Repair">Appliance Repair</SelectItem>
                                                <SelectItem value="General Field Service">General Field Service</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-slate-700 dark:text-slate-200">Timezone</Label>
                                        <Select value={companyProfileSettings.timezone} onValueChange={(value) => setCompanyProfileSettings((prev) => ({ ...prev, timezone: value }))}>
                                            <SelectTrigger className="border-white/10 bg-[#0b1424] text-white">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="America/Toronto">America/Toronto</SelectItem>
                                                <SelectItem value="America/New_York">America/New_York</SelectItem>
                                                <SelectItem value="America/Chicago">America/Chicago</SelectItem>
                                                <SelectItem value="America/Los_Angeles">America/Los_Angeles</SelectItem>
                                                <SelectItem value="Asia/Karachi">Asia/Karachi</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-slate-700 dark:text-slate-200">Primary Colour</Label>
                                        <div className="flex gap-2">
                                            <Input type="color" style={settingsDarkInputStyle} className="h-10 w-14 border-white/10 p-1" value={companyProfileSettings.primaryColor} onChange={(e) => setCompanyProfileSettings((prev) => ({ ...prev, primaryColor: e.target.value }))} />
                                            <Input style={settingsDarkInputStyle} className="border-white/10 text-white placeholder:text-slate-500" value={companyProfileSettings.primaryColor} onChange={(e) => setCompanyProfileSettings((prev) => ({ ...prev, primaryColor: e.target.value }))} />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-slate-700 dark:text-slate-200">Contact Email</Label>
                                        <Input style={settingsDarkInputStyle} className="border-white/10 text-white placeholder:text-slate-500" value={invoiceCompany.email} onChange={(e) => setInvoiceCompany({ ...invoiceCompany, email: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-slate-700 dark:text-slate-200">Contact Phone</Label>
                                        <Input style={settingsDarkInputStyle} className="border-white/10 text-white placeholder:text-slate-500" value={invoiceCompany.phone} onChange={(e) => setInvoiceCompany({ ...invoiceCompany, phone: e.target.value })} />
                                    </div>
                                    <div className="space-y-2 sm:col-span-2">
                                        <Label className="text-slate-700 dark:text-slate-200">PDF Footer Text</Label>
                                        <Textarea style={settingsDarkInputStyle} className="min-h-20 border-white/10 text-white placeholder:text-slate-500" value={companyProfileSettings.customFooterText} onChange={(e) => setCompanyProfileSettings((prev) => ({ ...prev, customFooterText: e.target.value }))} />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className={sectionFooterClass}>
                            <Button size="sm" className={cn('ml-auto', settingsPrimaryButtonClass)} onClick={handleSaveCompanyProfile} disabled={loading}>
                                {loading && <RefreshCw className="mr-2 h-3 w-3 animate-spin" />}
                                Save Company Profile
                            </Button>
                        </CardFooter>
                    </Card>

                    <div className="space-y-6">
                        <Card className={sectionCardClass}>
                            <CardHeader className={sectionHeaderClass}>
                                <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-950 dark:text-white">
                                    <span className="rounded-xl border border-emerald-200 bg-emerald-50 p-2 text-emerald-700 dark:border-emerald-300/20 dark:bg-emerald-300/10 dark:text-emerald-100">
                                        <MapPin className="h-4 w-4" />
                                    </span>
                                    Locations / Dealerships
                                </CardTitle>
                                <CardDescription className="text-slate-600 dark:text-slate-300">Jump to centralized location management.</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                                    <div className="text-2xl font-semibold text-slate-950 dark:text-white">{dealershipOptions.length}</div>
                                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Active location records available for jobs and reports.</p>
                                    <Button asChild size="sm" variant="outline" className="mt-4 rounded-full border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100">
                                        <Link to="/admin/locations">
                                            Open Locations
                                            <ExternalLink className="ml-2 h-3.5 w-3.5" />
                                        </Link>
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className={sectionCardClass}>
                            <CardHeader className={sectionHeaderClass}>
                                <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-950 dark:text-white">
                                    <span className="rounded-xl border border-amber-200 bg-amber-50 p-2 text-amber-700 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-100">
                                        <CreditCard className="h-4 w-4" />
                                    </span>
                                    Billing & Subscription
                                </CardTitle>
                                <CardDescription className="text-slate-600 dark:text-slate-300">Plan, limits, renewal, and billing portal access.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4 pt-0">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Current Plan</p>
                                        <p className="mt-2 font-semibold text-slate-950 dark:text-white">{billingSubscription.planName}</p>
                                        <p className="text-xs text-slate-500">{billingSubscription.monthlyPrice}</p>
                                    </div>
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Renewal</p>
                                        <Input type="date" className="mt-2 h-9 border-slate-200 bg-white text-slate-900 dark:border-white/10 dark:bg-white/[0.04] dark:text-white" value={billingSubscription.renewalDate} onChange={(e) => setBillingSubscription((prev) => ({ ...prev, renewalDate: e.target.value }))} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-white/[0.03]">
                                        <p className="text-slate-500">Technicians</p>
                                        <p className="font-semibold text-slate-950 dark:text-white">{technicianCount} / {billingSubscription.technicianLimit}</p>
                                    </div>
                                    <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-white/[0.03]">
                                        <p className="text-slate-500">Locations</p>
                                        <p className="font-semibold text-slate-950 dark:text-white">{dealershipOptions.length} / {billingSubscription.locationLimit}</p>
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className={sectionFooterClass}>
                                <div className="ml-auto flex gap-2">
                                    <Button size="sm" variant="outline" className="border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100" onClick={handleSaveBillingSubscription}>
                                        Save Billing View
                                    </Button>
                                    <Button size="sm" className="bg-slate-950 text-white hover:bg-slate-800 dark:bg-[#2F8E92] dark:hover:bg-[#267276]">
                                        Stripe Portal
                                        <ExternalLink className="ml-2 h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </CardFooter>
                        </Card>
                    </div>
                </div>

                <Card className={sectionCardClass}>
                    <CardHeader className={sectionHeaderClass}>
                        <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-950 dark:text-white">
                            <span className="rounded-xl border border-rose-200 bg-rose-50 p-2 text-rose-700 dark:border-rose-300/20 dark:bg-rose-300/10 dark:text-rose-100">
                                <Bell className="h-4 w-4" />
                            </span>
                            Notification Preferences
                        </CardTitle>
                        <CardDescription className="text-slate-600 dark:text-slate-300">
                            Configure admin, technician, customer, SMS, and chat digest notification behavior.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3 pt-0 md:grid-cols-2 xl:grid-cols-4">
                        {[
                            ['jobAssignedEmail', 'Job assigned email', 'Admin alert when a technician is assigned.'],
                            ['jobCompletedEmail', 'Job completed email', 'Admin alert when a job is completed.'],
                            ['invoiceReadyEmail', 'Invoice ready email', 'Admin alert when an invoice draft is ready.'],
                            ['technicianSignupEmail', 'Technician signup email', 'Admin alert for new technician signup.'],
                            ['chatDigestEmail', 'New chat digest', 'Email digest if unread for 30 minutes.'],
                            ['technicianSmsAssignments', 'SMS job assignment', 'SMS alert to technicians for assigned jobs.'],
                            ['customerBookingConfirmation', 'Booking confirmation', 'Customer booking confirmation email.'],
                            ['customerCompletionSummary', 'Completion summary', 'Customer job completion summary email.'],
                        ].map(([key, title, description]) => (
                            <div key={key} className="flex items-start justify-between gap-3 rounded-[20px] border border-white/10 bg-[linear-gradient(180deg,rgba(13,24,40,0.82),rgba(8,17,29,0.86))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors hover:border-cyan-300/20 hover:bg-[linear-gradient(180deg,rgba(15,29,48,0.9),rgba(9,19,33,0.92))]">
                                <div>
                                    <p className="font-semibold text-slate-950 dark:text-white">{title}</p>
                                    <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</p>
                                </div>
                                <Switch
                                    checked={notificationPreferences[key as keyof NotificationPreferences]}
                                    onCheckedChange={(checked) => setNotificationPreferences((prev) => ({ ...prev, [key]: checked }))}
                                    className={settingsSwitchClass}
                                />
                            </div>
                        ))}
                    </CardContent>
                    <CardFooter className={sectionFooterClass}>
                        <Button size="sm" className="ml-auto bg-slate-950 text-white hover:bg-slate-800 dark:bg-[#2F8E92] dark:hover:bg-[#267276]" onClick={handleSaveNotificationPreferences}>
                            Save Notifications
                        </Button>
                    </CardFooter>
                </Card>

                <Card className={sectionCardClass}>
                    <CardHeader className={sectionHeaderClass}>
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-950 dark:text-white">
                                    <span className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-2 text-cyan-100">
                                        <ExternalLink className="h-4 w-4" />
                                    </span>
                                    Customer Booking Portal
                                </CardTitle>
                                <CardDescription className="text-slate-600 dark:text-slate-300">
                                    Control the public booking experience, visible services, customer confirmation copy, and status lookup behavior.
                                </CardDescription>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    asChild
                                    size="sm"
                                    variant="outline"
                                    className={settingsSecondaryButtonClass}
                                >
                                    <Link to="/book" target="_blank" rel="noreferrer">
                                        Open Booking Form
                                        <ExternalLink className="ml-2 h-3.5 w-3.5" />
                                    </Link>
                                </Button>
                                <Button
                                    asChild
                                    size="sm"
                                    variant="outline"
                                    className={settingsSecondaryButtonClass}
                                >
                                    <Link to="/book/status" target="_blank" rel="noreferrer">
                                        Open Status Lookup
                                        <ExternalLink className="ml-2 h-3.5 w-3.5" />
                                    </Link>
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="grid gap-5 pt-0 xl:grid-cols-[1fr_1fr]">
                        <div className="space-y-5">
                            <div className="flex items-center justify-between rounded-[22px] border border-white/10 bg-[rgba(255,255,255,0.03)] p-4">
                                <div>
                                    <p className="font-semibold text-slate-950 dark:text-white">Booking portal enabled</p>
                                    <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Allow public customers to submit service requests from the branded booking page.</p>
                                </div>
                                <Switch
                                    checked={bookingPortalSettings.isEnabled}
                                    onCheckedChange={(checked) => setBookingPortalSettings((prev) => ({ ...prev, isEnabled: checked }))}
                                    className={settingsSwitchClass}
                                />
                            </div>
                            <div className="flex items-center justify-between rounded-[22px] border border-white/10 bg-[rgba(255,255,255,0.03)] p-4">
                                <div>
                                    <p className="font-semibold text-slate-950 dark:text-white">Status lookup page</p>
                                    <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Let customers check status with reference number and email.</p>
                                </div>
                                <Switch
                                    checked={bookingPortalSettings.statusLookupEnabled}
                                    onCheckedChange={(checked) => setBookingPortalSettings((prev) => ({ ...prev, statusLookupEnabled: checked }))}
                                    className={settingsSwitchClass}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-slate-700 dark:text-slate-200">Industry type</Label>
                                <Select value={bookingPortalSettings.industryType} onValueChange={(value) => setBookingPortalSettings((prev) => ({ ...prev, industryType: value as BookingPortalSettingsState['industryType'] }))}>
                                    <SelectTrigger className="border-white/10 bg-white/[0.04] text-white">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="automotive">Automotive</SelectItem>
                                        <SelectItem value="property">Property</SelectItem>
                                        <SelectItem value="general">General field service</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-slate-700 dark:text-slate-200">Details field label override</Label>
                                <Input
                                    style={settingsDarkInputStyle}
                                    className="border-white/10 text-white placeholder:text-slate-500"
                                    placeholder="Leave blank to use the industry default"
                                    value={bookingPortalSettings.detailsFieldLabel}
                                    onChange={(e) => setBookingPortalSettings((prev) => ({ ...prev, detailsFieldLabel: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-slate-700 dark:text-slate-200">Estimated response time message</Label>
                                <Input
                                    style={settingsDarkInputStyle}
                                    className="border-white/10 text-white placeholder:text-slate-500"
                                    value={bookingPortalSettings.estimatedResponseTimeMessage}
                                    onChange={(e) => setBookingPortalSettings((prev) => ({ ...prev, estimatedResponseTimeMessage: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div className="space-y-5">
                            <div className="space-y-2">
                                <Label className="text-slate-700 dark:text-slate-200">Confirmation email body</Label>
                                <Textarea
                                    style={settingsDarkInputStyle}
                                    className="min-h-[180px] border-white/10 text-white placeholder:text-slate-500"
                                    value={bookingPortalSettings.confirmationEmailBody}
                                    onChange={(e) => setBookingPortalSettings((prev) => ({ ...prev, confirmationEmailBody: e.target.value }))}
                                />
                                <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                                    Supported placeholders: <code>${'{customer_name}'}</code>, <code>${'{company_name}'}</code>, <code>${'{reference_number}'}</code>, <code>${'{estimated_response_time_message}'}</code>, <code>${'{admin_contact_email}'}</code>
                                </p>
                            </div>
                            <div className="space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <Label className="text-slate-700 dark:text-slate-200">Visible service types</Label>
                                    <Badge variant="outline" className="border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
                                        {bookingPortalSettings.visibleServiceIds.length} selected
                                    </Badge>
                                </div>
                                <Input
                                    style={settingsDarkInputStyle}
                                    className="border-white/10 text-white placeholder:text-slate-500"
                                    placeholder="Search services..."
                                    value={bookingServiceSearch}
                                    onChange={(e) => setBookingServiceSearch(e.target.value)}
                                />
                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className={settingsSecondaryButtonClass}
                                        onClick={() => setBookingPortalSettings((prev) => ({
                                            ...prev,
                                            visibleServiceIds: serviceOptions.map((service) => service.id),
                                        }))}
                                    >
                                        Select all
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className={settingsSecondaryButtonClass}
                                        onClick={() => setBookingPortalSettings((prev) => ({ ...prev, visibleServiceIds: [] }))}
                                    >
                                        Clear
                                    </Button>
                                </div>
                                <div className="max-h-[360px] overflow-y-auto rounded-[22px] border border-white/10 bg-[rgba(255,255,255,0.03)] p-3">
                                    <div className="grid gap-3 sm:grid-cols-2">
                                    {filteredBookingServiceOptions.map((service) => {
                                        const checked = bookingPortalSettings.visibleServiceIds.includes(service.id);
                                        return (
                                            <label key={service.id} className="flex items-center justify-between rounded-[18px] border border-white/10 bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-slate-200">
                                                <span>{service.name}</span>
                                                <Switch
                                                    checked={checked}
                                                    onCheckedChange={(nextChecked) => setBookingPortalSettings((prev) => ({
                                                        ...prev,
                                                        visibleServiceIds: nextChecked
                                                            ? [...prev.visibleServiceIds, service.id]
                                                            : prev.visibleServiceIds.filter((item) => item !== service.id),
                                                    }))}
                                                    className={settingsSwitchClass}
                                                />
                                            </label>
                                        );
                                    })}
                                    </div>
                                    {filteredBookingServiceOptions.length === 0 ? (
                                        <div className="px-2 py-6 text-sm text-slate-400">No services match this search.</div>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className={sectionFooterClass}>
                        <div className="ml-auto flex items-center gap-2">
                            <Button
                                size="sm"
                                variant="outline"
                                className={settingsSecondaryButtonClass}
                                onClick={() => setBookingPortalSettings(savedBookingPortalSettings)}
                                disabled={isSavingBookingPortalSettings}
                            >
                                Reset
                            </Button>
                            <Button
                                size="sm"
                                className={settingsPrimaryButtonClass}
                                onClick={handleSaveBookingPortalSettings}
                                disabled={isSavingBookingPortalSettings}
                            >
                                {isSavingBookingPortalSettings ? 'Saving...' : 'Save Booking Portal'}
                            </Button>
                        </div>
                    </CardFooter>
                </Card>

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
                        <CardDescription className="text-slate-600 dark:text-slate-300">Manage rule-based escalation and sorting for inbound jobs. Active rule weights stack into each job ranking score.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="mb-5 grid gap-3">
                            <div className="rounded-[22px] border border-white/10 bg-[rgba(255,255,255,0.03)] p-4">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Live Preview</p>
                                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Sample jobs re-ranked by current active urgency weights.</p>
                                    </div>
                                    <Button size="sm" variant="outline" className={cn('rounded-full', settingsSecondaryButtonClass)} onClick={handleResetPriorityRules}>
                                        <RotateCcw className="mr-2 h-3.5 w-3.5" />
                                        Reset to defaults
                                    </Button>
                                </div>
                                <div className="mt-4 grid gap-3 md:grid-cols-3">
                                    {previewJobs.map((job, index) => (
                                        <div key={job.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <span className="max-w-[140px] text-sm font-semibold leading-5 text-slate-950 dark:text-white">{index + 1}. {job.id}</span>
                                                <Badge variant="outline" className="shrink-0 border-cyan-300/20 bg-cyan-300/10 text-cyan-100">Score {job.score}</Badge>
                                            </div>
                                            <p className="mt-3 text-xs leading-5 text-slate-500">Base {job.base} + active {job.urgency.toLowerCase()} rules</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="rounded-[22px] border border-white/10 bg-[rgba(255,255,255,0.03)] p-4 text-sm">
                                <p className="font-semibold text-slate-950 dark:text-white">Rule attributes</p>
                                <p className="mt-2 leading-6 text-slate-600 dark:text-slate-300">
                                    Urgency, location zone, service type, technician skill match, and time since job creation are supported by the rule model and dispatch scoring surface.
                                </p>
                            </div>
                        </div>
                        <div className="overflow-hidden rounded-[22px] border border-white/8 bg-black/10 shadow-sm">
                            <Table>
                                <TableHeader className="bg-[rgba(255,255,255,0.04)]">
                                    <TableRow>
                                        <TableHead className="w-[300px] text-slate-500 dark:text-slate-400">Rule & Description</TableHead>
                                        <TableHead className="text-slate-500 dark:text-slate-400">Target</TableHead>
                                        <TableHead className="text-slate-500 dark:text-slate-400">Ranking</TableHead>
                                        <TableHead className="text-center text-slate-500 dark:text-slate-400">Active</TableHead>
                                        <TableHead className="text-right text-slate-500 dark:text-slate-400">Actions</TableHead>
                                    </TableRow>

                                </TableHeader>
                                <TableBody>
                                    {priorityRules.map(rule => {
                                        const dealer = MOCK_DEALERSHIPS.find(d => d.id === rule.dealershipId);
                                        return (
                                            <TableRow key={rule.id} className="border-slate-100 dark:border-white/6">
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

                                                <TableCell className="font-mono text-sm text-slate-700 dark:text-slate-100">+{rule.rankingScore}</TableCell>

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
                                <KeyRound className="w-4 h-4" />
                            </span>
                            Admin Access
                        </CardTitle>
                        <CardDescription className="text-slate-600 dark:text-slate-300">
                            Manage multiple tenant admins and update your own sign-in credentials.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="rounded-[22px] border border-white/10 bg-[rgba(255,255,255,0.03)] p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Admin Team</p>
                                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Invite more admins, dispatchers, or viewers under this tenant.</p>
                                </div>
                                <Badge variant="outline" className="border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
                                    {adminUsers.length} active records
                                </Badge>
                            </div>

                            <div className="mt-4 overflow-hidden rounded-[20px] border border-white/8 bg-black/10">
                                <Table>
                                    <TableHeader className="bg-[rgba(255,255,255,0.04)]">
                                        <TableRow>
                                            <TableHead className="text-slate-500 dark:text-slate-400">Name</TableHead>
                                            <TableHead className="text-slate-500 dark:text-slate-400">Email</TableHead>
                                            <TableHead className="text-slate-500 dark:text-slate-400">Role</TableHead>
                                            <TableHead className="text-slate-500 dark:text-slate-400">Status</TableHead>
                                            <TableHead className="text-right text-slate-500 dark:text-slate-400">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {adminUsers.map((adminUser) => (
                                            <TableRow key={adminUser.id} className="border-white/6">
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold text-slate-950 dark:text-white">{adminUser.fullName}</span>
                                                        <span className="text-xs text-slate-500 dark:text-slate-400">
                                                            {adminUser.lastLoginAt ? `Last login ${new Date(adminUser.lastLoginAt).toLocaleString()}` : 'No login recorded'}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-slate-700 dark:text-slate-200">{adminUser.email}</TableCell>
                                                <TableCell>
                                                    <Select
                                                        value={adminUser.tenantRole}
                                                        onValueChange={(value) => handlePromoteAdminUser(adminUser, value as AdminUserState['tenantRole'])}
                                                    >
                                                        <SelectTrigger className="h-9 border-white/10 bg-[#0b1424] text-white">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="owner">Owner</SelectItem>
                                                            <SelectItem value="admin">Admin</SelectItem>
                                                            <SelectItem value="dispatcher">Dispatcher</SelectItem>
                                                            <SelectItem value="viewer">Viewer</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant="outline"
                                                        className={cn(
                                                            adminUser.status === 'active'
                                                                ? 'border-emerald-300/20 bg-emerald-400/10 text-emerald-100'
                                                                : 'border-rose-300/20 bg-rose-400/10 text-rose-100',
                                                        )}
                                                    >
                                                        {adminUser.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className={settingsSecondaryButtonClass}
                                                        onClick={() => handleToggleAdminUserStatus(adminUser)}
                                                    >
                                                        {adminUser.status === 'active' ? 'Deactivate' : 'Activate'}
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            <div className="mt-5 grid gap-4 md:grid-cols-4">
                                <div className="space-y-2 md:col-span-1">
                                    <Label className="text-slate-700 dark:text-slate-200">Full Name</Label>
                                    <Input
                                        style={settingsDarkInputStyle}
                                        className="border-white/10 text-white placeholder:text-slate-500"
                                        value={newAdminUserForm.fullName}
                                        onChange={(e) => setNewAdminUserForm((prev) => ({ ...prev, fullName: e.target.value }))}
                                        placeholder="Dispatch lead"
                                    />
                                </div>
                                <div className="space-y-2 md:col-span-1">
                                    <Label className="text-slate-700 dark:text-slate-200">Email</Label>
                                    <Input
                                        type="email"
                                        style={settingsDarkInputStyle}
                                        className="border-white/10 text-white placeholder:text-slate-500"
                                        value={newAdminUserForm.email}
                                        onChange={(e) => setNewAdminUserForm((prev) => ({ ...prev, email: e.target.value }))}
                                        placeholder="admin@tenant.com"
                                    />
                                </div>
                                <div className="space-y-2 md:col-span-1">
                                    <Label className="text-slate-700 dark:text-slate-200">Temporary Password</Label>
                                    <Input
                                        type="password"
                                        style={settingsDarkInputStyle}
                                        className="border-white/10 text-white placeholder:text-slate-500"
                                        value={newAdminUserForm.password}
                                        onChange={(e) => setNewAdminUserForm((prev) => ({ ...prev, password: e.target.value }))}
                                        placeholder="Minimum 6 characters"
                                    />
                                </div>
                                <div className="space-y-2 md:col-span-1">
                                    <Label className="text-slate-700 dark:text-slate-200">Role</Label>
                                    <Select
                                        value={newAdminUserForm.tenantRole}
                                        onValueChange={(value) => setNewAdminUserForm((prev) => ({ ...prev, tenantRole: value as AdminUserState['tenantRole'] }))}
                                    >
                                        <SelectTrigger className="border-white/10 bg-[#0b1424] text-white">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="owner">Owner</SelectItem>
                                            <SelectItem value="admin">Admin</SelectItem>
                                            <SelectItem value="dispatcher">Dispatcher</SelectItem>
                                            <SelectItem value="viewer">Viewer</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            {newAdminUserError && (
                                <p className="mt-3 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{newAdminUserError}</p>
                            )}
                            <div className="mt-4 flex justify-end">
                                <Button
                                    size="sm"
                                    className={settingsPrimaryButtonClass}
                                    onClick={handleCreateAdminUser}
                                    disabled={isSavingNewAdminUser}
                                >
                                    {isSavingNewAdminUser && <RefreshCw className="mr-2 h-3 w-3 animate-spin" />}
                                    {isSavingNewAdminUser ? 'Creating...' : 'Add Admin User'}
                                </Button>
                            </div>
                        </div>

                        <div className="mt-6 grid sm:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="admin_full_name" className="text-slate-700 dark:text-slate-200">Your Name</Label>
                                <Input
                                    id="admin_full_name"
                                    style={settingsDarkInputStyle}
                                    className="border-white/10 text-white placeholder:text-slate-500"
                                    value={adminCredentialForm.fullName}
                                    onChange={(e) => setAdminCredentialForm((prev) => ({ ...prev, fullName: e.target.value }))}
                                    autoComplete="name"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="admin_account_email" className="text-slate-700 dark:text-slate-200">Admin Email</Label>
                                <Input
                                    id="admin_account_email"
                                    type="email"
                                    style={settingsDarkInputStyle}
                                    className="border-white/10 text-white placeholder:text-slate-500"
                                    value={adminCredentialForm.adminEmail}
                                    onChange={(e) => setAdminCredentialForm((prev) => ({ ...prev, adminEmail: e.target.value }))}
                                    autoComplete="email"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="admin_current_password" className="text-slate-700 dark:text-slate-200">Current Password</Label>
                                <Input
                                    id="admin_current_password"
                                    type="password"
                                    style={settingsDarkInputStyle}
                                    className="border-white/10 text-white placeholder:text-slate-500"
                                    value={adminCredentialForm.currentPassword}
                                    onChange={(e) => setAdminCredentialForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                                    autoComplete="current-password"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="admin_new_password" className="text-slate-700 dark:text-slate-200">New Password (Optional)</Label>
                                <Input
                                    id="admin_new_password"
                                    type="password"
                                    style={settingsDarkInputStyle}
                                    className="border-white/10 text-white placeholder:text-slate-500"
                                    value={adminCredentialForm.newPassword}
                                    onChange={(e) => setAdminCredentialForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                                    autoComplete="new-password"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="admin_confirm_password" className="text-slate-700 dark:text-slate-200">Confirm New Password</Label>
                                <Input
                                    id="admin_confirm_password"
                                    type="password"
                                    style={settingsDarkInputStyle}
                                    className="border-white/10 text-white placeholder:text-slate-500"
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
                                className={settingsSecondaryButtonClass}
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
                            <Button size="sm" className={settingsPrimaryButtonClass} onClick={handleSaveAdminCredentials} disabled={isSavingAdminCredentials}>
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

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import {
    BarChart2,
    Bell,
    Building2,
    Copy,
    CreditCard,
    ExternalLink,
    History,
    Link2,
    ListFilter,
    Mail,
    MapPin,
    Moon,
    Monitor,
    Pencil,
    PlusCircle,
    QrCode,
    RefreshCw,
    RotateCcw,
    ShieldCheck,
    Trash2,
    Upload,
    UserCog,
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
    fetchAdminDealerships,
    fetchAdminTechnicians,
    fetchAdminPriorityRules,
    fetchAdminServices,
    fetchAdminInvoiceBrandingSettings,
    fetchAdminTenantEmailIdentity,
    getStoredAdminToken,
    updateAdminBookingPortalSettings,
    updateAdminTenantEmailIdentity,
    updateAdminPriorityRule,
    updateAdminInvoiceBrandingSettings,
    type BackendBookingPortalSettings,
    type BackendDealership,
    type BackendPriorityRule,
    type BackendServiceCatalogItem,
    type BackendTenantEmailIdentity,
    type BackendTechnicianListItem,
} from '@/lib/backend-api';
import { useAuth } from '@/contexts/AuthContext';
// --- Mock Data & Types ---

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

type TenantEmailIdentityDraft = {
    email_domain: string;
    support_email: string;
    billing_email: string;
    invoice_email: string;
    notification_email: string;
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
const COMPANY_PROFILE_SETTINGS_STORAGE_KEY = 'sm_dispatch_company_profile_settings';
const NOTIFICATION_PREFERENCES_STORAGE_KEY = 'sm_dispatch_notification_preferences';
const BILLING_SUBSCRIPTION_STORAGE_KEY = 'sm_dispatch_billing_subscription_settings';

const DEFAULT_COMPANY_PROFILE_SETTINGS: CompanyProfileSettings = {
    industryType: 'Automotive',
    timezone: 'America/Toronto',
    primaryColor: '#4f7cff',
    customFooterText: 'Thank you for choosing NexusOps.',
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
    planName: 'NexusOps Growth',
    monthlyPrice: '$149/mo',
    renewalDate: '2026-06-01',
    technicianLimit: 25,
    locationLimit: 50,
};

const DEFAULT_BOOKING_PORTAL_SETTINGS: BookingPortalSettingsState = {
    isEnabled: false,
    estimatedResponseTimeMessage: 'We will contact you within 2 business hours.',
    confirmationEmailBody:
        'Hello ${customer_name},\n\nThanks for contacting ${company_name}. We received your service request ${reference_number}.\n\n${estimated_response_time_message}\n\nBooking form: ${booking_portal_url}\nTrack your request: ${booking_status_url}\n\nIf you need help, reply to ${admin_contact_email}.',
    visibleServiceIds: [],
    statusLookupEnabled: false,
    industryType: 'automotive',
    detailsFieldLabel: '',
};

const DEFAULT_TENANT_EMAIL_IDENTITY_DRAFT: TenantEmailIdentityDraft = {
    email_domain: '',
    support_email: '',
    billing_email: '',
    invoice_email: '',
    notification_email: '',
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

const mapBackendTenantEmailIdentityToDraft = (row: BackendTenantEmailIdentity | null): TenantEmailIdentityDraft => ({
    email_domain: row?.email_domain ?? '',
    support_email: row?.support_email ?? '',
    billing_email: row?.billing_email ?? '',
    invoice_email: row?.invoice_email ?? '',
    notification_email: row?.notification_email ?? '',
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

const sectionCardClass = 'overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,24,39,0.96),rgba(6,17,29,0.96))] shadow-[0_24px_80px_rgba(0,0,0,0.28)]';
const sectionHeaderClass = 'border-b border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0))] pb-5';
const sectionFooterClass = 'border-t border-white/8 bg-[rgba(255,255,255,0.03)] py-4';
const settingsPrimaryButtonClass = 'bg-[linear-gradient(135deg,#2F8E92,#38a7ae)] text-white shadow-[0_14px_34px_rgba(47,142,146,0.28)] hover:bg-[linear-gradient(135deg,#38a7ae,#4bc0c7)] hover:shadow-[0_18px_40px_rgba(56,167,174,0.34)]';
const settingsSecondaryButtonClass = 'border-cyan-300/18 bg-[linear-gradient(180deg,rgba(18,37,58,0.96),rgba(12,26,43,0.96))] text-slate-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_10px_24px_rgba(2,8,23,0.28)] hover:bg-[linear-gradient(180deg,rgba(27,49,74,0.98),rgba(17,34,56,0.98))] hover:text-white';
const settingsSwitchClass = 'shadow-[0_6px_14px_rgba(2,8,23,0.18)]';
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
    const [tenantEmailIdentity, setTenantEmailIdentity] = useState<BackendTenantEmailIdentity | null>(null);
    const [tenantEmailIdentityDraft, setTenantEmailIdentityDraft] = useState<TenantEmailIdentityDraft>(DEFAULT_TENANT_EMAIL_IDENTITY_DRAFT);
    const [isSavingTenantEmailIdentity, setIsSavingTenantEmailIdentity] = useState(false);
    const [priorityRules, setPriorityRules] = useState<PriorityRule[]>([]);
    const [dealershipOptions, setDealershipOptions] = useState<DealershipOption[]>([]);
    const [technicianCount, setTechnicianCount] = useState(0);
    const [serviceOptions, setServiceOptions] = useState<Array<{ id: string; name: string }>>([]);
    const [isAddingRule, setIsAddingRule] = useState(false);
    const [newRule, setNewRule] = useState<Partial<PriorityRule>>(getDefaultNewRule());
    const [isEditingRule, setIsEditingRule] = useState(false);
    const [editRule, setEditRule] = useState<Partial<PriorityRule> & { id?: string }>(getDefaultNewRule());
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
    const bookingTenantSlug = tenantEmailIdentity?.tenant_slug || 'workspace';
    const bookingPortalUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/book/${bookingTenantSlug}`
        : `/book/${bookingTenantSlug}`;
    const bookingStatusLookupUrl = `${bookingPortalUrl}/status`;
    const selectedBookingServiceNames = serviceOptions
        .filter((service) => bookingPortalSettings.visibleServiceIds.includes(service.id))
        .map((service) => service.name);

    const copyText = async (value: string, label: string) => {
        try {
            await navigator.clipboard.writeText(value);
            alert(`${label} copied.`);
        } catch {
            alert(value);
        }
    };

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
            setDealershipOptions([]);
            setTechnicianCount(0);
            setServiceOptions([]);
            setPriorityRules([]);
            setBookingPortalSettings(DEFAULT_BOOKING_PORTAL_SETTINGS);
            setSavedBookingPortalSettings(DEFAULT_BOOKING_PORTAL_SETTINGS);
            setTenantEmailIdentity(null);
            setTenantEmailIdentityDraft(DEFAULT_TENANT_EMAIL_IDENTITY_DRAFT);
            return;
        }

        setRefreshing(true);
        try {
            const [
                brandingResult,
                dealershipsResult,
                techniciansResult,
                servicesResult,
                rulesResult,
                bookingPortalResult,
                emailIdentityResult,
            ] = await Promise.allSettled([
                fetchAdminInvoiceBrandingSettings(adminToken),
                fetchAdminDealerships(adminToken),
                fetchAdminTechnicians(adminToken),
                fetchAdminServices(adminToken, true),
                fetchAdminPriorityRules(adminToken),
                fetchAdminBookingPortalSettings(adminToken),
                fetchAdminTenantEmailIdentity(adminToken),
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

            if (dealershipsResult.status === 'fulfilled') {
                setDealershipOptions(
                    dealershipsResult.value
                        .map(mapBackendDealershipOption)
                        .filter((row) => row.name.length > 0),
                );
            } else {
                setDealershipOptions([]);
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

            const nextTenantEmailIdentity = emailIdentityResult.status === 'fulfilled' ? emailIdentityResult.value : null;
            setTenantEmailIdentity(nextTenantEmailIdentity);
            setTenantEmailIdentityDraft(mapBackendTenantEmailIdentityToDraft(nextTenantEmailIdentity));
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
        alert('Notifications saved successfully.');
    };

    const handleSaveTenantEmailIdentity = async () => {
        const adminToken = getStoredAdminToken();
        if (!hasBackendAdminToken || !adminToken) {
            alert('Admin session is required to save email identity settings.');
            return;
        }

        setIsSavingTenantEmailIdentity(true);
        try {
            const saved = await updateAdminTenantEmailIdentity(adminToken, {
                email_domain: tenantEmailIdentityDraft.email_domain.trim() || undefined,
                support_email: tenantEmailIdentityDraft.support_email.trim() || undefined,
                billing_email: tenantEmailIdentityDraft.billing_email.trim() || undefined,
                invoice_email: tenantEmailIdentityDraft.invoice_email.trim() || undefined,
                notification_email: tenantEmailIdentityDraft.notification_email.trim() || undefined,
            });
            setTenantEmailIdentity(saved);
            setTenantEmailIdentityDraft(mapBackendTenantEmailIdentityToDraft(saved));
            alert('Email identity saved successfully.');
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Unable to save email identity.');
        } finally {
            setIsSavingTenantEmailIdentity(false);
        }
    };

    const handleSaveBillingSubscription = () => {
        saveStoredObject(BILLING_SUBSCRIPTION_STORAGE_KEY, billingSubscription);
        alert('Billing subscription settings saved locally.');
    };

    const handleSaveBookingPortalSettings = async () => {
        const adminToken = getStoredAdminToken();
        if (!hasBackendAdminToken || !adminToken) {
            alert('Admin session is required to save portal settings.');
            return;
        }

        if (!bookingPortalSettings.estimatedResponseTimeMessage.trim()) {
            alert('Response time is required.');
            return;
        }
        if (!bookingPortalSettings.confirmationEmailBody.trim()) {
            alert('Confirmation email is required.');
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
            alert(error instanceof Error ? error.message : 'Unable to save portal settings.');
        } finally {
            setIsSavingBookingPortalSettings(false);
        }
    };

    const handleResetPriorityRules = () => {
        setNewRule(getDefaultNewRule());
        alert('Default rule template restored. Existing saved rules were not removed.');
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
        <div className="w-full space-y-5 pb-10">
            <div className="relative space-y-5">
                {/* ── Stat Cards ── */}
                <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                    <div className="rounded-2xl border border-white/8 bg-[#0d1829] p-5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Ranking Rules</p>
                        <p className="mt-2 text-[2rem] font-bold leading-none text-white">{priorityRules.length}</p>
                        <div className="mt-3 flex items-center justify-between">
                            <p className="text-sm text-slate-400">Active configuration</p>
                            <ListFilter className="h-5 w-5 text-slate-600" />
                        </div>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-[#0d1829] p-5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Active Impact</p>
                        <p className="mt-2 text-[2rem] font-bold leading-none text-white">{priorityRules.filter((r) => r.isActive).length}</p>
                        <div className="mt-3 flex items-center justify-between">
                            <p className="text-sm text-slate-400">Queue redirection</p>
                            <BarChart2 className="h-5 w-5 text-slate-600" />
                        </div>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-[#0d1829] p-5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Partners</p>
                        <p className="mt-2 text-[2rem] font-bold leading-none text-white">{dealershipOptions.length}</p>
                        <div className="mt-3 flex items-center justify-between">
                            <p className="text-sm text-slate-400">Available for targeting</p>
                            <Building2 className="h-5 w-5 text-slate-600" />
                        </div>
                    </div>
                    <div className="rounded-2xl border border-cyan-400/25 bg-[#0d1829] p-5 shadow-[0_0_0_1px_rgba(34,211,238,0.08)]">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Theme</p>
                        <p className="mt-2 text-[2rem] font-bold leading-none text-white">{theme === 'dark' ? 'Dark' : theme === 'light' ? 'Light' : 'System'}</p>
                        <div className="mt-3 flex items-center justify-between">
                            <p className="text-sm text-cyan-300">Appearance</p>
                            <Monitor className="h-5 w-5 text-cyan-400" />
                        </div>
                        <div className="mt-4 grid grid-cols-3 gap-2">
                            {(['dark', 'light', 'system'] as const).map((option) => (
                                <button
                                    key={option}
                                    type="button"
                                    onClick={() => setTheme(option)}
                                    className={`rounded-xl border px-3 py-2 text-xs font-semibold capitalize transition-colors ${
                                        theme === option
                                            ? 'border-cyan-300/40 bg-cyan-300/15 text-cyan-200'
                                            : 'border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.06] hover:text-slate-100'
                                    }`}
                                >
                                    {option}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── Company Profile + Sidebar ── */}
                <div className="grid gap-5 xl:grid-cols-[1.5fr_0.75fr]">
                    {/* Company Profile */}
                    <div className="rounded-2xl border border-white/8 bg-[#0d1829] p-6">
                        <div className="mb-6 flex items-center gap-3">
                            <Building2 className="h-7 w-7 text-cyan-300" />
                            <h2 className="text-2xl font-bold text-white">Company Profile</h2>
                        </div>
                        <div className="grid gap-6 md:grid-cols-[1fr_260px]">
                            {/* Fields */}
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <Label className="text-sm text-slate-400">Company Name</Label>
                                    <Input style={settingsDarkInputStyle} className="border-white/10 text-white placeholder:text-slate-500" value={invoiceCompany.name} onChange={(e) => setInvoiceCompany({ ...invoiceCompany, name: e.target.value })} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-sm text-slate-400">Email</Label>
                                    <Input style={settingsDarkInputStyle} className="border-white/10 text-white placeholder:text-slate-500" value={invoiceCompany.email} onChange={(e) => setInvoiceCompany({ ...invoiceCompany, email: e.target.value })} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-sm text-slate-400">Industry</Label>
                                    <Select value={companyProfileSettings.industryType} onValueChange={(v) => setCompanyProfileSettings((prev) => ({ ...prev, industryType: v }))}>
                                        <SelectTrigger className="border-white/10 bg-[#0b1424] text-white"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Automotive">Automotive</SelectItem>
                                            <SelectItem value="HVAC">HVAC</SelectItem>
                                            <SelectItem value="Appliance Repair">Appliance Repair</SelectItem>
                                            <SelectItem value="General Field Service">General Field Service</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-sm text-slate-400">Phone</Label>
                                        <Input style={settingsDarkInputStyle} className="border-white/10 text-white placeholder:text-slate-500" value={invoiceCompany.phone} onChange={(e) => setInvoiceCompany({ ...invoiceCompany, phone: e.target.value })} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-sm text-slate-400">Primary color</Label>
                                        <div className="flex gap-2">
                                            <Input type="color" style={settingsDarkInputStyle} className="h-[52px] w-14 border-white/10 p-1" value={companyProfileSettings.primaryColor} onChange={(e) => setCompanyProfileSettings((prev) => ({ ...prev, primaryColor: e.target.value }))} />
                                            <Input style={settingsDarkInputStyle} className="border-white/10 text-white" value={companyProfileSettings.primaryColor} onChange={(e) => setCompanyProfileSettings((prev) => ({ ...prev, primaryColor: e.target.value }))} />
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-sm text-slate-400">PDF footer</Label>
                                    <Textarea style={settingsDarkInputStyle} className="min-h-16 border-white/10 text-white placeholder:text-slate-500" value={companyProfileSettings.customFooterText} onChange={(e) => setCompanyProfileSettings((prev) => ({ ...prev, customFooterText: e.target.value }))} />
                                </div>
                            </div>
                            {/* Logo upload */}
                            <div className="flex flex-col gap-3">
                                <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/20 bg-white/[0.02] p-6">
                                    {companyProfileSettings.logoUrl || invoiceCompany.logo_url ? (
                                        <img src={companyProfileSettings.logoUrl || invoiceCompany.logo_url} alt="Logo" className="max-h-24 max-w-full object-contain" />
                                    ) : (
                                        <>
                                            <Upload className="h-8 w-8 text-slate-500" />
                                            <p className="text-center text-sm font-medium text-slate-400">Upload logo</p>
                                            <p className="text-xs text-slate-600">SVG, PNG or JPG (Max 2MB)</p>
                                        </>
                                    )}
                                </div>
                                <Label htmlFor="company_logo_upload" className="flex h-9 cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-sm font-medium text-slate-200 transition-colors hover:bg-white/[0.08]">
                                    Browse Files
                                </Label>
                                <Input id="company_logo_upload" type="file" accept="image/*" className="hidden" onChange={(e) => handleLogoUpload(e.target.files?.[0])} />
                            </div>
                        </div>
                        <Button className="mt-6 h-12 w-full rounded-xl bg-gradient-to-r from-[#4f7cff] to-[#22d3ee] text-base font-semibold text-white shadow-[0_8px_24px_rgba(79,124,255,0.28)] hover:brightness-110 transition-all" onClick={handleSaveCompanyProfile} disabled={loading}>
                            {loading && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                            Save profile
                        </Button>
                    </div>

                    {/* Right sidebar */}
                    <div className="space-y-4">
                        {/* Locations */}
                        <div className="rounded-2xl border border-white/8 bg-[#0d1829] p-5">
                            <div className="mb-4 flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-cyan-300" />
                                <h3 className="text-sm font-semibold text-white">Locations</h3>
                            </div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Active Records</p>
                            <p className="mt-1 text-4xl font-bold text-white">{dealershipOptions.length}</p>
                            <Button asChild variant="outline" className="mt-4 w-full justify-between rounded-xl border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]">
                                <Link to="/admin/locations">
                                    View locations
                                    <ExternalLink className="h-4 w-4" />
                                </Link>
                            </Button>
                        </div>
                        {/* Billing */}
                        <div className="rounded-2xl border border-white/8 bg-[#0d1829] p-5">
                            <div className="mb-4 flex items-center gap-2">
                                <CreditCard className="h-4 w-4 text-cyan-300" />
                                <h3 className="text-sm font-semibold text-white">Billing</h3>
                            </div>
                            <div className="space-y-2.5 text-sm">
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-400">Current Plan</span>
                                    <span className="font-semibold text-cyan-300">{billingSubscription.planName.split(' ').slice(-2).join(' ')}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-400">Renewal Date</span>
                                    <span className="text-white">{new Date(billingSubscription.renewalDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                </div>
                            </div>
                            <div className="mt-4 grid grid-cols-2 gap-3">
                                <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3 text-center">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Technicians</p>
                                    <p className="mt-1 text-base font-bold text-white">{technicianCount} / {billingSubscription.technicianLimit}</p>
                                </div>
                                <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3 text-center">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Locations</p>
                                    <p className="mt-1 text-base font-bold text-white">{dealershipOptions.length} / {billingSubscription.locationLimit}</p>
                                </div>
                            </div>
                            <Button size="sm" className="mt-4 w-full bg-[#2F8E92] text-white hover:bg-[#267276]" onClick={handleSaveBillingSubscription}>
                                Save Billing View
                            </Button>
                        </div>
                    </div>
                </div>

                {/* ── Notifications ── */}
                <div className="rounded-2xl border border-white/8 bg-[#0d1829] p-6">
                    <div className="mb-6">
                        <h2 className="text-2xl font-bold text-white">Notifications</h2>
                        <p className="mt-1 text-sm text-slate-400">Choose workspace alerts.</p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-4">
                        {([
                            ['jobAssignedEmail',           'Job assigned',          'Technician alert'],
                            ['jobCompletedEmail',          'Job completed',         'Manager summary'],
                            ['invoiceReadyEmail',          'Invoice SMS',           'Billing alert'],
                            ['technicianSignupEmail',      'Technician signup',     'Admin alert'],
                            ['chatDigestEmail',            'Chat digest',           'Unread messages'],
                            ['technicianSmsAssignments',   'SMS assignments',       'Assigned jobs'],
                            ['customerBookingConfirmation','Booking confirmations', 'Customer email'],
                            ['customerCompletionSummary',  'Completion summary',    'Customer email'],
                        ] as [keyof NotificationPreferences, string, string][]).map(([key, title, description]) => (
                            <div key={key} className="flex items-center justify-between gap-4 rounded-xl border border-white/8 bg-white/[0.02] p-4">
                                <div>
                                    <p className="font-semibold text-white">{title}</p>
                                    <p className="mt-0.5 text-xs text-slate-500">{description}</p>
                                </div>
                                <Switch
                                    checked={notificationPreferences[key]}
                                    onCheckedChange={(checked) => setNotificationPreferences((prev) => ({ ...prev, [key]: checked }))}
                                />
                            </div>
                        ))}
                    </div>
                    <div className="mt-5 flex justify-end">
                        <Button size="sm" className="bg-[#2F8E92] text-white hover:bg-[#267276]" onClick={handleSaveNotificationPreferences}>
                            Save notifications
                        </Button>
                    </div>
                </div>

                {/* ── Booking Portal ── */}
                <div className="rounded-2xl border border-white/8 bg-[#0d1829] p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <div className="flex items-center gap-2">
                                <Mail className="h-5 w-5 text-cyan-300" />
                                <h2 className="text-2xl font-bold text-white">Email Settings</h2>
                            </div>
                            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                                Emails are sent from your workspace identity.
                            </p>
                        </div>
                        <Badge className={cn(
                            'w-fit rounded-full px-3 py-1 text-xs font-semibold',
                            tenantEmailIdentity?.email_verified ? 'bg-emerald-500/15 text-emerald-200' : 'bg-amber-500/15 text-amber-200',
                        )}>
                            {tenantEmailIdentity?.email_verified ? 'Verified' : 'Demo / Unverified'}
                        </Badge>
                    </div>
                    <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)]">
                        <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2 md:col-span-2">
                                    <Label className="text-sm text-slate-400" htmlFor="tenant-email-domain">
                                        Custom Domain
                                    </Label>
                                    <Input
                                        id="tenant-email-domain"
                                        value={tenantEmailIdentityDraft.email_domain}
                                        onChange={(event) => setTenantEmailIdentityDraft((prev) => ({ ...prev, email_domain: event.target.value }))}
                                        placeholder="techionik.com"
                                        style={settingsDarkInputStyle}
                                        className="border-white/10 text-white placeholder:text-slate-500"
                                    />
                                    <p className="text-xs leading-5 text-slate-500">
                                        This controls the domain used by the generated sender addresses for your workspace.
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm text-slate-400" htmlFor="tenant-support-email">
                                        Support Email
                                    </Label>
                                    <Input
                                        id="tenant-support-email"
                                        value={tenantEmailIdentityDraft.support_email}
                                        onChange={(event) => setTenantEmailIdentityDraft((prev) => ({ ...prev, support_email: event.target.value }))}
                                        style={settingsDarkInputStyle}
                                        className="border-white/10 text-white placeholder:text-slate-500"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm text-slate-400" htmlFor="tenant-billing-email">
                                        Billing Email
                                    </Label>
                                    <Input
                                        id="tenant-billing-email"
                                        value={tenantEmailIdentityDraft.billing_email}
                                        onChange={(event) => setTenantEmailIdentityDraft((prev) => ({ ...prev, billing_email: event.target.value }))}
                                        style={settingsDarkInputStyle}
                                        className="border-white/10 text-white placeholder:text-slate-500"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm text-slate-400" htmlFor="tenant-invoice-email">
                                        Invoice Email
                                    </Label>
                                    <Input
                                        id="tenant-invoice-email"
                                        value={tenantEmailIdentityDraft.invoice_email}
                                        onChange={(event) => setTenantEmailIdentityDraft((prev) => ({ ...prev, invoice_email: event.target.value }))}
                                        style={settingsDarkInputStyle}
                                        className="border-white/10 text-white placeholder:text-slate-500"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm text-slate-400" htmlFor="tenant-notification-email">
                                        Notification Email
                                    </Label>
                                    <Input
                                        id="tenant-notification-email"
                                        value={tenantEmailIdentityDraft.notification_email}
                                        onChange={(event) => setTenantEmailIdentityDraft((prev) => ({ ...prev, notification_email: event.target.value }))}
                                        style={settingsDarkInputStyle}
                                        className="border-white/10 text-white placeholder:text-slate-500"
                                    />
                                </div>
                            </div>
                            <div className="mt-4 rounded-xl border border-dashed border-white/12 bg-[#080f1c] p-4">
                                <p className="text-xs leading-5 text-slate-500">
                                    Changing the custom domain will preserve any custom sender addresses. If an address still matches the old generated pattern, it updates to the new domain automatically.
                                </p>
                            </div>
                            <div className="mt-4 flex flex-wrap items-center gap-3">
                                <Button
                                    size="sm"
                                    className="bg-[#2F8E92] text-white hover:bg-[#267276]"
                                    onClick={handleSaveTenantEmailIdentity}
                                    disabled={isSavingTenantEmailIdentity}
                                >
                                    {isSavingTenantEmailIdentity ? 'Saving email identity...' : 'Save email identity'}
                                </Button>
                                <Badge className={cn(
                                    'rounded-full px-3 py-1 text-xs font-semibold',
                                    tenantEmailIdentity?.email_verified ? 'bg-emerald-500/15 text-emerald-200' : 'bg-amber-500/15 text-amber-200',
                                )}>
                                    {tenantEmailIdentity?.email_sending_status || 'demo'}
                                </Badge>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <div className="rounded-xl border border-white/8 bg-[#080f1c] p-4">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Email domain</p>
                                <p className="mt-2 break-all text-sm text-slate-200">{tenantEmailIdentity?.email_domain || 'tenant.nexusops.app'}</p>
                            </div>
                            <div className="rounded-xl border border-white/8 bg-[#080f1c] p-4">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Sending status</p>
                                <p className="mt-2 text-sm font-semibold text-cyan-200">{tenantEmailIdentity?.email_sending_status || 'demo'}</p>
                            </div>
                            <div className="rounded-xl border border-white/8 bg-[#080f1c] p-4">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Workspace slug</p>
                                <p className="mt-2 text-sm text-slate-200">{tenantEmailIdentity?.tenant_slug || 'workspace'}</p>
                            </div>
                        </div>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        {([
                            ['Billing', tenantEmailIdentity?.billing_email],
                            ['Support', tenantEmailIdentity?.support_email],
                            ['Invoices', tenantEmailIdentity?.invoice_email],
                            ['Notifications', tenantEmailIdentity?.notification_email],
                        ] as const).map(([label, value]) => (
                            <div key={label} className="rounded-xl border border-white/8 bg-white/[0.025] p-4">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</p>
                                <p className="mt-2 break-all text-sm font-semibold text-white">{value || 'Loading workspace identity...'}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-white/8 bg-[#0d1829]">
                    {/* Dark header bar */}
                    <div className="flex flex-col gap-3 border-b border-white/8 bg-[#080f1c] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2.5">
                            <Monitor className="h-4 w-4 text-cyan-300" />
                            <span className="text-xs font-bold uppercase tracking-[0.22em] text-white">Booking Portal</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Badge className={cn('w-fit rounded-full px-3 py-1 text-xs font-semibold', bookingPortalSettings.isEnabled ? 'bg-emerald-500/15 text-emerald-200' : 'bg-red-500/15 text-red-200')}>
                                {bookingPortalSettings.isEnabled ? 'Online' : 'Offline'}
                            </Badge>
                            <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 rounded-lg border-white/15 bg-transparent px-3 text-xs font-semibold text-slate-200 hover:bg-white/[0.06]" onClick={() => void copyText(bookingPortalUrl, 'Booking link')}>
                                <Copy className="h-3.5 w-3.5" />
                                Copy link
                            </Button>
                            <Button asChild size="sm" variant="outline" className="h-8 gap-1.5 rounded-lg border-white/15 bg-transparent px-3 text-xs font-semibold text-slate-200 hover:bg-white/[0.06]">
                                <Link to={`/book/${bookingTenantSlug}`} target="_blank" rel="noreferrer">
                                    <ExternalLink className="h-3.5 w-3.5" />
                                    Open form
                                </Link>
                            </Button>
                        </div>
                    </div>
                    {/* Content */}
                    <div className="grid gap-6 p-6 xl:grid-cols-2">
                        {/* Left */}
                        <div className="space-y-5">
                            <div className="grid gap-3">
                                <div className="rounded-xl border border-white/8 bg-white/[0.025] p-4">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Booking URL</p>
                                    <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                        <p className="break-all text-sm font-semibold text-cyan-100">{bookingPortalUrl}</p>
                                        <Button type="button" size="sm" variant="outline" className="shrink-0 border-white/10 bg-transparent text-slate-200 hover:bg-white/[0.06]" onClick={() => void copyText(bookingPortalUrl, 'Booking link')}>
                                            Copy
                                        </Button>
                                    </div>
                                </div>
                                <div className="grid gap-3 md:grid-cols-2">
                                    <div className="rounded-xl border border-white/8 bg-white/[0.025] p-4">
                                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Status URL</p>
                                        <p className="mt-2 break-all text-sm text-slate-200">{bookingStatusLookupUrl}</p>
                                    </div>
                                    <div className="rounded-xl border border-dashed border-white/12 bg-white/[0.02] p-4">
                                        <div className="flex items-center gap-2 text-slate-200">
                                            <QrCode className="h-4 w-4 text-cyan-300" />
                                            <p className="text-sm font-semibold">QR code ready</p>
                                        </div>
                                        <p className="mt-2 text-xs leading-5 text-slate-500">Use the booking URL for QR codes.</p>
                                    </div>
                                </div>
                            </div>
                            <div className={cn('flex items-center justify-between rounded-xl border p-4 transition-colors', bookingPortalSettings.isEnabled ? 'border-emerald-400/20 bg-emerald-400/[0.05]' : 'border-red-400/20 bg-red-400/[0.05]')}>
                                <div>
                                    <p className="font-semibold text-white">Booking portal</p>
                                    <p className={cn('mt-0.5 text-xs', bookingPortalSettings.isEnabled ? 'text-emerald-400' : 'text-red-400')}>
                                        {bookingPortalSettings.isEnabled ? 'Accepting submissions' : 'Submissions disabled'}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2.5">
                                    <span className={cn('text-xs font-bold uppercase tracking-wide', bookingPortalSettings.isEnabled ? 'text-emerald-400' : 'text-red-400')}>
                                        {bookingPortalSettings.isEnabled ? 'Online' : 'Offline'}
                                    </span>
                                    <Switch checked={bookingPortalSettings.isEnabled} onCheckedChange={(c) => setBookingPortalSettings((prev) => ({ ...prev, isEnabled: c }))} />
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-semibold text-white">Status lookup</p>
                                    <p className="mt-0.5 text-xs text-slate-500">Reference number lookup</p>
                                </div>
                                <Switch checked={bookingPortalSettings.statusLookupEnabled} onCheckedChange={(c) => setBookingPortalSettings((prev) => ({ ...prev, statusLookupEnabled: c }))} />
                            </div>
                            <div className="space-y-2">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Services</p>
                                <p className="text-xs leading-5 text-slate-500">
                                    Public services: {selectedBookingServiceNames.length ? selectedBookingServiceNames.join(', ') : 'All active services'}
                                </p>
                                <Input style={settingsDarkInputStyle} className="border-white/10 text-white placeholder:text-slate-500" placeholder="Search services..." value={bookingServiceSearch} onChange={(e) => setBookingServiceSearch(e.target.value)} />
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                    {serviceOptions.filter((s) => bookingPortalSettings.visibleServiceIds.includes(s.id)).slice(0, 5).map((s) => (
                                        <button key={s.id} onClick={() => setBookingPortalSettings((prev) => ({ ...prev, visibleServiceIds: prev.visibleServiceIds.filter((id) => id !== s.id) }))} className="inline-flex items-center rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-200 transition-colors hover:bg-cyan-400/20">
                                            {s.name}
                                        </button>
                                    ))}
                                </div>
                                <div className="max-h-48 overflow-y-auto rounded-xl border border-white/8 bg-white/[0.02] p-2">
                                    {filteredBookingServiceOptions.map((service) => {
                                        const checked = bookingPortalSettings.visibleServiceIds.includes(service.id);
                                        return (
                                            <label key={service.id} className="flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-200 hover:bg-white/[0.04]">
                                                <span>{service.name}</span>
                                                <Switch checked={checked} onCheckedChange={(c) => setBookingPortalSettings((prev) => ({ ...prev, visibleServiceIds: c ? [...prev.visibleServiceIds, service.id] : prev.visibleServiceIds.filter((id) => id !== service.id) }))} />
                                            </label>
                                        );
                                    })}
                                    {filteredBookingServiceOptions.length === 0 && <p className="px-2 py-4 text-xs text-slate-500">No services match.</p>}
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-sm text-slate-400">Industry</Label>
                                <Select value={bookingPortalSettings.industryType} onValueChange={(v) => setBookingPortalSettings((prev) => ({ ...prev, industryType: v as BookingPortalSettingsState['industryType'] }))}>
                                    <SelectTrigger className="border-white/10 bg-[#0b1424] text-white"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="automotive">Automotive</SelectItem>
                                        <SelectItem value="property">Property</SelectItem>
                                        <SelectItem value="general">General field service</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-sm text-slate-400">Response time</Label>
                                <Input style={settingsDarkInputStyle} className="border-white/10 text-white placeholder:text-slate-500" value={bookingPortalSettings.estimatedResponseTimeMessage} onChange={(e) => setBookingPortalSettings((prev) => ({ ...prev, estimatedResponseTimeMessage: e.target.value }))} />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-sm text-slate-400">Details label</Label>
                                <Input style={settingsDarkInputStyle} className="border-white/10 text-white placeholder:text-slate-500" placeholder="Leave blank to use industry default" value={bookingPortalSettings.detailsFieldLabel} onChange={(e) => setBookingPortalSettings((prev) => ({ ...prev, detailsFieldLabel: e.target.value }))} />
                            </div>
                        </div>
                        {/* Right — email body */}
                        <div className="space-y-0">
                            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Confirmation email</p>
                            <div className="flex items-center gap-0.5 rounded-t-xl border border-white/10 bg-white/[0.04] px-3 py-2">
                                <button className="flex h-7 w-7 items-center justify-center rounded text-sm font-bold text-slate-400 hover:bg-white/[0.06] hover:text-white">B</button>
                                <button className="flex h-7 w-7 items-center justify-center rounded text-sm italic text-slate-400 hover:bg-white/[0.06] hover:text-white">I</button>
                                <button className="flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-white/[0.06] hover:text-white">
                                    <Link2 className="h-3.5 w-3.5" />
                                </button>
                            </div>
                            <Textarea style={settingsDarkInputStyle} className="min-h-[240px] rounded-t-none border-t-0 border-white/10 text-white placeholder:text-slate-500" value={bookingPortalSettings.confirmationEmailBody} onChange={(e) => setBookingPortalSettings((prev) => ({ ...prev, confirmationEmailBody: e.target.value }))} />
                            <p className="mt-2 text-xs leading-5 text-slate-600">
                                Available dynamic tags: <code className="text-slate-400">${'{customer_name}'}</code>, <code className="text-slate-400">${'{company_name}'}</code>, <code className="text-slate-400">${'{reference_number}'}</code>, <code className="text-slate-400">${'{service_location}'}</code>, <code className="text-slate-400">${'{estimated_response_time_message}'}</code>, <code className="text-slate-400">${'{booking_portal_url}'}</code>, <code className="text-slate-400">${'{booking_status_url}'}</code>, <code className="text-slate-400">${'{admin_contact_email}'}</code>
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center justify-end gap-2 border-t border-white/8 bg-[#080f1c] px-6 py-4">
                        <Button size="sm" variant="outline" className="border-white/10 bg-transparent text-slate-200 hover:bg-white/[0.05]" onClick={() => setBookingPortalSettings(savedBookingPortalSettings)} disabled={isSavingBookingPortalSettings}>Reset</Button>
                        <Button size="sm" className="bg-[#2F8E92] text-white hover:bg-[#267276]" onClick={handleSaveBookingPortalSettings} disabled={isSavingBookingPortalSettings}>
                            {isSavingBookingPortalSettings ? 'Saving...' : 'Save portal'}
                        </Button>
                    </div>
                </div>

                {/* ── Ranking Rules ── */}
                <div className="overflow-hidden rounded-2xl border border-white/8 bg-[#0d1829]">
                    <div className="flex flex-col gap-3 p-6 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <h2 className="text-2xl font-bold text-white">Ranking Rules</h2>
                            <p className="mt-1 text-sm text-slate-400">Prioritize inbound jobs.</p>
                        </div>
                        <Dialog open={isAddingRule} onOpenChange={setIsAddingRule}>
                            <DialogTrigger asChild>
                                <Button size="sm" variant="outline" className="h-9 shrink-0 gap-1.5 rounded-xl border-white/15 bg-transparent text-sm font-semibold text-white hover:bg-white/[0.06]">
                                    <PlusCircle className="h-4 w-4" /> New Rule
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-md border-white/10 bg-[#0d1829] text-white">
                                <DialogHeader>
                                    <DialogTitle className="text-white">Create New Ranking Rule</DialogTitle>
                                    <DialogDescription className="text-slate-400">Define logic to automatically escalate job ranking.</DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <Label className="text-slate-300">Rule Description</Label>
                                        <Input style={settingsDarkInputStyle} className="border-white/10 text-white placeholder:text-slate-500" placeholder="e.g., Prioritize Audi repairs" value={newRule.description} onChange={(e) => setNewRule({ ...newRule, description: e.target.value })} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-slate-300">Dealership</Label>
                                            <Select value={newRule.dealershipId} onValueChange={(v) => setNewRule({ ...newRule, dealershipId: v })}>
                                                <SelectTrigger className="border-white/10 bg-[#0b1424] text-white"><SelectValue placeholder="Select dealer" /></SelectTrigger>
                                                <SelectContent>{MOCK_DEALERSHIPS.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-slate-300">Service Type</Label>
                                            <Select value={newRule.serviceId} onValueChange={(v) => setNewRule({ ...newRule, serviceId: v })}>
                                                <SelectTrigger className="border-white/10 bg-[#0b1424] text-white"><SelectValue placeholder="Any Service" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="any">Any Service</SelectItem>
                                                    {serviceOptions.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-slate-300">Target Urgency</Label>
                                            <Select value={newRule.targetUrgency} onValueChange={(v) => setNewRule({ ...newRule, targetUrgency: v as UrgencyLevel })}>
                                                <SelectTrigger className="border-white/10 bg-[#0b1424] text-white"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="LOW">Low</SelectItem>
                                                    <SelectItem value="MEDIUM">Medium</SelectItem>
                                                    <SelectItem value="HIGH">High</SelectItem>
                                                    <SelectItem value="CRITICAL">Critical</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-slate-300">Ranking Score</Label>
                                            <Input type="number" style={settingsDarkInputStyle} className="border-white/10 text-white" value={newRule.rankingScore} onChange={(e) => setNewRule({ ...newRule, rankingScore: parseInt(e.target.value) })} />
                                        </div>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" className="border-white/10 bg-transparent text-slate-200 hover:bg-white/[0.06] hover:text-white" onClick={() => setIsAddingRule(false)}>Cancel</Button>
                                    <Button className="bg-[#2F8E92] text-white hover:bg-[#267276]" onClick={handleAddRule}>Save Rule</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                        <Dialog open={isEditingRule} onOpenChange={setIsEditingRule}>
                            <DialogContent className="max-w-md border-white/10 bg-[#0d1829] text-white">
                                <DialogHeader>
                                    <DialogTitle className="text-white">Edit Ranking Rule</DialogTitle>
                                    <DialogDescription className="text-slate-400">Update rule logic for dispatch ranking.</DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <Label className="text-slate-300">Rule Description</Label>
                                        <Input style={settingsDarkInputStyle} className="border-white/10 text-white placeholder:text-slate-500" placeholder="e.g., Prioritize Audi repairs" value={editRule.description || ''} onChange={(e) => setEditRule({ ...editRule, description: e.target.value })} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-slate-300">Dealership</Label>
                                            <Select value={editRule.dealershipId} onValueChange={(v) => setEditRule({ ...editRule, dealershipId: v })}>
                                                <SelectTrigger className="border-white/10 bg-[#0b1424] text-white"><SelectValue placeholder="Select dealer" /></SelectTrigger>
                                                <SelectContent>{MOCK_DEALERSHIPS.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-slate-300">Service Type</Label>
                                            <Select value={editRule.serviceId} onValueChange={(v) => setEditRule({ ...editRule, serviceId: v })}>
                                                <SelectTrigger className="border-white/10 bg-[#0b1424] text-white"><SelectValue placeholder="Any Service" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="any">Any Service</SelectItem>
                                                    {serviceOptions.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-slate-300">Target Urgency</Label>
                                            <Select value={editRule.targetUrgency} onValueChange={(v) => setEditRule({ ...editRule, targetUrgency: v as UrgencyLevel })}>
                                                <SelectTrigger className="border-white/10 bg-[#0b1424] text-white"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="LOW">Low</SelectItem>
                                                    <SelectItem value="MEDIUM">Medium</SelectItem>
                                                    <SelectItem value="HIGH">High</SelectItem>
                                                    <SelectItem value="CRITICAL">Critical</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-slate-300">Ranking Score</Label>
                                            <Input type="number" style={settingsDarkInputStyle} className="border-white/10 text-white" value={editRule.rankingScore} onChange={(e) => setEditRule({ ...editRule, rankingScore: parseInt(e.target.value) })} />
                                        </div>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" className="border-white/10 bg-transparent text-slate-200 hover:bg-white/[0.06] hover:text-white" onClick={() => setIsEditingRule(false)}>Cancel</Button>
                                    <Button className="bg-[#2F8E92] text-white hover:bg-[#267276]" onClick={handleEditRule}>Save Changes</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-y border-white/8 bg-[#080f1c]">
                                    <th className="px-6 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Rule &amp; Description</th>
                                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Target</th>
                                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Impact</th>
                                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Status</th>
                                    <th className="px-6 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {priorityRules.map((rule) => {
                                    const dealer = MOCK_DEALERSHIPS.find((d) => d.id === rule.dealershipId);
                                    return (
                                        <tr key={rule.id} className="border-b border-white/[0.06] transition-colors hover:bg-white/[0.015]">
                                            <td className="px-6 py-4">
                                                <p className="font-semibold text-white">{rule.description}</p>
                                                <p className="mt-0.5 text-xs text-slate-500">{dealer?.name ? `Auto-escalate ${dealer.name} service requests` : 'Global ranking rule'}</p>
                                            </td>
                                            <td className="px-4 py-4">
                                                <span className={cn(
                                                    'rounded px-2.5 py-1 text-[10px] font-bold uppercase',
                                                    rule.targetUrgency === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400' :
                                                    rule.targetUrgency === 'HIGH'     ? 'bg-orange-500/20 text-orange-400' :
                                                                                        'bg-slate-500/20 text-slate-300'
                                                )}>
                                                    {dealer?.name || rule.targetUrgency}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4">
                                                <span className="font-mono text-sm font-semibold text-cyan-300">+{rule.rankingScore} pts</span>
                                            </td>
                                            <td className="px-4 py-4">
                                                <button onClick={() => void handleToggleRule(rule.id)} className={cn('flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide transition-colors', rule.isActive ? 'text-emerald-400 hover:text-emerald-300' : 'text-slate-500 hover:text-slate-400')}>
                                                    <span className={cn('h-1.5 w-1.5 rounded-full', rule.isActive ? 'bg-emerald-400' : 'bg-slate-600')} />
                                                    {rule.isActive ? 'Active' : 'Paused'}
                                                </button>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:bg-cyan-400/10 hover:text-cyan-300" onClick={() => handleOpenEditRule(rule)}>
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:bg-rose-400/10 hover:text-rose-400" onClick={() => void handleDeleteRule(rule.id)}>
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {priorityRules.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500">No ranking rules configured yet.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    );
}

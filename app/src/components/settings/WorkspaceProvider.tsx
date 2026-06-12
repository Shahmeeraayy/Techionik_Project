import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { loadInvoiceCompanyProfile, saveInvoiceCompanyProfile, type InvoiceCompanyProfile } from '@/lib/invoice-company';
import {
  fetchAdminBookingPortalSettings,
  fetchAdminDealerships,
  fetchAdminInvoiceBrandingSettings,
  fetchAdminPriorityRules,
  fetchAdminServices,
  fetchAdminTechnicians,
  fetchAdminTenantEmailIdentity,
  getStoredAdminToken,
  type BackendBookingPortalSettings,
  type BackendDealership,
  type BackendPriorityRule,
  type BackendServiceCatalogItem,
  type BackendTenantEmailIdentity,
  type BackendInvoiceBrandingSettings,
} from '@/lib/backend-api';
import {
  BILLING_SUBSCRIPTION_STORAGE_KEY,
  COMPANY_PROFILE_SETTINGS_STORAGE_KEY,
  DEFAULT_BILLING_SUBSCRIPTION,
  DEFAULT_COMPANY_PROFILE_EXTRAS,
  DEFAULT_NOTIFICATION_PREFERENCES,
  loadSettingsObject,
  NOTIFICATION_PREFERENCES_STORAGE_KEY,
  type BillingSubscriptionSettings,
  type CompanyProfileExtras,
  type NotificationPreferences,
} from './storage';

const DEFAULT_BOOKING_PORTAL_SETTINGS: BackendBookingPortalSettings = {
  is_enabled: false,
  estimated_response_time_message: 'We will contact you within 2 business hours.',
  confirmation_email_body:
    'Hello ${customer_name},\n\nThanks for contacting ${company_name}. We received your request ${reference_number}.\n\n${estimated_response_time_message}\n\nBooking form: ${booking_portal_url}\nTrack your request: ${booking_status_url}\n\nIf you need help, reply to ${admin_contact_email}.',
  visible_service_ids: [],
  status_lookup_enabled: false,
  industry_type: 'automotive',
  details_field_label: '',
  tenant_slug: 'workspace',
  company_name: 'NexusOps',
  company_logo_url: null,
  admin_contact_email: 'support@nexusops.com',
  admin_contact_phone: '+1 (000) 000-0000',
  public_booking_url: '',
  status_lookup_url: '',
};

type SettingsWorkspaceState = {
  loading: boolean;
  refreshing: boolean;
  canUseBackend: boolean;
  lastRefreshedAt: string | null;
  invoiceBranding: InvoiceCompanyProfile;
  companyExtras: CompanyProfileExtras;
  notificationPreferences: NotificationPreferences;
  billingSubscription: BillingSubscriptionSettings;
  emailIdentity: BackendTenantEmailIdentity | null;
  bookingPortalSettings: BackendBookingPortalSettings;
  dealerships: BackendDealership[];
  priorityRules: BackendPriorityRule[];
  services: BackendServiceCatalogItem[];
  technicianCount: number;
};

type SettingsWorkspaceContextValue = SettingsWorkspaceState & {
  refresh: () => Promise<void>;
};

const SettingsWorkspaceContext = createContext<SettingsWorkspaceContextValue | null>(null);

const normalizeInvoiceBranding = (branding: BackendInvoiceBrandingSettings): InvoiceCompanyProfile => ({
  logo_url: branding.logo_url?.trim() || undefined,
  name: branding.name.trim(),
  street_address: branding.street_address.trim(),
  city: branding.city.trim(),
  state: branding.state.trim(),
  zip_code: branding.zip_code.trim(),
  phone: branding.phone.trim(),
  email: branding.email.trim(),
  website: branding.website.trim(),
});

export function SettingsWorkspaceProvider({ children }: { children: ReactNode }) {
  const { hasBackendAdminToken } = useAuth();
  const [workspace, setWorkspace] = useState<SettingsWorkspaceState>({
    loading: true,
    refreshing: false,
    canUseBackend: false,
    lastRefreshedAt: null,
    invoiceBranding: loadInvoiceCompanyProfile(),
    companyExtras: loadSettingsObject(COMPANY_PROFILE_SETTINGS_STORAGE_KEY, DEFAULT_COMPANY_PROFILE_EXTRAS),
    notificationPreferences: loadSettingsObject(NOTIFICATION_PREFERENCES_STORAGE_KEY, DEFAULT_NOTIFICATION_PREFERENCES),
    billingSubscription: loadSettingsObject(BILLING_SUBSCRIPTION_STORAGE_KEY, DEFAULT_BILLING_SUBSCRIPTION),
    emailIdentity: null,
    bookingPortalSettings: DEFAULT_BOOKING_PORTAL_SETTINGS,
    dealerships: [],
    priorityRules: [],
    services: [],
    technicianCount: 0,
  });
  const loadedOnceRef = useRef(false);

  const refresh = useCallback(async () => {
    const localInvoiceBranding = loadInvoiceCompanyProfile();
    const localCompanyExtras = loadSettingsObject(COMPANY_PROFILE_SETTINGS_STORAGE_KEY, DEFAULT_COMPANY_PROFILE_EXTRAS);
    const localNotificationPreferences = loadSettingsObject(NOTIFICATION_PREFERENCES_STORAGE_KEY, DEFAULT_NOTIFICATION_PREFERENCES);
    const localBillingSubscription = loadSettingsObject(BILLING_SUBSCRIPTION_STORAGE_KEY, DEFAULT_BILLING_SUBSCRIPTION);
    const adminToken = getStoredAdminToken();

    if (!hasBackendAdminToken || !adminToken) {
      setWorkspace({
        loading: false,
        refreshing: false,
        canUseBackend: false,
        lastRefreshedAt: new Date().toISOString(),
        invoiceBranding: localInvoiceBranding,
        companyExtras: localCompanyExtras,
        notificationPreferences: localNotificationPreferences,
        billingSubscription: localBillingSubscription,
        emailIdentity: null,
        bookingPortalSettings: DEFAULT_BOOKING_PORTAL_SETTINGS,
        dealerships: [],
        priorityRules: [],
        services: [],
        technicianCount: 0,
      });
      loadedOnceRef.current = true;
      return;
    }

    setWorkspace((current) => ({
      ...current,
      loading: !loadedOnceRef.current,
      refreshing: loadedOnceRef.current,
      canUseBackend: true,
    }));

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

    const nextInvoiceBranding =
      brandingResult.status === 'fulfilled'
        ? normalizeInvoiceBranding(brandingResult.value)
        : localInvoiceBranding;

    if (brandingResult.status === 'fulfilled') {
      saveInvoiceCompanyProfile(nextInvoiceBranding);
    }

    setWorkspace({
      loading: false,
      refreshing: false,
      canUseBackend: true,
      lastRefreshedAt: new Date().toISOString(),
      invoiceBranding: nextInvoiceBranding,
      companyExtras: localCompanyExtras,
      notificationPreferences: localNotificationPreferences,
      billingSubscription: localBillingSubscription,
      emailIdentity: emailIdentityResult.status === 'fulfilled' ? emailIdentityResult.value : null,
      bookingPortalSettings:
        bookingPortalResult.status === 'fulfilled'
          ? bookingPortalResult.value
          : DEFAULT_BOOKING_PORTAL_SETTINGS,
      dealerships: dealershipsResult.status === 'fulfilled' ? dealershipsResult.value : [],
      priorityRules: rulesResult.status === 'fulfilled' ? rulesResult.value : [],
      services: servicesResult.status === 'fulfilled' ? servicesResult.value : [],
      technicianCount: techniciansResult.status === 'fulfilled' ? techniciansResult.value.length : 0,
    });
    loadedOnceRef.current = true;
  }, [hasBackendAdminToken]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<SettingsWorkspaceContextValue>(() => ({
    ...workspace,
    refresh,
  }), [refresh, workspace]);

  return (
    <SettingsWorkspaceContext.Provider value={value}>
      {children}
    </SettingsWorkspaceContext.Provider>
  );
}

export function useSettingsWorkspace() {
  const context = useContext(SettingsWorkspaceContext);
  if (!context) {
    throw new Error('useSettingsWorkspace must be used within SettingsWorkspaceProvider');
  }
  return context;
}

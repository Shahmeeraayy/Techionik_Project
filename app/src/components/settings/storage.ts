import { safeParseJSON, safeSetItem } from '@/lib/storage';

export const COMPANY_PROFILE_SETTINGS_STORAGE_KEY = 'sm_dispatch_company_profile_settings';
export const NOTIFICATION_PREFERENCES_STORAGE_KEY = 'sm_dispatch_notification_preferences';
export const BILLING_SUBSCRIPTION_STORAGE_KEY = 'sm_dispatch_billing_subscription_settings';

export type CompanyProfileExtras = {
  industryType: string;
  timezone: string;
  primaryColor: string;
  customFooterText: string;
};

export type NotificationPreferences = {
  technicianJobAssignments: boolean;
  technicianJobUpdates: boolean;
  managerEscalations: boolean;
  managerDailySummary: boolean;
  customerBookingConfirmation: boolean;
  customerStatusUpdates: boolean;
  systemEmailDeliverability: boolean;
  systemIntegrationHealth: boolean;
};

export type BillingSubscriptionSettings = {
  planName: string;
  monthlyPrice: string;
  renewalDate: string;
  technicianLimit: number;
  locationLimit: number;
};

export const DEFAULT_COMPANY_PROFILE_EXTRAS: CompanyProfileExtras = {
  industryType: 'Automotive',
  timezone: 'America/Toronto',
  primaryColor: '#4f7cff',
  customFooterText: 'Thank you for choosing NexusOps.',
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  technicianJobAssignments: true,
  technicianJobUpdates: true,
  managerEscalations: true,
  managerDailySummary: true,
  customerBookingConfirmation: true,
  customerStatusUpdates: true,
  systemEmailDeliverability: true,
  systemIntegrationHealth: true,
};

export const DEFAULT_BILLING_SUBSCRIPTION: BillingSubscriptionSettings = {
  planName: 'NexusOps Growth',
  monthlyPrice: '$149/mo',
  renewalDate: '2026-07-01',
  technicianLimit: 25,
  locationLimit: 50,
};

export function loadSettingsObject<T>(key: string, fallback: T): T {
  return safeParseJSON(key, fallback);
}

export function saveSettingsObject<T>(key: string, value: T): void {
  if (typeof window === 'undefined') {
    return;
  }

  safeSetItem(key, JSON.stringify(value));
}


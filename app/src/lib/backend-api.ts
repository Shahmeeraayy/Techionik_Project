import { safeGetItemFromScopes, safeRemoveItemFromScopes, safeSetItem } from '@/lib/storage';

const ADMIN_TOKEN_STORAGE_KEY = 'sm_dispatch_admin_access_token';
const TECHNICIAN_TOKEN_STORAGE_KEY = 'sm_dispatch_technician_access_token';
const API_URL_ENV_KEYS = ['VITE_API_URL', 'VITE_BACKEND_URL'] as const;
const LOCAL_API_FALLBACK = 'http://127.0.0.1:8000';

type RequestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type RequestOptions = {
  method?: RequestMethod;
  token?: string | null;
  body?: unknown;
  headers?: Record<string, string>;
};

type ErrorPayload = {
  detail?: unknown;
};

type DecodedTokenClaims = {
  tenant_id?: string | null;
  app_metadata?: {
    tenant_id?: string | null;
  };
};

type AdminTokenResponse = {
  access_token: string;
  token_type: string;
  expires_at: string;
  role: 'admin';
  tenant_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  tenant_role: 'owner' | 'admin' | 'dispatcher' | 'viewer';
};

type DevTechnicianTokenResponse = {
  access_token: string;
  token_type: string;
  expires_at: string;
  role: 'technician';
  tenant_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  tenant_role: 'technician';
};

export type BackendTechnicianListItem = {
  id: string;
  name: string;
  full_name?: string;
  email: string;
  phone?: string | null;
  profile_picture_url?: string | null;
  status: 'active' | 'deactivated';
  manual_availability: boolean;
  effective_availability: boolean;
  on_leave_now: boolean;
  current_shift_window?: string | null;
  next_time_off_start?: string | null;
  working_days?: number[];
  working_hours_start?: string | null;
  working_hours_end?: string | null;
  after_hours_enabled?: boolean;
  has_pending_email_change_request?: boolean;
  pending_email_change_request_id?: string | null;
  pending_email_change_requested_email?: string | null;
  zones: Array<{ id: string; name: string }>;
  skills: Array<{ id: string; name: string }>;
  current_jobs_count: number;
};

export type BackendOutOfOfficeRange = {
  id: string;
  start_date: string;
  end_date: string;
  reason: string;
  created_at: string;
};

export type BackendTechnicianProfile = {
  id: string;
  name: string;
  full_name: string;
  email: string;
  phone?: string | null;
  profile_picture_url?: string | null;
  status: 'active' | 'deactivated';
  manual_availability: boolean;
  effective_availability: boolean;
  on_leave_now: boolean;
  current_shift_window?: string | null;
  next_time_off_start?: string | null;
  working_days: number[];
  working_hours_start?: string | null;
  working_hours_end?: string | null;
  after_hours_enabled: boolean;
  has_pending_email_change_request: boolean;
  pending_email_change_request_id?: string | null;
  pending_email_change_requested_email?: string | null;
  weekly_schedule: Array<{
    day_of_week: number;
    is_enabled: boolean;
    start_time?: string | null;
    end_time?: string | null;
  }>;
  upcoming_time_off: Array<{
    id: string;
    technician_id: string;
    entry_type: string;
    start_date: string;
    end_date: string;
    reason: string;
    created_at: string;
    cancelled_at?: string | null;
  }>;
  zones: Array<{ id: string; name: string }>;
  skills: Array<{ id: string; name: string }>;
};

export type BackendTechnicianCatalogEntry = {
  id: string;
  name: string;
};

export type BackendEmailChangeRequest = {
  id: string;
  technician_id: string;
  technician_name?: string | null;
  current_email: string;
  requested_email: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requested_at: string;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  remarks?: string | null;
};

export type BackendSignupRequest = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
  updated_at: string;
};

export type BackendTechnicianPasswordResetRequest = {
  id: string;
  technician_id: string;
  technician_name?: string | null;
  technician_email: string;
  technician_phone?: string | null;
  status: 'PENDING' | 'RESOLVED';
  requested_at: string;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  remarks?: string | null;
  updated_at: string;
};

export type BackendTechnicianPasswordResetRequestNotificationResponse = {
  message: string;
};

export type BackendTechnicianPasswordResetLinkIssueResponse = {
  request: BackendTechnicianPasswordResetRequest;
  reset_url: string;
};

export type BackendTechnicianPasswordResetLinkValidationResponse = {
  request_id: string;
  technician_name?: string | null;
  technician_email: string;
  expires_at: string;
};

export type BackendTechnicianPasswordResetCompleteResponse = {
  message: string;
};

export type BackendBookingPortalSettings = {
  is_enabled: boolean;
  estimated_response_time_message: string;
  confirmation_email_body: string;
  visible_service_ids: string[];
  status_lookup_enabled: boolean;
  industry_type: 'automotive' | 'property' | 'general';
  details_field_label?: string | null;
  company_name: string;
  company_logo_url?: string | null;
  admin_contact_email: string;
  admin_contact_phone: string;
};

export type BackendBookingPortalPublicConfig = {
  is_enabled: boolean;
  company_name: string;
  company_logo_url?: string | null;
  admin_contact_email: string;
  admin_contact_phone: string;
  estimated_response_time_message: string;
  status_lookup_enabled: boolean;
  industry_type: 'automotive' | 'property' | 'general';
  details_field_label: string;
  services: Array<{
    id: string;
    name: string;
    category: string;
  }>;
};

export type BackendBookingPortalSubmissionResponse = {
  reference_number: string;
  estimated_response_time_message: string;
};

export type BackendBookingPortalStatusLookupResponse = {
  reference_number: string;
  status: 'Received' | 'Under Review' | 'Job Scheduled' | 'In Progress' | 'Completed';
  assigned_technician_first_name?: string | null;
  estimated_completion_date?: string | null;
};

export type BackendBookingRequest = {
  id: string;
  reference_number: string;
  customer_full_name: string;
  phone_number: string;
  email_address: string;
  service_catalog_id?: string | null;
  service_name: string;
  service_catalog_ids?: string[];
  service_names?: string[];
  asset_details: string;
  preferred_date?: string | null;
  preferred_time_of_day: 'morning' | 'afternoon' | 'evening' | 'no_preference';
  additional_notes?: string | null;
  status: 'RECEIVED' | 'UNDER_REVIEW' | 'JOB_SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED';
  assigned_technician_first_name?: string | null;
  estimated_completion_date?: string | null;
  source: string;
  created_at: string;
  updated_at: string;
};

export type BackendChatAttachment = {
  id: string;
  name: string;
  mime_type: string;
  size_bytes: number;
  data_url: string;
};

export type BackendChatMessage = {
  id: string;
  technician_id: string;
  sender_role: 'admin' | 'technician';
  sender_id: string;
  text?: string | null;
  attachments: BackendChatAttachment[];
  is_broadcast: boolean;
  created_at: string;
  delivered_at?: string | null;
  read_at?: string | null;
};

export type BackendAdminChatConversation = {
  technician_id: string;
  technician_name: string;
  technician_email: string;
  technician_phone?: string | null;
  technician_avatar?: string | null;
  technician_status: 'Available' | 'In Progress' | 'Offline' | 'Out of Office' | string;
  current_jobs_count: number;
  unread_count: number;
  last_message_preview?: string | null;
  last_message_at?: string | null;
};

export type BackendAdminChatUnreadCount = {
  unread_count: number;
};

export type BackendDealership = {
  id: string;
  code: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  postal_code?: string | null;
  status: 'active' | 'inactive';
  notes?: string | null;
  last_job_at?: string | null;
  recent_jobs: Array<{
    id: string;
    job_code: string;
    status: string;
    created_at: string;
    assigned_tech?: string | null;
  }>;
};

export type BackendServiceCatalogItem = {
  id: string;
  code: string;
  name: string;
  sku?: string | null;
  description?: string | null;
  category: string;
  default_price: string | number;
  approval_required: boolean;
  status: 'active' | 'archived';
  notes?: string | null;
  updated_at: string;
  updated_by?: string | null;
};

export type BackendAdminJob = {
  id: string;
  job_code: string;
  status: string;
  dealership_id?: string | null;
  dealership_name?: string | null;
  assigned_technician_id?: string | null;
  assigned_technician_name?: string | null;
  pre_assigned_technician_id?: string | null;
  pre_assigned_technician_name?: string | null;
  pre_assignment_reason?: string | null;
  service_type?: string | null;
  service_names?: string[];
  service_entries?: Array<{
    id: string;
    service_name: string;
    source: string;
    notes?: string | null;
    quantity: string | number;
    unit_price: string | number;
    sort_order: number;
  }>;
  vehicle?: string | null;
  created_at: string;
  updated_at: string;
  requested_service_date?: string | null;
  requested_service_time?: string | null;
  source_system?: string | null;
  source_metadata?: Record<string, unknown> | null;
  last_refused_at?: string | null;
  last_refused_by_technician_id?: string | null;
  last_refused_by_technician_name?: string | null;
  last_refusal_reason?: string | null;
  last_refusal_comment?: string | null;
};

export type BackendTechnicianJobFeedItem = {
  id: string;
  job_code: string;
  status: string;
  dealership_name?: string | null;
  location_name?: string | null;
  location_address?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  admin_notes?: string | null;
  service_name?: string | null;
  service_names?: string[];
  service_entries?: Array<{
    id: string;
    service_name: string;
    source: string;
    notes?: string | null;
    quantity: string | number;
    unit_price: string | number;
    sort_order: number;
  }>;
  vehicle_summary?: string | null;
  zone_name?: string | null;
  requested_service_date?: string | null;
  requested_service_time?: string | null;
  created_at: string;
  updated_at: string;
};

export type BackendTechnicianJobFeed = {
  available_jobs: BackendTechnicianJobFeedItem[];
  my_jobs: BackendTechnicianJobFeedItem[];
};

export type BackendTechnicianJobActionResponse = {
  job_id: string;
  status: string;
};

export type BackendInvoiceBrandingSettings = {
  logo_url?: string | null;
  name: string;
  street_address: string;
  city: string;
  state: string;
  zip_code: string;
  phone: string;
  email: string;
  website: string;
};

export type BackendAdminPasswordChangeResponse = {
  status: string;
  admin_email: string;
  password_changed_at: string;
};

export type BackendAdminCredentialSettings = {
  id: string;
  full_name: string;
  admin_email: string;
  tenant_role: 'owner' | 'admin' | 'dispatcher' | 'viewer';
  status: 'active' | 'deactivated';
  password_changed_at: string;
  updated_at: string;
};

export type BackendAdminUser = {
  id: string;
  full_name: string;
  email: string;
  tenant_role: 'owner' | 'admin' | 'dispatcher' | 'viewer';
  status: 'active' | 'deactivated';
  last_login_at?: string | null;
  password_changed_at: string;
  created_at: string;
  updated_at: string;
};

export type BackendTechnicianPasswordChangeResponse = {
  status: string;
  technician_email: string;
  password_changed_at: string;
};

export type BackendPriorityRule = {
  id: string;
  description: string;
  dealership_id: string;
  service_id?: string | null;
  target_urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  ranking_score: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type BackendInvoiceLineItem = {
  id: string;
  job_id?: string | null;
  product_service: string;
  description?: string | null;
  quantity: string | number;
  qty: string | number;
  rate: string | number;
  amount: string | number;
  tax_code: string;
  tax_rate: string | number;
  tax_amount: string | number;
  line_order: number;
};

export type BackendInvoiceLineItemPayload = {
  product_service: string;
  description?: string | null;
  quantity?: string | number;
  qty?: string | number;
  rate: string | number;
  tax_code: string;
  tax_rate?: string | number | null;
  job_id?: string | null;
};

export type BackendInvoice = {
  id: string;
  invoice_number: string;
  job_code?: string | null;
  dealership_name?: string | null;
  technician_name?: string | null;
  company_info?: BackendInvoiceBrandingSettings | null;
  bill_to?: {
    name?: string | null;
    street?: string | null;
    city?: string | null;
    state?: string | null;
    zip_code?: string | null;
  } | null;
  ship_to?: {
    name?: string | null;
    street?: string | null;
    city?: string | null;
    state?: string | null;
    zip_code?: string | null;
  } | null;
  invoice_date: string;
  terms: 'NET_15' | 'NET_30' | 'CUSTOM';
  custom_term_days?: number | null;
  due_date: string;
  subtotal: string | number;
  sales_tax_total?: string | number | null;
  sales_tax: string | number;
  shipping: string | number;
  total: string | number;
  customer_message?: string | null;
  approval_note?: string | null;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  payment_recorded_at?: string | null;
  voided_at?: string | null;
  created_at: string;
  updated_at: string;
  line_items: BackendInvoiceLineItem[];
};

export type BackendPendingInvoiceApproval = {
  job_id: string;
  job_code: string;
  dealership_name: string;
  technician_name?: string | null;
  service_summary: string;
  vehicle_summary: string;
  completed_at?: string | null;
  estimated_subtotal: string | number;
  estimated_sales_tax: string | number;
  estimated_total: string | number;
  invoice_state: 'pending_approval';
  allowed_actions: string[];
  services: Array<{
    id: string;
    name: string;
    quantity: string | number;
    price: string | number;
    total: string | number;
    tax_code: string;
    tax_rate: string | number;
    source?: string | null;
    notes?: string | null;
  }>;
  items: Array<{
    id: string;
    description: string;
    quantity: string | number;
    unit_price: string | number;
    total: string | number;
  }>;
  bill_to?: {
    name?: string | null;
    street?: string | null;
    city?: string | null;
    state?: string | null;
    zip_code?: string | null;
  } | null;
  ship_to?: {
    name?: string | null;
    street?: string | null;
    city?: string | null;
    state?: string | null;
    zip_code?: string | null;
  } | null;
};

export type BackendPendingInvoiceApprovalIssue = {
  job_id: string;
  job_code: string;
  dealership_name: string;
  technician_name?: string | null;
  service_summary: string;
  vehicle_summary: string;
  completed_at?: string | null;
  estimated_subtotal?: string | number;
  estimated_sales_tax?: string | number;
  estimated_total?: string | number;
  blocking_reasons: string[];
};

export type BackendReportsKpis = {
  jobs_created: number;
  jobs_completed: number;
  avg_completion_minutes: number;
  technician_utilization: number;
  invoice_total: number;
  pending_approvals: number;
};

export type BackendDispatchStatusRow = {
  status: string;
  count: number;
  percentage: number;
};

export type BackendDispatchOverviewMetrics = {
  average_time_to_assignment: string;
  average_time_to_completion: string;
  accepted_rate: number;
  refused_rate: number;
  jobs_by_urgency: BackendDispatchStatusRow[];
};

export type BackendIntakeChannelRow = {
  source_channel: string;
  intake_records: number;
  converted_jobs: number;
  conversion_rate: number;
};

export type BackendIntakeDismissedReasonRow = {
  reason: string;
  count: number;
  percentage: number;
};

export type BackendIntakeAnalyticsMetrics = {
  total_intake_records: number;
  conversion_rate: number;
  average_time_to_job_creation: string;
  source_channels: BackendIntakeChannelRow[];
  dismissed_reasons: BackendIntakeDismissedReasonRow[];
};

export type BackendInvoiceStatusRow = {
  state: string;
  count: number;
  total_amount: number;
  is_critical: boolean;
};

export type BackendInvoiceBlockedReasonRow = {
  reason: string;
  count: number;
  percentage: number;
};

export type BackendInvoicePerformanceMetrics = {
  total_invoice_value: number;
  average_approval_turnaround_time: string;
  blocked_reasons: BackendInvoiceBlockedReasonRow[];
};

export type BackendTechnicianPerformanceRow = {
  id: string;
  name: string;
  jobs_assigned: number;
  jobs_completed: number;
  avg_completion_time: string;
  delays_count: number;
  refusals_count: number;
  revenue_generated: number;
  refusal_rate?: number;
  on_time_rate?: number;
  total_service_line_value?: number;
};

export type BackendDealershipPerformanceRow = {
  id: string;
  name: string;
  jobs_created: number;
  jobs_completed: number;
  avg_resolution_time: string;
  invoice_total: number;
  attention_flags: number;
  job_volume?: number;
  most_requested_service_types?: string[];
  avg_job_completion_time?: string;
  sla_compliance_rate?: number;
};

export type BackendCapacityUtilizationRow = {
  day_of_week: string;
  jobs_count: number;
  technician_utilization: number;
  jobs_per_technician: number;
};

export type BackendPeakDemandWindowRow = {
  hour: string;
  jobs_count: number;
};

export type BackendUnderstaffedPeriodRow = {
  period: string;
  jobs_count: number;
  technicians_available: number;
  gap: number;
};

export type BackendCapacityPlanningMetrics = {
  utilization_by_day: BackendCapacityUtilizationRow[];
  peak_demand_windows: BackendPeakDemandWindowRow[];
  jobs_per_technician_trend: BackendCapacityUtilizationRow[];
  understaffed_periods: BackendUnderstaffedPeriodRow[];
};

export type BackendInvoicingDetailRow = {
  technician: string;
  approved_amount: number;
  average_invoice: number;
  growth_percentage?: number | null;
};

export type BackendReportsOverview = {
  generated_at: string;
  from_date: string;
  to_date: string;
  current_period_invoice_count: number;
  revenue_delta: number;
  kpis: BackendReportsKpis;
  dispatch_overview?: BackendDispatchOverviewMetrics;
  intake_analytics?: BackendIntakeAnalyticsMetrics;
  invoice_metrics?: BackendInvoicePerformanceMetrics;
  dispatch_performance: BackendDispatchStatusRow[];
  invoice_performance: BackendInvoiceStatusRow[];
  technician_performance: BackendTechnicianPerformanceRow[];
  dealership_performance: BackendDealershipPerformanceRow[];
  capacity_planning?: BackendCapacityPlanningMetrics;
  invoicing_detail_rows: BackendInvoicingDetailRow[];
};

function getApiBaseUrl(): string {
  const rawValue = API_URL_ENV_KEYS
    .map((key) => import.meta.env[key])
    .find((value) => typeof value === 'string' && value.trim().length > 0);
  const normalized = typeof rawValue === 'string' ? rawValue.trim().replace(/\/$/, '') : '';

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const isLocalHost =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1';

    if (isLocalHost) {
      if (!normalized) {
        return LOCAL_API_FALLBACK;
      }

      try {
        const parsed = new URL(normalized);
        const apiIsLocal =
          parsed.hostname === 'localhost' ||
          parsed.hostname === '127.0.0.1' ||
          parsed.hostname === '::1';

        if (!apiIsLocal) {
          return LOCAL_API_FALLBACK;
        }
      } catch {
        return LOCAL_API_FALLBACK;
      }
    }
  }

  if (!normalized) {
    console.error(
      `Missing ${API_URL_ENV_KEYS.join(' or ')}. Configure the frontend API base URL before making backend requests.`,
    );
    throw new Error('API URL not configured');
  }

  return normalized;
}

export function assertApiUrlConfigured(): void {
  void getApiBaseUrl();
}

/**
 * Fire-and-forget ping to wake up the backend (e.g. Render free-tier cold start).
 * Silently retries up to 8 times with 5-second gaps until the server responds.
 * Call this once on app mount so the server is warm before the user takes action.
 */
export function warmupBackend(): void {
  let apiBaseUrl: string;
  try {
    apiBaseUrl = getApiBaseUrl();
  } catch {
    return; // API URL not configured — skip
  }

  const MAX_ATTEMPTS = 8;
  const INTERVAL_MS = 5000;

  let attempts = 0;
  const ping = async () => {
    attempts++;
    try {
      const res = await fetch(`${apiBaseUrl}/`, { method: 'GET' });
      if (res.ok) return; // server is up — done
    } catch {
      // server still sleeping
    }
    if (attempts < MAX_ATTEMPTS) {
      setTimeout(() => { void ping(); }, INTERVAL_MS);
    }
  };

  void ping();
}

export function getStoredAdminToken(): string | null {
  const raw = safeGetItemFromScopes(ADMIN_TOKEN_STORAGE_KEY);
  return raw && raw.trim() ? raw : null;
}

export function setStoredAdminToken(token: string, persist = true): void {
  clearStoredAdminToken();
  safeSetItem(ADMIN_TOKEN_STORAGE_KEY, token, persist ? 'local' : 'session');
}

export function clearStoredAdminToken(): void {
  safeRemoveItemFromScopes(ADMIN_TOKEN_STORAGE_KEY);
}

export function getStoredTechnicianToken(): string | null {
  const raw = safeGetItemFromScopes(TECHNICIAN_TOKEN_STORAGE_KEY);
  return raw && raw.trim() ? raw : null;
}

export function setStoredTechnicianToken(token: string, persist = true): void {
  clearStoredTechnicianToken();
  safeSetItem(TECHNICIAN_TOKEN_STORAGE_KEY, token, persist ? 'local' : 'session');
}

export function clearStoredTechnicianToken(): void {
  safeRemoveItemFromScopes(TECHNICIAN_TOKEN_STORAGE_KEY);
}

function decodeJwtClaims(token: string): DecodedTokenClaims | null {
  const parts = token.split('.');
  if (parts.length < 2) {
    return null;
  }

  try {
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const decoded = typeof window !== 'undefined' && typeof window.atob === 'function'
      ? window.atob(padded)
      : atob(padded);
    return JSON.parse(decoded) as DecodedTokenClaims;
  } catch {
    return null;
  }
}

export function getStoredTenantContext(): { tenantId?: string; tenantSlug?: string } {
  const adminToken = getStoredAdminToken();
  if (adminToken) {
    const claims = decodeJwtClaims(adminToken);
    const tenantId = claims?.tenant_id || claims?.app_metadata?.tenant_id || undefined;
    if (tenantId) {
      return { tenantId };
    }
  }

  const technicianToken = getStoredTechnicianToken();
  if (technicianToken) {
    const claims = decodeJwtClaims(technicianToken);
    const tenantId = claims?.tenant_id || claims?.app_metadata?.tenant_id || undefined;
    if (tenantId) {
      return { tenantId };
    }
  }

  return {};
}

async function tryRefreshAdminToken(expiredToken: string): Promise<string | null> {
  const currentAdminToken = getStoredAdminToken();
  if (currentAdminToken && currentAdminToken === expiredToken) {
    clearStoredAdminToken();
  }
  return null;
}

function extractErrorDetail(detail: unknown, fallback: string): string {
  if (typeof detail === 'string' && detail.trim()) {
    return detail;
  }
  if (detail && typeof detail === 'object') {
    try {
      const text = JSON.stringify(detail);
      if (text && text !== '{}') {
        return text;
      }
    } catch {
      // ignore and keep fallback
    }
  }
  return fallback;
}

async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const apiBaseUrl = getApiBaseUrl();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers ?? {}),
  };

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const fetchOnce = () => fetch(`${apiBaseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  let response: Response;
  try {
    response = await fetchOnce();
  } catch {
    // Backend may be waking up (e.g. Render free tier spin-down). Retry up to 5 times with 8 s gaps (40 s total).
    let connected = false;
    for (let i = 0; i < 5; i++) {
      await new Promise((resolve) => setTimeout(resolve, 8000));
      try {
        response = await fetchOnce();
        connected = true;
        break;
      } catch {
        // still starting up
      }
    }
    if (!connected) {
      throw new Error(`Unable to reach backend at ${apiBaseUrl}. The server may still be starting up — please wait a moment and try again.`);
    }
  }

  if (response.status === 401 && options.token) {
    const refreshedToken = await tryRefreshAdminToken(options.token);
    if (refreshedToken) {
      const retryHeaders: Record<string, string> = { ...headers, Authorization: `Bearer ${refreshedToken}` };
      let retryResponse: Response;
      try {
        retryResponse = await fetch(`${apiBaseUrl}${path}`, {
          method: options.method ?? 'GET',
          headers: retryHeaders,
          body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        });
      } catch {
        throw new Error(`Unable to reach backend at ${apiBaseUrl}. Check that the API server is running and CORS is configured.`);
      }
      if (retryResponse.ok) {
        return retryResponse.json() as Promise<T>;
      }
      // Continue with regular error handling below using retry response.
      let detail = `Request failed (${retryResponse.status})`;
      try {
        const payload = await retryResponse.json() as ErrorPayload;
        if (payload?.detail) {
          detail = extractErrorDetail(payload.detail, detail);
        }
      } catch {
        // Keep generic error if backend didn't return JSON.
      }
      throw new Error(detail);
    }
  }

  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const payload = await response.json() as ErrorPayload;
      if (payload?.detail) {
        detail = extractErrorDetail(payload.detail, detail);
      }
    } catch {
      // Keep generic error if backend didn't return JSON.
    }
    throw new Error(detail);
  }

  return response.json() as Promise<T>;
}

export async function fetchAdminToken(payload: {
  email: string;
  password: string;
}): Promise<AdminTokenResponse> {
  return requestJson<AdminTokenResponse>('/auth/admin-token', {
    method: 'POST',
    body: payload,
  });
}

export async function signupAdminOwner(payload: {
  company_name: string;
  workspace_slug: string;
  full_name: string;
  email: string;
  password: string;
}): Promise<AdminTokenResponse> {
  return requestJson<AdminTokenResponse>('/auth/admin-signup', {
    method: 'POST',
    body: payload,
  });
}

export async function fetchDevTechnicianToken(payload: {
  email: string;
  password: string;
}): Promise<DevTechnicianTokenResponse> {
  return requestJson<DevTechnicianTokenResponse>('/auth/dev/technician-token', {
    method: 'POST',
    body: payload,
  });
}

export async function fetchTechnicianToken(payload: {
  email: string;
  password: string;
}): Promise<DevTechnicianTokenResponse> {
  return requestJson<DevTechnicianTokenResponse>('/auth/technician-token', {
    method: 'POST',
    body: payload,
  });
}

export async function fetchAdminTechnicians(token: string): Promise<BackendTechnicianListItem[]> {
  return requestJson<BackendTechnicianListItem[]>('/admin/technicians', {
    token,
  });
}

export async function fetchAdminChatConversations(
  token: string,
  search?: string,
): Promise<BackendAdminChatConversation[]> {
  const suffix = search?.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
  return requestJson<BackendAdminChatConversation[]>(`/admin/chat/conversations${suffix}`, {
    token,
  });
}

export async function fetchAdminChatMessages(
  token: string,
  technicianId: string,
): Promise<BackendChatMessage[]> {
  return requestJson<BackendChatMessage[]>(`/admin/chat/conversations/${technicianId}/messages`, {
    token,
  });
}

export async function sendAdminChatMessage(
  token: string,
  technicianId: string,
  payload: {
    text?: string;
    attachments?: BackendChatAttachment[];
  },
): Promise<BackendChatMessage> {
  return requestJson<BackendChatMessage>(`/admin/chat/conversations/${technicianId}/messages`, {
    method: 'POST',
    token,
    body: payload,
  });
}

export async function broadcastAdminChatMessage(
  token: string,
  payload: {
    text?: string;
    attachments?: BackendChatAttachment[];
  },
): Promise<BackendChatMessage[]> {
  return requestJson<BackendChatMessage[]>('/admin/chat/broadcast', {
    method: 'POST',
    token,
    body: payload,
  });
}

export async function markAdminChatConversationRead(
  token: string,
  technicianId: string,
): Promise<BackendAdminChatUnreadCount> {
  return requestJson<BackendAdminChatUnreadCount>(`/admin/chat/conversations/${technicianId}/read`, {
    method: 'POST',
    token,
  });
}

export async function fetchAdminChatUnreadCount(token: string): Promise<BackendAdminChatUnreadCount> {
  return requestJson<BackendAdminChatUnreadCount>('/admin/chat/unread-count', {
    token,
  });
}

export async function createAdminTechnician(
  token: string,
  payload: {
    name: string;
    email: string;
    phone?: string;
    password?: string;
    status?: 'active' | 'deactivated';
    manual_availability?: boolean;
  },
): Promise<BackendTechnicianProfile> {
  return requestJson<BackendTechnicianProfile>('/admin/technicians', {
    method: 'POST',
    token,
    body: payload,
  });
}

export async function fetchAdminTechnicianJobsFeed(
  token: string,
  technicianId: string,
): Promise<BackendTechnicianJobFeed> {
  return requestJson<BackendTechnicianJobFeed>(`/admin/technicians/${technicianId}/jobs-feed`, {
    token,
  });
}

export async function fetchAdminTechnicianProfile(
  token: string,
  technicianId: string,
): Promise<BackendTechnicianProfile> {
  return requestJson<BackendTechnicianProfile>(`/admin/technicians/${technicianId}`, {
    token,
  });
}

export async function fetchAdminTechnicianZoneCatalog(
  token: string,
): Promise<BackendTechnicianCatalogEntry[]> {
  return requestJson<BackendTechnicianCatalogEntry[]>('/admin/technicians/zones/catalog', {
    token,
  });
}

export async function createAdminTechnicianZoneCatalogEntry(
  token: string,
  name: string,
): Promise<BackendTechnicianCatalogEntry> {
  return requestJson<BackendTechnicianCatalogEntry>('/admin/technicians/zones/catalog', {
    method: 'POST',
    token,
    body: { name },
  });
}

export async function fetchAdminTechnicianSkillCatalog(
  token: string,
): Promise<BackendTechnicianCatalogEntry[]> {
  return requestJson<BackendTechnicianCatalogEntry[]>('/admin/technicians/skills/catalog', {
    token,
  });
}

export async function createAdminTechnicianSkillCatalogEntry(
  token: string,
  name: string,
): Promise<BackendTechnicianCatalogEntry> {
  return requestJson<BackendTechnicianCatalogEntry>('/admin/technicians/skills/catalog', {
    method: 'POST',
    token,
    body: { name },
  });
}

export async function assignAdminTechnicianZone(
  token: string,
  technicianId: string,
  zoneId: string,
): Promise<{ status: string }> {
  return requestJson<{ status: string }>(`/admin/technicians/${technicianId}/zones`, {
    method: 'POST',
    token,
    body: { zone_id: zoneId },
  });
}

export async function removeAdminTechnicianZone(
  token: string,
  technicianId: string,
  zoneId: string,
): Promise<{ status: string }> {
  return requestJson<{ status: string }>(`/admin/technicians/${technicianId}/zones/${zoneId}`, {
    method: 'DELETE',
    token,
  });
}

export async function assignAdminTechnicianSkill(
  token: string,
  technicianId: string,
  skillId: string,
): Promise<{ status: string }> {
  return requestJson<{ status: string }>(`/admin/technicians/${technicianId}/skills`, {
    method: 'POST',
    token,
    body: { skill_id: skillId },
  });
}

export async function removeAdminTechnicianSkill(
  token: string,
  technicianId: string,
  skillId: string,
): Promise<{ status: string }> {
  return requestJson<{ status: string }>(`/admin/technicians/${technicianId}/skills/${skillId}`, {
    method: 'DELETE',
    token,
  });
}

export async function updateAdminTechnicianWeeklySchedule(
  token: string,
  technicianId: string,
  payload: Array<{
    day_of_week: number;
    is_enabled: boolean;
    start_time: string;
    end_time: string;
  }>,
): Promise<BackendTechnicianProfile['weekly_schedule']> {
  return requestJson<BackendTechnicianProfile['weekly_schedule']>(`/admin/technicians/${technicianId}/weekly-schedule`, {
    method: 'PUT',
    token,
    body: payload,
  });
}

export async function fetchAdminTechnicianTimeOff(
  token: string,
  technicianId: string,
): Promise<BackendOutOfOfficeRange[]> {
  return requestJson<BackendOutOfOfficeRange[]>(`/admin/technicians/${technicianId}/time-off`, {
    token,
  });
}

export async function createAdminTechnicianTimeOff(
  token: string,
  technicianId: string,
  payload: {
    start_date: string;
    end_date: string;
    reason: string;
  },
): Promise<BackendOutOfOfficeRange> {
  return requestJson<BackendOutOfOfficeRange>(`/admin/technicians/${technicianId}/time-off`, {
    method: 'POST',
    token,
    body: payload,
  });
}

export async function deleteAdminTechnicianTimeOff(
  token: string,
  technicianId: string,
  timeOffId: string,
): Promise<{ status: string }> {
  return requestJson<{ status: string }>(`/admin/technicians/${technicianId}/time-off/${timeOffId}`, {
    method: 'DELETE',
    token,
  });
}

export async function fetchAdminJobs(token: string): Promise<BackendAdminJob[]> {
  return requestJson<BackendAdminJob[]>('/admin/jobs', {
    token,
  });
}

export async function createAdminJob(
  token: string,
  payload: {
    job_code?: string | null;
    dealership_name: string;
    service_name?: string;
    service_names?: string[];
    vehicle_summary: string;
    pre_assigned_technician_id?: string | null;
    requested_service_date?: string | null;
    requested_service_time?: string | null;
  },
): Promise<BackendAdminJob> {
  return requestJson<BackendAdminJob>('/admin/jobs', {
    method: 'POST',
    token,
    body: payload,
  });
}

export async function updateAdminJob(
  token: string,
  jobId: string,
  payload: {
    dealership_name?: string;
    service_name?: string;
    service_names?: string[];
    vehicle_summary?: string;
    requested_service_date?: string | null;
    requested_service_time?: string | null;
  },
): Promise<BackendAdminJob> {
  return requestJson<BackendAdminJob>(`/admin/jobs/${jobId}`, {
    method: 'PATCH',
    token,
    body: payload,
  });
}

export async function updateAdminJobAssignment(
  token: string,
  jobId: string,
  payload: { assigned_technician_id: string | null },
): Promise<BackendAdminJob> {
  return requestJson<BackendAdminJob>(`/admin/jobs/${jobId}/assignment`, {
    method: 'PATCH',
    token,
    body: payload,
  });
}

export async function confirmAdminJob(
  token: string,
  jobId: string,
): Promise<BackendAdminJob> {
  return requestJson<BackendAdminJob>(`/admin/jobs/${jobId}/confirm`, {
    method: 'POST',
    token,
  });
}

export async function deleteAdminJob(token: string, jobId: string): Promise<{ status: string }> {
  return requestJson<{ status: string }>(`/admin/jobs/${jobId}`, {
    method: 'DELETE',
    token,
  });
}

export async function updateAdminTechnician(
  token: string,
  technicianId: string,
  payload: {
    name?: string;
    email?: string;
    phone?: string;
    password?: string;
    status?: 'active' | 'deactivated';
    manual_availability?: boolean;
  },
): Promise<BackendTechnicianListItem> {
  return requestJson<BackendTechnicianListItem>(`/admin/technicians/${technicianId}`, {
    method: 'PUT',
    token,
    body: payload,
  });
}

export async function createTechnicianSignupRequest(payload: {
  name: string;
  admin_email: string;
  email: string;
  phone?: string;
  password: string;
  tenant_id?: string;
  tenant_slug?: string;
}): Promise<BackendSignupRequest> {
  const headers: Record<string, string> = {};
  if (payload.tenant_id) {
    headers['x-tenant-id'] = payload.tenant_id;
  }
  if (payload.tenant_slug) {
    headers['x-tenant-slug'] = payload.tenant_slug;
  }

  return requestJson<BackendSignupRequest>('/auth/technician-signup-request', {
    method: 'POST',
    headers,
    body: {
      name: payload.name,
      admin_email: payload.admin_email,
      email: payload.email,
      phone: payload.phone,
      password: payload.password,
    },
  });
}

export async function fetchAdminTechnicianSignupRequests(
  token: string,
  status: 'pending' | 'approved' | 'rejected' | 'all' = 'all',
): Promise<BackendSignupRequest[]> {
  const suffix = status === 'all' ? '' : `?status=${status}`;
  return requestJson<BackendSignupRequest[]>(`/admin/technician-signup-requests${suffix}`, { token });
}

export async function approveAdminTechnicianSignupRequest(
  token: string,
  requestId: string,
): Promise<BackendSignupRequest> {
  return requestJson<BackendSignupRequest>(`/admin/technician-signup-requests/${requestId}/approve`, {
    method: 'POST',
    token,
  });
}

export async function rejectAdminTechnicianSignupRequest(
  token: string,
  requestId: string,
  reason?: string,
): Promise<BackendSignupRequest> {
  return requestJson<BackendSignupRequest>(`/admin/technician-signup-requests/${requestId}/reject`, {
    method: 'POST',
    token,
    body: { reason },
  });
}

export async function requestTechnicianPasswordReset(
  payload: { email: string },
): Promise<BackendTechnicianPasswordResetRequestNotificationResponse> {
  return requestJson<BackendTechnicianPasswordResetRequestNotificationResponse>('/auth/technician-password-reset-request', {
    method: 'POST',
    body: payload,
  });
}

export async function fetchAdminTechnicianPasswordResetRequests(
  token: string,
  status: 'PENDING' | 'RESOLVED' = 'PENDING',
): Promise<BackendTechnicianPasswordResetRequest[]> {
  const suffix = `?status=${encodeURIComponent(status)}`;
  return requestJson<BackendTechnicianPasswordResetRequest[]>(`/admin/technician-password-reset-requests${suffix}`, {
    token,
  });
}

export async function resolveAdminTechnicianPasswordResetRequest(
  token: string,
  requestId: string,
  remarks?: string,
): Promise<BackendTechnicianPasswordResetRequest> {
  return requestJson<BackendTechnicianPasswordResetRequest>(`/admin/technician-password-reset-requests/${requestId}/resolve`, {
    method: 'POST',
    token,
    body: { remarks },
  });
}

export async function issueAdminTechnicianPasswordResetLink(
  token: string,
  technicianId: string,
): Promise<BackendTechnicianPasswordResetLinkIssueResponse> {
  return requestJson<BackendTechnicianPasswordResetLinkIssueResponse>('/admin/technician-password-reset-requests/issue', {
    method: 'POST',
    token,
    body: { technician_id: technicianId },
  });
}

export async function fetchTechnicianPasswordResetLink(
  requestId: string,
): Promise<BackendTechnicianPasswordResetLinkValidationResponse> {
  return requestJson<BackendTechnicianPasswordResetLinkValidationResponse>(`/auth/technician-password-reset-request/${requestId}`);
}

export async function completeTechnicianPasswordReset(
  requestId: string,
  payload: { new_password: string },
): Promise<BackendTechnicianPasswordResetCompleteResponse> {
  return requestJson<BackendTechnicianPasswordResetCompleteResponse>(`/auth/technician-password-reset-request/${requestId}/complete`, {
    method: 'POST',
    body: payload,
  });
}

export async function fetchBookingPortalPublicConfig(): Promise<BackendBookingPortalPublicConfig> {
  return requestJson<BackendBookingPortalPublicConfig>('/booking-portal/config');
}

export async function submitBookingPortalRequest(payload: {
  customer_full_name: string;
  phone_number: string;
  email_address: string;
  service_catalog_ids: string[];
  asset_details: string;
  preferred_date?: string | null;
  preferred_time_of_day: 'morning' | 'afternoon' | 'evening' | 'no_preference';
  additional_notes?: string;
}): Promise<BackendBookingPortalSubmissionResponse> {
  return requestJson<BackendBookingPortalSubmissionResponse>('/booking-portal/submit', {
    method: 'POST',
    body: payload,
  });
}

export async function lookupBookingPortalStatus(payload: {
  reference_number: string;
  email_address: string;
}): Promise<BackendBookingPortalStatusLookupResponse> {
  return requestJson<BackendBookingPortalStatusLookupResponse>('/booking-portal/status-lookup', {
    method: 'POST',
    body: payload,
  });
}

export async function fetchAdminBookingPortalSettings(token: string): Promise<BackendBookingPortalSettings> {
  return requestJson<BackendBookingPortalSettings>('/admin/booking-portal/settings', { token });
}

export async function updateAdminBookingPortalSettings(
  token: string,
  payload: {
    is_enabled: boolean;
    estimated_response_time_message: string;
    confirmation_email_body: string;
    visible_service_ids: string[];
    status_lookup_enabled: boolean;
    industry_type: 'automotive' | 'property' | 'general';
    details_field_label?: string | null;
  },
): Promise<BackendBookingPortalSettings> {
  return requestJson<BackendBookingPortalSettings>('/admin/booking-portal/settings', {
    method: 'PUT',
    token,
    body: payload,
  });
}

export async function fetchAdminBookingRequests(token: string): Promise<BackendBookingRequest[]> {
  return requestJson<BackendBookingRequest[]>('/admin/booking-portal/requests', { token });
}

export async function updateAdminBookingRequest(
  token: string,
  bookingId: string,
  payload: {
    status?: 'RECEIVED' | 'UNDER_REVIEW' | 'JOB_SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED';
    assigned_technician_first_name?: string | null;
    estimated_completion_date?: string | null;
  },
): Promise<BackendBookingRequest> {
  return requestJson<BackendBookingRequest>(`/admin/booking-portal/requests/${bookingId}`, {
    method: 'PATCH',
    token,
    body: payload,
  });
}

export async function fetchAdminDealerships(token: string): Promise<BackendDealership[]> {
  return requestJson<BackendDealership[]>('/admin/dealerships', { token });
}

export async function fetchAdminServices(
  token: string,
  includeArchived = true,
): Promise<BackendServiceCatalogItem[]> {
  const suffix = `?include_archived=${includeArchived ? 'true' : 'false'}`;
  return requestJson<BackendServiceCatalogItem[]>(`/admin/services${suffix}`, { token });
}

export async function fetchServicesCatalog(token: string): Promise<BackendServiceCatalogItem[]> {
  return requestJson<BackendServiceCatalogItem[]>('/services', { token });
}

export async function createAdminService(
  token: string,
  payload: {
    code: string;
    name: string;
    category: string;
    default_price: number;
    approval_required?: boolean;
    status?: 'active' | 'archived';
    notes?: string | null;
  },
): Promise<BackendServiceCatalogItem> {
  return requestJson<BackendServiceCatalogItem>('/admin/services', {
    method: 'POST',
    token,
    body: payload,
  });
}

export async function updateAdminService(
  token: string,
  serviceId: string,
  payload: {
    code?: string;
    name?: string;
    category?: string;
    default_price?: number;
    approval_required?: boolean;
    notes?: string | null;
  },
): Promise<BackendServiceCatalogItem> {
  return requestJson<BackendServiceCatalogItem>(`/admin/services/${serviceId}`, {
    method: 'PUT',
    token,
    body: payload,
  });
}

export async function updateAdminServiceStatus(
  token: string,
  serviceId: string,
  status: 'active' | 'archived',
): Promise<BackendServiceCatalogItem> {
  return requestJson<BackendServiceCatalogItem>(`/admin/services/${serviceId}/status`, {
    method: 'PATCH',
    token,
    body: { status },
  });
}

export async function createAdminDealership(
  token: string,
  payload: {
    code?: string;
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    city?: string;
    postal_code?: string;
    notes?: string;
  },
): Promise<BackendDealership> {
  return requestJson<BackendDealership>('/admin/dealerships', {
    method: 'POST',
    token,
    body: payload,
  });
}

export async function updateAdminDealership(
  token: string,
  dealershipId: string,
  payload: {
    name?: string;
    phone?: string;
    email?: string;
    address?: string;
    city?: string;
    postal_code?: string;
    notes?: string;
    status?: 'active' | 'inactive';
  },
): Promise<BackendDealership> {
  return requestJson<BackendDealership>(`/admin/dealerships/${dealershipId}`, {
    method: 'PUT',
    token,
    body: payload,
  });
}

export async function updateAdminDealershipStatus(
  token: string,
  dealershipId: string,
  status: 'active' | 'inactive',
): Promise<BackendDealership> {
  return requestJson<BackendDealership>(`/admin/dealerships/${dealershipId}/status`, {
    method: 'PATCH',
    token,
    body: { status },
  });
}

export async function fetchAdminInvoiceBrandingSettings(
  token: string,
): Promise<BackendInvoiceBrandingSettings> {
  return requestJson<BackendInvoiceBrandingSettings>('/admin/settings/invoice-branding', {
    token,
  });
}

export async function updateAdminInvoiceBrandingSettings(
  token: string,
  payload: BackendInvoiceBrandingSettings,
): Promise<BackendInvoiceBrandingSettings> {
  return requestJson<BackendInvoiceBrandingSettings>('/admin/settings/invoice-branding', {
    method: 'PUT',
    token,
    body: payload,
  });
}

export async function updateAdminPassword(
  token: string,
  payload: {
    current_password: string;
    new_password: string;
  },
): Promise<BackendAdminPasswordChangeResponse> {
  return requestJson<BackendAdminPasswordChangeResponse>('/admin/settings/admin-password', {
    method: 'POST',
    token,
    body: payload,
  });
}

export async function fetchAdminCredentialSettings(
  token: string,
): Promise<BackendAdminCredentialSettings> {
  return requestJson<BackendAdminCredentialSettings>('/admin/settings/admin-credentials', {
    token,
  });
}

export async function updateAdminCredentialSettings(
  token: string,
  payload: {
    full_name?: string;
    admin_email: string;
    current_password: string;
    new_password?: string;
  },
): Promise<BackendAdminCredentialSettings> {
  return requestJson<BackendAdminCredentialSettings>('/admin/settings/admin-credentials', {
    method: 'PUT',
    token,
    body: payload,
  });
}

export async function fetchAdminPriorityRules(
  token: string,
): Promise<BackendPriorityRule[]> {
  return requestJson<BackendPriorityRule[]>('/admin/settings/priority-rules', {
    token,
  });
}

export async function createAdminPriorityRule(
  token: string,
  payload: {
    description: string;
    dealership_id: string;
    service_id?: string | null;
    target_urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    ranking_score: number;
    is_active?: boolean;
  },
): Promise<BackendPriorityRule> {
  return requestJson<BackendPriorityRule>('/admin/settings/priority-rules', {
    method: 'POST',
    token,
    body: payload,
  });
}

export async function updateAdminPriorityRule(
  token: string,
  ruleId: string,
  payload: {
    description?: string;
    dealership_id?: string;
    service_id?: string | null;
    target_urgency?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    ranking_score?: number;
    is_active?: boolean;
  },
): Promise<BackendPriorityRule> {
  return requestJson<BackendPriorityRule>(`/admin/settings/priority-rules/${ruleId}`, {
    method: 'PATCH',
    token,
    body: payload,
  });
}

export async function deleteAdminPriorityRule(
  token: string,
  ruleId: string,
): Promise<{ status: string }> {
  return requestJson<{ status: string }>(`/admin/settings/priority-rules/${ruleId}`, {
    method: 'DELETE',
    token,
  });
}

export async function fetchInvoices(token: string): Promise<BackendInvoice[]> {
  return requestJson<BackendInvoice[]>('/invoices', { token });
}

export async function createInvoice(
  token: string,
  payload: {
    dispatch_job_ids?: string[];
    line_items?: BackendInvoiceLineItemPayload[];
    replace_dispatch_line_items?: boolean;
    terms?: 'NET_15' | 'NET_30' | 'CUSTOM';
    custom_term_days?: number;
    shipping?: string | number;
    customer_message?: string;
    approval_note?: string;
    status?: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
    bill_to?: {
      name?: string | null;
      street?: string | null;
      city?: string | null;
      state?: string | null;
      zip_code?: string | null;
    } | null;
    ship_to?: {
      name?: string | null;
      street?: string | null;
      city?: string | null;
      state?: string | null;
      zip_code?: string | null;
    } | null;
  },
): Promise<BackendInvoice> {
  return requestJson<BackendInvoice>('/invoices', {
    method: 'POST',
    token,
    body: payload,
  });
}

export async function fetchAdminUsers(
  token: string,
): Promise<BackendAdminUser[]> {
  return requestJson<BackendAdminUser[]>('/admin/settings/admin-users', {
    token,
  });
}

export async function createAdminUser(
  token: string,
  payload: {
    full_name: string;
    email: string;
    password: string;
    tenant_role: 'owner' | 'admin' | 'dispatcher' | 'viewer';
  },
): Promise<BackendAdminUser> {
  return requestJson<BackendAdminUser>('/admin/settings/admin-users', {
    method: 'POST',
    token,
    body: payload,
  });
}

export async function updateAdminUser(
  token: string,
  adminUserId: string,
  payload: {
    full_name?: string;
    email?: string;
    password?: string;
    tenant_role?: 'owner' | 'admin' | 'dispatcher' | 'viewer';
    status?: 'active' | 'deactivated';
  },
): Promise<BackendAdminUser> {
  return requestJson<BackendAdminUser>(`/admin/settings/admin-users/${adminUserId}`, {
    method: 'PATCH',
    token,
    body: payload,
  });
}

export async function updateInvoice(
  token: string,
  invoiceId: string,
  payload: {
    invoice_number?: string;
    terms?: 'NET_15' | 'NET_30' | 'CUSTOM';
    custom_term_days?: number;
    shipping?: string | number;
    customer_message?: string;
    approval_note?: string;
    status?: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
    payment_recorded_at?: string;
    line_items?: BackendInvoiceLineItemPayload[];
    replace_dispatch_line_items?: boolean;
  },
): Promise<BackendInvoice> {
  return requestJson<BackendInvoice>(`/invoices/${invoiceId}`, {
    method: 'PUT',
    token,
    body: payload,
  });
}

export async function markInvoicePaid(
  token: string,
  invoiceId: string,
  payment_recorded_at?: string,
): Promise<BackendInvoice> {
  return requestJson<BackendInvoice>(`/invoices/${invoiceId}/mark-paid`, {
    method: 'POST',
    token,
    body: { payment_recorded_at },
  });
}

export async function voidInvoice(
  token: string,
  invoiceId: string,
): Promise<BackendInvoice> {
  return requestJson<BackendInvoice>(`/invoices/${invoiceId}`, {
    method: 'DELETE',
    token,
  });
}

export async function fetchPendingInvoiceApprovals(token: string): Promise<BackendPendingInvoiceApproval[]> {
  return requestJson<BackendPendingInvoiceApproval[]>('/invoices/pending-approvals', { token });
}

export async function fetchPendingInvoiceApprovalIssues(token: string): Promise<BackendPendingInvoiceApprovalIssue[]> {
  return requestJson<BackendPendingInvoiceApprovalIssue[]>('/invoices/pending-approval-issues', { token });
}

export type BackendPendingInvoiceApprovalDetail = BackendPendingInvoiceApproval & {
  blocking_reasons: string[];
};

export async function fetchPendingInvoiceApprovalDetail(
  token: string,
  jobId: string,
): Promise<BackendPendingInvoiceApprovalDetail> {
  return requestJson<BackendPendingInvoiceApprovalDetail>(`/invoices/pending-approval-jobs/${jobId}`, { token });
}

export async function savePendingInvoiceApprovalDraft(
  token: string,
  jobId: string,
  payload: {
    line_items: BackendInvoiceLineItemPayload[];
  },
): Promise<BackendPendingInvoiceApproval> {
  return requestJson<BackendPendingInvoiceApproval>(`/invoices/pending-approvals/${jobId}/draft`, {
    method: 'PUT',
    token,
    body: payload,
  });
}

export async function fetchTechnicianMeProfile(token: string): Promise<BackendTechnicianProfile> {
  return requestJson<BackendTechnicianProfile>('/technicians/me', { token });
}

export async function fetchTechnicianChatMessages(token: string): Promise<BackendChatMessage[]> {
  return requestJson<BackendChatMessage[]>('/technicians/me/chat/messages', { token });
}

export async function sendTechnicianChatMessage(
  token: string,
  payload: {
    text?: string;
    attachments?: BackendChatAttachment[];
  },
): Promise<BackendChatMessage> {
  return requestJson<BackendChatMessage>('/technicians/me/chat/messages', {
    method: 'POST',
    token,
    body: payload,
  });
}

export async function markTechnicianChatRead(token: string): Promise<{ status: string }> {
  return requestJson<{ status: string }>('/technicians/me/chat/read', {
    method: 'POST',
    token,
  });
}

export async function fetchTechnicianJobsFeed(token: string): Promise<BackendTechnicianJobFeed> {
  return requestJson<BackendTechnicianJobFeed>('/technicians/me/jobs-feed', { token });
}

export async function registerTechnicianPushSubscription(
  token: string,
  subscription: PushSubscriptionJSON,
): Promise<{ status: string }> {
  return requestJson<{ status: string }>('/technicians/me/push-subscriptions', {
    method: 'POST',
    token,
    body: subscription,
  });
}

export async function startTechnicianMyJob(
  token: string,
  jobId: string,
): Promise<BackendTechnicianJobActionResponse> {
  return requestJson<BackendTechnicianJobActionResponse>(`/technicians/me/jobs/${jobId}/start`, {
    method: 'POST',
    token,
  });
}

export async function acceptTechnicianMyJob(
  token: string,
  jobId: string,
): Promise<BackendTechnicianJobActionResponse> {
  return requestJson<BackendTechnicianJobActionResponse>(`/technicians/me/jobs/${jobId}/accept`, {
    method: 'POST',
    token,
  });
}

export async function completeTechnicianMyJob(
  token: string,
  jobId: string,
): Promise<BackendTechnicianJobActionResponse> {
  return requestJson<BackendTechnicianJobActionResponse>(`/technicians/me/jobs/${jobId}/complete`, {
    method: 'POST',
    token,
  });
}

export async function delayTechnicianMyJob(
  token: string,
  jobId: string,
  payload: { minutes?: number; note?: string },
): Promise<BackendTechnicianJobActionResponse> {
  return requestJson<BackendTechnicianJobActionResponse>(`/technicians/me/jobs/${jobId}/delay`, {
    method: 'POST',
    token,
    body: payload,
  });
}

export async function addTechnicianMyJobService(
  token: string,
  jobId: string,
  payload: { service_name: string; notes?: string; quantity?: string | number; unit_price?: string | number },
): Promise<BackendTechnicianJobFeedItem> {
  return requestJson<BackendTechnicianJobFeedItem>(`/technicians/me/jobs/${jobId}/services`, {
    method: 'POST',
    token,
    body: payload,
  });
}

export async function updateTechnicianMyJobService(
  token: string,
  jobId: string,
  serviceId: string,
  payload: { service_name: string; notes?: string; quantity?: string | number; unit_price?: string | number },
): Promise<BackendTechnicianJobFeedItem> {
  return requestJson<BackendTechnicianJobFeedItem>(`/technicians/me/jobs/${jobId}/services/${serviceId}`, {
    method: 'PATCH',
    token,
    body: payload,
  });
}

export async function removeTechnicianMyJobService(
  token: string,
  jobId: string,
  serviceId: string,
): Promise<BackendTechnicianJobFeedItem> {
  return requestJson<BackendTechnicianJobFeedItem>(`/technicians/me/jobs/${jobId}/services/${serviceId}`, {
    method: 'DELETE',
    token,
  });
}

export async function refuseTechnicianMyJob(
  token: string,
  jobId: string,
  payload: { reason?: string; comment?: string },
): Promise<BackendTechnicianJobActionResponse> {
  return requestJson<BackendTechnicianJobActionResponse>(`/technicians/me/jobs/${jobId}/refuse`, {
    method: 'POST',
    token,
    body: payload,
  });
}

export async function acceptTechnicianJob(
  token: string,
  technicianId: string,
  jobId: string,
): Promise<{ message: string; job_id: string; status: string }> {
  return requestJson<{ message: string; job_id: string; status: string }>(`/technicians/${technicianId}/accept/${jobId}`, {
    method: 'POST',
    token,
  });
}

export async function rejectTechnicianJob(
  token: string,
  technicianId: string,
  jobId: string,
  reason: string,
): Promise<{ status: string; message: string }> {
  return requestJson<{ status: string; message: string }>(`/technicians/${technicianId}/reject/${jobId}`, {
    method: 'POST',
    token,
    body: { reason },
  });
}

export async function updateTechnicianMeProfile(
  token: string,
  payload: {
    full_name: string;
    phone?: string | null;
    profile_picture_url?: string | null;
  },
): Promise<BackendTechnicianProfile> {
  return requestJson<BackendTechnicianProfile>('/technicians/me', {
    method: 'PUT',
    token,
    body: payload,
  });
}

export async function updateTechnicianMePassword(
  token: string,
  payload: {
    current_password: string;
    new_password: string;
  },
): Promise<BackendTechnicianPasswordChangeResponse> {
  return requestJson<BackendTechnicianPasswordChangeResponse>('/technicians/me/password', {
    method: 'POST',
    token,
    body: payload,
  });
}

export async function updateTechnicianMeAvailability(
  token: string,
  payload: {
    working_days: number[];
    working_hours_start: string;
    working_hours_end: string;
    after_hours_enabled: boolean;
    out_of_office_ranges: Array<{ start_date: string; end_date: string; note?: string | null }>;
  },
): Promise<BackendTechnicianProfile> {
  return requestJson<BackendTechnicianProfile>('/technicians/me/availability', {
    method: 'PUT',
    token,
    body: payload,
  });
}

export async function requestTechnicianEmailChange(
  token: string,
  payload: { requested_email: string },
): Promise<BackendEmailChangeRequest> {
  return requestJson<BackendEmailChangeRequest>('/technicians/me/email-change-request', {
    method: 'POST',
    token,
    body: payload,
  });
}

export async function fetchTechnicianEmailChangeRequests(token: string): Promise<BackendEmailChangeRequest[]> {
  return requestJson<BackendEmailChangeRequest[]>('/technicians/me/email-change-requests', {
    token,
  });
}

export async function fetchAdminEmailChangeRequests(
  token: string,
  status?: 'PENDING' | 'APPROVED' | 'REJECTED',
): Promise<BackendEmailChangeRequest[]> {
  const suffix = status ? `?status=${encodeURIComponent(status)}` : '';
  return requestJson<BackendEmailChangeRequest[]>(`/admin/email-change-requests${suffix}`, { token });
}

export async function approveAdminEmailChangeRequest(
  token: string,
  requestId: string,
  remarks?: string,
): Promise<BackendEmailChangeRequest> {
  return requestJson<BackendEmailChangeRequest>(`/admin/email-change-requests/${requestId}/approve`, {
    method: 'POST',
    token,
    body: { remarks },
  });
}

export async function rejectAdminEmailChangeRequest(
  token: string,
  requestId: string,
  remarks?: string,
): Promise<BackendEmailChangeRequest> {
  return requestJson<BackendEmailChangeRequest>(`/admin/email-change-requests/${requestId}/reject`, {
    method: 'POST',
    token,
    body: { remarks },
  });
}

export async function fetchAdminReportsOverview(
  token: string,
  params?: { from_date?: string; to_date?: string },
): Promise<BackendReportsOverview> {
  const search = new URLSearchParams();
  if (params?.from_date) search.set('from_date', params.from_date);
  if (params?.to_date) search.set('to_date', params.to_date);
  const suffix = search.toString() ? `?${search.toString()}` : '';
  return requestJson<BackendReportsOverview>(`/admin/reports/overview${suffix}`, { token });
}

import { safeGetItemFromScopes, safeRemoveItemFromScopes, safeSetItem } from '@/lib/storage';

const ADMIN_TOKEN_STORAGE_KEY = 'sm_dispatch_admin_access_token';
const SUPER_ADMIN_TOKEN_STORAGE_KEY = 'sm_dispatch_super_admin_access_token';
const TECHNICIAN_TOKEN_STORAGE_KEY = 'sm_dispatch_technician_access_token';
export const AUTH_SESSION_INVALID_EVENT = 'nexusops:auth-session-invalid';
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
  platform_role?: null;
};

type SuperAdminTokenResponse = {
  access_token: string;
  token_type: string;
  expires_at: string;
  role: 'super_admin';
  tenant_id?: null;
  user_id: string;
  user_name: string;
  user_email: string;
  tenant_role?: null;
  platform_role: 'super_admin' | 'platform_support' | 'billing_admin' | 'security_admin' | 'read_only_auditor';
};

export type BackendSuperAdminSession = {
  role: 'super_admin';
  tenant_id?: null;
  user_id: string;
  user_name: string;
  user_email: string;
  tenant_role?: null;
  platform_role: 'super_admin' | 'platform_support' | 'billing_admin' | 'security_admin' | 'read_only_auditor';
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

export type BackendSuperAdminMetricSummary = {
  total_tenants: number;
  active_tenants: number;
  suspended_tenants: number;
  trial_tenants: number;
  paid_tenants: number;
  payment_failures: number;
  total_platform_users: number;
  security_alerts: number;
};

export type BackendSuperAdminTenantSummary = {
  id: string;
  name: string;
  slug: string;
  industry_type: string;
  platform_status: 'active' | 'trial' | 'payment_pending' | 'suspended' | 'archived' | 'blocked';
  subscription_plan: 'basic' | 'pro' | 'enterprise';
  subscription_status: 'trial' | 'paid' | 'payment_pending' | 'past_due' | 'cancelled' | 'failed';
  owner_name?: string | null;
  owner_email?: string | null;
  users_count: number;
  technicians_count: number;
  payment_failures_count: number;
  created_at: string;
  updated_at: string;
  last_login_at?: string | null;
};

export type BackendSuperAdminSecurityAlert = {
  id: string;
  severity: string;
  title: string;
  message: string;
  tenant_id?: string | null;
  created_at: string;
};

export type BackendSuperAdminDashboard = {
  metrics: BackendSuperAdminMetricSummary;
  recent_tenant_activity: BackendSuperAdminTenantSummary[];
  recent_security_alerts: BackendSuperAdminSecurityAlert[];
  system_health: {
    status: string;
    database: string;
    tenant_scope: string;
    audit_pipeline: string;
    active_platform_users: number;
  };
};

export type BackendSuperAdminFeatureAccess = {
  key: string;
  label: string;
  description: string;
  included_by_plan: boolean;
  enabled: boolean;
  source: 'plan' | 'tenant_flag' | 'manual_override';
  override?: {
    is_enabled: boolean;
    reason?: string | null;
    updated_at?: string | null;
  } | null;
};

export type BackendSuperAdminTenantDetail = {
  tenant: BackendSuperAdminTenantSummary & {
    support_email?: string | null;
    billing_email?: string | null;
    invoice_email?: string | null;
    notification_email?: string | null;
    email_domain?: string | null;
    status_lookup_enabled?: boolean;
    trial_ends_at?: string | null;
    subscription_renewal_at?: string | null;
  };
  subscription: {
    plan: 'basic' | 'pro' | 'enterprise';
    legacy_plan: 'starter' | 'growth' | 'enterprise';
    status: 'trial' | 'paid' | 'payment_pending' | 'past_due' | 'cancelled' | 'failed';
    payment_failures_count: number;
    trial_ends_at?: string | null;
    subscription_renewal_at?: string | null;
  };
  features: BackendSuperAdminFeatureAccess[];
  break_glass_required: boolean;
};

export type BackendSuperAdminTenantUser = {
  id: string;
  kind: 'admin' | 'technician';
  name: string;
  email: string;
  role: string;
  status: string;
  last_login_at?: string | null;
  created_at: string;
};

export type BackendSuperAdminBreakGlassAccess = {
  tenant_users: BackendSuperAdminTenantUser[];
  billing_status: {
    plan: 'basic' | 'pro' | 'enterprise';
    status: string;
    payment_failures_count: number;
    billing_email?: string | null;
    invoice_email?: string | null;
    trial_ends_at?: string | null;
    subscription_renewal_at?: string | null;
  };
  audit_logs: Array<{
    id: string;
    source: 'platform' | 'tenant';
    actor: string;
    role: string;
    action: string;
    module: string;
    status: string;
    reason?: string | null;
    created_at: string;
  }>;
  security_activity: BackendSuperAdminSecurityAlert[];
};

export type BackendSuperAdminAuditLog = {
  id: string;
  actor_name: string;
  actor_role: string;
  tenant_id?: string | null;
  action: string;
  module: string;
  status: string;
  reason?: string | null;
  resource_id?: string | null;
  created_at: string;
};

export type BackendSuperAdminAccessPolicies = {
  feature_catalog: Array<{ key: string; label: string; description: string }>;
  plan_matrix: Record<string, string[]>;
  platform_roles: Array<{ role: string; permissions: string[] }>;
  tenant_roles: Array<{ role: string; permissions: string[] }>;
  validation_flow: string[];
  default_access: string;
};

export type BackendSuperAdminAccessCheck = {
  allowed: boolean;
  tenant_status: string;
  steps: Array<{ label: string; allowed: boolean }>;
  effective_features: BackendSuperAdminFeatureAccess[];
};

export type BackendPlatformFeatureDefault = {
  enabled_by_default: boolean;
  available_by_plan: boolean;
  manual_override_allowed: boolean;
  enterprise_only: boolean;
};

export type BackendSuperAdminPlatformSettings = {
  general: Record<string, string>;
  branding: Record<string, string>;
  organization_defaults: {
    default_plan: string;
    trial_duration_days: number;
    default_enabled_modules: string[];
    default_user_roles: string[];
    default_job_statuses: string[];
    default_invoice_prefix: string;
    default_timezone: string;
    default_currency: string;
    default_technician_limit: number;
    default_storage_limit_gb: number;
  };
  billing: Record<string, string | number | boolean | string[]>;
  feature_defaults: Record<string, BackendPlatformFeatureDefault>;
  security: Record<string, string | number | boolean>;
  email_notifications: Record<string, string | number | boolean | string[]>;
  files_storage: Record<string, string | number | boolean | string[]>;
  integrations: Record<string, string>;
  maintenance: Record<string, string | boolean>;
};

export type BackendSuperAdminPlatformSettingsResponse = {
  settings: BackendSuperAdminPlatformSettings;
  updated_at?: string | null;
  updated_by_role?: string | null;
  last_change_reason?: string | null;
  sensitive_sections: string[];
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
  tenant_slug: string;
  company_name: string;
  company_logo_url?: string | null;
  admin_contact_email: string;
  admin_contact_phone: string;
  public_booking_url: string;
  status_lookup_url: string;
};

export type BackendBookingPortalPublicConfig = {
  is_enabled: boolean;
  tenant_slug: string;
  company_name: string;
  company_logo_url?: string | null;
  admin_contact_email: string;
  admin_contact_phone: string;
  public_booking_url: string;
  status_lookup_url: string;
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
  assigned_technician_id?: string | null;
  assigned_technician_first_name?: string | null;
  estimated_completion_date?: string | null;
};

export type BackendBookingRequest = {
  id: string;
  reference_number: string;
  customer_full_name: string;
  phone_number: string;
  email_address: string;
  service_location_address?: string | null;
  service_location_city?: string | null;
  service_location_state?: string | null;
  service_location_zip_code?: string | null;
  service_catalog_id?: string | null;
  service_name: string;
  service_catalog_ids?: string[];
  service_names?: string[];
  asset_details: string;
  preferred_date?: string | null;
  preferred_time_of_day: 'morning' | 'afternoon' | 'evening' | 'no_preference';
  additional_notes?: string | null;
  status: 'RECEIVED' | 'UNDER_REVIEW' | 'JOB_SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED';
  assigned_technician_id?: string | null;
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
  attachment_type: 'image' | 'document' | 'voice' | string;
  duration_seconds?: number | null;
  preview_url?: string | null;
  download_url?: string | null;
  data_url?: string | null;
};

export type BackendChatMessage = {
  id: string;
  conversation_id: string;
  conversation_type: 'direct' | 'job';
  technician_id: string;
  job_id?: string | null;
  sender_role: 'admin' | 'technician';
  sender_id: string;
  text?: string | null;
  message_type: 'text' | 'attachment' | 'voice' | 'mixed' | string;
  attachments: BackendChatAttachment[];
  is_broadcast: boolean;
  is_pinned: boolean;
  pinned_at?: string | null;
  created_at: string;
  delivered_at?: string | null;
  read_at?: string | null;
};

export type BackendChatConversation = {
  id: string;
  conversation_type: 'direct' | 'job';
  channel_kind: 'direct' | 'group' | 'job';
  title: string;
  technician_id: string;
  technician_name: string;
  technician_email: string;
  technician_phone?: string | null;
  technician_avatar?: string | null;
  technician_status: 'Available' | 'In Progress' | 'Offline' | 'Out of Office' | string;
  current_jobs_count: number;
  job_id?: string | null;
  job_code?: string | null;
  job_status?: string | null;
  unread_count: number;
  pinned_count: number;
  member_count: number;
  member_ids: string[];
  member_names: string[];
  last_message_preview?: string | null;
  last_message_at?: string | null;
};

export type BackendAdminChatConversation = BackendChatConversation;
export type BackendTechnicianChatConversation = BackendChatConversation;

export type BackendAdminChatUnreadCount = {
  unread_count: number;
};

export type BackendChatConversationResolve = {
  conversation: BackendChatConversation;
};

export type BackendChatPinnedMessages = {
  items: BackendChatMessage[];
};

export type BackendChatAuditLog = {
  id: string;
  actor_role: string;
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  created_at: string;
  metadata?: Record<string, unknown> | null;
};

type RawBackendChatAttachment = Partial<BackendChatAttachment> & Pick<
  BackendChatAttachment,
  'id' | 'name' | 'mime_type' | 'size_bytes'
>;

type RawBackendChatMessage = Partial<BackendChatMessage> & Pick<
  BackendChatMessage,
  'id' | 'technician_id' | 'sender_role' | 'sender_id' | 'created_at'
> & {
  attachments?: RawBackendChatAttachment[];
};

type RawBackendChatConversation = Partial<BackendChatConversation> & Pick<
  BackendChatConversation,
  'technician_id' | 'technician_name' | 'technician_email'
>;

const LEGACY_DIRECT_THREAD_PREFIX = 'legacy-direct:';

function buildLegacyDirectConversationId(technicianId: string): string {
  return `${LEGACY_DIRECT_THREAD_PREFIX}${technicianId}`;
}

function parseLegacyDirectTechnicianId(conversationId: string): string | null {
  if (!conversationId.startsWith(LEGACY_DIRECT_THREAD_PREFIX)) {
    return null;
  }
  const technicianId = conversationId.slice(LEGACY_DIRECT_THREAD_PREFIX.length).trim();
  return technicianId || null;
}

function inferLegacyAttachmentType(mimeType: string): BackendChatAttachment['attachment_type'] {
  const normalized = mimeType.trim().toLowerCase();
  if (normalized.startsWith('audio/')) {
    return 'voice';
  }
  if (normalized.startsWith('image/')) {
    return 'image';
  }
  return 'document';
}

function normalizeChatAttachment(attachment: RawBackendChatAttachment): BackendChatAttachment {
  return {
    id: attachment.id,
    name: attachment.name,
    mime_type: attachment.mime_type,
    size_bytes: attachment.size_bytes,
    attachment_type: attachment.attachment_type ?? inferLegacyAttachmentType(attachment.mime_type),
    duration_seconds: attachment.duration_seconds ?? null,
    preview_url: attachment.preview_url ?? null,
    download_url: attachment.download_url ?? null,
    data_url: attachment.data_url ?? null,
  };
}

function resolveLegacyMessageType(
  text: string | null | undefined,
  attachments: BackendChatAttachment[],
): BackendChatMessage['message_type'] {
  if (attachments.length > 0 && text) {
    return 'mixed';
  }
  if (attachments.length > 0) {
    return attachments.every((attachment) => attachment.attachment_type === 'voice')
      ? 'voice'
      : 'attachment';
  }
  return 'text';
}

function normalizeChatMessage(
  message: RawBackendChatMessage,
  conversationId: string,
  conversationType: BackendChatMessage['conversation_type'] = 'direct',
): BackendChatMessage {
  const attachments = (message.attachments ?? []).map(normalizeChatAttachment);
  return {
    id: message.id,
    conversation_id: message.conversation_id ?? conversationId,
    conversation_type: message.conversation_type ?? conversationType,
    technician_id: message.technician_id,
    job_id: message.job_id ?? null,
    sender_role: message.sender_role,
    sender_id: message.sender_id,
    text: message.text ?? null,
    message_type: message.message_type ?? resolveLegacyMessageType(message.text, attachments),
    attachments,
    is_broadcast: message.is_broadcast ?? false,
    is_pinned: message.is_pinned ?? false,
    pinned_at: message.pinned_at ?? null,
    created_at: message.created_at,
    delivered_at: message.delivered_at ?? null,
    read_at: message.read_at ?? null,
  };
}

function normalizeChatConversation(conversation: RawBackendChatConversation): BackendChatConversation {
  const conversationType = conversation.conversation_type ?? 'direct';
  const memberIds = (conversation.member_ids ?? []).filter(Boolean);
  const memberNames = (conversation.member_names ?? []).filter(Boolean);
  const memberCount = conversation.member_count ?? memberIds.length ?? 0;
  const channelKind = conversation.channel_kind
    ?? (conversationType === 'job' ? 'job' : (Math.max(memberCount, memberIds.length, memberNames.length) > 1 ? 'group' : 'direct'));
  const normalizedTechnicianName = conversation.technician_name.trim();
  const fallbackTitle = channelKind === 'job'
    ? (conversation.job_code?.trim() ? `Job ${conversation.job_code.trim()}` : `Job chat with ${normalizedTechnicianName}`)
    : channelKind === 'group'
      ? (conversation.title?.trim() || (memberNames.length > 0 ? `${memberNames[0]} Group` : 'Technician Group'))
    : `Dispatch with ${normalizedTechnicianName}`;

  return {
    id: conversation.id?.trim() || buildLegacyDirectConversationId(conversation.technician_id),
    conversation_type: conversationType,
    channel_kind: channelKind,
    title: conversation.title?.trim() || fallbackTitle,
    technician_id: conversation.technician_id,
    technician_name: normalizedTechnicianName,
    technician_email: conversation.technician_email,
    technician_phone: conversation.technician_phone ?? null,
    technician_avatar: conversation.technician_avatar ?? null,
    technician_status: conversation.technician_status ?? 'Offline',
    current_jobs_count: conversation.current_jobs_count ?? 0,
    job_id: conversation.job_id ?? null,
    job_code: conversation.job_code ?? null,
    job_status: conversation.job_status ?? null,
    unread_count: conversation.unread_count ?? 0,
    pinned_count: conversation.pinned_count ?? 0,
    member_count: Math.max(memberCount, memberIds.length, memberNames.length, 1),
    member_ids: memberIds.length > 0 ? memberIds : [conversation.technician_id],
    member_names: memberNames.length > 0 ? memberNames : [normalizedTechnicianName],
    last_message_preview: conversation.last_message_preview ?? null,
    last_message_at: conversation.last_message_at ?? null,
  };
}

function filterChatMessagesBySearch(messages: BackendChatMessage[], search?: string): BackendChatMessage[] {
  const query = search?.trim().toLowerCase();
  if (!query) {
    return messages;
  }
  return messages.filter((message) => {
    const text = (message.text ?? '').toLowerCase();
    const attachmentMatch = message.attachments.some((attachment) => attachment.name.toLowerCase().includes(query));
    return text.includes(query) || attachmentMatch;
  });
}

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

export type BackendAdminJobTimelineEvent = {
  id: string;
  event_type: string;
  actor_type: 'SYSTEM' | 'ADMIN' | 'TECHNICIAN' | string;
  created_at: string;
  payload_json?: Record<string, unknown> | null;
};

export type BackendAdminJobDetail = BackendAdminJob & {
  internal_notes?: string | null;
  timeline: BackendAdminJobTimelineEvent[];
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

export type BackendTenantEmailIdentity = {
  tenant_id: string;
  company_name: string;
  tenant_slug: string;
  support_email: string;
  billing_email: string;
  invoice_email: string;
  notification_email: string;
  email_domain: string;
  email_sending_status: string;
  email_verified: boolean;
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
  customer_email?: string | null;
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

    if (isLocalHost && !normalized) {
      return LOCAL_API_FALLBACK;
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

export function buildBackendUrl(path: string): string {
  return `${getApiBaseUrl()}${path}`;
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
    return; // API URL not configured - skip
  }

  const MAX_ATTEMPTS = 8;
  const INTERVAL_MS = 5000;

  let attempts = 0;
  const ping = async () => {
    attempts++;
    try {
      const res = await fetch(`${apiBaseUrl}/`, { method: 'GET' });
      if (res.ok) return; // server is up - done
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

export function getStoredSuperAdminToken(): string | null {
  const raw = safeGetItemFromScopes(SUPER_ADMIN_TOKEN_STORAGE_KEY);
  return raw && raw.trim() ? raw : null;
}

export function setStoredSuperAdminToken(token: string, persist = true): void {
  clearStoredSuperAdminToken();
  safeSetItem(SUPER_ADMIN_TOKEN_STORAGE_KEY, token, persist ? 'local' : 'session');
}

export function clearStoredSuperAdminToken(): void {
  safeRemoveItemFromScopes(SUPER_ADMIN_TOKEN_STORAGE_KEY);
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

type AuthSessionInvalidRole = 'admin' | 'super_admin' | 'technician' | 'unknown';

function dispatchAuthSessionInvalid(role: AuthSessionInvalidRole): void {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') {
    return;
  }

  window.dispatchEvent(new CustomEvent(AUTH_SESSION_INVALID_EVENT, {
    detail: { role },
  }));
}

function invalidateStoredAuthToken(token: string): void {
  if (!token) {
    return;
  }

  const superAdminToken = getStoredSuperAdminToken();
  if (superAdminToken && superAdminToken === token) {
    clearStoredSuperAdminToken();
    dispatchAuthSessionInvalid('super_admin');
    return;
  }

  const adminToken = getStoredAdminToken();
  if (adminToken && adminToken === token) {
    clearStoredAdminToken();
    dispatchAuthSessionInvalid('admin');
    return;
  }

  const technicianToken = getStoredTechnicianToken();
  if (technicianToken && technicianToken === token) {
    clearStoredTechnicianToken();
    dispatchAuthSessionInvalid('technician');
    return;
  }

  dispatchAuthSessionInvalid('unknown');
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
  void expiredToken;
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

  const fetchWithRetry = async (): Promise<Response> => {
    try {
      return await fetchOnce();
    } catch {
      // Backend may be waking up (e.g. Render free tier spin-down). Retry up to 5 times with 8 s gaps (40 s total).
      for (let i = 0; i < 5; i++) {
        await new Promise((resolve) => setTimeout(resolve, 8000));
        try {
          return await fetchOnce();
        } catch {
          // still starting up
        }
      }
      throw new Error(`Unable to reach backend at ${apiBaseUrl}. The server may still be starting up - please wait a moment and try again.`);
    }
  };

  const response = await fetchWithRetry();

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
      if (retryResponse.status === 401 && refreshedToken) {
        invalidateStoredAuthToken(refreshedToken);
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

    invalidateStoredAuthToken(options.token);
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

export async function fetchSuperAdminToken(payload: {
  email: string;
  password: string;
}): Promise<SuperAdminTokenResponse> {
  return requestJson<SuperAdminTokenResponse>('/auth/super-admin-token', {
    method: 'POST',
    body: payload,
  });
}

export async function fetchSuperAdminSession(token: string): Promise<BackendSuperAdminSession> {
  return requestJson<BackendSuperAdminSession>('/auth/super-admin-session', {
    token,
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

export async function fetchSuperAdminDashboard(token: string): Promise<BackendSuperAdminDashboard> {
  return requestJson<BackendSuperAdminDashboard>('/super-admin/dashboard', { token });
}

export async function fetchSuperAdminTenants(
  token: string,
  filters?: {
    search?: string;
    platform_status?: string;
    subscription_plan?: string;
    subscription_status?: string;
  },
): Promise<BackendSuperAdminTenantSummary[]> {
  const search = new URLSearchParams();
  if (filters?.search) search.set('search', filters.search);
  if (filters?.platform_status) search.set('platform_status', filters.platform_status);
  if (filters?.subscription_plan) search.set('subscription_plan', filters.subscription_plan);
  if (filters?.subscription_status) search.set('subscription_status', filters.subscription_status);
  const suffix = search.toString() ? `?${search.toString()}` : '';
  return requestJson<BackendSuperAdminTenantSummary[]>(`/super-admin/tenants${suffix}`, { token });
}

export async function fetchSuperAdminTenantDetail(
  token: string,
  tenantId: string,
): Promise<BackendSuperAdminTenantDetail> {
  return requestJson<BackendSuperAdminTenantDetail>(`/super-admin/tenants/${tenantId}`, { token });
}

export async function updateSuperAdminTenantProfile(
  token: string,
  tenantId: string,
  payload: {
    name?: string;
    industry_type?: string;
    support_email?: string;
    billing_email?: string;
    invoice_email?: string;
    notification_email?: string;
  },
): Promise<BackendSuperAdminTenantDetail> {
  return requestJson<BackendSuperAdminTenantDetail>(`/super-admin/tenants/${tenantId}/profile`, {
    method: 'PATCH',
    token,
    body: payload,
  });
}

export async function updateSuperAdminTenantStatus(
  token: string,
  tenantId: string,
  payload: {
    status: 'active' | 'trial' | 'payment_pending' | 'suspended' | 'archived' | 'blocked';
    reason?: string;
  },
): Promise<BackendSuperAdminTenantDetail> {
  return requestJson<BackendSuperAdminTenantDetail>(`/super-admin/tenants/${tenantId}/status`, {
    method: 'POST',
    token,
    body: payload,
  });
}

export async function updateSuperAdminTenantPlan(
  token: string,
  tenantId: string,
  payload: {
    subscription_plan: 'basic' | 'pro' | 'enterprise';
    subscription_status?: 'trial' | 'paid' | 'payment_pending' | 'past_due' | 'cancelled' | 'failed';
    reason?: string;
  },
): Promise<BackendSuperAdminTenantDetail> {
  return requestJson<BackendSuperAdminTenantDetail>(`/super-admin/tenants/${tenantId}/plan`, {
    method: 'POST',
    token,
    body: payload,
  });
}

export async function updateSuperAdminTenantFeatures(
  token: string,
  tenantId: string,
  payload: {
    reason?: string;
    entries: Array<{
      feature_key: string;
      is_enabled: boolean;
      reason?: string;
    }>;
  },
): Promise<{ tenant_id: string; features: BackendSuperAdminFeatureAccess[] }> {
  return requestJson<{ tenant_id: string; features: BackendSuperAdminFeatureAccess[] }>(`/super-admin/tenants/${tenantId}/features`, {
    method: 'PUT',
    token,
    body: payload,
  });
}

export async function fetchSuperAdminBreakGlassAccess(
  token: string,
  tenantId: string,
  reason: string,
): Promise<BackendSuperAdminBreakGlassAccess> {
  return requestJson<BackendSuperAdminBreakGlassAccess>(`/super-admin/tenants/${tenantId}/break-glass-access`, {
    method: 'POST',
    token,
    body: { reason },
  });
}

export async function fetchSuperAdminAuditLogs(
  token: string,
  filters?: {
    tenant_id?: string;
    module?: string;
    status?: string;
    search?: string;
  },
): Promise<BackendSuperAdminAuditLog[]> {
  const search = new URLSearchParams();
  if (filters?.tenant_id) search.set('tenant_id', filters.tenant_id);
  if (filters?.module) search.set('module', filters.module);
  if (filters?.status) search.set('status', filters.status);
  if (filters?.search) search.set('search', filters.search);
  const suffix = search.toString() ? `?${search.toString()}` : '';
  return requestJson<BackendSuperAdminAuditLog[]>(`/super-admin/audit-logs${suffix}`, { token });
}

export async function fetchSuperAdminAccessPolicies(token: string): Promise<BackendSuperAdminAccessPolicies> {
  return requestJson<BackendSuperAdminAccessPolicies>('/super-admin/access-policies', { token });
}

export async function runSuperAdminAccessCheck(
  token: string,
  tenantId: string,
  payload: {
    requested_tenant_id?: string;
    resource_tenant_id?: string;
    requested_user_id?: string;
    resource_owner_user_id?: string;
    tenant_role: string;
    permission: string;
    feature_key?: string;
  },
): Promise<BackendSuperAdminAccessCheck> {
  return requestJson<BackendSuperAdminAccessCheck>(`/super-admin/tenants/${tenantId}/access-check`, {
    method: 'POST',
    token,
    body: payload,
  });
}

export async function fetchSuperAdminPlatformSettings(token: string): Promise<BackendSuperAdminPlatformSettingsResponse> {
  return requestJson<BackendSuperAdminPlatformSettingsResponse>('/super-admin/platform-settings', { token });
}

export async function updateSuperAdminPlatformSettings(
  token: string,
  payload: {
    settings: BackendSuperAdminPlatformSettings;
    reason?: string;
    sensitive_confirmation?: string;
  },
): Promise<BackendSuperAdminPlatformSettingsResponse> {
  return requestJson<BackendSuperAdminPlatformSettingsResponse>('/super-admin/platform-settings', {
    method: 'PUT',
    token,
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
  const conversations = await requestJson<RawBackendChatConversation[]>(`/admin/chat/conversations${suffix}`, {
    token,
  });
  return conversations.map(normalizeChatConversation);
}

export async function fetchAdminChatThreadMessages(
  token: string,
  conversationId: string,
  search?: string,
): Promise<BackendChatMessage[]> {
  const legacyTechnicianId = parseLegacyDirectTechnicianId(conversationId);
  if (legacyTechnicianId) {
    const messages = await requestJson<RawBackendChatMessage[]>(`/admin/chat/conversations/${legacyTechnicianId}/messages`, {
      token,
    });
    return filterChatMessagesBySearch(
      messages.map((message) => normalizeChatMessage(message, conversationId, 'direct')),
      search,
    );
  }
  const suffix = search?.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
  const messages = await requestJson<RawBackendChatMessage[]>(`/admin/chat/threads/${conversationId}/messages${suffix}`, {
    token,
  });
  return messages.map((message) => normalizeChatMessage(message, conversationId));
}

export async function sendAdminChatThreadMessage(
  token: string,
  conversationId: string,
  payload: {
    text?: string;
    attachments?: BackendChatAttachment[];
  },
): Promise<BackendChatMessage> {
  const legacyTechnicianId = parseLegacyDirectTechnicianId(conversationId);
  if (legacyTechnicianId) {
    const message = await requestJson<RawBackendChatMessage>(`/admin/chat/conversations/${legacyTechnicianId}/messages`, {
      method: 'POST',
      token,
      body: payload,
    });
    return normalizeChatMessage(message, conversationId, 'direct');
  }
  const message = await requestJson<RawBackendChatMessage>(`/admin/chat/threads/${conversationId}/messages`, {
    method: 'POST',
    token,
    body: payload,
  });
  return normalizeChatMessage(message, conversationId);
}

export async function markAdminChatThreadRead(
  token: string,
  conversationId: string,
): Promise<BackendAdminChatUnreadCount> {
  const legacyTechnicianId = parseLegacyDirectTechnicianId(conversationId);
  if (legacyTechnicianId) {
    return requestJson<BackendAdminChatUnreadCount>(`/admin/chat/conversations/${legacyTechnicianId}/read`, {
      method: 'POST',
      token,
    });
  }
  return requestJson<BackendAdminChatUnreadCount>(`/admin/chat/threads/${conversationId}/read`, {
    method: 'POST',
    token,
  });
}

export async function fetchAdminJobChatConversation(
  token: string,
  jobId: string,
): Promise<BackendChatConversationResolve> {
  const resolved = await requestJson<{
    conversation: RawBackendChatConversation;
  }>(`/admin/chat/jobs/${jobId}/conversation`, {
    token,
  });
  return { conversation: normalizeChatConversation(resolved.conversation) };
}

export async function createAdminChatGroup(
  token: string,
  payload: {
    title: string;
    technician_ids: string[];
  },
): Promise<BackendChatConversationResolve> {
  const resolved = await requestJson<{
    conversation: RawBackendChatConversation;
  }>('/admin/chat/groups', {
    method: 'POST',
    token,
    body: payload,
  });
  return { conversation: normalizeChatConversation(resolved.conversation) };
}

export async function updateAdminChatGroup(
  token: string,
  conversationId: string,
  payload: {
    title: string;
    technician_ids: string[];
  },
): Promise<BackendChatConversationResolve> {
  const resolved = await requestJson<{
    conversation: RawBackendChatConversation;
  }>(`/admin/chat/groups/${conversationId}`, {
    method: 'PUT',
    token,
    body: payload,
  });
  return { conversation: normalizeChatConversation(resolved.conversation) };
}

export async function fetchAdminPinnedChatMessages(
  token: string,
  conversationId: string,
): Promise<BackendChatPinnedMessages> {
  const legacyTechnicianId = parseLegacyDirectTechnicianId(conversationId);
  if (legacyTechnicianId) {
    const messages = await requestJson<RawBackendChatMessage[]>(`/admin/chat/conversations/${legacyTechnicianId}/messages`, {
      token,
    });
    return {
      items: messages
        .map((message) => normalizeChatMessage(message, conversationId, 'direct'))
        .filter((message) => message.is_pinned),
    };
  }
  const pinned = await requestJson<{ items: RawBackendChatMessage[] }>(`/admin/chat/threads/${conversationId}/pinned`, {
    token,
  });
  return {
    items: pinned.items.map((message) => normalizeChatMessage(message, conversationId)),
  };
}

export async function pinAdminChatMessage(
  token: string,
  messageId: string,
): Promise<BackendChatMessage> {
  return requestJson<BackendChatMessage>(`/admin/chat/messages/${messageId}/pin`, {
    method: 'POST',
    token,
  });
}

export async function unpinAdminChatMessage(
  token: string,
  messageId: string,
): Promise<BackendChatMessage> {
  return requestJson<BackendChatMessage>(`/admin/chat/messages/${messageId}/pin`, {
    method: 'DELETE',
    token,
  });
}

export async function fetchAdminChatAuditLogs(
  token: string,
  conversationId: string,
): Promise<BackendChatAuditLog[]> {
  if (parseLegacyDirectTechnicianId(conversationId)) {
    return [];
  }
  return requestJson<BackendChatAuditLog[]>(`/admin/chat/threads/${conversationId}/audit-logs`, {
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

export async function fetchAdminJob(
  token: string,
  jobLookup: string,
): Promise<BackendAdminJobDetail> {
  return requestJson<BackendAdminJobDetail>(`/admin/jobs/${encodeURIComponent(jobLookup)}`, {
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

export async function updateAdminJobInternalNotes(
  token: string,
  jobId: string,
  payload: {
    internal_notes?: string | null;
  },
): Promise<BackendAdminJobDetail> {
  return requestJson<BackendAdminJobDetail>(`/admin/jobs/${jobId}/internal-notes`, {
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

function bookingPortalTenantHeaders(tenantSlug?: string | null): Record<string, string> {
  const normalized = tenantSlug?.trim().toLowerCase();
  return normalized ? { 'x-tenant-slug': normalized } : {};
}

export async function fetchBookingPortalPublicConfig(tenantSlug?: string | null): Promise<BackendBookingPortalPublicConfig> {
  return requestJson<BackendBookingPortalPublicConfig>('/booking-portal/config', {
    headers: bookingPortalTenantHeaders(tenantSlug),
  });
}

export async function submitBookingPortalRequest(payload: {
  customer_full_name: string;
  phone_number: string;
  email_address: string;
  service_location_address: string;
  service_location_city?: string | null;
  service_location_state?: string | null;
  service_location_zip_code?: string | null;
  service_catalog_ids: string[];
  asset_details: string;
  preferred_date?: string | null;
  preferred_time_of_day: 'morning' | 'afternoon' | 'evening' | 'no_preference';
  additional_notes?: string;
  tenant_slug?: string | null;
  website?: string | null;
}): Promise<BackendBookingPortalSubmissionResponse> {
  return requestJson<BackendBookingPortalSubmissionResponse>('/booking-portal/submit', {
    method: 'POST',
    headers: bookingPortalTenantHeaders(payload.tenant_slug),
    body: payload,
  });
}

export async function lookupBookingPortalStatus(payload: {
  reference_number: string;
  email_address?: string | null;
  phone_number?: string | null;
  tenant_slug?: string | null;
}): Promise<BackendBookingPortalStatusLookupResponse> {
  return requestJson<BackendBookingPortalStatusLookupResponse>('/booking-portal/status-lookup', {
    method: 'POST',
    headers: bookingPortalTenantHeaders(payload.tenant_slug),
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
    assigned_technician_id?: string | null;
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
    send_email_to?: string;
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

export async function fetchAdminTenantEmailIdentity(
  token: string,
): Promise<BackendTenantEmailIdentity> {
  return requestJson<BackendTenantEmailIdentity>('/admin/settings/email-identity', {
    token,
  });
}

export async function sendInvoiceEmail(
  token: string,
  invoiceId: string,
  recipientEmail?: string,
): Promise<BackendInvoice> {
  return requestJson<BackendInvoice>(`/invoices/${invoiceId}/send-email`, {
    method: 'POST',
    token,
    body: recipientEmail ? { recipient_email: recipientEmail } : undefined,
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

export async function fetchTechnicianChatConversations(
  token: string,
  search?: string,
): Promise<BackendTechnicianChatConversation[]> {
  const suffix = search?.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
  const conversations = await requestJson<RawBackendChatConversation[]>(`/technicians/me/chat/conversations${suffix}`, { token });
  return conversations.map(normalizeChatConversation);
}

export async function fetchTechnicianChatThreadMessages(
  token: string,
  conversationId: string,
  search?: string,
): Promise<BackendChatMessage[]> {
  const legacyTechnicianId = parseLegacyDirectTechnicianId(conversationId);
  if (legacyTechnicianId) {
    const messages = await requestJson<RawBackendChatMessage[]>('/technicians/me/chat/messages', { token });
    return filterChatMessagesBySearch(
      messages.map((message) => normalizeChatMessage(message, conversationId, 'direct')),
      search,
    );
  }
  const suffix = search?.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
  const messages = await requestJson<RawBackendChatMessage[]>(`/technicians/me/chat/threads/${conversationId}/messages${suffix}`, { token });
  return messages.map((message) => normalizeChatMessage(message, conversationId));
}

export async function sendTechnicianChatThreadMessage(
  token: string,
  conversationId: string,
  payload: {
    text?: string;
    attachments?: BackendChatAttachment[];
  },
): Promise<BackendChatMessage> {
  const legacyTechnicianId = parseLegacyDirectTechnicianId(conversationId);
  if (legacyTechnicianId) {
    const message = await requestJson<RawBackendChatMessage>('/technicians/me/chat/messages', {
      method: 'POST',
      token,
      body: payload,
    });
    return normalizeChatMessage(message, conversationId, 'direct');
  }
  const message = await requestJson<RawBackendChatMessage>(`/technicians/me/chat/threads/${conversationId}/messages`, {
    method: 'POST',
    token,
    body: payload,
  });
  return normalizeChatMessage(message, conversationId);
}

export async function markTechnicianChatThreadRead(
  token: string,
  conversationId: string,
): Promise<BackendAdminChatUnreadCount> {
  const legacyTechnicianId = parseLegacyDirectTechnicianId(conversationId);
  if (legacyTechnicianId) {
    await requestJson<{ status: string }>('/technicians/me/chat/read', {
      method: 'POST',
      token,
    });
    return { unread_count: 0 };
  }
  return requestJson<BackendAdminChatUnreadCount>(`/technicians/me/chat/threads/${conversationId}/read`, {
    method: 'POST',
    token,
  });
}

export async function fetchTechnicianJobChatConversation(
  token: string,
  jobId: string,
): Promise<BackendChatConversationResolve> {
  const resolved = await requestJson<{
    conversation: RawBackendChatConversation;
  }>(`/technicians/me/chat/jobs/${jobId}/conversation`, {
    token,
  });
  return { conversation: normalizeChatConversation(resolved.conversation) };
}

export async function fetchTechnicianPinnedChatMessages(
  token: string,
  conversationId: string,
): Promise<BackendChatPinnedMessages> {
  const legacyTechnicianId = parseLegacyDirectTechnicianId(conversationId);
  if (legacyTechnicianId) {
    const messages = await requestJson<RawBackendChatMessage[]>('/technicians/me/chat/messages', { token });
    return {
      items: messages
        .map((message) => normalizeChatMessage(message, conversationId, 'direct'))
        .filter((message) => message.is_pinned),
    };
  }
  const pinned = await requestJson<{ items: RawBackendChatMessage[] }>(`/technicians/me/chat/threads/${conversationId}/pinned`, {
    token,
  });
  return {
    items: pinned.items.map((message) => normalizeChatMessage(message, conversationId)),
  };
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

export type BackendDeviceLogPayload = {
  device_type?: string | null;
  browser_name?: string | null;
  browser_version?: string | null;
  operating_system?: string | null;
  user_agent?: string | null;
  session_id?: string | null;
  app_version?: string | null;
};

export type BackendLocationPayload = {
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  device?: BackendDeviceLogPayload | null;
  job_id?: string | null;
};

export type BackendAttendanceEvent = {
  id: string;
  attendance_session_id: string;
  event_type: 'clock_in' | 'clock_out' | 'break_start' | 'break_end' | string;
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  device_log_id?: string | null;
  geo_fence_validation_id?: string | null;
  occurred_at: string;
};

export type BackendAttendanceSession = {
  id: string;
  technician_id: string;
  clock_in_at: string;
  clock_out_at?: string | null;
  total_minutes: number;
  active_work_minutes: number;
  break_minutes: number;
  status: 'clocked_in' | 'clocked_out' | 'on_break' | string;
  events: BackendAttendanceEvent[];
};

export type BackendLatestLocation = {
  id: string;
  technician_id: string;
  technician_name?: string | null;
  job_id?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  tracking_status: string;
  availability_status: string;
  location_permission_status: string;
  location_consent_given_at?: string | null;
  last_seen_at?: string | null;
  location_state: 'online' | 'recently_active' | 'offline_stale' | 'offline' | string;
  active_job_reference?: string | null;
  attendance_status?: string | null;
};

export type BackendLocationCheckpoint = {
  id: string;
  technician_id: string;
  job_id?: string | null;
  attendance_event_id?: string | null;
  event_type: string;
  job_status?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  captured_at: string;
};

export type BackendAttendanceDashboard = {
  summary: {
    total_technicians: number;
    active_technicians: number;
    on_break: number;
    offline: number;
    total_work_minutes: number;
    total_break_minutes: number;
    geo_fence_warnings: number;
  };
  locations: BackendLatestLocation[];
  reports: Array<{
    technician_id: string;
    technician_name: string;
    total_minutes: number;
    active_work_minutes: number;
    break_minutes: number;
    clock_ins: number;
    first_clock_in_at?: string | null;
    last_clock_out_at?: string | null;
    missed_clock_out: boolean;
    geo_fence_violations: number;
  }>;
  checkpoints: BackendLocationCheckpoint[];
};

export function buildDeviceLogPayload(): BackendDeviceLogPayload {
  const userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  const platform = typeof navigator === 'undefined' ? '' : navigator.platform;
  const browserMatch = userAgent.match(/(Edg|Chrome|Firefox|Safari)\/([\d.]+)/);
  let sessionId = safeGetItemFromScopes('nexusops_session_id');
  if (!sessionId && typeof crypto !== 'undefined') {
    sessionId = crypto.randomUUID();
    safeSetItem('nexusops_session_id', sessionId, 'session');
  }
  return {
    device_type: /Mobi|Android|iPhone|iPad/i.test(userAgent) ? 'mobile' : 'desktop',
    browser_name: browserMatch?.[1] ?? 'Browser',
    browser_version: browserMatch?.[2] ?? null,
    operating_system: platform || null,
    user_agent: userAgent || null,
    session_id: sessionId,
    app_version: 'web-v1',
  };
}

export async function saveTechnicianLocationConsent(
  token: string,
  payload: { status: 'granted' | 'denied' | 'prompt' | 'unknown'; device?: BackendDeviceLogPayload | null },
): Promise<BackendLatestLocation> {
  return requestJson<BackendLatestLocation>('/technician/location/consent', {
    method: 'POST',
    token,
    body: payload,
  });
}

export async function updateTechnicianLocation(
  token: string,
  payload: BackendLocationPayload & { availability_status?: string | null; tracking_status?: string | null },
): Promise<BackendLatestLocation> {
  return requestJson<BackendLatestLocation>('/technician/location/update', {
    method: 'POST',
    token,
    body: payload,
  });
}

export async function createTechnicianLocationCheckpoint(
  token: string,
  payload: BackendLocationPayload & { event_type: string; job_status?: string | null; attendance_event_id?: string | null },
): Promise<BackendLocationCheckpoint> {
  return requestJson<BackendLocationCheckpoint>('/technician/location/checkpoint', {
    method: 'POST',
    token,
    body: payload,
  });
}

export async function fetchTechnicianAttendanceCurrent(token: string): Promise<BackendAttendanceSession | null> {
  return requestJson<BackendAttendanceSession | null>('/technician/attendance/current', { token });
}

export async function fetchTechnicianAttendanceHistory(token: string): Promise<BackendAttendanceSession[]> {
  return requestJson<BackendAttendanceSession[]>('/technician/attendance/history', { token });
}

export async function performTechnicianAttendanceAction(
  token: string,
  action: 'clock-in' | 'clock-out' | 'break/start' | 'break/end',
  payload: BackendLocationPayload,
): Promise<BackendAttendanceSession> {
  return requestJson<BackendAttendanceSession>(`/technician/attendance/${action}`, {
    method: 'POST',
    token,
    body: payload,
  });
}

export async function fetchAdminAttendanceDashboard(token: string): Promise<BackendAttendanceDashboard> {
  return requestJson<BackendAttendanceDashboard>('/admin/attendance/dashboard', { token });
}

export type BackendChatterLocationRequest = {
  id: string;
  conversation_id?: string | null;
  message_id?: string | null;
  admin_id: string;
  technician_id: string;
  status: 'pending' | 'shared' | 'declined' | 'expired';
  requested_at: string;
  responded_at?: string | null;
  expires_at: string;
};

export type BackendChatterSharedLocation = {
  id: string;
  request_id: string;
  conversation_id?: string | null;
  technician_id: string;
  admin_id: string;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  device_log_id?: string | null;
  shared_at: string;
};

export async function createChatterLocationRequest(
  token: string,
  payload: { technician_id: string; conversation_id?: string | null; message_id?: string | null },
): Promise<BackendChatterLocationRequest> {
  return requestJson<BackendChatterLocationRequest>('/chatter/location-request', {
    method: 'POST',
    token,
    body: payload,
  });
}

export async function fetchPendingChatterLocationRequests(token: string): Promise<BackendChatterLocationRequest[]> {
  return requestJson<BackendChatterLocationRequest[]>('/chatter/location-requests/pending', { token });
}

export async function shareChatterLocationRequest(
  token: string,
  requestId: string,
  payload: BackendLocationPayload,
): Promise<BackendChatterSharedLocation> {
  return requestJson<BackendChatterSharedLocation>(`/chatter/location-request/${requestId}/share`, {
    method: 'POST',
    token,
    body: payload,
  });
}

export async function declineChatterLocationRequest(
  token: string,
  requestId: string,
): Promise<BackendChatterLocationRequest> {
  return requestJson<BackendChatterLocationRequest>(`/chatter/location-request/${requestId}/decline`, {
    method: 'POST',
    token,
  });
}

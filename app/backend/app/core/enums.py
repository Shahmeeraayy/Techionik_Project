from enum import Enum


class UserRole(str, Enum):
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    TECHNICIAN = "technician"


class PlatformRole(str, Enum):
    SUPER_ADMIN = "super_admin"
    PLATFORM_SUPPORT = "platform_support"
    BILLING_ADMIN = "billing_admin"
    SECURITY_ADMIN = "security_admin"
    READ_ONLY_AUDITOR = "read_only_auditor"


class TechnicianStatus(str, Enum):
    ACTIVE = "active"
    DEACTIVATED = "deactivated"


class DealershipStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class TimeOffEntryType(str, Enum):
    FULL_DAY = "full_day"
    MULTI_DAY = "multi_day"
    HALF_DAY_MORNING = "half_day_morning"
    HALF_DAY_AFTERNOON = "half_day_afternoon"
    BREAK = "break"


class AuditEntityType(str, Enum):
    TENANT = "tenant"
    TECHNICIAN = "technician"
    BOOKING_REQUEST = "booking_request"
    CHAT_MESSAGE = "chat_message"
    CHAT_CONVERSATION = "chat_conversation"
    CHAT_ATTACHMENT = "chat_attachment"
    CHAT_RECEIPT = "chat_receipt"
    DEALERSHIP = "dealership"
    TECHNICIAN_ZONE = "technician_zone"
    TECHNICIAN_SKILL = "technician_skill"
    TECHNICIAN_SCHEDULE = "technician_schedule"
    TECHNICIAN_TIME_OFF = "technician_time_off"
    TECHNICIAN_EMAIL_CHANGE_REQUEST = "technician_email_change_request"
    TECHNICIAN_PASSWORD_RESET_REQUEST = "technician_password_reset_request"
    JOB = "job"
    INVOICE = "invoice"
    FEATURE_OVERRIDE = "feature_override"
    PLATFORM_USER = "platform_user"
    ACCESS_POLICY = "access_policy"
    SUBSCRIPTION = "subscription"


class JobWorkflowStatus(str, Enum):
    UNKNOWN = "UNKNOWN"
    ADMIN_PREVIEW = "ADMIN_PREVIEW"
    READY_FOR_TECH = "READY_FOR_TECH"
    PENDING_ADMIN_CONFIRMATION = "PENDING_ADMIN_CONFIRMATION"
    PENDING_REVIEW = "PENDING_REVIEW"
    PENDING = "PENDING"
    SCHEDULED = "SCHEDULED"
    IN_PROGRESS = "IN_PROGRESS"
    DELAYED = "DELAYED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class ChatConversationType(str, Enum):
    DIRECT = "direct"
    JOB = "job"


class ChatMessageType(str, Enum):
    TEXT = "text"
    ATTACHMENT = "attachment"
    VOICE = "voice"
    MIXED = "mixed"


class ChatAttachmentType(str, Enum):
    IMAGE = "image"
    DOCUMENT = "document"
    VOICE = "voice"

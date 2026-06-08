CREATE TABLE IF NOT EXISTS public.technician_attendance_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    technician_id uuid NOT NULL REFERENCES public.technicians(id),
    clock_in_at timestamptz NOT NULL,
    clock_out_at timestamptz NULL,
    total_minutes integer NOT NULL DEFAULT 0,
    active_work_minutes integer NOT NULL DEFAULT 0,
    break_minutes integer NOT NULL DEFAULT 0,
    status varchar(32) NOT NULL DEFAULT 'clocked_in',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT technician_attendance_sessions_status_chk CHECK (status IN ('clocked_in','clocked_out','on_break'))
);

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_tenant_technician
    ON public.technician_attendance_sessions (tenant_id, technician_id);

CREATE TABLE IF NOT EXISTS public.technician_attendance_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    technician_id uuid NOT NULL REFERENCES public.technicians(id),
    attendance_session_id uuid NOT NULL REFERENCES public.technician_attendance_sessions(id) ON DELETE CASCADE,
    event_type varchar(32) NOT NULL,
    latitude double precision NULL,
    longitude double precision NULL,
    accuracy double precision NULL,
    device_log_id uuid NULL,
    geo_fence_validation_id uuid NULL,
    occurred_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT technician_attendance_events_type_chk CHECK (event_type IN ('clock_in','clock_out','break_start','break_end'))
);

CREATE INDEX IF NOT EXISTS idx_attendance_events_tenant_session
    ON public.technician_attendance_events (tenant_id, attendance_session_id);

CREATE TABLE IF NOT EXISTS public.technician_locations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    technician_id uuid NOT NULL REFERENCES public.technicians(id),
    job_id uuid NULL REFERENCES public.jobs(id),
    latitude double precision NULL,
    longitude double precision NULL,
    accuracy double precision NULL,
    tracking_status varchar(32) NOT NULL DEFAULT 'offline',
    availability_status varchar(32) NOT NULL DEFAULT 'Offline',
    location_permission_status varchar(32) NOT NULL DEFAULT 'unknown',
    location_consent_given_at timestamptz NULL,
    last_seen_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT technician_locations_tenant_technician_uniq UNIQUE (tenant_id, technician_id)
);

CREATE TABLE IF NOT EXISTS public.technician_location_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    technician_id uuid NOT NULL REFERENCES public.technicians(id),
    job_id uuid NULL REFERENCES public.jobs(id),
    attendance_event_id uuid NULL REFERENCES public.technician_attendance_events(id),
    event_type varchar(64) NOT NULL,
    job_status varchar(64) NULL,
    latitude double precision NULL,
    longitude double precision NULL,
    accuracy double precision NULL,
    captured_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_location_events_tenant_technician
    ON public.technician_location_events (tenant_id, technician_id, captured_at DESC);

CREATE TABLE IF NOT EXISTS public.technician_device_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    technician_id uuid NOT NULL REFERENCES public.technicians(id),
    event_type varchar(64) NOT NULL,
    job_id uuid NULL REFERENCES public.jobs(id),
    attendance_event_id uuid NULL,
    location_event_id uuid NULL,
    device_type varchar(64) NULL,
    browser_name varchar(128) NULL,
    browser_version varchar(64) NULL,
    operating_system varchar(128) NULL,
    ip_address varchar(64) NULL,
    user_agent text NULL,
    session_id varchar(128) NULL,
    app_version varchar(64) NULL,
    captured_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_device_logs_tenant_technician
    ON public.technician_device_logs (tenant_id, technician_id, captured_at DESC);

CREATE TABLE IF NOT EXISTS public.geo_fence_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    name varchar(255) NOT NULL,
    geo_fence_type varchar(64) NOT NULL,
    job_id uuid NULL REFERENCES public.jobs(id),
    branch_id uuid NULL,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    radius_meters integer NOT NULL DEFAULT 200,
    mode varchar(32) NOT NULL DEFAULT 'warning',
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT geo_fence_rules_mode_chk CHECK (mode IN ('warning','strict'))
);

CREATE TABLE IF NOT EXISTS public.geo_fence_validation_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    technician_id uuid NOT NULL REFERENCES public.technicians(id),
    job_id uuid NULL REFERENCES public.jobs(id),
    action_type varchar(64) NOT NULL,
    latitude double precision NULL,
    longitude double precision NULL,
    accuracy double precision NULL,
    target_latitude double precision NULL,
    target_longitude double precision NULL,
    allowed_radius_meters integer NULL,
    distance_from_target_meters double precision NULL,
    geo_fence_status varchar(32) NOT NULL,
    geo_fence_mode varchar(32) NULL,
    validated_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chatter_location_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    conversation_id uuid NULL,
    message_id uuid NULL,
    admin_id uuid NOT NULL,
    technician_id uuid NOT NULL REFERENCES public.technicians(id),
    status varchar(32) NOT NULL DEFAULT 'pending',
    requested_at timestamptz NOT NULL,
    responded_at timestamptz NULL,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chatter_location_requests_status_chk CHECK (status IN ('pending','shared','declined','expired'))
);

CREATE TABLE IF NOT EXISTS public.chatter_shared_locations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    request_id uuid NOT NULL REFERENCES public.chatter_location_requests(id) ON DELETE CASCADE,
    conversation_id uuid NULL,
    technician_id uuid NOT NULL REFERENCES public.technicians(id),
    admin_id uuid NOT NULL,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    accuracy double precision NULL,
    device_log_id uuid NULL,
    shared_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.attendance_audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    actor_id uuid NOT NULL,
    actor_role varchar(32) NOT NULL,
    technician_id uuid NULL,
    job_id uuid NULL,
    attendance_event_id uuid NULL,
    location_event_id uuid NULL,
    conversation_id uuid NULL,
    request_id uuid NULL,
    action varchar(100) NOT NULL,
    metadata jsonb NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

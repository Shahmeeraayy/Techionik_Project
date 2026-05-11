CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE FUNCTION app.current_tenant_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    direct_claim text;
    nested_claim text;
    session_claim text;
BEGIN
    session_claim := nullif(current_setting('app.current_tenant_id', true), '');
    IF session_claim IS NOT NULL THEN
        RETURN session_claim::uuid;
    END IF;

    direct_claim := nullif(current_setting('request.jwt.claim.tenant_id', true), '');
    IF direct_claim IS NOT NULL THEN
        RETURN direct_claim::uuid;
    END IF;

    IF nullif(current_setting('request.jwt.claims', true), '') IS NOT NULL THEN
        nested_claim := (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id');
        IF nested_claim IS NULL OR nested_claim = '' THEN
            nested_claim := (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id');
        END IF;
        IF nested_claim IS NOT NULL AND nested_claim <> '' THEN
            RETURN nested_claim::uuid;
        END IF;
    END IF;

    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION app.current_tenant_role()
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    direct_claim text;
    nested_claim text;
BEGIN
    direct_claim := nullif(current_setting('request.jwt.claim.tenant_role', true), '');
    IF direct_claim IS NOT NULL THEN
        RETURN lower(direct_claim);
    END IF;

    IF nullif(current_setting('request.jwt.claims', true), '') IS NOT NULL THEN
        nested_claim := (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_role');
        IF nested_claim IS NULL OR nested_claim = '' THEN
            nested_claim := (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_role');
        END IF;
        IF nested_claim IS NOT NULL AND nested_claim <> '' THEN
            RETURN lower(nested_claim);
        END IF;
    END IF;

    RETURN nullif(lower(current_setting('request.jwt.claim.role', true)), '');
END;
$$;

CREATE OR REPLACE FUNCTION app.current_tenant_matches(row_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT row_tenant_id = app.current_tenant_id();
$$;

CREATE OR REPLACE FUNCTION app.assign_tenant_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.tenant_id IS NULL THEN
        NEW.tenant_id := app.current_tenant_id();
    END IF;

    IF NEW.tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant_id is required for table %', TG_TABLE_NAME;
    END IF;

    IF NEW.tenant_id <> app.current_tenant_id() AND app.current_tenant_id() IS NOT NULL THEN
        RAISE EXCEPTION 'cross-tenant write blocked for table %', TG_TABLE_NAME;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.tenant_usage_counters (
    tenant_id uuid NOT NULL,
    metric_key text NOT NULL,
    usage_count bigint NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, metric_key)
);

CREATE OR REPLACE FUNCTION app.bump_tenant_usage_counter()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.tenant_usage_counters (tenant_id, metric_key, usage_count, updated_at)
    VALUES (NEW.tenant_id, TG_ARGV[0], 1, now())
    ON CONFLICT (tenant_id, metric_key)
    DO UPDATE SET
        usage_count = public.tenant_usage_counters.usage_count + 1,
        updated_at = now();
    RETURN NEW;
END;
$$;

DO $$
DECLARE
    table_name text;
    tenant_tables text[] := ARRAY[
        'admin_credential_settings',
        'audit_logs',
        'booking_portal_settings',
        'booking_requests',
        'chat_messages',
        'dealerships',
        'email_outbox',
        'invoice_approval_drafts',
        'invoice_branding_settings',
        'invoice_line_items',
        'invoices',
        'job_events',
        'job_rejections',
        'job_services',
        'jobs',
        'priority_rules',
        'service_catalog',
        'technician_signup_requests',
        'skills',
        'technician_email_change_requests',
        'technician_password_reset_requests',
        'technician_skills',
        'technician_time_off',
        'technician_working_hours',
        'technician_zones',
        'technicians',
        'zones'
    ];
BEGIN
    FOREACH table_name IN ARRAY tenant_tables LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_select ON public.%I', table_name);
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_insert ON public.%I', table_name);
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_update ON public.%I', table_name);
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_delete ON public.%I', table_name);

        EXECUTE format(
            'CREATE POLICY tenant_isolation_select ON public.%I FOR SELECT USING (app.current_tenant_matches(tenant_id))',
            table_name
        );
        EXECUTE format(
            'CREATE POLICY tenant_isolation_insert ON public.%I FOR INSERT WITH CHECK (tenant_id = app.current_tenant_id())',
            table_name
        );
        EXECUTE format(
            'CREATE POLICY tenant_isolation_update ON public.%I FOR UPDATE USING (app.current_tenant_matches(tenant_id)) WITH CHECK (tenant_id = app.current_tenant_id())',
            table_name
        );
        EXECUTE format(
            'CREATE POLICY tenant_isolation_delete ON public.%I FOR DELETE USING (app.current_tenant_matches(tenant_id))',
            table_name
        );

        IF NOT EXISTS (
            SELECT 1
            FROM pg_trigger
            WHERE tgname = format('%s_assign_tenant_id', table_name)
        ) THEN
            EXECUTE format(
                'CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION app.assign_tenant_id()',
                table_name || '_assign_tenant_id',
                table_name
            );
        END IF;
    END LOOP;
END $$;

DROP TRIGGER IF EXISTS booking_requests_usage_counter ON public.booking_requests;
CREATE TRIGGER booking_requests_usage_counter
AFTER INSERT ON public.booking_requests
FOR EACH ROW EXECUTE FUNCTION app.bump_tenant_usage_counter('booking_requests');

DROP TRIGGER IF EXISTS jobs_usage_counter ON public.jobs;
CREATE TRIGGER jobs_usage_counter
AFTER INSERT ON public.jobs
FOR EACH ROW EXECUTE FUNCTION app.bump_tenant_usage_counter('jobs');

DROP TRIGGER IF EXISTS email_outbox_usage_counter ON public.email_outbox;
CREATE TRIGGER email_outbox_usage_counter
AFTER INSERT ON public.email_outbox
FOR EACH ROW EXECUTE FUNCTION app.bump_tenant_usage_counter('queued_emails');

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'storage'
          AND table_name = 'objects'
    ) THEN
        BEGIN
            EXECUTE 'ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY';
            EXECUTE 'DROP POLICY IF EXISTS tenant_storage_select ON storage.objects';
            EXECUTE 'DROP POLICY IF EXISTS tenant_storage_insert ON storage.objects';
            EXECUTE 'DROP POLICY IF EXISTS tenant_storage_update ON storage.objects';
            EXECUTE 'DROP POLICY IF EXISTS tenant_storage_delete ON storage.objects';

            EXECUTE $policy$
                CREATE POLICY tenant_storage_select ON storage.objects
                FOR SELECT
                USING (
                    (storage.foldername(name))[1] = app.current_tenant_id()::text
                )
            $policy$;

            EXECUTE $policy$
                CREATE POLICY tenant_storage_insert ON storage.objects
                FOR INSERT
                WITH CHECK (
                    (storage.foldername(name))[1] = app.current_tenant_id()::text
                )
            $policy$;

            EXECUTE $policy$
                CREATE POLICY tenant_storage_update ON storage.objects
                FOR UPDATE
                USING (
                    (storage.foldername(name))[1] = app.current_tenant_id()::text
                )
                WITH CHECK (
                    (storage.foldername(name))[1] = app.current_tenant_id()::text
                )
            $policy$;

            EXECUTE $policy$
                CREATE POLICY tenant_storage_delete ON storage.objects
                FOR DELETE
                USING (
                    (storage.foldername(name))[1] = app.current_tenant_id()::text
                )
            $policy$;
        EXCEPTION
            WHEN insufficient_privilege THEN
                RAISE NOTICE 'Skipping storage.objects policy bootstrap because current database user does not own the table.';
        END;
    END IF;
END $$;

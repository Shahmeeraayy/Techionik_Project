DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_name = 'technician_signup_requests'
          AND constraint_type = 'UNIQUE'
          AND constraint_name = 'technician_signup_requests_email_key'
    ) THEN
        ALTER TABLE technician_signup_requests
        DROP CONSTRAINT technician_signup_requests_email_key;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_name = 'technician_signup_requests'
          AND constraint_type = 'UNIQUE'
          AND constraint_name = 'technician_signup_requests_tenant_email_uq'
    ) THEN
        ALTER TABLE technician_signup_requests
        ADD CONSTRAINT technician_signup_requests_tenant_email_uq UNIQUE (tenant_id, email);
    END IF;
END $$;

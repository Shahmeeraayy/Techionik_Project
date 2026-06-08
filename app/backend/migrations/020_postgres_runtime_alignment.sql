ALTER TABLE public.tenants
    ADD COLUMN IF NOT EXISTS industry_type VARCHAR(64) NOT NULL DEFAULT 'general_services',
    ADD COLUMN IF NOT EXISTS platform_status VARCHAR(32) NOT NULL DEFAULT 'trial',
    ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(32) NOT NULL DEFAULT 'pro',
    ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(32) NOT NULL DEFAULT 'trial',
    ADD COLUMN IF NOT EXISTS payment_failures_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS subscription_renewal_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL;

ALTER TABLE public.invoices
    ADD COLUMN IF NOT EXISTS approval_note TEXT;

ALTER TABLE public.service_catalog
    ADD COLUMN IF NOT EXISTS sku VARCHAR(128),
    ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE public.job_services
    ADD COLUMN IF NOT EXISTS quantity NUMERIC(10, 2) NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.booking_requests
    ADD COLUMN IF NOT EXISTS service_location_address TEXT,
    ADD COLUMN IF NOT EXISTS service_location_city VARCHAR(128),
    ADD COLUMN IF NOT EXISTS service_location_state VARCHAR(128),
    ADD COLUMN IF NOT EXISTS service_location_zip_code VARCHAR(32),
    ADD COLUMN IF NOT EXISTS service_catalog_ids JSONB,
    ADD COLUMN IF NOT EXISTS service_names JSONB,
    ADD COLUMN IF NOT EXISTS assigned_technician_id UUID NULL REFERENCES public.technicians(id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'job_services_quantity_non_negative_chk'
          AND conrelid = 'public.job_services'::regclass
    ) THEN
        ALTER TABLE public.job_services
            ADD CONSTRAINT job_services_quantity_non_negative_chk CHECK (quantity >= 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'job_services_unit_price_non_negative_chk'
          AND conrelid = 'public.job_services'::regclass
    ) THEN
        ALTER TABLE public.job_services
            ADD CONSTRAINT job_services_unit_price_non_negative_chk CHECK (unit_price >= 0);
    END IF;
END $$;

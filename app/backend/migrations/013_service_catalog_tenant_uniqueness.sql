DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'service_catalog_code_key'
          AND conrelid = 'public.service_catalog'::regclass
    ) THEN
        ALTER TABLE public.service_catalog
            DROP CONSTRAINT service_catalog_code_key;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'service_catalog_tenant_code_uq'
          AND conrelid = 'public.service_catalog'::regclass
    ) THEN
        ALTER TABLE public.service_catalog
            ADD CONSTRAINT service_catalog_tenant_code_uq UNIQUE (tenant_id, code);
    END IF;
END $$;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS app;

ALTER TABLE public.technicians
    ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(50),
    ADD COLUMN IF NOT EXISTS emergency_contact_relationship VARCHAR(128),
    ADD COLUMN IF NOT EXISTS employment_status VARCHAR(32) NOT NULL DEFAULT 'full_time';

UPDATE public.technicians
SET status = 'suspended'
WHERE status = 'deactivated';

UPDATE public.technicians
SET employment_status = 'full_time'
WHERE employment_status IS NULL
   OR employment_status NOT IN ('full_time','part_time','contractor','probation','inactive','terminated');

ALTER TABLE public.technicians
    DROP CONSTRAINT IF EXISTS technicians_status_chk,
    DROP CONSTRAINT IF EXISTS technicians_employment_status_chk;

ALTER TABLE public.technicians
    ADD CONSTRAINT technicians_status_chk
        CHECK (status IN ('active','suspended')),
    ADD CONSTRAINT technicians_employment_status_chk
        CHECK (employment_status IN ('full_time','part_time','contractor','probation','inactive','terminated'));

CREATE TABLE IF NOT EXISTS public.technician_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    technician_id UUID NOT NULL REFERENCES public.technicians(id) ON DELETE CASCADE,
    document_name VARCHAR(255) NOT NULL,
    document_type VARCHAR(64) NOT NULL,
    license_number VARCHAR(128),
    expiry_date DATE,
    file_url TEXT,
    uploaded_file_id VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT technician_documents_type_chk
        CHECK (document_type IN ('license','certification','insurance','background_check','other'))
);

CREATE INDEX IF NOT EXISTS ix_technician_documents_tenant_id ON public.technician_documents (tenant_id);
CREATE INDEX IF NOT EXISTS ix_technician_documents_technician_id ON public.technician_documents (technician_id);

ALTER TABLE public.technician_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_select ON public.technician_documents;
DROP POLICY IF EXISTS tenant_isolation_insert ON public.technician_documents;
DROP POLICY IF EXISTS tenant_isolation_update ON public.technician_documents;
DROP POLICY IF EXISTS tenant_isolation_delete ON public.technician_documents;

CREATE POLICY tenant_isolation_select ON public.technician_documents
    FOR SELECT USING (app.current_tenant_matches(tenant_id));
CREATE POLICY tenant_isolation_insert ON public.technician_documents
    FOR INSERT WITH CHECK (tenant_id = app.current_tenant_id());
CREATE POLICY tenant_isolation_update ON public.technician_documents
    FOR UPDATE USING (app.current_tenant_matches(tenant_id))
    WITH CHECK (tenant_id = app.current_tenant_id());
CREATE POLICY tenant_isolation_delete ON public.technician_documents
    FOR DELETE USING (app.current_tenant_matches(tenant_id));

DROP TRIGGER IF EXISTS technician_documents_assign_tenant_id ON public.technician_documents;
CREATE TRIGGER technician_documents_assign_tenant_id
    BEFORE INSERT OR UPDATE ON public.technician_documents
    FOR EACH ROW EXECUTE FUNCTION app.assign_tenant_id();

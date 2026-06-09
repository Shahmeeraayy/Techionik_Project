CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    recipient_user_id UUID NULL,
    recipient_role VARCHAR(32) NOT NULL,
    event_type VARCHAR(64) NOT NULL DEFAULT 'legacy',
    title VARCHAR(160) NOT NULL DEFAULT 'Notification',
    message TEXT NOT NULL,
    payload JSONB NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    delivered_at TIMESTAMPTZ NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'delivered'
);

ALTER TABLE public.notifications
    ADD COLUMN IF NOT EXISTS tenant_id UUID,
    ADD COLUMN IF NOT EXISTS recipient_user_id UUID NULL,
    ADD COLUMN IF NOT EXISTS recipient_role VARCHAR(32),
    ADD COLUMN IF NOT EXISTS event_type VARCHAR(64) NOT NULL DEFAULT 'legacy',
    ADD COLUMN IF NOT EXISTS title VARCHAR(160) NOT NULL DEFAULT 'Notification',
    ADD COLUMN IF NOT EXISTS message TEXT,
    ADD COLUMN IF NOT EXISTS payload JSONB NULL,
    ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'delivered';

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'notifications'
          AND column_name = 'metadata'
    ) THEN
        EXECUTE '
            UPDATE public.notifications
            SET payload = COALESCE(payload, metadata::jsonb)
            WHERE metadata IS NOT NULL AND payload IS NULL
        ';
    END IF;
END $$;

UPDATE public.notifications
SET tenant_id = COALESCE(tenant_id, '00000000-0000-0000-0000-000000000001'::uuid)
WHERE tenant_id IS NULL;

UPDATE public.notifications
SET recipient_role = COALESCE(NULLIF(TRIM(recipient_role), ''), 'admin')
WHERE recipient_role IS NULL OR TRIM(recipient_role) = '';

UPDATE public.notifications
SET message = COALESCE(message, 'Notification')
WHERE message IS NULL;

UPDATE public.notifications
SET status = CASE
    WHEN COALESCE(is_read, FALSE) THEN 'read'
    WHEN status IS NULL OR TRIM(status) = '' THEN 'delivered'
    ELSE status
END;

ALTER TABLE public.notifications
    ALTER COLUMN tenant_id SET NOT NULL,
    ALTER COLUMN recipient_role SET NOT NULL,
    ALTER COLUMN message SET NOT NULL,
    ALTER COLUMN created_at SET NOT NULL,
    ALTER COLUMN is_read SET NOT NULL,
    ALTER COLUMN status SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'notifications_recipient_role_chk'
          AND conrelid = 'public.notifications'::regclass
    ) THEN
        ALTER TABLE public.notifications
            ADD CONSTRAINT notifications_recipient_role_chk
            CHECK (recipient_role IN ('admin','technician'));
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'notifications_status_chk'
          AND conrelid = 'public.notifications'::regclass
    ) THEN
        ALTER TABLE public.notifications
            ADD CONSTRAINT notifications_status_chk
            CHECK (status IN ('created','delivered','read'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_notifications_recipient_lookup
    ON public.notifications (tenant_id, recipient_role, recipient_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_notifications_unread_lookup
    ON public.notifications (tenant_id, recipient_role, recipient_user_id, is_read, created_at DESC);

CREATE TABLE IF NOT EXISTS public.platform_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key varchar(64) NOT NULL UNIQUE,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_by_user_id uuid NULL,
    updated_by_role varchar(64) NULL,
    last_change_reason text NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_settings_key ON public.platform_settings (key);

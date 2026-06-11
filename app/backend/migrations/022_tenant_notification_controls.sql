ALTER TABLE public.tenants
    ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS in_app_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS browser_push_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS invoice_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE public.tenants
SET email_notifications_enabled = COALESCE(email_notifications_enabled, TRUE),
    in_app_notifications_enabled = COALESCE(in_app_notifications_enabled, TRUE),
    browser_push_notifications_enabled = COALESCE(browser_push_notifications_enabled, TRUE),
    invoice_notifications_enabled = COALESCE(invoice_notifications_enabled, TRUE);

ALTER TABLE public.tenants
    ALTER COLUMN email_notifications_enabled SET DEFAULT TRUE,
    ALTER COLUMN in_app_notifications_enabled SET DEFAULT TRUE,
    ALTER COLUMN browser_push_notifications_enabled SET DEFAULT TRUE,
    ALTER COLUMN invoice_notifications_enabled SET DEFAULT TRUE;

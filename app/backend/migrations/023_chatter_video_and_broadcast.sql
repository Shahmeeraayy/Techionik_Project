ALTER TABLE public.chat_attachments
    DROP CONSTRAINT IF EXISTS chat_attachments_type_chk;

ALTER TABLE public.chat_attachments
    ADD CONSTRAINT chat_attachments_type_chk
    CHECK (attachment_type IN ('image','document','voice','video'));

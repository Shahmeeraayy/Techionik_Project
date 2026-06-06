CREATE TABLE IF NOT EXISTS public.chat_conversations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    conversation_key varchar(255) NOT NULL,
    conversation_type varchar(20) NOT NULL,
    technician_id uuid NOT NULL REFERENCES public.technicians(id) ON DELETE CASCADE,
    job_id uuid NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    title text NULL,
    created_by_role varchar(20) NOT NULL,
    created_by_id uuid NOT NULL,
    last_message_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chat_conversations_tenant_key_uniq UNIQUE (tenant_id, conversation_key),
    CONSTRAINT chat_conversations_type_chk CHECK (conversation_type IN ('direct','job')),
    CONSTRAINT chat_conversations_created_by_role_chk CHECK (created_by_role IN ('admin','technician'))
);

CREATE TABLE IF NOT EXISTS public.chat_conversation_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
    technician_id uuid NOT NULL REFERENCES public.technicians(id) ON DELETE CASCADE,
    sender_role varchar(20) NOT NULL,
    sender_id uuid NOT NULL,
    body text NULL,
    message_type varchar(20) NOT NULL DEFAULT 'text',
    is_broadcast boolean NOT NULL DEFAULT false,
    delivered_at timestamptz NULL,
    read_at timestamptz NULL,
    pinned_at timestamptz NULL,
    pinned_by_role varchar(20) NULL,
    pinned_by_id uuid NULL,
    deleted_at timestamptz NULL,
    metadata jsonb NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chat_conversation_messages_sender_role_chk CHECK (sender_role IN ('admin','technician')),
    CONSTRAINT chat_conversation_messages_message_type_chk CHECK (message_type IN ('text','attachment','voice','mixed')),
    CONSTRAINT chat_conversation_messages_pinned_by_role_chk CHECK (pinned_by_role IS NULL OR pinned_by_role IN ('admin','technician'))
);

CREATE TABLE IF NOT EXISTS public.chat_attachments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
    message_id uuid NOT NULL REFERENCES public.chat_conversation_messages(id) ON DELETE CASCADE,
    original_name varchar(255) NOT NULL,
    mime_type varchar(128) NOT NULL,
    size_bytes integer NOT NULL,
    attachment_type varchar(20) NOT NULL,
    storage_path text NOT NULL,
    sha256_hash varchar(64) NOT NULL,
    duration_seconds integer NULL,
    metadata jsonb NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chat_attachments_type_chk CHECK (attachment_type IN ('image','document','voice'))
);

CREATE TABLE IF NOT EXISTS public.chat_message_receipts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
    message_id uuid NOT NULL REFERENCES public.chat_conversation_messages(id) ON DELETE CASCADE,
    recipient_role varchar(20) NOT NULL,
    recipient_user_id uuid NOT NULL,
    delivered_at timestamptz NULL,
    read_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chat_message_receipts_message_recipient_uniq UNIQUE (message_id, recipient_role, recipient_user_id),
    CONSTRAINT chat_message_receipts_role_chk CHECK (recipient_role IN ('admin','technician'))
);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_tenant_id ON public.chat_conversations (tenant_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_technician_id ON public.chat_conversations (technician_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_job_id ON public.chat_conversations (job_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversation_messages_tenant_id ON public.chat_conversation_messages (tenant_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversation_messages_conversation_id ON public.chat_conversation_messages (conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversation_messages_created_at ON public.chat_conversation_messages (created_at);
CREATE INDEX IF NOT EXISTS idx_chat_attachments_tenant_id ON public.chat_attachments (tenant_id);
CREATE INDEX IF NOT EXISTS idx_chat_attachments_message_id ON public.chat_attachments (message_id);
CREATE INDEX IF NOT EXISTS idx_chat_message_receipts_tenant_id ON public.chat_message_receipts (tenant_id);
CREATE INDEX IF NOT EXISTS idx_chat_message_receipts_message_id ON public.chat_message_receipts (message_id);

DO $$
DECLARE
    table_name text;
    tenant_tables text[] := ARRAY[
        'chat_conversations',
        'chat_conversation_messages',
        'chat_attachments',
        'chat_message_receipts'
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

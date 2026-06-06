CREATE TABLE IF NOT EXISTS public.chat_conversation_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
    technician_id uuid NOT NULL REFERENCES public.technicians(id) ON DELETE CASCADE,
    added_by_id uuid NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chat_conversation_members_conversation_technician_uniq UNIQUE (conversation_id, technician_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_conversation_members_tenant_id ON public.chat_conversation_members (tenant_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversation_members_conversation_id ON public.chat_conversation_members (conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversation_members_technician_id ON public.chat_conversation_members (technician_id);

ALTER TABLE public.chat_conversation_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_select ON public.chat_conversation_members;
DROP POLICY IF EXISTS tenant_isolation_insert ON public.chat_conversation_members;
DROP POLICY IF EXISTS tenant_isolation_update ON public.chat_conversation_members;
DROP POLICY IF EXISTS tenant_isolation_delete ON public.chat_conversation_members;

CREATE POLICY tenant_isolation_select
    ON public.chat_conversation_members
    FOR SELECT
    USING (app.current_tenant_matches(tenant_id));

CREATE POLICY tenant_isolation_insert
    ON public.chat_conversation_members
    FOR INSERT
    WITH CHECK (tenant_id = app.current_tenant_id());

CREATE POLICY tenant_isolation_update
    ON public.chat_conversation_members
    FOR UPDATE
    USING (app.current_tenant_matches(tenant_id))
    WITH CHECK (tenant_id = app.current_tenant_id());

CREATE POLICY tenant_isolation_delete
    ON public.chat_conversation_members
    FOR DELETE
    USING (app.current_tenant_matches(tenant_id));

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'chat_conversation_members_assign_tenant_id'
    ) THEN
        CREATE TRIGGER chat_conversation_members_assign_tenant_id
            BEFORE INSERT OR UPDATE ON public.chat_conversation_members
            FOR EACH ROW EXECUTE FUNCTION app.assign_tenant_id();
    END IF;
END $$;

INSERT INTO public.chat_conversation_members (tenant_id, conversation_id, technician_id, added_by_id, created_at)
SELECT DISTINCT c.tenant_id, c.id, c.technician_id, c.created_by_id, c.created_at
FROM public.chat_conversations c
LEFT JOIN public.chat_conversation_members m
    ON m.conversation_id = c.id
   AND m.technician_id = c.technician_id
WHERE m.id IS NULL;

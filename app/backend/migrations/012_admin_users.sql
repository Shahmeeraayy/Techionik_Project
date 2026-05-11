DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'admin_users'
    ) THEN
        EXECUTE 'ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.admin_users';
        EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_insert ON public.admin_users';
        EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_update ON public.admin_users';
        EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_delete ON public.admin_users';

        EXECUTE 'CREATE POLICY tenant_isolation_select ON public.admin_users FOR SELECT USING (app.current_tenant_matches(tenant_id))';
        EXECUTE 'CREATE POLICY tenant_isolation_insert ON public.admin_users FOR INSERT WITH CHECK (tenant_id = app.current_tenant_id())';
        EXECUTE 'CREATE POLICY tenant_isolation_update ON public.admin_users FOR UPDATE USING (app.current_tenant_matches(tenant_id)) WITH CHECK (tenant_id = app.current_tenant_id())';
        EXECUTE 'CREATE POLICY tenant_isolation_delete ON public.admin_users FOR DELETE USING (app.current_tenant_matches(tenant_id))';

        IF NOT EXISTS (
            SELECT 1
            FROM pg_trigger
            WHERE tgname = 'admin_users_assign_tenant_id'
        ) THEN
            EXECUTE 'CREATE TRIGGER admin_users_assign_tenant_id BEFORE INSERT OR UPDATE ON public.admin_users FOR EACH ROW EXECUTE FUNCTION app.assign_tenant_id()';
        END IF;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'tenant_memberships'
    ) THEN
        EXECUTE 'ALTER TABLE public.tenant_memberships ENABLE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.tenant_memberships';
        EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_insert ON public.tenant_memberships';
        EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_update ON public.tenant_memberships';
        EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_delete ON public.tenant_memberships';

        EXECUTE 'CREATE POLICY tenant_isolation_select ON public.tenant_memberships FOR SELECT USING (app.current_tenant_matches(tenant_id))';
        EXECUTE 'CREATE POLICY tenant_isolation_insert ON public.tenant_memberships FOR INSERT WITH CHECK (tenant_id = app.current_tenant_id())';
        EXECUTE 'CREATE POLICY tenant_isolation_update ON public.tenant_memberships FOR UPDATE USING (app.current_tenant_matches(tenant_id)) WITH CHECK (tenant_id = app.current_tenant_id())';
        EXECUTE 'CREATE POLICY tenant_isolation_delete ON public.tenant_memberships FOR DELETE USING (app.current_tenant_matches(tenant_id))';

        IF NOT EXISTS (
            SELECT 1
            FROM pg_trigger
            WHERE tgname = 'tenant_memberships_assign_tenant_id'
        ) THEN
            EXECUTE 'CREATE TRIGGER tenant_memberships_assign_tenant_id BEFORE INSERT OR UPDATE ON public.tenant_memberships FOR EACH ROW EXECUTE FUNCTION app.assign_tenant_id()';
        END IF;
    END IF;
END $$;

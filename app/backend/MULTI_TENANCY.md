# NexusOps Multi-Tenancy Foundation

This backend now includes a Supabase-ready multi-tenant foundation built around three layers:

1. Application-side tenant context propagation in FastAPI and SQLAlchemy
2. Database-side `tenant_id` enforcement with PostgreSQL functions and RLS scaffolding
3. Supabase-oriented bootstrap settings for Auth, Storage, migrations, and observability hooks

## What is wired in this repo

- `tenant_id` columns on the current tenant-owned SQLAlchemy models
- automatic tenant scoping for ORM reads through `SessionLocal` event hooks
- automatic `tenant_id` assignment on inserts through SQLAlchemy `before_flush`
- request middleware that resolves tenant context from:
  - JWT tenant claims
  - `X-Tenant-Id`
  - `X-Tenant-Slug`
  - `book.[tenant].nexusops.com` style hosts
- JWT decoding that accepts:
  - legacy app-issued tokens
  - Supabase HS256 JWTs when `SUPABASE_JWT_SECRET` is configured
- migration `011_supabase_multitenancy.sql` with:
  - `app.current_tenant_id()`
  - `app.assign_tenant_id()`
  - RLS policies for tenant tables
  - tenant usage counters
  - Storage policy scaffolding for tenant-prefixed objects

## What still depends on live Supabase infrastructure

- actual Supabase Auth signup/signin flows
- tenant claims being injected by Supabase Auth hooks or custom access token claims
- Redis cache isolation and quotas
- queue workers and tenant-aware scheduling
- Realtime subscriptions for dashboards and deployment telemetry
- Logflare / Supabase log drains and alert pipelines

Those are now easier to wire because the backend and schema expect tenant context consistently.

## Recommended Supabase setup

1. Set `SUPABASE_JWT_SECRET` in `app/backend/.env`
2. Run:

```bash
python scripts/migrate.py
```

3. In Supabase Auth, ensure access tokens include:
   - `tenant_id`
   - `tenant_role`
   - or `app_metadata.tenant_id`
   - or `app_metadata.tenant_role`

4. Store tenant files under a tenant-prefixed path such as:

```text
{tenant_id}/uploads/invoices/...
```

5. For background jobs, always include:

```json
{
  "tenant_id": "...",
  "tenant_slug": "...",
  "requested_by": "...",
  "payload": {}
}
```

## Current limitation to be aware of

This codebase still has some legacy global uniqueness constraints from its single-tenant past. Tenant isolation is now enforced through `tenant_id` and RLS, but if you need duplicate technician emails, service codes, or zone names across tenants, the next step is to convert those global unique constraints into composite tenant-scoped uniques.

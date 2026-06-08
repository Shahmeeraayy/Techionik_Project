# NexusOps SQA PostgreSQL Readiness Report

Date: 2026-06-08
Workspace: `C:\Users\Tech\Desktop\NexusOps`
Scope: `app/backend`

## Executive Verdict

Status: **CERTIFIED for PostgreSQL-only backend runtime in this workspace**

The active backend database is now PostgreSQL. The local runtime database `nexusops` and the dedicated smoke-test database `nexusops_test` both exist, both migrate successfully, and the verified backend flows now run against PostgreSQL instead of SQLite.

SQLite is no longer allowed for normal backend runtime. It is only available behind the explicit `ALLOW_SQLITE_FOR_TESTS=1` escape hatch for legacy local unit tests that have not yet been ported.

## Certified Environment

- Runtime database: `postgresql+psycopg://postgres:password@localhost:5432/nexusops`
- Smoke-test database: `postgresql+psycopg://postgres:password@localhost:5432/nexusops_test`
- Backend environment: `APP_ENV=development`
- Driver: `psycopg[binary]`

## Implementation Completed

1. Provisioned both PostgreSQL databases with `scripts/provision_postgres_databases.py`.
2. Enforced PostgreSQL as the required runtime database in `app/core/config.py`.
3. Added the missing `017_chatter_groups.sql` entry to `scripts/migrate.py`.
4. Added `020_postgres_runtime_alignment.sql` to move startup schema patching into an explicit migration.
5. Removed runtime schema patching and startup `create_all()` behavior from `app/main.py`.
6. Moved chat backfill execution into the managed migration flow.
7. Added PostgreSQL smoke coverage in `tests/test_postgres_smoke.py`.
8. Fixed a PostgreSQL tenant-context bug in `BookingPortalService.submit_booking()` that the new smoke run exposed.
9. Updated the backend docs and example environment files for PostgreSQL-only runtime.

## Verification Evidence

### 1. Direct Connectivity

Command executed:

```powershell
python -c "from app.api.deps import engine; from sqlalchemy import text; conn = engine.connect(); conn.execute(text('SELECT 1')); print('CONNECTED'); conn.close()"
```

Result:

```text
CONNECTED
```

### 2. Database Provisioning

Command executed:

```powershell
python .\scripts\provision_postgres_databases.py
```

Result:

- `nexusops` created and reachable
- `nexusops_test` created and reachable

### 3. Managed Migration Chain

Commands executed:

```powershell
python .\scripts\migrate.py
```

```powershell
$env:DATABASE_URL='postgresql+psycopg://postgres:password@localhost:5432/nexusops_test'; python .\scripts\migrate.py
```

Verified outcomes on both databases:

- `017_chatter_groups.sql` recorded in `schema_migrations`
- `020_postgres_runtime_alignment.sql` recorded in `schema_migrations`
- migration chain completed without failure

### 4. PostgreSQL Tenant and Chatter Protections

Validated directly in PostgreSQL on both `nexusops` and `nexusops_test`:

- `chat_conversation_members` exists
- row-level security is enabled on:
  - `chat_conversation_members`
  - `chat_conversations`
  - `chat_messages`
- tenant isolation policies exist for select, insert, update, and delete on all three tables
- trigger `chat_conversation_members_assign_tenant_id` exists

### 5. Health Endpoint Evidence

Verified response:

```json
{
  "database": "postgresql",
  "status": "connected",
  "environment": "development"
}
```

The `/health` endpoint also reports:

```json
{
  "status": "ok",
  "database": "postgresql",
  "database_status": "connected",
  "environment": "development"
}
```

## Smoke-Test Certification

Command executed:

```powershell
python -m pytest .\tests\test_postgres_smoke.py -q
```

Result:

```text
2 passed
```

Covered PostgreSQL-backed flows:

| Module | Evidence | Status |
| --- | --- | --- |
| Health | `/health` and `/health/db` report PostgreSQL connected | Pass |
| Auth | tenant admin signup/login, technician login, super admin login | Pass |
| Booking Portal | public config, request submission, status lookup | Pass |
| Jobs / Dispatch | booking request promoted into a PostgreSQL job and assigned technician | Pass |
| Attendance | technician clock-in and clock-out, admin dashboard readback | Pass |
| Chatter | admin job thread, technician access, cross-tenant denial | Pass |
| Invoices / Payments | pending approvals, invoice creation, mark paid | Pass |
| Tenant Isolation | tenant-two admin cannot see tenant-one booking data; tenant-two technician cannot access tenant-one job chat | Pass |
| Super Admin | dashboard and tenant list operate on PostgreSQL data | Pass |

Additional regression checks executed:

```powershell
python -m pytest .\tests\test_database_config.py .\tests\test_health_api.py -q
```

Result:

```text
3 passed
```

## Important Bug Found and Fixed During Certification

The first PostgreSQL smoke run exposed a real multitenant bug in `BookingPortalService.submit_booking()`:

- booking submission committed successfully
- the code restored the default tenant context too early
- the follow-up `email_outbox` status update then ran under the wrong tenant context
- PostgreSQL RLS aborted the transaction
- the exception was swallowed, causing a later failure on response serialization

Fix applied:

- keep the tenant-scoped update under the booking tenant context
- rollback if that post-commit update fails
- restore the original request tenant context only after that cleanup step

This issue would not have been caught reliably by the previous SQLite-heavy test setup, so the PostgreSQL smoke suite materially improved certification quality.

## Remaining Technical Follow-Up

These items do **not** block the PostgreSQL runtime certification above, but they are still worth tracking:

1. `scripts/migrate.py` still uses `Base.metadata.create_all()` to bootstrap legacy baseline tables before the numbered SQL migrations run. Runtime startup no longer patches schema, but the migration bootstrap path is not yet a pure SQL chain.
2. The repo still has broader SQLite-oriented unit coverage. Core PostgreSQL smoke coverage now exists, but more legacy tests can be ported incrementally.
3. The current test run surfaces framework deprecation warnings (Pydantic v1 validators, SQLAlchemy legacy base import, FastAPI startup-event deprecation). These are maintenance items, not PostgreSQL blockers.

## Final Decision

**Certified:** NexusOps backend is operating on PostgreSQL in this workspace.

Certification basis:

- PostgreSQL databases exist and connect successfully
- backend runtime rejects SQLite by default
- missing PostgreSQL migration `017_chatter_groups.sql` is now in the managed chain
- runtime schema patching has been removed from app startup
- PostgreSQL tenant protections and Chatter RLS are present
- real backend smoke flows pass against `nexusops_test`
- tenant isolation is validated through live API behavior

SQLite is no longer the active backend database for this workspace's certified runtime path.

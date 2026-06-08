# NexusOps SQA PostgreSQL Readiness Report

Date: 2026-06-08
Workspace: `C:\Users\Tech\Desktop\NexusOps`
Scope: `app/backend`

## Executive Verdict

Status: **NOT YET CERTIFIED as completely on PostgreSQL**

The backend codebase has meaningful PostgreSQL support, but the current workspace is **not fully operating on PostgreSQL end-to-end** yet.

The two biggest blockers are:

1. The active local PostgreSQL target is configured but not provisioned. A direct connection attempt fails because database `nexusops` does not exist yet.
2. The managed migration runner skips `017_chatter_groups.sql`, which means PostgreSQL-only RLS, trigger, and backfill logic for `chat_conversation_members` is not guaranteed to run.

## Audit Method

This SQA pass reviewed:

- runtime configuration and environment handling
- DB engine/session setup
- managed migration runner behavior
- PostgreSQL-specific migration files
- runtime schema patching behavior
- model and raw SQL compatibility signals
- local runtime connectivity
- automated test coverage evidence

## Summary Matrix

| Area | Result | Notes |
| --- | --- | --- |
| PostgreSQL URL support | Pass | `postgres://` and `postgresql://` normalize to `postgresql+psycopg://...` |
| Production/staging SQLite safety block | Pass | Non-local environments reject SQLite |
| Active local runtime on PostgreSQL | Fail | Config points to PostgreSQL, but target DB does not exist |
| Engine/session PostgreSQL support | Pass | `psycopg` driver and non-SQLite branch logic are present |
| Managed PostgreSQL migrations | Partial | Mostly present, but `017_chatter_groups.sql` is omitted from runner |
| PostgreSQL health visibility | Pass | `/health` and `/health/db` exist |
| Full PostgreSQL schema drift control | Partial | Startup path still performs `create_all()` and ad-hoc `ALTER TABLE` |
| Automated PostgreSQL integration coverage | Fail | Test suite is overwhelmingly SQLite-only |
| SQLite-to-PostgreSQL migration tooling | Pass | Transfer helper exists |
| Overall PostgreSQL certification | Fail | Cannot certify until DB exists, missing migration is fixed, and PostgreSQL smoke tests pass |

## Findings

### 1. High: The system is not currently running on a real PostgreSQL database

Evidence:

- Local runtime config points to PostgreSQL in `app/backend/.env`:
  - line 1: `APP_ENV=development`
  - line 3: `DATABASE_URL=postgresql+psycopg://postgres:password@localhost:5432/nexusops`
- A direct SQLAlchemy connection attempt failed with:
  - `FATAL: database "nexusops" does not exist`
- Port connectivity check to `localhost:5432` succeeded, so PostgreSQL is reachable, but the target database itself is missing.

Impact:

- The workspace is **not actually operational on PostgreSQL** right now.
- Health endpoints and migrations cannot be validated end-to-end against the configured target until the database is created.

Assessment:

- This is an environment readiness blocker, not just a documentation gap.

### 2. High: `017_chatter_groups.sql` is missing from the managed migration runner

Evidence:

- `app/backend/scripts/migrate.py` lists:
  - line 46: `Migration("016_chatter_v1.sql"),`
  - line 47: `Migration("018_job_internal_notes.sql"),`
  - line 48: `Migration("019_attendance_live_tracking.sql"),`
- `app/backend/migrations/017_chatter_groups.sql` exists and contains PostgreSQL-specific logic for:
  - `chat_conversation_members` table creation
  - RLS enablement
  - tenant isolation policies
  - `assign_tenant_id()` trigger
  - data backfill from `chat_conversations`

Impact:

- On PostgreSQL, the `chat_conversation_members` table may still appear because SQLAlchemy models are imported and `Base.metadata.create_all()` runs.
- But the PostgreSQL-only controls in `017_chatter_groups.sql` are **not guaranteed to run**:
  - no DB-level RLS for that table
  - no `assign_tenant_id` trigger
  - no migration-time backfill

Assessment:

- This is a real PostgreSQL security and data-consistency gap.
- The system cannot be considered fully migrated to PostgreSQL while a required PostgreSQL migration file is skipped.

### 3. Medium: Automated coverage does not verify PostgreSQL behavior

Evidence:

- `15` backend test files explicitly set `DATABASE_URL` to SQLite.
- Representative examples:
  - `app/backend/tests/test_admin_settings_api.py:11`
  - `app/backend/tests/test_booking_portal_api.py:13`
  - `app/backend/tests/test_health_api.py:12`
- PostgreSQL appears in tests only once as a config normalization assertion:
  - `app/backend/tests/test_database_config.py:33`
  - `app/backend/tests/test_database_config.py:41`
  - `app/backend/tests/test_database_config.py:45`

Impact:

- There is no meaningful automated proof yet that:
  - migrations succeed on PostgreSQL
  - routes behave correctly on PostgreSQL
  - JSON, UUID, RLS, transaction, and tenant-scoped paths work end-to-end on PostgreSQL

Assessment:

- Current tests show SQLite compatibility, not PostgreSQL certification.

### 4. Medium: Schema creation still depends on runtime patching outside the managed migration history

Evidence:

- `app/backend/scripts/migrate.py:497` runs `Base.metadata.create_all(bind=conn)`
- `app/backend/app/main.py:72` also runs `Base.metadata.create_all(bind=conn)` on startup
- `app/backend/app/main.py:125` and nearby lines apply runtime `ALTER TABLE` statements such as:
  - `ALTER TABLE booking_requests ADD COLUMN service_catalog_ids JSON`

Impact:

- Fresh environments may get schema from a blend of:
  - SQLAlchemy metadata
  - startup-time `ALTER TABLE`
  - managed SQL migration files
- This makes PostgreSQL change tracking harder to certify because schema state is not fully controlled by one canonical migration path.

Assessment:

- This is not an immediate blocker for PostgreSQL support, but it is a maintainability and auditability risk.

### 5. Low: Migration documentation is incomplete relative to the actual migration set

Evidence:

- `app/backend/migrations/README.md` lists only a subset of migration files.
- It does not enumerate many active migration files, including `011`, `012`, `014`, `016`, `017`, `018`, and `019` in a complete chronological way.

Impact:

- Developer onboarding and release verification can drift from reality.

Assessment:

- Low severity, but worth fixing because PostgreSQL rollout work depends on trustworthy migration documentation.

## Positive Findings

These are the parts that are in good shape:

- PostgreSQL driver dependency exists in `app/backend/requirements.txt`:
  - `psycopg[binary]>=3.1,<4`
- Runtime configuration supports PostgreSQL normalization in `app/backend/app/core/config.py`.
- Non-local environments reject SQLite in `app/backend/app/core/config.py`.
- PostgreSQL health reporting exists in:
  - `app/backend/app/main.py`
  - `/health`
  - `/health/db`
- PostgreSQL tenant session setup exists in:
  - `app/backend/app/api/deps.py`
  - `SELECT set_config('app.current_tenant_id', ...)`
- PostgreSQL-focused migration files exist for:
  - multitenancy and RLS
  - admin users and tenant memberships
  - signup uniqueness
  - chatter
  - attendance/live tracking
- SQLite to PostgreSQL data transfer helper exists:
  - `app/backend/scripts/migrate_sqlite_to_postgres.py`

## Detailed Readiness Checklist

| Check | Result | Evidence |
| --- | --- | --- |
| PostgreSQL can be configured via `DATABASE_URL` | Pass | `app/backend/app/core/config.py` |
| SQLite is blocked outside local/test | Pass | `app/backend/app/core/config.py` |
| Current workspace starts successfully on PostgreSQL | Fail | Connection test failed: database `nexusops` does not exist |
| Health endpoint exposes active DB type | Pass | `app/backend/app/main.py` |
| Managed migration runner includes all PostgreSQL SQL migrations | Fail | `017_chatter_groups.sql` omitted from `scripts/migrate.py` |
| PostgreSQL RLS and trigger path exists | Partial | Present in migration SQL, but not fully guaranteed because of missing `017` registration |
| Schema changes are fully migration-driven | Partial | Startup `create_all()` and runtime `ALTER TABLE` still active |
| PostgreSQL integration tests exist | Fail | Test suite remains SQLite-centric |
| Data migration path from SQLite exists | Pass | `scripts/migrate_sqlite_to_postgres.py` |
| PostgreSQL production safety policy is documented | Pass | `README.md`, `POSTGRES_MIGRATION.md`, `SUPABASE_SETUP.md` |

## Commands and Evidence Used

Key checks performed during this SQA pass:

```powershell
Test-NetConnection -ComputerName localhost -Port 5432
```

Result:

- `TcpTestSucceeded = True`

```powershell
python -c "from app.api.deps import engine; from sqlalchemy import text; conn = engine.connect(); conn.execute(text('SELECT 1')); print('CONNECTED'); conn.close()"
```

Result:

- failed with `FATAL: database "nexusops" does not exist`

```powershell
rg -n --hidden -F 'sqlite:///' .\app\backend\tests
```

Result:

- `15` SQLite-based test fixtures found

## Final Certification Decision

**Decision: FAIL for complete PostgreSQL certification**

Reason:

- The workspace is **configured toward PostgreSQL**, but it is **not yet completely operating on PostgreSQL**.
- There is at least one **managed PostgreSQL migration gap**.
- There is **no end-to-end PostgreSQL test evidence** for major backend modules.

## Required Actions Before Re-Certification

1. Create the actual PostgreSQL database `nexusops` and verify live startup with `/health/db`.
2. Add `017_chatter_groups.sql` to `app/backend/scripts/migrate.py` and rerun PostgreSQL migrations.
3. Run the managed migration flow against PostgreSQL and verify every expected table, trigger, and RLS policy exists.
4. Add PostgreSQL integration tests or a CI job that runs the backend test subset against PostgreSQL.
5. Run smoke tests for:
   - admin login
   - technician login
   - booking portal
   - chat/chatter
   - attendance tracking
   - invoices
   - super admin
6. Decide whether startup-time schema patching should remain, or be converted into explicit managed migrations for cleaner PostgreSQL auditability.

## Recommended Re-Test Exit Criteria

The backend can be re-evaluated as fully PostgreSQL-ready once all of the following are true:

- `DATABASE_URL` points to a real PostgreSQL database that exists.
- `python scripts/migrate.py` completes successfully against PostgreSQL.
- `GET /health/db` returns `{"database":"postgresql","status":"connected",...}` from a live server.
- `017_chatter_groups.sql` is included in the managed migration chain.
- A PostgreSQL test run or smoke test proves core admin, technician, chat, attendance, and invoice flows.


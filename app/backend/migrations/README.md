# Migrations Guide

The active migration chain is defined by `app/backend/scripts/migrate.py`.

## Active migration order

- `001_technician_module.sql`: legacy base schema placeholder and compatibility baseline
- `002_admin_technician_profile.sql`: admin and technician profile alignment
- `003_technician.sql`: legacy development seed migration
- `004_dealerships.sql`: dealership schema support
- `005_normalize_zone_names.sql`: zone-name cleanup
- `006_technician_signup_requests.sql`: technician signup request tables
- `007_invoices.sql`: invoice schema and constraints
- `008_dispatch_job_invoice_fields.sql`: dispatch-job invoice mapping fields
- `009_technician_profile_email_change_requests.sql`: technician email change request workflow
- `010_job_services.sql`: structured job service rows
- `011_supabase_multitenancy.sql`: PostgreSQL tenant functions, RLS, and tenant triggers
- `012_admin_users.sql`: tenant admin user records and memberships
- `013_service_catalog_tenant_uniqueness.sql`: tenant-scoped service catalog uniqueness
- `014_signup_requests_tenant_uniqueness.sql`: tenant-scoped signup uniqueness
- `015_tenant_email_identities.sql`: tenant notification and support email identity columns
- `016_chatter_v1.sql`: core Chatter tables
- `017_chatter_groups.sql`: Chatter group membership table, RLS, trigger, and backfill
- `018_job_internal_notes.sql`: internal notes for jobs
- `019_attendance_live_tracking.sql`: attendance, live tracking, geo-fencing, and chatter location requests
- `020_postgres_runtime_alignment.sql`: runtime-to-migration alignment for PostgreSQL-only backend fields

## How to run

From `app/backend`:

```bash
python scripts/migrate.py
```

Include development seed data:

```bash
python scripts/migrate.py --with-seed
```

Provision the local PostgreSQL databases referenced by `.env`:

```bash
python scripts/provision_postgres_databases.py
```

## Notes

- `003_technician.sql` is for local development seeding only and is skipped unless `--with-seed` is passed.
- `scripts/migrate.py` is the canonical active chain. SQL files that are not registered there are not part of the certified migration path.
- The current migration runner still bootstraps legacy baseline tables with SQLAlchemy metadata before applying numbered SQL migrations. Runtime app startup no longer performs schema patching.

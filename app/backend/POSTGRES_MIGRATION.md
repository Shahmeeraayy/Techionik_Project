# PostgreSQL Migration Guide

NexusOps uses PostgreSQL as the required database for staging, demo, client-facing, and production environments. SQLite is allowed only for temporary local development and testing.

## Environment policy

- Local-only fallback: `sqlite:///./nexusops-dev.db`
- Shared development, demo, staging, production: `postgresql+psycopg://...`
- Non-local environments will now fail fast if `DATABASE_URL` points to SQLite.

## 1. Configure the backend environment

Create `app/backend/.env` from `.env.example` and point `DATABASE_URL` at PostgreSQL:

```env
APP_ENV=development
DATABASE_URL=postgresql+psycopg://postgres:password@localhost:5432/nexusops
```

Cloud providers such as Neon, Supabase, Render PostgreSQL, and AWS RDS also work:

```env
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:PORT/nexusops?sslmode=require
```

## 2. Run managed schema migrations

This repo currently uses the managed backend migration script rather than Alembic:

```bash
cd app/backend
python -m pip install -r requirements.txt
python scripts/migrate.py
```

For local demo data only:

```bash
python scripts/migrate.py --with-seed
```

## 3. Migrate existing SQLite data if needed

1. Back up `app/backend/nexusops-dev.db`.
2. Create the PostgreSQL schema first with `python scripts/migrate.py`.
3. Run:

```bash
python scripts/migrate_sqlite_to_postgres.py \
  --sqlite-url sqlite:///./nexusops-dev.db \
  --postgres-url postgresql+psycopg://postgres:password@localhost:5432/nexusops
```

Optional flags:

- `--truncate-target` clears matching PostgreSQL tables before copying rows.
- `--bootstrap-target` runs the managed migration script against the PostgreSQL target before copying data.

The script writes a JSON migration report under `app/backend/private/migration-reports/`.

## 4. Verify database connectivity

Start the backend:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Check the database health endpoint:

```http
GET /health/db
```

Expected PostgreSQL response:

```json
{
  "database": "postgresql",
  "status": "connected",
  "environment": "development"
}
```

SQLite is still reported as local-only:

```json
{
  "database": "sqlite",
  "status": "connected",
  "environment": "development",
  "mode": "local_development_only"
}
```

## Deployment checklist

- PostgreSQL database exists and accepts connections.
- `DATABASE_URL` is set in the deployment environment.
- `JWT_SECRET_KEY` is set securely outside local development.
- `python scripts/migrate.py` completed successfully against PostgreSQL.
- `/health/db` reports `"database": "postgresql"`.
- Admin login, technician login, job creation, attendance, chatter, and invoices are validated against PostgreSQL.

## Backup and recovery

- Enable daily automated PostgreSQL backups at the provider level.
- Take a manual backup before each deployment or data migration.
- Keep the latest SQLite file until the PostgreSQL migration has been verified.
- Test restore procedures on a non-production database before go-live.

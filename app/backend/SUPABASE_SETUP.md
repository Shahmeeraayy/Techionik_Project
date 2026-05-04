# Supabase Setup

This backend uses SQLAlchemy with a single `DATABASE_URL`. There is no checked-in local database to delete; replacing the old database means replacing `DATABASE_URL` and running the migrations against your new Supabase project.

## 1. Create the backend env file

From `app/backend/`, create `.env` from `.env.example`:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

## 2. Add your Supabase connection string

In Supabase, open your project, click **Connect**, then copy a Postgres connection string.

Recommended choices:

- **Direct connection** for migrations and long-running backend servers when your host supports IPv6.
- **Session pooler** when your host needs IPv4 support.
- **Transaction pooler** only for serverless-style runtimes. Avoid it for migrations because transaction pooling does not support prepared statements.

Set `DATABASE_URL` in `app/backend/.env`:

```env
DATABASE_URL=postgresql://postgres.your-project-ref:your_password@aws-0-your-region.pooler.supabase.com:5432/postgres?sslmode=require
```

If Supabase gives you a URL starting with `postgres://`, you can paste it as-is. The app normalizes it to the SQLAlchemy `psycopg` driver automatically.

If your database password has special characters like `@`, `#`, `/`, `?`, or `:`, URL-encode them before putting the password in `DATABASE_URL`.

## 3. Run migrations on the new database

From `app/backend/`:

```bash
python -m pip install -r requirements.txt
python scripts/migrate.py
```

For local demo data only:

```bash
python scripts/migrate.py --with-seed
```

Do not use `--with-seed` for a clean production database unless you intentionally want the legacy development seed data.

## 4. Start the backend

From `app/backend/`:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Then the frontend should keep using:

```env
VITE_API_URL=http://localhost:8000
```

## 5. Deploying

In your hosting provider, set the same `DATABASE_URL` as an environment variable. Do not commit `.env` with real Supabase credentials.

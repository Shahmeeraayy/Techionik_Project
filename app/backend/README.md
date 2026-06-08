# NexusOps - Technician Module (FastAPI)

## Stack
- **Framework**: FastAPI
- **Database**: PostgreSQL for demo/staging/production, SQLite only as a temporary local fallback
- **ORM**: SQLAlchemy
- **Validation**: Pydantic
- **Architecture**: Clean Service-Repository Layer

## Features
- **Normalized Data**: Separate tables for Skills, Zones, Working Hours, and Time Off.
- **Eligibility Engine**: optimized SQL query checking 7 constraints:
  - Active Status
  - Skill coverage
  - Zone coverage
  - Working hours validation (with overnight shift support)
  - Time-off overrides
  - Concurrent job limits
  - Previous rejections
- **Transactional Safety**: Uses `SELECT FOR UPDATE` and explicit transactions for job acceptance to prevent race conditions.
- **Soft Deactivation**: Hard deletes on technicians are blocked; deactivation via status update only.
- **Audit Ready**: Key actions (Rejection, Acceptance, Status Changes) are routed through an audit service.

## API Endpoints

### Technician Management
- `POST /technicians/`: Create new technician
- `GET /technicians/`: List technicians
- `GET /technicians/{id}`: Detailed view
- `PUT /technicians/{id}`: Update info
- `PATCH /technicians/{id}/status`: Activate/Deactivate
- `DELETE /technicians/{id}`: -> Blocked (405)

### Assignments & Availability
- `POST /technicians/{id}/skills`: Map skills
- `POST /technicians/{id}/zones`: Map zones
- `POST /technicians/{id}/working-hours`: Define shift
- `POST /technicians/{id}/time-off`: Record absence

### Dispatch & Actions
- `GET /technicians/eligible/{job_id}`: Fetch eligible technicians for a specific job.
- `POST /technicians/{id}/accept/{job_id}`: Accept a job (Checks constraints).
- `POST /technicians/{id}/reject/{job_id}`: Reject a job (Hides from future broadcasts).

### Invoices
- `POST /invoices`: Create invoice payload with backend calculations.
- `GET /invoices/{id}`: Fetch invoice.
- `PUT /invoices/{id}`: Update invoice.
- `DELETE /invoices/{id}`: Void invoice (soft cancel).

## Setup
1. Configure environment variables (copy from `.env.example`):
   - Preferred local development uses `DATABASE_URL=postgresql+psycopg://postgres:password@localhost:5432/nexusops`
   - SQLite is allowed only for temporary local development with `DATABASE_URL=sqlite:///./nexusops-dev.db`
   - Staging, demo, production, and client-facing environments must use PostgreSQL.
   - `JWT_SECRET_KEY`
   - Optional: `APP_ENV`, `CORS_ALLOW_ORIGINS`
2. Install Python dependencies:
   - `python -m pip install -r requirements.txt`
3. Run managed migrations:
   - Core schema only: `python scripts/migrate.py`
   - Include dev seed data: `python scripts/migrate.py --with-seed`
   - This repo does not use Alembic yet; managed migrations currently run through `python scripts/migrate.py`.
4. Run app: `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
5. Verify the active database: `GET /health/db`

See `POSTGRES_MIGRATION.md` for the PostgreSQL rollout, SQLite-to-Postgres transfer flow, deployment checklist, and backup notes.
See `SUPABASE_SETUP.md` for a Supabase-flavored PostgreSQL example.
See `MULTI_TENANCY.md` for the new tenant isolation and RLS foundation.

## Migration Notes
- `001_technician_module.sql` and `002_admin_technician_profile.sql` are core schema migrations.
- `003_technician.sql` is a development seed migration (legacy frontend technicians, zones, skills).
- `scripts/migrate.py` tracks applied versions in `schema_migrations` and skips already-applied files.


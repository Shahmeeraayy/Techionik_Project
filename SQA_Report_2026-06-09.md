# NexusOps SQA Report

Date: 2026-06-09
Workspace: `C:\Users\Tech\Desktop\NexusOps`
Scope: Current application health across `app` frontend and `app/backend`

## Executive Summary

Current quality status: **Partially Ready**

The application is buildable and the backend is largely stable under targeted execution, but the overall quality gate is not green yet. The frontend production build passes, the backend suite is mostly healthy, and the PostgreSQL smoke suite passes when run on its own. However, the full backend suite still fails because SQLite-oriented tests mutate process-level database environment variables before the PostgreSQL smoke suite runs, and the frontend lint baseline remains high-risk with **228 errors** and **30 warnings**.

The highest-priority quality issues today are:

1. Full-suite backend test isolation is broken between SQLite and PostgreSQL test modes.
2. Frontend lint debt is substantial and concentrated in core admin/technician screens.
3. Backend maintenance warnings remain high, especially around Pydantic v1 validators and deprecated FastAPI startup patterns.

## Validation Performed

| Check | Command | Result |
| --- | --- | --- |
| Frontend production build | `npm run build` in `app` | Passed |
| Frontend lint | `npm run lint` in `app` | Failed: 228 errors, 30 warnings |
| Backend full suite | `python -m pytest` in `app/backend` | Failed: 70 passed, 2 failed |
| PostgreSQL smoke suite only | `python -m pytest tests/test_postgres_smoke.py -q` in `app/backend` | Passed: 2 passed |
| Reports regression slice | `python -m pytest tests/test_invoice_api.py -k "reports_pending_approvals"` in `app/backend` | Passed: 2 passed |

## Key Findings

### 1. Full backend suite is not hermetic

Severity: **High**

The full backend run failed only in `tests/test_postgres_smoke.py`, while the same smoke suite passed when executed by itself. This indicates a test-isolation problem rather than a direct PostgreSQL product regression.

Evidence:

- SQLite-oriented tests set process-wide environment variables at import time:
  - `app/backend/tests/test_admin_jobs_api.py:12-13`
  - `app/backend/tests/test_invoice_api.py:14-15`
  - `app/backend/tests/test_booking_portal_api.py:13-14`
- PostgreSQL smoke tests then attempt to switch the process back to PostgreSQL:
  - `app/backend/tests/test_postgres_smoke.py:42-43`
- The smoke suite expects PostgreSQL-specific behavior such as:
  - `app/backend/tests/test_postgres_smoke.py:100`
- Runtime database mode is decided from env at import time:
  - `app/backend/app/core/config.py:80-94`

Observed failure mode in the full suite:

- `/health` reported `sqlite` instead of `postgresql`
- PostgreSQL smoke setup hit `sqlite3.OperationalError: no such function: set_config`

Assessment:

- Targeted backend validation is mostly healthy.
- CI and local full-suite reliability are not trustworthy until database test modes are isolated.

### 2. Frontend lint baseline is unhealthy

Severity: **High**

`npm run lint` currently reports **228 errors** and **30 warnings**. The errors are not cosmetic-only; many indicate code patterns that can cause stale state, rerender churn, or fragile component behavior.

Top failing rules:

- `@typescript-eslint/no-unused-vars`: 131
- `react-hooks/set-state-in-effect`: 58
- `react-hooks/exhaustive-deps`: 30
- `@typescript-eslint/no-explicit-any`: 15
- `react-refresh/only-export-components`: 13

Largest hotspots by file count:

- `app/src/pages/admin/Jobs.tsx`: 38
- `app/src/pages/admin/Settings.tsx`: 30
- `app/src/pages/technician/Chat.tsx`: 30
- `app/src/pages/admin/Technicians.tsx`: 19
- `app/src/pages/admin/Attendance.tsx`: 17

Assessment:

- The frontend can still build for production.
- The lint backlog is large enough to mask real regressions and slow safe refactoring.

### 3. React effect usage needs cleanup in shared and high-traffic screens

Severity: **Medium**

Several errors come from synchronous state updates inside effects and render-time impurity patterns. These are concentrated in components that are likely to be user-heavy or reused across the app.

Representative examples from lint output:

- `app/src/contexts/AuthContext.tsx`
- `app/src/pages/technician/MyJobs.tsx`
- `app/src/pages/technician/Chat.tsx`
- `app/src/components/chat/AttachmentCard.tsx`
- `app/src/components/modals/TechnicianPreviewModal.tsx`

Assessment:

- This is a maintainability and correctness risk more than an immediate build blocker.
- Auth, jobs, and chat are the wrong places to carry hidden effect/state churn long term.

### 4. PostgreSQL runtime path is healthy when tested in isolation

Severity: **Medium**

Even though the full backend suite failed, the dedicated PostgreSQL smoke suite passed when run independently on 2026-06-09.

This means:

- PostgreSQL connectivity is working in this workspace.
- The smoke coverage itself is still valid.
- The immediate issue is full-suite contamination, not an outright PostgreSQL feature failure.

Evidence:

- `python -m pytest tests/test_postgres_smoke.py -q` -> `2 passed`
- Backend `.env` points to PostgreSQL runtime and test databases:
  - `app/backend/.env`

### 5. Reports date-range logic is now safer

Severity: **Closed / Improved**

The reports service now counts pending approvals only when the completion timestamp falls inside the selected reporting range. A regression test was added to protect that behavior.

Evidence:

- Logic change:
  - `app/backend/app/services/reports_service.py:230-238`
- Regression test:
  - `app/backend/tests/test_invoice_api.py:681`

Assessment:

- This closes a reporting accuracy bug for admin analytics.
- The reporting module is in better shape than the previous baseline.

### 6. Production bundle health is acceptable but still heavy

Severity: **Medium**

The production build passes, but the shipped asset profile is still large.

Notable bundle outputs from the build:

- `assets/index-B6vzi_Hf.js`: 433.48 kB
- `assets/vendor-jspdf-XLGnRROd.js`: 386.65 kB
- `assets/vendor-xlsx-C2K9OxTh.js`: 282.80 kB

Assessment:

- This is not a release blocker by itself.
- It is a performance optimization candidate, especially for slower admin devices or weak networks.

### 7. Backend deprecation backlog remains significant

Severity: **Medium**

The backend test runs emit more than 400 warnings, mostly from:

- Pydantic v1-style validators
- class-based config usage
- FastAPI `@app.on_event("startup")`
- SQLAlchemy legacy base import

Representative references:

- `app/backend/app/main.py:65`
- multiple schema modules under `app/backend/app/schemas/`

Assessment:

- These are not immediate functional failures.
- They are a medium-term maintenance risk and should be scheduled before a framework upgrade window tightens.

## Risk Summary

| Area | Current Status | Risk |
| --- | --- | --- |
| Frontend buildability | Passing | Low |
| Frontend code quality gate | Failing | High |
| Backend targeted functional tests | Mostly passing | Low-Medium |
| Backend full-suite reliability | Failing due to test isolation | High |
| PostgreSQL runtime confidence | Passing in isolated smoke run | Medium |
| Reporting accuracy | Improved | Low |
| Upgrade readiness | Warning-heavy | Medium |

## Recommended Next Actions

1. Split SQLite and PostgreSQL backend tests into isolated sessions or fixtures so env mutation cannot leak across suites.
2. Triage the frontend lint backlog by rule family, starting with `react-hooks/set-state-in-effect`, then `react-hooks/exhaustive-deps`, then unused variables.
3. Stabilize shared state-heavy surfaces first:
   - `AuthContext`
   - admin jobs
   - technician chat
   - technician jobs
4. Schedule a backend maintenance pass for Pydantic v2 validator migration and FastAPI lifespan migration.
5. Keep the new reports regression in place and add similar date-window coverage for other analytics metrics.

## Final Verdict

**SQA Verdict: Partially Ready**

The app is not in a broken state, but it is not yet at a clean release-quality baseline. Buildability and core backend behavior are good signals. The blockers to a stronger SQA verdict are the broken full-suite backend isolation and the large frontend lint backlog.

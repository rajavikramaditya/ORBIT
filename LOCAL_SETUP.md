# ORBIT — Local Development Setup

## Prerequisites
- **Python 3.11+**
- **Node.js 18+** and **Yarn 1.x** (the repo uses `yarn`)
- **MongoDB** available either locally or via MongoDB Atlas

### Quick MongoDB options
1. Local Docker:
```bash
docker run -d --name orbit-mongo -p 27017:27017 mongo:7
```

2. MongoDB Atlas:
- Create a free cluster
- Create a DB user
- Allow your IP
- Put the `mongodb+srv://...` connection string into `backend/.env`

---

## 1. Backend

```bash
cd backend

# Create a Python virtual environment
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
# source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env from the example (edit if needed)
copy .env.example .env      # Windows
# cp .env.example .env      # macOS/Linux

# IMPORTANT for localhost browser login:
# keep COOKIE_SECURE=false in local .env

# Start the backend (port 8001)
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

On first startup the backend seeds the admin account and two demo hotel tenants automatically.

## 2. Frontend

```bash
cd frontend

# Install dependencies (yarn preferred; npm works as fallback)
yarn install
# OR, if yarn has network trouble:
# npm install --legacy-peer-deps

# Create .env from the example
copy .env.example .env      # Windows
# cp .env.example .env      # macOS/Linux

# Start the dev server (port 3000)
yarn start
```

Open http://localhost:3000 in your browser.

## 3. Test Accounts

| Role | Email | Password |
|------|-------|----------|
| Platform Admin | `admin@orbit.ai` | `OrbitAdmin@2026` |
| Hotel Owner (Taj, demo) | `owner@tajpalace.in` | `Hotel@2026` |
| Hotel Owner (Leela, demo) | `owner@leela.in` | `Hotel@2026` |

- Admin → http://localhost:3000/admin
- Tenant → http://localhost:3000/dashboard

## 4. Running Tests

Tests are integration tests that run against a live backend. Start the backend first, then:

```bash
cd backend
# Serial mode (recommended locally — deterministic; the suites share seeded tenant state)
pytest -n 0 tests -v
```

The test suite defaults to `http://localhost:8001` when `REACT_APP_BACKEND_URL` is not set.
Note: the default parallel mode (`-n 2` from pytest.ini) can produce false failures locally
because the three test files mutate the same seeded Taj tenant concurrently. Use `-n 0`.

After a test run, remove leftover test artifacts (TEST_ tenants, test invoices, quarantine entries):

```bash
cd backend
python cleanup_test_data.py
```

This script is DEV/TEST only. It refuses to run when:

- `ORBIT_ENV` is `production` / `prod` / `staging`
- `DB_NAME` looks like production (`prod` / `production`) or is not one of `orbit_dev`, `test_database`, `orbit_test`
- the connected database already contains any tenant with `environment=production`

Those production/staging and production-tenant guards cannot be overridden.
`ALLOW_TEST_CLEANUP=true` only allows a non-allowlisted *development* `DB_NAME`.

Note on `ORBIT_ENV`: keep it at `development` locally. In production set `ORBIT_ENV=production` and a dedicated `DB_NAME` (not `orbit_dev`), which disables demo seed data (Taj/Leela) and blocks the cleanup script.

## 5. Mock/Demo Mode

All external providers (ElevenLabs, Exotel, Razorpay, WhatsApp) work in mock/demo mode when their credentials are empty. No real provider accounts are needed for local development.

- Demo tenants use mock connectors; results are clearly labelled `mock=True`.
- Production tenants with no real connector return `unavailable` (never fake data).
- Simulate-call is available only for demo tenants.
- Invoice payment returns `payment_config_required` when Razorpay keys are absent.

## 6. Notes

- Google OAuth (`/auth/session`) depends on the Emergent auth service and will not work locally. Use email/password login instead.
- The `@emergentbase/visual-edits` dev dependency is optional and gracefully skipped if missing.
- `COOKIE_SECURE=false` is required on `http://localhost`; set it back to `true` in production.

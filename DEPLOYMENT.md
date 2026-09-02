# ORBIT — Production Deployment

Do not deploy until provider credentials and a dedicated production database are ready.
This is configuration and process only — no source-code change is required per customer.

## Prerequisites

- Python 3.11+
- Node.js 18+
- MongoDB Atlas (or equivalent) **dedicated production cluster and `DB_NAME`**
- HTTPS in front of both frontend and API
- Unique secrets (never copy local `.env.example` values)

## Environment variables

Set on the **backend** host (never in the frontend bundle except `REACT_APP_BACKEND_URL`):

| Name | Production requirement |
|---|---|
| `ORBIT_ENV` | `production` (required — process refuses to start otherwise with weak config) |
| `MONGO_URL` | Production Atlas URI |
| `DB_NAME` | Dedicated name, **not** `orbit_dev` / `test_database` / `orbit_test` |
| `JWT_SECRET` | Unique, ≥32 characters (not the local example) |
| `WEBHOOK_SECRET` | Unique (not the local example) |
| `FRONTEND_URL` | Public HTTPS origin of the UI |
| `CORS_ORIGINS` | Optional extra comma-separated origins |
| `COOKIE_SECURE` | `true` |
| `ADMIN_EMAIL` | Platform admin login |
| `ADMIN_PASSWORD` | Unique production password (not `OrbitAdmin@2026`) |
| `ELEVENLABS_API_KEY` | When connecting voice |
| `ELEVENLABS_WEBHOOK_SECRET` | Required for production post-call webhooks |
| `EXOTEL_API_KEY` / `EXOTEL_API_TOKEN` / `EXOTEL_ACCOUNT_SID` / `EXOTEL_SUBDOMAIN` | When connecting phone |
| `EXOTEL_WEBHOOK_SECRET` | Recommended for production Exotel inbound mapping |
| `META_WHATSAPP_TOKEN` / `META_WHATSAPP_APP_SECRET` / `META_WHATSAPP_VERIFY_TOKEN` / `META_WHATSAPP_PHONE_NUMBER_ID` | Only if Meta Cloud API inbound webhook is used |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` | When taking payment |

Frontend **build-time**:

| Name | Production requirement |
|---|---|
| `REACT_APP_BACKEND_URL` | Public API origin (e.g. `https://api.example.com`) |

Do not put API keys, Mongo URIs, or JWT secrets in any `REACT_APP_*` variable.

## Production database

1. Create a **separate** Atlas cluster (or at minimum a separate `DB_NAME`) from local/dev.
2. Create a database user with least privilege on that database only.
3. Restrict Network Access to the backend host IPs.
4. Enable Atlas continuous backup / snapshot backup (M10+ recommended for production; M0 has no point-in-time restore).
5. Restore is Atlas snapshot restore (or `mongodump` / `mongorestore` of that database only). Never restore a dump into `orbit_dev`.

Startup **does not** seed Taj/Leela demo tenants when `ORBIT_ENV=production`. It **does** upsert the platform admin from `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

There are no schema migrations. Indexes are created on startup.

## Backend start command

From `backend/` with production env vars loaded (no `--reload`):

```bash
python -m uvicorn server:app --host 0.0.0.0 --port 8001
```

`backend/db.py` loads `backend/.env` via `load_dotenv` at import (does **not** override variables already in the process environment). After changing `.env` or host env vars, **restart the process**. `--reload` is for development only.

Bind behind HTTPS (nginx, Caddy, or a cloud load balancer).

## Frontend build / deployment

```bash
cd frontend
# set REACT_APP_BACKEND_URL to the public API origin
npm ci --legacy-peer-deps
npm run build
```

Serve the `frontend/build` static files over HTTPS. The API is reached only via `REACT_APP_BACKEND_URL`.

## Seed / data

- Production: admin user only (from env). Create real tenants in Platform Admin.
- Never run `python cleanup_test_data.py` against production. The script refuses `ORBIT_ENV=production`, production-looking `DB_NAME`s, and any database that already has `environment=production` tenants.

## Health check

- Liveness: `GET /api/` → `{ "service": "ORBIT", "status": "ok" }`
- Readiness: `GET /api/health` → same, or `503` if MongoDB ping fails

Point the load balancer at `/api/health`.

## Webhooks

Configure provider callbacks to:

- `POST https://<api>/api/webhooks/elevenlabs/post-call` (ElevenLabs signature required in production)
- `POST https://<api>/api/webhooks/elevenlabs/tool-call` (same signature rules)
- `POST https://<api>/api/webhooks/exotel/inbound` (maps ringing call to tenant; conversation still comes from ElevenLabs post-call)
- `GET/POST https://<api>/api/webhooks/whatsapp` (Meta Cloud API; conversational replies stay in ElevenLabs)
- `POST https://<api>/api/intake/<intake_key>` (website/form lead; tenant resolved from intake key)
- `POST https://<api>/api/webhooks/razorpay` (Razorpay signature required)

Processing is inline (no job queue). Duplicate ElevenLabs `conversation_id` values are idempotent. Unmapped `agent_id` events are stored in webhook quarantine. A processing exception returns HTTP 500 so the provider can retry.

## Logging

Process logs are INFO-level. Do not log request bodies, JWT cookies, API keys, or call transcripts. Uvicorn access logs record method/path/status only.

## Rollback

1. Redeploy the previous backend image / git revision and previous frontend `build`.
2. Env vars are not versioned in git — keep a secrets manager history.
3. Data rollback is an Atlas snapshot restore of the production database only. Indexes recreate on next start.

## Backup recommendation

- Atlas automated snapshots, retained ≥ 7 days, restore-tested once before go-live.
- Do not use the local/dev cluster as a backup of production.

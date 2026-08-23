# ORBIT — Production Deployment Guide

This document outlines the end-to-end procedure for deploying the ORBIT AI Employee Platform to production.

---

## 1. Architecture Overview

- **Frontend**: React SPA static build served via CDN / Nginx / Caddy over HTTPS.
- **Backend**: FastAPI (Python 3.11+) ASGI application running behind Uvicorn over HTTPS.
- **Database**: MongoDB Atlas (Dedicated Production Cluster, e.g., M10+).
- **External Providers**:
  - Voice: ElevenLabs Conversational AI
  - Telephony: Exotel Carrier Trunk
  - Payments: Razorpay Gateway
  - Transactional Email: SMTP / AWS SES / SendGrid

---

## 2. Environment Variables Checklist

### Backend Environment (`.env`)
Set these environment variables on the backend hosting server (e.g., AWS ECS, Render, Railway, DigitalOcean App Platform):

| Variable | Description | Example / Requirement |
|---|---|---|
| `ORBIT_ENV` | Environment mode | `production` (Enforces safety guards, disables mock data & demo seeding) |
| `MONGO_URL` | MongoDB Connection URI | `mongodb+srv://orbit_app:<password>@cluster0.xxx.mongodb.net/?retryWrites=true&w=majority` |
| `DB_NAME` | Dedicated Database Name | `orbit_prod` (Never `orbit_dev` or `test_database`) |
| `JWT_SECRET` | Secret key for auth token signing | Minimum 32-character high-entropy random string |
| `WEBHOOK_SECRET` | Shared secret for webhook validation | High-entropy random string |
| `FRONTEND_URL` | Canonical URL of production web UI | `https://app.your-orbit-domain.com` |
| `CORS_ORIGINS` | Comma-separated allowed origins | `https://app.your-orbit-domain.com,https://admin.your-orbit-domain.com` |
| `COOKIE_SECURE` | HTTPS-only session cookies | `true` |
| `ADMIN_EMAIL` | Initial platform admin login | `admin@your-orbit-domain.com` |
| `ADMIN_PASSWORD` | Strong password for initial admin | Strong production password (minimum 12 chars) |
| `ELEVENLABS_API_KEY` | ElevenLabs commercial workspace API key | `xi-api-key-...` |
| `ELEVENLABS_WEBHOOK_SECRET` | ElevenLabs signing secret | Used for HMAC signature verification |
| `EXOTEL_API_KEY` | Exotel telephony API key | Exotel carrier trunk credentials |
| `EXOTEL_API_TOKEN` | Exotel telephony token | Exotel carrier trunk credentials |
| `EXOTEL_ACCOUNT_SID` | Exotel account SID | Exotel carrier trunk credentials |
| `EXOTEL_SUBDOMAIN` | Exotel account subdomain | `api.exotel.com` |
| `RAZORPAY_KEY_ID` | Razorpay Key ID | Live Razorpay merchant key |
| `RAZORPAY_KEY_SECRET` | Razorpay Secret | Live Razorpay merchant secret |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay webhook signature secret | For payment settlement verification |

### Frontend Build-Time Environment (`.env.production`)
| Variable | Description | Value |
|---|---|---|
| `REACT_APP_BACKEND_URL` | Public HTTPS origin of ORBIT API | `https://api.your-orbit-domain.com` |

> **Security Rule:** Never put database URIs, API keys, or JWT secrets in any `REACT_APP_*` variable.

---

## 3. Webhook Endpoints & Contracts

Configure external provider callbacks to point to the production API:

### 1. ElevenLabs Post-Call Webhook
- **URL**: `POST https://api.your-orbit-domain.com/api/webhooks/elevenlabs/post-call`
- **Headers**: `ElevenLabs-Signature: <hmac_signature>`
- **Behavior**: Ingests call recordings, transcript, duration, and triggers automated usage ledger deductions. Idempotent on `conversation_id`.

### 2. ElevenLabs Tool-Call Webhook (Real-Time Business Data)
- **URL**: `POST https://api.your-orbit-domain.com/api/webhooks/elevenlabs/tool-call`
- **Headers**: `ElevenLabs-Signature: <hmac_signature>`
- **Payload Contract**:
  ```json
  {
    "agent_id": "agent_production_id",
    "tool_name": "check_availability",
    "parameters": { "room_type": "Deluxe" }
  }
  ```
- **Response Contract**:
  ```json
  {
    "status": "ok",
    "data": {
      "available": true,
      "rate": { "amount": 8500, "currency": "INR" },
      "unit_type": "Deluxe Room"
    }
  }
  ```

### 3. Razorpay Webhook
- **URL**: `POST https://api.your-orbit-domain.com/api/webhooks/razorpay`
- **Headers**: `X-Razorpay-Signature: <hmac_signature>`
- **Behavior**: Marks invoice status as `paid` upon successful settlement.

---

## 4. Health Checks & Verification

- **Liveness Check**: `GET /api/` → `{"service": "ORBIT", "status": "ok"}`
- **Readiness Check**: `GET /api/health` → `{"service": "ORBIT", "status": "ok"}` (Returns HTTP 503 if MongoDB connection is unhealthy).
- Configure your cloud load balancer / ingress to monitor `GET /api/health`.

---

## 5. Startup & Provisioning Process

1. **Backend Service Launch**:
   ```bash
   cd backend
   python -m uvicorn server:app --host 0.0.0.0 --port 8001 --workers 2
   ```
2. **Automated Initialization**:
   - `create_indexes()` ensures all unique and compound indexes are active.
   - `seed_platform_admin()` provisions the master admin account from `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
   - In production (`ORBIT_ENV=production`), **zero demo/mock tenants are seeded**.
3. **Frontend Build & Hosting**:
   ```bash
   cd frontend
   npm ci --legacy-peer-deps
   npm run build
   ```
   Deploy static contents of `frontend/build/` to CDN / S3 / Nginx.

---

## 6. Rollback & Recovery Strategy

1. **Application Code Rollback**:
   - Revert to previous Git tag/release container image.
   - Database schema is forward/backward compatible (no destructive migrations).
2. **Configuration Rollback**:
   - Maintain version-controlled secrets in your hosting provider's Secret Manager.
3. **Database Recovery**:
   - Restore point-in-time snapshot from MongoDB Atlas backup (see `docs/backup_and_recovery.md`).

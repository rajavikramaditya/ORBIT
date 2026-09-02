# ORBIT — Current State (every angle)

> **Ek line mein:** ORBIT ek multi-tenant "AI Employees for businesses" platform hai (React + FastAPI + MongoDB). Hotels pehla use-case hai. In-app logic **real** hai; external providers (voice/telephony/payments/WhatsApp) **credentials ke intezaar mein hain — koi bhi "Live" nahi hai**.
> Last updated: **2026-08-18**. Local backend `:8001` (reload), frontend build compile-successful. UI redesign nahi kiya — existing professional theme preserved.

---

## 1. Product overview
- **Kya hai:** Businesses ke liye managed AI employees (voice/phone/WhatsApp) jo unke apne business systems (PMS/POS/CRM) se live data padh sakein aur safe, permissioned actions le sakein.
- **Public positioning:** Generic AI-employee platform. Hotels = pehla vertical. Baaki illustrative (restaurants, clinics, real estate, agencies, retail).
- **Branding rule:** ElevenLabs / Exotel / provider IDs / API keys **customer UI mein nahi**. Admin console operational details dekh sakta hai. Invoice line is **"Phone usage"**, not a provider name.
- **Managed model:** No self-service prompt editor; customization ORBIT admins ke through managed queue se hoti hai.

---

## 2. Tech stack & architecture
- **Frontend:** React (JSX) + Tailwind + shadcn/ui + framer-motion. Router: react-router-dom.
- **Backend:** FastAPI (modular routers) + MongoDB. UUID string ids, ISO timestamps, `_id` kabhi expose nahi hota.
- **Local DB:** `DB_NAME=orbit_dev` (see `backend/.env.example`). Production uses a dedicated name — never `orbit_dev` / `test_database` / `orbit_test`.
- **Core flow:** `Tenant → AI Employee → Tool (READ/ACTION) → Business Integration (connector) → external system → live data/action → AI`.

---

## 3. Runtime, services & env config
- **Local:** backend `http://localhost:8001` (`uvicorn --reload`), frontend `http://localhost:3000`. Setup: `LOCAL_SETUP.md`. Production process: `DEPLOYMENT.md`.
- **Routing:** backend `/api` prefixed; frontend `REACT_APP_BACKEND_URL`.
- **Production startup (`runtime_config.py`):** `ORBIT_ENV=production` pe weak JWT/webhook/admin password, example secrets, `COOKIE_SECURE=false`, and dev `DB_NAME`s **refuse to start**. OpenAPI `/docs` off in production. `GET /api/health` Mongo ping karta hai.
- **CORS:** `FRONTEND_URL` + `CORS_ORIGINS`; localhost origins **only in development**.
- **backend/.env keys (values secret — never commit `.env`):**
  - Core: `ORBIT_ENV`, `MONGO_URL`, `DB_NAME`, `CORS_ORIGINS`, `FRONTEND_URL`, `JWT_SECRET`, `WEBHOOK_SECRET`, `COOKIE_SECURE`
  - Seed: `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `DEMO_OWNER_EMAIL`, `DEMO_OWNER_PASSWORD`
  - Providers (**empty locally → honest `credentials_required`**): `ELEVENLABS_API_KEY`, `ELEVENLABS_WEBHOOK_SECRET`, `EXOTEL_API_KEY`, `EXOTEL_API_TOKEN`, `EXOTEL_ACCOUNT_SID`, `EXOTEL_SUBDOMAIN`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
- **frontend/.env.example:** `REACT_APP_BACKEND_URL=http://localhost:8001`. Google button **hidden** unless `REACT_APP_ENABLE_GOOGLE_LOGIN=true` (Emergent-only; do not implement real Google OAuth unless asked).
- **Production webhooks:** `ELEVENLABS_WEBHOOK_SECRET` required — no demo HMAC fallback.

---

## 4. Backend files & responsibilities (`backend/`)
| File | Responsibility |
|---|---|
| `server.py` | App bootstrap, CORS, health, production docs-off, seed skip in production |
| `runtime_config.py` | `ORBIT_ENV`, CORS origins, production config hard-fail |
| `db.py` | Mongo connection |
| `models.py` | Pydantic models, ids, lifecycle/env constants |
| `security.py` | JWT + optional Google session + HMAC; role gating; **prod auth rate limit** |
| `providers.py` | Provider abstraction (ElevenLabs/Exotel/WhatsApp) — mock in demo |
| `provisioning.py` | Honest provider status (`credentials_required` when no keys) |
| `connectors.py` | Universal connector interface + ORBIT data contract, `LIVE_REGISTRY` |
| `tools.py` | Safe tool runner (READ vs ACTION), demo-vs-production gate |
| `billing.py` | Pricing, GST, invoice build, internal markup stripped from tenant view |
| `ingest.py` | Shared conversation capture (webhook + simulate) |
| `seed.py` | Indexes + admin seed; demo Taj/Leela **only** in non-production |
| `cleanup_test_data.py` | DEV/TEST only; refuses production env / prod-looking DB / production tenants |
| `routes_auth.py` | register/login/logout/me/session; new tenants `environment=demo` |
| `routes_admin.py` | Tenants, lifecycle, channels, integrations, provisioning, operations, **system-health**, audit, readiness/go-live gate |
| `routes_tenant.py` | Overview, AI employees, channels, conversations, integrations, tools, readiness (`needs_from_you` / `waiting_for_orbit` / `configured`), billing, profile, customization, simulate-call |
| `routes_business.py` | Business integrations + tool preview |
| `routes_billing.py` | Pricing, invoice generate/issue (immutable), tenant pay, Razorpay webhook |
| `routes_webhooks.py` | ElevenLabs post-call, Razorpay |

---

## 5. API surface (grouped)
**Auth** `/api/auth`: `POST /register`, `POST /login`, `POST /logout`, `GET /me`, `POST /session` (Google; UI hidden by default). Login/register **rate-limited in production** (20 / 5 min / IP).

**Admin** `/api/admin`: tenants CRUD/status/environment, AI-employee lifecycle + knowledge, verify-voice / verify-telephony, channels, provisioning, **operations**, **GET /system-health**, **GET /audit-log**, integrations/tools, connectors, stats, quarantine, customization queue, pricing, invoices generate/issue, reconcile, tenant readiness.

**Tenant** `/api/tenant`: overview, AI employees, channels, conversations, integrations, tools preview, **readiness** (split: needs-from-you vs waiting-for-ORBIT), billing, pay, profile, customization, simulate-call (demo only).

**Webhooks** `/api/webhooks`: `POST /elevenlabs/post-call`, `POST /razorpay`.

**Health** `GET /api/health` — process + Mongo ping.

---

## 6. Data model
Collections: `users`, `tenants`, `ai_employees`, `channels`, `conversations`, `business_integrations`, `tools`, `tool_invocation_log`, `tenant_pricing`, `invoices`, `usage_ledger`, `customization_requests`, `audit_log`, `webhook_quarantine`, `user_sessions`.

Lifecycle: `Draft → Testing → Approved → Live → Suspended` (enforced).
Invoice statuses: `draft, issued, due, paid, failed, demo, payment_config_required` (immutable once issued/due/paid/demo/payment_config_required).
Tenant `environment`: `demo` | `production`. New tenants default **demo** with default pricing.

**Do not** add a unique index on `user_sessions.session_token` — an existing non-unique `session_token_1` caused `IndexKeySpecsConflict` and took the backend down.

Local DB counts drift (tests create `TEST_*` tenants). Cleanup: from `backend/`, `venv\Scripts\python cleanup_test_data.py` (dev only).

---

## 7. Frontend pages & routes (`frontend/src`)
- `/` → `Landing.jsx` — footer **Terms / Privacy / AI disclosure** links (no redesign)
- `/login` · `/register` — password auth; Google hidden unless env flag
- `/terms` · `/privacy` · `/ai-disclosure` → `Legal.jsx` (public copy, no provider names)
- `/admin` → `AdminConsole.jsx`: Tenants, Customization queue, Quarantine, **Operations**, **System health**, **Audit log** + per-tenant production/readiness panel
- `/dashboard` nested: Overview (readiness: needs-from-you vs waiting-for-ORBIT), AI Employees, Channels, Integrations, Conversations (AI/recording notice), Customization, Billing, Settings

Approved UI stays. Minimal functional additions only.

---

## 8. Auth & roles
- **Methods:** JWT email/password (primary). Google/Emergent session exists in API but **UI is off** locally.
- **Cookies:** httpOnly `access_token` / `session_token`; Bearer also accepted.
- **Roles:** `platform_admin` → `/admin`; `owner` / `admin` with `tenant_id` → `/dashboard`.
- **Hard rule:** `tenant_id` always from session (`tid(user)`), never from the browser.
- Seed (development only): platform admin + Taj + Leela demo hotels.

---

## 9. Multi-tenancy & isolation
- Tenant routes derive identity server-side. Cross-tenant read → 404.
- Webhook tenant resolution: `agent_id → ai_employees.provider_agent_id → tenant_id`; unmapped → quarantine.
- LLM never writes DB/external systems directly — only authorized, enabled, confirmation-gated tools.

---

## 10. Business integration + tool layer
- READ contract: `{available, available_units, unit_type, rate:{amount, currency}}`
- ACTION: confirmation + enable + audit.
- Production tenant without a real connector → live read `unavailable` (no silent mock).
- Demo mock labelled MOCK. `LIVE_REGISTRY` empty until customer #1's real system is known. **Do not build a hotel PMS.**

---

## 11. Billing & commercial loop
- `usage_ledger` → estimate; per-tenant pricing (GST, markup, service charge, caps).
- Immutable invoices after issue. Tenant view strips `internal` (margins).
- Razorpay guarded: demo → `demo` (never charged); production without keys → `payment_config_required`. No fake charges.

---

## 12. Demo vs Production + go-live
- **Demo:** mock allowed and labelled; simulate-call allowed; invoices never charge; may go live on mock if readiness items pass the demo-relaxed set.
- **Production:** no mock connectors; unconnected reads `unavailable`; simulate-call 403; phone without Exotel keys → `action_required` (not fake `connected`); **status `live` blocked** until `compute_readiness()` has no blockers.
- Admin Operations has a **Go-live** column. Tenant cards show demo/production.

---

## 13. External integrations — HONEST status
| Service | Purpose | Status |
|---|---|---|
| **ElevenLabs** (voice) | AI agent/voice | Config path ready, **NOT connected** — `credentials_required` |
| **Exotel** (telephony) | Phone | Config path ready, **NOT connected** — `credentials_required` |
| **Razorpay** (payments) | INR + GST | SDK guarded, **NOT connected** — `payment_config_required` |
| **WhatsApp** | Channel | Status surface only, **NOT connected** — `action_required` |
| **MongoDB** | Persistence | Working locally |
| **JWT auth** | Login/roles | Working |
| **Google login** | Social | API exists; **UI hidden** until real OAuth is requested |
| **Customer connectors** | Live PMS/POS/CRM | None real yet |

Admin **System health** tab mirrors this honestly (SaaS/database `ok`; providers `credentials_required` / WhatsApp `action_required`). Capacity/concurrency numbers are **not** shown yet — ElevenLabs plan is unconfirmed (blueprint §19).

---

## 14. Data hygiene
Tests leave `TEST_*` tenants. Run `cleanup_test_data.py` from `backend/` in development only. Script refuses production.

---

## 15. Testing status (2026-08-18)
Files: `backend_test.py`, `test_business_tools.py`, `test_production_billing.py`, `test_runtime_config.py`, `test_cleanup_safety.py` (~70 cases). Run **serial** (`pytest -n 0`) — parallel flakes on shared Taj tenant.

This session verified: `TestOperations` (system-health + audit-log admin-only) pass; invoice generate unique-period flake fixed; frontend `npm run build` compiled. A full serial suite should be re-run after the next slice.

---

## 16. Test credentials (local/dev only)
- Platform admin: `admin@orbit.ai` / `OrbitAdmin@2026`
- Taj (demo): `owner@tajpalace.in` / `Hotel@2026`
- Leela: `owner@leela.in` / `Hotel@2026`

Never reuse these in production (`DEPLOYMENT.md`).

---

## 17. Done / Not-done / Blockers
**Done (real, in-app, this product — no redesign):**
- Multi-tenant auth + isolation, AI-employee lifecycle, tools/connectors architecture
- Billing math + immutable GST invoices + caps + tenant-safe invoice labels
- Demo/production split, honest provisioning, go-live gate, readiness split (you vs ORBIT)
- Production config guards, health ping, CORS, cleanup safety, extra indexes
- Public legal pages (Terms / Privacy / AI & recording disclosure) + Conversations notice
- Admin System health + Audit log tabs
- Production auth rate limiting
- Google login hidden by default

**Not done (needs credentials / email / a real customer):**
- Real ElevenLabs / Exotel / Razorpay keys + verify + one real call + one real payment
- First `LIVE_REGISTRY` connector (customer’s actual system — not a fake PMS)
- Real WhatsApp onboarding
- Password reset / account recovery (needs email)
- Admin capacity/concurrency indicator (blueprint §19) — must stay **not confirmed**, no fake “40 healthy”
- Configurable retention windows
- Scale/load toward ~100 tenants; ledger-vs-provider reconciliation job
- Database backups in the deployed environment (Atlas snapshots — ops, not code)

**Blockers to real go-live:** (a) provider credentials, (b) customer #1’s business system, (c) dedicated production DB + HTTPS + unique secrets, (d) one verified live call and one verified payment.

---

## 18. Onboarding steps
**Customer #1:** Admin creates tenant (starts **demo**) → complete profile → ORBIT attaches AI employee + knowledge → connect phone/WhatsApp when keys exist → set production only after verify → pricing/GST/caps → live connector → readiness all green → status Live → customer uses dashboard.
**Customer #2:** same steps, **zero source-code change**.

---

## 19. Next tasks (priority — smallest safe steps, no redesign)
1. **Admin capacity/concurrency (§19)** — honest “not confirmed” until a real ElevenLabs plan is known. No fake utilization.
2. **Password reset** — only when transactional email exists.
3. **Go-live wiring** — real keys + verify + one real call + one payment (blocked on you).
4. **First real connector** — `LIVE_REGISTRY` for customer #1’s system.
5. **WhatsApp managed onboarding** (real channel).
6. **Retention config** + scale/isolation testing + reconciliation vs provider analytics.

---

## 20. Hard rules (do not regress)
- Do not redesign the approved UI.
- Never claim Live without real provider verification.
- Production never serves mock as live data.
- Never trust `tenant_id` from the client.
- Never expose secrets, provider IDs, or margins to customers.
- Do not implement Google OAuth or a hotel PMS unless explicitly asked.

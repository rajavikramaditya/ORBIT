# ORBIT — Current State (every angle)

> **Ek line mein:** ORBIT ek multi-tenant "AI Employees for businesses" platform hai (React + FastAPI + MongoDB). Hotels pehla use-case hai. In-app logic **real** hai; external providers (voice/telephony/payments/WhatsApp) abhi tak **credentials ke intezaar mein hain — koi bhi "Live" nahi hai**.
> Last updated: 2026-06 · Verified by testing agent iteration-3 (54/54 backend pass, all frontend flows, 0 bugs).

---

## 1. Product overview
- **Kya hai:** Businesses ke liye managed AI employees (voice/phone/WhatsApp) jo unke apne business systems (PMS/POS/CRM) se live data padh sakein aur safe, permissioned actions le sakein.
- **Public positioning:** Generic AI-employee platform. Hotels = pehla vertical (Riya). Baaki illustrative: Aarav (restaurant), Ananya (clinic), Kabir (real estate), Neha (agency).
- **Branding rule:** ElevenLabs kabhi public/tenant UI mein nahi dikhta — sirf platform-admin console mein (operationally required). Provider abstraction: `provider = elevenlabs`, `provider_agent_id`.
- **Managed model:** No self-service prompt editor; customization ORBIT admins ke through managed queue se hoti hai.

---

## 2. Tech stack & architecture
- **Frontend:** React (JSX) + Tailwind + shadcn/ui + framer-motion + tsparticles + lenis. Router: react-router-dom.
- **Backend:** FastAPI (modular routers) + MongoDB (motor/pymongo). UUID string ids, ISO timestamps, `_id` kabhi expose nahi hota.
- **DB:** MongoDB, `DB_NAME=test_database` (env-driven).
- **Core flow:** `Tenant → AI Employee → Tool (READ/ACTION) → Business Integration (connector) → external system → live data/action → AI`.

---

## 3. Runtime, services & env config
- **Services (supervisor-managed):** backend `0.0.0.0:8001`, frontend `:3000`, mongodb. Hot-reload on.
- **Routing:** saare backend routes `/api` prefixed; frontend `REACT_APP_BACKEND_URL` use karta hai.
- **Preview URL:** `https://orbit-phone-ai.preview.emergentagent.com` (deploy nahi kiya gaya — preview only).
- **backend/.env keys (values secret):**
  - Core: `MONGO_URL`, `DB_NAME`, `CORS_ORIGINS`, `FRONTEND_URL`, `JWT_SECRET`, `WEBHOOK_SECRET`
  - Seed: `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `DEMO_OWNER_EMAIL`, `DEMO_OWNER_PASSWORD`
  - Providers (**abhi placeholders/empty → honest "credentials_required"**): `ELEVENLABS_API_KEY`, `ELEVENLABS_WEBHOOK_SECRET`, `EXOTEL_API_KEY`, `EXOTEL_API_TOKEN`, `EXOTEL_ACCOUNT_SID`, `EXOTEL_SUBDOMAIN`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
- **frontend/.env:** `REACT_APP_BACKEND_URL` (protected).

---

## 4. Backend files & responsibilities (`/app/backend`)
| File | Responsibility |
|---|---|
| `server.py` | App bootstrap; includes health + all routers |
| `db.py` | Mongo connection, indexes |
| `models.py` | Pydantic models, `PyObjectId`/base doc helpers |
| `security.py` | JWT + Google session + HMAC webhook verification, role gating |
| `providers.py` | Provider abstraction (ElevenLabs/Exotel/WhatsApp) — mock in demo |
| `provisioning.py` | Honest provider status (`credentials_required` when no keys) |
| `connectors.py` | Universal connector interface + STANDARD ORBIT data contract, `LIVE_REGISTRY` |
| `tools.py` | Safe tool runner (READ vs ACTION), demo-vs-production gate |
| `billing.py` | Pricing, GST, invoice build, ORBIT markup/service fee (internal), reconcile |
| `ingest.py` | Shared conversation capture (webhook + simulate) |
| `seed.py` | Idempotent seed (admin + 2 demo hotels; **no invoices seeded**) |
| `routes_auth.py` | register/login/logout/me/session |
| `routes_admin.py` | Tenants, AI-employee lifecycle, channels, integrations/tools, provisioning, operations, knowledge, quarantine, audit |
| `routes_tenant.py` | Overview, AI employees, channels, conversations, integrations, tools, readiness, billing, profile, customization, simulate-call |
| `routes_business.py` | Business integrations + tool preview |
| `routes_billing.py` | Pricing GET/PUT, invoice generate/issue (immutable), tenant pay, razorpay webhook |
| `routes_webhooks.py` | ElevenLabs post-call (HMAC), razorpay webhook |

---

## 5. API surface (grouped)
**Auth** `/api/auth`: `POST /register`, `POST /login`, `POST /logout`, `GET /me`, `POST /session` (Google).

**Admin** `/api/admin`: `GET/POST /tenants`, `GET /tenants/{id}`, `PATCH /tenants/{id}/status`, `PATCH /tenants/{id}/environment`, `POST /tenants/{id}/ai-employees`, `PATCH /ai-employees/{id}/lifecycle`, `PATCH /ai-employees/{id}/knowledge`, `POST /ai-employees/{id}/verify-voice`, `POST /tenants/{id}/channels`, `PATCH /channels/{id}`, `POST /channels/{id}/verify-telephony`, `GET /tenants/{id}/provisioning`, `GET /operations`, `POST /tenants/{id}/integrations`, `PATCH /integrations/{id}`, `POST /integrations/{id}/tools`, `PATCH /tools/{id}`, `GET /connectors`, `GET /stats`, `GET /quarantine`, `GET /audit-log`, `PATCH /customization-requests/{id}`, **billing:** `GET/PUT /tenants/{id}/pricing`, `GET /tenants/{id}/invoices`, `POST /tenants/{id}/invoices/generate`, `POST /invoices/{id}/issue`, `GET /tenants/{id}/reconcile`.

**Tenant** `/api/tenant`: `GET /overview`, `GET /ai-employees`, `GET /channels`, `GET /conversations`, `GET /conversations/{id}`, `GET /integrations`, `GET /tools`, `POST /tools/{id}/preview`, `GET /readiness`, `GET /billing`, `POST /invoices/{id}/pay`, `GET /profile`, `PATCH /profile`, `GET/POST /customization-requests`, `POST /simulate-call`.

**Webhooks** `/api/webhooks`: `POST /elevenlabs/post-call` (HMAC `X-Orbit-Signature`), `POST /razorpay`.

---

## 6. Data model — collections & current counts
| Collection | Count | Notes |
|---|---|---|
| `tenants` | 7 | 2 demo hotels + **5 leftover test/manual** (see §14) |
| `users` | 8 | admin + owners + test users |
| `ai_employees` | 6 | provider abstraction, lifecycle states |
| `channels` | 6 | phone (Exotel) / whatsapp, status-driven |
| `conversations` | 21 | transcript/summary/recording ref, data-source labelled |
| `business_integrations` | 3 | pms/pos/crm/custom; mode mock/live; status |
| `tools` | 7 | READ vs ACTION; enable-gated; actions need confirmation |
| `tool_invocation_log` | 60 | every tool call logged |
| `tenant_pricing` | 3 | per-tenant 8 configurable fields incl. GST %, markup, service fee |
| `invoices` | 1 | immutable once issued; only clean demo `2025-06` kept |
| `usage_ledger` | 21 | idempotent usage events → estimate |
| `customization_requests` | 7 | managed queue |
| `audit_log` | 162 | admin/security actions |
| `webhook_quarantine` | 2 | unmapped agent_id captures |
| `user_sessions` | 1 | Google session tokens |

Lifecycle states: `Draft → Testing → Approved → Live → Suspended` (enforced transitions).
Invoice statuses: `draft, issued, due, paid, failed, demo, payment_config_required` (immutable set: issued/due/paid/demo/payment_config_required).

---

## 7. Frontend pages & routes (`/app/frontend/src`)
- `/` → `Landing.jsx` (cinematic, generic positioning)
- `/login` → `Login.jsx` (email + Google) · `/register` → `Register.jsx`
- `/admin` → `admin/AdminConsole.jsx` (platform_admin only): tenants, lifecycle, channels, integrations/tools, **Operations tab**, **Production panel** (env toggle, provider verify, pricing form, invoice generate/issue, KB editor)
- `/dashboard` (tenant, ProtectedRoute) with nested:
  `Overview` (readiness bar), `AIEmployees`, `Channels`, `Integrations`, `Conversations`, `Customization`, `Billing`, `Settings`
- `AuthCallback.jsx` for Google OAuth return.

---

## 8. Auth & roles
- **Methods:** JWT email/password + Emergent-managed Google login. httpOnly cookies (`access_token` JWT, `session_token` Google); Bearer bhi accept hota hai.
- **Roles:** `platform_admin` (tenant_id null → `/admin`), `owner`, `admin` (tenant scope → `/dashboard`).
- Seed idempotent — admin + 2 demo owners auto-created.

---

## 9. Multi-tenancy & isolation (hard rules)
- Har tenant route `tenant_id` ko **session se derive** karta hai (`tid(user)`) — browser/body se kabhi nahi.
- Cross-tenant read → 404; lists always scoped.
- Webhook tenant resolution sirf `agent_id → ai_employees.provider_agent_id → tenant_id`; unmapped → quarantine.
- LLM kabhi bhi DB ya external system ko directly modify nahi karta — sirf authorized, enabled, confirmation-gated tools ke through.

---

## 10. Business integration + tool layer
- **Connector interface (`connectors.py`):** provider schemas → **STANDARD ORBIT contract** mein normalize:
  - READ result: `{available, available_units, unit_type, rate:{amount, currency}}`
  - ACTION result: `{reference, ...}`
- **Tenant-specific config as DATA** (`config_ref`) — source code mein nahi. Isi liye customer #2 bina code change kaam karta hai.
- **READ vs ACTION** tools alag; actions explicit enable + confirmation + audit ke saath.
- **Honesty:** production tenant jiska real connector nahi → live read = `unavailable` (mock fallback nahi). Demo mock data har jagah clearly "MOCK" labelled.
- `LIVE_REGISTRY` mein abhi koi real customer connector nahi (pehle customer ke system par depend karta hai).

---

## 11. Billing & commercial loop
- `usage_ledger` (idempotent) → current-month estimate.
- `tenant_pricing`: per-tenant 8 fields (rates, ORBIT markup, service charge, GST %, caps).
- **Immutable invoices**: issue ke baad re-issue/re-generate → 400.
- **Spend caps**: `warning` / `capped` states.
- **Tenant view (`GET /api/tenant/billing`)** `internal` subdoc (markup/service fee) strip karke deta hai — customer ko ORBIT margin nahi dikhta.
- **Razorpay (`razorpay==1.4.2`):** demo invoice → status `demo` (never charged); production w/o keys → `payment_config_required`; `pay` → `{status:'payment_config_required'}` (no crash, no fake charge). Real order/checkout path taiyaar hai, keys aane par activate.

---

## 12. Demo vs Production separation
- `tenant.environment ∈ {demo, production}`.
- **Demo:** mock connectors/data (labelled), simulate-call allowed, invoices never charge.
- **Production:** no mock fallback; unconnected reads `unavailable`; simulate-call → 403; invoices need real payment config.

---

## 13. External integrations — HONEST status
| Service | Purpose | Status |
|---|---|---|
| **ElevenLabs** (voice) | AI agent/voice | ⚠️ Config path ready, **NOT connected** — `credentials_required`. Verify button present. |
| **Exotel** (telephony) | Phone numbers/calls | ⚠️ Config path ready, **NOT connected** — `credentials_required`. |
| **Razorpay** (payments) | INR + GST billing | ⚠️ SDK installed, guarded; **NOT connected** — `payment_config_required`, never charges. |
| **WhatsApp** | Channel onboarding | ⚠️ Status surface only, **NOT connected**. |
| **MongoDB** | Persistence | ✅ Working. |
| **JWT auth** | Login/roles | ✅ Working. |
| **Emergent Google auth** | Social login | ✅ Implemented (deploy-time OAuth callback verify pending). |
| **Customer business connectors** | Live PMS/POS/CRM | ❌ None real yet; needs customer #1's system. |

> **Koi bhi external service "Live" claim nahi kiya gaya.** Green status sirf tab dikhega jab real keys + real connection test honge.

---

## 14. Data hygiene — known cleanup items
DB baseline sirf 2 demo hotels hona chahiye, lekin abhi ye extra tenants pade hain (testing/manual se):
- `TEST_Hotel_0fc8e4`, `TEST_Tenant_52a3a1`, `TEST_Hotel_06569f`, `TEST_Tenant_b2911d` → **test artifacts, safe to delete**.
- `MAHIL KINGDOM's Hotel` → possibly manually banaya gaya; delete karne se pehle confirm karein.
- Invoices clean: sirf ek demo `2025-06` (not charged) baaki test invoices hata diye gaye.

*(Cleanup abhi nahi kiya — chaaho to bolo, TEST_ tenants + unke users/records safely hata dunga.)*

---

## 15. Testing status
- **Backend:** 54/54 pytest pass (24 baseline + 12 business/tools + 18 production/billing). Files: `backend/tests/backend_test.py`, `test_business_tools.py`, `test_production_billing.py`.
- **Frontend:** Playwright — readiness bar, tenant billing pills, admin operations table, production panel (env/provider/pricing/invoices/KB), invoice immutability — all pass.
- **Report:** `/app/test_reports/iteration_3.json` (0 bugs).

---

## 16. Test credentials (also in `/app/memory/test_credentials.md`)
- Platform admin: `admin@orbit.ai` / `OrbitAdmin@2026`
- Taj (demo, live AI): `owner@tajpalace.in` / `Hotel@2026`
- Leela (onboarding): `owner@leela.in` / `Hotel@2026`

---

## 17. Done / Not-done / Blockers
**✅ Done (real, in-app):** multi-tenant auth + isolation, AI-employee lifecycle, integration/tool architecture, billing math + immutable GST invoices + caps, admin/tenant operational surfaces, honest provisioning, demo/production separation, cinematic landing.
**🟡 Not-done (needs you / a customer):** real ElevenLabs/Exotel/Razorpay keys + go-live test; first real business connector; real WhatsApp onboarding; retention config + legal text; scale/load testing (~100 tenants); reconciliation job hardening.
**⛔ Blockers to real go-live:** (a) provider credentials, (b) customer #1's actual business system, (c) real call + real payment test in a deployed env.

---

## 18. Onboarding steps
**Customer #1:** Admin → create tenant + owner → env=`production` → add ElevenLabs/Exotel/Razorpay keys to backend env + Verify → attach AI employee (`provider_agent_id`) → lifecycle Draft→…→Live → connect phone → set pricing/GST → build & map their live connector → test one real call + one payment order.
**Customer #2:** wahi steps, **zero source-code change** — sirf naye tenant ki settings/credentials/pricing/connector config.

---

## 19. Next tasks (priority order)
1. **Go-live wiring** — real provider keys + verify + one real call + one payment order.
2. **First real connector** — `LIVE_REGISTRY` entry for customer #1's PMS/POS/CRM (read + confirmation-gated action).
3. **WhatsApp managed onboarding** (real Meta/BSP flow).
4. **Retention + legal text** (Terms/Privacy/AI + recording disclosure).
5. **Scale/load + isolation testing** toward ~100 tenants; **reconciliation job** (ledger vs provider analytics).
6. *(Optional UX)* Admin "Go-Live Checklist" — har blocker green-tick hone par guided onboarding.

# ORBIT — Product Requirements & Build Log

## Original Problem Statement
Multi-tenant managed wrapper around ElevenLabs for India-first hotels. Lean MVP, architecture ready for ~100 tenants. ElevenLabs (voice, stored abstractly as provider + provider_agent_id), Exotel (telephony), ElevenLabs-supported WhatsApp (managed), Razorpay INR + GST usage billing. Stack: React + FastAPI + MongoDB. Hard rules: strict tenant isolation (tenant_id never from browser), secrets server-side only, configurable retention, ORBIT branding (not ElevenLabs), managed customization (no self-service prompt editor). Build sequence proves one hotel first.

## User Choices (this build)
- External providers (ElevenLabs / Exotel / WhatsApp) = clean provider-interface layer with **MOCKED** external calls; wire real keys later.
- Auth = **both** JWT email/password + Emergent-managed Google login.
- Scope for first pass = **Phase 1-2** (foundation + tenant isolation + first-hotel phone/agent lifecycle + conversation capture). Billing deferred.
- Design = Apple-level premium, cinematic landing with particle field, scroll reveals, restrained motion.

## Architecture
- Backend (FastAPI, modular): `db.py`, `models.py`, `security.py` (JWT+Google session+HMAC), `providers.py` (mock Exotel/ElevenLabs/WhatsApp), `ingest.py` (shared conversation capture), `seed.py`, `routes_auth.py`, `routes_admin.py`, `routes_tenant.py`, `routes_webhooks.py`, `server.py`. UUID string ids, ISO timestamps, `_id` never exposed.
- Auth: httpOnly cookies (`access_token` JWT / `session_token` Google), also accepts Bearer. Roles: `platform_admin` (tenant_id null), `owner`, `admin`.
- Tenant isolation: every tenant route derives tenant_id from the authenticated session (`tid(user)`); no request/body override. Webhook resolves tenant only via `agent_id -> ai_employees.provider_agent_id -> tenant_id`; unmapped ids are quarantined.
- Frontend (React JSX + Tailwind + shadcn + framer-motion + tsparticles + lenis): cinematic Landing, Login/Register (+Google), tenant DashboardLayout (Overview, AI Employees, Channels, Conversations, Customization, Settings), platform AdminConsole.

## Personas
- **ORBIT platform admin**: onboards hotels, attaches ElevenLabs agents, controls AI-employee lifecycle & channels, works the managed customization queue, monitors webhook quarantine.
- **Hotel owner/admin (tenant)**: views AI employees & channels, reviews conversations/transcripts, self-serves business profile & branding, submits customization requests.

## Core Requirements (static)
Strict tenant isolation; secrets server-side; ORBIT branding; managed (no self-service prompt editor); ElevenLabs abstraction; Exotel-only telephony; managed WhatsApp; extensible provider interface.

## Implemented (2026-06)
- ✅ JWT + Emergent Google auth, role-based gating, idempotent admin seed.
- ✅ Multi-tenant data model (tenants, users, ai_employees, channels, conversations, usage_ledger, customization_requests, audit_log, webhook_quarantine) with unique indexes.
- ✅ Strict tenant isolation (verified by testing agent: cross-tenant read = 404, list scoped).
- ✅ Platform admin console: create tenant + owner, attach provider_agent_id, AI-employee lifecycle (Draft→Testing→Approved→Live→Suspended with enforced transitions), connect Exotel phone + WhatsApp channels, customization queue, quarantine, stats, audit log.
- ✅ Phone-first first-hotel flow: Exotel channel (mock), HMAC-verified ElevenLabs post-call webhook → conversation + transcript + summary + recording ref + idempotent usage_ledger; unmapped agents quarantined; duplicates deduped. Simulate-call demo uses the same ingest path.
- ✅ Tenant dashboard with self-serve profile/branding (whitelisted fields) and managed customization requests.
- ✅ Cinematic ORBIT landing page (hero, storytelling, channels, dashboard preview, security, outcome, CTA).
- ✅ Testing: 24/24 backend pytest + full frontend flow, 0 bugs.

## Backlog (deferred, from spec build sequence)
- **P0 (Phase 3) Billing**: configurable rates/markup per tenant/plan, reconciliation job (ledger vs ElevenLabs analytics), immutable INR+GST invoices via Razorpay, soft-warning/threshold/hard-cap usage protection.
- **P1 (Phase 5) WhatsApp**: managed onboarding surface with real Meta/BSP action-required workflow.
- **P1 Privacy/Retention**: per-category configurable retention (metadata/transcript/recording/billing/audit) + configurable legal text (Terms, Privacy, AI disclosure, recording disclosure).
- **P2 (Phase 6) Scale**: load + isolation testing at ~100-tenant target; wire real ElevenLabs/Exotel keys behind the existing provider interfaces.

## Update (2026-06) — Product direction v2 (generic platform + live-data layer)
- ✅ Repositioned as a generic **AI Employee platform for businesses** (hotels = first vertical). Landing hero, "Built for your business" verticals (Hotels/Riya, Restaurants/Aarav, Clinics/Ananya, Real estate/Kabir, Agencies/Neha, Retail), and "More than a chatbot" live-data section.
- ✅ Removed **ElevenLabs from all public marketing** (hero/footer/positioning) and from the tenant dashboard. Kept only in the ORBIT platform-admin console (operationally required). Provider abstraction & backend integration unchanged.
- ✅ **Business Integration + Tool Layer** (generic, tenant-scoped): `business_integrations` (pms/pos/calendar/crm/custom; status connected/action_required/not_connected; mode mock/live) + `tools` (READ vs ACTION, enable-gated, actions force confirmation) + `tool_invocation_log`. Connector abstraction (`connectors.py`) + safe runner (`tools.py`).
- ✅ **Never fakes live data**: unconnected/live-without-real-connector → `unavailable`; mock data is DEV/DEMO only and clearly labelled MOCK everywhere (UI + API). ACTION tools require explicit confirmation; LLM never touches the DB directly.
- ✅ Admin manages integrations/tools per tenant; tenant sees a read-only unified "Business Integrations" surface + can safely test READ tools. Conversations show data source (Live/MOCK/Informational) + tool invocations. simulate-call demonstrates intent → tool → labelled result.
- ✅ Demo: Taj seeded with a clearly-MOCK "Hotel PMS" + check_availability/check_booking_status (read) + create_booking (action, disabled). Verified by testing agent (36/36 backend, all frontend flows, 0 bugs).

## Architecture (updated)
Tenant → AI Employee → Tool (READ/ACTION) → Business Integration (connector) → external business system → live data / action → AI. Real connectors plug into `connectors.LIVE_REGISTRY` when a customer's actual PMS/POS/CRM is identified; until then live mode safely reports unavailable.

## Next Tasks
1. First real connector: implement `LIVE_REGISTRY` entry for the chosen hotel PMS/booking system (availability + booking status read, create/cancel booking actions).
2. Static knowledge base management (separate from live data) per AI employee.
3. Phase 3 billing (rates/markup/GST + Razorpay invoices + reconciliation + caps).
4. Configurable retention + ORBIT legal text; real WhatsApp managed onboarding.

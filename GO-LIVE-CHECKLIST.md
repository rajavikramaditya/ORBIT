# ORBIT — Real customer go-live checklist

**Customer:** interior design + modular construction (first production tenant).  
**Code freeze:** 135 automated tests passing; frontend production build successful.  
**This document does not claim Live.** Local `.env` has **no** ElevenLabs / Exotel / Meta / Razorpay credentials.

Status values (exactly one per row):

| Status | Meaning |
|---|---|
| READY | Code path exists and is tested. Still not Live until credentials + provider config + a real event succeed. |
| CREDENTIAL_REQUIRED | Vendor/API secret is missing in this environment. |
| PROVIDER_CONFIGURATION_REQUIRED | Dashboard / DID / agent / webhook wiring outside ORBIT is not done. |
| CODE_MISSING | ORBIT cannot do this without a code change. **None found for this MVP.** |
| NOT_SUPPORTED_BY_DESIGN | Out of product scope (CRM, outbound, ORBIT-sent WhatsApp, etc.). |

---

## 1. ElevenLabs

| Item | Status | Evidence / note |
|---|---|---|
| API key (`ELEVENLABS_API_KEY`) | CREDENTIAL_REQUIRED | Empty in local `.env`. Admin verify-voice will return `credentials_required`. |
| Webhook secret (`ELEVENLABS_WEBHOOK_SECRET`) | CREDENTIAL_REQUIRED | Production post-call/tool-call **refuse** without this (no demo HMAC). |
| Agent verification | READY | `POST /api/admin/ai-employees/{id}/verify-voice` calls `GET https://api.elevenlabs.io/v1/convai/agents/{provider_agent_id}`. Needs key + real agent id. |
| Tool registration on the agent | PROVIDER_CONFIGURATION_REQUIRED | ORBIT serves `POST /api/webhooks/elevenlabs/tool-call`. Tools (`get_catalogue`, `get_services`, `get_business_policy`, `capture_lead`, `qualify_lead`, `request_owner_callback`) must be registered **on the ElevenLabs agent**. ORBIT does not push tool definitions. |
| Post-call webhook | READY | `POST /api/webhooks/elevenlabs/post-call` — HMAC, tenant from `provider_agent_id` only, conversation + lead upsert, idempotent on provider `conversation_id`. |

---

## 2. Exotel / phone

| Item | Status | Evidence / note |
|---|---|---|
| Credentials (`EXOTEL_API_KEY`, `EXOTEL_API_TOKEN`, `EXOTEL_ACCOUNT_SID`, `EXOTEL_SUBDOMAIN`) | CREDENTIAL_REQUIRED | Empty locally. `verify-telephony` hits Exotel Accounts API only when set. |
| Inbound webhook secret (`EXOTEL_WEBHOOK_SECRET`) | CREDENTIAL_REQUIRED | Production inbound mapping requires this (or `WEBHOOK_SECRET` fallback) + signature/token. |
| DID recorded in ORBIT | PROVIDER_CONFIGURATION_REQUIRED | Admin `POST /api/admin/tenants/{id}/channels` type `phone`. Status is `configured` / `credentials_required`, never fake `connected`. |
| Inbound mapping webhook | READY | `POST /api/webhooks/exotel/inbound` maps `CallTo` → tenant channel. Does **not** create a completed conversation. |
| DID → ElevenLabs routing | PROVIDER_CONFIGURATION_REQUIRED | Must be set in **Exotel applet / SIP / voicebot** to the ElevenLabs agent. Not an ORBIT code path. |
| Actual audio path | PROVIDER_CONFIGURATION_REQUIRED | Customer audio never transits ORBIT. Exotel ↔ ElevenLabs only. |

---

## 3. WhatsApp

**Deployment choice for this customer (must pick one conversational path):**

**Use ElevenLabs WhatsApp** for AI replies and catalogue/link send.  
Meta Cloud API in ORBIT is **inbound mapping + lead persist only**. ORBIT will not reply on WhatsApp.

| Item | Status | Evidence / note |
|---|---|---|
| Path: ElevenLabs WhatsApp | PROVIDER_CONFIGURATION_REQUIRED | Connect the business WhatsApp number to the **same** ElevenLabs agent. Conversation completion uses the existing post-call webhook. |
| Path: Meta Cloud API (optional) | CREDENTIAL_REQUIRED | Needs `META_WHATSAPP_TOKEN`, `META_WHATSAPP_APP_SECRET`, `META_WHATSAPP_VERIFY_TOKEN`, and channel `meta.phone_number_id`. |
| Inbound message path (Meta) | READY | `POST /api/webhooks/whatsapp` maps number/`phone_number_id` → tenant, persists message + lead. |
| Inbound message path (ElevenLabs WA) | READY | Same as phone: post-call ingest + optional `capture_lead` tool-call. |
| AI reply capability | NOT_SUPPORTED_BY_DESIGN (in ORBIT) | Replies are ElevenLabs-native. Meta-only inbound = lead stored, **no** auto-reply. |
| Catalogue / link sending | NOT_SUPPORTED_BY_DESIGN (in ORBIT) | `send_catalogue` returns `unsupported` / `owner: elevenlabs`. ORBIT `get_catalogue` **reads** `catalogue_url` / services so ElevenLabs can send. |
| Webhook verification (Meta GET hub challenge) | READY | `GET /api/webhooks/whatsapp` — 503 until `META_WHATSAPP_VERIFY_TOKEN` is set. |
| Webhook signature (Meta POST) | READY | Production requires `X-Hub-Signature-256`. |
| Idempotency | READY | Meta: unique `wamid` in `inbound_events`. ElevenLabs: unique provider `conversation_id`. Same WhatsApp thread updates one conversation/lead. |

---

## 4. Website / form

| Item | Status | Evidence / note |
|---|---|---|
| Intake key | READY | Admin `POST /api/admin/tenants/{id}/intake-key`. Tenant sees path on Channels. |
| Public HTTPS endpoint | PROVIDER_CONFIGURATION_REQUIRED | Code is `POST /api/intake/{intake_key}`. Public HTTPS hostname is hosting, not code. |
| Form payload | READY | `source`, name/phone/email, `requirement`/`message`. Payload `tenant_id` is ignored. |
| Lead creation | READY | Creates conversation + lead; source `website` / `form`. |
| Duplicate submission | READY | `Idempotency-Key` header or `idempotency_key` → same lead, `status: duplicate`. |

---

## 5. ORBIT application

| Item | Status | Evidence / note |
|---|---|---|
| Tenant resolution | READY | Session `tid(user)` on APIs. Webhooks: agent_id or channel identifier. Never client `tenant_id`. |
| Business data | READY | Tenant Business Data + `get_catalogue` / `get_services` / policies. Manual entry is the first-customer source of truth. |
| Lead creation | READY | Post-call, tool-call, WhatsApp inbound, form intake. Unknown fields stay null. |
| Lead qualification | READY | `qualify_lead` tool + owner Mark qualified. Status machine server-validated. |
| Owner callback / escalation | READY | Persist `owner_callback_requested`. **No outbound call.** Live transfer = ElevenLabs native. |
| Conversation history | READY | List + detail with transcript on `GET /api/tenant/conversations/{id}`. Lead detail links conversation **without** copying transcript. |
| Authentication | READY | JWT cookie auth. Production login/register rate limit 20 / 5 min / IP. |
| Tenant isolation | READY | Cross-tenant lead GET → 404. Tests cover Taj vs Leela. |
| Audit logs | READY | Admin `GET /api/admin/audit-log`. Lead owner updates write `lead.update`. |

---

## 5b. Managed onboarding + channel plans

ORBIT staff complete provider wiring. Owners never enter API keys, HMAC secrets, or webhook URLs.

| Item | Status | Evidence / note |
|---|---|---|
| Operational state | READY | Derived: `onboarding` / `ready_for_test` / `live` / `suspended` / `blocked`. Stored tenant.status remains `onboarding` \| `live` \| `suspended`. |
| Channel plan | READY | Admin `PATCH /api/admin/tenants/{id}/channel-plan`: `phone` / `whatsapp` / `phone_and_whatsapp`. Unused channels are not go-live blockers. |
| Honest connection status | READY | Admin sees `not_configured` / `credentials_required` / `configured` / `verified` / `failed`. Recording a DID is never `verified`. |
| Owner language | READY | Tenant Channels/Overview show Ready vs Setup in progress. Missing owner data: “ORBIT setup team needs this information”. |
| Go-live gate | READY | `PATCH .../status` `{status: live}` refused while required checklist items fail. Production also requires verified providers + `ELEVENLABS_WEBHOOK_SECRET`. |
| Phone-only / WhatsApp-only | READY | Same AI employee. Do not require the channel the customer did not select. |

---

## 6. Production hosting

| Item | Status | Evidence / note |
|---|---|---|
| HTTPS | PROVIDER_CONFIGURATION_REQUIRED | App does not terminate TLS. Put HTTPS in front of API + UI. |
| Production MongoDB | CREDENTIAL_REQUIRED | Need dedicated `MONGO_URL` + `DB_NAME` (not `orbit_dev`). Process refuses weak prod DB names. |
| Secrets | CREDENTIAL_REQUIRED | Unique `JWT_SECRET`, `WEBHOOK_SECRET`, `ADMIN_PASSWORD`; `COOKIE_SECURE=true`. |
| CORS | READY (code) / PROVIDER_CONFIGURATION_REQUIRED (values) | `FRONTEND_URL` + optional `CORS_ORIGINS`. Localhost origins only in non-production. |
| Cookie security | READY | `COOKIE_SECURE` must be `true` or production startup fails. |
| Backups | PROVIDER_CONFIGURATION_REQUIRED | Atlas snapshots ≥ 7 days; restore-tested. Documented in `DEPLOYMENT.md`. Not automated by ORBIT. |
| Logging | READY | INFO process logs. Do not log bodies, cookies, keys, or transcripts. Access log = method/path/status. |
| Error handling | READY | Bad webhook signature → 401. Unmapped agent/number → quarantine. Processing exception → 500 (provider retry). |
| Rate limits | READY (auth only) | Production auth throttle only. Webhooks are not application-rate-limited (rely on signature + provider retry). |

Razorpay is **not** required for the inbound enquiry MVP. Payments remain `credentials_required` until invoicing is needed.

---

## 7. Manual test plan (first customer)

Fill **Actual** and **PASS/FAIL** only after a real event. Do not mark PASS from unit tests.

Customer fixtures to prepare first: legal name, owner name/phone/email, services list, starting prices, catalogue/brochure URL, owner callback number, preferred DID, WhatsApp business number, website form URL.

### A. Call the real DID from a mobile

| | |
|---|---|
| Expected | Call rings through Exotel into the ElevenLabs agent. Caller hears the AI. ORBIT Exotel inbound (if configured) shows `mapped`, `conversation_created: false`. |
| Actual | _ |
| PASS/FAIL | _ |
| Evidence | Call recording or live listen; Exotel CDR; optional ORBIT inbound `CallSid` mapping. |

### B. Ask a service question

| | |
|---|---|
| Expected | Agent answers from ORBIT business data / knowledge (services), not invented inventory. |
| Actual | _ |
| PASS/FAIL | _ |
| Evidence | Transcript turn; tool-call log if `get_services` / `get_catalogue` fired. |

### C. Ask a pricing question

| | |
|---|---|
| Expected | Agent quotes only stored prices. If unknown, says unknown — does not invent a number. |
| Actual | _ |
| PASS/FAIL | _ |
| Evidence | Transcript vs Business Data prices. |

### D. Ask for catalogue / brochure

| | |
|---|---|
| Expected | On **voice**: agent can read/speak the catalogue URL from `get_catalogue`. On **WhatsApp (ElevenLabs)**: native send of that URL/file. ORBIT itself does not send media. |
| Actual | _ |
| PASS/FAIL | _ |
| Evidence | Transcript and/or WhatsApp thread showing the link. |

### E. Give a real project requirement

| | |
|---|---|
| Expected | Requirement captured (summary / `capture_lead`). Missing name/budget stay empty. |
| Actual | _ |
| PASS/FAIL | _ |
| Evidence | Lead `enquiry_summary` / `requirement` matches what the caller said. |

### F. Ask for the owner

| | |
|---|---|
| Expected | If ElevenLabs transfer-to-number is configured, live transfer may occur. ORBIT always persists **Owner callback requested** when `request_owner_callback` (or equivalent analysis flag) fires. ORBIT does not dial the owner. |
| Actual | _ |
| PASS/FAIL | _ |
| Evidence | Lead banner `Owner callback requested`; callback record; optional ElevenLabs transfer log. |

### G. Verify lead in ORBIT

| | |
|---|---|
| Expected | Owner Leads page shows customer, source `phone`, requirement, qualification/follow-up, callback flag. |
| Actual | _ |
| PASS/FAIL | _ |
| Evidence | Screenshot of Leads row + detail (no provider IDs). |

### H. Verify conversation / transcript

| | |
|---|---|
| Expected | Conversations list has the call; detail includes summary + transcript. Lead links to conversation without duplicating transcript. |
| Actual | _ |
| PASS/FAIL | _ |
| Evidence | Conversation detail screenshot. |

### I. Send a real WhatsApp message

| | |
|---|---|
| Expected | Message reaches the configured WhatsApp number (ElevenLabs and/or Meta). |
| Actual | _ |
| PASS/FAIL | _ |
| Evidence | WhatsApp thread timestamp. |

### J. Verify inbound mapping

| | |
|---|---|
| Expected | Event maps to **this** tenant only. Spoofed `tenant_id` ignored. |
| Actual | _ |
| PASS/FAIL | _ |
| Evidence | Lead `tenant` isolation; webhook result tenant id (admin/logs only). |

### K. Verify AI response (if provider supports it)

| | |
|---|---|
| Expected | **ElevenLabs WhatsApp:** AI replies in-thread. **Meta-only:** no ORBIT reply — FAIL this row only if ElevenLabs WA was the chosen path and no reply arrived. |
| Actual | _ |
| PASS/FAIL | _ |
| Evidence | WhatsApp reply screenshot. |

### L. Verify catalogue / link sending

| | |
|---|---|
| Expected | **ElevenLabs WhatsApp:** agent sends stored catalogue URL. **ORBIT/Meta:** will not send. |
| Actual | _ |
| PASS/FAIL | _ |
| Evidence | Link in WhatsApp thread matching Business Data `catalogue_url`. |

### M. Submit website form

| | |
|---|---|
| Expected | `POST https://<api>/api/intake/<intake_key>` with name, phone, requirement returns `ingested` (no `tenant_id` in response). |
| Actual | _ |
| PASS/FAIL | _ |
| Evidence | HTTP 200 body + Leads row source `website`/`form`. |

### N. Verify form lead creation

| | |
|---|---|
| Expected | Same as G for that enquiry. Contact/requirement match the form. No invented fields. |
| Actual | _ |
| PASS/FAIL | _ |
| Evidence | Lead detail screenshot. |

### O. Duplicate webhook / form does not duplicate lead

| | |
|---|---|
| Expected | Replay post-call same `conversation_id` → `duplicate`, one lead. Replay same WhatsApp `wamid` → `duplicate`. Replay form same `idempotency_key` → `duplicate`, same `lead_id`. |
| Actual | _ |
| PASS/FAIL | _ |
| Evidence | Second HTTP body + single lead id in dashboard. |

---

## Credentials required from vendors

**ElevenLabs**

- API key  
- Conversational AI webhook secret  
- Agent id for this customer (store in ORBIT as `provider_agent_id`; do not show to the owner)

**Exotel**

- API key, API token, Account SID, subdomain  
- Inbound DID  
- Webhook signing secret (or applet query token matching `EXOTEL_WEBHOOK_SECRET`)

**WhatsApp (pick the conversational owner)**

- ElevenLabs: WhatsApp channel attached to the agent (preferred for AI + catalogue send)  
- Meta (only if using Cloud API inbound to ORBIT): permanent token, app secret, verify token, phone_number_id  

**Hosting / Mongo**

- Production `MONGO_URL`, dedicated `DB_NAME`  
- Unique `JWT_SECRET` (≥32), `WEBHOOK_SECRET`, `ADMIN_EMAIL` / `ADMIN_PASSWORD`  
- `ORBIT_ENV=production`, `COOKIE_SECURE=true`, `FRONTEND_URL` HTTPS  

Do not put provider keys in `REACT_APP_*`.

---

## Dashboard configuration required

**ElevenLabs**

1. Create agent (voice, prompt, knowledge aligned with ORBIT business data — do not duplicate a second CRM).  
2. Register server tools pointing at `https://<api>/api/webhooks/elevenlabs/tool-call`: at least `get_catalogue`, `get_services` / `get_business_policy`, `capture_lead`, `qualify_lead`, `request_owner_callback`.  
3. Post-call webhook → `https://<api>/api/webhooks/elevenlabs/post-call` with signing secret.  
4. Optional: native transfer-to-number = owner mobile.  
5. Optional: WhatsApp channel on this agent + native send for URLs/files.

**Exotel**

1. Assign DID.  
2. Applet: inbound call → ElevenLabs agent (audio).  
3. Status callback (optional) → `https://<api>/api/webhooks/exotel/inbound` with signature/token.

**ORBIT Admin**

1. Create production tenant + owner login.  
2. Complete profile (email, phone, address).  
3. Attach AI employee with the real `provider_agent_id`.  
4. Verify voice. Connect phone DID; verify telephony.  
5. Connect WhatsApp identifier; verify if using Meta.  
6. Enter Business Data: services, prices, `catalogue_url`, hours/policies.  
7. Rotate intake key; give path to the website form.  
8. Set pricing if invoices matter later.  
9. Lifecycle: testing → approved → live **only after** a real call PASSes A–H.

**Customer website**

- Form POST to `/api/intake/<intake_key>` with `Idempotency-Key` per submission.

---

## Customer information required

- Legal / trading name  
- Owner name, login email, mobile (callback / transfer target)  
- Address, public phone, WhatsApp number, website  
- Services (e.g. interior design, modular kitchen, modular construction)  
- Price bands **only if they will be spoken**; otherwise leave blank (AI must not invent)  
- Catalogue / brochure URL or file ElevenLabs should send  
- Hours, service area, typical timeline language  
- Phrases for when to escalate to owner  

---

## First real-call procedure

1. Confirm Exotel DID routes to ElevenLabs and post-call webhook is signed.  
2. From a personal mobile, call the DID.  
3. Ask service, price, catalogue, describe a real project, ask for owner.  
4. Hang up. Wait for post-call ingest.  
5. Owner: Leads + Conversations. Confirm requirement, source `phone`, transcript, callback flag if asked.  
6. Replay is not needed in production; if ElevenLabs retries, still one lead.  
7. Only then consider tenant status Live.

## First real-WhatsApp procedure

1. Confirm conversational path is **ElevenLabs WhatsApp** (recommended).  
2. Message the business number: service + catalogue + owner request.  
3. Confirm AI reply in-thread and catalogue link if configured.  
4. Confirm one lead in ORBIT, source `whatsapp`, isolation vs any other tenant.  
5. If Meta-only was configured instead: expect lead, **not** an ORBIT-generated reply.

## First website-form procedure

1. Admin rotates intake key; copy `POST https://<api>/api/intake/<key>`.  
2. Submit name, phone, real requirement, unique `Idempotency-Key`.  
3. Confirm lead source `website`/`form`.  
4. Submit again with the **same** idempotency key → `duplicate`, same `lead_id`.

---

## CODE_MISSING

**None** for this MVP.

Remaining work is credentials, provider dashboards, HTTPS/Mongo, and the manual tests above. Do not add CRM, outbound, bulk WhatsApp, PMS, or duplicate ElevenLabs send/transfer tools.

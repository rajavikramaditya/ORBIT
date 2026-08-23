# AI Calling SaaS --- MVP Blueprint v1.0

**Purpose:** Production-ready MVP for selling branded AI business agents
to multiple businesses from one SaaS website.

**Primary implementation target:** Emergent

**Design direction:** Premium, minimal, Apple-inspired product UI ---
clean white/near-black surfaces, generous spacing, strong typography,
subtle borders, restrained motion, no clutter. Do not copy Apple's
proprietary assets or exact UI.

**Current architecture decision:** ElevenLabs remains the underlying
AI/voice-agent platform. The product being sold is our own multi-tenant
SaaS, branded dashboard, client management, usage billing, delivery
layer, monitoring and managed customization service.

------------------------------------------------------------------------

## 1. Product Definition

We are NOT building a new voice AI engine.

We are building a **multi-tenant SaaS wrapper and managed service around
existing ElevenLabs Agents**.

### Customer promise

> One business gets one or more AI employees that can handle configured
> phone/WhatsApp/customer conversations. The business uses our website
> to access its account, see activity and usage, while our team manages
> the AI agent configuration.

### Core model

``` text
Our Domain
    ↓
Our SaaS
    ↓
Tenant / Business Account
    ↓
AI Employee Record
    ↓
ElevenLabs Agent ID
    ↓
Phone / WhatsApp / Web interaction
    ↓
End Customer
```

------------------------------------------------------------------------

# 2. Business Model --- LOCKED

## Revenue model

Use **monthly usage-based billing**, similar to a phone, electricity or
internet bill.

There should be **no requirement to sell a separate software copy or
separate domain to each customer**.

### Customer billing

Each customer has:

-   Account
-   Usage meter
-   Monthly billing period
-   Usage statement
-   Invoice
-   Optional spending limit
-   Usage alerts

### Billable usage

The exact pricing/margin formula must be configurable by Admin rather
than hard-coded.

Possible billable components:

-   AI conversation/call minutes
-   Telephony charges
-   WhatsApp/message usage where applicable
-   Other provider usage that we choose to pass through

The system must distinguish:

1.  **Provider cost**
2.  **Our selling rate**
3.  **Customer usage**
4.  **Customer bill**
5.  **Gross margin**

Do not expose internal provider cost to the customer by default.

### Important

Do not advertise "unlimited" usage.

The customer should always be able to see:

-   Current period usage
-   Estimated current bill
-   Remaining usage allowance/cap, if a cap is configured
-   Previous invoices

### Usage protection

Each tenant should support:

-   Soft usage warning
-   Spending threshold
-   Hard usage cap
-   Admin override

If a tenant reaches its hard cap, new billable activity can be suspended
according to the configured policy instead of creating uncontrolled
costs.

------------------------------------------------------------------------

# 3. Multi-Tenant Architecture --- NON-NEGOTIABLE

One domain serves all businesses.

Example:

``` text
ourbrand.ai
ourbrand.ai/login
ourbrand.ai/dashboard
```

There is NOT:

``` text
hotel1.com
hotel2.com
hotel3.com
```

for the SaaS itself.

Instead:

``` text
ourbrand.ai
    ├── Tenant A — Royal Palace Hotel
    ├── Tenant B — Sharma Motors
    ├── Tenant C — ABC Marketing
    └── Tenant D — XYZ Clinic
```

Every customer is a separate **tenant**.

Every tenant must have isolated:

-   Users
-   Business profile
-   AI employees
-   Agent mappings
-   Phone numbers
-   WhatsApp connections
-   Calls
-   Conversations
-   Usage
-   Invoices
-   Requests
-   Settings

### Critical rule

Every tenant-owned database record must carry a tenant identifier or be
reachable through an equally strong tenant-scoped relationship.

A customer must NEVER be able to query, view, edit or infer another
tenant's data.

------------------------------------------------------------------------

# 4. Roles

## Platform Admin

Our internal team.

Can:

-   Create tenants
-   Edit tenants
-   Attach ElevenLabs agents
-   Attach channels
-   View all customers
-   View usage
-   View billing
-   View health
-   Create/suspend/deploy agents
-   Review customization requests
-   Change customer-facing branding
-   Manage subscription/billing configuration
-   View audit logs

## Tenant Owner

Customer/business owner.

Can:

-   View own dashboard
-   Edit permitted business profile fields
-   View own calls/conversations
-   View own usage
-   View invoices
-   View connected channels
-   Submit customization requests
-   Test their AI employee
-   Manage permitted account users

Cannot:

-   Edit ElevenLabs system prompt
-   Edit agent personality logic
-   Edit knowledge base
-   Edit workflows
-   Edit tools
-   Change core AI behavior
-   See ElevenLabs credentials
-   See another tenant's data

## Optional Tenant Staff

Later, not required for first MVP.

------------------------------------------------------------------------

# 5. Customer-Controlled vs Provider-Controlled & Dynamic Data Architecture

This boundary is a core architectural and business rule designed to ensure SaaS scalability while eliminating the "agency bottleneck."

## 5.1 Dynamic Data via Webhooks (Zero-Ticket Real-Time Sync)

Dynamic, frequently changing business data is **NOT** hardcoded into static prompts or static knowledge bases. Instead, the AI agent dynamically fetches live data during calls via **Webhooks & Tool Calling APIs**:

- **Live Pricing / Tariffs:** Daily room rates, seasonal tariffs, package prices.
- **Real-Time Availability / Inventory:** Available room types, table availability, appointment slots.
- **Operational Rules & Policies:** Check-in/check-out timings, buffet hours, cancellation & refund policies, active discount codes.

### Scalability Advantage:
When a business owner or hotel manager updates prices, policies, or timings in their existing system (PMS/POS) or the ORBIT dashboard, the AI agent immediately reflects the new data on live calls through the webhook tool. **Zero customization tickets are created for our team**, keeping operations lean and scalable to 1000+ tenants without expanding prompt-engineering headcount.

## 5.2 Customer-Controlled (Self-Service from Dashboard)

- Company name, branding, logo
- Contact details, address, website
- Operational metadata, business hours, and live rates/policy fields
- View call logs, audio recordings, and full transcripts
- Real-time usage and billing metrics

## 5.3 Provider-Controlled (Managed by ORBIT Platform Team)

- System prompt architecture and safety guardrails
- AI personality, greeting flow, and voice selection
- Multi-lingual tone switching (e.g. English, Hindi, Hinglish)
- Tool schemas and webhook endpoint bindings
- Telephony routing, failover, and provider credentials

### If customer wants a structural workflow change:
They submit a **Customization Request** (e.g., adding a completely new automated workflow like airport pickup upsell or custom CRM sync). Our team processes and tests it as a managed service.

------------------------------------------------------------------------

# 6. ElevenLabs Integration Strategy

ElevenLabs is the provider layer.

Store the provider relationship in our database.

Example:

``` text
provider: elevenlabs
provider_agent_id: agent_xxxxx
```

Do not make the customer-facing system dependent on an ElevenLabs share
URL alone.

The stable internal reference should be the **agent ID**.

Our own route resolves the tenant/agent relationship.

Example:

``` text
ourbrand.ai/agent/tenant_abc
        ↓
our backend
        ↓
tenant_abc
        ↓
agent record
        ↓
ElevenLabs agent ID
        ↓
agent interface
```

### Existing-agent-first MVP

For the first release, it is acceptable for our team to:

1.  Create/configure the agent in ElevenLabs
2.  Test it
3.  Copy/store the agent ID
4.  Attach it to the tenant
5.  Deploy it through our dashboard

Do NOT build a full ElevenLabs management replica.

### Future

When client volume justifies it, use the ElevenLabs API to automate:

-   Agent creation
-   Agent retrieval
-   Configuration
-   Version/deployment workflows
-   Agent mapping

The architecture must allow this later without redesigning the database.

------------------------------------------------------------------------

# 7. Agent Interface / Branding

The customer should interact with our branded product, not a raw
provider dashboard.

### Branded agent page

Example:

``` text
OUR BRAND

Royal Palace Hotel

Riya
AI Reservation Assistant

[ Start Conversation ]

Available 24/7
```

The underlying agent can be powered by ElevenLabs.

### Important transparency rule

Do NOT claim that the AI is human.

The interface must clearly disclose that the user is interacting with an
AI assistant before interaction where required.

The exact disclosure and consent language must follow the applicable
ElevenLabs terms and the customer's legal requirements.

------------------------------------------------------------------------

# 8. Phone + WhatsApp

These are the primary customer communication channels for MVP.

## Phone

Tenant has:

``` text
Phone Number
    ↓
AI Employee
    ↓
ElevenLabs / configured telephony
```

Dashboard shows:

-   Number
-   Status
-   Assigned AI employee
-   Connection state

## WhatsApp

Tenant has:

``` text
WhatsApp Number
    ↓
AI Employee / configured integration
```

Dashboard shows:

-   WhatsApp status
-   Connected number/account
-   Assigned AI employee

### Important

Our SaaS stores the mapping and status.

The actual provider integration/configuration remains controlled by the
platform/admin workflow unless an integration is later automated.

------------------------------------------------------------------------

# 9. AI Employee Model

A tenant can eventually have multiple AI employees.

Example:

``` text
Royal Palace Hotel

Riya
Reservation Agent

Aarav
Sales Agent

Neha
Customer Support Agent
```

Each AI employee has:

-   Internal ID
-   Tenant ID
-   Display name
-   Role
-   Status
-   ElevenLabs provider ID
-   Connected channels

For MVP, one active AI employee per tenant is enough if this materially
simplifies implementation. The database should still support multiple
agents.

------------------------------------------------------------------------

# 10. Dashboard

## Customer Dashboard

### Navigation

-   Overview
-   AI Employee
-   Calls / Conversations
-   Usage
-   Billing
-   Business Profile
-   Customization Requests
-   Settings

### Overview cards

-   AI status
-   Calls today
-   Conversations
-   Successful outcomes, where available
-   Current-period usage
-   Estimated bill
-   Connected channels

Keep the dashboard intentionally simple.

------------------------------------------------------------------------

# 11. Calls / Conversations

Customer can see only its own activity.

For each conversation, where available:

-   Date/time
-   Caller/contact
-   Duration
-   Direction
-   Outcome
-   Summary
-   Transcript
-   Recording availability
-   Agent used

Do not expose provider credentials or internal infrastructure
information.

Recording/transcript retention must be configurable and documented.

------------------------------------------------------------------------

# 12. Usage Dashboard

Customer sees a utility-style bill.

Example:

``` text
August Usage

AI Conversation Minutes
428 min

Estimated Usage Charge
₹X,XXX

Telephony
₹XXX

WhatsApp / Messages
₹XXX

Current Estimated Total
₹X,XXX
```

The UI should clearly label estimates versus finalized invoices.

### Admin sees more detail

``` text
Tenant
Provider cost
Customer charge
Margin
Usage
```

This is essential for protecting the business model.

------------------------------------------------------------------------

# 13. Billing

MVP billing flow:

``` text
Tenant usage
    ↓
Usage events
    ↓
Monthly aggregation
    ↓
Pricing rules
    ↓
Invoice
    ↓
Payment
    ↓
Paid / Due / Failed
```

Pricing rules must be stored in configuration, not hard-coded into UI
components.

Do not build a complicated billing engine.

Use a reliable payment provider for collection and invoice payment.

------------------------------------------------------------------------

# 14. Customization Requests

Customer dashboard:

``` text
Request a Change

What would you like changed?

[ text area ]

[ Submit Request ]
```

Admin:

``` text
Customization Requests

Royal Palace Hotel
"Add airport pickup upsell"

Status: Pending

[Open]
[Mark In Progress]
[Complete]
```

Our team then changes the ElevenLabs agent, tests it, and publishes the
approved version.

### Optional later

Add:

-   Priority
-   Estimated cost
-   Approval
-   Payment status

Not required for first MVP.

------------------------------------------------------------------------

# 15. Agent Deployment State

Every agent should have a simple lifecycle:

``` text
Draft
  ↓
Testing
  ↓
Approved
  ↓
Live
  ↓
Suspended
```

Do not expose raw provider configuration to customers.

### Deployment rule

An agent should not become Live until required onboarding checks are
complete.

------------------------------------------------------------------------

# 16. Version / Rollback Safety

The platform must preserve enough information to know:

-   Current live agent
-   Previous agent/version reference
-   Deployment timestamp
-   Who deployed it

If a customization breaks the experience, Admin must be able to restore
the previous known-good configuration where supported by the provider
workflow.

Do not build a complex version editor for MVP.

Just preserve the mapping/history necessary for safe rollback.

------------------------------------------------------------------------

# 17. Admin Panel

Admin navigation:

-   Overview
-   Customers
-   AI Employees
-   Channels
-   Usage
-   Billing
-   Customization Requests
-   System Health
-   Audit Log
-   Settings

### Admin Overview

Show:

-   Total tenants
-   Active tenants
-   Suspended tenants
-   Active agents
-   Current active calls/concurrency where available
-   Current-period provider usage
-   Current-period customer billing
-   Estimated gross margin
-   Failed payments
-   System warnings

------------------------------------------------------------------------

# 18. System Health

This is mandatory for a 100-customer launch.

Admin should see the health of:

-   SaaS application
-   Database
-   ElevenLabs connectivity
-   Telephony
-   WhatsApp integration
-   Billing/payment provider

Example:

``` text
SaaS             ● Healthy
Database         ● Healthy
AI Provider      ● Healthy
Telephony        ● Healthy
WhatsApp         ● Healthy
Billing          ● Healthy
```

If something fails, Admin should know before customers start reporting
it.

------------------------------------------------------------------------

# 19. Capacity / Concurrency

Do not confuse:

**100 customers**

with:

**100 simultaneous calls.**

Provider concurrency is a platform-level capacity consideration.

The current ElevenAgents pricing page lists plan-specific concurrent
call limits and usage-based charges. External LLM and telephony costs
can also apply.

Therefore Admin needs a capacity indicator:

``` text
Active Calls
23

Configured Capacity
40

Utilization
57.5%

Status
Healthy
```

The exact production limit must be selected based on the actual
ElevenLabs commercial plan and confirmed capacity.

Do NOT promise customers a concurrency level that has not been
purchased/confirmed.

------------------------------------------------------------------------

# 20. Onboarding Checklist

Every new customer must pass a simple checklist.

``` text
[ ] Tenant created
[ ] Business profile complete
[ ] AI employee created
[ ] ElevenLabs agent attached
[ ] Knowledge/configuration completed
[ ] Phone connected, if applicable
[ ] WhatsApp connected, if applicable
[ ] AI disclosure configured
[ ] Test conversation passed
[ ] Inbound test passed
[ ] Outbound test passed, if enabled
[ ] Human handoff tested, if applicable
[ ] Billing configured
[ ] Usage cap configured
[ ] Agent approved
[ ] Agent deployed
```

Only after required checks pass:

**Status = Live**

------------------------------------------------------------------------

# 21. Security Requirements

MVP security must include:

-   Secure authentication
-   Password reset / account recovery
-   Tenant isolation
-   Server-side authorization checks
-   No provider API keys in frontend
-   Secrets stored server-side
-   HTTPS
-   Audit logging for admin actions
-   Rate limiting on authentication and sensitive endpoints
-   Input validation
-   Secure file handling
-   Database backups
-   Error logging without leaking secrets

### Critical

Never trust a `tenant_id` supplied by the browser as proof of access.

The server must derive the authorized tenant from the authenticated
session/user relationship.

------------------------------------------------------------------------

# 22. Data Model --- Minimum

Suggested tables/entities:

``` text
users
tenants
tenant_members
business_profiles
ai_agents
agent_provider_mappings
channels
phone_numbers
whatsapp_connections
conversations
conversation_events
usage_events
billing_accounts
invoices
customization_requests
deployments
audit_logs
system_health
```

Keep the schema simple.

Do not create tables for features that are not in MVP.

------------------------------------------------------------------------

# 23. Provider Abstraction

Even though ElevenLabs is the only provider for MVP, store provider
identity explicitly.

``` text
provider = elevenlabs
provider_agent_id = ...
```

This prevents the entire database from becoming structurally dependent
on one provider.

Do NOT implement another provider now.

------------------------------------------------------------------------

# 24. Business Integrations & Dynamic Tool Architecture (READ vs ACTION)

The AI Agent never operates on stale or hardcoded business assumptions. It interacts with the business via a **secure, standardized Tool Calling layer**:

### 24.1 Dynamic READ Tools (Live Data on Call)
- **Room / Service Availability & Rates:** `get_live_rates(date, type)` -> returns real-time tariff and available units.
- **Policies & Operating Timings:** `get_business_policy(category)` -> returns latest rules, buffet timings, check-in/out guidelines.
- **Live Inquiry / Status Check:** `check_booking_status(booking_id/phone)`.

*Zero prompt changes are required when business numbers, rates, or operational policies change.*

### 24.2 Guarded ACTION Tools (Executing Safe Business Tasks)
- **Create Reservation / Lead:** `create_booking_inquiry(details)` -> sends confirmed booking details into the business CRM/PMS or generates an instant WhatsApp confirmation.
- **Escalate to Human:** `request_human_callback(caller_info, reason)`.

All action tools enforce confirmation steps and server-side authorization so the LLM cannot perform destructive operations.

### 24.3 CRM & External PMS Strategy
Do NOT build a full CRM. If the client has an existing CRM (HubSpot, Salesforce, Pipedrive) or Hotel PMS, connect it via the tool connector layer. If they do not, our built-in conversation history and lead ledger handle the storage.

------------------------------------------------------------------------

# 25. Failure Handling

The system must fail safely.

Examples:

### ElevenLabs unavailable

Show agent/channel status as unavailable and notify Admin.

### Billing failure

Apply configured grace period / suspension policy.

### Provider agent missing

Do not silently create a broken experience. Mark agent as configuration
error.

### Phone disconnected

Show channel error and alert Admin.

### WhatsApp disconnected

Show channel error and alert Admin.

### Tenant suspended

Disable access according to policy while preserving data needed for
recovery.

------------------------------------------------------------------------

# 26. Audit Log

Admin actions should be recorded.

Example:

``` text
2026-08-17 21:30
Admin: user@example.com

Changed:
Royal Palace Hotel

Action:
Attached ElevenLabs Agent

Old:
agent_old

New:
agent_new
```

Also log:

-   Agent deployment
-   Agent suspension
-   Channel changes
-   Billing changes
-   Tenant status changes
-   Admin access
-   Customization completion

------------------------------------------------------------------------

# 27. Privacy / Legal Product Requirements

The SaaS must provide a place for:

-   Terms of Service
-   Privacy Policy
-   AI interaction disclosure
-   Recording disclosure where applicable
-   Customer-specific privacy/configuration notices where applicable

For ElevenAgents specifically, current ElevenLabs terms require clear
notice that users are interacting with AI and that conversations are
recorded and may be shared with ElevenLabs and LLM providers. They also
place responsibility for legally required outbound-call
consents/disclosures on the customer.

This must be treated as a launch requirement, not a later feature.

------------------------------------------------------------------------

# 28. Branding / UI

## Design goal

Premium, calm, professional and trustworthy.

Apple-inspired, but not a copy.

### Visual characteristics

-   White / off-white background
-   Near-black typography
-   Very subtle gray borders
-   Large clean headings
-   Generous whitespace
-   Rounded but restrained cards
-   Minimal shadows
-   Smooth micro-interactions
-   Strong typography hierarchy
-   Simple iconography
-   No excessive gradients
-   No crowded admin-dashboard aesthetic

### Customer should feel

> "This is a serious business product."

Not:

> "This is a demo made around an AI tool."

### Main navigation

Use a restrained left sidebar or top navigation.

Avoid dozens of menu items.

------------------------------------------------------------------------

# 29. Public Website

MVP public site:

``` text
Home
Solutions
How It Works
Pricing
Demo
Login
Contact
```

The primary message:

> **AI employees for real businesses.**

Do not make ElevenLabs the marketing headline.

Do not claim ownership of third-party technology.

The product should be positioned around the business outcome:

-   Answer calls
-   Follow up with leads
-   Handle customer conversations
-   Automate routine communication
-   Work 24/7

------------------------------------------------------------------------

# 30. Customer Journey

### Step 1

Customer visits our website.

### Step 2

Customer contacts us / purchases service.

### Step 3

We create their tenant.

### Step 4

We collect business information.

### Step 5

We configure their ElevenLabs agent.

### Step 6

We test it.

### Step 7

We attach the agent ID to their tenant.

### Step 8

We connect phone/WhatsApp where applicable.

### Step 9

We configure billing and usage limits.

### Step 10

We deploy.

### Step 11

Customer logs into:

``` text
ourbrand.ai
```

### Step 12

Customer sees only its own business data.

### Step 13

Customer uses the AI service.

### Step 14

Usage accumulates.

### Step 15

Monthly bill is generated according to actual usage.

### Step 16

Customer requests customization when needed.

------------------------------------------------------------------------

# 31. What We Are NOT Building in MVP

Do NOT add:

-   Own LLM
-   Own voice engine
-   Own RAG engine
-   Full CRM
-   Full telephony infrastructure
-   Complex workflow builder
-   AI agent marketplace
-   Multiple AI providers
-   Advanced campaign automation
-   Complex customer self-service agent editor
-   Native mobile app
-   Complex role/permission matrix
-   Enterprise SSO
-   Multi-region infrastructure
-   Advanced BI platform

These are future considerations.

------------------------------------------------------------------------

# 32. MVP Acceptance Criteria

The MVP is considered successful only when all of the following work:

### Multi-tenancy

-   100 test tenants can exist in one application.
-   Tenant A cannot access Tenant B data.
-   Tenant A sees only its own agents, calls, usage and billing.

### Agent

-   A tenant can be mapped to an ElevenLabs Agent ID.
-   The branded agent interface launches the correct agent.
-   Replacing the provider agent mapping does not require changing the
    customer URL.

### Customer profile

-   Customer can edit allowed business profile fields.
-   Changes appear immediately in its dashboard.
-   These edits do not modify the AI's core behavior.

### Managed customization

-   Customer can submit a customization request.
-   Admin can see and process it.
-   Agent changes remain an Admin/managed-service responsibility.

### Channels

-   Phone mapping works.
-   WhatsApp mapping/status works where the configured
    ElevenLabs/integration setup supports it.

### Usage

-   Usage events are captured.
-   Customer can see current usage.
-   Admin can see provider cost, customer charge and margin.
-   Monthly usage can be converted into an invoice.

### Billing

-   Customer can view invoices.
-   Failed payment state is handled.
-   Usage cap can protect against uncontrolled spend.

### Reliability

-   Provider/system health is visible to Admin.
-   Agent status is visible.
-   Broken integrations are detectable.
-   Deployment state is tracked.

### Security

-   Authentication works.
-   Server-side tenant authorization works.
-   Provider secrets never reach the browser.
-   Admin actions are auditable.

### UX

-   Website looks like a premium SaaS product.
-   Customer never needs to operate the ElevenLabs dashboard for normal
    use.
-   No unnecessary complexity.

------------------------------------------------------------------------

# 33. Official ElevenLabs implementation references

Use the current official documentation as the implementation source of
truth:

-   ElevenAgents pricing: https://elevenlabs.io/pricing/agents
-   Widget customization and embedding:
    https://elevenlabs.io/docs/eleven-agents/customization/widget
-   Agent creation API:
    https://elevenlabs.io/docs/eleven-agents/api-reference/agents/create
-   ElevenAgents terms: https://elevenlabs.io/agents-terms
-   Disclosure requirements:
    https://elevenlabs.io/docs/eleven-agents/legal/disclosure-requirement
-   ElevenAgents integrations: https://elevenlabs.io/agents/integrations

Before commercial launch, verify the exact ElevenLabs plan/contract
permitted for this multi-tenant managed-service/resale model. Do not
assume that a technical capability automatically grants the required
commercial rights.

------------------------------------------------------------------------

# 34. Final Build Principle

**Build the smallest reliable system that can sell and operate the
service.**

The product is NOT:

> "Our own ElevenLabs."

The product IS:

> **"Our branded AI employee service platform."**

ElevenLabs provides the underlying conversational AI infrastructure.

Our value is:

``` text
Business onboarding
+
Tenant isolation
+
Branded customer experience
+
Agent delivery
+
Phone / WhatsApp channel management
+
Usage metering
+
Billing
+
Monitoring
+
Managed customization
+
Support
```

That is the MVP.

**Do not add more features until this entire loop works reliably for the
first 100 tenants.**

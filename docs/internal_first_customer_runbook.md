# ORBIT — Internal First Customer Onboarding Runbook
> **CONFIDENTIAL & INTERNAL ONLY**: This runbook is for ORBIT platform operations staff. Do NOT share with customers.

This document walks through the exact operational procedure for onboarding a new paying business from initial signup to live call handling.

---

## Onboarding Lifecycle Overview

```
[Customer Agreement Signed]
          ↓
1. Create Tenant & Owner in Admin Console
          ↓
2. Complete Business Profile (Settings)
          ↓
3. Attach & Configure AI Employee
          ↓
4. Configure Business Data / System of Record
          ↓
5. Register Tools in ElevenLabs Workspace
          ↓
6. Provision & Attach Phone Channel
          ↓
7. End-to-End Inbound Test Call
          ↓
8. Configure Commercial Pricing & Spend Caps
          ↓
9. Execute Go-Live Verification
          ↓
10. Monitor First Live Production Calls
```

---

## Step-by-Step Execution

### Step 1: Create Tenant & Owner Account
1. Log in to the ORBIT Admin Console (`/admin`) with platform admin credentials.
2. Navigate to **Tenants** tab and click **"+ Create Tenant"**.
3. Enter:
   - **Hotel / Business Name**: e.g., *"Grand Heritage Hotel & Resorts"*
   - **Owner Name**: Primary customer contact
   - **Owner Email**: Customer's official email address
   - **Temporary Password**: High-entropy initial password
   - **Brand Color**: Primary brand hex code (e.g., `#8B5CF6`)
4. Confirm creation. The tenant is initialized in `status: "onboarding"` with an initial environment setting (`demo` for testing, `production` for live).

---

### Step 2: Complete Business Profile
1. Log in as the tenant owner or assist them via screen-share.
2. Navigate to **Settings** (`/dashboard/settings`).
3. Fill in mandatory profile information:
   - **Contact Email**
   - **Contact Phone**
   - **Property / Business Address**
   - **Website & Description**
4. Save. (This resolves the `"Business profile incomplete"` readiness blocker).

---

### Step 3: Attach & Configure Dedicated AI Employee
1. In the **ElevenLabs Conversational AI Console**:
   - Create a new Conversational AI agent tailored for this customer.
   - Configure prompt, personality, voice tone, and language (e.g., Indian English female/male).
   - Copy the generated `agent_id` (e.g., `agent_7x9...`).
2. In the **ORBIT Admin Console**:
   - Open the customer's tenant detail sheet.
   - Click **"Attach AI Employee"**.
   - Set Name (e.g., *"Aria"*), Role Title (e.g., *"Front Desk Concierge"*), Voice description, and paste the `provider_agent_id`.
   - The AI employee is attached in `lifecycle_state: "draft"`.

---

### Step 4: Configure Business Information & System of Record

#### Option A: Manual Business Data (ORBIT-Managed)
If the customer has no external PMS/POS:
1. Advise customer to navigate to **"Business Data"** (`/dashboard/live-data`).
2. Add room/service categories, standard rates, check-in/out timings, buffet hours, and cancellation policies.
3. Save. (Data is stored in `db.tenant_live_data` and ready for instant tool resolution).

#### Option B: Connected Business System (External Connector)
If the customer uses an external system:
1. In Admin Console → **Business Integrations**, click **"+ Add System"**.
2. Select type (`pms`, `pos`, `calendar`, `crm`), provide display name, and select the corresponding live connector key.
3. If custom development is required, leave mode as `live` and status will clearly indicate `custom_integration_required`.

---

### Step 5: Configure Tool Endpoints in ElevenLabs
In the ElevenLabs Conversational AI Agent settings:
1. Add a **Client Webhook Tool**:
   - **Tool Name**: `check_availability`
   - **Webhook URL**: `https://api.your-orbit-domain.com/api/webhooks/elevenlabs/tool-call`
   - **Method**: `POST`
   - **Parameters**:
     - `room_type` (string, optional)
     - `service_type` (string, optional)
2. Add a second tool:
   - **Tool Name**: `get_business_policy`
   - **Webhook URL**: `https://api.your-orbit-domain.com/api/webhooks/elevenlabs/tool-call`
   - **Method**: `POST`
   - **Parameters**:
     - `category` (string, optional - e.g., "checkin", "buffet", "cancellation", "offers")
3. Save agent configuration.

---

### Step 6: Provision Phone Line (Exotel Carrier Trunk)
1. Allocate an inbound Virtual Phone Number on the Exotel carrier trunk.
2. Configure Exotel Call Flow (Passthrough App) to bridge inbound audio streams to the ElevenLabs agent.
3. In ORBIT Admin Console → **Channels**, click **"Connect Channel"**:
   - **Type**: `phone`
   - **Identifier**: Enter phone number (e.g., `+911140001234`)
   - **Assign AI Employee**: Select the attached agent (`Aria`).
   - Click **Verify** to test carrier connectivity.

---

### Step 7: Conduct Inbound Test Call
1. Dial the customer's allocated virtual phone number from a test mobile device.
2. Verify:
   - Voice agent answers within 1.5 seconds.
   - Persona and greeting match customer branding.
   - **READ Tool Test**: Ask *"What are your room rates?"* or *"What time is check-in?"* — verify AI fetches live data.
   - **Safety Test**: Ask to book a room — verify agent requests explicit confirmation and explains booking procedure.
3. In ORBIT Admin Console:
   - Click **"Start Testing"** → AI Employee moves to `lifecycle_state: "testing"`.
   - After successful verification, click **"Approve"** → moves to `lifecycle_state: "approved"`.

---

### Step 8: Configure Commercial Pricing & Spend Caps
In ORBIT Admin Console → Tenant Detail → **Pricing (INR)**:
1. Configure agreed customer rates:
   - `ai_voice_per_min`: Voice rate (e.g., ₹9.50)
   - `telephony_per_min`: Carrier trunk rate (e.g., ₹1.50)
   - `orbit_markup_pct`: Platform markup %
   - `gst_pct`: 18.0%
   - `warning_threshold`: Alert threshold (e.g., ₹15,000)
   - `hard_cap`: Spend limit (e.g., ₹25,000)
2. Click **"Save Pricing"**.

---

### Step 9: Execute Go-Live Verification
1. Review the **Onboarding & Go-Live Readiness Overview** in the tenant detail drawer.
2. Confirm that **all blockers are cleared** (`Ready for Live: Yes`).
3. Click **"Go Live Now"** (or update tenant status to `live`).
4. AI Employee lifecycle transitions to `live`.

---

### Step 10: Post-Launch Monitoring
1. Monitor the **Conversations** tab in the Admin Console as early guest calls land.
2. Confirm:
   - Webhook post-call events ingest successfully (`db.usage_ledger` increments correctly).
   - Zero events land in `db.webhook_quarantine`.
   - Customer's overview dashboard reflects accurate call minutes and conversation summaries.

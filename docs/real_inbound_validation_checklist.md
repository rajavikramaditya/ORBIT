# ORBIT — Real Inbound MVP Validation Checklist

This checklist defines the operational verification procedure for the first live inbound telephone call on ORBIT.

---

## 1. Complete Inbound Call Flow

```
[Caller dials Virtual Number]
             ↓
[Exotel Carrier Trunk] → Bridges audio to ElevenLabs
             ↓
[ElevenLabs Conversational AI Agent] → Answers in branded voice
             ↓
[Caller asks question: "What are your room rates?"]
             ↓
[ElevenLabs Tool Call] → POST /api/webhooks/elevenlabs/tool-call
             ↓
[ORBIT Backend] → Resolves tenant from provider_agent_id in DB
             ↓
[ORBIT Live Data Layer] → Fetches rate from db.tenant_live_data
             ↓
[ORBIT Webhook Response] → Returns JSON data to ElevenLabs
             ↓
[ElevenLabs Voice Synthesis] → Speaks answer to Caller
             ↓
[Call Ends / Caller Hangs Up]
             ↓
[ElevenLabs Post-Call Webhook] → POST /api/webhooks/elevenlabs/post-call
             ↓
[ORBIT Ingest Engine] → Stores transcript, caller number, intent, and summary
             ↓
[Billing Engine] → Deducts call seconds into db.usage_ledger & checks spend caps
             ↓
[Tenant Dashboard] → Owner views call summary, transcript, and outcome
```

---

## 2. What Has Been Verified Locally (Code Verified)

- ✅ **Server-Side Tenant Resolution**: Inbound tool requests look up tenant strictly from `db.ai_employees`. Client/LLM cannot forge `tenant_id`.
- ✅ **Cross-Tenant Isolation**: Verified that Tenant B cannot access Tenant A's rates, policies, or conversation records.
- ✅ **Action Confirmation Gating**: State-modifying actions require explicit confirmation and cannot execute silently.
- ✅ **Honest Data Source Labeling**: Dashboard and tools clearly distinguish between *Manual Business Data (ORBIT-maintained)* and *Connected External System*. No false claims of real-time inventory synchronization are made when only manual data exists.
- ✅ **Idempotent Ingest & Billing**: Post-call webhook deduplicates on `provider_conversation_id` and records exact duration in seconds.
- ✅ **Safety Guards**: Production mode forbids mock connectors, prevents demo seeding, and blocks call simulation.

---

## 3. What Requires ElevenLabs Configuration (Vendor Configuration)

- `ELEVENLABS_API_KEY`: Commercial workspace API key set in production `.env`.
- `ELEVENLABS_WEBHOOK_SECRET`: Webhook signing secret set in production `.env`.
- **In the ElevenLabs Agent Dashboard**:
  - **Tool 1 (`check_availability`)**: `POST https://api.yourdomain.com/api/webhooks/elevenlabs/tool-call`
  - **Tool 2 (`get_business_policy`)**: `POST https://api.yourdomain.com/api/webhooks/elevenlabs/tool-call`
  - **Post-Call Evaluation Webhook**: `POST https://api.yourdomain.com/api/webhooks/elevenlabs/post-call`

---

## 4. What Requires Exotel Configuration (Carrier Configuration)

- `EXOTEL_API_KEY`, `EXOTEL_API_TOKEN`, `EXOTEL_ACCOUNT_SID`, `EXOTEL_SUBDOMAIN`: Carrier credentials in production `.env`.
- Provisioning an inbound Virtual Number (DID).
- Configuring the Exotel Call Flow / Passthrough application to bridge audio streams to the ElevenLabs agent.

---

## 5. Exact First Real-Call Test Procedure

1. **Prerequisites**:
   - Tenant created and business profile completed in ORBIT Admin Console.
   - Rates and operating hours saved in the tenant's **Business Data** page.
   - Dedicated AI Employee attached with `provider_agent_id`.
   - Virtual phone number connected to the AI Employee.
2. **Execution Steps**:
   - **Step 1**: Dial the Exotel virtual number from a personal mobile phone.
   - **Step 2 (Greeting)**: Listen for the AI greeting.
   - **Step 3 (READ Test)**: Ask: *"What are your standard room rates?"*
   - **Step 4 (Policy Test)**: Ask: *"What is your check-in time and cancellation policy?"*
   - **Step 5 (Action Test)**: Say: *"Please confirm a booking for me tonight."*
   - **Step 6 (Hangup)**: Disconnect the call.
   - **Step 7 (Ingestion Verification)**: Open the ORBIT Dashboard → **Conversations** tab.

---

## 6. Expected Results at Every Step

| Step | Expected AI / System Behavior |
|---|---|
| **Call Connect** | Phone rings and is answered within 1–2 rings. |
| **Greeting** | AI introduces itself with the business's custom greeting and voice tone. |
| **Rate Question** | AI triggers `check_availability` and quotes the exact INR rate configured in Business Data. |
| **Policy Question** | AI triggers `get_business_policy` and quotes the configured check-in time and cancellation terms. |
| **Booking Attempt** | AI clarifies the reservation booking procedure and notes the enquiry rather than claiming automated real-time PMS inventory deduction. |
| **Post-Call Dashboard** | Call row appears with duration, caller number, summary title, and outcome badge. |
| **Usage Ledger** | Billable seconds recorded in `db.usage_ledger`. |

---

## 7. Pass vs. Fail Criteria

### What Counts as PASS ✅
1. The AI answers the inbound call without audio stream failure.
2. The AI quotes the exact figures configured in ORBIT Business Data.
3. The AI does not hallucinate false PMS connections or automated booking confirmations.
4. The call is captured in the ORBIT dashboard within 10 seconds of hangup.
5. The duration and transcript match the actual conversation.
6. The billable usage ledger increments correctly.

### What Counts as FAIL ❌
1. Call fails to connect or audio drops.
2. AI quotes outdated, default, or fabricated rates not present in Business Data.
3. Tool call fails with 401 (signature failure) or 404 (agent unmapped).
4. AI claims a room is booked in a PMS when no live PMS is connected.
5. Conversation transcript or duration is lost post-call.
6. Conversation is attributed to the wrong tenant.

---

## 8. Status Classification

- **Code Verified**: ✅ All 34 automated unit and e2e lifecycle tests passing.
- **Configuration Ready**: ✅ Webhooks, environment schemas, and models mapped.
- **Real Telephone Test Pending**: ⏳ Requires live ElevenLabs & Exotel credentials for physical handset testing.

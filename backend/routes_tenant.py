from fastapi import APIRouter, Depends, HTTPException
from db import db, write_audit
from models import (
    TenantProfileBody, CustomizationRequestBody, SimulateCallBody,
    LiveDataBody, LeadPatchBody, BUSINESS_TYPES, gen_id, now_iso,
    ONBOARDING_STAGES, ONBOARDING_STAGE_LABELS_CUSTOMER,
    AccountDeletionRequestBody,
)
from security import require_tenant_user
from providers import elevenlabs
from ingest import ingest_post_call
from tools import run_tool
from leads import public_lead, persist_owner_callback, owner_patch_updates
from provisioning import (
    telephony_status, whatsapp_status,
    customer_facing_channel_status, infer_channel_plan, channel_selected,
)

router = APIRouter(prefix="/api/tenant", tags=["tenant"])


# Fields a customer is allowed to self-serve (Correction 5 matrix).
PROFILE_FIELDS = {"logo_url", "website", "address", "contact_email", "contact_phone", "description"}
# Provider identifiers are internal infrastructure — never sent to customers.
CONV_TENANT_PROJECTION = {"_id": 0, "provider": 0, "provider_conversation_id": 0, "provider_agent_id": 0}


def tid(user):
    return user["tenant_id"]


@router.get("/overview")
async def overview(user=Depends(require_tenant_user)):
    t = tid(user)
    recent = await db.conversations.find(
        {"tenant_id": t}, {**CONV_TENANT_PROJECTION, "transcript": 0}
    ).sort("created_at", -1).to_list(6)
    # One $group in the database instead of streaming every ledger row into
    # Python and adding it up here. The old loop cost one document read per
    # billable event, so the Overview page got slower with every call the tenant
    # ever took — by a few thousand conversations it was the slowest thing on
    # the dashboard.
    usage = await db.usage_ledger.aggregate([
        {"$match": {"tenant_id": t}},
        {"$group": {"_id": None, "total_secs": {"$sum": "$quantity_secs"}}},
    ]).to_list(1)
    total_secs = (usage[0]["total_secs"] if usage else 0) or 0
    return {
        "stats": {
            "ai_employees": await db.ai_employees.count_documents({"tenant_id": t}),
            "channels": await db.channels.count_documents({"tenant_id": t}),
            "conversations": await db.conversations.count_documents({"tenant_id": t}),
            "total_call_minutes": round(total_secs / 60, 1),
            "open_requests": await db.customization_requests.count_documents({"tenant_id": t, "status": {"$in": ["submitted", "in_review", "in_progress"]}}),
        },
        "recent_conversations": recent,
    }


@router.get("/profile")
async def get_profile(user=Depends(require_tenant_user)):
    t = await db.tenants.find_one({"id": tid(user)}, {"_id": 0, "intake_key": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return t


@router.patch("/profile")
async def update_profile(body: TenantProfileBody, user=Depends(require_tenant_user)):
    updates = {}
    data = body.model_dump()
    if data.get("name"):
        updates["name"] = data["name"]
    if data.get("brand_color"):
        updates["branding.brand_color"] = data["brand_color"]
    if data.get("logo_url") is not None:
        updates["branding.logo_url"] = data["logo_url"]
        updates["profile.logo_url"] = data["logo_url"]
    # Customer-editable vertical — same field admin sets at tenant creation, but the
    # owner can change it themselves any time (e.g. picked wrong type at signup).
    if data.get("business_type") is not None and data["business_type"] in BUSINESS_TYPES:
        updates["business_type"] = data["business_type"]
    for f in PROFILE_FIELDS:
        if f == "logo_url":
            continue
        if data.get(f) is not None:
            updates[f"profile.{f}"] = data[f]
    if updates:
        await db.tenants.update_one({"id": tid(user)}, {"$set": updates})
    return await db.tenants.find_one({"id": tid(user)}, {"_id": 0, "intake_key": 0})


@router.get("/ai-employees")
async def ai_employees(user=Depends(require_tenant_user)):
    # Read-only for tenants. Provider identity/secrets/config are never exposed.
    return await db.ai_employees.find(
        {"tenant_id": tid(user)},
        {"_id": 0, "config_ref": 0, "provider": 0, "provider_agent_id": 0},
    ).to_list(100)


def _sanitize_owner_blockers(blockers: list) -> list:
    """Owner copy never includes provider secret names or webhook/HMAC instructions."""
    mapped = []
    seen = set()
    for raw in blockers or []:
        low = (raw or "").lower()
        if any(k in low for k in ("webhook", "elevenlabs", "exotel", "hmac", "api key", "credential", "meta_")):
            text = "ORBIT setup team needs this information"
        elif "phone" in low:
            text = "Phone setup is being completed by ORBIT"
        elif "whatsapp" in low:
            text = "WhatsApp setup is being completed by ORBIT"
        elif "voice provider" in low or ("verified" in low and "agent" in low):
            text = "ORBIT setup team needs this information"
        else:
            text = raw
        if text not in seen:
            seen.add(text)
            mapped.append(text)
    return mapped


@router.get("/channels")
async def channels(user=Depends(require_tenant_user)):
    tenant = await db.tenants.find_one({"id": tid(user)}, {"_id": 0})
    phone = await db.channels.find_one({"tenant_id": tid(user), "type": "phone"}, {"_id": 0})
    wa = await db.channels.find_one({"tenant_id": tid(user), "type": "whatsapp"}, {"_id": 0})
    plan = infer_channel_plan(tenant, phone, wa)
    is_live = (tenant or {}).get("status") == "live"
    environment = (tenant or {}).get("environment", "demo")

    chans = await db.channels.find({"tenant_id": tid(user)}, {"_id": 0, "provider": 0}).to_list(100)
    for c in chans:
        if c.get("assigned_ai_employee_id"):
            ae = await db.ai_employees.find_one({"id": c["assigned_ai_employee_id"]}, {"_id": 0, "name": 1})
            c["assigned_ai_employee_name"] = ae["name"] if ae else None
        c.pop("normalized_identifier", None)
        if c.get("meta"):
            meta = dict(c["meta"])
            meta.pop("phone_number_id", None)
            c["meta"] = meta
        honest = telephony_status(c) if c.get("type") == "phone" else whatsapp_status(c)
        c["status"] = customer_facing_channel_status(
            c,
            honest=honest,
            in_plan=channel_selected(plan, c.get("type")),
            is_live=is_live,
            environment=environment,
        )
    if tenant and tenant.get("intake_key"):
        chans.append({
            "id": "ch_form_intake",
            "type": "form",
            "status": "ready",
            "connected_identifier": "Website form",
            "intake_path": f"/api/intake/{tenant['intake_key']}",
            "assigned_ai_employee_name": None,
        })
    return chans


@router.get("/conversations")
async def conversations(user=Depends(require_tenant_user)):
    return await db.conversations.find(
        {"tenant_id": tid(user)}, {**CONV_TENANT_PROJECTION, "transcript": 0}
    ).sort("created_at", -1).to_list(200)


@router.get("/conversations/{conv_id}")
async def conversation_detail(conv_id: str, user=Depends(require_tenant_user)):
    conv = await db.conversations.find_one({"id": conv_id, "tenant_id": tid(user)}, CONV_TENANT_PROJECTION)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv


LEAD_TENANT_PROJECTION = {
    "_id": 0, "provider_conversation_id": 0,
}


@router.get("/leads")
async def list_leads(user=Depends(require_tenant_user)):
    rows = await db.leads.find({"tenant_id": tid(user)}, LEAD_TENANT_PROJECTION).sort("created_at", -1).to_list(200)
    return [public_lead(r) for r in rows]


@router.get("/leads/{lead_id}")
async def lead_detail(lead_id: str, user=Depends(require_tenant_user)):
    lead = await db.leads.find_one({"id": lead_id, "tenant_id": tid(user)}, LEAD_TENANT_PROJECTION)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    out = public_lead(lead)
    if out.get("conversation_id"):
        conv = await db.conversations.find_one(
            {"id": out["conversation_id"], "tenant_id": tid(user)},
            {**CONV_TENANT_PROJECTION, "transcript": 0},
        )
        out["conversation"] = conv
    callbacks = await db.owner_callback_requests.find(
        {"tenant_id": tid(user), "lead_id": lead_id}, {"_id": 0}
    ).sort("requested_at", -1).to_list(20)
    out["callback_requests"] = callbacks
    return out


@router.patch("/leads/{lead_id}")
async def patch_lead(lead_id: str, body: LeadPatchBody, user=Depends(require_tenant_user)):
    lead = await db.leads.find_one({"id": lead_id, "tenant_id": tid(user)}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    try:
        updates = owner_patch_updates(lead, body)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if body.owner_callback_requested is True and not lead.get("owner_callback_requested"):
        updates["owner_callback_requested"] = True
        updates["owner_callback_status"] = "requested"
        await persist_owner_callback(
            tid(user),
            lead_id=lead["id"],
            conversation_id=lead.get("conversation_id"),
            customer_name=lead.get("customer_name"),
            customer_phone=lead.get("customer_phone"),
            reason=lead.get("enquiry_summary"),
        )
    if not updates:
        return public_lead(lead)
    updates["updated_at"] = now_iso()
    await db.leads.update_one({"id": lead_id, "tenant_id": tid(user)}, {"$set": updates})
    await write_audit(user, "lead.update", lead_id, tid(user), {k: updates[k] for k in updates if k != "updated_at"})
    updated = await db.leads.find_one({"id": lead_id, "tenant_id": tid(user)}, LEAD_TENANT_PROJECTION)
    return public_lead(updated)


@router.post("/simulate-call")
async def simulate_call(body: SimulateCallBody, user=Depends(require_tenant_user)):
    """Demo helper: simulates a real inbound/outbound call landing on the tenant's
    live AI employee and captures the conversation via the same ingest path as the
    ElevenLabs post-call webhook."""
    tenant = await db.tenants.find_one({"id": tid(user)}, {"_id": 0, "environment": 1})
    if (tenant or {}).get("environment") == "production":
        raise HTTPException(status_code=403, detail="Call simulation is disabled for production tenants.")
    ae = await db.ai_employees.find_one(
        {"tenant_id": tid(user), "lifecycle_state": {"$in": ["live", "approved"]}}, {"_id": 0}
    )
    if not ae:
        raise HTTPException(status_code=400, detail="No live AI employee available to take calls yet")
    evt = elevenlabs.build_post_call_event(ae["provider_agent_id"], body.direction or "inbound", body.external_number)
    result = await ingest_post_call(evt["data"])
    if result.get("status") != "ingested":
        raise HTTPException(status_code=409, detail=f"Call not captured: {result.get('status')}")
    conv = result["conversation"]

    # Demonstrate the live business-data layer: if a live-data READ tool is
    # available, the AI uses it; otherwise it operates in limited informational mode.
    tool = await db.tools.find_one({"tenant_id": tid(user), "key": "check_availability", "enabled": True}, {"_id": 0})
    invocations = []
    data_mode = "informational"
    if tool:
        tool_res = await run_tool(tool, tid(user), {"room_type": "Deluxe King", "date": "tonight"}, actor=user)
        invocations.append({"tool": tool["key"], "name": tool["name"], **tool_res})
        if tool_res.get("status") == "ok":
            data_mode = tool_res.get("mode", "mock")
    if data_mode == "informational":
        note = "Live business-data integration not connected — AI answered in limited informational mode."
    elif data_mode == "mock":
        note = "Answered using MOCK demo data (no real business system connected)."
    else:
        note = "Answered using live business data."
    await db.conversations.update_one(
        {"id": conv["id"]},
        {"$set": {"data_mode": data_mode, "tool_invocations": invocations, "live_data_note": note}},
    )
    conv["data_mode"] = data_mode
    conv["tool_invocations"] = invocations
    conv["live_data_note"] = note
    conv.pop("provider", None)
    conv.pop("provider_conversation_id", None)
    return conv


@router.get("/customization-requests")
async def list_requests(user=Depends(require_tenant_user)):
    return await db.customization_requests.find(
        {"tenant_id": tid(user)}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)


@router.post("/customization-requests")
async def create_request(body: CustomizationRequestBody, user=Depends(require_tenant_user)):
    doc = {
        "id": gen_id("cr_"),
        "tenant_id": tid(user),
        "requested_by": user["id"],
        "requested_by_name": user.get("name"),
        "category": body.category,
        "title": body.title,
        "details": body.details,
        "priority": body.priority or "normal",
        "status": "submitted",
        "admin_notes": "",
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.customization_requests.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@router.get("/deletion-request")
async def get_deletion_request(user=Depends(require_tenant_user)):
    """Current pending account-deletion request for this tenant, if any — lets
    Settings show its status instead of the 'Delete my account' button."""
    return await db.account_deletion_requests.find_one(
        {"tenant_id": tid(user), "status": "pending"}, {"_id": 0}
    )


@router.post("/deletion-request")
async def create_deletion_request(body: AccountDeletionRequestBody, user=Depends(require_tenant_user)):
    """Requests the whole account + all its data be deleted. Deliberately does
    NOT delete anything itself — ORBIT staff confirm from the admin console
    (see routes_admin.py's /deletion-requests/{id}/approve), same concierge
    pattern as customization requests. Only the account owner can request this
    — a tenant 'admin' sub-user shouldn't be able to trigger deleting the whole
    account."""
    if user.get("role") != "owner":
        raise HTTPException(status_code=403, detail="Only the account owner can request account deletion")
    t = tid(user)
    if await db.account_deletion_requests.find_one({"tenant_id": t, "status": "pending"}):
        raise HTTPException(status_code=400, detail="A deletion request is already pending")
    doc = {
        "id": gen_id("adr_"),
        "tenant_id": t,
        "requested_by_user_id": user["id"],
        "requested_by_email": user.get("email"),
        "reason": body.reason,
        "status": "pending",
        "created_at": now_iso(),
        "resolved_at": None,
        "resolved_by_email": None,
    }
    await db.account_deletion_requests.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@router.post("/deletion-request/cancel")
async def cancel_deletion_request(user=Depends(require_tenant_user)):
    """Owner changes their mind before ORBIT has acted on the request."""
    if user.get("role") != "owner":
        raise HTTPException(status_code=403, detail="Only the account owner can cancel a deletion request")
    res = await db.account_deletion_requests.delete_one({"tenant_id": tid(user), "status": "pending"})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="No pending deletion request found")
    return {"status": "cancelled"}


@router.get("/live-data")
async def get_live_data(user=Depends(require_tenant_user)):
    """Tenant's dynamic live data: room rates, timings, policies.
    This is the data the AI agent fetches in real-time during calls via webhook."""
    doc = await db.tenant_live_data.find_one({"tenant_id": tid(user)}, {"_id": 0})
    if not doc:
        return {
            "tenant_id": tid(user),
            "room_rates": [],
            "check_in_time": None,
            "check_out_time": None,
            "buffet_breakfast": None,
            "buffet_lunch": None,
            "buffet_dinner": None,
            "cancellation_policy": None,
            "refund_policy": None,
            "active_offer": None,
            "seasonal_note": None,
            "catalogue_url": None,
            "services": [],
            "business_hours": None,
            "extra": {},
            "updated_at": None,
        }
    doc.pop("_id", None)
    return doc


@router.patch("/live-data")
async def update_live_data(body: LiveDataBody, user=Depends(require_tenant_user)):
    """Update tenant's dynamic live data. Changes take effect immediately on the
    next AI call — no customization request or admin intervention needed."""
    t = tid(user)
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    updates["updated_at"] = now_iso()
    updates["tenant_id"] = t
    existing = await db.tenant_live_data.find_one({"tenant_id": t}, {"_id": 0})
    if existing:
        await db.tenant_live_data.update_one({"tenant_id": t}, {"$set": updates})
    else:
        await db.tenant_live_data.insert_one(dict(updates))
    doc = await db.tenant_live_data.find_one({"tenant_id": t}, {"_id": 0})
    return doc


@router.get("/readiness")
async def readiness(user=Depends(require_tenant_user)):
    """Customer-facing setup summary. Provider IDs/credentials are never exposed.
    Distinguishes what the customer still needs to provide vs what ORBIT is handling."""
    from routes_admin import compute_readiness
    t = tid(user)
    r = await compute_readiness(t)
    tenant = await db.tenants.find_one({"id": t}, {"_id": 0})
    profile = (tenant or {}).get("profile") or {}
    extra = profile.get("extra") or {}
    profile_ok = bool(profile.get("contact_email") and profile.get("contact_phone") and profile.get("address"))
    live_data = await db.tenant_live_data.find_one({"tenant_id": t}, {"_id": 0})
    has_manual_data = bool(live_data and (
        live_data.get("room_rates") or live_data.get("cancellation_policy") or live_data.get("check_in_time")
        or live_data.get("catalogue_url") or live_data.get("services")
        or extra.get("hours") or extra.get("website") or extra.get("services")
    ))
    has_catalogue = bool(
        (live_data or {}).get("catalogue_url") or extra.get("catalogue_url")
        or extra.get("website") or profile.get("website")
    )
    data_source_ok = r["data_source"] != "none"

    needs_from_you = []
    if not profile_ok:
        needs_from_you.append({
            "label": "Business profile",
            "detail": "ORBIT setup team needs this information — add contact phone and address in Settings.",
        })
    if not has_manual_data and r["data_source"] == "none":
        needs_from_you.append({
            "label": "Business information",
            "detail": "ORBIT setup team needs this information — add services, hours, or policies in Business Data.",
        })

    waiting_for_orbit = []
    ae = await db.ai_employees.find_one({"tenant_id": t}, {"_id": 0})
    phone = await db.channels.find_one({"tenant_id": t, "type": "phone"}, {"_id": 0})
    wa = await db.channels.find_one({"tenant_id": t, "type": "whatsapp"}, {"_id": 0})
    integ = await db.business_integrations.find_one({"tenant_id": t}, {"_id": 0})
    plan = r.get("channel_plan") or infer_channel_plan(tenant, phone, wa)
    want_phone = channel_selected(plan, "phone")
    want_wa = channel_selected(plan, "whatsapp")
    environment = r.get("environment", "demo")
    is_live = r.get("is_live") is True
    phone_view = customer_facing_channel_status(
        phone, honest=telephony_status(phone), in_plan=want_phone, is_live=is_live, environment=environment,
    )
    wa_view = customer_facing_channel_status(
        wa, honest=whatsapp_status(wa), in_plan=want_wa, is_live=is_live, environment=environment,
    )

    if not ae:
        waiting_for_orbit.append({"label": "AI employee assignment", "detail": "ORBIT will assign and fine-tune your dedicated AI employee."})
    elif ae.get("lifecycle_state") not in ("live", "approved"):
        waiting_for_orbit.append({"label": f"AI employee · {ae['name']}", "detail": "ORBIT is testing and verifying voice quality and behavior."})
    if want_phone and (not phone or phone.get("status") in ("not_connected", "action_required") or phone_view == "setup_in_progress") and phone_view != "ready":
        waiting_for_orbit.append({"label": "Phone", "detail": "ORBIT is configuring your phone line. No action needed from you."})
    # Keep listing an existing incomplete WhatsApp channel even if it is not in the plan
    # (seeded demo tenants may have a recorded WhatsApp number still in onboarding).
    show_wa_wait = want_wa or (wa and wa.get("status") in ("not_connected", "action_required"))
    if show_wa_wait and (not wa or wa.get("status") in ("not_connected", "action_required") or wa_view in ("setup_in_progress", "action_required", "not_connected")) and wa_view != "ready":
        waiting_for_orbit.append({"label": "WhatsApp channel", "detail": "WhatsApp business setup is being handled by ORBIT."})
    if integ and integ.get("status") not in ("connected", "ok"):
        waiting_for_orbit.append({"label": f"Integration · {integ.get('name')}", "detail": "ORBIT is connecting your external business system."})

    configured = []
    if ae and ae.get("lifecycle_state") in ("live", "approved", "testing"):
        configured.append(ae["name"])
        configured.append(f"AI Employee ({ae['name']})")
    if phone_view == "ready" or (phone and phone.get("status") in ("connected", "ok", "verified")):
        configured.append("Phone channel")
    if wa_view == "ready" or (wa and wa.get("status") in ("connected", "ok", "verified")):
        configured.append("WhatsApp channel")
    if r["data_source"] == "connected":
        configured.append(f"Connected Business System ({integ.get('name', 'Live') if integ else 'Live'})")
    elif r["data_source"] == "manual":
        configured.append("Business Data (Manual Entry)")
    if profile_ok:
        configured.append("Business profile")

    ae_status = "ready" if ae and ae.get("lifecycle_state") in ("live", "approved") else (
        ae.get("lifecycle_state") if ae else "not_connected"
    )
    test_ok = not any("test" in (b or "").lower() for b in (r.get("blockers") or []))
    customer_items = {
        "business_profile": {"label": "Business information", "status": "ok" if profile_ok else "action_required"},
        "ai_employee": {"label": ae["name"] if ae else "AI Employee", "status": ae_status},
        "business_data": {
            "label": "Business Information",
            "status": "ok" if r["data_source"] != "none" else "action_required",
            "source": r["data_source_label"],
        },
        "phone": {"label": "Phone", "status": phone_view if phone or want_phone else "not_connected"},
        "whatsapp": {"label": "WhatsApp", "status": wa_view if wa or want_wa else "not_connected"},
        "catalogue": {"label": "Catalogue", "status": "ok" if has_catalogue else "action_required"},
        "test": {"label": "Test", "status": "ok" if (is_live or test_ok) else "pending"},
        "go_live": {"label": "Go Live", "status": "ok" if is_live else "pending"},
        "business_integration": {
            "label": integ.get("name") if integ else "Business system",
            "status": (integ or {}).get("status") or "not_connected",
        },
    }

    def _progress_row(label, status, included=True):
        if not included:
            return None
        ready = status in ("ready", "ok", "live", "approved", "verified")
        return {
            "label": label,
            "status": "ready" if ready else "pending",
            "detail": "Ready" if ready else "ORBIT setup team needs this information",
        }

    progress = [p for p in (
        _progress_row("Phone", customer_items["phone"]["status"], want_phone or bool(phone)),
        _progress_row("WhatsApp", customer_items["whatsapp"]["status"], want_wa or bool(wa)),
        _progress_row("AI Employee", customer_items["ai_employee"]["status"]),
        _progress_row("Business information", customer_items["business_data"]["status"]),
        _progress_row("Catalogue", customer_items["catalogue"]["status"], has_catalogue or True),
        _progress_row("Test", customer_items["test"]["status"]),
        _progress_row("Go Live", customer_items["go_live"]["status"]),
    ) if p]

    # ---- Guided onboarding wizard (customer-facing Overview page) ----
    # Single source of truth for step order/labels/status — the frontend used to
    # hardcode this same list; it now just renders whatever this returns.
    current_idx = ONBOARDING_STAGES.index(r["onboarding_stage"]) if r["onboarding_stage"] in ONBOARDING_STAGES else 1
    can_simulate = environment != "production"

    def _step(key, action=None, detail=None):
        # Status mirrors the existing stage-index comparison the frontend used to
        # do client-side (isPast/isCurrent in the old Overview.jsx stepper) — a
        # step is "done" purely because onboarding has moved past it, matching
        # today's behavior exactly (not a new completion check).
        idx = ONBOARDING_STAGES.index(key)
        if r["is_live"] or current_idx > idx:
            status = "done"
        elif current_idx == idx:
            status = "active"
        else:
            status = "upcoming"
        return {
            "key": key,
            "number": idx,  # "created" is index 0, so customer-facing steps start at 1
            "label": ONBOARDING_STAGE_LABELS_CUSTOMER.get(key, key),
            "owner": "you" if action and action.get("type") in ("navigate", "simulate_call") else "orbit",
            "status": status,
            "detail": detail or ("Completed" if status == "done" else "ORBIT setup team needs this information"),
            "action": None if status == "done" else action,
        }

    wizard_steps = [
        _step(
            "business_details",
            action={"type": "navigate", "route": "/dashboard/settings", "label": "Complete business profile"},
            detail="Your business profile is complete." if profile_ok
                   else "Add your contact phone, email and address in Settings.",
        ),
        _step(
            "ai_employee_setup",
            action={"type": "ask_orbit", "label": "Ask ORBIT about this"},
            detail=(f"{ae['name']} is ready." if ae and ae.get("lifecycle_state") in ("live", "approved")
                    else (f"ORBIT is testing and verifying {ae['name']}'s voice quality and behavior — usually within 1-2 business days." if ae
                          else "ORBIT will assign and fine-tune your dedicated AI employee — usually within 1-2 business days.")),
        ),
        _step(
            "business_data",
            action={"type": "navigate", "route": "/dashboard/live-data", "label": "Add business information"},
            detail=r["data_source_label"] if data_source_ok
                   else "Add services, hours, or policies in Business Data.",
        ),
        _step(
            "channel_setup",
            action={"type": "ask_orbit", "label": "Ask ORBIT about this"},
            detail="Your channels are connected." if ((not want_phone or phone_view == "ready") and (not want_wa or wa_view == "ready"))
                   else "ORBIT is configuring your phone/WhatsApp channel — usually within 1-2 business days. No action needed from you.",
        ),
        _step(
            "testing",
            action=({"type": "simulate_call", "label": "Simulate inbound call"} if can_simulate
                    else {"type": "ask_orbit", "label": "Ask ORBIT about this"}),
            detail="Testing complete." if (is_live or test_ok)
                   else ("Try a simulated call so ORBIT can confirm everything works." if can_simulate
                         else "ORBIT is running test calls against your AI employee."),
        ),
        _step(
            "ready_for_approval",
            action={"type": "ask_orbit", "label": "Ask ORBIT about this"},
            detail="Approved for live operations." if (is_live or (ae is not None and len(r["blockers"]) == 0))
                   else "ORBIT is reviewing everything above before approving you for launch — usually within 1 business day.",
        ),
        _step(
            "live",
            action={"type": "ask_orbit", "label": "Ask ORBIT about this"},
            detail="You're live!" if is_live
                   else "ORBIT will switch you to live once every step above is ready.",
        ),
    ]

    return {
        "environment": r["environment"],
        "is_live": r["is_live"],
        "onboarding_stage": r["onboarding_stage"],
        "stage_label": r["stage_label_customer"],
        "data_source": r["data_source"],
        "data_source_label": r["data_source_label"],
        "items": customer_items,
        "progress": progress,
        "actions_required": [k for k, v in customer_items.items() if v["status"] in ("action_required", "not_connected")],
        "needs_from_you": needs_from_you,
        "waiting_for_orbit": waiting_for_orbit,
        "configured": configured,
        "blockers": _sanitize_owner_blockers(r["blockers"]),
        "wizard_steps": wizard_steps,
    }


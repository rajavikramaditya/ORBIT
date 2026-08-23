from fastapi import APIRouter, Depends, HTTPException
from db import db
from models import (
    TenantProfileBody, CustomizationRequestBody, SimulateCallBody,
    LiveDataBody, gen_id, now_iso,
)
from security import require_tenant_user
from providers import elevenlabs
from ingest import ingest_post_call
from tools import run_tool

router = APIRouter(prefix="/api/tenant", tags=["tenant"])


# Fields a customer is allowed to self-serve (Correction 5 matrix).
PROFILE_FIELDS = {"logo_url", "website", "address", "contact_email", "contact_phone", "description"}


def tid(user):
    return user["tenant_id"]


@router.get("/overview")
async def overview(user=Depends(require_tenant_user)):
    t = tid(user)
    recent = await db.conversations.find({"tenant_id": t}, {"_id": 0, "transcript": 0}).sort("created_at", -1).to_list(6)
    total_secs = 0
    async for ev in db.usage_ledger.find({"tenant_id": t}, {"_id": 0, "quantity_secs": 1}):
        total_secs += ev.get("quantity_secs", 0)
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
    t = await db.tenants.find_one({"id": tid(user)}, {"_id": 0})
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
    for f in PROFILE_FIELDS:
        if f == "logo_url":
            continue
        if data.get(f) is not None:
            updates[f"profile.{f}"] = data[f]
    if updates:
        await db.tenants.update_one({"id": tid(user)}, {"$set": updates})
    return await db.tenants.find_one({"id": tid(user)}, {"_id": 0})


@router.get("/ai-employees")
async def ai_employees(user=Depends(require_tenant_user)):
    # Read-only for tenants. Provider identity/secrets/config are never exposed.
    return await db.ai_employees.find(
        {"tenant_id": tid(user)},
        {"_id": 0, "config_ref": 0, "provider": 0, "provider_agent_id": 0},
    ).to_list(100)


@router.get("/channels")
async def channels(user=Depends(require_tenant_user)):
    chans = await db.channels.find({"tenant_id": tid(user)}, {"_id": 0, "provider": 0}).to_list(100)
    for c in chans:
        if c.get("assigned_ai_employee_id"):
            ae = await db.ai_employees.find_one({"id": c["assigned_ai_employee_id"]}, {"_id": 0, "name": 1})
            c["assigned_ai_employee_name"] = ae["name"] if ae else None
    return chans


# Provider identifiers are internal infrastructure — never sent to customers.
CONV_TENANT_PROJECTION = {"_id": 0, "provider": 0, "provider_conversation_id": 0}


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
    profile_ok = bool(profile.get("contact_email") and profile.get("contact_phone") and profile.get("address"))
    live_data = await db.tenant_live_data.find_one({"tenant_id": t}, {"_id": 0})
    has_manual_data = bool(live_data and (live_data.get("room_rates") or live_data.get("cancellation_policy") or live_data.get("check_in_time")))

    needs_from_you = []
    if not profile_ok:
        needs_from_you.append({
            "label": "Business profile",
            "detail": "Add contact phone and address in Settings so ORBIT can finish onboarding.",
        })
    if not has_manual_data and r["data_source"] == "none":
        needs_from_you.append({
            "label": "Business rates & policies",
            "detail": "Add your standard rates, operating hours, or policies in Business Data so your AI employee can answer guest questions.",
        })

    waiting_for_orbit = []
    ae = await db.ai_employees.find_one({"tenant_id": t}, {"_id": 0})
    phone = await db.channels.find_one({"tenant_id": t, "type": "phone"}, {"_id": 0})
    wa = await db.channels.find_one({"tenant_id": t, "type": "whatsapp"}, {"_id": 0})
    integ = await db.business_integrations.find_one({"tenant_id": t}, {"_id": 0})

    if not ae:
        waiting_for_orbit.append({"label": "AI employee assignment", "detail": "ORBIT will assign and fine-tune your dedicated AI employee."})
    elif ae.get("lifecycle_state") not in ("live", "approved"):
        waiting_for_orbit.append({"label": f"AI employee · {ae['name']}", "detail": "ORBIT is testing and verifying voice quality and behavior."})
    if not phone or phone.get("status") in ("not_connected", "action_required"):
        waiting_for_orbit.append({"label": "Dedicated phone line", "detail": "ORBIT is configuring your phone line. No action needed from you."})
    if not wa or wa.get("status") in ("not_connected", "action_required"):
        waiting_for_orbit.append({"label": "WhatsApp channel", "detail": "WhatsApp business setup is being handled by ORBIT."})
    if integ and integ.get("status") not in ("connected", "ok"):
        waiting_for_orbit.append({"label": f"Integration · {integ.get('name')}", "detail": "ORBIT is connecting your external business system."})

    configured = []
    if ae and ae.get("lifecycle_state") in ("live", "approved", "testing"):
        configured.append(f"AI Employee ({ae['name']})")
    if phone and phone.get("status") in ("connected", "ok"):
        configured.append("Phone channel")
    if wa and wa.get("status") in ("connected", "ok"):
        configured.append("WhatsApp channel")
    if r["data_source"] == "connected":
        configured.append(f"Connected Business System ({integ.get('name', 'Live') if integ else 'Live'})")
    elif r["data_source"] == "manual":
        configured.append("Business Data (Manual Entry)")
    if profile_ok:
        configured.append("Business profile")

    # Map raw items to sanitized customer items
    customer_items = {
        "business_profile": {"label": "Business Profile", "status": "ok" if profile_ok else "action_required"},
        "ai_employee": {"label": ae["name"] if ae else "AI Employee", "status": ae["lifecycle_state"] if ae else "not_connected"},
        "business_data": {"label": "Business Information", "status": "ok" if r["data_source"] != "none" else "action_required", "source": r["data_source_label"]},
        "phone": {"label": "Phone Line", "status": phone["status"] if phone else "not_connected"},
        "whatsapp": {"label": "WhatsApp", "status": wa["status"] if wa else "not_connected"},
    }

    return {
        "environment": r["environment"],
        "is_live": r["is_live"],
        "onboarding_stage": r["onboarding_stage"],
        "stage_label": r["stage_label_customer"],
        "data_source": r["data_source"],
        "data_source_label": r["data_source_label"],
        "items": customer_items,
        "actions_required": [k for k, v in customer_items.items() if v["status"] in ("action_required", "not_connected")],
        "needs_from_you": needs_from_you,
        "waiting_for_orbit": waiting_for_orbit,
        "configured": configured,
        "blockers": r["blockers"],
    }


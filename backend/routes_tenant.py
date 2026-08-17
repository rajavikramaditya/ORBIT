from fastapi import APIRouter, Depends, HTTPException
from db import db
from models import (
    TenantProfileBody, CustomizationRequestBody, SimulateCallBody, gen_id, now_iso,
)
from security import require_tenant_user
from providers import elevenlabs
from ingest import ingest_post_call

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
    # Read-only for tenants. Provider secrets/config are never exposed.
    return await db.ai_employees.find(
        {"tenant_id": tid(user)},
        {"_id": 0, "config_ref": 0},
    ).to_list(100)


@router.get("/channels")
async def channels(user=Depends(require_tenant_user)):
    chans = await db.channels.find({"tenant_id": tid(user)}, {"_id": 0}).to_list(100)
    for c in chans:
        if c.get("assigned_ai_employee_id"):
            ae = await db.ai_employees.find_one({"id": c["assigned_ai_employee_id"]}, {"_id": 0, "name": 1})
            c["assigned_ai_employee_name"] = ae["name"] if ae else None
    return chans


@router.get("/conversations")
async def conversations(user=Depends(require_tenant_user)):
    return await db.conversations.find(
        {"tenant_id": tid(user)}, {"_id": 0, "transcript": 0}
    ).sort("created_at", -1).to_list(200)


@router.get("/conversations/{conv_id}")
async def conversation_detail(conv_id: str, user=Depends(require_tenant_user)):
    conv = await db.conversations.find_one({"id": conv_id, "tenant_id": tid(user)}, {"_id": 0})
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv


@router.post("/simulate-call")
async def simulate_call(body: SimulateCallBody, user=Depends(require_tenant_user)):
    """Demo helper: simulates a real inbound/outbound call landing on the tenant's
    live AI employee and captures the conversation via the same ingest path as the
    ElevenLabs post-call webhook."""
    ae = await db.ai_employees.find_one(
        {"tenant_id": tid(user), "lifecycle_state": {"$in": ["live", "approved"]}}, {"_id": 0}
    )
    if not ae:
        raise HTTPException(status_code=400, detail="No live AI employee available to take calls yet")
    evt = elevenlabs.build_post_call_event(ae["provider_agent_id"], body.direction or "inbound", body.external_number)
    result = await ingest_post_call(evt["data"])
    if result.get("status") != "ingested":
        raise HTTPException(status_code=409, detail=f"Call not captured: {result.get('status')}")
    return result["conversation"]


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

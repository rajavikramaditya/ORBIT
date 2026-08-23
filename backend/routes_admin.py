from fastapi import APIRouter, Depends, HTTPException
import os
import requests
from db import db, write_audit
from models import (
    CreateTenantBody, TenantStatusBody, CreateAIEmployeeBody, LifecycleBody,
    ConnectChannelBody, UpdateChannelBody, CustomizationStatusBody,
    EnvironmentBody, KnowledgeBaseBody,
    gen_id, now_iso, LIFECYCLE_TRANSITIONS, TENANT_STATUSES, TENANT_ENVIRONMENTS,
)
from security import require_platform_admin, hash_password
from providers import exotel
from provisioning import voice_status, telephony_status, elevenlabs_configured, exotel_configured, razorpay_configured
import billing as B

router = APIRouter(prefix="/api/admin", tags=["admin"])

# Demo tenants may go live on mock providers. Production requires real credentials
# and verification — credentials_required / configured (unverified) are blockers.
_READY_OK = {"ok", "connected"}
_DEMO_READY_OK = _READY_OK | {"credentials_required", "configured"}


async def compute_readiness(tenant_id: str) -> dict:
    """Go-live checklist & onboarding state derived HONESTLY from stored configuration."""
    from models import ONBOARDING_STAGE_LABELS_CUSTOMER
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    owner = await db.users.find_one({"tenant_id": tenant_id, "role": {"$in": ["owner", "admin"]}}, {"_id": 0})
    ae = await db.ai_employees.find_one({"tenant_id": tenant_id}, {"_id": 0})
    phone = await db.channels.find_one({"tenant_id": tenant_id, "type": "phone"}, {"_id": 0})
    wa = await db.channels.find_one({"tenant_id": tenant_id, "type": "whatsapp"}, {"_id": 0})
    integ = await db.business_integrations.find_one({"tenant_id": tenant_id}, {"_id": 0})
    live_data = await db.tenant_live_data.find_one({"tenant_id": tenant_id}, {"_id": 0})
    pricing = await db.tenant_pricing.find_one({"tenant_id": tenant_id}, {"_id": 0})

    profile = tenant.get("profile") or {}
    profile_ok = bool(profile.get("contact_email") and profile.get("contact_phone") and profile.get("address"))

    # Determine Business Data source
    has_manual_data = bool(live_data and (live_data.get("room_rates") or live_data.get("cancellation_policy") or live_data.get("check_in_time")))
    kb = (ae or {}).get("knowledge_base") or {}
    has_kb = any(bool(kb.get(k)) for k in ("business_info", "services", "policies", "hours", "instructions"))
    has_connected_integ = bool(integ and integ.get("status") == "connected" and (tenant.get("environment") != "production" or integ.get("mode") == "live"))

    if has_connected_integ:
        data_source = "connected"
        data_source_label = f"Live data from your connected business system ({integ.get('name') or 'Business System'})"
    elif has_manual_data or has_kb:
        data_source = "manual"
        data_source_label = "Information maintained in ORBIT (Manual Entry)"
    else:
        data_source = "none"
        data_source_label = "Not configured — AI operates in limited informational mode"

    data_source_ok = (data_source in ("connected", "manual"))
    lifecycle = ae.get("lifecycle_state") if ae else None
    tested = lifecycle in ("approved", "live")
    approved = lifecycle in ("approved", "live")
    is_live = tenant.get("status") == "live" and lifecycle == "live"
    environment = tenant.get("environment", "demo")

    def item(key, label, status, required, detail=""):
        return {"key": key, "label": label, "status": status, "required": required, "detail": detail}

    items = [
        item("owner", "Owner account", "ok" if owner else "action_required", True,
             owner["email"] if owner else "No owner login exists for this tenant."),
        item("profile", "Business profile", "ok" if profile_ok else "action_required", True,
             "" if profile_ok else "Contact email, phone and address are required in Settings."),
        item("ai_employee", "AI employee assigned", "ok" if ae else "action_required", True,
             ae["name"] if ae else "Attach an AI employee."),
        item("voice_agent", "Voice agent (provider)", voice_status(ae) if ae else "not_connected", True,
             "" if ae else "Requires an AI employee first."),
        item("phone", "Phone channel", telephony_status(phone), True,
             (phone or {}).get("connected_identifier", "") or "Connect a phone number."),
        item("whatsapp", "WhatsApp channel", wa["status"] if wa else "not_connected", False,
             (wa or {}).get("meta", {}).get("note", "")),
        item("business_data", "Business data / Knowledge", "ok" if data_source_ok else "action_required", True,
             data_source_label),
        item("billing", "Billing pricing", "ok" if pricing else "action_required", True,
             "" if pricing else "Pricing has not been configured."),
        item("payments", "Payments (Razorpay)", "ok" if razorpay_configured() else "credentials_required", False,
             "" if razorpay_configured() else "Required before issuing payable production invoices."),
        item("tested", "Testing & preview", "ok" if tested else ("testing" if lifecycle == "testing" else "pending"), True,
             "" if tested else "AI employee must pass testing."),
        item("approved", "Approval", "ok" if approved else "pending", True,
             "" if approved else "AI employee must be approved for live operations."),
        item("live", "Go live", "ok" if is_live else "pending", True,
             "" if is_live else "Requires tenant status Live and AI employee lifecycle Live."),
    ]

    allowed = _DEMO_READY_OK if environment == "demo" else _READY_OK
    blockers = []
    if not owner:
        blockers.append("Owner account missing")
    if not profile_ok:
        blockers.append("Business profile incomplete (contact email, phone, and address required in Settings)")
    if not ae:
        blockers.append("AI employee not assigned")
    if environment == "production" and (not ae or voice_status(ae) not in _READY_OK):
        blockers.append("Voice provider credentials not verified")
    if not phone or telephony_status(phone) not in allowed:
        blockers.append("Phone channel not connected or verified")
    if not data_source_ok:
        blockers.append("Business information not provided (Configure Business Data or Knowledge Base)")
    if not pricing:
        blockers.append("Billing pricing not configured")
    if not approved:
        blockers.append("AI employee not yet approved for live operations")

    # Authoritative onboarding stage
    if not profile_ok:
        stage = "business_details"
    elif not ae:
        stage = "ai_employee_setup"
    elif not data_source_ok:
        stage = "business_data"
    elif not phone or telephony_status(phone) not in allowed:
        stage = "channel_setup"
    elif not tested:
        stage = "testing"
    elif not approved or len(blockers) > 0:
        stage = "ready_for_approval"
    elif is_live:
        stage = "live"
    else:
        stage = "ready_for_approval"

    return {
        "tenant_id": tenant_id,
        "environment": environment,
        "onboarding_stage": stage,
        "stage_label_customer": ONBOARDING_STAGE_LABELS_CUSTOMER.get(stage, stage),
        "data_source": data_source,
        "data_source_label": data_source_label,
        "items": items,
        "blockers": blockers,
        "ready_for_live": len(blockers) == 0,
        "is_live": is_live,
    }



@router.get("/stats")
async def stats(admin=Depends(require_platform_admin)):
    return {
        "tenants": await db.tenants.count_documents({}),
        "live_tenants": await db.tenants.count_documents({"status": "live"}),
        "ai_employees": await db.ai_employees.count_documents({}),
        "live_ai_employees": await db.ai_employees.count_documents({"lifecycle_state": "live"}),
        "conversations": await db.conversations.count_documents({}),
        "open_requests": await db.customization_requests.count_documents({"status": {"$in": ["submitted", "in_review", "in_progress"]}}),
        "quarantined_webhooks": await db.webhook_quarantine.count_documents({}),
    }


@router.get("/tenants")
async def list_tenants(admin=Depends(require_platform_admin)):
    tenants = await db.tenants.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    for t in tenants:
        readiness = await compute_readiness(t["id"])
        t["counts"] = {
            "ai_employees": await db.ai_employees.count_documents({"tenant_id": t["id"]}),
            "channels": await db.channels.count_documents({"tenant_id": t["id"]}),
            "conversations": await db.conversations.count_documents({"tenant_id": t["id"]}),
        }
        t["onboarding_stage"] = readiness["onboarding_stage"]
        t["stage_label"] = readiness["stage_label_customer"]
        t["data_source"] = readiness["data_source"]
        t["ready_for_live"] = readiness["ready_for_live"]
        t["blockers_count"] = len(readiness["blockers"])
    return tenants


@router.post("/tenants")
async def create_tenant(body: CreateTenantBody, admin=Depends(require_platform_admin)):
    email = body.owner_email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Owner email already in use")
    tenant_id = gen_id("tenant_")
    await db.tenants.insert_one({
        "id": tenant_id,
        "slug": body.name.lower().replace(" ", "-")[:40],
        "name": body.name,
        "status": "onboarding",
        "environment": "demo",
        "profile": {"logo_url": "", "website": "", "address": "", "contact_email": email,
                    "contact_phone": "", "description": ""},
        "branding": {"brand_color": body.brand_color or "#18181B", "logo_url": ""},
        "created_at": now_iso(),
    })
    await B.get_pricing(tenant_id)
    await db.users.insert_one({
        "id": gen_id("usr_"),
        "email": email,
        "password_hash": hash_password(body.owner_password),
        "name": body.owner_name,
        "role": "owner",
        "tenant_id": tenant_id,
        "auth_provider": "password",
        "created_at": now_iso(),
    })
    await write_audit(admin, "tenant.create", tenant_id, tenant_id, {"name": body.name})
    return await db.tenants.find_one({"id": tenant_id}, {"_id": 0})


@router.get("/tenants/{tenant_id}")
async def tenant_detail(tenant_id: str, admin=Depends(require_platform_admin)):

    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    tenant["ai_employees"] = await db.ai_employees.find({"tenant_id": tenant_id}, {"_id": 0}).to_list(100)
    tenant["channels"] = await db.channels.find({"tenant_id": tenant_id}, {"_id": 0}).to_list(100)
    tenant["users"] = await db.users.find({"tenant_id": tenant_id}, {"_id": 0, "password_hash": 0}).to_list(100)
    tenant["integrations"] = await db.business_integrations.find({"tenant_id": tenant_id}, {"_id": 0}).to_list(100)
    tenant["tools"] = await db.tools.find({"tenant_id": tenant_id}, {"_id": 0}).to_list(200)
    tenant["live_data"] = await db.tenant_live_data.find_one({"tenant_id": tenant_id}, {"_id": 0})
    tenant["readiness"] = await compute_readiness(tenant_id)
    return tenant



@router.patch("/tenants/{tenant_id}/status")
async def set_tenant_status(tenant_id: str, body: TenantStatusBody, admin=Depends(require_platform_admin)):
    if body.status not in TENANT_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status")
    if body.status == "live":
        readiness = await compute_readiness(tenant_id)
        if not readiness["ready_for_live"]:
            raise HTTPException(
                status_code=400,
                detail="Not ready for live: " + ", ".join(readiness["blockers"]),
            )
    res = await db.tenants.update_one({"id": tenant_id}, {"$set": {"status": body.status}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Tenant not found")
    await write_audit(admin, "tenant.status", tenant_id, tenant_id, {"status": body.status})
    return await db.tenants.find_one({"id": tenant_id}, {"_id": 0})


@router.post("/tenants/{tenant_id}/ai-employees")
async def create_ai_employee(tenant_id: str, body: CreateAIEmployeeBody, admin=Depends(require_platform_admin)):
    if not await db.tenants.find_one({"id": tenant_id}):
        raise HTTPException(status_code=404, detail="Tenant not found")
    if await db.ai_employees.find_one({"provider_agent_id": body.provider_agent_id}):
        raise HTTPException(status_code=400, detail="This provider_agent_id is already mapped")
    doc = {
        "id": gen_id("ae_"),
        "tenant_id": tenant_id,
        "name": body.name,
        "role_title": body.role_title,
        "provider": "elevenlabs",
        "provider_agent_id": body.provider_agent_id,
        "lifecycle_state": "draft",
        "voice_name": body.voice_name,
        "voice_description": body.voice_description,
        "config_ref": "",
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.ai_employees.insert_one(dict(doc))
    await write_audit(admin, "ai_employee.create", doc["id"], tenant_id, {"agent_id": body.provider_agent_id})
    doc.pop("_id", None)
    return doc


@router.patch("/ai-employees/{ae_id}/lifecycle")
async def set_lifecycle(ae_id: str, body: LifecycleBody, admin=Depends(require_platform_admin)):
    ae = await db.ai_employees.find_one({"id": ae_id}, {"_id": 0})
    if not ae:
        raise HTTPException(status_code=404, detail="AI employee not found")
    current = ae["lifecycle_state"]
    if body.to_state not in LIFECYCLE_TRANSITIONS.get(current, set()):
        raise HTTPException(status_code=400, detail=f"Cannot transition from {current} to {body.to_state}")
    await db.ai_employees.update_one({"id": ae_id}, {"$set": {"lifecycle_state": body.to_state, "updated_at": now_iso()}})
    await write_audit(admin, "ai_employee.lifecycle", ae_id, ae["tenant_id"], {"from": current, "to": body.to_state})
    return await db.ai_employees.find_one({"id": ae_id}, {"_id": 0})


@router.post("/tenants/{tenant_id}/channels")
async def connect_channel(tenant_id: str, body: ConnectChannelBody, admin=Depends(require_platform_admin)):
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    if body.type == "phone":
        # Demo may record a mock connection. Production never fakes "connected"
        # without real telephony credentials.
        if tenant.get("environment") == "production" and not exotel_configured():
            provider, status = "exotel", "action_required"
        else:
            result = exotel.connect_number(tenant_id, body.connected_identifier)
            provider, status = "exotel", result["status"]
    elif body.type == "whatsapp":
        provider, status = "elevenlabs_whatsapp", "action_required"
    else:
        raise HTTPException(status_code=400, detail="Invalid channel type")
    doc = {
        "id": gen_id("ch_"),
        "tenant_id": tenant_id,
        "type": body.type,
        "provider": provider,
        "status": status,
        "connected_identifier": body.connected_identifier,
        "assigned_ai_employee_id": body.assigned_ai_employee_id,
        "meta": {},
        "created_at": now_iso(),
    }
    await db.channels.insert_one(dict(doc))
    await write_audit(admin, "channel.connect", doc["id"], tenant_id, {"type": body.type})
    doc.pop("_id", None)
    return doc


@router.patch("/channels/{channel_id}")
async def update_channel(channel_id: str, body: UpdateChannelBody, admin=Depends(require_platform_admin)):
    ch = await db.channels.find_one({"id": channel_id}, {"_id": 0})
    if not ch:
        raise HTTPException(status_code=404, detail="Channel not found")
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if updates:
        await db.channels.update_one({"id": channel_id}, {"$set": updates})
    await write_audit(admin, "channel.update", channel_id, ch["tenant_id"], updates)
    return await db.channels.find_one({"id": channel_id}, {"_id": 0})


@router.get("/customization-requests")
async def all_requests(admin=Depends(require_platform_admin)):
    reqs = await db.customization_requests.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    for r in reqs:
        t = await db.tenants.find_one({"id": r["tenant_id"]}, {"_id": 0, "name": 1})
        r["tenant_name"] = t["name"] if t else "Unknown"
    return reqs


@router.patch("/customization-requests/{req_id}")
async def update_request(req_id: str, body: CustomizationStatusBody, admin=Depends(require_platform_admin)):
    r = await db.customization_requests.find_one({"id": req_id}, {"_id": 0})
    if not r:
        raise HTTPException(status_code=404, detail="Request not found")
    updates = {"status": body.status, "updated_at": now_iso()}
    if body.admin_notes is not None:
        updates["admin_notes"] = body.admin_notes
    await db.customization_requests.update_one({"id": req_id}, {"$set": updates})
    await write_audit(admin, "customization.update", req_id, r["tenant_id"], {"status": body.status})
    return await db.customization_requests.find_one({"id": req_id}, {"_id": 0})


@router.get("/quarantine")
async def quarantine(admin=Depends(require_platform_admin)):
    return await db.webhook_quarantine.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)


@router.get("/system-health")
async def system_health(admin=Depends(require_platform_admin)):
    """Platform-level health for Admin. Statuses are honest: unconfigured
    providers are credentials_required, never fake Healthy."""
    db_ok = True
    try:
        await db.command("ping")
    except Exception:
        db_ok = False
    return {
        "items": [
            {"key": "saas", "label": "SaaS application", "status": "ok"},
            {"key": "database", "label": "Database", "status": "ok" if db_ok else "error"},
            {"key": "voice", "label": "Voice AI", "status": "ok" if elevenlabs_configured() else "credentials_required"},
            {"key": "telephony", "label": "Telephony", "status": "ok" if exotel_configured() else "credentials_required"},
            {"key": "whatsapp", "label": "WhatsApp", "status": "action_required",
             "detail": "Managed onboarding — not connected until a real channel is configured."},
            {"key": "payments", "label": "Payments", "status": "ok" if razorpay_configured() else "credentials_required"},
        ],
        "capacity": {
            "status": "unconfirmed",
            "message": "ElevenLabs plan concurrent call limit not yet confirmed. Do not promise a concurrency level until the commercial plan is verified.",
            "active_calls": None,
            "configured_limit": None,
            "utilization_pct": None,
        },
    }



@router.get("/audit-log")
async def audit_log(admin=Depends(require_platform_admin)):
    return await db.audit_log.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)


# ---------------- Production readiness: environment, provisioning, knowledge, ops ----------------
@router.patch("/tenants/{tenant_id}/environment")
async def set_environment(tenant_id: str, body: EnvironmentBody, admin=Depends(require_platform_admin)):
    if body.environment not in TENANT_ENVIRONMENTS:
        raise HTTPException(status_code=400, detail="Invalid environment")
    res = await db.tenants.update_one({"id": tenant_id}, {"$set": {"environment": body.environment}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Tenant not found")
    await write_audit(admin, "tenant.environment", tenant_id, tenant_id, {"environment": body.environment})
    return await db.tenants.find_one({"id": tenant_id}, {"_id": 0})


@router.get("/tenants/{tenant_id}/provisioning")
async def provisioning(tenant_id: str, admin=Depends(require_platform_admin)):
    aes = await db.ai_employees.find({"tenant_id": tenant_id}, {"_id": 0}).to_list(100)
    chans = await db.channels.find({"tenant_id": tenant_id, "type": "phone"}, {"_id": 0}).to_list(100)
    return {
        "elevenlabs": {
            "credentials_configured": elevenlabs_configured(),
            "agents": [{"ai_employee_id": a["id"], "name": a["name"], "provider_agent_id": a.get("provider_agent_id"),
                        "status": voice_status(a)} for a in aes],
        },
        "exotel": {
            "credentials_configured": exotel_configured(),
            "numbers": [{"channel_id": c["id"], "number": c.get("connected_identifier"), "status": telephony_status(c)} for c in chans],
        },
        "razorpay": {"credentials_configured": razorpay_configured()},
    }


@router.post("/ai-employees/{ae_id}/verify-voice")
async def verify_voice(ae_id: str, admin=Depends(require_platform_admin)):
    ae = await db.ai_employees.find_one({"id": ae_id}, {"_id": 0})
    if not ae:
        raise HTTPException(status_code=404, detail="AI employee not found")
    if not elevenlabs_configured():
        return {"status": "credentials_required", "message": "Production credentials required (ELEVENLABS_API_KEY)."}
    try:
        r = requests.get(
            f"https://api.elevenlabs.io/v1/convai/agents/{ae.get('provider_agent_id')}",
            headers={"xi-api-key": os.environ["ELEVENLABS_API_KEY"]}, timeout=10,
        )
        ok = r.status_code == 200
    except Exception:
        ok = False
    await db.ai_employees.update_one({"id": ae_id}, {"$set": {"provider_verified": ok, "updated_at": now_iso()}})
    return {"status": "connected" if ok else "error",
            "message": "Agent verified." if ok else "Could not verify the agent with ElevenLabs."}


@router.post("/channels/{channel_id}/verify-telephony")
async def verify_telephony(channel_id: str, admin=Depends(require_platform_admin)):
    ch = await db.channels.find_one({"id": channel_id}, {"_id": 0})
    if not ch:
        raise HTTPException(status_code=404, detail="Channel not found")
    if not exotel_configured():
        return {"status": "credentials_required", "message": "Production credentials required (EXOTEL_API_KEY/TOKEN/SID)."}
    try:
        sub = os.environ.get("EXOTEL_SUBDOMAIN", "api.in.exotel.com")
        r = requests.get(
            f"https://{os.environ['EXOTEL_API_KEY']}:{os.environ['EXOTEL_API_TOKEN']}@{sub}/v1/Accounts/{os.environ['EXOTEL_ACCOUNT_SID']}",
            timeout=10,
        )
        ok = r.status_code < 400
    except Exception:
        ok = False
    await db.channels.update_one({"id": channel_id}, {"$set": {"provider_verified": ok}})
    return {"status": "connected" if ok else "error",
            "message": "Telephony verified." if ok else "Could not verify with Exotel."}


@router.patch("/ai-employees/{ae_id}/knowledge")
async def set_knowledge(ae_id: str, body: KnowledgeBaseBody, admin=Depends(require_platform_admin)):
    ae = await db.ai_employees.find_one({"id": ae_id}, {"_id": 0})
    if not ae:
        raise HTTPException(status_code=404, detail="AI employee not found")
    updates = {f"knowledge_base.{k}": v for k, v in body.model_dump().items() if v is not None}
    updates["updated_at"] = now_iso()
    await db.ai_employees.update_one({"id": ae_id}, {"$set": updates})
    await write_audit(admin, "ai_employee.knowledge", ae_id, ae["tenant_id"], {"fields": list(updates.keys())})
    return await db.ai_employees.find_one({"id": ae_id}, {"_id": 0})


@router.get("/tenants/{tenant_id}/readiness")
async def tenant_readiness(tenant_id: str, admin=Depends(require_platform_admin)):
    """Go-live readiness checklist. Statuses are derived HONESTLY from actual
    configuration — nothing is reported green unless it is really done."""
    return await compute_readiness(tenant_id)


@router.get("/operations")
async def operations(admin=Depends(require_platform_admin)):
    rows = []
    for t in await db.tenants.find({}, {"_id": 0}).sort("created_at", -1).to_list(500):
        aes = await db.ai_employees.find({"tenant_id": t["id"]}, {"_id": 0}).to_list(50)
        phone = await db.channels.find_one({"tenant_id": t["id"], "type": "phone"}, {"_id": 0})
        wa = await db.channels.find_one({"tenant_id": t["id"], "type": "whatsapp"}, {"_id": 0})
        integ = await db.business_integrations.find_one({"tenant_id": t["id"]}, {"_id": 0})
        ai_state = next((a["lifecycle_state"] for a in aes if a["lifecycle_state"] == "live"),
                        aes[0]["lifecycle_state"] if aes else "not_connected")
        ready = await compute_readiness(t["id"])
        rows.append({
            "tenant_id": t["id"], "name": t["name"], "environment": t.get("environment", "demo"),
            "ai_employee": ai_state,
            "phone": phone["status"] if phone else "not_connected",
            "whatsapp": wa["status"] if wa else "not_connected",
            "business_integration": integ["status"] if integ else "not_connected",
            "billing": t.get("spend_status", "ok"),
            "ready_for_live": ready["ready_for_live"],
            "blockers": ready["blockers"],
            "is_live": ready["is_live"],
        })
    return rows

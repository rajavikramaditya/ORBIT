from fastapi import APIRouter, Depends, HTTPException
from db import db, write_audit
from models import (
    CreateTenantBody, TenantStatusBody, CreateAIEmployeeBody, LifecycleBody,
    ConnectChannelBody, UpdateChannelBody, CustomizationStatusBody,
    gen_id, now_iso, LIFECYCLE_TRANSITIONS, TENANT_STATUSES,
)
from security import require_platform_admin, hash_password
from providers import exotel, whatsapp

router = APIRouter(prefix="/api/admin", tags=["admin"])


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
        t["counts"] = {
            "ai_employees": await db.ai_employees.count_documents({"tenant_id": t["id"]}),
            "channels": await db.channels.count_documents({"tenant_id": t["id"]}),
            "conversations": await db.conversations.count_documents({"tenant_id": t["id"]}),
        }
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
        "profile": {"logo_url": "", "website": "", "address": "", "contact_email": email,
                    "contact_phone": "", "description": ""},
        "branding": {"brand_color": body.brand_color or "#18181B", "logo_url": ""},
        "created_at": now_iso(),
    })
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
    return tenant


@router.patch("/tenants/{tenant_id}/status")
async def set_tenant_status(tenant_id: str, body: TenantStatusBody, admin=Depends(require_platform_admin)):
    if body.status not in TENANT_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status")
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
    if not await db.tenants.find_one({"id": tenant_id}):
        raise HTTPException(status_code=404, detail="Tenant not found")
    if body.type == "phone":
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


@router.get("/audit-log")
async def audit_log(admin=Depends(require_platform_admin)):
    return await db.audit_log.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)

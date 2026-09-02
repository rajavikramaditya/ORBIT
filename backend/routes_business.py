"""Business Integration + Tool Layer API.

Admin (ORBIT-managed) endpoints create/configure a tenant's business-system
integrations and the tools an AI Employee may use. Tenant endpoints are
read-only surfaces plus a tool "preview" that runs a tool safely (read auto,
action requires confirmation) and clearly labels live / mock / unavailable data.
"""
from fastapi import APIRouter, Depends, HTTPException
from db import db, write_audit
from models import (
    CreateIntegrationBody, UpdateIntegrationBody, CreateToolBody, UpdateToolBody,
    ToolExecuteBody, gen_id, now_iso, INTEGRATION_TYPES, TOOL_KINDS,
)
from security import require_platform_admin, require_tenant_user
from tools import run_tool
from connectors import list_connectors

router = APIRouter(tags=["business"])


def _tid(user):
    return user["tenant_id"]


@router.get("/api/admin/connectors")
async def connectors_catalogue(admin=Depends(require_platform_admin)):
    """Catalogue for the 'what system does this business use?' onboarding step."""
    return list_connectors()


# ---------------- Admin (ORBIT-managed setup) ----------------
@router.post("/api/admin/tenants/{tenant_id}/integrations")
async def create_integration(tenant_id: str, body: CreateIntegrationBody, admin=Depends(require_platform_admin)):
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    if body.type not in INTEGRATION_TYPES:
        raise HTTPException(status_code=400, detail="Invalid integration type")
    connector_key = body.connector_key or "mock_pms"
    if tenant.get("environment") == "production" and (body.mode == "mock" or connector_key == "mock_pms"):
        raise HTTPException(status_code=400, detail="Production tenants cannot use mock connectors.")
    is_custom = connector_key == "custom"
    status = body.status or ("custom_integration_required" if is_custom else "connected")
    status_msg = body.status_message or ("Custom integration adapter required before live connection." if is_custom else "")
    doc = {
        "id": gen_id("int_"),
        "tenant_id": tenant_id,
        "type": body.type,
        "name": body.name,
        "connector_key": connector_key,
        "provider": body.provider or connector_key,
        # custom/managed integrations have no mock connector; they are 'live' once built.
        "mode": "live" if is_custom else body.mode,
        "status": status,
        "status_message": status_msg,
        "system_name": body.system_name,
        "auth_method": body.auth_method,
        "api_docs_url": body.api_docs_url,
        "required_capabilities": body.required_capabilities or [],
        "notes": body.notes or "",
        "credentials_configured": False,
        "last_verified_at": None,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.business_integrations.insert_one(dict(doc))
    await write_audit(admin, "integration.create", doc["id"], tenant_id, {"type": body.type, "connector": connector_key})
    doc.pop("_id", None)
    return doc



@router.patch("/api/admin/integrations/{integration_id}")
async def update_integration(integration_id: str, body: UpdateIntegrationBody, admin=Depends(require_platform_admin)):
    integ = await db.business_integrations.find_one({"id": integration_id}, {"_id": 0})
    if not integ:
        raise HTTPException(status_code=404, detail="Integration not found")
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if updates.get("mode") == "mock":
        tenant = await db.tenants.find_one({"id": integ["tenant_id"]}, {"_id": 0, "environment": 1})
        if (tenant or {}).get("environment") == "production":
            raise HTTPException(status_code=400, detail="Production tenants cannot use mock connectors.")
    updates["updated_at"] = now_iso()
    await db.business_integrations.update_one({"id": integration_id}, {"$set": updates})
    await write_audit(admin, "integration.update", integration_id, integ["tenant_id"], updates)
    return await db.business_integrations.find_one({"id": integration_id}, {"_id": 0})


@router.post("/api/admin/integrations/{integration_id}/tools")
async def create_tool(integration_id: str, body: CreateToolBody, admin=Depends(require_platform_admin)):
    integ = await db.business_integrations.find_one({"id": integration_id}, {"_id": 0})
    if not integ:
        raise HTTPException(status_code=404, detail="Integration not found")
    if body.kind not in TOOL_KINDS:
        raise HTTPException(status_code=400, detail="Invalid tool kind")
    doc = {
        "id": gen_id("tool_"),
        "tenant_id": integ["tenant_id"],
        "integration_id": integration_id,
        "key": body.key,
        "name": body.name,
        "kind": body.kind,  # read | action
        "enabled": body.enabled,
        # actions always require confirmation regardless of input
        "requires_confirmation": True if body.kind == "action" else bool(body.requires_confirmation),
        "description": body.description or "",
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.tools.insert_one(dict(doc))
    await write_audit(admin, "tool.create", doc["id"], integ["tenant_id"], {"key": body.key, "kind": body.kind})
    doc.pop("_id", None)
    return doc


@router.patch("/api/admin/tools/{tool_id}")
async def update_tool(tool_id: str, body: UpdateToolBody, admin=Depends(require_platform_admin)):
    tool = await db.tools.find_one({"id": tool_id}, {"_id": 0})
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if tool["kind"] == "action":
        updates["requires_confirmation"] = True
    updates["updated_at"] = now_iso()
    await db.tools.update_one({"id": tool_id}, {"$set": updates})
    await write_audit(admin, "tool.update", tool_id, tool["tenant_id"], updates)
    return await db.tools.find_one({"id": tool_id}, {"_id": 0})


# ---------------- Tenant (read-only surface + safe preview) ----------------
@router.get("/api/tenant/integrations")
async def tenant_integrations(user=Depends(require_tenant_user)):
    """Unified 'Business Integrations' view. Technical provider complexity is hidden."""
    t = _tid(user)
    systems = []
    for integ in await db.business_integrations.find({"tenant_id": t}, {"_id": 0}).to_list(100):
        systems.append({
            "category": "business", "key": integ["id"], "label": integ["name"],
            "type": integ["type"], "status": integ["status"],
            "mode": integ.get("mode"), "is_mock": integ.get("mode") == "mock",
        })
    for ch in await db.channels.find({"tenant_id": t}, {"_id": 0}).to_list(100):
        systems.append({
            "category": "channel", "key": ch["id"],
            "label": "Phone" if ch["type"] == "phone" else "WhatsApp",
            "type": ch["type"], "status": ch["status"], "mode": None, "is_mock": False,
        })
    for ae in await db.ai_employees.find({"tenant_id": t}, {"_id": 0}).to_list(100):
        systems.append({
            "category": "ai_employee", "key": ae["id"], "label": f"AI Employee · {ae['name']}",
            "type": "ai_employee", "status": ae["lifecycle_state"], "mode": None, "is_mock": False,
        })
    return {"systems": systems}


@router.get("/api/tenant/tools")
async def tenant_tools(user=Depends(require_tenant_user)):
    t = _tid(user)
    integrations = {i["id"]: i for i in await db.business_integrations.find({"tenant_id": t}, {"_id": 0}).to_list(100)}
    out = []
    for tool in await db.tools.find({"tenant_id": t}, {"_id": 0}).to_list(200):
        integ = integrations.get(tool.get("integration_id"))
        connected = bool(integ and integ.get("status") == "connected")
        out.append({
            **tool,
            "integration_name": integ["name"] if integ else None,
            "integration_mode": integ.get("mode") if integ else None,
            "available": bool(tool.get("enabled") and connected),
        })
    return out


@router.post("/api/tenant/tools/{tool_id}/preview")
async def preview_tool(tool_id: str, body: ToolExecuteBody, user=Depends(require_tenant_user)):
    """Safely run a tool for the current tenant. READ runs immediately; ACTION
    requires confirmed=True. Results are labelled live / mock / unavailable."""
    tool = await db.tools.find_one({"id": tool_id, "tenant_id": _tid(user)}, {"_id": 0})
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    return await run_tool(tool, _tid(user), body.args or {}, bool(body.confirmed), user)

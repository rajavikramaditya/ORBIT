from fastapi import APIRouter, Request, HTTPException
import os
import logging
from security import verify_webhook_signature, verify_elevenlabs_signature
from ingest import ingest_post_call
from runtime_config import is_production
from db import db
from connectors import get_orbit_live_connector, connector_supports

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])
logger = logging.getLogger("orbit.webhooks")


@router.post("/elevenlabs/post-call")
async def elevenlabs_post_call(request: Request):
    """HMAC-verified ElevenLabs post-call webhook. Tenant is resolved server-side
    via provider_agent_id only; any tenant field in the payload is ignored.
    Production requires ELEVENLABS_WEBHOOK_SECRET and does not accept the demo HMAC."""
    raw = await request.body()
    el_secret = os.environ.get("ELEVENLABS_WEBHOOK_SECRET")
    el_sig = request.headers.get("ElevenLabs-Signature") or request.headers.get("elevenlabs-signature")
    if is_production():
        if not el_secret:
            raise HTTPException(status_code=503, detail="Webhook not configured")
        ok = verify_elevenlabs_signature(raw, el_sig or "", el_secret)
    elif el_secret and el_sig:
        ok = verify_elevenlabs_signature(raw, el_sig, el_secret)
    else:
        orbit_sig = request.headers.get("X-Orbit-Signature") or request.headers.get("x-orbit-signature")
        ok = verify_webhook_signature(raw, orbit_sig)
    if not ok:
        raise HTTPException(status_code=401, detail="Invalid webhook signature")
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")
    data = payload.get("data", payload)
    try:
        result = await ingest_post_call(data)
    except Exception:
        logger.exception("post-call ingest failed conversation_id=%s", data.get("conversation_id"))
        raise HTTPException(status_code=500, detail="Webhook processing failed")
    status = result.get("status")
    if status == "quarantined":
        logger.warning("post-call quarantined reason=%s", result.get("reason"))
    elif status == "ingested":
        logger.info("post-call ingested")
    return result


@router.post("/elevenlabs/tool-call")
async def elevenlabs_tool_call(request: Request):
    """ElevenLabs calls this endpoint when the AI agent invokes a tool during a live call.
    We resolve the tenant from provider_agent_id, load their business data, and return the result.
    Signature verification mirrors the post-call webhook.
    
    NOTE: Code path ready — ElevenLabs tool configuration still required in the agent's definition.
    """
    raw = await request.body()
    el_secret = os.environ.get("ELEVENLABS_WEBHOOK_SECRET")
    el_sig = request.headers.get("ElevenLabs-Signature") or request.headers.get("elevenlabs-signature")
    if is_production():
        if not el_secret:
            raise HTTPException(status_code=503, detail="Webhook not configured")
        ok = verify_elevenlabs_signature(raw, el_sig or "", el_secret)
    elif el_secret and el_sig:
        ok = verify_elevenlabs_signature(raw, el_sig, el_secret)
    else:
        orbit_sig = request.headers.get("X-Orbit-Signature") or request.headers.get("x-orbit-signature")
        ok = verify_webhook_signature(raw, orbit_sig)
    if not ok:
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    # ElevenLabs tool-call payload: {agent_id, tool_name, parameters}
    agent_id = payload.get("agent_id")
    tool_name = payload.get("tool_name") or payload.get("tool")
    parameters = payload.get("parameters") or payload.get("args") or {}

    if not agent_id or not tool_name:
        raise HTTPException(status_code=400, detail="agent_id and tool_name are required")

    # Resolve tenant from agent_id — NEVER trust tenant_id from payload (tenant isolation)
    ae = await db.ai_employees.find_one({"provider_agent_id": agent_id}, {"_id": 0})
    if not ae:
        logger.warning("tool-call: unknown or unmapped agent_id=%s", agent_id)
        raise HTTPException(status_code=404, detail="Agent not found")

    # Verify agent is allowed to execute tools (not suspended or in draft)
    if ae.get("lifecycle_state") == "suspended":
        logger.warning("tool-call: rejected call for suspended agent_id=%s", agent_id)
        return {"status": "unavailable", "message": "This AI employee is currently suspended."}

    tenant_id = ae["tenant_id"]

    # Load tenant's manual business data from DB (scoped strictly to tenant_id)
    live_data_doc = await db.tenant_live_data.find_one({"tenant_id": tenant_id}, {"_id": 0})
    if not live_data_doc:
        logger.info("tool-call: no manual business data configured for tenant=%s, tool=%s", tenant_id, tool_name)
        return {"status": "unavailable", "message": "Business data not configured. Please configure your business data in ORBIT."}

    # Check tool is supported by orbit_live connector
    if not connector_supports("orbit_live", tool_name, "read"):
        logger.warning("tool-call: unsupported tool=%s requested for tenant=%s", tool_name, tenant_id)
        return {"status": "unsupported", "message": f"Tool '{tool_name}' is not supported."}

    connector = get_orbit_live_connector(live_data_doc)
    try:
        result = connector.read(tool_name, parameters)
        logger.info("tool-call: success tenant=%s tool=%s", tenant_id, tool_name)
        return {"status": "ok", "data": result.get("result")}
    except Exception:
        logger.exception("tool-call: execution failed tenant=%s tool=%s", tenant_id, tool_name)
        return {"status": "error", "message": "Could not fetch business data. Please try again."}


from fastapi import APIRouter, Request, HTTPException
from starlette.responses import PlainTextResponse
import os
import hmac
import hashlib
import logging
from pymongo.errors import DuplicateKeyError
from security import (
    verify_webhook_signature, verify_elevenlabs_signature, verify_meta_signature,
)
from ingest import ingest_post_call
from runtime_config import is_production
from db import db
from connectors import get_orbit_live_connector, connector_supports
from models import ORBIT_LEAD_PERSIST_TOOLS, FormIntakeBody, gen_id, now_iso
from leads import persist_from_tool_call
from voice_providers import get_voice_provider
from channel_adapters import (
    exotel_configured, meta_whatsapp_configured, meta_whatsapp_verify_configured,
)
from channel_ingest import ingest_exotel_inbound, ingest_whatsapp_inbound, ingest_form_lead

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])
intake_router = APIRouter(prefix="/api", tags=["intake"])
logger = logging.getLogger("orbit.webhooks")


def _verify_orbit_hmac(raw: bytes, request: Request) -> bool:
    orbit_sig = request.headers.get("X-Orbit-Signature") or request.headers.get("x-orbit-signature")
    return verify_webhook_signature(raw, orbit_sig)


def _verify_elevenlabs_request(raw: bytes, request: Request) -> None:
    el_secret = os.environ.get("ELEVENLABS_WEBHOOK_SECRET")
    el_sig = request.headers.get("ElevenLabs-Signature") or request.headers.get("elevenlabs-signature")
    if is_production():
        if not el_secret:
            raise HTTPException(status_code=503, detail="Webhook not configured")
        ok = verify_elevenlabs_signature(raw, el_sig or "", el_secret)
    elif el_secret and el_sig:
        ok = verify_elevenlabs_signature(raw, el_sig, el_secret)
    else:
        ok = _verify_orbit_hmac(raw, request)
    if not ok:
        raise HTTPException(status_code=401, detail="Invalid webhook signature")


def _json_object(payload) -> dict:
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Invalid JSON")
    return payload


async def _cached_tool_result(tool_call_id: str | None):
    if not tool_call_id:
        return None
    doc = await db.inbound_events.find_one(
        {"provider": "elevenlabs_tool", "provider_event_id": tool_call_id},
        {"_id": 0, "result": 1},
    )
    if doc and isinstance(doc.get("result"), dict):
        return doc["result"]
    return None


async def _begin_tool_call(tool_call_id: str | None, tenant_id: str) -> str:
    if not tool_call_id:
        return "new"
    try:
        await db.inbound_events.insert_one({
            "id": gen_id("iev_"),
            "provider": "elevenlabs_tool",
            "provider_event_id": tool_call_id,
            "tenant_id": tenant_id,
            "created_at": now_iso(),
        })
        return "new"
    except DuplicateKeyError:
        return "duplicate"


async def _finish_tool_call(tool_call_id: str | None, result: dict) -> dict:
    if tool_call_id:
        await db.inbound_events.update_one(
            {"provider": "elevenlabs_tool", "provider_event_id": tool_call_id},
            {"$set": {"result": result}},
        )
    return result


@router.post("/elevenlabs/post-call")
async def elevenlabs_post_call(request: Request):
    """HMAC-verified ElevenLabs post-call webhook. Tenant is resolved server-side
    via provider_agent_id only; any tenant field in the payload is ignored.
    Production requires ELEVENLABS_WEBHOOK_SECRET and does not accept the demo HMAC."""
    raw = await request.body()
    _verify_elevenlabs_request(raw, request)
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")
    payload = _json_object(payload)
    data = payload.get("data", payload)
    if not isinstance(data, dict):
        raise HTTPException(status_code=400, detail="Invalid JSON")
    data.pop("tenant_id", None)
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
    _verify_elevenlabs_request(raw, request)

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")
    payload = _json_object(payload)
    payload.pop("tenant_id", None)

    # This route only ever receives ElevenLabs-shaped bodies (the URL path is
    # provider-specific); a future provider gets its own /webhooks/{provider}/
    # route pair using its own adapter's parse_tool_call.
    parsed = get_voice_provider("elevenlabs").parse_tool_call(payload)
    agent_id = parsed.get("agent_id")
    tool_name = parsed.get("tool_name")
    parameters = parsed.get("parameters") or {}
    if parsed.get("conversation_id") and not parameters.get("conversation_id"):
        parameters = {**parameters, "conversation_id": parsed["conversation_id"]}
    tool_call_id = parsed.get("tool_call_id")

    if not agent_id or not tool_name:
        raise HTTPException(status_code=400, detail="agent_id and tool_name are required")

    cached = await _cached_tool_result(tool_call_id)
    if cached is not None:
        return cached

    # Resolve tenant from agent_id — NEVER trust tenant_id from payload (tenant isolation)
    ae = await db.ai_employees.find_one({"provider_agent_id": agent_id}, {"_id": 0})
    if not ae:
        logger.warning("tool-call: unknown or unmapped agent_id=%s", agent_id)
        raise HTTPException(status_code=404, detail="Agent not found")

    # Verify agent is allowed to execute tools (not suspended or in draft)
    if ae.get("lifecycle_state") in ("suspended", "draft"):
        logger.warning("tool-call: rejected call for %s agent_id=%s", ae.get("lifecycle_state"), agent_id)
        return {"status": "unavailable", "message": "This AI employee is currently suspended."}

    tenant_id = ae["tenant_id"]
    event_state = await _begin_tool_call(tool_call_id, tenant_id)
    if event_state == "duplicate":
        cached = await _cached_tool_result(tool_call_id)
        if cached is not None:
            return cached

    # ORBIT owns lead/callback records. Conversational tool execution stays in ElevenLabs.
    if tool_name in ORBIT_LEAD_PERSIST_TOOLS:
        try:
            result = await persist_from_tool_call(tenant_id, tool_name, parameters, payload)
        except Exception:
            logger.exception("tool-call persist failed tenant=%s tool=%s", tenant_id, tool_name)
            result = {"status": "error", "message": "Could not save this enquiry. Please try again."}
        if result.get("status") == "error":
            if tool_call_id:
                await db.inbound_events.delete_one({"provider": "elevenlabs_tool", "provider_event_id": tool_call_id})
            return result
        return await _finish_tool_call(tool_call_id, result)

    # Load tenant's manual business data from DB (scoped strictly to tenant_id)
    live_data_doc = await db.tenant_live_data.find_one({"tenant_id": tenant_id}, {"_id": 0})
    if not live_data_doc:
        logger.info("tool-call: no manual business data configured for tenant=%s, tool=%s", tenant_id, tool_name)
        result = {"status": "unavailable", "message": "Business data not configured. Please configure your business data in ORBIT."}
        return await _finish_tool_call(tool_call_id, result)

    # Check tool is supported by orbit_live connector
    if not connector_supports("orbit_live", tool_name, "read"):
        logger.warning("tool-call: unsupported tool=%s requested for tenant=%s", tool_name, tenant_id)
        result = {"status": "unsupported", "message": f"Tool '{tool_name}' is not supported."}
        return await _finish_tool_call(tool_call_id, result)

    connector = get_orbit_live_connector(live_data_doc)
    try:
        tool_result = connector.read(tool_name, parameters)
        logger.info("tool-call: success tenant=%s tool=%s", tenant_id, tool_name)
        result = {"status": "ok", "data": tool_result.get("result")}
    except Exception:
        logger.exception("tool-call: execution failed tenant=%s tool=%s", tenant_id, tool_name)
        result = {"status": "error", "message": "Could not fetch business data. Please try again."}
        if tool_call_id:
            await db.inbound_events.delete_one({"provider": "elevenlabs_tool", "provider_event_id": tool_call_id})
        return result
    return await _finish_tool_call(tool_call_id, result)


def _verify_exotel_request(raw: bytes, request: Request) -> None:
    if is_production():
        if not exotel_configured():
            raise HTTPException(status_code=503, detail="Webhook not configured")
        secret = os.environ.get("EXOTEL_WEBHOOK_SECRET") or os.environ.get("WEBHOOK_SECRET")
        if not secret:
            raise HTTPException(status_code=503, detail="Webhook not configured")
        header_sig = request.headers.get("X-Orbit-Signature") or request.headers.get("x-orbit-signature") or ""
        expected = hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()
        ok = hmac.compare_digest(expected, header_sig)
        if not ok:
            token = request.query_params.get("token") or ""
            ok = hmac.compare_digest(secret, token) if token else False
        if not ok:
            raise HTTPException(status_code=401, detail="Invalid webhook signature")
        return
    if not _verify_orbit_hmac(raw, request):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")


def _verify_whatsapp_request(raw: bytes, request: Request) -> None:
    if is_production():
        if not meta_whatsapp_configured():
            raise HTTPException(status_code=503, detail="Webhook not configured")
        sig = request.headers.get("X-Hub-Signature-256") or request.headers.get("x-hub-signature-256") or ""
        if not verify_meta_signature(raw, sig, os.environ.get("META_WHATSAPP_APP_SECRET") or ""):
            raise HTTPException(status_code=401, detail="Invalid webhook signature")
        return
    if not _verify_orbit_hmac(raw, request):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")


@router.post("/exotel/inbound")
async def exotel_inbound(request: Request):
    """Inbound telephony mapping. Does not invent a completed conversation."""
    raw = await request.body()
    _verify_exotel_request(raw, request)
    ctype = (request.headers.get("content-type") or "").lower()
    if "json" in ctype:
        try:
            fields = await request.json()
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid JSON")
        if not isinstance(fields, dict):
            raise HTTPException(status_code=400, detail="Invalid JSON")
    else:
        from urllib.parse import parse_qs
        parsed = parse_qs(raw.decode() if raw else "", keep_blank_values=True)
        fields = {k: (v[-1] if v else "") for k, v in parsed.items()}
        if not fields:
            try:
                fields = dict(await request.form())
            except Exception:
                fields = {}
    fields.pop("tenant_id", None)
    return await ingest_exotel_inbound(fields)


@router.get("/whatsapp")
async def whatsapp_verify(request: Request):
    """Meta Cloud API subscription handshake."""
    if not meta_whatsapp_verify_configured():
        raise HTTPException(status_code=503, detail="Webhook not configured")
    mode = request.query_params.get("hub.mode")
    token = request.query_params.get("hub.verify_token")
    challenge = request.query_params.get("hub.challenge")
    if mode == "subscribe" and token == os.environ.get("META_WHATSAPP_VERIFY_TOKEN"):
        return PlainTextResponse(challenge or "")
    raise HTTPException(status_code=403, detail="Forbidden")


@router.post("/whatsapp")
async def whatsapp_inbound(request: Request):
    """Inbound WhatsApp message mapping. Conversational replies stay in ElevenLabs."""
    raw = await request.body()
    _verify_whatsapp_request(raw, request)
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Invalid JSON")
    payload.pop("tenant_id", None)
    return await ingest_whatsapp_inbound(payload)


@intake_router.post("/intake/{intake_key}")
async def public_form_intake(intake_key: str, body: FormIntakeBody, request: Request):
    """Website/form lead intake. Tenant is resolved from the intake key only."""
    data = body.model_dump()
    data.pop("tenant_id", None)
    idem = request.headers.get("Idempotency-Key") or data.get("idempotency_key")
    result = await ingest_form_lead(intake_key, data, idem)
    if result.get("status") == "rejected" and result.get("reason") == "unknown_intake_key":
        raise HTTPException(status_code=404, detail="Intake endpoint not found")
    if result.get("status") == "rejected":
        raise HTTPException(status_code=400, detail="Enquiry is empty")
    return {
        "status": result["status"],
        "lead_id": result.get("lead_id"),
        "conversation_id": result.get("conversation_id"),
    }


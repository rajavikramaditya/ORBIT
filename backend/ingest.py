"""Shared conversation-capture ingest used by both the ElevenLabs webhook and the
simulate-call demo endpoint. Tenant is resolved ONLY via provider_agent_id ->
ai_employee -> tenant_id. Payload-supplied tenant is ignored. Idempotent on
conversation_id.

Provider-specific payload parsing (ElevenLabs' JSON shape today) lives in
voice_providers.py's adapters — this module only consumes the canonical dict
an adapter's parse_post_call() returns, so it stays provider-agnostic."""
import logging
from pymongo.errors import DuplicateKeyError
from db import db
from models import gen_id, now_iso
from voice_providers import get_voice_provider

logger = logging.getLogger("orbit.ingest")


def _clean_str(value) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        text = value.strip()
        return text or None
    return None


async def _resolve_channel(tenant_id: str, ae: dict, meta: dict) -> dict | None:
    """Prefer the channel that matches the provider event type (phone vs WhatsApp)."""
    preferred = None
    if isinstance(meta.get("phone_call"), dict) and meta.get("phone_call"):
        preferred = "phone"
    elif isinstance(meta.get("whatsapp"), dict) and meta.get("whatsapp"):
        preferred = "whatsapp"
    query = {"tenant_id": tenant_id, "assigned_ai_employee_id": ae["id"]}
    if preferred:
        found = await db.channels.find_one({**query, "type": preferred}, {"_id": 0})
        if found:
            return found
    return await db.channels.find_one(query, {"_id": 0})


async def ingest_post_call(data: dict) -> dict:
    if not isinstance(data, dict):
        return {"status": "rejected", "reason": "missing_fields"}
    data = dict(data)
    data.pop("tenant_id", None)

    agent_id = data.get("agent_id")
    conv_id = data.get("conversation_id")
    if not agent_id or not conv_id:
        return {"status": "rejected", "reason": "missing_fields"}

    ae = await db.ai_employees.find_one({"provider_agent_id": agent_id}, {"_id": 0})
    if not ae:
        await db.webhook_quarantine.insert_one({
            "id": gen_id(),
            "agent_id": agent_id,
            "conversation_id": conv_id,
            "reason": "unmapped_agent_id",
            "created_at": now_iso(),
        })
        return {"status": "quarantined", "reason": "unmapped_agent_id"}

    tenant_id = ae["tenant_id"]

    # Provider-specific field extraction happens inside the adapter; ingest
    # only ever sees the canonical shape from here on.
    adapter = get_voice_provider(ae.get("provider"))
    parsed = adapter.parse_post_call(data)
    meta = parsed.get("meta") or {}
    duration = parsed.get("duration_secs") or 0

    channel = await _resolve_channel(tenant_id, ae, meta)

    existing = await db.conversations.find_one({"provider_conversation_id": conv_id}, {"_id": 0})
    if existing:
        from leads import upsert_lead_from_ingest
        try:
            await upsert_lead_from_ingest(tenant_id, existing, data, channel)
        except Exception:
            logger.warning("lead upsert on duplicate ingest failed conv=%s", conv_id, exc_info=True)
        return {"status": "duplicate", "conversation_id": conv_id}

    conv = {
        "id": gen_id("cv_"),
        "tenant_id": tenant_id,
        "ai_employee_id": ae["id"],
        "channel_id": channel["id"] if channel else None,
        "channel_type": (channel or {}).get("type"),
        "provider": ae.get("provider") or "elevenlabs",
        "provider_conversation_id": conv_id,
        "direction": parsed.get("direction") or "inbound",
        "external_number": parsed.get("external_number"),
        "caller_name": _clean_str(parsed.get("caller_name")),
        "status": parsed.get("status") or "done",
        "call_successful": parsed.get("call_successful"),
        "outcome": parsed.get("outcome"),
        "follow_up_required": parsed.get("follow_up_required"),
        "duration_secs": duration,
        "transcript": parsed.get("transcript") or [],
        "summary_title": parsed.get("summary_title") or "Conversation",
        "summary": parsed.get("summary") or "",
        "custom_analysis": parsed.get("custom_analysis") or {},
        "recording_ref": parsed.get("recording_ref"),
        "started_at": now_iso(),
        "created_at": now_iso(),
    }

    try:
        await db.conversations.insert_one(dict(conv))
    except DuplicateKeyError:
        existing = await db.conversations.find_one({"provider_conversation_id": conv_id}, {"_id": 0})
        if existing:
            try:
                from leads import upsert_lead_from_ingest
                await upsert_lead_from_ingest(tenant_id, existing, data, channel)
            except Exception:
                logger.warning("lead upsert on race duplicate failed conv=%s", conv_id, exc_info=True)
        return {"status": "duplicate", "conversation_id": conv_id}

    # Idempotent operational usage ledger event (dedupe on event_id).
    await db.usage_ledger.update_one(
        {"event_id": conv_id},
        {"$setOnInsert": {
            "id": gen_id("ul_"),
            "event_id": conv_id,
            "tenant_id": tenant_id,
            "ai_employee_id": ae["id"],
            "conversation_id": conv["id"],
            "provider_conversation_id": conv_id,
            "type": "ai_voice",
            "quantity_secs": duration,
            "source": "webhook",
            "created_at": now_iso(),
        }},
        upsert=True,
    )
    # Spend protection: soft warning -> hard cap (suspends live agents in production).
    try:
        from billing import enforce_spend_caps
        await enforce_spend_caps(tenant_id)
    except Exception:
        logger.warning("spend cap enforcement failed tenant_id=%s", tenant_id, exc_info=True)
    conv.pop("_id", None)
    try:
        from leads import upsert_lead_from_ingest
        await upsert_lead_from_ingest(tenant_id, conv, data, channel)
    except Exception:
        logger.warning("lead upsert after ingest failed conv=%s", conv_id, exc_info=True)
    return {"status": "ingested", "conversation": conv}

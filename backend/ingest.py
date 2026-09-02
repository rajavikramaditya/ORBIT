"""Shared conversation-capture ingest used by both the ElevenLabs webhook and the
simulate-call demo endpoint. Tenant is resolved ONLY via provider_agent_id ->
ai_employee -> tenant_id. Payload-supplied tenant is ignored. Idempotent on
conversation_id."""
import logging
from pymongo.errors import DuplicateKeyError
from db import db
from models import gen_id, now_iso

logger = logging.getLogger("orbit.ingest")


def _as_int(value, default: int = 0) -> int:
    try:
        if value is None or value == "":
            return default
        return int(float(value))
    except (TypeError, ValueError):
        return default


def _clean_str(value) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        text = value.strip()
        return text or None
    return None


def _eval_flag(eval_criteria: dict, key: str) -> bool:
    val = (eval_criteria or {}).get(key)
    if isinstance(val, dict):
        result = str(val.get("result") or "").lower()
        return result in ("success", "true", "yes")
    if val is True:
        return True
    if isinstance(val, str):
        return val.strip().lower() in ("true", "yes", "1", "success")
    return False


def _recording_ref(data: dict, meta: dict) -> str | None:
    """Store a provider reference only when the payload actually includes one.

    ElevenLabs post-call transcription typically has no permanent audio URL.
    Do not invent a local path — missing recording still creates the conversation.
    """
    candidates = (
        meta.get("recording_url"),
        meta.get("audio_url"),
        meta.get("recording_ref"),
        data.get("recording_url"),
        data.get("audio_url"),
        data.get("recording_ref"),
    )
    for raw in candidates:
        text = _clean_str(raw)
        if text:
            return text
    return None


def _transcript(data: dict) -> list:
    raw = data.get("transcript")
    return raw if isinstance(raw, list) else []


def _derive_outcome(follow_up: bool, call_success, custom_data: dict) -> str | None:
    """Never default to resolved. Only set an outcome when the payload supports it."""
    if follow_up:
        return "follow_up_required"
    if call_success == "failure" or call_success is False:
        return "unresolved"
    if call_success == "success" or call_success is True:
        return "resolved"
    intent = _clean_str((custom_data or {}).get("intent"))
    return intent.lower() if intent else None


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


def _external_number(meta: dict) -> str | None:
    phone = meta.get("phone_call") if isinstance(meta.get("phone_call"), dict) else {}
    wa = meta.get("whatsapp") if isinstance(meta.get("whatsapp"), dict) else {}
    return (
        _clean_str(phone.get("external_number"))
        or _clean_str(wa.get("user_id"))
        or _clean_str(wa.get("from"))
        or _clean_str(wa.get("external_number"))
        or _clean_str(meta.get("user_id"))
    )


def _direction(meta: dict) -> str:
    phone = meta.get("phone_call") if isinstance(meta.get("phone_call"), dict) else {}
    wa = meta.get("whatsapp") if isinstance(meta.get("whatsapp"), dict) else {}
    return phone.get("direction") or wa.get("direction") or "inbound"


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

    meta = data.get("metadata") if isinstance(data.get("metadata"), dict) else {}
    analysis = data.get("analysis") if isinstance(data.get("analysis"), dict) else {}
    duration = _as_int(meta.get("call_duration_secs"), 0)

    channel = await _resolve_channel(tenant_id, ae, meta)

    existing = await db.conversations.find_one({"provider_conversation_id": conv_id}, {"_id": 0})
    if existing:
        from leads import upsert_lead_from_ingest
        try:
            await upsert_lead_from_ingest(tenant_id, existing, data, channel)
        except Exception:
            logger.warning("lead upsert on duplicate ingest failed conv=%s", conv_id, exc_info=True)
        return {"status": "duplicate", "conversation_id": conv_id}

    custom_data = analysis.get("custom_analysis_data") or analysis.get("data_collection_results") or {}
    if not isinstance(custom_data, dict):
        custom_data = {}
    eval_criteria = analysis.get("evaluation_criteria_results") or {}
    if not isinstance(eval_criteria, dict):
        eval_criteria = {}
    follow_up = bool(custom_data.get("follow_up_required")) or _eval_flag(eval_criteria, "follow_up_required")
    if isinstance(custom_data.get("follow_up_required"), str):
        follow_up = custom_data.get("follow_up_required").strip().lower() in ("true", "yes", "1")
    call_success = analysis.get("call_successful")
    outcome = _derive_outcome(follow_up, call_success, custom_data)
    summary = analysis.get("transcript_summary")
    if not isinstance(summary, str):
        summary = ""
    title = analysis.get("call_summary_title")
    if not isinstance(title, str) or not title.strip():
        title = "Conversation"

    conv = {
        "id": gen_id("cv_"),
        "tenant_id": tenant_id,
        "ai_employee_id": ae["id"],
        "channel_id": channel["id"] if channel else None,
        "channel_type": (channel or {}).get("type"),
        "provider": "elevenlabs",
        "provider_conversation_id": conv_id,
        "direction": _direction(meta),
        "external_number": _external_number(meta),
        "caller_name": _clean_str(custom_data.get("caller_name") or analysis.get("caller_name")),
        "status": data.get("status") or "done",
        "call_successful": call_success,
        "outcome": outcome,
        "follow_up_required": follow_up,
        "duration_secs": duration,
        "transcript": _transcript(data),
        "summary_title": title,
        "summary": summary,
        "custom_analysis": custom_data,
        "recording_ref": _recording_ref(data, meta),
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

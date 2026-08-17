"""Shared conversation-capture ingest used by both the ElevenLabs webhook and the
simulate-call demo endpoint. Tenant is resolved ONLY via provider_agent_id ->
ai_employee -> tenant_id. Payload-supplied tenant is ignored. Idempotent on
conversation_id."""
from pymongo.errors import DuplicateKeyError
from db import db
from models import gen_id, now_iso


async def ingest_post_call(data: dict) -> dict:
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

    existing = await db.conversations.find_one({"provider_conversation_id": conv_id}, {"_id": 0})
    if existing:
        return {"status": "duplicate", "conversation_id": conv_id}

    meta = data.get("metadata", {})
    phone = meta.get("phone_call", {})
    analysis = data.get("analysis", {})
    duration = int(meta.get("call_duration_secs", 0))

    channel = await db.channels.find_one(
        {"tenant_id": tenant_id, "assigned_ai_employee_id": ae["id"]}, {"_id": 0}
    )

    conv = {
        "id": gen_id("cv_"),
        "tenant_id": tenant_id,
        "ai_employee_id": ae["id"],
        "channel_id": channel["id"] if channel else None,
        "provider": "elevenlabs",
        "provider_conversation_id": conv_id,
        "direction": phone.get("direction", "inbound"),
        "external_number": phone.get("external_number"),
        "status": data.get("status", "done"),
        "duration_secs": duration,
        "transcript": data.get("transcript", []),
        "summary_title": analysis.get("call_summary_title", "Conversation"),
        "summary": analysis.get("transcript_summary", ""),
        "recording_ref": f"rec/{tenant_id}/{conv_id}.mp3",
        "started_at": now_iso(),
        "created_at": now_iso(),
    }
    try:
        await db.conversations.insert_one(dict(conv))
    except DuplicateKeyError:
        return {"status": "duplicate", "conversation_id": conv_id}

    # Idempotent operational usage ledger event (dedupe on event_id).
    await db.usage_ledger.update_one(
        {"event_id": conv_id},
        {"$setOnInsert": {
            "id": gen_id("ul_"),
            "event_id": conv_id,
            "tenant_id": tenant_id,
            "conversation_id": conv["id"],
            "type": "ai_voice",
            "quantity_secs": duration,
            "source": "webhook",
            "created_at": now_iso(),
        }},
        upsert=True,
    )
    conv.pop("_id", None)
    return {"status": "ingested", "conversation": conv}

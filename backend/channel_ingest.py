"""Inbound channel events → tenant-scoped conversation/lead records.

Phone ringing is mapped only. Conversation + lead for voice still come from
ElevenLabs post-call. WhatsApp/form can persist a lead immediately because the
customer's words are already in the payload.
"""
from pymongo.errors import DuplicateKeyError
from db import db
from models import gen_id, now_iso
from channel_adapters import resolve_channel, resolve_tenant_by_intake_key, normalize_identifier
from leads import upsert_lead_from_ingest, persist_owner_callback, normalize_source


async def _record_event(provider: str, provider_event_id: str, tenant_id: str | None, payload: dict) -> str:
    doc = {
        "id": gen_id("iev_"),
        "provider": provider,
        "provider_event_id": provider_event_id,
        "tenant_id": tenant_id,
        "created_at": now_iso(),
    }
    try:
        await db.inbound_events.insert_one(dict(doc))
        return "ingested"
    except DuplicateKeyError:
        return "duplicate"


def _public_channel(ch: dict | None) -> dict | None:
    if not ch:
        return None
    return {
        "id": ch.get("id"),
        "type": ch.get("type"),
        "tenant_id": ch.get("tenant_id"),
        "assigned_ai_employee_id": ch.get("assigned_ai_employee_id"),
    }


async def ingest_exotel_inbound(fields: dict) -> dict:
    """Map an inbound Exotel call to a tenant. Does not fabricate call success."""
    call_sid = (fields.get("CallSid") or fields.get("call_sid") or fields.get("Sid") or "").strip()
    called = fields.get("CallTo") or fields.get("To") or fields.get("called_number")
    caller = fields.get("CallFrom") or fields.get("From") or fields.get("caller_number")
    if not call_sid:
        return {"status": "rejected", "reason": "missing_call_sid"}

    # Ignore any client-supplied tenant_id.
    fields.pop("tenant_id", None)
    channel = await resolve_channel(channel_type="phone", identifier=str(called or ""))
    if not channel:
        await _record_event("exotel", call_sid, None, fields)
        await db.webhook_quarantine.insert_one({
            "id": gen_id(),
            "agent_id": None,
            "conversation_id": call_sid,
            "reason": "unmapped_phone_number",
            "created_at": now_iso(),
        })
        return {"status": "quarantined", "reason": "unmapped_phone_number"}

    event_status = await _record_event("exotel", call_sid, channel["tenant_id"], fields)
    if event_status == "duplicate":
        return {
            "status": "duplicate",
            "tenant_id": channel["tenant_id"],
            "channel": _public_channel(channel),
            "conversation_created": False,
            "live": False,
        }
    return {
        "status": "mapped",
        "tenant_id": channel["tenant_id"],
        "channel": _public_channel(channel),
        "caller": caller,
        "called": called,
        "conversation_created": False,
        "live": False,
        "message": "Inbound call mapped. Conversation and lead are created from the ElevenLabs post-call webhook, not from this ringing event.",
    }


def _whatsapp_messages(payload: dict) -> list[dict]:
    out = []
    for entry in payload.get("entry") or []:
        for change in entry.get("changes") or []:
            value = change.get("value") or {}
            meta = value.get("metadata") or {}
            for msg in value.get("messages") or []:
                text = None
                if isinstance(msg.get("text"), dict):
                    text = msg["text"].get("body")
                elif msg.get("type") == "button":
                    text = (msg.get("button") or {}).get("text") or (msg.get("button") or {}).get("payload")
                out.append({
                    "wamid": msg.get("id"),
                    "from_number": msg.get("from"),
                    "text": text,
                    "phone_number_id": meta.get("phone_number_id"),
                    "display_phone_number": meta.get("display_phone_number"),
                    "button_payload": ((msg.get("button") or {}).get("payload") if isinstance(msg.get("button"), dict) else None),
                })
    # Dev/test compact shape
    if not out and payload.get("wamid"):
        out.append({
            "wamid": payload.get("wamid"),
            "from_number": payload.get("from") or payload.get("customer_phone"),
            "text": payload.get("text") or payload.get("message"),
            "phone_number_id": payload.get("phone_number_id"),
            "display_phone_number": payload.get("to") or payload.get("display_phone_number"),
            "button_payload": payload.get("button_payload"),
        })
    return out


async def ingest_whatsapp_inbound(payload: dict) -> dict:
    payload = dict(payload or {})
    payload.pop("tenant_id", None)
    messages = _whatsapp_messages(payload)
    if not messages:
        return {"status": "rejected", "reason": "no_messages"}

    results = []
    for msg in messages:
        wamid = (msg.get("wamid") or "").strip()
        if not wamid:
            results.append({"status": "rejected", "reason": "missing_wamid"})
            continue
        channel = await resolve_channel(
            channel_type="whatsapp",
            identifier=msg.get("display_phone_number"),
            phone_number_id=msg.get("phone_number_id"),
        )
        if not channel:
            await _record_event("whatsapp", wamid, None, msg)
            await db.webhook_quarantine.insert_one({
                "id": gen_id(),
                "agent_id": None,
                "conversation_id": wamid,
                "reason": "unmapped_whatsapp_number",
                "created_at": now_iso(),
            })
            results.append({"status": "quarantined", "reason": "unmapped_whatsapp_number", "wamid": wamid})
            continue

        tenant_id = channel["tenant_id"]
        event_status = await _record_event("whatsapp", wamid, tenant_id, msg)
        thread_key = f"wa:{channel['id']}:{normalize_identifier(msg.get('from_number')) or 'unknown'}"
        ae = None
        if channel.get("assigned_ai_employee_id"):
            ae = await db.ai_employees.find_one({"id": channel["assigned_ai_employee_id"]}, {"_id": 0})

        existing = await db.conversations.find_one(
            {"tenant_id": tenant_id, "provider_conversation_id": thread_key},
            {"_id": 0},
        )
        if event_status == "duplicate":
            results.append({
                "status": "duplicate",
                "tenant_id": tenant_id,
                "conversation_id": (existing or {}).get("id"),
                "wamid": wamid,
            })
            continue

        text = (msg.get("text") or "").strip() or None
        now = now_iso()
        if existing:
            conv = existing
            if text:
                await db.conversations.update_one(
                    {"id": existing["id"], "tenant_id": tenant_id},
                    {"$set": {"updated_at": now, "summary": text},
                     "$push": {"transcript": {"role": "user", "message": text}}},
                )
                conv = await db.conversations.find_one({"id": existing["id"]}, {"_id": 0})
        else:
            conv = {
                "id": gen_id("cv_"),
                "tenant_id": tenant_id,
                "ai_employee_id": (ae or {}).get("id"),
                "channel_id": channel["id"],
                "channel_type": "whatsapp",
                "provider": "whatsapp",
                "provider_conversation_id": thread_key,
                "direction": "inbound",
                "external_number": msg.get("from_number"),
                "status": "open",
                "outcome": "follow_up_required" if text else "open",
                "follow_up_required": True,
                "duration_secs": 0,
                "transcript": [{"role": "user", "message": text}] if text else [],
                "summary_title": "WhatsApp enquiry",
                "summary": text or "",
                "created_at": now,
                "updated_at": now,
            }
            try:
                await db.conversations.insert_one(dict(conv))
            except DuplicateKeyError:
                conv = await db.conversations.find_one(
                    {"tenant_id": tenant_id, "provider_conversation_id": thread_key},
                    {"_id": 0},
                )
            conv.pop("_id", None)

        fake_payload = {
            "conversation_id": thread_key,
            "analysis": {
                "transcript_summary": text,
                "custom_analysis_data": {
                    "phone": msg.get("from_number"),
                    "enquiry": text,
                    "source": "whatsapp",
                    "follow_up_required": True,
                    "owner_callback_requested": (msg.get("button_payload") or "").upper() == "OWNER_CALLBACK",
                    "is_enquiry": True,
                },
            },
        }
        lead = await upsert_lead_from_ingest(tenant_id, conv, fake_payload, channel)
        if fake_payload["analysis"]["custom_analysis_data"]["owner_callback_requested"] and lead:
            await persist_owner_callback(
                tenant_id,
                lead_id=lead.get("id"),
                conversation_id=conv.get("id"),
                customer_phone=msg.get("from_number"),
                reason=text,
            )
        results.append({
            "status": "ingested",
            "tenant_id": tenant_id,
            "conversation_id": conv.get("id"),
            "lead_id": (lead or {}).get("id"),
            "wamid": wamid,
        })
    if len(results) == 1:
        return results[0]
    return {"status": "ok", "results": results}


async def ingest_form_lead(intake_key: str, body: dict, idempotency_key: str | None) -> dict:
    body = dict(body or {})
    body.pop("tenant_id", None)
    tenant = await resolve_tenant_by_intake_key(intake_key)
    if not tenant:
        return {"status": "rejected", "reason": "unknown_intake_key"}
    tenant_id = tenant["id"]
    key = (idempotency_key or body.get("idempotency_key") or "").strip() or None
    if key:
        existing_lead = await db.leads.find_one(
            {"tenant_id": tenant_id, "intake_idempotency_key": key},
            {"_id": 0},
        )
        if existing_lead:
            return {"status": "duplicate", "lead_id": existing_lead["id"], "tenant_id": tenant_id}

    source = normalize_source(body.get("source")) or "form"
    if source not in ("website", "form", "instagram", "facebook", "unknown"):
        source = "form"
    name = (body.get("customer_name") or body.get("name") or "").strip() or None
    phone = (body.get("phone") or body.get("customer_phone") or "").strip() or None
    email = (body.get("email") or body.get("customer_email") or "").strip() or None
    requirement = (body.get("requirement") or body.get("message") or body.get("enquiry") or "").strip() or None
    if not (name or phone or email or requirement):
        return {"status": "rejected", "reason": "empty_enquiry"}

    provider_conv_id = f"form:{key}" if key else f"form:{gen_id('')}"
    existing_conv = await db.conversations.find_one(
        {"tenant_id": tenant_id, "provider_conversation_id": provider_conv_id},
        {"_id": 0},
    )
    now = now_iso()
    if existing_conv:
        conv = existing_conv
    else:
        conv = {
            "id": gen_id("cv_"),
            "tenant_id": tenant_id,
            "channel_type": source,
            "provider": "orbit_intake",
            "provider_conversation_id": provider_conv_id,
            "direction": "inbound",
            "external_number": phone,
            "caller_name": name,
            "status": "done",
            "outcome": "follow_up_required",
            "follow_up_required": True,
            "duration_secs": 0,
            "transcript": [{"role": "user", "message": requirement}] if requirement else [],
            "summary_title": "Website enquiry",
            "summary": requirement or "",
            "created_at": now,
            "updated_at": now,
        }
        try:
            await db.conversations.insert_one(dict(conv))
        except DuplicateKeyError:
            conv = await db.conversations.find_one(
                {"tenant_id": tenant_id, "provider_conversation_id": provider_conv_id},
                {"_id": 0},
            )
        conv.pop("_id", None)

    fake_payload = {
        "conversation_id": provider_conv_id,
        "analysis": {
            "transcript_summary": requirement,
            "custom_analysis_data": {
                "caller_name": name,
                "phone": phone,
                "email": email,
                "enquiry": requirement,
                "source": source,
                "follow_up_required": True,
                "owner_callback_requested": bool(body.get("owner_callback_requested")),
                "is_enquiry": True,
            },
        },
    }
    lead = await upsert_lead_from_ingest(tenant_id, conv, fake_payload, None)
    if lead and key:
        await db.leads.update_one(
            {"id": lead["id"], "tenant_id": tenant_id},
            {"$set": {"intake_idempotency_key": key}},
        )
    if lead and body.get("owner_callback_requested"):
        await persist_owner_callback(
            tenant_id,
            lead_id=lead.get("id"),
            conversation_id=conv.get("id"),
            customer_name=name,
            customer_phone=phone,
            reason=requirement,
        )
    return {
        "status": "ingested" if lead else "skipped",
        "lead_id": (lead or {}).get("id"),
        "conversation_id": conv.get("id"),
        "tenant_id": tenant_id,
    }

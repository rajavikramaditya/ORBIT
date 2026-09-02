"""Inbound enquiry/lead persistence.

ORBIT stores the business record. ElevenLabs owns conversational execution;
this module only persists what post-call (or an explicit persist tool) actually
provided. Missing fields stay None — never invented.
"""
from pymongo.errors import DuplicateKeyError
from db import db
from models import (
    gen_id, now_iso,
    LEAD_SOURCES, LEAD_STATUSES, QUALIFICATION_STATUSES, CALLBACK_STATUSES,
    LEAD_TRANSITIONS, LEAD_STATUS_ALIASES, INTENT_LEVELS, URGENCY_LEVELS,
)

# Never returned to tenant/admin API consumers.
_INTERNAL_LEAD_FIELDS = {"_id", "provider_conversation_id", "provider_agent_id"}


def normalize_lead_status(value: str | None) -> str | None:
    if not value:
        return None
    key = value.strip().lower().replace(" ", "_")
    key = LEAD_STATUS_ALIASES.get(key, key)
    return key if key in LEAD_STATUSES else None


def normalize_source(value: str | None) -> str | None:
    if not value:
        return None
    key = value.strip().lower().replace(" ", "_")
    key = LEAD_STATUS_ALIASES.get(key, key)
    aliases = {
        "call": "phone", "voice": "phone", "inbound_call": "phone",
        "wa": "whatsapp", "whatsapp_business": "whatsapp",
        "web": "website", "landing": "website",
        "webform": "form", "contact_form": "form",
        "ig": "instagram", "insta": "instagram",
        "fb": "facebook", "meta": "facebook",
        "ads": "unknown", "social": "unknown", "other": "unknown",
    }
    key = aliases.get(key, key)
    return key if key in LEAD_SOURCES else None


def public_lead(doc: dict | None) -> dict | None:
    if not doc:
        return None
    out = {k: v for k, v in dict(doc).items() if k not in _INTERNAL_LEAD_FIELDS}
    status = normalize_lead_status(out.get("lead_status"))
    if status:
        out["lead_status"] = status
    source = normalize_source(out.get("source")) or "unknown"
    out["source"] = source
    # Owner-facing aliases — stored fields stay canonical.
    out["requirement"] = out.get("enquiry_summary")
    out["service_requested"] = out.get("service_category")
    out["product_or_service"] = out.get("service_category")
    out["caller_name"] = out.get("customer_name")
    out["phone"] = out.get("customer_phone")
    out["email"] = out.get("customer_email")
    out["whatsapp"] = out.get("customer_whatsapp")
    out["budget"] = out.get("budget_value")
    follow_at = out.get("follow_up_at")
    due = False
    if out.get("follow_up_required"):
        if not follow_at:
            due = True
        else:
            due = str(follow_at) <= now_iso()
    out["follow_up_due"] = due
    return out


def compute_lead_score(fields: dict) -> int | None:
    """Transparent points only when contact + requirement exist. Otherwise null."""
    has_contact = bool(
        fields.get("customer_name") or fields.get("customer_phone")
        or fields.get("customer_email") or fields.get("customer_whatsapp")
    )
    has_need = bool(fields.get("enquiry_summary") or fields.get("service_category"))
    if not (has_contact and has_need):
        return None
    score = 40
    if fields.get("service_category"):
        score += 10
    if fields.get("budget_value") not in (None, ""):
        score += 15
    if fields.get("location") or fields.get("timeline"):
        score += 5
    if fields.get("qualification_status") == "qualified":
        score += 20
    if fields.get("buying_intent") == "high":
        score += 10
    elif fields.get("buying_intent") == "medium":
        score += 5
    if fields.get("urgency") == "high":
        score += 10
    if fields.get("owner_callback_requested"):
        score += 5
    return min(100, score)


def can_transition(current: str | None, target: str) -> bool:
    cur = normalize_lead_status(current) or "new"
    tgt = normalize_lead_status(target)
    if not tgt:
        return False
    if cur == tgt:
        return True
    return tgt in LEAD_TRANSITIONS.get(cur, set())


def _clean_str(value) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        text = value.strip()
        return text or None
    text = str(value).strip()
    return text or None


def _as_bool(value) -> bool:
    if value is True:
        return True
    if value is False or value is None:
        return False
    if isinstance(value, str):
        return value.strip().lower() in ("true", "yes", "1")
    if isinstance(value, dict):
        result = str(value.get("result") or "").lower()
        return result in ("success", "true", "yes")
    if isinstance(value, (int, float)) and value in (0, 1):
        return bool(value)
    return False


def _custom(data: dict) -> dict:
    analysis = data.get("analysis") or {}
    custom = analysis.get("custom_analysis_data") or analysis.get("data_collection_results") or {}
    return custom if isinstance(custom, dict) else {}


def classify_source(data: dict, channel: dict | None = None) -> str:
    custom = _custom(data)
    raw = _clean_str(custom.get("source") or custom.get("channel") or custom.get("enquiry_source"))
    if raw:
        return normalize_source(raw) or "unknown"
    ch_type = (channel or {}).get("type")
    if ch_type in ("phone", "whatsapp"):
        return ch_type
    if (data.get("metadata") or {}).get("phone_call"):
        return "phone"
    return "unknown"


def _level(value, allowed: set) -> str | None:
    raw = _clean_str(value)
    if not raw:
        return None
    key = raw.lower().replace(" ", "_")
    return key if key in allowed else None


def extract_lead_fields(data: dict, conv: dict, channel: dict | None = None) -> dict:
    """Map post-call payload + stored conversation to lead fields. No hallucination."""
    analysis = data.get("analysis") or {}
    custom = _custom(data)
    meta = data.get("metadata") or {}
    phone_meta = meta.get("phone_call") or {}

    name = _clean_str(
        custom.get("customer_name") or custom.get("caller_name")
        or analysis.get("caller_name") or conv.get("caller_name")
    )
    phone = _clean_str(
        custom.get("customer_phone") or custom.get("phone")
        or phone_meta.get("external_number") or conv.get("external_number")
    )
    email = _clean_str(custom.get("customer_email") or custom.get("email"))
    summary = _clean_str(
        custom.get("enquiry") or custom.get("requirement") or custom.get("enquiry_summary")
        or analysis.get("transcript_summary") or conv.get("summary")
    )
    service = _clean_str(
        custom.get("service") or custom.get("category") or custom.get("service_category")
        or custom.get("service_requested") or custom.get("product_or_service")
    )
    budget = custom.get("budget")
    if budget is None:
        budget = custom.get("budget_value")
    if isinstance(budget, str):
        budget = _clean_str(budget)
    location = _clean_str(custom.get("location") or custom.get("city") or custom.get("area"))
    timeline = _clean_str(custom.get("timeline") or custom.get("when") or custom.get("timeframe"))
    whatsapp = _clean_str(custom.get("whatsapp") or custom.get("whatsapp_number") or custom.get("customer_whatsapp"))
    buying_intent = _level(custom.get("buying_intent") or custom.get("intent_level"), INTENT_LEVELS)
    urgency = _level(custom.get("urgency"), URGENCY_LEVELS)

    qual_raw = _clean_str(custom.get("qualification_status") or custom.get("qualification"))
    qualification = qual_raw.lower().replace(" ", "_") if qual_raw else "unknown"
    if qualification not in QUALIFICATION_STATUSES:
        qualification = "unknown"

    status_raw = _clean_str(custom.get("lead_status") or custom.get("status"))
    lead_status = status_raw.lower().replace(" ", "_") if status_raw else None
    if lead_status not in LEAD_STATUSES:
        lead_status = None

    eval_criteria = analysis.get("evaluation_criteria_results") or {}
    follow_up = _as_bool(
        custom.get("follow_up_required") or eval_criteria.get("follow_up_required")
        or conv.get("follow_up_required")
    )
    callback = _as_bool(
        custom.get("owner_callback_requested") or custom.get("request_owner_callback")
        or custom.get("callback_requested")
    )
    notes = _clean_str(custom.get("notes") or custom.get("note"))

    if lead_status is None:
        if follow_up:
            lead_status = "follow_up"
        elif qualification == "unqualified":
            lead_status = "unqualified"
        elif qualification == "qualified":
            lead_status = "qualified"
        else:
            lead_status = "new"

    explicit_enquiry = custom.get("is_enquiry")
    if isinstance(explicit_enquiry, str):
        if explicit_enquiry.strip().lower() in ("false", "no", "0"):
            explicit_enquiry = False
        elif explicit_enquiry.strip().lower() in ("true", "yes", "1"):
            explicit_enquiry = True

    return {
        "source": classify_source(data, channel),
        "customer_name": name,
        "customer_phone": phone,
        "customer_email": email,
        "enquiry_summary": summary,
        "service_category": service,
        "budget_value": budget,
        "location": location,
        "timeline": timeline,
        "customer_whatsapp": whatsapp,
        "buying_intent": buying_intent,
        "urgency": urgency,
        "qualification_status": qualification,
        "lead_status": lead_status,
        "follow_up_required": follow_up,
        "owner_callback_requested": callback,
        "owner_callback_status": "requested" if callback else None,
        "notes": notes,
        "is_enquiry": explicit_enquiry,
        "callback_reason": _clean_str(custom.get("callback_reason") or custom.get("reason") or summary),
    }


def is_meaningful_enquiry(fields: dict) -> bool:
    if fields.get("is_enquiry") is False:
        return False
    has_contact = bool(
        fields.get("customer_name") or fields.get("customer_phone")
        or fields.get("customer_email") or fields.get("customer_whatsapp")
    )
    has_need = bool(
        fields.get("enquiry_summary")
        or fields.get("service_category")
        or fields.get("follow_up_required")
        or fields.get("owner_callback_requested")
        or fields.get("qualification_status") not in (None, "unknown")
    )
    return has_contact or has_need


def _fill_empty_updates(existing: dict, fields: dict) -> dict:
    """Retry-safe merge: fill blanks only. Never overwrite owner-set status with 'new'."""
    updates = {}
    for key in (
        "source", "customer_name", "customer_phone", "customer_email", "customer_whatsapp",
        "enquiry_summary", "service_category", "budget_value", "location", "timeline",
        "notes", "qualification_status", "buying_intent", "urgency",
    ):
        incoming = fields.get(key)
        if incoming in (None, ""):
            continue
        current = existing.get(key)
        if current in (None, ""):
            updates[key] = incoming
        elif key == "qualification_status" and current == "unknown" and incoming != "unknown":
            updates[key] = incoming
    if fields.get("follow_up_required") and not existing.get("follow_up_required"):
        updates["follow_up_required"] = True
    if fields.get("owner_callback_requested"):
        if not existing.get("owner_callback_requested"):
            updates["owner_callback_requested"] = True
        if not existing.get("owner_callback_status"):
            updates["owner_callback_status"] = "requested"
        if not existing.get("owner_callback_requested_at"):
            updates["owner_callback_requested_at"] = now_iso()
    incoming_status = normalize_lead_status(fields.get("lead_status"))
    current_status = normalize_lead_status(existing.get("lead_status")) or "new"
    if incoming_status and current_status == "new" and incoming_status != "new" and can_transition(current_status, incoming_status):
        updates["lead_status"] = incoming_status
    score = compute_lead_score({**existing, **fields, **updates})
    if score is not None and existing.get("lead_score") is None:
        updates["lead_score"] = score
    return updates


async def persist_owner_callback(
    tenant_id: str,
    *,
    lead_id: str | None = None,
    conversation_id: str | None = None,
    customer_name: str | None = None,
    customer_phone: str | None = None,
    reason: str | None = None,
) -> dict | None:
    """Record that the owner should contact this customer. No outbound calling."""
    query = {"tenant_id": tenant_id}
    if conversation_id:
        query["conversation_id"] = conversation_id
    elif lead_id:
        query["lead_id"] = lead_id
    else:
        query = None

    if query and len(query) > 1:
        existing = await db.owner_callback_requests.find_one(query, {"_id": 0})
        if existing:
            return existing

    doc = {
        "id": gen_id("cb_"),
        "tenant_id": tenant_id,
        "customer_name": customer_name,
        "customer_phone": customer_phone,
        "reason": reason,
        "status": "requested",
        "requested_at": now_iso(),
        "updated_at": now_iso(),
    }
    if lead_id:
        doc["lead_id"] = lead_id
    if conversation_id:
        doc["conversation_id"] = conversation_id
    try:
        await db.owner_callback_requests.insert_one(dict(doc))
    except DuplicateKeyError:
        existing = await db.owner_callback_requests.find_one(
            {"tenant_id": tenant_id, "conversation_id": conversation_id} if conversation_id else {"id": doc["id"]},
            {"_id": 0},
        )
        return existing
    doc.pop("_id", None)
    if lead_id:
        await db.leads.update_one(
            {"id": lead_id, "tenant_id": tenant_id},
            {"$set": {
                "owner_callback_requested": True,
                "owner_callback_status": "requested",
                "owner_callback_requested_at": doc["requested_at"],
                "updated_at": now_iso(),
            }},
        )
    return doc


async def upsert_lead_from_ingest(tenant_id: str, conv: dict, data: dict, channel: dict | None = None) -> dict | None:
    fields = extract_lead_fields(data, conv, channel)
    if not is_meaningful_enquiry(fields):
        return None

    provider_conv_id = data.get("conversation_id") or conv.get("provider_conversation_id")
    existing = None
    if conv.get("id"):
        existing = await db.leads.find_one({"conversation_id": conv["id"], "tenant_id": tenant_id}, {"_id": 0})
    if not existing and provider_conv_id:
        existing = await db.leads.find_one(
            {"tenant_id": tenant_id, "provider_conversation_id": provider_conv_id}, {"_id": 0}
        )

    now = now_iso()
    if existing:
        updates = _fill_empty_updates(existing, fields)
        if conv.get("id") and not existing.get("conversation_id"):
            updates["conversation_id"] = conv["id"]
        if updates:
            updates["updated_at"] = now
            await db.leads.update_one({"id": existing["id"], "tenant_id": tenant_id}, {"$set": updates})
            existing = await db.leads.find_one({"id": existing["id"]}, {"_id": 0})
        if fields.get("owner_callback_requested"):
            await persist_owner_callback(
                tenant_id,
                lead_id=existing["id"],
                conversation_id=conv.get("id"),
                customer_name=existing.get("customer_name") or fields.get("customer_name"),
                customer_phone=existing.get("customer_phone") or fields.get("customer_phone"),
                reason=fields.get("callback_reason"),
            )
        return existing

    lead = {
        "id": gen_id("ld_"),
        "tenant_id": tenant_id,
        "source": fields["source"],
        "customer_name": fields["customer_name"],
        "customer_phone": fields["customer_phone"],
        "customer_email": fields["customer_email"],
        "enquiry_summary": fields["enquiry_summary"],
        "service_category": fields["service_category"],
        "budget_value": fields["budget_value"],
        "qualification_status": fields["qualification_status"],
        "lead_status": fields["lead_status"],
        "follow_up_required": fields["follow_up_required"],
        "follow_up_at": None,
        "owner_callback_requested": fields["owner_callback_requested"],
        "owner_callback_status": "requested" if fields["owner_callback_requested"] else None,
        "owner_callback_requested_at": now if fields["owner_callback_requested"] else None,
        "notes": fields["notes"],
        "location": fields.get("location"),
        "timeline": fields.get("timeline"),
        "customer_whatsapp": fields.get("customer_whatsapp"),
        "buying_intent": fields.get("buying_intent"),
        "urgency": fields.get("urgency"),
        "outcome": None,
        "won_at": None,
        "lost_at": None,
        "lost_reason": None,
        "lead_score": compute_lead_score(fields),
        "created_at": now,
        "updated_at": now,
    }
    if conv.get("id"):
        lead["conversation_id"] = conv["id"]
    if provider_conv_id:
        lead["provider_conversation_id"] = provider_conv_id
    try:
        await db.leads.insert_one(dict(lead))
    except DuplicateKeyError:
        query = None
        if conv.get("id"):
            query = {"tenant_id": tenant_id, "conversation_id": conv["id"]}
        elif provider_conv_id:
            query = {"tenant_id": tenant_id, "provider_conversation_id": provider_conv_id}
        existing = await db.leads.find_one(query, {"_id": 0}) if query else None
        if existing:
            return existing
        raise
    lead.pop("_id", None)
    if fields.get("owner_callback_requested"):
        await persist_owner_callback(
            tenant_id,
            lead_id=lead["id"],
            conversation_id=conv.get("id"),
            customer_name=fields.get("customer_name"),
            customer_phone=fields.get("customer_phone"),
            reason=fields.get("callback_reason"),
        )
    return lead


async def persist_from_tool_call(tenant_id: str, tool_name: str, parameters: dict, payload: dict | None = None) -> dict:
    """ORBIT-owned persistence when ElevenLabs invokes capture/qualify/callback tools.

    Conversational behaviour stays in ElevenLabs; we only store the business record.
    """
    parameters = parameters or {}
    payload = payload or {}
    analysis_custom = {
        "customer_name": parameters.get("customer_name") or parameters.get("caller_name"),
        "customer_phone": parameters.get("customer_phone") or parameters.get("phone"),
        "customer_email": parameters.get("customer_email") or parameters.get("email"),
        "enquiry": parameters.get("enquiry") or parameters.get("requirement") or parameters.get("summary"),
        "service": parameters.get("service") or parameters.get("category"),
        "budget": parameters.get("budget"),
        "qualification_status": parameters.get("qualification_status") or parameters.get("qualification"),
        "lead_status": parameters.get("lead_status"),
        "follow_up_required": parameters.get("follow_up_required"),
        "owner_callback_requested": tool_name == "request_owner_callback" or parameters.get("owner_callback_requested"),
        "notes": parameters.get("notes"),
        "source": parameters.get("source"),
        "callback_reason": parameters.get("reason") or parameters.get("callback_reason"),
        "location": parameters.get("location"),
        "timeline": parameters.get("timeline"),
        "whatsapp": parameters.get("whatsapp"),
        "buying_intent": parameters.get("buying_intent"),
        "urgency": parameters.get("urgency"),
        "is_enquiry": True,
    }
    nested = payload.get("data") if isinstance(payload.get("data"), dict) else {}
    provider_conv = _clean_str(
        parameters.get("conversation_id")
        or payload.get("conversation_id")
        or nested.get("conversation_id")
    )
    if provider_conv and not parameters.get("conversation_id"):
        parameters = {**parameters, "conversation_id": provider_conv}
    fake_payload = {"analysis": {"custom_analysis_data": analysis_custom}, "conversation_id": provider_conv}
    conv = {}
    if provider_conv:
        conv = await db.conversations.find_one(
            {"tenant_id": tenant_id, "provider_conversation_id": provider_conv},
            {"_id": 0},
        ) or {"provider_conversation_id": provider_conv}
        fake_payload["conversation_id"] = provider_conv
    channel = None
    if conv.get("channel_id"):
        channel = await db.channels.find_one({"id": conv["channel_id"], "tenant_id": tenant_id}, {"_id": 0})
    if tool_name == "qualify_lead" and not analysis_custom.get("qualification_status"):
        analysis_custom["qualification_status"] = "qualified"
        fake_payload["analysis"]["custom_analysis_data"] = analysis_custom
    lead = await upsert_lead_from_ingest(tenant_id, conv, fake_payload, channel)
    if tool_name == "request_owner_callback" and lead:
        await persist_owner_callback(
            tenant_id,
            lead_id=lead.get("id"),
            conversation_id=lead.get("conversation_id") or conv.get("id"),
            customer_name=lead.get("customer_name"),
            customer_phone=lead.get("customer_phone"),
            reason=analysis_custom.get("callback_reason"),
        )
    return {"status": "ok", "persisted": bool(lead), "lead_id": (lead or {}).get("id")}


def owner_patch_updates(lead: dict, body) -> dict:
    """Build validated owner updates. Raises ValueError on illegal status."""
    updates = {}
    if body.lead_status is not None:
        target = normalize_lead_status(body.lead_status)
        if not target:
            raise ValueError("Invalid lead status")
        if not can_transition(lead.get("lead_status"), target):
            raise ValueError(
                f"Cannot move from {normalize_lead_status(lead.get('lead_status')) or 'new'} to {target}"
            )
        updates["lead_status"] = target
        if target == "won":
            updates["outcome"] = "won"
            updates["won_at"] = now_iso()
        elif target == "lost":
            updates["outcome"] = "lost"
            updates["lost_at"] = now_iso()
        elif target == "qualified":
            updates["qualification_status"] = "qualified"
        elif target == "unqualified":
            updates["qualification_status"] = "unqualified"
        elif target == "follow_up":
            updates["follow_up_required"] = True
    if body.qualification_status is not None:
        if body.qualification_status not in QUALIFICATION_STATUSES:
            raise ValueError("Invalid qualification status")
        updates["qualification_status"] = body.qualification_status
    if body.follow_up_required is not None:
        updates["follow_up_required"] = body.follow_up_required
    if body.follow_up_at is not None:
        at = _clean_str(body.follow_up_at)
        updates["follow_up_at"] = at
        if at:
            updates["follow_up_required"] = True
    if body.notes is not None:
        updates["notes"] = body.notes
    if body.lost_reason is not None:
        updates["lost_reason"] = _clean_str(body.lost_reason)
    return updates

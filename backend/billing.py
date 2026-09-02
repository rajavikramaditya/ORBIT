"""Minimum real usage-based billing: idempotent ledger -> usage -> tenant pricing
-> invoice (immutable once issued) -> Razorpay (guarded). Plus spend protection
(soft warning -> hard cap). No hard-coded pricing model; rates are admin-configured.
Demo tenants are NEVER charged real money."""
from datetime import datetime, timezone
from db import db
from models import gen_id, now_iso

DEFAULT_PRICING = {
    "currency": "INR",
    "ai_voice_per_min": 8.0,
    "telephony_per_min": 1.2,
    "whatsapp_per_message": 0.5,
    "orbit_markup_pct": 15.0,
    "service_charge": 999.0,
    "gst_pct": 18.0,
    "warning_threshold": 8000.0,
    "hard_cap": 15000.0,
}


def current_period() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m")


async def get_pricing(tenant_id: str) -> dict:
    p = await db.tenant_pricing.find_one({"tenant_id": tenant_id}, {"_id": 0})
    if not p:
        p = {"tenant_id": tenant_id, **DEFAULT_PRICING, "updated_at": now_iso()}
        await db.tenant_pricing.insert_one(dict(p))
        p.pop("_id", None)
    return p


async def compute_usage(tenant_id: str, period: str) -> dict:
    ai_secs = 0
    async for e in db.usage_ledger.find(
        {"tenant_id": tenant_id, "type": "ai_voice", "created_at": {"$regex": f"^{period}"}},
        {"quantity_secs": 1},
    ):
        ai_secs += e.get("quantity_secs", 0) or 0
    ai_minutes = round(ai_secs / 60.0, 2)
    # Each AI voice call also consumes telephony minutes (Exotel). WhatsApp usage
    # is counted from whatsapp conversations when that channel is live.
    telephony_minutes = ai_minutes
    whatsapp_messages = await db.conversations.count_documents(
        {"tenant_id": tenant_id, "channel_type": "whatsapp", "created_at": {"$regex": f"^{period}"}}
    )
    return {"ai_minutes": ai_minutes, "telephony_minutes": telephony_minutes, "whatsapp_messages": whatsapp_messages}


def build_invoice_doc(tenant_id: str, period: str, pricing: dict, usage: dict, is_demo: bool) -> dict:
    ai_amt = round(usage["ai_minutes"] * pricing["ai_voice_per_min"], 2)
    tel_amt = round(usage["telephony_minutes"] * pricing["telephony_per_min"], 2)
    wa_amt = round(usage["whatsapp_messages"] * pricing["whatsapp_per_message"], 2)
    usage_subtotal = round(ai_amt + tel_amt + wa_amt, 2)
    markup_amt = round(usage_subtotal * pricing["orbit_markup_pct"] / 100.0, 2)
    service = round(pricing["service_charge"], 2)
    # Customer-facing: markup + service charge are combined into one "Platform & service fee"
    # so ORBIT's internal margin is never exposed to the customer.
    platform_fee = round(markup_amt + service, 2)
    subtotal = round(usage_subtotal + platform_fee, 2)
    tax = round(subtotal * pricing["gst_pct"] / 100.0, 2)
    total = round(subtotal + tax, 2)
    line_items = [
        {"label": "AI voice usage", "qty": usage["ai_minutes"], "unit": "min", "rate": pricing["ai_voice_per_min"], "amount": ai_amt},
        {"label": "Phone usage", "qty": usage["telephony_minutes"], "unit": "min", "rate": pricing["telephony_per_min"], "amount": tel_amt},
        {"label": "WhatsApp", "qty": usage["whatsapp_messages"], "unit": "msg", "rate": pricing["whatsapp_per_message"], "amount": wa_amt},
        {"label": "Platform & service fee", "qty": 1, "unit": "", "rate": platform_fee, "amount": platform_fee},
    ]
    return {
        "id": gen_id("inv_"),
        "tenant_id": tenant_id,
        "period": period,
        "currency": pricing["currency"],
        "is_demo": is_demo,
        "line_items": line_items,
        "subtotal": subtotal,
        "tax": tax,
        "tax_pct": pricing["gst_pct"],
        "total": total,
        "status": "draft",
        "internal": {"usage_subtotal": usage_subtotal, "markup_amt": markup_amt,
                     "markup_pct": pricing["orbit_markup_pct"], "service_charge": service},
        "razorpay_order_id": None,
        "reconciliation": None,
        "created_at": now_iso(),
        "issued_at": None,
    }


async def reconcile(tenant_id: str, period: str) -> dict:
    """Compare the operational ledger against captured conversations to catch
    duplicates or missing events before an invoice is finalized."""
    conv_ids = set()
    async for c in db.conversations.find(
        {"tenant_id": tenant_id, "created_at": {"$regex": f"^{period}"}}, {"provider_conversation_id": 1}
    ):
        conv_ids.add(c.get("provider_conversation_id"))
    ledger_ids = set()
    dupes = 0
    async for e in db.usage_ledger.find(
        {"tenant_id": tenant_id, "created_at": {"$regex": f"^{period}"}}, {"event_id": 1}
    ):
        if e["event_id"] in ledger_ids:
            dupes += 1
        ledger_ids.add(e["event_id"])
    missing = list(conv_ids - ledger_ids)
    return {"conversations": len(conv_ids), "ledger_events": len(ledger_ids),
            "missing_events": len(missing), "duplicate_events": dupes,
            "reconciled_at": now_iso(), "ok": len(missing) == 0 and dupes == 0}


async def month_to_date_spend(tenant_id: str) -> float:
    pricing = await get_pricing(tenant_id)
    usage = await compute_usage(tenant_id, current_period())
    doc = build_invoice_doc(tenant_id, current_period(), pricing, usage, is_demo=True)
    return doc["total"]


async def enforce_spend_caps(tenant_id: str) -> str:
    """Soft warning -> hard cap. In production, hitting the hard cap suspends live
    AI employees to prevent runaway provider costs."""
    pricing = await get_pricing(tenant_id)
    spend = await month_to_date_spend(tenant_id)
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0, "environment": 1})
    environment = (tenant or {}).get("environment", "demo")
    if spend >= pricing["hard_cap"]:
        status = "capped"
        if environment == "production":
            await db.ai_employees.update_many(
                {"tenant_id": tenant_id, "lifecycle_state": "live"},
                {"$set": {"lifecycle_state": "suspended", "updated_at": now_iso()}},
            )
    elif spend >= pricing["warning_threshold"]:
        status = "warning"
    else:
        status = "ok"
    await db.tenants.update_one(
        {"id": tenant_id}, {"$set": {"spend_status": status, "spend_mtd": round(spend, 2)}}
    )
    return status

"""Billing + payments API. Admin configures per-tenant pricing and generates
immutable invoices; tenants view invoices/usage and pay via Razorpay. Demo tenants
are never charged. If Razorpay is not configured, the flow returns
'payment_config_required' instead of failing."""
import os
import asyncio
import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from db import db, write_audit
from models import PricingBody, GenerateInvoiceBody, now_iso
from security import require_platform_admin, require_tenant_user
from provisioning import razorpay_configured
import billing as B

logger = logging.getLogger("orbit.billing")

router = APIRouter(tags=["billing"])

ISSUED_STATES = {"issued", "due", "paid", "demo"}


def _tid(user):
    return user["tenant_id"]


# Only a CAPTURED payment means money actually moved. Razorpay sends
# payment.failed and payment.authorized with the SAME order_id in the same
# envelope shape, and the previous code read order_id out of any of them and
# marked the invoice paid — so a declined card produced a paid invoice.
CAPTURED_EVENT = "payment.captured"


def parse_payment_webhook(payload: dict) -> dict:
    """What a Razorpay webhook body means, as plain data.

    Pure and I/O-free on purpose: the money decision is the part worth having
    tests for, and it should not need a database or a live signature to check.
    """
    event = (payload.get("event") or "").strip()
    entity = ((payload.get("payload") or {}).get("payment") or {}).get("entity") or {}
    return {
        "event": event,
        "is_capture": event == CAPTURED_EVENT,
        "order_id": entity.get("order_id") or None,
        "payment_id": entity.get("id") or None,
        "amount": entity.get("amount"),
        "method": entity.get("method"),
    }


# ---------------- Admin: pricing ----------------
@router.get("/api/admin/tenants/{tenant_id}/pricing")
async def get_pricing(tenant_id: str, admin=Depends(require_platform_admin)):
    return await B.get_pricing(tenant_id)


@router.put("/api/admin/tenants/{tenant_id}/pricing")
async def update_pricing(tenant_id: str, body: PricingBody, admin=Depends(require_platform_admin)):
    await B.get_pricing(tenant_id)  # ensure exists
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    updates["updated_at"] = now_iso()
    await db.tenant_pricing.update_one({"tenant_id": tenant_id}, {"$set": updates})
    await write_audit(admin, "pricing.update", tenant_id, tenant_id, updates)
    return await db.tenant_pricing.find_one({"tenant_id": tenant_id}, {"_id": 0})


# ---------------- Admin: invoices ----------------
@router.post("/api/admin/tenants/{tenant_id}/invoices/generate")
async def generate_invoice(tenant_id: str, body: GenerateInvoiceBody, admin=Depends(require_platform_admin)):
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    period = body.period or B.current_period()
    existing = await db.invoices.find_one({"tenant_id": tenant_id, "period": period}, {"_id": 0})
    if existing and existing["status"] in ISSUED_STATES:
        raise HTTPException(status_code=400, detail="An issued invoice for this period already exists (immutable).")
    pricing = await B.get_pricing(tenant_id)
    usage = await B.compute_usage(tenant_id, period)
    recon = await B.reconcile(tenant_id, period)
    is_demo = tenant.get("environment", "demo") == "demo"
    doc = B.build_invoice_doc(tenant_id, period, pricing, usage, is_demo)
    doc["reconciliation"] = recon
    if existing:  # overwrite the previous draft
        await db.invoices.delete_one({"id": existing["id"]})
    await db.invoices.insert_one(dict(doc))
    await write_audit(admin, "invoice.generate", doc["id"], tenant_id, {"period": period})
    doc.pop("_id", None)
    return doc


@router.post("/api/admin/invoices/{invoice_id}/issue")
async def issue_invoice(invoice_id: str, admin=Depends(require_platform_admin)):
    inv = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if inv["status"] in ISSUED_STATES:
        raise HTTPException(status_code=400, detail="Invoice already issued (immutable).")
    # Demo invoices are marked and never charged.
    new_status = "demo" if inv.get("is_demo") else ("payment_config_required" if not razorpay_configured() else "due")
    await db.invoices.update_one({"id": invoice_id}, {"$set": {"status": new_status, "issued_at": now_iso()}})
    await write_audit(admin, "invoice.issue", invoice_id, inv["tenant_id"], {"status": new_status})
    return await db.invoices.find_one({"id": invoice_id}, {"_id": 0})


@router.get("/api/admin/tenants/{tenant_id}/invoices")
async def admin_invoices(tenant_id: str, admin=Depends(require_platform_admin)):
    return await db.invoices.find({"tenant_id": tenant_id}, {"_id": 0}).sort("period", -1).to_list(100)


@router.get("/api/admin/tenants/{tenant_id}/reconcile")
async def admin_reconcile(tenant_id: str, admin=Depends(require_platform_admin)):
    return await B.reconcile(tenant_id, B.current_period())


# ---------------- Tenant: billing (internal margins stripped) ----------------
@router.get("/api/tenant/billing")
async def tenant_billing(user=Depends(require_tenant_user)):
    t = _tid(user)
    invoices = await db.invoices.find({"tenant_id": t}, {"_id": 0, "internal": 0}).sort("period", -1).to_list(100)
    usage = await B.compute_usage(t, B.current_period())
    tenant = await db.tenants.find_one({"id": t}, {"_id": 0, "spend_status": 1, "spend_mtd": 1, "environment": 1})
    est = await B.month_to_date_spend(t)
    return {
        "invoices": invoices,
        "current_period": B.current_period(),
        "current_usage": usage,
        "estimated_total": round(est, 2),
        "spend_status": (tenant or {}).get("spend_status", "ok"),
        "environment": (tenant or {}).get("environment", "demo"),
        "currency": "INR",
    }


@router.post("/api/tenant/invoices/{invoice_id}/pay")
async def pay_invoice(invoice_id: str, user=Depends(require_tenant_user)):
    inv = await db.invoices.find_one({"id": invoice_id, "tenant_id": _tid(user)}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if inv.get("is_demo"):
        raise HTTPException(status_code=400, detail="Demo invoices are not charged.")
    if inv["status"] not in ("due", "payment_config_required", "failed"):
        raise HTTPException(status_code=400, detail=f"Invoice is not payable (status: {inv['status']}).")
    if not razorpay_configured():
        return {"status": "payment_config_required", "message": "Production payment configuration required."}
    import razorpay
    client = razorpay.Client(auth=(os.environ["RAZORPAY_KEY_ID"], os.environ["RAZORPAY_KEY_SECRET"]))
    # razorpay's SDK is synchronous. Awaiting it directly on the event loop would
    # freeze EVERY other request in this worker for as long as Razorpay takes to
    # answer, so it runs on a worker thread instead.
    order = await asyncio.to_thread(
        client.order.create,
        {
            "amount": int(round(inv["total"] * 100)),
            "currency": inv.get("currency", "INR"),
            "receipt": invoice_id[:40],
            "payment_capture": 1,
        },
    )
    await db.invoices.update_one({"id": invoice_id}, {"$set": {"razorpay_order_id": order["id"]}})
    return {"status": "order_created", "order_id": order["id"], "key_id": os.environ["RAZORPAY_KEY_ID"],
            "amount": order["amount"], "currency": order["currency"]}


@router.post("/api/webhooks/razorpay")
async def razorpay_webhook(request: Request):
    if not razorpay_configured() or not os.environ.get("RAZORPAY_WEBHOOK_SECRET"):
        raise HTTPException(status_code=503, detail="Payment webhook not configured")
    raw = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")
    import razorpay
    client = razorpay.Client(auth=(os.environ["RAZORPAY_KEY_ID"], os.environ["RAZORPAY_KEY_SECRET"]))
    try:
        client.utility.verify_webhook_signature(raw.decode(), signature, os.environ["RAZORPAY_WEBHOOK_SECRET"])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid signature")
    payload = await request.json()
    parsed = parse_payment_webhook(payload)
    order_id = parsed["order_id"]

    if not parsed["is_capture"]:
        logger.info("razorpay webhook ignored event=%s", parsed["event"] or "(none)")
        return {"status": "ignored", "event": parsed["event"]}
    if not order_id:
        return {"status": "ignored", "reason": "no order id"}

    inv = await db.invoices.find_one({"razorpay_order_id": order_id}, {"_id": 0})
    if not inv:
        logger.warning("razorpay webhook: no invoice for order")
        return {"status": "ignored", "reason": "unknown order"}
    if inv.get("status") == "paid":
        # Razorpay retries webhooks; a repeat delivery must not re-run the effects.
        return {"status": "processed", "duplicate": True}

    await db.invoices.update_one(
        {"razorpay_order_id": order_id},
        {"$set": {
            "status": "paid",
            "paid_at": now_iso(),
            # Kept for refunds, chargebacks and reconciliation — without it there
            # is no way to tie an ORBIT invoice back to a Razorpay payment.
            "razorpay_payment_id": parsed["payment_id"],
            "paid_amount": parsed["amount"],
            "paid_method": parsed["method"],
        }},
    )

    # Payment is the event that should lift a spend suspension. Leaving this to a
    # manual admin step meant a customer could pay and stay switched off.
    tenant_id = inv.get("tenant_id")
    if tenant_id:
        outstanding = await db.invoices.count_documents(
            {"tenant_id": tenant_id, "status": {"$in": ["due", "failed"]}}
        )
        if outstanding == 0:
            await db.tenants.update_one({"id": tenant_id}, {"$set": {"spend_status": "ok"}})
        await write_audit(
            None, "billing.payment_captured", target=inv.get("id", ""), tenant_id=tenant_id,
            details={"order_id": order_id, "outstanding_after": outstanding},
        )
    return {"status": "processed"}

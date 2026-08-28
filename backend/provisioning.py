"""Production provider status — derived HONESTLY from whether real credentials are
configured server-side. We never report 'connected'/'verified' without real
credentials + a successful verification. No fake green statuses.
"""
import os


def elevenlabs_configured() -> bool:
    return bool(os.environ.get("ELEVENLABS_API_KEY"))


def elevenlabs_webhooks_configured() -> bool:
    return bool(os.environ.get("ELEVENLABS_WEBHOOK_SECRET"))


def exotel_configured() -> bool:
    return all(os.environ.get(k) for k in ("EXOTEL_API_KEY", "EXOTEL_API_TOKEN", "EXOTEL_ACCOUNT_SID"))


def razorpay_configured() -> bool:
    return all(os.environ.get(k) for k in ("RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"))


def meta_whatsapp_configured() -> bool:
    from channel_adapters import meta_whatsapp_configured as _meta
    return _meta()


def _verified_or_failed(doc: dict | None, configured: bool, has_identity: bool) -> str:
    if not has_identity:
        return "not_configured"
    if not configured:
        return "credentials_required"
    if doc and doc.get("provider_verified") is True:
        return "verified"
    if doc and doc.get("provider_verified") is False:
        return "failed"
    return "configured"


def voice_status(ai_employee: dict | None) -> str:
    if not ai_employee or not ai_employee.get("provider_agent_id"):
        return "not_configured"
    if ai_employee.get("lifecycle_state") == "suspended":
        return "suspended"
    return _verified_or_failed(ai_employee, elevenlabs_configured(), True)


def telephony_status(channel: dict | None) -> str:
    if not channel or not channel.get("connected_identifier"):
        return "not_configured"
    return _verified_or_failed(channel, exotel_configured(), True)


def whatsapp_status(channel: dict | None = None) -> str:
    if not channel or not channel.get("connected_identifier"):
        return "not_configured"
    from channel_adapters import meta_whatsapp_configured, elevenlabs_configured as el
    if channel.get("provider_verified") is True:
        return "verified"
    if channel.get("provider_verified") is False:
        return "failed"
    if meta_whatsapp_configured() or el():
        return "configured"
    return "action_required"


def channel_selected(plan: str, channel_type: str) -> bool:
    if plan == "phone_and_whatsapp":
        return channel_type in ("phone", "whatsapp")
    return plan == channel_type


def infer_channel_plan(tenant: dict | None, phone: dict | None, wa: dict | None) -> str:
    stored = (tenant or {}).get("channel_plan")
    if stored in ("phone", "whatsapp", "phone_and_whatsapp"):
        return stored
    phone_on = bool(phone and phone.get("connected_identifier") and phone.get("status") not in ("not_connected", "action_required"))
    wa_on = bool(wa and wa.get("connected_identifier") and wa.get("status") not in ("not_connected", "action_required"))
    if phone_on and wa_on:
        return "phone_and_whatsapp"
    if wa_on and not phone_on:
        return "whatsapp"
    if phone_on and not wa_on:
        return "phone"
    return "phone_and_whatsapp"


def customer_facing_channel_status(
    channel: dict | None,
    *,
    honest: str,
    in_plan: bool,
    is_live: bool,
    environment: str,
) -> str:
    """Owner-facing status. Never exposes credentials_required / HMAC / provider jargon.

    Ready is reserved for verified providers, or a demo tenant that is already live
    with a usable identifier (seeded demo). Incomplete channels stay setup_in_progress
    or action_required so existing owner copy still applies.
    """
    if channel and channel.get("type") == "form":
        return "ready" if channel.get("intake_path") else "setup_in_progress"
    if not in_plan and not (channel and channel.get("connected_identifier")):
        return "not_included"
    if not channel:
        return "not_connected" if in_plan else "not_included"
    stored = channel.get("status")
    if honest == "verified":
        return "ready"
    if stored == "action_required":
        return "action_required"
    if (
        is_live
        and environment == "demo"
        and channel.get("connected_identifier")
        and stored not in ("not_connected", "action_required", "failed", "suspended")
    ):
        return "ready"
    if honest in ("configured", "credentials_required", "failed", "suspended") or stored in (
        "connected", "ok", "configured", "credentials_required",
    ):
        return "setup_in_progress"
    return "not_connected"

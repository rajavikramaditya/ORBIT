"""Channel adapters: phone (Exotel), WhatsApp, website/form, owner handoff.

These are the REAL request/response boundaries. They never claim Live without
credentials, never fake a provider success, and never trust tenant_id from a
client/AI payload.

Conversational execution (voice, WhatsApp replies, catalogue send, live call
transfer) stays in ElevenLabs. ORBIT maps identity, persists state, and serves
tenant business data.
"""
import os
import re
import logging
import requests
from db import db

logger = logging.getLogger("orbit.channels")


def exotel_configured() -> bool:
    return all(os.environ.get(k) for k in ("EXOTEL_API_KEY", "EXOTEL_API_TOKEN", "EXOTEL_ACCOUNT_SID"))


def meta_whatsapp_configured() -> bool:
    return bool(os.environ.get("META_WHATSAPP_TOKEN") and os.environ.get("META_WHATSAPP_APP_SECRET"))


def meta_whatsapp_verify_configured() -> bool:
    return bool(os.environ.get("META_WHATSAPP_VERIFY_TOKEN"))


def elevenlabs_configured() -> bool:
    return bool(os.environ.get("ELEVENLABS_API_KEY"))


def normalize_identifier(value: str | None) -> str | None:
    if not value:
        return None
    digits = re.sub(r"\D", "", value)
    return digits or value.strip().lower()


def identifiers_match(stored: str | None, incoming: str | None) -> bool:
    """Match phone/WhatsApp identifiers across +91 vs 0-prefixed local forms."""
    a = normalize_identifier(stored)
    b = normalize_identifier(incoming)
    if not a or not b:
        return False
    if a == b:
        return True
    if len(a) >= 10 and len(b) >= 10:
        return a[-10:] == b[-10:]
    return a.endswith(b) or b.endswith(a)


def phone_connect_status(tenant: dict | None) -> str:
    """Recording a number is not a live connection."""
    if not exotel_configured():
        if (tenant or {}).get("environment") == "production":
            return "credentials_required"
        return "configured"
    return "configured"


def whatsapp_connect_status(_tenant: dict | None = None) -> str:
    """WhatsApp stays managed onboarding until a real channel is verified."""
    if meta_whatsapp_configured() or elevenlabs_configured():
        return "configured"
    return "action_required"


def platform_whatsapp_status() -> str:
    if meta_whatsapp_configured() or elevenlabs_configured():
        return "configured"
    return "credentials_required"


def owner_handoff_boundary() -> dict:
    """ORBIT persists the request. ElevenLabs executes live transfer if configured."""
    return {
        "outbound_call": False,
        "persist_callback": True,
        "live_transfer_owner": "elevenlabs",
        "message": "Owner callback is recorded in ORBIT. Live call transfer is an ElevenLabs native capability. ORBIT does not place outbound calls.",
    }


def whatsapp_catalogue_boundary() -> dict:
    return {
        "status": "unsupported",
        "capability": "send_catalogue",
        "owner": "elevenlabs",
        "message": "ORBIT stores catalogue/service URLs as business data. ElevenLabs native tools send the link or brochure on WhatsApp.",
    }


def exotel_verify_request() -> tuple[str, tuple[str, str]]:
    """URL and HTTP basic auth for Exotel account verify. Secrets stay out of the URL."""
    sub = os.environ.get("EXOTEL_SUBDOMAIN") or "api.in.exotel.com"
    sid = os.environ["EXOTEL_ACCOUNT_SID"]
    url = f"https://{sub}/v1/Accounts/{sid}"
    return url, (os.environ["EXOTEL_API_KEY"], os.environ["EXOTEL_API_TOKEN"])


class ExotelAdapter:
    name = "exotel"

    def configured(self) -> bool:
        return exotel_configured()

    def connect_number(self, tenant_id: str, number: str) -> dict:
        # Do not report connected. Verification is a separate real HTTP call.
        status = "configured" if self.configured() else "configured"
        return {
            "status": status,
            "provider": self.name,
            "number": number,
            "live": False,
            "tenant_id": tenant_id,
            "message": (
                "Number recorded. Verify telephony with production credentials before treating this channel as live."
                if self.configured()
                else "Number recorded. EXOTEL credentials are required before this channel is live."
            ),
        }

    def initiate_call(self, from_number: str, to_number: str, agent_id: str, direction: str) -> dict:
        return {
            "status": "not_implemented",
            "live": False,
            "reason": "outbound_calling_disabled",
            "message": "ORBIT does not place outbound calls. Use ElevenLabs native transfer during an active conversation.",
        }

    def verify_account(self) -> dict:
        if not self.configured():
            return {"ok": False, "status": "credentials_required",
                    "message": "Production credentials required (EXOTEL_API_KEY/TOKEN/SID)."}
        try:
            url, auth = exotel_verify_request()
            r = requests.get(url, auth=auth, timeout=10)
            ok = r.status_code < 400
            return {
                "ok": ok,
                "status": "verified" if ok else "failed",
                "http_status": r.status_code,
                "message": "Telephony verified." if ok else "Could not verify with Exotel.",
            }
        except Exception:
            logger.exception("exotel verify failed")
            return {"ok": False, "status": "failed", "message": "Could not verify with Exotel."}


class WhatsAppAdapter:
    name = "whatsapp"

    def configured(self) -> bool:
        return meta_whatsapp_configured()

    def send_catalogue(self, *_args, **_kwargs) -> dict:
        return whatsapp_catalogue_boundary()

    def send_message(self, *_args, **_kwargs) -> dict:
        return {
            "status": "unsupported",
            "capability": "send_message",
            "owner": "elevenlabs",
            "message": "ORBIT does not send WhatsApp messages. ElevenLabs owns conversational replies.",
        }

    def verify_phone_number(self, phone_number_id: str | None) -> dict:
        token = os.environ.get("META_WHATSAPP_TOKEN")
        pid = phone_number_id or os.environ.get("META_WHATSAPP_PHONE_NUMBER_ID")
        if not token or not pid:
            return {"ok": False, "status": "credentials_required",
                    "message": "META_WHATSAPP_TOKEN and phone_number_id are required to verify WhatsApp."}
        try:
            r = requests.get(
                f"https://graph.facebook.com/v21.0/{pid}",
                headers={"Authorization": f"Bearer {token}"},
                timeout=10,
            )
            ok = r.status_code == 200
            return {
                "ok": ok,
                "status": "verified" if ok else "failed",
                "http_status": r.status_code,
                "message": "WhatsApp number verified." if ok else "Could not verify WhatsApp with Meta.",
            }
        except Exception:
            logger.exception("whatsapp verify failed")
            return {"ok": False, "status": "failed", "message": "Could not verify WhatsApp with Meta."}


exotel_adapter = ExotelAdapter()
whatsapp_adapter = WhatsAppAdapter()


async def resolve_channel(
    *,
    channel_type: str,
    identifier: str | None = None,
    phone_number_id: str | None = None,
) -> dict | None:
    """Map an inbound address to a tenant channel. Never uses payload tenant_id."""
    if phone_number_id:
        found = await db.channels.find_one(
            {"type": channel_type, "meta.phone_number_id": phone_number_id},
            {"_id": 0},
        )
        if found:
            return found
    if not identifier:
        return None
    raw = identifier.strip()
    found = await db.channels.find_one(
        {"type": channel_type, "connected_identifier": raw},
        {"_id": 0},
    )
    if found:
        return found
    norm = normalize_identifier(raw)
    if not norm:
        return None
    found = await db.channels.find_one(
        {"type": channel_type, "normalized_identifier": norm},
        {"_id": 0},
    )
    if found:
        return found
    async for ch in db.channels.find({"type": channel_type}, {"_id": 0}):
        if identifiers_match(ch.get("connected_identifier") or ch.get("normalized_identifier"), raw):
            return ch
    return None


async def resolve_tenant_by_intake_key(intake_key: str | None) -> dict | None:
    if not intake_key:
        return None
    return await db.tenants.find_one({"intake_key": intake_key.strip()}, {"_id": 0})

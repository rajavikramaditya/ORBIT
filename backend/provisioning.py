"""Production provider status — derived HONESTLY from whether real credentials are
configured server-side. We never report 'connected' without real credentials + a
successful verification. No fake green statuses."""
import os


def elevenlabs_configured() -> bool:
    return bool(os.environ.get("ELEVENLABS_API_KEY"))


def exotel_configured() -> bool:
    return all(os.environ.get(k) for k in ("EXOTEL_API_KEY", "EXOTEL_API_TOKEN", "EXOTEL_ACCOUNT_SID"))


def razorpay_configured() -> bool:
    return all(os.environ.get(k) for k in ("RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"))


def voice_status(ai_employee: dict) -> str:
    if not ai_employee.get("provider_agent_id"):
        return "not_connected"
    if not elevenlabs_configured():
        return "credentials_required"
    return "connected" if ai_employee.get("provider_verified") else "configured"


def telephony_status(channel: dict) -> str:
    if not channel or not channel.get("connected_identifier"):
        return "not_connected"
    if not exotel_configured():
        return "credentials_required"
    return "connected" if channel.get("provider_verified") else "configured"

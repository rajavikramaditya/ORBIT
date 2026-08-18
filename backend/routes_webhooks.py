from fastapi import APIRouter, Request, HTTPException
import os
from security import verify_webhook_signature, verify_elevenlabs_signature
from ingest import ingest_post_call

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])


@router.post("/elevenlabs/post-call")
async def elevenlabs_post_call(request: Request):
    """HMAC-verified ElevenLabs post-call webhook. Tenant is resolved server-side
    via provider_agent_id only; any tenant field in the payload is ignored.
    In production, the real 'ElevenLabs-Signature' header is verified when
    ELEVENLABS_WEBHOOK_SECRET is configured; otherwise the demo signature is used."""
    raw = await request.body()
    el_secret = os.environ.get("ELEVENLABS_WEBHOOK_SECRET")
    el_sig = request.headers.get("ElevenLabs-Signature") or request.headers.get("elevenlabs-signature")
    if el_secret and el_sig:
        ok = verify_elevenlabs_signature(raw, el_sig, el_secret)
    else:
        orbit_sig = request.headers.get("X-Orbit-Signature") or request.headers.get("x-orbit-signature")
        ok = verify_webhook_signature(raw, orbit_sig)
    if not ok:
        raise HTTPException(status_code=401, detail="Invalid webhook signature")
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")
    data = payload.get("data", payload)
    result = await ingest_post_call(data)
    return result

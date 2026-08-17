from fastapi import APIRouter, Request, HTTPException
from security import verify_webhook_signature
from ingest import ingest_post_call

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])


@router.post("/elevenlabs/post-call")
async def elevenlabs_post_call(request: Request):
    """HMAC-verified ElevenLabs post-call webhook. Tenant is resolved server-side
    via provider_agent_id only; any tenant field in the payload is ignored."""
    raw = await request.body()
    signature = request.headers.get("X-Orbit-Signature") or request.headers.get("x-orbit-signature")
    if not verify_webhook_signature(raw, signature):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")
    data = payload.get("data", payload)
    result = await ingest_post_call(data)
    return result

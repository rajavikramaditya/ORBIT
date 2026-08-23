from fastapi import APIRouter, Request, Response, HTTPException
from datetime import datetime, timezone, timedelta

from db import db
from models import RegisterBody, LoginBody, gen_id, now_iso
from security import (
    hash_password, verify_password, create_access_token, set_auth_cookie,
    set_session_cookie, clear_auth_cookies, serialize_user, get_current_user,
    exchange_emergent_session, enforce_auth_rate_limit,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


async def _tenant_summary(tenant_id):
    if not tenant_id:
        return None
    t = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    if not t:
        return None
    return {"id": t["id"], "name": t["name"], "status": t["status"], "branding": t.get("branding", {})}


async def _create_tenant_with_owner(email, name, hotel_name, password=None, auth_provider="password"):
    tenant_id = gen_id("tenant_")
    await db.tenants.insert_one({
        "id": tenant_id,
        "slug": hotel_name.lower().replace(" ", "-")[:40],
        "name": hotel_name,
        "status": "onboarding",
        "environment": "demo",
        "profile": {"logo_url": "", "website": "", "address": "", "contact_email": email,
                    "contact_phone": "", "description": ""},
        "branding": {"brand_color": "#18181B", "logo_url": ""},
        "created_at": now_iso(),
    })
    from billing import get_pricing
    await get_pricing(tenant_id)
    user = {
        "id": gen_id("usr_"),
        "email": email,
        "password_hash": hash_password(password) if password else "",
        "name": name,
        "role": "owner",
        "tenant_id": tenant_id,
        "auth_provider": auth_provider,
        "created_at": now_iso(),
    }
    await db.users.insert_one(dict(user))
    return user


@router.post("/register")
async def register(body: RegisterBody, request: Request, response: Response):
    enforce_auth_rate_limit(request)
    email = body.email.lower()
    b_name = body.business_name or body.hotel_name or "My Business"
    user = await _create_tenant_with_owner(email, body.name, b_name, body.password)
    token = create_access_token(user["id"], email)

    set_auth_cookie(response, token)
    out = serialize_user(user)
    out["tenant"] = await _tenant_summary(user["tenant_id"])
    out["access_token"] = token
    return out


@router.post("/login")
async def login(body: LoginBody, request: Request, response: Response):
    enforce_auth_rate_limit(request)
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user["id"], email)
    set_auth_cookie(response, token)
    out = serialize_user(user)
    out["tenant"] = await _tenant_summary(user.get("tenant_id"))
    out["access_token"] = token
    return out


@router.post("/session")
async def google_session(request: Request, response: Response):
    session_id = request.headers.get("X-Session-ID")
    if not session_id:
        raise HTTPException(status_code=400, detail="Missing session id")
    data = exchange_emergent_session(session_id)
    email = data["email"].lower()
    user = await db.users.find_one({"email": email})
    if not user:
        hotel_name = f"{data.get('name', 'New')}'s Hotel"
        user = await _create_tenant_with_owner(email, data.get("name", email), hotel_name, None, "google")
    session_token = data["session_token"]
    await db.user_sessions.insert_one({
        "id": gen_id("sess_"),
        "user_id": user["id"],
        "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": now_iso(),
    })
    set_session_cookie(response, session_token)
    out = serialize_user(user)
    out["tenant"] = await _tenant_summary(user.get("tenant_id"))
    return out


@router.get("/me")
async def me(request: Request):
    user = await get_current_user(request)
    user["tenant"] = await _tenant_summary(user.get("tenant_id"))
    return user


@router.post("/logout")
async def logout(request: Request, response: Response):
    session_cookie = request.cookies.get("session_token")
    if session_cookie:
        await db.user_sessions.delete_one({"session_token": session_cookie})
    clear_auth_cookies(response)
    return {"status": "logged_out"}


@router.post("/forgot-password")
async def forgot_password(request: Request):
    """Generate a password reset token. In dev mode the token is printed to console.
    In production, integrate an email provider (SendGrid/SES) to email the link."""
    import json, os, logging, secrets
    enforce_auth_rate_limit(request)
    from models import ForgotPasswordBody as FPB
    try:
        raw = await request.body()
        data = json.loads(raw)
        validated = FPB(**data)
    except Exception:
        raise HTTPException(status_code=422, detail="Invalid request body")

    email = validated.email.lower()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    # Always return 200 to avoid user enumeration
    if not user:
        return {"status": "ok", "message": "If an account with that email exists, a reset link has been sent."}

    # Cryptographically secure random token (256-bit entropy)
    token = f"rst_{secrets.token_urlsafe(32)}"
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    # Remove any old tokens for this user
    await db.password_reset_tokens.delete_many({"user_id": user["id"]})
    await db.password_reset_tokens.insert_one({
        "token": token,
        "user_id": user["id"],
        "email": email,
        "expires_at": expires_at,
        "created_at": now_iso(),
    })
    logger = logging.getLogger("orbit.auth")
    if os.environ.get("ORBIT_ENV") != "production":
        # Dev mode only: log token for local test validation without transactional email
        logger.warning("=== PASSWORD RESET TOKEN (dev only) ===")
        logger.warning("Email: %s | Token: %s", email, token)
        logger.warning("Reset URL: http://localhost:3000/reset-password?token=%s", token)
        logger.warning("========================================")
    return {"status": "ok", "message": "If an account with that email exists, a reset link has been sent."}




@router.post("/reset-password")
async def reset_password(request: Request, response: Response):
    """Validate reset token and update password. Token expires after 1 hour."""
    from models import ResetPasswordBody as RPB
    import json
    try:
        raw = await request.body()
        data = json.loads(raw)
        validated = RPB(**data)
    except Exception:
        raise HTTPException(status_code=422, detail="Invalid request body")

    record = await db.password_reset_tokens.find_one({"token": validated.token}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    expires_at = datetime.fromisoformat(record["expires_at"])
    if datetime.now(timezone.utc) > expires_at:
        await db.password_reset_tokens.delete_one({"token": validated.token})
        raise HTTPException(status_code=400, detail="Reset token has expired. Please request a new one.")

    new_hash = hash_password(validated.new_password)
    await db.users.update_one({"id": record["user_id"]}, {"$set": {"password_hash": new_hash}})
    await db.password_reset_tokens.delete_one({"token": validated.token})
    return {"status": "ok", "message": "Password updated successfully. You can now log in."}


import os
import secrets
from fastapi import APIRouter, Request, Response, HTTPException
from fastapi.responses import RedirectResponse
from datetime import datetime, timezone, timedelta

from db import db
from models import RegisterBody, LoginBody, GoogleExchangeBody, BUSINESS_TYPES, gen_id, now_iso
from security import (
    hash_password, verify_password, create_access_token, set_auth_cookie,
    set_session_cookie, clear_auth_cookies, serialize_user, get_current_user,
    enforce_auth_rate_limit, _cookie_secure, _cookie_samesite,
    build_google_auth_url, exchange_google_code, verify_google_identity,
    create_auth_ticket, redeem_auth_ticket,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


async def _tenant_summary(tenant_id):
    if not tenant_id:
        return None
    t = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    if not t:
        return None
    return {"id": t["id"], "name": t["name"], "status": t["status"], "branding": t.get("branding", {})}


async def _create_tenant_with_owner(email, name, business_name, password=None, auth_provider="password", business_type="hotel"):
    tenant_id = gen_id("tenant_")
    await db.tenants.insert_one({
        "id": tenant_id,
        "slug": business_name.lower().replace(" ", "-")[:40],
        "name": business_name,
        "status": "onboarding",
        "environment": "demo",
        "business_type": business_type or "hotel",
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
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="An account with this email already exists")
    b_name = body.business_name or body.hotel_name or "My Business"
    b_type = body.business_type if body.business_type in BUSINESS_TYPES else "hotel"
    user = await _create_tenant_with_owner(email, body.name, b_name, body.password, business_type=b_type)
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


@router.get("/google/login")
async def google_login(request: Request):
    """Initiate ORBIT-native Google OAuth flow.
    Generates a cryptographically secure state token, stores it in an HttpOnly cookie,
    and redirects the browser to Google's consent screen."""
    state = secrets.token_urlsafe(32)
    google_url = build_google_auth_url(state)
    response = RedirectResponse(url=google_url, status_code=302)
    response.set_cookie(
        key="orbit_oauth_state",
        value=state,
        httponly=True,
        secure=_cookie_secure(),
        samesite=_cookie_samesite(),
        max_age=300,
        path="/api/auth",
    )
    return response


@router.get("/google/callback")
async def google_callback(request: Request):
    """Handle Google OAuth callback.
    Validates state cookie, exchanges code for Google tokens server-side,
    verifies Google identity, provisions or finds the user and tenant in MongoDB,
    generates a single-use 60-second auth ticket, and redirects to frontend."""
    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000").rstrip("/")
    error = request.query_params.get("error")
    if error:
        return RedirectResponse(url=f"{frontend_url}/login?error={error}", status_code=302)

    state = request.query_params.get("state")
    state_cookie = request.cookies.get("orbit_oauth_state")
    if not state or not state_cookie or state != state_cookie:
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state")

    code = request.query_params.get("code")
    if not code:
        raise HTTPException(status_code=400, detail="Missing authorization code from Google")

    tokens = exchange_google_code(code)
    identity = verify_google_identity(tokens)
    email = identity["email"]
    name = identity["name"]
    sub = identity["sub"]

    user = await db.users.find_one({"email": email})
    if not user:
        default_business_name = f"{name}'s Business"
        user = await _create_tenant_with_owner(email, name, default_business_name, None, "google")
        await db.users.update_one({"id": user["id"]}, {"$set": {"google_sub": sub}})
    elif not user.get("google_sub"):
        await db.users.update_one({"id": user["id"]}, {"$set": {"google_sub": sub}})

    ticket = await create_auth_ticket(user["id"], user["email"])
    response = RedirectResponse(url=f"{frontend_url}/dashboard#auth_ticket={ticket}", status_code=302)
    response.delete_cookie("orbit_oauth_state", path="/api/auth")
    return response


@router.post("/google/exchange")
async def google_exchange(body: GoogleExchangeBody, response: Response):
    """Redeem a single-use 60-second auth ticket for an ORBIT JWT access token."""
    user = await redeem_auth_ticket(body.ticket)
    token = create_access_token(user["id"], user["email"])
    set_auth_cookie(response, token)
    out = serialize_user(user)
    out["tenant"] = await _tenant_summary(user.get("tenant_id"))
    out["access_token"] = token
    return out


@router.post("/session")
async def retired_session_endpoint():
    """Emergent session exchange endpoint has been retired in favor of native Google OAuth."""
    raise HTTPException(status_code=410, detail="Emergent session auth has been retired. Use /api/auth/google/login")


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


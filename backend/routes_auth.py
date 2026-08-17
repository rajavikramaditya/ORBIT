from fastapi import APIRouter, Request, Response, HTTPException
from datetime import datetime, timezone, timedelta

from db import db
from models import RegisterBody, LoginBody, gen_id, now_iso
from security import (
    hash_password, verify_password, create_access_token, set_auth_cookie,
    set_session_cookie, clear_auth_cookies, serialize_user, get_current_user,
    exchange_emergent_session,
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
        "profile": {"logo_url": "", "website": "", "address": "", "contact_email": email,
                    "contact_phone": "", "description": ""},
        "branding": {"brand_color": "#18181B", "logo_url": ""},
        "created_at": now_iso(),
    })
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
async def register(body: RegisterBody, response: Response):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="An account with this email already exists")
    user = await _create_tenant_with_owner(email, body.name, body.hotel_name, body.password)
    token = create_access_token(user["id"], email)
    set_auth_cookie(response, token)
    out = serialize_user(user)
    out["tenant"] = await _tenant_summary(user["tenant_id"])
    out["access_token"] = token
    return out


@router.post("/login")
async def login(body: LoginBody, response: Response):
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

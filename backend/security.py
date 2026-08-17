import os
import hmac
import hashlib
import bcrypt
import jwt
import requests
from datetime import datetime, timezone, timedelta
from fastapi import Request, HTTPException, Depends

from db import db
from models import now_iso

JWT_ALGORITHM = "HS256"
EMERGENT_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    if not hashed:
        return False
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "type": "access",
        "exp": datetime.now(timezone.utc) + timedelta(hours=12),
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def set_auth_cookie(response, token: str):
    response.set_cookie(
        key="access_token", value=token, httponly=True, secure=True,
        samesite="none", max_age=43200, path="/",
    )


def set_session_cookie(response, session_token: str):
    response.set_cookie(
        key="session_token", value=session_token, httponly=True, secure=True,
        samesite="none", max_age=604800, path="/",
    )


def clear_auth_cookies(response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("session_token", path="/")


def serialize_user(doc: dict) -> dict:
    if not doc:
        return doc
    doc = dict(doc)
    doc.pop("_id", None)
    doc.pop("password_hash", None)
    return doc


async def _user_from_jwt(token: str):
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            return None
        return await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
    except jwt.PyJWTError:
        return None


async def _user_from_session(session_token: str):
    sess = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not sess:
        return None
    expires_at = sess.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        return None
    return await db.users.find_one({"id": sess["user_id"]}, {"_id": 0})


async def get_current_user(request: Request) -> dict:
    user = None
    session_cookie = request.cookies.get("session_token")
    access_cookie = request.cookies.get("access_token")
    if session_cookie:
        user = await _user_from_session(session_cookie)
    if not user and access_cookie:
        user = await _user_from_jwt(access_cookie)
    if not user:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
            user = await _user_from_jwt(token) or await _user_from_session(token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return serialize_user(user)


def require_platform_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "platform_admin":
        raise HTTPException(status_code=403, detail="Platform admin access required")
    return user


def require_tenant_user(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") not in ("owner", "admin") or not user.get("tenant_id"):
        raise HTTPException(status_code=403, detail="Tenant access required")
    return user


def exchange_emergent_session(session_id: str) -> dict:
    resp = requests.get(EMERGENT_SESSION_URL, headers={"X-Session-ID": session_id}, timeout=15)
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session")
    return resp.json()


# ---- Webhook HMAC ----
def sign_webhook(raw_body: bytes) -> str:
    secret = os.environ["WEBHOOK_SECRET"].encode()
    return hmac.new(secret, raw_body, hashlib.sha256).hexdigest()


def verify_webhook_signature(raw_body: bytes, signature: str) -> bool:
    return hmac.compare_digest(sign_webhook(raw_body), signature or "")

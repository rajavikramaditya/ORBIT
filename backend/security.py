import os
import hmac
import hashlib
import time
import secrets
import bcrypt
import jwt
import requests
from datetime import datetime, timezone, timedelta
from fastapi import Request, HTTPException, Depends

from db import db
from models import now_iso

JWT_ALGORITHM = "HS256"
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"
AUTH_TICKET_TTL_SECS = 60


def _cookie_secure() -> bool:
    return os.environ.get("COOKIE_SECURE", "true").strip().lower() == "true"


def _cookie_samesite() -> str:
    return "none" if _cookie_secure() else "lax"


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
        key="access_token", value=token, httponly=True, secure=_cookie_secure(),
        samesite=_cookie_samesite(), max_age=43200, path="/",
    )


def set_session_cookie(response, session_token: str):
    response.set_cookie(
        key="session_token", value=session_token, httponly=True, secure=_cookie_secure(),
        samesite=_cookie_samesite(), max_age=604800, path="/",
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


# In-memory auth throttle (per process). Production can sit behind a reverse-proxy limiter too.
_AUTH_HITS: dict[str, list[float]] = {}
_AUTH_WINDOW_SECS = 300
_AUTH_MAX = 20


def enforce_auth_rate_limit(request: Request):
    from runtime_config import is_production
    if not is_production():
        return
    ip = (request.client.host if request.client else "unknown") or "unknown"
    now = datetime.now(timezone.utc).timestamp()
    hits = [t for t in _AUTH_HITS.get(ip, []) if now - t < _AUTH_WINDOW_SECS]
    if len(hits) >= _AUTH_MAX:
        raise HTTPException(status_code=429, detail="Too many attempts. Try again later.")
    hits.append(now)
    _AUTH_HITS[ip] = hits


def get_google_client_id() -> str:
    return os.environ.get("GOOGLE_CLIENT_ID", "").strip()


def get_google_client_secret() -> str:
    return os.environ.get("GOOGLE_CLIENT_SECRET", "").strip()


def get_google_redirect_uri() -> str:
    return os.environ.get("GOOGLE_REDIRECT_URI", "").strip()


def build_google_auth_url(state: str) -> str:
    client_id = get_google_client_id()
    redirect_uri = get_google_redirect_uri()
    if not client_id or not redirect_uri:
        raise HTTPException(status_code=500, detail="Google OAuth configuration is incomplete")
    from urllib.parse import urlencode
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "online",
        "prompt": "select_account",
    }
    return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"


def exchange_google_code(code: str) -> dict:
    """Exchange authorization code with Google token endpoint."""
    client_id = get_google_client_id()
    client_secret = get_google_client_secret()
    redirect_uri = get_google_redirect_uri()
    if not client_id or not client_secret or not redirect_uri:
        raise HTTPException(status_code=500, detail="Google OAuth configuration is incomplete")
    payload = {
        "code": code,
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code",
    }
    try:
        resp = requests.post(GOOGLE_TOKEN_URL, data=payload, timeout=15)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to communicate with Google token endpoint: {exc}")
    if resp.status_code != 200:
        raise HTTPException(status_code=400, detail="Failed to exchange authorization code with Google")
    return resp.json()


def verify_google_identity(tokens: dict) -> dict:
    """Verify Google token identity, audience, issuer, expiry, and email_verified."""
    id_token = tokens.get("id_token")
    access_token = tokens.get("access_token")
    if not id_token and not access_token:
        raise HTTPException(status_code=400, detail="Missing Google tokens")

    client_id = get_google_client_id()
    info = None

    if id_token:
        try:
            resp = requests.get(GOOGLE_TOKENINFO_URL, params={"id_token": id_token}, timeout=15)
            if resp.status_code == 200:
                info = resp.json()
        except Exception:
            pass

    if not info and access_token:
        try:
            resp = requests.get(GOOGLE_USERINFO_URL, headers={"Authorization": f"Bearer {access_token}"}, timeout=15)
            if resp.status_code == 200:
                info = resp.json()
        except Exception:
            pass

    if not info:
        raise HTTPException(status_code=401, detail="Could not verify Google identity")

    # Verify audience if available
    aud = info.get("aud")
    if aud and client_id and aud != client_id:
        raise HTTPException(status_code=401, detail="Google token audience mismatch")

    # Verify issuer if available
    iss = info.get("iss")
    if iss and iss not in ("accounts.google.com", "https://accounts.google.com"):
        raise HTTPException(status_code=401, detail="Invalid Google token issuer")

    # Verify expiration if exp is present
    exp = info.get("exp")
    if exp:
        try:
            if int(exp) < time.time():
                raise HTTPException(status_code=401, detail="Google token has expired")
        except (ValueError, TypeError):
            pass

    # email_verified must be True
    email_verified = info.get("email_verified")
    if isinstance(email_verified, str):
        email_verified = email_verified.lower() == "true"
    if not email_verified:
        raise HTTPException(status_code=400, detail="Google email is not verified")

    email = info.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="No email associated with Google account")

    sub = info.get("sub")
    if not sub:
        raise HTTPException(status_code=400, detail="Missing Google stable user id (sub)")

    return {
        "email": email.lower().strip(),
        "name": info.get("name") or email.split("@")[0],
        "sub": str(sub),
        "picture": info.get("picture", ""),
    }


def hash_auth_ticket(ticket: str) -> str:
    return hashlib.sha256(ticket.encode("utf-8")).hexdigest()


async def create_auth_ticket(user_id: str, email: str) -> str:
    ticket = f"otc_{secrets.token_urlsafe(32)}"
    ticket_hash = hash_auth_ticket(ticket)
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(seconds=AUTH_TICKET_TTL_SECS)
    await db.auth_tickets.insert_one({
        "ticket_hash": ticket_hash,
        "user_id": user_id,
        "email": email,
        "expires_at": expires_at,
        "created_at": now.isoformat(),
    })
    return ticket


async def redeem_auth_ticket(ticket: str) -> dict:
    ticket_hash = hash_auth_ticket(ticket)
    record = await db.auth_tickets.find_one_and_delete({"ticket_hash": ticket_hash})
    if not record:
        raise HTTPException(status_code=400, detail="Invalid or already redeemed auth ticket")
    expires_at = record.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="Auth ticket has expired. Please sign in again.")
    user = await db.users.find_one({"id": record["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


# ---- Webhook HMAC ----
def sign_webhook(raw_body: bytes) -> str:
    secret = os.environ["WEBHOOK_SECRET"].encode()
    return hmac.new(secret, raw_body, hashlib.sha256).hexdigest()


def verify_webhook_signature(raw_body: bytes, signature: str) -> bool:
    return hmac.compare_digest(sign_webhook(raw_body), signature or "")


_ELEVENLABS_REPLAY_WINDOW_SECS = 30 * 60


def verify_elevenlabs_signature(raw_body: bytes, header: str, secret: str) -> bool:
    """ElevenLabs ConvAI webhook HMAC-SHA256.

    Documented header: ``t=<unix>,v0=<hex>`` over ``f"{timestamp}.{body}"``.
    Also accepts a plain hex digest over the raw body. Timestamped signatures
    older than 30 minutes are rejected (replay protection).
    """
    if not header or not secret:
        return False
    timestamp = None
    sig = header
    if "," in header or header.startswith("t=") or "v0=" in header:
        parts = dict(p.split("=", 1) for p in header.split(",") if "=" in p)
        timestamp = parts.get("t")
        sig = parts.get("v0") or parts.get("v1") or ""
        if not sig:
            return False
        if timestamp is not None:
            try:
                ts = int(timestamp)
            except (TypeError, ValueError):
                return False
            if abs(time.time() - ts) > _ELEVENLABS_REPLAY_WINDOW_SECS:
                return False
            signed = timestamp.encode() + b"." + raw_body
            expected = hmac.new(secret.encode(), signed, hashlib.sha256).hexdigest()
            if hmac.compare_digest(expected, sig):
                return True
    expected_body = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected_body, sig)


def verify_meta_signature(raw_body: bytes, header: str, secret: str) -> bool:
    """Meta Cloud API X-Hub-Signature-256 header."""
    if not header or not secret:
        return False
    provided = header.split("=", 1)[-1] if "=" in header else header
    expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, provided)

"""Comprehensive unit tests for ORBIT-native Google OAuth authentication flow."""
import os
import time
import hashlib
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime, timezone, timedelta
import jwt

# Configure test environment variables before importing app
os.environ["MONGO_URL"] = "mongodb://localhost:27017"
os.environ["DB_NAME"] = "orbit_test"
os.environ["JWT_SECRET"] = "test-orbit-jwt-secret-key-for-unit-tests"
os.environ["WEBHOOK_SECRET"] = "test-webhook-secret-value-32-chars-ok"
os.environ["GOOGLE_CLIENT_ID"] = "mock-google-client-id.apps.googleusercontent.com"
os.environ["GOOGLE_CLIENT_SECRET"] = "mock-google-client-secret"
os.environ["GOOGLE_REDIRECT_URI"] = "http://localhost:8001/api/auth/google/callback"
os.environ["FRONTEND_URL"] = "https://orbit-app.vercel.app"
os.environ["COOKIE_SECURE"] = "false"

from starlette.testclient import TestClient
from server import app
from security import (
    create_access_token, hash_auth_ticket, create_auth_ticket, redeem_auth_ticket,
    get_jwt_secret, JWT_ALGORITHM, hash_password, verify_google_identity,
)


@pytest.fixture
def client():
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture
def mock_db():
    """Provides an in-memory dictionary-backed mock for db collections."""
    store = {
        "users": {},
        "tenants": {},
        "auth_tickets": {},
        "user_sessions": {},
        "tenant_pricing": {},
    }

    class MockCollection:
        def __init__(self, name):
            self.name = name

        async def find_one(self, query, projection=None):
            for doc in store[self.name].values():
                match = True
                for k, v in query.items():
                    if doc.get(k) != v:
                        match = False
                        break
                if match:
                    res = dict(doc)
                    if projection and projection.get("_id") == 0:
                        res.pop("_id", None)
                    return res
            return None

        async def insert_one(self, doc):
            doc_copy = dict(doc)
            doc_id = doc_copy.get("id") or doc_copy.get("ticket_hash") or str(len(store[self.name]))
            store[self.name][doc_id] = doc_copy
            return MagicMock(inserted_id=doc_id)

        async def update_one(self, query, update):
            for doc_id, doc in store[self.name].items():
                match = True
                for k, v in query.items():
                    if doc.get(k) != v:
                        match = False
                        break
                if match:
                    if "$set" in update:
                        doc.update(update["$set"])
                    return MagicMock(modified_count=1)
            return MagicMock(modified_count=0)

        async def delete_one(self, query):
            for doc_id, doc in list(store[self.name].items()):
                match = True
                for k, v in query.items():
                    if doc.get(k) != v:
                        match = False
                        break
                if match:
                    del store[self.name][doc_id]
                    return MagicMock(deleted_count=1)
            return MagicMock(deleted_count=0)

        async def find_one_and_delete(self, query):
            for doc_id, doc in list(store[self.name].items()):
                match = True
                for k, v in query.items():
                    if doc.get(k) != v:
                        match = False
                        break
                if match:
                    del store[self.name][doc_id]
                    return doc
            return None

    mock_db_obj = MagicMock()
    mock_db_obj.users = MockCollection("users")
    mock_db_obj.tenants = MockCollection("tenants")
    mock_db_obj.auth_tickets = MockCollection("auth_tickets")
    mock_db_obj.user_sessions = MockCollection("user_sessions")
    mock_db_obj.tenant_pricing = MockCollection("tenant_pricing")
    mock_db_obj.store = store

    with patch("routes_auth.db", mock_db_obj), patch("security.db", mock_db_obj), patch("billing.db", mock_db_obj):
        yield mock_db_obj


class TestGoogleOAuthFlow:
    """Test suite for complete Google OAuth authentication lifecycle."""

    def test_google_login_redirect(self, client):
        """1. /api/auth/google/login must redirect to accounts.google.com with valid params & state cookie."""
        resp = client.get("/api/auth/google/login", follow_redirects=False)
        assert resp.status_code == 302
        location = resp.headers.get("location", "")
        assert location.startswith("https://accounts.google.com/o/oauth2/v2/auth")
        assert "client_id=" + os.environ["GOOGLE_CLIENT_ID"] in location
        assert "redirect_uri=" in location
        assert "scope=openid+email+profile" in location
        assert "state=" in location

        cookie = resp.headers.get("set-cookie", "")
        assert "orbit_oauth_state=" in cookie
        assert "HttpOnly" in cookie
        assert "Path=/api/auth" in cookie

    def test_callback_missing_or_invalid_state_rejected(self, client):
        """2. Callback without state or with mismatched state must return 400."""
        # No state cookie provided
        resp = client.get("/api/auth/google/callback?code=mock_code&state=test_state", follow_redirects=False)
        assert resp.status_code == 400
        assert "Invalid or expired OAuth state" in resp.json()["detail"]

        # State mismatch
        client.cookies.set("orbit_oauth_state", "real_state_123", path="/api/auth")
        resp = client.get("/api/auth/google/callback?code=mock_code&state=wrong_state_456", follow_redirects=False)
        assert resp.status_code == 400
        assert "Invalid or expired OAuth state" in resp.json()["detail"]

    def test_callback_missing_code_rejected(self, client):
        """3. Callback with valid state but missing code must return 400."""
        state = "state_xyz"
        client.cookies.set("orbit_oauth_state", state, path="/api/auth")
        resp = client.get(f"/api/auth/google/callback?state={state}", follow_redirects=False)
        assert resp.status_code == 400
        assert "Missing authorization code" in resp.json()["detail"]

    def test_callback_google_error_redirects_to_login(self, client):
        """4. Callback receiving error parameter from Google redirects to login page with error."""
        resp = client.get("/api/auth/google/callback?error=access_denied", follow_redirects=False)
        assert resp.status_code == 302
        assert resp.headers["location"] == "https://orbit-app.vercel.app/login?error=access_denied"

    def test_callback_invalid_oauth_code_rejected(self, client, mock_db):
        """5. Server-side code exchange failure must return 400."""
        state = "state_valid_123"
        client.cookies.set("orbit_oauth_state", state, path="/api/auth")

        with patch("routes_auth.exchange_google_code") as mock_exchange:
            from fastapi import HTTPException
            mock_exchange.side_effect = HTTPException(status_code=400, detail="Failed to exchange authorization code with Google")
            resp = client.get(f"/api/auth/google/callback?code=bad_code&state={state}", follow_redirects=False)
            assert resp.status_code == 400
            assert "Failed to exchange authorization code" in resp.json()["detail"]

    def test_unverified_google_identity_rejected(self):
        """6. Google accounts with unverified email or invalid aud/iss must be rejected."""
        # Unverified email
        with pytest.raises(Exception) as excinfo:
            verify_google_identity({"id_token": "mock"}, )
        # Using mocked tokeninfo
        with patch("requests.get") as mock_get:
            # 1. email_verified is False
            mock_get.return_value = MagicMock(status_code=200, json=lambda: {
                "aud": os.environ["GOOGLE_CLIENT_ID"],
                "iss": "https://accounts.google.com",
                "email": "hacker@domain.com",
                "email_verified": False,
                "sub": "sub123",
            })
            with pytest.raises(Exception) as exc:
                verify_google_identity({"id_token": "tok"})
            assert "not verified" in str(exc.value)

            # 2. Audience mismatch
            mock_get.return_value = MagicMock(status_code=200, json=lambda: {
                "aud": "wrong-client-id.apps.googleusercontent.com",
                "iss": "https://accounts.google.com",
                "email": "user@domain.com",
                "email_verified": True,
                "sub": "sub123",
            })
            with pytest.raises(Exception) as exc:
                verify_google_identity({"id_token": "tok"})
            assert "audience mismatch" in str(exc.value)

            # 3. Invalid issuer
            mock_get.return_value = MagicMock(status_code=200, json=lambda: {
                "aud": os.environ["GOOGLE_CLIENT_ID"],
                "iss": "https://fake-google.com",
                "email": "user@domain.com",
                "email_verified": True,
                "sub": "sub123",
            })
            with pytest.raises(Exception) as exc:
                verify_google_identity({"id_token": "tok"})
            assert "Invalid Google token issuer" in str(exc.value)

            # 4. Expired token
            mock_get.return_value = MagicMock(status_code=200, json=lambda: {
                "aud": os.environ["GOOGLE_CLIENT_ID"],
                "iss": "https://accounts.google.com",
                "email": "user@domain.com",
                "email_verified": True,
                "sub": "sub123",
                "exp": str(int(time.time()) - 100),
            })
            with pytest.raises(Exception) as exc:
                verify_google_identity({"id_token": "tok"})
            assert "expired" in str(exc.value)

    def test_valid_callback_provisions_new_user_and_tenant(self, client, mock_db):
        """7. Successful callback for new user creates tenant, owner user, single-use ticket, and redirects to Vercel."""
        state = "state_secure_999"
        client.cookies.set("orbit_oauth_state", state, path="/api/auth")

        mock_tokens = {"access_token": "mock_google_access", "id_token": "mock_id_token"}
        mock_identity = {
            "email": "priya.new@hotel.in",
            "name": "Priya New",
            "sub": "google_sub_1001",
            "picture": "https://avatar.google.com/priya",
        }

        with patch("routes_auth.exchange_google_code", return_value=mock_tokens), \
             patch("routes_auth.verify_google_identity", return_value=mock_identity):

            resp = client.get(f"/api/auth/google/callback?code=valid_code&state={state}", follow_redirects=False)

            assert resp.status_code == 302
            location = resp.headers["location"]
            assert location.startswith("https://orbit-app.vercel.app/dashboard#auth_ticket=otc_")

            # Verify ticket parameter
            ticket = location.split("auth_ticket=")[1]
            ticket_hash = hashlib.sha256(ticket.encode()).hexdigest()
            assert ticket_hash in mock_db.store["auth_tickets"]

            # Verify user created in mock DB
            created_user = None
            for u in mock_db.store["users"].values():
                if u.get("email") == "priya.new@hotel.in":
                    created_user = u
                    break
            assert created_user is not None
            assert created_user["name"] == "Priya New"
            assert created_user["role"] == "owner"
            assert created_user["auth_provider"] == "google"
            assert created_user["google_sub"] == "google_sub_1001"

            # Verify tenant created
            tenant_id = created_user["tenant_id"]
            assert tenant_id in mock_db.store["tenants"]

    def test_valid_callback_existing_user_preserves_tenant(self, client, mock_db):
        """8. Successful callback for existing user does not create a duplicate user or tenant."""
        existing_user = {
            "id": "usr_existing_123",
            "email": "existing.owner@tajpalace.in",
            "name": "Existing Owner",
            "role": "owner",
            "tenant_id": "tenant_taj_palace",
            "auth_provider": "password",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        mock_db.store["users"][existing_user["id"]] = existing_user

        state = "state_existing_user"
        client.cookies.set("orbit_oauth_state", state, path="/api/auth")

        mock_identity = {
            "email": "existing.owner@tajpalace.in",
            "name": "Existing Owner",
            "sub": "google_sub_2002",
            "picture": "",
        }

        with patch("routes_auth.exchange_google_code", return_value={"id_token": "abc"}), \
             patch("routes_auth.verify_google_identity", return_value=mock_identity):

            resp = client.get(f"/api/auth/google/callback?code=valid_code&state={state}", follow_redirects=False)

            assert resp.status_code == 302
            # Check user was NOT duplicated
            users_with_email = [u for u in mock_db.store["users"].values() if u["email"] == "existing.owner@tajpalace.in"]
            assert len(users_with_email) == 1
            assert users_with_email[0]["id"] == "usr_existing_123"
            assert users_with_email[0]["google_sub"] == "google_sub_2002"

    def test_auth_ticket_redemption_and_single_use(self, client, mock_db):
        """9. /api/auth/google/exchange issues valid JWT on 1st use, rejects 2nd use (single-use guarantee)."""
        user = {
            "id": "usr_ticket_user",
            "email": "ticket.user@orbit.ai",
            "name": "Ticket User",
            "role": "owner",
            "tenant_id": "tenant_xyz",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        mock_db.store["users"][user["id"]] = user

        # Create a ticket in mock_db
        ticket = "otc_mock_test_ticket_value_123"
        ticket_hash = hashlib.sha256(ticket.encode()).hexdigest()
        mock_db.store["auth_tickets"][ticket_hash] = {
            "ticket_hash": ticket_hash,
            "user_id": user["id"],
            "email": user["email"],
            "expires_at": datetime.now(timezone.utc) + timedelta(seconds=60),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        # 1st Redemption: Must succeed and return ORBIT JWT
        resp = client.post("/api/auth/google/exchange", json={"ticket": ticket})
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == "ticket.user@orbit.ai"
        assert "access_token" in data

        # Verify JWT claims
        token = data["access_token"]
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        assert payload["sub"] == user["id"]
        assert payload["email"] == user["email"]
        assert payload["type"] == "access"

        # 2nd Redemption: Must fail (ticket was atomically deleted)
        resp2 = client.post("/api/auth/google/exchange", json={"ticket": ticket})
        assert resp2.status_code == 400
        assert "Invalid or already redeemed" in resp2.json()["detail"]

    def test_expired_auth_ticket_rejected(self, client, mock_db):
        """10. Expired auth ticket must return 400 and be refused."""
        user = {
            "id": "usr_expired_ticket_user",
            "email": "expired@orbit.ai",
            "name": "Expired User",
            "role": "owner",
            "tenant_id": "tenant_exp",
        }
        mock_db.store["users"][user["id"]] = user

        ticket = "otc_expired_ticket_789"
        ticket_hash = hashlib.sha256(ticket.encode()).hexdigest()
        # Expired 10 seconds ago
        mock_db.store["auth_tickets"][ticket_hash] = {
            "ticket_hash": ticket_hash,
            "user_id": user["id"],
            "email": user["email"],
            "expires_at": datetime.now(timezone.utc) - timedelta(seconds=10),
            "created_at": (datetime.now(timezone.utc) - timedelta(seconds=70)).isoformat(),
        }

        resp = client.post("/api/auth/google/exchange", json={"ticket": ticket})
        assert resp.status_code == 400
        assert "expired" in resp.json()["detail"].lower()

    def test_retired_session_endpoint_returns_410(self, client):
        """11. Legacy /api/auth/session endpoint must return 410 Gone."""
        resp = client.post("/api/auth/session")
        assert resp.status_code == 410
        assert "retired" in resp.json()["detail"].lower()

    def test_existing_email_password_login_still_works(self, client, mock_db):
        """12. Existing email/password login is unaffected and issues access_token and auth cookie."""
        pwd_plain = "OwnerSecret@2026"
        pwd_hash = hash_password(pwd_plain)
        owner_user = {
            "id": "usr_owner_pwd",
            "email": "taj.owner@tajpalace.in",
            "password_hash": pwd_hash,
            "name": "Taj Owner",
            "role": "owner",
            "tenant_id": "tenant_taj_palace",
            "auth_provider": "password",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        mock_db.store["users"][owner_user["id"]] = owner_user

        resp = client.post("/api/auth/login", json={"email": "taj.owner@tajpalace.in", "password": pwd_plain})
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == "taj.owner@tajpalace.in"
        assert "access_token" in data
        assert resp.cookies.get("access_token") is not None

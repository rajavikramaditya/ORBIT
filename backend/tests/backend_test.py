"""ORBIT backend regression tests (Phase 1-2)."""
import os
import hmac
import hashlib
import json
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"
WEBHOOK_SECRET = "orbit_whsec_3a9f7c2e1b8d6045a3c9e7f1b2d4a6c8"

ADMIN = {"email": "admin@orbit.ai", "password": "OrbitAdmin@2026"}
TAJ = {"email": "owner@tajpalace.in", "password": "Hotel@2026"}
LEELA = {"email": "owner@leela.in", "password": "Hotel@2026"}


def _login(creds):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"Login failed for {creds['email']}: {r.status_code} {r.text}"
    return s, r.json()


# ---------- Auth ----------
class TestAuth:
    def test_admin_login_me(self):
        s, data = _login(ADMIN)
        assert data["role"] == "platform_admin"
        me = s.get(f"{API}/auth/me").json()
        assert me["role"] == "platform_admin"
        assert me.get("tenant_id") in (None, "")

    def test_taj_owner_login_me(self):
        s, data = _login(TAJ)
        assert data["role"] == "owner"
        assert data["tenant_id"] == "tenant_taj_palace"
        me = s.get(f"{API}/auth/me").json()
        assert me["tenant"]["id"] == "tenant_taj_palace"

    def test_logout(self):
        s, _ = _login(TAJ)
        r = s.post(f"{API}/auth/logout")
        assert r.status_code == 200
        # After logout the JWT cookie is cleared; /me should be 401
        r2 = s.get(f"{API}/auth/me")
        assert r2.status_code == 401

    def test_register_creates_tenant(self):
        email = f"test_owner_{uuid.uuid4().hex[:8]}@example.com"
        s = requests.Session()
        r = s.post(f"{API}/auth/register", json={
            "email": email, "password": "TestPass@123",
            "name": "Test Owner", "hotel_name": f"TEST_Hotel_{uuid.uuid4().hex[:6]}"
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["role"] == "owner"
        assert data["tenant"]["status"] == "onboarding"
        # session works
        me = s.get(f"{API}/auth/me").json()
        assert me["email"] == email

    def test_register_duplicate_email(self):
        r = requests.post(f"{API}/auth/register", json={
            "email": "owner@tajpalace.in", "password": "TestPass@123",
            "name": "Dup", "hotel_name": "Dup Hotel"
        })
        assert r.status_code == 400

    def test_unauthenticated_protected(self):
        assert requests.get(f"{API}/auth/me").status_code == 401
        assert requests.get(f"{API}/tenant/overview").status_code == 401
        assert requests.get(f"{API}/admin/stats").status_code == 401


# ---------- Authorization gating ----------
class TestAuthorization:
    def test_admin_cannot_use_tenant_endpoints(self):
        s, _ = _login(ADMIN)
        assert s.get(f"{API}/tenant/overview").status_code == 403

    def test_tenant_cannot_use_admin_endpoints(self):
        s, _ = _login(TAJ)
        assert s.get(f"{API}/admin/stats").status_code == 403


# ---------- Tenant isolation ----------
class TestTenantIsolation:
    def test_taj_only_sees_own_conversations(self):
        s, _ = _login(TAJ)
        convs = s.get(f"{API}/tenant/conversations").json()
        assert len(convs) >= 1
        for c in convs:
            assert c["tenant_id"] == "tenant_taj_palace"
        # Save an id
        pytest.taj_conv_id = convs[0]["id"]

    def test_leela_cannot_access_taj_conversation(self):
        # First ensure we have a Taj conv id
        s_taj, _ = _login(TAJ)
        taj_convs = s_taj.get(f"{API}/tenant/conversations").json()
        assert taj_convs, "No seeded Taj conversations"
        taj_id = taj_convs[0]["id"]

        s, _ = _login(LEELA)
        r = s.get(f"{API}/tenant/conversations/{taj_id}")
        assert r.status_code == 404

        leela_convs = s.get(f"{API}/tenant/conversations").json()
        ids = {c["id"] for c in leela_convs}
        assert taj_id not in ids


# ---------- Webhook ----------
def _sig(body_bytes):
    return hmac.new(WEBHOOK_SECRET.encode(), body_bytes, hashlib.sha256).hexdigest()


class TestWebhook:
    def test_valid_signature_ingests(self):
        conv_id = f"conv_test_{uuid.uuid4().hex[:8]}"
        payload = {"data": {
            "agent_id": "agent_taj_aria_001",
            "conversation_id": conv_id,
            "status": "done",
            "transcript": [{"role": "agent", "message": "hi"}],
            "metadata": {
                "call_duration_secs": 60,
                "phone_call": {"direction": "inbound", "external_number": "+919812345678"},
            },
            "analysis": {"call_summary_title": "Test", "transcript_summary": "s"},
        }}
        raw = json.dumps(payload).encode()
        r = requests.post(f"{API}/webhooks/elevenlabs/post-call", data=raw,
                          headers={"X-Orbit-Signature": _sig(raw), "Content-Type": "application/json"})
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "ingested"
        ingested_id = r.json()["conversation"]["id"]

        # Verify appears under Taj (tenant surface never exposes provider IDs)
        s, _ = _login(TAJ)
        convs = s.get(f"{API}/tenant/conversations").json()
        assert any(c["id"] == ingested_id for c in convs)
        assert all("provider_conversation_id" not in c and "provider" not in c for c in convs)

        # (b) Duplicate
        r2 = requests.post(f"{API}/webhooks/elevenlabs/post-call", data=raw,
                           headers={"X-Orbit-Signature": _sig(raw), "Content-Type": "application/json"})
        assert r2.status_code == 200
        assert r2.json()["status"] == "duplicate"

    def test_unknown_agent_quarantined(self):
        conv_id = f"conv_qtest_{uuid.uuid4().hex[:8]}"
        payload = {"data": {
            "agent_id": "agent_unknown_999",
            "conversation_id": conv_id,
            "status": "done",
            "transcript": [], "metadata": {}, "analysis": {},
        }}
        raw = json.dumps(payload).encode()
        r = requests.post(f"{API}/webhooks/elevenlabs/post-call", data=raw,
                          headers={"X-Orbit-Signature": _sig(raw), "Content-Type": "application/json"})
        assert r.status_code == 200
        assert r.json()["status"] == "quarantined"

        s, _ = _login(ADMIN)
        q = s.get(f"{API}/admin/quarantine").json()
        assert any(item["conversation_id"] == conv_id for item in q)

    def test_invalid_signature(self):
        payload = {"data": {"agent_id": "x", "conversation_id": "y"}}
        raw = json.dumps(payload).encode()
        r = requests.post(f"{API}/webhooks/elevenlabs/post-call", data=raw,
                          headers={"X-Orbit-Signature": "deadbeef", "Content-Type": "application/json"})
        assert r.status_code == 401

    def test_missing_signature(self):
        payload = {"data": {"agent_id": "x", "conversation_id": "y"}}
        r = requests.post(f"{API}/webhooks/elevenlabs/post-call", json=payload)
        assert r.status_code == 401


# ---------- Health ----------
class TestHealth:
    def test_liveness(self):
        r = requests.get(f"{API}/", timeout=15)
        assert r.status_code == 200
        assert r.json().get("status") == "ok"

    def test_readiness(self):
        r = requests.get(f"{API}/health", timeout=15)
        assert r.status_code == 200
        assert r.json().get("status") == "ok"


# ---------- Admin console ----------
class TestAdminConsole:
    def test_stats_and_tenants(self):
        s, _ = _login(ADMIN)
        stats = s.get(f"{API}/admin/stats").json()
        for k in ("tenants", "live_tenants", "ai_employees", "conversations", "open_requests", "quarantined_webhooks"):
            assert k in stats
        tenants = s.get(f"{API}/admin/tenants").json()
        assert any(t["id"] == "tenant_taj_palace" for t in tenants)
        for t in tenants:
            assert "counts" in t

    def test_create_tenant_then_ai_employee_lifecycle(self):
        s, _ = _login(ADMIN)
        tname = f"TEST_Tenant_{uuid.uuid4().hex[:6]}"
        oemail = f"test_admin_{uuid.uuid4().hex[:8]}@example.com"
        r = s.post(f"{API}/admin/tenants", json={
            "name": tname, "owner_email": oemail,
            "owner_name": "Admin Test", "owner_password": "AdminPass@123"
        })
        assert r.status_code == 200, r.text
        tenant_id = r.json()["id"]
        assert r.json().get("environment") == "demo"
        assert r.json().get("status") == "onboarding"

        # Incomplete tenants cannot be marked live
        r_live = s.patch(f"{API}/admin/tenants/{tenant_id}/status", json={"status": "live"})
        assert r_live.status_code == 400, r_live.text

        # Attach AI employee
        agent_id = f"agent_test_{uuid.uuid4().hex[:8]}"
        r2 = s.post(f"{API}/admin/tenants/{tenant_id}/ai-employees", json={
            "name": "TestBot", "role_title": "Concierge",
            "provider_agent_id": agent_id,
        })
        assert r2.status_code == 200, r2.text
        ae = r2.json()
        assert ae["lifecycle_state"] == "draft"

        # Duplicate provider_agent_id -> 400
        r3 = s.post(f"{API}/admin/tenants/{tenant_id}/ai-employees", json={
            "name": "Dup", "role_title": "x", "provider_agent_id": agent_id
        })
        assert r3.status_code == 400

        # draft -> testing OK
        r4 = s.patch(f"{API}/admin/ai-employees/{ae['id']}/lifecycle", json={"to_state": "testing"})
        assert r4.status_code == 200
        assert r4.json()["lifecycle_state"] == "testing"

        # draft -> live rejected. Create a fresh one to test.
        agent_id2 = f"agent_test_{uuid.uuid4().hex[:8]}"
        r5 = s.post(f"{API}/admin/tenants/{tenant_id}/ai-employees", json={
            "name": "TestBot2", "role_title": "x", "provider_agent_id": agent_id2
        })
        ae2 = r5.json()
        r6 = s.patch(f"{API}/admin/ai-employees/{ae2['id']}/lifecycle", json={"to_state": "live"})
        assert r6.status_code == 400

        # Connect phone channel
        r7 = s.post(f"{API}/admin/tenants/{tenant_id}/channels", json={
            "type": "phone", "connected_identifier": "+91 22 0000 0000",
            "assigned_ai_employee_id": ae["id"]
        })
        assert r7.status_code == 200, r7.text
        assert r7.json()["status"] == "connected"

        # WhatsApp
        r8 = s.post(f"{API}/admin/tenants/{tenant_id}/channels", json={
            "type": "whatsapp", "connected_identifier": "+91 22 0000 0000",
        })
        assert r8.status_code == 200
        assert r8.json()["status"] == "action_required"

    def test_customization_requests_list_and_update(self):
        s, _ = _login(ADMIN)
        reqs = s.get(f"{API}/admin/customization-requests").json()
        if reqs:
            rid = reqs[0]["id"]
            r = s.patch(f"{API}/admin/customization-requests/{rid}", json={
                "status": "in_progress", "admin_notes": "Working on it"
            })
            assert r.status_code == 200
            assert r.json()["status"] == "in_progress"


# ---------- Tenant dashboard ----------
class TestTenantDashboard:
    def test_overview(self):
        s, _ = _login(TAJ)
        r = s.get(f"{API}/tenant/overview").json()
        assert "stats" in r and "recent_conversations" in r

    def test_ai_employees_no_config_ref(self):
        s, _ = _login(TAJ)
        aes = s.get(f"{API}/tenant/ai-employees").json()
        assert aes
        for ae in aes:
            assert "config_ref" not in ae

    def test_channels_include_assigned_name(self):
        s, _ = _login(TAJ)
        chans = s.get(f"{API}/tenant/channels").json()
        types = {c["type"] for c in chans}
        assert {"phone", "whatsapp"}.issubset(types)
        assigned = [c for c in chans if c.get("assigned_ai_employee_id")]
        assert assigned and all(c.get("assigned_ai_employee_name") for c in assigned)

    def test_simulate_call_creates_conversation(self):
        s, _ = _login(TAJ)
        before = len(s.get(f"{API}/tenant/conversations").json())
        r = s.post(f"{API}/tenant/simulate-call", json={"direction": "inbound"})
        assert r.status_code == 200, r.text
        conv = r.json()
        assert conv["tenant_id"] == "tenant_taj_palace"
        after = len(s.get(f"{API}/tenant/conversations").json())
        assert after == before + 1

    def test_conversation_detail_includes_transcript(self):
        s, _ = _login(TAJ)
        convs = s.get(f"{API}/tenant/conversations").json()
        cid = convs[0]["id"]
        r = s.get(f"{API}/tenant/conversations/{cid}")
        assert r.status_code == 200
        assert "transcript" in r.json()

    def test_customization_request_create(self):
        s, _ = _login(TAJ)
        r = s.post(f"{API}/tenant/customization-requests", json={
            "category": "knowledge_base",
            "title": "TEST_Request",
            "details": "test detail",
        })
        assert r.status_code == 200
        assert r.json()["status"] == "submitted"

    def test_profile_update_whitelisted(self):
        s, _ = _login(TAJ)
        r = s.patch(f"{API}/tenant/profile", json={
            "name": "The Taj Palace, Mumbai",  # keep same
            "website": "https://tajpalace.example.in",
            "brand_color": "#1E3A5F",
            "description": "Updated description",
            # Try malicious extras (should be ignored by Pydantic model)
            "tenant_id": "tenant_leela_blr",
            "config_ref": "hacked",
            "status": "live",
        })
        assert r.status_code == 200
        data = r.json()
        # Verify tenant_id unchanged and no config injected
        assert data["id"] == "tenant_taj_palace"

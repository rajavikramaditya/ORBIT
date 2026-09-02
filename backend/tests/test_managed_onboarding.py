"""Managed customer onboarding + honest connection readiness."""
import os
import uuid

import requests

from provisioning import voice_status, telephony_status, whatsapp_status, infer_channel_plan

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN = {"email": "admin@orbit.ai", "password": "OrbitAdmin@2026"}
TAJ = {"email": "owner@tajpalace.in", "password": "Hotel@2026"}
LEELA = {"email": "owner@leela.in", "password": "Hotel@2026"}

SECRET_MARKERS = (
    "ELEVENLABS_API_KEY", "ELEVENLABS_WEBHOOK_SECRET", "EXOTEL_API_KEY", "EXOTEL_API_TOKEN",
    "EXOTEL_ACCOUNT_SID", "META_WHATSAPP_TOKEN", "META_WHATSAPP_APP_SECRET",
    "JWT_SECRET", "WEBHOOK_SECRET", "xi-api-key",
)


def _login(creds):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, r.text
    return s


def _assert_no_secrets(payload):
    blob = str(payload)
    for marker in SECRET_MARKERS:
        assert marker not in blob, f"secret marker leaked: {marker}"


def _create_tenant(admin, name=None):
    suffix = uuid.uuid4().hex[:8]
    email = f"onboard_{suffix}@example.com"
    r = admin.post(f"{API}/admin/tenants", json={
        "name": name or f"Modular Studio {suffix}",
        "owner_email": email,
        "owner_name": "Owner",
        "owner_password": "OrbitOnboard@2026",
    })
    assert r.status_code == 200, r.text
    return r.json(), email


class TestHonestConnectionStatus:
    def test_verification_failure_is_not_verified(self):
        ch = {"connected_identifier": "+912212345678", "provider_verified": False}
        ae = {"provider_agent_id": "agent_x", "provider_verified": False}
        assert telephony_status(ch) != "verified"
        assert telephony_status(ch) != "connected"
        assert voice_status(ae) != "verified"
        assert voice_status(ae) != "connected"
        wa = {"connected_identifier": "+919800011122", "provider_verified": False}
        assert whatsapp_status(wa) != "verified"
        assert whatsapp_status(wa) != "connected"

    def test_verified_flag_marks_ready_when_credentials_present(self, monkeypatch):
        monkeypatch.setattr("provisioning.elevenlabs_configured", lambda: True)
        monkeypatch.setattr("provisioning.exotel_configured", lambda: True)
        ae = {"provider_agent_id": "agent_x", "provider_verified": True}
        ch = {"connected_identifier": "+912212345678", "provider_verified": True}
        assert voice_status(ae) == "verified"
        assert telephony_status(ch) == "verified"
        wa = {"connected_identifier": "+919800011122", "provider_verified": True}
        assert whatsapp_status(wa) == "verified"

    def test_identifier_alone_is_not_live(self):
        ch = {"connected_identifier": "+912200000000", "status": "configured"}
        assert telephony_status(ch) in ("credentials_required", "configured", "not_configured")
        assert telephony_status(ch) not in ("verified", "connected", "live")


class TestTenantCannotSeeProviderSecrets:
    def test_owner_payloads_have_no_provider_secrets(self):
        taj = _login(TAJ)
        for path in (
            "/tenant/profile", "/tenant/channels", "/tenant/ai-employees",
            "/tenant/readiness", "/tenant/overview", "/tenant/leads",
        ):
            r = taj.get(f"{API}{path}")
            assert r.status_code == 200, path
            _assert_no_secrets(r.json())
        ready = taj.get(f"{API}/tenant/readiness").json()
        blob = str(ready).lower()
        assert "hmac" not in blob
        assert "elevenlabs webhook" not in blob
        assert "configure elevenlabs" not in blob


class TestCrossTenantChannelIsolation:
    def test_owner_cannot_configure_another_tenants_channel(self):
        leela = _login(LEELA)
        r = leela.post(f"{API}/admin/tenants/tenant_taj_palace/channels", json={
            "type": "phone", "connected_identifier": "+919999988877",
        })
        assert r.status_code in (401, 403)
        r2 = leela.patch(f"{API}/admin/channels/ch_taj_phone", json={"status": "verified"})
        assert r2.status_code in (401, 403, 404)
        r3 = leela.post(f"{API}/tenant/channels", json={"type": "phone", "connected_identifier": "+91"})
        assert r3.status_code in (404, 405, 403)


class TestChannelPlanGoLiveGates:
    def test_phone_only_does_not_require_whatsapp(self):
        admin = _login(ADMIN)
        tenant, _ = _create_tenant(admin)
        tid = tenant["id"]
        plan = admin.patch(f"{API}/admin/tenants/{tid}/channel-plan", json={"channel_plan": "phone"})
        assert plan.status_code == 200, plan.text
        ready = plan.json()
        assert ready["channel_plan"] == "phone"
        blob = " ".join(ready.get("blockers") or []).lower()
        assert "whatsapp" not in blob
        phone_item = next(i for i in ready["items"] if i["key"] == "whatsapp")
        assert phone_item["required"] is False
        assert phone_item["status"] == "not_included"

    def test_whatsapp_only_does_not_require_phone(self):
        admin = _login(ADMIN)
        tenant, _ = _create_tenant(admin)
        tid = tenant["id"]
        ready = admin.patch(f"{API}/admin/tenants/{tid}/channel-plan", json={"channel_plan": "whatsapp"}).json()
        assert ready["channel_plan"] == "whatsapp"
        blob = " ".join(ready.get("blockers") or []).lower()
        assert "phone channel" not in blob
        phone_item = next(i for i in ready["items"] if i["key"] == "phone")
        assert phone_item["required"] is False
        assert phone_item["status"] == "not_included"

    def test_go_live_blocked_when_required_checks_fail(self):
        admin = _login(ADMIN)
        tenant, _ = _create_tenant(admin)
        tid = tenant["id"]
        admin.patch(f"{API}/admin/tenants/{tid}/channel-plan", json={"channel_plan": "phone"})
        ready = admin.get(f"{API}/admin/tenants/{tid}/readiness").json()
        assert ready["ready_for_live"] is False
        assert ready["blockers"]
        live = admin.patch(f"{API}/admin/tenants/{tid}/status", json={"status": "live"})
        assert live.status_code == 400

    def test_go_live_succeeds_when_required_checks_pass(self):
        admin = _login(ADMIN)
        tenant, email = _create_tenant(admin, name="ABC Modular Interiors")
        tid = tenant["id"]
        owner = _login({"email": email, "password": "OrbitOnboard@2026"})
        prof = owner.patch(f"{API}/tenant/profile", json={
            "contact_phone": "+919811122233",
            "address": "Pune",
            "website": "https://abc-modular.example",
        })
        assert prof.status_code == 200, prof.text
        ae = admin.post(f"{API}/admin/tenants/{tid}/ai-employees", json={
            "name": "Maya",
            "role_title": "Studio assistant",
            "provider_agent_id": f"agent_onboard_{uuid.uuid4().hex[:10]}",
        }).json()
        admin.patch(f"{API}/admin/ai-employees/{ae['id']}/lifecycle", json={"to_state": "testing"})
        admin.patch(f"{API}/admin/ai-employees/{ae['id']}/lifecycle", json={"to_state": "approved"})
        ch = admin.post(f"{API}/admin/tenants/{tid}/channels", json={
            "type": "phone",
            "connected_identifier": f"+9122{uuid.uuid4().hex[:8]}",
            "assigned_ai_employee_id": ae["id"],
        })
        assert ch.status_code == 200, ch.text
        assert ch.json()["status"] not in ("connected", "verified", "live")
        owner.patch(f"{API}/tenant/live-data", json={
            "services": [{"name": "Modular Kitchen", "price": "from 2.5L"}],
            "catalogue_url": "https://abc-modular.example/brochure.pdf",
        })
        admin.patch(f"{API}/admin/tenants/{tid}/channel-plan", json={"channel_plan": "phone"})
        sim = owner.post(f"{API}/tenant/simulate-call", json={"direction": "inbound"})
        assert sim.status_code == 200, sim.text
        admin.patch(f"{API}/admin/ai-employees/{ae['id']}/lifecycle", json={"to_state": "live"})
        ready = admin.get(f"{API}/admin/tenants/{tid}/readiness").json()
        assert ready["ready_for_live"] is True, ready.get("blockers")
        live = admin.patch(f"{API}/admin/tenants/{tid}/status", json={"status": "live"})
        assert live.status_code == 200, live.text
        assert live.json()["status"] == "live"
        owner_ready = owner.get(f"{API}/tenant/readiness").json()
        assert owner_ready["is_live"] is True
        labels = str(owner_ready).lower()
        assert "hotel" not in labels
        assert "pms" not in labels
        assert "elevenlabs" not in labels
        assert "hmac" not in labels

    def test_verify_without_credentials_does_not_mark_live(self):
        admin = _login(ADMIN)
        r = admin.post(f"{API}/admin/channels/ch_taj_phone/verify-telephony")
        assert r.status_code == 200
        assert r.json()["status"] in ("credentials_required", "failed")
        assert r.json()["status"] not in ("verified", "connected", "live")
        prov = admin.get(f"{API}/admin/tenants/tenant_taj_palace/provisioning").json()
        for n in prov["exotel"]["numbers"]:
            assert n["status"] not in ("verified", "connected", "live")


class TestBusinessDataAndPipelineReuse:
    def test_no_hotel_assumption_in_channel_plan(self):
        plan = infer_channel_plan(
            {"channel_plan": "whatsapp"},
            {"connected_identifier": "+911", "status": "configured"},
            {"connected_identifier": "+912", "status": "configured"},
        )
        assert plan == "whatsapp"
        admin = _login(ADMIN)
        ready = admin.get(f"{API}/admin/tenants/tenant_taj_palace/readiness").json()
        keys = {i["key"] for i in ready["items"]}
        for k in ("profile", "ai_employee", "voice_agent", "phone", "whatsapp",
                  "business_data", "catalogue", "owner_escalation", "test_call",
                  "test_whatsapp", "lead_capture", "live"):
            assert k in keys
        assert ready.get("operational_state") in (
            "onboarding", "ready_for_test", "live", "suspended", "blocked",
        )
        labels = " ".join(i["label"] for i in ready["items"]).lower()
        assert "hotel" not in labels
        assert "elevenlabs" not in labels
        assert "hmac" not in labels

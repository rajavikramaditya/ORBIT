"""Phone, WhatsApp, website/form intake, and owner-handoff boundaries.

Proves mapping, signature checks, idempotency, isolation, and that missing
credentials never report a fake live success.
"""
import os
import hmac
import hashlib
import json
import uuid
import requests

from channel_adapters import (
    exotel_adapter, whatsapp_adapter, owner_handoff_boundary,
    whatsapp_catalogue_boundary, normalize_identifier, identifiers_match,
    exotel_verify_request,
)
from connectors import get_orbit_live_connector, get_live_connector

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"
WEBHOOK_SECRET = "orbit_whsec_3a9f7c2e1b8d6045a3c9e7f1b2d4a6c8"
ADMIN = {"email": "admin@orbit.ai", "password": "OrbitAdmin@2026"}
TAJ = {"email": "owner@tajpalace.in", "password": "Hotel@2026"}
LEELA = {"email": "owner@leela.in", "password": "Hotel@2026"}


def _login(creds):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, r.text
    return s


def _sig(body_bytes):
    return hmac.new(WEBHOOK_SECRET.encode(), body_bytes, hashlib.sha256).hexdigest()


def _post_signed(path, payload):
    raw = json.dumps(payload).encode()
    return requests.post(
        f"{API}{path}",
        data=raw,
        headers={"X-Orbit-Signature": _sig(raw), "Content-Type": "application/json"},
        timeout=15,
    )


class TestAdapterHonesty:
    def test_outbound_call_is_not_faked(self):
        result = exotel_adapter.initiate_call("+9111", "+9198", "agent_x", "outbound")
        assert result["status"] == "not_implemented"
        assert result.get("live") is False
        assert "provider_call_id" not in result
        assert result.get("status") != "initiated"

    def test_whatsapp_send_is_elevenlabs_boundary(self):
        sent = whatsapp_adapter.send_message("+9198", "hello")
        assert sent["status"] == "unsupported"
        assert sent["owner"] == "elevenlabs"
        cat = whatsapp_catalogue_boundary()
        assert cat["owner"] == "elevenlabs"
        assert cat["status"] == "unsupported"

    def test_owner_handoff_does_not_place_calls(self):
        boundary = owner_handoff_boundary()
        assert boundary["outbound_call"] is False
        assert boundary["persist_callback"] is True
        assert boundary["live_transfer_owner"] == "elevenlabs"

    def test_verify_without_credentials(self):
        tel = exotel_adapter.verify_account()
        assert tel["status"] == "credentials_required"
        wa = whatsapp_adapter.verify_phone_number(None)
        assert wa["status"] == "credentials_required"

    def test_exotel_verify_url_does_not_embed_secrets(self, monkeypatch):
        monkeypatch.setenv("EXOTEL_API_KEY", "key-secret-value")
        monkeypatch.setenv("EXOTEL_API_TOKEN", "token-secret-value")
        monkeypatch.setenv("EXOTEL_ACCOUNT_SID", "sid123")
        monkeypatch.setenv("EXOTEL_SUBDOMAIN", "api.in.exotel.com")
        url, auth = exotel_verify_request()
        assert "key-secret-value" not in url
        assert "token-secret-value" not in url
        assert auth == ("key-secret-value", "token-secret-value")
        assert url.startswith("https://api.in.exotel.com/v1/Accounts/sid123")

    def test_no_fake_live_connector(self):
        assert get_live_connector("mock_pms") is None
        assert get_live_connector("exotel") is None

    def test_catalogue_read_from_business_data(self):
        connector = get_orbit_live_connector({
            "catalogue_url": "https://example.com/brochure.pdf",
            "services": [{"name": "Modular kitchen", "price": "from 2.5L"}],
        })
        res = connector.read("get_catalogue", {})
        assert res["mock"] is False
        assert res["result"]["catalogue_url"] == "https://example.com/brochure.pdf"
        assert res["result"]["send_via"] == "elevenlabs"
        assert res["result"]["services"][0]["name"] == "Modular kitchen"

    def test_normalize_identifier(self):
        assert normalize_identifier("+91 98111 22222") == "919811122222"
        assert identifiers_match("+91 22 6789 0000", "02267890000") is True
        assert identifiers_match("+912267890000", "2267890000") is True
        assert identifiers_match("+912267890000", "+913312345678") is False


class TestWebhookSecurity:
    def test_unsigned_phone_inbound_rejected(self):
        r = requests.post(f"{API}/webhooks/exotel/inbound", json={"CallSid": "x"}, timeout=15)
        assert r.status_code == 401

    def test_unsigned_whatsapp_inbound_rejected(self):
        r = requests.post(f"{API}/webhooks/whatsapp", json={"wamid": "x"}, timeout=15)
        assert r.status_code == 401

    def test_whatsapp_verify_without_token_is_not_configured(self):
        r = requests.get(f"{API}/webhooks/whatsapp", params={
            "hub.mode": "subscribe", "hub.verify_token": "nope", "hub.challenge": "abc",
        }, timeout=15)
        assert r.status_code in (403, 503)


class TestPhoneInboundMapping:
    def test_maps_to_tenant_without_fake_conversation(self):
        admin = _login(ADMIN)
        number = f"+91970{uuid.uuid4().hex[:8]}"
        ch = admin.post(f"{API}/admin/tenants/tenant_taj_palace/channels", json={
            "type": "phone",
            "connected_identifier": number,
            "assigned_ai_employee_id": "ae_taj_aria",
        })
        assert ch.status_code == 200, ch.text
        assert ch.json()["status"] != "connected"
        sid = f"CA{uuid.uuid4().hex}"
        payload = {
            "CallSid": sid,
            "CallTo": number,
            "CallFrom": "+919811100001",
            "tenant_id": "tenant_leela",
        }
        r = _post_signed("/webhooks/exotel/inbound", payload)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "mapped"
        assert body["tenant_id"] == "tenant_taj_palace"
        assert body["conversation_created"] is False
        assert body.get("live") is False
        retry = _post_signed("/webhooks/exotel/inbound", payload)
        assert retry.json()["status"] == "duplicate"

    def test_unknown_number_is_quarantined(self):
        sid = f"CA{uuid.uuid4().hex}"
        r = _post_signed("/webhooks/exotel/inbound", {
            "CallSid": sid,
            "CallTo": f"+91000{uuid.uuid4().hex[:8]}",
            "CallFrom": "+919800000000",
        })
        assert r.json()["status"] == "quarantined"


class TestWhatsAppInboundMapping:
    def test_creates_lead_and_is_idempotent(self):
        admin = _login(ADMIN)
        wa_id = f"+91980{uuid.uuid4().hex[:8]}"
        ch = admin.post(f"{API}/admin/tenants/tenant_taj_palace/channels", json={
            "type": "whatsapp",
            "connected_identifier": wa_id,
            "assigned_ai_employee_id": "ae_taj_aria",
        })
        assert ch.status_code == 200, ch.text
        wamid = f"wamid.{uuid.uuid4().hex}"
        payload = {
            "wamid": wamid,
            "from": "+919812345678",
            "to": wa_id,
            "text": "Need a modular kitchen quote for a 10x12 space",
            "tenant_id": "tenant_leela",
        }
        r = _post_signed("/webhooks/whatsapp", payload)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "ingested"
        assert body["tenant_id"] == "tenant_taj_palace"
        assert body.get("lead_id")
        retry = _post_signed("/webhooks/whatsapp", payload)
        assert retry.json()["status"] == "duplicate"
        taj = _login(TAJ)
        leads = taj.get(f"{API}/tenant/leads").json()
        match = next(l for l in leads if l.get("id") == body["lead_id"])
        assert match["source"] == "whatsapp"
        assert match["customer_phone"] == "+919812345678"
        assert "modular kitchen" in (match.get("enquiry_summary") or "").lower()
        assert "provider_conversation_id" not in match
        leela = _login(LEELA)
        listed = leela.get(f"{API}/tenant/leads").json()
        assert all(l.get("id") != body["lead_id"] for l in listed)
        assert leela.get(f"{API}/tenant/leads/{body['lead_id']}").status_code == 404

    def test_owner_callback_button_persists_escalation(self):
        admin = _login(ADMIN)
        wa_id = f"+91981{uuid.uuid4().hex[:8]}"
        admin.post(f"{API}/admin/tenants/tenant_taj_palace/channels", json={
            "type": "whatsapp", "connected_identifier": wa_id, "assigned_ai_employee_id": "ae_taj_aria",
        })
        payload = {
            "wamid": f"wamid.{uuid.uuid4().hex}",
            "from": "+919800011122",
            "to": wa_id,
            "text": "Please have the owner call me",
            "button_payload": "OWNER_CALLBACK",
        }
        r = _post_signed("/webhooks/whatsapp", payload)
        assert r.status_code == 200, r.text
        taj = _login(TAJ)
        lead = taj.get(f"{API}/tenant/leads/{r.json()['lead_id']}").json()
        assert lead["owner_callback_requested"] is True
        assert lead["owner_callback_status"] == "requested"
        assert lead["callback_requests"]


class TestFormIntake:
    def test_creates_lead_without_trusting_tenant_id(self):
        admin = _login(ADMIN)
        key = admin.post(f"{API}/admin/tenants/tenant_taj_palace/intake-key").json()["intake_key"]
        assert key.startswith("ik_")
        idem = f"idemp-{uuid.uuid4().hex}"
        r = requests.post(f"{API}/intake/{key}", json={
            "source": "website",
            "name": "Anita Desai",
            "phone": "+919700011122",
            "requirement": "Interior design for a 3BHK in Pune",
            "tenant_id": "tenant_leela",
            "idempotency_key": idem,
        }, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "ingested"
        assert "tenant_id" not in body
        retry = requests.post(f"{API}/intake/{key}", json={
            "source": "website",
            "name": "Anita Desai",
            "phone": "+919700011122",
            "requirement": "Interior design for a 3BHK in Pune",
            "idempotency_key": idem,
        }, timeout=15)
        assert retry.json()["status"] == "duplicate"
        assert retry.json()["lead_id"] == body["lead_id"]
        taj = _login(TAJ)
        lead = taj.get(f"{API}/tenant/leads/{body['lead_id']}").json()
        assert lead["source"] == "website"
        assert lead["customer_name"] == "Anita Desai"
        assert lead["tenant_id"] == "tenant_taj_palace"
        leela = _login(LEELA)
        assert leela.get(f"{API}/tenant/leads/{body['lead_id']}").status_code == 404
        chans = taj.get(f"{API}/tenant/channels").json()
        form = next(c for c in chans if c["type"] == "form")
        assert form["intake_path"].endswith(key)
        assert "provider" not in form

    def test_unknown_intake_key_404(self):
        r = requests.post(f"{API}/intake/ik_doesnotexist", json={
            "name": "X", "requirement": "hello",
        }, timeout=15)
        assert r.status_code == 404

    def test_empty_enquiry_rejected(self):
        admin = _login(ADMIN)
        key = admin.post(f"{API}/admin/tenants/tenant_taj_palace/intake-key").json()["intake_key"]
        r = requests.post(f"{API}/intake/{key}", json={"tenant_id": "tenant_taj_palace"}, timeout=15)
        assert r.status_code == 400

    def test_tenant_cannot_rotate_intake_key(self):
        taj = _login(TAJ)
        assert taj.post(f"{API}/admin/tenants/tenant_taj_palace/intake-key").status_code == 403

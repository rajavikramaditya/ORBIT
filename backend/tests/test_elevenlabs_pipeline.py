"""End-to-end ElevenLabs ↔ ORBIT pipeline wiring.

Covers tenant isolation, business-data honesty, webhook/tool-call idempotency,
lead de-dupe, missing optional fields, recording-optional ingest, usage
idempotency, unknown/suspended agents, malformed payloads, intake and channel
isolation, provider fallback, and generic (non-hotel) business data.
"""
import hmac
import hashlib
import json
import os
import time
import uuid

import requests

from connectors import get_orbit_live_connector, connector_supports
from ingest import _recording_ref, _derive_outcome, _as_int
from security import verify_elevenlabs_signature

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


def _post(path, payload):
    raw = json.dumps(payload).encode()
    return requests.post(
        f"{API}{path}",
        data=raw,
        headers={"X-Orbit-Signature": _sig(raw), "Content-Type": "application/json"},
        timeout=15,
    )


def _post_call(payload):
    return _post("/webhooks/elevenlabs/post-call", payload)


def _tool_call(payload):
    return _post("/webhooks/elevenlabs/tool-call", payload)


class TestElevenLabsSignature:
    def test_timestamped_hmac_and_replay_window(self):
        secret = "el_test_secret"
        body = b'{"ok":true}'
        ts = str(int(time.time()))
        digest = hmac.new(secret.encode(), ts.encode() + b"." + body, hashlib.sha256).hexdigest()
        assert verify_elevenlabs_signature(body, f"t={ts},v0={digest}", secret) is True
        assert verify_elevenlabs_signature(body, f"t=1,v0={digest}", secret) is False
        body_only = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
        assert verify_elevenlabs_signature(body, body_only, secret) is True
        assert verify_elevenlabs_signature(body, "deadbeef", secret) is False

    def test_recording_ref_is_not_invented(self):
        assert _recording_ref({}, {}) is None
        assert _recording_ref({}, {"recording_url": "https://elevenlabs.io/audio/abc"}) == "https://elevenlabs.io/audio/abc"
        assert _derive_outcome(False, None, {}) is None
        assert _derive_outcome(True, "success", {}) == "follow_up_required"
        assert _as_int("12.0") == 12
        assert _as_int("nope") == 0


class TestGenericBusinessData:
    def test_modular_interior_catalogue_and_honest_miss(self):
        data = {
            "catalogue_url": "https://abc-modular.example/brochure.pdf",
            "services": [
                {"name": "Modular Kitchen", "price": "from 2.5L"},
                {"name": "Wardrobe", "price": "from 1.2L"},
                {"name": "Full Home Interior", "price": None},
                {"name": "Renovation"},
                {"name": "Civil Work"},
            ],
            "extra": {
                "hours": "Mon–Sat 10:00 AM – 7:00 PM",
                "website": "https://abc-modular.example",
            },
        }
        connector = get_orbit_live_connector(data)
        cat = connector.read("get_catalogue", {})
        assert cat["mock"] is False
        names = [s["name"] for s in cat["result"]["services"]]
        assert "Modular Kitchen" in names
        assert cat["result"]["catalogue_url"] == "https://abc-modular.example/brochure.pdf"
        assert cat["result"]["send_via"] == "elevenlabs"
        kitchen = connector.read("check_availability", {"service": "modular kitchen"})
        assert kitchen["result"]["found"] is True
        assert kitchen["result"]["unit_type"] == "Modular Kitchen"
        assert kitchen["result"]["rate"]["amount"] == "from 2.5L"
        missing = connector.read("check_availability", {"service": "swimming pool"})
        assert missing["result"]["found"] is False
        assert missing["result"]["available"] is False
        assert "owner confirmation" in missing["result"]["message"].lower()
        hours = connector.read("get_business_policy", {"category": "hours"})
        assert hours["result"]["hours"] == "Mon–Sat 10:00 AM – 7:00 PM"
        site = connector.read("get_business_policy", {"category": "website"})
        assert site["result"]["website"] == "https://abc-modular.example"
        empty = get_orbit_live_connector({})
        none = empty.read("get_services", {})
        assert none["result"]["found"] is False
        assert connector_supports("orbit_live", "get_menu", "read") is True


class TestTenantIsolationToolCall:
    def test_agent_mapping_ignores_payload_tenant_id(self):
        unique = f"from {uuid.uuid4().hex[:6]}"
        taj = _login(TAJ)
        patched = taj.patch(f"{API}/tenant/live-data", json={
            "services": [{"name": f"Taj only {unique}", "price": "n/a"}],
            "catalogue_url": "https://taj.example/cat.pdf",
        })
        assert patched.status_code == 200, patched.text
        r = _tool_call({
            "agent_id": "agent_taj_aria_001",
            "tool_name": "get_catalogue",
            "tenant_id": "tenant_leela_blr",
            "parameters": {},
        })
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "ok"
        names = [s.get("name") for s in (body.get("data") or {}).get("services") or []]
        assert any(unique in (n or "") for n in names)
        leela = _login(LEELA)
        listed = leela.get(f"{API}/tenant/live-data").json()
        leela_services = listed.get("services") or []
        assert all(unique not in str(s) for s in leela_services)

    def test_unknown_agent_rejected(self):
        r = _tool_call({
            "agent_id": "agent_does_not_exist",
            "tool_name": "get_catalogue",
            "parameters": {},
        })
        assert r.status_code == 404

    def test_suspended_agent_rejected(self):
        admin = _login(ADMIN)
        tname = f"Pipe_{uuid.uuid4().hex[:6]}"
        created = admin.post(f"{API}/admin/tenants", json={
            "name": tname,
            "owner_email": f"pipe_{uuid.uuid4().hex[:8]}@example.com",
            "owner_name": "Pipe Owner",
            "owner_password": "PipePass@123",
        })
        assert created.status_code == 200, created.text
        tenant_id = created.json()["id"]
        agent_id = f"agent_pipe_{uuid.uuid4().hex[:8]}"
        ae = admin.post(f"{API}/admin/tenants/{tenant_id}/ai-employees", json={
            "name": "PipeBot", "role_title": "Assistant", "provider_agent_id": agent_id,
        })
        assert ae.status_code == 200, ae.text
        ae_id = ae.json()["id"]
        assert ae.json()["lifecycle_state"] == "draft"
        draft = _tool_call({"agent_id": agent_id, "tool_name": "get_catalogue", "parameters": {}})
        assert draft.status_code == 200
        assert draft.json()["status"] == "unavailable"
        for state in ("testing", "approved", "live", "suspended"):
            r = admin.patch(f"{API}/admin/ai-employees/{ae_id}/lifecycle", json={"to_state": state})
            assert r.status_code == 200, r.text
        suspended = _tool_call({"agent_id": agent_id, "tool_name": "get_catalogue", "parameters": {}})
        assert suspended.status_code == 200
        assert suspended.json()["status"] == "unavailable"

    def test_malformed_webhook_rejected(self):
        raw = b"[1,2,3]"
        r = requests.post(
            f"{API}/webhooks/elevenlabs/post-call",
            data=raw,
            headers={"X-Orbit-Signature": _sig(raw), "Content-Type": "application/json"},
            timeout=15,
        )
        assert r.status_code == 400
        r2 = _post_call({"data": ["not", "an", "object"]})
        assert r2.status_code == 400
        r3 = _post_call({"data": {"agent_id": "agent_taj_aria_001"}})
        assert r3.status_code == 200
        assert r3.json()["status"] == "rejected"


class TestBusinessDataChangeAndFallback:
    def test_next_tool_call_sees_updated_value(self):
        taj = _login(TAJ)
        marker = f"rate-{uuid.uuid4().hex[:8]}"
        r = taj.patch(f"{API}/tenant/live-data", json={
            "services": [{"name": "Modular Kitchen", "price": marker}],
            "catalogue_url": "https://example.com/old.pdf",
        })
        assert r.status_code == 200, r.text
        first = _tool_call({
            "agent_id": "agent_taj_aria_001",
            "tool_name": "get_services",
            "parameters": {},
        })
        assert first.json()["status"] == "ok"
        prices = [s.get("price") for s in first.json()["data"]["services"]]
        assert marker in prices
        marker2 = f"rate-{uuid.uuid4().hex[:8]}"
        taj.patch(f"{API}/tenant/live-data", json={
            "services": [{"name": "Modular Kitchen", "price": marker2}],
        })
        second = _tool_call({
            "agent_id": "agent_taj_aria_001",
            "tool_name": "get_services",
            "parameters": {},
        })
        prices2 = [s.get("price") for s in second.json()["data"]["services"]]
        assert marker2 in prices2
        assert marker not in prices2

    def test_provider_failure_fallback_is_honest(self):
        r = _tool_call({
            "agent_id": "agent_taj_aria_001",
            "tool_name": "create_booking",
            "parameters": {"room_type": "Deluxe"},
        })
        assert r.status_code == 200
        assert r.json()["status"] == "unsupported"
        assert "data" not in r.json() or r.json().get("data") is None


class TestPostCallIdempotencyAndRecording:
    def test_duplicate_post_call_and_usage_not_double_billed(self):
        conv_id = f"conv_pipe_{uuid.uuid4().hex[:10]}"
        payload = {"data": {
            "agent_id": "agent_taj_aria_001",
            "conversation_id": conv_id,
            "status": "done",
            "transcript": [{"role": "user", "message": "Modular kitchen ka kaam karte ho?"}],
            "metadata": {
                "call_duration_secs": 77,
                "phone_call": {"direction": "inbound", "external_number": "+919811100099"},
            },
            "analysis": {
                "call_summary_title": "Kitchen enquiry",
                "transcript_summary": "Asked about modular kitchen work.",
                "call_successful": "success",
                "custom_analysis_data": {
                    "caller_name": "Ravi",
                    "enquiry": "10x12 kitchen quote",
                    "service": "Modular Kitchen",
                    "follow_up_required": True,
                },
            },
        }}
        r1 = _post_call(payload)
        assert r1.json()["status"] == "ingested"
        conv = r1.json()["conversation"]
        assert conv["recording_ref"] is None
        assert conv["duration_secs"] == 77
        assert conv["external_number"] == "+919811100099"
        assert conv["caller_name"] == "Ravi"
        r2 = _post_call(payload)
        assert r2.json()["status"] == "duplicate"
        taj = _login(TAJ)
        convs = taj.get(f"{API}/tenant/conversations").json()
        same = [c for c in convs if c["id"] == conv["id"]]
        assert len(same) == 1
        detail = taj.get(f"{API}/tenant/conversations/{conv['id']}").json()
        assert detail.get("recording_ref") in (None, "")
        assert "provider_conversation_id" not in detail
        leads = [l for l in taj.get(f"{API}/tenant/leads").json() if l.get("conversation_id") == conv["id"]]
        assert len(leads) == 1

    def test_missing_optional_fields_and_recording_still_creates(self):
        conv_id = f"conv_sparse_{uuid.uuid4().hex[:10]}"
        r = _post_call({"data": {
            "agent_id": "agent_taj_aria_001",
            "conversation_id": conv_id,
            "status": "done",
            "metadata": {},
            "analysis": {},
        }})
        assert r.json()["status"] == "ingested"
        conv = r.json()["conversation"]
        assert conv["recording_ref"] is None
        assert conv["duration_secs"] == 0
        assert conv["transcript"] == []
        assert conv["summary"] == ""
        assert conv.get("outcome") in (None, "")
        assert conv.get("caller_name") is None
        taj = _login(TAJ)
        detail = taj.get(f"{API}/tenant/conversations/{conv['id']}")
        assert detail.status_code == 200
        assert "transcript" in detail.json()

    def test_whatsapp_metadata_maps_channel_not_phone(self):
        conv_id = f"conv_wa_{uuid.uuid4().hex[:10]}"
        r = _post_call({"data": {
            "agent_id": "agent_taj_aria_001",
            "conversation_id": conv_id,
            "status": "done",
            "transcript": [{"role": "user", "message": "Catalogue WhatsApp par bhej sakte ho?"}],
            "metadata": {
                "call_duration_secs": 20,
                "whatsapp": {"direction": "inbound", "user_id": "+919800011122"},
            },
            "analysis": {
                "transcript_summary": "Asked for catalogue on WhatsApp.",
                "custom_analysis_data": {"enquiry": "Please send catalogue", "source": "whatsapp"},
            },
        }})
        assert r.json()["status"] == "ingested"
        conv = r.json()["conversation"]
        assert conv["external_number"] == "+919800011122"
        taj = _login(TAJ)
        lead = next(l for l in taj.get(f"{API}/tenant/leads").json() if l.get("conversation_id") == conv["id"])
        assert lead["source"] == "whatsapp"


class TestToolCallAndLeadDedup:
    def test_duplicate_tool_callback_does_not_duplicate_lead(self):
        tool_call_id = f"tc_{uuid.uuid4().hex}"
        conv_id = f"conv_tool_{uuid.uuid4().hex[:10]}"
        payload = {
            "agent_id": "agent_taj_aria_001",
            "conversation_id": conv_id,
            "tool_call_id": tool_call_id,
            "tool_name": "capture_lead",
            "parameters": {
                "customer_name": "Neha",
                "phone": f"+9198444{uuid.uuid4().hex[:4]}",
                "enquiry": "Full home interior for 3BHK",
                "service": "Full Home Interior",
            },
        }
        r1 = _tool_call(payload)
        assert r1.json()["status"] == "ok"
        lead_id = r1.json()["lead_id"]
        assert lead_id
        r2 = _tool_call(payload)
        assert r2.json()["status"] == "ok"
        assert r2.json()["lead_id"] == lead_id
        taj = _login(TAJ)
        leads = [l for l in taj.get(f"{API}/tenant/leads").json() if l.get("id") == lead_id]
        assert len(leads) == 1
        assert leads[0]["customer_name"] == "Neha"
        assert leads[0]["budget_value"] is None

    def test_duplicate_capture_lead_same_conversation(self):
        conv_id = f"conv_cap_{uuid.uuid4().hex[:10]}"
        phone = f"+9198555{uuid.uuid4().hex[:4]}"
        first = _tool_call({
            "agent_id": "agent_taj_aria_001",
            "conversation_id": conv_id,
            "tool_call_id": f"tc_{uuid.uuid4().hex}",
            "tool_name": "capture_lead",
            "parameters": {"phone": phone, "enquiry": "Wardrobe quote"},
        })
        second = _tool_call({
            "agent_id": "agent_taj_aria_001",
            "conversation_id": conv_id,
            "tool_call_id": f"tc_{uuid.uuid4().hex}",
            "tool_name": "capture_lead",
            "parameters": {"phone": phone, "enquiry": "Wardrobe quote", "customer_name": "Amit"},
        })
        assert first.json()["lead_id"] == second.json()["lead_id"]
        taj = _login(TAJ)
        lead = taj.get(f"{API}/tenant/leads/{first.json()['lead_id']}").json()
        assert lead["customer_name"] == "Amit"
        assert lead["customer_phone"] == phone

    def test_nested_tool_call_envelope(self):
        r = _tool_call({
            "type": "tool_request",
            "tenant_id": "tenant_leela_blr",
            "data": {
                "agent_id": "agent_taj_aria_001",
                "conversation_id": f"conv_nested_{uuid.uuid4().hex[:8]}",
                "tool_call": {
                    "tool_name": "get_catalogue",
                    "tool_call_id": f"tc_{uuid.uuid4().hex}",
                    "parameters": {},
                },
            },
        })
        assert r.status_code == 200, r.text
        assert r.json()["status"] in ("ok", "unavailable")


class TestIntakeAndChannelIsolation:
    def test_intake_key_cannot_write_other_tenant(self):
        admin = _login(ADMIN)
        taj_key = admin.post(f"{API}/admin/tenants/tenant_taj_palace/intake-key").json()["intake_key"]
        leela_key = admin.post(f"{API}/admin/tenants/tenant_leela_blr/intake-key").json()["intake_key"]
        r = requests.post(f"{API}/intake/{taj_key}", json={
            "name": "Form User",
            "phone": "+919700000111",
            "requirement": "Civil work quote",
            "tenant_id": "tenant_leela_blr",
            "idempotency_key": f"ik-{uuid.uuid4().hex}",
        }, timeout=15)
        assert r.status_code == 200
        assert "tenant_id" not in r.json()
        taj = _login(TAJ)
        leela = _login(LEELA)
        lead_id = r.json()["lead_id"]
        assert taj.get(f"{API}/tenant/leads/{lead_id}").status_code == 200
        assert leela.get(f"{API}/tenant/leads/{lead_id}").status_code == 404
        assert leela_key != taj_key

    def test_channel_identifier_cannot_map_two_tenants(self):
        admin = _login(ADMIN)
        number = f"+91971{uuid.uuid4().hex[:8]}"
        first = admin.post(f"{API}/admin/tenants/tenant_taj_palace/channels", json={
            "type": "phone",
            "connected_identifier": number,
            "assigned_ai_employee_id": "ae_taj_aria",
        })
        assert first.status_code == 200, first.text
        second = admin.post(f"{API}/admin/tenants/tenant_leela_blr/channels", json={
            "type": "phone",
            "connected_identifier": number,
            "assigned_ai_employee_id": "ae_leela_kai",
        })
        assert second.status_code == 400
        inbound = _post("/webhooks/exotel/inbound", {
            "CallSid": f"CA{uuid.uuid4().hex}",
            "CallTo": number,
            "CallFrom": "+919800000001",
            "tenant_id": "tenant_leela_blr",
        })
        assert inbound.json()["status"] == "mapped"
        assert inbound.json()["tenant_id"] == "tenant_taj_palace"
        assert inbound.json()["conversation_created"] is False

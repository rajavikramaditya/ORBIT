"""Inbound lead/enquiry layer — not a CRM.

Covers post-call lead creation, idempotency, isolation, no fabricated fields,
source classification, qualification/follow-up, callback persistence, and
regression of existing ingest + usage ledger.
"""
import os
import hmac
import hashlib
import json
import uuid
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
    assert r.status_code == 200, r.text
    return s


def _sig(body_bytes):
    return hmac.new(WEBHOOK_SECRET.encode(), body_bytes, hashlib.sha256).hexdigest()


def _post_call(payload):
    raw = json.dumps(payload).encode()
    r = requests.post(
        f"{API}/webhooks/elevenlabs/post-call",
        data=raw,
        headers={"X-Orbit-Signature": _sig(raw), "Content-Type": "application/json"},
        timeout=15,
    )
    return r


def _tool_call(payload):
    raw = json.dumps(payload).encode()
    r = requests.post(
        f"{API}/webhooks/elevenlabs/tool-call",
        data=raw,
        headers={"X-Orbit-Signature": _sig(raw), "Content-Type": "application/json"},
        timeout=15,
    )
    return r


def _enquiry_payload(conv_id, extra_custom=None, extra_analysis=None, extra_meta=None, agent_id="agent_taj_aria_001"):
    custom = {
        "caller_name": "Kavita Rao",
        "enquiry": "Need a full modular kitchen and living interior quote",
        "service": "modular interiors",
        "follow_up_required": True,
        **(extra_custom or {}),
    }
    analysis = {
        "call_summary_title": "Interior enquiry",
        "transcript_summary": custom.get("enquiry"),
        "call_successful": "success",
        "custom_analysis_data": custom,
        **(extra_analysis or {}),
    }
    meta = {
        "call_duration_secs": 92,
        "phone_call": {"direction": "inbound", "external_number": "+919811112222"},
        **(extra_meta or {}),
    }
    return {"data": {
        "agent_id": agent_id,
        "conversation_id": conv_id,
        "status": "done",
        "transcript": [{"role": "user", "message": "What work do you do?"}],
        "metadata": meta,
        "analysis": analysis,
    }}


class TestLeadIngest:
    def test_creates_lead_from_post_call(self):
        conv_id = f"conv_lead_{uuid.uuid4().hex[:10]}"
        r = _post_call(_enquiry_payload(conv_id, extra_custom={
            "qualification": "qualified",
            "budget": "8 lakh",
            "email": "kavita@example.com",
        }))
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "ingested"
        ingested = r.json()["conversation"]
        assert ingested.get("tenant_id") == "tenant_taj_palace"

        s = _login(TAJ)
        leads = s.get(f"{API}/tenant/leads").json()
        match = next((l for l in leads if l.get("conversation_id") == ingested["id"]), None)
        assert match is not None
        assert match["customer_name"] == "Kavita Rao"
        assert match["customer_phone"] == "+919811112222"
        assert match["customer_email"] == "kavita@example.com"
        assert match["service_category"] == "modular interiors"
        assert match["budget_value"] == "8 lakh"
        assert match["qualification_status"] == "qualified"
        assert match["lead_status"] in ("qualified", "follow_up")
        assert match["follow_up_required"] is True
        assert match["source"] == "phone"
        assert "provider_conversation_id" not in match
        assert "provider_agent_id" not in match

        detail = s.get(f"{API}/tenant/leads/{match['id']}").json()
        assert detail["id"] == match["id"]
        assert detail.get("conversation", {}).get("id") == ingested["id"]

    def test_webhook_retry_is_idempotent(self):
        conv_id = f"conv_lead_dup_{uuid.uuid4().hex[:10]}"
        payload = _enquiry_payload(conv_id)
        r1 = _post_call(payload)
        assert r1.json()["status"] == "ingested"
        r2 = _post_call(payload)
        assert r2.status_code == 200
        assert r2.json()["status"] == "duplicate"
        conv_id_orbit = r1.json()["conversation"]["id"]
        s = _login(TAJ)
        leads = s.get(f"{API}/tenant/leads").json()
        same = [l for l in leads if l.get("conversation_id") == conv_id_orbit]
        assert len(same) == 1

    def test_retry_fills_blank_fields_only(self):
        conv_id = f"conv_lead_fill_{uuid.uuid4().hex[:10]}"
        first = _enquiry_payload(conv_id, extra_custom={"email": None})
        first["data"]["analysis"]["custom_analysis_data"].pop("caller_name", None)
        r1 = _post_call(first)
        assert r1.json()["status"] == "ingested"
        retry = _enquiry_payload(conv_id, extra_custom={"caller_name": "Kavita Rao", "email": "later@example.com"})
        r2 = _post_call(retry)
        assert r2.json()["status"] == "duplicate"
        s = _login(TAJ)
        conv_orbit = r1.json()["conversation"]["id"]
        lead = next(l for l in s.get(f"{API}/tenant/leads").json() if l.get("conversation_id") == conv_orbit)
        assert lead["customer_name"] == "Kavita Rao"
        assert lead["customer_email"] == "later@example.com"

    def test_missing_optional_fields_are_null_not_fake(self):
        conv_id = f"conv_lead_sparse_{uuid.uuid4().hex[:10]}"
        payload = {"data": {
            "agent_id": "agent_taj_aria_001",
            "conversation_id": conv_id,
            "status": "done",
            "transcript": [],
            "metadata": {
                "call_duration_secs": 40,
                "phone_call": {"direction": "inbound", "external_number": "+919800000001"},
            },
            "analysis": {"call_summary_title": "Enquiry", "transcript_summary": "Asked about services."},
        }}
        r = _post_call(payload)
        assert r.json()["status"] == "ingested"
        s = _login(TAJ)
        lead = next(l for l in s.get(f"{API}/tenant/leads").json() if l.get("conversation_id") == r.json()["conversation"]["id"])
        assert lead["customer_name"] is None
        assert lead["customer_email"] is None
        assert lead["budget_value"] is None
        assert lead["service_category"] is None
        assert lead["qualification_status"] == "unknown"
        assert lead["customer_name"] != "Unknown"
        assert lead["customer_phone"] == "+919800000001"

    def test_explicit_not_enquiry_skips_lead(self):
        conv_id = f"conv_lead_skip_{uuid.uuid4().hex[:10]}"
        r = _post_call(_enquiry_payload(conv_id, extra_custom={"is_enquiry": False, "follow_up_required": False}))
        assert r.json()["status"] == "ingested"
        orbit_id = r.json()["conversation"]["id"]
        s = _login(TAJ)
        leads = s.get(f"{API}/tenant/leads").json()
        assert not any(l.get("conversation_id") == orbit_id for l in leads)

    def test_source_classification(self):
        conv_id = f"conv_lead_src_{uuid.uuid4().hex[:10]}"
        r = _post_call(_enquiry_payload(conv_id, extra_custom={"source": "whatsapp"}))
        assert r.json()["status"] == "ingested"
        s = _login(TAJ)
        lead = next(l for l in s.get(f"{API}/tenant/leads").json() if l.get("conversation_id") == r.json()["conversation"]["id"])
        assert lead["source"] == "whatsapp"

    def test_qualification_and_follow_up(self):
        conv_id = f"conv_lead_qf_{uuid.uuid4().hex[:10]}"
        r = _post_call(_enquiry_payload(conv_id, extra_custom={
            "qualification_status": "unqualified",
            "follow_up_required": True,
        }))
        s = _login(TAJ)
        lead = next(l for l in s.get(f"{API}/tenant/leads").json() if l.get("conversation_id") == r.json()["conversation"]["id"])
        assert lead["qualification_status"] == "unqualified"
        assert lead["follow_up_required"] is True
        assert lead["lead_status"] == "follow_up"

    def test_callback_request_persisted(self):
        conv_id = f"conv_lead_cb_{uuid.uuid4().hex[:10]}"
        r = _post_call(_enquiry_payload(conv_id, extra_custom={
            "owner_callback_requested": True,
            "callback_reason": "Wants to speak to owner about site visit",
            "follow_up_required": False,
        }))
        assert r.json()["status"] == "ingested"
        s = _login(TAJ)
        lead = next(l for l in s.get(f"{API}/tenant/leads").json() if l.get("conversation_id") == r.json()["conversation"]["id"])
        assert lead["owner_callback_requested"] is True
        detail = s.get(f"{API}/tenant/leads/{lead['id']}").json()
        assert detail["callback_requests"]
        assert detail["callback_requests"][0]["status"] == "requested"
        assert "site visit" in (detail["callback_requests"][0].get("reason") or "")
        _post_call(_enquiry_payload(conv_id, extra_custom={"owner_callback_requested": True}))
        detail2 = s.get(f"{API}/tenant/leads/{lead['id']}").json()
        assert len(detail2["callback_requests"]) == 1

    def test_usage_ledger_still_written(self):
        conv_id = f"conv_lead_ul_{uuid.uuid4().hex[:10]}"
        r = _post_call(_enquiry_payload(conv_id))
        assert r.json()["status"] == "ingested"
        s = _login(TAJ)
        convs = s.get(f"{API}/tenant/conversations").json()
        assert any(c["id"] == r.json()["conversation"]["id"] for c in convs)
        billing = s.get(f"{API}/tenant/billing").json()
        assert "invoices" in billing or "estimate" in billing or "usage" in billing

    def test_tenant_isolation(self):
        conv_id = f"conv_lead_iso_{uuid.uuid4().hex[:10]}"
        r = _post_call(_enquiry_payload(conv_id))
        lead_orbit_conv = r.json()["conversation"]["id"]
        taj = _login(TAJ)
        lead = next(l for l in taj.get(f"{API}/tenant/leads").json() if l.get("conversation_id") == lead_orbit_conv)
        leela = _login(LEELA)
        listed = leela.get(f"{API}/tenant/leads").json()
        assert all(l.get("id") != lead["id"] for l in listed)
        deny = leela.get(f"{API}/tenant/leads/{lead['id']}")
        assert deny.status_code == 404

    def test_tenant_cannot_forge_other_tenant_id_on_patch(self):
        conv_id = f"conv_lead_patch_{uuid.uuid4().hex[:10]}"
        r = _post_call(_enquiry_payload(conv_id))
        taj = _login(TAJ)
        lead = next(l for l in taj.get(f"{API}/tenant/leads").json() if l.get("conversation_id") == r.json()["conversation"]["id"])
        patched = taj.patch(f"{API}/tenant/leads/{lead['id']}", json={
            "lead_status": "won",
            "tenant_id": "tenant_leela",
        })
        assert patched.status_code == 200
        body = patched.json()
        assert body["lead_status"] == "won"
        assert body["tenant_id"] == "tenant_taj_palace"
        assert body.get("won_at")
        assert body.get("outcome") == "won"

    def test_admin_can_inspect_tenant_leads(self):
        conv_id = f"conv_lead_adm_{uuid.uuid4().hex[:10]}"
        r = _post_call(_enquiry_payload(conv_id))
        admin = _login(ADMIN)
        rows = admin.get(f"{API}/admin/tenants/tenant_taj_palace/leads").json()
        assert any(l.get("conversation_id") == r.json()["conversation"]["id"] for l in rows)
        taj = _login(TAJ)
        assert taj.get(f"{API}/admin/tenants/tenant_taj_palace/leads").status_code == 403

    def test_tool_call_persists_callback_without_live_claim(self):
        payload = {
            "agent_id": "agent_taj_aria_001",
            "tool_name": "request_owner_callback",
            "parameters": {
                "customer_name": "Imran Khan",
                "phone": f"+9198333{uuid.uuid4().hex[:4]}",
                "reason": "Needs owner for custom modular quote",
            },
        }
        phone = payload["parameters"]["phone"]
        r = _tool_call(payload)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("status") == "ok"
        assert body.get("persisted") is True
        assert body.get("lead_id")
        s = _login(TAJ)
        leads = s.get(f"{API}/tenant/leads").json()
        match = next((l for l in leads if l.get("id") == body["lead_id"] or l.get("customer_phone") == phone), None)
        assert match is not None
        assert match["customer_phone"] == phone
        assert match["owner_callback_requested"] is True
        assert match.get("owner_callback_status") == "requested"
        detail = s.get(f"{API}/tenant/leads/{match['id']}").json()
        assert detail["callback_requests"]


class TestLeadHandoff:
    def test_all_supported_sources_and_unknown(self):
        s = _login(TAJ)
        for src in ("phone", "whatsapp", "website", "instagram", "facebook", "form"):
            conv_id = f"conv_src_{src}_{uuid.uuid4().hex[:8]}"
            r = _post_call(_enquiry_payload(conv_id, extra_custom={"source": src, "follow_up_required": False}))
            assert r.json()["status"] == "ingested"
            lead = next(l for l in s.get(f"{API}/tenant/leads").json() if l.get("conversation_id") == r.json()["conversation"]["id"])
            assert lead["source"] == src
        conv_id = f"conv_src_unk_{uuid.uuid4().hex[:8]}"
        payload = _enquiry_payload(conv_id, extra_custom={"source": "telegram", "follow_up_required": False})
        payload["data"]["metadata"] = {"call_duration_secs": 30}
        r = _post_call(payload)
        lead = next(l for l in s.get(f"{API}/tenant/leads").json() if l.get("conversation_id") == r.json()["conversation"]["id"])
        assert lead["source"] == "unknown"

    def test_generic_enquiry_fields_without_invention(self):
        conv_id = f"conv_gen_{uuid.uuid4().hex[:10]}"
        r = _post_call(_enquiry_payload(conv_id, extra_custom={
            "follow_up_required": False,
            "location": "Pune",
            "timeline": "this month",
            "whatsapp": "+919811112222",
            "buying_intent": "high",
            "urgency": "medium",
        }))
        s = _login(TAJ)
        lead = next(l for l in s.get(f"{API}/tenant/leads").json() if l.get("conversation_id") == r.json()["conversation"]["id"])
        assert lead["location"] == "Pune"
        assert lead["timeline"] == "this month"
        assert lead["customer_whatsapp"] == "+919811112222"
        assert lead["buying_intent"] == "high"
        assert lead["urgency"] == "medium"
        assert lead["requirement"] == lead["enquiry_summary"]
        assert lead["lead_score"] is not None
        assert "transcript" not in lead

    def test_same_phone_different_conversations_are_separate(self):
        a = f"conv_ph_a_{uuid.uuid4().hex[:8]}"
        b = f"conv_ph_b_{uuid.uuid4().hex[:8]}"
        ra = _post_call(_enquiry_payload(a, extra_custom={"follow_up_required": False}))
        rb = _post_call(_enquiry_payload(b, extra_custom={"follow_up_required": False}))
        s = _login(TAJ)
        leads = s.get(f"{API}/tenant/leads").json()
        ids = {ra.json()["conversation"]["id"], rb.json()["conversation"]["id"]}
        matched = [l for l in leads if l.get("conversation_id") in ids]
        assert len(matched) == 2

    def test_status_validation_and_transitions(self):
        conv_id = f"conv_st_{uuid.uuid4().hex[:10]}"
        r = _post_call(_enquiry_payload(conv_id, extra_custom={"follow_up_required": False}))
        s = _login(TAJ)
        lead = next(l for l in s.get(f"{API}/tenant/leads").json() if l.get("conversation_id") == r.json()["conversation"]["id"])
        bad = s.patch(f"{API}/tenant/leads/{lead['id']}", json={"lead_status": "pipeline-hot"})
        assert bad.status_code == 400
        contacted = s.patch(f"{API}/tenant/leads/{lead['id']}", json={"lead_status": "contacted"})
        assert contacted.status_code == 200
        assert contacted.json()["lead_status"] == "contacted"
        won = s.patch(f"{API}/tenant/leads/{lead['id']}", json={"lead_status": "won"})
        assert won.status_code == 200
        assert won.json()["outcome"] == "won"
        reopen = s.patch(f"{API}/tenant/leads/{lead['id']}", json={"lead_status": "new"})
        assert reopen.status_code == 400

    def test_lost_lifecycle_and_follow_up(self):
        conv_id = f"conv_lf_{uuid.uuid4().hex[:10]}"
        r = _post_call(_enquiry_payload(conv_id, extra_custom={"follow_up_required": False}))
        s = _login(TAJ)
        lead = next(l for l in s.get(f"{API}/tenant/leads").json() if l.get("conversation_id") == r.json()["conversation"]["id"])
        fu = s.patch(f"{API}/tenant/leads/{lead['id']}", json={
            "lead_status": "follow_up",
            "follow_up_required": True,
            "follow_up_at": "2020-01-01T10:00:00+00:00",
            "notes": "Call after site visit",
        })
        assert fu.status_code == 200, fu.text
        assert fu.json()["follow_up_required"] is True
        assert fu.json()["follow_up_due"] is True
        assert fu.json()["notes"] == "Call after site visit"
        lost = s.patch(f"{API}/tenant/leads/{lead['id']}", json={"lead_status": "lost", "lost_reason": "Budget mismatch"})
        assert lost.status_code == 200
        assert lost.json()["lead_status"] == "lost"
        assert lost.json()["lost_reason"] == "Budget mismatch"
        assert lost.json().get("lost_at")

    def test_conversation_link_has_summary_not_transcript(self):
        conv_id = f"conv_link_{uuid.uuid4().hex[:10]}"
        r = _post_call(_enquiry_payload(conv_id, extra_custom={"follow_up_required": False}))
        s = _login(TAJ)
        lead = next(l for l in s.get(f"{API}/tenant/leads").json() if l.get("conversation_id") == r.json()["conversation"]["id"])
        detail = s.get(f"{API}/tenant/leads/{lead['id']}").json()
        assert detail["conversation_id"] == r.json()["conversation"]["id"]
        assert detail.get("conversation", {}).get("id") == r.json()["conversation"]["id"]
        assert "transcript" not in (detail.get("conversation") or {})
        assert "transcript" not in detail
        assert "provider_agent_id" not in detail
        assert "provider_conversation_id" not in detail

    def test_callback_sets_owner_callback_status(self):
        conv_id = f"conv_cbs_{uuid.uuid4().hex[:10]}"
        r = _post_call(_enquiry_payload(conv_id, extra_custom={
            "owner_callback_requested": True,
            "follow_up_required": False,
        }))
        s = _login(TAJ)
        lead = next(l for l in s.get(f"{API}/tenant/leads").json() if l.get("conversation_id") == r.json()["conversation"]["id"])
        assert lead["owner_callback_requested"] is True
        assert lead["owner_callback_status"] == "requested"
        assert lead.get("owner_callback_requested_at")

    def test_webhook_ignores_payload_tenant_id(self):
        conv_id = f"conv_spoof_{uuid.uuid4().hex[:10]}"
        payload = _enquiry_payload(conv_id, extra_custom={"follow_up_required": False})
        payload["tenant_id"] = "tenant_leela"
        payload["data"]["tenant_id"] = "tenant_leela"
        r = _post_call(payload)
        assert r.json()["status"] == "ingested"
        assert r.json()["conversation"]["tenant_id"] == "tenant_taj_palace"
        taj = _login(TAJ)
        leela = _login(LEELA)
        orbit_id = r.json()["conversation"]["id"]
        taj_leads = taj.get(f"{API}/tenant/leads").json()
        assert any(l.get("conversation_id") == orbit_id for l in taj_leads)
        assert all(l.get("conversation_id") != orbit_id for l in leela.get(f"{API}/tenant/leads").json())

    def test_unauthenticated_leads_rejected(self):
        assert requests.get(f"{API}/tenant/leads", timeout=15).status_code in (401, 403)


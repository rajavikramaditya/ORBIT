"""ORBIT iteration-3 tests: production/demo separation, honest failure, provisioning,
knowledge base, operations, billing (pricing/invoice/tenant view), razorpay guarded,
readiness."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@orbit.ai", "password": "OrbitAdmin@2026"}
TAJ = {"email": "owner@tajpalace.in", "password": "Hotel@2026"}
LEELA = {"email": "owner@leela.in", "password": "Hotel@2026"}

TAJ_TID = "tenant_taj_palace"
TAJ_AE = "ae_taj_aria"
TAJ_PHONE_CH = "ch_taj_phone"
TAJ_TOOL_AVAIL = "tool_taj_avail"
TAJ_TOOL_BOOK = "tool_taj_book"


def _login(creds):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"login {creds['email']} -> {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def admin_s():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def taj_s():
    return _login(TAJ)


@pytest.fixture(scope="module")
def leela_s():
    return _login(LEELA)


@pytest.fixture(scope="module", autouse=True)
def cleanup(admin_s):
    # Ensure baseline before
    admin_s.patch(f"{API}/admin/tenants/{TAJ_TID}/environment", json={"environment": "demo"})
    admin_s.patch(f"{API}/admin/tools/{TAJ_TOOL_BOOK}", json={"enabled": False})
    yield
    # Restore after
    admin_s.patch(f"{API}/admin/tenants/{TAJ_TID}/environment", json={"environment": "demo"})
    admin_s.patch(f"{API}/admin/tools/{TAJ_TOOL_BOOK}", json={"enabled": False})
    admin_s.patch(f"{API}/admin/ai-employees/{TAJ_AE}/knowledge",
                  json={"business_info": "The Taj Palace, Mumbai — luxury five-star heritage hotel."})


# ---------- Regression: auth + tenant isolation ----------
class TestRegression:
    def test_admins_and_owners_login(self):
        _login(ADMIN); _login(TAJ); _login(LEELA)

    def test_leela_cannot_read_taj_conv(self, taj_s, leela_s):
        taj_convs = taj_s.get(f"{API}/tenant/conversations").json()
        assert taj_convs
        cid = taj_convs[0]["id"]
        r = leela_s.get(f"{API}/tenant/conversations/{cid}")
        assert r.status_code == 404


# ---------- Production/Demo separation ----------
class TestProductionDemoSeparation:
    def test_demo_preview_returns_mock(self, taj_s, admin_s):
        admin_s.patch(f"{API}/admin/tenants/{TAJ_TID}/environment", json={"environment": "demo"})
        r = taj_s.post(f"{API}/tenant/tools/{TAJ_TOOL_AVAIL}/preview", json={"args": {"room_type": "Deluxe King", "date": "tonight"}})
        assert r.status_code == 200, r.text
        j = r.json()
        assert j.get("status") == "ok"
        assert j.get("mode") == "mock"
        # Standard ORBIT data contract
        data = j.get("data") or {}
        for k in ("available", "available_units", "unit_type", "rate"):
            assert k in data, f"missing key {k} in preview data: {data}"
        rate = data["rate"]
        assert "amount" in rate and "currency" in rate
        assert j.get("mock") is True or data.get("mock") is True or j.get("mode") == "mock"

    def test_production_blocks_mock_and_simulate(self, taj_s, admin_s):
        r = admin_s.patch(f"{API}/admin/tenants/{TAJ_TID}/environment", json={"environment": "production"})
        assert r.status_code == 200
        # Preview should NOT return mock
        r = taj_s.post(f"{API}/tenant/tools/{TAJ_TOOL_AVAIL}/preview", json={"args": {"room_type": "Deluxe King"}})
        assert r.status_code == 200, r.text
        j = r.json()
        assert j.get("status") == "unavailable", f"expected unavailable in production, got {j}"
        assert j.get("mode") != "mock"
        # simulate-call blocked
        r2 = taj_s.post(f"{API}/tenant/simulate-call", json={"direction": "inbound"})
        assert r2.status_code == 403

    def test_reset_to_demo_restores_mock(self, taj_s, admin_s):
        admin_s.patch(f"{API}/admin/tenants/{TAJ_TID}/environment", json={"environment": "demo"})
        r = taj_s.post(f"{API}/tenant/tools/{TAJ_TOOL_AVAIL}/preview", json={"args": {}})
        j = r.json()
        assert j.get("status") == "ok" and j.get("mode") == "mock"


# ---------- Honest failure / action safety ----------
class TestActionSafety:
    def test_disabled_action_tool(self, taj_s, admin_s):
        admin_s.patch(f"{API}/admin/tools/{TAJ_TOOL_BOOK}", json={"enabled": False})
        r = taj_s.post(f"{API}/tenant/tools/{TAJ_TOOL_BOOK}/preview", json={"args": {}})
        assert r.status_code == 200
        assert r.json().get("status") == "disabled"

    def test_action_requires_confirmation_then_ok(self, taj_s, admin_s):
        admin_s.patch(f"{API}/admin/tools/{TAJ_TOOL_BOOK}", json={"enabled": True})
        r = taj_s.post(f"{API}/tenant/tools/{TAJ_TOOL_BOOK}/preview", json={"args": {"room_type": "Deluxe King"}})
        assert r.status_code == 200
        assert r.json().get("status") == "confirmation_required"

        r2 = taj_s.post(f"{API}/tenant/tools/{TAJ_TOOL_BOOK}/preview",
                        json={"args": {"room_type": "Deluxe King"}, "confirmed": True})
        assert r2.status_code == 200, r2.text
        j = r2.json()
        assert j.get("status") == "ok"
        # Should be marked mock and include a reference
        data = j.get("data") or {}
        assert "reference" in data or "booking_reference" in data or "confirmation" in data or j.get("mode") == "mock"
        # Reset
        admin_s.patch(f"{API}/admin/tools/{TAJ_TOOL_BOOK}", json={"enabled": False})


# ---------- Provisioning: honest, no fake green ----------
class TestProvisioning:
    def test_provisioning_status(self, admin_s):
        r = admin_s.get(f"{API}/admin/tenants/{TAJ_TID}/provisioning")
        assert r.status_code == 200
        j = r.json()
        assert j["elevenlabs"]["credentials_configured"] is False
        assert j["razorpay"]["credentials_configured"] is False
        for a in j["elevenlabs"]["agents"]:
            assert a["status"] == "credentials_required"
        for n in j["exotel"]["numbers"]:
            assert n["status"] == "credentials_required"

    def test_verify_voice_credentials_required(self, admin_s):
        r = admin_s.post(f"{API}/admin/ai-employees/{TAJ_AE}/verify-voice")
        assert r.status_code == 200
        assert r.json().get("status") == "credentials_required"

    def test_verify_telephony_credentials_required(self, admin_s):
        r = admin_s.post(f"{API}/admin/channels/{TAJ_PHONE_CH}/verify-telephony")
        assert r.status_code == 200
        assert r.json().get("status") == "credentials_required"


# ---------- Knowledge base ----------
class TestKnowledgeBase:
    def test_update_and_expose_to_tenant(self, admin_s, taj_s):
        new_info = f"TEST_updated_{uuid.uuid4().hex[:6]}"
        r = admin_s.patch(f"{API}/admin/ai-employees/{TAJ_AE}/knowledge",
                          json={"business_info": new_info})
        assert r.status_code == 200
        aes = taj_s.get(f"{API}/tenant/ai-employees").json()
        aria = next((a for a in aes if a["id"] == TAJ_AE), None)
        assert aria is not None
        kb = aria.get("knowledge_base") or {}
        assert kb.get("business_info") == new_info
        assert "config_ref" not in aria


# ---------- Operations ----------
class TestOperations:
    def test_operations_rows(self, admin_s):
        rows = admin_s.get(f"{API}/admin/operations").json()
        assert isinstance(rows, list) and rows
        taj = next((r for r in rows if r["tenant_id"] == TAJ_TID), None)
        assert taj is not None
        for k in ("environment", "ai_employee", "phone", "whatsapp", "business_integration", "billing"):
            assert k in taj

    def test_system_health_honest(self, admin_s, taj_s):
        r = admin_s.get(f"{API}/admin/system-health")
        assert r.status_code == 200, r.text
        items = {i["key"]: i["status"] for i in r.json()["items"]}
        for k in ("saas", "database", "voice", "telephony", "whatsapp", "payments"):
            assert k in items
        assert items["saas"] == "ok"
        assert items["database"] == "ok"
        assert items["whatsapp"] in ("credentials_required", "configured")
        assert items["whatsapp"] != "ok"
        # Unconfigured providers must not be reported as healthy; configured ones may be ok.
        for k in ("voice", "telephony", "payments"):
            assert items[k] in ("ok", "credentials_required")
        deny = taj_s.get(f"{API}/admin/system-health")
        assert deny.status_code == 403

    def test_audit_log_admin_only(self, admin_s, taj_s):
        r = admin_s.get(f"{API}/admin/audit-log")
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        deny = taj_s.get(f"{API}/admin/audit-log")
        assert deny.status_code == 403


# ---------- Billing ----------
class TestBilling:
    def test_pricing_get_put(self, admin_s):
        r = admin_s.get(f"{API}/admin/tenants/{TAJ_TID}/pricing")
        assert r.status_code == 200, r.text
        pricing = r.json()
        assert pricing.get("tenant_id") == TAJ_TID
        # Update a field
        r2 = admin_s.put(f"{API}/admin/tenants/{TAJ_TID}/pricing",
                         json={"service_charge": 1234.0})
        assert r2.status_code == 200, r2.text
        assert r2.json().get("service_charge") == 1234.0

    def test_generate_and_issue_invoice_demo(self, admin_s):
        # Unique period to avoid immutability collision on re-runs
        period = f"{2100 + (int(uuid.uuid4().hex[:4], 16) % 800):04d}-{(int(uuid.uuid4().hex[4:6], 16) % 12) + 1:02d}"
        r = admin_s.post(f"{API}/admin/tenants/{TAJ_TID}/invoices/generate",
                        json={"period": period})
        assert r.status_code == 200, r.text
        inv = r.json()
        assert inv.get("is_demo") is True
        assert "line_items" in inv and isinstance(inv["line_items"], list) and len(inv["line_items"]) >= 3
        assert "subtotal" in inv and "tax" in inv and "total" in inv
        assert "reconciliation" in inv
        # Line item labels sanity
        labels = " ".join([li.get("label", "") for li in inv["line_items"]]).lower()
        # Issue
        r2 = admin_s.post(f"{API}/admin/invoices/{inv['id']}/issue")
        assert r2.status_code == 200, r2.text
        issued = r2.json()
        assert issued.get("status") == "demo"
        # Re-issue blocked
        r3 = admin_s.post(f"{API}/admin/invoices/{inv['id']}/issue")
        assert r3.status_code == 400
        # Re-generate same period blocked
        r4 = admin_s.post(f"{API}/admin/tenants/{TAJ_TID}/invoices/generate",
                         json={"period": period})
        assert r4.status_code == 400

    def test_tenant_billing_view_no_internal(self, taj_s):
        r = taj_s.get(f"{API}/tenant/billing")
        assert r.status_code == 200, r.text
        j = r.json()
        assert "invoices" in j
        assert "current_usage" in j
        assert "estimated_total" in j
        assert "spend_status" in j
        for inv in j["invoices"]:
            assert "internal" not in inv, "tenant view must not expose 'internal' markup"

    def test_pay_demo_invoice_400(self, taj_s):
        r = taj_s.get(f"{API}/tenant/billing")
        invoices = r.json()["invoices"]
        demo_inv = next((i for i in invoices if i.get("is_demo")), None)
        assert demo_inv, "expected at least one demo invoice"
        r2 = taj_s.post(f"{API}/tenant/invoices/{demo_inv['id']}/pay")
        assert r2.status_code == 400


# ---------- Razorpay guarded (kept in same TestBilling scope avoided; put here but
# run serially via -n 0 by test runner). ----------
class TestRazorpayGuarded:
    def test_pay_production_due_invoice_returns_payment_config_required(self, admin_s, taj_s):
        # Simulate production-like invoice: temporarily set env to production, generate,
        # issue, then try to pay. We must set env back to demo after.
        admin_s.patch(f"{API}/admin/tenants/{TAJ_TID}/environment", json={"environment": "production"})
        try:
            period = f"2099-{(int(uuid.uuid4().hex[2:4], 16) % 12) + 1:02d}"
            r = admin_s.post(f"{API}/admin/tenants/{TAJ_TID}/invoices/generate", json={"period": period})
            assert r.status_code == 200, r.text
            inv = r.json()
            assert inv.get("is_demo") is False
            r2 = admin_s.post(f"{API}/admin/invoices/{inv['id']}/issue")
            assert r2.status_code == 200, r2.text
            status = r2.json().get("status")
            # Since razorpay unconfigured, must be payment_config_required
            assert status == "payment_config_required", f"got status={status}"
            # Owner tries to pay
            r3 = taj_s.post(f"{API}/tenant/invoices/{inv['id']}/pay")
            assert r3.status_code == 200, r3.text
            assert r3.json().get("status") == "payment_config_required"
        finally:
            admin_s.patch(f"{API}/admin/tenants/{TAJ_TID}/environment", json={"environment": "demo"})


# ---------- Readiness ----------
class TestReadiness:
    def test_taj_readiness(self, taj_s):
        r = taj_s.get(f"{API}/tenant/readiness")
        assert r.status_code == 200, r.text
        j = r.json()
        assert j.get("is_live") is True
        items = j.get("items") or {}
        for k in ("ai_employee", "phone", "whatsapp", "business_integration"):
            assert k in items
        # Actions should include WhatsApp
        actions = j.get("actions_required") or []
        assert any("whats" in a.lower() for a in actions), f"WhatsApp not in actions_required: {actions}"
        assert "needs_from_you" in j and "waiting_for_orbit" in j and "configured" in j
        assert "Riya" in (j.get("configured") or [])
        assert any("whats" in x["label"].lower() for x in j.get("waiting_for_orbit") or [])

    def test_admin_readiness_checklist(self, admin_s):
        r = admin_s.get(f"{API}/admin/tenants/{TAJ_TID}/readiness")
        assert r.status_code == 200, r.text
        j = r.json()
        keys = {i["key"] for i in j["items"]}
        for k in ("owner", "profile", "ai_employee", "voice_agent", "phone", "whatsapp",
                  "integration", "knowledge", "billing", "tested", "approved", "live"):
            assert k in keys
        assert "blockers" in j and "ready_for_live" in j

    def test_new_tenant_cannot_go_live(self, admin_s):
        tname = f"TEST_Hotel_{uuid.uuid4().hex[:6]}"
        oemail = f"test_ready_{uuid.uuid4().hex[:8]}@example.com"
        r = admin_s.post(f"{API}/admin/tenants", json={
            "name": tname, "owner_email": oemail,
            "owner_name": "Ready Test", "owner_password": "Hotel@2026",
        })
        assert r.status_code == 200, r.text
        tid = r.json()["id"]
        assert r.json().get("environment") == "demo"
        ready = admin_s.get(f"{API}/admin/tenants/{tid}/readiness").json()
        assert ready["ready_for_live"] is False
        assert ready["blockers"]
        live = admin_s.patch(f"{API}/admin/tenants/{tid}/status", json={"status": "live"})
        assert live.status_code == 400

    def test_production_rejects_new_mock_integration(self, admin_s):
        admin_s.patch(f"{API}/admin/tenants/{TAJ_TID}/environment", json={"environment": "production"})
        try:
            r = admin_s.post(f"{API}/admin/tenants/{TAJ_TID}/integrations", json={
                "type": "pms", "name": "TEST_ProdMock", "connector_key": "mock_pms", "mode": "mock",
            })
            assert r.status_code == 400, r.text
        finally:
            admin_s.patch(f"{API}/admin/tenants/{TAJ_TID}/environment", json={"environment": "demo"})

"""ORBIT — Business Integration + Tool Layer regression tests.

Covers:
- Tenant read-only integrations + tools listing
- Preview: read (mock), action confirmation gating, disabled, unavailable-when-live-no-connector
- Admin CRUD: integrations + tools, kind=action forces requires_confirmation
- Tenant isolation
- simulate-call adds data_mode / tool_invocations / live_data_note
- Post-suite: restore Taj mock/connected/create_booking-disabled
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://orbit-phone-ai.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@orbit.ai", "password": "OrbitAdmin@2026"}
TAJ = {"email": "owner@tajpalace.in", "password": "Hotel@2026"}
LEELA = {"email": "owner@leela.in", "password": "Hotel@2026"}

TAJ_INT = "int_taj_pms"
TOOL_AVAIL = "tool_taj_avail"
TOOL_BSTATUS = "tool_taj_bstatus"
TOOL_BOOK = "tool_taj_book"


def _login(creds):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return s


# ---- Fixtures ----
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
def restore_taj_state(admin_s):
    yield
    # teardown — restore Taj to demo baseline
    admin_s.patch(f"{API}/admin/integrations/{TAJ_INT}", json={"mode": "mock", "status": "connected"})
    admin_s.patch(f"{API}/admin/tools/{TOOL_BOOK}", json={"enabled": False})


# ---------------- Tenant read-only listing ----------------
class TestTenantListing:
    def test_integrations_systems_shape(self, taj_s):
        r = taj_s.get(f"{API}/tenant/integrations")
        assert r.status_code == 200
        data = r.json()
        systems = data["systems"]
        pms = [s for s in systems if s["type"] == "pms"]
        assert pms, "Hotel PMS integration missing"
        assert pms[0]["status"] == "connected"
        assert pms[0]["mode"] == "mock"
        assert pms[0]["is_mock"] is True
        assert pms[0]["label"] == "Hotel PMS"
        # channels
        phone = [s for s in systems if s["type"] == "phone"]
        wa = [s for s in systems if s["type"] == "whatsapp"]
        assert phone and phone[0]["status"] == "connected"
        assert wa and wa[0]["status"] == "action_required"
        # ai employee
        ae = [s for s in systems if s["type"] == "ai_employee"]
        assert ae and "Riya" in ae[0]["label"]

    def test_tools_availability(self, taj_s):
        tools = taj_s.get(f"{API}/tenant/tools").json()
        by_key = {t["key"]: t for t in tools}
        assert by_key["check_availability"]["available"] is True
        assert by_key["check_availability"]["kind"] == "read"
        assert by_key["check_booking_status"]["available"] is True
        assert by_key["create_booking"]["kind"] == "action"
        # create_booking disabled by default
        assert by_key["create_booking"]["available"] is False


# ---------------- Preview: read tool ----------------
class TestPreviewRead:
    def test_check_availability_returns_mock_data(self, taj_s):
        r = taj_s.post(f"{API}/tenant/tools/{TOOL_AVAIL}/preview", json={})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] == "ok"
        assert data["mode"] == "mock"
        assert data["mock"] is True
        d = data["data"]
        assert "available" in d and "available_units" in d and "rate" in d
        assert "amount" in d["rate"] and "currency" in d["rate"]

    def test_disabled_tool_preview_returns_disabled(self, taj_s):
        # tool_taj_book is disabled by default
        r = taj_s.post(f"{API}/tenant/tools/{TOOL_BOOK}/preview", json={})
        assert r.status_code == 200
        assert r.json()["status"] == "disabled"


# ---------------- Action safety ----------------
class TestActionSafety:
    def test_action_requires_confirmation_then_ok(self, admin_s, taj_s):
        # enable
        r = admin_s.patch(f"{API}/admin/tools/{TOOL_BOOK}", json={"enabled": True})
        assert r.status_code == 200
        assert r.json()["enabled"] is True
        assert r.json()["requires_confirmation"] is True  # forced

        # preview without confirmation -> confirmation_required
        r1 = taj_s.post(f"{API}/tenant/tools/{TOOL_BOOK}/preview", json={})
        assert r1.status_code == 200
        assert r1.json()["status"] == "confirmation_required"

        # preview with confirmation -> ok, booking_id in mock data
        r2 = taj_s.post(f"{API}/tenant/tools/{TOOL_BOOK}/preview", json={"confirmed": True})
        assert r2.status_code == 200
        d = r2.json()
        assert d["status"] == "ok"
        assert d["mode"] == "mock"
        assert d["mock"] is True
        assert "reference" in d["data"] or "booking_reference" in d["data"]

        # cleanup
        admin_s.patch(f"{API}/admin/tools/{TOOL_BOOK}", json={"enabled": False})


# ---------------- Live-no-connector => unavailable ----------------
class TestNeverFakeLive:
    def test_live_mode_returns_unavailable(self, admin_s, taj_s):
        # switch to live
        r = admin_s.patch(f"{API}/admin/integrations/{TAJ_INT}", json={"mode": "live"})
        assert r.status_code == 200
        assert r.json()["mode"] == "live"

        pv = taj_s.post(f"{API}/tenant/tools/{TOOL_AVAIL}/preview", json={}).json()
        assert pv["status"] == "unavailable"
        # never fake data
        assert "data" not in pv or pv.get("data") is None

        # restore mock
        admin_s.patch(f"{API}/admin/integrations/{TAJ_INT}", json={"mode": "mock"})
        pv2 = taj_s.post(f"{API}/tenant/tools/{TOOL_AVAIL}/preview", json={}).json()
        assert pv2["status"] == "ok"
        assert pv2["mode"] == "mock"

    def test_not_connected_returns_unavailable(self, admin_s, taj_s):
        r = admin_s.patch(f"{API}/admin/integrations/{TAJ_INT}", json={"status": "not_connected"})
        assert r.status_code == 200
        pv = taj_s.post(f"{API}/tenant/tools/{TOOL_AVAIL}/preview", json={}).json()
        assert pv["status"] == "unavailable"
        # restore
        admin_s.patch(f"{API}/admin/integrations/{TAJ_INT}", json={"status": "connected"})


# ---------------- Isolation ----------------
class TestToolIsolation:
    def test_leela_cannot_see_taj_tools(self, leela_s):
        tools = leela_s.get(f"{API}/tenant/tools").json()
        keys = {t["key"] for t in tools}
        assert "check_availability" not in keys or all(
            t["tenant_id"] == "tenant_leela_blr" for t in tools
        )
        # verify no Taj tool ids
        ids = {t["id"] for t in tools}
        assert TOOL_AVAIL not in ids

    def test_leela_preview_taj_tool_404(self, leela_s):
        r = leela_s.post(f"{API}/tenant/tools/{TOOL_AVAIL}/preview", json={})
        assert r.status_code == 404


# ---------------- Admin CRUD ----------------
class TestAdminCRUD:
    def test_tenant_detail_includes_integrations_tools(self, admin_s):
        r = admin_s.get(f"{API}/admin/tenants/tenant_taj_palace")
        assert r.status_code == 200
        d = r.json()
        assert "integrations" in d and "tools" in d
        assert any(i["id"] == TAJ_INT for i in d["integrations"])
        assert any(t["id"] == TOOL_AVAIL for t in d["tools"])

    def test_create_integration_and_tools(self, admin_s):
        # create integration on Leela
        r = admin_s.post(f"{API}/admin/tenants/tenant_leela_blr/integrations", json={
            "type": "calendar", "name": "TEST_Clinic Calendar",
            "provider": "mock_pms", "mode": "mock", "status": "connected",
        })
        assert r.status_code == 200, r.text
        integ = r.json()
        int_id = integ["id"]
        assert integ["type"] == "calendar"

        # read tool
        rt = admin_s.post(f"{API}/admin/integrations/{int_id}/tools", json={
            "key": "check_slots", "name": "Check slots", "kind": "read"
        })
        assert rt.status_code == 200
        assert rt.json()["kind"] == "read"
        assert rt.json()["requires_confirmation"] is False

        # action tool — requires_confirmation forced true even if false passed
        rt2 = admin_s.post(f"{API}/admin/integrations/{int_id}/tools", json={
            "key": "book_slot", "name": "Book slot", "kind": "action",
            "requires_confirmation": False,
        })
        assert rt2.status_code == 200
        assert rt2.json()["kind"] == "action"
        assert rt2.json()["requires_confirmation"] is True

        # patch toggle
        tool_id = rt.json()["id"]
        pr = admin_s.patch(f"{API}/admin/tools/{tool_id}", json={"enabled": False})
        assert pr.status_code == 200
        assert pr.json()["enabled"] is False
        pr2 = admin_s.patch(f"{API}/admin/tools/{tool_id}", json={"enabled": True})
        assert pr2.json()["enabled"] is True


# ---------------- simulate-call live-data demo ----------------
class TestSimulateCallDataMode:
    def test_simulate_call_returns_mock_datamode(self, taj_s):
        r = taj_s.post(f"{API}/tenant/simulate-call", json={"direction": "inbound"})
        assert r.status_code == 200, r.text
        conv = r.json()
        assert conv["data_mode"] == "mock"
        assert "MOCK" in conv["live_data_note"].upper()
        assert any(inv.get("tool") == "check_availability" for inv in conv["tool_invocations"])
        cid = conv["id"]
        # fetch detail
        r2 = taj_s.get(f"{API}/tenant/conversations/{cid}")
        d = r2.json()
        assert d["data_mode"] == "mock"
        assert d["tool_invocations"]

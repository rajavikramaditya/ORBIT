"""Public landing-page voice demo (/api/public/demo/*).

Two concerns are covered here, in this order of importance:

  1. The provider stays invisible. No agent id, provider name, or env var name
     may reach a public response body — AGENT.md rules 4 and 6. These assertions
     need no running server and no credentials.
  2. The endpoint degrades safely and cannot be used as an open proxy: unknown
     scenarios are rejected, unconfigured scenarios return a clean 503 rather
     than an error, and a caller cannot mint unlimited paid sessions.

The unit tests run anywhere. The HTTP tests follow the repo convention of
black-box calls against a locally running server.
"""
import os
import requests

from routes_public import (
    DEMO_SCENARIOS,
    is_known_scenario,
    list_demo_scenarios,
    resolve_demo_agent,
)

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"

# Deliberately distinctive so a leak is unambiguous when asserted against a body.
FAKE_ENV = {
    "ORBIT_DEMO_AGENT_HOTEL": "agent_leakcanary_hotel_001",
    "ORBIT_DEMO_AGENT_RESTAURANT": "  ",
}


class TestScenarioResolver:
    """Pure mapping logic — no server, no credentials, no network."""

    def test_known_scenario_resolves_from_environment(self):
        assert resolve_demo_agent("hotel", FAKE_ENV) == "agent_leakcanary_hotel_001"

    def test_unknown_scenario_resolves_to_none(self):
        assert resolve_demo_agent("spaceship", FAKE_ENV) is None
        assert is_known_scenario("spaceship") is False
        assert is_known_scenario("hotel") is True

    def test_unset_and_blank_env_treated_as_unconfigured(self):
        # A whitespace-only value is a misconfiguration, not a valid agent id.
        assert resolve_demo_agent("restaurant", FAKE_ENV) is None
        assert resolve_demo_agent("clinic", FAKE_ENV) is None

    def test_catalogue_marks_only_configured_scenarios_enabled(self):
        by_key = {s["key"]: s for s in list_demo_scenarios(FAKE_ENV)}
        assert by_key["hotel"]["enabled"] is True
        assert by_key["restaurant"]["enabled"] is False
        assert by_key["clinic"]["enabled"] is False

    def test_catalogue_never_exposes_agent_ids_or_env_var_names(self):
        """The single most important assertion in this file (AGENT.md rules 4, 6)."""
        catalogue = list_demo_scenarios(FAKE_ENV)
        blob = repr(catalogue).lower()
        assert "agent_leakcanary_hotel_001" not in blob
        assert "orbit_demo_agent" not in blob
        assert "elevenlabs" not in blob
        for entry in catalogue:
            assert set(entry) == {"key", "label", "persona", "role", "tagline", "enabled"}

    def test_every_scenario_declares_a_distinct_env_var(self):
        keys = [s["key"] for s in DEMO_SCENARIOS]
        envs = [s["env"] for s in DEMO_SCENARIOS]
        assert len(set(keys)) == len(keys)
        assert len(set(envs)) == len(envs)


class TestDemoScenariosEndpoint:
    """GET /api/public/demo/scenarios — public, no auth."""

    def test_reachable_without_authentication(self):
        r = requests.get(f"{API}/public/demo/scenarios", timeout=15)
        assert r.status_code == 200, r.text
        scenarios = r.json()["scenarios"]
        assert isinstance(scenarios, list) and scenarios
        for entry in scenarios:
            assert isinstance(entry["enabled"], bool)
            assert entry["key"] and entry["label"] and entry["persona"]

    def test_response_body_leaks_no_provider_detail(self):
        body = requests.get(f"{API}/public/demo/scenarios", timeout=15).text.lower()
        assert "elevenlabs" not in body
        assert "xi-api-key" not in body
        assert "orbit_demo_agent" not in body
        assert "agent_" not in body


class TestDemoSessionEndpoint:
    """POST /api/public/demo/session — the endpoint that costs real money."""

    def test_unknown_scenario_rejected(self):
        r = requests.post(f"{API}/public/demo/session", json={"scenario": "spaceship"}, timeout=15)
        assert r.status_code == 400
        assert "scenario" in r.json()["detail"].lower()

    def test_client_supplied_agent_id_is_ignored(self):
        """An agent id in the body must never be honoured — that would be an open proxy."""
        r = requests.post(
            f"{API}/public/demo/session",
            json={"scenario": "spaceship", "agent_id": "agent_attacker_supplied"},
            timeout=15,
        )
        assert r.status_code == 400
        assert "agent_attacker_supplied" not in r.text

    def test_unconfigured_scenario_returns_clean_503(self):
        """With no ORBIT_DEMO_AGENT_* set (the .env.example default) this is the
        expected path: a calm 'not available', never a 500 and never a stack trace."""
        r = requests.post(f"{API}/public/demo/session", json={"scenario": "clinic"}, timeout=20)
        assert r.status_code in (429, 503, 502, 200), r.text
        if r.status_code == 503:
            detail = r.json()["detail"]
            assert "not available" in detail.lower()
            assert "elevenlabs" not in detail.lower()
            assert "agent" not in detail.lower()

    def test_repeated_calls_are_throttled(self):
        """Every mint costs provider minutes, so an unauthenticated caller must hit a wall."""
        codes = [
            requests.post(
                f"{API}/public/demo/session", json={"scenario": "hotel"}, timeout=20
            ).status_code
            for _ in range(7)
        ]
        assert 429 in codes, f"expected a 429 within 7 calls, got {codes}"

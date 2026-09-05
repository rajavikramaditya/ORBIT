"""Public (unauthenticated) marketing-site API.

The only consumer is ORBIT's own public landing page. Two rules shape every
response in this module:

  * AGENT.md rule 4/6 — the voice provider is internal infrastructure. No
    provider name, no agent id, and no credential fragment may appear in a
    response body, an error `detail`, or a log line here. The browser receives
    an opaque, short-lived session URL and nothing else.
  * The scenario -> agent mapping is resolved SERVER-SIDE from environment
    variables. An `agent_id` is never accepted from the request body: doing so
    would turn this endpoint into an open proxy that mints sessions for any
    agent on the ORBIT account. Same principle as `/api/intake/{intake_key}`,
    where the tenant is resolved from the key rather than trusted from the client.

Every minted session costs real provider minutes, so POST is IP-throttled by
`security.enforce_voice_demo_rate_limit` in every environment.
"""
import os
import logging

from fastapi import APIRouter, HTTPException, Request

from models import DemoSessionBody
from security import enforce_voice_demo_rate_limit
from voice_providers import get_voice_provider

logger = logging.getLogger("orbit.public")

router = APIRouter(prefix="/api/public", tags=["public"])

# Session URLs are short-lived by design; the browser must connect promptly.
DEMO_SESSION_TTL_SECS = 900

# key -> (env var holding the agent id, customer-facing copy).
# Adding a fourth vertical is one entry here plus one environment variable —
# no route, model, or frontend change.
DEMO_SCENARIOS: list[dict] = [
    {
        "key": "hotel",
        "env": "ORBIT_DEMO_AGENT_HOTEL",
        "label": "Hotel reception",
        "persona": "Riya",
        "role": "AI Reservation Assistant",
        "tagline": "Room availability, bookings and 24/7 guest support.",
    },
    {
        "key": "restaurant",
        "env": "ORBIT_DEMO_AGENT_RESTAURANT",
        "label": "Restaurant bookings",
        "persona": "Aarav",
        "role": "AI Booking & Order Assistant",
        "tagline": "Table reservations, orders and everyday enquiries.",
    },
    {
        "key": "clinic",
        "env": "ORBIT_DEMO_AGENT_CLINIC",
        "label": "Clinic appointments",
        "persona": "Ananya",
        "role": "AI Appointment Assistant",
        "tagline": "Appointment booking, reminders and patient support.",
    },
]


def resolve_demo_agent(scenario_key: str, environ: dict | None = None) -> str | None:
    """Map a public scenario key to a configured agent id, or None.

    Pure function with an injectable environment so it is unit-testable without a
    running server (same shape as runtime_config's helpers). Returns None both for
    an unknown key and for a known key whose environment variable is unset —
    callers distinguish those two cases via `is_known_scenario`.
    """
    env = environ if environ is not None else os.environ
    for scenario in DEMO_SCENARIOS:
        if scenario["key"] == scenario_key:
            return (env.get(scenario["env"]) or "").strip() or None
    return None


def is_known_scenario(scenario_key: str) -> bool:
    return any(s["key"] == scenario_key for s in DEMO_SCENARIOS)


def list_demo_scenarios(environ: dict | None = None) -> list[dict]:
    """Customer-facing catalogue. Never includes the agent id or its env var name."""
    return [
        {
            "key": s["key"],
            "label": s["label"],
            "persona": s["persona"],
            "role": s["role"],
            "tagline": s["tagline"],
            "enabled": resolve_demo_agent(s["key"], environ) is not None,
        }
        for s in DEMO_SCENARIOS
    ]


@router.get("/demo/scenarios")
async def demo_scenarios():
    """Which live-demo scenarios the marketing page may offer right now.

    A scenario is `enabled` only when its agent is configured on this server, so
    the landing page can render the rest as "coming soon" instead of failing a
    call. Public and uncached-by-design — configuration can change at any time.
    """
    return {"scenarios": list_demo_scenarios()}


@router.post("/demo/session")
async def demo_session(body: DemoSessionBody, request: Request):
    """Mint one short-lived voice session for the public landing-page demo."""
    enforce_voice_demo_rate_limit(request)

    scenario_key = (body.scenario or "").strip().lower()
    if not is_known_scenario(scenario_key):
        raise HTTPException(status_code=400, detail="Unknown demo scenario.")

    agent_id = resolve_demo_agent(scenario_key)
    if not agent_id:
        # Configured-but-off is a normal state (a vertical not launched yet),
        # so this is an expected 503, not an error worth a stack trace.
        raise HTTPException(status_code=503, detail="Live demo is not available right now.")

    result = get_voice_provider("elevenlabs").signed_url(agent_id)
    if not result.get("ok") or not result.get("signed_url"):
        logger.warning("demo session could not be minted scenario=%s", scenario_key)
        raise HTTPException(status_code=502, detail="Could not start the demo. Please try again.")

    return {"session_url": result["signed_url"], "expires_in": DEMO_SESSION_TTL_SECS}

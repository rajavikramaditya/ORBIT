"""Business system connector layer.

ORBIT connects an AI Employee to the customer's OWN external business system
(Hotel PMS, Restaurant POS, Clinic calendar, CRM, ...). ORBIT does NOT build a
PMS/CRM/ERP itself.

HARD RULES:
- We NEVER fabricate live operational data.
- Mock connectors are DEV/DEMO ONLY and every result is flagged `mock=True`.
- `mode="live"` requires a REAL connector. None are implemented yet, so live mode
  currently resolves to "unavailable" instead of inventing data.
"""
import random
import uuid


class BusinessConnector:
    provider = "base"

    def read(self, tool_key: str, args: dict) -> dict:
        raise NotImplementedError

    def act(self, tool_key: str, args: dict) -> dict:
        raise NotImplementedError


class MockPMSConnector(BusinessConnector):
    """DEV/DEMO ONLY mock hotel PMS. Results are clearly marked as MOCK and must
    never be presented as real-time operational truth in production."""
    provider = "mock_pms"

    def read(self, tool_key: str, args: dict) -> dict:
        # Returns the STANDARD ORBIT data contract (provider-agnostic), flagged MOCK.
        if tool_key == "check_availability":
            available = random.random() > 0.3
            return {"mock": True, "result": {
                "available": available,
                "available_units": random.randint(1, 6) if available else 0,
                "unit_type": args.get("room_type", "Deluxe"),
                "rate": {"amount": 14500, "currency": "INR"},
            }}
        if tool_key in ("get_booking", "check_booking_status"):
            return {"mock": True, "result": {
                "found": True,
                "reference": args.get("booking_id", "BK-2043"),
                "status": random.choice(["confirmed", "checked_in", "pending"]),
            }}
        return {"mock": True, "result": {}}

    def act(self, tool_key: str, args: dict) -> dict:
        if tool_key == "create_booking":
            return {"mock": True, "result": {
                "created": True,
                "reference": "BK-" + uuid.uuid4().hex[:6].upper(),
                "status": "confirmed",
                "unit_type": args.get("room_type", "Deluxe"),
            }}
        if tool_key == "cancel_booking":
            return {"mock": True, "result": {
                "cancelled": True,
                "reference": args.get("booking_id", "BK-2043"),
                "status": "cancelled",
            }}
        return {"mock": True, "result": {}}


# Mock connectors — usable only when integration.mode == "mock" (demo).
MOCK_REGISTRY = {"mock_pms": MockPMSConnector}
# Real connectors — populated when an actual business system is integrated.
LIVE_REGISTRY: dict = {}


def get_mock_connector(provider: str):
    cls = MOCK_REGISTRY.get(provider)
    return cls() if cls else None


def get_live_connector(provider: str):
    cls = LIVE_REGISTRY.get(provider)
    return cls() if cls else None


# Connector catalogue exposed to admin onboarding ("what system does this business use?").
# Each connector declares only the standardized capabilities it actually supports.
CONNECTOR_META = {
    "mock_pms": {"key": "mock_pms", "label": "Demo PMS (mock)", "kind": "demo",
                 "read": ["check_availability", "get_booking", "check_booking_status"],
                 "action": ["create_booking", "cancel_booking"]},
    "custom": {"key": "custom", "label": "Custom / managed integration", "kind": "custom",
               "read": [], "action": []},
}


def list_connectors():
    return list(CONNECTOR_META.values())


def get_connector_meta(key: str):
    return CONNECTOR_META.get(key)


def connector_supports(key: str, tool_key: str, kind: str) -> bool:
    meta = CONNECTOR_META.get(key) or {}
    return tool_key in (meta.get(kind) or [])

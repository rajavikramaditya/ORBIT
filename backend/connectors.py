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
        if tool_key == "check_availability":
            available = random.random() > 0.3
            return {"mock": True, "result": {
                "room_type": args.get("room_type", "Deluxe King"),
                "date": args.get("date", "tonight"),
                "available": available,
                "rooms_left": random.randint(1, 6) if available else 0,
                "rate_inr": 14500,
            }}
        if tool_key == "check_booking_status":
            return {"mock": True, "result": {
                "booking_id": args.get("booking_id", "BK-2043"),
                "status": random.choice(["confirmed", "checked_in", "pending"]),
            }}
        return {"mock": True, "result": {}}

    def act(self, tool_key: str, args: dict) -> dict:
        if tool_key == "create_booking":
            return {"mock": True, "result": {
                "booking_id": "BK-" + uuid.uuid4().hex[:6].upper(),
                "status": "created",
                "room_type": args.get("room_type", "Deluxe King"),
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

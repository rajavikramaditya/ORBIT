"""Business system connector layer — Universal Multi-Vertical Architecture.

ORBIT connects an AI Employee to the customer's OWN external business system
(Hotel PMS, Restaurant POS, Clinic EHR/Calendar, Salon Booking, Real Estate CRM,
Retail Inventory, Professional Services...).

ORBIT is NOT a PMS/CRM/ERP itself; it is the universal voice & communication
interface that bridges AI Employees to whatever system of record the business uses.

ARCHITECTURAL PRINCIPLES:
1. Standardized Capability Contracts:
   - READ operations: check_availability, get_rates, get_business_policy,
     get_all_rates, get_booking, check_booking_status, lookup_customer, get_order_status
   - ACTION operations (Confirmation-Gated): create_booking, create_order,
     update_booking, cancel_booking
2. Dual Data Source Strategy:
   - "Manual Business Data": Maintained directly in ORBIT dashboard by tenant.
     Used when no external system is connected or as initial setup.
   - "Connected Business System": Real-time synchronization through external
     connectors (Hotelogix, Opera, Google Calendar, Custom API, etc.).
3. Honesty & Safety:
   - We NEVER fabricate live operational data.
   - Mock connectors are DEV/DEMO ONLY and flagged `mock=True`.
   - Production tenants CANNOT use mock data.
   - ACTION operations ALWAYS require confirmation.
"""
import random
import uuid


class BusinessConnector:
    """Universal base class for all business system integrations."""
    provider = "base"

    def read(self, tool_key: str, args: dict) -> dict:
        """Execute a safe read operation against the business system."""
        raise NotImplementedError

    def act(self, tool_key: str, args: dict) -> dict:
        """Execute a state-modifying action against the business system."""
        raise NotImplementedError


class MockPMSConnector(BusinessConnector):
    """DEV/DEMO ONLY mock hospitality/booking system. Results are clearly marked
    as MOCK and must never be presented as real-time operational truth in production."""
    provider = "mock_pms"

    def read(self, tool_key: str, args: dict) -> dict:
        if tool_key in ("check_availability", "check_table_availability", "check_slot_availability"):
            available = random.random() > 0.3
            return {"mock": True, "result": {
                "available": available,
                "available_units": random.randint(1, 6) if available else 0,
                "unit_type": args.get("room_type") or args.get("service_type") or "Deluxe",
                "rate": {"amount": 14500, "currency": "INR"},
            }}
        if tool_key in ("get_booking", "check_booking_status", "get_order_status"):
            return {"mock": True, "result": {
                "found": True,
                "reference": args.get("booking_id") or args.get("order_id") or "BK-2043",
                "status": random.choice(["confirmed", "checked_in", "in_progress"]),
            }}
        if tool_key == "lookup_customer":
            return {"mock": True, "result": {
                "found": True,
                "customer_name": args.get("name") or "Rajesh Sharma",
                "loyalty_tier": "Gold Member",
                "past_visits": 4,
            }}
        return {"mock": True, "result": {}}

    def act(self, tool_key: str, args: dict) -> dict:
        if tool_key in ("create_booking", "create_order"):
            return {"mock": True, "result": {
                "created": True,
                "reference": "BK-" + uuid.uuid4().hex[:6].upper(),
                "status": "confirmed",
                "details": args,
            }}
        if tool_key in ("cancel_booking", "cancel_order"):
            return {"mock": True, "result": {
                "cancelled": True,
                "reference": args.get("booking_id") or args.get("order_id") or "BK-2043",
                "status": "cancelled",
            }}
        if tool_key == "update_booking":
            return {"mock": True, "result": {
                "updated": True,
                "reference": args.get("booking_id", "BK-2043"),
                "status": "rescheduled",
                "new_details": args,
            }}
        return {"mock": True, "result": {}}


class ORBITLiveConnector(BusinessConnector):
    """ORBIT Manual Business Data source.
    Reads rates, timings, and policies directly from ORBIT's database as configured
    by the business in their dashboard.

    This serves as:
    1. A complete standalone operational data source for businesses without an external PMS/POS.
    2. Fallback operational data when no live external connector is attached.
    """
    provider = "orbit_live"

    def __init__(self, live_data: dict):
        self._data = live_data or {}

    def read(self, tool_key: str, args: dict) -> dict:
        if tool_key in ("check_availability", "check_table_availability", "check_slot_availability"):
            query_type = (args.get("room_type") or args.get("service_type") or args.get("item") or "").lower()
            rates = self._data.get("room_rates") or []
            match = next(
                (r for r in rates if query_type in r.get("room_type", "").lower()),
                rates[0] if rates else None,
            )
            if match:
                return {"mock": False, "result": {
                    "available": match.get("available", True),
                    "available_units": match.get("available_units"),
                    "unit_type": match.get("room_type"),
                    "rate": {"amount": match.get("rate_inr"), "currency": "INR"},
                    "source": "manual_orbit_data",
                }}
            return {"mock": False, "result": {
                "available": False,
                "message": "Item or service rate not found in business data.",
                "source": "manual_orbit_data",
            }}

        if tool_key in ("get_business_policy", "get_policies", "get_operating_hours"):
            category = (args.get("category") or "").lower()
            result = {}
            if any(k in category for k in ("checkin", "check_in", "timing", "hours", "schedule")):
                result = {
                    "check_in_time": self._data.get("check_in_time"),
                    "check_out_time": self._data.get("check_out_time"),
                }
            elif any(k in category for k in ("buffet", "food", "meal", "breakfast", "dining", "menu")):
                result = {
                    "breakfast": self._data.get("buffet_breakfast"),
                    "lunch": self._data.get("buffet_lunch"),
                    "dinner": self._data.get("buffet_dinner"),
                }
            elif any(k in category for k in ("cancel", "refund", "reschedule", "policy")):
                result = {
                    "cancellation_policy": self._data.get("cancellation_policy"),
                    "refund_policy": self._data.get("refund_policy"),
                }
            elif any(k in category for k in ("offer", "discount", "special", "promo")):
                result = {
                    "active_offer": self._data.get("active_offer"),
                    "seasonal_note": self._data.get("seasonal_note"),
                }
            else:
                result = {
                    "check_in_time": self._data.get("check_in_time"),
                    "check_out_time": self._data.get("check_out_time"),
                    "buffet_breakfast": self._data.get("buffet_breakfast"),
                    "buffet_lunch": self._data.get("buffet_lunch"),
                    "buffet_dinner": self._data.get("buffet_dinner"),
                    "cancellation_policy": self._data.get("cancellation_policy"),
                    "refund_policy": self._data.get("refund_policy"),
                    "active_offer": self._data.get("active_offer"),
                    "seasonal_note": self._data.get("seasonal_note"),
                }
                result.update(self._data.get("extra") or {})
            result["source"] = "manual_orbit_data"
            return {"mock": False, "result": result}

        if tool_key in ("get_all_rates", "get_rates", "get_menu", "get_services"):
            return {"mock": False, "result": {
                "room_rates": self._data.get("room_rates") or [],
                "active_offer": self._data.get("active_offer"),
                "source": "manual_orbit_data",
            }}

        return {"mock": False, "result": {"source": "manual_orbit_data"}}

    def act(self, tool_key: str, args: dict) -> dict:
        # Manual data connector is READ-oriented; actions in MVP route through notification/agent flow
        return {"mock": False, "result": {"status": "acknowledged", "details": args, "source": "manual_orbit_data"}}


# Mock connectors — usable only when integration.mode == "mock" (demo).
MOCK_REGISTRY = {"mock_pms": MockPMSConnector}
# Live connectors — populated when customer-specific adapters are connected.
LIVE_REGISTRY: dict = {}


def get_mock_connector(provider: str):
    cls = MOCK_REGISTRY.get(provider)
    return cls() if cls else None


def get_live_connector(provider: str):
    cls = LIVE_REGISTRY.get(provider)
    return cls() if cls else None


def get_orbit_live_connector(live_data: dict):
    return ORBITLiveConnector(live_data)


CONNECTOR_META = {
    "mock_pms": {
        "key": "mock_pms",
        "label": "Demo Booking System (Mock)",
        "kind": "demo",
        "read": ["check_availability", "get_booking", "check_booking_status", "lookup_customer", "get_order_status"],
        "action": ["create_booking", "cancel_booking", "update_booking", "create_order"],
    },
    "orbit_live": {
        "key": "orbit_live",
        "label": "ORBIT Business Data (Manual / Dashboard)",
        "kind": "manual",
        "read": ["check_availability", "get_business_policy", "get_all_rates", "get_rates", "get_policies", "get_operating_hours"],
        "action": [],
    },
    "custom": {
        "key": "custom",
        "label": "Custom / External Integration (Adapter Required)",
        "kind": "custom",
        "read": [],
        "action": [],
    },
}


def list_connectors():
    return list(CONNECTOR_META.values())


def get_connector_meta(key: str):
    return CONNECTOR_META.get(key)


def connector_supports(key: str, tool_key: str, kind: str) -> bool:
    meta = CONNECTOR_META.get(key) or {}
    return tool_key in (meta.get(kind) or [])


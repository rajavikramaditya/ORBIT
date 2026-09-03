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

    def _extra(self) -> dict:
        extra = self._data.get("extra") or {}
        return extra if isinstance(extra, dict) else {}

    def _catalogue_items(self) -> list:
        """Generic priced items: services first, then room_rates as named items."""
        extra = self._extra()
        raw_services = self._data.get("services") or extra.get("services") or []
        items = []
        for s in raw_services:
            if isinstance(s, str):
                name = s.strip()
                if name:
                    items.append({"name": name, "price": None, "available": None})
                continue
            if not isinstance(s, dict):
                continue
            name = s.get("name") or s.get("service") or s.get("title") or s.get("room_type")
            if not name:
                continue
            price = s.get("price")
            if price is None:
                price = s.get("price_inr")
            if price is None:
                price = s.get("rate_inr", s.get("rate"))
            items.append({
                "name": name,
                "price": price,
                "available": s.get("available"),
                "available_units": s.get("available_units"),
                "notes": s.get("notes") or s.get("description"),
            })
        for r in (self._data.get("room_rates") or []):
            if not isinstance(r, dict):
                continue
            name = r.get("room_type") or r.get("name")
            if not name:
                continue
            items.append({
                "name": name,
                "price": r.get("rate_inr") if r.get("rate_inr") is not None else r.get("price"),
                "available": r.get("available"),
                "available_units": r.get("available_units"),
            })
        return items

    def _not_in_business_data(self, detail: str | None = None) -> dict:
        return {"mock": False, "result": {
            "available": False,
            "found": False,
            "message": detail or "This information is not in current business data. Owner confirmation is required.",
            "source": "manual_orbit_data",
        }}

    def read(self, tool_key: str, args: dict) -> dict:
        extra = self._extra()
        items = self._catalogue_items()

        if tool_key in ("check_availability", "check_table_availability", "check_slot_availability"):
            query_type = (
                args.get("room_type") or args.get("service_type") or args.get("item")
                or args.get("service") or args.get("name") or ""
            ).lower().strip()
            match = None
            if query_type:
                match = next(
                    (i for i in items if query_type in (i.get("name") or "").lower()),
                    None,
                )
            if not match:
                return self._not_in_business_data(
                    "No matching service or rate in current business data. Owner confirmation is required."
                )
            amount = match.get("price")
            rate = None
            if isinstance(amount, (int, float)):
                rate = {"amount": amount, "currency": "INR"}
            elif amount not in (None, ""):
                rate = {"amount": amount, "currency": None}
            return {"mock": False, "result": {
                "available": match.get("available") if match.get("available") is not None else True,
                "found": True,
                "available_units": match.get("available_units"),
                "unit_type": match.get("name"),
                "rate": rate,
                "source": "manual_orbit_data",
            }}

        if tool_key in ("get_business_policy", "get_policies", "get_operating_hours"):
            category = (args.get("category") or "").lower()
            # business_hours is the generic (non-hotel) field from Business Data;
            # check_in_time/check_out_time remain the hotel-specific pair, untouched.
            hours_val = (
                extra.get("hours") or extra.get("operating_hours")
                or self._data.get("hours") or self._data.get("business_hours")
            )
            website = extra.get("website") or self._data.get("website")
            result = {}
            if any(k in category for k in ("website", "web", "url", "site", "link")):
                result = {
                    "website": website,
                    "catalogue_url": self._data.get("catalogue_url") or extra.get("catalogue_url"),
                }
            elif any(k in category for k in ("checkin", "check_in", "timing", "hours", "schedule")):
                result = {
                    "check_in_time": self._data.get("check_in_time"),
                    "check_out_time": self._data.get("check_out_time"),
                    "hours": hours_val,
                    "operating_hours": hours_val,
                    "business_hours": self._data.get("business_hours"),
                }
            elif any(k in category for k in ("buffet", "food", "meal", "breakfast", "dining", "menu")):
                result = {
                    "breakfast": self._data.get("buffet_breakfast"),
                    "lunch": self._data.get("buffet_lunch"),
                    "dinner": self._data.get("buffet_dinner"),
                }
            elif any(k in category for k in ("cancel", "refund", "reschedule", "policy")):
                result = {
                    "cancellation_policy": self._data.get("cancellation_policy") or extra.get("cancellation_policy"),
                    "refund_policy": self._data.get("refund_policy") or extra.get("refund_policy"),
                    "policies": extra.get("policies") or self._data.get("policies"),
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
                    "hours": hours_val,
                    "operating_hours": hours_val,
                    "business_hours": self._data.get("business_hours"),
                    "website": website,
                    "buffet_breakfast": self._data.get("buffet_breakfast"),
                    "buffet_lunch": self._data.get("buffet_lunch"),
                    "buffet_dinner": self._data.get("buffet_dinner"),
                    "cancellation_policy": self._data.get("cancellation_policy"),
                    "refund_policy": self._data.get("refund_policy"),
                    "active_offer": self._data.get("active_offer"),
                    "seasonal_note": self._data.get("seasonal_note"),
                    "catalogue_url": self._data.get("catalogue_url") or extra.get("catalogue_url"),
                }
                result.update(extra)
            populated = [v for k, v in result.items() if k != "source" and v not in (None, "", [], {})]
            if not populated:
                return self._not_in_business_data()
            result["source"] = "manual_orbit_data"
            return {"mock": False, "result": result}

        if tool_key in ("get_all_rates", "get_rates", "get_menu", "get_services", "get_catalogue"):
            catalogue_url = self._data.get("catalogue_url") or extra.get("catalogue_url")
            website = extra.get("website") or self._data.get("website")
            if not items and not catalogue_url and not website and not self._data.get("active_offer"):
                return self._not_in_business_data(
                    "Catalogue and services are not in current business data. Owner confirmation is required."
                )
            return {"mock": False, "result": {
                "catalogue_url": catalogue_url,
                "website": website,
                "services": items,
                "room_rates": self._data.get("room_rates") or [],
                "active_offer": self._data.get("active_offer"),
                "send_via": "elevenlabs",
                "source": "manual_orbit_data",
            }}

        return self._not_in_business_data(
            "This tool is not mapped to current business data. Owner confirmation is required."
        )

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
        "read": [
            "check_availability", "get_business_policy", "get_all_rates", "get_rates",
            "get_policies", "get_operating_hours", "get_services", "get_catalogue", "get_menu",
        ],
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


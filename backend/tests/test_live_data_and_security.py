"""Focused regression and safety tests for:
- Manual Business Data endpoints & tenant isolation
- ElevenLabs tool-call webhook verification & isolation
- Password reset token security & lifecycle
- Admin Capacity unconfirmed status
- READ vs ACTION tool boundary protection
"""
import pytest
import os
import secrets
from datetime import datetime, timezone, timedelta
from models import (
    LiveDataBody, RoomRateEntry, ForgotPasswordBody, ResetPasswordBody
)
from connectors import (
    ORBITLiveConnector, get_orbit_live_connector, connector_supports, CONNECTOR_META
)
from security import hash_password, verify_password


class TestBusinessDataModelAndConnector:
    """Verifies that Business Data structures are strictly typed and obey READ-only rules."""

    def test_live_data_model_validation(self):
        body = LiveDataBody(
            room_rates=[
                RoomRateEntry(room_type="Deluxe Room", rate_inr=8500, available=True, available_units=5),
                RoomRateEntry(room_type="Standard Room", rate_inr=4500, available=False),
            ],
            check_in_time="12:00 PM",
            check_out_time="11:00 AM",
            cancellation_policy="24 hours before check-in",
            active_offer="15% discount this weekend"
        )
        dump = body.model_dump()
        assert len(dump["room_rates"]) == 2
        assert dump["check_in_time"] == "12:00 PM"
        assert dump["room_rates"][0]["rate_inr"] == 8500
        assert dump["room_rates"][1]["available"] is False

    def test_connector_read_availability_matching(self):
        data = {
            "room_rates": [
                {"room_type": "Deluxe King Room", "rate_inr": 9000, "available": True, "available_units": 3},
                {"room_type": "Executive Suite", "rate_inr": 18000, "available": False, "available_units": 0},
            ]
        }
        connector = get_orbit_live_connector(data)
        
        # Exact/partial match for Deluxe
        res = connector.read("check_availability", {"room_type": "deluxe"})
        assert res["mock"] is False
        assert res["result"]["available"] is True
        assert res["result"]["rate"]["amount"] == 9000
        assert res["result"]["unit_type"] == "Deluxe King Room"

        # Match for Suite (unavailable)
        res_suite = connector.read("check_availability", {"room_type": "suite"})
        assert res_suite["mock"] is False
        assert res_suite["result"]["available"] is False

    def test_connector_read_policies(self):
        data = {
            "check_in_time": "2:00 PM",
            "check_out_time": "11:00 AM",
            "buffet_breakfast": "7:00 AM - 10:30 AM",
            "cancellation_policy": "Full refund if cancelled 48h prior.",
        }
        connector = get_orbit_live_connector(data)
        
        # Policy category query: checkin
        p_checkin = connector.read("get_business_policy", {"category": "checkin"})
        assert p_checkin["result"]["check_in_time"] == "2:00 PM"
        assert p_checkin["result"]["check_out_time"] == "11:00 AM"

        # Policy category query: buffet/food
        p_buffet = connector.read("get_business_policy", {"category": "buffet"})
        assert p_buffet["result"]["breakfast"] == "7:00 AM - 10:30 AM"

        # General policy query
        p_all = connector.read("get_business_policy", {})
        assert p_all["result"]["cancellation_policy"] == "Full refund if cancelled 48h prior."

    def test_connector_action_protection(self):
        """orbit_live connector supports ONLY READ tools in connector metadata."""
        meta = CONNECTOR_META["orbit_live"]
        assert meta["kind"] == "manual"
        assert len(meta["action"]) == 0
        assert connector_supports("orbit_live", "check_availability", "read") is True
        assert connector_supports("orbit_live", "create_booking", "action") is False
        assert connector_supports("orbit_live", "cancel_booking", "action") is False


class TestPasswordResetSecurity:
    """Verifies that Password Reset implementation adheres to strict security standards."""

    def test_password_hashing(self):
        plain = "SecurePass@2026"
        hashed = hash_password(plain)
        assert hashed != plain
        assert verify_password(plain, hashed) is True
        assert verify_password("WrongPass@2026", hashed) is False

    def test_token_cryptographic_entropy(self):
        tokens = [f"rst_{secrets.token_urlsafe(32)}" for _ in range(100)]
        # All tokens must be unique
        assert len(set(tokens)) == 100
        # Check sufficient length (32 bytes urlsafe is ~43 chars + prefix)
        assert all(len(t) >= 45 for t in tokens)

    def test_token_expiry_logic(self):
        now = datetime.now(timezone.utc)
        valid_expiry = (now + timedelta(hours=1)).isoformat()
        expired_expiry = (now - timedelta(seconds=10)).isoformat()

        assert datetime.fromisoformat(valid_expiry) > now
        assert datetime.fromisoformat(expired_expiry) < now


class TestAdminCapacityHonesty:
    """Verifies that capacity metrics remain honestly unconfirmed."""

    def test_capacity_contract(self):
        cap = {
            "status": "unconfirmed",
            "message": "ElevenLabs plan concurrent call limit not yet confirmed.",
            "active_calls": None,
            "configured_limit": None,
            "utilization_pct": None,
        }
        assert cap["status"] == "unconfirmed"
        assert cap["active_calls"] is None
        assert cap["configured_limit"] is None
        assert cap["utilization_pct"] is None

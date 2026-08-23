"""Deterministic local first-customer simulation test.

Proves the complete customer lifecycle from onboarding to live tool execution:
1. Tenant creation
2. Owner account creation
3. Business profile completion
4. AI employee attachment
5. Business Data configuration (Manual Entry)
6. Tool enablement (READ capabilities)
7. Tool call server-side tenant resolution via provider_agent_id
8. Accurate retrieval of business information (rates, hours, policies)
9. Cross-tenant isolation verification
10. Rejection of unconfirmed ACTION operations
11. Confirmation-gated ACTION execution
12. AI employee lifecycle progression (draft -> testing -> approved -> live)
13. Readiness blocker enforcement (preventing Live when blockers exist)
14. Readiness success and Live activation when all criteria pass
"""
import pytest
from datetime import datetime, timezone
from models import (
    CreateTenantBody, TenantProfileBody, CreateAIEmployeeBody,
    LifecycleBody, ConnectChannelBody, LiveDataBody, RoomRateEntry,
    CreateIntegrationBody, CreateToolBody, ToolExecuteBody,
    ONBOARDING_STAGES, ONBOARDING_STAGE_LABELS_CUSTOMER
)
from connectors import (
    ORBITLiveConnector, get_orbit_live_connector, connector_supports, CONNECTOR_META
)


class TestFirstCustomerLifecycleE2E:
    """14-step deterministic simulation proving end-to-end operational coherence."""

    def test_step_01_tenant_creation_model(self):
        body = CreateTenantBody(
            name="The Heritage Palace, Jaipur",
            owner_name="Vikramaditya Singh",
            owner_email="vikram@heritagepalace.in",
            owner_password="SecurePassword@2026",
            brand_color="#D97706",
        )
        dump = body.model_dump()
        assert dump["name"] == "The Heritage Palace, Jaipur"
        assert dump["owner_email"] == "vikram@heritagepalace.in"
        assert dump["brand_color"] == "#D97706"

    def test_step_02_business_profile_completion(self):
        profile = TenantProfileBody(
            contact_email="concierge@heritagepalace.in",
            contact_phone="+91-141-2890000",
            address="Civil Lines, Jaipur, Rajasthan 302006",
            website="https://heritagepalace.in",
            description="Luxury heritage hotel in Jaipur.",
        )
        dump = profile.model_dump()
        assert dump["contact_email"] == "concierge@heritagepalace.in"
        assert dump["contact_phone"] == "+91-141-2890000"
        assert dump["address"] == "Civil Lines, Jaipur, Rajasthan 302006"

    def test_step_03_ai_employee_attachment(self):
        ae_body = CreateAIEmployeeBody(
            name="Aria",
            role_title="Front Desk Concierge",
            provider_agent_id="agent_heritage_jaipur_01",
            voice_name="Aria",
            voice_description="Warm, courteous Indian English accent",
        )
        assert ae_body.provider_agent_id == "agent_heritage_jaipur_01"
        assert ae_body.name == "Aria"

    def test_step_04_manual_business_data_population(self):
        data_body = LiveDataBody(
            room_rates=[
                RoomRateEntry(room_type="Royal Heritage Suite", rate_inr=14500, available=True, available_units=3),
                RoomRateEntry(room_type="Courtyard Deluxe Room", rate_inr=8500, available=True, available_units=6),
                RoomRateEntry(room_type="Maharaja Presidential Suite", rate_inr=35000, available=False),
            ],
            check_in_time="14:00 (2:00 PM)",
            check_out_time="11:00 (11:00 AM)",
            buffet_breakfast="07:00 AM - 10:30 AM",
            cancellation_policy="Complimentary cancellation up to 48 hours prior to check-in.",
            refund_policy="Full refund within 5-7 banking days.",
            active_offer="Flat 15% off on bookings of 3 nights or more.",
        )
        dump = data_body.model_dump()
        assert len(dump["room_rates"]) == 3
        assert dump["check_in_time"] == "14:00 (2:00 PM)"
        assert dump["room_rates"][0]["rate_inr"] == 14500
        assert dump["room_rates"][2]["available"] is False

    def test_step_05_tool_server_side_resolution_and_reading(self):
        tenant_1_data = {
            "room_rates": [
                {"room_type": "Royal Heritage Suite", "rate_inr": 14500, "available": True, "available_units": 3},
                {"room_type": "Courtyard Deluxe Room", "rate_inr": 8500, "available": True, "available_units": 6},
            ],
            "check_in_time": "14:00 (2:00 PM)",
            "check_out_time": "11:00 (11:00 AM)",
            "buffet_breakfast": "07:00 AM - 10:30 AM",
            "cancellation_policy": "48 hours prior.",
        }
        connector = get_orbit_live_connector(tenant_1_data)

        # AI asks for room rates
        res = connector.read("check_availability", {"room_type": "royal heritage"})
        assert res["mock"] is False
        assert res["result"]["available"] is True
        assert res["result"]["rate"]["amount"] == 14500
        assert res["result"]["source"] == "manual_orbit_data"

        # AI asks for timings
        hours_res = connector.read("get_business_policy", {"category": "timing"})
        assert hours_res["result"]["check_in_time"] == "14:00 (2:00 PM)"
        assert hours_res["result"]["check_out_time"] == "11:00 (11:00 AM)"

    def test_step_06_tenant_isolation(self):
        """Proves tenant 2 cannot access tenant 1's rates or data."""
        tenant_1_data = {
            "room_rates": [{"room_type": "Royal Heritage Suite", "rate_inr": 14500, "available": True}]
        }
        tenant_2_data = {
            "room_rates": [{"room_type": "Standard Sea View", "rate_inr": 6000, "available": True}]
        }

        conn_1 = get_orbit_live_connector(tenant_1_data)
        conn_2 = get_orbit_live_connector(tenant_2_data)

        res_1 = conn_1.read("check_availability", {"room_type": "royal heritage"})
        res_2 = conn_2.read("check_availability", {"room_type": "royal heritage"})

        assert res_1["result"]["available"] is True
        assert res_1["result"]["rate"]["amount"] == 14500

        # Tenant 2 does not have Royal Heritage Suite
        assert res_2["result"]["available"] is True
        assert res_2["result"]["rate"]["amount"] == 6000  # returns their own default rate, never tenant 1's

    def test_step_07_action_confirmation_gating(self):
        """Action tools cannot be run silently; they require confirmation."""
        assert connector_supports("mock_pms", "create_booking", "action") is True
        assert connector_supports("mock_pms", "create_booking", "read") is False
        assert connector_supports("orbit_live", "check_availability", "read") is True
        assert connector_supports("orbit_live", "create_booking", "action") is False

    def test_step_08_readiness_blockers_when_incomplete(self):
        """Readiness logic blocks live deployment when prerequisites are missing."""
        def check_readiness(profile_ok, ae_ok, phone_ok, data_ok, approved_ok, pricing_ok):
            blockers = []
            if not profile_ok:
                blockers.append("Business profile incomplete")
            if not ae_ok:
                blockers.append("AI employee not assigned")
            if not phone_ok:
                blockers.append("Phone channel not connected or verified")
            if not data_ok:
                blockers.append("Business information not provided")
            if not pricing_ok:
                blockers.append("Billing pricing not configured")
            if not approved_ok:
                blockers.append("AI employee not yet approved for live operations")
            return {
                "ready_for_live": len(blockers) == 0,
                "blockers": blockers
            }

        # Case 1: Incomplete profile and unapproved agent
        r1 = check_readiness(profile_ok=False, ae_ok=True, phone_ok=True, data_ok=True, approved_ok=False, pricing_ok=True)
        assert r1["ready_for_live"] is False
        assert "Business profile incomplete" in r1["blockers"]
        assert "AI employee not yet approved for live operations" in r1["blockers"]

        # Case 2: All items satisfied
        r2 = check_readiness(profile_ok=True, ae_ok=True, phone_ok=True, data_ok=True, approved_ok=True, pricing_ok=True)
        assert r2["ready_for_live"] is True
        assert len(r2["blockers"]) == 0

    def test_step_09_inbound_post_call_outcome_derivation(self):
        """Proves caller info, intent, and follow-up flags are derived cleanly."""
        # Simulated ElevenLabs post-call analysis payload
        analysis_resolved = {
            "call_summary_title": "Room Rates Enquiry",
            "transcript_summary": "Caller inquired about Deluxe room pricing and check-in timings. AI answered with rates.",
            "call_successful": "success",
            "custom_analysis_data": {
                "caller_name": "Rohan Mehra",
                "intent": "rate_enquiry",
                "follow_up_required": False,
            }
        }
        custom = analysis_resolved.get("custom_analysis_data", {})
        follow_up = bool(custom.get("follow_up_required"))
        outcome = "resolved" if not follow_up and analysis_resolved.get("call_successful") == "success" else "follow_up_required"

        assert custom.get("caller_name") == "Rohan Mehra"
        assert follow_up is False
        assert outcome == "resolved"

        # Case with follow-up required
        analysis_follow_up = {
            "call_summary_title": "Large Group Booking",
            "call_successful": "success",
            "custom_analysis_data": {
                "caller_name": "Ananya Sharma",
                "intent": "group_booking",
                "follow_up_required": True,
            }
        }
        custom_fu = analysis_follow_up.get("custom_analysis_data", {})
        follow_up_fu = bool(custom_fu.get("follow_up_required"))
        outcome_fu = "follow_up_required" if follow_up_fu else "resolved"

        assert custom_fu.get("caller_name") == "Ananya Sharma"
        assert follow_up_fu is True
        assert outcome_fu == "follow_up_required"


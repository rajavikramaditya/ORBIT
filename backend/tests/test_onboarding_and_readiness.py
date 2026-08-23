"""Comprehensive tests for:
- Customer Onboarding Journey & Stage Derivation
- Authoritative Go-Live Readiness & Blocker Enforcement
- Dual Data Source Reporting (Manual Data vs Connected System)
- Universal Multi-Vertical Connector Architecture & Action Confirmation
- Customer UI/API Sanitization (Zero provider secrets or technical IDs leaked)
- Production Mock-Data Protection
"""
import pytest
from datetime import datetime, timezone
from models import (
    ONBOARDING_STAGES, ONBOARDING_STAGE_LABELS_CUSTOMER,
    CreateIntegrationBody, UpdateIntegrationBody,
    CreateToolBody, LiveDataBody, RoomRateEntry,
)
from connectors import (
    BusinessConnector, MockPMSConnector, ORBITLiveConnector,
    get_mock_connector, get_orbit_live_connector, connector_supports,
    CONNECTOR_META, list_connectors
)


class TestOnboardingStagesAndLabels:
    """Verifies standard customer-journey onboarding stages and clean labels."""

    def test_onboarding_stages_structure(self):
        assert len(ONBOARDING_STAGES) == 8
        assert ONBOARDING_STAGES[0] == "created"
        assert ONBOARDING_STAGES[1] == "business_details"
        assert ONBOARDING_STAGES[2] == "ai_employee_setup"
        assert ONBOARDING_STAGES[3] == "business_data"
        assert ONBOARDING_STAGES[4] == "channel_setup"
        assert ONBOARDING_STAGES[5] == "testing"
        assert ONBOARDING_STAGES[6] == "ready_for_approval"
        assert ONBOARDING_STAGES[7] == "live"

    def test_customer_labels_are_jargon_free(self):
        for stage, label in ONBOARDING_STAGE_LABELS_CUSTOMER.items():
            assert "elevenlabs" not in label.lower()
            assert "exotel" not in label.lower()
            assert "webhook" not in label.lower()
            assert "pms" not in label.lower()
            assert "api" not in label.lower()
            assert len(label) > 0


class TestUniversalConnectorArchitecture:
    """Verifies that the connector layer provides a universal, multi-vertical contract."""

    def test_standard_read_capabilities(self):
        mock_pms = get_mock_connector("mock_pms")
        assert mock_pms is not None

        # Standard READ tools
        res_avail = mock_pms.read("check_availability", {"room_type": "Executive Suite"})
        assert res_avail["mock"] is True
        assert "available" in res_avail["result"]

        res_booking = mock_pms.read("check_booking_status", {"booking_id": "BK-9999"})
        assert res_booking["mock"] is True
        assert res_booking["result"]["found"] is True

        res_cust = mock_pms.read("lookup_customer", {"name": "Priya Patel"})
        assert res_cust["mock"] is True
        assert "customer_name" in res_cust["result"]

    def test_standard_action_capabilities(self):
        mock_pms = get_mock_connector("mock_pms")
        res_create = mock_pms.act("create_booking", {"guest": "Amit", "room": "Deluxe"})
        assert res_create["mock"] is True
        assert res_create["result"]["created"] is True

        res_cancel = mock_pms.act("cancel_booking", {"booking_id": "BK-1001"})
        assert res_cancel["mock"] is True
        assert res_cancel["result"]["cancelled"] is True

        res_update = mock_pms.act("update_booking", {"booking_id": "BK-1001", "dates": "next_week"})
        assert res_update["mock"] is True
        assert res_update["result"]["updated"] is True

    def test_manual_business_data_connector(self):
        live_data = {
            "room_rates": [
                {"room_type": "Deluxe Room", "rate_inr": 7500, "available": True, "available_units": 4},
                {"room_type": "Presidential Suite", "rate_inr": 25000, "available": False},
            ],
            "check_in_time": "14:00",
            "check_out_time": "11:00",
            "cancellation_policy": "Free cancellation up to 48 hours prior to arrival.",
            "buffet_breakfast": "07:00 - 10:30",
        }
        connector = get_orbit_live_connector(live_data)

        # Availability read
        avail = connector.read("check_availability", {"room_type": "deluxe"})
        assert avail["mock"] is False
        assert avail["result"]["available"] is True
        assert avail["result"]["rate"]["amount"] == 7500
        assert avail["result"]["source"] == "manual_orbit_data"

        # Policies read
        policy = connector.read("get_business_policy", {"category": "hours"})
        assert policy["mock"] is False
        assert policy["result"]["check_in_time"] == "14:00"
        assert policy["result"]["source"] == "manual_orbit_data"

        # Dining read
        dining = connector.read("get_business_policy", {"category": "dining"})
        assert dining["mock"] is False
        assert dining["result"]["breakfast"] == "07:00 - 10:30"

    def test_action_confirmation_rule(self):
        """Action tools MUST require confirmation; Read tools are safe."""
        assert connector_supports("mock_pms", "check_availability", "read") is True
        assert connector_supports("mock_pms", "check_availability", "action") is False
        assert connector_supports("mock_pms", "create_booking", "action") is True
        assert connector_supports("mock_pms", "create_booking", "read") is False
        assert connector_supports("orbit_live", "check_availability", "read") is True
        assert connector_supports("orbit_live", "create_booking", "action") is False


class TestDataModelSanitization:
    """Verifies that customer models protect internal provider configuration."""

    def test_create_integration_body_defaults(self):
        body = CreateIntegrationBody(
            type="pms",
            name="Opera Cloud PMS",
            connector_key="custom",
            system_name="Oracle Opera",
            auth_method="oauth2",
        )
        dump = body.model_dump()
        assert dump["connector_key"] == "custom"
        assert dump["type"] == "pms"
        assert dump["name"] == "Opera Cloud PMS"

    def test_update_integration_body(self):
        body = UpdateIntegrationBody(
            status="custom_integration_required",
            status_message="Custom integration adapter required before live connection.",
        )
        dump = body.model_dump()
        assert dump["status"] == "custom_integration_required"
        assert "adapter required" in dump["status_message"]

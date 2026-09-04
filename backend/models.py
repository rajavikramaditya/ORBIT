import uuid
from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def gen_id(prefix: str = "") -> str:
    return f"{prefix}{uuid.uuid4().hex[:16]}" if prefix else str(uuid.uuid4())


# ---- Auth request bodies ----
class RegisterBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str
    business_name: Optional[str] = None
    hotel_name: Optional[str] = None
    # Self-serve signups pick their own vertical too — not just admin-created tenants.
    business_type: Optional[str] = None
    # Collected on the same signup screen so the business profile is complete
    # from the start — no separate "a few more details" page right after signup.
    contact_phone: Optional[str] = None
    address: Optional[str] = None



class LoginBody(BaseModel):
    email: EmailStr
    password: str


class GoogleExchangeBody(BaseModel):
    ticket: str


# ---- Admin bodies ----
# ORBIT started with hotels; this platform is meant to serve any business.
# New verticals get added here as ORBIT signs them up — this list does not
# gate what a tenant can do, it only picks which Business Data fields show.
BUSINESS_TYPES = {"hotel", "restaurant", "salon", "clinic", "retail", "other"}


class CreateTenantBody(BaseModel):
    name: str
    owner_email: EmailStr
    owner_name: str
    owner_password: str = Field(min_length=6)
    brand_color: Optional[str] = "#18181B"
    business_type: Optional[str] = "hotel"


class TenantStatusBody(BaseModel):
    status: str  # onboarding | live | suspended


class BusinessTypeBody(BaseModel):
    business_type: str  # one of BUSINESS_TYPES — admin can correct an existing tenant's vertical


class CreateAIEmployeeBody(BaseModel):
    name: str
    role_title: str = "Front Desk Concierge"
    provider: Optional[str] = "elevenlabs"  # voice AI platform key (see voice_providers.py registry)
    provider_agent_id: str
    voice_name: str = "Aria"
    voice_description: str = "Warm, professional Indian English"


class LifecycleBody(BaseModel):
    to_state: str  # testing | approved | live | suspended | draft


class ConnectChannelBody(BaseModel):
    type: str  # phone | whatsapp
    connected_identifier: str
    assigned_ai_employee_id: Optional[str] = None


class UpdateChannelBody(BaseModel):
    status: Optional[str] = None
    connected_identifier: Optional[str] = None
    assigned_ai_employee_id: Optional[str] = None


class CustomizationStatusBody(BaseModel):
    status: str
    admin_notes: Optional[str] = None


# ---- Tenant bodies ----
class TenantProfileBody(BaseModel):
    name: Optional[str] = None
    logo_url: Optional[str] = None
    website: Optional[str] = None
    address: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    description: Optional[str] = None
    brand_color: Optional[str] = None
    # Customer can change their own vertical any time from Settings — not admin-only.
    business_type: Optional[str] = None


class CustomizationRequestBody(BaseModel):
    category: str  # system_prompt | personality | knowledge_base | tools | workflows | voice | other
    title: str
    details: str
    priority: Optional[str] = "normal"


class SimulateCallBody(BaseModel):
    direction: Optional[str] = "inbound"
    external_number: Optional[str] = None


# ---- Lifecycle & Onboarding rules ----
LIFECYCLE_TRANSITIONS = {
    "draft": {"testing"},
    "testing": {"approved", "draft"},
    "approved": {"live", "testing"},
    "live": {"suspended"},
    "suspended": {"live"},
}

TENANT_STATUSES = {"onboarding", "live", "suspended"}
# Derived operational state (not a stored tenant.status value).
OPERATIONAL_STATES = {"onboarding", "ready_for_test", "live", "suspended", "blocked"}
CHANNEL_PLANS = {"phone", "whatsapp", "phone_and_whatsapp"}

# Standard customer-journey onboarding stages
ONBOARDING_STAGES = [
    "created",
    "business_details",
    "ai_employee_setup",
    "business_data",
    "channel_setup",
    "testing",
    "ready_for_approval",
    "live",
]

# Customer-friendly labels (zero technical jargon)
ONBOARDING_STAGE_LABELS_CUSTOMER = {
    "created": "Account created",
    "business_details": "Business setup",
    "ai_employee_setup": "AI employee setup",
    "business_data": "Business information",
    "channel_setup": "Channels",
    "testing": "Testing & preview",
    "ready_for_approval": "Ready for approval",
    "live": "Live and active",
}

INTEGRATION_STATUSES = {
    "connected",
    "action_required",
    "not_connected",
    "custom_integration_required",
}


# ---- Business Integration + Tool layer ----
class CreateIntegrationBody(BaseModel):
    type: str  # pms | pos | calendar | crm | custom
    name: str
    connector_key: str = "mock_pms"   # mock_pms | custom | <live connector>
    provider: Optional[str] = None    # defaults to connector_key
    mode: str = "mock"          # mock (demo) | live (real)
    status: Optional[str] = None      # connected | action_required | custom_integration_required | not_connected
    system_name: Optional[str] = None
    auth_method: Optional[str] = None
    api_docs_url: Optional[str] = None
    required_capabilities: Optional[list] = None
    notes: Optional[str] = None
    status_message: Optional[str] = None


class UpdateIntegrationBody(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    mode: Optional[str] = None
    system_name: Optional[str] = None
    auth_method: Optional[str] = None
    api_docs_url: Optional[str] = None
    notes: Optional[str] = None
    status_message: Optional[str] = None
    last_verified_at: Optional[str] = None


class CreateToolBody(BaseModel):
    key: str
    name: str
    kind: str  # read | action

    enabled: bool = True
    requires_confirmation: bool = False
    description: Optional[str] = ""


class UpdateToolBody(BaseModel):
    name: Optional[str] = None
    enabled: Optional[bool] = None
    requires_confirmation: Optional[bool] = None


class ToolExecuteBody(BaseModel):
    args: Optional[dict] = None
    confirmed: Optional[bool] = False


INTEGRATION_TYPES = {"pms", "pos", "calendar", "crm", "custom"}
TOOL_KINDS = {"read", "action"}
TENANT_ENVIRONMENTS = {"demo", "production"}
INTEGRATION_STATUSES = {"not_connected", "action_required", "integrating", "testing", "connected", "error"}


class EnvironmentBody(BaseModel):
    environment: str  # demo | production


class ChannelPlanBody(BaseModel):
    channel_plan: str  # phone | whatsapp | phone_and_whatsapp


class KnowledgeBaseBody(BaseModel):
    business_info: Optional[str] = None
    services: Optional[str] = None
    policies: Optional[str] = None
    hours: Optional[str] = None
    faqs: Optional[list] = None
    instructions: Optional[str] = None


class PricingBody(BaseModel):
    ai_voice_per_min: Optional[float] = None
    telephony_per_min: Optional[float] = None
    whatsapp_per_message: Optional[float] = None
    orbit_markup_pct: Optional[float] = None
    service_charge: Optional[float] = None
    gst_pct: Optional[float] = None
    warning_threshold: Optional[float] = None
    hard_cap: Optional[float] = None


class GenerateInvoiceBody(BaseModel):
    period: Optional[str] = None  # YYYY-MM; defaults to current month


# ---- Live Data (Dynamic Webhook Data Source) ----
class RoomRateEntry(BaseModel):
    room_type: str
    rate_inr: float
    available: bool = True
    available_units: Optional[int] = None


class LiveDataBody(BaseModel):
    """Tenant-managed dynamic data fetched by AI agent via webhook during calls.
    This replaces static knowledge-base entries for frequently changing business data."""
    # Rates & Inventory
    room_rates: Optional[List[RoomRateEntry]] = None
    # Operational timings
    check_in_time: Optional[str] = None       # e.g. "12:00 PM"
    check_out_time: Optional[str] = None      # e.g. "11:00 AM"
    buffet_breakfast: Optional[str] = None    # e.g. "7:00 AM - 10:30 AM"
    buffet_lunch: Optional[str] = None
    buffet_dinner: Optional[str] = None
    # Policies
    cancellation_policy: Optional[str] = None
    refund_policy: Optional[str] = None
    # Special offers / announcements
    active_offer: Optional[str] = None        # e.g. "20% off on Deluxe rooms this weekend"
    seasonal_note: Optional[str] = None       # e.g. "Diwali special package available"
    catalogue_url: Optional[str] = None
    services: Optional[list] = None
    # Generic operating-hours text for non-hotel business types (hotels keep
    # using check_in_time/check_out_time/buffet_* above, unchanged).
    business_hours: Optional[str] = None
    # Extra free-form key-value pairs for business-specific data
    extra: Optional[dict] = None


class FormIntakeBody(BaseModel):
    source: Optional[str] = None
    customer_name: Optional[str] = None
    name: Optional[str] = None
    phone: Optional[str] = None
    customer_phone: Optional[str] = None
    email: Optional[str] = None
    customer_email: Optional[str] = None
    requirement: Optional[str] = None
    message: Optional[str] = None
    enquiry: Optional[str] = None
    owner_callback_requested: Optional[bool] = False
    idempotency_key: Optional[str] = None
    tenant_id: Optional[str] = None  # ignored if present


# ---- Password Reset ----
class ForgotPasswordBody(BaseModel):
    email: EmailStr


class ResetPasswordBody(BaseModel):
    token: str
    new_password: str = Field(min_length=6)


# ---- Inbound enquiry / lead (not a CRM) ----
# Sources are labels only. Unknown stays unknown — never invented.
LEAD_SOURCES = {"phone", "whatsapp", "website", "instagram", "facebook", "form", "unknown"}
# Operational lifecycle — not a sales pipeline board.
LEAD_STATUSES = {"new", "contacted", "qualified", "follow_up", "unqualified", "won", "lost"}
# Allowed owner/system moves. Same-status is always allowed. Terminal: won, lost.
LEAD_TRANSITIONS = {
    "new": {"contacted", "qualified", "follow_up", "unqualified", "won", "lost"},
    "contacted": {"qualified", "follow_up", "unqualified", "won", "lost"},
    "qualified": {"contacted", "follow_up", "won", "lost"},
    "follow_up": {"contacted", "qualified", "won", "lost", "unqualified"},
    "unqualified": {"contacted", "follow_up", "lost"},
    "won": set(),
    "lost": set(),
}
QUALIFICATION_STATUSES = {"unknown", "unqualified", "qualified"}
CALLBACK_STATUSES = {"requested", "contacted", "completed", "cancelled"}
INTENT_LEVELS = {"high", "medium", "low"}
URGENCY_LEVELS = {"high", "medium", "low"}
ORBIT_LEAD_PERSIST_TOOLS = {"capture_lead", "qualify_lead", "request_owner_callback"}
# Older persisted values mapped when read/written.
LEAD_STATUS_ALIASES = {"converted": "won", "other": "unknown", "social": "unknown"}


# ---- Account deletion (customer request -> ORBIT confirm -> 30-day soft delete) ----
class AccountDeletionRequestBody(BaseModel):
    reason: Optional[str] = None


class LeadPatchBody(BaseModel):
    lead_status: Optional[str] = None
    qualification_status: Optional[str] = None
    follow_up_required: Optional[bool] = None
    follow_up_at: Optional[str] = None
    notes: Optional[str] = None
    lost_reason: Optional[str] = None
    owner_callback_requested: Optional[bool] = None


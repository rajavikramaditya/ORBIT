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
    hotel_name: str


class LoginBody(BaseModel):
    email: EmailStr
    password: str


# ---- Admin bodies ----
class CreateTenantBody(BaseModel):
    name: str
    owner_email: EmailStr
    owner_name: str
    owner_password: str = Field(min_length=6)
    brand_color: Optional[str] = "#18181B"


class TenantStatusBody(BaseModel):
    status: str  # onboarding | live | suspended


class CreateAIEmployeeBody(BaseModel):
    name: str
    role_title: str = "Front Desk Concierge"
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


class CustomizationRequestBody(BaseModel):
    category: str  # system_prompt | personality | knowledge_base | tools | workflows | voice | other
    title: str
    details: str
    priority: Optional[str] = "normal"


class SimulateCallBody(BaseModel):
    direction: Optional[str] = "inbound"
    external_number: Optional[str] = None


# ---- Lifecycle rules ----
LIFECYCLE_TRANSITIONS = {
    "draft": {"testing"},
    "testing": {"approved", "draft"},
    "approved": {"live", "testing"},
    "live": {"suspended"},
    "suspended": {"live"},
}

TENANT_STATUSES = {"onboarding", "live", "suspended"}


# ---- Business Integration + Tool layer ----
class CreateIntegrationBody(BaseModel):
    type: str  # pms | pos | calendar | crm | custom
    name: str
    provider: str = "mock_pms"
    mode: str = "mock"          # mock (demo) | live (real)
    status: str = "connected"   # connected | action_required | not_connected


class UpdateIntegrationBody(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    mode: Optional[str] = None


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

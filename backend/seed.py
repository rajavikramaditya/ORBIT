import os
from db import db
from models import now_iso
from security import hash_password, verify_password


async def create_indexes():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.users.create_index("tenant_id")
    await db.user_sessions.create_index("session_token")
    await db.auth_tickets.create_index("ticket_hash", unique=True)
    await db.auth_tickets.create_index("expires_at", expireAfterSeconds=0)
    await db.tenants.create_index("id", unique=True)
    await db.ai_employees.create_index("provider_agent_id", unique=True)
    await db.ai_employees.create_index("tenant_id")
    await db.channels.create_index("tenant_id")
    try:
        await db.channels.create_index(
            [("type", 1), ("normalized_identifier", 1)],
            unique=True,
            name="channel_type_identifier_unique",
            partialFilterExpression={"normalized_identifier": {"$type": "string"}},
        )
    except Exception:
        pass
    await db.conversations.create_index("provider_conversation_id", unique=True)
    await db.conversations.create_index("tenant_id")
    await db.conversations.create_index([("tenant_id", 1), ("created_at", -1)])
    await db.usage_ledger.create_index("event_id", unique=True)
    await db.usage_ledger.create_index("tenant_id")
    await db.customization_requests.create_index("tenant_id")
    await db.business_integrations.create_index("tenant_id")
    await db.tools.create_index("tenant_id")
    await db.tool_invocation_log.create_index("tenant_id")
    await db.tenant_pricing.create_index("tenant_id", unique=True)
    await db.invoices.create_index("tenant_id")
    await db.webhook_quarantine.create_index("created_at")
    await db.audit_log.create_index("tenant_id")
    await db.leads.create_index("id", unique=True)
    await db.leads.create_index("tenant_id")
    await db.leads.create_index([("tenant_id", 1), ("created_at", -1)])
    await db.leads.create_index("conversation_id", unique=True, sparse=True)
    # Sparse unique on (tenant_id, provider_conversation_id) treats missing
    # provider ids as null and allows only one such lead per tenant. Use a
    # partial index so callback/tool-call enquiries without a conversation
    # remain distinct records.
    info = await db.leads.index_information()
    for name, spec in info.items():
        keys = spec.get("key") or []
        if list(keys) == [("tenant_id", 1), ("provider_conversation_id", 1)]:
            try:
                await db.leads.drop_index(name)
            except Exception:
                pass
    await db.leads.create_index(
        [("tenant_id", 1), ("provider_conversation_id", 1)],
        unique=True,
        name="tenant_provider_conv_unique",
        partialFilterExpression={"provider_conversation_id": {"$type": "string"}},
    )
    await db.owner_callback_requests.create_index("id", unique=True)
    await db.owner_callback_requests.create_index("tenant_id")
    cb_info = await db.owner_callback_requests.index_information()
    for name, spec in cb_info.items():
        keys = spec.get("key") or []
        if list(keys) == [("tenant_id", 1), ("conversation_id", 1)]:
            try:
                await db.owner_callback_requests.drop_index(name)
            except Exception:
                pass
    await db.owner_callback_requests.create_index(
        [("tenant_id", 1), ("conversation_id", 1)],
        unique=True,
        name="tenant_callback_conv_unique",
        partialFilterExpression={"conversation_id": {"$type": "string"}},
    )
    await db.inbound_events.create_index("tenant_id")
    await db.inbound_events.create_index(
        [("provider", 1), ("provider_event_id", 1)], unique=True
    )
    await db.tenants.create_index("intake_key", unique=True, sparse=True)
    lead_info = await db.leads.index_information()
    for name, spec in lead_info.items():
        keys = spec.get("key") or []
        if list(keys) == [("tenant_id", 1), ("intake_idempotency_key", 1)]:
            try:
                await db.leads.drop_index(name)
            except Exception:
                pass
    await db.leads.create_index(
        [("tenant_id", 1), ("intake_idempotency_key", 1)],
        unique=True,
        name="tenant_intake_idempotency",
        partialFilterExpression={"intake_idempotency_key": {"$type": "string"}},
    )


async def _upsert(collection, doc):
    await db[collection].update_one({"id": doc["id"]}, {"$setOnInsert": doc}, upsert=True)


async def seed_platform_admin():
    email = os.environ["ADMIN_EMAIL"].lower()
    password = os.environ["ADMIN_PASSWORD"]
    existing = (
        await db.users.find_one({"id": "usr_orbit_admin"})
        or await db.users.find_one({"email": email})
        or await db.users.find_one({"role": "platform_admin"})
    )
    if existing is None:
        await db.users.insert_one({
            "id": "usr_orbit_admin",
            "email": email,
            "password_hash": hash_password(password),
            "name": "ORBIT Admin",
            "role": "platform_admin",
            "tenant_id": None,
            "auth_provider": "password",
            "created_at": now_iso(),
        })
    else:
        update_fields = {}
        if existing.get("email") != email:
            update_fields["email"] = email
        if not verify_password(password, existing.get("password_hash", "")):
            update_fields["password_hash"] = hash_password(password)
        if update_fields:
            await db.users.update_one({"_id": existing["_id"]}, {"$set": update_fields})


async def seed_demo_data():
    # ---- Tenant: The Taj Palace (live) ----
    await _upsert("tenants", {
        "id": "tenant_taj_palace",
        "slug": "taj-palace-mumbai",
        "name": "The Taj Palace, Mumbai",
        "status": "live",
        "environment": "demo",
        "profile": {
            "logo_url": "",
            "website": "https://tajpalace.example.in",
            "address": "Apollo Bunder, Colaba, Mumbai 400001",
            "contact_email": "frontdesk@tajpalace.in",
            "contact_phone": "+91 22 6665 3366",
            "description": "A landmark luxury hotel offering timeless Indian hospitality.",
        },
        "branding": {"brand_color": "#1E3A5F", "logo_url": ""},
        "created_at": now_iso(),
    })
    owner_email = os.environ["DEMO_OWNER_EMAIL"].lower()
    if await db.users.find_one({"email": owner_email}) is None:
        await db.users.insert_one({
            "id": "usr_taj_owner",
            "email": owner_email,
            "password_hash": hash_password(os.environ["DEMO_OWNER_PASSWORD"]),
            "name": "Priya Sharma",
            "role": "owner",
            "tenant_id": "tenant_taj_palace",
            "auth_provider": "password",
            "created_at": now_iso(),
        })

    await _upsert("ai_employees", {
        "id": "ae_taj_aria",
        "tenant_id": "tenant_taj_palace",
        "name": "Riya",
        "role_title": "AI Reservation Assistant",
        "provider": "elevenlabs",
        "provider_agent_id": "agent_taj_aria_001",
        "lifecycle_state": "live",
        "voice_name": "Riya",
        "voice_description": "Warm, professional Indian English",
        "knowledge_base": {
            "business_info": "The Taj Palace, Mumbai — a landmark luxury hotel at Apollo Bunder, Colaba.",
            "services": "Rooms & suites, fine dining, rooftop restaurant, spa & wellness, banquets, airport transfers.",
            "policies": "Check-in 2 PM, check-out 12 PM. Free cancellation up to 24h before arrival.",
            "hours": "Front desk 24x7. Restaurant 7 AM-11 PM. Spa 9 AM-9 PM.",
            "faqs": [{"q": "Do you offer airport pickup?", "a": "Yes, on request at an additional charge."}],
            "instructions": "Be warm and concise. For live room availability or bookings, use the connected business tools — never quote availability from memory.",
        },
        "config_ref": "cfg/taj/riya/v3",
        "created_at": now_iso(),
        "updated_at": now_iso(),
    })
    await _upsert("channels", {
        "id": "ch_taj_phone",
        "tenant_id": "tenant_taj_palace",
        "type": "phone",
        "provider": "exotel",
        "status": "connected",
        "connected_identifier": "+91 22 6789 0000",
        "normalized_identifier": "912267890000",
        "assigned_ai_employee_id": "ae_taj_aria",
        "meta": {"circle": "Mumbai"},
        "created_at": now_iso(),
    })
    await _upsert("channels", {
        "id": "ch_taj_wa",
        "tenant_id": "tenant_taj_palace",
        "type": "whatsapp",
        "provider": "elevenlabs_whatsapp",
        "status": "action_required",
        "connected_identifier": "+91 22 6789 0000",
        "normalized_identifier": "912267890000",
        "assigned_ai_employee_id": "ae_taj_aria",
        "meta": {"note": "Meta Business verification pending — ORBIT team completing onboarding."},
        "created_at": now_iso(),
    })
    await _upsert("customization_requests", {
        "id": "cr_taj_1",
        "tenant_id": "tenant_taj_palace",
        "requested_by": "usr_taj_owner",
        "requested_by_name": "Priya Sharma",
        "category": "knowledge_base",
        "title": "Add spa & wellness menu to knowledge base",
        "details": "Please train Aria on our new spa treatment list and pricing so she can answer guest queries.",
        "priority": "normal",
        "status": "in_review",
        "admin_notes": "",
        "created_at": now_iso(),
        "updated_at": now_iso(),
    })

    # ---- Tenant: The Leela (onboarding) — used for isolation coverage ----
    await _upsert("tenants", {
        "id": "tenant_leela_blr",
        "slug": "leela-bengaluru",
        "name": "The Leela Palace, Bengaluru",
        "status": "onboarding",
        "environment": "demo",
        "profile": {
            "logo_url": "",
            "website": "https://leela.example.in",
            "address": "Old Airport Road, Bengaluru 560008",
            "contact_email": "reception@leela.in",
            "contact_phone": "+91 80 2521 1234",
            "description": "Contemporary luxury in the heart of Bengaluru.",
        },
        "branding": {"brand_color": "#7A5C2E", "logo_url": ""},
        "created_at": now_iso(),
    })
    if await db.users.find_one({"email": "owner@leela.in"}) is None:
        await db.users.insert_one({
            "id": "usr_leela_owner",
            "email": "owner@leela.in",
            "password_hash": hash_password("Hotel@2026"),
            "name": "Arjun Nair",
            "role": "owner",
            "tenant_id": "tenant_leela_blr",
            "auth_provider": "password",
            "created_at": now_iso(),
        })
    await _upsert("ai_employees", {
        "id": "ae_leela_kai",
        "tenant_id": "tenant_leela_blr",
        "name": "Kai",
        "role_title": "Guest Relations",
        "provider": "elevenlabs",
        "provider_agent_id": "agent_leela_kai_001",
        "lifecycle_state": "testing",
        "voice_name": "Kai",
        "voice_description": "Calm, refined Indian English",
        "config_ref": "cfg/leela/kai/v1",
        "created_at": now_iso(),
        "updated_at": now_iso(),
    })

    # ---- Demo business-system integration (MOCK — clearly marked, demo only) ----
    await _upsert("business_integrations", {
        "id": "int_taj_pms",
        "tenant_id": "tenant_taj_palace",
        "type": "pms",
        "name": "Hotel PMS",
        "connector_key": "mock_pms",
        "provider": "mock_pms",
        "mode": "mock",          # DEMO mock data — never presented as real live truth
        "status": "connected",
        "created_at": now_iso(),
        "updated_at": now_iso(),
    })
    await _upsert("tools", {
        "id": "tool_taj_avail", "tenant_id": "tenant_taj_palace", "integration_id": "int_taj_pms",
        "key": "check_availability", "name": "Check room availability", "kind": "read",
        "enabled": True, "requires_confirmation": False,
        "description": "Reads live room availability for a date and room type.",
        "created_at": now_iso(), "updated_at": now_iso(),
    })
    await _upsert("tools", {
        "id": "tool_taj_bstatus", "tenant_id": "tenant_taj_palace", "integration_id": "int_taj_pms",
        "key": "check_booking_status", "name": "Check booking status", "kind": "read",
        "enabled": True, "requires_confirmation": False,
        "description": "Reads the status of an existing booking.",
        "created_at": now_iso(), "updated_at": now_iso(),
    })
    await _upsert("tools", {
        "id": "tool_taj_book", "tenant_id": "tenant_taj_palace", "integration_id": "int_taj_pms",
        "key": "create_booking", "name": "Create booking", "kind": "action",
        "enabled": False, "requires_confirmation": True,
        "description": "Creates a reservation. Disabled by default; requires explicit confirmation.",
        "created_at": now_iso(), "updated_at": now_iso(),
    })

    # Seed a few captured conversations for the Taj demo (idempotent).
    from providers import elevenlabs
    from ingest import ingest_post_call
    if await db.conversations.count_documents({"tenant_id": "tenant_taj_palace"}) == 0:
        for i in range(5):
            evt = elevenlabs.build_post_call_event("agent_taj_aria_001", "inbound")
            evt["data"]["conversation_id"] = f"conv_seed_taj_{i}"
            await ingest_post_call(evt["data"])

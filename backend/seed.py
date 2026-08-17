import os
from db import db
from models import now_iso
from security import hash_password, verify_password


async def create_indexes():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.user_sessions.create_index("session_token")
    await db.ai_employees.create_index("provider_agent_id", unique=True)
    await db.ai_employees.create_index("tenant_id")
    await db.channels.create_index("tenant_id")
    await db.conversations.create_index("provider_conversation_id", unique=True)
    await db.conversations.create_index("tenant_id")
    await db.usage_ledger.create_index("event_id", unique=True)
    await db.customization_requests.create_index("tenant_id")


async def _upsert(collection, doc):
    await db[collection].update_one({"id": doc["id"]}, {"$setOnInsert": doc}, upsert=True)


async def seed_platform_admin():
    email = os.environ["ADMIN_EMAIL"].lower()
    password = os.environ["ADMIN_PASSWORD"]
    existing = await db.users.find_one({"email": email})
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
    elif not verify_password(password, existing.get("password_hash", "")):
        await db.users.update_one({"email": email}, {"$set": {"password_hash": hash_password(password)}})


async def seed_demo_data():
    # ---- Tenant: The Taj Palace (live) ----
    await _upsert("tenants", {
        "id": "tenant_taj_palace",
        "slug": "taj-palace-mumbai",
        "name": "The Taj Palace, Mumbai",
        "status": "live",
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
        "name": "Aria",
        "role_title": "Front Desk Concierge",
        "provider": "elevenlabs",
        "provider_agent_id": "agent_taj_aria_001",
        "lifecycle_state": "live",
        "voice_name": "Aria",
        "voice_description": "Warm, professional Indian English",
        "config_ref": "cfg/taj/aria/v3",
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

    # Seed a few captured conversations for the Taj demo (idempotent).
    from providers import elevenlabs
    from ingest import ingest_post_call
    if await db.conversations.count_documents({"tenant_id": "tenant_taj_palace"}) == 0:
        for i in range(5):
            evt = elevenlabs.build_post_call_event("agent_taj_aria_001", "inbound")
            evt["data"]["conversation_id"] = f"conv_seed_taj_{i}"
            await ingest_post_call(evt["data"])

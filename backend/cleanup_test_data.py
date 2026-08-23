"""DEV/TEST ONLY — removes test artifacts that the integration test suite leaves
behind: TEST_ tenants (with all their data), test invoices/conversations on the
demo tenants, test quarantine entries, and test pricing changes.

Safe to run in development:  python cleanup_test_data.py
Never touches seeded demo tenants (Taj / Leela) except restoring Taj pricing
after tests, and never touches real customer data named outside TEST_.

PRODUCTION SAFETY: this script REFUSES to run against a production environment
or production-looking database. Those guards cannot be overridden.
"""
import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

# Known local/test database names only. Production must use a different DB_NAME.
DEV_DB_NAMES = frozenset({"orbit_dev", "test_database", "orbit_test"})

TENANT_SCOPED = [
    "users", "ai_employees", "channels", "conversations", "business_integrations",
    "tools", "tool_invocation_log", "usage_ledger", "tenant_pricing", "invoices",
    "customization_requests",
]


def env_refusal_reason(orbit_env: str | None = None, db_name: str | None = None) -> str | None:
    """Pure guard used before any database writes. Returns a refusal message or None."""
    env = (orbit_env if orbit_env is not None else os.environ.get("ORBIT_ENV", "development")).strip().lower()
    name = (db_name if db_name is not None else os.environ.get("DB_NAME", "")).strip().lower()
    if env in ("production", "prod", "staging"):
        return "REFUSED: ORBIT_ENV is production/staging. This cleanup script is DEV/TEST only."
    if any(tok in name for tok in ("prod", "production")):
        return f"REFUSED: DB_NAME={name} looks like a production database. This cleanup script is DEV/TEST only."
    if name and name not in DEV_DB_NAMES:
        if os.environ.get("ALLOW_TEST_CLEANUP", "").strip().lower() == "true":
            return None
        return (
            f"REFUSED: DB_NAME={name} is not a known development database "
            f"({', '.join(sorted(DEV_DB_NAMES))}). This cleanup script is DEV/TEST only. "
            "Set ALLOW_TEST_CLEANUP=true only for a dedicated non-production database."
        )
    return None


async def assert_not_production(db):
    prod_tenants = await db.tenants.find(
        {"environment": "production"}, {"_id": 0, "name": 1}
    ).to_list(10)
    if prod_tenants:
        names = ", ".join(t["name"] for t in prod_tenants)
        sys.exit(
            f"REFUSED: this database contains production tenants ({names}). "
            "This cleanup script is DEV/TEST only and will not touch a production database."
        )


async def main():
    reason = env_refusal_reason()
    if reason:
        sys.exit(reason)

    from db import db
    await assert_not_production(db)

    # 1. TEST_ tenants + everything under them
    test_tenants = await db.tenants.find(
        {"name": {"$regex": "^TEST_"}}, {"_id": 0, "id": 1, "name": 1}
    ).to_list(500)
    ids = [t["id"] for t in test_tenants]
    if ids:
        for coll in TENANT_SCOPED:
            r = await db[coll].delete_many({"tenant_id": {"$in": ids}})
            if r.deleted_count:
                print(f"  {coll}: {r.deleted_count} removed")
        r = await db.tenants.delete_many({"id": {"$in": ids}})
        print(f"Deleted {r.deleted_count} TEST_ tenants: {[t['name'] for t in test_tenants]}")
    else:
        print("No TEST_ tenants found.")

    # 2. Test invoices on demo tenants (tests use far-future 2099-xx periods)
    r = await db.invoices.delete_many({"period": {"$regex": "^2099"}})
    print(f"Test invoices (2099-xx) removed: {r.deleted_count}")

    # 3. Test conversations injected via webhook tests (+ their usage events)
    conv_filter = {"provider_conversation_id": {"$regex": "^conv_(test|qtest)_"}}
    conv_ids = [c["provider_conversation_id"] async for c in db.conversations.find(conv_filter, {"provider_conversation_id": 1})]
    if conv_ids:
        await db.usage_ledger.delete_many({"event_id": {"$in": conv_ids}})
        r = await db.conversations.delete_many(conv_filter)
        print(f"Test conversations removed: {r.deleted_count}")

    # 4. Test customization requests / integrations named TEST_
    r = await db.customization_requests.delete_many({"title": {"$regex": "^TEST_"}})
    print(f"Test customization requests removed: {r.deleted_count}")
    test_ints = await db.business_integrations.find({"name": {"$regex": "^TEST_"}}, {"_id": 0, "id": 1}).to_list(100)
    if test_ints:
        int_ids = [i["id"] for i in test_ints]
        await db.tools.delete_many({"integration_id": {"$in": int_ids}})
        r = await db.business_integrations.delete_many({"id": {"$in": int_ids}})
        print(f"Test integrations removed: {r.deleted_count}")

    # 5. Quarantine entries from webhook tests (unknown test agent)
    r = await db.webhook_quarantine.delete_many({"agent_id": "agent_unknown_999"})
    print(f"Test quarantine entries removed: {r.deleted_count}")

    # 6. Tests overwrite Taj's service charge (1234.0) — restore the default
    r = await db.tenant_pricing.update_one(
        {"tenant_id": "tenant_taj_palace", "service_charge": 1234.0},
        {"$set": {"service_charge": 999.0}},
    )
    if r.modified_count:
        print("Taj pricing service_charge restored to 999.0")

    print("Cleanup complete.")


if __name__ == "__main__":
    asyncio.run(main())

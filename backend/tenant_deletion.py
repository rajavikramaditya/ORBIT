"""Tenant deletion — the one place that knows how to soft-delete, restore, and
permanently purge a tenant's data. Mirrors this codebase's existing pattern of
keeping a whole capability in one module (see voice_providers.py, connectors.py)
so routes_tenant.py / routes_admin.py stay thin and there is a single place to
update the tenant-scoped collection list if a new collection is ever added.

Lifecycle: customer requests deletion (routes_tenant.py) -> ORBIT staff approves
(routes_admin.py) -> soft_delete_tenant() sets deleted_at/purge_at and blocks
sign-in immediately, but every document stays in place for 30 days so a mistake
is recoverable via restore_tenant(). purge_expired_tenants() (run daily by
purge_deleted_tenants.py, or manually from the admin console) is what actually
erases data, once and only once the 30-day window has passed.

audit_log is deliberately never touched by any of this — "who deleted this tenant
and when" must survive the deletion itself, so it is excluded from both the
per-tenant collection list and the purge.
"""
from datetime import datetime, timezone, timedelta

from db import db, write_audit

DELETION_GRACE_DAYS = 30

# Every collection that stores tenant-owned data, keyed by "tenant_id".
# audit_log is excluded on purpose (see module docstring). "users" is excluded
# here because deleting a tenant's users also means cleaning up their sessions/
# reset tokens/auth tickets, which are keyed by user_id, not tenant_id — that's
# handled as its own step in hard_delete_tenant() below.
TENANT_SCOPED_COLLECTIONS = [
    "ai_employees",
    "business_integrations",
    "channels",
    "conversations",
    "customization_requests",
    "account_deletion_requests",
    "invoices",
    "leads",
    "owner_callback_requests",
    "tenant_live_data",
    "tenant_pricing",
    "tool_invocation_log",
    "tools",
    "usage_ledger",
    "inbound_events",
    "webhook_quarantine",
]


def _actor_label(actor: dict | None) -> str:
    return (actor or {}).get("email") or (actor or {}).get("id") or "system"


async def soft_delete_tenant(tenant_id: str, actor: dict | None, reason: str | None = None) -> dict:
    """Marks a tenant deleted. Blocks sign-in immediately (routes_auth.py checks
    deleted_at at login) but does not remove any data — recoverable for
    DELETION_GRACE_DAYS via restore_tenant()."""
    tenant = await db.tenants.find_one({"id": tenant_id})
    if not tenant:
        raise ValueError("Tenant not found")
    now = datetime.now(timezone.utc)
    purge_at = now + timedelta(days=DELETION_GRACE_DAYS)
    await db.tenants.update_one(
        {"id": tenant_id},
        {"$set": {
            "deleted_at": now.isoformat(),
            "purge_at": purge_at.isoformat(),
            "deletion_reason": reason,
        }},
    )
    await write_audit(actor, "tenant.soft_delete", tenant_id, tenant_id, {"reason": reason})
    return await db.tenants.find_one({"id": tenant_id}, {"_id": 0})


async def restore_tenant(tenant_id: str, actor: dict | None) -> dict:
    """Undoes soft_delete_tenant(), as long as the grace window hasn't passed
    (once purge_expired_tenants() has run for this tenant there is nothing left
    to restore)."""
    tenant = await db.tenants.find_one({"id": tenant_id})
    if not tenant:
        raise ValueError("Tenant not found")
    if not tenant.get("deleted_at"):
        raise ValueError("Tenant is not deleted")
    await db.tenants.update_one(
        {"id": tenant_id},
        {"$unset": {"deleted_at": "", "purge_at": "", "deletion_reason": ""}},
    )
    await write_audit(actor, "tenant.restore", tenant_id, tenant_id, {})
    return await db.tenants.find_one({"id": tenant_id}, {"_id": 0})


async def hard_delete_tenant(tenant_id: str) -> None:
    """Permanently erases a tenant and everything it owns. Only ever called by
    purge_expired_tenants() (i.e. only after the grace window has passed) —
    never called directly from a route. Irreversible."""
    user_ids = [u["id"] for u in await db.users.find({"tenant_id": tenant_id}, {"_id": 0, "id": 1}).to_list(1000)]
    if user_ids:
        await db.user_sessions.delete_many({"user_id": {"$in": user_ids}})
        await db.password_reset_tokens.delete_many({"user_id": {"$in": user_ids}})
        await db.auth_tickets.delete_many({"user_id": {"$in": user_ids}})
        await db.users.delete_many({"tenant_id": tenant_id})
    for collection in TENANT_SCOPED_COLLECTIONS:
        await db[collection].delete_many({"tenant_id": tenant_id})
    await db.tenants.delete_one({"id": tenant_id})
    # Written AFTER the delete, and audit_log is never purged — this row is the
    # permanent record that the tenant existed and was erased.
    await write_audit(None, "tenant.purge", tenant_id, tenant_id, {"user_ids_removed": len(user_ids)})


async def purge_expired_tenants() -> dict:
    """Finds every tenant whose grace window has passed and permanently erases
    it. Safe to call repeatedly (a daily cron / the admin console's manual
    trigger both call this same function — one implementation, two callers)."""
    now_iso_str = datetime.now(timezone.utc).isoformat()
    due = await db.tenants.find(
        {"deleted_at": {"$exists": True}, "purge_at": {"$lte": now_iso_str}},
        {"_id": 0, "id": 1, "name": 1},
    ).to_list(1000)
    purged = []
    for t in due:
        await hard_delete_tenant(t["id"])
        purged.append({"id": t["id"], "name": t.get("name")})
    return {"purged_count": len(purged), "purged": purged}

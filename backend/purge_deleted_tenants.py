"""Standalone script: permanently erases any tenant whose 30-day deletion grace
window has passed. Same shape as seed.py — run directly (`python
purge_deleted_tenants.py`), meant to be invoked once a day by a scheduled job
(e.g. a Render Cron Job) once one is set up; until then, the same
purge_expired_tenants() function is also reachable manually from the admin
console ("Run purge now" on the Deletion requests tab / POST
/api/admin/purge-expired-deletions), so nothing is stuck waiting on the cron
job existing.
"""
import asyncio
import logging

from tenant_deletion import purge_expired_tenants

logger = logging.getLogger("orbit.purge_deleted_tenants")


async def main():
    result = await purge_expired_tenants()
    if result["purged_count"]:
        logger.warning("Purged %d tenant(s): %s", result["purged_count"], result["purged"])
    else:
        logger.info("No tenants past their deletion grace window today.")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())

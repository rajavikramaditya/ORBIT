import os
import logging
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from runtime_config import is_production

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logger = logging.getLogger("orbit.db")

# Importing this module used to be able to kill the process outright:
# `os.environ["MONGO_URL"]` raised KeyError before anything could report it.
# That made the whole test suite unrunnable — pytest imports these modules
# without a .env, so every test failed at collection with a KeyError instead of
# a test result.
#
# Production is NOT made lenient by this: server.py's startup calls
# production_config_errors(), which refuses to start when MONGO_URL is missing.
# So a misconfigured production deploy still fails loudly and early — it just
# fails with a sentence a human can act on rather than a KeyError traceback.
MONGO_URL = (os.environ.get("MONGO_URL") or "").strip()
DB_NAME = (os.environ.get("DB_NAME") or "").strip()

if not MONGO_URL or not DB_NAME:
    missing = ", ".join(n for n, v in (("MONGO_URL", MONGO_URL), ("DB_NAME", DB_NAME)) if not v)
    if is_production():
        raise RuntimeError(
            f"{missing} must be set in production. Set it in the environment "
            "(Render → Environment) — see backend/.env.example."
        )
    logger.warning(
        "%s not set — falling back to a local development database. "
        "This is fine for tests and local work; production refuses to start without it.",
        missing,
    )
    MONGO_URL = MONGO_URL or "mongodb://localhost:27017"
    DB_NAME = DB_NAME or "orbit_dev"

# Motor connects lazily, so constructing the client never blocks or fails here —
# a wrong URL surfaces on the first query (and on /api/health's ping).
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# Kept for backwards compatibility with modules that imported the old lowercase name.
mongo_url = MONGO_URL


async def write_audit(actor: dict | None, action: str, target: str = "", tenant_id: str | None = None, details: dict | None = None):
    from models import gen_id, now_iso
    await db.audit_log.insert_one({
        "id": gen_id(),
        "actor_user_id": (actor or {}).get("id"),
        "actor_email": (actor or {}).get("email"),
        "tenant_id": tenant_id,
        "action": action,
        "target": target,
        "details": details or {},
        "created_at": now_iso(),
    })

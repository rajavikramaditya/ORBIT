import os
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]


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

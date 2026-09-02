"""Runtime environment helpers. Used at process start — no database I/O."""
import os

DEV_DB_NAMES = frozenset({"orbit_dev", "test_database", "orbit_test"})

INSECURE_JWT = "local-dev-jwt-secret-change-in-production"
INSECURE_WEBHOOK = "orbit_whsec_3a9f7c2e1b8d6045a3c9e7f1b2d4a6c8"
INSECURE_ADMIN_PASSWORD = "OrbitAdmin@2026"


def orbit_env(environ: dict | None = None) -> str:
    src = environ if environ is not None else os.environ
    return (src.get("ORBIT_ENV") or "development").strip().lower()


def is_production(environ: dict | None = None) -> bool:
    return orbit_env(environ) in ("production", "prod")


def cors_origins(environ: dict | None = None) -> list[str]:
    src = environ if environ is not None else os.environ
    origins: list[str] = []
    raw = (src.get("CORS_ORIGINS") or "").strip()
    if raw:
        origins.extend(o.strip().rstrip("/") for o in raw.split(",") if o.strip())
    frontend = (src.get("FRONTEND_URL") or "").strip().rstrip("/")
    if frontend and frontend not in origins:
        origins.append(frontend)
    if not is_production(src):
        for local in ("http://localhost:3000", "http://127.0.0.1:3000"):
            if local not in origins:
                origins.append(local)
    return origins


def production_config_errors(environ: dict | None = None) -> list[str]:
    """Return hard-fail reasons when ORBIT_ENV is production. Empty in other envs."""
    src = environ if environ is not None else os.environ
    if not is_production(src):
        return []
    errors: list[str] = []
    db_name = (src.get("DB_NAME") or "").strip().lower()
    if not db_name or db_name in DEV_DB_NAMES:
        errors.append("DB_NAME must be a dedicated production database (not orbit_dev/test_database/orbit_test).")
    jwt = (src.get("JWT_SECRET") or "").strip()
    if not jwt or jwt == INSECURE_JWT or len(jwt) < 32:
        errors.append("JWT_SECRET must be a unique production value at least 32 characters.")
    wh = (src.get("WEBHOOK_SECRET") or "").strip()
    if not wh or wh == INSECURE_WEBHOOK:
        errors.append("WEBHOOK_SECRET must be a unique production value (not the .env.example default).")
    if (src.get("COOKIE_SECURE") or "true").strip().lower() != "true":
        errors.append("COOKIE_SECURE must be true in production.")
    if not cors_origins(src):
        errors.append("FRONTEND_URL or CORS_ORIGINS must be set in production.")
    admin_pw = (src.get("ADMIN_PASSWORD") or "").strip()
    if not admin_pw or admin_pw == INSECURE_ADMIN_PASSWORD:
        errors.append("ADMIN_PASSWORD must be set to a unique production password.")
    if not (src.get("ADMIN_EMAIL") or "").strip():
        errors.append("ADMIN_EMAIL is required in production.")
    if not (src.get("MONGO_URL") or "").strip():
        errors.append("MONGO_URL is required.")
    return errors

import os
import logging
from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse
from db import db, client
from seed import create_indexes, seed_platform_admin, seed_demo_data
from runtime_config import is_production, cors_origins, production_config_errors, orbit_env
import routes_auth
import routes_admin
import routes_tenant
import routes_webhooks
import routes_business
import routes_billing

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("orbit")

_prod = is_production()
app = FastAPI(
    title="ORBIT API",
    docs_url=None if _prod else "/docs",
    redoc_url=None if _prod else "/redoc",
    openapi_url=None if _prod else "/openapi.json",
)

health = APIRouter(prefix="/api")


@health.get("/")
async def root():
    return {"service": "ORBIT", "status": "ok"}


@health.get("/health")
async def healthcheck():
    """Readiness: process is up and MongoDB accepts a ping."""
    try:
        await db.command("ping")
    except Exception:
        logger.exception("health check: database ping failed")
        return JSONResponse(status_code=503, content={"service": "ORBIT", "status": "unavailable"})
    return {"service": "ORBIT", "status": "ok"}


app.include_router(health)
app.include_router(routes_auth.router)
app.include_router(routes_admin.router)
app.include_router(routes_tenant.router)
app.include_router(routes_webhooks.router)
app.include_router(routes_business.router)
app.include_router(routes_billing.router)

_origins = cors_origins()
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    errors = production_config_errors()
    if errors:
        for msg in errors:
            logger.error("production config: %s", msg)
        raise RuntimeError("Refusing to start: " + " ".join(errors))
    await create_indexes()
    await seed_platform_admin()
    env = orbit_env()
    db_name = os.environ.get("DB_NAME", "").strip().lower()
    allow_demo = env in ("development", "demo", "test") and not any(
        tok in db_name for tok in ("prod", "production")
    )
    if allow_demo:
        await seed_demo_data()
    else:
        logger.info("ORBIT_ENV=%s DB_NAME=%s — demo seed data skipped", env, db_name)
    logger.info("ORBIT startup complete")


@app.on_event("shutdown")
async def shutdown():
    client.close()

import os
import logging
from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware

from db import db, client
from seed import create_indexes, seed_platform_admin, seed_demo_data
import routes_auth
import routes_admin
import routes_tenant
import routes_webhooks
import routes_business
import routes_billing

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("orbit")

app = FastAPI(title="ORBIT API")

health = APIRouter(prefix="/api")


@health.get("/")
async def root():
    return {"service": "ORBIT", "status": "ok"}


app.include_router(health)
app.include_router(routes_auth.router)
app.include_router(routes_admin.router)
app.include_router(routes_tenant.router)
app.include_router(routes_webhooks.router)
app.include_router(routes_business.router)
app.include_router(routes_billing.router)

_frontend = os.environ.get("FRONTEND_URL", "").strip()
_origins = [o for o in [_frontend, "http://localhost:3000"] if o]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await create_indexes()
    await seed_platform_admin()
    await seed_demo_data()
    logger.info("ORBIT startup complete")


@app.on_event("shutdown")
async def shutdown():
    client.close()

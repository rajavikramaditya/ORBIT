"""Production runtime guards (no database, no running server required)."""
from runtime_config import cors_origins, production_config_errors, is_production


def test_dev_cors_includes_localhost():
    origins = cors_origins({"ORBIT_ENV": "development", "FRONTEND_URL": "http://localhost:3000"})
    assert "http://localhost:3000" in origins


def test_production_cors_excludes_localhost():
    origins = cors_origins({
        "ORBIT_ENV": "production",
        "FRONTEND_URL": "https://app.example.com",
    })
    assert origins == ["https://app.example.com"]
    assert "http://localhost:3000" not in origins


def test_production_rejects_dev_database_and_example_secrets():
    errors = production_config_errors({
        "ORBIT_ENV": "production",
        "DB_NAME": "orbit_dev",
        "JWT_SECRET": "local-dev-jwt-secret-change-in-production",
        "WEBHOOK_SECRET": "orbit_whsec_3a9f7c2e1b8d6045a3c9e7f1b2d4a6c8",
        "COOKIE_SECURE": "false",
        "ADMIN_PASSWORD": "OrbitAdmin@2026",
        "ADMIN_EMAIL": "admin@orbit.ai",
        "MONGO_URL": "mongodb://localhost",
        "FRONTEND_URL": "https://app.example.com",
    })
    assert errors
    joined = " ".join(errors)
    assert "DB_NAME" in joined
    assert "JWT_SECRET" in joined
    assert "WEBHOOK_SECRET" in joined
    assert "COOKIE_SECURE" in joined
    assert "ADMIN_PASSWORD" in joined


def test_production_accepts_dedicated_config():
    errors = production_config_errors({
        "ORBIT_ENV": "production",
        "DB_NAME": "orbit",
        "JWT_SECRET": "x" * 32,
        "WEBHOOK_SECRET": "unique-production-webhook-secret",
        "COOKIE_SECURE": "true",
        "ADMIN_PASSWORD": "unique-admin-password",
        "ADMIN_EMAIL": "ops@example.com",
        "MONGO_URL": "mongodb+srv://user:pass@cluster/orbit",
        "FRONTEND_URL": "https://app.example.com",
    })
    assert errors == []


def test_development_skips_production_guards():
    assert production_config_errors({"ORBIT_ENV": "development", "DB_NAME": "orbit_dev"}) == []
    assert is_production({"ORBIT_ENV": "development"}) is False

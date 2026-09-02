"""Cleanup script production-safety guards (no database writes)."""
from cleanup_test_data import env_refusal_reason


def test_refuses_production_env():
    assert env_refusal_reason("production", "orbit_dev")
    assert env_refusal_reason("prod", "orbit_dev")
    assert env_refusal_reason("staging", "orbit_dev")


def test_refuses_production_looking_db_name():
    assert env_refusal_reason("development", "orbit_prod")
    assert env_refusal_reason("development", "production")


def test_refuses_unknown_db_without_override(monkeypatch):
    monkeypatch.delenv("ALLOW_TEST_CLEANUP", raising=False)
    assert env_refusal_reason("development", "orbit")


def test_allows_known_dev_databases():
    assert env_refusal_reason("development", "orbit_dev") is None
    assert env_refusal_reason("development", "test_database") is None
    assert env_refusal_reason("test", "orbit_test") is None

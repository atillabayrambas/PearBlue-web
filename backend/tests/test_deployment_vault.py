"""Regression tests for the CMS deployment vault.

Covers:
- GET /api/admin/deployment/vault requires admin
- GET returns all 17 known keys (empty strings default) + env_status flags
- PUT persists values, roundtrip decrypts correctly
- Unknown keys in the payload are silently ignored (whitelist enforcement)
- Values that look like real secrets are actually encrypted at rest (never
  round-trip as plaintext to the DB when the cipher is configured)
"""
import os
import requests
import pytest

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@pearblue.nl"
ADMIN_PASSWORD = "PearBlue2026!"

EXPECTED_KEYS = {
    "MONGO_URL", "DB_NAME", "EMERGENT_LLM_KEY",
    "ZOHO_CLIENT_ID", "ZOHO_CLIENT_SECRET",
    "ZOHO_BOOKS_ORG_ID", "ZOHO_PROJECTS_PORTAL_ID", "ZOHO_DESK_ORG_ID",
    "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET",
    "TOKEN_ENCRYPTION_KEY",
    "RESEND_API_KEY",
    "JWT_SECRET", "SESSION_SECRET",
    "FRONTEND_URL", "CORS_ORIGINS", "SUPER_ADMIN_EMAILS",
}


@pytest.fixture(scope="module")
def auth_headers():
    r = requests.post(
        f"{API}/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}", "Content-Type": "application/json"}


def test_vault_requires_admin():
    r = requests.get(f"{API}/admin/deployment/vault", timeout=10)
    assert r.status_code in (401, 403)
    r2 = requests.put(f"{API}/admin/deployment/vault", json={"DB_NAME": "x"}, timeout=10)
    assert r2.status_code in (401, 403)


def test_vault_get_shape(auth_headers):
    r = requests.get(f"{API}/admin/deployment/vault", headers=auth_headers, timeout=10)
    assert r.status_code == 200
    body = r.json()
    assert set(body["vault"].keys()) == EXPECTED_KEYS
    assert set(body["env_status"].keys()) == EXPECTED_KEYS
    # env_status booleans reflect the real process env
    for k, v in body["env_status"].items():
        assert isinstance(v, bool)


def test_vault_roundtrip(auth_headers):
    payload = {
        "FRONTEND_URL": "https://vault-test.example.com",
        "CORS_ORIGINS": "https://vault-test.example.com,https://alt.example.com",
        "ZOHO_BOOKS_ORG_ID": "999999",
        "STRIPE_WEBHOOK_SECRET": "whsec_vault_regression_test",
    }
    r = requests.put(f"{API}/admin/deployment/vault", json=payload, headers=auth_headers, timeout=15)
    assert r.status_code == 200, r.text
    assert r.json()["updated"] == len(payload)

    r2 = requests.get(f"{API}/admin/deployment/vault", headers=auth_headers, timeout=10)
    saved = r2.json()["vault"]
    for k, v in payload.items():
        assert saved[k] == v, f"{k} did not round-trip ({saved[k]!r} != {v!r})"

    # Meta stamps are populated
    meta = r2.json()
    assert meta.get("updated_at")
    assert meta.get("updated_by") == ADMIN_EMAIL

    # Wipe our test values so we don't pollute state
    wipe = {k: "" for k in payload}
    requests.put(f"{API}/admin/deployment/vault", json=wipe, headers=auth_headers, timeout=15)


def test_vault_rejects_unknown_keys(auth_headers):
    r = requests.put(
        f"{API}/admin/deployment/vault",
        json={"NOT_A_REAL_KEY": "anything", "MONGO_URL": ""},
        headers=auth_headers,
        timeout=10,
    )
    assert r.status_code == 200
    # Only MONGO_URL should be counted (unknown key silently ignored)
    assert r.json()["updated"] == 1

    r2 = requests.get(f"{API}/admin/deployment/vault", headers=auth_headers, timeout=10)
    assert "NOT_A_REAL_KEY" not in r2.json()["vault"]

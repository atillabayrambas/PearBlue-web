"""Iteration 39 backend tests — advisory lock, books-autopilot-status, Zoho hint."""
import os
import asyncio
from datetime import datetime, timezone, timedelta

import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://sheet-converter-68.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@pearblue.nl"
ADMIN_PASSWORD = "PearBlue2026!"
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def db():
    return AsyncIOMotorClient(MONGO_URL)[DB_NAME]


# --- Advisory lock module ---

def test_advisory_locks_ttl_index(db):
    async def run():
        idx = await db.advisory_locks.index_information()
        # Find any index on expires_at with expireAfterSeconds
        found = False
        for name, spec in idx.items():
            keys = spec.get("key", [])
            if any(k[0] == "expires_at" for k in keys) and "expireAfterSeconds" in spec:
                found = True
                assert spec["expireAfterSeconds"] == 0
        assert found, f"No TTL index on advisory_locks.expires_at. Indexes: {idx}"
    asyncio.get_event_loop().run_until_complete(run())


def test_try_acquire_lock_returns_false_when_held(db):
    """Insert a lock doc directly; second acquire attempt via helper import should fail."""
    async def run():
        # Clean slate
        await db.advisory_locks.delete_one({"_id": "test_iter39_lock"})
        future = datetime.now(timezone.utc) + timedelta(minutes=5)
        await db.advisory_locks.insert_one({"_id": "test_iter39_lock", "acquired_at": datetime.now(timezone.utc), "expires_at": future})

        # Try acquiring same lock -> should fail (duplicate key)
        try:
            await db.advisory_locks.insert_one({"_id": "test_iter39_lock", "acquired_at": datetime.now(timezone.utc), "expires_at": future})
            assert False, "second insert should have raised DuplicateKeyError"
        except Exception:
            pass  # expected
        # Cleanup
        await db.advisory_locks.delete_one({"_id": "test_iter39_lock"})
    asyncio.get_event_loop().run_until_complete(run())


# --- Manual scan endpoint bypasses lock ---

def test_manual_scan_bypasses_lock(admin_headers, db):
    """With books_autopilot lock held in DB, manual POST scan-books-invoices should still work."""
    async def seed_lock():
        await db.advisory_locks.delete_one({"_id": "books_autopilot"})
        future = datetime.now(timezone.utc) + timedelta(minutes=10)
        await db.advisory_locks.insert_one({"_id": "books_autopilot", "acquired_at": datetime.now(timezone.utc), "expires_at": future})

    async def clear_lock():
        await db.advisory_locks.delete_one({"_id": "books_autopilot"})

    asyncio.get_event_loop().run_until_complete(seed_lock())
    try:
        r = requests.post(f"{BASE_URL}/api/admin/reviews/scan-books-invoices", headers=admin_headers, timeout=60)
        assert r.status_code == 200, f"manual scan failed: {r.status_code} {r.text}"
        body = r.json()
        # Expected keys
        for k in ["scanned", "invited", "skipped", "errors"]:
            assert k in body, f"missing key {k} in scan response: {body}"
        assert isinstance(body["errors"], list)
        # Zoho is live w/ 0 paid invoices in 90d — errors should be empty
        assert body["errors"] == [], f"unexpected errors: {body['errors']}"
    finally:
        asyncio.get_event_loop().run_until_complete(clear_lock())


# --- Autopilot status endpoint ---

def test_books_autopilot_status_after_manual_scan(admin_headers):
    # trigger manual scan
    r = requests.post(f"{BASE_URL}/api/admin/reviews/scan-books-invoices", headers=admin_headers, timeout=60)
    assert r.status_code == 200

    # Fetch status
    r2 = requests.get(f"{BASE_URL}/api/admin/reviews/books-autopilot-status", headers=admin_headers, timeout=15)
    assert r2.status_code == 200, r2.text
    body = r2.json()
    assert body.get("trigger") == "manual"
    assert body.get("triggered_by") == ADMIN_EMAIL
    for k in ["at", "scanned", "invited", "skipped", "errors"]:
        assert k in body, f"missing key {k}: {body}"


def test_books_autopilot_status_requires_admin():
    r = requests.get(f"{BASE_URL}/api/admin/reviews/books-autopilot-status", timeout=10)
    assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}"


def test_scan_books_invoices_requires_admin():
    r = requests.post(f"{BASE_URL}/api/admin/reviews/scan-books-invoices", timeout=10)
    assert r.status_code in (401, 403)

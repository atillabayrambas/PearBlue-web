"""Iteration 35 tests:
1. GET /api/admin/financials — zoho_books.mocked=false (Books LIVE)
2. POST /api/admin/reviews/scan-books-invoices — dedupe/summary shape
3. Rate limit 429 shape — retry_after_seconds int in [1..60]
4. Project + Review _en fields accepted via PATCH; GET /projects echoes them
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://sheet-converter-68.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@pearblue.nl"
ADMIN_PASSWORD = "PearBlue2026!"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:200]}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def h(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# ---------- (1) Financials LIVE flag ----------
def test_financials_zoho_books_live(h):
    r = requests.get(f"{BASE_URL}/api/admin/financials", headers=h, timeout=30)
    assert r.status_code == 200, r.text[:300]
    data = r.json()
    assert "zoho_books" in data
    zb = data["zoho_books"]
    assert zb.get("mocked") is False, f"Expected mocked=False (LIVE), got: {zb}"
    print(f"Zoho Books LIVE ok: keys={list(zb.keys())}, mocked={zb.get('mocked')}")


# ---------- (2) Books-invoice review autopilot manual trigger ----------
def test_scan_books_invoices_shape(h):
    r = requests.post(f"{BASE_URL}/api/admin/reviews/scan-books-invoices", headers=h, timeout=60)
    assert r.status_code == 200, r.text[:300]
    data = r.json()
    for k in ("scanned", "invited", "skipped", "errors"):
        assert k in data, f"missing key {k}: {data}"
    assert isinstance(data["scanned"], int)
    assert isinstance(data["invited"], int)
    assert isinstance(data["skipped"], int)
    assert isinstance(data["errors"], list)
    print(f"scan-books-invoices: {data}")


def test_scan_books_invoices_idempotent(h):
    # Second call should not error — dedup collection ensures no double-invites.
    r1 = requests.post(f"{BASE_URL}/api/admin/reviews/scan-books-invoices", headers=h, timeout=60)
    r2 = requests.post(f"{BASE_URL}/api/admin/reviews/scan-books-invoices", headers=h, timeout=60)
    assert r1.status_code == 200 and r2.status_code == 200
    # Second run must not invite more than the first (dedup guarantee).
    assert r2.json()["invited"] <= r1.json()["invited"] or r2.json()["invited"] == 0
    print(f"idempotent: r1={r1.json()} r2={r2.json()}")


# ---------- (3) Rate limit 429 shape ----------
def test_rate_limit_429_retry_after_shape(h):
    # Set limit=3
    put_settings = requests.put(f"{BASE_URL}/api/settings",
                                headers=h,
                                json={"ai_translate_limit_per_minute": 3},
                                timeout=15)
    assert put_settings.status_code == 200, put_settings.text[:300]

    # Clear any recent hits by waiting? Instead we drive it: 3 successful + 1 429.
    # Use short/cheap payload to translate.
    body = {"text": "hallo", "source_lang": "nl", "target_lang": "en"}

    # Fire up to 6 attempts and look for the first 429.
    got_429 = None
    successes = 0
    for i in range(6):
        r = requests.post(f"{BASE_URL}/api/admin/ai/translate", headers=h, json=body, timeout=45)
        if r.status_code == 200:
            successes += 1
            continue
        if r.status_code == 429:
            got_429 = r
            break
        pytest.fail(f"Unexpected status {r.status_code}: {r.text[:200]}")

    # Restore limit to 30 asap
    try:
        requests.put(f"{BASE_URL}/api/settings", headers=h,
                     json={"ai_translate_limit_per_minute": 30}, timeout=15)
    except Exception:
        pass

    assert got_429 is not None, f"Never hit 429 after 6 tries; successes={successes}"
    body_json = got_429.json()
    detail = body_json.get("detail")
    assert isinstance(detail, dict), f"detail must be dict, got: {body_json}"
    assert "message" in detail
    assert "message_en" in detail
    assert "retry_after_seconds" in detail
    assert "limit" in detail
    ra = detail["retry_after_seconds"]
    assert isinstance(ra, int) and 1 <= ra <= 60, f"retry_after_seconds out of range: {ra}"
    assert detail["limit"] == 3
    # Retry-After header present too
    assert got_429.headers.get("Retry-After") is not None
    print(f"429 shape ok: {detail}")


# ---------- (4) Project + Review _en fields ----------
def test_project_en_fields_patch_and_get(h):
    # Find or create a project
    r = requests.get(f"{BASE_URL}/api/projects", timeout=15)
    assert r.status_code == 200
    projects = r.json()
    if not projects:
        pytest.skip("no projects available to test PATCH _en fields")

    pid = projects[0]["id"]
    payload = {
        "title_en": "Test EN Title",
        "description_en": "Test EN Description",
    }
    p = requests.patch(f"{BASE_URL}/api/projects/{pid}", headers=h, json=payload, timeout=15)
    assert p.status_code == 200, p.text[:300]
    # GET all again and verify persistence
    r2 = requests.get(f"{BASE_URL}/api/projects", timeout=15)
    assert r2.status_code == 200
    matched = [x for x in r2.json() if x["id"] == pid]
    assert matched, "project vanished after PATCH"
    proj = matched[0]
    assert proj.get("title_en") == "Test EN Title"
    assert proj.get("description_en") == "Test EN Description"
    print(f"project _en fields persisted on {pid}")


def test_review_quote_en_patch(h):
    r = requests.get(f"{BASE_URL}/api/reviews/all", headers=h, timeout=15)
    assert r.status_code == 200, r.text[:300]
    reviews = r.json()
    if not reviews:
        pytest.skip("no reviews available")
    rid = reviews[0]["id"]
    original_quote_en = reviews[0].get("quote_en")
    new_val = "TEST EN quote for iteration35"
    p = requests.patch(f"{BASE_URL}/api/reviews/{rid}", headers=h, json={"quote_en": new_val}, timeout=15)
    assert p.status_code == 200, p.text[:300]
    # verify
    r2 = requests.get(f"{BASE_URL}/api/reviews/all", headers=h, timeout=15)
    matched = [x for x in r2.json() if x["id"] == rid]
    assert matched and matched[0].get("quote_en") == new_val
    # Restore if there was a prior value (best-effort)
    if original_quote_en is not None:
        requests.patch(f"{BASE_URL}/api/reviews/{rid}", headers=h,
                       json={"quote_en": original_quote_en}, timeout=15)
    print(f"review quote_en patched on {rid}")

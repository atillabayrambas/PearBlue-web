"""Iteration 14 backend tests."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # frontend .env is the source of truth in this environment
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break

API = f"{BASE_URL}/api"
ADMIN_EMAIL = "admin@pearblue.nl"
ADMIN_PASSWORD = "PearBlue2026!"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# --- Changelog ---
def test_changelog_public():
    r = requests.get(f"{API}/changelog", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert data.get("current") == "0.7-Beta"
    assert isinstance(data.get("entries"), list)
    assert len(data["entries"]) >= 6


# --- Assignees ---
def test_assignees_requires_auth():
    r = requests.get(f"{API}/admin/assignees", timeout=15)
    assert r.status_code in (401, 403)


def test_assignees_list(admin_headers):
    r = requests.get(f"{API}/admin/assignees", headers=admin_headers, timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list) and len(data) >= 1
    allowed = {"super_admin", "admin", "beheerder", "moderator", "chat_support"}
    for a in data:
        assert "email" in a and "role" in a and "display_name" in a
        assert a["role"] in allowed


# --- Portfolio seed + archive ---
def test_portfolio_seed_and_archive(admin_headers):
    r = requests.get(f"{API}/admin/projects/all", headers=admin_headers, timeout=15)
    assert r.status_code == 200
    projects = r.json()
    assert len(projects) >= 6
    seeded = [p for p in projects if p.get("seed_id")]
    assert len(seeded) >= 6
    target = seeded[0]
    pid = target["id"]

    # ensure non-archived initially
    assert target.get("archived", False) in (False, None)

    # archive
    r = requests.patch(f"{API}/projects/{pid}", headers=admin_headers, json={"archived": True}, timeout=15)
    assert r.status_code == 200

    # public GET must not contain it
    r_pub = requests.get(f"{API}/projects", timeout=15)
    assert r_pub.status_code == 200
    ids = [p["id"] for p in r_pub.json()]
    assert pid not in ids

    # restore
    r = requests.patch(f"{API}/projects/{pid}", headers=admin_headers, json={"archived": False}, timeout=15)
    assert r.status_code == 200
    r_pub = requests.get(f"{API}/projects", timeout=15)
    assert pid in [p["id"] for p in r_pub.json()]


# --- Captcha telemetry ---
def test_captcha_telemetry(admin_headers):
    r = requests.post(f"{API}/telemetry/captcha-verified", timeout=15)
    assert r.status_code == 200
    assert r.json().get("ok") in (True, False)  # dedupe may return False if hit >=10
    r2 = requests.get(f"{API}/admin/cybersecurity/captcha-stats", headers=admin_headers, timeout=15)
    assert r2.status_code == 200
    stats = r2.json()
    assert "total_30d" in stats and "daily" in stats
    assert stats["total_30d"] >= 1


# --- Cybersec block enrichment via UA ---
def test_cybersec_block_ua_parse(admin_headers):
    ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120"
    # First unblock any current block for this IP
    blocked = False
    for i in range(8):
        r = requests.post(
            f"{API}/contact",
            json={"name": "Bot", "email": "bot@example.com", "message": "hello world normal message"},
            headers={"User-Agent": ua},
            timeout=15,
        )
        if r.status_code == 429:
            blocked = True
            break
        time.sleep(0.1)
    assert blocked, "Rate limit never triggered"

    r = requests.get(f"{API}/admin/cybersecurity/blocks", headers=admin_headers, timeout=15)
    assert r.status_code == 200
    blocks = r.json()
    assert isinstance(blocks, list) and len(blocks) >= 1
    # find latest with matching UA
    match = None
    for b in blocks:
        if "Chrome" in (b.get("browser") or "") and "Windows" in (b.get("os") or ""):
            match = b
            break
    assert match is not None, f"No UA-parsed block found: sample={blocks[0] if blocks else None}"
    assert match.get("device") == "Desktop"

    # Cleanup: unblock so subsequent tests aren't affected
    try:
        requests.post(f"{API}/admin/cybersecurity/blocks/{match['id']}/unblock", headers=admin_headers, timeout=15)
    except Exception:
        pass


# --- Spam auto-mark ---
def test_contact_spam_auto_mark(admin_headers):
    payload = {"name": "SpamUser", "email": "spamuser@example.com", "message": "Visit http://spam.example.com now"}
    r = requests.post(f"{API}/contact", json=payload, headers={"X-Forwarded-For": "203.0.113.11"}, timeout=15)
    # spam should return 400 but still store the record
    assert r.status_code in (400, 200), f"unexpected status: {r.status_code}"
    # List and locate the spam
    time.sleep(0.5)
    r_list = requests.get(f"{API}/contact", headers=admin_headers, timeout=15)
    assert r_list.status_code == 200
    msgs = r_list.json()
    match = next((m for m in msgs if m.get("email") == "spamuser@example.com" and m.get("spam")), None)
    assert match is not None, "No spam=true message stored for the test email"

    # Toggle spam off
    r_patch = requests.patch(f"{API}/admin/contact/{match['id']}", headers=admin_headers, json={"spam": False}, timeout=15)
    assert r_patch.status_code == 200
    r_list2 = requests.get(f"{API}/contact", headers=admin_headers, timeout=15)
    updated = next((m for m in r_list2.json() if m["id"] == match["id"]), None)
    assert updated and updated.get("spam") is False


# --- Priority + archive PATCH ---
def test_priority_and_archive_patch(admin_headers):
    # create a normal contact
    r = requests.post(
        f"{API}/contact",
        json={"name": "PrioTest", "email": "prio_test@example.com", "message": "regular request please quote"},
        headers={"X-Forwarded-For": "203.0.113.12"},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    mid = r.json()["id"]
    r1 = requests.patch(f"{API}/admin/contact/{mid}", headers=admin_headers, json={"priority": "P1"}, timeout=15)
    assert r1.status_code == 200
    r2 = requests.patch(f"{API}/admin/contact/{mid}", headers=admin_headers, json={"status": "archived"}, timeout=15)
    assert r2.status_code == 200
    r_list = requests.get(f"{API}/contact", headers=admin_headers, timeout=15)
    doc = next((m for m in r_list.json() if m["id"] == mid), None)
    assert doc and doc.get("priority") == "P1"
    assert doc.get("status") == "archived"


# --- Bulk actions ---
def test_bulk_delete_and_delete_all_spam(admin_headers):
    # Create one normal message
    r = requests.post(
        f"{API}/contact",
        json={"name": "BulkTest", "email": "bulk_test@example.com", "message": "normal message content"},
        headers={"X-Forwarded-For": "203.0.113.13"},
        timeout=15,
    )
    assert r.status_code == 200
    mid = r.json()["id"]
    rb = requests.post(f"{API}/admin/contact/bulk-delete", headers=admin_headers, json={"ids": [mid]}, timeout=15)
    assert rb.status_code == 200
    assert rb.json().get("deleted") == 1

    # Create two spam messages
    for i in range(2):
        requests.post(
            f"{API}/contact",
            json={"name": f"S{i}", "email": f"spamdel{i}@example.com", "message": "buy now http://spam.example.com"},
            headers={"X-Forwarded-For": f"203.0.113.2{i}"},
            timeout=15,
        )
    time.sleep(0.5)
    rd = requests.post(f"{API}/admin/contact/delete-all-spam", headers=admin_headers, timeout=15)
    assert rd.status_code == 200
    assert rd.json().get("deleted") >= 2

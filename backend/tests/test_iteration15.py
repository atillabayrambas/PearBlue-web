"""Iteration 15 backend tests — priority alerts, newsletter, Brevo, mailboxes,
virus scanner, extended user details, updated changelog (0.7.1-Beta)."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break

API = f"{BASE_URL}/api"
ADMIN_EMAIL = "admin@pearblue.nl"
ADMIN_PASSWORD = "PearBlue2026!"


@pytest.fixture(scope="module")
def admin_headers():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


# --- Changelog: 0.7.1-Beta minor version ---
def test_changelog_current_and_minor():
    r = requests.get(f"{API}/changelog", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert data.get("current") == "0.7.1-Beta", f"current is {data.get('current')}"
    entries = data.get("entries", [])
    assert isinstance(entries, list) and len(entries) >= 8, f"only {len(entries)} entries"
    versions = [e.get("version") for e in entries]
    assert "0.7.1-Beta" in versions


# --- Priority alerts ---
def test_priority_alerts_unauth():
    r = requests.get(f"{API}/admin/priority-alerts", timeout=15)
    assert r.status_code in (401, 403)


def test_priority_alerts_shape(admin_headers):
    r = requests.get(f"{API}/admin/priority-alerts", headers=admin_headers, timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert "counts" in data and "latest" in data
    counts = data["counts"]
    for k in ("Major", "P1", "P2"):
        assert k in counts and isinstance(counts[k], int)


# --- Newsletter ---
def test_newsletter_subscribe_public():
    email = f"TEST_newsletter_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{API}/newsletter/subscribe", json={"email": email, "source": "footer"}, timeout=15)
    assert r.status_code == 200, r.text
    assert r.json().get("status") == "subscribed"
    # Idempotent — same email again
    r2 = requests.post(f"{API}/newsletter/subscribe", json={"email": email, "source": "footer"}, timeout=15)
    assert r2.status_code == 200
    assert r2.json().get("status") == "subscribed"


def test_newsletter_subscribe_invalid():
    r = requests.post(f"{API}/newsletter/subscribe", json={"email": "not-an-email", "source": "footer"}, timeout=15)
    assert r.status_code == 400


def test_newsletter_stats_unauth():
    r = requests.get(f"{API}/admin/newsletter/stats", timeout=15)
    assert r.status_code in (401, 403)


def test_newsletter_stats(admin_headers):
    # Ensure at least one subscriber
    email = f"TEST_newsletter_stats_{uuid.uuid4().hex[:8]}@example.com"
    requests.post(f"{API}/newsletter/subscribe", json={"email": email, "source": "footer"}, timeout=15)
    r = requests.get(f"{API}/admin/newsletter/stats", headers=admin_headers, timeout=15)
    assert r.status_code == 200
    d = r.json()
    for k in ("total", "last_30d", "daily", "sources"):
        assert k in d, f"missing {k}"
    assert isinstance(d["daily"], list)
    assert isinstance(d["sources"], list)
    assert d["total"] >= 1


# --- Brevo ---
def test_brevo_settings_get_and_put(admin_headers):
    r = requests.get(f"{API}/admin/brevo/settings", headers=admin_headers, timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert "api_key" not in d, "raw api_key must never leak"
    assert set(["from_email", "from_name", "enabled", "api_key_set"]).issubset(d.keys())

    r2 = requests.put(
        f"{API}/admin/brevo/settings",
        headers=admin_headers,
        json={
            "api_key": "xkeysib-test-abc123",
            "from_email": "communication-noreply@pearblue.nl",
            "from_name": "PearBlue",
            "enabled": True,
        },
        timeout=15,
    )
    assert r2.status_code == 200
    r3 = requests.get(f"{API}/admin/brevo/settings", headers=admin_headers, timeout=15)
    d3 = r3.json()
    assert d3["api_key_set"] is True
    assert d3["from_email"] == "communication-noreply@pearblue.nl"
    assert d3["enabled"] is True
    assert "api_key" not in d3


def test_brevo_campaigns_mocked(admin_headers):
    r = requests.get(f"{API}/admin/brevo/campaigns", headers=admin_headers, timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d.get("mocked") is True
    assert "reason" in d
    assert isinstance(d.get("campaigns"), list)


# --- Mailboxes ---
def test_mailboxes_crud(admin_headers):
    payload = {
        "label": "TEST_Support",
        "email": "support-test@pearblue.nl",
        "host": "imap.example.com",
        "port": 993,
        "username": "support",
        "password": "supersecret",
        "use_ssl": True,
    }
    r = requests.post(f"{API}/admin/mailboxes", headers=admin_headers, json=payload, timeout=15)
    assert r.status_code == 200, r.text
    created = r.json()
    assert "id" in created
    assert "password" not in created, "password must not be echoed"
    mid = created["id"]

    r2 = requests.get(f"{API}/admin/mailboxes", headers=admin_headers, timeout=15)
    assert r2.status_code == 200
    ids = [m["id"] for m in r2.json()]
    assert mid in ids
    for m in r2.json():
        assert "password" not in m

    r3 = requests.delete(f"{API}/admin/mailboxes/{mid}", headers=admin_headers, timeout=15)
    assert r3.status_code == 200
    assert r3.json().get("status") == "deleted"


def test_mailboxes_unauth():
    r = requests.get(f"{API}/admin/mailboxes", timeout=15)
    assert r.status_code in (401, 403)


# --- Virus scanner ---
def test_virus_scanner_logs(admin_headers):
    r = requests.get(f"{API}/admin/virus-scanner/logs", headers=admin_headers, timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_virus_scanner_quarantine_404(admin_headers):
    fake = str(uuid.uuid4())
    r = requests.post(f"{API}/admin/virus-scanner/{fake}/quarantine", headers=admin_headers, timeout=15)
    assert r.status_code == 404


# --- Extended user details ---
def test_user_details_get(admin_headers):
    r = requests.get(f"{API}/admin/users/{ADMIN_EMAIL}/details", headers=admin_headers, timeout=15)
    assert r.status_code == 200
    d = r.json()
    for k in ("address", "postal_code", "city", "country", "company", "kvk", "tax_id", "profile_picture"):
        assert k in d, f"missing key {k}"


def test_user_details_put(admin_headers):
    r = requests.put(
        f"{API}/admin/users/{ADMIN_EMAIL}/details",
        headers=admin_headers,
        json={"address": "Havenstraat 1", "kvk": "87201607"},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    d = r.json()
    assert d.get("status") == "updated"
    assert d.get("zoho_synced") is False
    # verify persisted
    g = requests.get(f"{API}/admin/users/{ADMIN_EMAIL}/details", headers=admin_headers, timeout=15).json()
    assert g["address"] == "Havenstraat 1"
    assert g["kvk"] == "87201607"


def test_user_reset_password(admin_headers):
    r = requests.post(f"{API}/admin/users/{ADMIN_EMAIL}/reset-password", headers=admin_headers, timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d.get("status") == "sent"
    assert d.get("email") == ADMIN_EMAIL

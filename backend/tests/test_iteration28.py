"""Iteration 28 tests: maintenance mode, /site/version, portal registration without address, newsletter subscribe."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    # Fallback: read from /app/frontend/.env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.strip().split("=", 1)[1]
                break
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@pearblue.nl"
ADMIN_PASSWORD = "PearBlue2026!"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ---------- Version ----------
def test_site_version():
    r = requests.get(f"{API}/site/version", timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert data.get("version") == "0.6.5-Beta", f"got {data}"


# ---------- Maintenance snapshot defaults ----------
def test_site_maintenance_snapshot_shape():
    r = requests.get(f"{API}/site/maintenance", timeout=10)
    assert r.status_code == 200
    d = r.json()
    for key in [
        "maintenance_mode",
        "maintenance_title_nl",
        "maintenance_title_en",
        "maintenance_message_nl",
        "maintenance_message_en",
        "maintenance_bg_url",
        "maintenance_show_newsletter",
        "maintenance_show_version",
        "version",
    ]:
        assert key in d, f"missing key {key}"
    assert d["version"] == "0.6.5-Beta"


# ---------- Update settings with maintenance fields ----------
def test_settings_update_maintenance_fields(auth_headers):
    payload = {
        "maintenance_mode": True,
        "maintenance_title_nl": "Test onderhoud NL",
        "maintenance_title_en": "Test maintenance EN",
        "maintenance_message_nl": "NL msg iter28",
        "maintenance_message_en": "EN msg iter28",
        "maintenance_bg_url": "https://example.com/bg.png",
        "maintenance_show_newsletter": True,
        "maintenance_show_version": True,
    }
    r = requests.put(f"{API}/settings", json=payload, headers=auth_headers, timeout=15)
    assert r.status_code == 200, r.text
    saved = r.json()
    assert saved.get("maintenance_mode") is True
    assert saved.get("maintenance_title_nl") == "Test onderhoud NL"

    # verify public snapshot reflects it
    r2 = requests.get(f"{API}/site/maintenance", timeout=10)
    assert r2.status_code == 200
    d = r2.json()
    assert d["maintenance_mode"] is True
    assert d["maintenance_title_nl"] == "Test onderhoud NL"
    assert d["maintenance_message_en"] == "EN msg iter28"

    # newsletter subscribe under maintenance source
    email = "TEST_iter28@example.com"
    r3 = requests.post(f"{API}/newsletter/subscribe", json={"email": email, "source": "maintenance"}, timeout=15)
    assert r3.status_code == 200, r3.text
    assert r3.json().get("status") == "subscribed"

    # disable
    r4 = requests.put(f"{API}/settings", json={"maintenance_mode": False}, headers=auth_headers, timeout=15)
    assert r4.status_code == 200
    r5 = requests.get(f"{API}/site/maintenance", timeout=10)
    assert r5.json()["maintenance_mode"] is False


# ---------- Portal registration without address/postal ----------
def test_portal_register_without_address():
    payload = {
        "name": "TEST Iter28 User",
        "email": "TEST_iter28_reg@example.com",
        "language": "nl",
        # No address, postal_code, city, region, country
    }
    r = requests.post(f"{API}/portal/register", json=payload, timeout=15)
    # Endpoint may also require captcha; check the routes
    if r.status_code == 404:
        # try alternate path
        r = requests.post(f"{API}/portal/registrations", json=payload, timeout=15)
    assert r.status_code in (200, 201), f"{r.status_code} {r.text}"

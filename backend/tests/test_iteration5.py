"""Iteration 5 backend tests: chat stats admin endpoint, Zoho OAuth handshake, portal endpoints."""
import os
import pytest
import requests

BASE_URL = os.environ['REACT_APP_BACKEND_URL'].rstrip('/')
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@pearblue.nl"
ADMIN_PASSWORD = "PearBlue2026!"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_headers(session):
    r = session.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, r.text
    tok = r.json()["access_token"]
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ---- Chat stats ----
def test_chat_stats_requires_admin(session):
    r = session.get(f"{API}/chat/stats", timeout=15)
    assert r.status_code == 401


def test_chat_stats_default_30(session, admin_headers):
    r = session.get(f"{API}/chat/stats?days=30", headers=admin_headers, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    for k in ["days", "total_in_range", "total_messages_ever", "unique_sessions_in_range", "per_day", "per_language", "rate_limit_per_hour"]:
        assert k in body, f"Missing key {k}"
    assert body["days"] == 30
    assert isinstance(body["per_day"], list) and len(body["per_day"]) == 30
    for item in body["per_day"]:
        assert "date" in item and "count" in item
    assert body["rate_limit_per_hour"] == 20


def test_chat_stats_days_7(session, admin_headers):
    r = session.get(f"{API}/chat/stats?days=7", headers=admin_headers, timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert body["days"] == 7
    assert len(body["per_day"]) == 7


# ---- Zoho OAuth ----
def test_zoho_login_redirect(session):
    # Don't follow redirect
    r = session.get(f"{API}/auth/zoho/login", allow_redirects=False, timeout=15)
    assert r.status_code in (302, 307), f"Expected redirect, got {r.status_code}: {r.text[:200]}"
    loc = r.headers.get("Location", "")
    assert "accounts.zoho.eu/oauth/v2/auth" in loc, f"Bad location: {loc}"
    assert "scope=" in loc
    # Scope should include AaaServer.profile.READ and ZohoBooks.invoices.READ
    assert "AaaServer.profile.READ" in loc or "AaaServer.profile.READ" in requests.utils.unquote(loc)
    assert "ZohoBooks.invoices.READ" in loc or "ZohoBooks.invoices.READ" in requests.utils.unquote(loc)
    assert "state=" in loc


def test_portal_me_no_session(session):
    # Use a fresh session to guarantee no cookies
    s = requests.Session()
    r = s.get(f"{API}/auth/portal/me", timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("authenticated") is False


def test_portal_invoices_no_session():
    s = requests.Session()
    r = s.get(f"{API}/portal/invoices", timeout=15)
    assert r.status_code == 401


def test_portal_projects_no_session():
    s = requests.Session()
    r = s.get(f"{API}/portal/projects", timeout=15)
    assert r.status_code == 401


def test_portal_tickets_no_session():
    s = requests.Session()
    r = s.get(f"{API}/portal/tickets", timeout=15)
    assert r.status_code == 401


# ---- SEO static files (via frontend URL) ----
def test_robots_txt():
    r = requests.get(f"{BASE_URL}/robots.txt", timeout=15)
    assert r.status_code == 200
    text = r.text
    assert "Disallow: /admin" in text
    assert "Sitemap:" in text


def test_sitemap_xml():
    r = requests.get(f"{BASE_URL}/sitemap.xml", timeout=15)
    assert r.status_code == 200
    text = r.text
    for path in ["/over-ons", "/diensten", "/portfolio", "/contact"]:
        assert path in text, f"Missing {path} in sitemap"
    # Root
    assert "<loc>" in text

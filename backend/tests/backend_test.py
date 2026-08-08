"""PearBlue backend API tests - iteration 3.

Coverage:
- Health
- Auth: /api/auth/login (success + failure), /api/auth/me (with/without token)
- Projects: GET public, POST/DELETE require admin bearer token
- Chat: /api/chat with Claude Sonnet 4.6 (basic + multi-turn context)
- Contact regression
"""
import os
import time
import uuid
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
def admin_token(session):
    r = session.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    tok = r.json().get("access_token")
    assert tok
    return tok


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# ---- Health ----
def test_health(session):
    r = session.get(f"{API}/health", timeout=15)
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


# ---- Auth ----
def test_login_success(session):
    r = session.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "access_token" in data and isinstance(data["access_token"], str) and len(data["access_token"]) > 20
    assert data["user"]["email"] == ADMIN_EMAIL
    assert data["user"]["role"] == "admin"


def test_login_wrong_password(session):
    r = session.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "WRONG!!"}, timeout=15)
    assert r.status_code == 401


def test_login_unknown_email(session):
    r = session.post(f"{API}/auth/login", json={"email": "nobody@pearblue.nl", "password": "whatever"}, timeout=15)
    assert r.status_code == 401


def test_auth_me_without_token(session):
    r = session.get(f"{API}/auth/me", timeout=15)
    assert r.status_code == 401


def test_auth_me_with_token(session, auth_headers):
    r = session.get(f"{API}/auth/me", headers=auth_headers, timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert body["email"] == ADMIN_EMAIL
    assert body["role"] == "admin"


def test_auth_me_bad_token(session):
    r = session.get(f"{API}/auth/me", headers={"Authorization": "Bearer garbage.token.here"}, timeout=15)
    assert r.status_code == 401


# ---- Projects (public GET; protected POST/DELETE) ----
def test_projects_list_public(session):
    r = session.get(f"{API}/projects", timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_projects_post_without_token(session):
    payload = {"title": "TEST_Unauthorized", "category": "ai", "image_url": "https://picsum.photos/800/600"}
    r = session.post(f"{API}/projects", json=payload, timeout=15)
    assert r.status_code == 401


def test_projects_delete_without_token(session):
    r = session.delete(f"{API}/projects/some-id", timeout=15)
    assert r.status_code == 401


def test_projects_create_and_delete_with_admin(session, auth_headers):
    unique = f"TEST_Proj_{uuid.uuid4().hex[:8]}"
    payload = {
        "title": unique,
        "category": "ai",
        "image_url": "https://picsum.photos/id/1/800/600",
        "description": "sample",
        "tag": "TEST",
        "external_url": "https://example.com",
    }
    r = session.post(f"{API}/projects", json=payload, headers=auth_headers, timeout=15)
    assert r.status_code == 200, r.text
    pid = r.json()["id"]
    assert r.json()["title"] == unique

    # persistence via GET
    r2 = session.get(f"{API}/projects", timeout=15)
    ids = [p["id"] for p in r2.json()]
    assert pid in ids

    # delete
    d = session.delete(f"{API}/projects/{pid}", headers=auth_headers, timeout=15)
    assert d.status_code == 200

    # delete again -> 404
    d2 = session.delete(f"{API}/projects/{pid}", headers=auth_headers, timeout=15)
    assert d2.status_code == 404


# ---- Chat ----
def test_chat_basic_nl(session):
    sid = f"test-{uuid.uuid4().hex[:10]}"
    r = session.post(f"{API}/chat", json={
        "session_id": sid,
        "message": "Wat kost een website?",
        "language": "nl",
    }, timeout=45)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["session_id"] == sid
    reply = body["reply"]
    assert isinstance(reply, str) and len(reply) > 10
    # Sanity: should mention pricing or website
    low = reply.lower()
    assert any(t in low for t in ["200", "€", "vanaf", "website", "prijs"])


def test_chat_multi_turn_context(session):
    sid = f"test-multi-{uuid.uuid4().hex[:10]}"
    r1 = session.post(f"{API}/chat", json={
        "session_id": sid, "message": "Wat kost een website?", "language": "nl"
    }, timeout=45)
    assert r1.status_code == 200
    time.sleep(1)
    r2 = session.post(f"{API}/chat", json={
        "session_id": sid,
        "message": "Ken je de prijzen nog van je vorige antwoord?",
        "language": "nl",
    }, timeout=45)
    assert r2.status_code == 200
    reply2 = r2.json()["reply"].lower()
    # Should reference prior pricing content contextually
    assert any(t in reply2 for t in ["200", "€", "website", "vanaf", "prijs", "ja", "eerder"])


# ---- Settings ----
def test_settings_get_public(session):
    r = session.get(f"{API}/settings", timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    for k in ["ga4_measurement_id", "search_console_verification", "hero_headline_nl", "hero_headline_en"]:
        assert k in body


def test_settings_put_unauthenticated(session):
    r = session.put(f"{API}/settings", json={"ga4_measurement_id": "G-NOPE"}, timeout=15)
    assert r.status_code == 401


def test_settings_put_with_admin_and_persistence(session, auth_headers):
    payload = {
        "ga4_measurement_id": "G-TEST123",
        "search_console_verification": "sc-token-test",
        "hero_headline_nl": "TEST_NL_headline",
        "hero_headline_en": "TEST_EN_headline",
    }
    r = session.put(f"{API}/settings", json=payload, headers=auth_headers, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    for k, v in payload.items():
        assert body[k] == v

    # persistence
    r2 = session.get(f"{API}/settings", timeout=15)
    assert r2.status_code == 200
    body2 = r2.json()
    for k, v in payload.items():
        assert body2[k] == v


# ---- Chat rate limiting ----
def test_chat_returns_remaining_and_rate_limits(session):
    # Send short messages until we get a 429 or hit safety limit
    sid = f"rl-{uuid.uuid4().hex[:8]}"
    got_429 = False
    last_remaining = None
    for i in range(25):
        r = session.post(f"{API}/chat", json={
            "session_id": f"{sid}-{i}",
            "message": "hi",
            "language": "nl",
        }, timeout=45)
        if r.status_code == 429:
            got_429 = True
            break
        assert r.status_code == 200, f"iter {i}: {r.status_code} {r.text}"
        body = r.json()
        assert "remaining" in body and isinstance(body["remaining"], int)
        last_remaining = body["remaining"]
    assert got_429, f"Expected 429 after CHAT_RATE_LIMIT_PER_HOUR, last remaining={last_remaining}"


# ---- Contact regression ----
def test_contact_create(session):
    payload = {
        "name": "TEST_Regression",
        "email": "test_regression@example.com",
        "message": "Hello from test",
        "language": "nl",
    }
    r = session.post(f"{API}/contact", json=payload, timeout=20)
    assert r.status_code == 200, r.text
    assert r.json()["name"] == payload["name"]

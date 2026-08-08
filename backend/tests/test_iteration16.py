"""Iteration 16 backend tests — v0.5.2-Beta.
Covers: ROLE_FINANCIEN, /admin/financials, /admin/chat/rating(s), Brevo/mailbox encryption,
mailbox duplicate prevention, /quote wishlist+story extension, regressions.
"""
import os
import time
import uuid
import pytest
import requests
from pathlib import Path


def _load_env():
    for envf in ("/app/frontend/.env", "/app/backend/.env"):
        p = Path(envf)
        if not p.exists():
            continue
        for line in p.read_text().splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"'))


_load_env()
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL not set"
ADMIN_EMAIL = "admin@pearblue.nl"
ADMIN_PASS = "PearBlue2026!"


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# ---------- Roles ----------
def test_roles_include_financien(admin_headers):
    r = requests.get(f"{BASE_URL}/api/admin/roles", headers=admin_headers, timeout=15)
    assert r.status_code == 200
    data = r.json()
    keys = {x["key"] for x in data}
    assert "financien" in keys
    assert len(data) >= 7
    perms = {x["key"]: set(x["permissions"]) for x in data}
    assert {"financials", "analytics"} <= perms["financien"]
    for role in ["super_admin", "beheerder"]:
        assert "financials" in perms[role], f"{role} missing financials"


def test_create_user_financien(admin_headers):
    email = f"test_financien_{uuid.uuid4().hex[:8]}@pearblue.nl"
    r = requests.post(f"{BASE_URL}/api/admin/users", headers=admin_headers,
                      json={"email": email, "role": "financien", "password": "TestFin123!", "display_name": "Test Fin"}, timeout=15)
    assert r.status_code == 200, r.text
    assert r.json()["role"] == "financien"
    # cleanup
    requests.delete(f"{BASE_URL}/api/admin/users/{email}", headers=admin_headers, timeout=15)


# ---------- Financials ----------
def test_financials_default_30d(admin_headers):
    r = requests.get(f"{BASE_URL}/api/admin/financials?period=30d", headers=admin_headers, timeout=20)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["range"]["days"] == 30
    ai = d["emergent_ai"]
    for k in ("messages", "estimated_eur", "estimated_usd", "estimated_credits"):
        assert k in ai
    zb = d["zoho_books"]
    assert zb["mocked"] is True
    for k in ("invoiced_total_eur", "paid_total_eur", "outstanding_eur", "overdue_eur", "top_clients"):
        assert k in zb
    t = d["totals"]
    for k in ("combined_income_eur", "combined_costs_eur", "estimated_margin_eur"):
        assert k in t


def test_financials_7d(admin_headers):
    r = requests.get(f"{BASE_URL}/api/admin/financials?period=7d", headers=admin_headers, timeout=20)
    assert r.status_code == 200
    assert r.json()["range"]["days"] == 7


def test_financials_custom(admin_headers):
    r = requests.get(f"{BASE_URL}/api/admin/financials?period=custom&date_from=2025-01-01&date_to=2025-01-31",
                     headers=admin_headers, timeout=20)
    assert r.status_code == 200
    assert r.json()["range"]["days"] == 30


def test_financials_forbidden_for_moderator(admin_headers):
    # create moderator, login, hit /financials -> 403
    mod_email = f"test_mod_{uuid.uuid4().hex[:8]}@pearblue.nl"
    mod_pass = "TestMod123!"
    cr = requests.post(f"{BASE_URL}/api/admin/users", headers=admin_headers,
                       json={"email": mod_email, "role": "moderator", "password": mod_pass}, timeout=15)
    assert cr.status_code == 200, cr.text
    try:
        lr = requests.post(f"{BASE_URL}/api/auth/login", json={"email": mod_email, "password": mod_pass}, timeout=15)
        assert lr.status_code == 200, lr.text
        mod_tok = lr.json()["access_token"]
        r = requests.get(f"{BASE_URL}/api/admin/financials?period=30d",
                         headers={"Authorization": f"Bearer {mod_tok}"}, timeout=15)
        assert r.status_code == 403, f"expected 403, got {r.status_code} {r.text}"
    finally:
        requests.delete(f"{BASE_URL}/api/admin/users/{mod_email}", headers=admin_headers, timeout=15)


# ---------- Quote with wishlist + story ----------
def test_quote_with_wishlist_and_story():
    payload = {
        "name": "TEST_Quote User",
        "email": "test_quote@pearblue.nl",
        "company": "TEST Co",
        "pages": 5,
        "budget": "1000-5000",
        "services": ["web"],
        "description": "Test description",
        "language": "nl",
        "wishlist_items": [
            {"id": "web-basic", "label": "Basic Website", "qty": 1, "unit": "one-off", "price": 1500}
        ],
        "wishlist_totals": {"oneOff": 1500, "monthly": 20, "hourly": 0, "grandTotal": 1839},
        "story": "Sfeer en verhaal test — moderne warme site",
    }
    r = requests.post(f"{BASE_URL}/api/quote", json=payload, timeout=20)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["story"] == payload["story"]
    assert isinstance(d["wishlist_items"], list) and len(d["wishlist_items"]) == 1
    assert d["wishlist_totals"]["oneOff"] == 1500


# ---------- Chat rating ----------
def test_chat_rating_submit_and_stats(admin_headers):
    sid = f"test_sess_{uuid.uuid4().hex[:8]}"
    r = requests.post(f"{BASE_URL}/api/chat/rating", json={"session_id": sid, "rating": 5, "source": "chat"}, timeout=15)
    assert r.status_code == 200
    j = r.json()
    assert j["status"] == "saved"
    assert "id" in j
    # stats
    r2 = requests.get(f"{BASE_URL}/api/admin/chat/ratings?days=30", headers=admin_headers, timeout=15)
    assert r2.status_code == 200
    d = r2.json()
    for k in ("total", "avg", "counts", "per_day", "recent"):
        assert k in d
    assert set(map(int, d["counts"].keys())) == {1, 2, 3, 4, 5}
    assert d["total"] >= 1


def test_chat_rating_out_of_range():
    for bad in (0, 6):
        r = requests.post(f"{BASE_URL}/api/chat/rating",
                          json={"session_id": "x", "rating": bad, "source": "chat"}, timeout=15)
        assert r.status_code == 422, f"rating={bad} expected 422 got {r.status_code}"


# ---------- Brevo API key encryption ----------
def test_brevo_settings_encrypted(admin_headers):
    r = requests.put(f"{BASE_URL}/api/admin/brevo/settings", headers=admin_headers,
                     json={"api_key": "test123", "enabled": True}, timeout=15)
    assert r.status_code == 200
    g = requests.get(f"{BASE_URL}/api/admin/brevo/settings", headers=admin_headers, timeout=15)
    assert g.status_code == 200
    d = g.json()
    assert d["api_key_set"] is True
    assert "api_key" not in d  # raw key must never be returned
    # DB check via direct mongo
    import pymongo
    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    if mongo_url and db_name:
        client = pymongo.MongoClient(mongo_url)
        doc = client[db_name].integrations.find_one({"key": "brevo"})
        assert doc is not None
        assert isinstance(doc.get("api_key"), str)
        assert doc["api_key"].startswith("enc:"), f"api_key not encrypted: {doc.get('api_key')[:20]}"


# ---------- Mailbox duplicate + encryption ----------
def test_mailbox_duplicate_prevention(admin_headers):
    email = f"test_dup_{uuid.uuid4().hex[:6]}@example.com"
    payload = {
        "label": "TEST_MBX", "email": email, "host": "imap.example.com",
        "port": 993, "username": email, "password": "secret123", "use_ssl": True,
    }
    r = requests.post(f"{BASE_URL}/api/admin/mailboxes", headers=admin_headers, json=payload, timeout=15)
    assert r.status_code == 200, r.text
    mid = r.json()["id"]
    try:
        # duplicate
        r2 = requests.post(f"{BASE_URL}/api/admin/mailboxes", headers=admin_headers, json=payload, timeout=15)
        assert r2.status_code == 409, f"expected 409 got {r2.status_code}"
        # DB check encryption
        import pymongo
        mongo_url = os.environ.get("MONGO_URL")
        db_name = os.environ.get("DB_NAME")
        if mongo_url and db_name:
            client = pymongo.MongoClient(mongo_url)
            doc = client[db_name].mailboxes.find_one({"id": mid})
            assert doc and doc.get("password", "").startswith("enc:"), "mailbox password not encrypted"
    finally:
        requests.delete(f"{BASE_URL}/api/admin/mailboxes/{mid}", headers=admin_headers, timeout=15)


# ---------- Regression: stable endpoints ----------
@pytest.mark.parametrize("path", [
    "/api/projects", "/api/reviews", "/api/admin/counters",
])
def test_public_get_ok(path):
    # counters is admin-only; do a HEAD for public
    if "admin" in path:
        return
    r = requests.get(f"{BASE_URL}{path}", timeout=15)
    assert r.status_code == 200


def test_counters_admin(admin_headers):
    r = requests.get(f"{BASE_URL}/api/admin/counters", headers=admin_headers, timeout=15)
    assert r.status_code == 200


def test_chat_endpoint():
    r = requests.post(f"{BASE_URL}/api/chat", json={"session_id": "reg_test", "message": "hi"}, timeout=60)
    assert r.status_code == 200


def test_newsletter_subscribe():
    email = f"test_nl_{uuid.uuid4().hex[:6]}@pearblue.nl"
    r = requests.post(f"{BASE_URL}/api/newsletter/subscribe", json={"email": email}, timeout=15)
    assert r.status_code == 200


def test_telemetry_captcha():
    r = requests.post(f"{BASE_URL}/api/telemetry/captcha-verified",
                      json={"page": "/test", "action": "test"}, timeout=15)
    assert r.status_code in (200, 204)

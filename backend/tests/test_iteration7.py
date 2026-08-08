"""Iteration 7 tests: Reviews (public + admin CMS) + Zoho OAuth endpoint contracts."""
import os
import pytest
import requests
from urllib.parse import urlparse, parse_qs
from pymongo import MongoClient

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://sheet-converter-68.preview.emergentagent.com').rstrip('/')
ADMIN_EMAIL = "admin@pearblue.nl"
ADMIN_PASSWORD = "PearBlue2026!"

try:
    from dotenv import dotenv_values
    _env = dotenv_values('/app/backend/.env')
    MONGO_URL = _env.get('MONGO_URL')
    DB_NAME = _env.get('DB_NAME')
    ZOHO_REDIRECT_URI = _env.get('ZOHO_REDIRECT_URI')
    ZOHO_CLIENT_ID = _env.get('ZOHO_CLIENT_ID')
except Exception:
    MONGO_URL = DB_NAME = ZOHO_REDIRECT_URI = ZOHO_CLIENT_ID = None


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def created_review_ids():
    ids = []
    yield ids
    if MONGO_URL and DB_NAME and ids:
        try:
            cli = MongoClient(MONGO_URL)
            cli[DB_NAME].reviews.delete_many({"id": {"$in": ids}})
            cli.close()
        except Exception as e:
            print(f"cleanup failed: {e}")


# ---------- POST /api/reviews (public) ----------
def test_create_review_success(created_review_ids):
    payload = {
        "name": "TEST_Iter7 Klant",
        "company": "TEST Iter7 BV",
        "project": "Website + Zoho koppeling",
        "rating": 5,
        "quote": "Uitstekende samenwerking met PearBlue!",
    }
    r = requests.post(f"{BASE_URL}/api/reviews", json=payload, timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["approved"] is False
    assert data["featured"] is False
    assert data["rating"] == 5
    assert data["name"] == payload["name"]
    assert data["quote"] == payload["quote"]
    assert "id" in data
    created_review_ids.append(data["id"])


def test_create_review_rating_out_of_range():
    r = requests.post(f"{BASE_URL}/api/reviews", json={
        "name": "TEST bad", "rating": 6, "quote": "long enough quote here"
    }, timeout=15)
    assert r.status_code == 422


def test_create_review_quote_too_short():
    r = requests.post(f"{BASE_URL}/api/reviews", json={
        "name": "TEST short", "rating": 3, "quote": "short"
    }, timeout=15)
    assert r.status_code == 422


def test_create_review_missing_name():
    r = requests.post(f"{BASE_URL}/api/reviews", json={
        "rating": 4, "quote": "long enough quote here for validation"
    }, timeout=15)
    assert r.status_code == 422


# ---------- GET /api/reviews public ----------
def test_list_reviews_public_only_approved(created_review_ids):
    """Default (no query) should only return approved=true."""
    r = requests.get(f"{BASE_URL}/api/reviews", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert all(item["approved"] is True for item in data)
    # our unapproved one should NOT be in the default list
    ids = {i["id"] for i in data}
    assert created_review_ids[0] not in ids


def test_list_reviews_approved_false_returns_unapproved(created_review_ids):
    """Verify current behavior: ?approved=false returns unapproved (raw filter)."""
    r = requests.get(f"{BASE_URL}/api/reviews?approved=false", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert all(item["approved"] is False for item in data)
    ids = {i["id"] for i in data}
    assert created_review_ids[0] in ids


def test_list_reviews_featured_only_returns_featured_approved():
    r = requests.get(f"{BASE_URL}/api/reviews?featured=true", timeout=15)
    assert r.status_code == 200
    data = r.json()
    for item in data:
        assert item["approved"] is True
        assert item["featured"] is True


# ---------- Admin routes ----------
def test_list_all_reviews_unauth_401():
    r = requests.get(f"{BASE_URL}/api/reviews/all", timeout=15)
    assert r.status_code == 401


def test_list_all_reviews_admin(admin_token, created_review_ids):
    r = requests.get(f"{BASE_URL}/api/reviews/all",
                     headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
    assert r.status_code == 200
    data = r.json()
    ids = {i["id"] for i in data}
    assert created_review_ids[0] in ids


def test_patch_review_unauth(created_review_ids):
    r = requests.patch(f"{BASE_URL}/api/reviews/{created_review_ids[0]}",
                       json={"approved": True}, timeout=15)
    assert r.status_code == 401


def test_patch_review_approve(admin_token, created_review_ids):
    r = requests.patch(f"{BASE_URL}/api/reviews/{created_review_ids[0]}",
                       headers={"Authorization": f"Bearer {admin_token}"},
                       json={"approved": True}, timeout=15)
    assert r.status_code == 200
    assert r.json()["approved"] is True


def test_patch_review_feature(admin_token, created_review_ids):
    r = requests.patch(f"{BASE_URL}/api/reviews/{created_review_ids[0]}",
                       headers={"Authorization": f"Bearer {admin_token}"},
                       json={"featured": True}, timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert body["featured"] is True
    assert body["approved"] is True  # from previous patch


def test_featured_endpoint_returns_our_featured_review(created_review_ids):
    r = requests.get(f"{BASE_URL}/api/reviews?featured=true", timeout=15)
    assert r.status_code == 200
    ids = {i["id"] for i in r.json()}
    assert created_review_ids[0] in ids


def test_patch_review_not_found(admin_token):
    r = requests.patch(f"{BASE_URL}/api/reviews/nope-xyz",
                       headers={"Authorization": f"Bearer {admin_token}"},
                       json={"approved": True}, timeout=15)
    assert r.status_code == 404


def test_delete_review_unauth(created_review_ids):
    r = requests.delete(f"{BASE_URL}/api/reviews/{created_review_ids[0]}", timeout=15)
    assert r.status_code == 401


def test_delete_review_admin(admin_token, created_review_ids):
    r = requests.delete(f"{BASE_URL}/api/reviews/{created_review_ids[0]}",
                        headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
    assert r.status_code == 200
    # verify gone
    r2 = requests.get(f"{BASE_URL}/api/reviews/all",
                      headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
    ids = {i["id"] for i in r2.json()}
    assert created_review_ids[0] not in ids
    created_review_ids.pop(0)


# ---------- Zoho OAuth ----------
def test_zoho_login_redirect_shape():
    r = requests.get(f"{BASE_URL}/api/auth/zoho/login", allow_redirects=False, timeout=15)
    assert r.status_code in (302, 307)
    loc = r.headers.get("location", "")
    assert "accounts.zoho.eu/oauth/v2/auth" in loc
    parsed = urlparse(loc)
    qs = parse_qs(parsed.query)
    assert qs.get("client_id", [""])[0] == (ZOHO_CLIENT_ID or "")
    assert qs.get("redirect_uri", [""])[0] == (ZOHO_REDIRECT_URI or "")
    assert qs.get("state", [""])[0]
    assert qs.get("scope", [""])[0]


def test_zoho_exchange_bad_input_400():
    r = requests.post(f"{BASE_URL}/api/auth/zoho/exchange",
                      json={"code": "xxx", "state": "yyy"}, timeout=15)
    assert r.status_code == 400
    assert "Invalid OAuth state or code" in r.text or "state" in r.text.lower()


def test_zoho_exchange_empty_body_400():
    r = requests.post(f"{BASE_URL}/api/auth/zoho/exchange", json={}, timeout=15)
    assert r.status_code == 400


def test_zoho_legacy_callback_400_on_empty():
    r = requests.get(f"{BASE_URL}/api/auth/zoho/callback", timeout=15, allow_redirects=False)
    assert r.status_code == 400


def test_portal_me_unauthenticated():
    r = requests.get(f"{BASE_URL}/api/auth/portal/me", timeout=15)
    assert r.status_code == 200
    assert r.json() == {"authenticated": False}


def test_portal_logout_ok():
    r = requests.post(f"{BASE_URL}/api/auth/portal/logout", timeout=15)
    assert r.status_code == 200
    assert r.json().get("ok") is True


# ---------- Portal (Zoho) endpoints require auth ----------
@pytest.mark.parametrize("path", ["/api/portal/invoices", "/api/portal/projects", "/api/portal/tickets"])
def test_portal_endpoints_unauth_401(path):
    r = requests.get(f"{BASE_URL}{path}", timeout=15)
    assert r.status_code == 401


# ---------- Regression ----------
def test_contact_still_works():
    r = requests.post(f"{BASE_URL}/api/contact", json={
        "name": "TEST_iter7 regression", "email": "t7@example.com", "message": "hello"
    }, timeout=20)
    assert r.status_code == 200


def test_chat_still_responds():
    r = requests.post(f"{BASE_URL}/api/chat",
                      json={"session_id": "test-iter7-sess", "message": "Hi Pear, one word reply please"},
                      timeout=45)
    assert r.status_code == 200
    body = r.json()
    assert "reply" in body or "message" in body or "response" in body or len(body) > 0


def test_admin_login_regression():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200
    assert "access_token" in r.json()

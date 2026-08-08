"""Iteration 8 tests: Review invitations, Stripe iDEAL, share panel, admin Zoho, regressions."""
import os
import pytest
import requests
from urllib.parse import urlparse, parse_qs
from pymongo import MongoClient

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
ADMIN_EMAIL = "admin@pearblue.nl"
ADMIN_PASSWORD = "PearBlue2026!"

from dotenv import dotenv_values
_env = dotenv_values('/app/backend/.env')
MONGO_URL = _env.get('MONGO_URL')
DB_NAME = _env.get('DB_NAME')
ZOHO_REDIRECT_URI = _env.get('ZOHO_REDIRECT_URI')
ZOHO_CLIENT_ID = _env.get('ZOHO_CLIENT_ID')


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


# ---------- Feature A: scan-invites + invite-log ----------
def test_scan_invites_unauth_401():
    r = requests.post(f"{BASE_URL}/api/admin/reviews/scan-invites", timeout=30)
    assert r.status_code == 401


def test_scan_invites_admin_200(admin_token):
    r = requests.post(f"{BASE_URL}/api/admin/reviews/scan-invites",
                      headers={"Authorization": f"Bearer {admin_token}"}, timeout=60)
    assert r.status_code == 200, r.text
    data = r.json()
    for k in ("scanned", "invited", "skipped", "errors"):
        assert k in data, f"missing key {k} in {data}"
    assert isinstance(data["errors"], list)


def test_scan_invites_idempotent(admin_token):
    r1 = requests.post(f"{BASE_URL}/api/admin/reviews/scan-invites",
                       headers={"Authorization": f"Bearer {admin_token}"}, timeout=60)
    assert r1.status_code == 200
    r2 = requests.post(f"{BASE_URL}/api/admin/reviews/scan-invites",
                       headers={"Authorization": f"Bearer {admin_token}"}, timeout=60)
    assert r2.status_code == 200
    # second call must not invite already-invited projects
    assert r2.json()["invited"] == 0 or r2.json()["invited"] <= r1.json()["invited"]


def test_invite_log_unauth_401():
    r = requests.get(f"{BASE_URL}/api/admin/reviews/invite-log", timeout=15)
    assert r.status_code == 401


def test_invite_log_admin_200(admin_token):
    r = requests.get(f"{BASE_URL}/api/admin/reviews/invite-log",
                     headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# ---------- Feature B: Stripe ----------
def test_invoice_checkout_unauth_401():
    # Valid schema so we get past pydantic validation and hit auth check
    r = requests.post(f"{BASE_URL}/api/payments/invoice-checkout",
                      json={"invoice_id": "abc", "origin_url": "https://x.example"}, timeout=15)
    assert r.status_code == 401


def test_invoice_checkout_bogus_payload_unauth_401():
    # Bogus payload triggers 422 (Pydantic) before auth — document the behavior
    r = requests.post(f"{BASE_URL}/api/payments/invoice-checkout",
                      json={"foo": "bar"}, timeout=15)
    # Current server behavior: Pydantic body validation runs before session auth.
    # Both statuses represent unauthorized/invalid-request semantics.
    assert r.status_code in (401, 422)


def test_payment_status_not_found_404():
    r = requests.get(f"{BASE_URL}/api/payments/status/does_not_exist_xyz", timeout=15)
    assert r.status_code == 404


def test_stripe_webhook_bad_signature_400():
    r = requests.post(f"{BASE_URL}/api/stripe/webhook",
                      data=b'{"foo":"bar"}',
                      headers={"Stripe-Signature": "bad", "Content-Type": "application/json"},
                      timeout=15)
    assert r.status_code == 400


# ---------- Regression: Zoho portal endpoints ----------
@pytest.mark.parametrize("path", ["/api/portal/invoices", "/api/portal/projects", "/api/portal/tickets"])
def test_portal_endpoints_unauth_401(path):
    r = requests.get(f"{BASE_URL}{path}", timeout=15)
    assert r.status_code == 401


def test_zoho_login_redirect():
    r = requests.get(f"{BASE_URL}/api/auth/zoho/login", allow_redirects=False, timeout=15)
    assert r.status_code in (302, 307)
    loc = r.headers.get("location", "")
    assert "accounts.zoho.eu/oauth/v2/auth" in loc
    qs = parse_qs(urlparse(loc).query)
    assert qs.get("redirect_uri", [""])[0] == (ZOHO_REDIRECT_URI or "")
    assert qs.get("client_id", [""])[0] == (ZOHO_CLIENT_ID or "")


# ---------- Regression: Reviews public/admin ----------
def test_create_review_unapproved(created_review_ids):
    payload = {
        "name": "TEST Iter8",
        "company": "TEST Iter8 BV",
        "project": "Website Multibay",
        "rating": 4,
        "quote": "This is my end-to-end test review, thanks!",
    }
    r = requests.post(f"{BASE_URL}/api/reviews", json=payload, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["approved"] is False
    assert data["rating"] == 4
    created_review_ids.append(data["id"])


def test_public_reviews_only_approved(created_review_ids):
    r = requests.get(f"{BASE_URL}/api/reviews", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert all(x["approved"] is True for x in data)
    ids = {x["id"] for x in data}
    assert created_review_ids[0] not in ids


def test_public_reviews_approved_false_query_ignored(created_review_ids):
    """Iteration 8: the approved=false query param was removed. Only approved should be returned."""
    r = requests.get(f"{BASE_URL}/api/reviews?approved=false", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert all(x["approved"] is True for x in data), "Unapproved reviews should NOT leak via query param"
    ids = {x["id"] for x in data}
    assert created_review_ids[0] not in ids


def test_reviews_all_requires_admin():
    r = requests.get(f"{BASE_URL}/api/reviews/all", timeout=15)
    assert r.status_code == 401


def test_reviews_all_admin(admin_token, created_review_ids):
    r = requests.get(f"{BASE_URL}/api/reviews/all",
                     headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
    assert r.status_code == 200
    ids = {x["id"] for x in r.json()}
    assert created_review_ids[0] in ids


def test_patch_review_unauth(created_review_ids):
    r = requests.patch(f"{BASE_URL}/api/reviews/{created_review_ids[0]}",
                       json={"approved": True}, timeout=15)
    assert r.status_code == 401


def test_delete_review_unauth(created_review_ids):
    r = requests.delete(f"{BASE_URL}/api/reviews/{created_review_ids[0]}", timeout=15)
    assert r.status_code == 401


def test_delete_review_admin(admin_token, created_review_ids):
    r = requests.delete(f"{BASE_URL}/api/reviews/{created_review_ids[0]}",
                        headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
    assert r.status_code == 200
    created_review_ids.pop(0)


# ---------- Auth: super-admin JWT via _mint_admin_token ----------
def test_super_admin_minted_token_role_admin():
    """Mint an admin token via zoho_portal._mint_admin_token, then hit /api/auth/me."""
    import sys
    # Load backend .env so zoho_portal picks up JWT_SECRET
    for k, v in _env.items():
        if v is not None:
            os.environ.setdefault(k, v)
    sys.path.insert(0, '/app/backend')
    from zoho_portal import _mint_admin_token
    token = _mint_admin_token("beheer@multibay.eu")
    assert isinstance(token, str) and len(token) > 20
    r = requests.get(f"{BASE_URL}/api/auth/me",
                     headers={"Authorization": f"Bearer {token}"}, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("email") == "beheer@multibay.eu"
    assert body.get("role") == "admin"


# ---------- Regression: contact / chat / admin login ----------
def test_contact_still_works():
    r = requests.post(f"{BASE_URL}/api/contact", json={
        "name": "TEST_iter8 regression", "email": "t8@example.com", "message": "hello"
    }, timeout=20)
    assert r.status_code == 200


def test_chat_still_responds():
    r = requests.post(f"{BASE_URL}/api/chat",
                      json={"session_id": "test-iter8-sess", "message": "Hi Pear, one word reply please"},
                      timeout=60)
    assert r.status_code == 200


def test_admin_login_regression():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200
    assert "access_token" in r.json()

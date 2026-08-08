"""Iteration 9 tests — bug fix (Zoho project link) + new endpoints + regression."""
import os
import time
import requests
import pytest
from dotenv import dotenv_values

_env = dotenv_values("/app/frontend/.env")
BASE_URL = (_env.get("REACT_APP_BACKEND_URL") or os.environ.get("REACT_APP_BACKEND_URL", "")).rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL must be set"
API = f"{BASE_URL}/api"

# Ensure backend env exports for in-process module import (share buttons test)
_b_env = dotenv_values("/app/backend/.env")
for k, v in _b_env.items():
    os.environ.setdefault(k, v)


# ------ Auth guards on NEW portal endpoints ------
class TestNewPortalAuthGuards:
    def test_project_detail_requires_auth(self):
        r = requests.get(f"{API}/portal/projects/341680000000084075")
        assert r.status_code == 401, r.text

    def test_invoice_detail_requires_auth(self):
        r = requests.get(f"{API}/portal/invoices/12345")
        assert r.status_code == 401, r.text

    def test_invoice_pdf_requires_auth(self):
        r = requests.get(f"{API}/portal/invoices/12345/pdf")
        assert r.status_code == 401, r.text


# ------ Regression on existing endpoints ------
class TestRegression:
    def test_health(self):
        r = requests.get(f"{API}/health")
        assert r.status_code == 200
        assert r.json().get("status") == "ok"

    def test_reviews_approved_only(self):
        r = requests.get(f"{API}/reviews")
        assert r.status_code == 200
        data = r.json()
        # Response may be list or dict-with-reviews
        items = data if isinstance(data, list) else data.get("reviews", [])
        for rv in items:
            assert rv.get("approved", True) is True, rv

    def test_trust_stats(self):
        r = requests.get(f"{API}/stats/trust")
        assert r.status_code == 200
        data = r.json()
        for k in ("reviews", "avg", "projects"):
            assert k in data, f"missing {k}"

    def test_scan_invites_requires_admin(self):
        r = requests.post(f"{API}/admin/reviews/scan-invites")
        assert r.status_code == 401, r.text

    def test_invoice_checkout_requires_portal(self):
        r = requests.post(
            f"{API}/payments/invoice-checkout",
            json={"invoice_id": "abc", "origin_url": "https://example.com"},
        )
        assert r.status_code == 401, r.text


# ------ Email HTML share buttons ------
class TestReviewInviteEmailShareButtons:
    def test_bilingual_invite_contains_share_buttons(self):
        # Import fresh so it picks env vars
        import importlib
        import review_invites  # from /app/backend on sys.path (pytest runs there)
        importlib.reload(review_invites)
        html = review_invites._bilingual_invite_html("Demo Project", "https://example.com/review?project=Demo")
        assert "Trustpilot" in html, "Trustpilot share button missing"
        assert "Facebook" in html, "Facebook share button missing"
        # Google URL is blank -> should not appear
        assert ">Google<" not in html


# ------ New: project seeded review roundtrip for compact strip (optional) ------
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(
        f"{API}/auth/login",
        json={"email": os.environ.get("ADMIN_EMAIL", "admin@pearblue.nl"),
              "password": os.environ.get("ADMIN_PASSWORD", "PearBlue2026!")},
    )
    if r.status_code != 200:
        pytest.skip(f"admin login failed: {r.status_code}")
    return r.json().get("access_token")


class TestFeaturedReviewSeed:
    def test_seed_featured_review_flow(self, admin_token):
        if not admin_token:
            pytest.skip("no admin token")
        # Create review via public endpoint
        payload = {
            "name": "TEST Iter9",
            "email": "test-iter9@example.com",
            "rating": 5,
            "message": "TEST Iter9 featured review",
            "quote": "TEST Iter9 featured review",
            "project": "TEST Iter9",
        }
        r = requests.post(f"{API}/reviews", json=payload)
        assert r.status_code in (200, 201), r.text
        rid = r.json().get("id") or r.json().get("_id")
        # Approve + feature via admin
        headers = {"Authorization": f"Bearer {admin_token}"}
        pr = requests.patch(f"{API}/reviews/{rid}", json={"approved": True, "featured": True}, headers=headers)
        assert pr.status_code in (200, 204), pr.text
        # Wait briefly and check public list contains it
        time.sleep(1)
        listing = requests.get(f"{API}/reviews").json()
        items = listing if isinstance(listing, list) else listing.get("reviews", [])
        assert any((it.get("id") or it.get("_id")) == rid for it in items), "seeded review not returned publicly"
        # Cleanup
        d = requests.delete(f"{API}/reviews/{rid}", headers=headers)
        assert d.status_code in (200, 204)

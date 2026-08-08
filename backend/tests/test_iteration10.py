"""Iteration 10 tests — i18n portal + tasks/milestones endpoints + all-three share buttons."""
import os
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
    if v is not None:
        os.environ[k] = v  # override, not setdefault, so share-buttons test picks up latest values


# ------ Auth guards on NEW portal endpoints (tasks + milestones) ------
class TestNewPortalAuthGuards:
    def test_project_tasks_requires_auth(self):
        r = requests.get(f"{API}/portal/projects/341680000000084075/tasks")
        assert r.status_code == 401, r.text

    def test_project_milestones_requires_auth(self):
        r = requests.get(f"{API}/portal/projects/341680000000084075/milestones")
        assert r.status_code == 401, r.text

    def test_project_detail_still_requires_auth(self):
        r = requests.get(f"{API}/portal/projects/341680000000084075")
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


# ------ Email HTML: ALL THREE share buttons now active ------
class TestAllThreeShareButtons:
    def test_bilingual_invite_contains_all_three_platforms(self):
        import sys
        sys.path.insert(0, "/app/backend")
        import importlib
        import review_invites
        importlib.reload(review_invites)
        # Sanity — env should carry the three URLs
        assert review_invites.GOOGLE_REVIEW_URL, "GOOGLE_REVIEW_URL not loaded from env"
        assert review_invites.TRUSTPILOT_REVIEW_URL, "TRUSTPILOT_REVIEW_URL not loaded"
        assert review_invites.FACEBOOK_PAGE_URL, "FACEBOOK_PAGE_URL not loaded"
        html = review_invites._bilingual_invite_html("Demo Project", "https://example.com/review?project=Demo")
        assert "g.page" in html, "Google (g.page) share link missing"
        assert "trustpilot.com/review/pearblue.nl" in html, "Trustpilot link missing"
        assert "facebook.com/pearbluenl" in html, "Facebook link missing"
        # Button labels
        assert ">Google<" in html
        assert ">Trustpilot<" in html
        assert ">Facebook<" in html

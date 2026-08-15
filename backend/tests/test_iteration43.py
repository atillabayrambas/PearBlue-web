"""Iteration 43 — CMS search, Books-autopilot weekly report, models split.

Verifies that (1) the models moved to /app/backend/models.py still round-trip
through the existing endpoints, (2) the new admin search endpoint returns
kind-tagged hits with target deep-links, and (3) the weekly report endpoint
returns the expected keys and clamps `days` to a safe range.
"""
import os
import requests

BASE = (os.environ.get("REACT_APP_BACKEND_URL")
        or open("/app/frontend/.env").read().strip().split("=", 1)[1])
API = f"{BASE.strip()}/api"

ADMIN_EMAIL = "admin@pearblue.nl"
ADMIN_PASS = "PearBlue2026!"


def _auth():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


class TestModelsSplitRegression:
    def test_reviews_endpoint_still_returns_list(self):
        # Review model now lives in /app/backend/models.py — endpoint must
        # still serialize items with the exact same schema.
        r = requests.get(f"{API}/reviews", timeout=15)
        assert r.status_code == 200
        for row in r.json():
            assert "id" in row and "name" in row and "rating" in row

    def test_projects_endpoint_still_returns_list(self):
        r = requests.get(f"{API}/projects", timeout=15)
        assert r.status_code == 200
        for row in r.json():
            assert "id" in row and "title" in row and "image_url" in row


class TestGlobalSearch:
    def test_search_short_query_returns_empty(self):
        r = requests.get(f"{API}/admin/search", params={"q": "a"}, headers=_auth(), timeout=15)
        assert r.status_code == 200
        assert r.json() == {"query": "a", "hits": []}

    def test_search_requires_auth(self):
        r = requests.get(f"{API}/admin/search", params={"q": "trust"}, timeout=15)
        assert r.status_code in (401, 403)

    def test_search_hits_have_required_shape(self):
        # "trust" matches at least the "Please verify your Trust Wallet" seed
        r = requests.get(f"{API}/admin/search", params={"q": "trust"}, headers=_auth(), timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body["query"] == "trust"
        hits = body["hits"]
        assert isinstance(hits, list)
        for h in hits:
            assert "kind" in h and h["kind"] in {"message", "portal", "review", "feedback"}
            assert "target" in h and h["target"].startswith("/admin/")
            assert "title" in h


class TestBooksAutopilotWeekly:
    def test_weekly_shape(self):
        r = requests.get(f"{API}/admin/reviews/books-autopilot-weekly", headers=_auth(), timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k in ("range_days", "invites_total", "invites_delivered", "invites_skipped",
                  "invites_errored", "delivery_rate", "per_day", "recent_errors", "last_run"):
            assert k in d, f"missing key {k}"
        assert isinstance(d["per_day"], list)
        assert isinstance(d["recent_errors"], list)

    def test_weekly_clamps_days(self):
        r = requests.get(f"{API}/admin/reviews/books-autopilot-weekly", params={"days": 9999}, headers=_auth(), timeout=15)
        assert r.status_code == 200
        assert r.json()["range_days"] == 90  # clamped to 90d max
        r2 = requests.get(f"{API}/admin/reviews/books-autopilot-weekly", params={"days": 0}, headers=_auth(), timeout=15)
        assert r2.status_code == 200
        assert r2.json()["range_days"] == 1  # clamped to 1d min

    def test_weekly_requires_auth(self):
        r = requests.get(f"{API}/admin/reviews/books-autopilot-weekly", timeout=15)
        assert r.status_code in (401, 403)

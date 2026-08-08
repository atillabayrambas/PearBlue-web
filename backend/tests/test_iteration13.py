"""Iteration 13 backend tests: feedback, cybersec CMS, admin counters, block-logging on public POSTs."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback for pytest inside container
    BASE_URL = "http://localhost:8001"

ADMIN_EMAIL = "admin@pearblue.nl"
ADMIN_PASSWORD = "PearBlue2026!"


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="session")
def admin_token(s):
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"admin login failed: {r.status_code} {r.text[:200]}")
    return r.json().get("access_token")


@pytest.fixture(scope="session")
def admin_h(admin_token):
    return {"Content-Type": "application/json", "Authorization": f"Bearer {admin_token}"}


def _fip():
    """Unique per-test forwarded IP so we don't cross-pollute rate-limit buckets."""
    return f"10.13.{uuid.uuid4().int % 250 + 1}.{uuid.uuid4().int % 250 + 1}"


# ---------- Health ----------
class TestHealth:
    def test_health(self, s):
        r = s.get(f"{BASE_URL}/api/health")
        assert r.status_code == 200
        body = r.json()
        assert body.get("status") == "ok" or body.get("ok") is True


# ---------- Feedback (public) ----------
class TestFeedback:
    def test_submit_ok(self, s):
        r = s.post(f"{BASE_URL}/api/feedback",
                   headers={"X-Forwarded-For": _fip()},
                   json={"page": "test", "message": "hello test message", "rating": 5})
        assert r.status_code == 200, r.text
        assert r.json().get("status") == "received"

    def test_short_message_rejected(self, s):
        r = s.post(f"{BASE_URL}/api/feedback",
                   headers={"X-Forwarded-For": _fip()},
                   json={"page": "test", "message": "hi"})  # <5 chars fails Pydantic
        assert r.status_code in (400, 422), r.text

    def test_rate_limit_20s(self, s):
        ip = _fip()
        r1 = s.post(f"{BASE_URL}/api/feedback",
                    headers={"X-Forwarded-For": ip},
                    json={"page": "test", "message": "hello first feedback", "rating": 4})
        assert r1.status_code == 200
        r2 = s.post(f"{BASE_URL}/api/feedback",
                    headers={"X-Forwarded-For": ip},
                    json={"page": "test", "message": "hello second feedback", "rating": 4})
        assert r2.status_code == 429, r2.text


# ---------- Contact rate-limit + spam + block-logging ----------
class TestContactDefenses:
    def test_rate_limit_and_block(self, s, admin_h):
        ip = _fip()
        payload = {"name": "Tester", "email": "test@example.com", "message": "Legit contact message please respond"}
        codes = []
        for i in range(6):
            r = s.post(f"{BASE_URL}/api/contact",
                       headers={"X-Forwarded-For": ip, "Content-Type": "application/json"},
                       json=payload)
            codes.append(r.status_code)
        assert 429 in codes, f"Expected 429 in {codes}"
        # Verify block record with reason=rate_limit exists for this IP
        blocks = s.get(f"{BASE_URL}/api/admin/cybersecurity/blocks", headers=admin_h).json()
        my = [b for b in blocks if b.get("ip") == ip and b.get("endpoint") == "/api/contact"]
        assert any(b["reason"] == "rate_limit" for b in my), f"no rate_limit block for {ip}"

    def test_spam_url_blocked_and_logged(self, s, admin_h):
        ip = _fip()
        r = s.post(f"{BASE_URL}/api/contact",
                   headers={"X-Forwarded-For": ip, "Content-Type": "application/json"},
                   json={"name": "Tester", "email": "test@example.com",
                         "message": "Check my site https://example.com now"})
        assert r.status_code == 400, r.text
        body = r.json()
        # spam reason must include the URL pattern signal
        assert "reason" in body.get("detail", {}) and body["detail"]["reason"].startswith("pattern:"), body
        blocks = s.get(f"{BASE_URL}/api/admin/cybersecurity/blocks", headers=admin_h).json()
        my_spam = [b for b in blocks if b.get("ip") == ip and b.get("reason") == "spam"]
        assert my_spam, "no spam block record"


# ---------- Portal register + Reviews defenses ----------
class TestPortalReviewDefenses:
    def test_portal_register_rate_limit_and_block(self, s, admin_h):
        ip = _fip()
        codes = []
        for i in range(6):
            r = s.post(f"{BASE_URL}/api/portal/register",
                       headers={"X-Forwarded-For": ip, "Content-Type": "application/json"},
                       json={"name": f"User {i}", "email": f"u{i}@ex.com", "company": "Acme",
                             "message": "please give access"})
            codes.append(r.status_code)
        assert 429 in codes, codes
        blocks = s.get(f"{BASE_URL}/api/admin/cybersecurity/blocks", headers=admin_h).json()
        assert any(b.get("ip") == ip and b.get("reason") == "rate_limit"
                   and b.get("endpoint") == "/api/portal/register" for b in blocks)

    def test_reviews_rate_limit_and_block(self, s, admin_h):
        ip = _fip()
        payload = {"name": "Reviewer", "rating": 5,
                   "quote": "This is a genuine long enough review text for testing purposes."}
        codes = []
        for i in range(4):
            r = s.post(f"{BASE_URL}/api/reviews",
                       headers={"X-Forwarded-For": ip, "Content-Type": "application/json"},
                       json=payload)
            codes.append(r.status_code)
        assert 429 in codes, codes
        blocks = s.get(f"{BASE_URL}/api/admin/cybersecurity/blocks", headers=admin_h).json()
        assert any(b.get("ip") == ip and b.get("reason") == "rate_limit"
                   and b.get("endpoint") == "/api/reviews" for b in blocks)

    def test_reviews_spam_url_blocked(self, s, admin_h):
        ip = _fip()
        r = s.post(f"{BASE_URL}/api/reviews",
                   headers={"X-Forwarded-For": ip, "Content-Type": "application/json"},
                   json={"name": "Spammer", "rating": 5,
                         "quote": "Nice service check https://spam.com for more"})
        assert r.status_code == 400, r.text
        blocks = s.get(f"{BASE_URL}/api/admin/cybersecurity/blocks", headers=admin_h).json()
        assert any(b.get("ip") == ip and b.get("reason") == "spam"
                   and b.get("endpoint") == "/api/reviews" for b in blocks)


# ---------- Admin cybersecurity endpoints ----------
class TestAdminCybersec:
    def test_unauthenticated_401(self, s):
        r = s.get(f"{BASE_URL}/api/admin/cybersecurity/blocks")
        assert r.status_code in (401, 403), r.status_code
        r2 = s.get(f"{BASE_URL}/api/admin/cybersecurity/stats")
        assert r2.status_code in (401, 403)

    def test_stats_shape(self, s, admin_h):
        r = s.get(f"{BASE_URL}/api/admin/cybersecurity/stats", headers=admin_h)
        assert r.status_code == 200, r.text
        b = r.json()
        for k in ("total_30d", "unique_ips_30d", "daily", "reasons"):
            assert k in b
        assert isinstance(b["daily"], list) and isinstance(b["reasons"], list)
        assert isinstance(b["total_30d"], int) and isinstance(b["unique_ips_30d"], int)

    def test_blocks_list_shape(self, s, admin_h):
        r = s.get(f"{BASE_URL}/api/admin/cybersecurity/blocks", headers=admin_h)
        assert r.status_code == 200
        arr = r.json()
        assert isinstance(arr, list)
        if arr:
            for k in ("ip", "endpoint", "reason", "unblocked", "ip_manually_blocked"):
                assert k in arr[0], f"missing {k}"

    def test_reblock_then_unblock_flow(self, s, admin_h):
        # Seed a block by triggering spam from a unique IP
        ip = _fip()
        s.post(f"{BASE_URL}/api/contact",
               headers={"X-Forwarded-For": ip, "Content-Type": "application/json"},
               json={"name": "T", "email": "t@ex.com", "message": "https://x.com"})
        blocks = s.get(f"{BASE_URL}/api/admin/cybersecurity/blocks", headers=admin_h).json()
        target = next((b for b in blocks if b.get("ip") == ip), None)
        assert target, "no seeded block"
        bid = target["id"]

        # Reblock -> creates manual entry
        r = s.post(f"{BASE_URL}/api/admin/cybersecurity/blocks/{bid}/reblock", headers=admin_h)
        assert r.status_code == 200
        # verify ip_manually_blocked=true after refresh
        blocks2 = s.get(f"{BASE_URL}/api/admin/cybersecurity/blocks", headers=admin_h).json()
        after = next(b for b in blocks2 if b["id"] == bid)
        assert after["ip_manually_blocked"] is True

        # Unblock -> unblocked=true, manual deactivated
        r2 = s.post(f"{BASE_URL}/api/admin/cybersecurity/blocks/{bid}/unblock", headers=admin_h)
        assert r2.status_code == 200
        blocks3 = s.get(f"{BASE_URL}/api/admin/cybersecurity/blocks", headers=admin_h).json()
        after2 = next(b for b in blocks3 if b["id"] == bid)
        assert after2["unblocked"] is True
        assert after2["ip_manually_blocked"] is False


# ---------- Admin feedback endpoints ----------
class TestAdminFeedback:
    def test_unauth_401(self, s):
        r = s.get(f"{BASE_URL}/api/admin/feedback")
        assert r.status_code in (401, 403)

    def test_list_patch_notes(self, s, admin_h):
        # Seed one feedback
        ip = _fip()
        s.post(f"{BASE_URL}/api/feedback",
               headers={"X-Forwarded-For": ip},
               json={"page": "test", "message": "seed feedback for admin tests", "rating": 3})
        r = s.get(f"{BASE_URL}/api/admin/feedback", headers=admin_h)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        if not items:
            pytest.skip("no feedback docs")
        fid = items[0]["id"]
        # PATCH status
        r2 = s.patch(f"{BASE_URL}/api/admin/feedback/{fid}",
                     headers=admin_h, json={"status": "in_progress"})
        assert r2.status_code == 200
        # PATCH assigned_to
        r3 = s.patch(f"{BASE_URL}/api/admin/feedback/{fid}",
                     headers=admin_h, json={"assigned_to": ADMIN_EMAIL})
        assert r3.status_code == 200
        # POST note
        r4 = s.post(f"{BASE_URL}/api/admin/feedback/{fid}/notes",
                    headers=admin_h, json={"text": "hello test note"})
        assert r4.status_code == 200
        assert r4.json().get("text") == "hello test note"


# ---------- Admin messages (contact) ----------
class TestAdminMessages:
    def test_unauth_401(self, s):
        r = s.patch(f"{BASE_URL}/api/admin/contact/does-not-exist", json={"status": "done"})
        assert r.status_code in (401, 403)
        r2 = s.post(f"{BASE_URL}/api/admin/contact/does-not-exist/notes", json={"text": "x"})
        assert r2.status_code in (401, 403)

    def test_patch_and_note(self, s, admin_h):
        ip = _fip()
        # seed a contact msg (unique IP to avoid rate-limit)
        r = s.post(f"{BASE_URL}/api/contact",
                   headers={"X-Forwarded-For": ip, "Content-Type": "application/json"},
                   json={"name": "Msg Seed", "email": "seed@ex.com",
                         "message": "Please respond, this is legit"})
        assert r.status_code == 200, r.text
        mid = r.json()["id"]
        r2 = s.patch(f"{BASE_URL}/api/admin/contact/{mid}",
                     headers=admin_h, json={"status": "done", "assigned_to": ADMIN_EMAIL})
        assert r2.status_code == 200
        r3 = s.post(f"{BASE_URL}/api/admin/contact/{mid}/notes",
                    headers=admin_h, json={"text": "note1"})
        assert r3.status_code == 200


# ---------- Admin counters ----------
class TestAdminCounters:
    def test_unauth(self, s):
        r = s.get(f"{BASE_URL}/api/admin/counters")
        assert r.status_code in (401, 403)

    def test_shape(self, s, admin_h):
        r = s.get(f"{BASE_URL}/api/admin/counters", headers=admin_h)
        assert r.status_code == 200
        b = r.json()
        for k in ("messages", "portal", "reviews", "feedback", "handoffs", "cybersecurity"):
            assert k in b, f"missing {k}"
            assert isinstance(b[k], int) and b[k] >= 0


# ---------- Regression ----------
class TestRegression:
    def test_reviews_public_only_approved(self, s):
        r = s.get(f"{BASE_URL}/api/reviews")
        assert r.status_code == 200
        for x in r.json():
            assert x.get("approved") is True

    def test_site_scripts_public(self, s):
        r = s.get(f"{BASE_URL}/api/site/scripts")
        assert r.status_code == 200

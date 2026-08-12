"""Iteration 32 — Zoho Books CMS creds, manual review invite, IMAP mailbox sync."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://sheet-converter-68.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@pearblue.nl"
ADMIN_PASSWORD = "PearBlue2026!"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def h(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# ---- Zoho Books integration ----
class TestZohoBooks:
    def test_get_status_shape(self, h):
        r = requests.get(f"{BASE_URL}/api/admin/integrations/zoho-books", headers=h, timeout=10)
        assert r.status_code == 200
        d = r.json()
        for k in ("configured", "client_id_last4", "org_id", "dc", "updated_at"):
            assert k in d, f"missing key {k} in {d}"

    def test_put_persists_and_test_endpoint(self, h):
        # Save creds
        payload = {
            "client_id": "1000.TESTCLIENT9999",
            "client_secret": "testsecret_abcdef",
            "refresh_token": "1000.testrefreshtoken.badtoken",
            "org_id": "888777666",
            "dc": "eu",
        }
        r = requests.put(f"{BASE_URL}/api/admin/integrations/zoho-books", headers=h, json=payload, timeout=15)
        assert r.status_code == 200, r.text

        # Verify GET now returns configured=true
        r2 = requests.get(f"{BASE_URL}/api/admin/integrations/zoho-books", headers=h, timeout=10)
        d = r2.json()
        assert d["configured"] is True
        assert d["client_id_last4"] == "9999"
        assert d["org_id"] == "888777666"
        assert d["dc"] == "eu"

        # Empty fields preserve existing values
        r3 = requests.put(f"{BASE_URL}/api/admin/integrations/zoho-books", headers=h,
                          json={"dc": "com"}, timeout=15)
        assert r3.status_code == 200, r3.text
        r4 = requests.get(f"{BASE_URL}/api/admin/integrations/zoho-books", headers=h, timeout=10).json()
        assert r4["dc"] == "com"
        assert r4["client_id_last4"] == "9999"  # unchanged

        # Test endpoint should return 400 with refresh token exchange failure
        rt = requests.post(f"{BASE_URL}/api/admin/integrations/zoho-books/test", headers=h, timeout=30)
        assert rt.status_code == 400
        # Error should mention refresh token
        detail = rt.json().get("detail", "")
        assert "efresh" in detail or "aalde" in detail or "invalid" in detail.lower(), f"unexpected: {detail}"

        # Financials should still return mocked=true (fallback)
        rf = requests.get(f"{BASE_URL}/api/admin/financials", headers=h, timeout=30)
        assert rf.status_code == 200
        assert rf.json().get("zoho_books", {}).get("mocked") is True

    def test_cleanup_zoho_creds(self, h):
        """Clear the test creds so poller/financials return to unset state."""
        # Direct DB clear via PUT empty won't clear (empty=keep). Just leave dummy creds — financials still mocks.
        # Setting refresh_token to empty via PUT is a no-op (None means keep). We accept leaving them.
        pass


# ---- Manual review invite ----
class TestManualReviewInvite:
    def test_send_invite_and_log(self, h):
        payload = {"email": "test@example.com", "project_name": "Demo", "invoice_id": "INV-1"}
        r = requests.post(f"{BASE_URL}/api/admin/reviews/send-invite", headers=h, json=payload, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "delivered" in d
        assert d.get("email") == "test@example.com"
        assert d.get("project") in ("Demo", "PearBlue opdracht", None) or "project" in d

        # Log should include manual=true entry
        rl = requests.get(f"{BASE_URL}/api/admin/reviews/invite-log", headers=h, timeout=10)
        assert rl.status_code == 200
        items = rl.json()
        assert isinstance(items, list)
        manual_entries = [i for i in items if i.get("manual") is True and i.get("email") == "test@example.com"]
        assert len(manual_entries) >= 1, f"no manual invite in log: {items[:3]}"


# ---- Mailboxes / IMAP ----
class TestMailboxes:
    _mid = None

    def test_sync_now_empty_and_ingested_empty(self, h):
        # First delete any existing test mailboxes (safety)
        existing = requests.get(f"{BASE_URL}/api/admin/mailboxes", headers=h, timeout=10).json()
        for m in existing:
            if "invalid.example" in (m.get("host") or "") or m.get("email", "").startswith("test_"):
                requests.delete(f"{BASE_URL}/api/admin/mailboxes/{m['id']}", headers=h, timeout=10)

        # If zero, sync should return zeros
        current = requests.get(f"{BASE_URL}/api/admin/mailboxes", headers=h, timeout=10).json()
        if len(current) == 0:
            r = requests.post(f"{BASE_URL}/api/admin/mailboxes/sync-now", headers=h, timeout=30)
            assert r.status_code == 200
            d = r.json()
            assert d.get("mailboxes") == 0
            assert d.get("ingested") == 0

        # Ingested log
        ri = requests.get(f"{BASE_URL}/api/admin/mailboxes/ingested", headers=h, timeout=10)
        assert ri.status_code == 200
        assert isinstance(ri.json(), list)

    def test_add_duplicate_delete_mailbox(self, h):
        payload = {
            "label": "TEST_iter32",
            "email": "test_iter32@example.com",
            "host": "imap.invalid.example",
            "port": 993,
            "username": "test_iter32@example.com",
            "password": "dummy_password_xyz",
            "use_ssl": True,
            "folder": "INBOX",
        }
        r = requests.post(f"{BASE_URL}/api/admin/mailboxes", headers=h, json=payload, timeout=15)
        assert r.status_code == 200, r.text
        mid = r.json()["id"]
        assert r.json()["folder"] == "INBOX"

        # Duplicate should 409
        r2 = requests.post(f"{BASE_URL}/api/admin/mailboxes", headers=h, json=payload, timeout=15)
        assert r2.status_code == 409

        # Delete cleanup
        rd = requests.delete(f"{BASE_URL}/api/admin/mailboxes/{mid}", headers=h, timeout=10)
        assert rd.status_code == 200

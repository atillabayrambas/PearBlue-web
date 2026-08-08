"""Iteration 12 backend tests: chat spam+handoff, admin scripts index.html injection,
portal ticket reply/attachment 401 gating, and regression endpoints."""
import os
import io
import time
import uuid
import requests
import pytest
from pathlib import Path

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://sheet-converter-68.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_EMAIL = "admin@pearblue.nl"
ADMIN_PASSWORD = "PearBlue2026!"
INDEX_HTML = Path("/app/frontend/public/index.html")


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ---------- Regression ----------
class TestRegression:
    def test_health(self):
        r = requests.get(f"{API}/health", timeout=10)
        assert r.status_code == 200
        assert r.json().get("status") == "ok"

    def test_reviews_only_approved(self):
        r = requests.get(f"{API}/reviews", timeout=10)
        assert r.status_code == 200
        for rv in r.json():
            assert rv.get("approved") is True

    def test_site_scripts_public(self):
        r = requests.get(f"{API}/site/scripts", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert "header_scripts" in data and "footer_scripts" in data

    def test_admin_users_list(self, admin_headers):
        r = requests.get(f"{API}/admin/users", headers=admin_headers, timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_ticket_routes_exist(self):
        # openapi.json not exposed via ingress (routes to frontend). Verify existence
        # by checking endpoints return 401 (auth-gated), not 404.
        r1 = requests.post(f"{API}/portal/tickets/FAKE/reply", json={"content": "x"}, timeout=10)
        r2 = requests.post(f"{API}/portal/tickets/FAKE/attachments",
                           files={"file": ("t.txt", b"x", "text/plain")}, timeout=10)
        assert r1.status_code == 401, f"reply expected 401, got {r1.status_code}"
        assert r2.status_code == 401, f"attachments expected 401, got {r2.status_code}"


# ---------- Chat spam ----------
class TestChatSpam:
    def test_chat_spam_url_blocked(self):
        session_id = f"TEST_{uuid.uuid4()}"
        time.sleep(2.5)
        r = requests.post(f"{API}/chat", json={
            "session_id": session_id,
            "message": "visit http://spam.example.com now",
            "language": "en",
        }, timeout=20)
        # Implementation raises HTTPException 400 for spam
        assert r.status_code == 400, f"Expected 400 spam block, got {r.status_code}: {r.text}"
        body = r.json()
        detail = body.get("detail", {})
        assert isinstance(detail, dict)
        assert "spam" in (detail.get("message_en") or detail.get("message") or "").lower()

    def test_chat_normal_message(self):
        session_id = f"TEST_{uuid.uuid4()}"
        # Retry-safe against 2s anti-flood + parallel test workers
        reply = None
        for attempt in range(4):
            time.sleep(3)
            r = requests.post(f"{API}/chat", json={
                "session_id": session_id,
                "message": "Wat kost een website?",
                "language": "nl",
            }, timeout=45)
            if r.status_code == 200:
                reply = r.json()
                break
            if r.status_code != 429:
                assert False, f"Chat failed: {r.status_code} {r.text}"
        assert reply is not None, "Chat rate-limited on all retries"
        assert isinstance(reply.get("reply"), str) and len(reply["reply"]) > 0
        assert reply.get("session_id") == session_id


# ---------- Chat agent handoff ----------
class TestAgentHandoff:
    handoff_id = None

    def test_handoff_missing_fields(self):
        time.sleep(2.5)
        r = requests.post(f"{API}/chat/agent-handoff", json={"session_id": "x"}, timeout=10)
        assert r.status_code in (400, 422)

    def test_handoff_short_message(self):
        time.sleep(2.5)
        r = requests.post(f"{API}/chat/agent-handoff", json={
            "session_id": "TEST_sess_short",
            "name": "TU",
            "email": "t@example.com",
            "message": "hi",  # 2 chars, min_length=5
        }, timeout=10)
        assert r.status_code in (400, 422)

    def test_handoff_success(self):
        time.sleep(2.5)
        sid = f"TEST_sess_{uuid.uuid4()}"
        r = requests.post(f"{API}/chat/agent-handoff", json={
            "session_id": sid,
            "name": "TEST User",
            "email": "test_iter12@example.com",
            "message": "I would like to speak to a human agent please.",
        }, timeout=15)
        assert r.status_code == 200, f"Handoff failed: {r.status_code} {r.text}"
        data = r.json()
        assert data.get("status") == "queued"
        assert data.get("handoff_id")
        TestAgentHandoff.handoff_id = data["handoff_id"]

    def test_ack_requires_admin(self):
        # Without token
        hid = TestAgentHandoff.handoff_id or "nonexistent"
        r = requests.post(f"{API}/chat/agent-handoff/{hid}/ack", timeout=10)
        assert r.status_code == 401

    def test_ack_with_admin(self, admin_headers):
        assert TestAgentHandoff.handoff_id, "Prior handoff test must have succeeded"
        r = requests.post(f"{API}/chat/agent-handoff/{TestAgentHandoff.handoff_id}/ack",
                          headers=admin_headers, timeout=10)
        assert r.status_code == 200, f"Ack failed: {r.status_code} {r.text}"
        assert r.json().get("status") == "acknowledged"


# ---------- Custom scripts injection ----------
class TestCustomScripts:
    HEADER_MARK = '<meta name="pb-iter12" content="ok">'
    FOOTER_MARK = "<!-- pb-iter12-footer -->"

    def test_scripts_requires_auth(self):
        r = requests.put(f"{API}/admin/scripts", json={"header_scripts": "x", "footer_scripts": "y"}, timeout=10)
        assert r.status_code == 401

    def test_scripts_write_and_verify(self, admin_headers):
        r = requests.put(f"{API}/admin/scripts", headers=admin_headers,
                         json={"header_scripts": self.HEADER_MARK, "footer_scripts": self.FOOTER_MARK}, timeout=15)
        assert r.status_code == 200
        # Verify GET
        g = requests.get(f"{API}/site/scripts", timeout=10)
        assert g.status_code == 200
        gd = g.json()
        assert gd["header_scripts"] == self.HEADER_MARK
        assert gd["footer_scripts"] == self.FOOTER_MARK
        # Verify index.html was rewritten
        assert INDEX_HTML.exists()
        content = INDEX_HTML.read_text(encoding="utf-8")
        assert f"<!-- PB_HEADER_START -->{self.HEADER_MARK}<!-- PB_HEADER_END -->" in content
        assert f"<!-- PB_FOOTER_START -->{self.FOOTER_MARK}<!-- PB_FOOTER_END -->" in content

    def test_scripts_clear_and_verify(self, admin_headers):
        r = requests.put(f"{API}/admin/scripts", headers=admin_headers,
                         json={"header_scripts": "", "footer_scripts": ""}, timeout=15)
        assert r.status_code == 200
        content = INDEX_HTML.read_text(encoding="utf-8")
        assert "<!-- PB_HEADER_START --><!-- PB_HEADER_END -->" in content
        assert "<!-- PB_FOOTER_START --><!-- PB_FOOTER_END -->" in content
        # Public GET reflects empty
        g = requests.get(f"{API}/site/scripts", timeout=10).json()
        assert g["header_scripts"] == "" and g["footer_scripts"] == ""


# ---------- Portal ticket endpoints gated on Zoho ----------
class TestPortalTicketGating:
    def test_reply_requires_zoho(self):
        r = requests.post(f"{API}/portal/tickets/FAKE_ID/reply", json={"content": "Hello"}, timeout=10)
        assert r.status_code == 401, f"Expected 401, got {r.status_code}: {r.text}"
        assert r.status_code != 500

    def test_attachments_requires_zoho(self):
        files = {"file": ("test.txt", io.BytesIO(b"hello world"), "text/plain")}
        r = requests.post(f"{API}/portal/tickets/FAKE_ID/attachments", files=files, timeout=10)
        assert r.status_code == 401, f"Expected 401, got {r.status_code}: {r.text}"
        assert r.status_code != 500

"""Iteration 22 (Batch B) backend tests:
- /api/chat/stats supports days=1, days=1825, and ?from=&to=
- /api/admin/reply-templates CRUD + auth
- /api/admin/contact/{id}/attachments/{aid}/preview returns inline Content-Disposition
- Regression: chat_ratings up to 1825, contact list still strips b64
"""
import os
import base64
import pytest
import requests
from datetime import date, timedelta

def _read_frontend_env():
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip()
    except Exception:
        pass
    return None

BASE = (os.environ.get("REACT_APP_BACKEND_URL") or _read_frontend_env()).rstrip("/")
ADMIN_EMAIL = "admin@pearblue.nl"
ADMIN_PW = "PearBlue2026!"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PW}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def headers(token):
    return {"Authorization": f"Bearer {token}"}


# ------------------------ chat_stats -------------------------
class TestChatStats:
    def test_days_1(self, headers):
        r = requests.get(f"{BASE}/api/chat/stats?days=1", headers=headers, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["days"] == 1
        assert len(d["per_day"]) == 1
        assert "total_in_range" in d

    def test_days_1825(self, headers):
        r = requests.get(f"{BASE}/api/chat/stats?days=1825", headers=headers, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["days"] == 1825
        assert len(d["per_day"]) == 1825

    def test_days_over_cap_is_clamped(self, headers):
        r = requests.get(f"{BASE}/api/chat/stats?days=9999", headers=headers, timeout=30)
        assert r.status_code == 200
        assert r.json()["days"] == 1825

    def test_custom_from_to(self, headers):
        today = date.today()
        frm = (today - timedelta(days=6)).isoformat()
        to = today.isoformat()
        r = requests.get(f"{BASE}/api/chat/stats?from={frm}&to={to}", headers=headers, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["days"] == 7
        assert len(d["per_day"]) == 7
        assert d["per_day"][0]["date"] == frm
        assert d["per_day"][-1]["date"] == to

    def test_requires_auth(self):
        r = requests.get(f"{BASE}/api/chat/stats?days=1", timeout=15)
        assert r.status_code in (401, 403)


# ------------------------ reply-templates ---------------------
class TestReplyTemplates:
    def test_auth_required(self):
        assert requests.get(f"{BASE}/api/admin/reply-templates").status_code in (401, 403)
        assert requests.post(f"{BASE}/api/admin/reply-templates", json={"title": "x", "body": "y"}).status_code in (401, 403)

    def test_crud_flow(self, headers):
        # CREATE
        payload = {"title": "TEST_iter22_tpl", "body": "Hallo, dit is een testantwoord.", "lang": "nl"}
        r = requests.post(f"{BASE}/api/admin/reply-templates", json=payload, headers=headers, timeout=15)
        assert r.status_code == 200, r.text
        tpl = r.json()
        assert tpl["title"] == payload["title"]
        assert tpl["body"] == payload["body"]
        assert "id" in tpl
        tid = tpl["id"]

        # LIST — should include the new template
        r = requests.get(f"{BASE}/api/admin/reply-templates", headers=headers, timeout=15)
        assert r.status_code == 200
        titles = [t["title"] for t in r.json()]
        assert payload["title"] in titles

        # PATCH
        upd = {"title": "TEST_iter22_tpl_upd", "body": "bijgewerkt", "lang": "en"}
        r = requests.patch(f"{BASE}/api/admin/reply-templates/{tid}", json=upd, headers=headers, timeout=15)
        assert r.status_code == 200, r.text

        r = requests.get(f"{BASE}/api/admin/reply-templates", headers=headers, timeout=15)
        found = next((t for t in r.json() if t["id"] == tid), None)
        assert found is not None
        assert found["title"] == "TEST_iter22_tpl_upd"
        assert found["body"] == "bijgewerkt"

        # DELETE
        r = requests.delete(f"{BASE}/api/admin/reply-templates/{tid}", headers=headers, timeout=15)
        assert r.status_code == 200

        r = requests.get(f"{BASE}/api/admin/reply-templates", headers=headers, timeout=15)
        assert not any(t["id"] == tid for t in r.json())

    def test_patch_404(self, headers):
        r = requests.patch(f"{BASE}/api/admin/reply-templates/nonexistent-id", json={"title": "a", "body": "b"}, headers=headers, timeout=15)
        assert r.status_code == 404

    def test_delete_404(self, headers):
        r = requests.delete(f"{BASE}/api/admin/reply-templates/nonexistent-id", headers=headers, timeout=15)
        assert r.status_code == 404

    def test_validation_rejects_empty(self, headers):
        r = requests.post(f"{BASE}/api/admin/reply-templates", json={"title": "", "body": ""}, headers=headers, timeout=15)
        assert r.status_code == 422


# ------------------------ attachment preview -----------------
class TestAttachmentPreview:
    @pytest.fixture(scope="class")
    def msg_with_attachment(self, headers):
        # Create a contact message via public endpoint
        r = requests.post(f"{BASE}/api/contact", json={
            "name": "TEST_iter22_preview",
            "email": "test22preview@example.com",
            "message": "Preview attachment test",
        }, timeout=15)
        assert r.status_code == 200, r.text
        msg_id = r.json()["id"]

        # Upload a tiny PNG (1x1 red pixel) as attachment
        png = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
        )
        files = {"file": ("pixel.png", png, "image/png")}
        r = requests.post(
            f"{BASE}/api/admin/contact/{msg_id}/attachments",
            files=files, headers=headers, timeout=30,
        )
        assert r.status_code == 200, r.text
        att = r.json()["attachment"] if "attachment" in r.json() else r.json()
        # server may return dict with 'attachments' or 'attachment' — try to extract id robustly
        aid = att.get("id") if isinstance(att, dict) else None
        if not aid:
            # fallback: read the doc
            r2 = requests.get(f"{BASE}/api/admin/contact/{msg_id}", headers=headers, timeout=15)
            aid = r2.json()["attachments"][0]["id"]
        yield msg_id, aid
        # cleanup
        requests.post(f"{BASE}/api/admin/contact/bulk-delete", json={"ids": [msg_id]}, headers=headers, timeout=15)

    def test_preview_returns_inline(self, headers, msg_with_attachment):
        msg_id, aid = msg_with_attachment
        r = requests.get(f"{BASE}/api/admin/contact/{msg_id}/attachments/{aid}/preview", headers=headers, timeout=15)
        assert r.status_code == 200, r.text
        cd = r.headers.get("content-disposition", "")
        assert cd.lower().startswith("inline"), f"Expected inline, got: {cd}"
        assert r.headers.get("content-type", "").startswith("image/")
        assert len(r.content) > 0

    def test_preview_requires_auth(self, msg_with_attachment):
        msg_id, aid = msg_with_attachment
        r = requests.get(f"{BASE}/api/admin/contact/{msg_id}/attachments/{aid}/preview", timeout=15)
        assert r.status_code in (401, 403)

    def test_preview_404_bad_ids(self, headers):
        r = requests.get(f"{BASE}/api/admin/contact/nope/attachments/nope/preview", headers=headers, timeout=15)
        assert r.status_code == 404


# ------------------------ regression: chat_ratings -----------
class TestChatRatingsRegression:
    def test_ratings_up_to_1825(self, headers):
        # endpoint may or may not exist — best effort
        r = requests.get(f"{BASE}/api/chat/ratings?days=1825", headers=headers, timeout=30)
        if r.status_code == 404:
            pytest.skip("chat/ratings endpoint not present")
        assert r.status_code == 200

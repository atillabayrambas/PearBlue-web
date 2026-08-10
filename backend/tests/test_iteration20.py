"""Iteration 20 — Ticket Threads CMS backend tests.

Covers:
- GET /api/admin/contact/{id} single-message detail
- POST /api/admin/contact/{id}/reply (email_sent flag + status transitions)
- POST /api/admin/contact/{id}/attachments (multipart upload, 20MB limit)
- GET /api/admin/contact/{id}/attachments/{aid} (binary + Content-Disposition)
- DELETE /api/admin/contact/{id}/attachments/{aid}
- Regression: POST /api/admin/contact/{id}/notes on legacy doc (notes=null)
- Regression: GET /api/contact strips base64 payloads
- Auth: unauthenticated requests are rejected (401/403)
"""
import io
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://sheet-converter-68.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@pearblue.nl"
ADMIN_PASSWORD = "PearBlue2026!"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def created_msg_id(admin_headers):
    """Create a fresh contact message via public endpoint; clean up after module."""
    stamp = int(time.time())
    payload = {
        "name": f"TEST_iter20_{stamp}",
        "email": f"test_iter20_{stamp}@example.com",
        "subject": "TEST_iter20 subject",
        "message": "Automated ticket-threads CMS test message.",
    }
    r = requests.post(f"{BASE_URL}/api/contact", json=payload, timeout=30)
    assert r.status_code == 200, f"contact create failed: {r.text}"
    data = r.json()
    assert "id" in data
    yield data["id"]
    # cleanup
    try:
        requests.post(f"{BASE_URL}/api/admin/contact/bulk-delete", headers=admin_headers, json={"ids": [data["id"]]}, timeout=30)
    except Exception:
        pass


# --------- auth guard tests ---------

class TestAuthGuards:
    def test_get_thread_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/admin/contact/fake-id", timeout=15)
        assert r.status_code in (401, 403), r.status_code

    def test_reply_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/admin/contact/fake-id/reply", json={"body": "x"}, timeout=15)
        assert r.status_code in (401, 403), r.status_code

    def test_upload_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/admin/contact/fake-id/attachments", files={"file": ("a.txt", b"hi")}, timeout=15)
        assert r.status_code in (401, 403), r.status_code

    def test_download_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/admin/contact/fake-id/attachments/fake-aid", timeout=15)
        assert r.status_code in (401, 403), r.status_code

    def test_delete_attach_requires_auth(self):
        r = requests.delete(f"{BASE_URL}/api/admin/contact/fake-id/attachments/fake-aid", timeout=15)
        assert r.status_code in (401, 403), r.status_code


# --------- CMS thread tests ---------

class TestTicketThreadCMS:
    def test_get_thread_detail(self, admin_headers, created_msg_id):
        r = requests.get(f"{BASE_URL}/api/admin/contact/{created_msg_id}", headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["id"] == created_msg_id
        assert d["name"].startswith("TEST_iter20_")
        assert "email" in d and "subject" in d and "message" in d

    def test_get_thread_404(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/contact/{uuid.uuid4()}", headers=admin_headers, timeout=15)
        assert r.status_code == 404

    def test_reply_creates_reply_and_status_in_progress(self, admin_headers, created_msg_id):
        r = requests.post(
            f"{BASE_URL}/api/admin/contact/{created_msg_id}/reply",
            headers=admin_headers,
            json={"body": "Hello from test", "send_email": False},
            timeout=45,
        )
        assert r.status_code == 200, r.text
        reply = r.json()
        assert reply["direction"] == "out"
        assert reply["body"] == "Hello from test"
        assert reply["email_sent"] is False
        assert "id" in reply and "at" in reply
        # verify status change and reply persisted
        r2 = requests.get(f"{BASE_URL}/api/admin/contact/{created_msg_id}", headers=admin_headers, timeout=15)
        d = r2.json()
        assert d.get("status") == "in_progress"
        replies = d.get("replies") or []
        assert any(rp["id"] == reply["id"] for rp in replies)

    def test_reply_preserves_done_status(self, admin_headers, created_msg_id):
        # set status=done
        rp = requests.patch(f"{BASE_URL}/api/admin/contact/{created_msg_id}", headers=admin_headers, json={"status": "done"}, timeout=15)
        assert rp.status_code == 200
        # send another reply
        r = requests.post(
            f"{BASE_URL}/api/admin/contact/{created_msg_id}/reply",
            headers=admin_headers,
            json={"body": "second reply", "send_email": False},
            timeout=30,
        )
        assert r.status_code == 200
        d = requests.get(f"{BASE_URL}/api/admin/contact/{created_msg_id}", headers=admin_headers, timeout=15).json()
        assert d.get("status") == "done", "reply must not overwrite done status"
        # restore for further tests
        requests.patch(f"{BASE_URL}/api/admin/contact/{created_msg_id}", headers=admin_headers, json={"status": "in_progress"}, timeout=15)

    def test_upload_download_delete_attachment(self, admin_headers, created_msg_id):
        payload_bytes = b"Hello Attachment " + os.urandom(64)
        files = {"file": ("test_iter20.bin", io.BytesIO(payload_bytes), "application/octet-stream")}
        r = requests.post(
            f"{BASE_URL}/api/admin/contact/{created_msg_id}/attachments",
            headers=admin_headers,
            files=files,
            timeout=45,
        )
        assert r.status_code == 200, r.text
        meta = r.json()
        assert "id" in meta and meta["name"] == "test_iter20.bin" and meta["size"] == len(payload_bytes)
        assert "data_b64" not in meta, "response must not leak base64 payload"
        aid = meta["id"]

        # thread listing should show attachment metadata without data_b64
        thread = requests.get(f"{BASE_URL}/api/admin/contact/{created_msg_id}", headers=admin_headers, timeout=15).json()
        atts = thread.get("attachments") or []
        assert any(a["id"] == aid for a in atts)
        assert all("data_b64" not in a for a in atts), "GET thread must strip base64 payloads"

        # download binary
        rd = requests.get(f"{BASE_URL}/api/admin/contact/{created_msg_id}/attachments/{aid}", headers=admin_headers, timeout=30)
        assert rd.status_code == 200
        assert rd.content == payload_bytes
        cd = rd.headers.get("content-disposition", "")
        assert "attachment" in cd.lower() and "test_iter20.bin" in cd

        # delete
        rdel = requests.delete(f"{BASE_URL}/api/admin/contact/{created_msg_id}/attachments/{aid}", headers=admin_headers, timeout=15)
        assert rdel.status_code == 200
        # verify gone
        thread2 = requests.get(f"{BASE_URL}/api/admin/contact/{created_msg_id}", headers=admin_headers, timeout=15).json()
        atts2 = thread2.get("attachments") or []
        assert not any(a["id"] == aid for a in atts2)

    def test_add_note_regression(self, admin_headers, created_msg_id):
        r = requests.post(
            f"{BASE_URL}/api/admin/contact/{created_msg_id}/notes",
            headers=admin_headers,
            json={"text": "TEST_iter20 internal note"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        note = r.json()
        assert note["text"] == "TEST_iter20 internal note"
        thread = requests.get(f"{BASE_URL}/api/admin/contact/{created_msg_id}", headers=admin_headers, timeout=15).json()
        notes = thread.get("notes") or []
        assert any(n["id"] == note["id"] for n in notes)

    def test_list_contact_strips_base64(self, admin_headers, created_msg_id):
        # upload an attachment first
        files = {"file": ("strip.bin", b"x" * 128, "application/octet-stream")}
        r = requests.post(f"{BASE_URL}/api/admin/contact/{created_msg_id}/attachments", headers=admin_headers, files=files, timeout=30)
        assert r.status_code == 200
        aid = r.json()["id"]
        try:
            lst = requests.get(f"{BASE_URL}/api/contact", headers=admin_headers, timeout=30).json()
            hit = next((m for m in lst if m.get("id") == created_msg_id), None)
            assert hit is not None
            atts = hit.get("attachments") or []
            assert any(a.get("id") == aid for a in atts)
            assert all("data_b64" not in a for a in atts)
        finally:
            requests.delete(f"{BASE_URL}/api/admin/contact/{created_msg_id}/attachments/{aid}", headers=admin_headers, timeout=15)

    def test_reply_invalid_body_rejected(self, admin_headers, created_msg_id):
        r = requests.post(
            f"{BASE_URL}/api/admin/contact/{created_msg_id}/reply",
            headers=admin_headers,
            json={"body": ""},
            timeout=15,
        )
        assert r.status_code in (400, 422)

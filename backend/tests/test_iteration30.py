"""Iteration 30 tests: maintenance snapshot fields + portal documents CRUD."""
import os
import io
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://sheet-converter-68.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@pearblue.nl"
ADMIN_PASS = "PearBlue2026!"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ---- Maintenance snapshot ----
def test_public_maintenance_shape():
    r = requests.get(f"{API}/site/maintenance", timeout=10)
    assert r.status_code == 200
    d = r.json()
    for k in ("site_status", "site_status_lang", "maintenance_bg_mode", "maintenance_bg_url", "version"):
        assert k in d, f"missing key {k}"
    assert d["site_status"] in ("live", "maintenance", "coming_soon")


def test_settings_put_persists_new_fields(auth_headers):
    # Get current settings first
    cur = requests.get(f"{API}/settings", timeout=10).json()
    payload = dict(cur)
    payload.update({
        "site_status": "maintenance",
        "site_status_lang": "en",
        "maintenance_bg_mode": "custom",
    })
    # Remove any _id-ish fields
    payload.pop("_id", None)
    r = requests.put(f"{API}/settings", json=payload, headers=auth_headers, timeout=15)
    assert r.status_code == 200, r.text

    snap = requests.get(f"{API}/site/maintenance", timeout=10).json()
    assert snap["site_status"] == "maintenance"
    assert snap["site_status_lang"] == "en"
    assert snap["maintenance_bg_mode"] == "custom"

    # Restore live
    payload.update({"site_status": "live", "site_status_lang": "auto", "maintenance_bg_mode": "dynamic"})
    r2 = requests.put(f"{API}/settings", json=payload, headers=auth_headers, timeout=15)
    assert r2.status_code == 200
    snap2 = requests.get(f"{API}/site/maintenance", timeout=10).json()
    assert snap2["site_status"] == "live"


# ---- Portal documents (admin CRUD) ----
TEST_USER_EMAIL = "test_docs_user@example.com"


def test_portal_documents_admin_flow(auth_headers):
    # Upload
    files = {"file": ("TEST_hello.txt", io.BytesIO(b"hello world from iter30"), "text/plain")}
    params = {"user_email": TEST_USER_EMAIL, "doc_type": "contract", "label": "TEST_Contract"}
    up = requests.post(f"{API}/admin/portal/documents", params=params, files=files, headers=auth_headers, timeout=15)
    assert up.status_code == 200, up.text
    ud = up.json()
    assert "id" in ud and "filename" in ud and "size" in ud
    assert ud["filename"] == "TEST_hello.txt"
    assert ud["size"] > 0
    doc_id = ud["id"]

    # List
    ls = requests.get(f"{API}/admin/portal/documents", params={"user_email": TEST_USER_EMAIL}, headers=auth_headers, timeout=10)
    assert ls.status_code == 200
    docs = ls.json()["documents"]
    assert any(d["id"] == doc_id for d in docs)
    # Ensure content_base64 not included
    for d in docs:
        assert "content_base64" not in d

    # Delete
    dl = requests.delete(f"{API}/admin/portal/documents/{doc_id}", headers=auth_headers, timeout=10)
    assert dl.status_code == 200
    assert dl.json().get("deleted") is True

    # Verify gone
    ls2 = requests.get(f"{API}/admin/portal/documents", params={"user_email": TEST_USER_EMAIL}, headers=auth_headers, timeout=10)
    assert not any(d["id"] == doc_id for d in ls2.json()["documents"])


def test_portal_documents_requires_portal_session():
    r = requests.get(f"{API}/portal/documents", timeout=10)
    assert r.status_code == 401
    body = r.json()
    msg = body.get("detail") or body.get("message") or ""
    assert "portal" in str(msg).lower() or "not signed in" in str(msg).lower()


def test_admin_portal_documents_requires_auth():
    r = requests.get(f"{API}/admin/portal/documents", timeout=10)
    assert r.status_code in (401, 403)

"""Iteration 6 tests: portal registration workflow + admin approval + email notifications."""
import os
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://sheet-converter-68.preview.emergentagent.com').rstrip('/')
ADMIN_EMAIL = "admin@pearblue.nl"
ADMIN_PASSWORD = "PearBlue2026!"

# Try to read backend env for cleanup
try:
    from dotenv import dotenv_values
    _env = dotenv_values('/app/backend/.env')
    MONGO_URL = _env.get('MONGO_URL')
    DB_NAME = _env.get('DB_NAME')
except Exception:
    MONGO_URL = None
    DB_NAME = None


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def created_ids():
    ids = []
    yield ids
    # cleanup
    if MONGO_URL and DB_NAME and ids:
        try:
            cli = MongoClient(MONGO_URL)
            cli[DB_NAME].portal_registrations.delete_many({"id": {"$in": ids}})
            cli.close()
        except Exception as e:
            print(f"cleanup failed: {e}")


# ---------- Portal registration (public POST) ----------
def test_register_public_success(created_ids):
    payload = {
        "name": "TEST_Iter6 Klant",
        "email": "test_iter6_klant@example.com",
        "company": "TEST Iter6 BV",
        "phone": "+31 000000000",
        "message": "Graag toegang tot het portaal a.u.b.",
        "language": "nl",
    }
    r = requests.post(f"{BASE_URL}/api/portal/register", json=payload, timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["status"] == "pending"
    assert data["email"] == payload["email"]
    assert data["name"] == payload["name"]
    assert data["company"] == payload["company"]
    assert "id" in data
    created_ids.append(data["id"])


def test_register_missing_email_422():
    r = requests.post(f"{BASE_URL}/api/portal/register",
                      json={"name": "TEST no email", "company": "x"}, timeout=15)
    assert r.status_code == 422, r.text


# ---------- Admin list ----------
def test_list_registrations_unauth_401():
    r = requests.get(f"{BASE_URL}/api/portal/registrations", timeout=15)
    assert r.status_code == 401


def test_list_registrations_admin(admin_token, created_ids):
    assert created_ids, "no registration created in test_register_public_success"
    r = requests.get(f"{BASE_URL}/api/portal/registrations",
                     headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    ids = {i["id"] for i in data}
    assert created_ids[0] in ids


def test_list_registrations_filter_pending(admin_token, created_ids):
    r = requests.get(f"{BASE_URL}/api/portal/registrations?status=pending",
                     headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert all(i["status"] == "pending" for i in data)
    ids = {i["id"] for i in data}
    assert created_ids[0] in ids


# ---------- Admin PATCH ----------
def test_patch_unauth_401(created_ids):
    r = requests.patch(f"{BASE_URL}/api/portal/registrations/{created_ids[0]}",
                       json={"status": "approved"}, timeout=15)
    assert r.status_code == 401


def test_patch_invalid_status_422(admin_token, created_ids):
    r = requests.patch(f"{BASE_URL}/api/portal/registrations/{created_ids[0]}",
                       headers={"Authorization": f"Bearer {admin_token}"},
                       json={"status": "foo"}, timeout=15)
    assert r.status_code == 422


def test_patch_not_found_404(admin_token):
    r = requests.patch(f"{BASE_URL}/api/portal/registrations/does-not-exist-xyz",
                       headers={"Authorization": f"Bearer {admin_token}"},
                       json={"status": "approved"}, timeout=15)
    assert r.status_code == 404


def test_patch_approve_success(admin_token, created_ids):
    r = requests.patch(f"{BASE_URL}/api/portal/registrations/{created_ids[0]}",
                       headers={"Authorization": f"Bearer {admin_token}"},
                       json={"status": "approved", "admin_note": "Welkom"}, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["status"] == "approved"
    assert data["reviewed_at"] is not None
    assert data["admin_note"] == "Welkom"


# ---------- Regression ----------
def test_get_settings_public():
    r = requests.get(f"{BASE_URL}/api/settings", timeout=15)
    assert r.status_code == 200


def test_put_settings_admin_only(admin_token):
    r = requests.put(f"{BASE_URL}/api/settings", json={}, timeout=15)
    assert r.status_code == 401
    r2 = requests.put(f"{BASE_URL}/api/settings", json={},
                      headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
    assert r2.status_code == 200


def test_chat_stats_admin_only(admin_token):
    r = requests.get(f"{BASE_URL}/api/chat/stats", timeout=15)
    assert r.status_code == 401
    r2 = requests.get(f"{BASE_URL}/api/chat/stats",
                      headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
    assert r2.status_code == 200


def test_contact_public():
    r = requests.post(f"{BASE_URL}/api/contact", json={
        "name": "TEST regression",
        "email": "test_regression@example.com",
        "message": "hello",
    }, timeout=20)
    assert r.status_code == 200


def test_projects_admin_only(admin_token):
    r = requests.post(f"{BASE_URL}/api/projects", json={
        "title": "x", "category": "y", "image_url": "https://example.com/x.png"
    }, timeout=15)
    assert r.status_code == 401


def test_zoho_login_redirect():
    r = requests.get(f"{BASE_URL}/api/auth/zoho/login", allow_redirects=False, timeout=15)
    assert r.status_code == 307

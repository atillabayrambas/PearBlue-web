"""Iteration 11 tests: Custom Scripts, User Mgmt, Roles, Activity Log, Terms, Ticket Detail."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Try backend/.env or frontend/.env
    for envfile in ("/app/frontend/.env", "/app/backend/.env"):
        try:
            with open(envfile) as f:
                for line in f:
                    if line.startswith("REACT_APP_BACKEND_URL"):
                        BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
                        break
        except FileNotFoundError:
            pass
        if BASE_URL:
            break

ADMIN_EMAIL = "admin@pearblue.nl"
ADMIN_PW = "PearBlue2026!"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PW}, timeout=15)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    tok = r.json().get("access_token")
    assert tok
    return tok


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ---------- Health / Regression ----------
def test_health():
    r = requests.get(f"{BASE_URL}/api/health", timeout=10)
    assert r.status_code == 200


def test_reviews_public_approved_only():
    r = requests.get(f"{BASE_URL}/api/reviews", timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    for rv in data:
        assert rv.get("approved") is True or rv.get("status") in (None, "approved")


def test_stats_trust():
    r = requests.get(f"{BASE_URL}/api/stats/trust", timeout=10)
    assert r.status_code == 200


def test_admin_reviews_scan_invites_requires_auth():
    r = requests.post(f"{BASE_URL}/api/admin/reviews/scan-invites", timeout=10)
    assert r.status_code in (401, 403)


def test_portal_tasks_requires_auth():
    r = requests.get(f"{BASE_URL}/api/portal/projects/any-id/tasks", timeout=10)
    assert r.status_code == 401


def test_portal_milestones_requires_auth():
    r = requests.get(f"{BASE_URL}/api/portal/projects/any-id/milestones", timeout=10)
    assert r.status_code == 401


def test_invoice_checkout_requires_auth():
    r = requests.post(f"{BASE_URL}/api/payments/invoice-checkout",
                      json={"invoice_id": "x"}, timeout=10)
    assert r.status_code == 401


def test_zoho_login_redirect_307():
    r = requests.get(f"{BASE_URL}/api/auth/zoho/login", allow_redirects=False, timeout=10)
    assert r.status_code in (302, 307)


# ---------- Custom Scripts ----------
def test_site_scripts_public_get():
    r = requests.get(f"{BASE_URL}/api/site/scripts", timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert "header_scripts" in data and "footer_scripts" in data


def test_scripts_put_requires_auth():
    r = requests.put(f"{BASE_URL}/api/admin/scripts",
                     json={"header_scripts": "x", "footer_scripts": "y"}, timeout=10)
    assert r.status_code == 401


def test_scripts_roundtrip(admin_headers):
    # Save originals
    orig = requests.get(f"{BASE_URL}/api/site/scripts", timeout=10).json()
    try:
        hdr = '<meta name="pb-test" content="1">'
        ftr = "<!-- pb-x -->"
        r = requests.put(f"{BASE_URL}/api/admin/scripts",
                         headers=admin_headers,
                         json={"header_scripts": hdr, "footer_scripts": ftr}, timeout=10)
        assert r.status_code == 200, r.text
        g = requests.get(f"{BASE_URL}/api/site/scripts", timeout=10).json()
        assert g["header_scripts"] == hdr
        assert g["footer_scripts"] == ftr
    finally:
        # Restore to empty (or original) to avoid leaking test data into live site
        requests.put(f"{BASE_URL}/api/admin/scripts",
                     headers=admin_headers,
                     json={"header_scripts": orig.get("header_scripts", ""),
                           "footer_scripts": orig.get("footer_scripts", "")}, timeout=10)


# ---------- User Management ----------
def test_users_list_requires_auth():
    r = requests.get(f"{BASE_URL}/api/admin/users", timeout=10)
    assert r.status_code == 401


def test_users_list(admin_headers):
    r = requests.get(f"{BASE_URL}/api/admin/users", headers=admin_headers, timeout=10)
    assert r.status_code == 200, r.text
    users = r.json()
    assert isinstance(users, list)
    assert len(users) >= 1
    emails = [(u.get("email") or "").lower() for u in users]
    assert ADMIN_EMAIL in emails
    admin_user = next(u for u in users if (u.get("email") or "").lower() == ADMIN_EMAIL)
    assert admin_user["role"] == "super_admin"
    for u in users:
        assert "email" in u
        assert "role" in u
        assert "zoho_linked" in u
        assert "auth_source" in u


def test_user_crud_and_activity(admin_headers):
    email = "test_iter11_user@example.com"
    # Cleanup if exists
    requests.delete(f"{BASE_URL}/api/admin/users/{email}", headers=admin_headers, timeout=10)

    # Create
    r = requests.post(f"{BASE_URL}/api/admin/users",
                      headers=admin_headers,
                      json={"email": email, "role": "analist",
                            "password": "TestPass123!", "display_name": "Iter11"},
                      timeout=10)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["email"] == email
    assert body["role"] == "analist"
    assert "created_at" in body

    # Activity log check
    r = requests.get(f"{BASE_URL}/api/admin/activity-log",
                     headers=admin_headers, timeout=10)
    assert r.status_code == 200
    log = r.json()
    assert isinstance(log, list) and len(log) >= 1
    first = log[0]
    assert first["action"] == "user.create"
    assert first["target"] == email
    assert first["actor_email"] == ADMIN_EMAIL

    # Update to moderator
    r = requests.patch(f"{BASE_URL}/api/admin/users/{email}",
                       headers=admin_headers,
                       json={"role": "moderator"}, timeout=10)
    assert r.status_code == 200, r.text

    # Verify updated in list
    users = requests.get(f"{BASE_URL}/api/admin/users",
                         headers=admin_headers, timeout=10).json()
    u = next((x for x in users if (x.get("email") or "").lower() == email), None)
    assert u and u["role"] == "moderator"

    # Delete
    r = requests.delete(f"{BASE_URL}/api/admin/users/{email}",
                        headers=admin_headers, timeout=10)
    assert r.status_code == 200

    # Verify deleted
    users = requests.get(f"{BASE_URL}/api/admin/users",
                         headers=admin_headers, timeout=10).json()
    assert not any((x.get("email") or "").lower() == email for x in users)


def test_cannot_delete_seed_admin(admin_headers):
    r = requests.delete(f"{BASE_URL}/api/admin/users/{ADMIN_EMAIL}",
                        headers=admin_headers, timeout=10)
    assert r.status_code == 400


def test_roles_endpoint(admin_headers):
    r = requests.get(f"{BASE_URL}/api/admin/roles", headers=admin_headers, timeout=10)
    assert r.status_code == 200
    roles = r.json()
    keys = [r_.get("key") for r_ in roles]
    for expected in ["super_admin", "beheerder", "analist", "moderator", "chat_support", "gebruiker"]:
        assert expected in keys
    # super_admin should have 'scripts' perm
    sa = next(r_ for r_ in roles if r_["key"] == "super_admin")
    assert "scripts" in sa["permissions"]


def test_permission_enforcement_analist_cannot_edit_scripts(admin_headers):
    """Analist role has only 'analytics' — must be blocked from /api/admin/scripts."""
    email = "test_iter11_analist@example.com"
    password = "AnalistTest123!"
    requests.delete(f"{BASE_URL}/api/admin/users/{email}", headers=admin_headers, timeout=10)
    r = requests.post(f"{BASE_URL}/api/admin/users",
                      headers=admin_headers,
                      json={"email": email, "role": "analist",
                            "password": password, "display_name": "AL"},
                      timeout=10)
    assert r.status_code == 200, r.text
    try:
        # Log in as analist
        login = requests.post(f"{BASE_URL}/api/auth/login",
                              json={"email": email, "password": password}, timeout=10)
        assert login.status_code == 200, login.text
        tok = login.json()["access_token"]
        # Try to write scripts
        r = requests.put(f"{BASE_URL}/api/admin/scripts",
                         headers={"Authorization": f"Bearer {tok}"},
                         json={"header_scripts": "", "footer_scripts": ""}, timeout=10)
        assert r.status_code == 403, f"Expected 403 got {r.status_code} {r.text}"
        # Also cannot list users
        r = requests.get(f"{BASE_URL}/api/admin/users",
                         headers={"Authorization": f"Bearer {tok}"}, timeout=10)
        assert r.status_code == 403
    finally:
        requests.delete(f"{BASE_URL}/api/admin/users/{email}",
                        headers=admin_headers, timeout=10)


# ---------- Ticket Detail (Portal) ----------
def test_ticket_detail_requires_portal_auth():
    r = requests.get(f"{BASE_URL}/api/portal/tickets/fake-id-123", timeout=10)
    assert r.status_code == 401


def test_ticket_threads_requires_portal_auth():
    r = requests.get(f"{BASE_URL}/api/portal/tickets/fake-id-123/threads", timeout=10)
    assert r.status_code == 401


def test_ticket_reply_requires_portal_auth():
    r = requests.post(f"{BASE_URL}/api/portal/tickets/fake-id-123/reply",
                      json={"content": "hi"}, timeout=10)
    assert r.status_code == 401

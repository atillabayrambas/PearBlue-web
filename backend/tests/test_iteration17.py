"""Iteration 17 (v0.5.3-Beta) backend tests.

Covers:
- new CRM role + roles endpoint
- CRM reset-password authority
- super_admin change-password + role guard
- public /auth/reset-password/verify + apply
- /auth/me/prefs GET/PATCH
- /admin/users/{email}/notify-updated
- /admin/virus-scanner/unread + acknowledge-all
- /admin/counters exposes virus_scanner
- /portal/registrations PATCH assigned_to
- /admin/assignees returns first_name, last_name, profile_picture
- /api/quote accepts custom_request
- Regression on existing endpoints
"""
import os
import uuid
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback for local pytest env
    BASE_URL = "https://sheet-converter-68.preview.emergentagent.com"

ADMIN_EMAIL = "admin@pearblue.nl"
ADMIN_PW = "PearBlue2026!"


# -------- Fixtures --------
@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="session")
def admin_token(s):
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PW})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def crm_user(s, admin_headers):
    """Create a CRM user, yield credentials, delete after."""
    email = f"test_crm_{uuid.uuid4().hex[:8]}@pearblue.nl"
    pw = "CrmTest12345!"
    r = requests.post(
        f"{BASE_URL}/api/admin/users",
        headers=admin_headers,
        json={"email": email, "role": "crm", "display_name": "TEST CRM", "password": pw},
    )
    assert r.status_code in (200, 201), r.text
    login = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pw})
    assert login.status_code == 200, login.text
    token = login.json()["access_token"]
    yield {"email": email, "password": pw, "token": token}
    requests.delete(f"{BASE_URL}/api/admin/users/{email}", headers=admin_headers)


@pytest.fixture(scope="session")
def chat_support_user(s, admin_headers):
    email = f"test_cs_{uuid.uuid4().hex[:8]}@pearblue.nl"
    pw = "CsTest12345!"
    r = requests.post(
        f"{BASE_URL}/api/admin/users",
        headers=admin_headers,
        json={"email": email, "role": "chat_support", "display_name": "TEST CS", "password": pw},
    )
    assert r.status_code in (200, 201), r.text
    login = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pw})
    token = login.json()["access_token"]
    yield {"email": email, "password": pw, "token": token}
    requests.delete(f"{BASE_URL}/api/admin/users/{email}", headers=admin_headers)


@pytest.fixture(scope="session")
def target_user(admin_headers):
    """A user we will reset/change password for."""
    email = f"test_target_{uuid.uuid4().hex[:8]}@pearblue.nl"
    pw = "TargetPW12345!"
    r = requests.post(
        f"{BASE_URL}/api/admin/users",
        headers=admin_headers,
        json={"email": email, "role": "gebruiker", "display_name": "TEST Target", "password": pw},
    )
    assert r.status_code in (200, 201), r.text
    yield {"email": email, "password": pw}
    requests.delete(f"{BASE_URL}/api/admin/users/{email}", headers=admin_headers)


# -------- Roles --------
def test_roles_include_crm(admin_headers):
    r = requests.get(f"{BASE_URL}/api/admin/roles", headers=admin_headers)
    assert r.status_code == 200, r.text
    data = r.json()
    roles = data if isinstance(data, list) else data.get("roles", [])
    keys = {(r.get("key") if isinstance(r, dict) else r) for r in roles}
    assert "crm" in keys, f"crm role missing. got: {keys}"
    # count check: 8 roles expected
    assert len(keys) >= 8, f"expected >=8 roles, got {len(keys)}: {keys}"
    # check CRM perms
    crm = next((r for r in roles if isinstance(r, dict) and r.get("key") == "crm"), None)
    assert crm is not None
    perms = set(crm.get("permissions", []))
    expected = {"users", "chat", "tickets", "messages", "feedback", "reviews"}
    assert expected.issubset(perms), f"CRM missing perms: {expected - perms}"


def test_create_user_with_crm_role(crm_user):
    # fixture already created & logged in
    assert crm_user["token"]


# -------- Reset password (CRM authority) --------
def test_reset_password_by_crm(crm_user, target_user):
    hdr = {"Authorization": f"Bearer {crm_user['token']}", "Content-Type": "application/json"}
    r = requests.post(f"{BASE_URL}/api/admin/users/{target_user['email']}/reset-password", headers=hdr)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("status") == "sent"
    assert "reset_url" in data and "token=" in data["reset_url"]


def test_reset_password_forbidden_for_chat_support(chat_support_user, target_user):
    hdr = {"Authorization": f"Bearer {chat_support_user['token']}", "Content-Type": "application/json"}
    r = requests.post(f"{BASE_URL}/api/admin/users/{target_user['email']}/reset-password", headers=hdr)
    assert r.status_code == 403, r.text


# -------- Public verify + apply --------
def test_reset_verify_and_apply(admin_headers, target_user):
    # 1) generate token via admin reset endpoint
    r = requests.post(
        f"{BASE_URL}/api/admin/users/{target_user['email']}/reset-password", headers=admin_headers
    )
    assert r.status_code == 200
    reset_url = r.json()["reset_url"]
    token = reset_url.split("token=", 1)[1]
    # 2) verify
    v = requests.get(f"{BASE_URL}/api/auth/reset-password/verify", params={"token": token})
    assert v.status_code == 200, v.text
    body = v.json()
    assert body.get("valid") is True
    assert body.get("email") == target_user["email"]
    # 3) invalid token
    bad = requests.get(f"{BASE_URL}/api/auth/reset-password/verify", params={"token": "not-a-jwt"})
    assert bad.status_code == 400
    # 4) apply new password
    new_pw = "NewApplied12345!"
    ap = requests.post(
        f"{BASE_URL}/api/auth/reset-password/apply",
        json={"token": token, "new_password": new_pw},
    )
    assert ap.status_code == 200, ap.text
    assert ap.json().get("status") == "updated"
    # 5) login with new password
    login = requests.post(
        f"{BASE_URL}/api/auth/login", json={"email": target_user["email"], "password": new_pw}
    )
    assert login.status_code == 200, login.text
    # update fixture state so downstream tests still know current pw
    target_user["password"] = new_pw


# -------- Admin change password --------
def test_change_password_super_admin(admin_headers, target_user):
    new_pw = "SuperChanged12345!"
    r = requests.post(
        f"{BASE_URL}/api/admin/users/{target_user['email']}/change-password",
        headers=admin_headers,
        json={"new_password": new_pw, "send_notification": False},
    )
    assert r.status_code == 200, r.text
    assert r.json().get("status") == "updated"
    # login
    login = requests.post(
        f"{BASE_URL}/api/auth/login", json={"email": target_user["email"], "password": new_pw}
    )
    assert login.status_code == 200
    target_user["password"] = new_pw


def test_change_password_forbidden_for_crm(crm_user, target_user):
    hdr = {"Authorization": f"Bearer {crm_user['token']}", "Content-Type": "application/json"}
    r = requests.post(
        f"{BASE_URL}/api/admin/users/{target_user['email']}/change-password",
        headers=hdr,
        json={"new_password": "AnotherPW12345!", "send_notification": False},
    )
    assert r.status_code == 403


# -------- User prefs --------
def test_me_prefs(admin_headers):
    p = requests.patch(
        f"{BASE_URL}/api/auth/me/prefs", headers=admin_headers, json={"lang": "en"}
    )
    assert p.status_code == 200, p.text
    p2 = requests.patch(
        f"{BASE_URL}/api/auth/me/prefs", headers=admin_headers, json={"theme_mode": "dark"}
    )
    assert p2.status_code == 200
    g = requests.get(f"{BASE_URL}/api/auth/me/prefs", headers=admin_headers)
    assert g.status_code == 200
    body = g.json()
    assert body.get("lang") == "en"
    assert body.get("theme_mode") == "dark"


# -------- Notify updated --------
def test_notify_updated(admin_headers, target_user):
    r = requests.post(
        f"{BASE_URL}/api/admin/users/{target_user['email']}/notify-updated",
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    assert r.json().get("status") == "sent"


# -------- Virus scanner unread + counters --------
def test_virus_scanner_flow(admin_headers):
    # baseline
    r0 = requests.get(f"{BASE_URL}/api/admin/virus-scanner/unread", headers=admin_headers)
    assert r0.status_code == 200
    assert "count" in r0.json()
    # acknowledge-all
    r1 = requests.post(
        f"{BASE_URL}/api/admin/virus-scanner/acknowledge-all", headers=admin_headers
    )
    assert r1.status_code == 200
    assert "acknowledged" in r1.json()
    # after ack
    r2 = requests.get(f"{BASE_URL}/api/admin/virus-scanner/unread", headers=admin_headers)
    assert r2.status_code == 200
    assert r2.json()["count"] == 0


def test_counters_include_virus_scanner(admin_headers):
    r = requests.get(f"{BASE_URL}/api/admin/counters", headers=admin_headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "virus_scanner" in body
    assert isinstance(body["virus_scanner"], int)


# -------- Portal registrations PATCH --------
def test_portal_registration_assign(admin_headers):
    # create a registration
    reg_payload = {
        "name": "TEST Assign",
        "email": f"test_reg_{uuid.uuid4().hex[:6]}@example.com",
        "phone": "0612345678",
        "company": "Test Co",
        "message": "assign me",
    }
    c = requests.post(f"{BASE_URL}/api/portal/register", json=reg_payload)
    assert c.status_code == 200, c.text
    reg_id = c.json().get("id")
    assert reg_id
    # patch assigned_to
    p = requests.patch(
        f"{BASE_URL}/api/portal/registrations/{reg_id}",
        headers=admin_headers,
        json={"status": "pending", "assigned_to": ADMIN_EMAIL},
    )
    assert p.status_code == 200, p.text
    body = p.json()
    assert body.get("assigned_to") == ADMIN_EMAIL
    # GET verify
    g = requests.get(f"{BASE_URL}/api/portal/registrations", headers=admin_headers)
    assert g.status_code == 200
    matches = [r for r in g.json() if r.get("id") == reg_id]
    assert matches and matches[0].get("assigned_to") == ADMIN_EMAIL


# -------- Assignees --------
def test_assignees_shape(admin_headers):
    r = requests.get(f"{BASE_URL}/api/admin/assignees", headers=admin_headers)
    assert r.status_code == 200, r.text
    arr = r.json()
    assert isinstance(arr, list) and len(arr) > 0
    for a in arr:
        assert "email" in a
        assert "first_name" in a
        assert "last_name" in a
        assert "profile_picture" in a
        assert "role" in a


# -------- Quote custom_request --------
def test_quote_custom_request():
    payload = {
        "name": "TEST_Quote User17",
        "email": "test_quote17@example.com",
        "company": "TestCo",
        "kind": "web",
        "story": "custom quote test",
        "custom_request": "Ik wil iets heel bijzonders met Blender integratie",
    }
    r = requests.post(f"{BASE_URL}/api/quote", json=payload)
    assert r.status_code == 200, r.text
    body = r.json()
    # Either returned object or list; verify custom_request preserved somewhere
    # Try common shapes
    if isinstance(body, dict):
        # could be direct doc or wrapper
        cr = body.get("custom_request") or (body.get("quote") or {}).get("custom_request")
        assert cr == payload["custom_request"], f"custom_request missing in response: {body}"


# -------- Regressions --------
def test_regression_endpoints(admin_headers):
    # /api/admin/financials
    r = requests.get(f"{BASE_URL}/api/admin/financials?period=7d", headers=admin_headers)
    assert r.status_code == 200
    # /api/admin/chat/ratings
    r = requests.get(f"{BASE_URL}/api/admin/chat/ratings", headers=admin_headers)
    assert r.status_code == 200
    # /api/reviews
    r = requests.get(f"{BASE_URL}/api/reviews")
    assert r.status_code == 200
    # /api/portal/registrations
    r = requests.get(f"{BASE_URL}/api/portal/registrations", headers=admin_headers)
    assert r.status_code == 200
    # /api/chat
    r = requests.post(
        f"{BASE_URL}/api/chat", json={"session_id": f"test_{uuid.uuid4().hex[:6]}", "message": "hi"}
    )
    assert r.status_code == 200

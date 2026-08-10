"""Iteration 19 backend tests — password reset, portal registration with address/region, user details region+phone."""
import os
import time
import jwt
import pytest
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://sheet-converter-68.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
JWT_SECRET = "pearblue-super-secret-change-in-production-8f3d21a94b7c6e5f2d1a0c9b8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0"

ADMIN_EMAIL = "admin@pearblue.nl"
ADMIN_PWD = "PearBlue2026!"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PWD})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def hdr(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# --- Password Reset ---
class TestPasswordReset:
    def test_verify_invalid_token(self):
        r = requests.get(f"{API}/auth/reset-password/verify", params={"token": "fake"})
        assert r.status_code == 400
        assert "Ongeldig" in r.text or "Token" in r.text

    def test_verify_expired_token(self):
        tok = jwt.encode(
            {"sub": ADMIN_EMAIL, "exp": datetime.now(timezone.utc) - timedelta(minutes=5), "purpose": "reset"},
            JWT_SECRET, algorithm="HS256",
        )
        r = requests.get(f"{API}/auth/reset-password/verify", params={"token": tok})
        assert r.status_code == 400
        assert "verlopen" in r.text.lower() or "expired" in r.text.lower()

    def test_verify_wrong_purpose(self):
        tok = jwt.encode(
            {"sub": ADMIN_EMAIL, "exp": datetime.now(timezone.utc) + timedelta(hours=1), "purpose": "other"},
            JWT_SECRET, algorithm="HS256",
        )
        r = requests.get(f"{API}/auth/reset-password/verify", params={"token": tok})
        assert r.status_code == 400

    def test_verify_valid_token(self):
        tok = jwt.encode(
            {"sub": ADMIN_EMAIL, "exp": datetime.now(timezone.utc) + timedelta(hours=1), "purpose": "reset"},
            JWT_SECRET, algorithm="HS256",
        )
        r = requests.get(f"{API}/auth/reset-password/verify", params={"token": tok})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["valid"] is True
        assert data["email"] == ADMIN_EMAIL

    def test_apply_reset_and_login(self):
        # Use a throwaway pwd, then restore
        new_pwd = "TempReset2026!"
        tok = jwt.encode(
            {"sub": ADMIN_EMAIL, "exp": datetime.now(timezone.utc) + timedelta(hours=1), "purpose": "reset"},
            JWT_SECRET, algorithm="HS256",
        )
        r = requests.post(f"{API}/auth/reset-password/apply", json={"token": tok, "new_password": new_pwd})
        assert r.status_code == 200, r.text
        # Login with new password
        r2 = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": new_pwd})
        assert r2.status_code == 200, r2.text
        # Restore original
        tok2 = jwt.encode(
            {"sub": ADMIN_EMAIL, "exp": datetime.now(timezone.utc) + timedelta(hours=1), "purpose": "reset"},
            JWT_SECRET, algorithm="HS256",
        )
        r3 = requests.post(f"{API}/auth/reset-password/apply", json={"token": tok2, "new_password": ADMIN_PWD})
        assert r3.status_code == 200
        # Verify original login works
        r4 = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PWD})
        assert r4.status_code == 200


# --- Portal Registration extended fields ---
class TestPortalRegistration:
    def test_register_with_address(self, hdr):
        payload = {
            "name": "TEST Iter19",
            "email": f"test_iter19_{int(time.time())}@example.com",
            "address": "Kerkstraat 1",
            "postal_code": "1234AB",
            "city": "Amsterdam",
            "region": "Noord-Holland",
            "country": "Nederland",
        }
        r = requests.post(f"{API}/portal/register", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ["address", "postal_code", "city", "region", "country"]:
            assert data.get(k) == payload[k], f"{k}={data.get(k)}"

        # Verify listing returns those fields
        r2 = requests.get(f"{API}/portal/registrations", headers=hdr)
        assert r2.status_code == 200
        regs = r2.json()
        found = next((x for x in regs if x.get("email") == payload["email"]), None)
        assert found is not None
        assert found.get("address") == "Kerkstraat 1"
        assert found.get("region") == "Noord-Holland"


# --- User Details region + phone ---
class TestUserDetails:
    def test_get_details_has_region_and_phone(self, hdr):
        r = requests.get(f"{API}/admin/users/{ADMIN_EMAIL}/details", headers=hdr)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "region" in data
        assert "phone" in data

    def test_update_details_region_phone(self, hdr):
        r = requests.put(
            f"{API}/admin/users/{ADMIN_EMAIL}/details",
            headers=hdr,
            json={"region": "Noord-Holland", "phone": "0612345678"},
        )
        assert r.status_code == 200, r.text
        r2 = requests.get(f"{API}/admin/users/{ADMIN_EMAIL}/details", headers=hdr)
        assert r2.status_code == 200
        data = r2.json()
        assert data.get("region") == "Noord-Holland"
        assert data.get("phone") == "0612345678"


# --- Regression endpoints ---
class TestRegression:
    def test_counters(self, hdr):
        r = requests.get(f"{API}/admin/counters", headers=hdr)
        assert r.status_code == 200

    def test_financials(self, hdr):
        r = requests.get(f"{API}/admin/financials", headers=hdr)
        assert r.status_code == 200

    def test_roles(self, hdr):
        r = requests.get(f"{API}/admin/roles", headers=hdr)
        assert r.status_code == 200
        data = r.json()
        # should be 8 roles
        roles = data if isinstance(data, list) else data.get("roles", [])
        assert len(roles) == 8, f"Expected 8 roles, got {len(roles)}"

    def test_assignees(self, hdr):
        r = requests.get(f"{API}/admin/assignees", headers=hdr)
        assert r.status_code == 200
        data = r.json()
        items = data if isinstance(data, list) else data.get("assignees", [])
        if items:
            sample = items[0]
            # first_name+last_name+profile_picture keys should exist (may be empty)
            assert any(k in sample for k in ["first_name", "last_name"]), sample.keys()

    def test_quote(self):
        r = requests.post(f"{API}/quote", json={
            "name": "TEST",
            "email": "test_iter19@example.com",
            "message": "test quote",
            "services": ["Website"],
        })
        assert r.status_code in (200, 201), r.text

    def test_virus_unread(self, hdr):
        r = requests.get(f"{API}/admin/virus-scanner/unread", headers=hdr)
        assert r.status_code == 200

    def test_virus_ack_all(self, hdr):
        r = requests.post(f"{API}/admin/virus-scanner/acknowledge-all", headers=hdr)
        assert r.status_code == 200

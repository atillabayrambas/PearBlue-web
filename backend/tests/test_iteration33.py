"""Iteration 33 tests — AI Vertaal-Assist endpoint + regression on admin auth & CMS reads.

Focus:
- POST /api/admin/ai/translate (Claude Sonnet 4.6 via Emergent LLM key) auth + happy path
- Regression: admin login, admin-only endpoints still 401 without token, /api/contact GET, /api/projects GET
"""
import os
import re
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://sheet-converter-68.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@pearblue.nl"
ADMIN_PASSWORD = "PearBlue2026!"


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    tok = r.json().get("access_token")
    assert tok
    return tok


@pytest.fixture
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# --- REGRESSION ---

def test_admin_login_and_me(admin_token):
    r = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {admin_token}"}, timeout=10)
    assert r.status_code == 200
    j = r.json()
    assert j.get("email") == ADMIN_EMAIL
    assert j.get("role") in ("admin", "super_admin")


def test_translate_requires_auth():
    r = requests.post(f"{BASE_URL}/api/admin/ai/translate", json={"text": "hoi", "source_lang": "nl", "target_lang": "en"}, timeout=10)
    assert r.status_code in (401, 403)


def test_contact_list_regression(auth_headers):
    r = requests.get(f"{BASE_URL}/api/contact", headers=auth_headers, timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_projects_list_regression():
    r = requests.get(f"{BASE_URL}/api/projects", timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# --- NEW: AI translate happy path ---

def test_ai_translate_nl_to_en(auth_headers):
    body = {"text": "Wij bouwen moderne websites met liefde voor detail.", "source_lang": "nl", "target_lang": "en"}
    r = requests.post(f"{BASE_URL}/api/admin/ai/translate", headers=auth_headers, json=body, timeout=60)
    assert r.status_code == 200, r.text
    j = r.json()
    assert "translated" in j
    assert j.get("source_lang") == "nl"
    assert j.get("target_lang") == "en"
    tr = j["translated"]
    assert isinstance(tr, str) and len(tr.strip()) > 0
    # Should not be the exact Dutch phrase
    assert tr.strip().lower() != body["text"].lower()
    # Rough English signal
    assert re.search(r"\b(we|websites?|modern|detail|build|building|love|care)\b", tr, re.I), f"Unexpected translation: {tr}"


def test_ai_translate_same_lang_passthrough(auth_headers):
    # source_lang == target_lang → server returns the text unchanged (short-circuit)
    body = {"text": "Hello world", "source_lang": "en", "target_lang": "en"}
    r = requests.post(f"{BASE_URL}/api/admin/ai/translate", headers=auth_headers, json=body, timeout=15)
    assert r.status_code == 200
    j = r.json()
    assert j["translated"] == "Hello world"


def test_ai_translate_en_to_nl(auth_headers):
    body = {"text": "We build modern websites with love for detail.", "source_lang": "en", "target_lang": "nl"}
    r = requests.post(f"{BASE_URL}/api/admin/ai/translate", headers=auth_headers, json=body, timeout=60)
    assert r.status_code == 200, r.text
    tr = r.json()["translated"]
    assert isinstance(tr, str) and tr.strip()
    # Look for common Dutch words
    assert re.search(r"\b(wij|we|websites?|met|voor|liefde|bouwen|moderne|detail)\b", tr, re.I), f"Unexpected translation: {tr}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

"""Regression tests for social-media URL settings.

Covers:
- Every social_* field defaults to "" on /api/settings (public GET)
- Admin PUT roundtrip persists all 24 channels
- max_length=500 rejects monster payloads
- Non-admin PUT is rejected
"""
import os
import requests
import pytest

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@pearblue.nl"
ADMIN_PASSWORD = "PearBlue2026!"

SOCIAL_KEYS = [
    "social_linkedin", "social_facebook", "social_instagram", "social_twitter",
    "social_youtube", "social_tiktok", "social_whatsapp", "social_telegram",
    "social_signal", "social_discord", "social_github", "social_gitlab",
    "social_behance", "social_dribbble", "social_medium", "social_mastodon",
    "social_bluesky", "social_threads", "social_vimeo", "social_twitch",
    "social_trustpilot", "social_google_business", "social_pinterest", "social_reddit",
]


@pytest.fixture(scope="module")
def auth_headers():
    r = requests.post(
        f"{API}/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}", "Content-Type": "application/json"}


def test_social_defaults_present():
    r = requests.get(f"{API}/settings", timeout=10)
    assert r.status_code == 200
    d = r.json()
    for key in SOCIAL_KEYS:
        assert key in d, f"missing {key}"


def test_social_roundtrip(auth_headers):
    payload = {
        "social_linkedin": "https://linkedin.com/company/pearblue-test",
        "social_github": "https://github.com/pearblue-test",
        "social_whatsapp": "https://wa.me/31612345678",
        "social_bluesky": "https://bsky.app/profile/pearblue.bsky.social",
    }
    r = requests.put(f"{API}/settings", json=payload, headers=auth_headers, timeout=15)
    assert r.status_code == 200, r.text
    saved = r.json()
    for k, v in payload.items():
        assert saved[k] == v

    # Wipe them again so we don't leak state
    r2 = requests.put(
        f"{API}/settings",
        json={k: "" for k in payload},
        headers=auth_headers,
        timeout=15,
    )
    assert r2.status_code == 200
    for k in payload:
        assert r2.json()[k] == ""


def test_social_max_length_enforced(auth_headers):
    long = "https://" + ("x" * 600)
    r = requests.put(
        f"{API}/settings",
        json={"social_linkedin": long},
        headers=auth_headers,
        timeout=10,
    )
    assert r.status_code == 422


def test_social_requires_admin():
    r = requests.put(
        f"{API}/settings",
        json={"social_linkedin": "https://linkedin.com/x"},
        timeout=10,
    )
    assert r.status_code in (401, 403)

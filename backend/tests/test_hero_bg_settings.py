"""Regression tests for the CMS Hero background settings (video mode).

Covers:
- Defaults on /api/settings for hero_bg_* fields
- Admin can PUT hero_bg_mode="video" with a URL and dim
- Rejects invalid mode (bogus) and out-of-range dim
- Revert to animated clears the mode
"""
import os
import requests
import pytest

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@pearblue.nl"
ADMIN_PASSWORD = "PearBlue2026!"


@pytest.fixture(scope="module")
def auth_headers():
    r = requests.post(
        f"{API}/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def test_hero_bg_defaults_present():
    r = requests.get(f"{API}/settings", timeout=10)
    assert r.status_code == 200
    d = r.json()
    for key in ("hero_bg_mode", "hero_bg_video_url", "hero_bg_video_poster", "hero_bg_video_dim"):
        assert key in d, f"missing {key} in /api/settings"


def test_hero_bg_video_roundtrip(auth_headers):
    payload = {
        "hero_bg_mode": "video",
        "hero_bg_video_url": "https://cdn.example.com/hero-test.mp4",
        "hero_bg_video_poster": "https://cdn.example.com/hero-poster.jpg",
        "hero_bg_video_dim": 45,
    }
    r = requests.put(f"{API}/settings", json=payload, headers=auth_headers, timeout=15)
    assert r.status_code == 200, r.text
    saved = r.json()
    assert saved["hero_bg_mode"] == "video"
    assert saved["hero_bg_video_url"] == payload["hero_bg_video_url"]
    assert saved["hero_bg_video_dim"] == 45

    # revert
    r2 = requests.put(
        f"{API}/settings",
        json={"hero_bg_mode": "animated", "hero_bg_video_url": "", "hero_bg_video_dim": 35},
        headers=auth_headers,
        timeout=15,
    )
    assert r2.status_code == 200
    assert r2.json()["hero_bg_mode"] == "animated"


def test_hero_bg_rejects_invalid_mode(auth_headers):
    r = requests.put(
        f"{API}/settings",
        json={"hero_bg_mode": "bogus"},
        headers=auth_headers,
        timeout=10,
    )
    assert r.status_code == 422


def test_hero_bg_rejects_out_of_range_dim(auth_headers):
    r = requests.put(
        f"{API}/settings",
        json={"hero_bg_video_dim": 150},
        headers=auth_headers,
        timeout=10,
    )
    assert r.status_code == 422

    r2 = requests.put(
        f"{API}/settings",
        json={"hero_bg_video_dim": -5},
        headers=auth_headers,
        timeout=10,
    )
    assert r2.status_code == 422

"""Regression tests for hero video uploads (Emergent object storage).

Covers:
- POST /api/hero-videos/upload accepts valid MP4/WebM as admin
- Rejects non-video content-types
- Rejects unauthenticated uploads
- GET /api/hero-videos/{id} streams the file back publicly
- DELETE /api/hero-videos/{id} soft-deletes and hides from list + public GET
"""
import os
import io
import requests
import pytest

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@pearblue.nl"
ADMIN_PASSWORD = "PearBlue2026!"


@pytest.fixture(scope="module")
def token():
    r = requests.post(
        f"{API}/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def _upload_bytes():
    return io.BytesIO(b"\x00" * 1024)  # 1 KB dummy


def test_upload_video_mp4(auth_headers):
    files = {"file": ("test.mp4", _upload_bytes(), "video/mp4")}
    r = requests.post(f"{API}/hero-videos/upload", files=files, headers=auth_headers, timeout=60)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["content_type"] == "video/mp4"
    assert body["url"].startswith("/api/hero-videos/")
    assert body["size"] == 1024

    # Public GET (no auth) streams the file back
    pub = requests.get(f"{BASE_URL}{body['url']}", timeout=30)
    assert pub.status_code == 200
    assert pub.headers["Content-Type"].startswith("video/mp4")
    assert len(pub.content) == 1024

    # Soft delete removes it from public GET
    d = requests.delete(f"{API}/hero-videos/{body['id']}", headers=auth_headers, timeout=15)
    assert d.status_code == 200
    pub2 = requests.get(f"{BASE_URL}{body['url']}", timeout=10)
    assert pub2.status_code == 404


def test_upload_video_webm(auth_headers):
    files = {"file": ("test.webm", _upload_bytes(), "video/webm")}
    r = requests.post(f"{API}/hero-videos/upload", files=files, headers=auth_headers, timeout=60)
    assert r.status_code == 200
    assert r.json()["content_type"] == "video/webm"


def test_upload_rejects_non_video(auth_headers):
    files = {"file": ("hello.txt", io.BytesIO(b"hi"), "text/plain")}
    r = requests.post(f"{API}/hero-videos/upload", files=files, headers=auth_headers, timeout=15)
    assert r.status_code == 400


def test_upload_requires_admin():
    files = {"file": ("test.mp4", _upload_bytes(), "video/mp4")}
    r = requests.post(f"{API}/hero-videos/upload", files=files, timeout=15)
    assert r.status_code in (401, 403)


def test_list_hero_videos_requires_admin():
    r = requests.get(f"{API}/hero-videos/list", timeout=10)
    assert r.status_code in (401, 403)


def test_list_hero_videos_returns_admin_scope(auth_headers):
    r = requests.get(f"{API}/hero-videos/list", headers=auth_headers, timeout=10)
    assert r.status_code == 200
    assert isinstance(r.json(), list)

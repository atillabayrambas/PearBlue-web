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
    assert body["primary_ext"] == "mp4"
    assert body["url"].startswith("/api/hero-videos/")
    assert body["mp4_url"].endswith(".mp4")
    # WebM transcode may fail (dummy bytes aren't a real video); either way,
    # the MP4 must be servable and the endpoint must not crash.
    pub = requests.get(f"{BASE_URL}{body['mp4_url']}", timeout=30)
    assert pub.status_code == 200
    assert pub.headers["Content-Type"].startswith("video/mp4")

    d = requests.delete(f"{API}/hero-videos/{body['id']}", headers=auth_headers, timeout=15)
    assert d.status_code == 200
    pub2 = requests.get(f"{BASE_URL}{body['url']}", timeout=10)
    assert pub2.status_code == 404


def test_upload_video_webm_bytes(auth_headers):
    """Uploading raw bytes as video/webm is accepted (transcode may fail but the request is OK)."""
    files = {"file": ("test.webm", _upload_bytes(), "video/webm")}
    r = requests.post(f"{API}/hero-videos/upload", files=files, headers=auth_headers, timeout=60)
    assert r.status_code == 200
    assert r.json()["primary_ext"] == "webm"


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


def _make_real_mp4(tmp_path: str) -> None:
    import subprocess
    subprocess.run(
        [
            "ffmpeg", "-y", "-f", "lavfi", "-i",
            "testsrc2=size=160x90:rate=10:duration=1",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", tmp_path,
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def test_upload_transcodes_mp4_to_webm(auth_headers, tmp_path):
    """A real MP4 upload should produce a working WebM sibling via ffmpeg."""
    mp4 = tmp_path / "clip.mp4"
    _make_real_mp4(str(mp4))
    with mp4.open("rb") as fh:
        r = requests.post(
            f"{API}/hero-videos/upload",
            files={"file": ("clip.mp4", fh, "video/mp4")},
            headers=auth_headers,
            timeout=180,
        )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["primary_ext"] == "mp4"
    assert body["transcode_ok"] is True
    assert body["webm_url"] and body["mp4_url"]
    # Both variants are streamable
    for url, mime in [(body["mp4_url"], "video/mp4"), (body["webm_url"], "video/webm")]:
        pub = requests.get(f"{BASE_URL}{url}", timeout=30)
        assert pub.status_code == 200
        assert pub.headers["Content-Type"].startswith(mime)
        assert len(pub.content) > 500
    # Content negotiation prefers WebM for a Chrome UA and MP4 for Safari
    chrome = requests.get(f"{BASE_URL}{body['url']}", headers={"User-Agent": "Mozilla/5.0 Chrome/122"}, timeout=15)
    assert chrome.headers["Content-Type"].startswith("video/webm")
    safari = requests.get(f"{BASE_URL}{body['url']}", headers={"User-Agent": "Mozilla/5.0 (iPhone) Safari/605.1"}, timeout=15)
    assert safari.headers["Content-Type"].startswith("video/mp4")
    # Clean up
    requests.delete(f"{API}/hero-videos/{body['id']}", headers=auth_headers, timeout=15)

"""PearBlue backend API tests - iteration 2 (projects CRUD + contact regression)."""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://sheet-converter-68.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---- Health ----
def test_health(session):
    r = session.get(f"{API}/health", timeout=15)
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


# ---- Projects CRUD ----
def test_projects_list(session):
    r = session.get(f"{API}/projects", timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_projects_create_and_get(session):
    payload = {
        "title": "TEST_Project_Sample",
        "category": "ai",
        "image_url": "https://picsum.photos/id/1/800/600",
        "description": "sample",
        "tag": "TEST",
        "external_url": "https://example.com",
    }
    r = session.post(f"{API}/projects", json=payload, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["title"] == payload["title"]
    assert body["category"] == payload["category"]
    assert "id" in body and isinstance(body["id"], str)
    pid = body["id"]

    # Verify via list
    r2 = session.get(f"{API}/projects", timeout=15)
    assert r2.status_code == 200
    ids = [p["id"] for p in r2.json()]
    assert pid in ids

    # cleanup
    session.delete(f"{API}/projects/{pid}", timeout=15)


def test_projects_create_missing_required(session):
    # missing image_url
    payload = {"title": "TEST_Missing_Image", "category": "ai"}
    r = session.post(f"{API}/projects", json=payload, timeout=15)
    assert r.status_code == 422


def test_projects_delete_existing(session):
    payload = {
        "title": "TEST_ToDelete",
        "category": "sec",
        "image_url": "https://picsum.photos/id/2/800/600",
    }
    r = session.post(f"{API}/projects", json=payload, timeout=15)
    assert r.status_code == 200
    pid = r.json()["id"]

    d = session.delete(f"{API}/projects/{pid}", timeout=15)
    assert d.status_code == 200
    assert d.json().get("status") == "deleted"


def test_projects_delete_nonexistent(session):
    d = session.delete(f"{API}/projects/does-not-exist-xyz", timeout=15)
    assert d.status_code == 404


# ---- Contact regression ----
def test_contact_create(session):
    payload = {
        "name": "TEST_Regression",
        "email": "test_regression@example.com",
        "phone": "+31596229030",
        "company": "PearBlue Test",
        "subject": "Regression",
        "message": "Hello from test",
        "language": "nl",
    }
    r = session.post(f"{API}/contact", json=payload, timeout=20)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["name"] == payload["name"]
    assert body["phone"] == payload["phone"]
    assert body["subject"] == payload["subject"]
    assert body["email_sent"] is False  # RESEND_API_KEY empty
    assert "id" in body

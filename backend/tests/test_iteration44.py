"""Iteration 44 — Company roadmap timeline (About page + CMS Settings tab)."""
import os
import requests

BASE = (os.environ.get("REACT_APP_BACKEND_URL")
        or open("/app/frontend/.env").read().strip().split("=", 1)[1])
API = f"{BASE.strip()}/api"

ADMIN_EMAIL = "admin@pearblue.nl"
ADMIN_PASS = "PearBlue2026!"


def _auth():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


class TestPublicRoadmap:
    def test_seed_visible(self):
        r = requests.get(f"{API}/site/roadmap", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "achieved" in d and "planned" in d
        assert len(d["achieved"]) >= 1, "Seed should include the website achievement"
        assert len(d["planned"]) >= 4, "Seed should include 4 planned goals (builder, phone, tab, os)"

    def test_seed_icons_are_valid(self):
        r = requests.get(f"{API}/site/roadmap", timeout=15)
        allowed = requests.get(f"{API}/site/roadmap-icons", timeout=15).json()["icons"]
        for i in r.json()["achieved"] + r.json()["planned"]:
            assert i.get("icon") in allowed, f"Icon {i.get('icon')} not in whitelist"

    def test_icons_endpoint_public(self):
        r = requests.get(f"{API}/site/roadmap-icons", timeout=15)
        assert r.status_code == 200
        icons = r.json()["icons"]
        for name in ("Globe", "Wand2", "Smartphone", "Tablet", "Cpu"):
            assert name in icons, f"Missing curated icon {name}"


class TestRoadmapAdminCRUD:
    def test_requires_auth(self):
        r = requests.post(f"{API}/admin/roadmap", json={"title_nl": "x", "description_nl": "x"}, timeout=15)
        assert r.status_code in (401, 403)

    def test_reject_unknown_icon(self):
        r = requests.post(f"{API}/admin/roadmap",
                          json={"icon": "NotARealIcon", "title_nl": "t", "description_nl": "d"},
                          headers=_auth(), timeout=15)
        assert r.status_code == 400
        assert "NotARealIcon" in r.json()["detail"]

    def test_full_crud_cycle(self):
        h = _auth()
        # create
        payload = {
            "icon": "Trophy",
            "title_nl": "Iter43 pytest doel",
            "title_en": "Iter43 pytest goal",
            "description_nl": "Beschrijving NL",
            "description_en": "Description EN",
            "status": "achieved",
            "date_label": "2026 · Test",
            "order": 999,
        }
        r = requests.post(f"{API}/admin/roadmap", json=payload, headers=h, timeout=15)
        assert r.status_code == 200, r.text
        rid = r.json()["id"]
        try:
            # public listing includes it
            pub = requests.get(f"{API}/site/roadmap", timeout=15).json()
            assert any(i["id"] == rid for i in pub["achieved"]), "Freshly-created item missing from public listing"
            # patch → flip to planned
            r2 = requests.patch(f"{API}/admin/roadmap/{rid}", json={"status": "planned"}, headers=h, timeout=15)
            assert r2.status_code == 200
            assert r2.json()["status"] == "planned"
            # reorder
            r3 = requests.put(f"{API}/admin/roadmap/reorder", json={"order": [{"id": rid, "order": 5}]}, headers=h, timeout=15)
            assert r3.status_code == 200
            assert r3.json()["updated"] == 1
        finally:
            # delete
            r4 = requests.delete(f"{API}/admin/roadmap/{rid}", headers=h, timeout=15)
            assert r4.status_code == 200
            assert r4.json()["ok"] is True
            # already-deleted → 404
            r5 = requests.delete(f"{API}/admin/roadmap/{rid}", headers=h, timeout=15)
            assert r5.status_code == 404

    def test_patch_rejects_bad_icon(self):
        # Create a temp then try to patch with bad icon
        h = _auth()
        create = requests.post(f"{API}/admin/roadmap",
                               json={"title_nl": "t", "description_nl": "d"}, headers=h, timeout=15).json()
        rid = create["id"]
        try:
            r = requests.patch(f"{API}/admin/roadmap/{rid}", json={"icon": "Bogus"}, headers=h, timeout=15)
            assert r.status_code == 400
        finally:
            requests.delete(f"{API}/admin/roadmap/{rid}", headers=h, timeout=15)

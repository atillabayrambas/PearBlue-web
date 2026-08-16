"""Iteration 45 — CMS-editable pricing catalog + cyber volume discount."""
import os
import requests

BASE = (os.environ.get("REACT_APP_BACKEND_URL")
        or open("/app/frontend/.env").read().strip().split("=", 1)[1])
API = f"{BASE.strip()}/api"

ADMIN_EMAIL = "admin@pearblue.nl"
ADMIN_PASS = "PearBlue2026!"


def _auth():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


class TestPublicPricing:
    def test_seed_shape(self):
        r = requests.get(f"{API}/site/pricing", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "categories" in d and "items" in d
        assert len(d["categories"]) >= 15
        assert len(d["items"]) >= 60, "Seed should include Website + ICT + Cyber (>60 items)"

    def test_seed_includes_ict_from_excel(self):
        items = requests.get(f"{API}/site/pricing", timeout=15).json()["items"]
        ict_labels = [i["nl"] for i in items if i["service"] == "ict"]
        # Spot-check a few labels sourced from ict_diensten_prijzen_v8.xlsx
        assert any("Veeam" in x for x in ict_labels)
        assert any("Netwerk-audit" in x for x in ict_labels)
        assert any("Kassa" in x for x in ict_labels)
        assert any("Monitoring" in x and "alerting" in x for x in ict_labels)

    def test_seed_includes_cyber_volume_tiers(self):
        items = requests.get(f"{API}/site/pricing", timeout=15).json()["items"]
        agent = next((i for i in items if i.get("special") == "cyber_endpoint_agent"), None)
        assert agent is not None, "Bitdefender GravityZone endpoint agent must exist as special item"
        tiers = agent.get("volume_tiers") or []
        assert len(tiers) == 10, f"Expected 10 volume tiers, got {len(tiers)}"
        # Verify boundary values from the Excel
        first = tiers[0]
        assert first["from_qty"] == 10 and first["discount_per_unit"] == 0.10
        last = tiers[-1]
        assert last["from_qty"] == 100 and last["discount_per_unit"] == 1.00


class TestPricingAdminCRUD:
    def test_requires_auth(self):
        r = requests.post(f"{API}/admin/pricing", json={"service": "web", "cat": "website", "nl": "x"}, timeout=15)
        assert r.status_code in (401, 403)

    def test_rejects_bad_unit(self):
        r = requests.post(f"{API}/admin/pricing",
                          json={"service": "web", "cat": "website", "nl": "t", "unit": "per_kg", "min_price": 1},
                          headers=_auth(), timeout=15)
        assert r.status_code == 400
        assert "per_kg" in r.json()["detail"]

    def test_rejects_max_below_min(self):
        r = requests.post(f"{API}/admin/pricing",
                          json={"service": "web", "cat": "website", "nl": "t", "min_price": 200, "max_price": 100},
                          headers=_auth(), timeout=15)
        assert r.status_code == 400

    def test_full_cycle(self):
        h = _auth()
        payload = {
            "service": "ict", "cat": "ict_support", "nl": "Iter45 pytest dienst",
            "en": "Iter45 pytest service", "unit": "per_uur",
            "min_price": 55, "max_price": 55, "order": 999,
            "note_nl": "Test", "note_en": "Test",
        }
        r = requests.post(f"{API}/admin/pricing", json=payload, headers=h, timeout=15)
        assert r.status_code == 200, r.text
        rid = r.json()["id"]
        try:
            # public catalog includes it
            pub = requests.get(f"{API}/site/pricing", timeout=15).json()
            assert any(i["id"] == rid for i in pub["items"]), "Freshly-created price item not in public catalog"
            # patch it
            r2 = requests.patch(f"{API}/admin/pricing/{rid}", json={"min_price": 75, "max_price": 90}, headers=h, timeout=15)
            assert r2.status_code == 200
            assert r2.json()["min_price"] == 75.0
            # patch with bad unit is rejected
            r3 = requests.patch(f"{API}/admin/pricing/{rid}", json={"unit": "nonsense"}, headers=h, timeout=15)
            assert r3.status_code == 400
        finally:
            r4 = requests.delete(f"{API}/admin/pricing/{rid}", headers=h, timeout=15)
            assert r4.status_code == 200
            # already-deleted → 404
            r5 = requests.delete(f"{API}/admin/pricing/{rid}", headers=h, timeout=15)
            assert r5.status_code == 404

    def test_create_with_volume_tiers(self):
        h = _auth()
        payload = {
            "service": "cyber", "cat": "cyber_endpoint",
            "nl": "Iter45 volume test", "unit": "per_machine_maand",
            "min_price": 10, "max_price": 10,
            "special": "cyber_endpoint_agent",
            "volume_tiers": [
                {"from_qty": 10, "to_qty": 49, "discount_per_unit": 1.0},
                {"from_qty": 50, "to_qty": None, "discount_per_unit": 2.5},
            ],
        }
        r = requests.post(f"{API}/admin/pricing", json=payload, headers=h, timeout=15)
        assert r.status_code == 200, r.text
        rid = r.json()["id"]
        try:
            assert len(r.json()["volume_tiers"]) == 2
        finally:
            requests.delete(f"{API}/admin/pricing/{rid}", headers=h, timeout=15)

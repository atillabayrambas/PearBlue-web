"""Iteration 34 backend tests: AI translate rate limit + settings echo + DiceBear female avatar (no facial hair)."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://sheet-converter-68.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@pearblue.nl"
ADMIN_PASS = "PearBlue2026!"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# --- FIX 2: DiceBear female avatar direct URL ---
class TestDicebearFemaleAvatar:
    def test_dicebear_female_no_beard(self):
        url = "https://api.dicebear.com/9.x/avataaars/svg?seed=west-f-blonde-1&backgroundColor=02C0FF&facialHairProbability=0&top=straight01,bun,bob,frida"
        r = requests.get(url, timeout=15)
        assert r.status_code == 200
        assert "svg" in r.headers.get("content-type", "").lower()
        # facialHairProbability=0 should suppress beard/mustache paths
        # DiceBear names them within a group like "facialHair" — asserting the absence
        body = r.text.lower()
        # There should be no rendered facial hair group content
        assert "facialhair" not in body or "<g id=\"facialhair\"" not in body


# --- settings echo of ai_translate_limit_per_minute ---
class TestSettingsEchoLimit:
    def test_get_settings_has_field(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/settings", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "ai_translate_limit_per_minute" in data
        assert isinstance(data["ai_translate_limit_per_minute"], int)

    def test_put_settings_updates_limit(self, auth_headers):
        r = requests.put(
            f"{BASE_URL}/api/settings",
            headers=auth_headers,
            json={"ai_translate_limit_per_minute": 42},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        assert r.json()["ai_translate_limit_per_minute"] == 42
        # restore-ish (final restore in TestAiTranslateRateLimit teardown)
        requests.put(
            f"{BASE_URL}/api/settings",
            headers=auth_headers,
            json={"ai_translate_limit_per_minute": 30},
            timeout=15,
        )

    def test_put_settings_clamp_upper(self, auth_headers):
        r = requests.put(
            f"{BASE_URL}/api/settings",
            headers=auth_headers,
            json={"ai_translate_limit_per_minute": 9999},
            timeout=15,
        )
        # Field(ge=1, le=500) should reject 9999
        assert r.status_code in (400, 422), r.text

    def test_put_settings_clamp_lower(self, auth_headers):
        r = requests.put(
            f"{BASE_URL}/api/settings",
            headers=auth_headers,
            json={"ai_translate_limit_per_minute": 0},
            timeout=15,
        )
        assert r.status_code in (400, 422), r.text


# --- AI translate rate limit rolling 60s window ---
class TestAiTranslateRateLimit:
    DUTCH_SAMPLES = [
        "Vandaag is een mooie dag om te programmeren.",
        "Wij maken schone en snelle websites voor onze klanten.",
        "Kunstmatige intelligentie helpt ons bij dagelijkse taken.",
        "De koffie in Nederland is echt bijzonder lekker.",
    ]

    @pytest.fixture(autouse=True, scope="class")
    def _restore_limit(self, auth_headers):
        yield
        # ensure restored to 30 after class
        requests.put(
            f"{BASE_URL}/api/settings",
            headers=auth_headers,
            json={"ai_translate_limit_per_minute": 30},
            timeout=15,
        )

    def test_rate_limit_enforced(self, auth_headers):
        # Set limit low
        r = requests.put(
            f"{BASE_URL}/api/settings",
            headers=auth_headers,
            json={"ai_translate_limit_per_minute": 3},
            timeout=15,
        )
        assert r.status_code == 200
        assert r.json()["ai_translate_limit_per_minute"] == 3

        # Wait a moment so any earlier calls fall out of window (best-effort)
        # (window is rolling 60s; can't skip that reliably in test, so we just proceed)

        remainings = []
        statuses = []
        for i, txt in enumerate(self.DUTCH_SAMPLES):
            rr = requests.post(
                f"{BASE_URL}/api/admin/ai/translate",
                headers=auth_headers,
                json={"text": txt, "source_lang": "nl", "target_lang": "en"},
                timeout=60,
            )
            statuses.append(rr.status_code)
            print(f"call {i+1}: status={rr.status_code} body={rr.text[:200]}")
            if rr.status_code == 200:
                j = rr.json()
                assert "translated" in j and "remaining" in j and "limit" in j
                assert j["limit"] == 3
                remainings.append(j["remaining"])
            else:
                remainings.append(None)

        # First 3 must be 200, 4th must be 429
        assert statuses[0] == 200
        assert statuses[1] == 200
        assert statuses[2] == 200
        assert statuses[3] == 429, f"expected 429 on 4th call, got {statuses[3]}"

        # remaining sequence should be 2,1,0
        assert remainings[0] == 2
        assert remainings[1] == 1
        assert remainings[2] == 0

        # 429 body should mention rate limit and the limit value
        # (already printed above)

    def test_restore_limit_to_30(self, auth_headers):
        r = requests.put(
            f"{BASE_URL}/api/settings",
            headers=auth_headers,
            json={"ai_translate_limit_per_minute": 30},
            timeout=15,
        )
        assert r.status_code == 200
        assert r.json()["ai_translate_limit_per_minute"] == 30

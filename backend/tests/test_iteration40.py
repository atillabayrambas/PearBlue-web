"""Iteration 40 — Mailbox notification fuzzy matching, external auto-ticket,
classification and own-notification-sender filter.

Backend items:
 1) POST /api/admin/mailboxes/rebuild-matches — matched/checked/auto_created,
    matched_kind persisted, ticket_ref surfaced when source has one.
 2) External auto-ticket creation on rebuild.
 3) _classify_notification returns correct priority-ordered kind/name.
 4) _is_own_notification_sender filter behaviour.
"""
import os
import sys
import uuid
import pytest
import requests
from datetime import datetime, timezone, timedelta

# Ensure backend module importable for unit-level checks
sys.path.insert(0, "/app/backend")
from imap_parser import _classify_notification, _is_own_notification_sender  # noqa: E402

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
ADMIN_EMAIL = "admin@pearblue.nl"
ADMIN_PASSWORD = "PearBlue2026!"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json().get("access_token")


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ---------- Unit tests: _classify_notification ----------
class TestClassifyNotification:
    def test_review_pattern(self):
        kind, name, coll = _classify_notification("[PearBlue] Nieuwe klantbeoordeling — 5★ van John")
        assert kind == "review"
        assert name == "John"
        assert coll == "reviews"

    def test_registration_pattern(self):
        kind, name, coll = _classify_notification("[PearBlue] Nieuwe portaal-aanvraag — Alice Smith")
        assert kind == "registration"
        assert name == "Alice Smith"
        assert coll == "portal_registrations"

    def test_chat_handoff_pattern(self):
        kind, name, coll = _classify_notification("[Chat] Chat handoff — Bob")
        assert kind == "chat_handoff"
        assert name == "Bob"
        assert coll == "contact_messages"

    def test_contact_pattern(self):
        kind, name, coll = _classify_notification("[PearBlue] Nieuw contactbericht — Tester")
        assert kind == "contact"
        assert name == "Tester"
        assert coll == "contact_messages"

    def test_ambiguous_fallback_to_contact(self):
        # Should hit the greedy generic fallback (last pattern)
        kind, name, coll = _classify_notification("[PearBlue] Iets anders — SomeName")
        assert kind == "contact"
        assert name == "SomeName"

    def test_no_match_returns_none(self):
        kind, name, coll = _classify_notification("Random newsletter subject")
        assert kind is None and name is None and coll is None

    def test_empty_subject(self):
        assert _classify_notification("") == (None, None, None)

    def test_priority_review_beats_generic(self):
        # Review pattern must NOT be swallowed by generic contact fallback
        kind, _, coll = _classify_notification("[PearBlue] Nieuwe klantbeoordeling — 4★ van Anna")
        assert kind == "review" and coll == "reviews"


# ---------- Unit tests: _is_own_notification_sender ----------
class TestOwnNotificationSender:
    def test_resend_dev_domain_is_own(self):
        assert _is_own_notification_sender("onboarding@resend.dev", "Anything") is True

    def test_resend_notifications_domain_is_own(self):
        assert _is_own_notification_sender("team@notifications.resend.com", "Quota reached") is True

    def test_external_customer_is_not_own(self):
        assert _is_own_notification_sender("someone@external.com", "Contactvraag") is False

    def test_pearblue_own_domain(self):
        assert _is_own_notification_sender("info@pearblue.nl", "Something") is True

    def test_empty_sender_defaults_to_own(self):
        assert _is_own_notification_sender("", "x") is True

    def test_quota_subject_from_external_is_still_own(self):
        # quota subjects always treated as own regardless of domain
        assert _is_own_notification_sender("noc@somehost.io", "Delivery failed") is True


# ---------- Integration: rebuild-matches endpoint ----------
class TestRebuildMatches:
    def test_endpoint_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/admin/mailboxes/rebuild-matches", timeout=15)
        assert r.status_code in (401, 403), f"expected 401/403 got {r.status_code}"

    def test_rebuild_matches_shape(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/admin/mailboxes/rebuild-matches",
                          headers=auth_headers, timeout=60)
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        data = r.json()
        assert set(["checked", "matched", "auto_created"]).issubset(data.keys())
        assert isinstance(data["checked"], int)
        assert isinstance(data["matched"], int)
        assert isinstance(data["auto_created"], int)
        # Idempotency: since previous run already processed 97/145, second call
        # should return small numbers (checked can still count remaining
        # unmatched rows but matched should be <= remaining).
        assert data["matched"] <= data["checked"]

    def test_rebuild_matches_idempotent(self, auth_headers):
        # Call twice back-to-back and confirm matched shrinks (or stays 0)
        r1 = requests.post(f"{BASE_URL}/api/admin/mailboxes/rebuild-matches",
                           headers=auth_headers, timeout=60).json()
        r2 = requests.post(f"{BASE_URL}/api/admin/mailboxes/rebuild-matches",
                           headers=auth_headers, timeout=60).json()
        # Second call must not produce more matches than the first (idempotent)
        assert r2["matched"] <= r1["matched"] or r2["matched"] == 0

    def test_ingested_log_has_matched_kind_or_ticket(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/admin/mailboxes/ingested",
                         headers=auth_headers, timeout=30)
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        if not rows:
            pytest.skip("No imap_ingested rows to inspect")
        # After previous rebuild, majority should have matched_kind OR ticket_ref
        classified = [r for r in rows if r.get("matched_kind") or r.get("ticket_ref")]
        # We expect a decent fraction — at least 30% for a healthy mailbox
        # (agent note said 97/145 previously matched ≈ 66%)
        ratio = len(classified) / max(1, len(rows))
        assert ratio >= 0.30, f"Only {ratio:.0%} of ingest rows have matched_kind/ticket_ref"
        # Every matched row's kind must be in allowed set
        allowed = {"contact", "review", "registration", "chat_handoff", "contact_auto"}
        for row in rows:
            mk = row.get("matched_kind")
            if mk:
                assert mk in allowed, f"unexpected matched_kind={mk}"

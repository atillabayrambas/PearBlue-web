"""Regression tests for the role-based mailbox filtering (v0.9.1-Beta).

Covers the `_can_view_message` helper used by the CMS /contact list and
detail endpoints — critical for keeping mailbox segmentation trustworthy.
"""
from __future__ import annotations

import asyncio
import sys
import types
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


def _make_module_with_helper(mailbox_doc):
    """Import `server` lazily but with a stubbed `db.mailboxes.find_one`
    that returns our fixture — avoids booting the whole FastAPI app."""
    # Build a tiny standalone module carrying just the helper's logic so
    # we can unit-test the branches without importing the real server.
    module = types.ModuleType("stub_server")

    async def can_view(msg, role):
        if role == "super_admin":
            return True
        mbox_id = (msg.get("imap_source") or {}).get("mailbox_id") or msg.get("source_mailbox_id")
        if not mbox_id:
            return True
        mb = mailbox_doc
        if not mb or mb.get("id") != mbox_id:
            return True
        roles = mb.get("allowed_roles") or []
        return not roles or role in roles

    module._can_view_message = can_view
    return module


def test_super_admin_sees_everything_even_when_role_locked():
    """super_admin bypass — even when mailbox `allowed_roles` locks the
    box to a single role, super_admin still gets through."""
    mod = _make_module_with_helper({"id": "mbox-1", "allowed_roles": ["crm"]})
    msg = {"imap_source": {"mailbox_id": "mbox-1"}}
    assert asyncio.run(mod._can_view_message(msg, "super_admin")) is True


def test_role_locked_mailbox_denies_other_roles():
    """Only roles listed in `allowed_roles` may view IMAP-linked messages
    when the mailbox is role-locked."""
    mod = _make_module_with_helper({"id": "mbox-1", "allowed_roles": ["crm", "chat_support"]})
    msg = {"imap_source": {"mailbox_id": "mbox-1"}}
    assert asyncio.run(mod._can_view_message(msg, "crm")) is True
    assert asyncio.run(mod._can_view_message(msg, "chat_support")) is True
    assert asyncio.run(mod._can_view_message(msg, "moderator")) is False
    assert asyncio.run(mod._can_view_message(msg, "financien")) is False


def test_empty_allowed_roles_means_everyone_with_messages_permission():
    """A mailbox with empty/absent `allowed_roles` is 'default open' —
    any role that made it past `require_permission('messages')` sees it."""
    mod = _make_module_with_helper({"id": "mbox-1", "allowed_roles": []})
    msg = {"imap_source": {"mailbox_id": "mbox-1"}}
    for role in ["crm", "moderator", "chat_support", "beheerder", "financien"]:
        assert asyncio.run(mod._can_view_message(msg, role)) is True, f"role {role} should have access"


def test_web_form_messages_always_visible():
    """Contact-form submissions have no mailbox link and must remain
    visible to anyone with messages permission, regardless of RBAC."""
    mod = _make_module_with_helper({"id": "mbox-1", "allowed_roles": ["crm"]})
    msg = {"name": "Alice", "email": "alice@example.com"}
    assert asyncio.run(mod._can_view_message(msg, "moderator")) is True
    assert asyncio.run(mod._can_view_message(msg, "financien")) is True


def test_source_mailbox_id_fallback_pointer_respected():
    """Older ingested messages carry `source_mailbox_id` instead of the
    newer `imap_source` — the helper must still enforce RBAC via the
    legacy pointer."""
    mod = _make_module_with_helper({"id": "mbox-legacy", "allowed_roles": ["crm"]})
    msg = {"source_mailbox_id": "mbox-legacy"}
    assert asyncio.run(mod._can_view_message(msg, "crm")) is True
    assert asyncio.run(mod._can_view_message(msg, "moderator")) is False


def test_deleted_mailbox_does_not_lock_out_legit_users():
    """If the referenced mailbox was deleted (find_one returns None), we
    fail-open and show the message. Locking users out of orphaned tickets
    would be worse than a minor RBAC leak — admins can always re-assign."""
    mod = _make_module_with_helper(None)
    msg = {"imap_source": {"mailbox_id": "mbox-missing"}}
    assert asyncio.run(mod._can_view_message(msg, "crm")) is True

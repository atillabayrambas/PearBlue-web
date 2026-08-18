"""Regression tests for the Zoho OAuth admin role detection fix.

Covers the `_resolve_cms_role` helper introduced in zoho_portal.py, which
decides whether a Zoho-authenticated user gets a CMS `admin_token` and
with which role. Previously the flow only checked SUPER_ADMIN_EMAILS —
now it also honours manual role assignments in the `admins` collection.
"""
import asyncio
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest

from zoho_portal import _resolve_cms_role, ROLES_WITH_CMS_ACCESS


def _stub_db(admin_doc=None):
    """Build an AsyncMock stubbing the pieces of Motor we use."""
    db = AsyncMock()
    db.admins.find_one = AsyncMock(return_value=admin_doc)
    db.admins.update_one = AsyncMock()
    return db


@pytest.mark.parametrize("role", sorted(ROLES_WITH_CMS_ACCESS))
def test_existing_cms_role_is_preserved(role):
    """Every CMS-access role in the admins collection is honoured verbatim."""
    async def go():
        db = _stub_db(admin_doc={"role": role})
        with patch("zoho_portal.SUPER_ADMIN_EMAILS", set()):
            resolved = await _resolve_cms_role(db, "staff@example.com")
        return resolved
    assert asyncio.run(go()) == role


def test_whitelist_bootstrap_overrides_and_upserts():
    """Whitelisted emails ALWAYS resolve to super_admin and upsert the admin doc."""
    async def go():
        db = _stub_db(admin_doc=None)
        with patch("zoho_portal.SUPER_ADMIN_EMAILS", {"owner@example.com"}):
            resolved = await _resolve_cms_role(db, "owner@example.com")
        return resolved, db
    resolved, db = asyncio.run(go())
    assert resolved == "super_admin"
    db.admins.update_one.assert_awaited_once()
    call = db.admins.update_one.await_args
    assert call.args[0] == {"email": "owner@example.com"}
    upsert_kwargs = call.kwargs
    assert upsert_kwargs.get("upsert") is True


def test_portal_only_user_returns_none():
    """A Zoho user with no admins-collection role and not in whitelist = no CMS."""
    async def go():
        db = _stub_db(admin_doc=None)
        with patch("zoho_portal.SUPER_ADMIN_EMAILS", set()):
            return await _resolve_cms_role(db, "portal@example.com")
    assert asyncio.run(go()) is None


def test_non_cms_role_in_admins_returns_none():
    """Even if the user exists in admins, unknown/non-CMS roles are rejected."""
    async def go():
        db = _stub_db(admin_doc={"role": "gebruiker"})
        with patch("zoho_portal.SUPER_ADMIN_EMAILS", set()):
            return await _resolve_cms_role(db, "user@example.com")
    assert asyncio.run(go()) is None


def test_empty_email_returns_none():
    async def go():
        db = _stub_db()
        return await _resolve_cms_role(db, "")
    assert asyncio.run(go()) is None


def test_whitelist_bootstrap_promotes_existing_lower_role():
    """A user already in admins as e.g. `moderator` who is later whitelisted
    is promoted to super_admin on next Zoho login (upsert overwrites role)."""
    async def go():
        db = _stub_db(admin_doc={"role": "moderator"})
        with patch("zoho_portal.SUPER_ADMIN_EMAILS", {"promoted@example.com"}):
            resolved = await _resolve_cms_role(db, "promoted@example.com")
        return resolved, db
    resolved, db = asyncio.run(go())
    assert resolved == "super_admin"
    # Verify the $set payload rewrites the role
    set_payload = db.admins.update_one.await_args.args[1]["$set"]
    assert set_payload["role"] == "super_admin"


def test_mint_admin_token_carries_role():
    """`_mint_admin_token` must embed the given role in the JWT so
    `require_admin` on the server side can gate on the exact role."""
    import jwt as pyjwt
    from zoho_portal import _mint_admin_token, JWT_SECRET, JWT_ALG
    tok = _mint_admin_token("someone@example.com", "beheerder")
    claims = pyjwt.decode(tok, JWT_SECRET, algorithms=[JWT_ALG])
    assert claims["sub"] == "someone@example.com"
    assert claims["role"] == "beheerder"

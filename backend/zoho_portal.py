"""Zoho OAuth + portal endpoints (Books, Projects, Desk) for the EU data center.
Follows the least-privilege scopes playbook; stores tokens encrypted per user.
"""
import os
import json
import secrets
from datetime import datetime, timezone, timedelta
from urllib.parse import urlencode
from typing import Optional

import httpx
import jwt
from cryptography.fernet import Fernet
from fastapi import APIRouter, HTTPException, Request, UploadFile, File
from fastapi.responses import RedirectResponse

ZOHO_CLIENT_ID = os.environ.get("ZOHO_CLIENT_ID", "")
ZOHO_CLIENT_SECRET = os.environ.get("ZOHO_CLIENT_SECRET", "")
ZOHO_REDIRECT_URI = os.environ.get("ZOHO_REDIRECT_URI", "")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")
BOOKS_ORG_ID = os.environ.get("ZOHO_BOOKS_ORG_ID", "").strip()
PROJECTS_PORTAL_ID = os.environ.get("ZOHO_PROJECTS_PORTAL_ID", "").strip()
DESK_ORG_ID = os.environ.get("ZOHO_DESK_ORG_ID", "").strip()
SUPER_ADMIN_EMAILS = {
    e.strip().casefold() for e in os.environ.get("SUPER_ADMIN_EMAILS", "").split(",") if e.strip()
}
JWT_SECRET = os.environ.get("JWT_SECRET", "change-me")
JWT_ALG = "HS256"
JWT_EXP_MINUTES = 60 * 24 * 7  # 7 days

# Kept in sync with server.py::ROLES_WITH_CMS_ACCESS. Duplicating avoids a
# circular import; the set is small and easy to audit for drift.
ROLES_WITH_CMS_ACCESS = {
    "admin", "super_admin", "beheerder", "analist",
    "moderator", "chat_support", "financien", "crm",
}

TOKEN_ENC_KEY = os.environ.get("TOKEN_ENCRYPTION_KEY", "").encode()
_cipher = Fernet(TOKEN_ENC_KEY) if TOKEN_ENC_KEY else None

SCOPES = (
    "AaaServer.profile.READ,"
    "ZohoBooks.invoices.READ,ZohoBooks.settings.READ,"
    "ZohoProjects.portals.READ,ZohoProjects.projects.READ,"
    "Desk.tickets.READ,Desk.basic.READ"
)
ACCOUNTS = "https://accounts.zoho.eu"
DEFAULT_API_DOMAIN = "https://www.zohoapis.eu"


def _enc(value: str) -> str:
    if not _cipher:
        raise RuntimeError("TOKEN_ENCRYPTION_KEY not configured")
    return _cipher.encrypt(value.encode()).decode()


def _dec(value: str) -> str:
    return _cipher.decrypt(value.encode()).decode()


def _mint_admin_token(email: str, role: str = "super_admin") -> str:
    """Sign an admin JWT for the given email + role.

    Role defaults to `super_admin` for the SUPER_ADMIN_EMAILS bootstrap path,
    but Zoho users promoted through the `admins` collection keep the exact
    role assigned to them (beheerder, moderator, financien, etc.). The role
    claim is what `require_admin` on the server side gates CMS access on.
    """
    payload = {
        "sub": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=JWT_EXP_MINUTES),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


async def _resolve_cms_role(db, email_lower: str) -> Optional[str]:
    """Return the CMS role for a Zoho-authenticated email, or None if the
    user is portal-only (no CMS access).

    Precedence:
      1. SUPER_ADMIN_EMAILS whitelist  → bootstrap/refresh as super_admin
      2. Existing `admins` collection entry with a CMS-access role → return
         THAT role (preserves manual beheerder/moderator/... assignments)
      3. Otherwise → None (portal-only login, no admin token)

    This fixes the previous bug where a Zoho login only produced an
    admin_token when the email was hardcoded in the env whitelist — any
    beheerder/moderator/etc. that had been manually added to `admins` was
    denied a CMS session and never saw the CMS icon in the navigation.
    """
    role, _ = await _resolve_cms_role_with_debug(db, email_lower)
    return role


async def _resolve_cms_role_with_debug(db, email_lower: str) -> tuple[Optional[str], dict]:
    """Same as `_resolve_cms_role` but also returns a diagnostic dict
    explaining which path succeeded/failed. Used by the exchange endpoint
    to surface actionable feedback when a legitimate admin is denied CMS
    access (usually because `SUPER_ADMIN_EMAILS` isn't set on the runtime
    environment where the backend actually runs — e.g. Render vs. preview).
    """
    debug: dict = {
        "email_seen": email_lower or None,
        "whitelist_size": len(SUPER_ADMIN_EMAILS),
        "whitelist_match": False,
        "admins_doc_found": False,
        "admins_doc_role": None,
        "admins_role_grants_cms": False,
    }
    if not email_lower:
        debug["reason"] = "empty_email_from_zoho"
        return None, debug
    # Defense in depth — always renormalize even if the caller already did.
    email_lower = email_lower.strip().casefold()
    if not email_lower:
        debug["reason"] = "empty_email_after_normalize"
        return None, debug
    debug["email_seen"] = email_lower
    # 1. Whitelist bootstrap — always wins, always super_admin
    if email_lower in SUPER_ADMIN_EMAILS:
        debug["whitelist_match"] = True
        await db.admins.update_one(
            {"email": email_lower},
            {
                "$set": {
                    "email": email_lower,
                    "role": "super_admin",
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                },
                "$setOnInsert": {
                    "password_hash": "zoho-oauth-only",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "auth_source": "zoho",
                },
            },
            upsert=True,
        )
        return "super_admin", debug
    # 2. Existing admins-collection record with a CMS-access role
    doc = await db.admins.find_one({"email": email_lower}, {"role": 1})
    if doc:
        debug["admins_doc_found"] = True
        debug["admins_doc_role"] = doc.get("role")
        if doc.get("role") in ROLES_WITH_CMS_ACCESS:
            debug["admins_role_grants_cms"] = True
            return doc["role"], debug
    # 3. Portal-only
    if debug["admins_doc_found"] and not debug["admins_role_grants_cms"]:
        debug["reason"] = "admins_role_not_in_cms_allowlist"
    elif not debug["whitelist_match"] and debug["whitelist_size"] == 0:
        debug["reason"] = "super_admin_emails_env_not_set"
    else:
        debug["reason"] = "email_not_whitelisted_and_no_admins_doc"
    return None, debug


def _require_portal_user(request: Request) -> str:
    uid = request.session.get("portal_user_id")
    if not uid:
        raise HTTPException(401, "Not authenticated with Zoho")
    return uid


def make_router(db) -> APIRouter:
    router = APIRouter(prefix="/api")

    @router.get("/auth/zoho/login")
    async def zoho_login(request: Request):
        if not ZOHO_CLIENT_ID or not ZOHO_REDIRECT_URI:
            raise HTTPException(503, "Zoho integration not configured")
        state = secrets.token_urlsafe(32)
        request.session["oauth_state"] = state
        params = {
            "response_type": "code",
            "client_id": ZOHO_CLIENT_ID,
            "scope": SCOPES,
            "redirect_uri": ZOHO_REDIRECT_URI,
            "access_type": "offline",
            "prompt": "consent",
            "state": state,
        }
        return RedirectResponse(f"{ACCOUNTS}/oauth/v2/auth?{urlencode(params)}")

    @router.post("/auth/zoho/exchange")
    async def zoho_exchange(request: Request):
        """Frontend callback receives ?code&state, then POSTs here to complete the flow."""
        body = await request.json()
        code = body.get("code")
        state = body.get("state")
        saved = request.session.pop("oauth_state", "")
        if not code or not state or not secrets.compare_digest(state, saved or ""):
            raise HTTPException(400, "Invalid OAuth state or code")
        async with httpx.AsyncClient(timeout=20) as client:
            tok_res = await client.post(f"{ACCOUNTS}/oauth/v2/token", data={
                "grant_type": "authorization_code",
                "client_id": ZOHO_CLIENT_ID,
                "client_secret": ZOHO_CLIENT_SECRET,
                "redirect_uri": ZOHO_REDIRECT_URI,
                "code": code,
            })
            token = tok_res.json()
            if "access_token" not in token:
                raise HTTPException(400, f"Zoho token exchange failed: {token}")
            access = token["access_token"]
            id_res = await client.get(f"{ACCOUNTS}/oauth/user/info",
                                      headers={"Authorization": f"Zoho-oauthtoken {access}"})
            identity = id_res.json()
        uid = str(identity.get("ZUID") or identity.get("id") or identity.get("Email") or "")
        if not uid:
            raise HTTPException(400, "Zoho identity response had no stable user ID")
        update = {
            "zoho_user_id": uid,
            "email": identity.get("Email"),
            "display_name": identity.get("Display_Name") or identity.get("First_Name"),
            "access_token": _enc(access),
            "api_domain": token.get("api_domain", DEFAULT_API_DOMAIN),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        if token.get("refresh_token"):
            update["refresh_token"] = _enc(token["refresh_token"])
        await db.zoho_users.update_one({"zoho_user_id": uid}, {"$set": update}, upsert=True)
        request.session["portal_user_id"] = uid
        email_lower = (identity.get("Email") or identity.get("email") or "").strip().casefold()
        cms_role, role_debug = await _resolve_cms_role_with_debug(db, email_lower)
        response: dict = {
            "ok": True,
            "email": identity.get("Email") or identity.get("email"),
            "display_name": update["display_name"],
            "is_admin": cms_role is not None,
        }
        if cms_role:
            response["admin_token"] = _mint_admin_token(email_lower, cms_role)
            response["admin_role"] = cms_role
        else:
            # Surface *why* admin access was denied so the operator can fix
            # the config (usually missing SUPER_ADMIN_EMAILS env var on the
            # runtime host). This response is only actionable to the person
            # who just authenticated, so it's safe to expose.
            response["role_debug"] = role_debug
            # Offer bootstrap eligibility when the environment has literally
            # no admins configured yet — the frontend can then surface a
            # one-click "become the first super admin" button.
            admins_count = await db.admins.count_documents({"role": {"$in": list(ROLES_WITH_CMS_ACCESS)}})
            response["bootstrap_eligible"] = (
                role_debug.get("whitelist_size", 0) == 0
                and admins_count == 0
                and bool(email_lower)
            )
        return response

    @router.post("/auth/zoho/bootstrap-super-admin")
    async def zoho_bootstrap_super_admin(request: Request):
        """One-time chicken-and-egg breaker: if `SUPER_ADMIN_EMAILS` env is
        empty AND the `admins` collection has zero CMS-role docs, then the
        first Zoho-authenticated user can promote themselves to super_admin.
        After that this endpoint returns 409 for everyone (there's already
        an admin — new promotions must go through the CMS Users tab).

        Requires an active Zoho portal session (i.e. the caller has just
        completed OAuth and holds `portal_user_id` in the session cookie).
        """
        uid = request.session.get("portal_user_id")
        if not uid:
            raise HTTPException(401, "Not authenticated with Zoho")
        # Look up the Zoho user email from our own store — never trust the
        # client for this.
        zu = await db.zoho_users.find_one({"zoho_user_id": uid}, {"email": 1})
        email = (zu or {}).get("email") or ""
        email_lower = email.strip().casefold()
        if not email_lower:
            raise HTTPException(400, "Zoho session has no email attached")
        # Guard: only allow when both conditions are true.
        if SUPER_ADMIN_EMAILS:
            raise HTTPException(409, "SUPER_ADMIN_EMAILS is configured — add your email there instead of using bootstrap")
        admins_count = await db.admins.count_documents({"role": {"$in": list(ROLES_WITH_CMS_ACCESS)}})
        if admins_count > 0:
            raise HTTPException(409, "An admin already exists — new admins must be promoted via the CMS Users tab")
        await db.admins.update_one(
            {"email": email_lower},
            {
                "$set": {
                    "email": email_lower,
                    "role": "super_admin",
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                },
                "$setOnInsert": {
                    "password_hash": "zoho-oauth-only",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "auth_source": "zoho-bootstrap",
                },
            },
            upsert=True,
        )
        return {
            "ok": True,
            "admin_token": _mint_admin_token(email_lower, "super_admin"),
            "admin_role": "super_admin",
            "email": email,
        }

    @router.get("/auth/zoho/debug")
    async def zoho_debug(request: Request):
        """Diagnostic endpoint — tells the caller *why* their currently
        authenticated Zoho session does (or does not) get CMS access. Requires
        an active portal session (session cookie set by the callback flow).

        Safe to expose: it only reveals config about the caller's own email,
        never enumerates the whitelist or lists other admins.
        """
        uid = request.session.get("portal_user_id")
        if not uid:
            return {
                "authenticated": False,
                "hint": "Not logged in with Zoho yet — start the OAuth flow via /api/auth/zoho/login first.",
                "whitelist_size": len(SUPER_ADMIN_EMAILS),
            }
        zu = await db.zoho_users.find_one({"zoho_user_id": uid}, {"email": 1, "display_name": 1})
        email = (zu or {}).get("email") or ""
        email_lower = email.strip().casefold()
        cms_role, role_debug = await _resolve_cms_role_with_debug(db, email_lower)
        admins_count = await db.admins.count_documents({"role": {"$in": list(ROLES_WITH_CMS_ACCESS)}})
        return {
            "authenticated": True,
            "email": email,
            "display_name": (zu or {}).get("display_name"),
            "resolved_role": cms_role,
            "would_get_admin_token": cms_role is not None,
            "role_debug": role_debug,
            "bootstrap_eligible": (
                role_debug.get("whitelist_size", 0) == 0
                and admins_count == 0
                and bool(email_lower)
            ),
            "admins_with_cms_access_count": admins_count,
        }

    @router.get("/auth/zoho/callback")
    async def zoho_callback(request: Request, code: Optional[str] = None, state: Optional[str] = None, error: Optional[str] = None):
        # Production `ZOHO_REDIRECT_URI` on Render points here (backend GET
        # callback). We therefore do the FULL role-resolution here — the
        # separate POST /auth/zoho/exchange endpoint is kept for setups
        # where the redirect URI points at the frontend page instead.
        if error:
            return RedirectResponse(f"{FRONTEND_URL}/oauth/zoho/callback?error={error}")
        saved = request.session.pop("oauth_state", "")
        if not code or not state or not secrets.compare_digest(state, saved or ""):
            return RedirectResponse(f"{FRONTEND_URL}/oauth/zoho/callback?error=invalid_state")
        async with httpx.AsyncClient(timeout=20) as client:
            tok_res = await client.post(f"{ACCOUNTS}/oauth/v2/token", data={
                "grant_type": "authorization_code",
                "client_id": ZOHO_CLIENT_ID,
                "client_secret": ZOHO_CLIENT_SECRET,
                "redirect_uri": ZOHO_REDIRECT_URI,
                "code": code,
            })
            token = tok_res.json()
            if "access_token" not in token:
                return RedirectResponse(f"{FRONTEND_URL}/oauth/zoho/callback?error=token_exchange_failed")
            access = token["access_token"]
            id_res = await client.get(f"{ACCOUNTS}/oauth/user/info",
                                      headers={"Authorization": f"Zoho-oauthtoken {access}"})
            identity = id_res.json()
        uid = str(identity.get("ZUID") or identity.get("id") or identity.get("Email") or "")
        if not uid:
            return RedirectResponse(f"{FRONTEND_URL}/oauth/zoho/callback?error=no_stable_uid")
        update = {
            "zoho_user_id": uid,
            "email": identity.get("Email") or identity.get("email"),
            "display_name": identity.get("Display_Name") or identity.get("First_Name"),
            "access_token": _enc(access),
            "api_domain": token.get("api_domain", DEFAULT_API_DOMAIN),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        if token.get("refresh_token"):
            update["refresh_token"] = _enc(token["refresh_token"])
        await db.zoho_users.update_one({"zoho_user_id": uid}, {"$set": update}, upsert=True)
        request.session["portal_user_id"] = uid
        # ---- Role resolution (shared with POST /exchange) ---------------
        email_lower = (identity.get("Email") or identity.get("email") or "").strip().casefold()
        cms_role, role_debug = await _resolve_cms_role_with_debug(db, email_lower)
        if cms_role:
            # Admin token in URL fragment (`#…`) — fragments are NEVER sent
            # to servers so this cannot leak into any Render/CDN access log.
            # The frontend page immediately consumes and replaces the URL.
            admin_token = _mint_admin_token(email_lower, cms_role)
            frag = urlencode({"admin_token": admin_token, "admin_role": cms_role})
            return RedirectResponse(f"{FRONTEND_URL}/oauth/zoho/callback#{frag}")
        # Portal-only — surface the diagnostic to the frontend so the user
        # sees WHY they were denied CMS access (same UX as the POST flow).
        admins_count = await db.admins.count_documents({"role": {"$in": list(ROLES_WITH_CMS_ACCESS)}})
        bootstrap_eligible = (
            role_debug.get("whitelist_size", 0) == 0
            and admins_count == 0
            and bool(email_lower)
        )
        params = urlencode({
            "portal_only": "1",
            "email": identity.get("Email") or identity.get("email") or "",
            "role_debug": json.dumps(role_debug, separators=(",", ":")),
            "bootstrap_eligible": "1" if bootstrap_eligible else "0",
        })
        return RedirectResponse(f"{FRONTEND_URL}/oauth/zoho/callback?{params}")

    @router.get("/auth/portal/me")
    async def portal_me(request: Request):
        uid = request.session.get("portal_user_id")
        if not uid:
            return {"authenticated": False}
        u = await db.zoho_users.find_one({"zoho_user_id": uid}, {"_id": 0, "access_token": 0, "refresh_token": 0})
        return {"authenticated": True, "user": u}

    @router.post("/auth/portal/logout")
    async def portal_logout(request: Request):
        request.session.pop("portal_user_id", None)
        return {"ok": True}

    # ---- Portal self-service profile — read + update ----
    @router.get("/portal/profile")
    async def portal_profile_get(request: Request):
        uid = _require_portal_user(request)
        u = await db.zoho_users.find_one(
            {"zoho_user_id": uid},
            {"_id": 0, "access_token": 0, "refresh_token": 0},
        ) or {}
        return {
            "email": u.get("email"),
            "display_name": u.get("display_name") or "",
            "first_name": u.get("first_name") or "",
            "last_name": u.get("last_name") or "",
            "phone": u.get("phone") or "",
            "company": u.get("company") or "",
            "address": u.get("address") or "",
            "postal_code": u.get("postal_code") or "",
            "house_number": u.get("house_number") or "",
            "city": u.get("city") or "",
            "region": u.get("region") or "",
            "country": u.get("country") or "Nederland",
            "profile_picture": u.get("profile_picture") or "",
        }

    @router.put("/portal/profile")
    async def portal_profile_update(request: Request, payload: dict):
        uid = _require_portal_user(request)
        allowed = {
            "display_name", "first_name", "last_name", "phone", "company",
            "address", "postal_code", "house_number", "city", "region", "country",
            "profile_picture",
        }
        upd = {}
        for k, v in (payload or {}).items():
            if k in allowed:
                if k == "profile_picture" and isinstance(v, str) and len(v) > 3 * 1024 * 1024:
                    raise HTTPException(413, "Profile picture too large (>3MB)")
                if isinstance(v, str) and len(v) > 3 * 1024 * 1024:
                    raise HTTPException(413, "Field too large")
                upd[k] = v
        if not upd:
            raise HTTPException(400, "No editable fields provided")
        upd["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.zoho_users.update_one({"zoho_user_id": uid}, {"$set": upd})
        return {"status": "updated"}

    async def _access_token(uid: str) -> tuple[str, dict]:
        u = await db.zoho_users.find_one({"zoho_user_id": uid})
        if not u:
            raise HTTPException(401, "Zoho account is not connected")
        access = _dec(u["access_token"])
        return access, u

    async def _refresh_and_retry(uid: str, u: dict, url: str, params, headers) -> httpx.Response:
        if not u.get("refresh_token"):
            raise HTTPException(401, "Zoho token expired; please reconnect")
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.post(f"{ACCOUNTS}/oauth/v2/token", params={
                "refresh_token": _dec(u["refresh_token"]),
                "client_id": ZOHO_CLIENT_ID,
                "client_secret": ZOHO_CLIENT_SECRET,
                "grant_type": "refresh_token",
            })
            refreshed = r.json()
        if "access_token" not in refreshed:
            raise HTTPException(401, "Zoho token revoked; please reconnect")
        new_access = refreshed["access_token"]
        await db.zoho_users.update_one({"zoho_user_id": uid}, {"$set": {
            "access_token": _enc(new_access),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }})
        h = {"Authorization": f"Zoho-oauthtoken {new_access}"}
        if headers:
            h.update(headers)
        async with httpx.AsyncClient(timeout=20) as client:
            return await client.get(url, params=params, headers=h)

    async def _zoho_get(uid: str, url: str, params=None, headers=None):
        token, u = await _access_token(uid)
        h = {"Authorization": f"Zoho-oauthtoken {token}"}
        if headers:
            h.update(headers)
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.get(url, params=params, headers=h)
        if r.status_code == 401:
            r = await _refresh_and_retry(uid, u, url, params, headers)
        if r.status_code >= 400:
            raise HTTPException(r.status_code, r.text)
        return r.json()

    @router.get("/portal/invoices")
    async def invoices(request: Request, page: int = 1, per_page: int = 25):
        uid = _require_portal_user(request)
        if not BOOKS_ORG_ID:
            raise HTTPException(400, "ZOHO_BOOKS_ORG_ID not configured — vraag admin om instelling")
        return await _zoho_get(
            uid,
            f"{DEFAULT_API_DOMAIN}/books/v3/invoices",
            params={"organization_id": BOOKS_ORG_ID, "page": page, "per_page": per_page},
        )

    @router.get("/portal/projects")
    async def projects(request: Request):
        uid = _require_portal_user(request)
        if not PROJECTS_PORTAL_ID:
            raise HTTPException(400, "ZOHO_PROJECTS_PORTAL_ID not configured — vraag admin om instelling")
        return await _zoho_get(
            uid,
            f"https://projectsapi.zoho.eu/restapi/portal/{PROJECTS_PORTAL_ID}/projects/",
            params={"index": 1, "range": 50},
        )

    @router.get("/portal/invoices/{invoice_id}")
    async def invoice_detail(request: Request, invoice_id: str):
        uid = _require_portal_user(request)
        if not BOOKS_ORG_ID:
            raise HTTPException(400, "ZOHO_BOOKS_ORG_ID not configured")
        return await _zoho_get(
            uid,
            f"{DEFAULT_API_DOMAIN}/books/v3/invoices/{invoice_id}",
            params={"organization_id": BOOKS_ORG_ID},
        )

    @router.get("/portal/invoices/{invoice_id}/pdf")
    async def invoice_pdf(request: Request, invoice_id: str):
        """Stream the Zoho Books PDF back to the browser."""
        from fastapi.responses import StreamingResponse
        uid = _require_portal_user(request)
        if not BOOKS_ORG_ID:
            raise HTTPException(400, "ZOHO_BOOKS_ORG_ID not configured")
        token, u = await _access_token(uid)
        url = f"{DEFAULT_API_DOMAIN}/books/v3/invoices/{invoice_id}"
        params = {"organization_id": BOOKS_ORG_ID, "accept": "pdf"}
        headers = {"Authorization": f"Zoho-oauthtoken {token}", "Accept": "application/pdf"}
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get(url, params=params, headers=headers)
        if r.status_code == 401 and u.get("refresh_token"):
            # Refresh once and retry
            async with httpx.AsyncClient(timeout=20) as client:
                rt = await client.post(f"{ACCOUNTS}/oauth/v2/token", data={
                    "refresh_token": _dec(u["refresh_token"]),
                    "client_id": ZOHO_CLIENT_ID,
                    "client_secret": ZOHO_CLIENT_SECRET,
                    "grant_type": "refresh_token",
                })
                data = rt.json()
            new_access = data.get("access_token")
            if new_access:
                await db.zoho_users.update_one({"zoho_user_id": uid}, {"$set": {
                    "access_token": _enc(new_access),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }})
                headers["Authorization"] = f"Zoho-oauthtoken {new_access}"
                async with httpx.AsyncClient(timeout=30) as client:
                    r = await client.get(url, params=params, headers=headers)
        if r.status_code >= 400:
            raise HTTPException(r.status_code, r.text[:200])
        return StreamingResponse(
            iter([r.content]),
            media_type="application/pdf",
            headers={"Content-Disposition": f'inline; filename="factuur-{invoice_id}.pdf"'},
        )

    @router.get("/portal/projects/{project_id}")
    async def project_detail(request: Request, project_id: str):
        uid = _require_portal_user(request)
        if not PROJECTS_PORTAL_ID:
            raise HTTPException(400, "ZOHO_PROJECTS_PORTAL_ID not configured")
        return await _zoho_get(
            uid,
            f"https://projectsapi.zoho.eu/restapi/portal/{PROJECTS_PORTAL_ID}/projects/{project_id}/",
        )

    @router.get("/portal/projects/{project_id}/tasks")
    async def project_tasks(request: Request, project_id: str):
        uid = _require_portal_user(request)
        if not PROJECTS_PORTAL_ID:
            raise HTTPException(400, "ZOHO_PROJECTS_PORTAL_ID not configured")
        return await _zoho_get(
            uid,
            f"https://projectsapi.zoho.eu/restapi/portal/{PROJECTS_PORTAL_ID}/projects/{project_id}/tasks/",
            params={"index": 1, "range": 200},
        )

    @router.get("/portal/projects/{project_id}/milestones")
    async def project_milestones(request: Request, project_id: str):
        uid = _require_portal_user(request)
        if not PROJECTS_PORTAL_ID:
            raise HTTPException(400, "ZOHO_PROJECTS_PORTAL_ID not configured")
        return await _zoho_get(
            uid,
            f"https://projectsapi.zoho.eu/restapi/portal/{PROJECTS_PORTAL_ID}/projects/{project_id}/milestones/",
        )

    @router.get("/portal/tickets")
    async def tickets(request: Request, from_: int = 1, limit: int = 50):
        uid = _require_portal_user(request)
        if not DESK_ORG_ID:
            raise HTTPException(400, "ZOHO_DESK_ORG_ID not configured — vraag admin om instelling")
        return await _zoho_get(
            uid,
            "https://desk.zoho.eu/api/v1/tickets",
            params={"from": from_, "limit": min(limit, 50)},
            headers={"orgId": DESK_ORG_ID},
        )

    @router.get("/portal/tickets/{ticket_id}")
    async def ticket_detail(request: Request, ticket_id: str):
        uid = _require_portal_user(request)
        if not DESK_ORG_ID:
            raise HTTPException(400, "ZOHO_DESK_ORG_ID not configured")
        return await _zoho_get(
            uid,
            f"https://desk.zoho.eu/api/v1/tickets/{ticket_id}",
            headers={"orgId": DESK_ORG_ID},
        )

    @router.get("/portal/tickets/{ticket_id}/threads")
    async def ticket_threads(request: Request, ticket_id: str):
        uid = _require_portal_user(request)
        if not DESK_ORG_ID:
            raise HTTPException(400, "ZOHO_DESK_ORG_ID not configured")
        # First get list of threads, then expand each with content
        listing = await _zoho_get(
            uid,
            f"https://desk.zoho.eu/api/v1/tickets/{ticket_id}/threads",
            headers={"orgId": DESK_ORG_ID},
            params={"limit": 50},
        )
        threads = listing.get("data", [])
        expanded = []
        for th in threads[:30]:
            try:
                full = await _zoho_get(
                    uid,
                    f"https://desk.zoho.eu/api/v1/tickets/{ticket_id}/threads/{th.get('id')}",
                    headers={"orgId": DESK_ORG_ID},
                    params={"include": "plainText"},
                )
                expanded.append(full)
            except Exception:
                expanded.append(th)
        return {"data": expanded}

    @router.post("/portal/tickets/{ticket_id}/reply")
    async def ticket_reply(request: Request, ticket_id: str):
        uid = _require_portal_user(request)
        if not DESK_ORG_ID:
            raise HTTPException(400, "ZOHO_DESK_ORG_ID not configured")
        body = await request.json()
        content = (body or {}).get("content", "").strip()
        if not content:
            raise HTTPException(400, "Reply content is required")
        # Zoho Desk POST thread — the client posts a public reply
        payload = {
            "channel": "WEB",
            "contentType": "html",
            "content": content,
            "fromEmailAddress": None,  # let Zoho use the requester email
            "isForward": False,
        }
        token, u = await _access_token(uid)
        url = f"https://desk.zoho.eu/api/v1/tickets/{ticket_id}/sendReply"
        h = {"Authorization": f"Zoho-oauthtoken {token}", "orgId": DESK_ORG_ID, "Content-Type": "application/json"}
        async with httpx.AsyncClient(timeout=25) as client:
            r = await client.post(url, headers=h, json=payload)
        if r.status_code == 401 and u.get("refresh_token"):
            async with httpx.AsyncClient(timeout=20) as client:
                rt = await client.post(f"{ACCOUNTS}/oauth/v2/token", data={
                    "refresh_token": _dec(u["refresh_token"]),
                    "client_id": ZOHO_CLIENT_ID,
                    "client_secret": ZOHO_CLIENT_SECRET,
                    "grant_type": "refresh_token",
                })
                new_token = rt.json().get("access_token")
            if new_token:
                await db.zoho_users.update_one({"zoho_user_id": uid}, {"$set": {
                    "access_token": _enc(new_token),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }})
                h["Authorization"] = f"Zoho-oauthtoken {new_token}"
                async with httpx.AsyncClient(timeout=25) as client:
                    r = await client.post(url, headers=h, json=payload)
        if r.status_code >= 400:
            raise HTTPException(r.status_code, f"Zoho reply failed: {r.text[:200]}")
        return r.json() if r.text else {"status": "sent"}

    @router.post("/portal/tickets/{ticket_id}/attachments")
    async def upload_attachment(request: Request, ticket_id: str, file: UploadFile = File(...)):
        uid = _require_portal_user(request)
        if not DESK_ORG_ID:
            raise HTTPException(400, "ZOHO_DESK_ORG_ID not configured")
        # Enforce a soft 20 MB limit
        max_bytes = 20 * 1024 * 1024
        content = await file.read()
        if len(content) > max_bytes:
            raise HTTPException(413, "Bestand is te groot (max 20 MB)")
        token, u = await _access_token(uid)
        url = f"https://desk.zoho.eu/api/v1/tickets/{ticket_id}/attachments"
        headers = {"Authorization": f"Zoho-oauthtoken {token}", "orgId": DESK_ORG_ID}
        files = {"file": (file.filename, content, file.content_type or "application/octet-stream")}
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(url, headers=headers, files=files)
        if r.status_code == 401 and u.get("refresh_token"):
            async with httpx.AsyncClient(timeout=20) as client:
                rt = await client.post(f"{ACCOUNTS}/oauth/v2/token", data={
                    "refresh_token": _dec(u["refresh_token"]),
                    "client_id": ZOHO_CLIENT_ID,
                    "client_secret": ZOHO_CLIENT_SECRET,
                    "grant_type": "refresh_token",
                })
                new_token = rt.json().get("access_token")
            if new_token:
                await db.zoho_users.update_one({"zoho_user_id": uid}, {"$set": {
                    "access_token": _enc(new_token),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }})
                headers["Authorization"] = f"Zoho-oauthtoken {new_token}"
                async with httpx.AsyncClient(timeout=60) as client:
                    r = await client.post(url, headers=headers, files=files)
        if r.status_code >= 400:
            raise HTTPException(r.status_code, f"Zoho upload failed: {r.text[:200]}")
        return r.json() if r.text else {"status": "uploaded"}

    return router

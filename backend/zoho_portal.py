"""Zoho OAuth + portal endpoints (Books, Projects, Desk) for the EU data center.
Follows the least-privilege scopes playbook; stores tokens encrypted per user.
"""
import os
import secrets
from datetime import datetime, timezone
from urllib.parse import urlencode
from typing import Optional

import httpx
from cryptography.fernet import Fernet
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse

ZOHO_CLIENT_ID = os.environ.get("ZOHO_CLIENT_ID", "")
ZOHO_CLIENT_SECRET = os.environ.get("ZOHO_CLIENT_SECRET", "")
ZOHO_REDIRECT_URI = os.environ.get("ZOHO_REDIRECT_URI", "")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")
BOOKS_ORG_ID = os.environ.get("ZOHO_BOOKS_ORG_ID", "").strip()
PROJECTS_PORTAL_ID = os.environ.get("ZOHO_PROJECTS_PORTAL_ID", "").strip()
DESK_ORG_ID = os.environ.get("ZOHO_DESK_ORG_ID", "").strip()

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

    @router.get("/auth/zoho/callback")
    async def zoho_callback(request: Request, code: Optional[str] = None, state: Optional[str] = None, error: Optional[str] = None):
        if error:
            return RedirectResponse(f"{FRONTEND_URL}/portal?error={error}")
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
        return RedirectResponse(f"{FRONTEND_URL}/portal")

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

    return router

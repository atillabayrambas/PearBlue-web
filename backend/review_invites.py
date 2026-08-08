"""Review invitation system.
Polls Zoho Projects for newly-closed projects and emails the linked
Zoho Books customer with a bilingual (NL + EN) invitation to leave a review.
Idempotent: `review_invites` collection stores {project_id, sent_at, email}.
"""
import asyncio
import logging
import os
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import quote_plus

import httpx
from cryptography.fernet import Fernet

logger = logging.getLogger(__name__)

ZOHO_CLIENT_ID = os.environ.get("ZOHO_CLIENT_ID", "")
ZOHO_CLIENT_SECRET = os.environ.get("ZOHO_CLIENT_SECRET", "")
BOOKS_ORG_ID = os.environ.get("ZOHO_BOOKS_ORG_ID", "").strip()
PROJECTS_PORTAL_ID = os.environ.get("ZOHO_PROJECTS_PORTAL_ID", "").strip()
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")
GOOGLE_REVIEW_URL = os.environ.get("GOOGLE_REVIEW_URL", "").strip()
TRUSTPILOT_REVIEW_URL = os.environ.get("TRUSTPILOT_REVIEW_URL", "").strip()
FACEBOOK_PAGE_URL = os.environ.get("FACEBOOK_PAGE_URL", "").strip()
SUPER_ADMIN_EMAILS = {
    e.strip().lower() for e in os.environ.get("SUPER_ADMIN_EMAILS", "").split(",") if e.strip()
}
TOKEN_ENC_KEY = os.environ.get("TOKEN_ENCRYPTION_KEY", "").encode()
_cipher = Fernet(TOKEN_ENC_KEY) if TOKEN_ENC_KEY else None

ACCOUNTS = "https://accounts.zoho.eu"
BOOKS_BASE = "https://www.zohoapis.eu/books/v3"
PROJECTS_BASE = "https://projectsapi.zoho.eu/restapi"

POLL_INTERVAL_SECONDS = int(os.environ.get("REVIEW_INVITE_POLL_SECONDS", "900"))  # 15 min


def _dec(v: str) -> str:
    return _cipher.decrypt(v.encode()).decode()


def _enc(v: str) -> str:
    return _cipher.encrypt(v.encode()).decode()


async def _get_admin_zoho_user(db):
    """Return the first Zoho user whose email is in SUPER_ADMIN_EMAILS."""
    if not SUPER_ADMIN_EMAILS:
        return None
    cursor = db.zoho_users.find({})
    async for u in cursor:
        if (u.get("email") or "").lower().strip() in SUPER_ADMIN_EMAILS:
            return u
    return None


async def _refresh_token(db, user: dict) -> str:
    if not user.get("refresh_token"):
        raise RuntimeError("No refresh_token on super-admin Zoho user")
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post(f"{ACCOUNTS}/oauth/v2/token", params={
            "refresh_token": _dec(user["refresh_token"]),
            "client_id": ZOHO_CLIENT_ID,
            "client_secret": ZOHO_CLIENT_SECRET,
            "grant_type": "refresh_token",
        })
        data = r.json()
    access = data.get("access_token")
    if not access:
        raise RuntimeError(f"Zoho token refresh failed: {data}")
    await db.zoho_users.update_one({"zoho_user_id": user["zoho_user_id"]}, {"$set": {
        "access_token": _enc(access),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }})
    return access


async def _zoho_get(db, user: dict, url: str, *, params=None, headers=None):
    token = _dec(user["access_token"])
    h = {"Authorization": f"Zoho-oauthtoken {token}"}
    if headers:
        h.update(headers)
    async with httpx.AsyncClient(timeout=25) as client:
        r = await client.get(url, params=params, headers=h)
    if r.status_code == 401:
        token = await _refresh_token(db, user)
        h["Authorization"] = f"Zoho-oauthtoken {token}"
        async with httpx.AsyncClient(timeout=25) as client:
            r = await client.get(url, params=params, headers=h)
    if r.status_code >= 400:
        raise RuntimeError(f"Zoho GET {url} → {r.status_code}: {r.text[:200]}")
    return r.json()


def _share_buttons_html() -> str:
    """Optional share row appended to invite emails when platform links are configured."""
    targets = []
    if GOOGLE_REVIEW_URL:
        targets.append(("Google", GOOGLE_REVIEW_URL, "#ffffff", "#0A192F", "#e2e8f0"))
    if TRUSTPILOT_REVIEW_URL:
        targets.append(("Trustpilot", TRUSTPILOT_REVIEW_URL, "#00b67a", "#ffffff", "#00b67a"))
    if FACEBOOK_PAGE_URL:
        fb_url = FACEBOOK_PAGE_URL.rstrip("/") + "/reviews"
        targets.append(("Facebook", fb_url, "#1877f2", "#ffffff", "#1877f2"))
    if not targets:
        return ""
    buttons = "".join([
        f'<a href="{url}" style="display:inline-block; margin:4px; padding:8px 16px; border-radius:999px; text-decoration:none; font-size:13px; font-weight:600; background:{bg}; color:{fg}; border:1px solid {bd};">{label}</a>'
        for (label, url, bg, fg, bd) in targets
    ])
    return f"""
    <hr style="border:none; border-top:1px solid #e2e8f0; margin:24px 0;"/>
    <p style="font-size:13px; color:#334155; margin:0 0 10px; text-align:center;">
      Plaats hem <strong>ook</strong> op je favoriete platform — één klik.
    </p>
    <p style="text-align:center; margin:0 0 6px;">{buttons}</p>
    <p style="font-size:11px; color:#94a3b8; text-align:center; margin:8px 0 0;">
      One click — your review opens on the chosen platform.
    </p>"""


def _bilingual_invite_html(project_name: str, review_url: str) -> str:
    return f"""
<div style="font-family: Arial, sans-serif; max-width:600px; margin:0 auto; color:#0A192F;">
  <div style="background:#02C0FF; color:#fff; padding:20px 24px; border-radius:12px 12px 0 0;">
    <h1 style="margin:0; font-size:22px;">PearBlue</h1>
  </div>
  <div style="background:#f8fafc; padding:28px 24px; border-radius:0 0 12px 12px;">
    <!-- NL -->
    <h2 style="margin:0 0 12px; font-size:18px; color:#0A192F;">Bedankt dat we voor je mochten werken!</h2>
    <p style="line-height:1.6; color:#334155;">
      Je project <strong>{project_name}</strong> is afgerond. Zou je even 30 seconden willen nemen om
      een korte review achter te laten? Het helpt ons enorm en toont andere klanten wat we voor ze kunnen doen.
    </p>
    <p style="text-align:center; margin:24px 0;">
      <a href="{review_url}" style="background:#02C0FF; color:#fff; padding:12px 28px; text-decoration:none; border-radius:999px; font-weight:600; display:inline-block;">
        Laat je review achter →
      </a>
    </p>
    <hr style="border:none; border-top:1px solid #e2e8f0; margin:28px 0;"/>
    <!-- EN -->
    <h2 style="margin:0 0 12px; font-size:18px; color:#0A192F;">Thanks for letting us work with you!</h2>
    <p style="line-height:1.6; color:#334155;">
      Your project <strong>{project_name}</strong> is complete. Would you take 30 seconds to leave a short
      review? It means the world to us and helps future clients know what we can do for them.
    </p>
    <p style="text-align:center; margin:24px 0 8px;">
      <a href="{review_url}" style="background:#02C0FF; color:#fff; padding:12px 28px; text-decoration:none; border-radius:999px; font-weight:600; display:inline-block;">
        Leave your review →
      </a>
    </p>
    {_share_buttons_html()}
    <p style="font-size:12px; color:#94a3b8; text-align:center; margin-top:28px;">
      PearBlue — jouw complete digitale partner · info@pearblue.nl
    </p>
  </div>
</div>"""


async def _resolve_customer_email(db, user, project: dict) -> Optional[str]:
    """Try, in order: project.customer_id → Books contact email; then
    project.owner_email (which may be internal). Return None if no email found."""
    # Zoho Projects → try customer_id (Books linkage)
    customer_id = project.get("customer_id") or project.get("customer_id_link")
    if customer_id and BOOKS_ORG_ID:
        try:
            data = await _zoho_get(
                db, user,
                f"{BOOKS_BASE}/contacts/{customer_id}",
                params={"organization_id": BOOKS_ORG_ID},
            )
            contact = data.get("contact") or {}
            email = contact.get("email")
            if email:
                return email.strip()
            # Try first contact_person
            persons = contact.get("contact_persons") or []
            for p in persons:
                if p.get("email"):
                    return p["email"].strip()
        except Exception as e:
            logger.info(f"Books contact {customer_id} lookup failed: {e}")
    # Fallback: project owner (may be internal — we still send so admin can forward)
    owner_email = project.get("owner_email")
    if owner_email:
        return owner_email.strip()
    return None


async def _scan_once(db, send_email_fn) -> dict:
    """Fetch closed projects, email new ones, record in Mongo.
    Returns {'scanned': N, 'invited': M, 'skipped': K, 'errors': [...]}
    """
    result = {"scanned": 0, "invited": 0, "skipped": 0, "errors": []}
    if not PROJECTS_PORTAL_ID:
        result["errors"].append("ZOHO_PROJECTS_PORTAL_ID not configured")
        return result
    user = await _get_admin_zoho_user(db)
    if not user:
        result["errors"].append("No super-admin Zoho user connected yet — login once via /admin/login")
        return result
    try:
        data = await _zoho_get(
            db, user,
            f"{PROJECTS_BASE}/portal/{PROJECTS_PORTAL_ID}/projects/",
            params={"index": 1, "range": 100},
        )
    except Exception as e:
        result["errors"].append(f"Fetch projects failed: {e}")
        return result

    all_projects = data.get("projects") or []
    projects = [p for p in all_projects if str(p.get("status") or "").lower() in {"closed", "completed", "archived"}]
    result["scanned"] = len(projects)
    for p in projects:
        pid = str(p.get("id") or p.get("id_string") or "")
        if not pid:
            continue
        # Already invited?
        if await db.review_invites.find_one({"project_id": pid}):
            result["skipped"] += 1
            continue
        name = p.get("name") or "PearBlue project"
        email = await _resolve_customer_email(db, user, p)
        if not email:
            result["errors"].append(f"Project {pid} ({name}): no customer email — skipped")
            result["skipped"] += 1
            # Still record so we don't retry endlessly (with sent_at=None)
            await db.review_invites.insert_one({
                "project_id": pid, "project_name": name, "email": None,
                "sent_at": None, "error": "no-email",
                "recorded_at": datetime.now(timezone.utc).isoformat(),
            })
            continue
        review_url = f"{FRONTEND_URL}/review?project={quote_plus(name)}"
        sent = await send_email_fn(
            email,
            f"Bedankt voor je project bij PearBlue — laat je review achter",
            _bilingual_invite_html(name, review_url),
        )
        await db.review_invites.insert_one({
            "project_id": pid, "project_name": name, "email": email,
            "sent_at": datetime.now(timezone.utc).isoformat(),
            "delivered": bool(sent),
            "recorded_at": datetime.now(timezone.utc).isoformat(),
        })
        if sent:
            result["invited"] += 1
        else:
            result["errors"].append(f"Project {pid}: e-mail send failed to {email}")
    return result


async def start_background_poller(db, send_email_fn):
    """Kick off the periodic scan. Awaits POLL_INTERVAL_SECONDS between runs."""
    logger.info(f"Review-invite poller started (interval={POLL_INTERVAL_SECONDS}s)")
    while True:
        try:
            r = await _scan_once(db, send_email_fn)
            if r.get("invited") or r.get("errors"):
                logger.info(f"Review-invite scan: {r}")
        except Exception as e:
            logger.error(f"Review-invite scan crashed: {e}")
        await asyncio.sleep(POLL_INTERVAL_SECONDS)


async def scan_now(db, send_email_fn) -> dict:
    """Admin-triggered scan (exposed via /api/admin/reviews/scan-invites)."""
    return await _scan_once(db, send_email_fn)

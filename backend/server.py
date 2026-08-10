from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, status, UploadFile, File, Query
from fastapi.responses import Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
import time
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
import base64
import html as _html
import re as _re
from datetime import datetime, timezone, timedelta
from pathlib import Path as _Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import bcrypt
import jwt
import resend
from collections import defaultdict
from starlette.middleware.sessions import SessionMiddleware
from emergentintegrations.llm.chat import LlmChat, UserMessage
from zoho_portal import make_router as make_zoho_router
from review_invites import scan_now as review_scan_now, start_background_poller as review_poller
from stripe_payments import make_router as make_stripe_router
from cryptography.fernet import Fernet, InvalidToken

# Fernet cipher for encrypting integration secrets (Brevo API key, IMAP passwords)
# Uses TOKEN_ENCRYPTION_KEY from env (already used by zoho_portal/stripe_payments)
_ENC_KEY_RAW = os.environ.get("TOKEN_ENCRYPTION_KEY", "").encode()
_secret_cipher = Fernet(_ENC_KEY_RAW) if _ENC_KEY_RAW else None

def enc_secret(plaintext: str) -> str:
    """Encrypt a secret at rest. Returns 'enc:<token>' or raw if cipher unavailable."""
    if not plaintext:
        return ""
    if _secret_cipher is None:
        return plaintext  # fallback for local dev without key
    return "enc:" + _secret_cipher.encrypt(plaintext.encode()).decode()

def dec_secret(stored: str) -> str:
    """Decrypt a secret written with enc_secret. Returns plaintext or empty string on failure."""
    if not stored:
        return ""
    if not stored.startswith("enc:"):
        return stored  # legacy plaintext
    if _secret_cipher is None:
        return ""
    try:
        return _secret_cipher.decrypt(stored[4:].encode()).decode()
    except InvalidToken:
        return ""

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Resend configuration
RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')
CONTACT_RECIPIENT_EMAIL = os.environ.get('CONTACT_RECIPIENT_EMAIL', 'info@pearblue.nl')
if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

# Auth configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'change-me')
JWT_ALG = 'HS256'
JWT_EXP_MINUTES = 60 * 24 * 7  # 7 days
ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', 'admin@pearblue.nl').lower().strip()
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'admin123')

# LLM configuration
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')
CHAT_RATE_LIMIT_PER_HOUR = int(os.environ.get('CHAT_RATE_LIMIT_PER_HOUR', '20'))

# In-memory chat rate-limit store: ip -> list[datetime]
_chat_rate_store: dict = defaultdict(list)
_register_rate_store: dict = defaultdict(list)

app = FastAPI(title="PearBlue API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)


# ---------- Models ----------
class ContactMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: EmailStr
    phone: Optional[str] = None
    company: Optional[str] = None
    subject: Optional[str] = None
    message: str
    language: Optional[str] = "nl"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    email_sent: bool = False
    status: Optional[str] = "new"
    priority: Optional[str] = "P3"
    assigned_to: Optional[str] = None
    notes: Optional[list] = None
    replies: Optional[list] = None
    attachments: Optional[list] = None
    spam: Optional[bool] = False
    spam_reason: Optional[str] = None


class ContactCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    email: EmailStr
    phone: Optional[str] = Field(None, max_length=40)
    company: Optional[str] = Field(None, max_length=120)
    subject: Optional[str] = Field(None, max_length=200)
    message: str = Field(..., min_length=1, max_length=5000)
    language: Optional[str] = "nl"


class QuoteRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: EmailStr
    company: Optional[str] = None
    pages: Optional[int] = None
    budget: Optional[str] = None
    services: List[str] = []
    description: Optional[str] = None
    language: Optional[str] = "nl"
    # Extended: wishlist + story from calculator
    wishlist_items: Optional[List[Dict[str, Any]]] = None
    wishlist_totals: Optional[Dict[str, Any]] = None
    story: Optional[str] = None
    custom_request: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class QuoteCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    email: EmailStr
    company: Optional[str] = Field(None, max_length=120)
    pages: Optional[int] = None
    budget: Optional[str] = None
    services: List[str] = []
    description: Optional[str] = Field(None, max_length=5000)
    language: Optional[str] = "nl"
    wishlist_items: Optional[List[Dict[str, Any]]] = Field(None, description="[{id,label,qty,unit,price}]")
    wishlist_totals: Optional[Dict[str, Any]] = None
    story: Optional[str] = Field(None, max_length=5000)
    custom_request: Optional[str] = Field(None, max_length=5000)


class Project(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    category: str
    tag: Optional[str] = None
    description: Optional[str] = None
    image_url: str
    external_url: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ProjectCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=140)
    category: str = Field(..., min_length=1, max_length=40)
    tag: Optional[str] = Field(None, max_length=80)
    description: Optional[str] = Field(None, max_length=2000)
    image_url: str = Field(..., min_length=4)
    external_url: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=200)


class LoginResponse(BaseModel):
    access_token: str
    user: dict


class ChatRequest(BaseModel):
    session_id: str = Field(..., min_length=1, max_length=120)
    message: str = Field(..., min_length=1, max_length=2000)
    language: Optional[str] = "nl"


class ChatResponse(BaseModel):
    reply: str
    session_id: str
    remaining: int


class SiteSettings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    ga4_measurement_id: Optional[str] = ""
    search_console_verification: Optional[str] = ""
    hero_headline_nl: Optional[str] = ""
    hero_headline_en: Optional[str] = ""


class SiteSettingsUpdate(BaseModel):
    ga4_measurement_id: Optional[str] = Field(None, max_length=40)
    search_console_verification: Optional[str] = Field(None, max_length=200)
    hero_headline_nl: Optional[str] = Field(None, max_length=200)
    hero_headline_en: Optional[str] = Field(None, max_length=200)


class PortalRegistration(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: EmailStr
    company: Optional[str] = None
    phone: Optional[str] = None
    message: Optional[str] = None
    language: Optional[str] = "nl"
    address: Optional[str] = None
    postal_code: Optional[str] = None
    city: Optional[str] = None
    region: Optional[str] = None
    country: Optional[str] = None
    status: str = "pending"  # pending | approved | rejected
    admin_note: Optional[str] = None
    assigned_to: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    reviewed_at: Optional[datetime] = None


class PortalRegistrationCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    email: EmailStr
    company: Optional[str] = Field(None, max_length=120)
    phone: Optional[str] = Field(None, max_length=40)
    message: Optional[str] = Field(None, max_length=2000)
    language: Optional[str] = "nl"
    # Address block (required by the new portal registration UX)
    address: Optional[str] = Field(None, max_length=200)
    postal_code: Optional[str] = Field(None, max_length=20)
    city: Optional[str] = Field(None, max_length=120)
    region: Optional[str] = Field(None, max_length=120)
    country: Optional[str] = Field(None, max_length=80)


class RegistrationReview(BaseModel):
    status: str = Field(..., pattern="^(approved|rejected|pending)$")
    admin_note: Optional[str] = Field(None, max_length=1000)
    assigned_to: Optional[str] = None


class Review(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    company: Optional[str] = None
    project: Optional[str] = None
    rating: int = Field(..., ge=1, le=5)
    quote: str
    approved: bool = False
    featured: bool = False
    assigned_to: Optional[str] = None
    status: Optional[str] = "new"  # new | in_progress | done
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ReviewCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    company: Optional[str] = Field(None, max_length=120)
    project: Optional[str] = Field(None, max_length=200)
    rating: int = Field(..., ge=1, le=5)
    quote: str = Field(..., min_length=10, max_length=1000)


class ReviewUpdate(BaseModel):
    approved: Optional[bool] = None
    featured: Optional[bool] = None
    assigned_to: Optional[str] = None
    status: Optional[str] = Field(None, pattern="^(new|in_progress|done)$")


# ---------- Auth helpers ----------
def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(email: str, role: str = "admin") -> str:
    payload = {
        "sub": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=JWT_EXP_MINUTES),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


async def require_admin(creds: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> dict:
    if creds is None or not creds.credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALG])
        role = payload.get("role")
        if role not in ROLES_WITH_CMS_ACCESS:
            raise HTTPException(status_code=403, detail="Forbidden")
        return {"email": payload.get("sub"), "role": role}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# --- Role model (6 roles) ---
ROLE_SUPER_ADMIN = "super_admin"
ROLE_BEHEERDER = "beheerder"
ROLE_ANALIST = "analist"
ROLE_MODERATOR = "moderator"
ROLE_CHAT_SUPPORT = "chat_support"
ROLE_FINANCIEN = "financien"
ROLE_CRM = "crm"
ROLE_GEBRUIKER = "gebruiker"

ALL_ROLES = [ROLE_SUPER_ADMIN, ROLE_BEHEERDER, ROLE_ANALIST, ROLE_MODERATOR, ROLE_CHAT_SUPPORT, ROLE_FINANCIEN, ROLE_CRM, ROLE_GEBRUIKER]
ROLES_WITH_CMS_ACCESS = {"admin", ROLE_SUPER_ADMIN, ROLE_BEHEERDER, ROLE_ANALIST, ROLE_MODERATOR, ROLE_CHAT_SUPPORT, ROLE_FINANCIEN, ROLE_CRM}

ROLE_PERMS = {
    ROLE_SUPER_ADMIN: {"users", "roles", "secrets", "scripts", "content", "reviews", "analytics", "chat", "tickets", "portfolio", "settings", "messages", "cybersecurity", "feedback", "changelog", "mailmarketing", "financials"},
    "admin": {"users", "roles", "secrets", "scripts", "content", "reviews", "analytics", "chat", "tickets", "portfolio", "settings", "messages", "cybersecurity", "feedback", "changelog", "mailmarketing", "financials"},
    ROLE_BEHEERDER: {"users", "content", "reviews", "analytics", "chat", "tickets", "portfolio", "messages", "cybersecurity", "feedback", "changelog", "mailmarketing", "financials"},
    ROLE_ANALIST: {"analytics", "cybersecurity"},
    ROLE_MODERATOR: {"content", "portfolio", "reviews", "messages", "feedback"},
    ROLE_CHAT_SUPPORT: {"chat", "tickets", "messages"},
    ROLE_FINANCIEN: {"financials", "analytics"},
    ROLE_CRM: {"users", "chat", "tickets", "messages", "feedback", "reviews"},
    ROLE_GEBRUIKER: set(),
}


def require_permission(perm: str):
    async def _check(current=Depends(require_admin)):
        role = current.get("role")
        if perm not in ROLE_PERMS.get(role, set()):
            raise HTTPException(status_code=403, detail=f"Missing permission: {perm}")
        return current
    return _check


async def _log_activity(actor_email: str, action: str, target: Optional[str] = None, meta: Optional[dict] = None):
    await db.activity_log.insert_one({
        "actor_email": actor_email,
        "action": action,
        "target": target,
        "meta": meta or {},
        "created_at": datetime.now(timezone.utc).isoformat(),
    })


async def seed_admin():
    existing = await db.admins.find_one({"email": ADMIN_EMAIL})
    hashed = hash_password(ADMIN_PASSWORD)
    if existing is None:
        await db.admins.insert_one({
            "email": ADMIN_EMAIL,
            "password_hash": hashed,
            "role": ROLE_SUPER_ADMIN,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info(f"Admin seeded: {ADMIN_EMAIL}")
    else:
        updates = {}
        if not verify_password(ADMIN_PASSWORD, existing.get("password_hash", "")):
            updates["password_hash"] = hashed
        if existing.get("role") in {None, "admin"}:
            updates["role"] = ROLE_SUPER_ADMIN
        if updates:
            await db.admins.update_one({"email": ADMIN_EMAIL}, {"$set": updates})
            logger.info(f"Admin updated ({', '.join(updates.keys())}): {ADMIN_EMAIL}")


# ---------- Email helpers ----------
def _build_contact_html(payload: ContactCreate) -> str:
    return f"""
    <div style="font-family: Arial, sans-serif; max-width:600px; margin:0 auto; color:#0A192F;">
      <div style="background:#02C0FF; color:#fff; padding:24px; border-radius:12px 12px 0 0;">
        <h2 style="margin:0;">Nieuw bericht via PearBlue website</h2>
      </div>
      <table style="width:100%; border-collapse:collapse; background:#fff; padding:24px;">
        <tr><td><strong>Naam:</strong></td><td>{payload.name}</td></tr>
        <tr><td><strong>E-mail:</strong></td><td>{payload.email}</td></tr>
        <tr><td><strong>Telefoon:</strong></td><td>{payload.phone or '-'}</td></tr>
        <tr><td><strong>Bedrijf:</strong></td><td>{payload.company or '-'}</td></tr>
        <tr><td><strong>Onderwerp:</strong></td><td>{payload.subject or '-'}</td></tr>
        <tr><td style="vertical-align:top;"><strong>Bericht:</strong></td><td style="white-space:pre-wrap;">{payload.message}</td></tr>
      </table>
    </div>
    """


async def _send_contact_email(payload: ContactCreate) -> bool:
    if not RESEND_API_KEY:
        logger.info("RESEND_API_KEY not configured — skipping email send.")
        return False
    params = {
        "from": SENDER_EMAIL,
        "to": [CONTACT_RECIPIENT_EMAIL],
        "reply_to": payload.email,
        "subject": f"[PearBlue] {payload.subject or 'Nieuw contactbericht'} — {payload.name}",
        "html": _build_contact_html(payload),
    }
    try:
        result = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Email sent: {result}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email: {e}")
        return False


# ---------- Chat helpers ----------
CHATBOT_SYSTEM_PROMPT = (
    "Je bent 'Pear', de vriendelijke digitale assistent van PearBlue — een Nederlands "
    "bureau voor ICT & Media Design. Beantwoord vragen over PearBlue's diensten en prijzen "
    "kort en helder (max 4 zinnen). Wees warm, professioneel en behulpzaam. Detecteer de "
    "taal van de gebruiker (NL of EN) en antwoord in dezelfde taal.\n\n"
    "Kerninformatie over PearBlue:\n"
    "- 'Jouw Complete Digitale Partner' — innovatief, duurzaam, betaalbaar\n"
    "- Vestiging: Nederland, Delfzijl\n"
    "- KVK: 87201607 · Vestigingsnummer 000053124294\n"
    "- Contact: info@pearblue.nl · +31 596 229 030\n\n"
    "Drie pakketten:\n"
    "1) Website — vanaf €200. Ontwerp, copywriting, hosting, meertalig (NL/EN), basis SEO.\n"
    "2) ICT Diensten — vanaf €100. Netwerkontwerp, cloud, beheer & 24/7 monitoring, security, "
    "device-management, audits & roadmap.\n"
    "3) Cybersecurity — vanaf €5 per actieve machine. Bitdefender GravityZone Elite met EDR, "
    "firewall, encryptie en risk management. Beheerd of onbeheerd. Geen langlopende contracten.\n\n"
    "Voor concrete offertes of afspraken: verwijs beleefd naar de contact-pagina "
    "(/contact) of info@pearblue.nl. Als een klant naar het klantportaal vraagt "
    "(facturen, projecten, tickets), verwijs naar /portal — daar kunnen ze inloggen "
    "met Zoho of toegang aanvragen. Verzin nooit prijzen of feiten die niet in deze "
    "context staan — zeg dan dat je het navraagt of verwijs naar contact."
)


# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {
        "message": "PearBlue API is running",
        "resend_configured": bool(RESEND_API_KEY),
        "llm_configured": bool(EMERGENT_LLM_KEY),
    }


@api_router.get("/health")
async def health():
    return {"status": "ok"}


# ---- Auth ----
@api_router.post("/auth/login", response_model=LoginResponse)
async def login(payload: LoginRequest):
    email = payload.email.lower().strip()
    admin = await db.admins.find_one({"email": email}, {"_id": 0})
    if admin is None or not verify_password(payload.password, admin.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(email=email, role=admin.get("role", "admin"))
    return LoginResponse(access_token=token, user={"email": email, "role": admin.get("role", "admin")})


@api_router.get("/auth/me")
async def auth_me(current=Depends(require_admin)):
    return current


# ---- Contact ----
@api_router.post("/contact", response_model=ContactMessage)
async def create_contact(payload: ContactCreate, request: Request):
    # IP-level defenses
    if await _is_ip_manually_blocked(request):
        await _record_block(request, "manual_block", "/api/contact")
        raise HTTPException(status_code=403, detail="Forbidden")
    try:
        _public_rate_limit(request, "/api/contact", window_seconds=300, max_hits=5)
    except HTTPException:
        await _record_block(request, "rate_limit", "/api/contact")
        raise
    # Spam gate on message
    is_spam, reason = _detect_spam(f"{payload.subject or ''} {payload.message}")
    if is_spam:
        # Instead of hard-rejecting, still persist as a spam-marked record so the
        # admin can review/delete via the Spam sub-tab.
        await _record_block(request, "spam", "/api/contact", {"spam_reason": reason})
        doc = {
            "id": str(uuid.uuid4()),
            "name": payload.name, "email": payload.email, "phone": payload.phone,
            "company": payload.company, "subject": payload.subject, "message": payload.message,
            "language": payload.language, "email_sent": False,
            "spam": True, "spam_reason": reason,
            "status": "new", "priority": "P4", "assigned_to": None, "notes": [],
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.contact_messages.insert_one(doc)
        raise HTTPException(status_code=400, detail={"message": "Bericht is als spam gedetecteerd.", "reason": reason})
    email_sent = await _send_contact_email(payload)
    msg = ContactMessage(**payload.model_dump(), email_sent=email_sent)
    doc = msg.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['status'] = 'new'  # new | in_progress | on_hold | done | archived
    doc['priority'] = 'P3'  # P1 (highest) | P2 | P3 | P4 | Major
    doc['assigned_to'] = None
    doc['notes'] = []
    doc['spam'] = False
    await db.contact_messages.insert_one(doc)
    return msg


@api_router.get("/contact", response_model=List[ContactMessage])
async def list_contacts(current=Depends(require_admin)):
    items = await db.contact_messages.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    for i in items:
        if isinstance(i.get('created_at'), str):
            i['created_at'] = datetime.fromisoformat(i['created_at'])
        # Strip heavy attachment payloads from list view
        if i.get("attachments"):
            i["attachments"] = [
                {k: v for k, v in a.items() if k != "data_b64"} for a in i["attachments"]
            ]
    return items


@api_router.post("/quote", response_model=QuoteRequest)
async def create_quote(payload: QuoteCreate):
    q = QuoteRequest(**payload.model_dump())
    doc = q.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.quote_requests.insert_one(doc)
    if RESEND_API_KEY:
        # Build wishlist section for the email
        wishlist_lines: List[str] = []
        if payload.wishlist_items:
            wishlist_lines.append("\n\n--- Wishlist / Calculator ---")
            for it in payload.wishlist_items:
                qty = it.get("qty") or 1
                label = it.get("label") or it.get("id") or "item"
                unit = it.get("unit") or ""
                price = it.get("price")
                price_s = f" — €{price}" if price is not None else ""
                wishlist_lines.append(f"• {label} × {qty} {unit}{price_s}")
        if payload.wishlist_totals:
            t = payload.wishlist_totals
            wishlist_lines.append(
                f"\nTotalen (excl. btw): eenmalig €{t.get('oneOff', 0)}, per maand €{t.get('monthly', 0)}, per uur €{t.get('hourly', 0)}"
            )
            if t.get("grandTotal") is not None:
                wishlist_lines.append(f"Eindtotaal (incl. 21% btw): €{t.get('grandTotal')}")

        story_block = f"\n\n--- Sfeer & verhaal van de website ---\n{payload.story}" if payload.story else ""
        custom_block = f"\n\n--- Anders / maatwerk-verzoek ---\n{payload.custom_request}" if payload.custom_request else ""

        contact_like = ContactCreate(
            name=payload.name,
            email=payload.email,
            company=payload.company,
            subject=f"Offerte-aanvraag — {payload.company or payload.name}",
            message=(
                f"Pagina's: {payload.pages}\nBudget: {payload.budget}\nDiensten: {', '.join(payload.services)}\n\n"
                f"{payload.description or ''}"
                f"{story_block}"
                f"{custom_block}"
                + ("\n" + "\n".join(wishlist_lines) if wishlist_lines else "")
            ),
            language=payload.language,
        )
        await _send_contact_email(contact_like)
    return q


# ---- Projects (public GET; protected POST/DELETE) ----
@api_router.get("/projects", response_model=List[Project])
async def list_projects(include_archived: bool = False):
    q = {} if include_archived else {"archived": {"$ne": True}}
    items = await db.projects.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    for i in items:
        if isinstance(i.get('created_at'), str):
            i['created_at'] = datetime.fromisoformat(i['created_at'])
    return items


@api_router.get("/admin/projects/all")
async def admin_list_projects(current=Depends(require_admin)):
    """Admin-only: returns all projects including archived, without response-model coercion."""
    items = await db.projects.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items


@api_router.post("/projects", response_model=Project)
async def create_project(payload: ProjectCreate, current=Depends(require_admin)):
    p = Project(**payload.model_dump())
    doc = p.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.projects.insert_one(doc)
    return p


@api_router.delete("/projects/{project_id}")
async def delete_project(project_id: str, current=Depends(require_admin)):
    result = await db.projects.delete_one({"id": project_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"status": "deleted", "id": project_id}


# ---- Chat stats (admin) ----
@api_router.get("/chat/stats")
async def chat_stats(days: int = 30, from_: Optional[str] = Query(None, alias="from"), to: Optional[str] = None, current=Depends(require_admin)):
    from datetime import date
    # Support custom range via ?from=YYYY-MM-DD&to=YYYY-MM-DD
    days = max(1, min(days, 1825))  # up to 5 years
    now = datetime.now(timezone.utc)
    if from_ and to:
        try:
            start = datetime.fromisoformat(from_).replace(tzinfo=timezone.utc)
            end = datetime.fromisoformat(to).replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
            days = max(1, (end.date() - start.date()).days + 1)
            since = start
        except Exception:
            since = now - timedelta(days=days - 1)
    else:
        since = now - timedelta(days=days - 1)
    cutoff = since.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    cursor = db.chat_messages.find(
        {"created_at": {"$gte": cutoff}},
        {"_id": 0, "created_at": 1, "session_id": 1, "language": 1},
    )
    per_day: dict[str, int] = {}
    sessions: set[str] = set()
    per_lang: dict[str, int] = defaultdict(int)
    total = 0
    async for doc in cursor:
        total += 1
        s = doc.get("session_id")
        if s:
            sessions.add(s)
        per_lang[doc.get("language") or "unknown"] += 1
        ca = doc.get("created_at")
        try:
            d = datetime.fromisoformat(ca).date().isoformat() if isinstance(ca, str) else ca.date().isoformat()
        except Exception:
            continue
        per_day[d] = per_day.get(d, 0) + 1
    # Build a dense series for the last N days
    series = []
    for i in range(days):
        day = (since + timedelta(days=i)).date().isoformat()
        series.append({"date": day, "count": per_day.get(day, 0)})
    total_messages_ever = await db.chat_messages.count_documents({})
    # Cost estimate — Claude Sonnet 4.6 approximate token usage per turn + Emergent LLM pricing
    # Assumption: avg ~500 input + ~350 output tokens per user message.
    # Emergent LLM Key charges roughly $3 / 1M input + $15 / 1M output (Anthropic passthrough).
    input_toks = total * 500
    output_toks = total * 350
    est_usd = (input_toks / 1_000_000) * 3.0 + (output_toks / 1_000_000) * 15.0
    est_eur = est_usd * 0.92  # rough USD→EUR
    # Emergent LLM Key credit: 1 credit = $0.01 (matches Emergent portal display)
    est_credits = round(est_usd * 100, 1)
    return {
        "days": days,
        "total_in_range": total,
        "total_messages_ever": total_messages_ever,
        "unique_sessions_in_range": len(sessions),
        "per_day": series,
        "per_language": dict(per_lang),
        "rate_limit_per_hour": CHAT_RATE_LIMIT_PER_HOUR,
        "cost": {
            "estimated_credits": est_credits,
            "estimated_eur": round(est_eur, 2),
            "estimated_usd": round(est_usd, 2),
            "avg_input_tokens_per_msg": 500,
            "avg_output_tokens_per_msg": 350,
            "note": "Schatting op basis van gemiddelde tokenverbruik per bericht.",
        },
    }


# ---- Chatbot ----
# Simple regex-based spam signals (fast, no LLM cost)
_SPAM_PATTERNS = [
    _re.compile(r"https?://\S+", _re.I),                           # URL spam
    _re.compile(r"\b(bitcoin|forex|crypto pump|onlyfans|xxx)\b", _re.I),
    _re.compile(r"(.)\1{9,}"),                                     # 10+ repeated chars
    _re.compile(r"\b\d{10,}\b"),                                   # long digit runs (phone spam)
]

_MIN_INTERVAL_SECONDS = 2  # anti-flood: 2s between messages per IP
_last_chat_ts: dict = defaultdict(float)


def _detect_spam(text: str) -> tuple[bool, str]:
    if not text or len(text.strip()) < 2:
        return True, "empty"
    if len(text) > 2000:
        return True, "too_long"
    for pat in _SPAM_PATTERNS:
        if pat.search(text):
            return True, f"pattern:{pat.pattern[:30]}"
    # simple caps-shout detection (all uppercase + long)
    alpha = [c for c in text if c.isalpha()]
    if len(alpha) > 40 and sum(1 for c in alpha if c.isupper()) / len(alpha) > 0.85:
        return True, "shout"
    return False, ""


# ---- Public form rate-limiter + Cybersecurity block logger ----
_PUB_RATE: dict[str, list[float]] = defaultdict(list)


def _parse_ua(ua: str) -> dict:
    """Extract OS / browser / device from a user-agent string (best-effort)."""
    ua = (ua or "").lower()
    os_name = "Onbekend"
    if "windows nt 10" in ua: os_name = "Windows 10/11"
    elif "windows nt 6.3" in ua: os_name = "Windows 8.1"
    elif "windows" in ua: os_name = "Windows"
    elif "mac os x" in ua or "macintosh" in ua: os_name = "macOS"
    elif "android" in ua: os_name = "Android"
    elif "iphone" in ua or "ipad" in ua or "ios" in ua: os_name = "iOS"
    elif "linux" in ua: os_name = "Linux"
    browser = "Onbekend"
    if "edg/" in ua: browser = "Edge"
    elif "chrome/" in ua and "chromium" not in ua: browser = "Chrome"
    elif "firefox/" in ua: browser = "Firefox"
    elif "safari/" in ua and "chrome/" not in ua: browser = "Safari"
    elif "curl/" in ua: browser = "cURL"
    elif "python-" in ua or "httpx" in ua: browser = "Python client"
    elif "bot" in ua or "crawler" in ua or "spider" in ua: browser = "Bot/Crawler"
    device = "Desktop"
    if "mobile" in ua or "iphone" in ua or "android" in ua: device = "Mobile"
    elif "tablet" in ua or "ipad" in ua: device = "Tablet"
    return {"os": os_name, "browser": browser, "device": device}


async def _record_block(request: Request, reason: str, endpoint: str, extra: dict | None = None):
    """Persist a blocked request into db.cybersec_blocks (unblocked=False by default)."""
    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "unknown").split(",")[0].strip()
    ua = request.headers.get("user-agent", "")[:300]
    parsed = _parse_ua(ua)
    # Country from Cloudflare / Kubernetes header if available; else "Unknown"
    country = request.headers.get("cf-ipcountry") or request.headers.get("x-country") or "Onbekend"
    doc = {
        "id": str(uuid.uuid4()),
        "ip": ip,
        "user_agent": ua,
        "referer": request.headers.get("referer", "")[:300],
        "endpoint": endpoint,
        "method": request.method,
        "reason": reason,  # "rate_limit" | "honeypot" | "spam" | "captcha" | "manual_block"
        "os": parsed["os"],
        "browser": parsed["browser"],
        "device": parsed["device"],
        "country": country,
        "extra": extra or {},
        "unblocked": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.cybersec_blocks.insert_one(doc)


def _public_rate_limit(request: Request, endpoint: str, window_seconds: int = 300, max_hits: int = 5):
    """Simple in-memory IP rate limiter for public POST endpoints. Raises 429 when exceeded."""
    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "unknown").split(",")[0].strip()
    key = f"{endpoint}:{ip}"
    # Check unblock status — if IP is manually blocked forever, honor it.
    # We rely on the async check right before this; caller can await _is_ip_blocked separately.
    now = time.time()
    hits = [t for t in _PUB_RATE[key] if now - t < window_seconds]
    if len(hits) >= max_hits:
        raise HTTPException(status_code=429, detail={
            "message": "Te veel verzoeken vanaf dit IP-adres. Probeer het later opnieuw.",
            "message_en": "Too many requests from this IP. Please try again later.",
            "retry_after_seconds": window_seconds,
        })
    hits.append(now)
    _PUB_RATE[key] = hits


async def _is_ip_manually_blocked(request: Request) -> bool:
    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "unknown").split(",")[0].strip()
    doc = await db.cybersec_manual_blocks.find_one({"ip": ip, "active": True}, {"_id": 0})
    return bool(doc)


def _chat_rate_check(request: Request) -> int:
    """Return remaining allowance for this IP; raise 429 if exhausted."""
    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "unknown").split(",")[0].strip()
    now = datetime.now(timezone.utc)
    # Anti-flood: 2 seconds between messages
    prev_ts = _last_chat_ts.get(ip, 0.0)
    if prev_ts and (now.timestamp() - prev_ts) < _MIN_INTERVAL_SECONDS:
        raise HTTPException(status_code=429, detail={
            "message": "Rustig aan — wacht 2 seconden.",
            "message_en": "Slow down — wait 2 seconds.",
            "retry_after_seconds": _MIN_INTERVAL_SECONDS,
        })
    _last_chat_ts[ip] = now.timestamp()
    window_start = now - timedelta(hours=1)
    hits = [t for t in _chat_rate_store[ip] if t > window_start]
    if len(hits) >= CHAT_RATE_LIMIT_PER_HOUR:
        raise HTTPException(status_code=429, detail={
            "message": "Te veel berichten. Probeer het later opnieuw.",
            "message_en": "Too many messages. Please try again later.",
            "retry_after_minutes": 60,
        })
    hits.append(now)
    _chat_rate_store[ip] = hits
    return max(0, CHAT_RATE_LIMIT_PER_HOUR - len(hits))


@api_router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(payload: ChatRequest, request: Request):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=503, detail="Chat service not configured")
    if await _is_ip_manually_blocked(request):
        await _record_block(request, "manual_block", "/api/chat")
        raise HTTPException(status_code=403, detail="Forbidden")
    # Spam gate — reject before hitting the LLM
    is_spam, reason = _detect_spam(payload.message)
    if is_spam:
        await db.chat_messages.insert_one({
            "session_id": payload.session_id,
            "user_message": payload.message[:200],
            "bot_reply": None,
            "spam": True,
            "spam_reason": reason,
            "language": payload.language,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        await _record_block(request, "spam", "/api/chat", {"spam_reason": reason, "session_id": payload.session_id})
        raise HTTPException(status_code=400, detail={
            "message": "Je bericht is als spam gedetecteerd. Herformuleer zonder links of speciale tekens.",
            "message_en": "Your message was flagged as spam. Please rephrase without links or special characters.",
            "reason": reason,
        })
    try:
        remaining = _chat_rate_check(request)
    except HTTPException:
        await _record_block(request, "rate_limit", "/api/chat", {"session_id": payload.session_id})
        raise
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=payload.session_id,
            system_message=CHATBOT_SYSTEM_PROMPT,
        ).with_model("anthropic", "claude-sonnet-4-6")
        response = await chat.send_message(UserMessage(text=payload.message))
        reply_text = response if isinstance(response, str) else str(response)
        await db.chat_messages.insert_one({
            "session_id": payload.session_id,
            "user_message": payload.message,
            "bot_reply": reply_text,
            "language": payload.language,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        return ChatResponse(reply=reply_text, session_id=payload.session_id, remaining=remaining)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail="Chat failed")


# ---- Agent handoff (from chat "Vraag een agent" button) ----
class AgentHandoffPayload(BaseModel):
    session_id: str = Field(..., min_length=3)
    name: str = Field(..., min_length=2, max_length=100)
    email: str = Field(..., min_length=3, max_length=200)
    subject: Optional[str] = None
    message: str = Field(..., min_length=5, max_length=2000)


@api_router.post("/chat/agent-handoff")
async def chat_agent_handoff(payload: AgentHandoffPayload, request: Request):
    """Client asked for a human. Log request, email support, schedule fallback if unanswered."""
    _chat_rate_check(request)  # same rate limit
    # Grab recent chat history from this session (last 20 exchanges) as context for the agent
    history = await db.chat_messages.find(
        {"session_id": payload.session_id, "spam": {"$ne": True}},
        {"_id": 0, "user_message": 1, "bot_reply": 1, "created_at": 1},
    ).sort("created_at", -1).to_list(20)
    history.reverse()
    history_html = "".join([
        f"<p><strong>{_html.escape(payload.name)}:</strong> {_html.escape(m.get('user_message') or '')}</p>"
        f"<p style='color:#64748b'><em>PearBlue AI:</em> {_html.escape((m.get('bot_reply') or '')[:600])}</p><hr/>"
        for m in history[-10:]
    ]) or "<p><em>Geen recente chat-historie.</em></p>"

    subject = payload.subject or f"Chat handoff — {payload.name}"
    body = f"""
    <h2>Nieuwe agent-handoff vanuit chatbot</h2>
    <p><strong>Naam:</strong> {_html.escape(payload.name)}<br/>
       <strong>E-mail:</strong> <a href="mailto:{_html.escape(payload.email)}">{_html.escape(payload.email)}</a><br/>
       <strong>Sessie:</strong> <code>{_html.escape(payload.session_id)}</code></p>
    <h3>Vraag</h3>
    <p style="white-space:pre-wrap">{_html.escape(payload.message)}</p>
    <h3>Laatste chat-uitwisseling</h3>
    {history_html}
    <p style="color:#94a3b8; font-size:12px">Antwoord binnen 2 minuten of er volgt automatisch een reminder.</p>
    """
    handoff_doc = {
        "id": str(uuid.uuid4()),
        "session_id": payload.session_id,
        "name": payload.name,
        "email": payload.email,
        "message": payload.message,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "acknowledged": False,
        "reminder_sent": False,
    }
    await db.chat_handoffs.insert_one(handoff_doc)
    await _send_email(CONTACT_RECIPIENT_EMAIL, f"[Chat] {subject}", body,
                      reply_to=payload.email)
    # Schedule fallback: 2 minutes later, send a "still waiting" reminder if not acknowledged
    async def fallback():
        await asyncio.sleep(120)
        doc = await db.chat_handoffs.find_one({"id": handoff_doc["id"]})
        if doc and not doc.get("acknowledged") and not doc.get("reminder_sent"):
            await db.chat_handoffs.update_one({"id": handoff_doc["id"]}, {"$set": {"reminder_sent": True}})
            await _send_email(
                CONTACT_RECIPIENT_EMAIL,
                f"[URGENT · Chat] Geen antwoord op {payload.name}",
                f"<p>Al 2 minuten geen antwoord op de chat-vraag van <strong>{_html.escape(payload.name)}</strong> "
                f"(<a href='mailto:{_html.escape(payload.email)}'>{_html.escape(payload.email)}</a>).</p>"
                f"<p>Bericht: {_html.escape(payload.message)}</p>"
                f"<p style='color:#94a3b8; font-size:12px'>Handoff-ID: {handoff_doc['id']}</p>",
                reply_to=payload.email,
            )
    asyncio.create_task(fallback())
    return {"status": "queued", "handoff_id": handoff_doc["id"]}


@api_router.post("/chat/agent-handoff/{handoff_id}/ack")
async def ack_handoff(handoff_id: str, current=Depends(require_admin)):
    res = await db.chat_handoffs.update_one({"id": handoff_id}, {"$set": {"acknowledged": True, "acknowledged_by": current.get("email")}})
    if res.modified_count == 0:
        raise HTTPException(404, "Handoff not found")
    return {"status": "acknowledged"}


# ---- Site settings ----
@api_router.get("/settings", response_model=SiteSettings)
async def get_settings():
    doc = await db.site_settings.find_one({"_id": "singleton"}, {"_id": 0})
    return SiteSettings(**(doc or {}))


@api_router.put("/settings", response_model=SiteSettings)
async def update_settings(payload: SiteSettingsUpdate, current=Depends(require_admin)):
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    await db.site_settings.update_one(
        {"_id": "singleton"},
        {"$set": updates},
        upsert=True,
    )
    doc = await db.site_settings.find_one({"_id": "singleton"}, {"_id": 0})
    return SiteSettings(**(doc or {}))


# ---- Portal registrations ----
def _reg_admin_html(r: PortalRegistration) -> str:
    return f"""
    <div style="font-family: Arial, sans-serif; max-width:600px; margin:0 auto; color:#0A192F;">
      <div style="background:#02C0FF; color:#fff; padding:24px; border-radius:12px 12px 0 0;">
        <h2 style="margin:0;">Nieuwe klantportaal-aanvraag</h2>
      </div>
      <table style="width:100%; background:#fff; padding:24px;">
        <tr><td><strong>Naam:</strong></td><td>{r.name}</td></tr>
        <tr><td><strong>E-mail:</strong></td><td>{r.email}</td></tr>
        <tr><td><strong>Bedrijf:</strong></td><td>{r.company or '-'}</td></tr>
        <tr><td><strong>Telefoon:</strong></td><td>{r.phone or '-'}</td></tr>
        <tr><td style="vertical-align:top;"><strong>Bericht:</strong></td><td style="white-space:pre-wrap;">{r.message or '-'}</td></tr>
      </table>
      <p style="text-align:center; color:#0A192F;">Log in op het CMS om deze aanvraag goed te keuren of af te wijzen.</p>
    </div>
    """


def _reg_approved_html(r: PortalRegistration) -> str:
    return f"""
    <div style="font-family: Arial, sans-serif; max-width:600px; margin:0 auto; color:#0A192F;">
      <div style="background:#02C0FF; color:#fff; padding:24px; border-radius:12px 12px 0 0;">
        <h2 style="margin:0;">Welkom bij het PearBlue klantportaal, {r.name}!</h2>
      </div>
      <div style="background:#fff; padding:24px;">
        <p>Je aanvraag is goedgekeurd. Je hebt vanaf nu toegang tot ons klantportaal.</p>
        <p><strong>Zo log je in:</strong></p>
        <ol>
          <li>Ga naar <a href="https://sheet-converter-68.preview.emergentagent.com/portal">het klantportaal</a>.</li>
          <li>Klik op <strong>Inloggen met Zoho</strong>.</li>
          <li>Gebruik je Zoho-account ({r.email}) om in te loggen.</li>
        </ol>
        <p>Nog geen Zoho account? We nodigen je binnenkort uit via Zoho.</p>
        {f'<p style="background:#F0FBFF; padding:12px; border-radius:8px;"><em>Opmerking van onze kant:</em><br/>{r.admin_note}</p>' if r.admin_note else ''}
        <p>Vragen? Mail ons op <a href="mailto:info@pearblue.nl">info@pearblue.nl</a>.</p>
      </div>
    </div>
    """


def _reg_rejected_html(r: PortalRegistration) -> str:
    return f"""
    <div style="font-family: Arial, sans-serif; max-width:600px; margin:0 auto; color:#0A192F;">
      <div style="background:#0A192F; color:#fff; padding:24px; border-radius:12px 12px 0 0;">
        <h2 style="margin:0;">Update over je portaal-aanvraag</h2>
      </div>
      <div style="background:#fff; padding:24px;">
        <p>Hi {r.name}, bedankt voor je interesse in het PearBlue klantportaal.</p>
        <p>Op dit moment kunnen we je aanvraag helaas niet goedkeuren.</p>
        {f'<p style="background:#FEF2F2; padding:12px; border-radius:8px;"><em>Toelichting:</em><br/>{r.admin_note}</p>' if r.admin_note else ''}
        <p>Neem contact op via <a href="mailto:info@pearblue.nl">info@pearblue.nl</a> als je vragen hebt.</p>
      </div>
    </div>
    """


async def _send_email(to_email: str, subject: str, html: str, reply_to: Optional[str] = None) -> bool:
    if not RESEND_API_KEY:
        logger.info("RESEND not configured — skipping email.")
        return False
    params = {"from": SENDER_EMAIL, "to": [to_email], "subject": subject, "html": html}
    if reply_to:
        params["reply_to"] = reply_to
    try:
        result = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Email sent: {result}")
        return True
    except Exception as e:
        logger.error(f"Email send failed: {e}")
        return False


@api_router.post("/portal/register", response_model=PortalRegistration)
async def register_portal(payload: PortalRegistrationCreate, request: Request):
    # IP defenses + block logging
    if await _is_ip_manually_blocked(request):
        await _record_block(request, "manual_block", "/api/portal/register")
        raise HTTPException(status_code=403, detail="Forbidden")
    try:
        _public_rate_limit(request, "/api/portal/register", window_seconds=3600, max_hits=5)
    except HTTPException:
        await _record_block(request, "rate_limit", "/api/portal/register")
        raise
    # Spam gate on the free-text message
    combined = f"{payload.company or ''} {payload.message or ''}"
    is_spam, reason = _detect_spam(combined) if combined.strip() else (False, "")
    if is_spam:
        await _record_block(request, "spam", "/api/portal/register", {"spam_reason": reason})
        raise HTTPException(status_code=400, detail={"message": "Aanvraag geblokkeerd — spam-signalen gedetecteerd.", "reason": reason})

    reg = PortalRegistration(**payload.model_dump())
    doc = reg.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    if doc.get('reviewed_at'):
        doc['reviewed_at'] = doc['reviewed_at'].isoformat()
    await db.portal_registrations.insert_one(doc)
    # Notify admin
    await _send_email(
        CONTACT_RECIPIENT_EMAIL,
        f"[PearBlue] Nieuwe portaal-aanvraag — {reg.name}",
        _reg_admin_html(reg),
        reply_to=reg.email,
    )
    return reg


@api_router.get("/portal/registrations", response_model=List[PortalRegistration])
async def list_registrations(status_filter: Optional[str] = None, current=Depends(require_admin)):
    q: dict = {}
    if status_filter:
        q["status"] = status_filter
    items = await db.portal_registrations.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    for i in items:
        if isinstance(i.get('created_at'), str):
            i['created_at'] = datetime.fromisoformat(i['created_at'])
        if isinstance(i.get('reviewed_at'), str):
            i['reviewed_at'] = datetime.fromisoformat(i['reviewed_at'])
    return items


@api_router.patch("/portal/registrations/{reg_id}", response_model=PortalRegistration)
async def review_registration(reg_id: str, payload: RegistrationReview, current=Depends(require_admin)):
    now = datetime.now(timezone.utc).isoformat()
    updates = {"status": payload.status, "reviewed_at": now}
    if payload.admin_note is not None:
        updates["admin_note"] = payload.admin_note
    if payload.assigned_to is not None:
        updates["assigned_to"] = payload.assigned_to or None
    result = await db.portal_registrations.update_one({"id": reg_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Registration not found")
    doc = await db.portal_registrations.find_one({"id": reg_id}, {"_id": 0})
    if isinstance(doc.get('created_at'), str):
        doc['created_at'] = datetime.fromisoformat(doc['created_at'])
    if isinstance(doc.get('reviewed_at'), str):
        doc['reviewed_at'] = datetime.fromisoformat(doc['reviewed_at'])
    reg = PortalRegistration(**doc)
    # Notify customer
    if payload.status == "approved":
        await _send_email(reg.email, "Je PearBlue klantportaal is klaar", _reg_approved_html(reg))
    elif payload.status == "rejected":
        await _send_email(reg.email, "Update over je portaal-aanvraag", _reg_rejected_html(reg))
    return reg


# ---- Reviews (customer testimonials) ----
@api_router.post("/reviews", response_model=Review)
async def create_review(payload: ReviewCreate, request: Request):
    if await _is_ip_manually_blocked(request):
        await _record_block(request, "manual_block", "/api/reviews")
        raise HTTPException(status_code=403, detail="Forbidden")
    try:
        _public_rate_limit(request, "/api/reviews", window_seconds=3600, max_hits=3)
    except HTTPException:
        await _record_block(request, "rate_limit", "/api/reviews")
        raise
    is_spam, reason = _detect_spam(payload.quote)
    if is_spam:
        await _record_block(request, "spam", "/api/reviews", {"spam_reason": reason})
        raise HTTPException(status_code=400, detail={"message": "Review geblokkeerd — spam-signalen.", "reason": reason})
    r = Review(**payload.model_dump())
    doc = r.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.reviews.insert_one(doc)
    # Notify admin
    await _send_email(
        CONTACT_RECIPIENT_EMAIL,
        f"[PearBlue] Nieuwe klantbeoordeling — {r.rating}★ van {_html.escape(r.name)}",
        f"<p>{_html.escape(r.name)}{' · ' + _html.escape(r.company) if r.company else ''} heeft een {r.rating}-sterren review achtergelaten:</p><blockquote>{_html.escape(r.quote)}</blockquote><p>Open het CMS om deze te publiceren.</p>",
    )
    return r


@api_router.get("/reviews", response_model=List[Review])
async def list_reviews(featured: Optional[bool] = None):
    """Public list — always only approved reviews. Pass featured=true for homepage picks."""
    q: dict = {"approved": True}
    if featured is not None:
        q["featured"] = featured
    items = await db.reviews.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)
    for i in items:
        if isinstance(i.get('created_at'), str):
            i['created_at'] = datetime.fromisoformat(i['created_at'])
    return items


@api_router.get("/reviews/all", response_model=List[Review])
async def list_all_reviews(current=Depends(require_admin)):
    items = await db.reviews.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    for i in items:
        if isinstance(i.get('created_at'), str):
            i['created_at'] = datetime.fromisoformat(i['created_at'])
    return items


@api_router.patch("/reviews/{review_id}", response_model=Review)
async def update_review(review_id: str, payload: ReviewUpdate, current=Depends(require_admin)):
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = await db.reviews.update_one({"id": review_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Review not found")
    doc = await db.reviews.find_one({"id": review_id}, {"_id": 0})
    if isinstance(doc.get('created_at'), str):
        doc['created_at'] = datetime.fromisoformat(doc['created_at'])
    return Review(**doc)


@api_router.delete("/reviews/{review_id}")
async def delete_review(review_id: str, current=Depends(require_admin)):
    result = await db.reviews.delete_one({"id": review_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Review not found")
    return {"status": "deleted"}


# ---- Review invitations (auto-poller + admin trigger) ----
@api_router.post("/admin/reviews/scan-invites")
async def admin_scan_review_invites(current=Depends(require_admin)):
    return await review_scan_now(db, _send_email)


@api_router.get("/admin/reviews/invite-log")
async def admin_invite_log(current=Depends(require_admin)):
    items = await db.review_invites.find({}, {"_id": 0}).sort("recorded_at", -1).to_list(200)
    return items


# ---- Public trust stats (for homepage) ----
@api_router.get("/stats/trust")
async def trust_stats():
    """Aggregate stats to show on the homepage. Cached implicitly by clients."""
    approved = await db.reviews.count_documents({"approved": True})
    # Average rating on approved reviews
    avg = 0.0
    if approved > 0:
        pipeline = [{"$match": {"approved": True}}, {"$group": {"_id": None, "avg": {"$avg": "$rating"}}}]
        cursor = db.reviews.aggregate(pipeline)
        async for row in cursor:
            avg = round(float(row.get("avg") or 0), 2)
            break
    # Completed projects = successful payment transactions (proxy) OR fall back to a manual count
    # Reasonable proxy: distinct paid Zoho invoices in payment_transactions
    completed_from_stripe = await db.payment_transactions.count_documents({"payment_status": "paid"})
    manual_bonus = int(os.environ.get("STATS_COMPLETED_PROJECTS_BASE", "0"))
    projects = completed_from_stripe + manual_bonus
    return {"reviews": approved, "avg": avg, "projects": projects}


# ============================================================================
# User management (Iteration 11) — CRUD over admins + Zoho link status
# ============================================================================
class UserCreatePayload(BaseModel):
    email: str = Field(..., min_length=3, max_length=200)
    role: str
    password: Optional[str] = None
    display_name: Optional[str] = None


class UserUpdatePayload(BaseModel):
    role: Optional[str] = None
    password: Optional[str] = None
    display_name: Optional[str] = None


@api_router.get("/admin/users")
async def list_users(current=Depends(require_permission("users"))):
    admins = await db.admins.find({}, {"_id": 0, "password_hash": 0}).to_list(500)
    zoho_users = await db.zoho_users.find({}, {"_id": 0, "email": 1}).to_list(500)
    zoho_emails = {(u.get("email") or "").lower().strip() for u in zoho_users if u.get("email")}
    out = []
    for a in admins:
        email_l = (a.get("email") or "").lower().strip()
        out.append({
            "email": a.get("email"),
            "role": a.get("role", "gebruiker"),
            "display_name": a.get("display_name"),
            "auth_source": a.get("auth_source", "password"),
            "zoho_linked": email_l in zoho_emails,
            "created_at": a.get("created_at"),
        })
    # Include zoho-only users not present in admins
    admin_emails = {(a.get("email") or "").lower().strip() for a in admins}
    for zu in zoho_users:
        email_l = (zu.get("email") or "").lower().strip()
        if email_l and email_l not in admin_emails:
            out.append({
                "email": zu.get("email"),
                "role": ROLE_GEBRUIKER,
                "display_name": None,
                "auth_source": "zoho",
                "zoho_linked": True,
                "created_at": None,
            })
    return sorted(out, key=lambda x: (x.get("email") or ""))


@api_router.post("/admin/users")
async def create_user(payload: UserCreatePayload, current=Depends(require_permission("users"))):
    if payload.role not in ALL_ROLES:
        raise HTTPException(400, f"Invalid role. Allowed: {ALL_ROLES}")
    # Only super_admin can create/edit other super_admins
    if payload.role == ROLE_SUPER_ADMIN and current.get("role") not in {ROLE_SUPER_ADMIN, "admin"}:
        raise HTTPException(403, "Only super_admin can assign super_admin role")
    email_l = payload.email.lower().strip()
    if await db.admins.find_one({"email": email_l}):
        raise HTTPException(409, "User already exists")
    doc = {
        "email": email_l,
        "role": payload.role,
        "display_name": payload.display_name,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current.get("email"),
    }
    if payload.password:
        doc["password_hash"] = hash_password(payload.password)
    else:
        doc["password_hash"] = "zoho-oauth-only"
        doc["auth_source"] = "zoho"
    await db.admins.insert_one(doc)
    await _log_activity(current.get("email"), "user.create", email_l, {"role": payload.role})
    doc.pop("password_hash", None)
    doc.pop("_id", None)
    return doc


@api_router.patch("/admin/users/{email}")
async def update_user(email: str, payload: UserUpdatePayload, current=Depends(require_permission("users"))):
    email_l = email.lower().strip()
    existing = await db.admins.find_one({"email": email_l})
    if not existing:
        raise HTTPException(404, "User not found")
    if existing.get("role") == ROLE_SUPER_ADMIN and current.get("role") not in {ROLE_SUPER_ADMIN, "admin"}:
        raise HTTPException(403, "Only super_admin can modify super_admin accounts")
    updates = {}
    if payload.role is not None:
        if payload.role not in ALL_ROLES:
            raise HTTPException(400, f"Invalid role. Allowed: {ALL_ROLES}")
        if payload.role == ROLE_SUPER_ADMIN and current.get("role") not in {ROLE_SUPER_ADMIN, "admin"}:
            raise HTTPException(403, "Only super_admin can assign super_admin role")
        updates["role"] = payload.role
    if payload.display_name is not None:
        updates["display_name"] = payload.display_name
    if payload.password:
        updates["password_hash"] = hash_password(payload.password)
    if not updates:
        raise HTTPException(400, "Nothing to update")
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    updates["updated_by"] = current.get("email")
    await db.admins.update_one({"email": email_l}, {"$set": updates})
    await _log_activity(current.get("email"), "user.update", email_l, {k: v for k, v in updates.items() if k != "password_hash"})
    return {"status": "updated"}


@api_router.delete("/admin/users/{email}")
async def delete_user(email: str, current=Depends(require_permission("users"))):
    email_l = email.lower().strip()
    if email_l == ADMIN_EMAIL.lower():
        raise HTTPException(400, "Cannot delete seed admin")
    existing = await db.admins.find_one({"email": email_l})
    if not existing:
        raise HTTPException(404, "User not found")
    if existing.get("role") == ROLE_SUPER_ADMIN and current.get("role") not in {ROLE_SUPER_ADMIN, "admin"}:
        raise HTTPException(403, "Only super_admin can delete super_admin accounts")
    await db.admins.delete_one({"email": email_l})
    await _log_activity(current.get("email"), "user.delete", email_l)
    return {"status": "deleted"}


@api_router.get("/admin/roles")
async def list_roles(current=Depends(require_permission("users"))):
    return [
        {"key": r, "permissions": sorted(list(ROLE_PERMS.get(r, set())))}
        for r in ALL_ROLES
    ]


@api_router.get("/admin/activity-log")
async def activity_log(limit: int = 100, current=Depends(require_permission("users"))):
    items = await db.activity_log.find({}, {"_id": 0}).sort("created_at", -1).to_list(min(limit, 500))
    return items


# ============================================================================
# Custom scripts (super_admin only) — inject in <head> and end of <body>
# ============================================================================
class CustomScripts(BaseModel):
    header_scripts: str = ""
    footer_scripts: str = ""


@api_router.get("/site/scripts")
async def public_get_scripts():
    """Public read — used by the frontend to inject custom scripts (Trustpilot, etc.)."""
    doc = await db.site_config.find_one({"_id": "scripts"}, {"_id": 0}) or {}
    return {"header_scripts": doc.get("header_scripts", ""), "footer_scripts": doc.get("footer_scripts", "")}


@api_router.put("/admin/scripts")
async def update_scripts(payload: CustomScripts, current=Depends(require_permission("scripts"))):
    await db.site_config.update_one(
        {"_id": "scripts"},
        {"$set": {"header_scripts": payload.header_scripts, "footer_scripts": payload.footer_scripts,
                  "updated_at": datetime.now(timezone.utc).isoformat(), "updated_by": current.get("email")}},
        upsert=True,
    )
    # Also persist to public/index.html for SSR crawlers (Trustpilot verification, GTB, Facebook debugger)
    try:
        idx_path = _Path("/app/frontend/public/index.html")
        if idx_path.exists():
            html_text = idx_path.read_text(encoding="utf-8")
            html_text = _re.sub(
                r"<!-- PB_HEADER_START -->.*?<!-- PB_HEADER_END -->",
                f"<!-- PB_HEADER_START -->{payload.header_scripts}<!-- PB_HEADER_END -->",
                html_text, flags=_re.DOTALL,
            )
            html_text = _re.sub(
                r"<!-- PB_FOOTER_START -->.*?<!-- PB_FOOTER_END -->",
                f"<!-- PB_FOOTER_START -->{payload.footer_scripts}<!-- PB_FOOTER_END -->",
                html_text, flags=_re.DOTALL,
            )
            idx_path.write_text(html_text, encoding="utf-8")
    except Exception as e:
        logger.warning(f"Failed to write scripts into index.html: {e}")
    await _log_activity(current.get("email"), "scripts.update", None,
                        {"header_len": len(payload.header_scripts), "footer_len": len(payload.footer_scripts)})
    return {"status": "saved"}


# ---- Feedback (public submissions + admin list) ----
class FeedbackPayload(BaseModel):
    page: str = Field(..., min_length=1, max_length=80)
    message: str = Field(..., min_length=5, max_length=2000)
    email: Optional[str] = Field(None, max_length=200)
    rating: Optional[int] = Field(None, ge=1, le=5)


def _client_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for", "")
    return xff.split(",")[0].strip() if xff else (request.client.host if request.client else "unknown")


_FEEDBACK_RATE: dict[str, float] = {}


@api_router.post("/feedback")
async def submit_feedback(payload: FeedbackPayload, request: Request):
    ip = _client_ip(request)
    now = time.time()
    last = _FEEDBACK_RATE.get(ip, 0)
    if now - last < 20:  # 20s between submissions per IP
        raise HTTPException(429, "Please wait a moment before sending another feedback")
    _FEEDBACK_RATE[ip] = now
    is_spam, reason = _detect_spam(payload.message)
    doc = {
        "id": str(uuid.uuid4()),
        "page": payload.page.strip(),
        "message": payload.message.strip(),
        "email": (payload.email or "").strip() or None,
        "rating": payload.rating,
        "ip": ip,
        "user_agent": request.headers.get("user-agent", "")[:300],
        "status": "new",  # new | in_progress | on_hold | done
        "assigned_to": None,
        "notes": [],
        "spam": bool(is_spam),
        "spam_reason": reason if is_spam else None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.feedback.insert_one(doc)
    return {"status": "received"}


@api_router.get("/admin/feedback")
async def list_feedback(current=Depends(require_permission("messages"))):
    docs = await db.feedback.find({"spam": {"$ne": True}}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return docs


@api_router.patch("/admin/feedback/{fid}")
async def update_feedback(fid: str, patch: dict, current=Depends(require_permission("messages"))):
    allowed = {"status", "assigned_to"}
    upd = {k: v for k, v in (patch or {}).items() if k in allowed}
    if not upd:
        raise HTTPException(400, "Nothing to update")
    upd["updated_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.feedback.update_one({"id": fid}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(404, "Feedback not found")
    await _log_activity(current.get("email"), "feedback.update", fid, upd)
    return {"status": "updated"}


@api_router.post("/admin/feedback/{fid}/notes")
async def add_feedback_note(fid: str, payload: dict, current=Depends(require_permission("messages"))):
    text = (payload or {}).get("text", "").strip()
    if not text or len(text) > 2000:
        raise HTTPException(400, "Invalid note text")
    note = {"id": str(uuid.uuid4()), "text": text, "by": current.get("email"), "at": datetime.now(timezone.utc).isoformat()}
    res = await db.feedback.update_one({"id": fid}, {"$push": {"notes": note}})
    if res.matched_count == 0:
        raise HTTPException(404, "Feedback not found")
    return note


# ---- Cybersecurity CMS (blocked IPs / requests) ----
@api_router.get("/admin/cybersecurity/blocks")
async def list_cybersec_blocks(limit: int = 300, current=Depends(require_permission("cybersecurity"))):
    docs = await db.cybersec_blocks.find({}, {"_id": 0}).sort("created_at", -1).to_list(min(limit, 1000))
    # Enrich with manual-block status by IP
    ips = list({d.get("ip") for d in docs if d.get("ip")})
    manual = {}
    if ips:
        async for m in db.cybersec_manual_blocks.find({"ip": {"$in": ips}}, {"_id": 0}):
            manual[m["ip"]] = m
    for d in docs:
        d["ip_manually_blocked"] = bool(manual.get(d.get("ip"), {}).get("active"))
    return docs


@api_router.post("/admin/cybersecurity/blocks/{block_id}/unblock")
async def unblock_block(block_id: str, current=Depends(require_permission("cybersecurity"))):
    """Mark this block record as unblocked. Also lifts manual block on its IP."""
    doc = await db.cybersec_blocks.find_one({"id": block_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Block not found")
    await db.cybersec_blocks.update_one(
        {"id": block_id},
        {"$set": {"unblocked": True, "unblocked_at": datetime.now(timezone.utc).isoformat(), "unblocked_by": current.get("email")}},
    )
    # Also deactivate manual-block for this IP if any
    if doc.get("ip"):
        await db.cybersec_manual_blocks.update_many({"ip": doc["ip"]}, {"$set": {"active": False}})
    await _log_activity(current.get("email"), "cybersec.unblock", block_id, {"ip": doc.get("ip")})
    return {"status": "unblocked"}


@api_router.post("/admin/cybersecurity/blocks/{block_id}/reblock")
async def reblock_block(block_id: str, current=Depends(require_permission("cybersecurity"))):
    """Reinstate the block record + add/activate a manual block entry on its IP."""
    doc = await db.cybersec_blocks.find_one({"id": block_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Block not found")
    await db.cybersec_blocks.update_one(
        {"id": block_id},
        {"$set": {"unblocked": False, "reblocked_at": datetime.now(timezone.utc).isoformat(), "reblocked_by": current.get("email")}},
    )
    if doc.get("ip"):
        await db.cybersec_manual_blocks.update_one(
            {"ip": doc["ip"]},
            {"$set": {
                "ip": doc["ip"],
                "active": True,
                "reason": "manual",
                "by": current.get("email"),
                "at": datetime.now(timezone.utc).isoformat(),
            }},
            upsert=True,
        )
    await _log_activity(current.get("email"), "cybersec.reblock", block_id, {"ip": doc.get("ip")})
    return {"status": "reblocked"}


@api_router.get("/admin/cybersecurity/stats")
async def cybersec_stats(current=Depends(require_permission("cybersecurity"))):
    """Daily block counts for the last 30 days + reason breakdown for the chart."""
    now = datetime.now(timezone.utc)
    since = (now - timedelta(days=30)).isoformat()
    docs = await db.cybersec_blocks.find({"created_at": {"$gte": since}}, {"_id": 0, "created_at": 1, "reason": 1, "ip": 1}).to_list(20000)
    by_day: dict[str, int] = {}
    by_reason: dict[str, int] = {}
    unique_ips: set[str] = set()
    for d in docs:
        try:
            day = d["created_at"][:10]
        except Exception:
            continue
        by_day[day] = by_day.get(day, 0) + 1
        r = d.get("reason") or "unknown"
        by_reason[r] = by_reason.get(r, 0) + 1
        if d.get("ip"):
            unique_ips.add(d["ip"])
    daily = [{"day": k, "count": v} for k, v in sorted(by_day.items())]
    reasons = [{"reason": k, "count": v} for k, v in sorted(by_reason.items(), key=lambda x: -x[1])]
    return {"total_30d": len(docs), "unique_ips_30d": len(unique_ips), "daily": daily, "reasons": reasons}


# ---- CMS sidebar counters (unresolved-badge numbers) ----
@api_router.get("/admin/counters")
async def cms_counters(current=Depends(require_admin)):
    # Only count "open" items that need attention.
    messages_new = await db.contact_messages.count_documents({"status": {"$in": [None, "new", "in_progress", "on_hold"]}})
    # Fallback for legacy records without a status field
    if messages_new == 0:
        messages_new = await db.contact_messages.count_documents({"status": {"$exists": False}})
    portal_pending = await db.portal_registrations.count_documents({"status": "pending"})
    reviews_pending = await db.reviews.count_documents({"approved": False})
    feedback_new = await db.feedback.count_documents({"status": {"$in": [None, "new", "in_progress", "on_hold"]}, "spam": {"$ne": True}})
    handoffs_pending = await db.chat_handoffs.count_documents({"acknowledged": False})
    cybersec_new_24h = await db.cybersec_blocks.count_documents({
        "unblocked": {"$ne": True},
        "created_at": {"$gte": (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()},
    })
    return {
        "messages": messages_new,
        "portal": portal_pending,
        "reviews": reviews_pending,
        "feedback": feedback_new,
        "handoffs": handoffs_pending,
        "cybersecurity": cybersec_new_24h,
        "virus_scanner": await db.virus_scans.count_documents({"acknowledged": {"$ne": True}}),
    }


# ---- Contact-message status/notes (CMS) ----
@api_router.patch("/admin/contact/{msg_id}")
async def patch_contact_status(msg_id: str, patch: dict, current=Depends(require_permission("messages"))):
    allowed = {"status", "assigned_to", "priority", "spam"}
    upd = {k: v for k, v in (patch or {}).items() if k in allowed}
    if not upd:
        raise HTTPException(400, "Nothing to update")
    upd["updated_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.contact_messages.update_one({"id": msg_id}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(404, "Message not found")
    await _log_activity(current.get("email"), "message.update", msg_id, upd)
    return {"status": "updated"}


@api_router.post("/admin/contact/{msg_id}/notes")
async def add_contact_note(msg_id: str, payload: dict, current=Depends(require_permission("messages"))):
    text = (payload or {}).get("text", "").strip()
    if not text or len(text) > 2000:
        raise HTTPException(400, "Invalid note text")
    note = {"id": str(uuid.uuid4()), "text": text, "by": current.get("email"), "at": datetime.now(timezone.utc).isoformat()}
    res = await db.contact_messages.update_one(
        {"id": msg_id},
        [{"$set": {"notes": {"$concatArrays": [{"$ifNull": ["$notes", []]}, [note]]}}}],
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Message not found")
    return note


# ---- Ticket Threads CMS: single message detail + replies + attachments ----
@api_router.get("/admin/contact/{msg_id}")
async def get_contact_message(msg_id: str, current=Depends(require_permission("messages"))):
    doc = await db.contact_messages.find_one({"id": msg_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Message not found")
    # Strip heavy base64 payload from attachments; keep metadata only
    if doc.get("attachments"):
        doc["attachments"] = [
            {k: v for k, v in a.items() if k != "data_b64"} for a in doc["attachments"]
        ]
    return doc


class ReplyPayload(BaseModel):
    body: str = Field(..., min_length=1, max_length=10000)
    subject: Optional[str] = Field(None, max_length=200)
    send_email: bool = True


@api_router.post("/admin/contact/{msg_id}/reply")
async def reply_contact_message(msg_id: str, payload: ReplyPayload, current=Depends(require_permission("messages"))):
    doc = await db.contact_messages.find_one({"id": msg_id})
    if not doc:
        raise HTTPException(404, "Message not found")
    now_iso = datetime.now(timezone.utc).isoformat()
    subject = (payload.subject or f"Re: {doc.get('subject') or 'PearBlue'}").strip()[:200]
    reply = {
        "id": str(uuid.uuid4()),
        "direction": "out",  # admin -> client
        "author": current.get("email"),
        "body": payload.body.strip(),
        "subject": subject,
        "at": now_iso,
        "email_sent": False,
    }
    # Send email via Resend if configured and requested
    if payload.send_email and RESEND_API_KEY and doc.get("email"):
        html_body = (
            "<div style='font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#0A192F;'>"
            "<div style='background:#02C0FF;color:#fff;padding:20px;border-radius:12px 12px 0 0;'>"
            f"<h2 style='margin:0;'>PearBlue — {_html.escape(subject)}</h2></div>"
            "<div style='background:#fff;padding:24px;'>"
            f"<div style='white-space:pre-wrap;line-height:1.55;'>{_html.escape(payload.body).replace(chr(10), '<br/>')}</div>"
            "<hr style='margin:24px 0;border:none;border-top:1px solid #eee;'/>"
            f"<p style='font-size:12px;color:#666;'>Beantwoord dit e-mailbericht om verder te reageren.<br/>Referentie: #{doc.get('id')}</p>"
            "</div></div>"
        )
        ok = await _send_email(doc["email"], subject, html_body, reply_to=SENDER_EMAIL)
        reply["email_sent"] = bool(ok)
    await db.contact_messages.update_one(
        {"id": msg_id},
        [{"$set": {
            "replies": {"$concatArrays": [{"$ifNull": ["$replies", []]}, [reply]]},
            "updated_at": now_iso,
            "status": {"$cond": [{"$eq": ["$status", "done"]}, "done", "in_progress"]},
        }}],
    )
    await _log_activity(current.get("email"), "message.reply", msg_id, {"email_sent": reply["email_sent"]})
    return reply


@api_router.post("/admin/contact/{msg_id}/attachments")
async def upload_contact_attachment(msg_id: str, file: UploadFile = File(...), current=Depends(require_permission("messages"))):
    doc = await db.contact_messages.find_one({"id": msg_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Message not found")
    raw = await file.read()
    if len(raw) > 20 * 1024 * 1024:
        raise HTTPException(413, "File too large (>20 MB)")
    attach = {
        "id": str(uuid.uuid4()),
        "name": file.filename or "file",
        "mime": file.content_type or "application/octet-stream",
        "size": len(raw),
        "data_b64": base64.b64encode(raw).decode("ascii"),
        "by": current.get("email"),
        "at": datetime.now(timezone.utc).isoformat(),
    }
    await db.contact_messages.update_one(
        {"id": msg_id},
        [{"$set": {"attachments": {"$concatArrays": [{"$ifNull": ["$attachments", []]}, [attach]]}}}],
    )
    # Do not return the base64 payload back in the response (keep it small)
    return {"id": attach["id"], "name": attach["name"], "mime": attach["mime"], "size": attach["size"], "by": attach["by"], "at": attach["at"]}


@api_router.get("/admin/contact/{msg_id}/attachments/{attach_id}")
async def download_contact_attachment(msg_id: str, attach_id: str, current=Depends(require_permission("messages"))):
    doc = await db.contact_messages.find_one({"id": msg_id}, {"attachments": 1})
    if not doc:
        raise HTTPException(404, "Message not found")
    att = next((a for a in (doc.get("attachments") or []) if a.get("id") == attach_id), None)
    if not att or not att.get("data_b64"):
        raise HTTPException(404, "Attachment not found")
    try:
        raw = base64.b64decode(att["data_b64"])
    except Exception:
        raise HTTPException(500, "Attachment corrupt")
    return Response(
        content=raw,
        media_type=att.get("mime") or "application/octet-stream",
        headers={"Content-Disposition": f"attachment; filename=\"{att.get('name', 'file')}\""},
    )


@api_router.delete("/admin/contact/{msg_id}/attachments/{attach_id}")
async def delete_contact_attachment(msg_id: str, attach_id: str, current=Depends(require_permission("messages"))):
    res = await db.contact_messages.update_one({"id": msg_id}, {"$pull": {"attachments": {"id": attach_id}}})
    if res.matched_count == 0:
        raise HTTPException(404, "Message not found")
    return {"status": "deleted"}


# ---- Inline attachment preview (streams the raw bytes without a "download" filename header) ----
@api_router.get("/admin/contact/{msg_id}/attachments/{attach_id}/preview")
async def preview_contact_attachment(msg_id: str, attach_id: str, current=Depends(require_permission("messages"))):
    doc = await db.contact_messages.find_one({"id": msg_id}, {"attachments": 1})
    if not doc:
        raise HTTPException(404, "Message not found")
    att = next((a for a in (doc.get("attachments") or []) if a.get("id") == attach_id), None)
    if not att or not att.get("data_b64"):
        raise HTTPException(404, "Attachment not found")
    try:
        raw = base64.b64decode(att["data_b64"])
    except Exception:
        raise HTTPException(500, "Attachment corrupt")
    return Response(
        content=raw,
        media_type=att.get("mime") or "application/octet-stream",
        headers={"Content-Disposition": f"inline; filename=\"{att.get('name', 'file')}\""},
    )


# ---- Reply templates (CRUD) — used by the Ticket Threads CMS quick-insert dropdown ----
class ReplyTemplate(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str = Field(..., min_length=1, max_length=120)
    body: str = Field(..., min_length=1, max_length=5000)
    lang: Optional[str] = "nl"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None


class ReplyTemplateCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=120)
    body: str = Field(..., min_length=1, max_length=5000)
    lang: Optional[str] = "nl"


@api_router.get("/admin/reply-templates")
async def list_reply_templates(current=Depends(require_permission("messages"))):
    items = await db.reply_templates.find({}, {"_id": 0}).sort("title", 1).to_list(200)
    return items


@api_router.post("/admin/reply-templates", response_model=ReplyTemplate)
async def create_reply_template(payload: ReplyTemplateCreate, current=Depends(require_permission("messages"))):
    tpl = ReplyTemplate(**payload.model_dump(), created_by=current.get("email"))
    await db.reply_templates.insert_one(tpl.model_dump(mode="json"))
    return tpl


@api_router.patch("/admin/reply-templates/{tid}")
async def update_reply_template(tid: str, payload: ReplyTemplateCreate, current=Depends(require_permission("messages"))):
    upd = payload.model_dump()
    res = await db.reply_templates.update_one({"id": tid}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(404, "Template not found")
    return {"status": "updated"}


@api_router.delete("/admin/reply-templates/{tid}")
async def delete_reply_template(tid: str, current=Depends(require_permission("messages"))):
    res = await db.reply_templates.delete_one({"id": tid})
    if res.deleted_count == 0:
        raise HTTPException(404, "Template not found")
    return {"status": "deleted"}




# ---- Bulk actions for messages ----
class BulkIds(BaseModel):
    ids: List[str]


@api_router.post("/admin/contact/bulk-delete")
async def bulk_delete_contacts(payload: BulkIds, current=Depends(require_permission("messages"))):
    if not payload.ids:
        return {"deleted": 0}
    res = await db.contact_messages.delete_many({"id": {"$in": payload.ids}})
    await _log_activity(current.get("email"), "messages.bulk_delete", None, {"count": res.deleted_count})
    return {"deleted": res.deleted_count}


@api_router.post("/admin/contact/delete-all-spam")
async def delete_all_spam(current=Depends(require_permission("messages"))):
    res = await db.contact_messages.delete_many({"spam": True})
    await _log_activity(current.get("email"), "messages.delete_spam", None, {"count": res.deleted_count})
    return {"deleted": res.deleted_count}


# ---- Assignees (users assignable to items) ----
_ASSIGNABLE_ROLES = {"super_admin", "admin", "beheerder", "moderator", "chat_support", "crm"}


@api_router.get("/admin/assignees")
async def list_assignees(current=Depends(require_admin)):
    admins = await db.admins.find(
        {"role": {"$in": list(_ASSIGNABLE_ROLES)}},
        {"_id": 0, "password_hash": 0},
    ).to_list(200)
    return sorted(
        [{
            "email": a.get("email"),
            "display_name": a.get("display_name"),
            "first_name": a.get("first_name") or "",
            "last_name": a.get("last_name") or "",
            "role": a.get("role", "admin"),
            "profile_picture": a.get("profile_picture") or "",
        } for a in admins if a.get("email")],
        key=lambda x: x["email"],
    )


# ---- Verified captchas counter (public POST) ----
@api_router.post("/telemetry/captcha-verified")
async def telemetry_captcha_verified(request: Request):
    """Public — the LocalCaptcha component pings this every time a human successfully ticks."""
    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "unknown").split(",")[0].strip()
    # Dedupe: only one per IP per hour to avoid inflation
    key = f"captcha:{ip}"
    now = time.time()
    hits = [t for t in _PUB_RATE[key] if now - t < 3600]
    if len(hits) >= 10:
        return {"ok": False}
    hits.append(now)
    _PUB_RATE[key] = hits
    await db.cybersec_captchas.insert_one({"ip": ip, "at": datetime.now(timezone.utc).isoformat()})
    return {"ok": True}


@api_router.get("/admin/cybersecurity/captcha-stats")
async def captcha_stats(current=Depends(require_permission("cybersecurity"))):
    since = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    docs = await db.cybersec_captchas.find({"at": {"$gte": since}}, {"_id": 0, "at": 1}).to_list(20000)
    by_day: dict[str, int] = {}
    for d in docs:
        try:
            k = d["at"][:10]
            by_day[k] = by_day.get(k, 0) + 1
        except Exception:
            continue
    return {"total_30d": len(docs), "daily": [{"day": k, "count": v} for k, v in sorted(by_day.items())]}


# ---- Changelog ----
@api_router.get("/changelog")
async def public_changelog():
    """Public JSON of released versions.

    Semver-like schema for a Beta site:
      * X.0.0-Beta  → Major release (large batch of features / architecture)
      * 0.X.0-Beta  → Feature release (a themed feature set — content, calc, security)
      * 0.0.X-Beta  → Minor release (bug-fix / copy-tweak / polish)

    v1.0 will be the official launch, dropping the -Beta suffix.
    """
    entries = [
        {
            "version": "0.5.5-Beta",
            "date": "2026-02-10",
            "type": "feature",
            "highlights": [
                "Password Reset UI-pagina op /admin/reset-password?token=… (backend en frontend werken volledig)",
                "Klantportaal aanvragen: adres, postcode, plaats, regio + land met 🇳🇱🇧🇪🇩🇪🇫🇷🇬🇧🇺🇸 emoji-vlaggen. Regio-lijst reageert op landkeuze (NL toont NL-provincies)",
                "Klantportaal welkomstblok: profielfoto (Avatar-component gedeeld tussen CMS en portaal) naast naam ingelogde klant",
                "Reviews marquee (Home) — 22s cyclus (2x sneller), 5x replicated array voor naadloos oneindig scrollen zonder lege plekken",
                "Floating review pill toont nu naam + bedrijf naast quote (was alleen quote)",
                "Assignee-labels tonen enkel voornaam+achternaam (fallback display_name of email local-part) — geen e-mail meer in dropdowns",
                "CMS mobile header: 'Terug naar site' knop ipv versietekst, geen logo (logo staat in hamburger-menu), compactere layout",
                "CMS mobile hamburger: klik buiten menu (backdrop) sluit het menu",
                "CMS zijmenu-logo: groter en gecentreerd bovenaan (h-12 lg:h-14)",
                "CMS badges: kleinere rode pillen (18px min-width) direct naast label voor compactere weergave",
                "Homepage hero mobile: kortere overline 'WEBSITES · IT · CYBERSECURITY' + text-4xl H1 past netjes binnen phone-kaders",
                "Calculator: knoppen in 1 horizontale rij met scroll ipv wrap, kortere labels op mobile ('Leeg', 'Deel', 'Offerte + wensen')",
                "Backend: UserDetailsUpdate + user_details endpoint uitgebreid met region + phone",
                "Backend: PortalRegistrationCreate + PortalRegistration uitgebreid met address/postal_code/city/region/country",
                "Avatar-component naar /app/frontend/src/components/Avatar.jsx verplaatst voor herbruik",
            ],
        },
        {
            "version": "0.5.4-Beta",
            "date": "2026-02-10",
            "type": "fix",
            "highlights": [
                "Theme-aware styling voor ALLE selects, inputs en textareas — geen witte-op-witte vakjes meer in CMS (thema-adaptief bg + border + option kleuren)",
                "CMS mobiel: nieuwe hamburger header met PearBlue-logo + versie-badge, zijmenu klapt uit/in",
                "CMS zijmenu: PearBlue logo bovenaan + profielfoto naast naam ingelogde gebruiker + taal (NL/EN) en thema-toggle onderaan",
                "Homepage klantverhalen: 2x weergave opgelost — enkele oneindige marquee (32s ipv 60s, ~2x sneller) met drag-to-scroll + hover-pauze",
                "Homepage hero-titel: schaalt netjes op smalle telefoons (text-4xl base) — geen half-doorgesneden titels meer",
                "Calculator mobiel: compact 3-kolom-grid altijd zichtbaar zodat de lijst met keuzes leesbaar blijft; totalen samengevoegd in kleinere blokken",
                "Klantportaal facturen: View toont PDF-preview modal in-page · PDF opent in nieuw tabblad via blob-URL · Print triggert direct printerscherm (fallback via hidden iframe voor popup-blockers)",
                "Klantportaal admin-shortcut + Uitloggen knop: geen overloop meer op smalle schermen (flex-wrap)",
                "Cybersecurity CMS: sticky rechterkolom heeft nu themakleur (surface) ipv transparant — geen overlap met tabelcellen op tablet",
                "Services page: 'vanaf €5 p/machine p/maand' vertaalt nu correct naar 'from €5 /machine /month' in Engels",
                "Footer 'Klantportaal' vertaalt naar 'Client portal' in Engels",
            ],
        },
        {
            "version": "0.5.3-Beta",
            "date": "2026-02-08",
            "type": "feature",
            "highlights": [
                "Nieuwe rol 'CRM' (Customer Relationship Manager) — mag klantgegevens bewerken + reset-mails sturen",
                "Uitgebreide gebruiker-bewerken modal in CMS (voornaam, achternaam, adres, postcode, plaats, land, bedrijf, KVK, BTW)",
                "Random pear+robot profielfoto generator (DiceBear bottts + PearBlue palet)",
                "Direct wachtwoord wijzigen door super_admin/beheerder + notificatie-mail naar klant",
                "Wachtwoord reset via publieke `/auth/reset-password/verify` + `/auth/reset-password/apply` endpoints",
                "Assignee-picker met voornaam + achternaam + rol + profielfoto voor Berichten, Feedback, Klantreviews en Portaal aanvragen",
                "Automatische lock op berichten/feedback zodra status 'afgerond' — behalve super_admin/admin",
                "Homepage: nieuwe reviews vervagen 1-voor-1 in/uit als drijvende pil bovenaan de hero",
                "Homepage: middelste reviews-sectie automatisch oneindig scrollend (marquee) met hover-pauze",
                "Calculator: 'Anders' vrij-tekstveld met info-tooltip (uitleg over flexibele prijs)",
                "Calculator: 'Contact' knop verwijderd — voer alles via het offerte-formulier",
                "Cybersecurity: 'Virusscanner openen' knop met unread-badge (verdwijnt na openen)",
                "Taal + thema-voorkeuren persistent in cookies + localStorage + user profile (`/auth/me/prefs`)",
                "Parallax logo: fullscreen watermark op alle pagina's + secondaire textuurlaag",
            ],
        },
        {
            "version": "0.5.2-Beta",
            "date": "2026-02-08",
            "type": "feature",
            "highlights": [
                "Nieuwe rol 'Financiën' toegevoegd — volledige financiële toegang",
                "AI Dashboard uitgebreid met Financiën-sectie (Emergent AI-kosten + Zoho Books, MOCKED)",
                "Filters 7d / 30d / 90d / 6m / 1-5j / custom in Financiën-dashboard",
                "Chat-rating (1-5 smileys) toegevoegd + analytics grafiek in AI Dashboard",
                "Fernet-encryptie voor Brevo API-key en IMAP-wachtwoorden in de database",
                "Calculator: per-categorie subtotalen (Eenmalig/Maandelijks/Uurlijks)",
                "Calculator: 'Offerte aanvragen en calculatie en wensen mee verzenden' knop met dedicated formulier",
                "Nieuwe 'SFEER EN VERHAAL VAN UW WEBSITE' textarea in offerte-flow",
                "Wishlist + totalen worden meegestuurd in de offerte-mail",
                "Mobiele share-tekst: 'Dit is mijn wishlist bij PearBlue voor mijn droom website, IT platform en de beveiliging'",
                "Mailbox-duplicaat-check om dubbele IMAP-sync te voorkomen",
            ],
        },
        {
            "version": "0.5.1-Beta",
            "date": "2026-02-08",
            "type": "minor",
            "highlights": [
                "Parallax pear-achtergrond zichtbaarder (5,5% opacity + 4,5% accent)",
                "Homepage-scroller: 'Transparant' toegevoegd tussen de kernwaarden",
                "About: extra paragraaf over transparantie in uren/projecten/prijzen",
                "Diensten: Cybersecurity prijs €5 p/machine → €5 p/machine p/maand",
                "Newsletter footer-tekst ingekort (geen frequentie-belofte meer)",
                "Calculator: onderste doublet 'Setup/Per maand/Uurlijks €0' verwijderd",
                "Offerte-knop hernoemd + calculator-inhoud gaat mee in het offerte-verzoek",
                "Sfeer & Verhaal veld toegevoegd aan Contact/Offerte-formulier",
                "Ratings 1-5 met emoji op chat + support-tickets",
                "Nieuwe rol 'Financien' voor toegang tot AI Dashboard financials",
                "AI Dashboard uitgebreid met (MOCKED) Zoho Books financials + Emergent build-cost trackers",
            ],
        },
        {
            "version": "0.5.0-Beta",
            "date": "2026-02-08",
            "type": "feature",
            "highlights": [
                "Nieuwe CMS-tabs: Mailboxen (IMAP) + Mailmarketing (Brevo) + Virusscanner — alle MOCKED",
                "Priority-balloons Major/P1/P2 boven changelog-balloon",
                "User-details endpoints (adres/KVK/BTW/wachtwoord-reset)",
                "Avatar + prettyRole in Feedback/Messages/Cybersecurity",
                "Sticky action-kolom in Cybersecurity table",
                "Nieuwsbrief-aanmelding in footer + analytics chart in CMS",
            ],
        },
        {
            "version": "0.4.0-Beta",
            "date": "2026-02-08",
            "type": "feature",
            "highlights": [
                "3-tab prijslijst (Website / ICT / Cybersecurity) met combined calculator",
                "Kostencalculator: subtotaal + BTW 21% + totaal + Wishlist + Delen",
                "Full-viewport parallax pear-achtergrond",
                "Kruisrol-toewijzing op Feedback + Messages",
                "Portfolio-import van 6 curated cases + archive-functie",
                "Messages: sub-tabs Postvak IN / Spam / Archief, prioriteit P1-P4/Major, bulk-delete",
                "Cybersecurity: OS/browser/device/land verrijking + captcha-verified chart",
                "Changelog-pagina + CMS version-bar",
            ],
        },
        {
            "version": "0.3.0-Beta",
            "date": "2026-02-08",
            "type": "feature",
            "highlights": [
                "Volledige `/prijslijst` (Excel-bron) + calculator met smart average",
                "LocalCaptcha + akkoord-tekst op contact/portal/reviews/chatbot",
                "IP-rate-limits + block-logging in Cybersecurity CMS",
                "Feedback-widget + Feedback CMS met status/toewijzing",
                "Mobiele header (thema/taal in hamburger)",
                "Privacy pagina + Google Maps (Delfzijl)",
                "Terms Artikel 5.4 '5 revisierondes'",
            ],
        },
        {
            "version": "0.2.0-Beta",
            "date": "2026-02-08",
            "type": "feature",
            "highlights": [
                "AI Chat anti-spam + agent-handoff",
                "Ticket-bijlagen (client → Zoho Desk multipart)",
                "Trustpilot script bugfix (SSR-injectie)",
                "Gebruikersbeheer CMS met 6 rollen",
                "Custom scripts CMS (header/footer)",
                "Algemene voorwaarden pagina",
                "Portal ticket detail met replies",
            ],
        },
        {
            "version": "0.1.0-Beta",
            "date": "2026-02-07",
            "type": "major",
            "highlights": [
                "Stripe iDEAL Betaal Nu op Zoho-facturen",
                "Review invitations + Trust-stats UI",
                "Portal Zoho project-detail (in-app) + i18n",
                "Zoho OAuth portaal (Books / Projects / Desk)",
                "Klantreviews met CMS-moderatie",
                "Cookie-banner + GA4 opt-in",
                "AI Dashboard (Claude 4.6 chatbot analytics)",
                "5-pagina site (Home/Over ons/Diensten/Portfolio/Contact)",
                "NL/EN i18n + donker/licht thema",
                "Contact-formulier + admin CMS (portfolio, messages, settings)",
            ],
        },
    ]
    return {"current": entries[0]["version"], "entries": entries}


# ---- Portfolio: archive support ----
@api_router.patch("/projects/{project_id}")
async def patch_project(project_id: str, patch: dict, current=Depends(require_admin)):
    allowed = {"title", "category", "tag", "description", "image_url", "external_url", "archived"}
    upd = {k: v for k, v in (patch or {}).items() if k in allowed}
    if not upd:
        raise HTTPException(400, "Nothing to update")
    upd["updated_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.projects.update_one({"id": project_id}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(404, "Project not found")
    return {"status": "updated"}


# ---- Priority alerts (Major / P1 / P2) — CMS balloons ----
@api_router.get("/admin/priority-alerts")
async def priority_alerts(current=Depends(require_admin)):
    """Aggregate open Major/P1/P2 items across contact_messages so the CMS can show alert balloons."""
    open_statuses = {"$nin": ["done", "archived"]}
    counts = {"Major": 0, "P1": 0, "P2": 0}
    latest_by_prio: dict[str, dict] = {}
    async for doc in db.contact_messages.find(
        {"priority": {"$in": ["Major", "P1", "P2"]}, "status": open_statuses, "spam": {"$ne": True}},
        {"_id": 0, "id": 1, "priority": 1, "name": 1, "subject": 1, "created_at": 1},
    ).sort("created_at", -1):
        p = doc.get("priority") or "P3"
        if p not in counts:
            continue
        counts[p] += 1
        if p not in latest_by_prio:
            latest_by_prio[p] = doc
    return {"counts": counts, "latest": latest_by_prio}


# ---- Newsletter signup (public, no captcha per user request) ----
class NewsletterSignup(BaseModel):
    email: str = Field(..., min_length=3, max_length=200)
    language: Optional[str] = "nl"
    source: Optional[str] = "footer"


@api_router.post("/newsletter/subscribe")
async def newsletter_subscribe(payload: NewsletterSignup, request: Request):
    email = payload.email.strip().lower()
    if "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(400, "Ongeldig e-mailadres")
    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "unknown").split(",")[0].strip()
    # Idempotent: silently upsert
    doc = {
        "email": email,
        "language": payload.language or "nl",
        "source": payload.source or "footer",
        "ip": ip,
        "user_agent": request.headers.get("user-agent", "")[:200],
        "subscribed_at": datetime.now(timezone.utc).isoformat(),
        "active": True,
    }
    await db.newsletter_subscribers.update_one({"email": email}, {"$set": doc}, upsert=True)
    # NOTE: MOCKED — a real integration would push this to Brevo via their API using the key stored in
    # site_settings.brevo_api_key. See /api/admin/brevo/* endpoints for the connection UI.
    return {"status": "subscribed"}


@api_router.get("/admin/newsletter/stats")
async def newsletter_stats(current=Depends(require_admin)):
    total = await db.newsletter_subscribers.count_documents({"active": True})
    since = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    docs = await db.newsletter_subscribers.find(
        {"active": True, "subscribed_at": {"$gte": since}},
        {"_id": 0, "subscribed_at": 1, "source": 1},
    ).to_list(20000)
    by_day: dict[str, int] = {}
    by_source: dict[str, int] = {}
    for d in docs:
        try:
            k = d["subscribed_at"][:10]
        except Exception:
            continue
        by_day[k] = by_day.get(k, 0) + 1
        s = d.get("source", "footer")
        by_source[s] = by_source.get(s, 0) + 1
    return {
        "total": total,
        "last_30d": len(docs),
        "daily": [{"day": k, "count": v} for k, v in sorted(by_day.items())],
        "sources": [{"source": k, "count": v} for k, v in sorted(by_source.items(), key=lambda x: -x[1])],
    }


@api_router.get("/admin/newsletter/subscribers")
async def newsletter_subscribers(current=Depends(require_admin)):
    docs = await db.newsletter_subscribers.find({}, {"_id": 0}).sort("subscribed_at", -1).to_list(500)
    return docs


# ---- Brevo integration (settings + stub) ----
class BrevoSettings(BaseModel):
    api_key: Optional[str] = None
    from_email: Optional[str] = "communication-noreply@pearblue.nl"
    from_name: Optional[str] = "PearBlue"
    enabled: Optional[bool] = False


@api_router.get("/admin/brevo/settings")
async def brevo_settings(current=Depends(require_admin)):
    doc = await db.integrations.find_one({"key": "brevo"}, {"_id": 0}) or {}
    # Never send the raw API key back — only whether it's set.
    return {
        "from_email": doc.get("from_email", "communication-noreply@pearblue.nl"),
        "from_name": doc.get("from_name", "PearBlue"),
        "enabled": bool(doc.get("enabled")),
        "api_key_set": bool(doc.get("api_key")),
    }


@api_router.put("/admin/brevo/settings")
async def save_brevo_settings(payload: BrevoSettings, current=Depends(require_admin)):
    upd = {"key": "brevo", "updated_at": datetime.now(timezone.utc).isoformat(), "updated_by": current.get("email")}
    if payload.api_key: upd["api_key"] = enc_secret(payload.api_key.strip())
    if payload.from_email: upd["from_email"] = payload.from_email.strip()
    if payload.from_name: upd["from_name"] = payload.from_name.strip()
    if payload.enabled is not None: upd["enabled"] = bool(payload.enabled)
    await db.integrations.update_one({"key": "brevo"}, {"$set": upd}, upsert=True)
    return {"status": "saved", "encrypted": _secret_cipher is not None}


@api_router.get("/admin/brevo/campaigns")
async def brevo_campaigns(current=Depends(require_admin)):
    """MOCKED — returns a placeholder response. Real Brevo API integration to be wired
    against https://api.brevo.com/v3/emailCampaigns once the api_key is set."""
    doc = await db.integrations.find_one({"key": "brevo"}, {"_id": 0}) or {}
    if not doc.get("api_key"):
        return {"mocked": True, "reason": "no_api_key", "campaigns": []}
    return {
        "mocked": True,
        "reason": "endpoint_not_wired",
        "campaigns": [
            {"id": "demo-1", "name": "Welkomstmail (demo)", "status": "sent", "sent": 148, "opened": 92, "clicked": 41},
            {"id": "demo-2", "name": "Nieuwsbrief Q1 (demo)", "status": "draft", "sent": 0, "opened": 0, "clicked": 0},
        ],
    }


# ---- IMAP Mailboxes (stub — settings only, no real fetching yet) ----
class MailboxCreate(BaseModel):
    label: str = Field(..., min_length=1, max_length=80)
    email: str = Field(..., min_length=3, max_length=200)
    host: str = Field(..., min_length=1, max_length=200)
    port: int = Field(993, ge=1, le=65535)
    username: str = Field(..., min_length=1, max_length=200)
    password: str = Field(..., min_length=1, max_length=200)
    use_ssl: bool = True


@api_router.get("/admin/mailboxes")
async def list_mailboxes(current=Depends(require_admin)):
    docs = await db.mailboxes.find({}, {"_id": 0, "password": 0}).to_list(50)
    return docs


@api_router.post("/admin/mailboxes")
async def add_mailbox(payload: MailboxCreate, current=Depends(require_admin)):
    # Only super_admin + beheerder can add mailboxes
    if current.get("role") not in {"super_admin", "admin", "beheerder"}:
        raise HTTPException(403, "Alleen beheerders en super admins mogen mailboxen toevoegen")
    email_norm = payload.email.strip().lower()
    # Prevent duplicate mailboxes to avoid double IMAP sync of the same account
    existing = await db.mailboxes.find_one({"email": email_norm})
    if existing:
        raise HTTPException(409, f"Mailbox met e-mail {email_norm} bestaat al — dubbele sync voorkomen.")
    doc = {
        "id": str(uuid.uuid4()),
        "label": payload.label.strip(),
        "email": email_norm,
        "host": payload.host.strip(),
        "port": payload.port,
        "username": payload.username.strip(),
        "password": enc_secret(payload.password),  # Fernet-encrypted at rest
        "use_ssl": payload.use_ssl,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current.get("email"),
        "last_sync": None,
    }
    await db.mailboxes.insert_one(doc)
    doc.pop("password", None)
    doc.pop("_id", None)
    return doc


@api_router.delete("/admin/mailboxes/{mid}")
async def del_mailbox(mid: str, current=Depends(require_admin)):
    if current.get("role") not in {"super_admin", "admin", "beheerder"}:
        raise HTTPException(403, "Alleen beheerders en super admins mogen mailboxen verwijderen")
    res = await db.mailboxes.delete_one({"id": mid})
    if res.deleted_count == 0:
        raise HTTPException(404, "Mailbox niet gevonden")
    return {"status": "deleted"}


# ---- Virus scanner (stub — records only, no real scanning) ----
@api_router.get("/admin/virus-scanner/logs")
async def virus_logs(current=Depends(require_permission("cybersecurity"))):
    docs = await db.virus_scans.find({}, {"_id": 0}).sort("detected_at", -1).to_list(300)
    return docs


@api_router.post("/admin/virus-scanner/{scan_id}/quarantine")
async def virus_quarantine(scan_id: str, current=Depends(require_permission("cybersecurity"))):
    res = await db.virus_scans.update_one({"id": scan_id}, {"$set": {"quarantined": True, "quarantined_at": datetime.now(timezone.utc).isoformat()}})
    if res.matched_count == 0:
        raise HTTPException(404, "Niet gevonden")
    return {"status": "quarantined"}


@api_router.post("/admin/virus-scanner/{scan_id}/restore")
async def virus_restore(scan_id: str, current=Depends(require_permission("cybersecurity"))):
    res = await db.virus_scans.update_one({"id": scan_id}, {"$set": {"quarantined": False, "restored_at": datetime.now(timezone.utc).isoformat()}})
    if res.matched_count == 0:
        raise HTTPException(404, "Niet gevonden")
    return {"status": "restored"}


# ---- Extended user details (address / KVK / password reset) ----
class UserDetailsUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    address: Optional[str] = None
    postal_code: Optional[str] = None
    house_number: Optional[str] = None
    city: Optional[str] = None
    region: Optional[str] = None
    country: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    kvk: Optional[str] = None
    tax_id: Optional[str] = None
    profile_picture: Optional[str] = None


@api_router.get("/admin/users/{email}/details")
async def user_details(email: str, current=Depends(require_permission("users"))):
    doc = await db.admins.find_one({"email": email.lower().strip()}, {"_id": 0, "password_hash": 0}) or {}
    return {
        "email": doc.get("email"),
        "role": doc.get("role"),
        "first_name": doc.get("first_name") or "",
        "last_name": doc.get("last_name") or "",
        "address": doc.get("address") or "",
        "postal_code": doc.get("postal_code") or "",
        "house_number": doc.get("house_number") or "",
        "city": doc.get("city") or "",
        "region": doc.get("region") or "",
        "country": doc.get("country") or "Nederland",
        "phone": doc.get("phone") or "",
        "company": doc.get("company") or "",
        "kvk": doc.get("kvk") or "",
        "tax_id": doc.get("tax_id") or "",
        "profile_picture": doc.get("profile_picture") or "",
    }


@api_router.put("/admin/users/{email}/details")
async def update_user_details(email: str, payload: UserDetailsUpdate, current=Depends(require_permission("users"))):
    # Only super_admin / admin / beheerder / CRM can edit user profile details
    if current.get("role") not in {"super_admin", "admin", "beheerder", "crm"}:
        raise HTTPException(403, "Onvoldoende rechten")
    email_l = email.lower().strip()
    upd = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    upd["updated_at"] = datetime.now(timezone.utc).isoformat()
    upd["updated_by"] = current.get("email")
    await db.admins.update_one({"email": email_l}, {"$set": upd}, upsert=False)
    # NOTE: MOCKED — a full implementation should also push to Zoho Books
    # via zoho_portal.update_contact(email, first_name=..., last_name=..., etc.)
    return {"status": "updated", "zoho_synced": False, "note": "Zoho 2-way sync is MOCKED — see roadmap"}


@api_router.post("/admin/users/{email}/reset-password")
async def send_password_reset(email: str, current=Depends(require_admin)):
    # CRM + super_admin + beheerder + admin can send reset emails
    if current.get("role") not in {"super_admin", "admin", "beheerder", "crm"}:
        raise HTTPException(403, "Onvoldoende rechten")
    email_l = email.lower().strip()
    doc = await db.admins.find_one({"email": email_l}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Gebruiker niet gevonden")
    # Generate a signed reset token (short-lived)
    token = jwt.encode(
        {"sub": email_l, "exp": datetime.now(timezone.utc) + timedelta(hours=1), "purpose": "reset"},
        os.environ.get("JWT_SECRET", "dev-secret"),
        algorithm="HS256",
    )
    frontend = os.environ.get("FRONTEND_URL", "https://pearblue.nl")
    reset_url = f"{frontend}/admin/reset-password?token={token}"
    try:
        await _send_email(
            to=[email_l],
            subject="Reset je PearBlue wachtwoord",
            html=f"<p>Klik hier om je wachtwoord opnieuw in te stellen (verloopt binnen 1 uur):</p><p><a href=\"{reset_url}\">{reset_url}</a></p>",
        )
    except Exception as e:
        logger.warning(f"Reset mail failed: {e}")
    return {"status": "sent", "email": email_l, "expires_in_minutes": 60}


# ---- Public: verify + apply a password reset token ----
class PasswordResetApply(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8, max_length=200)


@api_router.get("/auth/reset-password/verify")
async def verify_reset_token(token: str):
    try:
        payload = jwt.decode(token, os.environ.get("JWT_SECRET", "dev-secret"), algorithms=["HS256"])
        if payload.get("purpose") != "reset":
            raise HTTPException(400, "Ongeldig token")
        return {"valid": True, "email": payload.get("sub")}
    except jwt.ExpiredSignatureError:
        raise HTTPException(400, "Token verlopen")
    except jwt.InvalidTokenError:
        raise HTTPException(400, "Ongeldig token")


@api_router.post("/auth/reset-password/apply")
async def apply_reset_token(payload: PasswordResetApply):
    try:
        decoded = jwt.decode(payload.token, os.environ.get("JWT_SECRET", "dev-secret"), algorithms=["HS256"])
        if decoded.get("purpose") != "reset":
            raise HTTPException(400, "Ongeldig token")
        email_l = decoded.get("sub")
    except jwt.ExpiredSignatureError:
        raise HTTPException(400, "Token verlopen")
    except jwt.InvalidTokenError:
        raise HTTPException(400, "Ongeldig token")
    new_hash = bcrypt.hashpw(payload.new_password.encode(), bcrypt.gensalt()).decode()
    res = await db.admins.update_one({"email": email_l}, {"$set": {"password_hash": new_hash, "password_updated_at": datetime.now(timezone.utc).isoformat()}})
    if res.matched_count == 0:
        raise HTTPException(404, "Gebruiker niet gevonden")
    return {"status": "updated", "email": email_l}


# ---- Admin: directly change a user's password (super_admin + beheerder only) ----
class AdminChangePassword(BaseModel):
    new_password: str = Field(..., min_length=8, max_length=200)
    send_notification: bool = True


@api_router.post("/admin/users/{email}/change-password")
async def admin_change_password(email: str, payload: AdminChangePassword, current=Depends(require_admin)):
    if current.get("role") not in {"super_admin", "admin", "beheerder"}:
        raise HTTPException(403, "Alleen super_admin of beheerder mag wachtwoorden direct wijzigen")
    email_l = email.lower().strip()
    doc = await db.admins.find_one({"email": email_l})
    if not doc:
        raise HTTPException(404, "Gebruiker niet gevonden")
    new_hash = bcrypt.hashpw(payload.new_password.encode(), bcrypt.gensalt()).decode()
    await db.admins.update_one(
        {"email": email_l},
        {"$set": {"password_hash": new_hash, "password_updated_at": datetime.now(timezone.utc).isoformat(), "password_changed_by": current.get("email")}},
    )
    if payload.send_notification and RESEND_API_KEY:
        try:
            await _send_email(
                to=[email_l],
                subject="Je PearBlue wachtwoord is gewijzigd",
                html=(
                    f"<p>Beste,</p>"
                    f"<p>Je PearBlue wachtwoord is zojuist gewijzigd door {current.get('email')}. "
                    f"Log opnieuw in met je nieuwe wachtwoord.</p>"
                    f"<p>Herken je deze actie niet? Neem direct contact op via <a href=\"mailto:info@pearblue.nl\">info@pearblue.nl</a>.</p>"
                ),
            )
        except Exception as e:
            logger.warning(f"Password change notify failed: {e}")
    return {"status": "updated", "email": email_l, "notified": bool(payload.send_notification and RESEND_API_KEY)}


# ---- User self-preferences (lang + theme) ----
class UserPrefs(BaseModel):
    lang: Optional[str] = Field(None, pattern="^(nl|en)$")
    theme_mode: Optional[str] = Field(None, pattern="^(light|dark|system)$")


@api_router.patch("/auth/me/prefs")
async def update_my_prefs(payload: UserPrefs, current=Depends(require_admin)):
    email_l = (current.get("email") or "").lower().strip()
    if not email_l:
        raise HTTPException(400, "Geen e-mail in token")
    upd = {}
    if payload.lang: upd["pref_lang"] = payload.lang
    if payload.theme_mode: upd["pref_theme"] = payload.theme_mode
    if not upd:
        return {"status": "noop"}
    upd["prefs_updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.admins.update_one({"email": email_l}, {"$set": upd}, upsert=False)
    return {"status": "saved", **upd}


@api_router.get("/auth/me/prefs")
async def get_my_prefs(current=Depends(require_admin)):
    email_l = (current.get("email") or "").lower().strip()
    doc = await db.admins.find_one({"email": email_l}, {"_id": 0, "pref_lang": 1, "pref_theme": 1}) or {}
    return {"lang": doc.get("pref_lang"), "theme_mode": doc.get("pref_theme")}


# ---- Notify user by email after their profile/details change ----
@api_router.post("/admin/users/{email}/notify-updated")
async def notify_user_updated(email: str, current=Depends(require_admin)):
    if current.get("role") not in {"super_admin", "admin", "beheerder", "crm"}:
        raise HTTPException(403, "Onvoldoende rechten")
    email_l = email.lower().strip()
    doc = await db.admins.find_one({"email": email_l})
    if not doc:
        raise HTTPException(404, "Gebruiker niet gevonden")
    if RESEND_API_KEY:
        try:
            await _send_email(
                to=[email_l],
                subject="Je PearBlue accountgegevens zijn bijgewerkt",
                html=(
                    "<p>Beste,</p>"
                    "<p>Je accountgegevens (naam, adres of bedrijfsinformatie) zijn zojuist bijgewerkt door PearBlue. "
                    "Log in op je portaal om je bijgewerkte gegevens te bekijken.</p>"
                    "<p>Herken je deze wijziging niet? Neem contact op via <a href=\"mailto:info@pearblue.nl\">info@pearblue.nl</a>.</p>"
                ),
            )
        except Exception as e:
            logger.warning(f"Notify-updated mail failed: {e}")
    return {"status": "sent", "email": email_l}


# ---- Virus scanner: unread/quarantined counter for the sidebar badge ----
@api_router.get("/admin/virus-scanner/unread")
async def virus_unread(current=Depends(require_permission("cybersecurity"))):
    """Count of virus events not yet acknowledged (whether quarantined or not)."""
    count = await db.virus_scans.count_documents({"acknowledged": {"$ne": True}})
    return {"count": count}


@api_router.post("/admin/virus-scanner/acknowledge-all")
async def virus_ack_all(current=Depends(require_permission("cybersecurity"))):
    """Called when the user opens the virus scanner tab — clears the badge."""
    res = await db.virus_scans.update_many(
        {"acknowledged": {"$ne": True}},
        {"$set": {"acknowledged": True, "acknowledged_at": datetime.now(timezone.utc).isoformat(), "acknowledged_by": current.get("email")}},
    )
    return {"acknowledged": res.modified_count}



# ---------------------------------------------------------------------------
# Financials Dashboard (Emergent AI costs + Zoho Books stats)
# Access: super_admin, admin (legacy), beheerder, financien
# Everything is currently MOCKED / stubbed until Zoho Books credentials are wired.
# ---------------------------------------------------------------------------
def _range_from_period(period: str, custom_from: Optional[str], custom_to: Optional[str]):
    now = datetime.now(timezone.utc)
    end = now
    if period == "custom" and custom_from and custom_to:
        try:
            start = datetime.fromisoformat(custom_from).replace(tzinfo=timezone.utc)
            end = datetime.fromisoformat(custom_to).replace(tzinfo=timezone.utc)
        except Exception:
            raise HTTPException(400, "Ongeldige custom datumreeks (gebruik ISO-8601)")
    else:
        mapping = {
            "7d": 7, "30d": 30, "90d": 90,
            "6m": 183, "1y": 365, "2y": 730,
            "3y": 1095, "4y": 1460, "5y": 1825,
        }
        days = mapping.get(period, 30)
        start = now - timedelta(days=days)
    return start, end


@api_router.get("/admin/financials")
async def financials_dashboard(
    period: str = "30d",
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current=Depends(require_permission("financials")),
):
    start, end = _range_from_period(period, date_from, date_to)

    # ---- Emergent AI costs — real message count, estimated cost like /chat/stats ----
    chat_q = {
        "created_at": {"$gte": start.isoformat(), "$lte": end.isoformat()},
    }
    # count messages in range; the DB stores created_at as ISO string
    total_msgs = await db.chat_messages.count_documents(chat_q)
    # Approx: 1 message ≈ ~800 tokens combined I/O (rough estimate)
    avg_tokens_per_msg = 800
    input_cost_per_mtok = 3.0  # USD per 1M input tokens (Claude Sonnet 4.6)
    output_cost_per_mtok = 15.0
    # 30% input 70% output split (typical chat)
    total_tokens = total_msgs * avg_tokens_per_msg
    input_tokens = total_tokens * 0.3
    output_tokens = total_tokens * 0.7
    est_usd = (input_tokens * input_cost_per_mtok + output_tokens * output_cost_per_mtok) / 1_000_000
    est_eur = est_usd * 0.92  # rough FX
    est_credits = est_usd * 100  # 1 credit ≈ $0.01

    # ---- Zoho Books stats — MOCKED until credentials + endpoint wiring ----
    days_span = max(1, (end - start).days or 1)
    mocked_zoho = {
        "mocked": True,
        "reason": "zoho_books_not_wired",
        "invoiced_total_eur": round(days_span * 145.0, 2),
        "paid_total_eur": round(days_span * 118.0, 2),
        "outstanding_eur": round(days_span * 27.0, 2),
        "overdue_eur": round(days_span * 8.5, 2),
        "invoices_sent": days_span * 3,
        "invoices_paid": days_span * 2,
        "top_clients": [
            {"name": "Voorbeeld Klant BV", "total_eur": round(days_span * 45.0, 2)},
            {"name": "Demo Stichting", "total_eur": round(days_span * 32.0, 2)},
            {"name": "Testbedrijf", "total_eur": round(days_span * 24.0, 2)},
        ],
    }

    return {
        "period": period,
        "range": {"from": start.isoformat(), "to": end.isoformat(), "days": days_span},
        "emergent_ai": {
            "messages": total_msgs,
            "estimated_input_tokens": int(input_tokens),
            "estimated_output_tokens": int(output_tokens),
            "estimated_usd": round(est_usd, 4),
            "estimated_eur": round(est_eur, 4),
            "estimated_credits": round(est_credits, 2),
            "note": "Schatting op basis van $3/1M input + $15/1M output tokens (Claude Sonnet 4.6). Werkelijke Emergent-verbruik zichtbaar in Emergent Profile → Universal Key.",
        },
        "zoho_books": mocked_zoho,
        "totals": {
            "combined_costs_eur": round(est_eur, 2),
            "combined_income_eur": mocked_zoho["paid_total_eur"],
            "estimated_margin_eur": round(mocked_zoho["paid_total_eur"] - est_eur, 2),
        },
    }


# ---------------------------------------------------------------------------
# Chat / Ticket smiley rating (1-5) + analytics
# ---------------------------------------------------------------------------
class ChatRating(BaseModel):
    session_id: str = Field(..., min_length=1, max_length=200)
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = Field(None, max_length=1000)
    source: Optional[str] = Field("chat", pattern="^(chat|ticket|handoff)$")


@api_router.post("/chat/rating")
async def submit_chat_rating(payload: ChatRating, request: Request):
    doc = {
        "id": str(uuid.uuid4()),
        "session_id": payload.session_id,
        "rating": payload.rating,
        "comment": (payload.comment or "").strip(),
        "source": payload.source or "chat",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "ip": _client_ip(request) if request else "",
    }
    await db.chat_ratings.insert_one(doc)
    doc.pop("_id", None)
    return {"status": "saved", "id": doc["id"]}


@api_router.get("/admin/chat/ratings")
async def chat_ratings_stats(days: int = 30, current=Depends(require_admin)):
    start = datetime.now(timezone.utc) - timedelta(days=max(1, min(days, 1825)))
    docs = await db.chat_ratings.find(
        {"created_at": {"$gte": start.isoformat()}}, {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    counts = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    total = 0
    total_score = 0
    per_day = defaultdict(int)
    per_day_score = defaultdict(lambda: [0, 0])  # [total, count]
    for d in docs:
        r = int(d.get("rating") or 0)
        if r < 1 or r > 5: continue
        counts[r] += 1
        total += 1
        total_score += r
        day = (d.get("created_at") or "")[:10]
        per_day[day] += 1
        per_day_score[day][0] += r
        per_day_score[day][1] += 1
    avg = round(total_score / total, 2) if total else None
    return {
        "days": days,
        "total": total,
        "avg": avg,
        "counts": counts,
        "per_day": [
            {"date": d, "count": per_day[d], "avg": round(per_day_score[d][0] / per_day_score[d][1], 2) if per_day_score[d][1] else 0}
            for d in sorted(per_day.keys())
        ],
        "recent": docs[:25],
    }


app.include_router(api_router)
app.include_router(make_zoho_router(db))
app.include_router(make_stripe_router(db))

# Session middleware BEFORE CORS
SESSION_SECRET = os.environ.get('SESSION_SECRET', 'change-me-in-production-32-bytes-min')
app.add_middleware(
    SessionMiddleware,
    secret_key=SESSION_SECRET,
    session_cookie="pb_session",
    same_site="lax",
    https_only=False,
    max_age=60 * 60 * 8,  # 8 hours
)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def on_startup():
    await seed_admin()
    await seed_portfolio()
    await seed_virus_scans()
    # Background poller for review invites (runs every ~15 min)
    asyncio.create_task(review_poller(db, _send_email))


async def seed_virus_scans():
    """One-shot: create 3 mock virus-scanner records so the CMS list can be reviewed.

    Real scanner integration (ClamAV, VirusTotal or Bitdefender GravityZone) is
    not wired yet — these mocks stay until credentials arrive.
    """
    try:
        existing = await db.virus_scans.count_documents({})
        if existing >= 3:
            return
        now = datetime.now(timezone.utc)
        mocks = [
            {
                "id": "mock-vs-1",
                "filename": "invoice_scan_2026Q1.zip",
                "path": "/uploads/mailbox/2026-02-08/invoice_scan_2026Q1.zip",
                "size_bytes": 452_320,
                "threat_name": "Trojan.Generic.KDZ.98123",
                "engine": "mock (bitdefender-simulator)",
                "severity": "high",
                "quarantined": True,
                "quarantined_at": (now - timedelta(hours=6)).isoformat(),
                "detected_at": (now - timedelta(hours=6)).isoformat(),
                "acknowledged": False,
                "source": "email-attachment",
                "note": "MOCKED — verbind een echte scanner om automatisch te scannen.",
            },
            {
                "id": "mock-vs-2",
                "filename": "cv-lucas.docm",
                "path": "/uploads/portal/1234/cv-lucas.docm",
                "size_bytes": 89_112,
                "threat_name": "Macro.Downloader.Agent",
                "engine": "mock (bitdefender-simulator)",
                "severity": "medium",
                "quarantined": True,
                "quarantined_at": (now - timedelta(hours=32)).isoformat(),
                "detected_at": (now - timedelta(hours=32)).isoformat(),
                "acknowledged": False,
                "source": "portal-upload",
                "note": "MOCKED — Word-macro met verdachte downloader.",
            },
            {
                "id": "mock-vs-3",
                "filename": "photo_lastminute.jpg.exe",
                "path": "/uploads/chat/session-84/photo_lastminute.jpg.exe",
                "size_bytes": 1_204_881,
                "threat_name": "PUA.DoubleExtension.Suspicious",
                "engine": "mock (heuristic)",
                "severity": "low",
                "quarantined": False,
                "restored_at": None,
                "detected_at": (now - timedelta(days=2)).isoformat(),
                "acknowledged": False,
                "source": "chatbot-upload",
                "note": "MOCKED — dubbele extensie, gebruiker geïnformeerd.",
            },
        ]
        for m in mocks:
            await db.virus_scans.update_one({"id": m["id"]}, {"$setOnInsert": m}, upsert=True)
        logger.info("virus_scans seeded (mocked)")
    except Exception as e:
        logger.warning(f"seed_virus_scans failed: {e}")


# Static seed content — case studies from /app/frontend/src/data/projects.js
_SEED_PORTFOLIO = [
    {"seed_id": "case-boekweit-cyber", "title": "Boekweit Logistics — Bitdefender Rollout", "category": "Cybersecurity", "tag": "Cybersecurity", "description": "Bitdefender GravityZone Elite uitgerold over 84 endpoints en 6 servers voor een noordelijk logistiek bedrijf. EDR, encryptie en 24/7 monitoring vanuit ons SOC. Storingen dalen met 74%, en het management krijgt maandelijkse risk-rapportages in duidelijke taal.", "image_url": "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?crop=entropy&cs=srgb&fm=jpg&w=1400&q=85", "external_url": "https://www.pearblue.nl/services/computerbeveiliging/"},
    {"seed_id": "case-groninger-cloud", "title": "Groninger Zorgcoöperatie — Cloud Migratie", "category": "IT Infrastructuur", "tag": "IT Platform", "description": "Migratie van 32 werkplekken naar Nextcloud + Internxt met zero-downtime overgang. MFA, Zero-Trust device-compliance en herstelbare back-ups binnen 5 minuten.", "image_url": "https://images.unsplash.com/photo-1451187580459-43490279c0fa?crop=entropy&cs=srgb&fm=jpg&w=1200&q=85", "external_url": "https://www.pearblue.nl/services/it-infrastructuur/"},
    {"seed_id": "case-fresh-bakkerij", "title": "Bakkerij De Peer — Merkverhaal & Webshop", "category": "E-commerce", "tag": "E-commerce", "description": "Van huisstijl tot webshop met iDEAL en Mollie: een frisse online bakkerij die abonnementen op wekelijkse broodpakketten aanbiedt.", "image_url": "https://images.unsplash.com/photo-1509440159596-0249088772ff?crop=entropy&cs=srgb&fm=jpg&w=1200&q=85", "external_url": "https://www.pearblue.nl/diensten/"},
    {"seed_id": "case-aivoice", "title": "AiVoice Studio — AI Transcriptie SaaS", "category": "AI Product", "tag": "AI Product", "description": "Custom SaaS voor podcasters en journalisten: realtime transcriptie, samenvattingen en sprekerherkenning op Claude + Whisper. 400+ actieve creators, SLA 99,9%.", "image_url": "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?crop=entropy&cs=srgb&fm=jpg&w=1200&q=85", "external_url": "https://www.pearblue.nl/services/kunstmatige-intelligentie-ai/"},
    {"seed_id": "case-fresh-studio", "title": "Fresh Studio — Creative Agency Site", "category": "Media Website", "tag": "Media Website", "description": "Portfoliosite voor een creatief bureau met vloeiende Framer Motion overgangen, headless CMS en meertalige content.", "image_url": "https://images.unsplash.com/photo-1519222970733-f546218fa6d7?crop=entropy&cs=srgb&fm=jpg&w=1200&q=85", "external_url": "https://www.pearblue.nl/portfolio/"},
    {"seed_id": "case-dashboards", "title": "Havenbedrijf — BI Dashboards", "category": "Analytics", "tag": "Analytics", "description": "Custom BI-dashboards voor havenoperaties met live KPI's uit meerdere bronsystemen. Opererende managers besparen 6 uur per week aan handmatige rapportage.", "image_url": "https://images.unsplash.com/photo-1551288049-bebda4e38f71?crop=entropy&cs=srgb&fm=jpg&w=1200&q=85", "external_url": "https://www.pearblue.nl/services/"},
]


async def seed_portfolio():
    """One-shot: import curated portfolio into db.projects if not already present."""
    try:
        for item in _SEED_PORTFOLIO:
            existing = await db.projects.find_one({"seed_id": item["seed_id"]})
            if existing:
                continue
            doc = {
                "id": str(uuid.uuid4()),
                "seed_id": item["seed_id"],
                "title": item["title"],
                "category": item["category"],
                "tag": item["tag"],
                "description": item["description"],
                "image_url": item["image_url"],
                "external_url": item.get("external_url"),
                "archived": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            await db.projects.insert_one(doc)
        logger.info("Seed portfolio ensured.")
    except Exception as e:
        logger.warning(f"Portfolio seed failed: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

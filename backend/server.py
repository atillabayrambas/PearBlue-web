from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
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
    status: str = "pending"  # pending | approved | rejected
    admin_note: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    reviewed_at: Optional[datetime] = None


class PortalRegistrationCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    email: EmailStr
    company: Optional[str] = Field(None, max_length=120)
    phone: Optional[str] = Field(None, max_length=40)
    message: Optional[str] = Field(None, max_length=2000)
    language: Optional[str] = "nl"


class RegistrationReview(BaseModel):
    status: str = Field(..., pattern="^(approved|rejected|pending)$")
    admin_note: Optional[str] = Field(None, max_length=1000)


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
ROLE_GEBRUIKER = "gebruiker"

ALL_ROLES = [ROLE_SUPER_ADMIN, ROLE_BEHEERDER, ROLE_ANALIST, ROLE_MODERATOR, ROLE_CHAT_SUPPORT, ROLE_GEBRUIKER]
ROLES_WITH_CMS_ACCESS = {"admin", ROLE_SUPER_ADMIN, ROLE_BEHEERDER, ROLE_ANALIST, ROLE_MODERATOR, ROLE_CHAT_SUPPORT}

ROLE_PERMS = {
    ROLE_SUPER_ADMIN: {"users", "roles", "secrets", "scripts", "content", "reviews", "analytics", "chat", "tickets", "portfolio", "settings"},
    "admin": {"users", "roles", "secrets", "scripts", "content", "reviews", "analytics", "chat", "tickets", "portfolio", "settings"},
    ROLE_BEHEERDER: {"users", "content", "reviews", "analytics", "chat", "tickets", "portfolio"},
    ROLE_ANALIST: {"analytics"},
    ROLE_MODERATOR: {"content", "portfolio", "reviews"},
    ROLE_CHAT_SUPPORT: {"chat", "tickets"},
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
async def create_contact(payload: ContactCreate):
    email_sent = await _send_contact_email(payload)
    msg = ContactMessage(**payload.model_dump(), email_sent=email_sent)
    doc = msg.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.contact_messages.insert_one(doc)
    return msg


@api_router.get("/contact", response_model=List[ContactMessage])
async def list_contacts(current=Depends(require_admin)):
    items = await db.contact_messages.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    for i in items:
        if isinstance(i.get('created_at'), str):
            i['created_at'] = datetime.fromisoformat(i['created_at'])
    return items


@api_router.post("/quote", response_model=QuoteRequest)
async def create_quote(payload: QuoteCreate):
    q = QuoteRequest(**payload.model_dump())
    doc = q.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.quote_requests.insert_one(doc)
    if RESEND_API_KEY:
        contact_like = ContactCreate(
            name=payload.name,
            email=payload.email,
            company=payload.company,
            subject=f"Offerte-aanvraag — {payload.company or payload.name}",
            message=f"Pagina's: {payload.pages}\nBudget: {payload.budget}\nDiensten: {', '.join(payload.services)}\n\n{payload.description or ''}",
            language=payload.language,
        )
        await _send_contact_email(contact_like)
    return q


# ---- Projects (public GET; protected POST/DELETE) ----
@api_router.get("/projects", response_model=List[Project])
async def list_projects():
    items = await db.projects.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    for i in items:
        if isinstance(i.get('created_at'), str):
            i['created_at'] = datetime.fromisoformat(i['created_at'])
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
async def chat_stats(days: int = 30, current=Depends(require_admin)):
    from datetime import date
    days = max(1, min(days, 90))
    now = datetime.now(timezone.utc)
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
        raise HTTPException(status_code=400, detail={
            "message": "Je bericht is als spam gedetecteerd. Herformuleer zonder links of speciale tekens.",
            "message_en": "Your message was flagged as spam. Please rephrase without links or special characters.",
            "reason": reason,
        })
    remaining = _chat_rate_check(request)
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
    # Per-IP rate limit: 5 registrations per hour
    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "unknown").split(",")[0].strip()
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(hours=1)
    hits = [t for t in _register_rate_store[ip] if t > window_start]
    if len(hits) >= 5:
        raise HTTPException(status_code=429, detail="Te veel aanvragen. Probeer het over een uur opnieuw.")
    hits.append(now)
    _register_rate_store[ip] = hits

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
async def create_review(payload: ReviewCreate):
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
    # Background poller for review invites (runs every ~15 min)
    asyncio.create_task(review_poller(db, _send_email))


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

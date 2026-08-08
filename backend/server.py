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
from datetime import datetime, timezone, timedelta

import bcrypt
import jwt
import resend
from collections import defaultdict
from emergentintegrations.llm.chat import LlmChat, UserMessage

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
        if payload.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Forbidden")
        return {"email": payload.get("sub"), "role": payload.get("role")}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def seed_admin():
    existing = await db.admins.find_one({"email": ADMIN_EMAIL})
    hashed = hash_password(ADMIN_PASSWORD)
    if existing is None:
        await db.admins.insert_one({
            "email": ADMIN_EMAIL,
            "password_hash": hashed,
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info(f"Admin seeded: {ADMIN_EMAIL}")
    elif not verify_password(ADMIN_PASSWORD, existing.get("password_hash", "")):
        await db.admins.update_one({"email": ADMIN_EMAIL}, {"$set": {"password_hash": hashed}})
        logger.info(f"Admin password updated: {ADMIN_EMAIL}")


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
    "- Vestiging: Boekweitkamp 7, 9932MA Delfzijl\n"
    "- KVK: 87201607 · Eenmanszaak · Handelsnaam PearBlue\n"
    "- Contact: info@pearblue.nl · +31 596 229 030\n\n"
    "Drie pakketten:\n"
    "1) Website — vanaf €200. Ontwerp, copywriting, hosting, meertalig (NL/EN), basis SEO.\n"
    "2) ICT Diensten — vanaf €100. Netwerkontwerp, cloud, beheer & 24/7 monitoring, security, "
    "device-management, audits & roadmap.\n"
    "3) Cybersecurity — vanaf €5 per actieve machine. Bitdefender GravityZone Elite met EDR, "
    "firewall, encryptie en risk management. Beheerd of onbeheerd. Geen langlopende contracten.\n\n"
    "Voor concrete offertes of afspraken: verwijs beleefd naar de contact-pagina "
    "(/contact) of info@pearblue.nl. Verzin nooit prijzen of feiten die niet in deze "
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


# ---- Chatbot ----
def _chat_rate_check(request: Request) -> int:
    """Return remaining allowance for this IP; raise 429 if exhausted."""
    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "unknown").split(",")[0].strip()
    now = datetime.now(timezone.utc)
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


app.include_router(api_router)

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


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

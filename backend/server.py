from fastapi import FastAPI, APIRouter, HTTPException
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
from datetime import datetime, timezone

import resend

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

app = FastAPI(title="PearBlue API")
api_router = APIRouter(prefix="/api")


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


# ---------- Helpers ----------
def _build_contact_html(payload: ContactCreate) -> str:
    return f"""
    <div style="font-family: Arial, sans-serif; max-width:600px; margin:0 auto; color:#0A192F;">
      <div style="background:#02C0FF; color:#fff; padding:24px; border-radius:12px 12px 0 0;">
        <h2 style="margin:0;">Nieuw bericht via PearBlue website</h2>
      </div>
      <table style="width:100%; border-collapse:collapse; background:#fff; padding:24px; border-radius:0 0 12px 12px; box-shadow:0 2px 12px rgba(0,0,0,0.06);">
        <tr><td style="padding:8px 0;"><strong>Naam:</strong></td><td>{payload.name}</td></tr>
        <tr><td style="padding:8px 0;"><strong>E-mail:</strong></td><td>{payload.email}</td></tr>
        <tr><td style="padding:8px 0;"><strong>Telefoon:</strong></td><td>{payload.phone or '-'}</td></tr>
        <tr><td style="padding:8px 0;"><strong>Bedrijf:</strong></td><td>{payload.company or '-'}</td></tr>
        <tr><td style="padding:8px 0;"><strong>Onderwerp:</strong></td><td>{payload.subject or '-'}</td></tr>
        <tr><td style="padding:8px 0; vertical-align:top;"><strong>Bericht:</strong></td><td style="white-space:pre-wrap;">{payload.message}</td></tr>
        <tr><td style="padding:8px 0;"><strong>Taal:</strong></td><td>{payload.language}</td></tr>
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


# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {"message": "PearBlue API is running", "resend_configured": bool(RESEND_API_KEY)}


@api_router.get("/health")
async def health():
    return {"status": "ok"}


@api_router.post("/contact", response_model=ContactMessage)
async def create_contact(payload: ContactCreate):
    email_sent = await _send_contact_email(payload)
    msg = ContactMessage(**payload.model_dump(), email_sent=email_sent)
    doc = msg.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.contact_messages.insert_one(doc)
    return msg


@api_router.get("/contact", response_model=List[ContactMessage])
async def list_contacts():
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
    # Also fire an email if Resend is configured
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


@api_router.get("/projects", response_model=List[Project])
async def list_projects():
    items = await db.projects.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    for i in items:
        if isinstance(i.get('created_at'), str):
            i['created_at'] = datetime.fromisoformat(i['created_at'])
    return items


@api_router.post("/projects", response_model=Project)
async def create_project(payload: ProjectCreate):
    p = Project(**payload.model_dump())
    doc = p.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.projects.insert_one(doc)
    return p


@api_router.delete("/projects/{project_id}")
async def delete_project(project_id: str):
    result = await db.projects.delete_one({"id": project_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"status": "deleted", "id": project_id}


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


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

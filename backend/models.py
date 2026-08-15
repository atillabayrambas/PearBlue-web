"""Pydantic models shared by server.py and (future) route modules.

Split out from server.py in iteration 43 as Phase 1 of the CMS/backend
modularization. Pure data — no side effects, no DB access. Any helper that
generates a ticket ref lives here too so route modules can create tickets
without pulling `server.py` (which would be a circular import).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field


def new_ticket_ref() -> str:
    """Human-readable ticket reference used in outgoing emails.
    Format: `TKT-XXXXXX` (6 uppercase hex chars). Uniqueness comes from the
    underlying uuid `id`; collisions on the short ref are extremely unlikely."""
    return f"TKT-{uuid.uuid4().hex[:6].upper()}"


class ContactMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    ticket_ref: Optional[str] = None  # e.g. "TKT-A1B2C3" — human-readable ref shown in emails
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
    # Optional English translations — filled by the CMS "Bulk translate" button
    # or the per-field "AI vertaal" chip. Public site prefers these when lang=en.
    title_en: Optional[str] = None
    description_en: Optional[str] = None
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
    # Site status controls the public gate. "live" = site is up as normal.
    # "maintenance" and "coming_soon" each render their own themed splash page
    # with hard-coded, translated copy — no admin input required.
    site_status: Optional[str] = "live"  # "live" | "maintenance" | "coming_soon"
    site_status_lang: Optional[str] = "auto"  # "auto" | "nl" | "en"
    maintenance_bg_mode: Optional[str] = "dynamic"  # "dynamic" | "custom"
    maintenance_bg_url: Optional[str] = ""  # only used when bg_mode == "custom"
    # Legacy fields — kept for backwards compat but not surfaced in the UI anymore.
    maintenance_mode: Optional[bool] = False
    maintenance_title_nl: Optional[str] = ""
    maintenance_title_en: Optional[str] = ""
    maintenance_message_nl: Optional[str] = ""
    maintenance_message_en: Optional[str] = ""
    maintenance_show_newsletter: Optional[bool] = True
    maintenance_show_version: Optional[bool] = True
    # AI translate rate limit (per admin, per minute). Set via CMS.
    ai_translate_limit_per_minute: Optional[int] = 30


class SiteSettingsUpdate(BaseModel):
    ga4_measurement_id: Optional[str] = Field(None, max_length=40)
    search_console_verification: Optional[str] = Field(None, max_length=200)
    hero_headline_nl: Optional[str] = Field(None, max_length=200)
    hero_headline_en: Optional[str] = Field(None, max_length=200)
    site_status: Optional[str] = Field(None, pattern="^(live|maintenance|coming_soon)$")
    site_status_lang: Optional[str] = Field(None, pattern="^(auto|nl|en)$")
    maintenance_bg_mode: Optional[str] = Field(None, pattern="^(dynamic|custom)$")
    maintenance_bg_url: Optional[str] = Field(None, max_length=500)
    ai_translate_limit_per_minute: Optional[int] = Field(None, ge=1, le=500)


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
    # Optional English translation for the review quote — filled by the CMS
    # "Bulk translate" button. Public site uses it when lang=en.
    quote_en: Optional[str] = None
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
    quote_en: Optional[str] = Field(None, max_length=1500)

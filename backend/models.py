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
    # Visibility toggles — flip these from CMS → General to hide social-proof
    # widgets sitewide (rebrand, migration, dispute resolution, etc.). Default
    # to True so the public site keeps its current look.
    show_reviews: Optional[bool] = True
    show_trust_stats: Optional[bool] = True
    # Hero background — "animated" (default CSS/motion backdrop) or "video"
    # (admin-supplied muted looping MP4/WebM). Admins upload/paste a URL and
    # the public hero swaps the backdrop layer only; copy/CTAs are untouched.
    hero_bg_mode: Optional[str] = "animated"  # "animated" | "video"
    hero_bg_video_url: Optional[str] = ""
    hero_bg_video_poster: Optional[str] = ""
    # Dim the video with a translucent overlay so hero copy stays readable
    # regardless of the clip's brightness. 0..80 (%), default 35.
    hero_bg_video_dim: Optional[int] = 35
    # ------------------------------------------------------------------
    # Social media links — every field is optional. The public footer only
    # renders an icon when its URL is non-empty. Curated selection covers
    # general reach (Meta / X / TikTok), pro networks (LinkedIn / GitHub /
    # Behance / Dribbble), video (YouTube / Vimeo / Twitch), messaging
    # (WhatsApp / Telegram / Signal / Discord), reviews (Trustpilot /
    # Google Business) and next-gen networks (Mastodon / Bluesky /
    # Threads / Medium).
    # ------------------------------------------------------------------
    social_linkedin: Optional[str] = ""
    social_facebook: Optional[str] = ""
    social_instagram: Optional[str] = ""
    social_twitter: Optional[str] = ""       # a.k.a. X
    social_youtube: Optional[str] = ""
    social_tiktok: Optional[str] = ""
    social_whatsapp: Optional[str] = ""      # wa.me / phone
    social_telegram: Optional[str] = ""
    social_signal: Optional[str] = ""        # signal.me link
    social_discord: Optional[str] = ""
    social_github: Optional[str] = ""
    social_gitlab: Optional[str] = ""
    social_behance: Optional[str] = ""
    social_dribbble: Optional[str] = ""
    social_medium: Optional[str] = ""
    social_mastodon: Optional[str] = ""
    social_bluesky: Optional[str] = ""
    social_threads: Optional[str] = ""
    social_vimeo: Optional[str] = ""
    social_twitch: Optional[str] = ""
    social_trustpilot: Optional[str] = ""
    social_google_business: Optional[str] = ""
    social_pinterest: Optional[str] = ""
    social_reddit: Optional[str] = ""


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
    show_reviews: Optional[bool] = None
    show_trust_stats: Optional[bool] = None
    hero_bg_mode: Optional[str] = Field(None, pattern="^(animated|video)$")
    hero_bg_video_url: Optional[str] = Field(None, max_length=500)
    hero_bg_video_poster: Optional[str] = Field(None, max_length=500)
    hero_bg_video_dim: Optional[int] = Field(None, ge=0, le=80)
    # Social links — plain URL strings; empty means "hide the icon".
    # Length caps guard against accidental paste of monster blobs; 500 chars
    # is comfortably above any legitimate share URL.
    social_linkedin: Optional[str] = Field(None, max_length=500)
    social_facebook: Optional[str] = Field(None, max_length=500)
    social_instagram: Optional[str] = Field(None, max_length=500)
    social_twitter: Optional[str] = Field(None, max_length=500)
    social_youtube: Optional[str] = Field(None, max_length=500)
    social_tiktok: Optional[str] = Field(None, max_length=500)
    social_whatsapp: Optional[str] = Field(None, max_length=500)
    social_telegram: Optional[str] = Field(None, max_length=500)
    social_signal: Optional[str] = Field(None, max_length=500)
    social_discord: Optional[str] = Field(None, max_length=500)
    social_github: Optional[str] = Field(None, max_length=500)
    social_gitlab: Optional[str] = Field(None, max_length=500)
    social_behance: Optional[str] = Field(None, max_length=500)
    social_dribbble: Optional[str] = Field(None, max_length=500)
    social_medium: Optional[str] = Field(None, max_length=500)
    social_mastodon: Optional[str] = Field(None, max_length=500)
    social_bluesky: Optional[str] = Field(None, max_length=500)
    social_threads: Optional[str] = Field(None, max_length=500)
    social_vimeo: Optional[str] = Field(None, max_length=500)
    social_twitch: Optional[str] = Field(None, max_length=500)
    social_trustpilot: Optional[str] = Field(None, max_length=500)
    social_google_business: Optional[str] = Field(None, max_length=500)
    social_pinterest: Optional[str] = Field(None, max_length=500)
    social_reddit: Optional[str] = Field(None, max_length=500)


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


class RoadmapItem(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    # Lucide-react icon name (curated set — see /api/site/roadmap-icons for allowed values)
    icon: str = Field(default="Sparkles")
    title_nl: str
    title_en: Optional[str] = None
    description_nl: str
    description_en: Optional[str] = None
    status: str = Field(default="planned", pattern="^(achieved|planned)$")
    order: int = 0
    # Free-form label the CMS admin sets — e.g. "2026 Q1" or "Live". Rendered
    # as a chip on the timeline. Kept optional so the CMS can leave it empty.
    date_label: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class RoadmapItemCreate(BaseModel):
    icon: str = Field(default="Sparkles", max_length=40)
    title_nl: str = Field(..., min_length=1, max_length=120)
    title_en: Optional[str] = Field(None, max_length=120)
    description_nl: str = Field(..., min_length=1, max_length=600)
    description_en: Optional[str] = Field(None, max_length=600)
    status: str = Field(default="planned", pattern="^(achieved|planned)$")
    order: Optional[int] = 0
    date_label: Optional[str] = Field(None, max_length=40)


class RoadmapItemUpdate(BaseModel):
    icon: Optional[str] = Field(None, max_length=40)
    title_nl: Optional[str] = Field(None, min_length=1, max_length=120)
    title_en: Optional[str] = Field(None, max_length=120)
    description_nl: Optional[str] = Field(None, min_length=1, max_length=600)
    description_en: Optional[str] = Field(None, max_length=600)
    status: Optional[str] = Field(None, pattern="^(achieved|planned)$")
    order: Optional[int] = None
    date_label: Optional[str] = Field(None, max_length=40)


# ---------- Pricing catalog (CMS-editable, powers /prijslijst + calculator) ----------
class PricingVolumeTier(BaseModel):
    """One row in a volume-discount table (used by cyber endpoint agents)."""
    from_qty: int = Field(..., ge=1, description="Inclusive lower bound of the machine count")
    to_qty: Optional[int] = Field(None, description="Inclusive upper bound; None = unbounded")
    discount_per_unit: float = Field(..., ge=0, description="EUR discount per unit (deducted from base price)")


class PricingItem(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    service: str = Field(..., pattern="^(web|ict|cyber)$")
    cat: str = Field(..., min_length=1, max_length=40)
    nl: str
    en: Optional[str] = None
    unit: str = Field(default="eenmalig")  # eenmalig | per_maand | per_uur | per_stuk | per_taal | per_machine_maand | per_module | per_20_items | vanaf
    min_price: float = 0.0
    max_price: float = 0.0
    note_nl: Optional[str] = None
    note_en: Optional[str] = None
    tbd: Optional[bool] = False
    included: Optional[bool] = False
    order: int = 100
    # Special marker: e.g. "cyber_endpoint_agent" tells the frontend calculator
    # to show a machine-count input and apply the volume_tiers.
    special: Optional[str] = None
    volume_tiers: Optional[List[PricingVolumeTier]] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PricingItemCreate(BaseModel):
    service: str = Field(..., pattern="^(web|ict|cyber)$")
    cat: str = Field(..., min_length=1, max_length=40)
    nl: str = Field(..., min_length=1, max_length=240)
    en: Optional[str] = Field(None, max_length=240)
    unit: str = Field(default="eenmalig", max_length=32)
    min_price: float = Field(0.0, ge=0)
    max_price: float = Field(0.0, ge=0)
    note_nl: Optional[str] = Field(None, max_length=400)
    note_en: Optional[str] = Field(None, max_length=400)
    tbd: Optional[bool] = False
    included: Optional[bool] = False
    order: int = 100
    special: Optional[str] = Field(None, max_length=60)
    volume_tiers: Optional[List[PricingVolumeTier]] = None


class PricingItemUpdate(BaseModel):
    service: Optional[str] = Field(None, pattern="^(web|ict|cyber)$")
    cat: Optional[str] = Field(None, min_length=1, max_length=40)
    nl: Optional[str] = Field(None, min_length=1, max_length=240)
    en: Optional[str] = Field(None, max_length=240)
    unit: Optional[str] = Field(None, max_length=32)
    min_price: Optional[float] = Field(None, ge=0)
    max_price: Optional[float] = Field(None, ge=0)
    note_nl: Optional[str] = Field(None, max_length=400)
    note_en: Optional[str] = Field(None, max_length=400)
    tbd: Optional[bool] = None
    included: Optional[bool] = None
    order: Optional[int] = None
    special: Optional[str] = Field(None, max_length=60)
    volume_tiers: Optional[List[PricingVolumeTier]] = None


class PricingCategory(BaseModel):
    """A grouping used on /prijslijst + calculator (bv. 'Website-bescherming')."""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    key: str = Field(..., min_length=1, max_length=40, description="Stable slug used by items in `cat`")
    service: str = Field(..., pattern="^(web|ict|cyber)$")
    nl: str
    en: Optional[str] = None
    order: int = 100
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PricingCategoryCreate(BaseModel):
    key: str = Field(..., min_length=1, max_length=40)
    service: str = Field(..., pattern="^(web|ict|cyber)$")
    nl: str = Field(..., min_length=1, max_length=120)
    en: Optional[str] = Field(None, max_length=120)
    order: int = 100


class PricingCategoryUpdate(BaseModel):
    key: Optional[str] = Field(None, min_length=1, max_length=40)
    service: Optional[str] = Field(None, pattern="^(web|ict|cyber)$")
    nl: Optional[str] = Field(None, min_length=1, max_length=120)
    en: Optional[str] = Field(None, max_length=120)
    order: Optional[int] = None

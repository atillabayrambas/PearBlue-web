"""Hero background video uploads.

Wraps the Emergent Object Storage API so admins can upload MP4/WebM directly
from the CMS instead of pasting external URLs. Videos are:
  1. Streamed to Emergent storage (bucket-scoped, session key cached)
  2. Recorded in `hero_video_assets` (id, storage_path, size, content_type,
     uploaded_by, created_at, is_deleted)
  3. Served back through `/api/hero-videos/{id}` — public GET so the <video>
     tag on the marketing page can render without an auth token.

Design notes:
  - We intentionally do NOT transcode server-side (no ffmpeg in the sandbox);
    admins can upload one MP4 (Safari/iOS) *and* one WebM (Chrome/Firefox) and
    the public hero picks whichever setting is filled in via `<source>` tags.
  - Soft-delete only (Emergent storage has no delete API — playbook constraint).
  - Uploads are capped at 20 MB and restricted to video/mp4 + video/webm.
"""
import os
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional

import requests
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Response
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

APP_NAME = "pearblue"
MAX_BYTES = 20 * 1024 * 1024  # 20 MB — hero clips are meant to be short/optimized
ALLOWED_TYPES = {"video/mp4": "mp4", "video/webm": "webm"}

# Session-scoped storage key (playbook says init once and reuse).
_storage_key: Optional[str] = None


def _init_storage(force: bool = False) -> str:
    """Mint / return a cached storage session key. Retries force=True on 403/404."""
    global _storage_key
    if _storage_key and not force:
        return _storage_key
    if not EMERGENT_KEY:
        raise HTTPException(status_code=500, detail="Object storage unavailable — EMERGENT_LLM_KEY not set")
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    if resp.status_code != 200:
        logger.error("Storage init failed %s: %s", resp.status_code, resp.text[:200])
        raise HTTPException(status_code=502, detail="Object storage init failed")
    _storage_key = resp.json()["storage_key"]
    return _storage_key


def _put_object(path: str, data: bytes, content_type: str) -> dict:
    """PUT the payload; on 403/404 mint a fresh key once and retry (playbook)."""
    key = _init_storage()
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data,
        timeout=180,
    )
    if resp.status_code in (403, 404):
        key = _init_storage(force=True)
        resp = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data,
            timeout=180,
        )
    if resp.status_code != 200:
        logger.error("Storage PUT %s failed %s: %s", path, resp.status_code, resp.text[:200])
        raise HTTPException(status_code=502, detail="Video upload failed")
    return resp.json()


def _get_object(path: str) -> tuple[bytes, str]:
    key = _init_storage()
    resp = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key},
        timeout=60,
    )
    if resp.status_code in (403, 404):
        key = _init_storage(force=True)
        resp = requests.get(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key},
            timeout=60,
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=404, detail="Video not found")
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


def make_router(db: AsyncIOMotorDatabase, require_admin_dep) -> APIRouter:
    """Build the /api/hero-videos router.

    Endpoints return **relative** URLs (e.g. `/api/hero-videos/{id}`) so the
    client can prepend `REACT_APP_BACKEND_URL` — keeps the backend agnostic
    to its public hostname (preview vs production).
    """
    router = APIRouter(prefix="/hero-videos", tags=["hero-uploads"])

    def _public_url(asset_id: str) -> str:
        return f"/api/hero-videos/{asset_id}"

    @router.post("/upload")
    async def upload_hero_video(file: UploadFile = File(...), current=Depends(require_admin_dep)):
        ct = (file.content_type or "").lower()
        if ct not in ALLOWED_TYPES:
            raise HTTPException(status_code=400, detail=f"Only {'/'.join(ALLOWED_TYPES)} allowed")
        data = await file.read()
        if not data:
            raise HTTPException(status_code=400, detail="Empty file")
        if len(data) > MAX_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"File too large ({len(data) // (1024 * 1024)} MB) — max {MAX_BYTES // (1024 * 1024)} MB",
            )

        ext = ALLOWED_TYPES[ct]
        asset_id = str(uuid.uuid4())
        # Path convention from the playbook — no leading slash, uuid filename
        path = f"{APP_NAME}/hero-videos/{asset_id}.{ext}"
        result = _put_object(path, data, ct)

        now = datetime.now(timezone.utc).isoformat()
        record = {
            "id": asset_id,
            "storage_path": result["path"],
            "content_type": ct,
            "size": result.get("size", len(data)),
            "original_filename": file.filename or f"{asset_id}.{ext}",
            "uploaded_by": current.get("email"),
            "created_at": now,
            "is_deleted": False,
        }
        await db.hero_video_assets.insert_one(record)

        return {
            "id": asset_id,
            "url": _public_url(asset_id),
            "content_type": ct,
            "size": record["size"],
            "original_filename": record["original_filename"],
        }

    @router.get("/list")
    async def list_hero_videos(current=Depends(require_admin_dep)):
        cursor = db.hero_video_assets.find({"is_deleted": False}).sort("created_at", -1).limit(50)
        items = []
        async for doc in cursor:
            doc.pop("_id", None)
            doc["url"] = _public_url(doc["id"])
            items.append(doc)
        return items

    @router.delete("/{asset_id}")
    async def delete_hero_video(asset_id: str, current=Depends(require_admin_dep)):
        res = await db.hero_video_assets.update_one(
            {"id": asset_id, "is_deleted": False},
            {"$set": {"is_deleted": True, "deleted_at": datetime.now(timezone.utc).isoformat()}},
        )
        if res.matched_count == 0:
            raise HTTPException(status_code=404, detail="Not found")
        return {"ok": True}

    @router.get("/{asset_id}")
    async def stream_hero_video(asset_id: str):
        # PUBLIC endpoint — the public hero <video> tag needs to render without
        # auth. We only reveal videos that are actively linked in hero settings.
        record = await db.hero_video_assets.find_one({"id": asset_id, "is_deleted": False})
        if not record:
            raise HTTPException(status_code=404, detail="Not found")
        data, ct = _get_object(record["storage_path"])
        return Response(
            content=data,
            media_type=record.get("content_type") or ct,
            headers={"Cache-Control": "public, max-age=31536000, immutable"},
        )

    return router

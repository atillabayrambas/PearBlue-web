"""Hero background video uploads.

Admins upload ONE MP4 or WebM from the CMS and we automatically produce the
missing sibling format with ffmpeg so browsers get the best variant via
`<source>` tags (WebM for Chromium/Firefox, MP4 for Safari/iOS).

Flow:
  1. Client POSTs a video (mp4|webm, max 20MB) → we upload the original to
     Emergent Object Storage under `pearblue/hero-videos/{id}.{ext}`.
  2. We run ffmpeg to transcode into the OTHER format (fast presets — a
     10s clip finishes in <8s on a shared CPU) and upload that too.
  3. Both `mp4_path` and `webm_path` land in `hero_video_assets`.
  4. Public streaming exposes three URLs:
        /api/hero-videos/{id}          → auto-negotiates on Accept + UA
        /api/hero-videos/{id}.mp4      → forced MP4
        /api/hero-videos/{id}.webm     → forced WebM
     Frontend renders BOTH `.mp4` and `.webm` <source> tags so the browser
     picks the smaller/faster of the two automatically.

Design notes:
  - Soft-delete only (Emergent storage has no delete API).
  - Transcode is best-effort: if ffmpeg fails, we still return the original
    and log a warning. The public hero degrades to a single-source video.
"""
import os
import uuid
import shutil
import logging
import subprocess
import tempfile
from datetime import datetime, timezone
from typing import Optional, Tuple

import requests
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request
from fastapi.responses import Response
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

APP_NAME = "pearblue"
MAX_BYTES = 20 * 1024 * 1024
EXT_BY_CT = {"video/mp4": "mp4", "video/webm": "webm"}
CT_BY_EXT = {"mp4": "video/mp4", "webm": "video/webm"}
FFMPEG_BIN = shutil.which("ffmpeg") or "ffmpeg"

_storage_key: Optional[str] = None


def _init_storage(force: bool = False) -> str:
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


def _get_object(path: str) -> Tuple[bytes, str]:
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


def _transcode(src_bytes: bytes, src_ext: str, dst_ext: str) -> Optional[bytes]:
    """Transcode src_bytes (`mp4`|`webm`) → dst_ext. Returns bytes or None on failure.

    Uses ffmpeg's fastest realistic presets so an 8–15s clip finishes in a
    few seconds. Silent audio is fine; we don't drop it.
    """
    if src_ext == dst_ext:
        return src_bytes
    with tempfile.TemporaryDirectory() as tmp:
        src_path = os.path.join(tmp, f"in.{src_ext}")
        dst_path = os.path.join(tmp, f"out.{dst_ext}")
        with open(src_path, "wb") as f:
            f.write(src_bytes)
        if dst_ext == "mp4":
            args = [
                FFMPEG_BIN, "-y", "-i", src_path,
                "-c:v", "libx264", "-preset", "ultrafast", "-crf", "26",
                "-pix_fmt", "yuv420p",  # broad player compatibility (iOS/Safari)
                "-movflags", "+faststart",  # let the player start before full download
                "-c:a", "aac", "-b:a", "96k",
                dst_path,
            ]
        elif dst_ext == "webm":
            args = [
                FFMPEG_BIN, "-y", "-i", src_path,
                "-c:v", "libvpx-vp9", "-crf", "34", "-b:v", "0",
                "-deadline", "realtime", "-cpu-used", "8",
                "-row-mt", "1",
                "-c:a", "libopus", "-b:a", "96k",
                dst_path,
            ]
        else:
            return None
        try:
            proc = subprocess.run(
                args,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.PIPE,
                timeout=110,
                check=False,
            )
            if proc.returncode != 0:
                logger.warning(
                    "ffmpeg transcode %s → %s failed (code=%s): %s",
                    src_ext, dst_ext, proc.returncode, proc.stderr.decode(errors="ignore")[-300:],
                )
                return None
            with open(dst_path, "rb") as f:
                return f.read()
        except subprocess.TimeoutExpired:
            logger.warning("ffmpeg transcode %s → %s timed out", src_ext, dst_ext)
            return None
        except Exception as e:  # pragma: no cover
            logger.exception("ffmpeg transcode crash: %s", e)
            return None


def _pick_format(accept_header: str, user_agent: str) -> str:
    """Choose mp4 vs webm for the auto-negotiate endpoint.

    Safari / iOS => mp4 (Safari's WebM support is patchy).
    Everyone else => webm (smaller, plays fine).
    """
    ua = (user_agent or "").lower()
    if "safari" in ua and "chrome" not in ua and "chromium" not in ua and "edg" not in ua:
        return "mp4"
    if "iphone" in ua or "ipad" in ua or "ipod" in ua:
        return "mp4"
    if "video/webm" in (accept_header or "").lower():
        return "webm"
    return "webm"


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
        if ct not in EXT_BY_CT:
            raise HTTPException(status_code=400, detail=f"Only {'/'.join(EXT_BY_CT)} allowed")
        data = await file.read()
        if not data:
            raise HTTPException(status_code=400, detail="Empty file")
        if len(data) > MAX_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"File too large ({len(data) // (1024 * 1024)} MB) — max {MAX_BYTES // (1024 * 1024)} MB",
            )

        src_ext = EXT_BY_CT[ct]
        dst_ext = "webm" if src_ext == "mp4" else "mp4"
        asset_id = str(uuid.uuid4())

        # 1. Upload the original
        src_path = f"{APP_NAME}/hero-videos/{asset_id}.{src_ext}"
        src_result = _put_object(src_path, data, ct)

        # 2. Attempt transcode → dst_ext. Best-effort.
        dst_bytes = _transcode(data, src_ext, dst_ext)
        dst_result = None
        if dst_bytes:
            dst_path = f"{APP_NAME}/hero-videos/{asset_id}.{dst_ext}"
            try:
                dst_result = _put_object(dst_path, dst_bytes, CT_BY_EXT[dst_ext])
            except HTTPException as e:
                logger.warning("Storage PUT of transcoded %s failed: %s", dst_ext, e.detail)

        now = datetime.now(timezone.utc).isoformat()
        record = {
            "id": asset_id,
            "mp4_path": src_result["path"] if src_ext == "mp4" else (dst_result["path"] if dst_result else None),
            "webm_path": src_result["path"] if src_ext == "webm" else (dst_result["path"] if dst_result else None),
            "primary_ext": src_ext,
            "original_filename": file.filename or f"{asset_id}.{src_ext}",
            "original_size": len(data),
            "transcoded_size": len(dst_bytes) if dst_bytes else None,
            "transcode_ok": dst_bytes is not None,
            "uploaded_by": current.get("email"),
            "created_at": now,
            "is_deleted": False,
        }
        await db.hero_video_assets.insert_one(record)

        return {
            "id": asset_id,
            "url": _public_url(asset_id),
            "mp4_url": _public_url(asset_id) + ".mp4" if record["mp4_path"] else None,
            "webm_url": _public_url(asset_id) + ".webm" if record["webm_path"] else None,
            "primary_ext": src_ext,
            "transcode_ok": record["transcode_ok"],
            "original_size": record["original_size"],
            "transcoded_size": record["transcoded_size"],
            "original_filename": record["original_filename"],
        }

    @router.get("/list")
    async def list_hero_videos(current=Depends(require_admin_dep)):
        cursor = db.hero_video_assets.find({"is_deleted": False}).sort("created_at", -1).limit(50)
        items = []
        async for doc in cursor:
            doc.pop("_id", None)
            doc["url"] = _public_url(doc["id"])
            doc["mp4_url"] = _public_url(doc["id"]) + ".mp4" if doc.get("mp4_path") else None
            doc["webm_url"] = _public_url(doc["id"]) + ".webm" if doc.get("webm_path") else None
            items.append(doc)
        return items

    @router.delete("/{asset_id}")
    async def delete_hero_video(asset_id: str, current=Depends(require_admin_dep)):
        # Strip an accidental extension so admins/curl can pass either form
        clean_id = asset_id.split(".", 1)[0]
        res = await db.hero_video_assets.update_one(
            {"id": clean_id, "is_deleted": False},
            {"$set": {"is_deleted": True, "deleted_at": datetime.now(timezone.utc).isoformat()}},
        )
        if res.matched_count == 0:
            raise HTTPException(status_code=404, detail="Not found")
        return {"ok": True}

    async def _serve(asset_id: str, forced_ext: Optional[str], request: Request):
        record = await db.hero_video_assets.find_one({"id": asset_id, "is_deleted": False})
        if not record:
            raise HTTPException(status_code=404, detail="Not found")
        if forced_ext:
            ext = forced_ext
        else:
            ext = _pick_format(
                request.headers.get("accept", ""),
                request.headers.get("user-agent", ""),
            )
        path_key = f"{ext}_path"
        storage_path = record.get(path_key)
        # Fall back to whatever variant we do have
        if not storage_path:
            alt = "mp4" if ext == "webm" else "webm"
            storage_path = record.get(f"{alt}_path")
            ext = alt
        if not storage_path:
            raise HTTPException(status_code=404, detail="Not found")
        data, ct = _get_object(storage_path)
        return Response(
            content=data,
            media_type=CT_BY_EXT.get(ext, ct),
            headers={"Cache-Control": "public, max-age=31536000, immutable"},
        )

    @router.get("/{asset_id}.mp4")
    async def stream_mp4(asset_id: str, request: Request):
        return await _serve(asset_id, "mp4", request)

    @router.get("/{asset_id}.webm")
    async def stream_webm(asset_id: str, request: Request):
        return await _serve(asset_id, "webm", request)

    @router.get("/{asset_id}")
    async def stream_auto(asset_id: str, request: Request):
        return await _serve(asset_id, None, request)

    return router

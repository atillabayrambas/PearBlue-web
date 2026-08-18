# syntax=docker/dockerfile:1.6
# ---------------------------------------------------------------------------
# PearBlue backend — production image for Render.com Docker deploys.
# Build context expected to be `backend/` (i.e. this Dockerfile sits next
# to server.py and requirements.txt).
# ---------------------------------------------------------------------------
FROM python:3.11-slim

# ---- OS packages ---------------------------------------------------------
# ffmpeg: hero_uploads.py transcodes uploaded video to MP4 + WebM
# build-essential + libffi + libssl: needed by cryptography / bcrypt wheels
#   that fall back to source on some architectures
# curl: healthcheck + operator debugging
# ---------------------------------------------------------------------------
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ffmpeg \
        build-essential \
        libffi-dev \
        libssl-dev \
        curl \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# ---- Python deps ---------------------------------------------------------
# Copy only the requirements file first so Docker can cache the pip layer
# across code-only rebuilds.
# `emergentintegrations` lives on a private index that our platform
# publishes — the extra index URL is required to resolve it.
# ---------------------------------------------------------------------------
COPY requirements.txt ./
RUN pip install --upgrade pip \
    && pip install \
        --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/ \
        -r requirements.txt

# ---- Application code ----------------------------------------------------
COPY . .

# Render injects PORT at runtime; default to 8001 for local `docker run`.
ENV PORT=8001
EXPOSE 8001

# Simple TCP healthcheck against the FastAPI /api/health endpoint. Render
# also does its own health-probe, but this helps `docker ps` / local runs.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS "http://127.0.0.1:${PORT}/api/health" || exit 1

# Bind to $PORT so Render's routing layer can reach us. Single worker keeps
# the in-process schedulers (Zoho autopilot, IMAP poller, review invites)
# behaving like they do in dev — scale horizontally on Render if you need
# more throughput, not by bumping workers here.
CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT} --workers 1 --proxy-headers --forwarded-allow-ips='*'"]

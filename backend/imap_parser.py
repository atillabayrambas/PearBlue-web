"""IMAP inbound parser — pulls unseen messages from every mailbox stored in
`db.mailboxes` and, when the subject carries `[#TKT-XXXXXX]`, files the message
body as an admin reply on the matching contact_message thread.

Design notes
------------
* Runs as a background asyncio task started from `server.startup_event`.
* Poll interval defaults to 60s (env: `IMAP_POLL_SECONDS`).
* Uses stdlib `imaplib` inside `asyncio.to_thread` so we don't block the loop.
* Idempotent: seen mails are marked `\Seen` in the mailbox AND recorded in
  `db.imap_ingested` with (mailbox_id, uid) so we never double-ingest.
"""
from __future__ import annotations

import asyncio
import email
import email.header
import imaplib
import logging
import os
import re
import socket
from datetime import datetime, timezone, timedelta
from typing import Optional
from email.utils import parseaddr

logger = logging.getLogger(__name__)

# Keep hanging IMAP hosts from blocking the poller thread. 10s is plenty for a
# well-behaved provider and fails fast on typos or DNS misses.
_IMAP_SOCKET_TIMEOUT = int(os.environ.get("IMAP_SOCKET_TIMEOUT", "10"))
socket.setdefaulttimeout(_IMAP_SOCKET_TIMEOUT)

POLL_SECONDS = int(os.environ.get("IMAP_POLL_SECONDS", "60"))
TKT_RE = re.compile(r"#TKT-([A-Z0-9]{4,10})", re.IGNORECASE)

# Time window around the source-record timestamp used for fuzzy matching
# outgoing notification emails back to the entity that produced them.
NOTIFICATION_MATCH_WINDOW_MIN = int(os.environ.get("IMAP_NOTIF_WINDOW_MIN", "15"))

# Subjects of the transactional notifications PearBlue sends to info@pearblue.nl.
# Each pattern captures the "name" (or rating+name for reviews) so we can look
# up the source contact_message / portal_registration / review by name AND
# by a time window around the email timestamp.
_NOTIF_PATTERNS = [
    # kind, regex, collection. ORDER MATTERS — specific patterns first, so the
    # greedy contact fallback at the bottom doesn't hijack review / portal / chat
    # subjects. Each regex captures the customer name in group(1).
    ("review", re.compile(r"\[PearBlue\]\s+Nieuwe\s+klantbeoordeling\s+[—-]+\s+\d+★\s+van\s+(.+?)\s*$", re.IGNORECASE), "reviews"),
    ("registration", re.compile(r"\[PearBlue\]\s+Nieuwe\s+portaal[- ]aanvraag\s+[—-]+\s+(.+?)\s*$", re.IGNORECASE), "portal_registrations"),
    ("chat_handoff", re.compile(r"\[Chat\]\s+Chat\s+handoff\s+[—-]+\s+(.+?)\s*$", re.IGNORECASE), "contact_messages"),
    ("contact", re.compile(r"\[PearBlue\]\s+Nieuw\s+contactbericht\s+[—-]+\s+(.+?)\s*$", re.IGNORECASE), "contact_messages"),
    ("contact", re.compile(r"\[PearBlue\]\s+Offerte[- ]aanvraag\s+[—-]+\s+.+?\s+[—-]+\s+(.+?)\s*$", re.IGNORECASE), "contact_messages"),
    ("contact", re.compile(r"\[PearBlue\]\s+.+?\s+[—-]+\s+(.+?)\s*$", re.IGNORECASE), "contact_messages"),  # generic fallback — MUST stay last
]


# Track which subjects triggered the generic fallback — logged once per unique
# subject prefix so admins can spot new notification types worth an explicit rule.
_FALLBACK_SEEN: set[str] = set()


def _classify_notification(subject: str):
    """Return (kind, name, collection) for a notification-style subject, or
    (None, None, None) when the subject doesn't match any pattern. When the
    generic `[PearBlue]` fallback fires on a subject we haven't seen before,
    a warning is logged so we can add a specific pattern in a future release."""
    if not subject:
        return None, None, None
    subj = subject.strip()
    for idx, (kind, pat, coll) in enumerate(_NOTIF_PATTERNS):
        m = pat.match(subj)
        if m:
            name = m.group(1).strip()
            # Skip obvious junk / quota emails (from Resend/system providers).
            if not name or name.lower() in {"pearblue", "test"}:
                continue
            # `idx == last` is the greedy generic fallback — emit a discovery
            # warning once per unique subject-prefix (first 5 words) so we can
            # add a specific rule for this notification type later.
            if idx == len(_NOTIF_PATTERNS) - 1:
                key = " ".join(subj.split()[:5]).lower()
                if key not in _FALLBACK_SEEN:
                    _FALLBACK_SEEN.add(key)
                    logger.warning(
                        f"IMAP notification classifier: generic fallback fired for '{subj[:120]}' — "
                        f"consider adding a specific _NOTIF_PATTERNS entry for this subject."
                    )
            return kind, name, coll
    return None, None, None


# Domains that PearBlue itself uses to send outgoing transactional / system
# email. When a mail comes FROM one of these, it's either an outgoing
# notification (already covered by _classify_notification above) or a
# provider-level status message (quota warnings, etc.) — never an actual
# customer message. Mails from these senders will NOT auto-create tickets.
OWN_NOTIFICATION_DOMAINS = {
    "resend.dev",
    "resend.com",
    "notifications.resend.com",
    "pearblue.nl",  # own domain — avoids self-loops if we forward
}


def _is_own_notification_sender(from_email: str, subject: str) -> bool:
    if not from_email:
        return True
    addr = from_email.lower().strip()
    domain = addr.rsplit("@", 1)[-1] if "@" in addr else ""
    if domain in OWN_NOTIFICATION_DOMAINS:
        return True
    # Quota-style provider notifications never map to a customer ticket.
    if subject and re.search(r"quota|delivery.*(failed|delayed)|bounce|no[- ]reply", subject, re.IGNORECASE):
        return True
    return False


# Window used by _create_ticket_from_email to group repeat customer emails
# into a single conversation instead of creating N separate tickets.
AUTO_TICKET_DEDUP_HOURS = int(os.environ.get("IMAP_AUTO_TICKET_DEDUP_HOURS", "24"))


def _normalize_subject(subject: str) -> str:
    """Normalize an inbound subject for dedup grouping — strips leading
    Re:/Fwd:/[TAG] prefixes and lowercases whitespace so that a fresh reply
    thread lands on the same base subject."""
    s = (subject or "").strip()
    # Repeatedly strip leading Re:/Fwd:/Antw:/AW:/[TAG]
    prev = None
    while prev != s:
        prev = s
        s = re.sub(r"^\s*(re|fwd|fw|antw|aw|vs)\s*:\s*", "", s, flags=re.IGNORECASE)
        s = re.sub(r"^\s*\[[^\]]+\]\s*", "", s)
    return " ".join(s.lower().split())


async def _create_ticket_from_email(db, m: dict, mbox: dict) -> Optional[dict]:
    """Create a new contact_messages doc from an incoming customer email so
    it appears in the Berichten CMS tab, OR — if the same customer already
    has an open ticket in the last AUTO_TICKET_DEDUP_HOURS with the same
    normalized subject — append the new email as a reply to that existing
    ticket instead of spawning a duplicate. Idempotent on the RFC-822
    Message-ID (see idempotency guard in the caller — this is only called
    once per unique UID)."""
    try:
        import secrets, string, uuid as _uuid  # local import: keeps top-level imports minimal
        from_email = (m.get("from_email") or "").lower().strip()
        subject_norm = _normalize_subject(m.get("subject") or "")
        now = datetime.now(timezone.utc)
        cutoff_iso = (now - timedelta(hours=AUTO_TICKET_DEDUP_HOURS)).isoformat()
        # ── Dedup: is there an existing ticket from the same customer with
        # the same normalized subject in the last N hours? Prefer the newest.
        existing = None
        if from_email and subject_norm:
            existing = await db.contact_messages.find_one(
                {
                    "email": {"$regex": f"^{re.escape(from_email)}$", "$options": "i"},
                    "created_at": {"$gt": cutoff_iso},
                    "status": {"$ne": "done"},
                },
                sort=[("created_at", -1)],
            )
            if existing:
                exist_norm = _normalize_subject(existing.get("subject") or "")
                if exist_norm != subject_norm:
                    existing = None
        if existing:
            # Append this email as a client-side reply instead of creating a
            # second ticket. Same shape as the ticket-ref match in Case A.
            reply = {
                "id": f"imap-{m.get('uid')}-dedup",
                "parent_id": existing.get("id"),
                "author": "client",
                "author_name": m.get("from_name") or from_email,
                "author_email": from_email,
                "body": m.get("body") or "",
                "created_at": now.isoformat(),
                "source": "imap_dedup",
                "message_id": m.get("message_id"),
            }
            await db.contact_message_replies.insert_one(reply)
            await db.contact_messages.update_one(
                {"id": existing["id"]},
                {"$set": {"last_reply_at": reply["created_at"], "status": "open"}},
            )
            return existing
        # ── No recent match → fresh ticket
        ref = "".join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(6))
        doc = {
            "id": str(_uuid.uuid4()),
            "name": (m.get("from_name") or (from_email or "").split("@")[0] or "IMAP klant").strip()[:80],
            "email": from_email,
            "phone": None,
            "company": None,
            "subject": (m.get("subject") or "(geen onderwerp)")[:180],
            "message": m.get("body") or "",
            "consent": True,
            "created_at": now.isoformat(),
            "status": "new",
            "priority": "P3",
            "spam": False,
            "ticket_ref": ref,
            "assigned_to": None,
            "source": "imap_auto",
            "source_mailbox_id": mbox.get("id"),
            # Full IMAP source pointer — enables 2-way sync (CMS delete →
            # move to Trash on the mail server, and vice versa).
            "imap_source": {
                "mailbox_id": mbox.get("id"),
                "uid": str(m.get("uid")),
                "message_id": m.get("message_id"),
            },
        }
        await db.contact_messages.insert_one(doc)
        return doc
    except Exception as e:
        logger.warning(f"IMAP auto-ticket-create failed: {e}")
        return None


def _decode_header(v) -> str:
    if not v:
        return ""
    parts = email.header.decode_header(v)
    out = []
    for text, enc in parts:
        if isinstance(text, bytes):
            try:
                out.append(text.decode(enc or "utf-8", errors="replace"))
            except LookupError:
                out.append(text.decode("utf-8", errors="replace"))
        else:
            out.append(text)
    return "".join(out).strip()


def _extract_body(msg) -> str:
    """Prefer text/plain, fall back to stripped text/html."""
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type() == "text/plain" and not part.get("Content-Disposition"):
                try:
                    return part.get_payload(decode=True).decode(part.get_content_charset() or "utf-8", errors="replace").strip()
                except Exception:
                    pass
        for part in msg.walk():
            if part.get_content_type() == "text/html":
                try:
                    html = part.get_payload(decode=True).decode(part.get_content_charset() or "utf-8", errors="replace")
                    return re.sub(r"<[^>]+>", " ", html).strip()
                except Exception:
                    pass
        return ""
    try:
        return msg.get_payload(decode=True).decode(msg.get_content_charset() or "utf-8", errors="replace").strip()
    except Exception:
        return ""


def _fetch_new_messages(host: str, port: int, use_ssl: bool, username: str, password: str, folder: str = "INBOX", last_uid: Optional[int] = None, backfill_days: int = 30) -> tuple[list, Optional[int]]:
    """Blocking IMAP fetch — returns (messages, new_max_uid).

    UID-based sync so we don't skip already-read (`\\Seen`) messages:
      * First run for a mailbox (`last_uid is None`)  → fetch everything since
        `backfill_days` ago (default 30 days). Existing INBOX content is then
        imported the first time the mailbox is synced.
      * Subsequent runs → fetch `UID {last_uid+1}:*` so we only look at mail
        that arrived since the previous poll — regardless of \\Seen flags.

    Idempotency is still guarded by `db.imap_ingested` (mailbox_id, uid).
    Runs inside `asyncio.to_thread`.
    """
    imap_cls = imaplib.IMAP4_SSL if use_ssl else imaplib.IMAP4
    conn = imap_cls(host, port)
    try:
        conn.login(username, password)
        conn.select(folder)
        if last_uid is not None and last_uid > 0:
            # Incremental — everything strictly newer than what we saw last time.
            typ, data = conn.uid("search", None, f"UID {int(last_uid) + 1}:*")
        else:
            # First sync — backfill so already-read INBOX messages get imported.
            since = (datetime.now(timezone.utc) - timedelta(days=max(1, backfill_days))).strftime("%d-%b-%Y")
            typ, data = conn.uid("search", None, f"SINCE {since}")
        if typ != "OK":
            return [], last_uid
        raw_uids = data[0].split() if data and data[0] else []
        # Sort numerically so `max_uid` really is the highest UID we saw.
        try:
            uids = sorted({int(u) for u in raw_uids})
        except ValueError:
            uids = []
        results = []
        max_uid_seen = last_uid or 0
        # Cap per-poll load — process the newest 500 UIDs (plenty for a
        # 60s poll interval even under heavy inbound volume).
        for uid_int in uids[-500:]:
            uid_bytes = str(uid_int).encode()
            typ, msg_data = conn.uid("fetch", uid_bytes, "(RFC822)")
            if typ != "OK" or not msg_data or msg_data[0] is None:
                continue
            raw = msg_data[0]
            payload = raw[1] if isinstance(raw, tuple) else b""
            if not payload:
                continue
            try:
                msg = email.message_from_bytes(payload)
            except Exception:
                continue
            subject = _decode_header(msg.get("Subject"))
            from_name, from_addr = parseaddr(_decode_header(msg.get("From")))
            body = _extract_body(msg)
            results.append({
                "uid": str(uid_int),
                "subject": subject,
                "from_name": from_name,
                "from_email": (from_addr or "").lower(),
                "body": body,
                "date": _decode_header(msg.get("Date")),
                "message_id": _decode_header(msg.get("Message-ID")),
            })
            if uid_int > max_uid_seen:
                max_uid_seen = uid_int
        try:
            conn.close()
        except Exception:
            pass
        conn.logout()
        return results, max_uid_seen
    except imaplib.IMAP4.error as e:
        logger.warning(f"IMAP {username}@{host} error: {e}")
        try:
            conn.logout()
        except Exception:
            pass
        return [], last_uid


# ---------------------------------------------------------------------------
# 2-way sync helpers — used by /admin/contact/{id} delete flow to mirror
# deletions back to the mail server, and by the poller to detect
# server-side deletions and mirror them into the CMS.
# ---------------------------------------------------------------------------
# Candidate Trash folder names (Zoho Mail = "Trash", Gmail = "[Gmail]/Trash",
# common IMAP = "INBOX.Trash"). We try each on connect and cache the winner.
_TRASH_CANDIDATES = ["Trash", "INBOX.Trash", "[Gmail]/Trash", "Deleted Items", "Deleted Messages"]


def _find_trash_folder(conn) -> Optional[str]:
    """Return the first Trash-like folder that IMAP SELECT accepts, else None."""
    for name in _TRASH_CANDIDATES:
        typ, _ = conn.select(name)
        if typ == "OK":
            return name
    return None


def _imap_move_uids_to_trash(host: str, port: int, use_ssl: bool, username: str,
                              password: str, folder: str, uids: list[str]) -> dict:
    """Move a batch of UIDs from `folder` to the account's Trash folder.
    Prefers the IMAP MOVE extension (RFC 6851); falls back to COPY + STORE
    \\Deleted + EXPUNGE for older servers (e.g. Dovecot without MOVE).
    Returns {moved, method, trash_folder}. Runs inside `asyncio.to_thread`."""
    if not uids:
        return {"moved": 0, "method": "noop", "trash_folder": None}
    imap_cls = imaplib.IMAP4_SSL if use_ssl else imaplib.IMAP4
    conn = imap_cls(host, port)
    moved = 0
    method = "noop"
    trash = None
    try:
        conn.login(username, password)
        # Find the Trash folder using SELECT probing, then re-SELECT source.
        trash = _find_trash_folder(conn)
        conn.select(folder)
        if not trash:
            logger.warning(f"IMAP {username}@{host}: no Trash-like folder found; skipping move")
            return {"moved": 0, "method": "no_trash", "trash_folder": None}
        uid_set = ",".join(str(u) for u in uids)
        # Prefer MOVE extension when supported.
        try:
            typ, _ = conn.uid("MOVE", uid_set, trash)
            if typ == "OK":
                moved = len(uids)
                method = "move"
            else:
                raise imaplib.IMAP4.error("MOVE not OK")
        except imaplib.IMAP4.error:
            # Fallback: COPY + \\Deleted + EXPUNGE
            typ, _ = conn.uid("COPY", uid_set, trash)
            if typ != "OK":
                logger.warning(f"IMAP COPY to {trash} failed for {username}")
                return {"moved": 0, "method": "copy_failed", "trash_folder": trash}
            conn.uid("STORE", uid_set, "+FLAGS", r"(\Deleted)")
            conn.expunge()
            moved = len(uids)
            method = "copy_expunge"
    except imaplib.IMAP4.error as e:
        logger.warning(f"IMAP move-to-trash for {username}@{host} error: {e}")
    finally:
        try:
            conn.close()
        except Exception:
            pass
        try:
            conn.logout()
        except Exception:
            pass
    return {"moved": moved, "method": method, "trash_folder": trash}


def _imap_list_current_uids(host: str, port: int, use_ssl: bool, username: str,
                             password: str, folder: str, since_days: int = 60) -> Optional[set[int]]:
    """Return the set of UIDs currently present in `folder`, restricted to
    the last `since_days` (so we don't fetch years of archive). Returns
    `None` on connection/protocol errors so callers can skip the deletion
    pass rather than mass-deleting on a transient failure."""
    imap_cls = imaplib.IMAP4_SSL if use_ssl else imaplib.IMAP4
    conn = imap_cls(host, port)
    try:
        conn.login(username, password)
        conn.select(folder)
        since = (datetime.now(timezone.utc) - timedelta(days=max(1, since_days))).strftime("%d-%b-%Y")
        typ, data = conn.uid("search", None, f"SINCE {since}")
        if typ != "OK":
            return None
        raw = data[0].split() if data and data[0] else []
        result = set()
        for u in raw:
            try:
                result.add(int(u))
            except ValueError:
                continue
        return result
    except imaplib.IMAP4.error as e:
        logger.warning(f"IMAP list-uids for {username}@{host} error: {e}")
        return None
    finally:
        try:
            conn.close()
        except Exception:
            pass
        try:
            conn.logout()
        except Exception:
            pass


async def move_contact_message_to_imap_trash(db, contact_msg: dict, dec_fn) -> dict:
    """Given a contact_messages doc, move the underlying IMAP mail to
    Trash on the mail server. Idempotent — the caller is expected to
    delete the Mongo doc afterwards.

    Source-pointer resolution (in order):
      1. Native `imap_source` on the doc (post-iteration-58 tickets)
      2. Fallback: look up `imap_ingested` where `matched_id` or
         `matched_parent_id` matches this doc's `id` — this catches
         legacy tickets ingested BEFORE `imap_source` was added, and
         also multi-UID tickets that were merged by dedup logic.

    Returns a dict with `moved`, `method`, and (on fallback) `via`.
    """
    msg_id = (contact_msg or {}).get("id")
    src = (contact_msg or {}).get("imap_source") or {}
    mbox_id = src.get("mailbox_id")
    uids: list[str] = []
    if src.get("uid"):
        uids.append(str(src["uid"]))
    via = "imap_source"
    # ── Fallback: sweep all ingest rows that link to this message ───────
    # If the ticket was created before `imap_source` existed, or if it's
    # a merged thread with multiple UIDs, gather them ALL so the whole
    # conversation ends up in Trash — not just the last reply.
    if msg_id:
        cursor = db.imap_ingested.find({"$or": [
            {"matched_id": msg_id},
            {"matched_parent_id": msg_id},
        ]}, {"mailbox_id": 1, "uid": 1})
        async for row in cursor:
            row_mbox = row.get("mailbox_id")
            row_uid = row.get("uid")
            if not row_mbox or not row_uid:
                continue
            # Only support a single mailbox per delete — messages should
            # never straddle mailboxes in practice. If they do, we drop
            # the ones that don't match the primary mailbox.
            if not mbox_id:
                mbox_id = row_mbox
                via = "imap_ingested_fallback"
            if row_mbox != mbox_id:
                continue
            if str(row_uid) not in uids:
                uids.append(str(row_uid))
    if not mbox_id or not uids:
        return {"moved": 0, "method": "no_source"}
    mbox = await db.mailboxes.find_one({"id": mbox_id})
    if not mbox:
        return {"moved": 0, "method": "mailbox_missing"}
    pwd = dec_fn(mbox.get("password", ""))
    if not pwd:
        return {"moved": 0, "method": "no_password"}
    result = await asyncio.to_thread(
        _imap_move_uids_to_trash,
        mbox["host"], int(mbox.get("port") or 993), bool(mbox.get("use_ssl", True)),
        mbox["username"], pwd, mbox.get("folder") or "INBOX", uids,
    )
    result["via"] = via
    result["uids"] = uids
    return result


async def detect_server_side_deletions(db, mbox: dict, dec_fn, since_days: int = 60) -> dict:
    """For a single mailbox, compare `imap_ingested` UIDs against what's
    currently on the server. UIDs that vanished from INBOX get their
    linked contact_messages deleted (and the ingested row purged so a
    future re-sync doesn't resurrect the ticket).

    Returns {checked, deleted, mode}. `mode` = 'ok' when the server
    responded and we could safely compare, or 'skipped' on connection
    error (fail-safe — never mass-delete on a transient network blip).
    """
    pwd = dec_fn(mbox.get("password", ""))
    if not pwd:
        return {"checked": 0, "deleted": 0, "mode": "no_password"}
    current = await asyncio.to_thread(
        _imap_list_current_uids,
        mbox["host"], int(mbox.get("port") or 993), bool(mbox.get("use_ssl", True)),
        mbox["username"], pwd, mbox.get("folder") or "INBOX", since_days,
    )
    if current is None:
        return {"checked": 0, "deleted": 0, "mode": "skipped"}
    # Only consider ingested rows from the recent window — an old archive
    # doesn't need to be scanned every poll, and we don't want to purge
    # ancient tickets that pre-date the SINCE window on the server.
    cutoff = (datetime.now(timezone.utc) - timedelta(days=max(1, since_days))).isoformat()
    cursor = db.imap_ingested.find({
        "mailbox_id": mbox["id"],
        "ingested_at": {"$gte": cutoff},
    })
    checked = 0
    deleted_docs = 0
    async for row in cursor:
        checked += 1
        try:
            uid_int = int(row.get("uid"))
        except (TypeError, ValueError):
            continue
        if uid_int in current:
            continue  # still on server
        # UID vanished — mirror the deletion into the CMS.
        matched_id = row.get("matched_id") or row.get("matched_parent_id")
        if matched_id:
            await db.contact_messages.delete_one({"id": matched_id})
            await db.contact_message_replies.delete_many({"parent_id": matched_id})
        await db.imap_ingested.delete_one({"_id": row["_id"]})
        deleted_docs += 1
    return {"checked": checked, "deleted": deleted_docs, "mode": "ok"}


async def _sync_one_mailbox(db, mbox: dict, dec_fn) -> dict:
    """Sync a single mailbox. Returns counters {ingested, matched, skipped}."""
    counters = {"ingested": 0, "matched": 0, "skipped": 0}
    pwd = dec_fn(mbox.get("password", ""))
    if not pwd:
        counters["skipped"] += 1
        return counters
    # Use per-mailbox `last_uid` for incremental sync, or backfill on first
    # run. Backfill window is configurable per-mailbox (default 30 days).
    last_uid_raw = mbox.get("last_uid")
    try:
        last_uid = int(last_uid_raw) if last_uid_raw is not None else None
    except (TypeError, ValueError):
        last_uid = None
    backfill_days = int(mbox.get("backfill_days") or 30)
    try:
        messages, new_max_uid = await asyncio.to_thread(
            _fetch_new_messages,
            mbox["host"], int(mbox.get("port") or 993), bool(mbox.get("use_ssl", True)),
            mbox["username"], pwd, mbox.get("folder") or "INBOX",
            last_uid, backfill_days,
        )
    except Exception as e:
        logger.warning(f"IMAP fetch crashed for {mbox.get('email')}: {e}")
        return counters

    for m in messages:
        # Idempotency guard
        already = await db.imap_ingested.find_one({"mailbox_id": mbox["id"], "uid": m["uid"]})
        if already:
            continue
        subject_ref = None
        matched_kind = None
        matched_id = None
        matched_display = None
        ticket_match = TKT_RE.search(m.get("subject") or "")
        if ticket_match:
            subject_ref = ticket_match.group(1).upper()
        counters["ingested"] += 1
        record = {
            "mailbox_id": mbox["id"],
            "uid": m["uid"],
            "message_id": m["message_id"],
            "subject": m["subject"],
            "from_email": m["from_email"],
            "from_name": m["from_name"],
            "ticket_ref": subject_ref,
            "ingested_at": datetime.now(timezone.utc).isoformat(),
        }
        # ── Case A: subject carries #TKT-XXXX → append as client reply ─────
        if subject_ref:
            parent = await db.contact_messages.find_one({"ticket_ref": subject_ref})
            if parent:
                reply = {
                    "id": f"imap-{m['uid']}-{subject_ref}",
                    "parent_id": parent.get("id"),
                    "author": "client",
                    "author_name": m.get("from_name") or m.get("from_email"),
                    "author_email": m.get("from_email"),
                    "body": m.get("body") or "",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "source": "imap",
                    "message_id": m.get("message_id"),
                }
                await db.contact_message_replies.insert_one(reply)
                # Also attach the IMAP source to the parent doc so a CMS
                # delete moves this specific UID to Trash (nice-to-have —
                # replies within a thread don't get their own entry).
                update = {"last_reply_at": reply["created_at"], "status": "open"}
                if not parent.get("imap_source"):
                    update["imap_source"] = {
                        "mailbox_id": mbox["id"],
                        "uid": str(m["uid"]),
                        "message_id": m.get("message_id"),
                    }
                await db.contact_messages.update_one({"id": parent["id"]}, {"$set": update})
                record["matched_parent_id"] = parent.get("id")
                counters["matched"] += 1
        else:
            # ── Case B: outgoing PearBlue notification → fuzzy-match to source ──
            kind, name, coll = _classify_notification(m.get("subject") or "")
            if kind and coll:
                # Search by case-insensitive name in the correct collection,
                # preferring records created within a ±15 min window of the email.
                pattern = {"$regex": f"^{re.escape(name)}$", "$options": "i"}
                query = {"name": pattern}
                if kind == "review":
                    # For reviews we already know the rating; the notification
                    # sender is Resend so no ID leaks — we still search by name.
                    pass
                match = None
                try:
                    # Find most recent match by name — no time filter first
                    # because created_at might be stored as string or datetime.
                    matches = await db[coll].find(query).sort("created_at", -1).limit(3).to_list(3)
                    if matches:
                        match = matches[0]
                except Exception as e:
                    logger.warning(f"IMAP notification match query failed: {e}")
                if match:
                    matched_kind = kind
                    matched_id = match.get("id")
                    matched_display = match.get("name") or match.get("email") or ""
                    record["matched_kind"] = kind
                    record["matched_collection"] = coll
                    record["matched_id"] = matched_id
                    record["matched_display"] = matched_display
                    # If this notification refers to a contact_message that
                    # already has a ticket_ref, surface that on the ingest row
                    # so the CMS chip shows the ticket number instead of "Zonder ticket".
                    if kind in {"contact", "chat_handoff"} and match.get("ticket_ref"):
                        record["ticket_ref"] = match["ticket_ref"]
                        subject_ref = match["ticket_ref"]
                    counters["matched"] += 1
            # ── Case C: neither #TKT-XXXX nor a known PearBlue notification.
            #    If the mail is FROM an outside sender (not our own Resend
            #    outbound), auto-create a new contact_message ticket so the
            #    conversation appears in the Berichten tab. Otherwise mark it
            #    as an unmatched notification so admins see the audit trail.
            elif m.get("from_email") and not _is_own_notification_sender(m.get("from_email"), m.get("subject")):
                new_msg = await _create_ticket_from_email(db, m, mbox)
                if new_msg:
                    record["matched_kind"] = "contact_auto"
                    record["matched_collection"] = "contact_messages"
                    record["matched_id"] = new_msg["id"]
                    record["matched_display"] = new_msg.get("name") or new_msg.get("email")
                    record["ticket_ref"] = new_msg.get("ticket_ref")
                    subject_ref = new_msg.get("ticket_ref")
                    counters["matched"] += 1
                    counters["auto_ticket_created"] = counters.get("auto_ticket_created", 0) + 1
        # persist the (possibly updated) ticket_ref
        record["ticket_ref"] = subject_ref
        await db.imap_ingested.insert_one(record)

    update = {"last_sync": datetime.now(timezone.utc).isoformat(), "last_sync_counts": counters}
    if new_max_uid and new_max_uid > (last_uid or 0):
        update["last_uid"] = int(new_max_uid)
    await db.mailboxes.update_one({"id": mbox["id"]}, {"$set": update})

    # ── Server-side deletion mirror (2-way sync) ─────────────────────────
    # Refetch mbox because we just updated last_uid — the fresh copy has
    # the latest state for future logging.
    try:
        deletion_stats = await detect_server_side_deletions(db, mbox, dec_fn, since_days=int(mbox.get("backfill_days") or 30))
        counters["cms_deleted"] = deletion_stats.get("deleted", 0)
        counters["deletion_mode"] = deletion_stats.get("mode")
    except Exception as e:
        logger.warning(f"IMAP deletion-detection crashed for {mbox.get('email')}: {e}")
    return counters


async def sync_all(db, dec_fn) -> dict:
    """One-shot sync over every mailbox — also exposed via /api/admin/mailboxes/sync-now."""
    totals = {"mailboxes": 0, "ingested": 0, "matched": 0, "skipped": 0, "cms_deleted": 0}
    async for m in db.mailboxes.find({}):
        totals["mailboxes"] += 1
        counters = await _sync_one_mailbox(db, m, dec_fn)
        for k, v in counters.items():
            # Only aggregate numeric counters — the deletion_mode string is per-mailbox.
            if isinstance(v, (int, float)):
                totals[k] = totals.get(k, 0) + v
    return totals


async def start_background_poller(db, dec_fn):
    """Long-running task started at app startup. Skips work if no mailboxes."""
    logger.info(f"IMAP parser poller started (interval={POLL_SECONDS}s)")
    while True:
        try:
            has_mbox = await db.mailboxes.count_documents({}) > 0
            if has_mbox:
                totals = await sync_all(db, dec_fn)
                if totals.get("ingested") or totals.get("matched"):
                    logger.info(f"IMAP sync: {totals}")
        except Exception as e:
            logger.error(f"IMAP poller crashed: {e}")
        await asyncio.sleep(POLL_SECONDS)

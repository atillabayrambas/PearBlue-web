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
from datetime import datetime, timezone
from email.utils import parseaddr
from typing import Optional

logger = logging.getLogger(__name__)

# Keep hanging IMAP hosts from blocking the poller thread. 10s is plenty for a
# well-behaved provider and fails fast on typos or DNS misses.
_IMAP_SOCKET_TIMEOUT = int(os.environ.get("IMAP_SOCKET_TIMEOUT", "10"))
socket.setdefaulttimeout(_IMAP_SOCKET_TIMEOUT)

POLL_SECONDS = int(os.environ.get("IMAP_POLL_SECONDS", "60"))
TKT_RE = re.compile(r"#TKT-([A-Z0-9]{4,10})", re.IGNORECASE)


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


def _fetch_new_messages(host: str, port: int, use_ssl: bool, username: str, password: str, folder: str = "INBOX") -> list:
    """Blocking IMAP fetch — returns a list of dicts with parsed messages.
    Runs inside `asyncio.to_thread`."""
    imap_cls = imaplib.IMAP4_SSL if use_ssl else imaplib.IMAP4
    conn = imap_cls(host, port)
    try:
        conn.login(username, password)
        conn.select(folder)
        typ, data = conn.search(None, "UNSEEN")
        if typ != "OK":
            return []
        ids = data[0].split()
        results = []
        for msgid in ids[-200:]:  # cap per-poll load
            typ, msg_data = conn.fetch(msgid, "(RFC822 UID)")
            if typ != "OK" or not msg_data or msg_data[0] is None:
                continue
            # Extract UID from response envelope like: b'1 (UID 42 RFC822 {size}'
            raw = msg_data[0]
            envelope = raw[0].decode(errors="replace") if isinstance(raw, tuple) else ""
            uid_match = re.search(r"UID (\d+)", envelope)
            uid = uid_match.group(1) if uid_match else msgid.decode()
            payload = raw[1] if isinstance(raw, tuple) else b""
            msg = email.message_from_bytes(payload)
            subject = _decode_header(msg.get("Subject"))
            from_name, from_addr = parseaddr(_decode_header(msg.get("From")))
            body = _extract_body(msg)
            results.append({
                "uid": uid,
                "subject": subject,
                "from_name": from_name,
                "from_email": (from_addr or "").lower(),
                "body": body,
                "date": _decode_header(msg.get("Date")),
                "message_id": _decode_header(msg.get("Message-ID")),
            })
        try:
            conn.close()
        except Exception:
            pass
        conn.logout()
        return results
    except imaplib.IMAP4.error as e:
        logger.warning(f"IMAP {username}@{host} error: {e}")
        try:
            conn.logout()
        except Exception:
            pass
        return []


async def _sync_one_mailbox(db, mbox: dict, dec_fn) -> dict:
    """Sync a single mailbox. Returns counters {ingested, matched, skipped}."""
    counters = {"ingested": 0, "matched": 0, "skipped": 0}
    pwd = dec_fn(mbox.get("password", ""))
    if not pwd:
        counters["skipped"] += 1
        return counters
    try:
        messages = await asyncio.to_thread(
            _fetch_new_messages,
            mbox["host"], int(mbox.get("port") or 993), bool(mbox.get("use_ssl", True)),
            mbox["username"], pwd, mbox.get("folder") or "INBOX",
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
        if subject_ref:
            # Find the matching contact message by ticket_ref and append the body
            # as a client-side reply so it shows up in AdminMessageThread.
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
                await db.contact_messages.update_one(
                    {"id": parent["id"]},
                    {"$set": {"last_reply_at": reply["created_at"], "status": "open"}},
                )
                record["matched_parent_id"] = parent.get("id")
                counters["matched"] += 1
        await db.imap_ingested.insert_one(record)

    await db.mailboxes.update_one(
        {"id": mbox["id"]},
        {"$set": {"last_sync": datetime.now(timezone.utc).isoformat(), "last_sync_counts": counters}},
    )
    return counters


async def sync_all(db, dec_fn) -> dict:
    """One-shot sync over every mailbox — also exposed via /api/admin/mailboxes/sync-now."""
    totals = {"mailboxes": 0, "ingested": 0, "matched": 0, "skipped": 0}
    async for m in db.mailboxes.find({}):
        totals["mailboxes"] += 1
        counters = await _sync_one_mailbox(db, m, dec_fn)
        for k, v in counters.items():
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

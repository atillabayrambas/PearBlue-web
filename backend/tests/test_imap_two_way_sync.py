"""Regression suite for 2-way IMAP ↔ CMS sync (v0.9.0-Beta).

Covers:
* CMS delete → IMAP MOVE to Trash (with COPY+EXPUNGE fallback)
* IMAP delete → CMS `contact_messages` + `imap_ingested` cleanup
* Fail-safe: transient IMAP errors do NOT trigger mass-deletion
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from unittest.mock import MagicMock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import imap_parser  # noqa: E402


class _StubCollection:
    """Async Mongo-like collection stub with just enough surface for the
    2-way sync helpers to run against."""
    def __init__(self, docs=None):
        self._docs = list(docs or [])

    async def find_one(self, query, projection=None):  # noqa: ARG002
        for d in self._docs:
            if all(d.get(k) == v for k, v in query.items()):
                return d
        return None

    async def delete_one(self, query):
        for i, d in enumerate(self._docs):
            if all(d.get(k) == v for k, v in query.items()):
                self._docs.pop(i)
                return MagicMock(deleted_count=1)
        return MagicMock(deleted_count=0)

    async def delete_many(self, query):
        keep = []
        deleted = 0
        for d in self._docs:
            match = False
            if "$or" in query:
                for cond in query["$or"]:
                    if all(d.get(k) == v for k, v in cond.items()):
                        match = True
                        break
            else:
                match = all(
                    (d.get(k) in v.get("$in", []) if isinstance(v, dict) and "$in" in v else d.get(k) == v)
                    for k, v in query.items()
                )
            if match:
                deleted += 1
            else:
                keep.append(d)
        self._docs[:] = keep
        return MagicMock(deleted_count=deleted)

    def find(self, query=None, projection=None):  # noqa: ARG002
        parent = self

        def _match(d, q):
            if not q:
                return True
            if "$or" in q:
                return any(_match(d, cond) for cond in q["$or"])
            for k, v in q.items():
                if isinstance(v, dict):
                    # Very small operator handler — enough for the parser's queries.
                    if "$gte" in v and not (d.get(k) is not None and d.get(k) >= v["$gte"]):
                        return False
                    if "$in" in v and d.get(k) not in v["$in"]:
                        return False
                    if "$exists" in v and (bool(k in d) != bool(v["$exists"])):
                        return False
                elif d.get(k) != v:
                    return False
            return True

        filtered = [d for d in parent._docs if _match(d, query or {})]

        class _Cursor:
            def __aiter__(self):
                self._i = 0
                return self

            async def __anext__(self):
                if self._i >= len(filtered):
                    raise StopAsyncIteration
                d = filtered[self._i]
                self._i += 1
                return d
        return _Cursor()


class _StubDB:
    def __init__(self, imap_ingested=None, contact_messages=None, mailboxes=None, replies=None):
        self.imap_ingested = _StubCollection(imap_ingested)
        self.contact_messages = _StubCollection(contact_messages)
        self.contact_message_replies = _StubCollection(replies)
        self.mailboxes = _StubCollection(mailboxes)


# ---------------------------------------------------------------------------
# CMS delete → IMAP MOVE to Trash
# ---------------------------------------------------------------------------
def test_move_to_trash_uses_move_extension_when_available():
    """A server that supports RFC 6851 MOVE should get a single UID MOVE
    call — no COPY/EXPUNGE fallback."""
    conn = MagicMock()
    conn.login.return_value = ("OK", [b""])
    # `_find_trash_folder` probes SELECT — first "Trash" accepts.
    conn.select.side_effect = lambda name: ("OK", [b"1"])
    conn.uid.return_value = ("OK", [b""])
    conn.expunge.return_value = ("OK", [b""])

    imap_parser.imaplib.IMAP4_SSL = MagicMock(return_value=conn)
    result = imap_parser._imap_move_uids_to_trash(
        "imap.example.com", 993, True, "u", "p", "INBOX", ["12", "15"],
    )
    assert result["moved"] == 2
    assert result["method"] == "move"
    assert result["trash_folder"] == "Trash"
    # Only ONE uid call should have been MOVE (no COPY fallback).
    move_calls = [c for c in conn.uid.call_args_list if c.args[0].upper() == "MOVE"]
    assert len(move_calls) == 1


def test_move_to_trash_falls_back_to_copy_expunge():
    """Servers without MOVE (older Dovecot) must fall back to
    COPY + STORE \\Deleted + EXPUNGE."""
    conn = MagicMock()
    conn.login.return_value = ("OK", [b""])
    conn.select.side_effect = lambda name: ("OK", [b"1"])

    call_log = []

    def uid_side_effect(cmd, *args):
        call_log.append(cmd.upper())
        if cmd.upper() == "MOVE":
            raise imap_parser.imaplib.IMAP4.error("MOVE not supported")
        return ("OK", [b""])
    conn.uid.side_effect = uid_side_effect
    conn.expunge.return_value = ("OK", [b""])

    imap_parser.imaplib.IMAP4_SSL = MagicMock(return_value=conn)
    result = imap_parser._imap_move_uids_to_trash(
        "imap.example.com", 993, True, "u", "p", "INBOX", ["42"],
    )
    assert result["method"] == "copy_expunge"
    assert result["moved"] == 1
    assert "COPY" in call_log
    assert "STORE" in call_log
    conn.expunge.assert_called()


def test_move_to_trash_gracefully_handles_missing_trash_folder():
    """When no candidate Trash folder is selectable, the helper returns
    a clear no_trash status and does NOT delete anything on the server."""
    conn = MagicMock()
    conn.login.return_value = ("OK", [b""])
    conn.select.return_value = ("NO", [b"No such folder"])

    imap_parser.imaplib.IMAP4_SSL = MagicMock(return_value=conn)
    result = imap_parser._imap_move_uids_to_trash(
        "imap.example.com", 993, True, "u", "p", "INBOX", ["12"],
    )
    assert result["moved"] == 0
    assert result["method"] == "no_trash"
    conn.uid.assert_not_called()


# ---------------------------------------------------------------------------
# IMAP delete → CMS delete
# ---------------------------------------------------------------------------
def test_deletion_detection_purges_missing_uids(monkeypatch):
    """UIDs present in `imap_ingested` but no longer on the server must
    trigger deletion of the linked contact_messages doc AND the ingest row."""
    mbox = {
        "id": "mbox-1", "email": "info@example.com",
        "host": "imap.example.com", "port": 993, "use_ssl": True,
        "username": "u", "password": "encrypted-blob",
        "folder": "INBOX", "backfill_days": 30,
    }
    ingested = [
        {"_id": 1, "mailbox_id": "mbox-1", "uid": "10", "matched_id": "msg-a", "ingested_at": "2099-01-01T00:00:00+00:00"},
        {"_id": 2, "mailbox_id": "mbox-1", "uid": "11", "matched_id": "msg-b", "ingested_at": "2099-01-01T00:00:00+00:00"},
    ]
    contacts = [{"id": "msg-a"}, {"id": "msg-b"}]
    db = _StubDB(imap_ingested=list(ingested), contact_messages=list(contacts))

    # Server still has UID 10 but UID 11 was deleted by the user.
    monkeypatch.setattr(imap_parser, "_imap_list_current_uids",
                        lambda *a, **kw: {10})

    stats = asyncio.run(imap_parser.detect_server_side_deletions(db, mbox, lambda s: "decrypted"))
    assert stats["mode"] == "ok"
    assert stats["deleted"] == 1
    # msg-b (linked to UID 11) must be gone; msg-a survives.
    remaining_ids = [d["id"] for d in db.contact_messages._docs]
    assert remaining_ids == ["msg-a"]
    # And the corresponding ingest row is purged so a future re-sync
    # doesn't resurrect the ticket.
    remaining_uids = [r["uid"] for r in db.imap_ingested._docs]
    assert remaining_uids == ["10"]


def test_deletion_detection_is_failsafe_on_connection_error(monkeypatch):
    """If listing current UIDs returns None (network/IMAP error), the
    function MUST NOT delete anything — otherwise a transient blip would
    wipe the whole CMS Berichten tab."""
    mbox = {
        "id": "mbox-1", "host": "imap.example.com", "port": 993, "use_ssl": True,
        "username": "u", "password": "blob", "folder": "INBOX", "backfill_days": 30,
    }
    ingested = [{"_id": 1, "mailbox_id": "mbox-1", "uid": "10", "matched_id": "msg-a", "ingested_at": "2099-01-01T00:00:00+00:00"}]
    contacts = [{"id": "msg-a"}]
    db = _StubDB(imap_ingested=list(ingested), contact_messages=list(contacts))

    monkeypatch.setattr(imap_parser, "_imap_list_current_uids",
                        lambda *a, **kw: None)  # simulate connection error

    stats = asyncio.run(imap_parser.detect_server_side_deletions(db, mbox, lambda s: "decrypted"))
    assert stats["mode"] == "skipped"
    assert stats["deleted"] == 0
    # Nothing was deleted — fail-safe held.
    assert len(db.contact_messages._docs) == 1
    assert len(db.imap_ingested._docs) == 1


def test_move_contact_message_no_imap_source_returns_noop():
    """Documents without an `imap_source` pointer AND no imap_ingested
    breadcrumb (created via the contact form, not from IMAP) must not
    attempt any IMAP call."""
    db = _StubDB(mailboxes=[])
    result = asyncio.run(imap_parser.move_contact_message_to_imap_trash(
        db, {"id": "msg-a"}, lambda s: "decrypted"
    ))
    assert result == {"moved": 0, "method": "no_source"}


def test_move_contact_message_fallback_via_imap_ingested(monkeypatch):
    """Legacy tickets (pre-iteration-58) lack `imap_source` on the doc.
    The fallback must find their UIDs via the `imap_ingested` breadcrumbs
    so CMS delete still moves the mail to Trash. This is what the user
    was hitting on production."""
    ingested = [
        {"_id": 1, "mailbox_id": "mbox-1", "uid": "20", "matched_id": "msg-legacy"},
        {"_id": 2, "mailbox_id": "mbox-1", "uid": "21", "matched_parent_id": "msg-legacy"},
        # Unrelated row — must NOT be picked up
        {"_id": 3, "mailbox_id": "mbox-1", "uid": "99", "matched_id": "other-msg"},
    ]
    mailboxes = [{
        "id": "mbox-1", "host": "imap.example.com", "port": 993, "use_ssl": True,
        "username": "u", "password": "encrypted-blob", "folder": "INBOX",
    }]
    db = _StubDB(imap_ingested=ingested, mailboxes=mailboxes)

    captured = {}

    async def fake_thread(fn, *args, **kwargs):  # noqa: ARG001
        # args: host, port, use_ssl, username, password, folder, uids
        captured["uids"] = list(args[6])
        return {"moved": len(args[6]), "method": "move", "trash_folder": "Trash"}

    monkeypatch.setattr(imap_parser.asyncio, "to_thread", fake_thread)

    legacy_doc = {"id": "msg-legacy"}  # NO imap_source on the doc
    result = asyncio.run(imap_parser.move_contact_message_to_imap_trash(
        db, legacy_doc, lambda s: "decrypted"
    ))
    assert result["moved"] == 2
    assert result["via"] == "imap_ingested_fallback"
    assert sorted(captured["uids"]) == ["20", "21"]
    # Unrelated UID 99 must not have been included.
    assert "99" not in captured["uids"]

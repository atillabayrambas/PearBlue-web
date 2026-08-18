"""Regression suite for the IMAP parser UID-based sync (v0.8.8-Beta).

Guards against the bug where the parser used `SEARCH UNSEEN` and therefore
skipped every already-read mail in an inbox — which was almost every mail
the customer actually needed to be imported. The parser now uses UID-based
incremental sync with a first-run backfill window.
"""
from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import imap_parser  # noqa: E402


def _fake_imap_conn(uids: list[int], subjects: dict[int, bytes]):
    """Return a MagicMock behaving like an `imaplib.IMAP4_SSL` connection.
    `uids` is what SEARCH returns; `subjects` maps UID → raw RFC-822 bytes."""
    conn = MagicMock()
    conn.login.return_value = ("OK", [b""])
    conn.select.return_value = ("OK", [b"1"])

    def uid(cmd, *args):
        if cmd == "search":
            joined = " ".join(str(a) for a in args if a)
            # Very small query parser: honour `UID N:*` filter and `SINCE …`.
            if "UID " in joined:
                # e.g. "None UID 6:*"
                lower = joined.split("UID", 1)[1].strip()
                lo = int(lower.split(":", 1)[0])
                filtered = [u for u in uids if u >= lo]
            else:
                filtered = list(uids)
            return ("OK", [b" ".join(str(u).encode() for u in filtered)])
        if cmd == "fetch":
            uid_int = int(args[0])
            payload = subjects.get(uid_int, b"")
            return ("OK", [(f"1 (UID {uid_int} RFC822".encode(), payload)])
        return ("BAD", [b""])

    conn.uid.side_effect = uid
    conn.close.return_value = ("OK", [b""])
    conn.logout.return_value = ("OK", [b""])
    return conn


def _mail_bytes(subject: str, from_addr: str = "user@example.com", body: str = "hi") -> bytes:
    return (
        f"From: {from_addr}\r\n"
        f"To: info@pearblue.nl\r\n"
        f"Subject: {subject}\r\n"
        f"Message-ID: <{subject.replace(' ', '')}@example.com>\r\n"
        f"MIME-Version: 1.0\r\n"
        f"Content-Type: text/plain; charset=utf-8\r\n\r\n"
        f"{body}\r\n"
    ).encode()


def test_first_run_backfills_all_regardless_of_seen(monkeypatch):
    """First sync (no last_uid) must fetch every UID in the backfill window
    — including \\Seen (already read) messages, which was the reported bug."""
    uids = [10, 11, 12]
    payload = {u: _mail_bytes(f"Mail {u}") for u in uids}
    conn = _fake_imap_conn(uids, payload)

    monkeypatch.setattr(imap_parser.imaplib, "IMAP4_SSL", MagicMock(return_value=conn))
    messages, max_uid = imap_parser._fetch_new_messages(
        "imap.example.com", 993, True, "u", "p", "INBOX",
        last_uid=None, backfill_days=30,
    )
    assert [m["uid"] for m in messages] == ["10", "11", "12"]
    assert max_uid == 12
    # Verify the SEARCH was a SINCE-style query, NOT the old UNSEEN one.
    search_calls = [c for c in conn.uid.call_args_list if c.args[0] == "search"]
    assert search_calls, "expected UID SEARCH to be issued"
    joined = " ".join(str(a) for c in search_calls for a in c.args)
    assert "SINCE" in joined
    assert "UNSEEN" not in joined  # regression: must never fall back to UNSEEN


def test_incremental_uses_uid_greater_than_last(monkeypatch):
    """Subsequent syncs must ask for `UID {last+1}:*` and skip everything
    already ingested — independent of \\Seen flags."""
    uids = [10, 11, 12, 13]
    payload = {u: _mail_bytes(f"Mail {u}") for u in uids}
    conn = _fake_imap_conn(uids, payload)

    monkeypatch.setattr(imap_parser.imaplib, "IMAP4_SSL", MagicMock(return_value=conn))
    messages, max_uid = imap_parser._fetch_new_messages(
        "imap.example.com", 993, True, "u", "p", "INBOX",
        last_uid=11, backfill_days=30,
    )
    # Only UIDs strictly newer than 11 should be returned.
    assert [m["uid"] for m in messages] == ["12", "13"]
    assert max_uid == 13
    search_calls = [c for c in conn.uid.call_args_list if c.args[0] == "search"]
    joined = " ".join(str(a) for c in search_calls for a in c.args)
    assert "UID 12:*" in joined
    assert "SINCE" not in joined  # incremental path must not fall back to date search


def test_no_messages_returns_previous_max_uid(monkeypatch):
    """When SEARCH returns no UIDs, the caller should keep the previous
    `last_uid` so we don't reset the cursor on empty polls."""
    conn = _fake_imap_conn([], {})
    monkeypatch.setattr(imap_parser.imaplib, "IMAP4_SSL", MagicMock(return_value=conn))
    messages, max_uid = imap_parser._fetch_new_messages(
        "imap.example.com", 993, True, "u", "p", "INBOX",
        last_uid=42, backfill_days=30,
    )
    assert messages == []
    assert max_uid == 42


def test_subject_and_from_parsing_survives_backfill(monkeypatch):
    """The parsed message envelope must still expose subject/from correctly
    when fetched via the new UID path (regression on the RFC-822 envelope
    tuple change)."""
    uids = [50]
    payload = {50: _mail_bytes("[#TKT-ABC123] Hello there", from_addr="john@example.com", body="body-text")}
    conn = _fake_imap_conn(uids, payload)

    monkeypatch.setattr(imap_parser.imaplib, "IMAP4_SSL", MagicMock(return_value=conn))
    messages, _ = imap_parser._fetch_new_messages(
        "imap.example.com", 993, True, "u", "p", "INBOX",
        last_uid=None, backfill_days=30,
    )
    assert len(messages) == 1
    m = messages[0]
    assert m["subject"] == "[#TKT-ABC123] Hello there"
    assert m["from_email"] == "john@example.com"
    assert "body-text" in m["body"]

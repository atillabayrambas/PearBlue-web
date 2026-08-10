import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowLeft, Loader2, AlertCircle, Send, MessageCircle, Paperclip, XCircle,
  Download, Trash2, Lock,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { Avatar } from "../components/Avatar";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const MSG_STATUS = [
  { key: "new", label: "Nieuw", color: "bg-pear-100 text-pear-700" },
  { key: "in_progress", label: "In behandeling", color: "bg-amber-100 text-amber-700" },
  { key: "on_hold", label: "Hold", color: "bg-slate-100 text-slate-700" },
  { key: "done", label: "Afgerond", color: "bg-emerald-100 text-emerald-700" },
  { key: "archived", label: "Gearchiveerd", color: "bg-slate-100 text-slate-500" },
];
const MSG_PRIORITY = [
  { key: "Major", label: "Major", color: "bg-red-200 text-red-900" },
  { key: "P1", label: "P1", color: "bg-red-100 text-red-700" },
  { key: "P2", label: "P2", color: "bg-amber-100 text-amber-700" },
  { key: "P3", label: "P3", color: "bg-slate-100 text-slate-700" },
  { key: "P4", label: "P4", color: "bg-slate-50 text-slate-500" },
];

const fmt = (iso) => {
  try { return new Date(iso).toLocaleString("nl-NL"); } catch { return iso || ""; }
};

export default function AdminMessageThread() {
  const { msgId } = useParams();
  const { authHeader, user } = useAuth();
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reply, setReply] = useState("");
  const [subject, setSubject] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [sending, setSending] = useState(false);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [note, setNote] = useState("");
  const fileInput = useRef(null);

  const load = () => {
    setLoading(true);
    axios.get(`${API}/admin/contact/${msgId}`, { headers: authHeader() })
      .then((r) => {
        setMsg(r.data);
        setSubject(`Re: ${r.data?.subject || "PearBlue"}`);
        setError(null);
      })
      .catch((e) => setError(e?.response?.data?.detail || e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [msgId]);

  const patch = async (upd) => {
    try {
      await axios.patch(`${API}/admin/contact/${msgId}`, upd, { headers: authHeader() });
      load();
    } catch { toast.error("Update mislukt"); }
  };

  const sendReply = async () => {
    if (!reply.trim()) { toast.error("Typ eerst je antwoord."); return; }
    setSending(true);
    try {
      await axios.post(
        `${API}/admin/contact/${msgId}/reply`,
        { body: reply.trim(), subject: subject.trim() || undefined, send_email: sendEmail },
        { headers: authHeader() },
      );
      if (files.length) {
        setUploading(true);
        for (const f of files) {
          const fd = new FormData();
          fd.append("file", f);
          try {
            await axios.post(`${API}/admin/contact/${msgId}/attachments`, fd, {
              headers: { ...authHeader(), "Content-Type": "multipart/form-data" },
            });
          } catch {
            toast.error(`Upload mislukt: ${f.name}`);
          }
        }
        setUploading(false);
      }
      toast.success(sendEmail ? "Antwoord verstuurd naar klant" : "Antwoord opgeslagen");
      setReply("");
      setFiles([]);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Versturen mislukt");
    } finally { setSending(false); }
  };

  const addNote = async () => {
    if (!note.trim()) return;
    try {
      await axios.post(`${API}/admin/contact/${msgId}/notes`, { text: note.trim() }, { headers: authHeader() });
      toast.success("Notitie toegevoegd");
      setNote("");
      load();
    } catch { toast.error("Notitie mislukt"); }
  };

  const removeAttachment = async (aid) => {
    if (!window.confirm("Bijlage verwijderen?")) return;
    try {
      await axios.delete(`${API}/admin/contact/${msgId}/attachments/${aid}`, { headers: authHeader() });
      load();
    } catch { toast.error("Verwijderen mislukt"); }
  };

  const downloadAttachment = async (aid, name) => {
    try {
      const r = await axios.get(`${API}/admin/contact/${msgId}/attachments/${aid}`, {
        headers: authHeader(),
        responseType: "blob",
      });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement("a");
      a.href = url; a.download = name || "file"; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch { toast.error("Download mislukt"); }
  };

  const isDone = msg?.status === "done";
  const canOverride = user?.role === "super_admin" || user?.role === "admin";
  const locked = isDone && !canOverride;

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-fg text-sm" data-testid="msg-thread-loading">
        <Loader2 className="h-4 w-4 animate-spin" /> Bericht laden…
      </div>
    );
  }
  if (error || !msg) {
    return (
      <div className="surface border border-app rounded-3xl p-8 text-center" data-testid="msg-thread-error">
        <AlertCircle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
        <p className="font-heading text-lg text-strong">Kon bericht niet openen</p>
        <p className="text-sm text-muted-fg mt-1">{typeof error === "string" ? error : "—"}</p>
        <Link to="/admin/messages" className="inline-block mt-4 text-sm text-pear-500 hover:underline">← Terug naar Berichten</Link>
      </div>
    );
  }

  const st = MSG_STATUS.find((s) => s.key === (msg.status || "new")) || MSG_STATUS[0];
  const pr = MSG_PRIORITY.find((p) => p.key === (msg.priority || "P3")) || MSG_PRIORITY[3];

  // Build unified timeline: original + replies + notes
  const timeline = [
    { kind: "original", at: msg.created_at, body: msg.message, author: msg.name, email: msg.email, subject: msg.subject },
    ...((msg.replies || []).map((r) => ({ kind: "reply", ...r }))),
    ...((msg.notes || []).map((n) => ({ kind: "note", ...n }))),
  ].sort((a, b) => (a.at || "").localeCompare(b.at || ""));

  return (
    <div data-testid="cms-message-thread">
      <Link to="/admin/messages" className="inline-flex items-center gap-1 text-sm text-muted-fg hover:text-pear-500 mb-6" data-testid="msg-thread-back">
        <ArrowLeft className="h-4 w-4" /> Terug naar Berichten
      </Link>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <header className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div className="min-w-0 flex items-start gap-3">
            <Avatar name={msg.name} email={msg.email} size={44} />
            <div className="min-w-0">
              <p className="overline mb-1">#{(msg.id || "").slice(0, 8)}</p>
              <h1 className="font-heading text-2xl sm:text-3xl font-medium text-strong break-words" data-testid="msg-thread-subject">
                {msg.subject || "(geen onderwerp)"}
              </h1>
              <p className="text-xs text-muted-fg mt-1">
                <strong>{msg.name}</strong> · {msg.email}
                {msg.phone && <> · {msg.phone}</>}
                {msg.company && <> · {msg.company}</>}
                <br />{fmt(msg.created_at)}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <span className={`text-[10px] uppercase tracking-widest rounded-full px-3 py-1 font-bold ${pr.color}`} data-testid="msg-thread-priority">{pr.label}</span>
            <span className={`text-[10px] uppercase tracking-widest rounded-full px-3 py-1 font-bold ${st.color}`} data-testid="msg-thread-status">{st.label}</span>
            {locked && <span className="text-[10px] uppercase tracking-widest bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5 inline-flex items-center gap-1" data-testid="msg-thread-locked"><Lock className="h-3 w-3" /> Vergrendeld</span>}
          </div>
        </header>

        {/* Meta actions */}
        <div className="surface border border-app rounded-2xl p-4 mb-6 flex flex-wrap items-center gap-2 text-xs" data-testid="msg-thread-actions">
          <label className="text-muted-fg">Status:</label>
          <select
            value={msg.status || "new"}
            onChange={(e) => patch({ status: e.target.value })}
            disabled={locked}
            className="rounded-lg border border-app surface px-2 py-1 disabled:opacity-50"
            data-testid="msg-thread-status-select"
          >
            {MSG_STATUS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <label className="text-muted-fg ml-2">Prioriteit:</label>
          <select
            value={msg.priority || "P3"}
            onChange={(e) => patch({ priority: e.target.value })}
            disabled={locked}
            className="rounded-lg border border-app surface px-2 py-1 disabled:opacity-50"
            data-testid="msg-thread-priority-select"
          >
            {MSG_PRIORITY.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
          {!msg.spam ? (
            <button onClick={() => patch({ spam: true })} disabled={locked} className="rounded-full px-3 py-1 border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-40" data-testid="msg-thread-mark-spam">Markeer als spam</button>
          ) : (
            <button onClick={() => patch({ spam: false })} className="rounded-full px-3 py-1 border border-emerald-200 text-emerald-600 hover:bg-emerald-50" data-testid="msg-thread-unmark-spam">Geen spam</button>
          )}
          <a href={`mailto:${msg.email}?subject=Re: ${encodeURIComponent(msg.subject || 'PearBlue')}`} className="rounded-full px-3 py-1 border border-pear-500 text-pear-500 hover:bg-pear-50" data-testid="msg-thread-mailto">Open in mail-client</a>
        </div>

        {/* Conversation timeline */}
        <div className="mb-6" data-testid="msg-thread-timeline">
          <div className="flex items-center gap-2 mb-3">
            <MessageCircle className="h-4 w-4 text-pear-500" />
            <h3 className="font-heading font-semibold text-strong">Gesprek</h3>
            <span className="text-xs text-muted-fg">({timeline.length})</span>
          </div>
          <ol className="space-y-3">
            {timeline.map((t, i) => {
              if (t.kind === "note") {
                return (
                  <li key={t.id || i} className="rounded-2xl p-4 border border-amber-200 bg-amber-50/60 dark:bg-amber-500/5" data-testid={`msg-thread-item-note-${i}`}>
                    <div className="flex items-center gap-2 mb-2 text-[11px] uppercase tracking-widest text-amber-700">
                      📌 Interne notitie · {t.by} · {fmt(t.at)}
                    </div>
                    <div className="text-sm whitespace-pre-wrap text-strong/90">{t.text}</div>
                  </li>
                );
              }
              const isOut = t.kind === "reply"; // admin → client
              return (
                <li
                  key={t.id || i}
                  className={`rounded-2xl p-4 border ${isOut ? "bg-pear-500/5 border-pear-200" : "surface-2 border-transparent"}`}
                  data-testid={`msg-thread-item-${t.kind}-${i}`}
                >
                  <div className="flex items-center gap-2 mb-2 text-xs">
                    <span className="font-semibold text-strong">{isOut ? `PearBlue (${t.author})` : t.author || msg.name}</span>
                    <span className="text-muted-fg">· {fmt(t.at)}</span>
                    {isOut && (t.email_sent ? (
                      <span className="text-[10px] uppercase rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5">✉ verstuurd</span>
                    ) : (
                      <span className="text-[10px] uppercase rounded-full bg-slate-100 text-slate-600 px-2 py-0.5">enkel opgeslagen</span>
                    ))}
                    {t.subject && isOut && <span className="text-muted-fg">· {t.subject}</span>}
                  </div>
                  <div className="text-sm text-strong/90 whitespace-pre-wrap leading-relaxed">{t.body}</div>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Attachments */}
        {(msg.attachments || []).length > 0 && (
          <div className="mb-6" data-testid="msg-thread-attachments">
            <div className="flex items-center gap-2 mb-2">
              <Paperclip className="h-4 w-4 text-pear-500" />
              <h3 className="font-heading font-semibold text-strong">Bijlagen</h3>
              <span className="text-xs text-muted-fg">({msg.attachments.length})</span>
            </div>
            <ul className="flex flex-wrap gap-2">
              {msg.attachments.map((a) => (
                <li key={a.id} className="inline-flex items-center gap-2 rounded-full surface-2 border border-app px-3 py-1.5 text-xs" data-testid={`msg-thread-attachment-${a.id}`}>
                  <button type="button" onClick={() => downloadAttachment(a.id, a.name)} className="inline-flex items-center gap-1 hover:text-pear-500" data-testid={`msg-thread-attachment-download-${a.id}`}>
                    <Download className="h-3.5 w-3.5" /> {a.name} · {(a.size / 1024).toFixed(0)} kB
                  </button>
                  <button type="button" onClick={() => removeAttachment(a.id)} className="hover:text-red-500" aria-label="Verwijder bijlage" data-testid={`msg-thread-attachment-remove-${a.id}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Reply panel */}
        <div className="surface border border-app rounded-2xl p-5 mb-6" data-testid="msg-thread-reply-panel">
          <h3 className="font-heading font-semibold text-strong mb-3">Antwoord versturen</h3>
          <label className="text-xs uppercase tracking-widest text-muted-fg block mb-1">Onderwerp</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={locked}
            className="w-full rounded-xl surface-2 border border-transparent focus:border-pear-500 px-4 py-2 text-sm outline-none text-strong mb-3 disabled:opacity-50"
            data-testid="msg-thread-subject-input"
          />
          <label className="text-xs uppercase tracking-widest text-muted-fg block mb-1">Bericht</label>
          <textarea
            rows={6}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            disabled={locked}
            placeholder="Typ hier je antwoord aan de klant…"
            className="w-full rounded-xl surface-2 border border-transparent focus:border-pear-500 px-4 py-3 text-sm outline-none resize-y text-strong disabled:opacity-50"
            data-testid="msg-thread-reply-input"
          />

          <div className="flex flex-wrap items-center gap-2 mt-3" data-testid="msg-thread-file-picker">
            <label className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-full surface-2 border border-app px-3 py-1.5 cursor-pointer hover:border-pear-500">
              <Paperclip className="h-3.5 w-3.5" />
              Bijlage toevoegen
              <input
                ref={fileInput}
                type="file"
                multiple
                hidden
                disabled={locked}
                data-testid="msg-thread-file-input"
                onChange={(e) => {
                  const list = Array.from(e.target.files || []);
                  const valid = list.filter((f) => f.size < 20 * 1024 * 1024);
                  if (valid.length < list.length) toast.error("Sommige bestanden zijn groter dan 20 MB en overgeslagen");
                  setFiles((p) => [...p, ...valid]);
                  e.target.value = "";
                }}
              />
            </label>
            {files.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-xs rounded-full bg-pear-100 text-pear-700 px-2.5 py-1" data-testid={`msg-thread-file-chip-${i}`}>
                {f.name} · {(f.size / 1024).toFixed(0)}kB
                <button type="button" onClick={() => setFiles((p) => p.filter((_, idx) => idx !== i))} className="hover:text-red-500" data-testid={`msg-thread-file-remove-${i}`}>
                  <XCircle className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
            <label className="inline-flex items-center gap-2 text-xs text-muted-fg cursor-pointer" data-testid="msg-thread-send-email-toggle">
              <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} className="accent-pear-500 h-4 w-4" />
              E-mail naar {msg.email} sturen
            </label>
            <button
              onClick={sendReply}
              disabled={sending || locked || !reply.trim()}
              className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
              data-testid="msg-thread-send"
            >
              <Send className="h-4 w-4" /> {uploading ? "Uploaden…" : sending ? "Versturen…" : sendEmail ? "Verstuur antwoord" : "Sla op"}
            </button>
          </div>
        </div>

        {/* Internal note */}
        <div className="surface border border-app rounded-2xl p-5" data-testid="msg-thread-note-panel">
          <h3 className="font-heading font-semibold text-strong mb-3">Interne notitie</h3>
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Alleen zichtbaar voor het CMS-team…"
            className="w-full rounded-xl surface-2 border border-transparent focus:border-pear-500 px-4 py-3 text-sm outline-none resize-y text-strong"
            data-testid="msg-thread-note-input"
          />
          <div className="flex justify-end mt-3">
            <button
              onClick={addNote}
              disabled={!note.trim()}
              className="text-xs rounded-full px-4 py-1.5 border border-app hover:border-pear-500 disabled:opacity-40"
              data-testid="msg-thread-note-submit"
            >
              Notitie toevoegen
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

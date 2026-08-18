import React, { useEffect, useRef, useState, useCallback } from "react";
import axios from "axios";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowLeft, Loader2, AlertCircle, Send, MessageCircle, Paperclip, XCircle,
  Download, Trash2, Lock, FileText, Image as ImageIcon, Plus, Edit2, ChevronDown,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useLang } from "../i18n/LanguageContext";
import { Avatar } from "../components/Avatar";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const MSG_STATUS_NL = [
  { key: "new", label: "Nieuw", color: "bg-pear-100 text-pear-700" },
  { key: "in_progress", label: "In behandeling", color: "bg-amber-100 text-amber-700" },
  { key: "on_hold", label: "Hold", color: "bg-slate-100 text-slate-700" },
  { key: "done", label: "Afgerond", color: "bg-emerald-100 text-emerald-700" },
  { key: "archived", label: "Gearchiveerd", color: "bg-slate-100 text-slate-500" },
];
const MSG_STATUS_EN = [
  { key: "new", label: "New", color: "bg-pear-100 text-pear-700" },
  { key: "in_progress", label: "In progress", color: "bg-amber-100 text-amber-700" },
  { key: "on_hold", label: "On hold", color: "bg-slate-100 text-slate-700" },
  { key: "done", label: "Done", color: "bg-emerald-100 text-emerald-700" },
  { key: "archived", label: "Archived", color: "bg-slate-100 text-slate-500" },
];
const MSG_PRIORITY = [
  { key: "Major", label: "Major", color: "bg-red-200 text-red-900" },
  { key: "P1", label: "P1", color: "bg-red-100 text-red-700" },
  { key: "P2", label: "P2", color: "bg-amber-100 text-amber-700" },
  { key: "P3", label: "P3", color: "bg-slate-100 text-slate-700" },
  { key: "P4", label: "P4", color: "bg-slate-50 text-slate-500" },
];

const fmt = (iso, en = false) => {
  try { return new Date(iso).toLocaleString(en ? "en-US" : "nl-NL"); } catch { return iso || ""; }
};

export default function AdminMessageThread() {
  const { msgId } = useParams();
  const { authHeader, user } = useAuth();
  const { lang } = useLang();
  const en = lang === "en";
  const MSG_STATUS = en ? MSG_STATUS_EN : MSG_STATUS_NL;
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

  // Reply templates state
  const [templates, setTemplates] = useState([]);
  const [showTplMgr, setShowTplMgr] = useState(false);
  const [previewAtt, setPreviewAtt] = useState(null); // { att, url, mime }

  const loadTemplates = useCallback(() => {
    axios.get(`${API}/admin/reply-templates`, { headers: authHeader() })
      .then((r) => setTemplates(r.data || []))
      .catch(() => setTemplates([]));
  }, [authHeader]);
  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const load = useCallback(() => {
    setLoading(true);
    axios.get(`${API}/admin/contact/${msgId}`, { headers: authHeader() })
      .then((r) => {
        setMsg(r.data);
        setSubject(`Re: ${r.data?.subject || "PearBlue"}`);
        setError(null);
      })
      .catch((e) => setError(e?.response?.data?.detail || e.message))
      .finally(() => setLoading(false));
  }, [msgId, authHeader]);
  useEffect(() => { load(); }, [load]);

  const patch = async (upd) => {
    try {
      await axios.patch(`${API}/admin/contact/${msgId}`, upd, { headers: authHeader() });
      load();
    } catch { toast.error(en ? "Update failed" : "Update mislukt"); }
  };

  const sendReply = async () => {
    if (!reply.trim()) { toast.error(en ? "Type your reply first." : "Typ eerst je antwoord."); return; }
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
            toast.error(`${en ? "Upload failed" : "Upload mislukt"}: ${f.name}`);
          }
        }
        setUploading(false);
      }
      toast.success(sendEmail ? (en ? "Reply sent to client" : "Antwoord verstuurd naar klant") : (en ? "Reply saved" : "Antwoord opgeslagen"));
      setReply("");
      setFiles([]);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || (en ? "Send failed" : "Versturen mislukt"));
    } finally { setSending(false); }
  };

  const addNote = async () => {
    if (!note.trim()) return;
    try {
      await axios.post(`${API}/admin/contact/${msgId}/notes`, { text: note.trim() }, { headers: authHeader() });
      toast.success(en ? "Note added" : "Notitie toegevoegd");
      setNote("");
      load();
    } catch { toast.error(en ? "Note failed" : "Notitie mislukt"); }
  };

  const removeAttachment = async (aid) => {
    if (!window.confirm(en ? "Delete attachment?" : "Bijlage verwijderen?")) return;
    try {
      await axios.delete(`${API}/admin/contact/${msgId}/attachments/${aid}`, { headers: authHeader() });
      load();
    } catch { toast.error(en ? "Delete failed" : "Verwijderen mislukt"); }
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
    } catch { toast.error(en ? "Download failed" : "Download mislukt"); }
  };

  const isDone = msg?.status === "done";
  const canOverride = user?.role === "super_admin" || user?.role === "admin";
  const locked = isDone && !canOverride;

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-fg text-sm" data-testid="msg-thread-loading">
        <Loader2 className="h-4 w-4 animate-spin" /> {en ? "Loading message…" : "Bericht laden…"}
      </div>
    );
  }
  if (error || !msg) {
    return (
      <div className="surface border border-app rounded-3xl p-8 text-center" data-testid="msg-thread-error">
        <AlertCircle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
        <p className="font-heading text-lg text-strong">{en ? "Couldn't open message" : "Kon bericht niet openen"}</p>
        <p className="text-sm text-muted-fg mt-1">{typeof error === "string" ? error : "—"}</p>
        <Link to="/admin/messages" className="inline-block mt-4 text-sm text-pear-500 hover:underline">← {en ? "Back to Messages" : "Terug naar Berichten"}</Link>
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
        <ArrowLeft className="h-4 w-4" /> {en ? "Back to Messages" : "Terug naar Berichten"}
      </Link>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <header className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div className="min-w-0 flex items-start gap-3">
            <Avatar name={msg.name} email={msg.email} size={44} />
            <div className="min-w-0">
              <p className="overline mb-1" data-testid="msg-thread-ref">
                {msg.ticket_ref ? `#${msg.ticket_ref}` : `#${(msg.id || "").slice(0, 8)}`}
              </p>
              <h1 className="font-heading text-2xl sm:text-3xl font-medium text-strong break-words" data-testid="msg-thread-subject">
                {msg.subject || (en ? "(no subject)" : "(geen onderwerp)")}
              </h1>
              <p className="text-xs text-muted-fg mt-1">
                <strong>{msg.name}</strong> · {msg.email}
                {msg.phone && <> · {msg.phone}</>}
                {msg.company && <> · {msg.company}</>}
                <br />{fmt(msg.created_at, en)}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <span className={`text-[10px] uppercase tracking-widest rounded-full px-3 py-1 font-bold ${pr.color}`} data-testid="msg-thread-priority">{pr.label}</span>
            <span className={`text-[10px] uppercase tracking-widest rounded-full px-3 py-1 font-bold ${st.color}`} data-testid="msg-thread-status">{st.label}</span>
            {locked && <span className="text-[10px] uppercase tracking-widest bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5 inline-flex items-center gap-1" data-testid="msg-thread-locked"><Lock className="h-3 w-3" /> {en ? "Locked" : "Vergrendeld"}</span>}
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
          <label className="text-muted-fg ml-2">{en ? "Priority:" : "Prioriteit:"}</label>
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
            <button onClick={() => patch({ spam: true })} disabled={locked} className="rounded-full px-3 py-1 border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-40" data-testid="msg-thread-mark-spam">{en ? "Mark as spam" : "Markeer als spam"}</button>
          ) : (
            <button onClick={() => patch({ spam: false })} className="rounded-full px-3 py-1 border border-emerald-200 text-emerald-600 hover:bg-emerald-50" data-testid="msg-thread-unmark-spam">{en ? "Not spam" : "Geen spam"}</button>
          )}
          <a href={`mailto:${msg.email}?subject=Re: ${encodeURIComponent(msg.subject || 'PearBlue')}`} className="rounded-full px-3 py-1 border border-pear-500 text-pear-500 hover:bg-pear-50" data-testid="msg-thread-mailto">{en ? "Open in mail client" : "Open in mail-client"}</a>
        </div>

        {/* Conversation timeline */}
        <div className="mb-6" data-testid="msg-thread-timeline">
          <div className="flex items-center gap-2 mb-3">
            <MessageCircle className="h-4 w-4 text-pear-500" />
            <h3 className="font-heading font-semibold text-strong">{en ? "Conversation" : "Gesprek"}</h3>
            <span className="text-xs text-muted-fg">({timeline.length})</span>
          </div>
          <ol className="space-y-3">
            {timeline.map((t, i) => {
              if (t.kind === "note") {
                return (
                  <li key={t.id || i} className="rounded-2xl p-4 border border-amber-200 bg-amber-50/60 dark:bg-amber-500/5" data-testid={`msg-thread-item-note-${i}`}>
                    <div className="flex items-center gap-2 mb-2 text-[11px] uppercase tracking-widest text-amber-700">
                      📌 {en ? "Internal note" : "Interne notitie"} · {t.by} · {fmt(t.at, en)}
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
                    <span className="text-muted-fg">· {fmt(t.at, en)}</span>
                    {isOut && (t.email_sent ? (
                      <span className="text-[10px] uppercase rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5">✉ {en ? "sent" : "verstuurd"}</span>
                    ) : (
                      <span className="text-[10px] uppercase rounded-full bg-slate-100 text-slate-600 px-2 py-0.5">{en ? "saved only" : "enkel opgeslagen"}</span>
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
          <AttachmentsGrid
            attachments={msg.attachments}
            msgId={msgId}
            authHeader={authHeader}
            onDelete={removeAttachment}
            onDownload={downloadAttachment}
            onOpenPreview={setPreviewAtt}
          />
        )}

        {/* Attachment preview modal */}
        {previewAtt && (
          <AttachmentPreview
            att={previewAtt.att}
            url={previewAtt.url}
            mime={previewAtt.mime}
            onClose={() => setPreviewAtt(null)}
            onDownload={() => downloadAttachment(previewAtt.att.id, previewAtt.att.name)}
          />
        )}

        {/* Reply panel */}
        <div className="surface border border-app rounded-2xl p-5 mb-6" data-testid="msg-thread-reply-panel">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-heading font-semibold text-strong">{en ? "Send reply" : "Antwoord versturen"}</h3>
            <ReplyTemplatesDropdown
              templates={templates}
              onInsert={(tpl) => setReply((r) => r ? `${r}\n\n${tpl.body}` : tpl.body)}
              onManage={() => setShowTplMgr(true)}
              disabled={locked}
            />
          </div>
          <label className="text-xs uppercase tracking-widest text-muted-fg block mb-1">{en ? "Subject" : "Onderwerp"}</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={locked}
            className="w-full rounded-xl surface-2 border border-transparent focus:border-pear-500 px-4 py-2 text-sm outline-none text-strong mb-3 disabled:opacity-50"
            data-testid="msg-thread-subject-input"
          />
          <label className="text-xs uppercase tracking-widest text-muted-fg block mb-1">{en ? "Message" : "Bericht"}</label>
          <textarea
            rows={6}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            disabled={locked}
            placeholder={en ? "Type your reply to the client here…" : "Typ hier je antwoord aan de klant…"}
            className="w-full rounded-xl surface-2 border border-transparent focus:border-pear-500 px-4 py-3 text-sm outline-none resize-y text-strong disabled:opacity-50"
            data-testid="msg-thread-reply-input"
          />

          <div className="flex flex-wrap items-center gap-2 mt-3" data-testid="msg-thread-file-picker">
            <label className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-full surface-2 border border-app px-3 py-1.5 cursor-pointer hover:border-pear-500">
              <Paperclip className="h-3.5 w-3.5" />
              {en ? "Add attachment" : "Bijlage toevoegen"}
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
                  if (valid.length < list.length) toast.error(en ? "Some files exceed 20 MB and were skipped" : "Sommige bestanden zijn groter dan 20 MB en overgeslagen");
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
              {en ? `Send email to ${msg.email}` : `E-mail naar ${msg.email} sturen`}
            </label>
            <button
              onClick={sendReply}
              disabled={sending || locked || !reply.trim()}
              className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
              data-testid="msg-thread-send"
            >
              <Send className="h-4 w-4" /> {uploading ? (en ? "Uploading…" : "Uploaden…") : sending ? (en ? "Sending…" : "Versturen…") : sendEmail ? (en ? "Send reply" : "Verstuur antwoord") : (en ? "Save" : "Sla op")}
            </button>
          </div>
        </div>

        {/* Internal note */}
        <div className="surface border border-app rounded-2xl p-5" data-testid="msg-thread-note-panel">
          <h3 className="font-heading font-semibold text-strong mb-3">{en ? "Internal note" : "Interne notitie"}</h3>
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={en ? "Only visible to the CMS team…" : "Alleen zichtbaar voor het CMS-team…"}
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
              {en ? "Add note" : "Notitie toevoegen"}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Templates manager modal */}
      {showTplMgr && (
        <TemplatesManager
          templates={templates}
          authHeader={authHeader}
          onClose={() => { setShowTplMgr(false); loadTemplates(); }}
          onChange={loadTemplates}
        />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// AttachmentsGrid — thumb grid with inline preview trigger (images + PDF)
// -----------------------------------------------------------------------------
function AttachmentsGrid({ attachments, msgId, authHeader, onDelete, onDownload, onOpenPreview }) {
  const [thumbs, setThumbs] = useState({}); // { attId: objectUrl }
  const loadedRef = useRef(new Set());
  useEffect(() => {
    let cancelled = false;
    const urls = [];
    (async () => {
      for (const a of attachments) {
        if (loadedRef.current.has(a.id)) continue;
        if (!(a.mime || "").startsWith("image/")) continue;
        try {
          const r = await axios.get(`${API}/admin/contact/${msgId}/attachments/${a.id}/preview`, {
            headers: authHeader(), responseType: "blob",
          });
          if (cancelled) return;
          const url = URL.createObjectURL(r.data);
          urls.push(url);
          loadedRef.current.add(a.id);
          setThumbs((prev) => ({ ...prev, [a.id]: url }));
        } catch { /* skip */ }
      }
    })();
    return () => { cancelled = true; urls.forEach(URL.revokeObjectURL); };
  }, [attachments, msgId, authHeader]);

  const openPreview = async (a) => {
    const isImage = (a.mime || "").startsWith("image/");
    const isPdf = (a.mime || "") === "application/pdf";
    if (!isImage && !isPdf) return onDownload(a.id, a.name);
    try {
      const r = await axios.get(`${API}/admin/contact/${msgId}/attachments/${a.id}/preview`, {
        headers: authHeader(), responseType: "blob",
      });
      const url = URL.createObjectURL(r.data);
      onOpenPreview({ att: a, url, mime: a.mime });
    } catch {
      toast.error("Preview mislukt");
    }
  };

  return (
    <div className="mb-6" data-testid="msg-thread-attachments">
      <div className="flex items-center gap-2 mb-2">
        <Paperclip className="h-4 w-4 text-pear-500" />
        <h3 className="font-heading font-semibold text-strong">Bijlagen</h3>
        <span className="text-xs text-muted-fg">({attachments.length})</span>
      </div>
      <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {attachments.map((a) => {
          const isImage = (a.mime || "").startsWith("image/");
          const isPdf = (a.mime || "") === "application/pdf";
          return (
            <li key={a.id} className="surface-2 rounded-xl border border-app overflow-hidden group relative" data-testid={`msg-thread-attachment-${a.id}`}>
              <button type="button" onClick={() => openPreview(a)} className="block w-full text-left" data-testid={`msg-thread-attachment-open-${a.id}`}>
                <div className="aspect-video flex items-center justify-center bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  {isImage && thumbs[a.id] ? (
                    <img src={thumbs[a.id]} alt={a.name} className="w-full h-full object-cover" loading="lazy" />
                  ) : isImage ? (
                    <ImageIcon className="h-10 w-10 text-muted-fg animate-pulse" />
                  ) : isPdf ? (
                    <FileText className="h-10 w-10 text-red-400" />
                  ) : (
                    <Paperclip className="h-10 w-10 text-muted-fg" />
                  )}
                </div>
                <div className="px-2 py-1.5 text-[11px] text-strong truncate" title={a.name}>{a.name}</div>
                <div className="px-2 pb-2 text-[10px] text-muted-fg truncate">{(a.size / 1024).toFixed(0)} kB · {a.mime}</div>
              </button>
              <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button type="button" onClick={(e) => { e.stopPropagation(); onDownload(a.id, a.name); }} className="p-1 rounded-full bg-white/90 dark:bg-slate-900/90 hover:text-pear-500" aria-label="Download" data-testid={`msg-thread-attachment-download-${a.id}`}>
                  <Download className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(a.id); }} className="p-1 rounded-full bg-white/90 dark:bg-slate-900/90 hover:text-red-500" aria-label="Verwijder bijlage" data-testid={`msg-thread-attachment-remove-${a.id}`}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// -----------------------------------------------------------------------------
// AttachmentPreview — fullscreen inline viewer for images & PDFs (uses blob URL)
// -----------------------------------------------------------------------------
function AttachmentPreview({ att, url, mime, onClose, onDownload }) {
  useEffect(() => () => { try { URL.revokeObjectURL(url); } catch { /* noop */ } }, [url]);
  return (
    <div className="pb-modal" onClick={onClose} data-testid="msg-thread-attachment-preview">
      <div className="pb-modal-card w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
        <header className="px-4 py-2 border-b border-app flex items-center justify-between shrink-0 surface">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-strong truncate">{att.name}</div>
            <div className="text-[11px] text-muted-fg">{mime} · {(att.size / 1024).toFixed(0)} kB</div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onDownload} className="text-xs rounded-full border border-app px-3 py-1 hover:border-pear-500" data-testid="msg-thread-preview-download">
              <Download className="h-3.5 w-3.5 inline mr-1" /> Download
            </button>
            <button onClick={onClose} className="text-2xl leading-none text-muted-fg hover:text-strong" data-testid="msg-thread-preview-close">×</button>
          </div>
        </header>
        <div className="pb-modal-body bg-slate-900/95 flex items-center justify-center min-h-[60vh]">
          {mime.startsWith("image/") ? (
            <img src={url} alt={att.name} className="max-w-full max-h-[80vh] object-contain" />
          ) : mime === "application/pdf" ? (
            <iframe src={url} title={att.name} className="w-full h-[80vh] border-0 bg-white" />
          ) : (
            <div className="p-6 text-white text-sm">Voor dit type kan geen preview worden gegenereerd.</div>
          )}
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// ReplyTemplatesDropdown — quick-insert one of the saved templates
// -----------------------------------------------------------------------------
function ReplyTemplatesDropdown({ templates, onInsert, onManage, disabled }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  useEffect(() => {
    const onClick = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);
  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 text-xs rounded-full border border-app px-3 py-1.5 hover:border-pear-500 disabled:opacity-40"
        data-testid="msg-thread-templates-toggle"
      >
        Antwoord-templates <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-72 max-h-72 overflow-y-auto surface border border-app rounded-2xl shadow-lg z-20 p-1.5" data-testid="msg-thread-templates-menu">
          {templates.length === 0 && (
            <p className="p-3 text-xs text-muted-fg text-center">Nog geen templates. Maak er een aan met &quot;Beheren&quot;.</p>
          )}
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => { onInsert(t); setOpen(false); }}
              className="w-full text-left px-3 py-2 rounded-xl text-xs hover:bg-pear-100/50"
              data-testid={`msg-thread-template-insert-${t.id}`}
            >
              <div className="font-semibold text-strong">{t.title}</div>
              <div className="text-muted-fg line-clamp-2">{t.body}</div>
            </button>
          ))}
          <div className="border-t border-app mt-1.5 pt-1.5">
            <button
              type="button"
              onClick={() => { onManage(); setOpen(false); }}
              className="w-full text-center text-xs text-pear-500 hover:text-pear-600 py-1.5"
              data-testid="msg-thread-templates-manage"
            >
              <Edit2 className="h-3 w-3 inline mr-1" /> Beheren
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// TemplatesManager — CRUD modal for saved reply templates
// -----------------------------------------------------------------------------
function TemplatesManager({ templates, authHeader, onClose, onChange }) {
  const [editing, setEditing] = useState(null); // { id?, title, body }
  const [busy, setBusy] = useState(false);

  const startNew = () => setEditing({ title: "", body: "" });
  const save = async () => {
    if (!editing.title.trim() || !editing.body.trim()) { toast.error("Titel en tekst zijn verplicht"); return; }
    setBusy(true);
    try {
      if (editing.id) {
        await axios.patch(`${API}/admin/reply-templates/${editing.id}`, { title: editing.title, body: editing.body, lang: "nl" }, { headers: authHeader() });
        toast.success("Template bijgewerkt");
      } else {
        await axios.post(`${API}/admin/reply-templates`, { title: editing.title, body: editing.body, lang: "nl" }, { headers: authHeader() });
        toast.success("Template opgeslagen");
      }
      setEditing(null);
      onChange();
    } catch { toast.error("Opslaan mislukt"); } finally { setBusy(false); }
  };
  const del = async (id) => {
    if (!window.confirm("Deze template verwijderen?")) return;
    try {
      await axios.delete(`${API}/admin/reply-templates/${id}`, { headers: authHeader() });
      onChange();
    } catch { toast.error("Verwijderen mislukt"); }
  };

  return (
    <div className="pb-modal" style={{ zIndex: 90 }} onClick={onClose} data-testid="msg-thread-templates-modal">
      <div className="pb-modal-card w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <header className="px-6 py-4 border-b border-app flex items-center justify-between shrink-0 surface">
          <div>
            <div className="font-heading text-lg font-semibold text-strong">Antwoord-templates beheren</div>
            <p className="text-xs text-muted-fg">Snel-invoegen voor terugkerende antwoorden.</p>
          </div>
          <button onClick={onClose} className="text-muted-fg hover:text-strong text-2xl leading-none">×</button>
        </header>
        <div className="pb-modal-body p-6 space-y-4 surface">
          {!editing && (
            <div className="flex justify-end">
              <button onClick={startNew} className="btn-primary" data-testid="templates-new">
                <Plus className="h-4 w-4" /> Nieuwe template
              </button>
            </div>
          )}
          {editing && (
            <div className="space-y-3 surface-2 rounded-xl p-4">
              <label className="block">
                <span className="text-xs uppercase tracking-widest text-muted-fg">Titel</span>
                <input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="mt-1 w-full rounded-lg border border-app px-3 py-2 text-sm" data-testid="templates-edit-title" />
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-widest text-muted-fg">Tekst</span>
                <textarea value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} rows={6} className="mt-1 w-full rounded-lg border border-app px-3 py-2 text-sm" data-testid="templates-edit-body" />
              </label>
              <div className="flex items-center justify-end gap-2">
                <button onClick={() => setEditing(null)} className="text-xs px-3 py-1.5 rounded-full border border-app">Annuleren</button>
                <button onClick={save} disabled={busy} className="btn-primary" data-testid="templates-edit-save">
                  {busy ? "Opslaan…" : "Opslaan"}
                </button>
              </div>
            </div>
          )}
          <ul className="space-y-2">
            {templates.length === 0 && !editing && (
              <li className="text-sm text-muted-fg text-center py-8">Nog geen templates. Maak er een aan om ze in het antwoord-panel snel in te voegen.</li>
            )}
            {templates.map((t) => (
              <li key={t.id} className="surface-2 rounded-xl border border-app p-3 flex items-start justify-between gap-3" data-testid={`templates-item-${t.id}`}>
                <div className="min-w-0">
                  <div className="font-semibold text-strong text-sm">{t.title}</div>
                  <div className="text-xs text-muted-fg whitespace-pre-wrap line-clamp-3">{t.body}</div>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <button onClick={() => setEditing(t)} className="text-xs rounded-full border border-app px-2.5 py-1 hover:border-pear-500" data-testid={`templates-edit-${t.id}`}>
                    <Edit2 className="h-3 w-3 inline mr-1" /> Bewerken
                  </button>
                  <button onClick={() => del(t.id)} className="text-xs rounded-full border border-red-200 text-red-500 px-2.5 py-1 hover:bg-red-50" data-testid={`templates-delete-${t.id}`}>
                    <Trash2 className="h-3 w-3 inline mr-1" /> Verwijderen
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

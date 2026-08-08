import React, { useEffect, useState } from "react";
import axios from "axios";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowLeft, Loader2, AlertCircle, Send, User, MessageCircle, Paperclip, XCircle } from "lucide-react";
import { useLang } from "../i18n/LanguageContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TT = {
  back: { nl: "Terug naar portaal", en: "Back to portal" },
  loading: { nl: "Ticket laden…", en: "Loading ticket…" },
  cantOpen: { nl: "Kon ticket niet openen", en: "Could not open ticket" },
  yourReply: { nl: "Je antwoord", en: "Your reply" },
  send: { nl: "Verstuur antwoord", en: "Send reply" },
  sending: { nl: "Bezig…", en: "Sending…" },
  emptyReply: { nl: "Typ eerst je antwoord.", en: "Type your reply first." },
  sent: { nl: "Antwoord verstuurd", en: "Reply sent" },
  sendFailed: { nl: "Versturen mislukt", en: "Send failed" },
  conversation: { nl: "Gesprek", en: "Conversation" },
  agent: { nl: "PearBlue support", en: "PearBlue support" },
  you: { nl: "Jij", en: "You" },
};

const statusColor = (s) => {
  const st = String(s || "").toLowerCase();
  if (st === "open") return "bg-pear-100 text-pear-700";
  if (st === "closed" || st === "solved") return "bg-emerald-100 text-emerald-700";
  if (st === "on hold") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-700";
};

export default function TicketDetail() {
  const { ticketId } = useParams();
  const { lang } = useLang();
  const t = (k) => TT[k]?.[lang] || TT[k]?.nl || k;

  const [ticket, setTicket] = useState({ loading: true, data: null, error: null });
  const [threads, setThreads] = useState({ loading: true, data: [] });
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);

  const load = () => {
    axios.get(`${API}/portal/tickets/${ticketId}`, { withCredentials: true })
      .then((r) => setTicket({ loading: false, data: r.data, error: null }))
      .catch((e) => setTicket({ loading: false, data: null, error: e?.response?.data?.detail || e.message }));
    axios.get(`${API}/portal/tickets/${ticketId}/threads`, { withCredentials: true })
      .then((r) => setThreads({ loading: false, data: r.data?.data || [] }))
      .catch(() => setThreads({ loading: false, data: [] }));
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [ticketId]);

  const sendReply = async () => {
    if (!reply.trim()) { toast.error(t("emptyReply")); return; }
    setSending(true);
    try {
      const html = reply.split("\n").map(l => `<p>${l}</p>`).join("");
      await axios.post(`${API}/portal/tickets/${ticketId}/reply`, { content: html }, { withCredentials: true });
      // Upload attachments one by one (Zoho Desk API accepts one file per POST)
      if (files.length) {
        setUploading(true);
        for (const f of files) {
          const fd = new FormData();
          fd.append("file", f);
          try {
            await axios.post(`${API}/portal/tickets/${ticketId}/attachments`, fd, {
              withCredentials: true,
              headers: { "Content-Type": "multipart/form-data" },
            });
          } catch (e) {
            toast.error(`${lang === "en" ? "Upload failed for" : "Upload mislukt voor"}: ${f.name}`);
          }
        }
        setUploading(false);
      }
      toast.success(t("sent"));
      setReply("");
      setFiles([]);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || t("sendFailed"));
    } finally { setSending(false); }
  };

  const tk = ticket.data;

  return (
    <div className="max-w-4xl mx-auto px-6 lg:px-10 py-12" data-testid="page-ticket-detail">
      <Link to="/portal" className="inline-flex items-center gap-1 text-sm text-muted-fg hover:text-pear-500 mb-6" data-testid="ticket-back">
        <ArrowLeft className="h-4 w-4" /> {t("back")}
      </Link>
      {ticket.loading && (
        <div className="flex items-center gap-2 text-muted-fg text-sm"><Loader2 className="h-4 w-4 animate-spin" /> {t("loading")}</div>
      )}
      {ticket.error && !ticket.loading && (
        <div className="surface border border-app rounded-3xl p-8 text-center">
          <AlertCircle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
          <p className="font-heading text-lg text-strong">{t("cantOpen")}</p>
          <p className="text-sm text-muted-fg mt-1">{typeof ticket.error === "string" ? ticket.error : "—"}</p>
        </div>
      )}
      {tk && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="flex items-start justify-between gap-4 mb-6">
            <div className="min-w-0">
              <p className="overline mb-1">#{tk.ticketNumber || ticketId}</p>
              <h1 className="font-heading text-2xl sm:text-3xl font-medium text-strong" data-testid="ticket-subject">{tk.subject}</h1>
              <p className="text-xs text-muted-fg mt-2">
                {tk.contact?.email || tk.email} · {tk.channel} · {tk.createdTime?.slice(0, 10)}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <span className={`text-[10px] uppercase tracking-widest rounded-full px-3 py-1 font-bold ${statusColor(tk.status)}`} data-testid="ticket-status-badge">
                {tk.status}
              </span>
              {tk.priority && (
                <span className="text-[10px] uppercase tracking-widest rounded-full px-3 py-1 font-bold bg-slate-100 text-slate-700">
                  {tk.priority}
                </span>
              )}
            </div>
          </div>

          {tk.description && (
            <div className="surface border border-app rounded-2xl p-5 mb-6">
              <p className="text-xs uppercase tracking-widest text-muted-fg mb-2">Origineel bericht</p>
              <div className="text-sm text-strong/90 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: tk.description }} />
            </div>
          )}

          <div className="mb-6" data-testid="ticket-threads">
            <div className="flex items-center gap-2 mb-3">
              <MessageCircle className="h-4 w-4 text-pear-500" />
              <h3 className="font-heading font-semibold text-strong">{t("conversation")}</h3>
              <span className="text-xs text-muted-fg">({threads.data.length})</span>
            </div>
            {threads.loading ? <div className="text-xs text-muted-fg"><Loader2 className="h-3 w-3 animate-spin inline mr-1" /> …</div> : (
              <ol className="space-y-3">
                {threads.data.map((th, i) => {
                  const isAgent = th.direction === "out" || th.author?.type === "AGENT" || th.channel === "EMAIL_TEMPLATE";
                  return (
                    <li key={th.id || i} className={`rounded-2xl p-4 border ${isAgent ? "bg-pear-500/5 border-pear-200" : "surface-2 border-transparent"}`}>
                      <div className="flex items-center gap-2 mb-2 text-xs">
                        <User className="h-3 w-3 text-pear-500" />
                        <span className="font-semibold text-strong">{isAgent ? t("agent") : (th.author?.name || t("you"))}</span>
                        <span className="text-muted-fg">· {th.createdTime?.slice(0, 16).replace("T", " ")}</span>
                      </div>
                      <div
                        className="text-sm text-strong/90 whitespace-pre-wrap prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: th.content || th.plainText || th.summary || "" }}
                      />
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          <div className="surface border border-app rounded-2xl p-5" data-testid="ticket-reply-panel">
            <label className="text-xs uppercase tracking-widest text-muted-fg block mb-2">{t("yourReply")}</label>
            <textarea rows={5} value={reply} onChange={(e) => setReply(e.target.value)} data-testid="ticket-reply-input"
              className="w-full rounded-xl surface-2 border border-transparent focus:border-pear-500 px-4 py-3 text-sm outline-none resize-y text-strong" />

            {/* Attachment picker */}
            <div className="flex flex-wrap items-center gap-2 mt-3" data-testid="ticket-attachment-picker">
              <label className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-full surface-2 border border-app px-3 py-1.5 cursor-pointer hover:border-pear-500">
                <Paperclip className="h-3.5 w-3.5" />
                {lang === "en" ? "Add attachment" : "Bijlage toevoegen"}
                <input type="file" multiple hidden data-testid="ticket-file-input"
                  onChange={(e) => {
                    const list = Array.from(e.target.files || []);
                    const valid = list.filter((f) => f.size < 20 * 1024 * 1024);
                    if (valid.length < list.length) toast.error(lang === "en" ? "Some files exceed 20 MB and were skipped" : "Sommige bestanden zijn groter dan 20 MB en overgeslagen");
                    setFiles((p) => [...p, ...valid]);
                    e.target.value = "";
                  }} />
              </label>
              {files.map((f, i) => (
                <span key={i} className="inline-flex items-center gap-1 text-xs rounded-full bg-pear-100 text-pear-700 px-2.5 py-1" data-testid={`ticket-file-chip-${i}`}>
                  {f.name} · {(f.size / 1024).toFixed(0)}kB
                  <button type="button" onClick={() => setFiles((p) => p.filter((_, idx) => idx !== i))} className="hover:text-red-500" data-testid={`ticket-file-remove-${i}`}>
                    <XCircle className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
            </div>

            <div className="flex justify-end mt-4">
              <button onClick={sendReply} disabled={sending || !reply.trim()} className="btn-primary" data-testid="ticket-reply-send">
                <Send className="h-4 w-4" /> {uploading ? (lang === "en" ? "Uploading…" : "Uploaden…") : (sending ? t("sending") : t("send"))}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

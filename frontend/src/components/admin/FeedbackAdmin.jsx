import React, { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { MessageSquare } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { useLang } from "../../i18n/LanguageContext";
import { Avatar } from "../Avatar";
import { API, FEEDBACK_STATUS, AssigneeChip, assigneeLabel, prettyRole } from "./_shared";
import { AiTranslateButton } from "./AiTranslateButton";

export const FeedbackAdmin = () => {
  const { authHeader, user } = useAuth();
  const { lang } = useLang();
  const en = lang === "en";
  const [items, setItems] = useState([]);
  const [assignees, setAssignees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("open");
  const [openItem, setOpenItem] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [r, a] = await Promise.all([
        axios.get(`${API}/admin/feedback`, { headers: authHeader() }),
        axios.get(`${API}/admin/assignees`, { headers: authHeader() }),
      ]);
      setItems(r.data || []);
      setAssignees(a.data || []);
    } catch { toast.error("Kon feedback niet laden"); } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const setStatus = async (id, status) => {
    try {
      await axios.patch(`${API}/admin/feedback/${id}`, { status }, { headers: authHeader() });
      toast.success("Status bijgewerkt");
      load();
    } catch { toast.error("Actie mislukt"); }
  };
  const assign = async (id, email) => {
    try {
      await axios.patch(`${API}/admin/feedback/${id}`, { assigned_to: email || null }, { headers: authHeader() });
      load();
    } catch { toast.error("Toewijzen mislukt"); }
  };
  const addNote = async (id, text) => {
    if (!text.trim()) return;
    try {
      await axios.post(`${API}/admin/feedback/${id}/notes`, { text }, { headers: authHeader() });
      const r = await axios.get(`${API}/admin/feedback`, { headers: authHeader() });
      setItems(r.data || []);
      const updated = (r.data || []).find((x) => x.id === id);
      setOpenItem(updated || null);
    } catch { toast.error("Notitie toevoegen mislukt"); }
  };

  const byPage = items.reduce((acc, it) => { (acc[it.page] = acc[it.page] || []).push(it); return acc; }, {});
  const filtered = (list) => filter === "open" ? list.filter((x) => x.status !== "done") : list;

  return (
    <div className="space-y-6" data-testid="cms-feedback">
      <div>
        <h2 className="font-heading text-2xl font-semibold text-strong flex items-center gap-2">
          <MessageSquare className="h-6 w-6 text-pear-500" />
          {en ? "Customer feedback" : "Klantfeedback"}
        </h2>
        <p className="text-sm text-muted-fg mt-1">{en ? "Feedback per page — status, assignment and internal notes." : "Feedback per pagina — status, toewijzing en interne notities."}</p>
      </div>
      <div className="flex items-center gap-2 text-sm">
        {["open", "all"].map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            data-testid={`fb-filter-${k}`}
            className={`px-3 py-1.5 rounded-full border text-xs font-medium ${filter === k ? "bg-pear-500 text-white border-pear-500" : "text-strong border-app hover:border-pear-500"}`}
          >{en ? (k === "open" ? "Open items" : "All") : (k === "open" ? "Open items" : "Alles")}</button>
        ))}
        <button onClick={load} className="ml-auto text-xs text-muted-fg hover:text-pear-500" data-testid="fb-refresh">↻ {en ? "Refresh" : "Vernieuwen"}</button>
      </div>
      {loading ? <div className="text-muted-fg">{en ? "Loading…" : "Laden…"}</div> : Object.keys(byPage).length === 0 ? (
        <div className="text-muted-fg text-sm">{en ? "No feedback yet." : "Nog geen feedback binnen."}</div>
      ) : (
        <div className="space-y-6">
          {Object.entries(byPage).map(([page, list]) => (
            <div key={page} data-testid={`fb-group-${page}`}>
              <div className="text-xs uppercase tracking-widest text-muted-fg mb-2">{en ? "Page" : "Pagina"}: <span className="text-strong">{page}</span> · {filtered(list).length} items</div>
              <div className="rounded-2xl border border-app overflow-hidden surface">
                {filtered(list).map((f) => {
                  const st = FEEDBACK_STATUS.find((s) => s.key === (f.status || "new")) || FEEDBACK_STATUS[0];
                  return (
                    <div key={f.id} className="p-3 sm:p-4 border-b border-app/50 last:border-0" data-testid={`fb-row-${f.id}`}>
                      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                    <div className="flex gap-3 items-start flex-1 min-w-0">
                      <Avatar name={f.email || "Anon"} email={f.email} size={36} />
                      <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[10px] uppercase font-bold rounded-full px-2 py-0.5 ${st.color}`}>{st.label}</span>
                            {f.rating && <span className="text-xs text-pear-500">{"★".repeat(f.rating)}</span>}
                            <span className="text-[10px] text-muted-fg">{new Date(f.created_at).toLocaleString("nl-NL")}</span>
                            {f.email && <span className="text-[10px] text-muted-fg break-all">· {f.email}</span>}
                          </div>
                          <p className="text-sm text-strong mt-1 whitespace-pre-wrap break-words">{f.message}</p>
                          {f.assigned_to && (
                            <div className="mt-1"><AssigneeChip email={f.assigned_to} assignees={assignees} size={22} /></div>
                          )}
                        </div>
                    </div>
                        <div className="flex flex-col gap-1.5 sm:shrink-0 w-full sm:w-auto sm:min-w-[180px]">
                          <select
                            value={f.status || "new"}
                            onChange={(e) => setStatus(f.id, e.target.value)}
                            className="text-xs rounded-lg border border-app surface px-2 py-1 disabled:opacity-50"
                            data-testid={`fb-status-${f.id}`}
                            disabled={(f.status === "done") && !["super_admin","admin"].includes(user?.role)}
                          >
                            {FEEDBACK_STATUS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                          </select>
                          <select
                            value={f.assigned_to || ""}
                            onChange={(e) => assign(f.id, e.target.value || null)}
                            className="text-xs rounded-lg border border-app surface px-2 py-1 disabled:opacity-50"
                            data-testid={`fb-assignee-${f.id}`}
                            disabled={(f.status === "done") && !["super_admin","admin"].includes(user?.role)}
                          >
                            <option value="">— Niet toegewezen —</option>
                            {assignees.map((a) => (
                              <option key={a.email} value={a.email}>
                                {assigneeLabel(a)} · {prettyRole(a.role)}
                              </option>
                            ))}
                            {user?.email && !assignees.find((a) => a.email === user.email) && (
                              <option value={user.email}>{user.email} · (mij)</option>
                            )}
                          </select>
                          <button
                            onClick={() => setOpenItem(f)}
                            className="text-xs rounded-full px-2 py-1 border border-app hover:border-pear-500"
                            data-testid={`fb-notes-${f.id}`}
                          >Notities ({(f.notes || []).length})</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {openItem && (
        <div className="pb-modal" onClick={() => setOpenItem(null)} data-testid="fb-notes-modal">
          <div className="pb-modal-card w-full max-w-lg p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <div className="font-heading font-semibold text-strong">Notities</div>
                <div className="text-[11px] text-muted-fg">{openItem.page} · {new Date(openItem.created_at).toLocaleString("nl-NL")}</div>
              </div>
              <button onClick={() => setOpenItem(null)} className="text-muted-fg hover:text-strong text-2xl leading-none">×</button>
            </div>
            <div className="text-sm text-strong bg-pear-50/40 dark:bg-pear-500/5 rounded-xl p-3 mb-3 whitespace-pre-wrap">{openItem.message}</div>
            <div className="space-y-2 max-h-40 overflow-y-auto mb-3">
              {(openItem.notes || []).length === 0 ? (
                <div className="text-xs text-muted-fg">Nog geen notities.</div>
              ) : (openItem.notes || []).map((n) => (
                <div key={n.id} className="text-xs bg-pear-50/40 dark:bg-pear-500/5 rounded p-2">
                  <div className="text-strong whitespace-pre-wrap">{n.text}</div>
                  <div className="text-[10px] text-muted-fg mt-1">— {n.by} · {new Date(n.at).toLocaleString("nl-NL")}</div>
                </div>
              ))}
            </div>
            <FeedbackNoteForm openItem={openItem} addNote={addNote} />
          </div>
        </div>
      )}
    </div>
  );
};

// Note-entry form with AI translate button (extracted so we can hold local state
// for the note text and hand it to <AiTranslateButton>).
const FeedbackNoteForm = ({ openItem, addNote }) => {
  const [note, setNote] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    if (!note.trim()) return;
    await addNote(openItem.id, note);
    setNote("");
  };
  return (
    <form onSubmit={submit} className="space-y-2" data-testid="fb-note-form">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-widest text-muted-fg">Interne notitie</span>
        <AiTranslateButton value={note} onTranslated={setNote} testid="fb-note-translate" size="xs" />
      </div>
      <div className="flex gap-2">
        <input value={note} onChange={(e) => setNote(e.target.value)} name="note" placeholder="Voeg een notitie toe…" className="flex-1 rounded-xl border border-app surface px-3 py-2 text-sm" data-testid="fb-note-input" />
        <button type="submit" className="btn-primary" data-testid="fb-note-submit">Toevoegen</button>
      </div>
    </form>
  );
};

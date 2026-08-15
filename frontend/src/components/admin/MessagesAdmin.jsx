import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "../../auth/AuthContext";
import { Avatar } from "../Avatar";
import { useSilentPolling } from "../../hooks/useSilentPolling";
import { API, MSG_STATUS, MSG_PRIORITY, priorityRank, AssigneeChip, assigneeLabel, prettyRole } from "./_shared";

export const MessagesAdmin = () => {
  const { authHeader, user } = useAuth();
  const [items, setItems] = useState([]);
  const [assignees, setAssignees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("inbox");     // inbox | spam | archive | all
  const [sort, setSort] = useState("date");    // date | name | priority
  const [selected, setSelected] = useState(new Set());

  const load = async () => {
    setLoading(true);
    try {
      const [r, a] = await Promise.all([
        axios.get(`${API}/contact`, { headers: authHeader() }),
        axios.get(`${API}/admin/assignees`, { headers: authHeader() }),
      ]);
      setItems(r.data || []);
      setAssignees(a.data || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  // Silent background refresh every 15s — does NOT toggle loading, skips ticks
  // while the user is interacting with a field, only updates state when the
  // payload actually changed (JSON-diff). This preserves open dropdowns and
  // half-filled note inputs across polls.
  useSilentPolling(
    async () => {
      const [r, a] = await Promise.all([
        axios.get(`${API}/contact`, { headers: authHeader() }),
        axios.get(`${API}/admin/assignees`, { headers: authHeader() }),
      ]);
      return { items: r.data || [], assignees: a.data || [] };
    },
    ({ items: newItems, assignees: newAssignees }) => {
      setItems(newItems);
      setAssignees(newAssignees);
    },
    15000,
    [],
  );

  const patch = async (id, upd) => {
    try { await axios.patch(`${API}/admin/contact/${id}`, upd, { headers: authHeader() }); load(); }
    catch { toast.error("Update mislukt"); }
  };
  const addNote = async (id, text) => {
    if (!text.trim()) return;
    try { await axios.post(`${API}/admin/contact/${id}/notes`, { text }, { headers: authHeader() }); load(); toast.success("Notitie toegevoegd"); }
    catch { toast.error("Notitie mislukt"); }
  };
  const bulkDelete = async () => {
    const ids = [...selected];
    if (!ids.length) return;
    if (!window.confirm(`${ids.length} bericht(en) definitief verwijderen?`)) return;
    try {
      await axios.post(`${API}/admin/contact/bulk-delete`, { ids }, { headers: authHeader() });
      toast.success(`${ids.length} verwijderd`);
      setSelected(new Set());
      load();
    } catch { toast.error("Bulk-verwijderen mislukt"); }
  };
  const deleteAllSpam = async () => {
    if (!window.confirm("ALLE als spam gemarkeerde berichten definitief verwijderen?")) return;
    try {
      const r = await axios.post(`${API}/admin/contact/delete-all-spam`, {}, { headers: authHeader() });
      toast.success(`${r.data?.deleted || 0} spam-berichten verwijderd`);
      setSelected(new Set());
      load();
    } catch { toast.error("Actie mislukt"); }
  };
  const toggleSel = (id) => setSelected((prev) => {
    const s = new Set(prev);
    if (s.has(id)) s.delete(id); else s.add(id);
    return s;
  });

  // Sub-tab filtering
  const inTab = (m) => {
    if (tab === "spam") return m.spam === true;
    if (tab === "archive") return m.status === "archived";
    if (tab === "inbox") return !m.spam && m.status !== "archived";
    return true; // all
  };
  const filtered = items.filter(inTab);
  const sorted = [...filtered].sort((a, b) => {
    if (sort === "name") return (a.name || "").localeCompare(b.name || "");
    if (sort === "priority") return priorityRank(a.priority) - priorityRank(b.priority);
    return (b.created_at || "").localeCompare(a.created_at || "");
  });

  const counts = {
    inbox: items.filter((m) => !m.spam && m.status !== "archived").length,
    spam: items.filter((m) => m.spam).length,
    archive: items.filter((m) => m.status === "archived").length,
    all: items.length,
  };

  return (
    <div data-testid="cms-messages">
      <header className="mb-4">
        <h1 className="font-heading text-3xl font-medium text-strong">Berichten</h1>
        <p className="text-sm text-muted-fg mt-1">Beheer aanvragen — postvak, spam en archief.</p>
      </header>

      {/* Sub-tabs */}
      <div className="flex flex-wrap gap-1 border-b border-app mb-4" data-testid="msg-subtabs">
        {[
          { key: "inbox", label: "Postvak IN" },
          { key: "spam", label: "Spam" },
          { key: "archive", label: "Archief" },
          { key: "all", label: "Alles" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setSelected(new Set()); }}
            data-testid={`msg-tab-${t.key}`}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px flex items-center gap-2 ${
              tab === t.key ? "border-pear-500 text-pear-600" : "border-transparent text-muted-fg hover:text-strong"
            }`}
          >
            {t.label}
            <span className="text-[10px] rounded-full surface px-1.5 py-0.5">{counts[t.key]}</span>
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 text-xs">
          <span className="text-muted-fg">Sorteer op:</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="text-xs rounded-lg border border-app surface px-2 py-1" data-testid="msg-sort">
            <option value="date">Datum</option>
            <option value="name">Naam</option>
            <option value="priority">Prioriteit</option>
          </select>
        </div>
      </div>

      {/* Bulk toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button
          disabled={!selected.size}
          onClick={bulkDelete}
          className="text-xs px-3 py-1.5 rounded-full border border-red-300 text-red-500 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
          data-testid="msg-bulk-delete"
        >Verwijder geselecteerde ({selected.size})</button>
        {tab === "spam" && (
          <button
            onClick={deleteAllSpam}
            className="text-xs px-3 py-1.5 rounded-full border border-red-300 text-red-500 hover:bg-red-50"
            data-testid="msg-delete-all-spam"
          >Verwijder alle spam</button>
        )}
        <button onClick={load} className="ml-auto text-xs text-muted-fg hover:text-pear-500" data-testid="msg-refresh">↻ Vernieuwen</button>
      </div>

      {loading ? <p className="text-muted-fg">Laden…</p> : sorted.length === 0 ? (
        <div className="surface border border-app rounded-2xl p-10 text-center text-muted-fg">Geen berichten in deze weergave.</div>
      ) : (
        <div className="surface border border-app rounded-2xl divide-y divide-app">
          {sorted.map((m, i) => {
            const st = MSG_STATUS.find((s) => s.key === (m.status || "new")) || MSG_STATUS[0];
            const pr = MSG_PRIORITY.find((p) => p.key === (m.priority || "P3")) || MSG_PRIORITY[3];
            const isSel = selected.has(m.id);
            return (
              <details key={m.id || i} className="group" data-testid={`cms-message-${i}`}>
                <summary className="p-3 cursor-pointer flex items-start gap-3 flex-wrap">
                  <input
                    type="checkbox"
                    onClick={(e) => { e.stopPropagation(); toggleSel(m.id); }}
                    checked={isSel}
                    onChange={() => {}}
                    className="mt-1 accent-pear-500 h-4 w-4"
                    aria-label="Selecteer"
                    data-testid={`msg-select-${m.id || i}`}
                  />
                  <Avatar name={m.name} email={m.email} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-strong truncate">
                      {m.name} <span className="text-muted-fg font-normal text-xs">— {m.email}</span>
                      {m.spam && <span className="ml-2 text-[10px] uppercase text-red-500 bg-red-100 rounded-full px-2 py-0.5">Spam</span>}
                    </p>
                    <p className="text-xs text-muted-fg truncate">
                      {m.ticket_ref && <span className="font-mono text-pear-500 mr-1.5">#{m.ticket_ref}</span>}
                      {m.subject || "(geen onderwerp)"} · {new Date(m.created_at).toLocaleString("nl-NL")}
                    </p>
                  </div>
                  <span className={`text-[10px] uppercase tracking-widest rounded-full px-2 py-1 ${pr.color}`}>{pr.label}</span>
                  <span className={`text-[10px] uppercase tracking-widest rounded-full px-2 py-1 ${st.color}`}>{st.label}</span>
                  {m.assigned_to && <AssigneeChip email={m.assigned_to} assignees={assignees} size={20} />}
                </summary>
                <div className="px-4 pb-4 pt-1 text-sm text-strong/90 space-y-3">
                  {m.phone && <p><strong className="text-muted-fg">Tel:</strong> {m.phone}</p>}
                  {m.company && <p><strong className="text-muted-fg">Bedrijf:</strong> {m.company}</p>}
                  <p className="whitespace-pre-wrap"><strong className="text-muted-fg block mb-1">Bericht:</strong>{m.message}</p>
                  {(() => {
                    const isDone = m.status === "done";
                    const canOverride = user?.role === "super_admin" || user?.role === "admin";
                    const disabled = isDone && !canOverride;
                    return (
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-app/40">
                    {disabled && <span className="text-[10px] uppercase tracking-widest bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5" data-testid={`msg-locked-${m.id || i}`}>🔒 Vergrendeld — afgerond</span>}
                    <select
                      value={m.status || "new"}
                      onChange={(e) => patch(m.id, { status: e.target.value })}
                      className="text-xs rounded-lg border border-app surface px-2 py-1 disabled:opacity-50"
                      data-testid={`msg-status-${m.id || i}`}
                      disabled={disabled}
                    >
                      {MSG_STATUS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                      <option value="archived">Gearchiveerd</option>
                    </select>
                    <select
                      value={m.priority || "P3"}
                      onChange={(e) => patch(m.id, { priority: e.target.value })}
                      className="text-xs rounded-lg border border-app surface px-2 py-1 disabled:opacity-50"
                      data-testid={`msg-priority-${m.id || i}`}
                      disabled={disabled}
                    >
                      {MSG_PRIORITY.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                    </select>
                    <select
                      value={m.assigned_to || ""}
                      onChange={(e) => patch(m.id, { assigned_to: e.target.value || null })}
                      className="text-xs rounded-lg border border-app surface px-2 py-1 disabled:opacity-50"
                      data-testid={`msg-assignee-${m.id || i}`}
                      disabled={disabled}
                    >
                      <option value="">— Niet toegewezen —</option>
                      {assignees.map((a) => (
                        <option key={a.email} value={a.email}>{assigneeLabel(a)} · {prettyRole(a.role)}</option>
                      ))}
                      {user?.email && !assignees.find((a) => a.email === user.email) && (
                        <option value={user.email}>{user.email} · (mij)</option>
                      )}
                    </select>
                    {!m.spam && (
                      <button
                        onClick={() => patch(m.id, { spam: true })}
                        className="text-xs rounded-full px-3 py-1 border border-red-200 text-red-500 hover:bg-red-50"
                        data-testid={`msg-mark-spam-${m.id || i}`}
                      >Markeer als spam</button>
                    )}
                    {m.spam && (
                      <button
                        onClick={() => patch(m.id, { spam: false })}
                        className="text-xs rounded-full px-3 py-1 border border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                        data-testid={`msg-unmark-spam-${m.id || i}`}
                      >Geen spam</button>
                    )}
                    <a
                      href={`mailto:${m.email}?subject=Re: ${encodeURIComponent(m.subject || 'PearBlue')}`}
                      className="text-xs rounded-full px-3 py-1 border border-pear-500 text-pear-500 hover:bg-pear-50"
                      data-testid={`msg-reply-${m.id || i}`}
                    >Antwoord via e-mail</a>
                    <Link
                      to={`/admin/messages/${m.id}`}
                      className="text-xs rounded-full px-3 py-1 border border-pear-500 bg-pear-500 text-white hover:bg-pear-600"
                      data-testid={`msg-open-thread-${m.id || i}`}
                    >Bekijk gesprek →</Link>
                  </div>
                    );
                  })()}
                  {(m.notes || []).length > 0 && (
                    <div className="pt-2 border-t border-app/40 space-y-1">
                      <p className="text-[10px] uppercase tracking-widest text-muted-fg">Notities</p>
                      {(m.notes || []).map((n) => (
                        <div key={n.id} className="text-xs bg-pear-50/40 dark:bg-pear-500/5 rounded p-2">
                          <div className="whitespace-pre-wrap">{n.text}</div>
                          <div className="text-[10px] text-muted-fg mt-0.5">— {n.by} · {new Date(n.at).toLocaleString("nl-NL")}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.target); addNote(m.id, fd.get("note")); e.target.reset(); }} className="flex gap-2 pt-2">
                    <input name="note" placeholder="Interne notitie…" className="flex-1 rounded-lg border border-app surface px-3 py-1.5 text-xs" data-testid={`msg-note-input-${m.id || i}`} />
                    <button type="submit" className="text-xs rounded-full px-3 py-1 border border-app hover:border-pear-500" data-testid={`msg-note-submit-${m.id || i}`}>Toevoegen</button>
                  </form>
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
};

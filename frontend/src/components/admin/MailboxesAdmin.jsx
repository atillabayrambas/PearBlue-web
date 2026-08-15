import React, { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Inbox, Plus, Send, Clock } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { API } from "./_shared";

export const MailboxesAdmin = () => {
  const { authHeader, user } = useAuth();
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ label: "", email: "", host: "", port: 993, username: "", password: "", use_ssl: true, folder: "INBOX" });
  const [selectedId, setSelectedId] = useState(null);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [ingested, setIngested] = useState([]);
  const [rebuildBusy, setRebuildBusy] = useState(false);
  const canManage = ["super_admin", "admin", "beheerder"].includes(user?.role);

  const rebuildMatches = async () => {
    setRebuildBusy(true);
    try {
      const r = await axios.post(`${API}/admin/mailboxes/rebuild-matches`, {}, { headers: authHeader() });
      const d = r.data || {};
      toast.success(`Opnieuw gematcht: ${d.matched || 0} van ${d.checked || 0}`);
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Rebuild mislukt"); }
    finally { setRebuildBusy(false); }
  };

  const load = async () => {
    try {
      const [r, l] = await Promise.all([
        axios.get(`${API}/admin/mailboxes`, { headers: authHeader() }),
        axios.get(`${API}/admin/mailboxes/ingested`, { headers: authHeader() }).catch(() => ({ data: [] })),
      ]);
      setItems(r.data || []);
      setIngested(l.data || []);
    } catch { toast.error("Kon mailboxen niet laden"); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const add = async (e) => {
    e.preventDefault();
    try {
      const r = await axios.post(`${API}/admin/mailboxes`, form, { headers: authHeader() });
      toast.success("Mailbox toegevoegd");
      setItems([...items, r.data]);
      setForm({ label: "", email: "", host: "", port: 993, username: "", password: "", use_ssl: true, folder: "INBOX" });
      setShowForm(false);
    } catch (e) { toast.error(e?.response?.data?.detail || "Toevoegen mislukt"); }
  };

  const del = async (id) => {
    if (!window.confirm("Deze mailbox verwijderen?")) return;
    try { await axios.delete(`${API}/admin/mailboxes/${id}`, { headers: authHeader() }); toast.success("Verwijderd"); load(); }
    catch { toast.error("Verwijderen mislukt"); }
  };

  const syncNow = async () => {
    setSyncBusy(true);
    setSyncResult(null);
    try {
      const r = await axios.post(`${API}/admin/mailboxes/sync-now`, {}, { headers: authHeader() });
      setSyncResult(r.data);
      toast.success(`Sync klaar — ${r.data?.ingested || 0} nieuw, ${r.data?.matched || 0} gekoppeld aan ticket`);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Sync mislukt");
    } finally { setSyncBusy(false); }
  };

  return (
    <div data-testid="cms-mailboxes">
      <div className="flex items-start justify-between gap-3 mb-2">
        <h2 className="font-heading text-2xl font-semibold text-strong flex items-center gap-2">
          <Inbox className="h-6 w-6 text-pear-500" /> Mailboxen (IMAP)
        </h2>
        {items.length > 0 && (
          <button onClick={syncNow} disabled={syncBusy} className="btn-primary text-xs shrink-0" data-testid="mailbox-sync-now">
            {syncBusy ? "Bezig…" : <><Send className="h-3.5 w-3.5" /> Sync nu</>}
          </button>
        )}
      </div>
      <p className="text-sm text-muted-fg mt-1 mb-2">
        Verbind je IMAP-mailboxen. De achtergrond-poller draait elke 60 seconden en scant elke inbox op nieuwe e-mails. Onderwerpen met <code className="font-mono text-pear-600">[#TKT-XXXXXX]</code> worden automatisch als antwoord aan de bijbehorende ticket-thread gehangen.
      </p>
      {syncResult && (
        <div className="mb-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 p-2.5 text-xs text-emerald-700 dark:text-emerald-300" data-testid="mailbox-sync-result">
          {syncResult.mailboxes} mailbox(en) gescand · {syncResult.ingested} nieuw · {syncResult.matched} gekoppeld aan ticket
        </div>
      )}

      {items.length > 1 && (
        <div className="mb-4 flex items-center gap-2 flex-wrap" data-testid="mailbox-switcher">
          <span className="text-xs uppercase tracking-widest text-muted-fg">Actieve mailbox:</span>
          {items.map((m) => (
            <button
              key={m.id}
              onClick={() => setSelectedId(m.id)}
              className={`text-xs px-3 py-1.5 rounded-full border ${selectedId === m.id ? "bg-pear-500 text-white border-pear-500" : "border-app hover:border-pear-500"}`}
              data-testid={`mailbox-switch-${m.id}`}
            >{m.label} <span className="text-muted-fg">({m.email})</span></button>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-app overflow-hidden surface mb-4">
        {items.length === 0 ? (
          <div className="p-8 text-center text-muted-fg text-sm">Nog geen mailboxen gekoppeld.</div>
        ) : (
          <ul className="divide-y divide-app">
            {items.map((m) => (
              <li key={m.id} className="p-4 flex items-center justify-between gap-4" data-testid={`mailbox-row-${m.id}`}>
                <div className="min-w-0">
                  <p className="font-semibold text-strong">{m.label}</p>
                  <p className="text-xs text-muted-fg font-mono">{m.email} · {m.host}:{m.port} {m.use_ssl && "(SSL)"} · {m.folder || "INBOX"}</p>
                  <p className="text-[10px] text-muted-fg mt-0.5">Laatste sync: {m.last_sync ? new Date(m.last_sync).toLocaleString("nl-NL") : "nooit"} {m.last_sync_counts && <span>· {m.last_sync_counts.ingested || 0} nieuw · {m.last_sync_counts.matched || 0} gekoppeld</span>}</p>
                </div>
                {canManage && (
                  <button onClick={() => del(m.id)} className="text-red-500 hover:text-red-600 text-xs px-3 py-1 border border-red-200 rounded-full" data-testid={`mailbox-delete-${m.id}`}>
                    Verwijderen
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {canManage && (
        <>
          {!showForm ? (
            <button onClick={() => setShowForm(true)} className="btn-primary" data-testid="mailbox-add-btn">
              <Plus className="h-4 w-4" /> Mailbox toevoegen
            </button>
          ) : (
            <form onSubmit={add} className="surface border border-app rounded-2xl p-6 grid grid-cols-1 md:grid-cols-2 gap-3" data-testid="mailbox-form">
              <input required placeholder="Label (bv. Support)" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className="rounded-lg border border-app surface px-3 py-2 text-sm" data-testid="mailbox-input-label" />
              <input required type="email" placeholder="you@pearblue.nl" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded-lg border border-app surface px-3 py-2 text-sm" data-testid="mailbox-input-email" />
              <input required placeholder="IMAP host (imap.provider.com)" value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} className="rounded-lg border border-app surface px-3 py-2 text-sm" data-testid="mailbox-input-host" />
              <input type="number" placeholder="Port" value={form.port} onChange={(e) => setForm({ ...form, port: parseInt(e.target.value, 10) || 993 })} className="rounded-lg border border-app surface px-3 py-2 text-sm" data-testid="mailbox-input-port" />
              <input required placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="rounded-lg border border-app surface px-3 py-2 text-sm" data-testid="mailbox-input-username" />
              <input required type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="rounded-lg border border-app surface px-3 py-2 text-sm" data-testid="mailbox-input-password" />
              <input placeholder="Folder (default INBOX)" value={form.folder} onChange={(e) => setForm({ ...form, folder: e.target.value })} className="rounded-lg border border-app surface px-3 py-2 text-sm" data-testid="mailbox-input-folder" />
              <label className="flex items-center gap-2 text-xs md:col-span-1">
                <input type="checkbox" checked={form.use_ssl} onChange={(e) => setForm({ ...form, use_ssl: e.target.checked })} className="accent-pear-500" data-testid="mailbox-input-ssl" />
                SSL/TLS (aanbevolen)
              </label>
              <div className="md:col-span-2 flex gap-2">
                <button type="submit" className="btn-primary" data-testid="mailbox-submit">Opslaan</button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary" data-testid="mailbox-cancel">Annuleer</button>
              </div>
            </form>
          )}
        </>
      )}
      {ingested.length > 0 && (
        <div className="mt-6" data-testid="mailbox-ingest-log">
          <h3 className="text-xs uppercase tracking-widest text-muted-fg mb-2 flex items-center gap-1"><Clock className="h-3 w-3" /> Laatste 100 IMAP-ingests</h3>
          <ul className="divide-y divide-app rounded-2xl border border-app surface max-h-72 overflow-y-auto">
            {ingested.slice(0, 100).map((r, i) => (
              <li key={r.uid + "-" + i} className="p-3 flex items-center justify-between gap-3 text-xs" data-testid={`mailbox-ingest-row-${i}`}>
                <div className="min-w-0 flex-1">
                  <p className="text-strong truncate">{r.subject || "(geen onderwerp)"}</p>
                  <p className="text-muted-fg truncate">{r.from_email} · {new Date(r.ingested_at).toLocaleString("nl-NL")}</p>
                </div>
                {r.ticket_ref ? (
                  <span className="rounded-full bg-pear-100 text-pear-700 px-2 py-0.5 font-mono shrink-0" data-testid={`mailbox-ingest-tkt-${r.ticket_ref}`}>#TKT-{r.ticket_ref}</span>
                ) : r.matched_kind ? (
                  <span className="rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 shrink-0 truncate max-w-[180px]" title={`${r.matched_kind} · ${r.matched_display || ""}`} data-testid={`mailbox-ingest-matched-${i}`}>
                    ✓ {r.matched_kind === "contact_auto" ? "nieuw ticket" : r.matched_kind === "review" ? "review" : r.matched_kind === "registration" ? "portaal" : r.matched_kind === "chat_handoff" ? "chat" : "contact"}
                    {r.matched_display && ` · ${r.matched_display}`}
                  </span>
                ) : (
                  <span className="rounded-full bg-slate-100 text-slate-500 px-2 py-0.5 shrink-0">Zonder ticket</span>
                )}
              </li>
            ))}
          </ul>
          <div className="flex justify-between items-center mt-2">
            <p className="text-[10px] text-muted-fg">
              Groene chip = automatisch gekoppeld aan {" "}
              <code className="font-mono">contact</code>/{" "}
              <code className="font-mono">review</code>/{" "}
              <code className="font-mono">portaal</code>/{" "}
              <code className="font-mono">chat</code>. Blauwe chip = ticket-nummer in onderwerp.
            </p>
            <button onClick={rebuildMatches} disabled={rebuildBusy} className="text-[11px] px-3 py-1 rounded-full border border-app hover:border-pear-500 disabled:opacity-40" data-testid="mailbox-rebuild-matches">
              {rebuildBusy ? "Bezig…" : "🔄 Match bestaande opnieuw"}
            </button>
          </div>
        </div>
      )}
      <p className="text-[11px] text-muted-fg mt-4">
        Wachtwoorden worden Fernet-versleuteld opgeslagen. De poller draait om de 60 seconden en verwerkt onderwerpen met <code className="font-mono">[#TKT-XXXXXX]</code> automatisch naar de juiste ticket-thread. Gebruik &quot;Sync nu&quot; om handmatig te forceren.
      </p>
    </div>
  );
};

import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Check, Trash2, Sparkles, Send, Clock, BarChart3 } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { API, StarsRow, AssigneeChip, assigneeLabel, prettyRole } from "./_shared";
import { BulkTranslateButton } from "./BulkTranslateButton";

const ManualReviewInviteRow = ({ onSent }) => {
  const { authHeader } = useAuth();
  const [email, setEmail] = useState("");
  const [project, setProject] = useState("");
  const [invoice, setInvoice] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async (e) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast.error("Geldig e-mailadres invullen"); return; }
    setBusy(true);
    try {
      const r = await axios.post(`${API}/admin/reviews/send-invite`, { email: email.trim(), project_name: project.trim() || null, invoice_id: invoice.trim() || null }, { headers: authHeader() });
      if (r.data?.delivered) {
        toast.success("Review-uitnodiging verstuurd");
      } else {
        toast.error("Kon niet versturen (mailer niet geconfigureerd?)");
      }
      setEmail(""); setProject(""); setInvoice("");
      onSent?.();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Versturen mislukt");
    } finally { setBusy(false); }
  };
  return (
    <form onSubmit={send} className="mt-4 rounded-xl surface-2 border border-app p-3" data-testid="cms-manual-invite-row">
      <p className="text-xs font-semibold text-strong mb-2 flex items-center gap-1.5"><Send className="h-3 w-3 text-violet-500" /> Handmatige review-uitnodiging <span className="text-[10px] font-normal text-muted-fg">(automatisch verzonden zodra Zoho Books-factuur op &apos;paid&apos; gaat — gebruik dit voor uitzonderingen)</span></p>
      <div className="grid sm:grid-cols-4 gap-2">
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="klant@voorbeeld.nl" className="rounded-lg border border-app px-3 py-2 text-sm sm:col-span-2" data-testid="cms-manual-invite-email" />
        <input type="text" value={project} onChange={(e) => setProject(e.target.value)} placeholder="Projectnaam (optioneel)" className="rounded-lg border border-app px-3 py-2 text-sm" data-testid="cms-manual-invite-project" />
        <input type="text" value={invoice} onChange={(e) => setInvoice(e.target.value)} placeholder="Factuur ID (optioneel)" className="rounded-lg border border-app px-3 py-2 text-sm" data-testid="cms-manual-invite-invoice" />
      </div>
      <button type="submit" disabled={busy} className="btn-primary text-xs mt-3" data-testid="cms-manual-invite-send">
        {busy ? "Bezig…" : <><Send className="h-3 w-3" /> Verstuur uitnodiging</>}
      </button>
    </form>
  );
};


export const ReviewsAdmin = () => {
  const { authHeader, user } = useAuth();
  const [items, setItems] = useState([]);
  const [assignees, setAssignees] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [invLog, setInvLog] = useState([]);
  const [scanBusy, setScanBusy] = useState(false);
  const [autopilotStatus, setAutopilotStatus] = useState(null);
  const [weekly, setWeekly] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    axios.get(`${API}/reviews/all`, { headers: authHeader() })
      .then((r) => setItems(r.data || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
    axios.get(`${API}/admin/reviews/invite-log`, { headers: authHeader() })
      .then((r) => setInvLog(r.data || []))
      .catch(() => setInvLog([]));
    axios.get(`${API}/admin/assignees`, { headers: authHeader() })
      .then((r) => setAssignees(r.data || []))
      .catch(() => setAssignees([]));
    axios.get(`${API}/admin/reviews/books-autopilot-status`, { headers: authHeader() })
      .then((r) => setAutopilotStatus(r.data || null))
      .catch(() => setAutopilotStatus(null));
    axios.get(`${API}/admin/reviews/books-autopilot-weekly?days=7`, { headers: authHeader() })
      .then((r) => setWeekly(r.data || null))
      .catch(() => setWeekly(null));
  }, [authHeader]);
  useEffect(() => { load(); }, [load]);

  const scanInvites = async () => {
    setScanBusy(true);
    try {
      const r = await axios.post(`${API}/admin/reviews/scan-invites`, {}, { headers: authHeader() });
      const { scanned = 0, invited = 0, skipped = 0, errors = [] } = r.data || {};
      if (invited > 0) toast.success(`${invited} uitnodiging${invited === 1 ? "" : "en"} verstuurd (van ${scanned} voltooide projecten, ${skipped} al eerder verwerkt)`);
      else toast.info(`${scanned} voltooide projecten gescand — ${skipped} al eerder uitgenodigd, 0 nieuwe.`);
      if (errors.length) toast.warning(`${errors.length} waarschuwing${errors.length === 1 ? "" : "en"}: ${errors[0]}`);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Scan mislukt");
    } finally { setScanBusy(false); }
  };

  const patch = async (id, updates) => {
    setBusy(id);
    try {
      await axios.patch(`${API}/reviews/${id}`, updates, { headers: authHeader() });
      toast.success("Review bijgewerkt");
      load();
    } catch { toast.error("Bijwerken mislukt"); } finally { setBusy(null); }
  };

  const remove = async (id) => {
    if (!window.confirm("Deze review permanent verwijderen?")) return;
    setBusy(id);
    try {
      await axios.delete(`${API}/reviews/${id}`, { headers: authHeader() });
      toast.success("Verwijderd");
      load();
    } catch { toast.error("Verwijderen mislukt"); } finally { setBusy(null); }
  };

  const visible = items.filter((r) => {
    if (filter === "pending") return !r.approved;
    if (filter === "approved") return r.approved && !r.featured;
    if (filter === "featured") return r.featured;
    return true;
  });

  return (
    <div data-testid="cms-reviews">
      <header className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-medium text-strong">Klantreviews</h1>
          <p className="text-sm text-muted-fg mt-1">Beoordeel binnenkomende reviews en markeer je favorieten om ze op de homepage te tonen.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { k: "all", l: "Alles" },
            { k: "pending", l: "Openstaand" },
            { k: "approved", l: "Goedgekeurd" },
            { k: "featured", l: "Uitgelicht" },
          ].map((f) => (
            <button key={f.k} onClick={() => setFilter(f.k)} data-testid={`reviews-filter-${f.k}`}
              className={`text-xs rounded-full px-3 py-1.5 border transition-colors ${
                filter === f.k ? "bg-pear-500 text-white border-pear-500" : "surface text-strong border-app hover:border-pear-500"
              }`}>{f.l}</button>
          ))}
        </div>
      </header>

      <div className="flex justify-end mb-3">
        <BulkTranslateButton
          items={items.filter((r) => r.approved)}
          itemLabel={(r) => `${r.name} · ${(r.quote || "").slice(0, 40)}…`}
          needsTranslation={(r) => r.quote && !r.quote_en}
          fields={[{ srcKey: "quote", dstKey: "quote_en" }]}
          patchUrl={(r) => `${API}/reviews/${r.id}`}
          onDone={load}
          testid="cms-reviews-bulk-translate"
        />
      </div>

      <section className="surface border border-app rounded-2xl p-5 mb-6" data-testid="cms-invite-panel">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="font-heading font-semibold text-strong flex items-center gap-2"><Send className="h-4 w-4 text-pear-500" /> Automatische review-uitnodigingen</h2>
            <p className="text-xs text-muted-fg mt-1">Twee scanners draaien elke 15 min: (1) Zoho <em>Projects</em> → status <em>closed</em>, (2) Zoho <em>Books</em> → factuur op <em>paid</em>. Beide sturen automatisch een tweetalige review-uitnodiging (met dedupe).</p>
            {autopilotStatus?.at && (
              <div className="mt-2 flex items-center gap-2 text-[11px]" data-testid="cms-books-autopilot-status">
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${autopilotStatus.errors?.length ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-700"}`}>
                  {autopilotStatus.errors?.length ? "✗" : "✓"} Books-autopilot · {autopilotStatus.trigger === "manual" ? "handmatig" : "auto"}
                </span>
                <span className="text-muted-fg">
                  {new Date(autopilotStatus.at).toLocaleString("nl-NL")} · gescand {autopilotStatus.scanned}, verstuurd {autopilotStatus.invited}, overgeslagen {autopilotStatus.skipped}
                </span>
                {autopilotStatus.errors?.length > 0 && (
                  <span className="text-red-600 truncate max-w-md" title={autopilotStatus.errors.join(" · ")}>
                    — {autopilotStatus.errors[0]}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={scanInvites} disabled={scanBusy} className="btn-secondary text-xs" data-testid="cms-invite-scan-now">
              {scanBusy ? "…" : <><Send className="h-3.5 w-3.5" /> Scan Projects</>}
            </button>
            <button onClick={async () => { try { const r = await axios.post(`${API}/admin/reviews/scan-books-invoices`, {}, { headers: authHeader() }); toast.success(`Books: ${r.data?.invited || 0} verzonden · ${r.data?.skipped || 0} overgeslagen`); if (r.data?.errors?.length) toast.warning(r.data.errors[0]); load(); } catch (e) { toast.error(e?.response?.data?.detail || "Scan mislukt"); } }} className="btn-primary text-xs" data-testid="cms-invite-scan-books">
              <Send className="h-3.5 w-3.5" /> Scan Books nu
            </button>
          </div>
        </div>
        <ManualReviewInviteRow onSent={() => axios.get(`${API}/admin/reviews/invite-log`, { headers: authHeader() }).then((r) => setInvLog(r.data || [])).catch(() => {})} />
        {invLog.length > 0 && (
          <div className="mt-5 border-t border-app pt-4">
            <h3 className="text-xs uppercase tracking-widest text-muted-fg mb-2 flex items-center gap-1"><Clock className="h-3 w-3" /> Laatste uitnodigingen ({invLog.length})</h3>
            <ul className="divide-y divide-app max-h-56 overflow-y-auto text-sm" data-testid="cms-invite-log">
              {invLog.slice(0, 15).map((l, i) => (
                <li key={`${l.project_id || "inv"}-${l.recorded_at || i}`} className="py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-strong truncate">{l.project_name || l.project_id} {l.manual && <span className="text-[10px] uppercase tracking-widest rounded-full px-1.5 py-0.5 bg-violet-100 text-violet-700 ml-1">Handmatig</span>}</p>
                    <p className="text-xs text-muted-fg truncate">{l.email || "geen klant-e-mail gevonden"}</p>
                  </div>
                  <span className={`text-[10px] uppercase tracking-widest rounded-full px-2 py-0.5 font-bold shrink-0 ${l.delivered ? "bg-pear-100 text-pear-700" : "bg-amber-100 text-amber-700"}`}>
                    {l.delivered ? "Verstuurd" : "Overgeslagen"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {weekly && (
          <div className="mt-5 border-t border-app pt-4" data-testid="cms-books-autopilot-weekly">
            <h3 className="text-xs uppercase tracking-widest text-muted-fg mb-3 flex items-center gap-1">
              <BarChart3 className="h-3 w-3" /> Autopilot weekrapport (laatste {weekly.range_days} dagen)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <div className="rounded-xl surface-2 border border-app p-3">
                <p className="text-[10px] uppercase tracking-widest text-muted-fg">Totaal</p>
                <p className="font-heading text-2xl font-medium text-strong" data-testid="weekly-total">{weekly.invites_total}</p>
              </div>
              <div className="rounded-xl surface-2 border border-emerald-200 dark:border-emerald-500/30 p-3">
                <p className="text-[10px] uppercase tracking-widest text-emerald-700">Verstuurd</p>
                <p className="font-heading text-2xl font-medium text-emerald-700" data-testid="weekly-delivered">{weekly.invites_delivered}</p>
              </div>
              <div className="rounded-xl surface-2 border border-amber-200 dark:border-amber-500/30 p-3">
                <p className="text-[10px] uppercase tracking-widest text-amber-700">Overgeslagen</p>
                <p className="font-heading text-2xl font-medium text-amber-700" data-testid="weekly-skipped">{weekly.invites_skipped}</p>
              </div>
              <div className={`rounded-xl surface-2 border p-3 ${weekly.invites_errored > 0 ? "border-red-200 dark:border-red-500/30" : "border-app"}`}>
                <p className={`text-[10px] uppercase tracking-widest ${weekly.invites_errored > 0 ? "text-red-600" : "text-muted-fg"}`}>Fouten</p>
                <p className={`font-heading text-2xl font-medium ${weekly.invites_errored > 0 ? "text-red-600" : "text-strong"}`} data-testid="weekly-errored">{weekly.invites_errored}</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-fg mb-2">
              <span>Aflever-ratio: <strong className="text-strong">{weekly.delivery_rate}%</strong></span>
              {weekly.last_run?.at && <span>Laatste scan: {new Date(weekly.last_run.at).toLocaleString("nl-NL")}</span>}
            </div>
            {weekly.per_day?.length > 0 && (
              <div className="flex items-end gap-1 h-16 rounded-xl surface-2 border border-app p-2" data-testid="weekly-sparkline">
                {(() => {
                  const max = Math.max(1, ...weekly.per_day.map((d) => d.delivered + d.skipped));
                  return weekly.per_day.map((d) => {
                    const total = d.delivered + d.skipped;
                    const deliveredPct = total ? (d.delivered / max) * 100 : 0;
                    const skippedPct = total ? (d.skipped / max) * 100 : 0;
                    return (
                      <div key={d.date} className="flex-1 flex flex-col items-center justify-end gap-0.5" title={`${d.date} · ${d.delivered} verstuurd, ${d.skipped} overgeslagen`}>
                        <div className="w-full bg-emerald-500 rounded-sm" style={{ height: `${deliveredPct}%` }} />
                        <div className="w-full bg-amber-400 rounded-sm" style={{ height: `${skippedPct}%` }} />
                        <span className="text-[8px] text-muted-fg mt-0.5">{d.date.slice(5)}</span>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
            {weekly.recent_errors?.length > 0 && (
              <div className="mt-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 p-2 text-[11px] text-red-700 dark:text-red-400" data-testid="weekly-errors">
                <p className="font-semibold mb-1">Recente fouten:</p>
                <ul className="space-y-0.5 list-disc list-inside">
                  {weekly.recent_errors.slice(0, 5).map((e, i) => (
                    <li key={i}><span className="font-mono">{e.email || "—"}</span>: {e.error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>
      {loading ? (
        <p className="text-muted-fg">Laden…</p>
      ) : visible.length === 0 ? (
        <div className="surface border border-app rounded-2xl p-10 text-center text-muted-fg">Geen reviews in deze filter.</div>
      ) : (
        <div className="surface border border-app rounded-2xl divide-y divide-app">
          {visible.map((r) => (
            <div key={r.id} className="p-4" data-testid={`cms-review-${r.id}`}>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="font-semibold text-strong break-words">{r.name}</p>
                    <StarsRow n={r.rating} />
                    {r.approved && <span className="text-[10px] uppercase tracking-widest rounded-full px-2 py-0.5 font-bold bg-pear-100 text-pear-700">Live</span>}
                    {r.featured && <span className="text-[10px] uppercase tracking-widest rounded-full px-2 py-0.5 font-bold bg-amber-100 text-amber-700">Uitgelicht</span>}
                  </div>
                  <p className="text-xs text-muted-fg mt-0.5 break-words">
                    {[r.company, r.project].filter(Boolean).join(" · ")} · {new Date(r.created_at).toLocaleString("nl-NL")}
                  </p>
                  <p className="text-sm text-strong/90 mt-2 whitespace-pre-wrap break-words">&ldquo;{r.quote}&rdquo;</p>
                  {r.assigned_to && <div className="mt-2"><AssigneeChip email={r.assigned_to} assignees={assignees} size={22} /></div>}
                </div>
                <div className="flex flex-wrap gap-1.5 sm:gap-2 sm:shrink-0 w-full sm:w-auto sm:min-w-[180px]">
                  <select
                    value={r.assigned_to || ""}
                    onChange={(e) => patch(r.id, { assigned_to: e.target.value || null })}
                    className="text-xs rounded-lg border border-app surface px-2 py-1 w-full sm:w-auto"
                    data-testid={`review-assignee-${r.id}`}
                  >
                    <option value="">— Niet toegewezen —</option>
                    {assignees.map((a) => (
                      <option key={a.email} value={a.email}>{assigneeLabel(a)} · {prettyRole(a.role)}</option>
                    ))}
                    {user?.email && !assignees.find((a) => a.email === user.email) && (
                      <option value={user.email}>{user.email} · (mij)</option>
                    )}
                  </select>
                  <button onClick={() => patch(r.id, { approved: !r.approved })} disabled={busy === r.id}
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2.5 py-1.5 disabled:opacity-50 ${
                      r.approved ? "surface-2 text-strong border border-app" : "bg-pear-500 text-white hover:bg-pear-600"
                    }`}
                    data-testid={`review-approve-${r.id}`}>
                    <Check className="h-3.5 w-3.5" /> {r.approved ? "Intrekken" : "Goedkeuren"}
                  </button>
                  <button onClick={() => patch(r.id, { featured: !r.featured, approved: true })} disabled={busy === r.id}
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2.5 py-1.5 disabled:opacity-50 ${
                      r.featured ? "surface-2 text-strong border border-app" : "bg-amber-500 text-white hover:bg-amber-600"
                    }`}
                    data-testid={`review-feature-${r.id}`}>
                    <Sparkles className="h-3.5 w-3.5" /> {r.featured ? "Van home" : "Op home"}
                  </button>
                  <button onClick={() => remove(r.id)} disabled={busy === r.id}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold rounded-full surface-2 text-red-500 border border-red-200 px-2.5 py-1.5 hover:bg-red-50 disabled:opacity-50"
                    data-testid={`review-delete-${r.id}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

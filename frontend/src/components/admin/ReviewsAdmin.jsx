import React, { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Check, Trash2, Sparkles, Send, Clock } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { API, StarsRow, AssigneeChip, assigneeLabel, prettyRole } from "./_shared";

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
      <p className="text-xs font-semibold text-strong mb-2 flex items-center gap-1.5"><Send className="h-3 w-3 text-violet-500" /> Handmatige review-uitnodiging <span className="text-[10px] font-normal text-muted-fg">(gebruik voor betaalde facturen — auto-trigger volgt zodra Zoho Books live is)</span></p>
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

  const load = () => {
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
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

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

      <section className="surface border border-app rounded-2xl p-5 mb-6" data-testid="cms-invite-panel">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="font-heading font-semibold text-strong flex items-center gap-2"><Send className="h-4 w-4 text-pear-500" /> Automatische review-uitnodigingen</h2>
            <p className="text-xs text-muted-fg mt-1">Zoho-projecten met status <em>closed</em> krijgen automatisch een tweetalige review-uitnodiging (klant e-mail via Zoho Books). Poller draait elke 15 min.</p>
          </div>
          <button onClick={scanInvites} disabled={scanBusy} className="btn-primary shrink-0" data-testid="cms-invite-scan-now">
            {scanBusy ? "Bezig…" : <><Send className="h-4 w-4" /> Scan nu</>}
          </button>
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

import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Check, XCircle } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { API, STATUS_STYLE, AssigneeChip, assigneeLabel, prettyRole } from "./_shared";

export const RegistrationsAdmin = () => {
  const { authHeader, user } = useAuth();
  const [items, setItems] = useState([]);
  const [assignees, setAssignees] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      axios.get(`${API}/portal/registrations`, { headers: authHeader() }),
      axios.get(`${API}/admin/assignees`, { headers: authHeader() }),
    ])
      .then(([r, a]) => { setItems(r.data || []); setAssignees(a.data || []); })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [authHeader]);
  useEffect(() => { load(); }, [load]);

  const review = async (id, status) => {
    const note = status === "rejected"
      ? window.prompt("Reden voor afwijzing (optioneel, wordt in e-mail meegestuurd):", "") ?? ""
      : "";
    setBusy(id);
    try {
      await axios.patch(`${API}/portal/registrations/${id}`, { status, admin_note: note || null }, { headers: authHeader() });
      toast.success(status === "approved" ? "Goedgekeurd — e-mail verstuurd" : "Afgewezen — e-mail verstuurd");
      load();
    } catch { toast.error("Kon status niet bijwerken"); } finally { setBusy(null); }
  };

  const assign = async (id, email) => {
    try {
      const cur = items.find((x) => x.id === id);
      await axios.patch(`${API}/portal/registrations/${id}`, { status: cur?.status || "pending", assigned_to: email || null }, { headers: authHeader() });
      toast.success(email ? "Toegewezen" : "Toewijzing verwijderd");
      load();
    } catch { toast.error("Toewijzen mislukt"); }
  };

  const visible = filter === "all" ? items : items.filter((i) => i.status === filter);

  return (
    <div data-testid="cms-registrations">
      <header className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-medium text-strong">Portaal-aanvragen</h1>
          <p className="text-sm text-muted-fg mt-1">Beoordeel nieuwe klantregistraties. Goedgekeurde klanten krijgen automatisch een e-mail met inloginstructies.</p>
        </div>
        <div className="flex gap-2">
          {[
            { k: "all", l: "Alles" },
            { k: "pending", l: "Openstaand" },
            { k: "approved", l: "Goedgekeurd" },
            { k: "rejected", l: "Afgewezen" },
          ].map((f) => (
            <button key={f.k} onClick={() => setFilter(f.k)}
              data-testid={`registrations-filter-${f.k}`}
              className={`text-xs rounded-full px-3 py-1.5 border transition-colors ${
                filter === f.k ? "bg-pear-500 text-white border-pear-500" : "surface text-strong border-app hover:border-pear-500"
              }`}>{f.l}</button>
          ))}
        </div>
      </header>
      {loading ? (
        <p className="text-muted-fg">Laden…</p>
      ) : visible.length === 0 ? (
        <div className="surface border border-app rounded-2xl p-10 text-center text-muted-fg">Geen aanvragen in deze filter.</div>
      ) : (
        <div className="surface border border-app rounded-2xl divide-y divide-app">
          {visible.map((r, i) => (
            <div key={r.id || i} className="p-4" data-testid={`cms-registration-${r.id}`}>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-strong break-words">{r.name}</p>
                    <span className={`text-[10px] uppercase tracking-widest rounded-full px-2 py-0.5 font-bold ${STATUS_STYLE[r.status] || "bg-slate-200 text-slate-700"}`}>{r.status}</span>
                  </div>
                  <p className="text-xs text-muted-fg mt-0.5 break-words">
                    {r.email}{r.company ? ` · ${r.company}` : ""}{r.phone ? ` · ${r.phone}` : ""} · {new Date(r.created_at).toLocaleString("nl-NL")}
                  </p>
                  {(r.address || r.postal_code || r.city) && (
                    <p className="text-xs text-muted-fg mt-0.5 break-words">
                      {[r.address, r.postal_code, r.city, r.region, r.country].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  {r.message && <p className="text-sm text-strong/80 mt-2 whitespace-pre-wrap break-words">{r.message}</p>}
                  {r.admin_note && <p className="text-xs text-muted-fg italic mt-2 break-words">Notitie: {r.admin_note}</p>}
                  {r.assigned_to && <div className="mt-2"><AssigneeChip email={r.assigned_to} assignees={assignees} size={22} /></div>}
                </div>
                <div className="flex flex-col gap-2 sm:shrink-0 w-full sm:w-auto sm:min-w-[180px]">
                  {r.status === "pending" && (
                    <select
                      value={r.assigned_to || ""}
                      onChange={(e) => assign(r.id, e.target.value || null)}
                      className="text-xs rounded-lg border border-app surface px-2 py-1.5 w-full"
                      data-testid={`registration-assignee-${r.id}`}
                    >
                      <option value="">— Niet toegewezen —</option>
                      {assignees.map((a) => (
                        <option key={a.email} value={a.email}>{assigneeLabel(a)} · {prettyRole(a.role)}</option>
                      ))}
                      {user?.email && !assignees.find((a) => a.email === user.email) && (
                        <option value={user.email}>{user.email} · (mij)</option>
                      )}
                    </select>
                  )}
                  {r.status === "pending" && (
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => review(r.id, "approved")} disabled={busy === r.id}
                      className="flex-1 inline-flex items-center justify-center gap-1 text-xs font-semibold rounded-full bg-pear-500 text-white px-3 py-1.5 hover:bg-pear-600 disabled:opacity-50"
                      data-testid={`registration-approve-${r.id}`}>
                      <Check className="h-3.5 w-3.5" /> Goedkeuren
                    </button>
                    <button onClick={() => review(r.id, "rejected")} disabled={busy === r.id}
                      className="flex-1 inline-flex items-center justify-center gap-1 text-xs font-semibold rounded-full surface-2 text-red-500 border border-red-200 px-3 py-1.5 hover:bg-red-50 disabled:opacity-50"
                      data-testid={`registration-reject-${r.id}`}>
                      <XCircle className="h-3.5 w-3.5" /> Afwijzen
                    </button>
                  </div>
                )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Plus, Trash2, Save, Settings as SettingsIcon, Eye, ChevronLeft, ChevronRight, ShieldCheck, ShieldX } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { useLang } from "../../i18n/LanguageContext";
import { Avatar } from "../Avatar";
import { AvatarPicker } from "../AvatarPicker";
import { PhoneInput } from "../PhoneInput";
import { usePostalLookup, extractNlPostcode, extractHouseNumber, NL_POSTCODE_RE, isoToFlag, guessCountryCode } from "../../hooks/usePostalLookup";
import { API, ROLE_LABELS, USER_COL_DEFS, readUserCols, generatePearAvatar } from "./_shared";

export const UsersAdmin = () => {
  const { authHeader, user: me } = useAuth();
  const { lang } = useLang();
  const en = lang === "en";
  const colLabel = (c) => (en ? c.labelEn : c.label);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ email: "", role: "gebruiker", password: "", display_name: "" });
  const [editingUser, setEditingUser] = useState(null); // email being edited
  const [quickViewUser, setQuickViewUser] = useState(null); // read-only detail email
  const [cols, setCols] = useState(readUserCols);
  const [colMenuOpen, setColMenuOpen] = useState(false);
  const [pageSize, setPageSize] = useState(() => Number(localStorage.getItem("pb_user_page_size")) || 20);
  const [page, setPage] = useState(1);
  const persistCols = (next) => { setCols(next); try { localStorage.setItem("pb_user_cols", JSON.stringify(next)); } catch { /* ignore */ } };
  const setPageSizePersist = (n) => { setPageSize(n); setPage(1); try { localStorage.setItem("pb_user_page_size", String(n)); } catch { /* ignore */ } };
  const toggleCol = (k) => {
    if (cols.includes(k)) persistCols(cols.filter((c) => c !== k));
    else persistCols([...cols, k]);
  };
  const visibleCols = USER_COL_DEFS.filter((c) => c.fixed || cols.includes(c.key));

  const isSuperAdmin = (me?.role === "super_admin" || me?.role === "admin");
  const isBeheerder = isSuperAdmin || me?.role === "beheerder";

  const load = () => {
    setLoading(true);
    Promise.all([
      axios.get(`${API}/admin/users`, { headers: authHeader() }),
      axios.get(`${API}/admin/roles`, { headers: authHeader() }),
      axios.get(`${API}/admin/activity-log?limit=50`, { headers: authHeader() }),
    ])
      .then(([u, r, l]) => { setUsers(u.data || []); setRoles(r.data || []); setLogs(l.data || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const createUser = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await axios.post(`${API}/admin/users`, form, { headers: authHeader() });
      toast.success("Gebruiker aangemaakt");
      setForm({ email: "", role: "gebruiker", password: "", display_name: "" });
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Aanmaken mislukt");
    } finally { setCreating(false); }
  };

  const updateRole = async (email, role) => {
    try {
      await axios.patch(`${API}/admin/users/${encodeURIComponent(email)}`, { role }, { headers: authHeader() });
      toast.success(`Rol bijgewerkt naar ${ROLE_LABELS[role] || role}`);
      load();
    } catch (err) { toast.error(err?.response?.data?.detail || "Bijwerken mislukt"); }
  };

  const remove = async (email) => {
    if (!window.confirm(`${email} verwijderen? Zoho-koppeling blijft bestaan.`)) return;
    try {
      await axios.delete(`${API}/admin/users/${encodeURIComponent(email)}`, { headers: authHeader() });
      toast.success("Verwijderd");
      load();
    } catch (err) { toast.error(err?.response?.data?.detail || "Verwijderen mislukt"); }
  };

  return (
    <div data-testid="cms-users">
      <header className="mb-6">
        <h1 className="font-heading text-3xl font-medium text-strong">{en ? "Users & roles" : "Gebruikers & rollen"}</h1>
        <p className="text-sm text-muted-fg mt-1">{en ? "Manage who can access the CMS and what they can do. Zoho linkage is auto-detected by email address." : "Beheer wie toegang heeft tot het CMS en welke rechten ze hebben. Zoho-koppeling wordt automatisch gedetecteerd op e-mailadres."}</p>
      </header>

      <section className="surface border border-app rounded-2xl p-5 mb-6" data-testid="cms-users-create">
        <h2 className="font-heading font-semibold text-strong mb-3">{en ? "New user" : "Nieuwe gebruiker"}</h2>
        <form onSubmit={createUser} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input required type="email" placeholder={en ? "email address" : "e-mailadres"} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
            data-testid="user-form-email" className="rounded-xl surface-2 border border-transparent focus:border-pear-500 px-3 py-2 text-sm outline-none text-strong" />
          <input type="text" placeholder={en ? "Name (optional)" : "Naam (optioneel)"} value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })}
            data-testid="user-form-name" className="rounded-xl surface-2 border border-transparent focus:border-pear-500 px-3 py-2 text-sm outline-none text-strong" />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
            data-testid="user-form-role" className="rounded-xl surface-2 border border-transparent focus:border-pear-500 px-3 py-2 text-sm outline-none text-strong">
            {Object.entries(ROLE_LABELS).filter(([k]) => k !== "admin").map(([k, v]) => (
              <option key={k} value={k} disabled={k === "super_admin" && !isSuperAdmin}>{v}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <input type="password" placeholder="Wachtwoord (leeg = Zoho)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
              data-testid="user-form-password" className="flex-1 rounded-xl surface-2 border border-transparent focus:border-pear-500 px-3 py-2 text-sm outline-none text-strong" />
            <button type="submit" disabled={creating} className="btn-primary shrink-0" data-testid="user-form-submit">
              {creating ? "…" : <><Plus className="h-4 w-4" /></>}
            </button>
          </div>
        </form>
      </section>

      <section className="surface border border-app rounded-2xl mb-6">
        {loading ? <p className="p-6 text-muted-fg text-sm">Laden…</p> : (
          <>
            {/* Column toggle + page size */}
            <div className="px-4 py-2 border-b border-app flex flex-wrap items-center gap-2 relative">
              <span className="text-[10px] uppercase tracking-widest text-muted-fg">{users.length} gebruiker(s)</span>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-1 text-xs text-muted-fg">
                  Per pagina
                  <select value={pageSize} onChange={(e) => setPageSizePersist(Number(e.target.value))} className="rounded-lg surface-2 border border-app px-2 py-1 text-xs" data-testid="users-page-size">
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={200}>200</option>
                  </select>
                </label>
                <button type="button" onClick={() => setColMenuOpen((v) => !v)} className="text-xs rounded-full border border-app px-3 py-1 hover:border-pear-500 inline-flex items-center gap-1" data-testid="users-col-menu-toggle">
                  <SettingsIcon className="h-3.5 w-3.5" /> {en ? "Columns" : "Kolommen"}
                </button>
              </div>
              {colMenuOpen && (
                <div className="absolute top-full right-2 mt-1 w-56 surface border border-app rounded-2xl shadow-lg z-30 p-2" data-testid="users-col-menu">
                  {USER_COL_DEFS.map((c) => (
                    <label key={c.key} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-strong ${c.fixed ? "opacity-60" : "hover:bg-pear-100/50 cursor-pointer"}`}>
                      <input
                        type="checkbox"
                        checked={c.fixed || cols.includes(c.key)}
                        disabled={c.fixed}
                        onChange={() => toggleCol(c.key)}
                        className="accent-pear-500 h-3.5 w-3.5"
                        data-testid={`users-col-toggle-${c.key}`}
                      />
                      {colLabel(c)}
                    </label>
                  ))}
                  <button onClick={() => setColMenuOpen(false)} className="w-full text-center text-[10px] uppercase tracking-widest text-muted-fg mt-2 pt-2 border-t border-app hover:text-strong">{en ? "Close" : "Sluiten"}</button>
                </div>
              )}
            </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[860px]" data-testid="cms-users-table">
            <thead className="text-xs uppercase tracking-widest text-muted-fg">
              <tr>
                {visibleCols.map((c) => (
                  <th key={c.key} className="text-left px-4 py-3">{colLabel(c)}</th>
                ))}
                <th className="text-right px-4 py-3 w-[140px]">{en ? "Actions" : "Acties"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app">
              {users.slice((page - 1) * pageSize, page * pageSize).map((u) => {
                const initial = (u.first_name || "").trim().charAt(0).toUpperCase();
                const nameDisplay = (u.first_name || u.last_name)
                  ? `${u.first_name || ""} ${initial ? initial + "." : ""} ${u.last_name || ""}`.trim().replace(/\s+/g, " ")
                  : (u.display_name || "—");
                return (
                <tr key={u.email} data-testid={`user-row-${u.email}`}>
                  {visibleCols.map((c) => {
                    if (c.key === "email") return (
                      <td key="email" className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar name={nameDisplay} email={u.email} profilePicture={u.profile_picture} size={32} />
                          <div className="min-w-0">
                            <p className="font-medium text-strong truncate">{u.email}</p>
                            {u.display_name && <p className="text-xs text-muted-fg truncate">{u.display_name}</p>}
                          </div>
                        </div>
                      </td>
                    );
                    if (c.key === "name") return (
                      <td key="name" className="px-4 py-3 text-strong whitespace-nowrap">{nameDisplay}</td>
                    );
                    if (c.key === "role") return (
                      <td key="role" className="px-4 py-3">
                        <select
                          value={u.role}
                          disabled={u.email === me?.email}
                          onChange={(e) => updateRole(u.email, e.target.value)}
                          data-testid={`user-role-${u.email}`}
                          className="rounded-lg surface-2 border border-transparent focus:border-pear-500 px-2 py-1 text-xs outline-none text-strong w-full max-w-[180px]"
                        >
                          {Object.entries(ROLE_LABELS).filter(([k]) => k !== "admin").map(([k, v]) => (
                            <option key={k} value={k} disabled={k === "super_admin" && !isSuperAdmin}>{v}</option>
                          ))}
                        </select>
                      </td>
                    );
                    if (c.key === "company") return <td key="company" className="px-4 py-3 text-strong text-xs">{u.company || "—"}</td>;
                    if (c.key === "phone") return <td key="phone" className="px-4 py-3 text-xs">{u.phone || "—"}</td>;
                    if (c.key === "city") return <td key="city" className="px-4 py-3 text-xs">{u.city || "—"}</td>;
                    if (c.key === "country") return <td key="country" className="px-4 py-3 text-xs">{u.country || "—"}</td>;
                    if (c.key === "zoho") return (
                      <td key="zoho" className="px-4 py-3">
                        {u.zoho_linked ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-700 px-2.5 py-1" data-testid={`user-zoho-linked-${u.email}`}>
                            <ShieldCheck className="h-3 w-3" /> Gekoppeld
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold rounded-full bg-red-100 text-red-700 px-2.5 py-1" data-testid={`user-zoho-unlinked-${u.email}`}>
                            <ShieldX className="h-3 w-3" /> Niet gekoppeld
                          </span>
                        )}
                      </td>
                    );
                    return null;
                  })}
                  <td className="px-4 py-3 text-right w-[140px]">
                    <div className="inline-flex items-center gap-1 justify-end">
                      <button
                        onClick={() => setQuickViewUser(u.email)}
                        data-testid={`user-view-${u.email}`}
                        aria-label="Snelle weergave"
                        title="Snelle weergave"
                        className="inline-flex items-center justify-center h-8 w-8 rounded-full border border-pear-500 text-pear-500 hover:bg-pear-500/10 transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setEditingUser(u.email)}
                        data-testid={`user-edit-${u.email}`}
                        aria-label="Bewerken"
                        title="Bewerken"
                        className="inline-flex items-center justify-center h-8 w-8 rounded-full border border-app text-strong hover:border-pear-500 hover:text-pear-500 transition-colors"
                      >
                        <SettingsIcon className="h-3.5 w-3.5" />
                      </button>
                      {u.email !== me?.email && u.auth_source !== "zoho-only" ? (
                        <button
                          onClick={() => remove(u.email)}
                          data-testid={`user-delete-${u.email}`}
                          aria-label="Verwijderen"
                          title="Verwijderen"
                          className="inline-flex items-center justify-center h-8 w-8 rounded-full border border-red-200 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        // Placeholder to keep alignment consistent for admins/zoho users
                        <span className="inline-block h-8 w-8" aria-hidden="true" />
                      )}
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          {/* Pagination footer */}
          {users.length > pageSize && (
            <div className="px-4 py-2 border-t border-app flex flex-wrap items-center justify-between gap-2 text-xs" data-testid="users-pagination">
              <span className="text-muted-fg">
                {`${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, users.length)} van ${users.length}`}
              </span>
              <div className="inline-flex items-center gap-1">
                <button type="button" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="inline-flex items-center gap-1 rounded-full border border-app px-3 py-1 hover:border-pear-500 disabled:opacity-40 disabled:cursor-not-allowed" data-testid="users-page-prev">
                  <ChevronLeft className="h-3 w-3" /> Vorige
                </button>
                <span className="px-2 text-muted-fg">Pagina {page} / {Math.ceil(users.length / pageSize)}</span>
                <button type="button" disabled={page >= Math.ceil(users.length / pageSize)} onClick={() => setPage((p) => Math.min(Math.ceil(users.length / pageSize), p + 1))} className="inline-flex items-center gap-1 rounded-full border border-app px-3 py-1 hover:border-pear-500 disabled:opacity-40 disabled:cursor-not-allowed" data-testid="users-page-next">
                  Volgende <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}
          </>
        )}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="surface border border-app rounded-2xl p-5">
          <h3 className="font-heading font-semibold text-strong mb-3">Rollen &amp; rechten</h3>
          <ul className="space-y-2 text-xs" data-testid="cms-roles-list">
            {roles.map((r) => (
              <li key={r.key} className="flex flex-wrap items-center gap-2 rounded-xl surface-2 p-3" data-testid={`role-row-${r.key}`}>
                <span className="font-semibold text-strong text-sm">{ROLE_LABELS[r.key] || r.key}</span>
                {r.permissions.length === 0 && <span className="text-muted-fg">— geen CMS rechten</span>}
                {r.permissions.map((p) => (
                  <span key={p} className="rounded-full bg-pear-100 text-pear-700 px-2 py-0.5 font-mono">{p}</span>
                ))}
              </li>
            ))}
          </ul>
        </div>
        <div className="surface border border-app rounded-2xl p-5">
          <h3 className="font-heading font-semibold text-strong mb-3">Activiteitenlog</h3>
          {logs.length === 0 ? (
            <p className="text-xs text-muted-fg">Nog geen activiteit.</p>
          ) : (
            <ul className="divide-y divide-app text-xs max-h-72 overflow-y-auto" data-testid="cms-activity-log">
              {logs.map((l, i) => (
                <li key={i} className="py-2">
                  <p className="text-strong"><span className="font-mono">{l.action}</span> {l.target && <span className="text-muted-fg">· {l.target}</span>}</p>
                  <p className="text-[10px] text-muted-fg">{l.actor_email} · {l.created_at?.slice(0, 19).replace("T", " ")}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
      {editingUser && (
        <UserDetailsModal
          email={editingUser}
          onClose={() => { setEditingUser(null); load(); }}
          canEditPassword={isBeheerder}
        />
      )}
      {quickViewUser && (
        <UserQuickViewModal email={quickViewUser} onClose={() => setQuickViewUser(null)} onEdit={() => { setEditingUser(quickViewUser); setQuickViewUser(null); }} />
      )}
    </div>
  );
};

// --- Read-only quick-view modal ---
const UserQuickViewModal = ({ email, onClose, onEdit }) => {
  const { authHeader } = useAuth();
  const [d, setD] = useState(null);
  useEffect(() => {
    axios.get(`${API}/admin/users/${encodeURIComponent(email)}/details`, { headers: authHeader() })
      .then((r) => setD(r.data)).catch(() => setD({}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);
  const row = (label, value) => (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-app/50 last:border-0">
      <span className="text-[11px] uppercase tracking-widest text-muted-fg shrink-0">{label}</span>
      <span className="text-sm text-strong text-right break-all">{value || "—"}</span>
    </div>
  );
  return (
    <div className="pb-modal" style={{ zIndex: 80 }} onClick={onClose} data-testid="user-quickview-modal">
      <div className="pb-modal-card w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <header className="px-6 py-4 border-b border-app flex items-center justify-between shrink-0 surface">
          <div className="min-w-0">
            <div className="font-heading text-lg font-semibold text-strong">Snelle weergave</div>
            <p className="text-xs text-muted-fg truncate">{email}</p>
          </div>
          <button onClick={onClose} className="text-muted-fg hover:text-strong text-2xl leading-none" data-testid="user-quickview-close">×</button>
        </header>
        <div className="pb-modal-body p-6 surface">
          {!d ? <p className="text-muted-fg text-sm">Laden…</p> : (
            <div className="flex flex-col items-center gap-3 mb-4">
              <Avatar name={`${d.first_name || ""} ${d.last_name || ""}`.trim() || email} email={email} profilePicture={d.profile_picture} size={80} />
              <p className="font-heading text-lg font-semibold text-strong">{`${d.first_name || ""} ${d.last_name || ""}`.trim() || "—"}</p>
              <p className="text-xs text-muted-fg">{d.role || "gebruiker"}</p>
            </div>
          )}
          {d && (
            <div className="text-sm">
              {row("E-mail", email)}
              {row("Telefoon", d.phone)}
              {row("Bedrijf", d.company)}
              {row("Adres", d.address)}
              {row("Postcode", d.postal_code)}
              {row("Huisnummer", d.house_number)}
              {row("Plaats", d.city)}
              {row("Regio", d.region)}
              {row("Land", d.country)}
              {row("KVK", d.kvk)}
              {row("BTW / Tax ID", d.tax_id)}
            </div>
          )}
          <UserDocumentsPanel email={email} />
        </div>
        <footer className="px-6 py-3 border-t border-app flex items-center justify-end gap-2 surface">
          <button onClick={onClose} className="text-xs px-4 py-2 rounded-full border border-app hover:border-slate-400">Sluiten</button>
          <button onClick={onEdit} className="btn-primary" data-testid="user-quickview-edit">Bewerken</button>
        </footer>
      </div>
    </div>
  );
};

// --- Documents panel used inside the Users quick-view modal.
// Admins upload contracts/invoices/other files here; the client sees them in
// the "Documenten" tab of the portal (backed by /api/portal/documents).
const UserDocumentsPanel = ({ email }) => {
  const { authHeader } = useAuth();
  const fileRef = useRef(null);
  const [docs, setDocs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [docType, setDocType] = useState("contract");
  const [label, setLabel] = useState("");

  const load = async () => {
    try {
      const r = await axios.get(`${API}/admin/portal/documents`, { params: { user_email: email }, headers: authHeader() });
      setDocs(r.data?.documents || []);
    } catch { /* keep silent — panel is best-effort */ }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [email]);

  const upload = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) { toast.error("Max 20 MB"); return; }
    setBusy(true);
    const fd = new FormData();
    fd.append("file", f);
    try {
      await axios.post(`${API}/admin/portal/documents`, fd, {
        params: { user_email: email, doc_type: docType, label: label || f.name },
        headers: { ...authHeader() },
      });
      toast.success("Document geüpload");
      setLabel("");
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Upload mislukt");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const remove = async (docId) => {
    if (!window.confirm("Document verwijderen?")) return;
    try {
      await axios.delete(`${API}/admin/portal/documents/${docId}`, { headers: authHeader() });
      toast.success("Verwijderd");
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Kon niet verwijderen");
    }
  };

  const fmtSize = (b) => b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} kB` : `${(b / 1048576).toFixed(1)} MB`;
  const badgeClass = (dt) => dt === "invoice" ? "bg-pear-100 text-pear-700" : dt === "contract" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700";

  return (
    <div className="mt-6 pt-4 border-t border-app" data-testid="user-documents-panel">
      <h4 className="font-heading text-sm font-semibold text-strong mb-2">Documenten <span className="text-muted-fg font-normal">({docs.length})</span></h4>
      <p className="text-[11px] text-muted-fg mb-3">Contracten en andere PDF&apos;s zijn direct downloadbaar voor de klant in de &quot;Documenten&quot; tab van het portaal.</p>
      <div className="flex flex-wrap gap-2 items-center rounded-xl surface-2 border border-app p-3 mb-3">
        <select value={docType} onChange={(e) => setDocType(e.target.value)} className="text-xs rounded-lg border border-app px-2 py-1.5" data-testid="user-doc-type">
          <option value="contract">Contract</option>
          <option value="invoice">Factuur</option>
          <option value="other">Overig</option>
        </select>
        <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (optioneel)" className="text-xs flex-1 min-w-[10rem] rounded-lg border border-app px-2 py-1.5" data-testid="user-doc-label" />
        <input ref={fileRef} type="file" onChange={upload} className="hidden" data-testid="user-doc-file-input" />
        <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} className="btn-primary text-xs" data-testid="user-doc-upload">
          {busy ? "…" : "Uploaden"}
        </button>
      </div>
      {docs.length === 0 ? (
        <p className="text-xs text-muted-fg">Nog geen documenten geüpload.</p>
      ) : (
        <ul className="space-y-1.5" data-testid="user-docs-list">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center gap-2 rounded-lg surface-2 border border-app px-3 py-2 text-xs" data-testid={`user-doc-row-${d.id}`}>
              <span className={`text-[9px] uppercase tracking-widest rounded-full px-1.5 py-0.5 font-bold ${badgeClass(d.doc_type)}`}>{d.doc_type}</span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-strong truncate">{d.label || d.filename}</p>
                <p className="text-muted-fg text-[10px]">{d.filename} · {fmtSize(d.size)}</p>
              </div>
              <button onClick={() => remove(d.id)} className="text-red-500 hover:text-red-600 shrink-0" title="Verwijder" data-testid={`user-doc-delete-${d.id}`}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// --- Extended user details editor modal ---
const UserDetailsModal = ({ email, onClose, canEditPassword }) => {
  const { authHeader } = useAuth();
  const [details, setDetails] = useState(null);
  const [saving, setSaving] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  useEffect(() => {
    axios.get(`${API}/admin/users/${encodeURIComponent(email)}/details`, { headers: authHeader() })
      .then((r) => setDetails(r.data))
      .catch(() => setDetails({}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  const save = async (e) => {
    e?.preventDefault?.();
    const required = ["first_name", "last_name", "address", "postal_code"];
    for (const k of required) {
      if (!details?.[k]) { toast.error(`Vul verplichte velden in: ${required.join(", ")}`); return; }
    }
    setSaving(true);
    try {
      const { role, email: _e, ...body } = details || {}; // eslint-disable-line no-unused-vars
      await axios.put(`${API}/admin/users/${encodeURIComponent(email)}/details`, body, { headers: authHeader() });
      // Notify user by email
      try { await axios.post(`${API}/admin/users/${encodeURIComponent(email)}/notify-updated`, {}, { headers: authHeader() }); } catch { /* ignore */ }
      toast.success("Opgeslagen — klant is via e-mail geïnformeerd. Zoho-sync: MOCKED.");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Opslaan mislukt");
    } finally { setSaving(false); }
  };

  const sendReset = async () => {
    try {
      await axios.post(`${API}/admin/users/${encodeURIComponent(email)}/reset-password`, {}, { headers: authHeader() });
      toast.success("Reset-mail verstuurd naar " + email);
    } catch (err) { toast.error(err?.response?.data?.detail || "Reset mislukt"); }
  };

  const changePassword = async () => {
    if (!newPassword || newPassword.length < 8) { toast.error("Minimaal 8 tekens"); return; }
    if (!window.confirm(`Wachtwoord van ${email} nu direct wijzigen?`)) return;
    try {
      await axios.post(`${API}/admin/users/${encodeURIComponent(email)}/change-password`, { new_password: newPassword, send_notification: true }, { headers: authHeader() });
      toast.success("Wachtwoord gewijzigd — klant is geïnformeerd");
      setNewPassword("");
    } catch (err) { toast.error(err?.response?.data?.detail || "Wachtwoord wijzigen mislukt"); }
  };

  const randomize = () => setDetails((d) => ({ ...(d || {}), profile_picture: generatePearAvatar(email) }));
  const removeAvatar = () => setDetails((d) => ({ ...(d || {}), profile_picture: "" }));
  const [pickerOpen, setPickerOpen] = useState(false);
  const { lookup } = usePostalLookup();
  const [lookingUp, setLookingUp] = useState(false);

  const set = (k) => (e) => setDetails((d) => ({ ...(d || {}), [k]: e.target.value }));

  const autofillFromPostcode = async () => {
    let pc = details?.postal_code;
    let hn = details?.house_number || details?.house;
    if (!pc && details?.address) {
      const found = extractNlPostcode(details.address);
      if (found) pc = found;
    }
    if (!hn && details?.address) {
      const strip = details.address.replace(NL_POSTCODE_RE, "");
      const h = extractHouseNumber(strip);
      if (h) hn = h;
    }
    if (!pc) return;
    setLookingUp(true);
    const res = await lookup(pc, hn || "", details?.address, details?.country_code);
    setLookingUp(false);
    if (res) {
      setDetails((d) => ({ ...(d || {}),
        postal_code: pc,
        house_number: hn || d?.house_number,
        address: res.street ? `${res.street}${hn ? " " + hn : ""}` : d?.address,
        city: res.city || d?.city,
        region: res.region || d?.region,
        country: res.country_name || res.country || d?.country || "Nederland",
        country_code: res.country || d?.country_code || "",
      }));
      toast.success(`Adres gevonden: ${res.street || res.city}, ${res.city}`);
    } else {
      toast.error("Kon dit adres niet vinden");
    }
  };

  return (
    <div className="pb-modal" style={{ zIndex: 80 }} onClick={onClose} data-testid="user-details-modal">
      <div className="pb-modal-card w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <header className="px-6 py-4 border-b border-app flex items-center justify-between shrink-0 surface">
          <div>
            <div className="font-heading text-lg font-semibold text-strong">Gebruiker bewerken</div>
            <p className="text-xs text-muted-fg">{email}</p>
          </div>
          <button onClick={onClose} className="text-muted-fg hover:text-strong text-2xl leading-none" data-testid="user-details-close">×</button>
        </header>
        {!details ? <p className="p-6 text-muted-fg">Laden…</p> : (
          <form onSubmit={save} className="pb-modal-body p-6 space-y-5 surface">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <Avatar name={`${details.first_name || ""} ${details.last_name || ""}`.trim() || email} email={email} profilePicture={details.profile_picture} size={64} />
              <div className="flex flex-col gap-2">
                <button type="button" onClick={() => setPickerOpen(true)} className="text-xs px-3 py-1.5 rounded-full border border-app hover:border-pear-500" data-testid="user-details-avatar-pick">Kies avatar</button>
                <button type="button" onClick={randomize} className="text-xs px-3 py-1.5 rounded-full border border-app hover:border-pear-500" data-testid="user-details-avatar-random">Random pear-avatar</button>
                <button type="button" onClick={removeAvatar} className="text-xs px-3 py-1.5 rounded-full border border-app hover:border-red-400" data-testid="user-details-avatar-remove">Terug naar initialen</button>
              </div>
            </div>
            {pickerOpen && (
              <div className="pb-modal" style={{ zIndex: 90 }} onClick={() => setPickerOpen(false)} data-testid="user-details-avatar-picker-modal">
                <div className="pb-modal-card w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
                  <header className="px-6 py-4 border-b border-app flex items-center justify-between shrink-0 surface">
                    <div className="font-heading text-lg font-semibold text-strong">Kies een avatar</div>
                    <button type="button" onClick={() => setPickerOpen(false)} className="text-2xl leading-none text-muted-fg hover:text-strong">×</button>
                  </header>
                  <div className="pb-modal-body p-6 surface">
                    <AvatarPicker
                      currentUrl={details.profile_picture}
                      onSelect={(url) => { setDetails((d) => ({ ...(d || {}), profile_picture: url || "" })); setPickerOpen(false); }}
                      onCancel={() => setPickerOpen(false)}
                    />
                  </div>
                </div>
              </div>
            )}
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[10px] uppercase tracking-widest text-muted-fg">Voornaam *</span>
                <input required value={details.first_name || ""} onChange={set("first_name")} className="mt-1 w-full rounded-lg border border-app bg-white dark:bg-slate-800 px-3 py-2 text-sm text-strong" data-testid="user-details-first-name" />
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-widest text-muted-fg">Achternaam *</span>
                <input required value={details.last_name || ""} onChange={set("last_name")} className="mt-1 w-full rounded-lg border border-app bg-white dark:bg-slate-800 px-3 py-2 text-sm text-strong" data-testid="user-details-last-name" />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-[10px] uppercase tracking-widest text-muted-fg">Adres</span>
                <input value={details.address || ""} onChange={set("address")} onBlur={autofillFromPostcode} className="mt-1 w-full rounded-lg border border-app bg-white dark:bg-slate-800 px-3 py-2 text-sm text-strong" data-testid="user-details-address" placeholder="Straat + huisnr of volledig adres" />
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-widest text-muted-fg">Postcode</span>
                <div className="flex gap-1 mt-1">
                  <input value={details.postal_code || ""} onChange={set("postal_code")} onBlur={autofillFromPostcode} placeholder="1234AB" className="flex-1 rounded-lg border border-app bg-white dark:bg-slate-800 px-3 py-2 text-sm text-strong uppercase" data-testid="user-details-postal" />
                  <button type="button" onClick={autofillFromPostcode} disabled={lookingUp} className="text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-lg border border-app hover:border-pear-500 disabled:opacity-40" data-testid="user-details-postal-lookup">{lookingUp ? "…" : "Zoek"}</button>
                </div>
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-widest text-muted-fg">Huisnummer</span>
                <input value={details.house_number || ""} onChange={set("house_number")} onBlur={autofillFromPostcode} className="mt-1 w-full rounded-lg border border-app bg-white dark:bg-slate-800 px-3 py-2 text-sm text-strong" data-testid="user-details-house-number" />
              </label>
            </div>

            {/* Plain-text display of country / region / city — no more input boxes here. */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl border border-app surface-2 p-3" data-testid="user-details-location-display">
              <div className="min-w-0">
                <span className="text-[10px] uppercase tracking-widest text-muted-fg">Land</span>
                <p className="mt-1 text-sm text-strong flex items-center gap-1.5 truncate" data-testid="user-details-country">
                  <span className="text-lg leading-none" aria-hidden>{isoToFlag(guessCountryCode(details))}</span>
                  {details.country || <span className="text-muted-fg">Wordt automatisch ingevuld</span>}
                </p>
              </div>
              <div className="min-w-0">
                <span className="text-[10px] uppercase tracking-widest text-muted-fg">Provincie / regio</span>
                <p className="mt-1 text-sm text-strong truncate" data-testid="user-details-region">{details.region || <span className="text-muted-fg">Wordt automatisch ingevuld</span>}</p>
              </div>
              <div className="min-w-0">
                <span className="text-[10px] uppercase tracking-widest text-muted-fg">Plaats</span>
                <p className="mt-1 text-sm text-strong truncate" data-testid="user-details-city">{details.city || <span className="text-muted-fg">Wordt automatisch ingevuld</span>}</p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block sm:col-span-2">
                <span className="text-[10px] uppercase tracking-widest text-muted-fg">Telefoon</span>
                <div className="mt-1">
                  <PhoneInput value={details.phone || ""} onChange={(v) => setDetails((d) => ({ ...(d || {}), phone: v }))} testid="user-details-phone" />
                </div>
              </label>
            </div>
            <details className="rounded-xl border border-app p-3">
              <summary className="text-xs uppercase tracking-widest text-muted-fg cursor-pointer">Zakelijke gegevens (optioneel)</summary>
              <div className="grid sm:grid-cols-2 gap-3 mt-3">
                <label className="block">
                  <span className="text-[10px] uppercase tracking-widest text-muted-fg">Bedrijfsnaam</span>
                  <input value={details.company || ""} onChange={set("company")} className="mt-1 w-full rounded-lg border border-app bg-white dark:bg-slate-800 px-3 py-2 text-sm text-strong" data-testid="user-details-company" />
                </label>
                <label className="block">
                  <span className="text-[10px] uppercase tracking-widest text-muted-fg">KVK</span>
                  <input value={details.kvk || ""} onChange={set("kvk")} className="mt-1 w-full rounded-lg border border-app bg-white dark:bg-slate-800 px-3 py-2 text-sm text-strong" data-testid="user-details-kvk" />
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-[10px] uppercase tracking-widest text-muted-fg">Belasting-ID / BTW</span>
                  <input value={details.tax_id || ""} onChange={set("tax_id")} className="mt-1 w-full rounded-lg border border-app bg-white dark:bg-slate-800 px-3 py-2 text-sm text-strong" data-testid="user-details-tax-id" />
                </label>
              </div>
            </details>

            {/* Password actions */}
            <div className="rounded-xl border border-app p-3 space-y-2" data-testid="user-details-password-block">
              <p className="text-xs uppercase tracking-widest text-muted-fg">Wachtwoord</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={sendReset} className="btn-secondary" data-testid="user-details-send-reset">Reset-mail sturen</button>
                {canEditPassword && (
                  <>
                    <input
                      type={showPwd ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Nieuw wachtwoord (min 8)"
                      className="flex-1 min-w-[160px] rounded-lg border border-app bg-white dark:bg-slate-800 px-3 py-2 text-sm text-strong"
                      data-testid="user-details-new-password"
                    />
                    <button type="button" onClick={() => setShowPwd((v) => !v)} className="text-xs px-3 py-1.5 rounded-full border border-app">{showPwd ? "Verberg" : "Toon"}</button>
                    <button type="button" onClick={changePassword} className="btn-primary" data-testid="user-details-change-password">Direct wijzigen</button>
                  </>
                )}
              </div>
              {!canEditPassword && <p className="text-[11px] text-muted-fg">Alleen super_admin of beheerder mag wachtwoorden direct wijzigen.</p>}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="text-xs px-4 py-2 rounded-full border border-app hover:border-slate-400" data-testid="user-details-cancel">Sluiten</button>
              <button type="submit" disabled={saving} className="btn-primary" data-testid="user-details-save">
                {saving ? "Opslaan…" : <><Save className="h-4 w-4" /> Opslaan</>}
              </button>
            </div>
            <p className="text-[10px] text-muted-fg">Zoho 2-way sync: <strong>MOCKED</strong> — de synchronisatie wordt geactiveerd zodra Zoho Books org-ID is ingevuld.</p>
          </form>
        )}
      </div>
    </div>
  );
};

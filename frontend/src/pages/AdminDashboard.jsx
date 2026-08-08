import React, { useEffect, useState } from "react";
import axios from "axios";
import { Navigate, NavLink, Routes, Route, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Briefcase, Settings as SettingsIcon, Inbox, LogOut, Plus, Trash2, Save, ExternalLink, BarChart3, UserPlus, Check, XCircle, Star, Sparkles, Send, Clock, Users, Code, ShieldCheck, ShieldX, MessageSquare, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../auth/AuthContext";
import { useLang } from "../i18n/LanguageContext";
import { AnalyticsAdmin } from "./AdminAnalytics";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const RequireAdmin = ({ children }) => {
  const { isAdmin, loading } = useAuth();
  if (loading) return <div className="p-10 text-center text-muted-fg">Laden…</div>;
  if (!isAdmin) return <Navigate to="/admin/login" replace />;
  return children;
};

const AdminSidebar = () => {
  const { logout, user, authHeader } = useAuth();
  const [counters, setCounters] = useState({});
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await axios.get(`${API}/admin/counters`, { headers: authHeader() });
        if (alive) setCounters(r.data || {});
      } catch { /* ignore */ }
    };
    load();
    const t = setInterval(load, 60000);
    return () => { alive = false; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const items = [
    { to: "/admin", label: "Portfolio", icon: Briefcase, end: true, testid: "cms-nav-projects" },
    { to: "/admin/analytics", label: "AI dashboard", icon: BarChart3, testid: "cms-nav-analytics" },
    { to: "/admin/registrations", label: "Portaal aanvragen", icon: UserPlus, testid: "cms-nav-registrations", badge: counters.portal },
    { to: "/admin/reviews", label: "Klantreviews", icon: Star, testid: "cms-nav-reviews", badge: counters.reviews },
    { to: "/admin/messages", label: "Berichten", icon: Inbox, testid: "cms-nav-messages", badge: counters.messages },
    { to: "/admin/feedback", label: "Feedback", icon: MessageSquare, testid: "cms-nav-feedback", badge: counters.feedback },
    { to: "/admin/cybersecurity", label: "Cybersecurity", icon: ShieldAlert, testid: "cms-nav-cybersecurity", badge: counters.cybersecurity },
    { to: "/admin/users", label: "Gebruikers & rollen", icon: Users, testid: "cms-nav-users" },
    { to: "/admin/scripts", label: "Custom scripts", icon: Code, testid: "cms-nav-scripts" },
    { to: "/admin/settings", label: "Site instellingen", icon: SettingsIcon, testid: "cms-nav-settings" },
  ];
  return (
    <aside className="lg:w-64 shrink-0 surface border border-app rounded-2xl p-5 self-start" data-testid="cms-sidebar">
      <div className="mb-6">
        <p className="text-[11px] uppercase tracking-widest text-muted-fg">Ingelogd als</p>
        <p className="font-heading font-semibold text-strong text-sm mt-1 truncate">{user?.email || "admin"}</p>
      </div>
      <nav className="flex flex-col gap-1">
        {items.map((i) => (
          <NavLink
            key={i.to}
            to={i.to}
            end={i.end}
            data-testid={i.testid}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive ? "bg-pear-500 text-white" : "text-strong hover:bg-pear-100/60"
              }`
            }
          >
            <i.icon className="h-4 w-4" />
            <span className="flex-1">{i.label}</span>
            {i.badge > 0 && (
              <span
                className="inline-flex items-center justify-center min-w-[20px] h-5 rounded-full bg-pear-500 text-white text-[10px] font-bold px-1.5 shadow-[0_0_0_2px_var(--pb-surface,_white)]"
                data-testid={`badge-${i.testid}`}
              >
                {i.badge > 99 ? "99+" : i.badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
      <button
        onClick={logout}
        className="mt-6 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm text-red-500 border border-red-200 hover:bg-red-50 dark:hover:bg-red-500/10"
        data-testid="cms-logout"
      >
        <LogOut className="h-4 w-4" /> Uitloggen
      </button>
      <div className="mt-6 pt-4 border-t border-app text-[10px] text-muted-fg text-center">
        PearBlue CMS · v1.2 · 2026
      </div>
    </aside>
  );
};

// --- Projects tab ---
const CATEGORIES = [
  { key: "media", label: "Media" },
  { key: "ecom", label: "E-commerce" },
  { key: "infra", label: "Infrastructuur" },
  { key: "sec", label: "Security" },
  { key: "ai", label: "AI" },
  { key: "corp", label: "Corporate" },
];
const emptyForm = { title: "", category: "media", tag: "", description: "", image_url: "", external_url: "" };

const ProjectsAdmin = () => {
  const { authHeader } = useAuth();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const res = await axios.get(`${API}/projects`);
    setItems(res.data || []);
  };
  useEffect(() => { load(); }, []);

  const change = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await axios.post(`${API}/projects`, form, { headers: authHeader() });
      toast.success("Project toegevoegd");
      setForm(emptyForm);
      load();
    } catch { toast.error("Toevoegen mislukt"); } finally { setSaving(false); }
  };

  const remove = async (id) => {
    if (!window.confirm("Project verwijderen?")) return;
    try {
      await axios.delete(`${API}/projects/${id}`, { headers: authHeader() });
      toast.success("Verwijderd");
      load();
    } catch { toast.error("Verwijderen mislukt"); }
  };

  return (
    <div data-testid="cms-projects">
      <header className="mb-6">
        <h1 className="font-heading text-3xl font-medium text-strong">Portfolio beheren</h1>
        <p className="text-sm text-muted-fg mt-1">Voeg nieuwe cases toe of verwijder bestaande. Wijzigingen zijn direct zichtbaar op de site.</p>
      </header>

      <form onSubmit={save} className="surface border border-app rounded-2xl p-6 grid grid-cols-1 md:grid-cols-2 gap-4 mb-8" data-testid="cms-project-form">
        <label className="block md:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg">Titel *</span>
          <input required value={form.title} onChange={change("title")} data-testid="cms-input-title"
            className="mt-1.5 w-full rounded-xl surface-2 border border-transparent focus:border-pear-500 focus:ring-2 focus:ring-pear-500/20 px-4 py-2.5 text-sm outline-none text-strong" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg">Categorie *</span>
          <select required value={form.category} onChange={change("category")} data-testid="cms-input-category"
            className="mt-1.5 w-full rounded-xl surface-2 border border-transparent focus:border-pear-500 focus:ring-2 focus:ring-pear-500/20 px-4 py-2.5 text-sm outline-none text-strong">
            {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg">Tag</span>
          <input value={form.tag} onChange={change("tag")} data-testid="cms-input-tag"
            className="mt-1.5 w-full rounded-xl surface-2 border border-transparent focus:border-pear-500 focus:ring-2 focus:ring-pear-500/20 px-4 py-2.5 text-sm outline-none text-strong" />
        </label>
        <label className="block md:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg">Afbeelding URL *</span>
          <input required type="url" value={form.image_url} onChange={change("image_url")} data-testid="cms-input-image"
            className="mt-1.5 w-full rounded-xl surface-2 border border-transparent focus:border-pear-500 focus:ring-2 focus:ring-pear-500/20 px-4 py-2.5 text-sm outline-none text-strong" />
        </label>
        <label className="block md:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg">Externe link</span>
          <input type="url" value={form.external_url} onChange={change("external_url")} data-testid="cms-input-link"
            className="mt-1.5 w-full rounded-xl surface-2 border border-transparent focus:border-pear-500 focus:ring-2 focus:ring-pear-500/20 px-4 py-2.5 text-sm outline-none text-strong" />
        </label>
        <label className="block md:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg">Omschrijving</span>
          <textarea rows={4} value={form.description} onChange={change("description")} data-testid="cms-input-description"
            className="mt-1.5 w-full rounded-xl surface-2 border border-transparent focus:border-pear-500 focus:ring-2 focus:ring-pear-500/20 px-4 py-2.5 text-sm outline-none text-strong resize-none" />
        </label>
        <div className="md:col-span-2">
          <button type="submit" disabled={saving} className="btn-primary" data-testid="cms-project-submit">
            {saving ? "…" : <><Plus className="h-4 w-4" /> Project toevoegen</>}
          </button>
        </div>
      </form>

      <div className="surface border border-app rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-app font-heading font-semibold text-strong">Bestaande projecten ({items.length})</div>
        {items.length === 0 ? (
          <div className="p-8 text-center text-muted-fg text-sm">Nog geen projecten toegevoegd via het CMS.</div>
        ) : (
          <ul className="divide-y divide-app">
            {items.map((p) => (
              <li key={p.id} className="p-4 flex items-center gap-4" data-testid={`cms-project-row-${p.id}`}>
                <img src={p.image_url} alt={p.title} className="w-16 h-16 object-cover rounded-lg" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-strong truncate">{p.title}</p>
                  <p className="text-xs text-muted-fg">{p.tag || p.category}</p>
                </div>
                {p.external_url && <a href={p.external_url} target="_blank" rel="noreferrer" className="text-pear-500 text-sm"><ExternalLink className="h-4 w-4" /></a>}
                <button onClick={() => remove(p.id)} className="text-red-500 hover:text-red-600 p-2" data-testid={`cms-project-delete-${p.id}`}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

// --- Site settings tab ---
const SettingsAdmin = () => {
  const { authHeader } = useAuth();
  const [form, setForm] = useState({ ga4_measurement_id: "", search_console_verification: "", hero_headline_nl: "", hero_headline_en: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    axios.get(`${API}/settings`).then((r) => setForm({ ...form, ...(r.data || {}) })).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const change = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await axios.put(`${API}/settings`, form, { headers: authHeader() });
      toast.success("Instellingen opgeslagen");
    } catch { toast.error("Opslaan mislukt"); } finally { setSaving(false); }
  };

  return (
    <div data-testid="cms-settings">
      <header className="mb-6">
        <h1 className="font-heading text-3xl font-medium text-strong">Site instellingen</h1>
        <p className="text-sm text-muted-fg mt-1">Koppel Google Analytics 4 en Search Console, en pas de hoofdkop van de homepagina aan.</p>
      </header>

      <form onSubmit={save} className="surface border border-app rounded-2xl p-6 space-y-5 max-w-2xl" data-testid="cms-settings-form">
        <div>
          <h3 className="font-heading font-semibold text-strong mb-3">Google Analytics 4</h3>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg">Measurement ID (G-XXXXXXX)</span>
            <input value={form.ga4_measurement_id || ""} onChange={change("ga4_measurement_id")} placeholder="G-XXXXXXXXXX" data-testid="cms-input-ga4"
              className="mt-1.5 w-full rounded-xl surface-2 border border-transparent focus:border-pear-500 focus:ring-2 focus:ring-pear-500/20 px-4 py-2.5 text-sm outline-none text-strong font-mono" />
          </label>
          <p className="text-xs text-muted-fg mt-2">Vind je Measurement ID in Google Analytics → Beheerder → Datastreams → Web.</p>
        </div>

        <div className="pt-4 border-t border-app">
          <h3 className="font-heading font-semibold text-strong mb-3">Google Search Console</h3>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg">Verificatie code (content-waarde)</span>
            <input value={form.search_console_verification || ""} onChange={change("search_console_verification")} placeholder="abcdef123456..." data-testid="cms-input-search-console"
              className="mt-1.5 w-full rounded-xl surface-2 border border-transparent focus:border-pear-500 focus:ring-2 focus:ring-pear-500/20 px-4 py-2.5 text-sm outline-none text-strong font-mono" />
          </label>
          <p className="text-xs text-muted-fg mt-2">Plak alleen de <code>content=&quot;...&quot;</code> waarde uit de meta-tag die Search Console je geeft.</p>
        </div>

        <div className="pt-4 border-t border-app">
          <h3 className="font-heading font-semibold text-strong mb-3">Hero-tekst (optioneel)</h3>
          <label className="block mb-3">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg">NL headline (leeg = standaard)</span>
            <input value={form.hero_headline_nl || ""} onChange={change("hero_headline_nl")} data-testid="cms-input-hero-nl"
              className="mt-1.5 w-full rounded-xl surface-2 border border-transparent focus:border-pear-500 focus:ring-2 focus:ring-pear-500/20 px-4 py-2.5 text-sm outline-none text-strong" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg">EN headline (leeg = standaard)</span>
            <input value={form.hero_headline_en || ""} onChange={change("hero_headline_en")} data-testid="cms-input-hero-en"
              className="mt-1.5 w-full rounded-xl surface-2 border border-transparent focus:border-pear-500 focus:ring-2 focus:ring-pear-500/20 px-4 py-2.5 text-sm outline-none text-strong" />
          </label>
        </div>

        <button type="submit" disabled={saving} className="btn-primary" data-testid="cms-settings-submit">
          {saving ? "…" : <><Save className="h-4 w-4" /> Opslaan</>}
        </button>
      </form>
    </div>
  );
};

// --- Messages tab ---
const MSG_STATUS = [
  { key: "new", label: "Nieuw", color: "bg-red-100 text-red-600" },
  { key: "in_progress", label: "In behandeling", color: "bg-amber-100 text-amber-700" },
  { key: "on_hold", label: "Hold", color: "bg-slate-100 text-slate-600" },
  { key: "done", label: "Afgerond", color: "bg-emerald-100 text-emerald-700" },
];

const MessagesAdmin = () => {
  const { authHeader, user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/contact`, { headers: authHeader() });
      setItems(r.data || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const patch = async (id, upd) => {
    try {
      await axios.patch(`${API}/admin/contact/${id}`, upd, { headers: authHeader() });
      load();
    } catch { toast.error("Update mislukt"); }
  };
  const addNote = async (id, text) => {
    if (!text.trim()) return;
    try {
      await axios.post(`${API}/admin/contact/${id}/notes`, { text }, { headers: authHeader() });
      load();
      toast.success("Notitie toegevoegd");
    } catch { toast.error("Notitie mislukt"); }
  };

  return (
    <div data-testid="cms-messages">
      <header className="mb-6">
        <h1 className="font-heading text-3xl font-medium text-strong">Contact berichten</h1>
        <p className="text-sm text-muted-fg mt-1">Beheer aanvragen — status, toewijzing en notities.</p>
      </header>
      {loading ? <p className="text-muted-fg">Laden…</p> : items.length === 0 ? (
        <div className="surface border border-app rounded-2xl p-10 text-center text-muted-fg">Nog geen berichten ontvangen.</div>
      ) : (
        <div className="surface border border-app rounded-2xl divide-y divide-app">
          {items.map((m, i) => {
            const st = MSG_STATUS.find((s) => s.key === (m.status || "new")) || MSG_STATUS[0];
            return (
              <details key={m.id || i} className="group" data-testid={`cms-message-${i}`}>
                <summary className="p-4 cursor-pointer flex items-center justify-between gap-4 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-strong truncate">{m.name} <span className="text-muted-fg font-normal">— {m.email}</span></p>
                    <p className="text-xs text-muted-fg truncate">{m.subject || "(geen onderwerp)"} · {new Date(m.created_at).toLocaleString("nl-NL")}</p>
                  </div>
                  <span className={`text-[10px] uppercase tracking-widest rounded-full px-2 py-1 ${st.color}`}>{st.label}</span>
                  {m.assigned_to && <span className="text-[10px] text-muted-fg">@ {m.assigned_to}</span>}
                </summary>
                <div className="px-4 pb-4 pt-1 text-sm text-strong/90 space-y-3">
                  {m.phone && <p><strong className="text-muted-fg">Tel:</strong> {m.phone}</p>}
                  {m.company && <p><strong className="text-muted-fg">Bedrijf:</strong> {m.company}</p>}
                  <p className="whitespace-pre-wrap"><strong className="text-muted-fg block mb-1">Bericht:</strong>{m.message}</p>
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-app/40">
                    <select
                      value={m.status || "new"}
                      onChange={(e) => patch(m.id, { status: e.target.value })}
                      className="text-xs rounded-lg border border-app bg-app px-2 py-1"
                      data-testid={`msg-status-${m.id || i}`}
                    >
                      {MSG_STATUS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                    </select>
                    <button
                      type="button"
                      onClick={() => patch(m.id, { assigned_to: m.assigned_to === user?.email ? null : user?.email })}
                      className="text-xs rounded-full px-3 py-1 border border-app hover:border-pear-500"
                      data-testid={`msg-assign-${m.id || i}`}
                    >{m.assigned_to === user?.email ? "Loskoppelen" : "Wijs aan mij toe"}</button>
                    <a
                      href={`mailto:${m.email}?subject=Re: ${encodeURIComponent(m.subject || 'PearBlue')}`}
                      className="text-xs rounded-full px-3 py-1 border border-pear-500 text-pear-500 hover:bg-pear-50"
                      data-testid={`msg-reply-${m.id || i}`}
                    >Antwoord via e-mail</a>
                  </div>
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
                    <input name="note" placeholder="Interne notitie…" className="flex-1 rounded-lg border border-app bg-app px-3 py-1.5 text-xs" data-testid={`msg-note-input-${m.id || i}`} />
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

// --- Registrations tab ---
const STATUS_STYLE = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-pear-100 text-pear-700",
  rejected: "bg-red-100 text-red-700",
};

const RegistrationsAdmin = () => {
  const { authHeader } = useAuth();
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  const load = () => {
    setLoading(true);
    axios.get(`${API}/portal/registrations`, { headers: authHeader() })
      .then((r) => setItems(r.data || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

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
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-strong truncate">{r.name}</p>
                    <span className={`text-[10px] uppercase tracking-widest rounded-full px-2 py-0.5 font-bold ${STATUS_STYLE[r.status] || "bg-slate-200 text-slate-700"}`}>{r.status}</span>
                  </div>
                  <p className="text-xs text-muted-fg mt-0.5">
                    {r.email}{r.company ? ` · ${r.company}` : ""}{r.phone ? ` · ${r.phone}` : ""} · {new Date(r.created_at).toLocaleString("nl-NL")}
                  </p>
                  {r.message && <p className="text-sm text-strong/80 mt-2 whitespace-pre-wrap">{r.message}</p>}
                  {r.admin_note && <p className="text-xs text-muted-fg italic mt-2">Notitie: {r.admin_note}</p>}
                </div>
                {r.status === "pending" && (
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => review(r.id, "approved")} disabled={busy === r.id}
                      className="inline-flex items-center gap-1 text-xs font-semibold rounded-full bg-pear-500 text-white px-3 py-1.5 hover:bg-pear-600 disabled:opacity-50"
                      data-testid={`registration-approve-${r.id}`}>
                      <Check className="h-3.5 w-3.5" /> Goedkeuren
                    </button>
                    <button onClick={() => review(r.id, "rejected")} disabled={busy === r.id}
                      className="inline-flex items-center gap-1 text-xs font-semibold rounded-full surface-2 text-red-500 border border-red-200 px-3 py-1.5 hover:bg-red-50 disabled:opacity-50"
                      data-testid={`registration-reject-${r.id}`}>
                      <XCircle className="h-3.5 w-3.5" /> Afwijzen
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// --- Reviews tab ---
const StarsRow = ({ n }) => (
  <div className="flex items-center gap-0.5 text-pear-500">
    {[...Array(5)].map((_, i) => (
      <Star key={i} className={`h-3.5 w-3.5 ${i < n ? "fill-current" : "opacity-25"}`} />
    ))}
  </div>
);

const ReviewsAdmin = () => {
  const { authHeader } = useAuth();
  const [items, setItems] = useState([]);
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
        {invLog.length > 0 && (
          <div className="mt-5 border-t border-app pt-4">
            <h3 className="text-xs uppercase tracking-widest text-muted-fg mb-2 flex items-center gap-1"><Clock className="h-3 w-3" /> Laatste uitnodigingen ({invLog.length})</h3>
            <ul className="divide-y divide-app max-h-56 overflow-y-auto text-sm" data-testid="cms-invite-log">
              {invLog.slice(0, 15).map((l, i) => (
                <li key={l.project_id || i} className="py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-strong truncate">{l.project_name || l.project_id}</p>
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
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="font-semibold text-strong">{r.name}</p>
                    <StarsRow n={r.rating} />
                    {r.approved && <span className="text-[10px] uppercase tracking-widest rounded-full px-2 py-0.5 font-bold bg-pear-100 text-pear-700">Live</span>}
                    {r.featured && <span className="text-[10px] uppercase tracking-widest rounded-full px-2 py-0.5 font-bold bg-amber-100 text-amber-700">Uitgelicht</span>}
                  </div>
                  <p className="text-xs text-muted-fg mt-0.5">
                    {[r.company, r.project].filter(Boolean).join(" · ")} · {new Date(r.created_at).toLocaleString("nl-NL")}
                  </p>
                  <p className="text-sm text-strong/90 mt-2 whitespace-pre-wrap">&ldquo;{r.quote}&rdquo;</p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <button onClick={() => patch(r.id, { approved: !r.approved })} disabled={busy === r.id}
                    className={`inline-flex items-center gap-1 text-xs font-semibold rounded-full px-3 py-1.5 disabled:opacity-50 ${
                      r.approved ? "surface-2 text-strong border border-app" : "bg-pear-500 text-white hover:bg-pear-600"
                    }`}
                    data-testid={`review-approve-${r.id}`}>
                    <Check className="h-3.5 w-3.5" /> {r.approved ? "Intrekken" : "Goedkeuren"}
                  </button>
                  <button onClick={() => patch(r.id, { featured: !r.featured, approved: true })} disabled={busy === r.id}
                    className={`inline-flex items-center gap-1 text-xs font-semibold rounded-full px-3 py-1.5 disabled:opacity-50 ${
                      r.featured ? "surface-2 text-strong border border-app" : "bg-amber-500 text-white hover:bg-amber-600"
                    }`}
                    data-testid={`review-feature-${r.id}`}>
                    <Sparkles className="h-3.5 w-3.5" /> {r.featured ? "Van homepage" : "Op homepage"}
                  </button>
                  <button onClick={() => remove(r.id)} disabled={busy === r.id}
                    className="inline-flex items-center gap-1 text-xs font-semibold rounded-full surface-2 text-red-500 border border-red-200 px-3 py-1.5 hover:bg-red-50 disabled:opacity-50"
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

// --- Users & Roles tab ---
const ROLE_LABELS = {
  super_admin: "Super administrator",
  beheerder: "Beheerder",
  analist: "Analist",
  moderator: "Moderator",
  chat_support: "Chat support",
  gebruiker: "Gebruiker",
  admin: "Beheerder (legacy)",
};

const UsersAdmin = () => {
  const { authHeader, user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ email: "", role: "gebruiker", password: "", display_name: "" });

  const isSuperAdmin = (me?.role === "super_admin" || me?.role === "admin");

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
        <h1 className="font-heading text-3xl font-medium text-strong">Gebruikers &amp; rollen</h1>
        <p className="text-sm text-muted-fg mt-1">Beheer wie toegang heeft tot het CMS en welke rechten ze hebben. Zoho-koppeling wordt automatisch gedetecteerd op e-mailadres.</p>
      </header>

      <section className="surface border border-app rounded-2xl p-5 mb-6" data-testid="cms-users-create">
        <h2 className="font-heading font-semibold text-strong mb-3">Nieuwe gebruiker</h2>
        <form onSubmit={createUser} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input required type="email" placeholder="e-mailadres" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
            data-testid="user-form-email" className="rounded-xl surface-2 border border-transparent focus:border-pear-500 px-3 py-2 text-sm outline-none text-strong" />
          <input type="text" placeholder="Naam (optioneel)" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })}
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

      <section className="surface border border-app rounded-2xl overflow-hidden mb-6">
        {loading ? <p className="p-6 text-muted-fg text-sm">Laden…</p> : (
          <table className="w-full text-sm" data-testid="cms-users-table">
            <thead className="text-xs uppercase tracking-widest text-muted-fg">
              <tr>
                <th className="text-left px-4 py-3">E-mail</th>
                <th className="text-left px-4 py-3">Rol</th>
                <th className="text-left px-4 py-3">Zoho</th>
                <th className="text-right px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app">
              {users.map((u) => (
                <tr key={u.email} data-testid={`user-row-${u.email}`}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-strong">{u.email}</p>
                    {u.display_name && <p className="text-xs text-muted-fg">{u.display_name}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      disabled={u.email === me?.email}
                      onChange={(e) => updateRole(u.email, e.target.value)}
                      data-testid={`user-role-${u.email}`}
                      className="rounded-lg surface-2 border border-transparent focus:border-pear-500 px-2 py-1 text-xs outline-none text-strong"
                    >
                      {Object.entries(ROLE_LABELS).filter(([k]) => k !== "admin").map(([k, v]) => (
                        <option key={k} value={k} disabled={k === "super_admin" && !isSuperAdmin}>{v}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
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
                  <td className="px-4 py-3 text-right">
                    {u.email !== me?.email && u.auth_source !== "zoho-only" && (
                      <button onClick={() => remove(u.email)} data-testid={`user-delete-${u.email}`}
                        className="inline-flex items-center gap-1 text-xs text-red-500 hover:bg-red-50 px-2.5 py-1 rounded-full border border-red-200">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
    </div>
  );
};

// --- Custom scripts tab (super_admin only) ---
const ScriptsAdmin = () => {
  const { authHeader, user: me } = useAuth();
  const [header, setHeader] = useState("");
  const [footer, setFooter] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const canEdit = me?.role === "super_admin" || me?.role === "admin";

  useEffect(() => {
    axios.get(`${API}/site/scripts`)
      .then((r) => { setHeader(r.data?.header_scripts || ""); setFooter(r.data?.footer_scripts || ""); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/admin/scripts`, { header_scripts: header, footer_scripts: footer }, { headers: authHeader() });
      toast.success("Scripts opgeslagen. Herlaad de site om de nieuwe scripts te zien.");
    } catch (err) { toast.error(err?.response?.data?.detail || "Opslaan mislukt"); }
    finally { setSaving(false); }
  };

  if (!canEdit) {
    return <div className="surface border border-app rounded-3xl p-10 text-center" data-testid="cms-scripts-forbidden">
      <ShieldX className="h-10 w-10 text-red-500 mx-auto mb-3" />
      <p className="font-heading text-lg text-strong">Alleen Super Administrator</p>
      <p className="text-sm text-muted-fg">Voor het bewerken van site-scripts heb je super_admin rechten nodig — de scripts kunnen tracking- of security-gevolgen hebben.</p>
    </div>;
  }

  return (
    <div data-testid="cms-scripts">
      <header className="mb-6">
        <h1 className="font-heading text-3xl font-medium text-strong">Custom scripts</h1>
        <p className="text-sm text-muted-fg mt-1">Injecteer aangepaste HTML/JS in de <code>&lt;head&gt;</code> of aan het einde van <code>&lt;body&gt;</code>. Handig voor Trustpilot TrustBox, Google Tag Manager, meta pixels, etc.</p>
      </header>
      {loading ? <p className="text-muted-fg">Laden…</p> : (
        <div className="space-y-6">
          <div className="surface border border-app rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Code className="h-4 w-4 text-pear-500" />
              <h2 className="font-heading font-semibold text-strong">Header scripts <span className="text-xs text-muted-fg font-normal">— injecteert in &lt;head&gt;</span></h2>
            </div>
            <textarea rows={8} value={header} onChange={(e) => setHeader(e.target.value)} data-testid="scripts-header-input"
              placeholder='<!-- e.g. Google Tag Manager, meta pixels --><script>...</script>'
              className="w-full rounded-xl surface-2 border border-transparent focus:border-pear-500 px-4 py-3 text-sm font-mono outline-none resize-y text-strong" />
          </div>
          <div className="surface border border-app rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Code className="h-4 w-4 text-pear-500" />
              <h2 className="font-heading font-semibold text-strong">Footer scripts <span className="text-xs text-muted-fg font-normal">— injecteert vlak voor &lt;/body&gt;</span></h2>
            </div>
            <textarea rows={8} value={footer} onChange={(e) => setFooter(e.target.value)} data-testid="scripts-footer-input"
              placeholder='<!-- e.g. Trustpilot TrustBox JS, chat widgets --><script src="..."></script>'
              className="w-full rounded-xl surface-2 border border-transparent focus:border-pear-500 px-4 py-3 text-sm font-mono outline-none resize-y text-strong" />
          </div>
          <div className="flex justify-end">
            <button onClick={save} disabled={saving} className="btn-primary" data-testid="scripts-save">
              <Save className="h-4 w-4" /> {saving ? "Opslaan…" : "Opslaan"}
            </button>
          </div>
          <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 rounded-2xl p-4">
            ⚠ Waarschuwing: aangepaste scripts kunnen prestatie en veiligheid van de site beïnvloeden. Plak alleen code die je vertrouwt. Kwaadaardige code kan bezoekers tracken of misleiden.
          </div>
        </div>
      )}
    </div>
  );
};

// --- Layout & Cybersecurity/Feedback Admin (kept together) ---

// ------------------------------------------------------------
// Cybersecurity CMS — blocked requests with unblock / reblock
// ------------------------------------------------------------
const REASON_LABEL = {
  rate_limit: "Rate limit",
  spam: "Spam",
  honeypot: "Honeypot",
  captcha: "Captcha",
  manual_block: "Handmatig geblokkeerd",
  unknown: "Onbekend",
};

const CybersecurityAdmin = () => {
  const { authHeader } = useAuth();
  const [blocks, setBlocks] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const load = async () => {
    setLoading(true);
    try {
      const [b, s] = await Promise.all([
        axios.get(`${API}/admin/cybersecurity/blocks`, { headers: authHeader() }),
        axios.get(`${API}/admin/cybersecurity/stats`, { headers: authHeader() }),
      ]);
      setBlocks(b.data || []);
      setStats(s.data || null);
    } catch (e) {
      toast.error("Kon cybersecurity-data niet laden");
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const toggle = async (block, unblock) => {
    try {
      const path = unblock ? "unblock" : "reblock";
      await axios.post(`${API}/admin/cybersecurity/blocks/${block.id}/${path}`, {}, { headers: authHeader() });
      toast.success(unblock ? "Ontblokkeerd" : "Opnieuw geblokkeerd");
      load();
    } catch { toast.error("Actie mislukt"); }
  };

  const shown = filter === "all"
    ? blocks
    : filter === "active"
      ? blocks.filter((b) => !b.unblocked)
      : blocks.filter((b) => b.unblocked);

  const maxDaily = stats?.daily?.reduce((m, d) => Math.max(m, d.count), 1) || 1;

  return (
    <div className="space-y-6" data-testid="cms-cybersecurity">
      <div>
        <h2 className="font-heading text-2xl font-semibold text-strong flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-pear-500" />
          Cybersecurity
        </h2>
        <p className="text-sm text-muted-fg mt-1">Verzoeken die door de rate-limiter, spam-filter of honeypot zijn geblokkeerd. Je kunt handmatig ont- of herblokkeren.</p>
      </div>

      {/* Stats + chart */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-app p-5 surface">
            <div className="text-xs uppercase tracking-widest text-muted-fg">Blokkades (30 dagen)</div>
            <div className="font-heading text-3xl font-medium text-strong mt-1" data-testid="cs-total-30d">{stats.total_30d}</div>
          </div>
          <div className="rounded-2xl border border-app p-5 surface">
            <div className="text-xs uppercase tracking-widest text-muted-fg">Unieke IPs (30 dagen)</div>
            <div className="font-heading text-3xl font-medium text-strong mt-1" data-testid="cs-unique-ips">{stats.unique_ips_30d}</div>
          </div>
          <div className="rounded-2xl border border-app p-5 surface">
            <div className="text-xs uppercase tracking-widest text-muted-fg mb-2">Top-oorzaken</div>
            <ul className="space-y-1 text-sm">
              {(stats.reasons || []).slice(0, 4).map((r) => (
                <li key={r.reason} className="flex justify-between">
                  <span className="text-strong">{REASON_LABEL[r.reason] || r.reason}</span>
                  <span className="text-muted-fg font-mono">{r.count}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {stats?.daily?.length > 0 && (
        <div className="rounded-2xl border border-app p-5 surface" data-testid="cs-daily-chart">
          <div className="text-xs uppercase tracking-widest text-muted-fg mb-3">Blokkades per dag</div>
          <div className="flex items-end gap-1.5 h-32">
            {stats.daily.map((d) => (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-pear-500 rounded-t transition-all"
                  style={{ height: `${(d.count / maxDaily) * 100}%`, minHeight: d.count > 0 ? "2px" : "0" }}
                  title={`${d.day}: ${d.count}`}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-muted-fg">
            <span>{stats.daily[0]?.day || ""}</span>
            <span>{stats.daily[stats.daily.length - 1]?.day || ""}</span>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-2 text-sm">
        {[
          { key: "all", label: "Alle" },
          { key: "active", label: "Actief geblokkeerd" },
          { key: "unblocked", label: "Gedeblokkeerd" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            data-testid={`cs-filter-${f.key}`}
            className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
              filter === f.key ? "bg-pear-500 text-white border-pear-500" : "text-strong border-app hover:border-pear-500"
            }`}
          >{f.label}</button>
        ))}
        <button onClick={load} className="ml-auto text-xs text-muted-fg hover:text-pear-500" data-testid="cs-refresh">↻ Vernieuwen</button>
      </div>

      {/* Blocks table */}
      <div className="rounded-2xl border border-app overflow-hidden surface" data-testid="cs-blocks-table">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-pear-50/50 dark:bg-pear-500/5 text-left">
              <tr>
                <th className="px-3 py-2 font-semibold text-xs uppercase tracking-widest text-muted-fg">Wie (IP)</th>
                <th className="px-3 py-2 font-semibold text-xs uppercase tracking-widest text-muted-fg">Wat</th>
                <th className="px-3 py-2 font-semibold text-xs uppercase tracking-widest text-muted-fg">Waar</th>
                <th className="px-3 py-2 font-semibold text-xs uppercase tracking-widest text-muted-fg">Hoe</th>
                <th className="px-3 py-2 font-semibold text-xs uppercase tracking-widest text-muted-fg">Wanneer</th>
                <th className="px-3 py-2 font-semibold text-xs uppercase tracking-widest text-muted-fg">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-fg">Laden…</td></tr>
              ) : shown.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-fg">Geen geblokkeerde verzoeken.</td></tr>
              ) : shown.map((b) => (
                <tr key={b.id} className="border-t border-app/50" data-testid={`cs-row-${b.id}`}>
                  <td className="px-3 py-2 font-mono text-xs">
                    {b.ip}
                    {b.ip_manually_blocked && <span className="ml-1 inline-block px-1 py-0.5 text-[9px] rounded bg-red-100 text-red-600">manual</span>}
                  </td>
                  <td className="px-3 py-2 text-strong">{REASON_LABEL[b.reason] || b.reason}</td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-fg">{b.endpoint}</td>
                  <td className="px-3 py-2 text-xs text-muted-fg max-w-[220px] truncate" title={b.user_agent}>{b.user_agent}</td>
                  <td className="px-3 py-2 text-xs text-muted-fg whitespace-nowrap">{new Date(b.created_at).toLocaleString("nl-NL")}</td>
                  <td className="px-3 py-2">
                    {b.unblocked ? (
                      <span className="text-xs text-emerald-600 font-semibold">Gedeblokkeerd</span>
                    ) : (
                      <span className="text-xs text-red-500 font-semibold">Geblokkeerd</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {b.unblocked ? (
                      <button
                        onClick={() => toggle(b, false)}
                        data-testid={`cs-reblock-${b.id}`}
                        className="text-xs px-2.5 py-1 rounded-full border border-red-200 text-red-500 hover:bg-red-50"
                      >Opnieuw blokkeren</button>
                    ) : (
                      <button
                        onClick={() => toggle(b, true)}
                        data-testid={`cs-unblock-${b.id}`}
                        className="text-xs px-2.5 py-1 rounded-full border border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                      >Deblokkeren</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ------------------------------------------------------------
// Feedback CMS
// ------------------------------------------------------------
const FEEDBACK_STATUS = [
  { key: "new", label: "Nieuw", color: "bg-red-100 text-red-600" },
  { key: "in_progress", label: "In behandeling", color: "bg-amber-100 text-amber-700" },
  { key: "on_hold", label: "On hold", color: "bg-slate-100 text-slate-600" },
  { key: "done", label: "Afgerond", color: "bg-emerald-100 text-emerald-700" },
];

const FeedbackAdmin = () => {
  const { authHeader, user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("open");
  const [openItem, setOpenItem] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/admin/feedback`, { headers: authHeader() });
      setItems(r.data || []);
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
          Klantfeedback
        </h2>
        <p className="text-sm text-muted-fg mt-1">Feedback per pagina — status, toewijzing en interne notities.</p>
      </div>
      <div className="flex items-center gap-2 text-sm">
        {["open", "all"].map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            data-testid={`fb-filter-${k}`}
            className={`px-3 py-1.5 rounded-full border text-xs font-medium ${filter === k ? "bg-pear-500 text-white border-pear-500" : "text-strong border-app hover:border-pear-500"}`}
          >{k === "open" ? "Open items" : "Alles"}</button>
        ))}
        <button onClick={load} className="ml-auto text-xs text-muted-fg hover:text-pear-500" data-testid="fb-refresh">↻ Vernieuwen</button>
      </div>
      {loading ? <div className="text-muted-fg">Laden…</div> : Object.keys(byPage).length === 0 ? (
        <div className="text-muted-fg text-sm">Nog geen feedback binnen.</div>
      ) : (
        <div className="space-y-6">
          {Object.entries(byPage).map(([page, list]) => (
            <div key={page} data-testid={`fb-group-${page}`}>
              <div className="text-xs uppercase tracking-widest text-muted-fg mb-2">Pagina: <span className="text-strong">{page}</span> · {filtered(list).length} items</div>
              <div className="rounded-2xl border border-app overflow-hidden surface">
                {filtered(list).map((f) => {
                  const st = FEEDBACK_STATUS.find((s) => s.key === (f.status || "new")) || FEEDBACK_STATUS[0];
                  return (
                    <div key={f.id} className="p-4 border-b border-app/50 last:border-0" data-testid={`fb-row-${f.id}`}>
                      <div className="flex flex-wrap items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[10px] uppercase font-bold rounded-full px-2 py-0.5 ${st.color}`}>{st.label}</span>
                            {f.rating && <span className="text-xs text-pear-500">{"★".repeat(f.rating)}</span>}
                            <span className="text-[10px] text-muted-fg">{new Date(f.created_at).toLocaleString("nl-NL")}</span>
                            {f.email && <span className="text-[10px] text-muted-fg">· {f.email}</span>}
                          </div>
                          <p className="text-sm text-strong mt-1 whitespace-pre-wrap">{f.message}</p>
                          {f.assigned_to && <p className="text-[10px] text-muted-fg mt-1">Toegewezen aan: {f.assigned_to}</p>}
                        </div>
                        <div className="flex flex-col gap-1.5 shrink-0">
                          <select
                            value={f.status || "new"}
                            onChange={(e) => setStatus(f.id, e.target.value)}
                            className="text-xs rounded-lg border border-app bg-app px-2 py-1"
                            data-testid={`fb-status-${f.id}`}
                          >
                            {FEEDBACK_STATUS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                          </select>
                          <button
                            onClick={() => assign(f.id, f.assigned_to === user?.email ? null : user?.email)}
                            className="text-xs rounded-full px-2 py-1 border border-app hover:border-pear-500"
                            data-testid={`fb-assign-me-${f.id}`}
                          >{f.assigned_to === user?.email ? "Loskoppelen" : "Wijs aan mij toe"}</button>
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
        <div className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={() => setOpenItem(null)} data-testid="fb-notes-modal">
          <div className="w-full max-w-lg bg-app border border-app rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
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
            <form onSubmit={async (e) => { e.preventDefault(); const fd = new FormData(e.target); await addNote(openItem.id, fd.get("note")); e.target.reset(); }} className="flex gap-2">
              <input name="note" placeholder="Voeg een notitie toe…" className="flex-1 rounded-xl border border-app bg-app px-3 py-2 text-sm" data-testid="fb-note-input" />
              <button type="submit" className="btn-primary" data-testid="fb-note-submit">Toevoegen</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const AdminLayout = ({ children }) => (
  <div className="max-w-7xl mx-auto px-6 lg:px-10 py-10">
    <div className="mb-6 text-sm">
      <Link to="/" className="text-muted-fg hover:text-pear-500">← Terug naar site</Link>
    </div>
    <div className="flex flex-col lg:flex-row gap-8">
      <AdminSidebar />
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex-1 min-w-0">
        {children}
      </motion.div>
    </div>
  </div>
);

export default function AdminDashboard() {
  return (
    <RequireAdmin>
      <AdminLayout>
        <Routes>
          <Route index element={<ProjectsAdmin />} />
          <Route path="analytics" element={<AnalyticsAdmin />} />
          <Route path="registrations" element={<RegistrationsAdmin />} />
          <Route path="reviews" element={<ReviewsAdmin />} />
          <Route path="users" element={<UsersAdmin />} />
          <Route path="scripts" element={<ScriptsAdmin />} />
          <Route path="settings" element={<SettingsAdmin />} />
          <Route path="messages" element={<MessagesAdmin />} />
          <Route path="feedback" element={<FeedbackAdmin />} />
          <Route path="cybersecurity" element={<CybersecurityAdmin />} />
        </Routes>
      </AdminLayout>
    </RequireAdmin>
  );
}

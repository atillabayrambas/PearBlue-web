import React, { useEffect, useState } from "react";
import axios from "axios";
import { Navigate, NavLink, Routes, Route, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Briefcase, Settings as SettingsIcon, Inbox, LogOut, Plus, Trash2, Save, ExternalLink, BarChart3, UserPlus, Check, XCircle } from "lucide-react";
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
  const { logout, user } = useAuth();
  const items = [
    { to: "/admin", label: "Portfolio", icon: Briefcase, end: true, testid: "cms-nav-projects" },
    { to: "/admin/analytics", label: "AI dashboard", icon: BarChart3, testid: "cms-nav-analytics" },
    { to: "/admin/registrations", label: "Portaal aanvragen", icon: UserPlus, testid: "cms-nav-registrations" },
    { to: "/admin/settings", label: "Site instellingen", icon: SettingsIcon, testid: "cms-nav-settings" },
    { to: "/admin/messages", label: "Berichten", icon: Inbox, testid: "cms-nav-messages" },
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
            {i.label}
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
const MessagesAdmin = () => {
  const { authHeader } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    axios.get(`${API}/contact`, { headers: authHeader() })
      .then((r) => setItems(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div data-testid="cms-messages">
      <header className="mb-6">
        <h1 className="font-heading text-3xl font-medium text-strong">Contact berichten</h1>
        <p className="text-sm text-muted-fg mt-1">Bekijk alle contact- en offerte-aanvragen die via de website binnenkomen.</p>
      </header>
      {loading ? <p className="text-muted-fg">Laden…</p> : items.length === 0 ? (
        <div className="surface border border-app rounded-2xl p-10 text-center text-muted-fg">Nog geen berichten ontvangen.</div>
      ) : (
        <div className="surface border border-app rounded-2xl divide-y divide-app">
          {items.map((m, i) => (
            <details key={m.id || i} className="group" data-testid={`cms-message-${i}`}>
              <summary className="p-4 cursor-pointer flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-semibold text-strong truncate">{m.name} <span className="text-muted-fg font-normal">— {m.email}</span></p>
                  <p className="text-xs text-muted-fg truncate">{m.subject || "(geen onderwerp)"} · {new Date(m.created_at).toLocaleString("nl-NL")}</p>
                </div>
                <span className={`text-[10px] uppercase tracking-widest rounded-full px-2 py-1 ${m.email_sent ? "bg-pear-100 text-pear-700" : "bg-slate-200 text-slate-600"}`}>{m.email_sent ? "E-mail" : "DB only"}</span>
              </summary>
              <div className="px-4 pb-4 pt-1 text-sm text-strong/90 space-y-1">
                {m.phone && <p><strong className="text-muted-fg">Tel:</strong> {m.phone}</p>}
                {m.company && <p><strong className="text-muted-fg">Bedrijf:</strong> {m.company}</p>}
                <p className="whitespace-pre-wrap"><strong className="text-muted-fg block mb-1">Bericht:</strong>{m.message}</p>
              </div>
            </details>
          ))}
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

// --- Layout ---
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
          <Route path="settings" element={<SettingsAdmin />} />
          <Route path="messages" element={<MessagesAdmin />} />
        </Routes>
      </AdminLayout>
    </RequireAdmin>
  );
}

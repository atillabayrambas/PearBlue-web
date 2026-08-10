import React, { useEffect, useState } from "react";
import axios from "axios";
import { Navigate, NavLink, Routes, Route, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Briefcase, Settings as SettingsIcon, Inbox, LogOut, Plus, Trash2, Save, ExternalLink, BarChart3, UserPlus, Check, XCircle, Star, Sparkles, Send, Clock, Users, Code, ShieldCheck, ShieldX, MessageSquare, ShieldAlert, Euro, Menu } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../auth/AuthContext";
import { useLang } from "../i18n/LanguageContext";
import { useTheme } from "../theme/ThemeContext";
import { AnalyticsAdmin } from "./AdminAnalytics";
import { FinancialsAdmin } from "./AdminFinancials";
import { Avatar } from "../components/Avatar";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const PEARBLUE_LOGO = "https://customer-assets-gfyr7b9c.emergentagent.net/job_sheet-converter-68/artifacts/djwgz9jk_PearBlue%20logo-10.webp";

const RequireAdmin = ({ children }) => {
  const { isAdmin, loading } = useAuth();
  if (loading) return <div className="p-10 text-center text-muted-fg">Laden…</div>;
  if (!isAdmin) return <Navigate to="/admin/login" replace />;
  return children;
};

const AdminSidebar = () => {
  const { user, logout } = useAuth();
  const { lang, setLang } = useLang();
  const { mode, setMode } = useTheme();
  const [counters, setCounters] = useState({});
  const [profile, setProfile] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    const load = () => axios.get(`${API}/admin/counters`, { headers: authHeaderFromStorage() }).then((r) => setCounters(r.data || {})).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!user?.email) return;
    axios.get(`${API}/admin/users/${encodeURIComponent(user.email)}/details`, { headers: authHeaderFromStorage() })
      .then((r) => setProfile(r.data))
      .catch(() => {});
  }, [user?.email]);
  // Close mobile menu when navigating (route change) — done via NavLink onClick below
  const role = user?.role || "";
  const canSeeFinancials = ["super_admin", "admin", "beheerder", "financien"].includes(role);
  const items = [
    { to: "/admin", label: "Portfolio", icon: Briefcase, end: true, testid: "cms-nav-projects" },
    { to: "/admin/analytics", label: "AI dashboard", icon: BarChart3, testid: "cms-nav-analytics" },
    ...(canSeeFinancials ? [{ to: "/admin/financials", label: "Financiën", icon: Euro, testid: "cms-nav-financials" }] : []),
    { to: "/admin/registrations", label: "Portaal aanvragen", icon: UserPlus, testid: "cms-nav-registrations", badge: counters.portal },
    { to: "/admin/reviews", label: "Klantreviews", icon: Star, testid: "cms-nav-reviews", badge: counters.reviews },
    { to: "/admin/messages", label: "Berichten", icon: Inbox, testid: "cms-nav-messages", badge: counters.messages },
    { to: "/admin/feedback", label: "Feedback", icon: MessageSquare, testid: "cms-nav-feedback", badge: counters.feedback },
    { to: "/admin/cybersecurity", label: "Cybersecurity", icon: ShieldAlert, testid: "cms-nav-cybersecurity", badge: counters.cybersecurity },
    { to: "/admin/users", label: "Gebruikers & rollen", icon: Users, testid: "cms-nav-users" },
    { to: "/admin/mailboxes", label: "Mailboxen (IMAP)", icon: Inbox, testid: "cms-nav-mailboxes" },
    { to: "/admin/mailmarketing", label: "Mailmarketing (Brevo)", icon: Send, testid: "cms-nav-brevo" },
    { to: "/admin/scripts", label: "Custom scripts", icon: Code, testid: "cms-nav-scripts" },
    { to: "/admin/settings", label: "Site instellingen", icon: SettingsIcon, testid: "cms-nav-settings" },
  ];
  const displayName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() || user?.display_name || user?.email;
  const nextTheme = { light: "dark", dark: "system", system: "light" }[mode] || "light";
  const themeIcon = mode === "light" ? "☀️" : mode === "dark" ? "🌙" : "🖥️";
  return (
    <>
      {/* Mobile hamburger header — compact, "Terug naar site" instead of version tag, no logo (logo stays in sidebar) */}
      <div className="lg:hidden sticky top-0 z-40 -mx-6 sm:-mx-10 mb-3 flex items-center gap-2 px-3 py-2 surface border-b border-app" data-testid="cms-mobile-header">
        <button onClick={() => setMobileOpen((v) => !v)} className="p-1.5 rounded-lg surface-2 hover:bg-pear-100/50" aria-label="Menu" aria-expanded={mobileOpen} data-testid="cms-mobile-toggle">
          <Menu className="h-5 w-5 text-strong" />
        </button>
        <Link to="/" className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-strong hover:text-pear-500 px-3 py-1.5 rounded-full border border-app" data-testid="cms-mobile-back">
          ← Terug naar site
        </Link>
      </div>

      {/* Click-outside overlay (mobile only) */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setMobileOpen(false)}
          data-testid="cms-mobile-backdrop"
          aria-hidden="true"
        />
      )}

      <aside
        className={`lg:w-64 shrink-0 surface border border-app rounded-2xl p-5 self-start lg:sticky lg:top-6 ${mobileOpen ? "fixed inset-y-0 left-0 z-40 w-72 rounded-none overflow-y-auto lg:relative lg:z-auto lg:inset-auto lg:w-64 lg:overflow-visible" : "hidden lg:block"}`}
        data-testid="cms-sidebar"
      >
        {/* Logo + close for mobile — larger, centered */}
        <div className="flex items-center justify-between mb-5 lg:mb-6">
          <button onClick={() => setMobileOpen(false)} className="lg:hidden p-1.5 rounded-lg hover:bg-pear-100/50 order-2" aria-label="Sluit menu" data-testid="cms-mobile-close">
            <XCircle className="h-5 w-5 text-strong" />
          </button>
          <img src={PEARBLUE_LOGO} alt="PearBlue" className="h-12 lg:h-14 w-auto mx-auto order-1" data-testid="cms-sidebar-logo" onError={(e) => { e.target.style.display = 'none'; }} />
        </div>

        {/* Profile summary with avatar */}
        <div className="mb-6 flex items-center gap-3" data-testid="cms-sidebar-profile">
          <Avatar name={displayName} email={user?.email} profilePicture={profile?.profile_picture} size={40} />
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-widest text-muted-fg">Ingelogd als</p>
            <p className="font-heading font-semibold text-strong text-sm mt-0.5 truncate">{displayName}</p>
          </div>
        </div>

        <nav className="flex flex-col gap-1">
          {items.map((i) => (
            <NavLink
              key={i.to}
              to={i.to}
              end={i.end}
              onClick={() => setMobileOpen(false)}
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
                  className="inline-flex items-center justify-center min-w-[18px] h-4 rounded-full bg-red-500 text-white text-[9px] font-bold px-1"
                  data-testid={`badge-${i.testid}`}
                >
                  {i.badge > 99 ? "99+" : i.badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Language + theme quick toggles */}
        <div className="mt-5 flex items-center justify-between gap-2 rounded-xl surface-2 px-3 py-2" data-testid="cms-sidebar-prefs">
          <button
            type="button"
            onClick={() => setLang(lang === "nl" ? "en" : "nl")}
            className="flex-1 text-xs font-semibold text-strong hover:text-pear-500 uppercase tracking-widest"
            data-testid="cms-sidebar-lang"
          >
            🌐 {lang.toUpperCase()}
          </button>
          <button
            type="button"
            onClick={() => setMode(nextTheme)}
            title={`Thema: ${mode}`}
            className="flex-1 text-xs font-semibold text-strong hover:text-pear-500 uppercase tracking-widest"
            data-testid="cms-sidebar-theme"
          >
            {themeIcon} {mode === "light" ? "Licht" : mode === "dark" ? "Donker" : "Auto"}
          </button>
        </div>

        <button
          onClick={logout}
          className="mt-4 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm text-red-500 border border-red-200 hover:bg-red-50 dark:hover:bg-red-500/10"
          data-testid="cms-logout"
        >
          <LogOut className="h-4 w-4" /> Uitloggen
        </button>
        <div className="mt-4 pt-3 border-t border-app text-[10px] text-muted-fg text-center">
          PearBlue CMS · v0.5.5-Beta · 2026 · <Link to="/admin/changelog" className="hover:text-pear-500 underline" data-testid="cms-sidebar-changelog-link">Changelogs</Link>
        </div>
      </aside>
    </>
  );
};

// Helper to read auth token straight from localStorage (used inside effects
// that fire before `useAuth` context is available).
const authHeaderFromStorage = () => {
  const t = localStorage.getItem("pb_admin_token");
  return t ? { Authorization: `Bearer ${t}` } : {};
};

// (Avatar helper moved to /app/frontend/src/components/Avatar.jsx)

// Turn "chat_support" → "Chat support"; "super_admin" → "Super admin"
const prettyRole = (r) => (r || "").split("_").map((w) => w ? w[0].toUpperCase() + w.slice(1) : "").join(" ").trim();

// Preferred display label for an assignee row from /api/admin/assignees.
// Prefers "First Last"; falls back to display_name; only falls back to email
// when nothing else is available.
const assigneeLabel = (a) => {
  if (!a) return "—";
  const full = [a.first_name, a.last_name].filter(Boolean).join(" ").trim();
  if (full) return full;
  if (a.display_name && !a.display_name.includes("@")) return a.display_name;
  // As a last resort, use the local-part of the email so we never surface the
  // full address in a dropdown (per user request).
  const email = a.email || "";
  const local = email.split("@")[0] || email;
  return local;
};

// Small chip showing an assignee's avatar + name + role. Used in the CMS lists.
const AssigneeChip = ({ email, assignees, size = 24 }) => {
  if (!email) return <span className="text-[10px] text-muted-fg italic">Niet toegewezen</span>;
  const a = (assignees || []).find((x) => x.email === email);
  const name = assigneeLabel(a) || email;
  return (
    <span className="inline-flex items-center gap-1.5" data-testid={`assignee-chip-${email}`}>
      <Avatar name={name} email={email} profilePicture={a?.profile_picture} size={size} />
      <span className="text-[11px] leading-tight">
        <span className="text-strong font-medium block truncate max-w-[140px]">{name}</span>
        {a?.role && <span className="text-muted-fg text-[10px] block">{prettyRole(a.role)}</span>}
      </span>
    </span>
  );
};

// Priority alert balloons stack (above the version bar). Uses localStorage for dismiss + hourly-reappear for P1.
const PriorityAlerts = () => {
  const { authHeader } = useAuth();
  const [alerts, setAlerts] = useState({ counts: { Major: 0, P1: 0, P2: 0 }, latest: {} });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const load = () => axios.get(`${API}/admin/priority-alerts`, { headers: authHeader() }).then((r) => setAlerts(r.data || {})).catch(() => {});
    load();
    const iv = setInterval(load, 60000);
    // Bump every 60s so hourly re-appearance check works
    const t = setInterval(() => setTick((x) => x + 1), 60000);
    return () => { clearInterval(iv); clearInterval(t); };
    // eslint-disable-next-line
  }, []);

  const rules = [
    { key: "Major", label: "Major", color: "bg-red-800 text-white", persist: true, hourly: false },
    { key: "P1", label: "P1", color: "bg-red-500 text-white", persist: false, hourly: true },
    { key: "P2", label: "P2", color: "bg-amber-400 text-slate-900", persist: false, hourly: false },
  ];

  const shouldShow = (level) => {
    const count = alerts?.counts?.[level] || 0;
    if (!count) return false;
    const rule = rules.find((r) => r.key === level);
    if (rule.persist) return true;
    const key = `pb_prio_dismissed_${level}`;
    const dismissed = parseInt(localStorage.getItem(key) || "0", 10);
    if (!dismissed) return true;
    if (rule.hourly) {
      return (Date.now() - dismissed) > 60 * 60 * 1000;
    }
    return false;
  };
  const dismiss = (level) => {
    localStorage.setItem(`pb_prio_dismissed_${level}`, String(Date.now()));
    setTick((x) => x + 1);
  };

  return (
    <div className="space-y-2 mb-3" data-testid="cms-priority-stack">
      {rules.map((r) => (
        shouldShow(r.key) ? (
          <div
            key={r.key}
            className={`rounded-2xl px-4 py-2.5 text-sm font-medium flex items-center gap-3 shadow-lg ${r.color}`}
            data-testid={`cms-prio-bar-${r.key.toLowerCase()}`}
          >
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span className="flex-1">
              <strong>{r.label}</strong> · {alerts.counts[r.key]} open item{alerts.counts[r.key] > 1 ? "s" : ""}
              {alerts.latest?.[r.key]?.subject ? ` — ${alerts.latest[r.key].subject}` : ""}
            </span>
            <Link to="/admin/messages" className="bg-white/25 hover:bg-white/40 rounded-full px-3 py-1 text-xs" data-testid={`cms-prio-view-${r.key.toLowerCase()}`}>
              Bekijk
            </Link>
            {!r.persist && (
              <button onClick={() => dismiss(r.key)} className={r.color.includes("text-slate") ? "text-slate-900/70 hover:text-slate-900" : "text-white/80 hover:text-white"} aria-label="Sluiten" data-testid={`cms-prio-close-${r.key.toLowerCase()}`}>
                <XCircle className="h-4 w-4" />
              </button>
            )}
          </div>
        ) : null
      ))}
    </div>
  );
};
const VersionAlertBar = ({ currentVersion }) => {
  const key = `pb_cms_ack_${currentVersion}`;
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!currentVersion) return;
    const ack = localStorage.getItem(key);
    if (!ack) { setShown(true); return; }
    const dismissedAt = parseInt(ack, 10);
    const days = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
    if (days < 31 && ack !== "seen") setShown(false);
    else setShown(false);
  }, [currentVersion, key]);
  const dismiss = () => { localStorage.setItem(key, String(Date.now())); setShown(false); };
  const markSeen = () => { localStorage.setItem(key, "seen"); setShown(false); };
  if (!shown || !currentVersion) return null;
  return (
    <div className="bg-pear-500 text-white text-sm font-medium mb-4 rounded-2xl flex items-center gap-3 px-4 py-2.5 shadow-lg" data-testid="cms-version-bar">
      <Sparkles className="h-4 w-4 shrink-0" />
      <span className="flex-1">Nieuwe versie <strong>v{currentVersion}</strong> is uitgerold — bekijk wat er is veranderd.</span>
      <Link to="/admin/changelog" onClick={markSeen} className="bg-white/20 hover:bg-white/30 rounded-full px-3 py-1 text-xs" data-testid="cms-version-bar-view">
        Bekijk changelog
      </Link>
      <button onClick={dismiss} className="text-white/80 hover:text-white" aria-label="Sluiten" data-testid="cms-version-bar-close">
        <XCircle className="h-4 w-4" />
      </button>
    </div>
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
  const [filter, setFilter] = useState("active");  // active | archived | all

  const load = async () => {
    // Include archived so admin sees everything
    const res = await axios.get(`${API}/admin/projects/all`, { headers: authHeader() });
    setItems(res.data || []);
  };
  useEffect(() => { load(); }, []); // eslint-disable-line

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
    if (!window.confirm("Project definitief verwijderen? Archiveren is meestal veiliger.")) return;
    try {
      await axios.delete(`${API}/projects/${id}`, { headers: authHeader() });
      toast.success("Verwijderd");
      load();
    } catch { toast.error("Verwijderen mislukt"); }
  };

  const archive = async (id, archived) => {
    try {
      await axios.patch(`${API}/projects/${id}`, { archived }, { headers: authHeader() });
      toast.success(archived ? "Gearchiveerd — niet meer zichtbaar op site" : "Terug op site geplaatst");
      load();
    } catch { toast.error("Actie mislukt"); }
  };

  const shown = filter === "all" ? items : filter === "archived" ? items.filter((p) => p.archived) : items.filter((p) => !p.archived);

  return (
    <div data-testid="cms-projects">
      <header className="mb-6">
        <h1 className="font-heading text-3xl font-medium text-strong">Portfolio beheren</h1>
        <p className="text-sm text-muted-fg mt-1">Voeg cases toe, archiveer (haalt van site) of verwijder permanent.</p>
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

      <div className="flex items-center gap-2 mb-3 text-sm">
        {[
          { key: "active", label: "Actief op site" },
          { key: "archived", label: "Gearchiveerd" },
          { key: "all", label: "Alles" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            data-testid={`cms-project-filter-${f.key}`}
            className={`px-3 py-1.5 rounded-full border text-xs font-medium ${filter === f.key ? "bg-pear-500 text-white border-pear-500" : "text-strong border-app hover:border-pear-500"}`}
          >{f.label}</button>
        ))}
        <span className="ml-auto text-xs text-muted-fg">Totaal: {items.length} · Actief: {items.filter((p) => !p.archived).length}</span>
      </div>

      <div className="surface border border-app rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-app font-heading font-semibold text-strong">Projecten ({shown.length})</div>
        {shown.length === 0 ? (
          <div className="p-8 text-center text-muted-fg text-sm">Geen projecten in deze weergave.</div>
        ) : (
          <ul className="divide-y divide-app">
            {shown.map((p) => (
              <li key={p.id} className={`p-4 flex items-center gap-4 ${p.archived ? "opacity-60" : ""}`} data-testid={`cms-project-row-${p.id}`}>
                <img src={p.image_url} alt={p.title} className="w-16 h-16 object-cover rounded-lg" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-strong truncate">{p.title} {p.archived && <span className="ml-2 text-[10px] uppercase tracking-widest text-amber-600">Gearchiveerd</span>}</p>
                  <p className="text-xs text-muted-fg truncate">{p.tag || p.category}</p>
                </div>
                {p.external_url && <a href={p.external_url} target="_blank" rel="noreferrer" className="text-pear-500 text-sm"><ExternalLink className="h-4 w-4" /></a>}
                <button
                  onClick={() => archive(p.id, !p.archived)}
                  className={`text-xs rounded-full px-3 py-1 border ${p.archived ? "border-emerald-300 text-emerald-600 hover:bg-emerald-50" : "border-amber-300 text-amber-600 hover:bg-amber-50"}`}
                  data-testid={`cms-project-archive-${p.id}`}
                >{p.archived ? "Terugplaatsen" : "Archiveren"}</button>
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
const MSG_PRIORITY = [
  { key: "Major", label: "Major", color: "bg-red-600 text-white" },
  { key: "P1", label: "P1", color: "bg-red-500 text-white" },
  { key: "P2", label: "P2", color: "bg-amber-500 text-white" },
  { key: "P3", label: "P3", color: "bg-slate-400 text-white" },
  { key: "P4", label: "P4", color: "bg-slate-300 text-slate-700" },
];
const priorityRank = (p) => ({ Major: 0, P1: 1, P2: 2, P3: 3, P4: 4 }[p] ?? 3);

const MessagesAdmin = () => {
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
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

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
                    <p className="text-xs text-muted-fg truncate">{m.subject || "(geen onderwerp)"} · {new Date(m.created_at).toLocaleString("nl-NL")}</p>
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

// --- Registrations tab ---
const STATUS_STYLE = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-pear-100 text-pear-700",
  rejected: "bg-red-100 text-red-700",
};

const RegistrationsAdmin = () => {
  const { authHeader, user } = useAuth();
  const [items, setItems] = useState([]);
  const [assignees, setAssignees] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      axios.get(`${API}/portal/registrations`, { headers: authHeader() }),
      axios.get(`${API}/admin/assignees`, { headers: authHeader() }),
    ])
      .then(([r, a]) => { setItems(r.data || []); setAssignees(a.data || []); })
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

// --- Reviews tab ---
const StarsRow = ({ n }) => (
  <div className="flex items-center gap-0.5 text-pear-500">
    {[...Array(5)].map((_, i) => (
      <Star key={i} className={`h-3.5 w-3.5 ${i < n ? "fill-current" : "opacity-25"}`} />
    ))}
  </div>
);

const ReviewsAdmin = () => {
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

// --- Users & Roles tab ---
const ROLE_LABELS = {
  super_admin: "Super administrator",
  beheerder: "Beheerder",
  analist: "Analist",
  moderator: "Moderator",
  chat_support: "Chat support",
  financien: "Financiën",
  crm: "CRM (Customer Relationship)",
  gebruiker: "Gebruiker",
  admin: "Beheerder (legacy)",
};

// Random pear-and-robot themed avatar generator using DiceBear (bots) with a pear-fresh palette.
const RANDOM_AVATAR_PALETTES = ["02c0ff", "6ee7b7", "34d399", "10b981", "0891b2", "22d3ee", "34e0a1", "84cc16"];
const generatePearAvatar = (seed) => {
  const s = encodeURIComponent(seed || String(Math.random()).slice(2, 10));
  const bg = RANDOM_AVATAR_PALETTES[Math.floor(Math.random() * RANDOM_AVATAR_PALETTES.length)];
  return `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${s}&backgroundColor=${bg}&scale=90`;
};

const UsersAdmin = () => {
  const { authHeader, user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ email: "", role: "gebruiker", password: "", display_name: "" });
  const [editingUser, setEditingUser] = useState(null); // email being edited

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

      <section className="surface border border-app rounded-2xl overflow-x-auto mb-6">
        {loading ? <p className="p-6 text-muted-fg text-sm">Laden…</p> : (
          <table className="w-full text-sm min-w-[720px]" data-testid="cms-users-table">
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
                    <div className="inline-flex items-center gap-1">
                      <button
                        onClick={() => setEditingUser(u.email)}
                        data-testid={`user-edit-${u.email}`}
                        className="inline-flex items-center gap-1 text-xs text-strong hover:bg-pear-50 px-2.5 py-1 rounded-full border border-app"
                      >
                        Bewerken
                      </button>
                      {u.email !== me?.email && u.auth_source !== "zoho-only" && (
                        <button onClick={() => remove(u.email)} data-testid={`user-delete-${u.email}`}
                          className="inline-flex items-center gap-1 text-xs text-red-500 hover:bg-red-50 px-2.5 py-1 rounded-full border border-red-200">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
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
      {editingUser && (
        <UserDetailsModal
          email={editingUser}
          onClose={() => { setEditingUser(null); load(); }}
          canEditPassword={isBeheerder}
        />
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

  const set = (k) => (e) => setDetails((d) => ({ ...(d || {}), [k]: e.target.value }));

  return (
    <div className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose} data-testid="user-details-modal">
      <div className="w-full max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto border border-app bg-white dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <header className="px-6 py-4 border-b border-app flex items-center justify-between">
          <div>
            <div className="font-heading text-lg font-semibold text-strong">Gebruiker bewerken</div>
            <p className="text-xs text-muted-fg">{email}</p>
          </div>
          <button onClick={onClose} className="text-muted-fg hover:text-strong text-2xl leading-none" data-testid="user-details-close">×</button>
        </header>
        {!details ? <p className="p-6 text-muted-fg">Laden…</p> : (
          <form onSubmit={save} className="p-6 space-y-5">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <Avatar name={`${details.first_name || ""} ${details.last_name || ""}`.trim() || email} email={email} profilePicture={details.profile_picture} size={64} />
              <div className="flex flex-col gap-2">
                <button type="button" onClick={randomize} className="text-xs px-3 py-1.5 rounded-full border border-app hover:border-pear-500" data-testid="user-details-avatar-random">Random pear-avatar</button>
                <button type="button" onClick={removeAvatar} className="text-xs px-3 py-1.5 rounded-full border border-app hover:border-red-400" data-testid="user-details-avatar-remove">Terug naar initialen</button>
              </div>
            </div>
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
                <span className="text-[10px] uppercase tracking-widest text-muted-fg">Adres *</span>
                <input required value={details.address || ""} onChange={set("address")} className="mt-1 w-full rounded-lg border border-app bg-white dark:bg-slate-800 px-3 py-2 text-sm text-strong" data-testid="user-details-address" />
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-widest text-muted-fg">Postcode *</span>
                <input required value={details.postal_code || ""} onChange={set("postal_code")} className="mt-1 w-full rounded-lg border border-app bg-white dark:bg-slate-800 px-3 py-2 text-sm text-strong" data-testid="user-details-postal" />
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-widest text-muted-fg">Plaats</span>
                <input value={details.city || ""} onChange={set("city")} className="mt-1 w-full rounded-lg border border-app bg-white dark:bg-slate-800 px-3 py-2 text-sm text-strong" data-testid="user-details-city" />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-[10px] uppercase tracking-widest text-muted-fg">Land</span>
                <input value={details.country || "Nederland"} onChange={set("country")} className="mt-1 w-full rounded-lg border border-app bg-white dark:bg-slate-800 px-3 py-2 text-sm text-strong" data-testid="user-details-country" />
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
  const [captchaStats, setCaptchaStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [virusUnread, setVirusUnread] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      const [b, s, c, v] = await Promise.all([
        axios.get(`${API}/admin/cybersecurity/blocks`, { headers: authHeader() }),
        axios.get(`${API}/admin/cybersecurity/stats`, { headers: authHeader() }),
        axios.get(`${API}/admin/cybersecurity/captcha-stats`, { headers: authHeader() }).catch(() => ({ data: null })),
        axios.get(`${API}/admin/virus-scanner/unread`, { headers: authHeader() }).catch(() => ({ data: { count: 0 } })),
      ]);
      setBlocks(b.data || []);
      setStats(s.data || null);
      setCaptchaStats(c.data || null);
      setVirusUnread(v.data?.count || 0);
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
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-heading text-2xl font-semibold text-strong flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-pear-500" />
            Cybersecurity
          </h2>
          <p className="text-sm text-muted-fg mt-1">Verzoeken die door de rate-limiter, spam-filter of honeypot zijn geblokkeerd. Je kunt handmatig ont- of herblokkeren.</p>
        </div>
        <Link
          to="/admin/virusscanner"
          onClick={async () => {
            try { await axios.post(`${API}/admin/virus-scanner/acknowledge-all`, {}, { headers: authHeader() }); setVirusUnread(0); } catch { /* ignore */ }
          }}
          className="btn-secondary relative"
          data-testid="cs-open-virus-scanner"
        >
          <ShieldX className="h-4 w-4" /> Virusscanner openen
          {virusUnread > 0 && (
            <span className="absolute -top-2 -right-2 inline-flex items-center justify-center min-w-[22px] h-5 rounded-full bg-red-500 text-white text-[10px] font-bold px-1.5 shadow" data-testid="cs-virus-unread-badge">
              {virusUnread > 99 ? "99+" : virusUnread}
            </span>
          )}
        </Link>
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

      {captchaStats?.daily?.length > 0 && (
        <div className="rounded-2xl border border-app p-5 surface" data-testid="cs-captcha-chart">
          <div className="text-xs uppercase tracking-widest text-muted-fg mb-1">Geverifieerde captchas (30 dagen)</div>
          <div className="font-heading text-2xl font-medium text-strong mb-3" data-testid="cs-captcha-total">{captchaStats.total_30d}</div>
          <div className="flex items-end gap-1.5 h-24">
            {captchaStats.daily.map((d) => {
              const max = captchaStats.daily.reduce((m, x) => Math.max(m, x.count), 1);
              return (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-emerald-500 rounded-t"
                    style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count > 0 ? "2px" : "0" }}
                    title={`${d.day}: ${d.count} captchas`}
                  />
                </div>
              );
            })}
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
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-pear-50/50 dark:bg-pear-500/5 text-left">
              <tr>
                <th className="px-3 py-2 font-semibold text-xs uppercase tracking-widest text-muted-fg">Wie (IP · Land)</th>
                <th className="px-3 py-2 font-semibold text-xs uppercase tracking-widest text-muted-fg">Wat</th>
                <th className="px-3 py-2 font-semibold text-xs uppercase tracking-widest text-muted-fg">Waar</th>
                <th className="px-3 py-2 font-semibold text-xs uppercase tracking-widest text-muted-fg">Hoe (OS · Browser · Device)</th>
                <th className="px-3 py-2 font-semibold text-xs uppercase tracking-widest text-muted-fg">Wanneer</th>
                <th className="px-3 py-2 font-semibold text-xs uppercase tracking-widest text-muted-fg">Status</th>
                <th className="px-3 py-2 sticky right-0 bg-pear-50/50 dark:bg-pear-500/5" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-fg">Laden…</td></tr>
              ) : shown.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-fg">Geen geblokkeerde verzoeken.</td></tr>
              ) : shown.map((b) => (
                <tr key={b.id} className="border-t border-app/50" data-testid={`cs-row-${b.id}`}>
                  <td className="px-3 py-2 text-xs">
                    <div className="font-mono">{b.ip}</div>
                    <div className="text-[10px] text-muted-fg">{b.country || "Onbekend"}</div>
                    {b.ip_manually_blocked && <span className="inline-block mt-1 px-1 py-0.5 text-[9px] rounded bg-red-100 text-red-600">manual</span>}
                  </td>
                  <td className="px-3 py-2 text-strong">{REASON_LABEL[b.reason] || b.reason}</td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-fg">{b.endpoint}</td>
                  <td className="px-3 py-2 text-xs">
                    <div className="text-strong">{b.os || "?"} · {b.browser || "?"}</div>
                    <div className="text-[10px] text-muted-fg">{b.device || "?"}</div>
                    <div className="text-[10px] text-muted-fg truncate max-w-[220px]" title={b.user_agent}>{b.user_agent}</div>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-fg whitespace-nowrap">{new Date(b.created_at).toLocaleString("nl-NL")}</td>
                  <td className="px-3 py-2">
                    {b.unblocked ? (
                      <span className="text-xs text-emerald-600 font-semibold">Gedeblokkeerd</span>
                    ) : (
                      <span className="text-xs text-red-500 font-semibold">Geblokkeerd</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap sticky right-0 surface border-l-2 border-app shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.15)]">
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
        <div className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={() => setOpenItem(null)} data-testid="fb-notes-modal">
          <div className="w-full max-w-lg surface border border-app rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
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
              <input name="note" placeholder="Voeg een notitie toe…" className="flex-1 rounded-xl border border-app surface px-3 py-2 text-sm" data-testid="fb-note-input" />
              <button type="submit" className="btn-primary" data-testid="fb-note-submit">Toevoegen</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ------------------------------------------------------------
// IMAP Mailboxes CMS — connect and switch inboxes
// (Real IMAP fetching is MOCKED — settings storage is real.)
// ------------------------------------------------------------
const MailboxesAdmin = () => {
  const { authHeader, user } = useAuth();
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ label: "", email: "", host: "", port: 993, username: "", password: "", use_ssl: true });
  const [selectedId, setSelectedId] = useState(null);
  const canManage = ["super_admin", "admin", "beheerder"].includes(user?.role);

  const load = async () => {
    try { const r = await axios.get(`${API}/admin/mailboxes`, { headers: authHeader() }); setItems(r.data || []); }
    catch { toast.error("Kon mailboxen niet laden"); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const add = async (e) => {
    e.preventDefault();
    try {
      const r = await axios.post(`${API}/admin/mailboxes`, form, { headers: authHeader() });
      toast.success("Mailbox toegevoegd");
      setItems([...items, r.data]);
      setForm({ label: "", email: "", host: "", port: 993, username: "", password: "", use_ssl: true });
      setShowForm(false);
    } catch (e) { toast.error(e?.response?.data?.detail || "Toevoegen mislukt"); }
  };

  const del = async (id) => {
    if (!window.confirm("Deze mailbox verwijderen?")) return;
    try { await axios.delete(`${API}/admin/mailboxes/${id}`, { headers: authHeader() }); toast.success("Verwijderd"); load(); }
    catch { toast.error("Verwijderen mislukt"); }
  };

  return (
    <div data-testid="cms-mailboxes">
      <h2 className="font-heading text-2xl font-semibold text-strong flex items-center gap-2">
        <Inbox className="h-6 w-6 text-pear-500" /> Mailboxen (IMAP)
      </h2>
      <p className="text-sm text-muted-fg mt-1 mb-4">
        Verbind je IMAP-mailboxen zodat ze samen met de Berichten-CMS lopen. Actuele bericht-synchronisatie is <strong>MOCKED</strong> — instellingen worden wel opgeslagen. Alleen beheerders en super admins kunnen mailboxen toevoegen of verwijderen.
      </p>

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
                  <p className="text-xs text-muted-fg font-mono">{m.email} · {m.host}:{m.port} {m.use_ssl && "(SSL)"}</p>
                  <p className="text-[10px] text-muted-fg mt-0.5">Laatste sync: {m.last_sync ? new Date(m.last_sync).toLocaleString("nl-NL") : "nooit"}</p>
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
              <label className="flex items-center gap-2 text-xs md:col-span-2">
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
      <p className="text-[11px] text-muted-fg mt-4">
        <strong>Note:</strong> IMAP-fetching is momenteel MOCKED. Instellingen worden opgeslagen, maar mails worden nog niet automatisch opgehaald. Voor productie moet <code>python-imaplib</code>/<code>aioimaplib</code> gekoppeld worden + Zoho Desk sync via subject-parsing (regex <code>#TKT-\d+</code>).
      </p>
    </div>
  );
};

// ------------------------------------------------------------
// Brevo CMS — settings + campaigns (MOCKED)
// ------------------------------------------------------------
const BrevoAdmin = () => {
  const { authHeader } = useAuth();
  const [settings, setSettings] = useState({ from_email: "communication-noreply@pearblue.nl", from_name: "PearBlue", enabled: false, api_key_set: false });
  const [apiKey, setApiKey] = useState("");
  const [stats, setStats] = useState(null);
  const [campaigns, setCampaigns] = useState(null);

  const load = async () => {
    try {
      const [s, st, c] = await Promise.all([
        axios.get(`${API}/admin/brevo/settings`, { headers: authHeader() }),
        axios.get(`${API}/admin/newsletter/stats`, { headers: authHeader() }).catch(() => ({ data: null })),
        axios.get(`${API}/admin/brevo/campaigns`, { headers: authHeader() }).catch(() => ({ data: null })),
      ]);
      setSettings(s.data || settings);
      setStats(st.data);
      setCampaigns(c.data);
    } catch { /* ignore */ }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const save = async (e) => {
    e.preventDefault();
    try {
      const body = { from_email: settings.from_email, from_name: settings.from_name, enabled: settings.enabled };
      if (apiKey) body.api_key = apiKey;
      await axios.put(`${API}/admin/brevo/settings`, body, { headers: authHeader() });
      toast.success("Brevo-instellingen opgeslagen");
      setApiKey("");
      load();
    } catch { toast.error("Opslaan mislukt"); }
  };

  const maxDaily = stats?.daily?.reduce((m, d) => Math.max(m, d.count), 1) || 1;
  return (
    <div data-testid="cms-brevo">
      <h2 className="font-heading text-2xl font-semibold text-strong flex items-center gap-2">
        <Send className="h-6 w-6 text-pear-500" /> Mailmarketing (Brevo)
      </h2>
      <p className="text-sm text-muted-fg mt-1 mb-4">
        Beheer je nieuwsbrief-lijsten en campagnes. Vul hieronder je Brevo API-sleutel in — de rest van deze pagina wordt actief zodra de sleutel is opgeslagen. <strong>Verzendingen zijn momenteel MOCKED</strong>.
      </p>

      <form onSubmit={save} className="surface border border-app rounded-2xl p-6 space-y-3 mb-6" data-testid="brevo-settings-form">
        <div>
          <label className="text-xs uppercase tracking-widest text-muted-fg">Brevo API-sleutel {settings.api_key_set && <span className="text-emerald-600 ml-2">✓ geconfigureerd</span>}</label>
          <input
            type="password"
            placeholder={settings.api_key_set ? "•••••• (leeg laten om huidige te behouden)" : "xkeysib-xxxxxxxxxxxxx"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="mt-1 w-full rounded-lg border border-app surface px-3 py-2 text-sm font-mono"
            data-testid="brevo-api-key"
          />
          <p className="text-[11px] text-muted-fg mt-1">Haal je API-sleutel op via app.brevo.com → SMTP &amp; API → API Keys. Alleen v3 keys.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input value={settings.from_email} onChange={(e) => setSettings({ ...settings, from_email: e.target.value })} className="rounded-lg border border-app surface px-3 py-2 text-sm" placeholder="Verzend-e-mail" data-testid="brevo-from-email" />
          <input value={settings.from_name} onChange={(e) => setSettings({ ...settings, from_name: e.target.value })} className="rounded-lg border border-app surface px-3 py-2 text-sm" placeholder="Verzendnaam" data-testid="brevo-from-name" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={settings.enabled} onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })} className="accent-pear-500" data-testid="brevo-enabled" />
          Mailmarketing inschakelen
        </label>
        <button type="submit" className="btn-primary" data-testid="brevo-save">Opslaan</button>
      </form>

      {stats && (
        <div className="rounded-2xl border border-app p-5 surface mb-6" data-testid="brevo-newsletter-stats">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-fg">Aanmeldingen (totaal)</div>
              <div className="font-heading text-3xl font-medium text-strong" data-testid="newsletter-total">{stats.total}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-fg">Laatste 30 dagen</div>
              <div className="font-heading text-3xl font-medium text-strong">{stats.last_30d}</div>
            </div>
          </div>
          {stats.daily?.length > 0 && (
            <div className="flex items-end gap-1.5 h-24">
              {stats.daily.map((d) => (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full bg-pear-500 rounded-t" style={{ height: `${(d.count / maxDaily) * 100}%`, minHeight: d.count > 0 ? "2px" : "0" }} title={`${d.day}: ${d.count}`} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {campaigns && (
        <div className="rounded-2xl border border-app p-5 surface" data-testid="brevo-campaigns">
          <div className="text-xs uppercase tracking-widest text-muted-fg mb-3">Campagnes (MOCKED: {campaigns.reason})</div>
          {(campaigns.campaigns || []).length === 0 ? (
            <div className="text-sm text-muted-fg">Nog geen campagnes.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-fg">
                <tr><th className="py-1">Naam</th><th>Status</th><th className="text-right">Verzonden</th><th className="text-right">Geopend</th><th className="text-right">Klikken</th></tr>
              </thead>
              <tbody>
                {(campaigns.campaigns || []).map((c) => (
                  <tr key={c.id} className="border-t border-app/40">
                    <td className="py-2">{c.name}</td>
                    <td><span className="text-xs rounded-full px-2 py-0.5 bg-slate-100 text-slate-600">{c.status}</span></td>
                    <td className="text-right font-mono">{c.sent}</td>
                    <td className="text-right font-mono">{c.opened}</td>
                    <td className="text-right font-mono">{c.clicked}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

// ------------------------------------------------------------
// Virus scanner tab (MOCKED — same layout as production, but no real scan engine yet)
// ------------------------------------------------------------
const VirusScannerAdmin = () => {
  const { authHeader } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    try { const r = await axios.get(`${API}/admin/virus-scanner/logs`, { headers: authHeader() }); setLogs(r.data || []); }
    catch { toast.error("Kon virus-logs niet laden"); } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);
  const act = async (id, action) => {
    try {
      await axios.post(`${API}/admin/virus-scanner/${id}/${action}`, {}, { headers: authHeader() });
      toast.success(action === "quarantine" ? "In quarantaine gezet" : "Teruggezet");
      load();
    } catch { toast.error("Actie mislukt"); }
  };
  return (
    <div data-testid="cms-virusscanner">
      <h2 className="font-heading text-2xl font-semibold text-strong flex items-center gap-2">
        <ShieldX className="h-6 w-6 text-red-500" /> Virusscanner
      </h2>
      <p className="text-sm text-muted-fg mt-1 mb-6">
        Overzicht van gedetecteerde bedreigingen. In quarantaine gezette items blijven in de lijst en kunnen worden teruggezet. <strong>MOCKED:</strong> deze module is UI-only tot een externe scan-engine (ClamAV / VirusTotal API) wordt gekoppeld.
      </p>
      <div className="rounded-2xl border border-app overflow-hidden surface" data-testid="virus-logs-table">
        {loading ? <div className="p-8 text-center text-muted-fg">Laden…</div> :
          logs.length === 0 ? (
            <div className="p-10 text-center text-muted-fg text-sm">
              Nog geen detecties. Dit is verwacht — de scanner is nog niet actief.
              <div className="mt-4 text-[11px]">Roadmap: ClamAV/EDR-integratie + automatische mail-alert bij ernstige detecties + automatische quarantaine bij CVSS ≥ 7.</div>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-red-50 dark:bg-red-500/10 text-left">
                <tr>
                  <th className="px-3 py-2 text-xs uppercase tracking-widest text-muted-fg">Bestand/Bron</th>
                  <th className="px-3 py-2 text-xs uppercase tracking-widest text-muted-fg">Bedreiging</th>
                  <th className="px-3 py-2 text-xs uppercase tracking-widest text-muted-fg">Severity</th>
                  <th className="px-3 py-2 text-xs uppercase tracking-widest text-muted-fg">Gedetecteerd</th>
                  <th className="px-3 py-2 text-xs uppercase tracking-widest text-muted-fg">Status</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-t border-app/50">
                    <td className="px-3 py-2 text-xs font-mono">{l.source || l.filename}</td>
                    <td className="px-3 py-2">{l.threat}</td>
                    <td className="px-3 py-2 text-xs">{l.severity}</td>
                    <td className="px-3 py-2 text-xs text-muted-fg">{new Date(l.detected_at).toLocaleString("nl-NL")}</td>
                    <td className="px-3 py-2 text-xs">{l.quarantined ? "In quarantaine" : "Actief"}</td>
                    <td className="px-3 py-2 text-right">
                      {l.quarantined
                        ? <button onClick={() => act(l.id, "restore")} className="text-xs px-2.5 py-1 rounded-full border border-emerald-200 text-emerald-600 hover:bg-emerald-50">Terugzetten</button>
                        : <button onClick={() => act(l.id, "quarantine")} className="text-xs px-2.5 py-1 rounded-full border border-red-200 text-red-500 hover:bg-red-50">In quarantaine</button>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        }
      </div>
    </div>
  );
};

// ------------------------------------------------------------
// Changelog admin — reads public /api/changelog
// ------------------------------------------------------------
const ChangelogAdmin = () => {
  const [data, setData] = useState({ entries: [], current: null });
  useEffect(() => { axios.get(`${API}/changelog`).then((r) => setData(r.data || { entries: [] })).catch(() => {}); }, []);
  return (
    <div data-testid="cms-changelog">
      <h2 className="font-heading text-2xl font-semibold text-strong flex items-center gap-2">
        <Sparkles className="h-6 w-6 text-pear-500" /> Changelog / Versies
      </h2>
      <p className="text-sm text-muted-fg mt-1 mb-6">Alle uitgebrachte versies van het platform. Huidige versie: <strong>v{data.current || "?"}</strong></p>
      <div className="relative pl-6">
        <div className="absolute left-2 top-1 bottom-1 w-px surface" />
        {data.entries.map((e, i) => (
          <div key={e.version} className="relative mb-8" data-testid={`cms-changelog-${e.version}`}>
            <div className={`absolute -left-6 top-1.5 w-3 h-3 rounded-full ${i === 0 ? "bg-pear-500 ring-4 ring-pear-500/20" : "surface border-2 border-pear-300"}`} />
            <div className="flex items-baseline gap-3 flex-wrap">
              <h3 className="font-heading text-xl font-semibold text-strong">v{e.version}</h3>
              <span className="text-xs text-muted-fg">{new Date(e.date).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}</span>
            </div>
            <ul className="mt-2 space-y-1 text-sm text-strong/90 list-disc pl-5">
              {e.highlights.map((h, idx) => <li key={idx}>{h}</li>)}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};

const AdminLayout = ({ children }) => {
  const [currentVersion, setCurrentVersion] = useState(null);
  useEffect(() => {
    axios.get(`${API}/changelog`)
      .then((r) => setCurrentVersion(r.data?.current || null))
      .catch(() => {});
  }, []);
  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-10 py-10">
      <div className="mb-6 text-sm hidden lg:block">
        <Link to="/" className="text-muted-fg hover:text-pear-500">← Terug naar site</Link>
      </div>
      <div className="flex flex-col lg:flex-row gap-8">
        <AdminSidebar />
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex-1 min-w-0">
          <PriorityAlerts />
          <VersionAlertBar currentVersion={currentVersion} />
          {children}
        </motion.div>
      </div>
    </div>
  );
};

export default function AdminDashboard() {
  return (
    <RequireAdmin>
      <AdminLayout>
        <Routes>
          <Route index element={<ProjectsAdmin />} />
          <Route path="analytics" element={<AnalyticsAdmin />} />
          <Route path="financials" element={<FinancialsAdmin />} />
          <Route path="registrations" element={<RegistrationsAdmin />} />
          <Route path="reviews" element={<ReviewsAdmin />} />
          <Route path="users" element={<UsersAdmin />} />
          <Route path="scripts" element={<ScriptsAdmin />} />
          <Route path="settings" element={<SettingsAdmin />} />
          <Route path="messages" element={<MessagesAdmin />} />
          <Route path="feedback" element={<FeedbackAdmin />} />
          <Route path="cybersecurity" element={<CybersecurityAdmin />} />
          <Route path="virusscanner" element={<VirusScannerAdmin />} />
          <Route path="mailboxes" element={<MailboxesAdmin />} />
          <Route path="mailmarketing" element={<BrevoAdmin />} />
          <Route path="changelog" element={<ChangelogAdmin />} />
        </Routes>
      </AdminLayout>
    </RequireAdmin>
  );
}

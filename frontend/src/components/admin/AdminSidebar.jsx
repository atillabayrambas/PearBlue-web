import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { NavLink, Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Briefcase, Settings as SettingsIcon, Inbox, LogOut, BarChart3, UserPlus, Star, Users, Code, ShieldAlert, MessageSquare, Send, Menu, XCircle, Euro, Search } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { useLang } from "../../i18n/LanguageContext";
import { useTheme } from "../../theme/ThemeContext";
import { Avatar } from "../Avatar";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import { useSilentPolling } from "../../hooks/useSilentPolling";
import { API, PEARBLUE_LOGO, authHeaderFromStorage } from "./_shared";

// Counter keys that should trigger a "new item" toast when they increment
// during a silent poll. Deliberately excludes `messages` because those are
// already streamed live via the mailboxes IMAP UI and would spam.
const TOAST_COUNTER_KEYS = [
  { key: "messages", labelNl: "nieuw bericht", labelEn: "new message", target: "/admin/messages" },
  { key: "portal", labelNl: "portaal-aanvraag", labelEn: "portal request", target: "/admin/registrations" },
  { key: "reviews", labelNl: "review", labelEn: "review", target: "/admin/reviews" },
  { key: "feedback", labelNl: "feedback", labelEn: "feedback", target: "/admin/feedback" },
  { key: "cybersecurity", labelNl: "veiligheidsmelding", labelEn: "security event", target: "/admin/cybersecurity" },
];

export const AdminSidebar = () => {
  const { user, logout } = useAuth();
  const { lang, setLang } = useLang();
  const { mode, setMode } = useTheme();
  const navigate = useNavigate();
  const [counters, setCounters] = useState({});
  const [profile, setProfile] = useState(null);
  const [version, setVersion] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchHits, setSearchHits] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchBusy, setSearchBusy] = useState(false);
  const searchTimer = useRef(null);
  useBodyScrollLock(mobileOpen);
  useEffect(() => {
    axios.get(`${API}/admin/counters`, { headers: authHeaderFromStorage() }).then((r) => setCounters(r.data || {})).catch(() => {});
    axios.get(`${API}/site/version`).then((r) => setVersion(r.data?.version || "")).catch(() => {});
  }, []);
  // Refresh sidebar badge counters silently every 30s. When a counter INCREASES
  // between polls, surface a subtle toast so the admin never misses inbound
  // items. Existing item states (dropdowns, forms) are preserved because the
  // hook already skips ticks while the user is interacting.
  useSilentPolling(
    () => axios.get(`${API}/admin/counters`, { headers: authHeaderFromStorage() }).then((r) => r.data || {}).catch(() => null),
    (data) => { if (data) setCounters(data); },
    30000,
    [],
    (prev, next) => {
      if (!prev || !next) return;
      const en = lang === "en";
      TOAST_COUNTER_KEYS.forEach(({ key, labelNl, labelEn, target }) => {
        const before = prev?.[key] || 0;
        const after = next?.[key] || 0;
        if (after > before) {
          const delta = after - before;
          const label = en ? labelEn : labelNl;
          toast(
            en
              ? `${delta} new ${label}${delta > 1 ? "s" : ""}`
              : `${delta} nieuwe ${label}${delta > 1 ? "s" : ""}`,
            {
              description: en ? "Click to open" : "Klik om te openen",
              action: {
                label: en ? "Open" : "Open",
                onClick: () => navigate(target),
              },
            }
          );
        }
      });
    },
  );

  // Global search — debounced 250ms. Empty query closes the dropdown.
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const q = searchQ.trim();
    if (q.length < 2) { setSearchHits([]); setSearchOpen(false); return; }
    setSearchBusy(true);
    setSearchOpen(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const r = await axios.get(`${API}/admin/search`, { params: { q, limit: 12 }, headers: authHeaderFromStorage() });
        setSearchHits(r.data?.hits || []);
      } catch { setSearchHits([]); }
      finally { setSearchBusy(false); }
    }, 250);
    return () => searchTimer.current && clearTimeout(searchTimer.current);
  }, [searchQ]);

  const goHit = (hit) => {
    setSearchOpen(false);
    setSearchQ("");
    if (hit?.target) navigate(hit.target);
  };

  useEffect(() => {
    if (!user?.email) return;
    axios.get(`${API}/admin/users/${encodeURIComponent(user.email)}/details`, { headers: authHeaderFromStorage() })
      .then((r) => setProfile(r.data))
      .catch(() => {});
  }, [user?.email]);
  const role = user?.role || "";
  const canSeeFinancials = ["super_admin", "admin", "beheerder", "financien"].includes(role);
  const items = [
    { to: "/admin", label: lang === "en" ? "AI dashboard" : "AI dashboard", icon: BarChart3, end: true, testid: "cms-nav-analytics" },
    { to: "/admin/portfolio", label: "Portfolio", icon: Briefcase, testid: "cms-nav-projects" },
    ...(canSeeFinancials ? [{ to: "/admin/financials", label: lang === "en" ? "Financials" : "Financiën", icon: Euro, testid: "cms-nav-financials" }] : []),
    { to: "/admin/registrations", label: lang === "en" ? "Portal requests" : "Portaal aanvragen", icon: UserPlus, testid: "cms-nav-registrations", badge: counters.portal },
    { to: "/admin/reviews", label: lang === "en" ? "Client reviews" : "Klantreviews", icon: Star, testid: "cms-nav-reviews", badge: counters.reviews },
    { to: "/admin/messages", label: lang === "en" ? "Messages" : "Berichten", icon: Inbox, testid: "cms-nav-messages", badge: counters.messages },
    { to: "/admin/feedback", label: lang === "en" ? "Feedback" : "Feedback", icon: MessageSquare, testid: "cms-nav-feedback", badge: counters.feedback },
    { to: "/admin/cybersecurity", label: lang === "en" ? "Cybersecurity" : "Cybersecurity", icon: ShieldAlert, testid: "cms-nav-cybersecurity", badge: counters.cybersecurity },
    { to: "/admin/users", label: lang === "en" ? "Users & roles" : "Gebruikers & rollen", icon: Users, testid: "cms-nav-users" },
    { to: "/admin/mailboxes", label: lang === "en" ? "Mailboxes (IMAP)" : "Mailboxen (IMAP)", icon: Inbox, testid: "cms-nav-mailboxes" },
    { to: "/admin/mailmarketing", label: lang === "en" ? "Mailmarketing (Brevo)" : "Mailmarketing (Brevo)", icon: Send, testid: "cms-nav-brevo" },
    { to: "/admin/scripts", label: lang === "en" ? "Custom scripts" : "Custom scripts", icon: Code, testid: "cms-nav-scripts" },
    { to: "/admin/settings", label: lang === "en" ? "Site settings" : "Site instellingen", icon: SettingsIcon, testid: "cms-nav-settings" },
  ];
  const displayName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() || user?.display_name || user?.email;
  const nextTheme = { light: "dark", dark: "system", system: "light" }[mode] || "light";
  const themeIcon = mode === "light" ? "☀️" : mode === "dark" ? "🌙" : "🖥️";
  return (
    <>
      <div className="lg:hidden sticky top-0 z-40 -mx-6 sm:-mx-10 mb-3 flex items-center gap-2 px-3 py-2 surface border-b border-app" data-testid="cms-mobile-header">
        <button onClick={() => setMobileOpen((v) => !v)} className="p-1.5 rounded-lg surface-2 hover:bg-pear-100/50" aria-label="Menu" aria-expanded={mobileOpen} data-testid="cms-mobile-toggle">
          <Menu className="h-5 w-5 text-strong" />
        </button>
        <Link to="/" className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-strong hover:text-pear-500 px-3 py-1.5 rounded-full border border-app" data-testid="cms-mobile-back">
          ← {lang === "en" ? "Back to site" : "Terug naar site"}
        </Link>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setMobileOpen(false)} data-testid="cms-mobile-backdrop" aria-hidden="true" />
      )}

      <aside
        className={`lg:w-64 shrink-0 surface border border-app rounded-2xl p-5 self-start lg:sticky lg:top-6 ${mobileOpen ? "fixed inset-y-0 left-0 z-40 w-72 max-w-[85vw] rounded-none overflow-y-auto overscroll-contain lg:relative lg:z-auto lg:inset-auto lg:w-64 lg:overflow-visible" : "hidden lg:block"}`}
        data-testid="cms-sidebar"
        style={mobileOpen ? { WebkitOverflowScrolling: "touch", height: "100dvh", maxHeight: "100dvh", paddingTop: "max(env(safe-area-inset-top), 20px)", paddingBottom: "max(env(safe-area-inset-bottom), 20px)", boxSizing: "border-box" } : undefined}
      >
        <div className="flex items-center justify-between mb-5 lg:mb-6">
          <button onClick={() => setMobileOpen(false)} className="lg:hidden p-1.5 rounded-lg hover:bg-pear-100/50 order-2" aria-label="Sluit menu" data-testid="cms-mobile-close">
            <XCircle className="h-5 w-5 text-strong" />
          </button>
          <img src={PEARBLUE_LOGO} alt="PearBlue" className="h-12 lg:h-14 w-auto mx-auto order-1" data-testid="cms-sidebar-logo" onError={(e) => { e.target.style.display = 'none'; }} />
        </div>

        <div className="mb-6 flex items-center gap-3" data-testid="cms-sidebar-profile">
          <Avatar name={displayName} email={user?.email} profilePicture={profile?.profile_picture} size={40} />
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-widest text-muted-fg">{lang === "en" ? "Signed in as" : "Ingelogd als"}</p>
            <p className="font-heading font-semibold text-strong text-sm mt-0.5 truncate">{displayName}</p>
            {user?.email && <p className="text-[10px] text-muted-fg truncate mt-0.5" data-testid="cms-sidebar-email">{user.email}</p>}
          </div>
        </div>

        {/* Global CMS search */}
        <div className="relative mb-4" data-testid="cms-sidebar-search">
          <div className="flex items-center gap-2 rounded-xl surface-2 border border-app px-3 py-2 focus-within:border-pear-500 transition-colors">
            <Search className="h-4 w-4 text-muted-fg shrink-0" />
            <input
              type="text"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              onFocus={() => searchQ.trim().length >= 2 && setSearchOpen(true)}
              onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
              placeholder={lang === "en" ? "Search messages, tickets…" : "Zoek berichten, tickets…"}
              className="flex-1 bg-transparent text-xs text-strong placeholder:text-muted-fg outline-none"
              data-testid="cms-sidebar-search-input"
              aria-label={lang === "en" ? "Global CMS search" : "Globaal zoeken"}
            />
            {searchBusy && <span className="text-[10px] text-muted-fg animate-pulse">…</span>}
          </div>
          {searchOpen && (searchHits.length > 0 || (!searchBusy && searchQ.trim().length >= 2)) && (
            <div
              className="absolute left-0 right-0 top-full mt-1 max-h-96 overflow-auto rounded-xl surface border border-app shadow-xl z-50"
              data-testid="cms-sidebar-search-results"
            >
              {searchHits.length === 0 ? (
                <div className="p-3 text-xs text-muted-fg" data-testid="cms-sidebar-search-empty">
                  {lang === "en" ? "No matches" : "Geen resultaten"}
                </div>
              ) : (
                searchHits.map((h, i) => (
                  <button
                    key={`${h.kind}-${h.id || i}`}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); goHit(h); }}
                    className="w-full text-left px-3 py-2 hover:bg-pear-100/50 dark:hover:bg-pear-500/10 border-b border-app last:border-b-0 flex items-start gap-2"
                    data-testid={`cms-sidebar-search-hit-${i}`}
                  >
                    <span className={`shrink-0 text-[9px] uppercase tracking-widest rounded-full px-1.5 py-0.5 mt-0.5 ${
                      h.kind === "message" ? "bg-pear-100 text-pear-600 dark:bg-pear-500/20"
                      : h.kind === "portal" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20"
                      : h.kind === "review" ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20"
                      : "bg-slate-100 text-slate-700 dark:bg-slate-500/20"
                    }`}>{h.kind}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold text-strong truncate">
                        {h.ref && <span className="font-mono text-pear-500 mr-1">#{h.ref}</span>}
                        {h.title}
                      </span>
                      {h.subtitle && <span className="block text-[10px] text-muted-fg truncate">{h.subtitle}</span>}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
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
                <span className="inline-flex items-center justify-center min-w-[18px] h-4 rounded-full bg-red-500 text-white text-[9px] font-bold px-1" data-testid={`badge-${i.testid}`}>
                  {i.badge > 99 ? "99+" : i.badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-5 flex items-center justify-between gap-2 rounded-xl surface-2 px-3 py-2" data-testid="cms-sidebar-prefs">
          <button type="button" onClick={() => setLang(lang === "nl" ? "en" : "nl")} className="flex-1 text-xs font-semibold text-strong hover:text-pear-500 uppercase tracking-widest" data-testid="cms-sidebar-lang">
            🌐 {lang.toUpperCase()}
          </button>
          <button type="button" onClick={() => setMode(nextTheme)} title={`Thema: ${mode}`} className="flex-1 text-xs font-semibold text-strong hover:text-pear-500 uppercase tracking-widest" data-testid="cms-sidebar-theme">
            {themeIcon} {mode === "light" ? "Licht" : mode === "dark" ? "Donker" : "Auto"}
          </button>
        </div>

        <button onClick={logout} className="mt-4 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm text-red-500 border border-red-200 hover:bg-red-50 dark:hover:bg-red-500/10" data-testid="cms-logout">
          <LogOut className="h-4 w-4" /> {lang === "en" ? "Log out" : "Uitloggen"}
        </button>
        <div className="mt-4 pt-3 border-t border-app text-[10px] text-muted-fg text-center" data-testid="cms-sidebar-version">
          PearBlue CMS{version ? ` · v${version}` : ""} · 2026 · <Link to="/admin/changelog" className="hover:text-pear-500 underline" data-testid="cms-sidebar-changelog-link">Changelogs</Link>
        </div>
      </aside>
    </>
  );
};

import React, { useEffect, useState } from "react";
import axios from "axios";
import { NavLink, Link } from "react-router-dom";
import { Briefcase, Settings as SettingsIcon, Inbox, LogOut, BarChart3, UserPlus, Star, Users, Code, ShieldAlert, MessageSquare, Send, Menu, XCircle, Euro } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { useLang } from "../../i18n/LanguageContext";
import { useTheme } from "../../theme/ThemeContext";
import { Avatar } from "../Avatar";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import { API, PEARBLUE_LOGO, authHeaderFromStorage } from "./_shared";

export const AdminSidebar = () => {
  const { user, logout } = useAuth();
  const { lang, setLang } = useLang();
  const { mode, setMode } = useTheme();
  const [counters, setCounters] = useState({});
  const [profile, setProfile] = useState(null);
  const [version, setVersion] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  useBodyScrollLock(mobileOpen);
  useEffect(() => {
    const load = () => axios.get(`${API}/admin/counters`, { headers: authHeaderFromStorage() }).then((r) => setCounters(r.data || {})).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    axios.get(`${API}/site/version`).then((r) => setVersion(r.data?.version || "")).catch(() => {});
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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

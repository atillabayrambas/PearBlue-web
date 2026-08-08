import React, { useEffect, useRef, useState } from "react";
import { NavLink, useLocation, Link } from "react-router-dom";
import { Menu, X, Globe, Sun, Moon, Monitor, ChevronDown, User, LogIn } from "lucide-react";
import { useLang } from "../i18n/LanguageContext";
import { useTheme } from "../theme/ThemeContext";
import { useAuth } from "../auth/AuthContext";
import { usePortalAuth } from "../auth/PortalAuthContext";
import { Logo } from "./Logo";

const ThemeSwitcher = () => {
  const { mode, setMode } = useTheme();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const onClick = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const options = [
    { key: "light", label: "Licht", icon: Sun },
    { key: "dark", label: "Donker", icon: Moon },
    { key: "system", label: "Systeem", icon: Monitor },
  ];
  const CurrentIcon = options.find((o) => o.key === mode)?.icon || Sun;

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 justify-center w-9 h-9 rounded-full border border-app text-strong hover:text-pear-500 hover:border-pear-500 transition-colors"
        data-testid="theme-toggle"
        aria-label="Theme"
      >
        <CurrentIcon className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-44 surface border border-app rounded-2xl shadow-[0_20px_50px_rgba(10,25,47,0.12)] p-1.5 z-[60]" data-testid="theme-menu">
          {options.map((o) => (
            <button
              key={o.key}
              onClick={() => { setMode(o.key); setOpen(false); }}
              data-testid={`theme-option-${o.key}`}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors ${
                mode === o.key ? "bg-pear-100 text-pear-700" : "text-strong hover:bg-pear-100/50"
              }`}
            >
              <o.icon className="h-4 w-4" />
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const Navbar = () => {
  const { lang, setLang, t } = useLang();
  const { isAdmin } = useAuth();
  const { authenticated: portalAuth, user: portalUser } = usePortalAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);

  const firstName = portalUser?.display_name ? portalUser.display_name.split(" ")[0] : (portalUser?.email ? portalUser.email.split("@")[0] : "");

  const links = [
    { to: "/", label: t("nav.home"), testid: "nav-home" },
    { to: "/over-ons", label: t("nav.about"), testid: "nav-about" },
    { to: "/diensten", label: t("nav.services"), testid: "nav-services" },
    { to: "/portfolio", label: t("nav.portfolio"), testid: "nav-portfolio" },
    { to: "/contact", label: t("nav.contact"), testid: "nav-contact" },
  ];

  return (
    <header className="glass-nav sticky top-0 z-50" data-testid="site-navbar">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 h-20 flex items-center justify-between gap-3 sm:gap-6">
        <Logo size={44} className="shrink-0" />

        <nav className="hidden lg:flex items-center gap-8">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              data-testid={l.testid}
              end={l.to === "/"}
              className={({ isActive }) =>
                `text-sm font-medium tracking-wide transition-colors ${
                  isActive ? "text-pear-500" : "text-strong hover:text-pear-500"
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeSwitcher />
          <button
            onClick={() => setLang(lang === "nl" ? "en" : "nl")}
            className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-fg hover:text-pear-500 border border-app rounded-full px-3 py-1.5"
            data-testid="lang-toggle"
            aria-label="Toggle language"
          >
            <Globe className="h-3.5 w-3.5" />
            {lang.toUpperCase()}
          </button>
          <Link
            to="/portal"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-strong border border-app rounded-full px-3 py-1.5 hover:border-pear-500 hover:text-pear-500 max-w-[9rem]"
            data-testid="nav-portal"
            aria-label={portalAuth ? "Klantportaal" : "Login"}
          >
            {portalAuth ? (
              <>
                <User className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{firstName || "Portaal"}</span>
              </>
            ) : (
              <>
                <LogIn className="h-3.5 w-3.5 shrink-0" />
                <span>{lang === "nl" ? "Login" : "Login"}</span>
              </>
            )}
          </Link>
          {isAdmin && (
            <Link to="/admin" className="hidden md:inline-flex items-center gap-1 text-xs font-semibold text-pear-500 border border-pear-500/40 rounded-full px-3 py-1.5" data-testid="nav-cms">
              CMS
            </Link>
          )}
          <Link to="/contact" className="btn-primary ml-1 !hidden lg:!inline-flex" data-testid="nav-cta">
            {t("nav.cta")}
          </Link>
          <button
            className="lg:hidden p-2 rounded-full border border-app"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
            data-testid="nav-mobile-toggle"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="lg:hidden border-t border-app surface">
          <div className="px-6 py-5 flex flex-col gap-3">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === "/"}
                className={({ isActive }) => `py-2 text-base font-medium ${isActive ? "text-pear-500" : "text-strong"}`}
                data-testid={`mobile-${l.testid}`}
              >
                {l.label}
              </NavLink>
            ))}
            <Link to="/contact" className="btn-primary mt-2" data-testid="mobile-nav-cta">
              {t("nav.cta")}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};

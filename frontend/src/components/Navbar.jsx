import React, { useEffect, useState } from "react";
import { NavLink, useLocation, Link } from "react-router-dom";
import { Menu, X, Globe, Sun, Moon } from "lucide-react";
import { useLang } from "../i18n/LanguageContext";
import { useTheme } from "../theme/ThemeContext";
import { Logo } from "./Logo";

export const Navbar = () => {
  const { lang, setLang, t } = useLang();
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);

  const links = [
    { to: "/", label: t("nav.home"), testid: "nav-home" },
    { to: "/over-ons", label: t("nav.about"), testid: "nav-about" },
    { to: "/diensten", label: t("nav.services"), testid: "nav-services" },
    { to: "/contact", label: t("nav.contact"), testid: "nav-contact" },
  ];

  return (
    <header className="glass-nav sticky top-0 z-50" data-testid="site-navbar">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 h-20 flex items-center justify-between">
        <Logo size={36} />

        <nav className="hidden lg:flex items-center gap-9">
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
          <button
            onClick={toggle}
            className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-app text-strong hover:text-pear-500 hover:border-pear-500 transition-colors"
            data-testid="theme-toggle"
            aria-label="Toggle theme"
          >
            {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setLang(lang === "nl" ? "en" : "nl")}
            className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-fg hover:text-pear-500 border border-app rounded-full px-3 py-1.5"
            data-testid="lang-toggle"
            aria-label="Toggle language"
          >
            <Globe className="h-3.5 w-3.5" />
            {lang.toUpperCase()}
          </button>
          <Link to="/contact" className="btn-primary hidden md:inline-flex ml-1" data-testid="nav-cta">
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
                className={({ isActive }) =>
                  `py-2 text-base font-medium ${isActive ? "text-pear-500" : "text-strong"}`
                }
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

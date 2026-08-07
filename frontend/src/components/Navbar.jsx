import React, { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Menu, X, Globe } from "lucide-react";
import { useLang } from "../i18n/LanguageContext";

const LOGO_URL = "https://customer-assets-lxgj4vgw.emergentagent.net/job_3b5c4d50-dd30-4d09-93b8-e113754c7368/artifacts/bxpfaweb_PearBlue-logo-04-scaled.webp";

export const Navbar = () => {
  const { lang, setLang, t } = useLang();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);

  const links = [
    { to: "/", label: t("nav.home"), testid: "nav-home" },
    { to: "/over-ons", label: t("nav.about"), testid: "nav-about" },
    { to: "/diensten", label: t("nav.services"), testid: "nav-services" },
    { to: "/portfolio", label: t("nav.portfolio"), testid: "nav-portfolio" },
    { to: "/contact", label: t("nav.contact"), testid: "nav-contact" },
  ];

  return (
    <header className="glass-nav sticky top-0 z-50" data-testid="site-navbar">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 h-20 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3" data-testid="nav-logo-link">
          <img src={LOGO_URL} alt="PearBlue" className="h-9 w-auto" />
          <span className="sr-only">PearBlue</span>
        </Link>

        <nav className="hidden lg:flex items-center gap-9">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              data-testid={l.testid}
              end={l.to === "/"}
              className={({ isActive }) =>
                `text-sm font-medium tracking-wide transition-colors ${
                  isActive ? "text-pear-500" : "text-pear-900/80 hover:text-pear-500"
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setLang(lang === "nl" ? "en" : "nl")}
            className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-pear-900/70 hover:text-pear-500 border border-slate-200 rounded-full px-3 py-1.5"
            data-testid="lang-toggle"
            aria-label="Toggle language"
          >
            <Globe className="h-3.5 w-3.5" />
            {lang.toUpperCase()}
          </button>
          <Link to="/contact" className="btn-primary hidden md:inline-flex" data-testid="nav-cta">
            {t("nav.cta")}
          </Link>
          <button
            className="lg:hidden p-2 rounded-full border border-slate-200"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
            data-testid="nav-mobile-toggle"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="lg:hidden border-t border-slate-100 bg-white/90 backdrop-blur-md">
          <div className="px-6 py-5 flex flex-col gap-3">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === "/"}
                className={({ isActive }) =>
                  `py-2 text-base font-medium ${isActive ? "text-pear-500" : "text-pear-900"}`
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

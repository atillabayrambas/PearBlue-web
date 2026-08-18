import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ShieldAlert, LogOut, X } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useLang } from "../i18n/LanguageContext";

/**
 * StaffBanner — visible only when an admin is bypassing a non-live site
 * status (maintenance / coming_soon). Without this banner, admins were
 * silently viewing the live site while they tried to *test* their own
 * maintenance mode, thinking maintenance was broken. Now the bypass is
 * explicit and reversible with one click.
 *
 * Only rendered on public routes (App.js `Shell` handles that condition).
 */
export const StaffBanner = ({ siteStatus }) => {
  const { isAdmin, logout, user } = useAuth();
  const { lang } = useLang();
  const en = lang === "en";
  const [hidden, setHidden] = useState(false);

  if (!isAdmin || siteStatus === "live" || hidden) return null;

  const label =
    siteStatus === "maintenance"
      ? en ? "Site is in maintenance mode" : "Site staat in onderhoudsmodus"
      : siteStatus === "coming_soon"
        ? en ? "Site is set to Coming Soon" : "Site staat op Coming Soon"
        : en ? `Site status: ${siteStatus}` : `Sitestatus: ${siteStatus}`;

  return (
    <div
      className="w-full bg-amber-500 text-slate-900 text-sm font-medium shadow-md relative z-40"
      data-testid="staff-banner"
      role="status"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-2 flex flex-wrap items-center gap-3">
        <ShieldAlert className="h-4 w-4 shrink-0" />
        <span className="flex-1 min-w-[200px]" data-testid="staff-banner-message">
          <strong>{label}.</strong>{" "}
          {en
            ? "You are seeing the live site because you're signed in as staff. Regular visitors see the splash page."
            : "Je ziet de live site omdat je als staff ingelogd bent. Reguliere bezoekers zien de splash pagina."}
          {user?.email && (
            <span className="text-slate-800/80 ml-1">
              ({user.email}
              {user.role ? ` · ${user.role}` : ""})
            </span>
          )}
        </span>
        <Link
          to={`/?preview=${siteStatus === "coming_soon" ? "coming_soon" : "maintenance"}`}
          className="text-xs font-semibold rounded-full bg-slate-900/15 hover:bg-slate-900/25 px-3 py-1"
          data-testid="staff-banner-preview"
        >
          {en ? "Preview splash" : "Bekijk splash"}
        </Link>
        <button
          onClick={() => { logout(); }}
          className="inline-flex items-center gap-1 text-xs font-semibold rounded-full bg-slate-900 text-white hover:bg-slate-800 px-3 py-1"
          data-testid="staff-banner-logout"
        >
          <LogOut className="h-3 w-3" />
          {en ? "Sign out as staff" : "Uitloggen als staff"}
        </button>
        <button
          onClick={() => setHidden(true)}
          className="text-slate-900/60 hover:text-slate-900"
          aria-label={en ? "Dismiss" : "Verbergen"}
          data-testid="staff-banner-dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { ShieldAlert, XCircle, Sparkles } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { useSilentPolling } from "../../hooks/useSilentPolling";
import { API } from "./_shared";

// Priority alert balloons stack (above the version bar). Uses localStorage for dismiss + hourly-reappear for P1.
export const PriorityAlerts = () => {
  const { authHeader } = useAuth();
  const [alerts, setAlerts] = useState({ counts: { Major: 0, P1: 0, P2: 0 }, latest: {} });
  const [, setTick] = useState(0);
  useEffect(() => {
    axios.get(`${API}/admin/priority-alerts`, { headers: authHeader() }).then((r) => setAlerts(r.data || {})).catch(() => {});
    // Ticker keeps the hourly-reappear logic recalculating without hammering the API.
    const t = setInterval(() => setTick((x) => x + 1), 60000);
    return () => clearInterval(t);
  }, []);
  // Silent 60s refresh so open selects / typed text upstream never get reset.
  useSilentPolling(
    () => axios.get(`${API}/admin/priority-alerts`, { headers: authHeader() }).then((r) => r.data || null).catch(() => null),
    (data) => { if (data) setAlerts(data); },
    60000,
    [],
  );

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
    if (rule.hourly) return (Date.now() - dismissed) > 60 * 60 * 1000;
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
          <div key={r.key} className={`rounded-2xl px-4 py-2.5 text-sm font-medium flex items-center gap-3 shadow-lg ${r.color}`} data-testid={`cms-prio-bar-${r.key.toLowerCase()}`}>
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span className="flex-1">
              <strong>{r.label}</strong> · {alerts.counts[r.key]} open item{alerts.counts[r.key] > 1 ? "s" : ""}
              {alerts.latest?.[r.key]?.subject ? ` — ${alerts.latest[r.key].subject}` : ""}
            </span>
            <Link to="/admin/messages" className="bg-white/25 hover:bg-white/40 rounded-full px-3 py-1 text-xs" data-testid={`cms-prio-view-${r.key.toLowerCase()}`}>Bekijk</Link>
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

export const VersionAlertBar = ({ currentVersion }) => {
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
      <Link to="/admin/changelog" onClick={markSeen} className="bg-white/20 hover:bg-white/30 rounded-full px-3 py-1 text-xs" data-testid="cms-version-bar-view">Bekijk changelog</Link>
      <button onClick={dismiss} className="text-white/80 hover:text-white" aria-label="Sluiten" data-testid="cms-version-bar-close">
        <XCircle className="h-4 w-4" />
      </button>
    </div>
  );
};

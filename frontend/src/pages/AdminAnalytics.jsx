import React, { useEffect, useState } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import { MessageCircle, Users, Gauge, Sparkles } from "lucide-react";
import { useAuth } from "../auth/AuthContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Stat = ({ icon: Icon, label, value, sub }) => (
  <div className="surface border border-app rounded-2xl p-5">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-pear-100 text-pear-500 flex items-center justify-center"><Icon className="h-5 w-5" /></div>
      <div>
        <p className="text-xs text-muted-fg uppercase tracking-widest">{label}</p>
        <p className="font-heading text-2xl font-medium text-strong">{value}</p>
        {sub && <p className="text-xs text-muted-fg mt-1">{sub}</p>}
      </div>
    </div>
  </div>
);

export const AnalyticsAdmin = () => {
  const { authHeader } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    setLoading(true);
    axios.get(`${API}/chat/stats?days=${days}`, { headers: authHeader() })
      .then((r) => setStats(r.data))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  const max = Math.max(1, ...(stats?.per_day || []).map((d) => d.count));

  return (
    <div data-testid="cms-analytics">
      <header className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-medium text-strong">AI kosten dashboard</h1>
          <p className="text-sm text-muted-fg mt-1">Bekijk in één oogopslag hoeveel chat-berichten er via Claude Sonnet 4.6 worden verstuurd.</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-fg">Periode:</span>
          {[7, 30, 90].map((d) => (
            <button key={d} onClick={() => setDays(d)}
              data-testid={`analytics-range-${d}`}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors ${
                days === d ? "bg-pear-500 text-white border-pear-500" : "surface text-strong border-app hover:border-pear-500"
              }`}>{d}d</button>
          ))}
        </div>
      </header>

      {loading && <p className="text-muted-fg">Laden…</p>}

      {stats && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Stat icon={MessageCircle} label="In periode" value={stats.total_in_range} sub={`Laatste ${stats.days} dagen`} />
            <Stat icon={Users} label="Unieke sessies" value={stats.unique_sessions_in_range} sub="Aparte gesprekken" />
            <Stat icon={Sparkles} label="Totaal ooit" value={stats.total_messages_ever} sub="Sinds livegang" />
            <Stat icon={Gauge} label="Rate limit" value={`${stats.rate_limit_per_hour}/u`} sub="Per bezoeker (IP)" />
          </div>

          <div className="surface border border-app rounded-2xl p-6" data-testid="analytics-chart">
            <h3 className="font-heading font-semibold text-strong mb-4">Berichten per dag</h3>
            <div className="flex items-end gap-1 h-40">
              {stats.per_day.map((d, i) => {
                const pct = (d.count / max) * 100;
                return (
                  <motion.div key={d.date}
                    initial={{ height: 0 }}
                    animate={{ height: `${pct}%` }}
                    transition={{ duration: 0.5, delay: i * 0.01 }}
                    className="flex-1 min-w-[6px] bg-gradient-to-t from-pear-500 to-pear-300 rounded-t-md relative group"
                    style={{ minHeight: d.count > 0 ? "4px" : "0" }}
                    data-testid={`analytics-bar-${d.date}`}
                    title={`${d.date}: ${d.count} berichten`} />
                );
              })}
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-muted-fg font-mono">
              <span>{stats.per_day[0]?.date}</span>
              <span>{stats.per_day[stats.per_day.length - 1]?.date}</span>
            </div>
          </div>

          {stats.per_language && Object.keys(stats.per_language).length > 0 && (
            <div className="mt-6 surface border border-app rounded-2xl p-6">
              <h3 className="font-heading font-semibold text-strong mb-4">Per taal</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(stats.per_language).map(([k, v]) => (
                  <span key={k} className="inline-flex items-center gap-2 rounded-full bg-pear-100 text-pear-700 px-3 py-1.5 text-xs font-semibold">
                    {k.toUpperCase()} · {v}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

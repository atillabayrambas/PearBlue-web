import React, { useEffect, useState } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import { MessageCircle, Users, Gauge, Sparkles, Smile } from "lucide-react";
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
  const [ratings, setRatings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      axios.get(`${API}/chat/stats?days=${days}`, { headers: authHeader() }).then((r) => r.data).catch(() => null),
      axios.get(`${API}/admin/chat/ratings?days=${days}`, { headers: authHeader() }).then((r) => r.data).catch(() => null),
    ]).then(([s, r]) => { setStats(s); setRatings(r); }).finally(() => setLoading(false));
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

          {stats.cost && (
            <div className="mb-8 surface border border-app rounded-2xl p-6" data-testid="analytics-cost">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="h-4 w-4 text-pear-500" />
                <h3 className="font-heading font-semibold text-strong">Geschatte AI-kosten</h3>
                <span className="text-[10px] uppercase tracking-widest bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 font-bold">schatting</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="surface-2 rounded-xl p-4 text-center" data-testid="cost-credits">
                  <p className="text-[10px] uppercase tracking-widest text-muted-fg">Emergent credits</p>
                  <p className="mt-1 font-heading text-3xl font-medium text-strong tabular-nums">{stats.cost.estimated_credits}</p>
                  <p className="text-[11px] text-muted-fg mt-1">1 credit ≈ $0.01</p>
                </div>
                <div className="surface-2 rounded-xl p-4 text-center" data-testid="cost-eur">
                  <p className="text-[10px] uppercase tracking-widest text-muted-fg">In euro</p>
                  <p className="mt-1 font-heading text-3xl font-medium text-strong tabular-nums">€{stats.cost.estimated_eur}</p>
                  <p className="text-[11px] text-muted-fg mt-1">≈ ${stats.cost.estimated_usd} USD</p>
                </div>
                <div className="surface-2 rounded-xl p-4 text-center" data-testid="cost-per-msg">
                  <p className="text-[10px] uppercase tracking-widest text-muted-fg">Per bericht</p>
                  <p className="mt-1 font-heading text-3xl font-medium text-strong tabular-nums">
                    €{stats.total_in_range > 0 ? (stats.cost.estimated_eur / stats.total_in_range).toFixed(4) : "0.0000"}
                  </p>
                  <p className="text-[11px] text-muted-fg mt-1">gemiddeld</p>
                </div>
              </div>
              <p className="text-[11px] text-muted-fg mt-4">
                {stats.cost.note} Prijs op basis van Emergent LLM key ≈ $3/1M input + $15/1M output tokens (Claude Sonnet 4.6).
              </p>
            </div>
          )}

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

          {ratings && ratings.total > 0 && (
            <div className="mt-6 surface border border-app rounded-2xl p-6" data-testid="analytics-ratings">
              <div className="flex items-center gap-2 mb-4">
                <Smile className="h-4 w-4 text-pear-500" />
                <h3 className="font-heading font-semibold text-strong">Chat-tevredenheid (smileys)</h3>
                <span className="ml-auto text-xs text-muted-fg">Gemiddeld: <b className="text-strong">{ratings.avg ?? "—"} / 5</b> · {ratings.total} beoordelingen</span>
              </div>
              <div className="grid grid-cols-5 gap-2 mb-4">
                {[1, 2, 3, 4, 5].map((r) => {
                  const c = ratings.counts?.[r] || 0;
                  const maxCount = Math.max(1, ...Object.values(ratings.counts || {}));
                  const pct = (c / maxCount) * 100;
                  const emoji = ["😞", "🙁", "😐", "🙂", "😄"][r - 1];
                  return (
                    <div key={r} className="text-center" data-testid={`analytics-rating-bar-${r}`}>
                      <div className="h-24 flex items-end justify-center">
                        <div className="w-8 rounded-t-md bg-gradient-to-t from-pear-500 to-pear-300" style={{ height: `${pct}%`, minHeight: c > 0 ? "6px" : "0" }} />
                      </div>
                      <div className="text-xl mt-1">{emoji}</div>
                      <div className="text-[11px] text-muted-fg tabular-nums">{c}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

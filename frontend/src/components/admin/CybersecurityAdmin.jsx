import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ShieldAlert, ShieldX } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { useLang } from "../../i18n/LanguageContext";
import { API, REASON_LABEL } from "./_shared";

const REASON_LABEL_EN = {
  rate_limit: "Rate limit",
  spam: "Spam",
  honeypot: "Honeypot",
  captcha: "Captcha",
  manual_block: "Manually blocked",
  unknown: "Unknown",
};

export const CybersecurityAdmin = () => {
  const { authHeader } = useAuth();
  const { lang } = useLang();
  const en = lang === "en";
  const REASONS = en ? REASON_LABEL_EN : REASON_LABEL;
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
      toast.error(en ? "Failed to load cybersecurity data" : "Kon cybersecurity-data niet laden");
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const toggle = async (block, unblock) => {
    try {
      const path = unblock ? "unblock" : "reblock";
      await axios.post(`${API}/admin/cybersecurity/blocks/${block.id}/${path}`, {}, { headers: authHeader() });
      toast.success(unblock ? (en ? "Unblocked" : "Ontblokkeerd") : (en ? "Re-blocked" : "Opnieuw geblokkeerd"));
      load();
    } catch { toast.error(en ? "Action failed" : "Actie mislukt"); }
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
          <p className="text-sm text-muted-fg mt-1">{en ? "Requests blocked by rate-limiter, spam filter or honeypot. You can manually unblock or re-block." : "Verzoeken die door de rate-limiter, spam-filter of honeypot zijn geblokkeerd. Je kunt handmatig ont- of herblokkeren."}</p>
        </div>
        <Link
          to="/admin/virusscanner"
          onClick={async () => {
            try { await axios.post(`${API}/admin/virus-scanner/acknowledge-all`, {}, { headers: authHeader() }); setVirusUnread(0); } catch { /* ignore */ }
          }}
          className="btn-secondary relative"
          data-testid="cs-open-virus-scanner"
        >
          <ShieldX className="h-4 w-4" /> {en ? "Open virus scanner" : "Virusscanner openen"}
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
            <div className="text-xs uppercase tracking-widest text-muted-fg">{en ? "Blocks (30 days)" : "Blokkades (30 dagen)"}</div>
            <div className="font-heading text-3xl font-medium text-strong mt-1" data-testid="cs-total-30d">{stats.total_30d}</div>
          </div>
          <div className="rounded-2xl border border-app p-5 surface">
            <div className="text-xs uppercase tracking-widest text-muted-fg">{en ? "Unique IPs (30 days)" : "Unieke IPs (30 dagen)"}</div>
            <div className="font-heading text-3xl font-medium text-strong mt-1" data-testid="cs-unique-ips">{stats.unique_ips_30d}</div>
          </div>
          <div className="rounded-2xl border border-app p-5 surface">
            <div className="text-xs uppercase tracking-widest text-muted-fg mb-2">{en ? "Top reasons" : "Top-oorzaken"}</div>
            <ul className="space-y-1 text-sm">
              {(stats.reasons || []).slice(0, 4).map((r) => (
                <li key={r.reason} className="flex justify-between">
                  <span className="text-strong">{REASONS[r.reason] || r.reason}</span>
                  <span className="text-muted-fg font-mono">{r.count}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {stats?.daily?.length > 0 && (
        <div className="rounded-2xl border border-app p-5 surface" data-testid="cs-daily-chart">
          <div className="text-xs uppercase tracking-widest text-muted-fg mb-3">{en ? "Blocks per day" : "Blokkades per dag"}</div>
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
          <div className="text-xs uppercase tracking-widest text-muted-fg mb-1">{en ? "Verified captchas (30 days)" : "Geverifieerde captchas (30 dagen)"}</div>
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
          { key: "all", label: en ? "All" : "Alle" },
          { key: "active", label: en ? "Actively blocked" : "Actief geblokkeerd" },
          { key: "unblocked", label: en ? "Unblocked" : "Gedeblokkeerd" },
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
        <button onClick={load} className="ml-auto text-xs text-muted-fg hover:text-pear-500" data-testid="cs-refresh">↻ {en ? "Refresh" : "Vernieuwen"}</button>
      </div>

      {/* Blocks table */}
      <div className="rounded-2xl border border-app overflow-hidden surface" data-testid="cs-blocks-table">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-pear-50/50 dark:bg-pear-500/5 text-left">
              <tr>
                <th className="px-3 py-2 font-semibold text-xs uppercase tracking-widest text-muted-fg">{en ? "Who (IP · Country)" : "Wie (IP · Land)"}</th>
                <th className="px-3 py-2 font-semibold text-xs uppercase tracking-widest text-muted-fg">{en ? "What" : "Wat"}</th>
                <th className="px-3 py-2 font-semibold text-xs uppercase tracking-widest text-muted-fg">{en ? "Where" : "Waar"}</th>
                <th className="px-3 py-2 font-semibold text-xs uppercase tracking-widest text-muted-fg">{en ? "How (OS · Browser · Device)" : "Hoe (OS · Browser · Device)"}</th>
                <th className="px-3 py-2 font-semibold text-xs uppercase tracking-widest text-muted-fg">{en ? "When" : "Wanneer"}</th>
                <th className="px-3 py-2 font-semibold text-xs uppercase tracking-widest text-muted-fg">Status</th>
                <th className="px-3 py-2 sticky right-0 bg-pear-50/50 dark:bg-pear-500/5" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-fg">{en ? "Loading…" : "Laden…"}</td></tr>
              ) : shown.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-fg">{en ? "No blocked requests." : "Geen geblokkeerde verzoeken."}</td></tr>
              ) : shown.map((b) => (
                <tr key={b.id} className="border-t border-app/50" data-testid={`cs-row-${b.id}`}>
                  <td className="px-3 py-2 text-xs">
                    <div className="font-mono">{b.ip}</div>
                    <div className="text-[10px] text-muted-fg">{b.country || (en ? "Unknown" : "Onbekend")}</div>
                    {b.ip_manually_blocked && <span className="inline-block mt-1 px-1 py-0.5 text-[9px] rounded bg-red-100 text-red-600">manual</span>}
                  </td>
                  <td className="px-3 py-2 text-strong">{REASONS[b.reason] || b.reason}</td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-fg">{b.endpoint}</td>
                  <td className="px-3 py-2 text-xs">
                    <div className="text-strong">{b.os || "?"} · {b.browser || "?"}</div>
                    <div className="text-[10px] text-muted-fg">{b.device || "?"}</div>
                    <div className="text-[10px] text-muted-fg truncate max-w-[220px]" title={b.user_agent}>{b.user_agent}</div>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-fg whitespace-nowrap">{new Date(b.created_at).toLocaleString(en ? "en-US" : "nl-NL")}</td>
                  <td className="px-3 py-2 min-w-[130px]">
                    {b.unblocked ? (
                      <span className="text-xs text-emerald-600 font-semibold">{en ? "Unblocked" : "Gedeblokkeerd"}</span>
                    ) : (
                      <span className="text-xs text-red-500 font-semibold">{en ? "Blocked" : "Geblokkeerd"}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap sticky right-0 lg:static surface lg:bg-transparent border-l-2 lg:border-l-0 border-app shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.15)] lg:shadow-none">
                    {b.unblocked ? (
                      <button
                        onClick={() => toggle(b, false)}
                        data-testid={`cs-reblock-${b.id}`}
                        className="text-xs px-2.5 py-1 rounded-full border border-red-200 text-red-500 hover:bg-red-50"
                      >{en ? "Re-block" : "Opnieuw blokkeren"}</button>
                    ) : (
                      <button
                        onClick={() => toggle(b, true)}
                        data-testid={`cs-unblock-${b.id}`}
                        className="text-xs px-2.5 py-1 rounded-full border border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                      >{en ? "Unblock" : "Deblokkeren"}</button>
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

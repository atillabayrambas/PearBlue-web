import React, { useEffect, useState } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import { Euro, TrendingUp, TrendingDown, Sparkles, Info } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PERIODS = [
  { key: "7d", label: "7 dagen" },
  { key: "30d", label: "30 dagen" },
  { key: "90d", label: "90 dagen" },
  { key: "6m", label: "6 maanden" },
  { key: "1y", label: "1 jaar" },
  { key: "2y", label: "2 jaar" },
  { key: "3y", label: "3 jaar" },
  { key: "5y", label: "5 jaar" },
  { key: "custom", label: "Aangepast" },
];

const money = (n) => `€${(Number(n) || 0).toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const Card = ({ icon: Icon, label, value, sub, testid, tone = "neutral" }) => {
  const tint = tone === "pos"
    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
    : tone === "neg"
    ? "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300"
    : "bg-pear-100 text-pear-700 dark:bg-pear-500/15 dark:text-pear-300";
  return (
    <div className="surface border border-app rounded-2xl p-5" data-testid={testid}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tint}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] text-muted-fg uppercase tracking-widest">{label}</p>
          <p className="font-heading text-2xl font-medium text-strong tabular-nums truncate">{value}</p>
          {sub && <p className="text-[11px] text-muted-fg mt-0.5">{sub}</p>}
        </div>
      </div>
    </div>
  );
};

export const FinancialsAdmin = () => {
  const { authHeader } = useAuth();
  const [period, setPeriod] = useState("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const params = { period };
      if (period === "custom") {
        if (!customFrom || !customTo) { setLoading(false); return; }
        params.date_from = customFrom;
        params.date_to = customTo;
      }
      const r = await axios.get(`${API}/admin/financials`, { headers: authHeader(), params });
      setData(r.data);
    } catch (e) {
      toast.error("Kon financiën niet laden");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (period !== "custom") load(); /* eslint-disable-next-line */ }, [period]);

  const emergent = data?.emergent_ai;
  const zoho = data?.zoho_books;
  const totals = data?.totals;

  return (
    <div data-testid="cms-financials">
      <header className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-medium text-strong">Financiën dashboard</h1>
          <p className="text-sm text-muted-fg mt-1">
            Emergent AI-kosten en Zoho Books-omzet in één beeld. Alleen zichtbaar voor super_admin, beheerder en financiën.
          </p>
        </div>
      </header>

      {/* Period filter */}
      <div className="flex flex-wrap items-center gap-2 mb-6" data-testid="financials-period-tabs">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            data-testid={`financials-period-${p.key}`}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors ${
              period === p.key ? "bg-pear-500 text-white border-pear-500" : "surface text-strong border-app hover:border-pear-500"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {period === "custom" && (
        <div className="mb-6 flex flex-wrap items-end gap-3 surface border border-app rounded-2xl p-4" data-testid="financials-custom-range">
          <label className="text-xs">
            <span className="block text-muted-fg uppercase tracking-widest mb-1">Van</span>
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="rounded-lg border border-app px-3 py-2 text-sm bg-white dark:bg-slate-800 text-strong" data-testid="financials-date-from" />
          </label>
          <label className="text-xs">
            <span className="block text-muted-fg uppercase tracking-widest mb-1">Tot</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="rounded-lg border border-app px-3 py-2 text-sm bg-white dark:bg-slate-800 text-strong" data-testid="financials-date-to" />
          </label>
          <button onClick={load} disabled={!customFrom || !customTo} className="btn-primary" data-testid="financials-apply-range">Toepassen</button>
        </div>
      )}

      {data?.zoho_books?.mocked && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/40 dark:bg-amber-500/10 p-3 flex gap-2 text-xs" data-testid="financials-mocked-banner">
          <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-strong/90">
            <strong>Zoho Books-cijfers zijn MOCKED</strong> — deze module wordt geactiveerd zodra de Zoho Books API-key en organisatie-ID
            in de site-instellingen zijn ingevuld. De AI-kosten zijn gebaseerd op werkelijk verzonden chatberichten.
          </div>
        </div>
      )}

      {data?.zoho_books && data.zoho_books.mocked === false && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-500/10 p-3 flex gap-2 text-xs" data-testid="financials-live-banner">
          <span className="text-emerald-600 shrink-0 mt-0.5">✓</span>
          <div className="text-strong/90">
            <strong>Zoho Books LIVE</strong> — factuur-cijfers komen rechtstreeks uit je Zoho Books organisatie. AI-kosten zijn gebaseerd op werkelijk verzonden chatberichten.
          </div>
        </div>
      )}

      {loading && <p className="text-muted-fg">Laden…</p>}

      {!loading && data && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          {/* Combined totals */}
          <section className="mb-8">
            <h2 className="text-xs uppercase tracking-widest text-muted-fg mb-3">Totalen ({data.range.days} dagen)</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card icon={TrendingUp} label="Inkomsten (Zoho, betaald)" value={money(totals?.combined_income_eur)} tone="pos" testid="financials-total-income" />
              <Card icon={TrendingDown} label="AI-kosten (Emergent)" value={money(totals?.combined_costs_eur)} tone="neg" testid="financials-total-costs" />
              <Card
                icon={Euro}
                label="Geschatte marge"
                value={money(totals?.estimated_margin_eur)}
                tone={Number(totals?.estimated_margin_eur) >= 0 ? "pos" : "neg"}
                testid="financials-total-margin"
              />
            </div>
          </section>

          {/* Emergent AI details */}
          <section className="mb-8 surface border border-app rounded-2xl p-6" data-testid="financials-emergent-block">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-4 w-4 text-pear-500" />
              <h3 className="font-heading font-semibold text-strong">Emergent AI (Claude Sonnet 4.6)</h3>
              <span className="text-[10px] uppercase tracking-widest bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 font-bold">schatting</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div className="surface-2 rounded-xl p-3">
                <p className="text-[10px] uppercase tracking-widest text-muted-fg">Berichten</p>
                <p className="font-heading text-2xl font-medium text-strong tabular-nums">{emergent?.messages || 0}</p>
              </div>
              <div className="surface-2 rounded-xl p-3">
                <p className="text-[10px] uppercase tracking-widest text-muted-fg">Credits</p>
                <p className="font-heading text-2xl font-medium text-strong tabular-nums">{emergent?.estimated_credits || 0}</p>
              </div>
              <div className="surface-2 rounded-xl p-3">
                <p className="text-[10px] uppercase tracking-widest text-muted-fg">USD</p>
                <p className="font-heading text-2xl font-medium text-strong tabular-nums">${(emergent?.estimated_usd || 0).toFixed(2)}</p>
              </div>
              <div className="surface-2 rounded-xl p-3">
                <p className="text-[10px] uppercase tracking-widest text-muted-fg">EUR</p>
                <p className="font-heading text-2xl font-medium text-strong tabular-nums">{money(emergent?.estimated_eur)}</p>
              </div>
            </div>
            <p className="text-[11px] text-muted-fg mt-3">{emergent?.note}</p>
          </section>

          {/* Zoho Books */}
          <section className="mb-8 surface border border-app rounded-2xl p-6" data-testid="financials-zoho-block">
            <div className="flex items-center gap-2 mb-4">
              <Euro className="h-4 w-4 text-pear-500" />
              <h3 className="font-heading font-semibold text-strong">Zoho Books</h3>
              {zoho?.mocked ? (
                <span className="text-[10px] uppercase tracking-widest bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 font-bold" data-testid="financials-zoho-badge-mocked">mocked</span>
              ) : (
                <span className="text-[10px] uppercase tracking-widest bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5 font-bold" data-testid="financials-zoho-badge-live">live</span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="surface-2 rounded-xl p-3">
                <p className="text-[10px] uppercase tracking-widest text-muted-fg">Gefactureerd</p>
                <p className="font-heading text-xl font-medium text-strong tabular-nums">{money(zoho?.invoiced_total_eur)}</p>
              </div>
              <div className="surface-2 rounded-xl p-3">
                <p className="text-[10px] uppercase tracking-widest text-muted-fg">Betaald</p>
                <p className="font-heading text-xl font-medium text-emerald-600 tabular-nums">{money(zoho?.paid_total_eur)}</p>
              </div>
              <div className="surface-2 rounded-xl p-3">
                <p className="text-[10px] uppercase tracking-widest text-muted-fg">Openstaand</p>
                <p className="font-heading text-xl font-medium text-strong tabular-nums">{money(zoho?.outstanding_eur)}</p>
              </div>
              <div className="surface-2 rounded-xl p-3">
                <p className="text-[10px] uppercase tracking-widest text-muted-fg">Achterstallig</p>
                <p className="font-heading text-xl font-medium text-red-600 tabular-nums">{money(zoho?.overdue_eur)}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-muted-fg">
              <span>Verzonden: <b className="text-strong tabular-nums">{zoho?.invoices_sent || 0}</b></span>
              <span>Betaald: <b className="text-strong tabular-nums">{zoho?.invoices_paid || 0}</b></span>
            </div>
            {zoho?.top_clients?.length > 0 && (
              <div className="mt-6">
                <h4 className="text-xs uppercase tracking-widest text-muted-fg mb-2">Top klanten</h4>
                <ul className="divide-y divide-app/40 text-sm">
                  {zoho.top_clients.map((c) => (
                    <li key={c.name} className="flex justify-between py-2">
                      <span className="text-strong">{c.name}</span>
                      <span className="font-mono text-pear-600">{money(c.total_eur)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </motion.div>
      )}
    </div>
  );
};

export default FinancialsAdmin;

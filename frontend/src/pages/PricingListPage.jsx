import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Calculator, Globe, Server, ShieldCheck, ArrowRight, Info, Save, Share2, X, Check } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "../i18n/LanguageContext";
import { usePageSeo } from "../hooks/usePageSeo";
import { CATEGORIES, PRICING, itemsByCat, priceLabel, smartAverage, SERVICES, SERVICE_OF_CAT } from "../data/pricing";
import { FeedbackWidget } from "../components/FeedbackWidget";

const SERVICE_ICON = { web: Globe, ict: Server, cyber: ShieldCheck };

const H1 = ({ children }) => <h1 className="font-heading text-4xl sm:text-5xl font-medium text-strong mb-4">{children}</h1>;
const H2 = ({ children }) => <h2 className="font-heading text-2xl sm:text-3xl font-semibold text-strong mt-12 mb-4">{children}</h2>;

const PriceRow = ({ item, lang }) => (
  <tr className="border-b border-app/40 last:border-0" data-testid={`price-row-${item.id}`}>
    <td className="py-3 px-5 align-top text-strong">
      <div className="font-medium">{lang === "en" ? item.en : item.nl}</div>
      {(item.note_nl || item.note_en) && (
        <div className="text-xs text-muted-fg mt-1">{lang === "en" ? item.note_en : item.note_nl}</div>
      )}
    </td>
    <td className="py-3 px-5 text-right whitespace-nowrap text-pear-600 dark:text-pear-400 font-heading font-medium">
      {priceLabel(item, lang)}
    </td>
  </tr>
);

export default function PricingListPage() {
  const { lang } = useLang();
  const initialTab = (() => {
    if (typeof window === "undefined") return "web";
    const q = new URLSearchParams(window.location.search).get("tab");
    return ["web", "ict", "cyber"].includes(q) ? q : "web";
  })();
  const [activeService, setActiveService] = useState(initialTab);
  const [openCalc, setOpenCalc] = useState(false);
  usePageSeo({
    title: lang === "en" ? "Full pricelist — PearBlue" : "Volledige prijslijst — PearBlue",
    description: lang === "en"
      ? "Full pricelist for websites, ICT services and cybersecurity."
      : "Volledige prijslijst voor websites, ICT-diensten en cybersecurity.",
    path: "/prijslijst",
  });

  const categoriesForActive = CATEGORIES.filter((c) => SERVICE_OF_CAT[c.key] === activeService);

  return (
    <div className="max-w-5xl mx-auto px-6 lg:px-10 py-16" data-testid="page-pricing-list">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
        <p className="overline mb-3">{lang === "en" ? "Transparent pricing" : "Transparante prijzen"}</p>
        <H1>{lang === "en" ? "Full pricelist" : "Volledige prijslijst"}</H1>
        <p className="text-muted-fg text-lg max-w-2xl leading-relaxed">
          {lang === "en"
            ? "Every module is priced independently. Combine what you need — starting from as low as €200 for a fresh 5-page site."
            : "Elke module heeft een eigen prijs. Combineer wat je nodig hebt — vanaf €200 voor een frisse site van 5 pagina's."}
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button onClick={() => setOpenCalc(true)} className="btn-primary" data-testid="pricing-open-calculator">
            <Calculator className="h-4 w-4" />
            {lang === "en" ? "Calculate your cost" : "Bereken jouw kosten"}
          </button>
          <Link to="/contact" className="btn-secondary" data-testid="pricing-cta-contact">
            {lang === "en" ? "Request a quote" : "Vraag een offerte"} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* 3 service tabs — Website / ICT / Cybersecurity */}
        <div className="mt-10 border-b border-app flex flex-wrap gap-1" data-testid="pricing-service-tabs">
          {SERVICES.map((s) => {
            const Icon = SERVICE_ICON[s.key];
            const active = activeService === s.key;
            return (
              <button
                key={s.key}
                onClick={() => setActiveService(s.key)}
                data-testid={`pricing-tab-${s.key}`}
                className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  active ? "border-pear-500 text-pear-600" : "border-transparent text-muted-fg hover:text-strong"
                }`}
              >
                <Icon className="h-4 w-4" /> {lang === "en" ? s.en : s.nl}
              </button>
            );
          })}
        </div>

        {activeService === "web" && (
          <div className="mt-6 rounded-2xl border border-pear-200 bg-pear-50/40 dark:bg-pear-500/5 p-4 flex gap-3 items-start" data-testid="pricing-revisies-callout">
            <Info className="h-5 w-5 text-pear-500 shrink-0 mt-0.5" />
            <div className="text-sm text-strong/90">
              <strong>{lang === "en" ? "5 revisions included" : "5 revisies inbegrepen"}</strong> — {lang === "en"
                ? "the first 2 during test/design phase, the last 3 for refinements and final tweaks."
                : "de eerste 2 tijdens de test-/ontwerpfase, de laatste 3 voor verbeteringen en laatste aanpassingen."}
            </div>
          </div>
        )}

        {/* Category tables for the active service */}
        {categoriesForActive.map((c) => {
          const items = itemsByCat(c.key);
          if (!items.length) return null;
          return (
            <section key={c.key} id={`cat-${c.key}`} className="scroll-mt-24" data-testid={`pricing-cat-${c.key}`}>
              <H2>{lang === "en" ? c.en : c.nl}</H2>
              <div className="rounded-2xl border border-app overflow-hidden surface">
                <table className="w-full text-sm">
                  <tbody>
                    {items.map((it) => <PriceRow key={it.id} item={it} lang={lang} />)}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}

        {activeService === "ict" && (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/40 dark:bg-amber-500/5 p-4 text-sm text-strong/90">
            {lang === "en"
              ? "ICT service prices are being finalized and will be published shortly. Contact us for a custom quote."
              : "De ICT-prijzen worden binnenkort gepubliceerd. Neem contact op voor een offerte op maat."}
          </div>
        )}

        <div className="mt-14 text-xs text-muted-fg">
          {lang === "en"
            ? "Prices are in EUR, excl. VAT (21%). Prices may be adapted per project after intake — see the calculator disclaimer."
            : "Prijzen zijn in EUR, excl. btw (21%). Prijzen kunnen na intake per project worden bijgesteld — zie de calculator-disclaimer."}
        </div>
      </motion.div>

      <FeedbackWidget page="prijslijst" />

      {openCalc && <CalculatorModal onClose={() => setOpenCalc(false)} />}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Calculator — service-scoped tallies + combined total incl. BTW + Wishlist
// -----------------------------------------------------------------------------

const isRecurring = (u) => u === "per_maand" || u === "per_machine_maand";
const isHourly = (u) => u === "per_uur";
const VAT_RATE = 0.21;
const CALC_STORAGE = "pb_calc_wishlist";

const money = (n) => `€${(Math.round(n * 100) / 100).toLocaleString("nl-NL", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

function CalculatorModal({ onClose }) {
  const { lang } = useLang();
  const [tab, setTab] = useState("web");
  const [qty, setQty] = useState(() => {
    try { return JSON.parse(localStorage.getItem(CALC_STORAGE) || "{}"); } catch { return {}; }
  });
  const setQ = (id, v) => setQty((p) => ({ ...p, [id]: v }));

  const totals = useMemo(() => {
    const buckets = { web: { oneOff: 0, monthly: 0, hourly: 0 }, ict: { oneOff: 0, monthly: 0, hourly: 0 }, cyber: { oneOff: 0, monthly: 0, hourly: 0 } };
    for (const item of PRICING) {
      if (item.tbd) continue;
      const q = qty[item.id] || 0;
      if (!q) continue;
      const base = item.included ? 0 : smartAverage(item.min, item.max);
      const line = base * q;
      const svc = SERVICE_OF_CAT[item.cat] || "web";
      if (isRecurring(item.unit)) buckets[svc].monthly += line;
      else if (isHourly(item.unit)) buckets[svc].hourly += line;
      else buckets[svc].oneOff += line;
    }
    const activeSvcs = Object.entries(buckets).filter(([, b]) => b.oneOff || b.monthly || b.hourly);
    const combined = {
      oneOff: activeSvcs.reduce((s, [, b]) => s + b.oneOff, 0),
      monthly: activeSvcs.reduce((s, [, b]) => s + b.monthly, 0),
      hourly: activeSvcs.reduce((s, [, b]) => s + b.hourly, 0),
    };
    combined.subtotal = combined.oneOff;
    combined.btw = combined.oneOff * VAT_RATE;
    combined.grandTotal = combined.oneOff + combined.btw;
    combined.monthlyBtw = combined.monthly * VAT_RATE;
    combined.monthlyTotal = combined.monthly + combined.monthlyBtw;
    return { buckets, activeSvcs: activeSvcs.map(([k]) => k), combined };
  }, [qty]);

  const saveWishlist = () => {
    localStorage.setItem(CALC_STORAGE, JSON.stringify(qty));
    toast.success(lang === "en" ? "Saved to your device (wishlist)" : "Opgeslagen op je apparaat (wishlist)");
  };
  const clearWishlist = () => {
    setQty({});
    localStorage.removeItem(CALC_STORAGE);
    toast.info(lang === "en" ? "Wishlist cleared" : "Wishlist geleegd");
  };
  const shareLink = () => {
    const lines = [
      lang === "en" ? "My PearBlue estimate:" : "Mijn PearBlue schatting:",
      `- ${lang === "en" ? "One-off" : "Eenmalig"}: ${money(totals.combined.oneOff)}`,
      `- ${lang === "en" ? "VAT 21%" : "BTW 21%"}: ${money(totals.combined.btw)}`,
      `- ${lang === "en" ? "Total incl. VAT" : "Totaal incl. btw"}: ${money(totals.combined.grandTotal)}`,
      totals.combined.monthly ? `- ${lang === "en" ? "Monthly" : "Per maand"}: ${money(totals.combined.monthly)} (${money(totals.combined.monthlyTotal)} incl. btw)` : "",
      totals.combined.hourly ? `- ${lang === "en" ? "Hourly" : "Uurlijks"}: ${money(totals.combined.hourly)}` : "",
      "",
      `${lang === "en" ? "Estimate URL: " : "Schatting URL: "}${window.location.origin}/prijslijst`,
    ].filter(Boolean).join("\n");
    if (navigator.share) {
      navigator.share({ title: "PearBlue prijs-schatting", text: lines }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(lines);
      toast.success(lang === "en" ? "Copied to clipboard" : "Gekopieerd naar klembord");
    }
  };

  const tabCategories = CATEGORIES.filter((c) => SERVICE_OF_CAT[c.key] === tab);
  const b = totals.buckets[tab];

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
      data-testid="pricing-calc-modal"
    >
      <div
        className="w-full max-w-3xl rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-hidden flex flex-col border border-app bg-white dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
        style={{ backgroundColor: "var(--pb-bg-solid, white)" }}
      >
        <header className="px-6 py-4 border-b border-app flex items-center justify-between bg-white dark:bg-slate-900">
          <div>
            <div className="font-heading text-xl font-semibold text-strong flex items-center gap-2">
              <Calculator className="h-5 w-5 text-pear-500" />
              {lang === "en" ? "Cost calculator" : "Kostencalculator"}
            </div>
            <p className="text-xs text-muted-fg mt-0.5">
              {lang === "en"
                ? "Estimate only — final quote may differ based on scope and requirements."
                : "Slechts een schatting — de definitieve offerte kan afwijken op basis van scope en wensen."}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-fg hover:text-strong text-2xl leading-none" data-testid="pricing-calc-close">
            <X className="h-6 w-6" />
          </button>
        </header>

        {/* Service tabs */}
        <div className="border-b border-app flex bg-white dark:bg-slate-900" data-testid="pricing-calc-service-tabs">
          {SERVICES.map((s) => {
            const Icon = SERVICE_ICON[s.key];
            return (
              <button
                key={s.key}
                onClick={() => setTab(s.key)}
                data-testid={`pricing-calc-tab-${s.key}`}
                className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 -mb-px inline-flex items-center justify-center gap-2 ${
                  tab === s.key ? "border-pear-500 text-pear-600" : "border-transparent text-muted-fg hover:text-strong"
                }`}
              >
                <Icon className="h-4 w-4" /> {lang === "en" ? s.en : s.nl}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6 bg-white dark:bg-slate-900">
          {tabCategories.length === 0 || tabCategories.every((c) => itemsByCat(c.key).every((i) => i.tbd)) ? (
            <div className="text-sm text-muted-fg text-center py-8">
              {lang === "en" ? "Prices for this service will be published soon. Contact us for a custom quote." : "Prijzen voor deze dienst worden binnenkort gepubliceerd. Neem contact op voor maatwerk."}
            </div>
          ) : tabCategories.map((c) => {
            const items = itemsByCat(c.key).filter((i) => !i.tbd && !i.included);
            if (!items.length) return null;
            return (
              <div key={c.key}>
                <h4 className="text-xs uppercase tracking-widest text-muted-fg mb-2">{lang === "en" ? c.en : c.nl}</h4>
                <ul className="space-y-2">
                  {items.map((it) => {
                    const supportsCount = ["per_stuk", "per_maand", "per_uur", "per_taal", "per_module", "per_20_items", "per_machine_maand"].includes(it.unit);
                    const cur = qty[it.id] || 0;
                    return (
                      <li key={it.id} className="flex items-center justify-between gap-3 py-1.5">
                        <div className="min-w-0">
                          <div className="text-sm text-strong">{lang === "en" ? it.en : it.nl}</div>
                          <div className="text-[11px] text-muted-fg">{priceLabel(it, lang)}</div>
                        </div>
                        {supportsCount ? (
                          <input
                            type="number"
                            min={0}
                            max={999}
                            value={cur}
                            onChange={(e) => setQ(it.id, Math.max(0, parseInt(e.target.value || "0", 10)))}
                            className="w-20 rounded-lg border border-app bg-white dark:bg-slate-800 text-strong px-3 py-1.5 text-sm text-right"
                            data-testid={`pricing-calc-qty-${it.id}`}
                          />
                        ) : (
                          <label className="inline-flex items-center gap-2 cursor-pointer" data-testid={`pricing-calc-toggle-${it.id}`}>
                            <input
                              type="checkbox"
                              checked={cur > 0}
                              onChange={(e) => setQ(it.id, e.target.checked ? 1 : 0)}
                              className="accent-pear-500 h-4 w-4"
                            />
                            <span className="text-xs text-muted-fg">{lang === "en" ? "Include" : "Meenemen"}</span>
                          </label>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}

          {/* Per-service subtotal */}
          <div className="rounded-xl border border-pear-200 bg-pear-50/40 dark:bg-pear-500/10 p-4 grid grid-cols-3 gap-3 text-sm" data-testid={`pricing-calc-service-total-${tab}`}>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-fg">{lang === "en" ? "Setup" : "Setup"}</div>
              <div className="font-heading font-medium text-strong">{money(b.oneOff)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-fg">{lang === "en" ? "Monthly" : "Per maand"}</div>
              <div className="font-heading font-medium text-strong">{money(b.monthly)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-fg">{lang === "en" ? "Hourly" : "Uurlijks"}</div>
              <div className="font-heading font-medium text-strong">{money(b.hourly)}</div>
            </div>
          </div>
        </div>

        {/* Combined totals footer — 3 stacked blocks: One-off / Monthly / Hourly with BTW */}
        <footer className="border-t border-app px-4 py-3 bg-pear-50/50 dark:bg-slate-800">
          <div className="text-[10px] uppercase tracking-widest text-muted-fg mb-2">
            {lang === "en" ? `Combined (${totals.activeSvcs.length || 0}/3 services)` : `Gecombineerd (${totals.activeSvcs.length || 0}/3 diensten)`}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <div className="rounded-lg border border-app bg-white/50 dark:bg-slate-900/50 p-2.5" data-testid="pricing-calc-col-oneoff">
              <div className="text-[10px] uppercase tracking-widest text-muted-fg mb-1">{lang === "en" ? "One-off" : "Eenmalig"}</div>
              <div className="flex justify-between"><span className="text-muted-fg">{lang === "en" ? "Subtotal" : "Subtotaal"}</span><span className="font-mono text-strong" data-testid="pricing-calc-subtotal">{money(totals.combined.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-fg">{lang === "en" ? "VAT 21%" : "BTW 21%"}</span><span className="font-mono text-strong" data-testid="pricing-calc-vat">{money(totals.combined.btw)}</span></div>
              <div className="flex justify-between border-t border-app/50 mt-1 pt-1 font-semibold"><span className="text-strong">{lang === "en" ? "Total" : "Totaal"}</span><span className="font-mono text-pear-600" data-testid="pricing-calc-total-inclvat">{money(totals.combined.grandTotal)}</span></div>
            </div>
            <div className="rounded-lg border border-app bg-white/50 dark:bg-slate-900/50 p-2.5" data-testid="pricing-calc-col-monthly">
              <div className="text-[10px] uppercase tracking-widest text-muted-fg mb-1">{lang === "en" ? "Monthly (recurring)" : "Maandelijks (vast)"}</div>
              <div className="flex justify-between"><span className="text-muted-fg">{lang === "en" ? "Subtotal" : "Subtotaal"}</span><span className="font-mono text-strong">{money(totals.combined.monthly)}</span></div>
              <div className="flex justify-between"><span className="text-muted-fg">{lang === "en" ? "VAT 21%" : "BTW 21%"}</span><span className="font-mono text-strong">{money(totals.combined.monthlyBtw)}</span></div>
              <div className="flex justify-between border-t border-app/50 mt-1 pt-1 font-semibold"><span className="text-strong">{lang === "en" ? "Total /mo" : "Totaal /m"}</span><span className="font-mono text-pear-600" data-testid="pricing-calc-monthly-total">{money(totals.combined.monthlyTotal)}</span></div>
            </div>
            <div className="rounded-lg border border-app bg-white/50 dark:bg-slate-900/50 p-2.5" data-testid="pricing-calc-col-hourly">
              <div className="text-[10px] uppercase tracking-widest text-muted-fg mb-1">{lang === "en" ? "Hourly (ad-hoc)" : "Uurlijks (los)"}</div>
              <div className="flex justify-between"><span className="text-muted-fg">{lang === "en" ? "Subtotal" : "Subtotaal"}</span><span className="font-mono text-strong">{money(totals.combined.hourly)}</span></div>
              <div className="flex justify-between"><span className="text-muted-fg">{lang === "en" ? "VAT 21%" : "BTW 21%"}</span><span className="font-mono text-strong">{money(totals.combined.hourly * VAT_RATE)}</span></div>
              <div className="flex justify-between border-t border-app/50 mt-1 pt-1 font-semibold"><span className="text-strong">{lang === "en" ? "Total /hr" : "Totaal /uur"}</span><span className="font-mono text-pear-600" data-testid="pricing-calc-hourly-total">{money(totals.combined.hourly * (1 + VAT_RATE))}</span></div>
            </div>
          </div>
          <p className="mt-2 text-[10px] text-muted-fg leading-relaxed">
            {lang === "en"
              ? "Estimate only — final quote may differ. Setup is one-off, monthly costs recur, hourly rates are billed ad-hoc."
              : "Slechts een schatting — offerte kan afwijken. Setup is eenmalig, maandelijkse kosten zijn doorlopend, uurtarieven worden los gefactureerd."}
          </p>
          <div className="mt-2 flex flex-wrap gap-2 justify-end">
            <button type="button" onClick={clearWishlist} className="text-xs px-3 py-1.5 rounded-full border border-app hover:border-red-400 hover:text-red-500" data-testid="pricing-calc-clear">
              {lang === "en" ? "Clear" : "Leegmaken"}
            </button>
            <div className="relative inline-block group" data-testid="pricing-calc-save-wrap">
              <button type="button" onClick={saveWishlist} className="btn-secondary" data-testid="pricing-calc-save">
                <Save className="h-4 w-4" /> {lang === "en" ? "Save wishlist" : "Wishlist opslaan"}
                <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700 text-strong text-[10px] font-bold" data-testid="pricing-calc-save-info" aria-label="info">i</span>
              </button>
              <div className="absolute bottom-full right-0 mb-2 w-64 rounded-lg bg-slate-900 text-white text-[11px] p-2.5 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-xl z-10">
                {lang === "en"
                  ? "Saved locally in cookies/cache if you accepted cookies — otherwise only kept in this tab. Log in to your portal to store permanently on your profile."
                  : "Opgeslagen in cookies/cache mits cookies geaccepteerd — anders alleen in dit tabblad. Log in op je portaal om het permanent aan je profiel te koppelen."}
              </div>
            </div>
            <button type="button" onClick={shareLink} className="btn-secondary" data-testid="pricing-calc-share">
              <Share2 className="h-4 w-4" /> {lang === "en" ? "Share" : "Delen"}
            </button>
            <Link to="/contact" className="btn-primary" data-testid="pricing-calc-request-quote">
              {lang === "en" ? "Request quote" : "Vraag offerte"} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          {/* Feedback widget inside modal (compact) */}
          <div className="pt-2 mt-2 border-t border-app/40">
            <FeedbackWidget page="calculator" className="!mt-0" />
          </div>
        </footer>
      </div>
    </div>
  );
}

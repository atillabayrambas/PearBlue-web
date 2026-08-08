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
    const byCat = {}; // { catKey: { oneOff, monthly, hourly } }
    const chosen = []; // { id, label, qty, unit, price, cat }
    for (const item of PRICING) {
      if (item.tbd) continue;
      const q = qty[item.id] || 0;
      if (!q) continue;
      const base = item.included ? 0 : smartAverage(item.min, item.max);
      const line = base * q;
      const svc = SERVICE_OF_CAT[item.cat] || "web";
      if (!byCat[item.cat]) byCat[item.cat] = { oneOff: 0, monthly: 0, hourly: 0 };
      if (isRecurring(item.unit)) { buckets[svc].monthly += line; byCat[item.cat].monthly += line; }
      else if (isHourly(item.unit)) { buckets[svc].hourly += line; byCat[item.cat].hourly += line; }
      else { buckets[svc].oneOff += line; byCat[item.cat].oneOff += line; }
      chosen.push({ id: item.id, label: item.nl, qty: q, unit: item.unit, price: base, cat: item.cat });
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
    return { buckets, byCat, chosen, activeSvcs: activeSvcs.map(([k]) => k), combined };
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
    const wishlistText = lang === "en"
      ? "This is my wishlist at PearBlue for my dream website, IT platform and security"
      : "Dit is mijn wishlist bij PearBlue voor mijn droom website, IT platform en de beveiliging";
    const lines = [
      wishlistText,
      "",
      `- ${lang === "en" ? "One-off" : "Eenmalig"}: ${money(totals.combined.oneOff)}`,
      `- ${lang === "en" ? "VAT 21%" : "BTW 21%"}: ${money(totals.combined.btw)}`,
      `- ${lang === "en" ? "Total incl. VAT" : "Totaal incl. btw"}: ${money(totals.combined.grandTotal)}`,
      totals.combined.monthly ? `- ${lang === "en" ? "Monthly" : "Per maand"}: ${money(totals.combined.monthly)} (${money(totals.combined.monthlyTotal)} incl. btw)` : "",
      totals.combined.hourly ? `- ${lang === "en" ? "Hourly" : "Uurlijks"}: ${money(totals.combined.hourly)}` : "",
      "",
      `${lang === "en" ? "Estimate URL: " : "Schatting URL: "}${window.location.origin}/prijslijst`,
    ].filter(Boolean).join("\n");
    if (navigator.share) {
      navigator.share({ title: "PearBlue — Wishlist", text: lines }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(lines);
      toast.success(lang === "en" ? "Copied to clipboard" : "Gekopieerd naar klembord");
    }
  };

  const [openQuote, setOpenQuote] = useState(false);

  const tabCategories = CATEGORIES.filter((c) => SERVICE_OF_CAT[c.key] === tab);

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
            const cb = totals.byCat[c.key];
            const hasCatTotal = cb && (cb.oneOff || cb.monthly || cb.hourly);
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
                {hasCatTotal && (
                  <div className="mt-2 flex flex-wrap items-center justify-end gap-3 text-[11px] rounded-lg bg-pear-50/60 dark:bg-pear-500/10 border border-pear-200/60 px-3 py-1.5" data-testid={`pricing-calc-cat-subtotal-${c.key}`}>
                    <span className="text-muted-fg uppercase tracking-widest text-[10px]">{lang === "en" ? "Subtotal" : "Subtotaal"}</span>
                    {cb.oneOff > 0 && <span className="text-strong font-mono">{lang === "en" ? "One-off" : "Eenmalig"}: <span className="text-pear-600 font-semibold">{money(cb.oneOff)}</span></span>}
                    {cb.monthly > 0 && <span className="text-strong font-mono">{lang === "en" ? "Monthly" : "Maandelijks"}: <span className="text-pear-600 font-semibold">{money(cb.monthly)}</span></span>}
                    {cb.hourly > 0 && <span className="text-strong font-mono">{lang === "en" ? "Hourly" : "Uurlijks"}: <span className="text-pear-600 font-semibold">{money(cb.hourly)}</span></span>}
                  </div>
                )}
              </div>
            );
          })}
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
            <Link to="/contact" className="btn-secondary hidden sm:inline-flex" data-testid="pricing-calc-plain-contact">
              {lang === "en" ? "Contact" : "Contact"}
            </Link>
            <button
              type="button"
              onClick={() => setOpenQuote(true)}
              className="btn-primary"
              data-testid="pricing-calc-request-quote"
            >
              {lang === "en"
                ? "Request quote & send calculation and wishes"
                : "Offerte aanvragen en calculatie en wensen mee verzenden"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          {/* Feedback widget inside modal (compact) */}
          <div className="pt-2 mt-2 border-t border-app/40">
            <FeedbackWidget page="calculator" className="!mt-0" />
          </div>
        </footer>
      </div>
      {openQuote && (
        <QuoteFromCalculator
          onClose={() => setOpenQuote(false)}
          totals={totals}
          lang={lang}
        />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Quote form modal — pre-fills wishlist + adds a "Sfeer & verhaal" story field
// -----------------------------------------------------------------------------
function QuoteFromCalculator({ onClose, totals, lang }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [story, setStory] = useState("");
  const [busy, setBusy] = useState(false);

  const hasSelection = totals.chosen && totals.chosen.length > 0;

  const submit = async (e) => {
    e.preventDefault();
    if (!name || !email) {
      toast.error(lang === "en" ? "Fill in your name & email" : "Vul je naam en e-mail in");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        name,
        email,
        company: company || undefined,
        language: lang,
        services: Array.from(new Set(totals.chosen.map((c) => SERVICE_OF_CAT[c.cat] || "web"))),
        description: story || (lang === "en" ? "Quote request from calculator" : "Offerte-aanvraag via calculator"),
        story,
        wishlist_items: totals.chosen,
        wishlist_totals: {
          oneOff: Math.round(totals.combined.oneOff * 100) / 100,
          monthly: Math.round(totals.combined.monthly * 100) / 100,
          hourly: Math.round(totals.combined.hourly * 100) / 100,
          btw: Math.round(totals.combined.btw * 100) / 100,
          grandTotal: Math.round(totals.combined.grandTotal * 100) / 100,
        },
      };
      const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
      const axios = (await import("axios")).default;
      await axios.post(`${API}/quote`, payload);
      toast.success(lang === "en" ? "Quote request sent — we'll get back to you soon." : "Offerte-aanvraag verstuurd — we nemen snel contact op.");
      onClose();
    } catch (err) {
      toast.error(lang === "en" ? "Could not send — please try again." : "Verzenden mislukt — probeer opnieuw.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose} data-testid="quote-from-calc-modal">
      <div
        className="w-full max-w-xl rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto border border-app bg-white dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
        style={{ backgroundColor: "var(--pb-bg-solid, white)" }}
      >
        <header className="px-6 py-4 border-b border-app flex items-center justify-between">
          <div>
            <div className="font-heading text-lg font-semibold text-strong">
              {lang === "en" ? "Request quote & send calculation" : "Offerte + calculatie versturen"}
            </div>
            <p className="text-xs text-muted-fg mt-0.5">
              {lang === "en"
                ? "Your wishlist and totals are attached automatically."
                : "Je wishlist en totalen worden automatisch meegestuurd."}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-fg hover:text-strong" data-testid="quote-from-calc-close"><X className="h-6 w-6" /></button>
        </header>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs uppercase tracking-widest text-muted-fg">{lang === "en" ? "Name" : "Naam"} *</span>
              <input required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border border-app bg-white dark:bg-slate-800 px-3 py-2 text-sm text-strong" data-testid="quote-name" />
            </label>
            <label className="block">
              <span className="text-xs uppercase tracking-widest text-muted-fg">E-mail *</span>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-app bg-white dark:bg-slate-800 px-3 py-2 text-sm text-strong" data-testid="quote-email" />
            </label>
          </div>
          <label className="block">
            <span className="text-xs uppercase tracking-widest text-muted-fg">{lang === "en" ? "Company" : "Bedrijf"}</span>
            <input value={company} onChange={(e) => setCompany(e.target.value)} className="mt-1 w-full rounded-lg border border-app bg-white dark:bg-slate-800 px-3 py-2 text-sm text-strong" data-testid="quote-company" />
          </label>
          <label className="block">
            <span className="block text-xs uppercase tracking-widest text-muted-fg font-bold">
              {lang === "en" ? "MOOD & STORY OF YOUR WEBSITE" : "SFEER EN VERHAAL VAN UW WEBSITE"}
            </span>
            <span className="block text-[11px] text-muted-fg mt-0.5">
              {lang === "en"
                ? "What feeling should the site convey? What's the story behind your brand? Colours, references, examples you love — tell us anything."
                : "Wat voor gevoel moet de site uitstralen? Wat is het verhaal achter je merk? Kleuren, referenties, mooie voorbeelden — vertel het ons."}
            </span>
            <textarea
              value={story}
              onChange={(e) => setStory(e.target.value)}
              rows={5}
              maxLength={5000}
              placeholder={lang === "en"
                ? "e.g. Fresh, modern and playful — with a nod to nature. Similar to X or Y. Target audience: …"
                : "bijv. Fris, modern en speels — met een knipoog naar de natuur. Vergelijkbaar met X of Y. Doelgroep: …"}
              className="mt-1 w-full rounded-lg border border-app bg-white dark:bg-slate-800 px-3 py-2 text-sm text-strong resize-y"
              data-testid="quote-story"
            />
          </label>
          {hasSelection && (
            <div className="rounded-lg border border-pear-200 bg-pear-50/40 dark:bg-pear-500/10 p-3 text-xs" data-testid="quote-wishlist-preview">
              <div className="font-heading font-semibold text-strong mb-1">{lang === "en" ? "Attached wishlist" : "Meegestuurde wishlist"}</div>
              <ul className="space-y-0.5 max-h-32 overflow-y-auto">
                {totals.chosen.slice(0, 20).map((c) => (
                  <li key={c.id} className="flex justify-between gap-2">
                    <span className="text-strong truncate">{c.label} × {c.qty}</span>
                    <span className="font-mono text-muted-fg">€{c.price * c.qty}</span>
                  </li>
                ))}
                {totals.chosen.length > 20 && <li className="text-muted-fg">+ {totals.chosen.length - 20} more…</li>}
              </ul>
              <div className="mt-2 pt-2 border-t border-pear-200/50 flex flex-wrap gap-3 justify-end text-[11px]">
                {totals.combined.oneOff > 0 && <span>{lang === "en" ? "One-off" : "Eenmalig"}: <b>{money(totals.combined.oneOff)}</b></span>}
                {totals.combined.monthly > 0 && <span>{lang === "en" ? "Monthly" : "Per maand"}: <b>{money(totals.combined.monthly)}</b></span>}
                {totals.combined.hourly > 0 && <span>{lang === "en" ? "Hourly" : "Per uur"}: <b>{money(totals.combined.hourly)}</b></span>}
              </div>
            </div>
          )}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="text-xs px-4 py-2 rounded-full border border-app hover:border-slate-400" data-testid="quote-cancel">
              {lang === "en" ? "Cancel" : "Annuleren"}
            </button>
            <button type="submit" disabled={busy} className="btn-primary" data-testid="quote-submit">
              {busy
                ? (lang === "en" ? "Sending…" : "Bezig met versturen…")
                : (lang === "en" ? "Send request" : "Verstuur aanvraag")}
              <Check className="h-4 w-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

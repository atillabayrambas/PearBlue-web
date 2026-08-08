import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Calculator, ChevronRight, Info, ArrowRight } from "lucide-react";
import { useLang } from "../i18n/LanguageContext";
import { usePageSeo } from "../hooks/usePageSeo";
import { CATEGORIES, PRICING, itemsByCat, priceLabel, smartAverage, UNIT_LABEL } from "../data/pricing";
import { FeedbackWidget } from "../components/FeedbackWidget";

const H1 = ({ children }) => <h1 className="font-heading text-4xl sm:text-5xl font-medium text-strong mb-4">{children}</h1>;
const H2 = ({ children }) => <h2 className="font-heading text-2xl sm:text-3xl font-semibold text-strong mt-14 mb-4">{children}</h2>;

const PriceRow = ({ item, lang }) => (
  <tr className="border-b border-app/40 last:border-0" data-testid={`price-row-${item.id}`}>
    <td className="py-3 pr-4 align-top text-strong">
      <div className="font-medium">{lang === "en" ? item.en : item.nl}</div>
      {(item.note_nl || item.note_en) && (
        <div className="text-xs text-muted-fg mt-1">{lang === "en" ? item.note_en : item.note_nl}</div>
      )}
    </td>
    <td className="py-3 pl-4 text-right whitespace-nowrap text-pear-600 dark:text-pear-400 font-heading font-medium">
      {priceLabel(item, lang)}
    </td>
  </tr>
);

export default function PricingListPage() {
  const { lang } = useLang();
  const [openCalc, setOpenCalc] = useState(false);
  usePageSeo({
    title: lang === "en" ? "Full pricelist — PearBlue" : "Volledige prijslijst — PearBlue",
    description: lang === "en"
      ? "Full pricelist for websites, ICT services and cybersecurity. Modular, transparent, no hidden fees."
      : "Volledige prijslijst voor websites, ICT-diensten en cybersecurity. Modulair, transparant, geen verborgen kosten.",
    path: "/prijslijst",
  });

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
          <button
            onClick={() => setOpenCalc(true)}
            className="btn-primary"
            data-testid="pricing-open-calculator"
          >
            <Calculator className="h-4 w-4" />
            {lang === "en" ? "Calculate your cost" : "Bereken jouw kosten"}
          </button>
          <Link to="/contact" className="btn-secondary" data-testid="pricing-cta-contact">
            {lang === "en" ? "Request a quote" : "Vraag een offerte"} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Quick category anchors */}
        <div className="mt-8 flex flex-wrap gap-2" data-testid="pricing-anchors">
          {CATEGORIES.map((c) => (
            <a
              key={c.key}
              href={`#cat-${c.key}`}
              className="text-xs rounded-full border border-app px-3 py-1.5 text-strong/80 hover:border-pear-500 hover:text-pear-600 transition-colors"
              data-testid={`pricing-anchor-${c.key}`}
            >
              {lang === "en" ? c.en : c.nl}
            </a>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-pear-200 bg-pear-50/40 dark:bg-pear-500/5 p-4 flex gap-3 items-start" data-testid="pricing-revisies-callout">
          <Info className="h-5 w-5 text-pear-500 shrink-0 mt-0.5" />
          <div className="text-sm text-strong/90">
            <strong>{lang === "en" ? "5 revisions included" : "5 revisies inbegrepen"}</strong> — {lang === "en"
              ? "the first 2 during test/design phase, the last 3 for refinements and final tweaks."
              : "de eerste 2 tijdens de test-/ontwerpfase, de laatste 3 voor verbeteringen en laatste aanpassingen."}
          </div>
        </div>

        {/* Category tables */}
        {CATEGORIES.map((c) => {
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

        <div className="mt-16 text-xs text-muted-fg">
          {lang === "en"
            ? "Prices are in EUR, excl. VAT. Prices may be adapted per project after intake — see the calculator disclaimer."
            : "Prijzen zijn in EUR, excl. btw. Prijzen kunnen na intake per project worden bijgesteld — zie de calculator-disclaimer."}
        </div>
      </motion.div>

      <FeedbackWidget page="prijslijst" />

      {openCalc && <CalculatorModal onClose={() => setOpenCalc(false)} />}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Calculator
// -----------------------------------------------------------------------------

const isRecurring = (u) => u === "per_maand" || u === "per_machine_maand";
const isHourly = (u) => u === "per_uur";

function CalculatorModal({ onClose }) {
  const { lang } = useLang();
  // qty map: itemId -> number (0/1 for eenmalig, N for per_stuk/per_maand)
  const [qty, setQty] = useState({});
  const setQ = (id, v) => setQty((p) => ({ ...p, [id]: v }));

  const totals = useMemo(() => {
    let oneOff = 0;
    let monthly = 0;
    let hourly = 0;
    const lines = [];
    for (const item of PRICING) {
      if (item.tbd) continue;
      const q = qty[item.id] || 0;
      if (!q) continue;
      const base = item.included ? 0 : smartAverage(item.min, item.max);
      const line = base * q;
      lines.push({ id: item.id, item, q, unitPrice: base, total: line });
      if (isRecurring(item.unit)) monthly += line;
      else if (isHourly(item.unit)) hourly += line;
      else oneOff += line;
    }
    return { oneOff, monthly, hourly, lines };
  }, [qty]);

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
         onClick={onClose} data-testid="pricing-calc-modal">
      <div
        className="w-full max-w-3xl bg-app border border-app rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-6 py-4 border-b border-app flex items-center justify-between">
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
          <button onClick={onClose} className="text-muted-fg hover:text-strong text-2xl leading-none" data-testid="pricing-calc-close">×</button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {CATEGORIES.map((c) => {
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
                            className="w-20 rounded-lg border border-app bg-app px-3 py-1.5 text-sm text-right"
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
        </div>

        <footer className="border-t border-app px-6 py-4 bg-pear-50/40 dark:bg-pear-500/5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-muted-fg">{lang === "en" ? "One-off" : "Eenmalig"}</div>
              <div className="font-heading text-2xl font-semibold text-strong" data-testid="pricing-calc-total-oneoff">€{totals.oneOff}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-widest text-muted-fg">{lang === "en" ? "Monthly" : "Per maand"}</div>
              <div className="font-heading text-2xl font-semibold text-strong" data-testid="pricing-calc-total-monthly">€{totals.monthly}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-widest text-muted-fg">{lang === "en" ? "Hourly (add-hoc)" : "Uurlijks (los)"}</div>
              <div className="font-heading text-2xl font-semibold text-strong" data-testid="pricing-calc-total-hourly">€{totals.hourly}</div>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-muted-fg leading-relaxed">
            {lang === "en"
              ? "This is an indication only — depending on scope, refinements or extra requirements the final quote may be lower or higher. Hourly rates are shown separately from one-off setup and monthly recurring costs."
              : "Dit is slechts een indicatie — afhankelijk van scope, verbeteringen of extra wensen kan de definitieve offerte lager of hoger uitpakken. Uurtarieven staan los van eenmalige setup en maandelijkse vaste lasten."}
          </p>
          <div className="mt-3 flex gap-2 justify-end">
            <Link to="/contact" className="btn-primary" data-testid="pricing-calc-request-quote">
              {lang === "en" ? "Request quote" : "Vraag offerte"} <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}

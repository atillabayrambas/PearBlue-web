import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, Leaf, Wallet, HeartHandshake, ArrowRight, MessageSquare, Palette, Wrench, Rocket, ShieldCheck, LifeBuoy } from "lucide-react";
import { useLang } from "../i18n/LanguageContext";
import { usePageSeo } from "../hooks/usePageSeo";

const IMG_OFFICE = "https://images.unsplash.com/photo-1606836591695-4d58a73eba1e?crop=entropy&cs=srgb&fm=jpg&w=1200&q=85";
const IMG_TEAM = "https://images.unsplash.com/photo-1711558596331-900d9cb71f62?crop=entropy&cs=srgb&fm=jpg&w=900&q=85";
const IMG_NATURE = "https://images.unsplash.com/photo-1547468243-8839e59a7c54?crop=entropy&cs=srgb&fm=jpg&w=900&q=85";

export default function About() {
  const { t, lang } = useLang();
  usePageSeo({ title: "Over ons", description: "Wij zijn PearBlue: innovatief, duurzaam en betaalbaar. Ontdek onze waarden en werkwijze.", path: "/over-ons" });
  // Convert **word** → <strong>word</strong> for markdown-lite paragraphs
  const bold = (s) => s.replace(/\*\*([^*]+)\*\*/g, '<strong class="text-strong font-semibold">$1</strong>');
  const values = [
    { icon: Sparkles, title: t("about.v1_title"), desc: t("about.v1_desc") },
    { icon: Leaf, title: t("about.v2_title"), desc: t("about.v2_desc") },
    { icon: Wallet, title: t("about.v3_title"), desc: t("about.v3_desc") },
    { icon: HeartHandshake, title: t("about.v4_title"), desc: t("about.v4_desc") },
    { icon: Sparkles, title: t("about.v5_title"), desc: t("about.v5_desc") },
    { icon: Leaf, title: t("about.v6_title"), desc: t("about.v6_desc") },
    { icon: Sparkles, title: t("about.v7_title"), desc: t("about.v7_desc") },
    { icon: Leaf, title: t("about.v8_title"), desc: t("about.v8_desc") },
    { icon: HeartHandshake, title: t("about.v9_title"), desc: t("about.v9_desc") },
  ];
  return (
    <div data-testid="page-about">
      <section className="max-w-7xl mx-auto px-6 lg:px-10 pt-16 lg:pt-24 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-7">
            <p className="overline mb-4">{t("about.eyebrow")}</p>
            <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
              className="font-heading text-4xl sm:text-5xl lg:text-6xl font-light tracking-tighter text-strong leading-[1.05]" data-testid="about-title">
              {t("about.title")}
            </motion.h1>
            <div className="mt-8 space-y-5 text-lg text-muted-fg leading-relaxed max-w-2xl">
              <p dangerouslySetInnerHTML={{ __html: bold(t("about.p1")) }} />
              <p dangerouslySetInnerHTML={{ __html: bold(t("about.p2")) }} />
              <p dangerouslySetInnerHTML={{ __html: bold(t("about.p3")) }} />
              <p dangerouslySetInnerHTML={{ __html: bold(t("about.p4")) }} />
            </div>
          </div>
          <div className="lg:col-span-5 grid grid-cols-2 gap-4">
            <div className="rounded-2xl overflow-hidden aspect-[3/4] shadow-[0_20px_60px_rgba(10,25,47,0.08)]">
              <img src={IMG_OFFICE} alt="Office" className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col gap-4 mt-8">
              <div className="rounded-2xl overflow-hidden aspect-square shadow-[0_20px_60px_rgba(10,25,47,0.08)]">
                <img src={IMG_TEAM} alt="Team" className="w-full h-full object-cover" />
              </div>
              <div className="rounded-2xl overflow-hidden aspect-square shadow-[0_20px_60px_rgba(10,25,47,0.08)]">
                <img src={IMG_NATURE} alt="Nature" className="w-full h-full object-cover" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-16 lg:py-24">
        <h2 className="font-heading text-3xl sm:text-4xl font-medium tracking-tight text-strong" data-testid="about-values-title">{t("about.values_title")}</h2>
        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {values.map((v, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.06 }}
              className="p-7 rounded-2xl border border-app surface card-lift" data-testid={`value-card-${i}`}>
              <div className="w-11 h-11 rounded-full bg-pear-100 text-pear-500 flex items-center justify-center mb-4">
                <v.icon className="h-5 w-5" />
              </div>
              <h3 className="font-heading text-lg font-semibold text-strong mb-2">{v.title}</h3>
              <p className="text-sm text-muted-fg leading-relaxed">{v.desc}</p>
            </motion.div>
          ))}
        </div>
        <div className="mt-14">
          <Link to="/contact" className="btn-primary" data-testid="about-cta">
            {t("cta.button")} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* OTAP procedure — visual timeline of our end-to-end delivery process */}
      <ProcedureSection lang={lang} />
    </div>
  );
}

// -----------------------------------------------------------------------------
// OTAP procedure — Ontwikkeling → Test → Acceptatie → Productie
// -----------------------------------------------------------------------------
const ProcedureSection = ({ lang }) => {
  const nl = lang !== "en";
  const steps = [
    {
      icon: MessageSquare,
      phase: nl ? "01 · INTAKE" : "01 · INTAKE",
      title: nl ? "Kennismaking & wensen" : "Kickoff & scoping",
      desc: nl
        ? "Gratis strategiegesprek — we luisteren naar je verhaal, doelen en dromen. Binnen 24u een concept-offerte met heldere scope."
        : "Free strategy call — we listen to your story, goals and dreams. Concept quote with clear scope within 24h.",
      time: nl ? "Dag 1" : "Day 1",
      color: "from-sky-400 to-cyan-400",
    },
    {
      icon: Palette,
      phase: nl ? "02 · ONTWIKKELING (O)" : "02 · DEVELOPMENT (D)",
      title: nl ? "Design & bouw" : "Design & build",
      desc: nl
        ? "Wireframes → 3 landingpage-varianten om te vergelijken → definitieve UI-mockup → code in onze developmentomgeving. Dagelijkse voortgangsupdates via het klantportaal."
        : "Wireframes → 3 landing-page variants to compare → final UI mockup → code in our development environment. Daily progress updates via the client portal.",
      time: nl ? "Dag 2-4" : "Day 2-4",
      color: "from-pear-400 to-pear-500",
    },
    {
      icon: Wrench,
      phase: nl ? "03 · TEST (T)" : "03 · TEST (T)",
      title: nl ? "Kwaliteit & performance" : "Quality & performance",
      desc: nl
        ? "Automated tests, cross-browser check, Lighthouse ≥ 90, WCAG-toegankelijkheid en security-scan (Bitdefender)."
        : "Automated tests, cross-browser check, Lighthouse ≥ 90, WCAG accessibility and security scan (Bitdefender).",
      time: nl ? "Dag 5" : "Day 5",
      color: "from-amber-400 to-orange-400",
    },
    {
      icon: ShieldCheck,
      phase: nl ? "04 · ACCEPTATIE (A)" : "04 · ACCEPTANCE (A)",
      title: nl ? "Jij bepaalt" : "You approve",
      desc: nl
        ? "Live acceptatieomgeving. Feedback in 5 hoofd-revisierondes + 3 extra design-revisies voor de gekozen landingpage inbegrepen. Pas na jouw expliciete go gaan we naar productie."
        : "Live acceptance environment. 5 main revision rounds + 3 extra design revisions on the chosen landing page included. Only after your explicit go we move to production.",
      time: nl ? "Dag 6" : "Day 6",
      color: "from-violet-400 to-fuchsia-400",
    },
    {
      icon: Rocket,
      phase: nl ? "05 · PRODUCTIE (P)" : "05 · PRODUCTION (P)",
      title: nl ? "Live gaan" : "Go live",
      desc: nl
        ? "Deploy naar jouw eigen domein, SSL-certificaat, monitoring en analytics actief. Officieel live binnen 7 dagen."
        : "Deploy to your own domain, SSL certificate, monitoring and analytics live. Officially live within 7 days.",
      time: nl ? "Dag 7" : "Day 7",
      color: "from-emerald-400 to-teal-400",
    },
    {
      icon: LifeBuoy,
      phase: nl ? "06 · NAZORG" : "06 · AFTERCARE",
      title: nl ? "Doorlopende support" : "Ongoing support",
      desc: nl
        ? "Managed hosting, wekelijkse back-ups, security-updates, ICT-helpdesk en cybersecurity monitoring — zonder verrassingen."
        : "Managed hosting, weekly backups, security updates, IT helpdesk and cybersecurity monitoring — no surprises.",
      time: nl ? "Doorlopend" : "Ongoing",
      color: "from-slate-400 to-slate-500",
    },
  ];

  return (
    <section className="max-w-7xl mx-auto px-6 lg:px-10 pb-24" data-testid="about-procedure">
      <div className="max-w-3xl mb-12">
        <p className="overline mb-4">{nl ? "Onze procedure" : "Our procedure"}</p>
        <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-strong" data-testid="procedure-title">
          {nl ? "Van eerste idee tot live: transparant in 7 dagen." : "From first idea to live: transparent in 7 days."}
        </h2>
        <p className="mt-5 text-lg text-muted-fg leading-relaxed">
          {nl
            ? "Wij werken volgens een strakke OTAP-methode (Ontwikkeling → Test → Acceptatie → Productie). Met deze processtructuur leveren we websites binnen 7 dagen en ICT-diensten in nog kortere doorlooptijden — zonder in te leveren op kwaliteit en met transparante prijzen die betaalbaar blijven."
            : "We work with a strict OTAP method (Development → Test → Acceptance → Production). This process lets us deliver websites within 7 days and IT services in even shorter timelines — without compromising quality, at transparent prices that stay affordable."}
        </p>
      </div>

      {/* Desktop: horizontal connected timeline */}
      <div className="hidden lg:block relative">
        <div className="absolute top-14 left-0 right-0 h-0.5 bg-gradient-to-r from-sky-400 via-pear-500 via-amber-400 via-violet-400 via-emerald-400 to-slate-400" aria-hidden="true" />
        <div className="grid grid-cols-6 gap-6 relative">
          {steps.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="text-center"
              data-testid={`procedure-step-${i}`}
            >
              <div className={`mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br ${s.color} text-white flex items-center justify-center shadow-lg ring-4 ring-white dark:ring-slate-900`}>
                <s.icon className="h-7 w-7" />
              </div>
              <p className="mt-4 text-[10px] uppercase tracking-widest font-bold text-pear-500">{s.phase}</p>
              <h3 className="mt-1 font-heading font-semibold text-strong text-sm leading-tight">{s.title}</h3>
              <p className="mt-2 text-xs text-muted-fg leading-relaxed">{s.desc}</p>
              <p className="mt-3 inline-block text-[10px] uppercase tracking-widest font-bold surface-2 rounded-full px-2 py-1 text-strong">{s.time}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Mobile/tablet: vertical connected timeline */}
      <div className="lg:hidden relative pl-8">
        <div className="absolute top-2 bottom-2 left-3 w-0.5 bg-gradient-to-b from-sky-400 via-pear-500 via-amber-400 via-violet-400 via-emerald-400 to-slate-400" aria-hidden="true" />
        {steps.map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.4, delay: i * 0.05 }}
            className="relative pb-8 last:pb-0"
            data-testid={`procedure-step-mobile-${i}`}
          >
            <div className={`absolute -left-8 top-0 w-6 h-6 rounded-full bg-gradient-to-br ${s.color} text-white flex items-center justify-center ring-4 ring-white dark:ring-slate-900`}>
              <s.icon className="h-3 w-3" />
            </div>
            <p className="text-[10px] uppercase tracking-widest font-bold text-pear-500">{s.phase} · {s.time}</p>
            <h3 className="mt-1 font-heading font-semibold text-strong">{s.title}</h3>
            <p className="mt-1 text-sm text-muted-fg leading-relaxed">{s.desc}</p>
          </motion.div>
        ))}
      </div>

      {/* Callout — 7-day promise */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="mt-14 relative overflow-hidden rounded-3xl border border-pear-500/30 bg-gradient-to-br from-pear-500/10 to-sky-500/5 p-8 sm:p-12"
        data-testid="procedure-callout"
      >
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-pear-500/20 blur-3xl" aria-hidden="true" />
        <div className="relative">
          <p className="overline mb-3">{nl ? "Onze belofte" : "Our promise"}</p>
          <h3 className="font-heading text-2xl sm:text-3xl font-medium text-strong max-w-2xl">
            {nl ? "Website live binnen 7 dagen. Transparant, betaalbaar, zonder concessies aan kwaliteit." : "Website live within 7 days. Transparent, affordable, no concessions on quality."}
          </h3>
          <p className="mt-4 text-muted-fg max-w-2xl">
            {nl
              ? "Voor spoed-ICT-projecten leveren we vaak in 48-72u. Alle prijzen staan vooraf online — geen verborgen kosten, altijd realtime inzicht via het klantportaal."
              : "For urgent IT projects we often deliver in 48-72h. All prices are online upfront — no hidden costs, real-time insight via the client portal."}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/prijslijst" className="btn-primary" data-testid="procedure-cta-pricing">
              {nl ? "Bekijk prijslijst" : "View pricing"} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/contact" className="btn-secondary" data-testid="procedure-cta-contact">
              {nl ? "Start je project" : "Start your project"}
            </Link>
          </div>
        </div>
      </motion.div>
    </section>
  );
};

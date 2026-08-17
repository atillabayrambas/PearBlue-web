import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Star, ChevronRight, ShieldCheck, Award, Clock } from "lucide-react";
import { useLang } from "../i18n/LanguageContext";
import { PricingTables } from "../components/PricingTables";
import { PORTFOLIO_PROJECTS } from "../data/projects";
import { usePageSeo } from "../hooks/usePageSeo";
import { FeaturedReviews, FloatingReviewTicker } from "../components/Reviews";
import { TrustStats } from "../components/TrustStats";
import { TrustpilotWidget } from "../components/TrustpilotWidget";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.6 } } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };

export default function Home() {
  const { t, lang } = useLang();
  usePageSeo({ title: "Home", description: "PearBlue — websites, ICT-diensten en cybersecurity. Fris, modern en betaalbaar voor de nieuwe generatie ondernemers.", path: "/" });
  const [preview, setPreview] = useState(PORTFOLIO_PROJECTS.slice(0, 4));
  const [projectCount, setProjectCount] = useState(PORTFOLIO_PROJECTS.length);

  useEffect(() => {
    axios.get(`${API}/projects`).then((res) => {
      // Deduplicate: prefer live CMS projects, fall back to the seed bundle
      const cmsIds = new Set((res.data || []).map((p) => p.id));
      const combined = [...(res.data || []), ...PORTFOLIO_PROJECTS.filter((p) => !cmsIds.has(p.id))];
      setPreview(combined.slice(0, 4));
      setProjectCount(combined.length);
    }).catch(() => {
      setPreview(PORTFOLIO_PROJECTS.slice(0, 4));
      setProjectCount(PORTFOLIO_PROJECTS.length);
    });
  }, []);

  // Round down to the nearest 10 so "80+", "90+", "100+" etc read as
  // deliberate milestones rather than jittering by 1 on every new upload.
  const projectMilestone = projectCount >= 10 ? `${Math.floor(projectCount / 10) * 10}+` : `${projectCount}`;

  return (
    <div data-testid="page-home">
      {/* HERO — full-width, animated background, no photo. Feels open, calm, trustworthy. */}
      <section className="relative overflow-hidden isolate" data-testid="hero">
        <HeroBackground />

        {/* Floating rotating review pill at top of the hero */}
        <div className="relative z-10">
          <FloatingReviewTicker />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-6 lg:px-10 pt-20 pb-24 lg:pt-28 lg:pb-36 text-center">
          <motion.div initial="hidden" animate="show" variants={stagger} className="flex flex-col items-center">
            <motion.p variants={fadeUp} className="overline inline-flex items-center gap-1.5 rounded-full surface border border-pear-500/25 px-4 py-1.5 shadow-sm" data-testid="hero-eyebrow">
              <Sparkles className="h-3.5 w-3.5 text-pear-500" />
              <span className="sm:hidden">{lang === "en" ? "Websites · IT · Cybersecurity" : "Websites · IT · Cybersecurity"}</span>
              <span className="hidden sm:inline">{t("hero.eyebrow")}</span>
            </motion.p>

            <motion.h1 variants={fadeUp} className="font-heading font-light text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] leading-[1.02] tracking-tighter text-strong break-words mt-8 max-w-5xl" data-testid="hero-title">
              {t("hero.title_1")}{" "}
              <span className="text-gradient-pear font-medium">{t("hero.title_accent")}</span>{" "}
              {t("hero.title_2")}
            </motion.h1>

            <motion.p variants={fadeUp} className="mt-8 text-lg sm:text-xl text-muted-fg max-w-2xl leading-relaxed" data-testid="hero-subtitle">
              {t("hero.subtitle")}
            </motion.p>

            <motion.div variants={fadeUp} className="mt-10 flex flex-wrap gap-3 justify-center">
              <Link to="/contact" className="btn-primary" data-testid="hero-cta-primary">
                {t("hero.cta_primary")} <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/diensten" className="btn-secondary" data-testid="hero-cta-secondary">
                {t("hero.cta_secondary")}
              </Link>
            </motion.div>

            {/* Trust pill — customer quote surfaced as social proof under the CTAs */}
            <motion.div
              variants={fadeUp}
              className="mt-8 inline-flex items-center gap-3 rounded-full surface border border-app px-4 py-2 shadow-[0_10px_30px_rgba(2,192,255,0.08)]"
              data-testid="hero-trust-quote"
            >
              <div className="flex items-center gap-0.5 text-amber-400">
                {[...Array(5)].map((_, i) => <Star key={i} className="h-3.5 w-3.5 fill-current" />)}
              </div>
              <p className="text-xs sm:text-sm text-strong/85">
                <span className="italic">
                  {lang === "en" ? "\u201cFast, professional and the site looks fantastic.\u201d" : "\u201cSnel, professioneel en de site oogt fantastisch.\u201d"}
                </span>
                <span className="ml-2 text-muted-fg">— Jeroen, Bakkerij De Peer</span>
              </p>
            </motion.div>

            {/* Reassurance strip — three lightweight trust signals */}
            <motion.div
              variants={fadeUp}
              className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-fg"
              data-testid="hero-reassurance"
            >
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-pear-500" /> {lang === "en" ? "AVG-first · no lock-in" : "AVG-first · geen lock-in"}</span>
              <span className="hidden sm:inline text-app">·</span>
              <span className="inline-flex items-center gap-1.5"><Award className="h-3.5 w-3.5 text-pear-500" /> {lang === "en" ? `${projectMilestone} delivered projects` : `${projectMilestone} opgeleverde projecten`}</span>
              <span className="hidden sm:inline text-app">·</span>
              <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-pear-500" /> {lang === "en" ? "Reply within 24h" : "Reactie binnen 24u"}</span>
            </motion.div>

            {/* Stats — centered, evenly spaced */}
            <motion.div variants={fadeUp} className="mt-14 grid grid-cols-3 gap-8 sm:gap-14 max-w-2xl" data-testid="hero-stats">
              {[{ n: projectMilestone, l: t("hero.stat_1") }, { n: "50+", l: t("hero.stat_2") }, { n: "7+", l: t("hero.stat_3") }].map((s, i) => (
                <div key={i} className="text-center">
                  <div className="font-heading text-4xl sm:text-5xl font-medium text-strong">{s.n}</div>
                  <div className="text-xs text-muted-fg mt-1 uppercase tracking-widest">{s.l}</div>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>

        {/* Bottom fade so the hero blends into the marquee band below */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-[color:var(--bg)]" aria-hidden="true" />
      </section>

      {/* MARQUEE */}
      <section className="border-y border-app surface py-6" data-testid="marquee-section">
        <div className="marquee">
          <div className="marquee-track font-heading text-xl text-muted-fg/70 whitespace-nowrap items-center">
            {[...Array(2)].flatMap((_, k) => ["Innovatief", "Duurzaam", "Betaalbaar", "Persoonlijk", "Transparant", "Toekomstgericht", "Fris & Fruitig", "Kwaliteit"].map((w, i) => (
              <span key={`${k}-${i}`} className="flex items-center gap-12">
                {w}<span className="text-pear-500">◆</span>
              </span>
            )))}
          </div>
        </div>
      </section>

      {/* PRICING TABLES (3 pakketten) */}
      <PricingTables />

      {/* TRUST STATS + auto-scrolling reviews marquee (middle of page, infinite loop) */}
      <TrustStats />
      <FeaturedReviews />

      {/* TRUSTPILOT WIDGET (optional, activates when BUSINESS_UNIT_ID is set) */}
      <TrustpilotWidget />

      {/* PORTFOLIO PREVIEW */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-20" data-testid="portfolio-preview">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
          <div className="max-w-2xl">
            <p className="overline mb-4">{t("portfolio.eyebrow")}</p>
            <h2 className="font-heading font-medium text-4xl sm:text-5xl tracking-tight text-strong leading-tight">{t("portfolio.title")}</h2>
            <p className="mt-4 text-lg text-muted-fg">{t("portfolio.subtitle")}</p>
          </div>
          <Link to="/portfolio" className="btn-secondary self-start md:self-auto" data-testid="portfolio-view-all">
            {t("portfolio.all")} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          {preview.map((p, i) => {
            const span = p.span || (i % 2 === 0 ? "md:col-span-8" : "md:col-span-4");
            return (
              <motion.div
                key={p.id || i}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
                className={`relative group rounded-2xl overflow-hidden ${span} aspect-[4/3] card-lift`}
                data-testid={`portfolio-card-${i}`}
              >
                <img src={p.image_url} alt={p.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-pear-900/70 via-pear-900/20 to-transparent" />
                <div className="absolute bottom-5 left-5 right-5 text-white flex items-end justify-between">
                  <div>
                    <div className="text-[11px] uppercase tracking-widest text-white/80">{p.tag || p.category}</div>
                    <div className="font-heading text-2xl font-medium">{(lang === "en" && p.title_en) || p.title}</div>
                  </div>
                  <Link to="/portfolio" className="text-xs bg-white/20 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/25 hover:bg-white/30">{t("portfolio.view")}</Link>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 pb-24" data-testid="home-cta">
        <div className="relative rounded-3xl overflow-hidden bg-pear-900 text-white p-12 lg:p-16">
          <div className="pear-blob bg-pear-500 w-[420px] h-[420px] top-[-140px] right-[-100px]" />
          <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div>
              <h3 className="font-heading text-4xl sm:text-5xl font-medium tracking-tight leading-tight">{t("cta.title")}</h3>
              <p className="mt-4 text-white/70 max-w-md leading-relaxed">{t("cta.subtitle")}</p>
            </div>
            <div className="lg:justify-self-end">
              <Link to="/contact" className="btn-primary" data-testid="home-cta-button">
                {t("cta.button")} <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// -----------------------------------------------------------------------------
// HeroBackground — full-bleed animated backdrop for the landing hero
//
// Layers (bottom → top):
//   1. Soft pear-mint radial wash to lift the section off the page background
//   2. Static dot-grid mask (pear-tinted) — gives the wide hero visual texture
//      without competing with the copy
//   3. Three floating gradient orbs that gently drift → creates a calm,
//      trustworthy sense of motion (framer-motion respects prefers-reduced-motion)
//   4. Subtle top→bottom fade to hand off to the marquee cleanly
//
// The whole thing is `aria-hidden` because it is decorative. No image assets.
// -----------------------------------------------------------------------------
const HeroBackground = () => (
  <div className="absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
    {/* 1) Base wash */}
    <div className="absolute inset-0 bg-gradient-to-br from-pear-50/60 via-transparent to-pear-100/30 dark:from-pear-500/5 dark:via-transparent dark:to-pear-500/10" />

    {/* 2) Dot grid (SVG data-URI mask so it works on both light/dark) */}
    <div
      className="absolute inset-0 opacity-[0.35] dark:opacity-20"
      style={{
        backgroundImage:
          "radial-gradient(circle at 1px 1px, rgba(2,192,255,0.35) 1px, transparent 0)",
        backgroundSize: "26px 26px",
        maskImage:
          "radial-gradient(ellipse 80% 60% at 50% 40%, black 40%, transparent 100%)",
        WebkitMaskImage:
          "radial-gradient(ellipse 80% 60% at 50% 40%, black 40%, transparent 100%)",
      }}
    />

    {/* 3) Floating orbs — slow, calming drift. Each orb has its own duration
           and phase so they never sync up (feels alive, not looping). */}
    <motion.div
      className="absolute rounded-full blur-3xl bg-pear-400/30 dark:bg-pear-500/25"
      style={{ width: 520, height: 520, top: -140, right: -100 }}
      animate={{ x: [0, 40, -20, 0], y: [0, 30, -10, 0] }}
      transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
    />
    <motion.div
      className="absolute rounded-full blur-3xl bg-sky-300/30 dark:bg-sky-400/15"
      style={{ width: 620, height: 620, bottom: -240, left: -180 }}
      animate={{ x: [0, -30, 25, 0], y: [0, -20, 20, 0] }}
      transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
    />
    <motion.div
      className="absolute rounded-full blur-3xl bg-emerald-300/20 dark:bg-emerald-400/10"
      style={{ width: 340, height: 340, top: "40%", left: "55%" }}
      animate={{ x: [0, 20, -30, 0], y: [0, -15, 10, 0], scale: [1, 1.06, 0.96, 1] }}
      transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
    />

    {/* 4) Sweeping horizontal shine (very subtle) — moves left→right over ~14s */}
    <motion.div
      className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 dark:via-white/[0.04] to-transparent pointer-events-none"
      initial={{ x: "-40%" }}
      animate={{ x: "140%" }}
      transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
    />
  </div>
);


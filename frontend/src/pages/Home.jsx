import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, ShieldCheck, Cpu, Layers, Star, ChevronRight } from "lucide-react";
import { useLang } from "../i18n/LanguageContext";

const IMAGES = {
  hero: "https://images.unsplash.com/photo-1585854467604-cf2080ccef31?crop=entropy&cs=srgb&fm=jpg&w=1400&q=85",
  ai: "https://images.unsplash.com/photo-1758073519996-6d3c63b4922c?crop=entropy&cs=srgb&fm=jpg&w=900&q=85",
  security: "https://images.unsplash.com/photo-1728739529355-31dcaefd82b7?crop=entropy&cs=srgb&fm=jpg&w=900&q=85",
  infra: "https://images.unsplash.com/photo-1680992046615-065f58bcb4d8?crop=entropy&cs=srgb&fm=jpg&w=900&q=85",
  fluid: "https://images.unsplash.com/photo-1727434032773-af3cd98375ba?crop=entropy&cs=srgb&fm=jpg&w=900&q=85",
  nature: "https://images.unsplash.com/photo-1547468243-8839e59a7c54?crop=entropy&cs=srgb&fm=jpg&w=900&q=85",
};

const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.6 } } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };

export default function Home() {
  const { t } = useLang();

  return (
    <div data-testid="page-home">
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="pear-blob bg-pear-200 w-[420px] h-[420px] top-[-100px] right-[-100px]" />
        <div className="pear-blob bg-pear-100 w-[520px] h-[520px] bottom-[-200px] left-[-140px]" />
        <div className="max-w-7xl mx-auto px-6 lg:px-10 pt-20 pb-24 lg:pt-28 lg:pb-32 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative">
          <motion.div initial="hidden" animate="show" variants={stagger} className="lg:col-span-7">
            <motion.p variants={fadeUp} className="overline mb-5" data-testid="hero-eyebrow">
              <Sparkles className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
              {t("hero.eyebrow")}
            </motion.p>
            <motion.h1 variants={fadeUp} className="font-heading font-light text-5xl sm:text-6xl lg:text-7xl leading-[1.02] tracking-tighter text-pear-900" data-testid="hero-title">
              {t("hero.title_1")}{" "}
              <span className="text-gradient-pear font-medium">{t("hero.title_accent")}</span>{" "}
              {t("hero.title_2")}
            </motion.h1>
            <motion.p variants={fadeUp} className="mt-6 text-lg text-pear-900/70 max-w-2xl leading-relaxed" data-testid="hero-subtitle">
              {t("hero.subtitle")}
            </motion.p>
            <motion.div variants={fadeUp} className="mt-9 flex flex-wrap gap-3">
              <Link to="/contact" className="btn-primary" data-testid="hero-cta-primary">
                {t("hero.cta_primary")} <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/diensten" className="btn-secondary" data-testid="hero-cta-secondary">
                {t("hero.cta_secondary")}
              </Link>
            </motion.div>
            <motion.div variants={fadeUp} className="mt-12 grid grid-cols-3 gap-6 max-w-lg" data-testid="hero-stats">
              {[{ n: "80+", l: t("hero.stat_1") }, { n: "50+", l: t("hero.stat_2") }, { n: "7+", l: t("hero.stat_3") }].map((s, i) => (
                <div key={i} className="border-l-2 border-pear-500 pl-4">
                  <div className="font-heading text-3xl font-medium text-pear-900">{s.n}</div>
                  <div className="text-xs text-pear-900/60 mt-1">{s.l}</div>
                </div>
              ))}
            </motion.div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8 }} className="lg:col-span-5 relative">
            <div className="relative rounded-3xl overflow-hidden aspect-[4/5] shadow-[0_30px_80px_rgba(2,192,255,0.2)]">
              <img src={IMAGES.hero} alt="Fluid abstract" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-tr from-pear-500/10 via-transparent to-transparent" />
            </div>
            <div className="absolute -bottom-6 -left-6 bg-white rounded-2xl p-5 shadow-[0_20px_50px_rgba(10,25,47,0.08)] border border-slate-100 w-56 hidden sm:block">
              <div className="flex items-center gap-1 text-pear-500 mb-2">
                {[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}
              </div>
              <p className="text-xs text-pear-900/70 leading-relaxed">"Snel, professioneel en de site oogt fantastisch."</p>
              <p className="text-xs font-semibold text-pear-900 mt-2">— Jeroen, Bakkerij De Peer</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* MARQUEE */}
      <section className="border-y border-slate-100 bg-white py-6" data-testid="marquee-section">
        <div className="marquee">
          <div className="marquee-track font-heading text-xl text-pear-900/40 whitespace-nowrap items-center">
            {[...Array(2)].flatMap((_, k) => ["Innovatief", "Duurzaam", "Betaalbaar", "Persoonlijk", "Toekomstgericht", "Fris & Fruitig", "Kwaliteit"].map((w, i) => (
              <span key={`${k}-${i}`} className="flex items-center gap-12">
                {w}<span className="text-pear-500">◆</span>
              </span>
            )))}
          </div>
        </div>
      </section>

      {/* SERVICES BENTO */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-24 lg:py-32" data-testid="services-preview">
        <div className="max-w-3xl">
          <p className="overline mb-4">{t("services.eyebrow")}</p>
          <h2 className="font-heading font-medium text-4xl sm:text-5xl tracking-tight text-pear-900 leading-tight">
            {t("services.title")}
          </h2>
          <p className="mt-5 text-lg text-pear-900/70 leading-relaxed">{t("services.subtitle")}</p>
        </div>

        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            { icon: Layers, title: t("services.infra_title"), desc: t("services.infra_desc"), img: IMAGES.infra, tid: "svc-card-infra" },
            { icon: Sparkles, title: t("services.media_title"), desc: t("services.media_desc"), img: IMAGES.fluid, tid: "svc-card-media" },
            { icon: ShieldCheck, title: t("services.security_title"), desc: t("services.security_desc"), img: IMAGES.security, tid: "svc-card-security" },
            { icon: Cpu, title: t("services.ai_title"), desc: t("services.ai_desc"), img: IMAGES.ai, tid: "svc-card-ai" },
          ].map((s, i) => (
            <motion.article
              key={i}
              initial={{ opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              className="card-lift group bg-white border border-slate-100 rounded-2xl overflow-hidden flex flex-col"
              data-testid={s.tid}
            >
              <div className="h-40 overflow-hidden">
                <img src={s.img} alt={s.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
              </div>
              <div className="p-6 flex-1 flex flex-col">
                <div className="w-11 h-11 rounded-full bg-pear-100 flex items-center justify-center text-pear-500 mb-4">
                  <s.icon className="h-5 w-5" />
                </div>
                <h3 className="font-heading text-xl font-semibold text-pear-900 mb-2">{s.title}</h3>
                <p className="text-sm text-pear-900/70 leading-relaxed flex-1">{s.desc}</p>
              </div>
            </motion.article>
          ))}
        </div>

        <div className="mt-10">
          <Link to="/diensten" className="inline-flex items-center gap-2 text-pear-500 font-semibold hover:gap-3 transition-all" data-testid="services-view-all">
            {t("services.cta")} <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* PORTFOLIO PREVIEW */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-24" data-testid="portfolio-preview">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
          <div className="max-w-2xl">
            <p className="overline mb-4">{t("portfolio.eyebrow")}</p>
            <h2 className="font-heading font-medium text-4xl sm:text-5xl tracking-tight text-pear-900 leading-tight">{t("portfolio.title")}</h2>
            <p className="mt-4 text-lg text-pear-900/70">{t("portfolio.subtitle")}</p>
          </div>
          <Link to="/portfolio" className="btn-secondary self-start md:self-auto" data-testid="portfolio-view-all">
            {t("portfolio.all")} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          {[
            { title: "Bloem & Wortel", tag: "E-commerce", img: IMAGES.nature, span: "md:col-span-8" },
            { title: "InfraStack NL", tag: "IT Platform", img: IMAGES.infra, span: "md:col-span-4" },
            { title: "AiVoice", tag: "AI Product", img: IMAGES.ai, span: "md:col-span-4" },
            { title: "Fresh Studio", tag: "Media Website", img: IMAGES.fluid, span: "md:col-span-8" },
          ].map((p, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              className={`relative group rounded-2xl overflow-hidden ${p.span} aspect-[4/3] card-lift`}
              data-testid={`portfolio-card-${i}`}
            >
              <img src={p.img} alt={p.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-pear-900/70 via-pear-900/20 to-transparent" />
              <div className="absolute bottom-5 left-5 right-5 text-white flex items-end justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-widest text-white/80">{p.tag}</div>
                  <div className="font-heading text-2xl font-medium">{p.title}</div>
                </div>
                <span className="text-xs bg-white/20 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/25">{t("portfolio.view")}</span>
              </div>
            </motion.div>
          ))}
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
                {t("cta.button")} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

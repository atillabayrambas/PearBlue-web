import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Layers, Sparkles, ShieldCheck, Cpu, Check, ArrowRight } from "lucide-react";
import { useLang } from "../i18n/LanguageContext";

const IMG = {
  infra: "https://images.unsplash.com/photo-1680992046615-065f58bcb4d8?crop=entropy&cs=srgb&fm=jpg&w=900&q=85",
  media: "https://images.unsplash.com/photo-1727434032773-af3cd98375ba?crop=entropy&cs=srgb&fm=jpg&w=900&q=85",
  security: "https://images.unsplash.com/photo-1728739529355-31dcaefd82b7?crop=entropy&cs=srgb&fm=jpg&w=900&q=85",
  ai: "https://images.unsplash.com/photo-1758073519996-6d3c63b4922c?crop=entropy&cs=srgb&fm=jpg&w=900&q=85",
};

export default function Services() {
  const { t, lang } = useLang();

  const items = [
    {
      icon: Layers, title: t("services.infra_title"), desc: t("services.infra_desc"), img: IMG.infra,
      price: lang === "nl" ? "vanaf €50 setup" : "from €50 setup",
      features: lang === "nl"
        ? ["Basis Setup (Hosting/CMS)", "Beveiliging & SSL", "Meertaligheid (NL/EN)", "Beheer via CMS"]
        : ["Basic setup (Hosting/CMS)", "Security & SSL", "Multilingual (NL/EN)", "CMS management"],
    },
    {
      icon: Sparkles, title: t("services.media_title"), desc: t("services.media_desc"), img: IMG.media,
      price: lang === "nl" ? "€200 – €400 design" : "€200 – €400 design",
      features: lang === "nl"
        ? ["Home & sub-pagina design", "Copywriting per pagina", "Stockfoto selectie", "Huisstijl handboek"]
        : ["Home & sub-page design", "Copywriting per page", "Stock photo curation", "Brand style guide"],
    },
    {
      icon: ShieldCheck, title: t("services.security_title"), desc: t("services.security_desc"), img: IMG.security,
      price: lang === "nl" ? "vanaf €50 setup" : "from €50 setup",
      features: lang === "nl"
        ? ["Security audit", "SSL & DDoS bescherming", "Monitoring 24/7", "Backup & recovery"]
        : ["Security audit", "SSL & DDoS protection", "24/7 monitoring", "Backup & recovery"],
    },
    {
      icon: Cpu, title: t("services.ai_title"), desc: t("services.ai_desc"), img: IMG.ai,
      price: lang === "nl" ? "€75 – €150 per set" : "€75 – €150 per set",
      features: lang === "nl"
        ? ["AI content generatie", "Chatbot integratie", "AI zoek & aanbeveling", "Custom AI workflows"]
        : ["AI content generation", "Chatbot integration", "AI search & recommendations", "Custom AI workflows"],
    },
  ];

  return (
    <div data-testid="page-services">
      <section className="max-w-7xl mx-auto px-6 lg:px-10 pt-16 lg:pt-24 pb-10">
        <div className="max-w-3xl">
          <p className="overline mb-4">{t("servicesPage.eyebrow")}</p>
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-light tracking-tighter text-pear-900 leading-[1.05]" data-testid="services-title">
            {t("servicesPage.title")}
          </h1>
          <p className="mt-5 text-lg text-pear-900/70 leading-relaxed">{t("servicesPage.subtitle")}</p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 lg:px-10 pb-8">
        <div className="space-y-16">
          {items.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6 }}
              className={`grid grid-cols-1 lg:grid-cols-12 gap-10 items-center ${i % 2 === 1 ? "lg:flex-row-reverse" : ""}`}
              data-testid={`service-block-${i}`}
            >
              <div className={`lg:col-span-6 ${i % 2 === 1 ? "lg:order-2" : ""}`}>
                <div className="rounded-3xl overflow-hidden aspect-[5/4] shadow-[0_30px_80px_rgba(2,192,255,0.14)]">
                  <img src={s.img} alt={s.title} className="w-full h-full object-cover" />
                </div>
              </div>
              <div className={`lg:col-span-6 ${i % 2 === 1 ? "lg:order-1" : ""}`}>
                <div className="w-12 h-12 rounded-full bg-pear-100 text-pear-500 flex items-center justify-center mb-5">
                  <s.icon className="h-6 w-6" />
                </div>
                <h2 className="font-heading text-3xl sm:text-4xl font-medium tracking-tight text-pear-900">{s.title}</h2>
                <p className="mt-4 text-lg text-pear-900/70 leading-relaxed">{s.desc}</p>
                <ul className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {s.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-pear-900/80">
                      <span className="mt-1 w-5 h-5 rounded-full bg-pear-100 text-pear-500 flex items-center justify-center shrink-0">
                        <Check className="h-3 w-3" />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-7 flex items-center gap-4">
                  <span className="inline-block text-xs uppercase tracking-widest bg-pear-100 text-pear-700 rounded-full px-3 py-1.5 font-semibold">
                    {s.price}
                  </span>
                  <Link to="/contact" className="text-pear-500 font-semibold text-sm hover:gap-2 inline-flex items-center gap-1 transition-all" data-testid={`service-cta-${i}`}>
                    {t("servicesPage.cta")} <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
        <p className="text-xs text-pear-900/50 mt-16">{t("servicesPage.pricingNote")}</p>
      </section>

      <section className="max-w-7xl mx-auto px-6 lg:px-10 pb-20">
        <div className="relative rounded-3xl overflow-hidden bg-pear-900 text-white p-10 lg:p-14 mt-12">
          <div className="pear-blob bg-pear-500 w-[380px] h-[380px] top-[-120px] right-[-80px]" />
          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <h3 className="font-heading text-3xl sm:text-4xl font-medium tracking-tight leading-tight max-w-lg">{t("cta.title")}</h3>
            <Link to="/contact" className="btn-primary self-start" data-testid="services-page-cta">
              {t("cta.button")} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

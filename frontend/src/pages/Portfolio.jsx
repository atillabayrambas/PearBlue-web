import React, { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, ExternalLink } from "lucide-react";
import { useLang } from "../i18n/LanguageContext";

const IMG = {
  ai: "https://images.unsplash.com/photo-1758073519996-6d3c63b4922c?crop=entropy&cs=srgb&fm=jpg&w=900&q=85",
  security: "https://images.unsplash.com/photo-1728739529355-31dcaefd82b7?crop=entropy&cs=srgb&fm=jpg&w=900&q=85",
  infra: "https://images.unsplash.com/photo-1680992046615-065f58bcb4d8?crop=entropy&cs=srgb&fm=jpg&w=900&q=85",
  fluid: "https://images.unsplash.com/photo-1727434032773-af3cd98375ba?crop=entropy&cs=srgb&fm=jpg&w=900&q=85",
  nature: "https://images.unsplash.com/photo-1547468243-8839e59a7c54?crop=entropy&cs=srgb&fm=jpg&w=900&q=85",
  office: "https://images.unsplash.com/photo-1606836591695-4d58a73eba1e?crop=entropy&cs=srgb&fm=jpg&w=900&q=85",
};

export default function Portfolio() {
  const { t, lang } = useLang();
  const [filter, setFilter] = useState("all");

  const items = [
    { title: "Bloem & Wortel", cat: "ecom", tagNL: "E-commerce", tagEN: "E-commerce", img: IMG.nature, span: "md:col-span-8" },
    { title: "InfraStack NL", cat: "infra", tagNL: "IT Platform", tagEN: "IT Platform", img: IMG.infra, span: "md:col-span-4" },
    { title: "AiVoice Studio", cat: "ai", tagNL: "AI Product", tagEN: "AI Product", img: IMG.ai, span: "md:col-span-6" },
    { title: "Guard365", cat: "sec", tagNL: "Cybersecurity", tagEN: "Cybersecurity", img: IMG.security, span: "md:col-span-6" },
    { title: "Fresh Studio", cat: "media", tagNL: "Media Website", tagEN: "Media Website", img: IMG.fluid, span: "md:col-span-8" },
    { title: "Peer Advies", cat: "corp", tagNL: "Corporate Site", tagEN: "Corporate Site", img: IMG.office, span: "md:col-span-4" },
  ];

  const filters = [
    { key: "all", label: lang === "nl" ? "Alles" : "All" },
    { key: "ecom", label: "E-commerce" },
    { key: "ai", label: "AI" },
    { key: "sec", label: lang === "nl" ? "Security" : "Security" },
    { key: "media", label: "Media" },
  ];

  const visible = filter === "all" ? items : items.filter((i) => i.cat === filter);

  return (
    <div data-testid="page-portfolio">
      <section className="max-w-7xl mx-auto px-6 lg:px-10 pt-16 lg:pt-24 pb-8">
        <p className="overline mb-4">{t("portfolio.eyebrow")}</p>
        <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-light tracking-tighter text-pear-900 leading-[1.05] max-w-3xl" data-testid="portfolio-title">
          {t("portfolio.title")}
        </h1>
        <p className="mt-5 text-lg text-pear-900/70 max-w-2xl">{t("portfolio.subtitle")}</p>

        <div className="mt-8 flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              data-testid={`portfolio-filter-${f.key}`}
              className={`text-sm rounded-full px-4 py-2 border transition-colors ${
                filter === f.key ? "bg-pear-500 text-white border-pear-500" : "bg-white text-pear-900 border-slate-200 hover:border-pear-500"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 lg:px-10 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          {visible.map((p, i) => (
            <motion.article
              key={p.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              className={`relative group rounded-2xl overflow-hidden ${p.span} aspect-[4/3] card-lift`}
              data-testid={`portfolio-item-${i}`}
            >
              <img src={p.img} alt={p.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-pear-900/75 via-pear-900/20 to-transparent" />
              <div className="absolute bottom-5 left-5 right-5 text-white flex items-end justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-widest text-white/80">{lang === "nl" ? p.tagNL : p.tagEN}</div>
                  <div className="font-heading text-2xl font-medium">{p.title}</div>
                </div>
                <span className="inline-flex items-center gap-1 text-xs bg-white/20 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/25">
                  {t("portfolio.view")} <ExternalLink className="h-3 w-3" />
                </span>
              </div>
            </motion.article>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 lg:px-10 pb-20">
        <div className="relative rounded-3xl overflow-hidden bg-pear-900 text-white p-10 lg:p-14">
          <div className="pear-blob bg-pear-500 w-[380px] h-[380px] top-[-120px] right-[-80px]" />
          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <h3 className="font-heading text-3xl sm:text-4xl font-medium tracking-tight leading-tight max-w-md">{t("cta.title")}</h3>
              <p className="mt-3 text-white/70 max-w-md">{t("cta.subtitle")}</p>
            </div>
            <Link to="/contact" className="btn-primary self-start" data-testid="portfolio-cta">
              {t("cta.button")} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

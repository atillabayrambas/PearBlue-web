import React, { useEffect, useState } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { X, ExternalLink, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useLang } from "../i18n/LanguageContext";
import { PORTFOLIO_PROJECTS } from "../data/projects";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CATEGORIES = [
  { key: "all", nl: "Alles", en: "All" },
  { key: "ecom", nl: "E-commerce", en: "E-commerce" },
  { key: "ai", nl: "AI", en: "AI" },
  { key: "sec", nl: "Security", en: "Security" },
  { key: "media", nl: "Media", en: "Media" },
  { key: "infra", nl: "Infrastructuur", en: "Infrastructure" },
  { key: "corp", nl: "Corporate", en: "Corporate" },
];

export default function Projects() {
  const { t, lang } = useLang();
  const [filter, setFilter] = useState("all");
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    axios.get(`${API}/projects`)
      .then((res) => setItems([...(res.data || []), ...PORTFOLIO_PROJECTS]))
      .catch(() => setItems(PORTFOLIO_PROJECTS));
  }, []);

  const visible = filter === "all" ? items : items.filter((i) => i.category === filter);

  return (
    <div data-testid="page-projects">
      <section className="max-w-7xl mx-auto px-6 lg:px-10 pt-16 lg:pt-24 pb-10">
        <p className="overline mb-4">{t("portfolio.eyebrow")}</p>
        <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-light tracking-tighter text-strong leading-[1.05] max-w-3xl" data-testid="projects-title">
          {t("portfolio.title")}
        </h1>
        <p className="mt-5 text-lg text-muted-fg max-w-2xl">{t("portfolio.subtitle")}</p>

        <div className="mt-8 flex flex-wrap gap-2">
          {CATEGORIES.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              data-testid={`projects-filter-${f.key}`}
              className={`text-sm rounded-full px-4 py-2 border transition-colors ${
                filter === f.key ? "bg-pear-500 text-white border-pear-500" : "surface text-strong border-app hover:border-pear-500"
              }`}
            >
              {lang === "nl" ? f.nl : f.en}
            </button>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 lg:px-10 pb-16">
        {visible.length === 0 ? (
          <div className="rounded-3xl border border-app surface p-16 text-center text-muted-fg" data-testid="projects-empty">
            {t("projects.empty")}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visible.map((p, i) => (
              <motion.article
                key={p.id}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: (i % 6) * 0.05 }}
                className="relative group rounded-2xl overflow-hidden border border-app surface card-lift cursor-pointer"
                onClick={() => setSelected(p)}
                data-testid={`project-card-${i}`}
              >
                <div className="aspect-[4/3] overflow-hidden">
                  <img src={p.image_url} alt={p.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                </div>
                <div className="p-5">
                  <div className="text-[11px] uppercase tracking-widest text-pear-500 mb-1">{p.tag || p.category}</div>
                  <h3 className="font-heading text-xl font-semibold text-strong">{p.title}</h3>
                  {p.description && <p className="text-sm text-muted-fg mt-2 line-clamp-2">{p.description}</p>}
                  <div className="mt-4 inline-flex items-center gap-1.5 text-pear-500 text-sm font-semibold">
                    {t("projects.view_detail")} <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
        )}
      </section>

      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-pear-900/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setSelected(null)}
            data-testid="project-modal-overlay"
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.94, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 24 }}
              className="surface rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-[0_40px_100px_rgba(0,0,0,0.35)]"
              onClick={(e) => e.stopPropagation()}
              data-testid="project-modal"
            >
              <div className="relative aspect-[16/9] overflow-hidden">
                <img src={selected.image_url} alt={selected.title} className="w-full h-full object-cover" />
                <button onClick={() => setSelected(null)} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/90 backdrop-blur text-pear-900 flex items-center justify-center hover:bg-white" aria-label="Close" data-testid="project-modal-close">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-8">
                <div className="text-xs uppercase tracking-widest text-pear-500 mb-2">{selected.tag || selected.category}</div>
                <h3 className="font-heading text-3xl font-semibold text-strong mb-4">{selected.title}</h3>
                {selected.description && <p className="text-muted-fg leading-relaxed">{selected.description}</p>}
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  {selected.external_url && selected.external_url !== "#" && (
                    <a href={selected.external_url} target="_blank" rel="noreferrer" className="btn-primary" data-testid="project-modal-external">
                      {t("projects.external")} <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                  <button onClick={() => setSelected(null)} className="btn-secondary" data-testid="project-modal-close-btn">
                    {t("projects.close")}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <section className="max-w-7xl mx-auto px-6 lg:px-10 pb-20">
        <div className="relative rounded-3xl overflow-hidden bg-pear-900 text-white p-10 lg:p-14">
          <div className="pear-blob bg-pear-500 w-[380px] h-[380px] top-[-120px] right-[-80px]" />
          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <h3 className="font-heading text-3xl sm:text-4xl font-medium tracking-tight leading-tight max-w-md">{t("cta.title")}</h3>
              <p className="mt-3 text-white/70 max-w-md">{t("cta.subtitle")}</p>
            </div>
            <Link to="/contact" className="btn-primary self-start" data-testid="projects-cta">
              {t("cta.button")}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

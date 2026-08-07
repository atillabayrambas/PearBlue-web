import React, { useEffect, useState } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, ExternalLink, Trash2, Link as LinkIcon, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useLang } from "../i18n/LanguageContext";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SEEDED = [
  {
    id: "seed-1",
    title: "Bloem & Wortel",
    category: "ecom",
    tag: "E-commerce",
    description: "Complete webshop met iDEAL, voorraadbeheer en meertaligheid voor een duurzame bloemist.",
    image_url: "https://images.unsplash.com/photo-1547468243-8839e59a7c54?crop=entropy&cs=srgb&fm=jpg&w=1200&q=85",
    external_url: "#",
  },
  {
    id: "seed-2",
    title: "InfraStack NL",
    category: "infra",
    tag: "IT Platform",
    description: "Multi-tenant cloud dashboard voor MKB IT-beheer met server monitoring en ticketing.",
    image_url: "https://images.unsplash.com/photo-1680992046615-065f58bcb4d8?crop=entropy&cs=srgb&fm=jpg&w=1200&q=85",
    external_url: "#",
  },
  {
    id: "seed-3",
    title: "AiVoice Studio",
    category: "ai",
    tag: "AI Product",
    description: "Realtime AI-transcriptie en samenvattingen voor podcasters en journalisten.",
    image_url: "https://images.unsplash.com/photo-1758073519996-6d3c63b4922c?crop=entropy&cs=srgb&fm=jpg&w=1200&q=85",
    external_url: "#",
  },
  {
    id: "seed-4",
    title: "Guard365",
    category: "sec",
    tag: "Cybersecurity",
    description: "24/7 monitoring dashboard bovenop Bitdefender GravityZone met eigen alerting.",
    image_url: "https://images.unsplash.com/photo-1728739529355-31dcaefd82b7?crop=entropy&cs=srgb&fm=jpg&w=1200&q=85",
    external_url: "#",
  },
  {
    id: "seed-5",
    title: "Fresh Studio",
    category: "media",
    tag: "Media Website",
    description: "Creative agency portfolio site met framer-motion overgangen en CMS.",
    image_url: "https://images.unsplash.com/photo-1727434032773-af3cd98375ba?crop=entropy&cs=srgb&fm=jpg&w=1200&q=85",
    external_url: "#",
  },
  {
    id: "seed-6",
    title: "Peer Advies",
    category: "corp",
    tag: "Corporate Site",
    description: "Corporate website met multi-language, klantenportaal en Google Analytics 4.",
    image_url: "https://images.unsplash.com/photo-1606836591695-4d58a73eba1e?crop=entropy&cs=srgb&fm=jpg&w=1200&q=85",
    external_url: "#",
  },
];

const CATEGORIES = [
  { key: "all", nl: "Alles", en: "All" },
  { key: "ecom", nl: "E-commerce", en: "E-commerce" },
  { key: "ai", nl: "AI", en: "AI" },
  { key: "sec", nl: "Security", en: "Security" },
  { key: "media", nl: "Media", en: "Media" },
  { key: "infra", nl: "Infrastructuur", en: "Infrastructure" },
  { key: "corp", nl: "Corporate", en: "Corporate" },
];

const emptyForm = { title: "", category: "media", tag: "", description: "", image_url: "", external_url: "" };

export default function Projects() {
  const { t, lang } = useLang();
  const [filter, setFilter] = useState("all");
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const res = await axios.get(`${API}/projects`);
      setItems([...(res.data || []), ...SEEDED]);
    } catch (e) {
      console.error(e);
      setItems(SEEDED);
    }
  };

  useEffect(() => { load(); }, []);

  const visible = filter === "all" ? items : items.filter((i) => i.category === filter);

  const change = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submitProject = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await axios.post(`${API}/projects`, form);
      toast.success(lang === "nl" ? "Project toegevoegd!" : "Project added!");
      setShowForm(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      toast.error(lang === "nl" ? "Kon project niet opslaan." : "Could not save project.");
    } finally {
      setSaving(false);
    }
  };

  const deleteProject = async (p) => {
    if (p.id.startsWith("seed-")) return;
    if (!window.confirm(t("projects.confirm_delete"))) return;
    try {
      await axios.delete(`${API}/projects/${p.id}`);
      toast.success(lang === "nl" ? "Verwijderd." : "Deleted.");
      setSelected(null);
      load();
    } catch (err) {
      toast.error(lang === "nl" ? "Verwijderen mislukt." : "Delete failed.");
    }
  };

  return (
    <div data-testid="page-projects">
      <section className="max-w-7xl mx-auto px-6 lg:px-10 pt-16 lg:pt-24 pb-10">
        <p className="overline mb-4">{t("portfolio.eyebrow")}</p>
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div>
            <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-light tracking-tighter text-strong leading-[1.05] max-w-3xl" data-testid="projects-title">
              {t("projects.title")}
            </h1>
            <p className="mt-5 text-lg text-muted-fg max-w-2xl">{t("projects.subtitle")}</p>
          </div>
          <button onClick={() => setShowForm(true)} className="btn-primary self-start lg:self-auto" data-testid="projects-add-button">
            <Plus className="h-4 w-4" /> {t("projects.add")}
          </button>
        </div>

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

      {/* DETAIL MODAL */}
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
                <button
                  onClick={() => setSelected(null)}
                  className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/90 backdrop-blur text-pear-900 flex items-center justify-center hover:bg-white"
                  aria-label="Close" data-testid="project-modal-close"
                >
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
                  {!selected.id.startsWith("seed-") && (
                    <button
                      onClick={() => deleteProject(selected)}
                      className="ml-auto inline-flex items-center gap-2 text-red-500 text-sm font-semibold hover:text-red-600"
                      data-testid="project-modal-delete"
                    >
                      <Trash2 className="h-4 w-4" /> {t("projects.delete")}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ADD FORM MODAL */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-pear-900/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowForm(false)}
            data-testid="project-form-overlay"
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.94, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 24 }}
              className="surface rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-[0_40px_100px_rgba(0,0,0,0.35)] p-8"
              onClick={(e) => e.stopPropagation()}
              data-testid="project-form"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-heading text-2xl font-semibold text-strong">{t("projects.form_title")}</h3>
                <button onClick={() => setShowForm(false)} className="w-9 h-9 rounded-full border border-app flex items-center justify-center text-strong" data-testid="project-form-close">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <form onSubmit={submitProject} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block md:col-span-2">
                  <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg">{t("projects.form_name")} *</span>
                  <input required value={form.title} onChange={change("title")} type="text" data-testid="project-input-title"
                    className="mt-1.5 w-full rounded-xl surface-2 border border-transparent focus:border-pear-500 focus:ring-2 focus:ring-pear-500/20 px-4 py-3 text-sm outline-none text-strong" />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg">{t("projects.form_cat")} *</span>
                  <select required value={form.category} onChange={change("category")} data-testid="project-input-category"
                    className="mt-1.5 w-full rounded-xl surface-2 border border-transparent focus:border-pear-500 focus:ring-2 focus:ring-pear-500/20 px-4 py-3 text-sm outline-none text-strong">
                    {CATEGORIES.filter((c) => c.key !== "all").map((c) => (
                      <option key={c.key} value={c.key}>{lang === "nl" ? c.nl : c.en}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg">{t("projects.form_tag")}</span>
                  <input value={form.tag} onChange={change("tag")} type="text" placeholder="E-commerce, AI, ..." data-testid="project-input-tag"
                    className="mt-1.5 w-full rounded-xl surface-2 border border-transparent focus:border-pear-500 focus:ring-2 focus:ring-pear-500/20 px-4 py-3 text-sm outline-none text-strong" />
                </label>
                <label className="block md:col-span-2">
                  <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg">{t("projects.form_img")} *</span>
                  <input required value={form.image_url} onChange={change("image_url")} type="url" placeholder="https://..." data-testid="project-input-image"
                    className="mt-1.5 w-full rounded-xl surface-2 border border-transparent focus:border-pear-500 focus:ring-2 focus:ring-pear-500/20 px-4 py-3 text-sm outline-none text-strong" />
                </label>
                <label className="block md:col-span-2">
                  <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg">{t("projects.form_link")}</span>
                  <input value={form.external_url} onChange={change("external_url")} type="url" placeholder="https://..." data-testid="project-input-link"
                    className="mt-1.5 w-full rounded-xl surface-2 border border-transparent focus:border-pear-500 focus:ring-2 focus:ring-pear-500/20 px-4 py-3 text-sm outline-none text-strong" />
                </label>
                <label className="block md:col-span-2">
                  <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg">{t("projects.form_desc")}</span>
                  <textarea value={form.description} onChange={change("description")} rows={4} data-testid="project-input-description"
                    className="mt-1.5 w-full rounded-xl surface-2 border border-transparent focus:border-pear-500 focus:ring-2 focus:ring-pear-500/20 px-4 py-3 text-sm outline-none resize-none text-strong" />
                </label>
                <div className="md:col-span-2 flex items-center gap-3 mt-2">
                  <button type="submit" disabled={saving} className="btn-primary" data-testid="project-form-submit">
                    {saving ? "…" : t("projects.save")}
                  </button>
                  <button type="button" onClick={() => setShowForm(false)} className="btn-secondary" data-testid="project-form-cancel">
                    {t("projects.cancel")}
                  </button>
                </div>
              </form>
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
              {t("cta.button")} <LinkIcon className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

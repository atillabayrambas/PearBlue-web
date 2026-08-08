import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, Leaf, Wallet, HeartHandshake, ArrowRight } from "lucide-react";
import { useLang } from "../i18n/LanguageContext";
import { usePageSeo } from "../hooks/usePageSeo";

const IMG_OFFICE = "https://images.unsplash.com/photo-1606836591695-4d58a73eba1e?crop=entropy&cs=srgb&fm=jpg&w=1200&q=85";
const IMG_TEAM = "https://images.unsplash.com/photo-1711558596331-900d9cb71f62?crop=entropy&cs=srgb&fm=jpg&w=900&q=85";
const IMG_NATURE = "https://images.unsplash.com/photo-1547468243-8839e59a7c54?crop=entropy&cs=srgb&fm=jpg&w=900&q=85";

export default function About() {
  const { t } = useLang();
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
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { motion } from "framer-motion";
import { Sparkles, ArrowLeft } from "lucide-react";
import { useLang } from "../i18n/LanguageContext";
import { usePageSeo } from "../hooks/usePageSeo";
import { RichText } from "../components/RichText";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function ChangelogPage() {
  const { lang } = useLang();
  const [data, setData] = useState({ entries: [] });
  usePageSeo({
    title: lang === "en" ? "Changelog — PearBlue" : "Changelog — PearBlue",
    description: lang === "en" ? "All released versions of the PearBlue platform." : "Alle uitgebrachte versies van het PearBlue-platform.",
    path: "/changelog",
  });
  useEffect(() => { axios.get(`${API}/changelog`).then((r) => setData(r.data || { entries: [] })).catch(() => {}); }, []);

  return (
    <div className="max-w-3xl mx-auto px-6 lg:px-10 py-16" data-testid="page-changelog">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="text-sm mb-4">
          <Link to="/" className="text-muted-fg hover:text-pear-500 inline-flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" /> {lang === "en" ? "Back to site" : "Terug naar site"}
          </Link>
        </div>
        <p className="overline mb-2 flex items-center gap-2">
          <Sparkles className="h-3 w-3 text-pear-500" /> {lang === "en" ? "Product updates" : "Product-updates"}
        </p>
        <h1 className="font-heading text-4xl sm:text-5xl font-medium text-strong mb-2">
          Changelog
        </h1>
        <p className="text-muted-fg text-lg mb-10 leading-relaxed">
          {lang === "en"
            ? "PearBlue is currently in Beta. Every version shipped is listed below."
            : "PearBlue is momenteel in Beta. Elke uitgebrachte versie staat hieronder."}
        </p>

        <div className="relative pl-6">
          <div className="absolute left-2 top-1 bottom-1 w-px bg-app" />
          {data.entries.map((e, i) => (
            <div key={e.version} className="relative mb-10" data-testid={`changelog-entry-${e.version}`}>
              <div className={`absolute -left-6 top-1.5 w-3 h-3 rounded-full ${i === 0 ? "bg-pear-500 ring-4 ring-pear-500/20" : "bg-app border-2 border-pear-300"}`} />
              <div className="flex items-baseline gap-3 mb-2 flex-wrap">
                <h2 className="font-heading text-2xl font-semibold text-strong">v{e.version}</h2>
                <span className="text-xs text-muted-fg">{new Date(e.date).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}</span>
                {i === 0 && (
                  <span className="text-[10px] uppercase tracking-widest bg-pear-500 text-white rounded-full px-2 py-0.5 font-bold">
                    {lang === "en" ? "Latest" : "Nieuwste"}
                  </span>
                )}
              </div>
              <ul className="space-y-1.5 text-sm text-strong/90 list-disc pl-5">
                {e.highlights.map((h, idx) => <li key={idx}><RichText text={h} /></li>)}
              </ul>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

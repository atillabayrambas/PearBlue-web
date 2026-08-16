import React, { useEffect, useState } from "react";
import axios from "axios";
import { Sparkles } from "lucide-react";
import { API } from "./_shared";
import { RichText } from "../RichText";

export const ChangelogAdmin = () => {
  const [data, setData] = useState({ entries: [], current: null });
  useEffect(() => { axios.get(`${API}/changelog`).then((r) => setData(r.data || { entries: [] })).catch(() => {}); }, []);
  return (
    <div data-testid="cms-changelog">
      <h2 className="font-heading text-2xl font-semibold text-strong flex items-center gap-2">
        <Sparkles className="h-6 w-6 text-pear-500" /> Changelog / Versies
      </h2>
      <p className="text-sm text-muted-fg mt-1 mb-6">Alle uitgebrachte versies van het platform. Huidige versie: <strong>v{data.current || "?"}</strong></p>
      <div className="relative pl-6">
        <div className="absolute left-2 top-1 bottom-1 w-px surface" />
        {data.entries.map((e, i) => (
          <div key={e.version} className="relative mb-8" data-testid={`cms-changelog-${e.version}`}>
            <div className={`absolute -left-6 top-1.5 w-3 h-3 rounded-full ${i === 0 ? "bg-pear-500 ring-4 ring-pear-500/20" : "surface border-2 border-pear-300"}`} />
            <div className="flex items-baseline gap-3 flex-wrap">
              <h3 className="font-heading text-xl font-semibold text-strong">v{e.version}</h3>
              <span className="text-xs text-muted-fg">{new Date(e.date).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}</span>
            </div>
            <ul className="mt-2 space-y-1 text-sm text-strong/90 list-disc pl-5">
              {e.highlights.map((h, idx) => <li key={idx}><RichText text={h} /></li>)}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};

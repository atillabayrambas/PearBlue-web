import React, { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Plus, Trash2, ExternalLink } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { useLang } from "../../i18n/LanguageContext";
import { API, CATEGORIES, emptyProjectForm as emptyForm } from "./_shared";
import { AiTranslateButton } from "./AiTranslateButton";
import { BulkTranslateButton } from "./BulkTranslateButton";

export const ProjectsAdmin = () => {
  const { authHeader } = useAuth();
  const { lang } = useLang();
  const en = lang === "en";
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("active");

  const load = async () => {
    // Include archived so admin sees everything
    const res = await axios.get(`${API}/admin/projects/all`, { headers: authHeader() });
    setItems(res.data || []);
  };
  useEffect(() => { load(); }, []); // eslint-disable-line

  const change = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await axios.post(`${API}/projects`, form, { headers: authHeader() });
      toast.success("Project toegevoegd");
      setForm(emptyForm);
      load();
    } catch { toast.error("Toevoegen mislukt"); } finally { setSaving(false); }
  };

  const remove = async (id) => {
    if (!window.confirm("Project definitief verwijderen? Archiveren is meestal veiliger.")) return;
    try {
      await axios.delete(`${API}/projects/${id}`, { headers: authHeader() });
      toast.success("Verwijderd");
      load();
    } catch { toast.error("Verwijderen mislukt"); }
  };

  const archive = async (id, archived) => {
    try {
      await axios.patch(`${API}/projects/${id}`, { archived }, { headers: authHeader() });
      toast.success(archived ? "Gearchiveerd — niet meer zichtbaar op site" : "Terug op site geplaatst");
      load();
    } catch { toast.error("Actie mislukt"); }
  };

  const shown = filter === "all" ? items : filter === "archived" ? items.filter((p) => p.archived) : items.filter((p) => !p.archived);

  return (
    <div data-testid="cms-projects">
      <header className="mb-6">
        <h1 className="font-heading text-3xl font-medium text-strong">{en ? "Portfolio" : "Portfolio beheren"}</h1>
        <p className="text-sm text-muted-fg mt-1">{en ? "Add cases, archive (hides from site) or delete permanently." : "Voeg cases toe, archiveer (haalt van site) of verwijder permanent."}</p>
      </header>

      <form onSubmit={save} className="surface border border-app rounded-2xl p-6 grid grid-cols-1 md:grid-cols-2 gap-4 mb-8" data-testid="cms-project-form">
        <label className="block md:col-span-2">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg">Titel *</span>
            <AiTranslateButton value={form.title} onTranslated={(t) => setForm((f) => ({ ...f, title: t }))} testid="cms-title-translate" size="xs" />
          </div>
          <input required value={form.title} onChange={change("title")} data-testid="cms-input-title"
            className="w-full rounded-xl surface-2 border border-transparent focus:border-pear-500 focus:ring-2 focus:ring-pear-500/20 px-4 py-2.5 text-sm outline-none text-strong" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg">Categorie *</span>
          <select required value={form.category} onChange={change("category")} data-testid="cms-input-category"
            className="mt-1.5 w-full rounded-xl surface-2 border border-transparent focus:border-pear-500 focus:ring-2 focus:ring-pear-500/20 px-4 py-2.5 text-sm outline-none text-strong">
            {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg">Tag</span>
          <input value={form.tag} onChange={change("tag")} data-testid="cms-input-tag"
            className="mt-1.5 w-full rounded-xl surface-2 border border-transparent focus:border-pear-500 focus:ring-2 focus:ring-pear-500/20 px-4 py-2.5 text-sm outline-none text-strong" />
        </label>
        <label className="block md:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg">Afbeelding URL *</span>
          <input required type="url" value={form.image_url} onChange={change("image_url")} data-testid="cms-input-image"
            className="mt-1.5 w-full rounded-xl surface-2 border border-transparent focus:border-pear-500 focus:ring-2 focus:ring-pear-500/20 px-4 py-2.5 text-sm outline-none text-strong" />
        </label>
        <label className="block md:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg">Externe link</span>
          <input type="url" value={form.external_url} onChange={change("external_url")} data-testid="cms-input-link"
            className="mt-1.5 w-full rounded-xl surface-2 border border-transparent focus:border-pear-500 focus:ring-2 focus:ring-pear-500/20 px-4 py-2.5 text-sm outline-none text-strong" />
        </label>
        <label className="block md:col-span-2">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg">Omschrijving</span>
            <AiTranslateButton value={form.description} onTranslated={(t) => setForm((f) => ({ ...f, description: t }))} testid="cms-desc-translate" size="xs" />
          </div>
          <textarea rows={4} value={form.description} onChange={change("description")} data-testid="cms-input-description"
            className="w-full rounded-xl surface-2 border border-transparent focus:border-pear-500 focus:ring-2 focus:ring-pear-500/20 px-4 py-2.5 text-sm outline-none text-strong resize-none" />
        </label>
        <div className="md:col-span-2">
          <button type="submit" disabled={saving} className="btn-primary" data-testid="cms-project-submit">
            {saving ? "…" : <><Plus className="h-4 w-4" /> Project toevoegen</>}
          </button>
        </div>
      </form>

      <div className="flex items-center gap-2 mb-3 text-sm">
        {[
          { key: "active", label: "Actief op site" },
          { key: "archived", label: "Gearchiveerd" },
          { key: "all", label: "Alles" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            data-testid={`cms-project-filter-${f.key}`}
            className={`px-3 py-1.5 rounded-full border text-xs font-medium ${filter === f.key ? "bg-pear-500 text-white border-pear-500" : "text-strong border-app hover:border-pear-500"}`}
          >{f.label}</button>
        ))}
        <span className="ml-auto text-xs text-muted-fg">Totaal: {items.length} · Actief: {items.filter((p) => !p.archived).length}</span>
      </div>

      <div className="flex items-center justify-end mb-3">
        <BulkTranslateButton
          items={shown.filter((p) => !p.archived)}
          itemLabel={(p) => p.title}
          needsTranslation={(p) => (p.title && !p.title_en) || (p.description && !p.description_en)}
          fields={[
            { srcKey: "title", dstKey: "title_en" },
            { srcKey: "description", dstKey: "description_en" },
          ]}
          patchUrl={(p) => `${API}/projects/${p.id}`}
          onDone={load}
          testid="cms-projects-bulk-translate"
        />
      </div>

      <div className="surface border border-app rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-app font-heading font-semibold text-strong">Projecten ({shown.length})</div>
        {shown.length === 0 ? (
          <div className="p-8 text-center text-muted-fg text-sm">Geen projecten in deze weergave.</div>
        ) : (
          <ul className="divide-y divide-app">
            {shown.map((p) => (
              <li key={p.id} className={`p-4 flex items-center gap-4 ${p.archived ? "opacity-60" : ""}`} data-testid={`cms-project-row-${p.id}`}>
                <img src={p.image_url} alt={p.title} className="w-16 h-16 object-cover rounded-lg" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-strong truncate">{p.title} {p.archived && <span className="ml-2 text-[10px] uppercase tracking-widest text-amber-600">Gearchiveerd</span>}</p>
                  <p className="text-xs text-muted-fg truncate">{p.tag || p.category}</p>
                </div>
                {p.external_url && <a href={p.external_url} target="_blank" rel="noreferrer" className="text-pear-500 text-sm"><ExternalLink className="h-4 w-4" /></a>}
                <button
                  onClick={() => archive(p.id, !p.archived)}
                  className={`text-xs rounded-full px-3 py-1 border ${p.archived ? "border-emerald-300 text-emerald-600 hover:bg-emerald-50" : "border-amber-300 text-amber-600 hover:bg-amber-50"}`}
                  data-testid={`cms-project-archive-${p.id}`}
                >{p.archived ? "Terugplaatsen" : "Archiveren"}</button>
                <button onClick={() => remove(p.id)} className="text-red-500 hover:text-red-600 p-2" data-testid={`cms-project-delete-${p.id}`}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

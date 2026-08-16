import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Save, Plus, Trash2, Edit3, X, ShieldCheck, Server, Globe, DollarSign } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { API } from "./_shared";
import { invalidatePricingCache } from "../../data/pricing";

// Unit whitelist — matches backend `PRICING_UNIT_WHITELIST`
const UNIT_OPTIONS = [
  { value: "eenmalig", label_nl: "eenmalig", label_en: "one-off" },
  { value: "per_maand", label_nl: "per maand", label_en: "per month" },
  { value: "per_uur", label_nl: "per uur", label_en: "per hour" },
  { value: "per_stuk", label_nl: "per stuk", label_en: "per item" },
  { value: "per_taal", label_nl: "per taal", label_en: "per language" },
  { value: "per_machine_maand", label_nl: "per machine · per maand", label_en: "per machine · per month" },
  { value: "per_module", label_nl: "per module", label_en: "per module" },
  { value: "per_20_items", label_nl: "per 20 items", label_en: "per 20 items" },
  { value: "vanaf", label_nl: "vanaf", label_en: "from" },
];

const SERVICE_META = {
  web: { label_nl: "Website", label_en: "Website", icon: Globe, accent: "text-sky-600" },
  ict: { label_nl: "ICT Diensten", label_en: "ICT Services", icon: Server, accent: "text-pear-600" },
  cyber: { label_nl: "Cybersecurity", label_en: "Cybersecurity", icon: ShieldCheck, accent: "text-red-600" },
};

const EMPTY = {
  service: "web",
  cat: "",
  nl: "",
  en: "",
  unit: "eenmalig",
  min_price: 0,
  max_price: 0,
  note_nl: "",
  note_en: "",
  tbd: false,
  included: false,
  order: 100,
  special: null,
  volume_tiers: null,
};

export const PricingAdminTab = ({ en }) => {
  const { authHeader } = useAuth();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeService, setActiveService] = useState("web");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null = form hidden, or a draft object

  const load = async () => {
    setLoading(true);
    try {
      const [adminR, publicR] = await Promise.all([
        axios.get(`${API}/admin/pricing`, { headers: authHeader() }),
        axios.get(`${API}/site/pricing`),
      ]);
      setItems(adminR.data || []);
      setCategories(publicR.data?.categories || []);
    } catch { toast.error(en ? "Load failed" : "Laden mislukt"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const catsForService = useMemo(
    () => categories.filter((c) => c.service === activeService),
    [categories, activeService]
  );
  const itemsForActive = useMemo(
    () => items.filter((it) => it.service === activeService),
    [items, activeService]
  );

  const startNew = (cat = "") => {
    const preset = { ...EMPTY, service: activeService, cat: cat || (catsForService[0]?.key || "") };
    setEditing(preset);
  };
  const startEdit = (item) => setEditing({ ...item });
  const closeEditor = () => setEditing(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!editing.nl?.trim() || !editing.cat) {
      toast.error(en ? "NL label and category are required" : "NL-label en categorie zijn verplicht");
      return;
    }
    // Normalise numbers
    const payload = {
      ...editing,
      min_price: Number(editing.min_price) || 0,
      max_price: Number(editing.max_price) || 0,
      order: Number(editing.order) || 0,
    };
    try {
      if (editing.id) {
        await axios.patch(`${API}/admin/pricing/${editing.id}`, payload, { headers: authHeader() });
        toast.success(en ? "Updated" : "Bijgewerkt");
      } else {
        await axios.post(`${API}/admin/pricing`, payload, { headers: authHeader() });
        toast.success(en ? "Added" : "Toegevoegd");
      }
      invalidatePricingCache(); // public prijslijst + calculator will refetch
      closeEditor();
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || (en ? "Save failed" : "Opslaan mislukt"));
    }
  };

  const remove = async (id, label) => {
    if (!window.confirm(en ? `Delete "${label}"?` : `"${label}" verwijderen?`)) return;
    try {
      await axios.delete(`${API}/admin/pricing/${id}`, { headers: authHeader() });
      toast.success(en ? "Deleted" : "Verwijderd");
      invalidatePricingCache();
      load();
    } catch { toast.error(en ? "Delete failed" : "Verwijderen mislukt"); }
  };

  return (
    <div className="space-y-6" data-testid="cms-pricing-tab">
      {/* Service picker */}
      <div className="flex flex-wrap gap-2" data-testid="cms-pricing-service-picker">
        {Object.entries(SERVICE_META).map(([key, meta]) => {
          const Icon = meta.icon;
          const active = activeService === key;
          const count = items.filter((it) => it.service === key).length;
          return (
            <button
              key={key}
              type="button"
              onClick={() => { setActiveService(key); setEditing(null); }}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold border transition ${
                active
                  ? "bg-pear-500 text-white border-pear-500 shadow"
                  : "surface-2 text-strong border-app hover:border-pear-500 hover:text-pear-500"
              }`}
              data-testid={`cms-pricing-service-${key}`}
            >
              <Icon className="h-4 w-4" />
              {en ? meta.label_en : meta.label_nl}
              <span className={`text-[10px] rounded-full px-2 py-0.5 font-mono ${active ? "bg-white/20" : "surface"}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Editor */}
      {editing ? (
        <form onSubmit={submit} className="surface border border-pear-500/40 rounded-2xl p-6 space-y-4" data-testid="cms-pricing-form">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className="font-heading font-semibold text-strong">
              {editing.id ? (en ? "Edit price item" : "Prijs-item bewerken") : (en ? "New price item" : "Nieuw prijs-item")}
            </h3>
            <button type="button" onClick={closeEditor} className="p-1.5 rounded-lg hover:surface-2" data-testid="cms-pricing-close">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg">{en ? "Service" : "Dienst"}</span>
              <select value={editing.service} onChange={(e) => setEditing({ ...editing, service: e.target.value, cat: "" })} className="mt-1.5 w-full rounded-xl surface-2 px-3 py-2 text-sm outline-none border border-transparent focus:border-pear-500 text-strong" data-testid="cms-pricing-service">
                {Object.entries(SERVICE_META).map(([k, m]) => <option key={k} value={k}>{en ? m.label_en : m.label_nl}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg">{en ? "Category" : "Categorie"}*</span>
              <select required value={editing.cat} onChange={(e) => setEditing({ ...editing, cat: e.target.value })} className="mt-1.5 w-full rounded-xl surface-2 px-3 py-2 text-sm outline-none border border-transparent focus:border-pear-500 text-strong" data-testid="cms-pricing-cat">
                <option value="">— {en ? "select" : "kies"} —</option>
                {categories.filter((c) => c.service === editing.service).map((c) => (
                  <option key={c.key} value={c.key}>{en ? c.en : c.nl}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg">{en ? "Order (asc)" : "Volgorde"}</span>
              <input type="number" value={editing.order} onChange={(e) => setEditing({ ...editing, order: e.target.value })} className="mt-1.5 w-full rounded-xl surface-2 px-3 py-2 text-sm outline-none border border-transparent focus:border-pear-500 text-strong font-mono" data-testid="cms-pricing-order" />
            </label>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg">{en ? "Label (NL)*" : "Label (NL)*"}</span>
              <input required value={editing.nl} onChange={(e) => setEditing({ ...editing, nl: e.target.value })} className="mt-1.5 w-full rounded-xl surface-2 px-3 py-2 text-sm outline-none border border-transparent focus:border-pear-500 text-strong" data-testid="cms-pricing-nl" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg">Label (EN)</span>
              <input value={editing.en || ""} onChange={(e) => setEditing({ ...editing, en: e.target.value })} className="mt-1.5 w-full rounded-xl surface-2 px-3 py-2 text-sm outline-none border border-transparent focus:border-pear-500 text-strong" data-testid="cms-pricing-en" />
            </label>
          </div>

          <div className="grid sm:grid-cols-4 gap-3">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg">{en ? "Unit" : "Eenheid"}</span>
              <select value={editing.unit} onChange={(e) => setEditing({ ...editing, unit: e.target.value })} className="mt-1.5 w-full rounded-xl surface-2 px-3 py-2 text-sm outline-none border border-transparent focus:border-pear-500 text-strong" data-testid="cms-pricing-unit">
                {UNIT_OPTIONS.map((u) => <option key={u.value} value={u.value}>{en ? u.label_en : u.label_nl}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg">Min €</span>
              <input type="number" step="0.01" min="0" value={editing.min_price} onChange={(e) => setEditing({ ...editing, min_price: e.target.value })} className="mt-1.5 w-full rounded-xl surface-2 px-3 py-2 text-sm outline-none border border-transparent focus:border-pear-500 text-strong font-mono" data-testid="cms-pricing-min" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg">Max €</span>
              <input type="number" step="0.01" min="0" value={editing.max_price} onChange={(e) => setEditing({ ...editing, max_price: e.target.value })} className="mt-1.5 w-full rounded-xl surface-2 px-3 py-2 text-sm outline-none border border-transparent focus:border-pear-500 text-strong font-mono" data-testid="cms-pricing-max" />
            </label>
            <div className="flex flex-col justify-end gap-2 pt-1 text-[11px]">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={!!editing.included} onChange={(e) => setEditing({ ...editing, included: e.target.checked })} className="accent-pear-500" data-testid="cms-pricing-included" />
                <span>{en ? "Included" : "Inbegrepen"}</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={!!editing.tbd} onChange={(e) => setEditing({ ...editing, tbd: e.target.checked })} className="accent-pear-500" data-testid="cms-pricing-tbd" />
                <span>TBD / {en ? "n/a" : "n.n.b."}</span>
              </label>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg">{en ? "Note (NL)" : "Notitie (NL)"}</span>
              <input value={editing.note_nl || ""} onChange={(e) => setEditing({ ...editing, note_nl: e.target.value })} className="mt-1.5 w-full rounded-xl surface-2 px-3 py-2 text-sm outline-none border border-transparent focus:border-pear-500 text-strong" data-testid="cms-pricing-note-nl" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg">{en ? "Note (EN)" : "Notitie (EN)"}</span>
              <input value={editing.note_en || ""} onChange={(e) => setEditing({ ...editing, note_en: e.target.value })} className="mt-1.5 w-full rounded-xl surface-2 px-3 py-2 text-sm outline-none border border-transparent focus:border-pear-500 text-strong" data-testid="cms-pricing-note-en" />
            </label>
          </div>

          {/* Volume tiers editor — surfaced when item has volume_tiers or explicit special marker */}
          {(editing.volume_tiers?.length > 0 || editing.special === "cyber_endpoint_agent") && (
            <div className="rounded-xl border border-pear-500/30 surface-2 p-4 space-y-2" data-testid="cms-pricing-volume-editor">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-fg">
                {en ? "Volume discount tiers (per-unit EUR discount)" : "Volumekorting-stappen (EUR per stuk korting)"}
              </p>
              <div className="grid grid-cols-4 gap-2 text-[11px] uppercase tracking-widest text-muted-fg">
                <span>Van #</span><span>T/m #</span><span>−€ / stuk</span><span></span>
              </div>
              {(editing.volume_tiers || []).map((t, i) => (
                <div key={i} className="grid grid-cols-4 gap-2">
                  <input type="number" min="1" value={t.from_qty} onChange={(e) => {
                    const next = [...editing.volume_tiers];
                    next[i] = { ...next[i], from_qty: parseInt(e.target.value, 10) || 1 };
                    setEditing({ ...editing, volume_tiers: next });
                  }} className="rounded-lg surface px-2 py-1.5 text-sm font-mono border border-transparent focus:border-pear-500 outline-none" />
                  <input type="number" value={t.to_qty == null ? "" : t.to_qty} placeholder="∞" onChange={(e) => {
                    const v = e.target.value === "" ? null : parseInt(e.target.value, 10);
                    const next = [...editing.volume_tiers];
                    next[i] = { ...next[i], to_qty: v };
                    setEditing({ ...editing, volume_tiers: next });
                  }} className="rounded-lg surface px-2 py-1.5 text-sm font-mono border border-transparent focus:border-pear-500 outline-none" />
                  <input type="number" step="0.01" min="0" value={t.discount_per_unit} onChange={(e) => {
                    const next = [...editing.volume_tiers];
                    next[i] = { ...next[i], discount_per_unit: parseFloat(e.target.value) || 0 };
                    setEditing({ ...editing, volume_tiers: next });
                  }} className="rounded-lg surface px-2 py-1.5 text-sm font-mono border border-transparent focus:border-pear-500 outline-none" />
                  <button type="button" onClick={() => {
                    setEditing({ ...editing, volume_tiers: editing.volume_tiers.filter((_, ix) => ix !== i) });
                  }} className="text-xs text-red-500 hover:underline">
                    {en ? "remove" : "verwijderen"}
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => {
                const next = [...(editing.volume_tiers || []), { from_qty: 1, to_qty: 9, discount_per_unit: 0 }];
                setEditing({ ...editing, volume_tiers: next });
              }} className="text-xs text-pear-600 hover:underline inline-flex items-center gap-1" data-testid="cms-pricing-volume-add">
                <Plus className="h-3 w-3" /> {en ? "add tier" : "stap toevoegen"}
              </button>
            </div>
          )}

          {!editing.volume_tiers?.length && (
            <button type="button" onClick={() => setEditing({ ...editing, special: "cyber_endpoint_agent", volume_tiers: [{ from_qty: 10, to_qty: 19, discount_per_unit: 0.10 }] })} className="text-xs text-muted-fg hover:text-pear-600 inline-flex items-center gap-1" data-testid="cms-pricing-add-volume">
              <Plus className="h-3 w-3" /> {en ? "Add volume-discount tiers" : "Volumekorting toevoegen"}
            </button>
          )}

          <div className="flex flex-wrap gap-2 pt-3 border-t border-app">
            <button type="submit" className="btn-primary text-sm" data-testid="cms-pricing-submit">
              {editing.id ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {editing.id ? (en ? "Save changes" : "Opslaan") : (en ? "Add" : "Toevoegen")}
            </button>
            <button type="button" onClick={closeEditor} className="btn-secondary text-sm" data-testid="cms-pricing-cancel">
              {en ? "Cancel" : "Annuleren"}
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => startNew()} className="btn-primary text-sm" data-testid="cms-pricing-new">
          <Plus className="h-4 w-4" /> {en ? "New price item" : "Nieuw prijs-item"}
        </button>
      )}

      {/* Grouped list by category */}
      {loading ? (
        <p className="text-sm text-muted-fg">{en ? "Loading…" : "Laden…"}</p>
      ) : (
        <div className="space-y-4">
          {catsForService.map((cat) => {
            const catItems = itemsForActive.filter((it) => it.cat === cat.key);
            return (
              <div key={cat.key} className="surface border border-app rounded-2xl overflow-hidden" data-testid={`cms-pricing-cat-${cat.key}`}>
                <div className="flex items-center justify-between p-3 border-b border-app bg-pear-50/40 dark:bg-pear-500/5">
                  <div>
                    <h4 className="font-heading font-semibold text-strong">{en ? cat.en : cat.nl}</h4>
                    <p className="text-[10px] uppercase tracking-widest text-muted-fg font-mono">{cat.key} · {catItems.length}</p>
                  </div>
                  <button type="button" onClick={() => startNew(cat.key)} className="text-xs px-3 py-1 rounded-full border border-pear-500 text-pear-500 hover:bg-pear-500 hover:text-white" data-testid={`cms-pricing-add-in-${cat.key}`}>
                    + {en ? "add" : "toevoegen"}
                  </button>
                </div>
                {catItems.length === 0 ? (
                  <p className="p-4 text-xs text-muted-fg">{en ? "No items in this category yet." : "Nog geen items in deze categorie."}</p>
                ) : (
                  <ul className="divide-y divide-app">
                    {catItems.map((it) => (
                      <li key={it.id} className="p-3 flex items-start gap-3" data-testid={`cms-pricing-row-${it.id}`}>
                        <DollarSign className="h-4 w-4 text-pear-500 mt-1 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-strong">{it.nl}</p>
                          {it.en && <p className="text-[11px] text-muted-fg">{it.en}</p>}
                          <p className="text-[11px] text-pear-600 font-mono mt-0.5">
                            {it.included ? (en ? "included" : "inbegrepen") : it.tbd ? "TBD" : `€${it.min_price}${it.max_price !== it.min_price ? `–€${it.max_price}` : ""} ${it.unit}`}
                            <span className="text-muted-fg ml-2">#{it.order}</span>
                            {it.volume_tiers?.length > 0 && <span className="ml-2 text-emerald-600">· {it.volume_tiers.length} volume tiers</span>}
                          </p>
                          {it.note_nl && <p className="text-[11px] text-muted-fg mt-0.5 italic">{it.note_nl}</p>}
                        </div>
                        <div className="flex flex-col gap-1 shrink-0">
                          <button type="button" onClick={() => startEdit(it)} className="text-xs px-3 py-1 rounded-full border border-pear-500 text-pear-500 hover:bg-pear-50 dark:hover:bg-pear-500/10 inline-flex items-center gap-1" data-testid={`cms-pricing-edit-${it.id}`}>
                            <Edit3 className="h-3 w-3" /> {en ? "Edit" : "Bewerk"}
                          </button>
                          <button type="button" onClick={() => remove(it.id, it.nl)} className="text-xs px-3 py-1 rounded-full border border-red-300 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 inline-flex items-center gap-1" data-testid={`cms-pricing-delete-${it.id}`}>
                            <Trash2 className="h-3 w-3" /> {en ? "Delete" : "Verwijder"}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

import React, { useMemo, useState } from "react";
import { Check, Trash2 } from "lucide-react";

// -----------------------------------------------------------------------------
// PearBlue avatar library — 30 unique presets:
//   • 10 masculine  (avataaars with short-hair variants)
//   • 10 feminine   (avataaars with long-hair variants)
//   • 10 unisex     (bottts-neutral robot variants)
// Plus a background-color palette so every user can pick a personal look while
// keeping the family palette (pear-blue accents) consistent.
// The final avatar URL is a DiceBear SVG which we store as-is in `profile_picture`.
// -----------------------------------------------------------------------------

const DICEBEAR = "https://api.dicebear.com/9.x";

const MASC_SEEDS = ["arjan", "bram", "cees", "daan", "erik", "finn", "gijs", "hugo", "ivo", "joris"];
const FEM_SEEDS = ["anna", "bea", "carla", "demi", "eva", "fien", "gabi", "hana", "iris", "julia"];
const NEUTRAL_SEEDS = ["pear", "leaf", "sun", "cloud", "wave", "rock", "star", "moon", "spark", "core"];

export const AVATAR_PALETTE = [
  { key: "pear", label: "Pear", hex: "02C0FF" },
  { key: "sky", label: "Sky", hex: "38BDF8" },
  { key: "mint", label: "Mint", hex: "34D399" },
  { key: "amber", label: "Amber", hex: "FBBF24" },
  { key: "rose", label: "Rose", hex: "FB7185" },
  { key: "violet", label: "Violet", hex: "A78BFA" },
  { key: "coral", label: "Coral", hex: "FB923C" },
  { key: "slate", label: "Slate", hex: "94A3B8" },
];

const buildUrl = (style, seed, bg) => {
  const b = bg || "02C0FF";
  const extras = style === "avataaars" ? "&mouth=smile,default,twinkle&eyes=default,happy,side,wink" : "";
  return `${DICEBEAR}/${style}/svg?seed=${encodeURIComponent(seed)}&backgroundColor=${b}${extras}`;
};

/**
 * Build the full 30-avatar library.
 * @param {string} bg — hex color WITHOUT the leading #, e.g. "02C0FF".
 */
export const buildAvatarLibrary = (bg) => ([
  ...MASC_SEEDS.map((s, i) => ({ id: `masc-${i}`, url: buildUrl("avataaars", `${s}-m`, bg), category: "masculine", seed: s })),
  ...FEM_SEEDS.map((s, i) => ({ id: `fem-${i}`, url: buildUrl("avataaars", `${s}-f`, bg), category: "feminine", seed: s })),
  ...NEUTRAL_SEEDS.map((s, i) => ({ id: `neu-${i}`, url: buildUrl("bottts-neutral", s, bg), category: "unisex", seed: s })),
]);

/**
 * AvatarPicker — modal-friendly UI. Wrap with your own modal shell.
 * onSelect(url|null) — null means "clear back to initials".
 */
export const AvatarPicker = ({ currentUrl, onSelect, onCancel }) => {
  const [bg, setBg] = useState(AVATAR_PALETTE[0].hex);
  const [tab, setTab] = useState("all");
  const library = useMemo(() => buildAvatarLibrary(bg), [bg]);
  const filtered = tab === "all" ? library : library.filter((a) => a.category === tab);

  return (
    <div className="space-y-5" data-testid="avatar-picker">
      {/* Colour palette */}
      <div>
        <p className="text-[11px] uppercase tracking-widest text-muted-fg mb-2">Achtergrondkleur</p>
        <div className="flex flex-wrap gap-2" data-testid="avatar-palette">
          {AVATAR_PALETTE.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setBg(p.hex)}
              className={`relative w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${bg === p.hex ? "border-pear-500 ring-2 ring-pear-500/30 scale-110" : "border-white dark:border-slate-800"}`}
              style={{ backgroundColor: `#${p.hex}` }}
              title={p.label}
              aria-label={p.label}
              data-testid={`avatar-palette-${p.key}`}
            >
              {bg === p.hex && <Check className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow" />}
            </button>
          ))}
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-1 border-b border-app" data-testid="avatar-tabs">
        {[
          { key: "all", label: "Alles" },
          { key: "masculine", label: "Mannelijk" },
          { key: "feminine", label: "Vrouwelijk" },
          { key: "unisex", label: "Unisex / robots" },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px ${tab === t.key ? "border-pear-500 text-pear-600" : "border-transparent text-muted-fg hover:text-strong"}`}
            data-testid={`avatar-tab-${t.key}`}
          >{t.label}</button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 gap-3" data-testid="avatar-grid">
        {filtered.map((a) => {
          const isSelected = currentUrl === a.url;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => onSelect(a.url)}
              className={`relative rounded-full aspect-square overflow-hidden border-2 hover:scale-105 transition-transform ${isSelected ? "border-pear-500 ring-2 ring-pear-500/40" : "border-transparent hover:border-pear-300"}`}
              data-testid={`avatar-option-${a.id}`}
              title={`${a.category} · ${a.seed}`}
            >
              <img src={a.url} alt={a.seed} className="w-full h-full" loading="lazy" />
              {isSelected && (
                <span className="absolute bottom-0 right-0 bg-pear-500 text-white rounded-full p-0.5">
                  <Check className="h-3 w-3" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-3 pt-3 border-t border-app">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="text-xs px-3 py-1.5 rounded-full border border-red-200 text-red-500 hover:bg-red-50 inline-flex items-center gap-1"
          data-testid="avatar-reset"
        >
          <Trash2 className="h-3 w-3" /> Terug naar initialen
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-xs px-3 py-1.5 rounded-full border border-app hover:border-pear-500" data-testid="avatar-cancel">
            Sluiten
          </button>
        )}
      </div>
    </div>
  );
};

export default AvatarPicker;

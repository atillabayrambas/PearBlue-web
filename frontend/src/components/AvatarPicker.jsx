import React, { useMemo, useRef, useState } from "react";
import { Check, Trash2, Upload, Camera, Palette as PaletteIcon, X } from "lucide-react";
import { toast } from "sonner";

// -----------------------------------------------------------------------------
// PearBlue avatar library — 40 unique presets:
//   • 10 masculine     (avataaars — short-hair variants)
//   • 10 feminine      (avataaars — long-hair variants)
//   • 10 robots        (bottts-neutral — sci-fi robot look)
//   • 10 subcultures   (avataaars — Gothic / Emo / Artist / Rock / Punk / Skater / Preppy / Vintage / Sporty / Anime)
// Plus an 8-swatch background palette + a Custom colour picker.
// The final avatar URL is a DiceBear SVG we store as-is in `profile_picture`.
// -----------------------------------------------------------------------------

const DICEBEAR = "https://api.dicebear.com/9.x";

const MASC_SEEDS = ["arjan", "bram", "cees", "daan", "erik", "finn", "gijs", "hugo", "ivo", "joris"];
const FEM_SEEDS = ["anna", "bea", "carla", "demi", "eva", "fien", "gabi", "hana", "iris", "julia"];
const ROBOT_SEEDS = ["pear", "leaf", "sun", "cloud", "wave", "rock", "star", "moon", "spark", "core"];
// Subcultures use different DiceBear styles per seed to keep visual diversity while
// avoiding the risky avataaars enum values that can 400 the API.
// Docs: https://www.dicebear.com/styles/
const SUBCULTURES = [
  { seed: "gothic-01", label: "Gothic", style: "adventurer" },
  { seed: "emo-04", label: "Emo", style: "adventurer" },
  { seed: "artist-11", label: "Artist", style: "micah" },
  { seed: "rocker-17", label: "Rocker", style: "adventurer" },
  { seed: "punk-22", label: "Punk", style: "adventurer" },
  { seed: "skater-28", label: "Skater", style: "micah" },
  { seed: "preppy-32", label: "Preppy", style: "micah" },
  { seed: "vintage-40", label: "Vintage", style: "micah" },
  { seed: "sporty-45", label: "Sporty", style: "adventurer" },
  { seed: "anime-51", label: "Anime", style: "big-smile" },
];

export const AVATAR_PALETTE = [
  { key: "pear", label: "Pear blue", hex: "02C0FF" },
  { key: "mint", label: "Mint", hex: "34D399" },
  { key: "amber", label: "Amber", hex: "FBBF24" },
  { key: "rose", label: "Rose", hex: "FB7185" },
  { key: "violet", label: "Violet", hex: "A78BFA" },
  { key: "coral", label: "Coral", hex: "FB923C" },
  { key: "slate", label: "Slate", hex: "94A3B8" },
  { key: "midnight", label: "Midnight", hex: "0A192F" },
];

const buildUrl = (style, seed, bg, extras = "") => {
  const b = bg || "02C0FF";
  const baseExtras = style === "avataaars" ? "&mouth=smile,default,twinkle&eyes=default,happy,side,wink" : "";
  return `${DICEBEAR}/${style}/svg?seed=${encodeURIComponent(seed)}&backgroundColor=${b}${baseExtras}${extras ? "&" + extras : ""}`;
};

/**
 * Build the full 40-avatar library.
 * @param {string} bg — hex color WITHOUT the leading #, e.g. "02C0FF".
 */
export const buildAvatarLibrary = (bg) => ([
  ...MASC_SEEDS.map((s, i) => ({ id: `masc-${i}`, url: buildUrl("avataaars", `${s}-m`, bg), category: "masculine", seed: s })),
  ...FEM_SEEDS.map((s, i) => ({ id: `fem-${i}`, url: buildUrl("avataaars", `${s}-f`, bg), category: "feminine", seed: s })),
  ...SUBCULTURES.map((sc, i) => ({ id: `sub-${i}`, url: buildUrl(sc.style, sc.seed, bg), category: "subculture", seed: sc.label })),
  ...ROBOT_SEEDS.map((s, i) => ({ id: `bot-${i}`, url: buildUrl("bottts-neutral", s, bg), category: "robots", seed: s })),
]);

/**
 * AvatarPicker — modal-friendly UI.
 * Props:
 *   currentUrl:        currently selected profile picture URL / dataURL.
 *   onSelect(url|null): pick or clear (null = back to initials).
 *   onCancel:          close the picker without changing.
 */
export const AvatarPicker = ({ currentUrl, onSelect, onCancel }) => {
  const [bg, setBg] = useState(AVATAR_PALETTE[0].hex);
  const [customHex, setCustomHex] = useState("00A9E0");
  const [tab, setTab] = useState("all");
  const [webcamOpen, setWebcamOpen] = useState(false);
  const fileInput = useRef(null);
  const library = useMemo(() => buildAvatarLibrary(bg), [bg]);
  const filtered = tab === "all" ? library : library.filter((a) => a.category === tab);

  const applyCustom = () => {
    const hex = customHex.replace("#", "").trim().toUpperCase();
    if (!/^[0-9A-F]{6}$/.test(hex)) { toast.error("Ongeldige hex-kleur (bijv. 02C0FF)"); return; }
    setBg(hex);
  };

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) { toast.error("Kies een afbeelding"); return; }
    if (f.size > 3 * 1024 * 1024) { toast.error("Max 3 MB"); return; }
    const reader = new FileReader();
    reader.onload = (ev) => onSelect(ev.target.result);
    reader.readAsDataURL(f);
  };

  return (
    <div className="space-y-5" data-testid="avatar-picker">
      {/* Upload / webcam / palette row */}
      <div className="flex flex-wrap gap-2" data-testid="avatar-picker-actions">
        <button type="button" onClick={() => fileInput.current?.click()} className="text-xs inline-flex items-center gap-1.5 rounded-full border border-app px-3 py-1.5 hover:border-pear-500" data-testid="avatar-upload">
          <Upload className="h-3.5 w-3.5" /> Upload foto
        </button>
        <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={onFile} data-testid="avatar-file-input" />
        <button type="button" onClick={() => setWebcamOpen(true)} className="text-xs inline-flex items-center gap-1.5 rounded-full border border-app px-3 py-1.5 hover:border-pear-500" data-testid="avatar-webcam-open">
          <Camera className="h-3.5 w-3.5" /> Foto met webcam
        </button>
      </div>

      {/* Palette */}
      <div>
        <p className="text-[11px] uppercase tracking-widest text-muted-fg mb-2">Achtergrondkleur</p>
        <div className="flex flex-wrap items-center gap-2" data-testid="avatar-palette">
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
          {/* Custom color chip */}
          <div className="inline-flex items-center gap-1 pl-2 border-l border-app ml-1">
            <label htmlFor="avatar-custom-color" className="cursor-pointer inline-flex items-center gap-1 text-xs text-muted-fg hover:text-strong" data-testid="avatar-custom-label">
              <PaletteIcon className="h-3.5 w-3.5" /> Custom
            </label>
            <input
              id="avatar-custom-color"
              type="color"
              value={`#${customHex}`}
              onChange={(e) => setCustomHex(e.target.value.replace("#", "").toUpperCase())}
              className="w-8 h-8 rounded-full overflow-hidden cursor-pointer border border-app bg-transparent"
              data-testid="avatar-custom-color"
            />
            <input
              type="text"
              value={customHex}
              onChange={(e) => setCustomHex(e.target.value.replace("#", "").toUpperCase().slice(0, 6))}
              placeholder="02C0FF"
              className="w-20 rounded-lg border border-app surface-2 px-2 py-1 text-xs font-mono"
              data-testid="avatar-custom-hex"
            />
            <button type="button" onClick={applyCustom} className="text-[10px] uppercase tracking-widest rounded-full border border-app px-2 py-1 hover:border-pear-500" data-testid="avatar-custom-apply">Toepassen</button>
          </div>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-1 border-b border-app" data-testid="avatar-tabs">
        {[
          { key: "all", label: "Alles" },
          { key: "masculine", label: "Mannelijk" },
          { key: "feminine", label: "Vrouwelijk" },
          { key: "subculture", label: "Subculturen" },
          { key: "robots", label: "Robots" },
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

      {webcamOpen && (
        <WebcamCapture onCapture={(dataUrl) => { setWebcamOpen(false); onSelect(dataUrl); }} onClose={() => setWebcamOpen(false)} />
      )}
    </div>
  );
};

// -----------------------------------------------------------------------------
// WebcamCapture — inline getUserMedia + canvas snapshot → dataURL
// -----------------------------------------------------------------------------
function WebcamCapture({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);

  React.useEffect(() => {
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 640, height: 640 }, audio: false });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => setReady(true);
        }
      } catch (e) {
        setError(e?.message || "Geen toegang tot webcam");
      }
    })();
    return () => { streamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, []);

  const snap = () => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c) return;
    const size = 512;
    c.width = size; c.height = size;
    const ctx = c.getContext("2d");
    // Crop to square from center
    const min = Math.min(v.videoWidth, v.videoHeight);
    const sx = (v.videoWidth - min) / 2;
    const sy = (v.videoHeight - min) / 2;
    ctx.drawImage(v, sx, sy, min, min, 0, 0, size, size);
    setPreview(c.toDataURL("image/jpeg", 0.85));
  };

  const confirm = () => { if (preview) onCapture(preview); };

  return (
    <div className="pb-modal" style={{ zIndex: 100 }} onClick={onClose} data-testid="webcam-modal">
      <div className="pb-modal-card w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <header className="px-6 py-4 border-b border-app flex items-center justify-between shrink-0 surface">
          <div className="font-heading text-lg font-semibold text-strong">Webcam foto</div>
          <button onClick={onClose} className="text-2xl leading-none text-muted-fg hover:text-strong" data-testid="webcam-close"><X className="h-5 w-5" /></button>
        </header>
        <div className="pb-modal-body p-6 surface flex flex-col items-center gap-4">
          {error ? (
            <p className="text-sm text-red-500 text-center">{error}</p>
          ) : (
            <>
              <div className="relative w-64 h-64 rounded-full overflow-hidden bg-black">
                {preview ? (
                  <img src={preview} alt="preview" className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" data-testid="webcam-video" />
                )}
              </div>
              <canvas ref={canvasRef} className="hidden" />
              {preview ? (
                <div className="flex gap-2">
                  <button onClick={() => setPreview(null)} className="text-xs rounded-full border border-app px-3 py-1.5 hover:border-pear-500" data-testid="webcam-retake">Opnieuw</button>
                  <button onClick={confirm} className="btn-primary text-xs" data-testid="webcam-confirm">Gebruik deze foto</button>
                </div>
              ) : (
                <button disabled={!ready} onClick={snap} className="btn-primary disabled:opacity-50" data-testid="webcam-snap">
                  <Camera className="h-4 w-4" /> Foto maken
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default AvatarPicker;

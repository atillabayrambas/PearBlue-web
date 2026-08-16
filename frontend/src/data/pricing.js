// Central pricing catalog — fetched from GET /api/site/pricing (which the CMS
// edits via /api/admin/pricing). The static arrays below act as bundled
// fallback for the first paint before the API responds and for offline dev.
//
// Unit types: "eenmalig" (one-off), "per_maand" (monthly), "per_uur" (hourly),
// "per_stuk" (per item), "per_taal" (per language), "per_machine_maand"
// (per machine/month), "per_module" (per module), "per_20_items", "vanaf".
//
// Calculator note: for wide ranges (e.g. €300–2000) we return a "smart
// average" that biases toward realistic sub-average projects so totals aren't
// inflated. Cyber-endpoint items with `special === "cyber_endpoint_agent"`
// pull an extra machine-count input and apply their `volume_tiers` in the
// calculator via `applyVolumeDiscount()`.

import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// ---------- Static fallback (matches the seed order used by the backend) ----
// Keeping this in the bundle lets the /prijslijst page render instantly on
// first paint even if the /site/pricing call is slow. Once the API resolves
// `usePricingCatalog()` swaps to the live data.
export const FALLBACK_CATEGORIES = [
  { key: "project", service: "web", nl: "Projectoverzicht", en: "Project overview", order: 10 },
  { key: "website", service: "web", nl: "Pakket & Pagina's", en: "Package & Pages", order: 20 },
  { key: "advanced", service: "web", nl: "Geavanceerde functies", en: "Advanced features", order: 30 },
  { key: "upload", service: "web", nl: "Upload & CMS", en: "Upload & CMS", order: 40 },
  { key: "ecom", service: "web", nl: "E-commerce modules", en: "E-commerce modules", order: 50 },
  { key: "integrations", service: "web", nl: "Integraties & Training", en: "Integrations & Training", order: 60 },
  { key: "ict_infra", service: "ict", nl: "Infrastructuur & Server", en: "Infrastructure & Server", order: 10 },
  { key: "ict_network", service: "ict", nl: "Netwerk", en: "Network", order: 20 },
  { key: "ict_cloud", service: "ict", nl: "Cloud & Storage", en: "Cloud & Storage", order: 30 },
  { key: "ict_backup", service: "ict", nl: "Backup", en: "Backup", order: 40 },
  { key: "ict_finance", service: "ict", nl: "Boekhouding & Kassa", en: "Finance & POS", order: 50 },
  { key: "ict_support", service: "ict", nl: "Nazorg, SLA & Consultancy", en: "Support, SLA & Consultancy", order: 60 },
  { key: "cybersecurity", service: "cyber", nl: "Website-bescherming", en: "Website protection", order: 10 },
  { key: "cyber_endpoint", service: "cyber", nl: "Endpoint bescherming (Bitdefender GravityZone)", en: "Endpoint protection (Bitdefender GravityZone)", order: 20 },
  { key: "cyber_services", service: "cyber", nl: "Cybersecurity — services & onboarding", en: "Cybersecurity — services & onboarding", order: 30 },
];

// Empty fallback — the API is the source of truth. Keeps the tables blank
// (with a spinner) if the API is unreachable rather than showing stale data.
export const FALLBACK_ITEMS = [];

// ---------- Public API used by pages ------------------------------------------------
export const CATEGORIES = FALLBACK_CATEGORIES; // legacy re-export (kept for compat)
export const PRICING = FALLBACK_ITEMS;         // legacy re-export

// Category → service group
export const SERVICE_OF_CAT = FALLBACK_CATEGORIES.reduce((m, c) => { m[c.key] = c.service; return m; }, {});

export const SERVICES = [
  { key: "web", nl: "Website & Media", en: "Website & Media" },
  { key: "ict", nl: "ICT-diensten", en: "ICT services" },
  { key: "cyber", nl: "Cybersecurity", en: "Cybersecurity" },
];

// Human-readable unit label used everywhere.
export const UNIT_LABEL = {
  eenmalig: { nl: "eenmalig", en: "one-off" },
  per_maand: { nl: "per maand", en: "per month" },
  per_uur: { nl: "per uur", en: "per hour" },
  per_stuk: { nl: "per stuk", en: "per item" },
  per_taal: { nl: "per taal", en: "per language" },
  per_machine_maand: { nl: "per machine · per maand", en: "per machine · per month" },
  per_module: { nl: "per module", en: "per module" },
  per_20_items: { nl: "per 20 items", en: "per 20 items" },
  vanaf: { nl: "vanaf", en: "from" },
};

// Smart-average biased toward sub-average projects so wide ranges don't scare users.
export const smartAverage = (min, max) => {
  min = Number(min) || 0;
  max = Number(max) || 0;
  if (min === max) return min;
  const gap = max - min;
  if (gap >= 500) return Math.round(min + gap * 0.22);
  return Math.round((min + max) / 2);
};

// Volume discount lookup for `special === "cyber_endpoint_agent"`.
// Returns the per-unit EUR discount to subtract from base for a given qty.
export const volumeDiscountFor = (item, qty) => {
  const tiers = item?.volume_tiers || [];
  if (!qty || tiers.length === 0) return 0;
  let bestDiscount = 0;
  for (const t of tiers) {
    const from = Number(t.from_qty || 0);
    const to = t.to_qty == null ? Number.POSITIVE_INFINITY : Number(t.to_qty);
    if (qty >= from && qty <= to && (t.discount_per_unit || 0) > bestDiscount) {
      bestDiscount = t.discount_per_unit;
    }
  }
  return bestDiscount;
};

// Given `qty` and a pricing item, return the effective per-unit price
// (base − volume-discount, floored at 0). Only meaningful for the machine
// item; other items just return `base`.
export const effectiveUnitPrice = (item, qty) => {
  const base = item?.included ? 0 : smartAverage(item?.min_price ?? item?.min, item?.max_price ?? item?.max);
  const discount = volumeDiscountFor(item, qty);
  return Math.max(0, base - discount);
};

// Format helper for tables. `item` shape may include either min/max (legacy)
// or min_price/max_price (API); we normalise here.
export const priceLabel = (item, lang = "nl") => {
  const mn = item.min_price ?? item.min ?? 0;
  const mx = item.max_price ?? item.max ?? 0;
  if (item.tbd) return lang === "en" ? "TBD" : "n.n.b.";
  if (item.included) return lang === "en" ? "included" : "inbegrepen";
  const unit = UNIT_LABEL[item.unit]?.[lang] || item.unit;
  if (mn === mx) return `€${mn} ${unit}`;
  return `€${mn} – €${mx} ${unit}`;
};

// ---------- Live catalog (fetched once, cached — but only when non-empty) ------------
let _cache = null;

/** Fetches the pricing catalog from the API. Returns {categories, items}.
 *  Never caches an empty items array — that way if the initial fetch fails or
 *  the API is momentarily unreachable, the next call will retry instead of
 *  serving a stale "empty" catalog for the rest of the SPA session. */
export const loadPricingCatalog = async () => {
  if (_cache && _cache.items && _cache.items.length > 0) return _cache;
  try {
    const r = await axios.get(`${API}/site/pricing`);
    const next = {
      categories: r.data?.categories || FALLBACK_CATEGORIES,
      items: r.data?.items || FALLBACK_ITEMS,
    };
    if (next.items.length > 0) _cache = next;
    return next;
  } catch {
    return { categories: FALLBACK_CATEGORIES, items: FALLBACK_ITEMS };
  }
};

/** Bust the cache — used by the CMS after edits so the public site picks up
 *  changes without a full page reload. */
export const invalidatePricingCache = () => { _cache = null; };

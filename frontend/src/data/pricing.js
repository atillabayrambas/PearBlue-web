// Central pricing catalog — sourced from Website_Offerte_Intelligent_vFinal3.xlsx
// Unit types: "eenmalig" (one-off), "per_maand" (monthly), "per_uur" (hourly),
// "per_stuk" (per item), "per_taal" (per language), "per_machine_maand" (per machine/month),
// "per_module" (per module), "per_20_items" (per batch of 20).
//
// Calculator note: for wide ranges (e.g. €300–2000) we return a "smart average" that
// biases toward realistic sub-average projects so totals aren't inflated.

export const CATEGORIES = [
  { key: "project", nl: "Projectoverzicht", en: "Project overview" },
  { key: "website", nl: "Pakket & Pagina's", en: "Package & Pages" },
  { key: "advanced", nl: "Geavanceerde functies", en: "Advanced features" },
  { key: "upload", nl: "Upload & CMS", en: "Upload & CMS" },
  { key: "ecom", nl: "E-commerce modules", en: "E-commerce modules" },
  { key: "integrations", nl: "Integraties & Training", en: "Integrations & Training" },
  { key: "ict", nl: "ICT-diensten", en: "ICT services" },
  { key: "cybersecurity", nl: "Cybersecurity", en: "Cybersecurity" },
];

// Human-readable unit label (used in tables + calculator)
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

// Smart average helper — used by calculator.
// Rule per user brief:
//  • range < €100 gap  → arithmetic mean
//  • range ≥ €500 gap  → biased toward the lower quarter (e.g. 250–2500 → ~400)
//  • otherwise         → arithmetic mean
export const smartAverage = (min, max) => {
  if (min === max) return min;
  const gap = max - min;
  if (gap >= 500) {
    // low-side biased so wide ranges don't scare users
    return Math.round(min + gap * 0.22);
  }
  return Math.round((min + max) / 2);
};

// Full item catalog. tbd:true means "prices to be provided by client".
export const PRICING = [
  // ---------- Projectoverzicht ----------
  { cat: "project", id: "goals", nl: "Verkopen, leads, afspraken", en: "Sales, leads, appointments", unit: "eenmalig", min: 50, max: 50, note_nl: "Doel-instelling & KPI-tracking", note_en: "Goal setup & KPI tracking" },
  { cat: "project", id: "revisies", nl: "5 revisies totaal (1e 2 voor testfase, laatste 3 voor verbeteringen)", en: "5 revisions total (first 2 test, last 3 refinements)", unit: "eenmalig", min: 0, max: 0, included: true, note_nl: "Inbegrepen bij elk pakket", note_en: "Included with every package" },

  // ---------- Website / pakket & pagina's ----------
  { cat: "website", id: "basis-5p", nl: "Basis Pakket — 5 pagina's (Home, Over ons, Diensten, Portfolio, Contact)", en: "Basic Package — 5 pages (Home, About, Services, Portfolio, Contact)", unit: "eenmalig", min: 200, max: 200, note_nl: "Vanaf-prijs", note_en: "Starting price" },
  { cat: "website", id: "wettelijk", nl: "Wettelijke pagina's (Algemene voorwaarden, Privacy, Cookies)", en: "Legal pages (T&C, Privacy, Cookies)", unit: "eenmalig", min: 0, max: 0, included: true, note_nl: "Verplicht — inbegrepen", note_en: "Mandatory — included" },
  { cat: "website", id: "extra-pagina", nl: "Elke extra pagina (na de eerste 5)", en: "Each extra page (after the first 5)", unit: "per_stuk", min: 50, max: 50 },
  { cat: "website", id: "detail-struct", nl: "Product-/dienstdetail paginastructuur", en: "Product/service detail page structure", unit: "eenmalig", min: 100, max: 200 },
  { cat: "website", id: "theme-manual", nl: "Handmatige thema-switcher (donker/licht)", en: "Manual dark/light theme switcher", unit: "eenmalig", min: 50, max: 50 },
  { cat: "website", id: "theme-auto", nl: "Automatisch systeemthema volgen", en: "Auto system-theme follow", unit: "eenmalig", min: 10, max: 10 },
  { cat: "website", id: "taal", nl: "Extra taal (meertaligheid)", en: "Extra language", unit: "per_taal", min: 50, max: 50 },

  // ---------- Geavanceerde functies ----------
  { cat: "advanced", id: "ai-chat", nl: "AI Chat + Agent-overname (Claude API)", en: "AI Chat + Agent takeover (Claude API)", unit: "eenmalig", min: 100, max: 100 },
  { cat: "advanced", id: "ai-mail-sync", nl: "AI Mail & Support-ticket sync via nummer", en: "AI Mail & Support-ticket sync via number", unit: "eenmalig", min: 150, max: 150 },
  { cat: "advanced", id: "ai-dashboard", nl: "AI Dashboard modules (analytics per module)", en: "AI Dashboard modules (analytics per module)", unit: "per_module", min: 20, max: 20 },
  { cat: "advanced", id: "feedback-sys", nl: "Klant-feedbacksysteem", en: "Client feedback system", unit: "eenmalig", min: 30, max: 30 },

  // ---------- Upload & CMS ----------
  { cat: "upload", id: "cms-products", nl: "Zelf producten toevoegen via CMS", en: "Add products yourself via CMS", unit: "eenmalig", min: 20, max: 20 },
  { cat: "upload", id: "cms-portfolio", nl: "Zelf portfolio-werk uploaden via CMS", en: "Upload portfolio work via CMS", unit: "eenmalig", min: 20, max: 20 },
  { cat: "upload", id: "cms-blog", nl: "Zelf artikelen plaatsen via CMS", en: "Post articles via CMS", unit: "eenmalig", min: 20, max: 20 },
  { cat: "upload", id: "manual-upload", nl: "Invoer door ons (per 20 items)", en: "Data entry by us (per 20 items)", unit: "per_20_items", min: 100, max: 200 },

  // ---------- E-commerce modules ----------
  { cat: "ecom", id: "shop", nl: "Winkel-setup (mandje & checkout)", en: "Shop setup (cart & checkout)", unit: "eenmalig", min: 300, max: 2000, note_nl: "Afhankelijk van complexiteit", note_en: "Depends on complexity" },
  { cat: "ecom", id: "shipping", nl: "Adressen & verzending (Std incl. / uitgebreid)", en: "Addresses & shipping (Std incl. / extended)", unit: "eenmalig", min: 10, max: 150 },
  { cat: "ecom", id: "pay-int", nl: "Betaalintegratie (iDEAL, Stripe)", en: "Payment integration (iDEAL, Stripe)", unit: "eenmalig", min: 30, max: 30 },
  { cat: "ecom", id: "colors", nl: "Product-kleurvariaties", en: "Product color variations", unit: "eenmalig", min: 20, max: 20 },
  { cat: "ecom", id: "sizes", nl: "Product-maatvariaties", en: "Product size variations", unit: "eenmalig", min: 20, max: 20 },
  { cat: "ecom", id: "photo-sync", nl: "Gekoppelde productfoto's (sync kleur/maat)", en: "Linked product photos (sync color/size)", unit: "eenmalig", min: 60, max: 60 },
  { cat: "ecom", id: "product-calc", nl: "Product-calculator (configurator)", en: "Product calculator (configurator)", unit: "eenmalig", min: 50, max: 50 },

  // ---------- Integraties & Training ----------
  { cat: "integrations", id: "reviews-int", nl: "Reviews-koppeling (Google, Trustpilot, …)", en: "Reviews integration (Google, Trustpilot, …)", unit: "per_stuk", min: 30, max: 30 },
  { cat: "integrations", id: "custom-scripts", nl: "Custom scripts (header/footer)", en: "Custom scripts (header/footer)", unit: "eenmalig", min: 20, max: 20 },
  { cat: "integrations", id: "analytics-mod", nl: "Analytics-koppeling per module", en: "Analytics integration per module", unit: "per_stuk", min: 5, max: 5 },
  { cat: "integrations", id: "crm-pro", nl: "CRM-koppeling Pro (Zoho, HubSpot, …)", en: "CRM integration Pro (Zoho, HubSpot, …)", unit: "vanaf", min: 75, max: 75 },
  { cat: "integrations", id: "training-cms", nl: "Gebruikerstraining CMS", en: "User training CMS", unit: "per_uur", min: 80, max: 80 },
  { cat: "integrations", id: "training-crm", nl: "Training Zoho/CRM", en: "Training Zoho/CRM", unit: "per_uur", min: 80, max: 80 },

  // ---------- ICT services (prices TBD by user) ----------
  { cat: "ict", id: "ict-tbd", nl: "ICT-diensten (netwerk, cloud, beheer, MFA, devices)", en: "ICT services (network, cloud, mgmt, MFA, devices)", unit: "eenmalig", tbd: true, note_nl: "Prijzen worden binnenkort gepubliceerd", note_en: "Prices to be published soon" },

  // ---------- Cybersecurity ----------
  { cat: "cybersecurity", id: "cyber-block", nl: "Website IP-block & DDOS-protectie op formulieren/chat", en: "Website IP-block & DDOS protection on forms/chat", unit: "eenmalig", min: 50, max: 50 },
  { cat: "cybersecurity", id: "cyber-endpoint", nl: "Bitdefender GravityZone endpoint bescherming", en: "Bitdefender GravityZone endpoint protection", unit: "per_machine_maand", min: 5, max: 5, note_nl: "Per machine per maand", note_en: "Per machine per month" },
  { cat: "cybersecurity", id: "cyber-mgmt-tbd", nl: "Managed cybersecurity (SOC, EDR-response)", en: "Managed cybersecurity (SOC, EDR response)", unit: "per_maand", tbd: true, note_nl: "Prijzen worden binnenkort gepubliceerd", note_en: "Prices to be published soon" },
];

// Category → service group
export const SERVICE_OF_CAT = {
  project: "web",
  website: "web",
  advanced: "web",
  upload: "web",
  ecom: "web",
  integrations: "web",
  ict: "ict",
  cybersecurity: "cyber",
};

export const SERVICES = [
  { key: "web", nl: "Website & Media", en: "Website & Media" },
  { key: "ict", nl: "ICT-diensten", en: "ICT services" },
  { key: "cyber", nl: "Cybersecurity", en: "Cybersecurity" },
];

// Convenience selector
export const itemsByCat = (catKey) => PRICING.filter((p) => p.cat === catKey);

// Format helper
export const priceLabel = (item, lang = "nl") => {
  if (item.tbd) return lang === "en" ? "TBD" : "n.n.b.";
  if (item.included) return lang === "en" ? "included" : "inbegrepen";
  const unit = UNIT_LABEL[item.unit]?.[lang] || item.unit;
  if (item.min === item.max) return `€${item.min} ${unit}`;
  return `€${item.min} – €${item.max} ${unit}`;
};

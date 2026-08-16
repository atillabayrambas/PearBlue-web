import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Save, Plus, Trash2, ArrowUp, ArrowDown, CheckCircle2, Target, Sparkles } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { useLang } from "../../i18n/LanguageContext";
import { API } from "./_shared";
import { ROADMAP_ICON_NAMES, iconFromName } from "../../data/roadmapIcons";
import { PricingAdminTab } from "./PricingAdminTab";

export const SettingsAdmin = () => {
  const { authHeader } = useAuth();
  const { lang } = useLang();
  const en = lang === "en";
  const [form, setForm] = useState({
    ga4_measurement_id: "",
    search_console_verification: "",
    hero_headline_nl: "",
    hero_headline_en: "",
    site_status: "live",
    site_status_lang: "auto",
    maintenance_bg_mode: "dynamic",
    maintenance_bg_url: "",
    ai_translate_limit_per_minute: 30,
  });
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("general");
  const [instantMsg, setInstantMsg] = useState("");
  const loadedRef = useRef(false);

  useEffect(() => {
    axios.get(`${API}/settings`).then((r) => {
      setForm((prev) => ({ ...prev, ...(r.data || {}) }));
      loadedRef.current = true;
    }).catch(() => { loadedRef.current = true; });
  }, []);

  const change = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  // Instant-save helper for the Engineering controls — no need to click Save.
  const patch = async (partial) => {
    setForm((f) => ({ ...f, ...partial }));
    if (!loadedRef.current) return;
    try {
      await axios.put(`${API}/settings`, partial, { headers: authHeader() });
      setInstantMsg(en ? "Saved" : "Opgeslagen");
      setTimeout(() => setInstantMsg(""), 1400);
    } catch {
      toast.error(en ? "Save failed" : "Opslaan mislukt");
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await axios.put(`${API}/settings`, form, { headers: authHeader() });
      toast.success(en ? "Settings saved" : "Instellingen opgeslagen");
    } catch { toast.error(en ? "Save failed" : "Opslaan mislukt"); } finally { setSaving(false); }
  };

  const previewUrl = (mode) => `/?preview=${mode}`;

  return (
    <div data-testid="cms-settings">
      <header className="mb-6">
        <h1 className="font-heading text-3xl font-medium text-strong">{en ? "Site settings" : "Site instellingen"}</h1>
        <p className="text-sm text-muted-fg mt-1">{en ? "Analytics, Search Console, hero copy and Engineering tools." : "Analytics, Search Console, hero-tekst en Engineering-tools."}</p>
      </header>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-app mb-6" data-testid="cms-settings-tabs">
        {[
          { key: "general", label: en ? "General" : "Algemeen" },
          { key: "pricing", label: en ? "Pricing" : "Prijslijst" },
          { key: "roadmap", label: en ? "Roadmap" : "Roadmap" },
          { key: "engineering", label: en ? "Engineering" : "Engineering" },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${tab === t.key ? "border-pear-500 text-pear-600" : "border-transparent text-muted-fg hover:text-strong"}`}
            data-testid={`cms-settings-tab-${t.key}`}
          >{t.label}</button>
        ))}
      </div>

      {tab === "pricing" && <PricingAdminTab en={en} />}
      {tab === "roadmap" && <RoadmapAdminTab en={en} />}

      {tab === "general" && (
        <form onSubmit={save} className="surface border border-app rounded-2xl p-6 space-y-5 max-w-2xl" data-testid="cms-settings-form">
          <div>
            <h3 className="font-heading font-semibold text-strong mb-3">Google Analytics 4</h3>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg">Measurement ID (G-XXXXXXX)</span>
              <input value={form.ga4_measurement_id || ""} onChange={change("ga4_measurement_id")} placeholder="G-XXXXXXXXXX" data-testid="cms-input-ga4"
                className="mt-1.5 w-full rounded-xl surface-2 border border-transparent focus:border-pear-500 focus:ring-2 focus:ring-pear-500/20 px-4 py-2.5 text-sm outline-none text-strong font-mono" />
            </label>
            <p className="text-xs text-muted-fg mt-2">{en ? "Find your Measurement ID in Google Analytics → Admin → Data streams → Web." : "Vind je Measurement ID in Google Analytics → Beheerder → Datastreams → Web."}</p>
          </div>

          <div className="pt-4 border-t border-app">
            <h3 className="font-heading font-semibold text-strong mb-3">Google Search Console</h3>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg">{en ? "Verification code (content value)" : "Verificatie code (content-waarde)"}</span>
              <input value={form.search_console_verification || ""} onChange={change("search_console_verification")} placeholder="abcdef123456..." data-testid="cms-input-search-console"
                className="mt-1.5 w-full rounded-xl surface-2 border border-transparent focus:border-pear-500 focus:ring-2 focus:ring-pear-500/20 px-4 py-2.5 text-sm outline-none text-strong font-mono" />
            </label>
          </div>

          <div className="pt-4 border-t border-app">
            <h3 className="font-heading font-semibold text-strong mb-3">{en ? "Hero text (optional)" : "Hero-tekst (optioneel)"}</h3>
            <label className="block mb-3">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg">{en ? "NL headline (empty = default)" : "NL headline (leeg = standaard)"}</span>
              <input value={form.hero_headline_nl || ""} onChange={change("hero_headline_nl")} data-testid="cms-input-hero-nl"
                className="mt-1.5 w-full rounded-xl surface-2 border border-transparent focus:border-pear-500 focus:ring-2 focus:ring-pear-500/20 px-4 py-2.5 text-sm outline-none text-strong" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg">{en ? "EN headline (empty = default)" : "EN headline (leeg = standaard)"}</span>
              <input value={form.hero_headline_en || ""} onChange={change("hero_headline_en")} data-testid="cms-input-hero-en"
                className="mt-1.5 w-full rounded-xl surface-2 border border-transparent focus:border-pear-500 focus:ring-2 focus:ring-pear-500/20 px-4 py-2.5 text-sm outline-none text-strong" />
            </label>
          </div>

          <button type="submit" disabled={saving} className="btn-primary" data-testid="cms-settings-submit">
            {saving ? "…" : <><Save className="h-4 w-4" /> {en ? "Save" : "Opslaan"}</>}
          </button>
        </form>
      )}

      {tab === "engineering" && (
        <div className="surface border border-app rounded-2xl p-6 space-y-6 max-w-3xl" data-testid="cms-settings-engineering">
          <div className="rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 p-4">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200 flex items-center gap-2">🚧 {en ? "Site status" : "Site-status"}</p>
            <p className="text-xs text-amber-700 dark:text-amber-300/80 mt-1">
              {en
                ? "Choose what public visitors see. Any signed-in admin (with an admin token in this browser) always keeps normal access."
                : "Kies wat publieke bezoekers zien. Iedere ingelogde beheerder (met admin-token in deze browser) blijft altijd normaal toegang houden."}
            </p>
          </div>

          {/* Mode segmented control — auto-saves */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-fg mb-2">{en ? "Mode" : "Modus"}</p>
            <div className="inline-flex rounded-full border border-app p-1 surface-2" data-testid="cms-site-status-group">
              {[
                { key: "live", label: en ? "Live" : "Live", tid: "cms-site-status-live" },
                { key: "maintenance", label: en ? "Maintenance" : "Onderhoud", tid: "cms-site-status-maintenance" },
                { key: "coming_soon", label: en ? "Coming soon" : "Binnenkort", tid: "cms-site-status-coming_soon" },
              ].map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => patch({ site_status: s.key })}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-full transition ${form.site_status === s.key ? (s.key === "live" ? "bg-emerald-500 text-white shadow" : s.key === "maintenance" ? "bg-amber-500 text-white shadow" : "bg-violet-500 text-white shadow") : "text-muted-fg hover:text-strong"}`}
                  data-testid={s.tid}
                >{s.label}</button>
              ))}
            </div>
            {instantMsg && <span className="ml-3 text-xs text-emerald-500" data-testid="cms-instant-saved">✓ {instantMsg}</span>}
          </div>

          {/* Language segmented control */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-fg mb-2">{en ? "Language on splash" : "Taal op splashpagina"}</p>
            <div className="inline-flex rounded-full border border-app p-1 surface-2" data-testid="cms-site-lang-group">
              {[
                { key: "auto", label: en ? "Auto (browser)" : "Auto (browser)" },
                { key: "nl", label: "🇳🇱 NL" },
                { key: "en", label: "🇬🇧 EN" },
              ].map((l) => (
                <button
                  key={l.key}
                  type="button"
                  onClick={() => patch({ site_status_lang: l.key })}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-full transition ${form.site_status_lang === l.key ? "bg-pear-500 text-white shadow" : "text-muted-fg hover:text-strong"}`}
                  data-testid={`cms-site-lang-${l.key}`}
                >{l.label}</button>
              ))}
            </div>
            <p className="text-[11px] text-muted-fg mt-2">
              {en ? "Auto follows the visitor's browser language. Copy is baked-in — no need to type anything." : "Auto volgt de browsertaal van de bezoeker. Teksten zijn ingebakken — hoef je niets in te vullen."}
            </p>
          </div>

          {/* Background */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-fg mb-2">{en ? "Background" : "Achtergrond"}</p>
            <div className="inline-flex rounded-full border border-app p-1 surface-2 mb-3" data-testid="cms-site-bg-group">
              {[
                { key: "dynamic", label: en ? "Dynamic bokeh (auto rotates)" : "Dynamische bokeh (auto-wissel)" },
                { key: "custom", label: en ? "Custom image URL" : "Eigen afbeelding (URL)" },
              ].map((b) => (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => patch({ maintenance_bg_mode: b.key })}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-full transition ${form.maintenance_bg_mode === b.key ? "bg-slate-800 dark:bg-white dark:text-slate-900 text-white shadow" : "text-muted-fg hover:text-strong"}`}
                  data-testid={`cms-site-bg-${b.key}`}
                >{b.label}</button>
              ))}
            </div>
            {form.maintenance_bg_mode === "custom" && (
              <div className="flex gap-2">
                <input
                  value={form.maintenance_bg_url || ""}
                  onChange={change("maintenance_bg_url")}
                  onBlur={() => patch({ maintenance_bg_url: form.maintenance_bg_url })}
                  placeholder="https://..."
                  className="flex-1 rounded-xl surface-2 border border-transparent focus:border-pear-500 focus:ring-2 focus:ring-pear-500/20 px-4 py-2.5 text-sm outline-none text-strong font-mono"
                  data-testid="cms-site-bg-url"
                />
              </div>
            )}
            <p className="text-[11px] text-muted-fg mt-2">
              {en ? "Bokeh photos are randomly picked every page load and blurred at 10% for a soft, atmospheric look." : "Bokeh-foto's worden per herlaad willekeurig gekozen en 10% gebluurd voor een sfeervolle look."}
            </p>
          </div>

          {/* Preview buttons */}
          <div className="pt-4 border-t border-app">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-fg mb-2">{en ? "Preview" : "Voorvertoning"}</p>
            <div className="flex flex-wrap gap-2">
              <a href={previewUrl("maintenance")} target="_blank" rel="noreferrer" className="text-xs px-4 py-2 rounded-full border border-amber-400 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-500/10 inline-flex items-center gap-1.5" data-testid="cms-preview-maintenance">
                🔧 {en ? "Preview Maintenance" : "Preview Onderhoud"}
              </a>
              <a href={previewUrl("coming_soon")} target="_blank" rel="noreferrer" className="text-xs px-4 py-2 rounded-full border border-violet-400 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-500/10 inline-flex items-center gap-1.5" data-testid="cms-preview-coming-soon">
                🚀 {en ? "Preview Coming Soon" : "Preview Binnenkort"}
              </a>
            </div>
            <p className="text-[11px] text-muted-fg mt-2">
              {en ? "Preview opens in a new tab without affecting live visitors." : "Voorvertoning opent in een nieuw tabblad zonder de live-bezoekers te beïnvloeden."}
            </p>
          </div>

          {/* Zoho Books integration */}
          <ZohoBooksCard en={en} />

          {/* AI Translate rate limit — per admin, per minute. */}
          <div className="rounded-2xl surface-2 border border-app p-5" data-testid="cms-ai-translate-limit-card">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-fg">AI Vertaal · {en ? "Rate limit" : "Snelheidslimiet"}</p>
                <p className="font-heading font-semibold text-strong text-lg mt-1">
                  {en ? "Per-admin rate limit (per minute)" : "Limiet per admin (per minuut)"}
                </p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300 text-[10px] uppercase tracking-widest px-2.5 py-1 font-semibold">
                Claude Sonnet 4.6
              </span>
            </div>
            <p className="text-xs text-muted-fg mb-4 leading-relaxed">
              {en
                ? "Caps how many AI-translate calls each admin can trigger per rolling 60-second window. Protects the Emergent LLM key budget from runaway loops or bulk-translate scripts. Range 1–500."
                : "Beperkt hoeveel AI-vertaal-aanvragen elke admin per rollend 60-seconden-venster mag doen. Beschermt het Emergent LLM key-budget tegen doorlopende loops of bulk-vertaal-scripts. Bereik 1–500."}
            </p>
            <label className="block max-w-xs">
              <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted-fg mb-1.5">
                {en ? "Calls per admin per minute" : "Aanroepen per admin per minuut"}
              </span>
              <input
                type="number"
                min={1}
                max={500}
                value={form.ai_translate_limit_per_minute ?? 30}
                onChange={(e) => {
                  const v = Math.max(1, Math.min(500, parseInt(e.target.value || "30", 10) || 30));
                  setForm((f) => ({ ...f, ai_translate_limit_per_minute: v }));
                }}
                onBlur={(e) => {
                  const v = Math.max(1, Math.min(500, parseInt(e.target.value || "30", 10) || 30));
                  patch({ ai_translate_limit_per_minute: v });
                }}
                className="w-32 rounded-xl surface border border-app focus:border-pear-500 focus:ring-2 focus:ring-pear-500/20 px-4 py-2.5 text-sm outline-none text-strong text-center font-mono"
                data-testid="cms-ai-translate-limit-input"
              />
              <span className="ml-2 text-xs text-muted-fg">{en ? "requests / minute" : "verzoeken / minuut"}</span>
            </label>
            <p className="text-[10px] text-muted-fg mt-3">
              💡 {en ? "Default: 30. Lower if the key budget is running out." : "Standaard: 30. Verlaag als het key-budget snel opraakt."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

// -----------------------------------------------------------------------------
// ZohoBooksCard — fills the 4 Zoho Books credentials (client id/secret, refresh
// token, org id + data-centre) and offers a "Test connectie" round-trip button
// that exchanges the refresh_token and hits /organizations.
// Values are stored server-side encrypted (Fernet). The secret inputs stay
// masked; empty submit means "keep existing".
// -----------------------------------------------------------------------------
const ZohoBooksCard = ({ en }) => {
  const { authHeader } = useAuth();
  const [status, setStatus] = useState({ configured: false });
  const [form, setForm] = useState({ client_id: "", client_secret: "", refresh_token: "", org_id: "", dc: "eu" });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  // Wizard state — turns a freshly-generated Self-Client `code` into a
  // permanent refresh_token + populates the org_id dropdown for the admin.
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardCode, setWizardCode] = useState("");
  const [wizardBusy, setWizardBusy] = useState(false);
  const [wizardOrgs, setWizardOrgs] = useState([]);

  const loadStatus = () => axios.get(`${API}/admin/integrations/zoho-books`, { headers: authHeader() })
    .then((r) => { setStatus(r.data || {}); setForm((f) => ({ ...f, org_id: r.data?.org_id || "", dc: r.data?.dc || "eu" })); })
    .catch(() => {});
  useEffect(() => { loadStatus(); }, []);

  const change = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async () => {
    setSaving(true);
    setTestResult(null);
    try {
      const body = { org_id: form.org_id, dc: form.dc };
      // Only send secrets if the user typed something — empty keeps stored value
      if (form.client_id) body.client_id = form.client_id;
      if (form.client_secret) body.client_secret = form.client_secret;
      if (form.refresh_token) body.refresh_token = form.refresh_token;
      await axios.put(`${API}/admin/integrations/zoho-books`, body, { headers: authHeader() });
      setForm({ ...form, client_id: "", client_secret: "", refresh_token: "" });
      await loadStatus();
      toast.success(en ? "Zoho Books credentials saved" : "Zoho Books credentials opgeslagen");
    } catch (e) {
      toast.error(e?.response?.data?.detail || (en ? "Save failed" : "Opslaan mislukt"));
    } finally { setSaving(false); }
  };

  const test = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await axios.post(`${API}/admin/integrations/zoho-books/test`, {}, { headers: authHeader() });
      setTestResult({ ok: true, ...r.data });
      toast.success(en ? "Zoho connection OK" : "Zoho verbinding OK");
    } catch (e) {
      setTestResult({ ok: false, error: e?.response?.data?.detail || String(e) });
      toast.error(e?.response?.data?.detail || (en ? "Connection failed" : "Verbinding mislukt"));
    } finally { setTesting(false); }
  };

  const runWizard = async () => {
    if (!form.client_id || !form.client_secret) {
      toast.error(en ? "First enter your Client ID + Secret above." : "Vul eerst je Client ID + Secret in hierboven.");
      return;
    }
    if (!wizardCode || wizardCode.length < 20) {
      toast.error(en ? "Paste the generated code from api-console" : "Plak de gegenereerde code uit api-console");
      return;
    }
    setWizardBusy(true);
    setWizardOrgs([]);
    try {
      const r = await axios.post(`${API}/admin/integrations/zoho-books/exchange-code`, {
        code: wizardCode.trim(),
        client_id: form.client_id.trim(),
        client_secret: form.client_secret.trim(),
        dc: form.dc,
      }, { headers: authHeader() });
      const { refresh_token, organizations } = r.data || {};
      const singleOrg = organizations && organizations.length === 1 ? organizations[0].organization_id : "";
      // Immediately persist all 3 credentials + org (if unique) so client_id,
      // client_secret and refresh_token stay in sync. This prevents the
      // "invalid_code" error that happens when Save is clicked separately
      // and one of the three fields drifts.
      const bodyToSave = {
        client_id: form.client_id.trim(),
        client_secret: form.client_secret.trim(),
        refresh_token: refresh_token,
        dc: form.dc,
      };
      if (singleOrg) bodyToSave.org_id = singleOrg;
      try {
        await axios.put(`${API}/admin/integrations/zoho-books`, bodyToSave, { headers: authHeader() });
      } catch (saveErr) {
        toast.error(en ? "Exchange OK, but save failed — click Save manually." : "Exchange gelukt, opslaan mislukt — klik handmatig op Opslaan.");
      }
      setForm((f) => ({
        ...f,
        refresh_token: refresh_token || "",
        org_id: singleOrg || f.org_id,
      }));
      setWizardOrgs(organizations || []);
      setWizardCode("");
      await loadStatus();
      toast.success(en
        ? (singleOrg ? "✓ Refresh token + org saved. Try Test connection." : "Refresh token generated ✓")
        : (singleOrg ? "✓ Refresh token + organisatie opgeslagen. Klik nu Test verbinding." : "Refresh token gegenereerd ✓"));
    } catch (e) {
      toast.error(e?.response?.data?.detail || (en ? "Exchange failed — code expired?" : "Exchange mislukt — code verlopen?"));
    } finally { setWizardBusy(false); }
  };

  return (
    <div className="pt-4 border-t border-app" data-testid="cms-zoho-books-card">
      <div className="flex items-center gap-3 mb-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-fg">Zoho Books</p>
        <span className={`text-[10px] uppercase tracking-widest rounded-full px-2 py-0.5 font-bold ${status.configured ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`} data-testid="cms-zoho-books-status">
          {status.configured ? (en ? "Live" : "Live") : (en ? "Not configured" : "Nog niet ingesteld")}
        </span>
      </div>
      <p className="text-[11px] text-muted-fg mb-3">
        {en
          ? "Fill in your Zoho Books OAuth credentials. Secrets are Fernet-encrypted at rest. Leave a field empty to keep the currently stored value."
          : "Vul je Zoho Books OAuth-credentials in. Geheimen worden Fernet-versleuteld opgeslagen. Laat een veld leeg om de huidige waarde te behouden."}
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-[10px] uppercase tracking-widest text-muted-fg">Client ID {status.client_id_last4 && <span className="text-emerald-500">✓ …{status.client_id_last4}</span>}</span>
          <input type="password" value={form.client_id} onChange={change("client_id")} placeholder={status.client_id_last4 ? "•••••••" : "1000.XXXXXX"} className="mt-1 w-full rounded-lg surface-2 border border-app px-3 py-2 text-sm text-strong font-mono" data-testid="zoho-input-client-id" />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-widest text-muted-fg">Client secret</span>
          <input type="password" value={form.client_secret} onChange={change("client_secret")} placeholder={status.configured ? "•••••••" : ""} className="mt-1 w-full rounded-lg surface-2 border border-app px-3 py-2 text-sm text-strong font-mono" data-testid="zoho-input-client-secret" />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-[10px] uppercase tracking-widest text-muted-fg">Refresh token</span>
          <input type="password" value={form.refresh_token} onChange={change("refresh_token")} placeholder={status.configured ? "•••••••" : "1000.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.xxxx"} className="mt-1 w-full rounded-lg surface-2 border border-app px-3 py-2 text-sm text-strong font-mono" data-testid="zoho-input-refresh-token" />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-widest text-muted-fg">Organization ID</span>
          {wizardOrgs.length > 0 ? (
            <select
              value={form.org_id}
              onChange={change("org_id")}
              className="mt-1 w-full rounded-lg surface-2 border border-app px-3 py-2 text-sm text-strong font-mono"
              data-testid="zoho-input-org-id-select"
            >
              <option value="">— {en ? "Choose organization…" : "Kies organisatie…"} —</option>
              {wizardOrgs.map((o) => <option key={o.organization_id} value={o.organization_id}>{o.name} · {o.organization_id}</option>)}
            </select>
          ) : (
            <input type="text" value={form.org_id} onChange={change("org_id")} placeholder="6xxxxxxxx" className="mt-1 w-full rounded-lg surface-2 border border-app px-3 py-2 text-sm text-strong font-mono" data-testid="zoho-input-org-id" />
          )}
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-widest text-muted-fg">Data centre</span>
          <select value={form.dc} onChange={change("dc")} className="mt-1 w-full rounded-lg surface-2 border border-app px-3 py-2 text-sm text-strong" data-testid="zoho-input-dc">
            <option value="eu">🇪🇺 EU (zoho.eu)</option>
            <option value="com">🇺🇸 US (zoho.com)</option>
            <option value="in">🇮🇳 IN (zoho.in)</option>
            <option value="com.au">🇦🇺 AU (zoho.com.au)</option>
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-4">
        <button type="button" onClick={save} disabled={saving} className="btn-primary text-xs" data-testid="zoho-save">
          {saving ? "…" : (en ? "Save" : "Opslaan")}
        </button>
        <button type="button" onClick={test} disabled={testing || !status.configured} className="text-xs px-4 py-2 rounded-full border border-app hover:border-pear-500 disabled:opacity-40" data-testid="zoho-test">
          {testing ? "…" : (en ? "Test connection" : "Test verbinding")}
        </button>
        <button type="button" onClick={() => setWizardOpen((v) => !v)} className="text-xs px-4 py-2 rounded-full border border-violet-300 text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-500/10" data-testid="zoho-wizard-toggle">
          🪄 {en ? "Refresh-token wizard" : "Refresh-token wizard"}
        </button>
        {testResult && (
          <span className={`text-xs ${testResult.ok ? "text-emerald-600" : "text-red-500"}`} data-testid="zoho-test-result">
            {testResult.ok ? `✓ ${testResult.org_name || "OK"} · DC ${testResult.dc}` : `✗ ${testResult.error}`}
          </span>
        )}
      </div>

      {wizardOpen && (
        <div className="mt-4 rounded-xl border border-violet-200 dark:border-violet-500/30 bg-violet-50/50 dark:bg-violet-500/5 p-4" data-testid="zoho-wizard-panel">
          <p className="text-xs font-semibold uppercase tracking-widest text-violet-700 dark:text-violet-300 mb-2">
            🪄 {en ? "Get refresh_token in 3 steps" : "Refresh_token in 3 stappen"}
          </p>
          <ol className="text-[11px] text-strong space-y-1.5 mb-3 list-decimal list-inside">
            <li>
              {en ? "Open " : "Open "}
              <a href="https://api-console.zoho.eu" target="_blank" rel="noreferrer" className="text-pear-500 underline">api-console.zoho.eu</a>
              {en ? " → your Self Client → tab " : " → jouw Self Client → tab "}
              <strong>Generate Code</strong>.
            </li>
            <li>
              {en
                ? "Scope: "
                : "Scope: "}
              <code className="rounded surface-2 border border-app px-1.5 py-0.5">ZohoBooks.fullaccess.all</code>
              {en ? " · Duration: 10 min · Description: pearblue" : " · Duur: 10 min · Beschrijving: pearblue"}
            </li>
            <li>{en ? "Click Create, copy the generated code, paste it below and click Exchange." : "Klik Create, kopieer de gegenereerde code, plak hem hieronder en klik Exchange."}</li>
          </ol>
          <p className="text-[11px] text-muted-fg mb-3">
            💡 {en ? "Client ID + Secret above must already be filled in — the wizard uses them for the exchange (they are NOT saved yet)." : "Client ID + Secret hierboven moeten al ingevuld zijn — de wizard gebruikt ze voor de exchange (ze zijn nog niet opgeslagen)."}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={wizardCode}
              onChange={(e) => setWizardCode(e.target.value)}
              placeholder={en ? "Paste the code from api-console…" : "Plak de code uit api-console…"}
              className="flex-1 min-w-[220px] rounded-lg surface border border-app px-3 py-2 text-sm text-strong font-mono"
              data-testid="zoho-wizard-code-input"
            />
            <button
              type="button"
              onClick={runWizard}
              disabled={wizardBusy}
              className="btn-primary text-xs disabled:opacity-50"
              data-testid="zoho-wizard-exchange"
            >
              {wizardBusy ? (en ? "Exchanging…" : "Exchangen…") : "⚡ Exchange"}
            </button>
          </div>
          {wizardOrgs.length > 0 && (
            <p className="text-[11px] text-emerald-600 mt-3" data-testid="zoho-wizard-result">
              ✓ {en ? "Refresh token generated" : "Refresh token gegenereerd"} · {wizardOrgs.length} {en ? "organization(s) found — pick one above and click Save." : "organisatie(s) gevonden — kies er één hierboven en klik Opslaan."}
            </p>
          )}
        </div>
      )}

      <p className="text-[11px] text-muted-fg mt-3">
        {en
          ? "Once saved, /admin/financials switches from mocked to live invoice data automatically."
          : "Zodra opgeslagen schakelt /admin/financials automatisch van mocked naar live factuur-data."}
      </p>
    </div>
  );
};


// -----------------------------------------------------------------------------
// Roadmap admin tab — CRUD for the /over-ons timeline items
// -----------------------------------------------------------------------------
const EMPTY_FORM = {
  icon: "Sparkles",
  title_nl: "",
  title_en: "",
  description_nl: "",
  description_en: "",
  status: "planned",
  date_label: "",
  order: 100,
};

const RoadmapAdminTab = ({ en }) => {
  const { authHeader } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/admin/roadmap`, { headers: authHeader() });
      setItems(r.data || []);
    } catch { toast.error(en ? "Load failed" : "Laden mislukt"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const reset = () => { setForm(EMPTY_FORM); setEditingId(null); };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title_nl.trim() || !form.description_nl.trim()) {
      toast.error(en ? "Dutch title and description are required" : "NL-titel en -beschrijving zijn verplicht");
      return;
    }
    setBusy(true);
    try {
      if (editingId) {
        await axios.patch(`${API}/admin/roadmap/${editingId}`, form, { headers: authHeader() });
        toast.success(en ? "Updated" : "Bijgewerkt");
      } else {
        await axios.post(`${API}/admin/roadmap`, form, { headers: authHeader() });
        toast.success(en ? "Added" : "Toegevoegd");
      }
      reset();
      load();
    } catch (err) { toast.error(err?.response?.data?.detail || (en ? "Save failed" : "Opslaan mislukt")); }
    finally { setBusy(false); }
  };

  const edit = (i) => {
    setEditingId(i.id);
    setForm({
      icon: i.icon || "Sparkles",
      title_nl: i.title_nl || "",
      title_en: i.title_en || "",
      description_nl: i.description_nl || "",
      description_en: i.description_en || "",
      status: i.status || "planned",
      date_label: i.date_label || "",
      order: i.order || 0,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const remove = async (id) => {
    if (!window.confirm(en ? "Delete this roadmap item?" : "Dit roadmap-item verwijderen?")) return;
    try {
      await axios.delete(`${API}/admin/roadmap/${id}`, { headers: authHeader() });
      toast.success(en ? "Deleted" : "Verwijderd");
      if (editingId === id) reset();
      load();
    } catch { toast.error(en ? "Delete failed" : "Verwijderen mislukt"); }
  };

  const move = async (idx, delta) => {
    const newItems = [...items];
    const swap = idx + delta;
    if (swap < 0 || swap >= newItems.length) return;
    [newItems[idx], newItems[swap]] = [newItems[swap], newItems[idx]];
    const order = newItems.map((i, ord) => ({ id: i.id, order: ord * 10 }));
    setItems(newItems); // optimistic
    try {
      await axios.put(`${API}/admin/roadmap/reorder`, { order }, { headers: authHeader() });
    } catch { toast.error(en ? "Reorder failed" : "Herordenen mislukt"); load(); }
  };

  return (
    <div className="space-y-6" data-testid="cms-roadmap-tab">
      {/* Editor */}
      <form onSubmit={submit} className="surface border border-app rounded-2xl p-6 space-y-4" data-testid="cms-roadmap-form">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="font-heading font-semibold text-strong">
            {editingId ? (en ? "Edit roadmap item" : "Roadmap-item bewerken") : (en ? "New roadmap item" : "Nieuw roadmap-item")}
          </h3>
          {editingId && (
            <button type="button" onClick={reset} className="text-xs text-muted-fg hover:text-pear-500" data-testid="cms-roadmap-cancel-edit">
              ({en ? "cancel" : "annuleren"})
            </button>
          )}
        </div>

        {/* Icon picker */}
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg block mb-2">
            {en ? "Icon" : "Icoontje"}
          </span>
          <div className="grid grid-cols-8 sm:grid-cols-12 gap-2" data-testid="cms-roadmap-icon-picker">
            {ROADMAP_ICON_NAMES.map((name) => {
              const Icon = iconFromName(name);
              const selected = form.icon === name;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setForm({ ...form, icon: name })}
                  title={name}
                  className={`aspect-square rounded-xl flex items-center justify-center transition-all ${
                    selected
                      ? "bg-pear-500 text-white ring-2 ring-pear-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 shadow-lg scale-105"
                      : "surface-2 border border-app text-strong hover:border-pear-500 hover:text-pear-500"
                  }`}
                  data-testid={`cms-roadmap-icon-${name}`}
                >
                  <Icon className="h-5 w-5" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Status + date label + order */}
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg">{en ? "Status" : "Status"}</span>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="mt-1.5 w-full rounded-xl surface-2 border border-transparent focus:border-pear-500 focus:ring-2 focus:ring-pear-500/20 px-3 py-2 text-sm outline-none text-strong"
              data-testid="cms-roadmap-status"
            >
              <option value="achieved">{en ? "Achieved" : "Behaald"}</option>
              <option value="planned">{en ? "Planned" : "Gepland"}</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg">{en ? "Date label (optional)" : "Datumlabel (optioneel)"}</span>
            <input
              value={form.date_label}
              onChange={(e) => setForm({ ...form, date_label: e.target.value })}
              placeholder="2026 · Q3"
              className="mt-1.5 w-full rounded-xl surface-2 border border-transparent focus:border-pear-500 focus:ring-2 focus:ring-pear-500/20 px-3 py-2 text-sm outline-none text-strong"
              data-testid="cms-roadmap-date-label"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg">{en ? "Order (asc)" : "Volgorde (opl)"}</span>
            <input
              type="number"
              value={form.order}
              onChange={(e) => setForm({ ...form, order: parseInt(e.target.value, 10) || 0 })}
              className="mt-1.5 w-full rounded-xl surface-2 border border-transparent focus:border-pear-500 focus:ring-2 focus:ring-pear-500/20 px-3 py-2 text-sm outline-none text-strong font-mono"
              data-testid="cms-roadmap-order"
            />
          </label>
        </div>

        {/* NL/EN titles */}
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg">{en ? "Title (NL)*" : "Titel (NL)*"}</span>
            <input
              required
              value={form.title_nl}
              onChange={(e) => setForm({ ...form, title_nl: e.target.value })}
              className="mt-1.5 w-full rounded-xl surface-2 border border-transparent focus:border-pear-500 focus:ring-2 focus:ring-pear-500/20 px-3 py-2 text-sm outline-none text-strong"
              data-testid="cms-roadmap-title-nl"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg">{en ? "Title (EN)" : "Titel (EN)"}</span>
            <input
              value={form.title_en}
              onChange={(e) => setForm({ ...form, title_en: e.target.value })}
              className="mt-1.5 w-full rounded-xl surface-2 border border-transparent focus:border-pear-500 focus:ring-2 focus:ring-pear-500/20 px-3 py-2 text-sm outline-none text-strong"
              data-testid="cms-roadmap-title-en"
            />
          </label>
        </div>

        {/* NL/EN descriptions */}
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg">{en ? "Description (NL)*" : "Beschrijving (NL)*"}</span>
            <textarea
              required
              rows={3}
              value={form.description_nl}
              onChange={(e) => setForm({ ...form, description_nl: e.target.value })}
              className="mt-1.5 w-full rounded-xl surface-2 border border-transparent focus:border-pear-500 focus:ring-2 focus:ring-pear-500/20 px-3 py-2 text-sm outline-none text-strong resize-y"
              data-testid="cms-roadmap-desc-nl"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg">{en ? "Description (EN)" : "Beschrijving (EN)"}</span>
            <textarea
              rows={3}
              value={form.description_en}
              onChange={(e) => setForm({ ...form, description_en: e.target.value })}
              className="mt-1.5 w-full rounded-xl surface-2 border border-transparent focus:border-pear-500 focus:ring-2 focus:ring-pear-500/20 px-3 py-2 text-sm outline-none text-strong resize-y"
              data-testid="cms-roadmap-desc-en"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-2 items-center pt-2 border-t border-app">
          <button type="submit" disabled={busy} className="btn-primary text-sm" data-testid="cms-roadmap-submit">
            {editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {busy ? (en ? "Saving…" : "Bezig…") : (editingId ? (en ? "Save changes" : "Wijzigingen opslaan") : (en ? "Add item" : "Item toevoegen"))}
          </button>
          {editingId && (
            <button type="button" onClick={reset} className="btn-secondary text-sm" data-testid="cms-roadmap-reset">
              {en ? "New instead" : "Nieuw i.p.v."}
            </button>
          )}
        </div>
      </form>

      {/* List */}
      <div className="surface border border-app rounded-2xl overflow-hidden" data-testid="cms-roadmap-list">
        <div className="flex items-center justify-between p-4 border-b border-app">
          <h3 className="font-heading font-semibold text-strong">
            {en ? "Timeline items" : "Tijdlijn-items"} ({items.length})
          </h3>
          <button onClick={load} type="button" className="text-xs text-muted-fg hover:text-pear-500" data-testid="cms-roadmap-refresh">
            {en ? "↻ Refresh" : "↻ Vernieuwen"}
          </button>
        </div>
        {loading ? (
          <p className="p-6 text-sm text-muted-fg">{en ? "Loading…" : "Laden…"}</p>
        ) : items.length === 0 ? (
          <p className="p-6 text-sm text-muted-fg">{en ? "No items yet — add one above." : "Nog geen items — voeg er hierboven één toe."}</p>
        ) : (
          <ul className="divide-y divide-app">
            {items.map((i, idx) => {
              const Icon = iconFromName(i.icon);
              const done = i.status === "achieved";
              return (
                <li key={i.id} className="p-4 flex items-start gap-3" data-testid={`cms-roadmap-row-${idx}`}>
                  <div className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center ${done ? "bg-gradient-to-br from-pear-500 to-pear-600 text-white" : "surface-2 border-2 border-dashed border-pear-500/50 text-pear-500"}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className={`text-[10px] uppercase tracking-widest font-bold rounded-full px-2 py-0.5 ${done ? "bg-pear-100 text-pear-700 dark:bg-pear-500/20" : "surface-2 text-muted-fg border border-dashed border-slate-400"}`}>
                        {done ? <><CheckCircle2 className="h-3 w-3 inline -mt-0.5" /> {en ? "Achieved" : "Behaald"}</> : <><Target className="h-3 w-3 inline -mt-0.5" /> {en ? "Planned" : "Gepland"}</>}
                      </span>
                      {i.date_label && <span className="text-[10px] uppercase tracking-widest text-muted-fg">{i.date_label}</span>}
                      <span className="text-[10px] text-muted-fg font-mono">#{i.order}</span>
                    </div>
                    <p className="font-semibold text-strong">{i.title_nl}</p>
                    {i.title_en && <p className="text-xs text-muted-fg">{i.title_en}</p>}
                    <p className="text-sm text-strong/90 mt-1">{i.description_nl}</p>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button type="button" onClick={() => move(idx, -1)} disabled={idx === 0} className="p-1.5 rounded-lg surface-2 hover:bg-pear-100 disabled:opacity-30" title={en ? "Move up" : "Omhoog"} data-testid={`cms-roadmap-up-${idx}`}>
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => move(idx, 1)} disabled={idx === items.length - 1} className="p-1.5 rounded-lg surface-2 hover:bg-pear-100 disabled:opacity-30" title={en ? "Move down" : "Omlaag"} data-testid={`cms-roadmap-down-${idx}`}>
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button type="button" onClick={() => edit(i)} className="text-xs px-3 py-1 rounded-full border border-pear-500 text-pear-500 hover:bg-pear-50 dark:hover:bg-pear-500/10" data-testid={`cms-roadmap-edit-${idx}`}>
                      {en ? "Edit" : "Bewerk"}
                    </button>
                    <button type="button" onClick={() => remove(i.id)} className="text-xs px-3 py-1 rounded-full border border-red-300 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10" data-testid={`cms-roadmap-delete-${idx}`}>
                      <Trash2 className="h-3 w-3 inline" /> {en ? "Delete" : "Verwijder"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

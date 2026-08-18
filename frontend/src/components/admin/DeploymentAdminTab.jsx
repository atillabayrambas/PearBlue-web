import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Save, Copy, Eye, EyeOff, ExternalLink, ShieldAlert, CheckCircle2, AlertTriangle, Key, RefreshCw } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { API } from "./_shared";

// One authoritative catalog of every env var we need on the hosting
// platform. Each entry doubles as inline documentation in the CMS — the
// admin never has to leave the tab to figure out where a key lives.
const VAULT_KEYS = [
  {
    key: "MONGO_URL",
    label: "MongoDB Connection String",
    sensitive: true,
    placeholder: "mongodb+srv://user:pass@cluster.mongodb.net/?authSource=admin",
    docs_nl: "MongoDB Atlas → Database → Connect → Drivers → kopieer connection string, vervang <password> met de user password en voeg ?authSource=admin toe.",
    docs_en: "MongoDB Atlas → Database → Connect → Drivers → copy the connection string, replace <password> with your user password and append ?authSource=admin.",
    link: "https://cloud.mongodb.com",
  },
  {
    key: "DB_NAME",
    label: "Database Naam",
    sensitive: false,
    placeholder: "pearblue_prod",
    docs_nl: "Vrij te kiezen. Gebruik bijv. 'pearblue_prod' voor productie. Motor maakt de database automatisch aan bij de eerste write.",
    docs_en: "Any name. Use 'pearblue_prod' for production. Motor auto-creates the database on first write.",
  },
  {
    key: "EMERGENT_LLM_KEY",
    label: "Emergent Universal LLM Key",
    sensitive: true,
    placeholder: "sk-emergent-...",
    docs_nl: "app.emergent.sh → Profile → Manage plan → Universal Key. Deze key werkt voor Claude, GPT, Gemini en Nano Banana. Ook voor object storage (video uploads).",
    docs_en: "app.emergent.sh → Profile → Manage plan → Universal Key. Works for Claude, GPT, Gemini, Nano Banana and object storage.",
    link: "https://app.emergent.sh/profile",
  },
  {
    key: "ZOHO_CLIENT_ID",
    label: "Zoho OAuth Client ID",
    sensitive: false,
    placeholder: "1000.XXXXXXXXXXXXXXX",
    docs_nl: "api-console.zoho.eu → jouw Self Client / Server-based app → Client Secret tab → Client ID kopiëren.",
    docs_en: "api-console.zoho.eu → your app → Client Secret tab → copy Client ID.",
    link: "https://api-console.zoho.eu",
  },
  {
    key: "ZOHO_CLIENT_SECRET",
    label: "Zoho OAuth Client Secret",
    sensitive: true,
    placeholder: "abc123...",
    docs_nl: "Zelfde plek als Client ID. Behandel als wachtwoord — nooit committen naar git.",
    docs_en: "Same place as Client ID. Treat like a password — never commit to git.",
    link: "https://api-console.zoho.eu",
  },
  {
    key: "ZOHO_BOOKS_ORG_ID",
    label: "Zoho Books Organization ID",
    sensitive: false,
    placeholder: "20109165270",
    docs_nl: "books.zoho.eu → Settings (tandwiel rechtsboven) → Organization Profile → Organization ID (numeriek).",
    docs_en: "books.zoho.eu → Settings → Organization Profile → Organization ID (numeric).",
    link: "https://books.zoho.eu",
  },
  {
    key: "ZOHO_PROJECTS_PORTAL_ID",
    label: "Zoho Projects Portal ID",
    sensitive: false,
    placeholder: "20118024653",
    docs_nl: "projects.zoho.eu → Settings → Portal Info → Portal ID (numeriek, NIET de portal-slug 'multibaydoteu').",
    docs_en: "projects.zoho.eu → Settings → Portal Info → Portal ID (numeric, NOT the slug).",
    link: "https://projects.zoho.eu",
  },
  {
    key: "ZOHO_DESK_ORG_ID",
    label: "Zoho Desk Organization ID",
    sensitive: false,
    placeholder: "20118024663",
    docs_nl: "desk.zoho.eu → Setup (tandwiel) → Organization → Organization Details → Organization ID.",
    docs_en: "desk.zoho.eu → Setup → Organization → Organization Details → Organization ID.",
    link: "https://desk.zoho.eu",
  },
  {
    key: "STRIPE_SECRET_KEY",
    label: "Stripe Secret Key",
    sensitive: true,
    placeholder: "sk_live_... of sk_test_...",
    docs_nl: "dashboard.stripe.com → Developers → API keys → Secret key (klik 'Reveal'). Gebruik sk_test_ voor testen, sk_live_ voor productie.",
    docs_en: "dashboard.stripe.com → Developers → API keys → Secret key (click 'Reveal').",
    link: "https://dashboard.stripe.com/apikeys",
  },
  {
    key: "STRIPE_WEBHOOK_SECRET",
    label: "Stripe Webhook Signing Secret",
    sensitive: true,
    placeholder: "whsec_...",
    docs_nl: "dashboard.stripe.com → Developers → Webhooks → jouw endpoint → Signing secret (klik 'Reveal'). Elk endpoint heeft z'n eigen secret.",
    docs_en: "dashboard.stripe.com → Developers → Webhooks → your endpoint → Signing secret ('Reveal').",
    link: "https://dashboard.stripe.com/webhooks",
  },
  {
    key: "TOKEN_ENCRYPTION_KEY",
    label: "Token Encryption Key (Fernet)",
    sensitive: true,
    danger: true,
    placeholder: "44-char base64 Fernet key",
    docs_nl: "Genereer in Python: `from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())`. ⚠️ Als je deze wijzigt zijn ALLE encrypted Zoho refresh-tokens én IMAP-wachtwoorden onleesbaar. Bewaar de originele key veilig.",
    docs_en: "Generate in Python: `Fernet.generate_key().decode()`. ⚠️ Changing this invalidates ALL encrypted Zoho refresh tokens and IMAP passwords.",
  },
  {
    key: "RESEND_API_KEY",
    label: "Resend API Key",
    sensitive: true,
    placeholder: "re_...",
    docs_nl: "resend.com → API Keys → Create API Key. Kies 'Full access'. Nodig voor contact-form mail, review-invites en nieuwsbrief.",
    docs_en: "resend.com → API Keys → Create API Key. Choose 'Full access'.",
    link: "https://resend.com/api-keys",
  },
  {
    key: "JWT_SECRET",
    label: "JWT Signing Secret",
    sensitive: true,
    danger: true,
    placeholder: "willekeurige 32+ char string",
    docs_nl: "Genereer in Python: `import secrets; print(secrets.token_urlsafe(32))`. ⚠️ Wijzigen logt alle admins onmiddellijk uit (alle bestaande JWT-tokens worden ongeldig).",
    docs_en: "Generate: `secrets.token_urlsafe(32)`. ⚠️ Changing this logs out every admin.",
  },
  {
    key: "SESSION_SECRET",
    label: "Session Cookie Secret",
    sensitive: true,
    danger: true,
    placeholder: "willekeurige 32+ char string",
    docs_nl: "Genereer in Python: `secrets.token_urlsafe(32)`. Wordt gebruikt door Starlette SessionMiddleware voor de OAuth state cookie tijdens Zoho login.",
    docs_en: "Generate: `secrets.token_urlsafe(32)`. Used by Starlette SessionMiddleware for the OAuth state cookie.",
  },
  {
    key: "FRONTEND_URL",
    label: "Frontend Public URL",
    sensitive: false,
    placeholder: "https://www.pearblue.nl",
    docs_nl: "De publieke URL waar je Vercel-frontend draait. Wordt in Zoho OAuth redirects en in verstuurde mails gebruikt. Geen trailing slash.",
    docs_en: "The public URL where your Vercel frontend lives. Used in OAuth redirects and outbound emails. No trailing slash.",
  },
  {
    key: "CORS_ORIGINS",
    label: "CORS Allowed Origins",
    sensitive: false,
    placeholder: "https://www.pearblue.nl,https://pearblue.nl",
    docs_nl: "Comma-separated lijst. De backend accepteert alleen browser-requests van deze domeinen. Voeg beide varianten toe (met en zonder www).",
    docs_en: "Comma-separated. Backend rejects browser requests from any other origin. Include both www and apex.",
  },
  {
    key: "SUPER_ADMIN_EMAILS",
    label: "Super Admin Emails",
    sensitive: false,
    placeholder: "beheer@multibay.eu",
    docs_nl: "Comma-separated e-mailadressen. Wie hiermee via Zoho inlogt krijgt automatisch admin-rechten (rol = super_admin).",
    docs_en: "Comma-separated. Anyone logging in via Zoho with one of these emails is auto-promoted to super_admin.",
  },
];

// Copy to clipboard with fallback for older browsers.
const copy = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

// Render one row per env var — label + description + masked/reveal input +
// copy + external doc link. All state is local to the parent tab component
// which owns the vault dict and the save flow.
const VaultRow = ({ meta, value, envSet, en, onChange, onSave, dirty }) => {
  const [reveal, setReveal] = useState(false);
  const [copied, setCopied] = useState(false);
  const docs = en ? meta.docs_en : meta.docs_nl;
  const showCopy = async () => {
    if (!value) return;
    if (await copy(value)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  };
  return (
    <div
      className={`rounded-2xl border p-4 space-y-2 transition ${
        meta.danger ? "border-amber-400/40 bg-amber-50/40 dark:bg-amber-500/5" : "border-app surface-2"
      }`}
      data-testid={`vault-row-${meta.key}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Key className="h-3.5 w-3.5 text-pear-500 shrink-0" />
            <span className="font-mono text-xs font-semibold text-strong break-all">{meta.key}</span>
            {envSet ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded-full px-2 py-0.5">
                <CheckCircle2 className="h-3 w-3" /> {en ? "live on backend" : "actief op backend"}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-red-500 bg-red-500/10 rounded-full px-2 py-0.5">
                <AlertTriangle className="h-3 w-3" /> {en ? "not on backend" : "niet op backend"}
              </span>
            )}
            {meta.danger && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-full px-2 py-0.5">
                <ShieldAlert className="h-3 w-3" /> {en ? "handle with care" : "voorzichtig"}
              </span>
            )}
          </div>
          <p className="text-sm text-strong mt-1">{meta.label}</p>
          <p className="text-xs text-muted-fg mt-1 leading-relaxed">{docs}</p>
        </div>
        {meta.link && (
          <a
            href={meta.link}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-1 text-xs text-pear-500 hover:underline"
            data-testid={`vault-doc-link-${meta.key}`}
          >
            {en ? "Open" : "Openen"} <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
      <div className="flex items-stretch gap-2">
        <input
          type={meta.sensitive && !reveal ? "password" : "text"}
          value={value || ""}
          onChange={(e) => onChange(meta.key, e.target.value)}
          placeholder={meta.placeholder}
          spellCheck={false}
          autoComplete="off"
          className="flex-1 min-w-0 rounded-xl surface border border-transparent focus:border-pear-500 focus:ring-2 focus:ring-pear-500/20 px-3 py-2 text-sm outline-none text-strong font-mono"
          data-testid={`vault-input-${meta.key}`}
        />
        {meta.sensitive && (
          <button
            type="button"
            onClick={() => setReveal((v) => !v)}
            className="shrink-0 rounded-xl surface border border-app px-3 text-muted-fg hover:text-strong hover:border-pear-500 transition"
            title={reveal ? (en ? "Hide" : "Verbergen") : (en ? "Reveal" : "Tonen")}
            data-testid={`vault-toggle-${meta.key}`}
          >
            {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
        <button
          type="button"
          onClick={showCopy}
          disabled={!value}
          className="shrink-0 rounded-xl surface border border-app px-3 text-muted-fg hover:text-strong hover:border-pear-500 disabled:opacity-40 disabled:hover:text-muted-fg disabled:hover:border-app transition"
          title={en ? "Copy" : "Kopiëren"}
          data-testid={`vault-copy-${meta.key}`}
        >
          {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={() => onSave(meta.key)}
          disabled={!dirty}
          className="shrink-0 rounded-xl bg-pear-500 hover:bg-pear-600 disabled:opacity-40 disabled:hover:bg-pear-500 text-white px-3 text-xs font-semibold transition"
          title={en ? "Save this row" : "Deze rij opslaan"}
          data-testid={`vault-save-${meta.key}`}
        >
          <Save className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export const DeploymentAdminTab = ({ en }) => {
  const { authHeader } = useAuth();
  const [vault, setVault] = useState({});
  const [envStatus, setEnvStatus] = useState({});
  const [dirty, setDirty] = useState({}); // key -> true when local value !== saved value
  const [savedSnapshot, setSavedSnapshot] = useState({});
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState({ updated_at: null, updated_by: null });

  const load = async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/admin/deployment/vault`, { headers: authHeader() });
      setVault(r.data.vault || {});
      setSavedSnapshot(r.data.vault || {});
      setEnvStatus(r.data.env_status || {});
      setMeta({ updated_at: r.data.updated_at, updated_by: r.data.updated_by });
      setDirty({});
    } catch {
      toast.error(en ? "Failed to load vault" : "Kluis kon niet worden geladen");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onChange = (key, value) => {
    setVault((v) => ({ ...v, [key]: value }));
    setDirty((d) => ({ ...d, [key]: (savedSnapshot[key] || "") !== value }));
  };

  const persist = async (partial) => {
    try {
      await axios.put(`${API}/admin/deployment/vault`, partial, { headers: authHeader() });
      setSavedSnapshot((s) => ({ ...s, ...partial }));
      setDirty((d) => {
        const nxt = { ...d };
        for (const k of Object.keys(partial)) nxt[k] = false;
        return nxt;
      });
      toast.success(en ? "Saved" : "Opgeslagen");
    } catch {
      toast.error(en ? "Save failed" : "Opslaan mislukt");
    }
  };

  const saveOne = (key) => persist({ [key]: vault[key] || "" });
  const saveAll = () => {
    const dirtyKeys = Object.keys(dirty).filter((k) => dirty[k]);
    if (!dirtyKeys.length) return;
    persist(Object.fromEntries(dirtyKeys.map((k) => [k, vault[k] || ""])));
  };

  // Build a paste-ready .env block from the current vault values.
  const envBlock = useMemo(() =>
    VAULT_KEYS.map(({ key }) => {
      const v = vault[key] || "";
      // Wrap values with spaces or # in quotes so shells parse them right.
      const needsQuotes = /[\s#"']/.test(v);
      const escaped = v.replace(/"/g, '\\"');
      return `${key}=${needsQuotes ? `"${escaped}"` : v}`;
    }).join("\n"),
  [vault]);

  const copyEnvBlock = async () => {
    if (await copy(envBlock)) toast.success(en ? ".env block copied — paste it into Render/Vercel" : ".env-blok gekopieerd — plak in Render/Vercel");
    else toast.error(en ? "Copy failed" : "Kopiëren mislukt");
  };

  const dirtyCount = Object.values(dirty).filter(Boolean).length;
  const setOnBackendCount = Object.values(envStatus).filter(Boolean).length;

  return (
    <div className="space-y-5 max-w-4xl" data-testid="cms-deployment-tab">
      <div className="rounded-2xl border border-amber-400/40 bg-amber-50 dark:bg-amber-500/10 p-4">
        <div className="flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900 dark:text-amber-100 leading-relaxed">
            <p className="font-semibold">
              {en
                ? "This is a vault — not runtime config."
                : "Dit is een kluis — géén runtime configuratie."}
            </p>
            <p className="text-xs mt-1 text-amber-800 dark:text-amber-200/90">
              {en
                ? "Values you save here are encrypted at rest so you have ONE place with all your deployment secrets and docs. Changing a value does NOT restart the backend — you must paste it into Render/Vercel/wherever the process actually runs."
                : "Waarden die je hier opslaat worden versleuteld bewaard zodat je ÉÉN plek hebt met al je deployment secrets en docs. Wijzigingen hier herstarten de backend NIET — je moet ze zelf overzetten naar Render/Vercel/waar het proces draait."}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-muted-fg">
          {en ? "On backend right now" : "Actueel op backend"}:{" "}
          <span className="font-semibold text-strong">
            {setOnBackendCount}/{VAULT_KEYS.length}
          </span>
          {meta.updated_at && (
            <>
              {" · "}
              {en ? "vault updated" : "kluis bijgewerkt"} {new Date(meta.updated_at).toLocaleString()} {meta.updated_by ? `· ${meta.updated_by}` : ""}
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl surface-2 border border-app px-3 py-2 text-xs text-muted-fg hover:text-strong hover:border-pear-500 transition disabled:opacity-50"
            data-testid="vault-refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            {en ? "Refresh" : "Vernieuwen"}
          </button>
          <button
            type="button"
            onClick={copyEnvBlock}
            className="inline-flex items-center gap-1.5 rounded-xl surface-2 border border-app px-3 py-2 text-xs text-strong hover:border-pear-500 transition"
            data-testid="vault-copy-env"
          >
            <Copy className="h-3.5 w-3.5" />
            {en ? "Copy .env block" : "Kopieer .env-blok"}
          </button>
          <button
            type="button"
            onClick={saveAll}
            disabled={!dirtyCount}
            className="inline-flex items-center gap-1.5 rounded-xl bg-pear-500 hover:bg-pear-600 disabled:opacity-40 disabled:hover:bg-pear-500 text-white px-4 py-2 text-xs font-semibold transition"
            data-testid="vault-save-all"
          >
            <Save className="h-3.5 w-3.5" />
            {en ? `Save all${dirtyCount ? ` (${dirtyCount})` : ""}` : `Alles opslaan${dirtyCount ? ` (${dirtyCount})` : ""}`}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {VAULT_KEYS.map((m) => (
          <VaultRow
            key={m.key}
            meta={m}
            value={vault[m.key] || ""}
            envSet={!!envStatus[m.key]}
            en={en}
            dirty={!!dirty[m.key]}
            onChange={onChange}
            onSave={saveOne}
          />
        ))}
      </div>

      <details className="rounded-2xl border border-app surface-2 p-4" data-testid="vault-env-preview">
        <summary className="text-sm font-semibold text-strong cursor-pointer">
          {en ? "Preview .env block" : "Voorbeeld .env-blok"}
        </summary>
        <pre className="mt-3 text-[11px] font-mono text-strong whitespace-pre-wrap break-all bg-slate-900 text-slate-100 rounded-xl p-3 overflow-x-auto">
{envBlock}
        </pre>
      </details>
    </div>
  );
};

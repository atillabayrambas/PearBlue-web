import React, { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Code, Save, ShieldX } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { API } from "./_shared";

export const ScriptsAdmin = () => {
  const { authHeader, user: me } = useAuth();
  const [header, setHeader] = useState("");
  const [footer, setFooter] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const canEdit = me?.role === "super_admin" || me?.role === "admin";

  useEffect(() => {
    axios.get(`${API}/site/scripts`)
      .then((r) => { setHeader(r.data?.header_scripts || ""); setFooter(r.data?.footer_scripts || ""); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/admin/scripts`, { header_scripts: header, footer_scripts: footer }, { headers: authHeader() });
      toast.success("Scripts opgeslagen. Herlaad de site om de nieuwe scripts te zien.");
    } catch (err) { toast.error(err?.response?.data?.detail || "Opslaan mislukt"); }
    finally { setSaving(false); }
  };

  if (!canEdit) {
    return <div className="surface border border-app rounded-3xl p-10 text-center" data-testid="cms-scripts-forbidden">
      <ShieldX className="h-10 w-10 text-red-500 mx-auto mb-3" />
      <p className="font-heading text-lg text-strong">Alleen Super Administrator</p>
      <p className="text-sm text-muted-fg">Voor het bewerken van site-scripts heb je super_admin rechten nodig — de scripts kunnen tracking- of security-gevolgen hebben.</p>
    </div>;
  }

  return (
    <div data-testid="cms-scripts">
      <header className="mb-6">
        <h1 className="font-heading text-3xl font-medium text-strong">Custom scripts</h1>
        <p className="text-sm text-muted-fg mt-1">Injecteer aangepaste HTML/JS in de <code>&lt;head&gt;</code> of aan het einde van <code>&lt;body&gt;</code>. Handig voor Trustpilot TrustBox, Google Tag Manager, meta pixels, etc.</p>
      </header>
      {loading ? <p className="text-muted-fg">Laden…</p> : (
        <div className="space-y-6">
          <div className="surface border border-app rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Code className="h-4 w-4 text-pear-500" />
              <h2 className="font-heading font-semibold text-strong">Header scripts <span className="text-xs text-muted-fg font-normal">— injecteert in &lt;head&gt;</span></h2>
            </div>
            <textarea rows={8} value={header} onChange={(e) => setHeader(e.target.value)} data-testid="scripts-header-input"
              placeholder='<!-- e.g. Google Tag Manager, meta pixels --><script>...</script>'
              className="w-full rounded-xl surface-2 border border-transparent focus:border-pear-500 px-4 py-3 text-sm font-mono outline-none resize-y text-strong" />
          </div>
          <div className="surface border border-app rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Code className="h-4 w-4 text-pear-500" />
              <h2 className="font-heading font-semibold text-strong">Footer scripts <span className="text-xs text-muted-fg font-normal">— injecteert vlak voor &lt;/body&gt;</span></h2>
            </div>
            <textarea rows={8} value={footer} onChange={(e) => setFooter(e.target.value)} data-testid="scripts-footer-input"
              placeholder='<!-- e.g. Trustpilot TrustBox JS, chat widgets --><script src="..."></script>'
              className="w-full rounded-xl surface-2 border border-transparent focus:border-pear-500 px-4 py-3 text-sm font-mono outline-none resize-y text-strong" />
          </div>
          <div className="flex justify-end">
            <button onClick={save} disabled={saving} className="btn-primary" data-testid="scripts-save">
              <Save className="h-4 w-4" /> {saving ? "Opslaan…" : "Opslaan"}
            </button>
          </div>
          <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 rounded-2xl p-4">
            ⚠ Waarschuwing: aangepaste scripts kunnen prestatie en veiligheid van de site beïnvloeden. Plak alleen code die je vertrouwt. Kwaadaardige code kan bezoekers tracken of misleiden.
          </div>
        </div>
      )}
    </div>
  );
};

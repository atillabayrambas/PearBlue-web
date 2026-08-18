import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { API } from "./_shared";

export const BrevoAdmin = () => {
  const { authHeader } = useAuth();
  const [settings, setSettings] = useState({ from_email: "communication-noreply@pearblue.nl", from_name: "PearBlue", enabled: false, api_key_set: false });
  const [apiKey, setApiKey] = useState("");
  const [stats, setStats] = useState(null);
  const [campaigns, setCampaigns] = useState(null);

  const load = useCallback(async () => {
    try {
      const [s, st, c] = await Promise.all([
        axios.get(`${API}/admin/brevo/settings`, { headers: authHeader() }),
        axios.get(`${API}/admin/newsletter/stats`, { headers: authHeader() }).catch(() => ({ data: null })),
        axios.get(`${API}/admin/brevo/campaigns`, { headers: authHeader() }).catch(() => ({ data: null })),
      ]);
      setSettings((prev) => s.data || prev);
      setStats(st.data);
      setCampaigns(c.data);
    } catch { /* ignore */ }
  }, [authHeader]);
  useEffect(() => { load(); }, [load]);

  const save = async (e) => {
    e.preventDefault();
    try {
      const body = { from_email: settings.from_email, from_name: settings.from_name, enabled: settings.enabled };
      if (apiKey) body.api_key = apiKey;
      await axios.put(`${API}/admin/brevo/settings`, body, { headers: authHeader() });
      toast.success("Brevo-instellingen opgeslagen");
      setApiKey("");
      load();
    } catch { toast.error("Opslaan mislukt"); }
  };

  const maxDaily = stats?.daily?.reduce((m, d) => Math.max(m, d.count), 1) || 1;
  return (
    <div data-testid="cms-brevo">
      <h2 className="font-heading text-2xl font-semibold text-strong flex items-center gap-2">
        <Send className="h-6 w-6 text-pear-500" /> Mailmarketing (Brevo)
      </h2>
      <p className="text-sm text-muted-fg mt-1 mb-4">
        Beheer je nieuwsbrief-lijsten en campagnes. Vul hieronder je Brevo API-sleutel in — de rest van deze pagina wordt actief zodra de sleutel is opgeslagen. <strong>Verzendingen zijn momenteel MOCKED</strong>.
      </p>

      <form onSubmit={save} className="surface border border-app rounded-2xl p-6 space-y-3 mb-6" data-testid="brevo-settings-form">
        <div>
          <label className="text-xs uppercase tracking-widest text-muted-fg">Brevo API-sleutel {settings.api_key_set && <span className="text-emerald-600 ml-2">✓ geconfigureerd</span>}</label>
          <input
            type="password"
            placeholder={settings.api_key_set ? "•••••• (leeg laten om huidige te behouden)" : "xkeysib-xxxxxxxxxxxxx"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="mt-1 w-full rounded-lg border border-app surface px-3 py-2 text-sm font-mono"
            data-testid="brevo-api-key"
          />
          <p className="text-[11px] text-muted-fg mt-1">Haal je API-sleutel op via app.brevo.com → SMTP &amp; API → API Keys. Alleen v3 keys.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input value={settings.from_email} onChange={(e) => setSettings({ ...settings, from_email: e.target.value })} className="rounded-lg border border-app surface px-3 py-2 text-sm" placeholder="Verzend-e-mail" data-testid="brevo-from-email" />
          <input value={settings.from_name} onChange={(e) => setSettings({ ...settings, from_name: e.target.value })} className="rounded-lg border border-app surface px-3 py-2 text-sm" placeholder="Verzendnaam" data-testid="brevo-from-name" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={settings.enabled} onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })} className="accent-pear-500" data-testid="brevo-enabled" />
          Mailmarketing inschakelen
        </label>
        <button type="submit" className="btn-primary" data-testid="brevo-save">Opslaan</button>
      </form>

      {stats && (
        <div className="rounded-2xl border border-app p-5 surface mb-6" data-testid="brevo-newsletter-stats">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-fg">Aanmeldingen (totaal)</div>
              <div className="font-heading text-3xl font-medium text-strong" data-testid="newsletter-total">{stats.total}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-fg">Laatste 30 dagen</div>
              <div className="font-heading text-3xl font-medium text-strong">{stats.last_30d}</div>
            </div>
          </div>
          {stats.daily?.length > 0 && (
            <div className="flex items-end gap-1.5 h-24">
              {stats.daily.map((d) => (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full bg-pear-500 rounded-t" style={{ height: `${(d.count / maxDaily) * 100}%`, minHeight: d.count > 0 ? "2px" : "0" }} title={`${d.day}: ${d.count}`} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {campaigns && (
        <div className="rounded-2xl border border-app p-5 surface" data-testid="brevo-campaigns">
          <div className="text-xs uppercase tracking-widest text-muted-fg mb-3">Campagnes (MOCKED: {campaigns.reason})</div>
          {(campaigns.campaigns || []).length === 0 ? (
            <div className="text-sm text-muted-fg">Nog geen campagnes.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-fg">
                <tr><th className="py-1">Naam</th><th>Status</th><th className="text-right">Verzonden</th><th className="text-right">Geopend</th><th className="text-right">Klikken</th></tr>
              </thead>
              <tbody>
                {(campaigns.campaigns || []).map((c) => (
                  <tr key={c.id} className="border-t border-app/40">
                    <td className="py-2">{c.name}</td>
                    <td><span className="text-xs rounded-full px-2 py-0.5 bg-slate-100 text-slate-600">{c.status}</span></td>
                    <td className="text-right font-mono">{c.sent}</td>
                    <td className="text-right font-mono">{c.opened}</td>
                    <td className="text-right font-mono">{c.clicked}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

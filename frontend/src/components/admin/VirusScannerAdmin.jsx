import React, { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { ShieldX } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { API } from "./_shared";

export const VirusScannerAdmin = () => {
  const { authHeader } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    try { const r = await axios.get(`${API}/admin/virus-scanner/logs`, { headers: authHeader() }); setLogs(r.data || []); }
    catch { toast.error("Kon virus-logs niet laden"); } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);
  const act = async (id, action) => {
    try {
      await axios.post(`${API}/admin/virus-scanner/${id}/${action}`, {}, { headers: authHeader() });
      toast.success(action === "quarantine" ? "In quarantaine gezet" : "Teruggezet");
      load();
    } catch { toast.error("Actie mislukt"); }
  };
  return (
    <div data-testid="cms-virusscanner">
      <h2 className="font-heading text-2xl font-semibold text-strong flex items-center gap-2">
        <ShieldX className="h-6 w-6 text-red-500" /> Virusscanner
      </h2>
      <p className="text-sm text-muted-fg mt-1 mb-6">
        Overzicht van gedetecteerde bedreigingen. In quarantaine gezette items blijven in de lijst en kunnen worden teruggezet. <strong>MOCKED:</strong> deze module is UI-only tot een externe scan-engine (ClamAV / VirusTotal API) wordt gekoppeld.
      </p>
      <div className="rounded-2xl border border-app overflow-hidden surface" data-testid="virus-logs-table">
        {loading ? <div className="p-8 text-center text-muted-fg">Laden…</div> :
          logs.length === 0 ? (
            <div className="p-10 text-center text-muted-fg text-sm">
              Nog geen detecties. Dit is verwacht — de scanner is nog niet actief.
              <div className="mt-4 text-[11px]">Roadmap: ClamAV/EDR-integratie + automatische mail-alert bij ernstige detecties + automatische quarantaine bij CVSS ≥ 7.</div>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-red-50 dark:bg-red-500/10 text-left">
                <tr>
                  <th className="px-3 py-2 text-xs uppercase tracking-widest text-muted-fg">Bestand/Bron</th>
                  <th className="px-3 py-2 text-xs uppercase tracking-widest text-muted-fg">Bedreiging</th>
                  <th className="px-3 py-2 text-xs uppercase tracking-widest text-muted-fg">Severity</th>
                  <th className="px-3 py-2 text-xs uppercase tracking-widest text-muted-fg">Gedetecteerd</th>
                  <th className="px-3 py-2 text-xs uppercase tracking-widest text-muted-fg">Status</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-t border-app/50">
                    <td className="px-3 py-2 text-xs font-mono">{l.source || l.filename}</td>
                    <td className="px-3 py-2">{l.threat}</td>
                    <td className="px-3 py-2 text-xs">{l.severity}</td>
                    <td className="px-3 py-2 text-xs text-muted-fg">{new Date(l.detected_at).toLocaleString("nl-NL")}</td>
                    <td className="px-3 py-2 text-xs">{l.quarantined ? "In quarantaine" : "Actief"}</td>
                    <td className="px-3 py-2 text-right">
                      {l.quarantined
                        ? <button onClick={() => act(l.id, "restore")} className="text-xs px-2.5 py-1 rounded-full border border-emerald-200 text-emerald-600 hover:bg-emerald-50">Terugzetten</button>
                        : <button onClick={() => act(l.id, "quarantine")} className="text-xs px-2.5 py-1 rounded-full border border-red-200 text-red-500 hover:bg-red-50">In quarantaine</button>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        }
      </div>
    </div>
  );
};

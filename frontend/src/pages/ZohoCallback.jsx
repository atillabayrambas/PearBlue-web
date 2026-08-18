import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";
import { Loader2, AlertCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { usePortalAuth } from "../auth/PortalAuthContext";
import { useAuth } from "../auth/AuthContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const REASON_TEXT = {
  super_admin_emails_env_not_set:
    "De backend heeft geen `SUPER_ADMIN_EMAILS` ingesteld. Vraag de operator om deze env var op Render/Vercel te zetten (bv. `SUPER_ADMIN_EMAILS=jouw@email.nl`) en de backend te herstarten.",
  email_not_whitelisted_and_no_admins_doc:
    "Jouw e-mailadres staat niet in `SUPER_ADMIN_EMAILS` én er is geen admin-record voor je in de database. Voeg je adres toe aan de env var op Render/Vercel of laat een bestaande super-admin je promoveren via de CMS Users-tab.",
  admins_role_not_in_cms_allowlist:
    "Je hebt wel een admin-record in de database, maar je rol geeft geen CMS-toegang. Vraag een super-admin om je rol te wijzigen naar minimaal `moderator`.",
  empty_email_from_zoho:
    "Zoho gaf geen e-mailadres terug in de OAuth-response. Controleer de `AaaServer.profile.READ`-scope in de Zoho API Console.",
  empty_email_after_normalize:
    "Zoho gaf geen bruikbaar e-mailadres terug. Controleer je Zoho profiel-instellingen.",
};

export default function ZohoCallback() {
  const [error, setError] = useState(null);
  const [debug, setDebug] = useState(null); // { role_debug, bootstrap_eligible, email }
  const [bootstrapBusy, setBootstrapBusy] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { refresh } = usePortalAuth();
  const { adoptToken } = useAuth();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const params = new URLSearchParams(location.search);
    const code = params.get("code");
    const state = params.get("state");
    const err = params.get("error");
    if (err) { setError(err); return; }
    if (!code || !state) { setError("Missing OAuth parameters"); return; }
    axios
      .post(`${API}/auth/zoho/exchange`, { code, state }, { withCredentials: true })
      .then(async (res) => {
        await refresh();
        if (res.data?.admin_token) {
          await adoptToken(res.data.admin_token);
          navigate("/admin", { replace: true });
          return;
        }
        // No admin_token — surface WHY when we have diagnostics so the
        // user isn't left staring at a portal without CMS access.
        if (res.data?.role_debug) {
          setDebug({
            role_debug: res.data.role_debug,
            bootstrap_eligible: !!res.data.bootstrap_eligible,
            email: res.data.email,
          });
          return; // stay on this page so the diagnostic is visible
        }
        navigate("/portal", { replace: true });
      })
      .catch((e) => setError(e?.response?.data?.detail || e.message || "Zoho login mislukt"));
  }, [location.search, navigate, refresh, adoptToken]);

  const runBootstrap = async () => {
    setBootstrapBusy(true);
    try {
      const r = await axios.post(`${API}/auth/zoho/bootstrap-super-admin`, {}, { withCredentials: true });
      if (r.data?.admin_token) {
        await adoptToken(r.data.admin_token);
        toast.success("Je bent nu super-admin — welkom in het CMS.");
        navigate("/admin", { replace: true });
      }
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Bootstrap mislukt");
    } finally {
      setBootstrapBusy(false);
    }
  };

  if (debug) {
    const reason = debug.role_debug?.reason;
    const reasonText = REASON_TEXT[reason] || `Onbekende reden: ${reason || "—"}`;
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-6 py-16" data-testid="page-zoho-callback">
        <div className="surface rounded-3xl border border-app p-8 max-w-xl w-full">
          <AlertCircle className="h-10 w-10 text-amber-500 mb-4" />
          <h1 className="font-heading text-xl font-semibold text-strong mb-2">
            Je bent ingelogd — maar zonder CMS-toegang
          </h1>
          <p className="text-sm text-muted-fg mb-4">
            Zoho heeft je herkend als <strong className="text-strong">{debug.email}</strong>,
            maar deze backend beschouwt je niet als admin.
          </p>
          <div className="rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 p-4 mb-4 text-sm">
            <p className="text-amber-800 dark:text-amber-300 font-semibold mb-1">Waarom?</p>
            <p className="text-amber-800 dark:text-amber-300" data-testid="zoho-role-debug-reason">{reasonText}</p>
          </div>
          <details className="mb-4 text-xs">
            <summary className="cursor-pointer text-muted-fg hover:text-strong">Technische diagnose</summary>
            <pre className="mt-2 rounded-lg bg-slate-100 dark:bg-slate-900 p-3 overflow-x-auto text-[11px] font-mono" data-testid="zoho-role-debug-payload">{JSON.stringify(debug.role_debug, null, 2)}</pre>
          </details>
          {debug.bootstrap_eligible && (
            <div className="rounded-2xl bg-pear-50 dark:bg-pear-500/10 border border-pear-200 dark:border-pear-500/30 p-4 mb-4">
              <p className="text-sm text-pear-800 dark:text-pear-200 font-semibold mb-1 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" /> Eenmalige bootstrap beschikbaar
              </p>
              <p className="text-xs text-pear-800 dark:text-pear-200 mb-3">
                Er zijn nog géén admins geconfigureerd én de env-whitelist is leeg. Als eerste
                Zoho-gebruiker kan je jezelf één keer promoveren tot super-admin. Daarna beheer je
                nieuwe admins via de CMS Users-tab.
              </p>
              <button
                onClick={runBootstrap}
                disabled={bootstrapBusy}
                className="btn-primary text-sm"
                data-testid="zoho-bootstrap-btn"
              >
                {bootstrapBusy ? "Bezig…" : "Word super-admin"}
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={() => navigate("/portal")} className="btn-secondary" data-testid="zoho-continue-portal">
              Ga naar klantportaal
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6 py-16" data-testid="page-zoho-callback">
      {error ? (
        <div className="surface rounded-3xl border border-app p-10 max-w-md w-full text-center">
          <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-4" />
          <h1 className="font-heading text-xl font-semibold text-strong mb-2">Inloggen mislukt</h1>
          <p className="text-sm text-muted-fg mb-6" data-testid="zoho-callback-error">{typeof error === "string" ? error : "Onbekende fout"}</p>
          <button onClick={() => navigate("/portal")} className="btn-primary">Terug naar portaal</button>
        </div>
      ) : (
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-pear-500 mx-auto mb-3" />
          <p className="text-muted-fg text-sm">Inloggen met Zoho…</p>
        </div>
      )}
    </div>
  );
}

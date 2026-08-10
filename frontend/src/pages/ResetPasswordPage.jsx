import React, { useEffect, useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { KeyRound, CheckCircle2, ShieldAlert, Eye, EyeOff } from "lucide-react";
import { useLang } from "../i18n/LanguageContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const t = (lang, nl, en) => (lang === "en" ? en : nl);

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [state, setState] = useState({ loading: true, valid: false, email: "", error: "" });
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const { lang } = useLang();
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      setState({ loading: false, valid: false, email: "", error: t(lang, "Geen token in URL", "No token in URL") });
      return;
    }
    axios.get(`${API}/auth/reset-password/verify`, { params: { token } })
      .then((r) => setState({ loading: false, valid: true, email: r.data?.email || "", error: "" }))
      .catch((e) => setState({ loading: false, valid: false, email: "", error: e?.response?.data?.detail || t(lang, "Ongeldig of verlopen token", "Invalid or expired token") }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    if (pwd.length < 8) return toast.error(t(lang, "Minimaal 8 tekens", "Minimum 8 characters"));
    if (pwd !== pwd2) return toast.error(t(lang, "Wachtwoorden komen niet overeen", "Passwords don't match"));
    setBusy(true);
    try {
      await axios.post(`${API}/auth/reset-password/apply`, { token, new_password: pwd });
      setDone(true);
      toast.success(t(lang, "Wachtwoord bijgewerkt — je kunt nu inloggen", "Password updated — you can now log in"));
      setTimeout(() => navigate("/admin/login"), 2000);
    } catch (err) {
      toast.error(err?.response?.data?.detail || t(lang, "Kon wachtwoord niet bijwerken", "Could not update password"));
    } finally { setBusy(false); }
  };

  return (
    <section className="max-w-md mx-auto px-6 py-24" data-testid="reset-password-page">
      <div className="surface border border-app rounded-3xl p-8 shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full bg-pear-100 text-pear-700 flex items-center justify-center">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-heading text-2xl text-strong font-semibold">
              {t(lang, "Wachtwoord opnieuw instellen", "Reset your password")}
            </h1>
            <p className="text-xs text-muted-fg mt-0.5">PearBlue Admin / Portaal</p>
          </div>
        </div>

        {state.loading && <p className="text-muted-fg text-sm">{t(lang, "Token controleren…", "Verifying token…")}</p>}

        {!state.loading && !state.valid && (
          <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-500/10 p-4 flex gap-3" data-testid="reset-invalid">
            <ShieldAlert className="h-5 w-5 text-red-500 shrink-0" />
            <div className="text-sm text-strong">
              <p className="font-semibold">{t(lang, "Dit token is niet geldig", "This token is not valid")}</p>
              <p className="text-xs text-muted-fg mt-1">{state.error}</p>
              <p className="text-xs text-muted-fg mt-2">
                {t(lang, "Vraag een nieuwe reset-link aan via een beheerder of via de loginpagina.", "Request a new reset link via an admin or from the login page.")}
              </p>
              <Link to="/admin/login" className="mt-3 inline-block text-xs font-semibold text-pear-500 hover:underline" data-testid="reset-back-login">
                {t(lang, "← Terug naar login", "← Back to login")}
              </Link>
            </div>
          </div>
        )}

        {!state.loading && state.valid && !done && (
          <form onSubmit={submit} className="space-y-4" data-testid="reset-form">
            <div className="rounded-xl border border-pear-200 bg-pear-50/40 dark:bg-pear-500/10 p-3 text-xs">
              {t(lang, "Ingelogd voor:", "Resetting password for:")} <b className="text-strong">{state.email}</b>
            </div>
            <label className="block">
              <span className="text-[10px] uppercase tracking-widest text-muted-fg">{t(lang, "Nieuw wachtwoord", "New password")}</span>
              <div className="relative mt-1">
                <input
                  type={show ? "text" : "password"}
                  value={pwd}
                  onChange={(e) => setPwd(e.target.value)}
                  minLength={8}
                  required
                  className="w-full rounded-lg border border-app bg-white dark:bg-slate-800 px-3 py-2 pr-10 text-sm text-strong"
                  data-testid="reset-password-input"
                />
                <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-2 top-2 text-muted-fg hover:text-strong" aria-label="toggle">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-widest text-muted-fg">{t(lang, "Herhaal wachtwoord", "Repeat password")}</span>
              <input
                type={show ? "text" : "password"}
                value={pwd2}
                onChange={(e) => setPwd2(e.target.value)}
                minLength={8}
                required
                className="mt-1 w-full rounded-lg border border-app bg-white dark:bg-slate-800 px-3 py-2 text-sm text-strong"
                data-testid="reset-password-confirm"
              />
            </label>
            <p className="text-[11px] text-muted-fg leading-relaxed">
              {t(lang, "Kies iets sterks: min. 8 tekens, mix van letters, cijfers en symbolen.", "Choose something strong: min 8 chars, mix of letters, numbers and symbols.")}
            </p>
            <button type="submit" disabled={busy || !pwd || !pwd2} className="w-full btn-primary justify-center" data-testid="reset-submit">
              {busy ? t(lang, "Bezig…", "Working…") : t(lang, "Wachtwoord instellen", "Set password")}
            </button>
          </form>
        )}

        {done && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-500/10 p-4 flex gap-3" data-testid="reset-done">
            <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
            <div className="text-sm text-strong">
              <p className="font-semibold">{t(lang, "Wachtwoord bijgewerkt", "Password updated")}</p>
              <p className="text-xs text-muted-fg mt-1">
                {t(lang, "Je wordt doorgestuurd naar de loginpagina…", "Redirecting to the login page…")}
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

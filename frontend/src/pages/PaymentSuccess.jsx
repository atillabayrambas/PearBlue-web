import React, { useEffect, useState } from "react";
import axios from "axios";
import { useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2, AlertCircle, ArrowRight } from "lucide-react";
import { useLang } from "../i18n/LanguageContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PS = {
  verifying: { nl: "Betaling verifiëren…", en: "Verifying payment…" },
  usually: { nl: "Dit duurt meestal 2–5 seconden.", en: "This usually takes 2–5 seconds." },
  success: { nl: "Betaling geslaagd", en: "Payment successful" },
  paidText: { nl: "is voldaan. We hebben deze automatisch als betaald geregistreerd in Zoho Books.", en: "is paid. We've automatically marked it as paid in Zoho Books." },
  invoicePrefix: { nl: "Factuur", en: "Invoice" },
  back: { nl: "Terug naar portaal", en: "Back to portal" },
  notConfirmed: { nl: "Nog niet bevestigd", en: "Not yet confirmed" },
  fallbackWait: { nl: "Betaling nog niet bevestigd. Controleer je bank of probeer over enkele minuten opnieuw.", en: "Payment not yet confirmed. Please check with your bank or try again in a few minutes." },
  missingSession: { nl: "session_id ontbreekt", en: "session_id missing" },
  statusFail: { nl: "Status ophalen mislukt", en: "Could not fetch payment status" },
};

export default function PaymentSuccess() {
  const { lang } = useLang();
  const t = (k) => PS[k]?.[lang] || PS[k]?.nl || k;
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const [state, setState] = useState({ loading: true, paid: false, data: null, error: null });

  useEffect(() => {
    if (!sessionId) { setState({ loading: false, paid: false, error: t("missingSession"), data: null }); return; }
    let attempts = 0;
    let cancelled = false;
    const poll = async () => {
      attempts += 1;
      try {
        const r = await axios.get(`${API}/payments/status/${sessionId}`);
        if (cancelled) return;
        if (r.data.payment_status === "paid") {
          setState({ loading: false, paid: true, data: r.data, error: null });
          return;
        }
        if (attempts >= 15) {
          setState({ loading: false, paid: false, data: r.data, error: t("fallbackWait") });
          return;
        }
        setTimeout(poll, 2000);
      } catch (e) {
        setState({ loading: false, paid: false, data: null, error: e?.response?.data?.detail || t("statusFail") });
      }
    };
    poll();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6 py-16" data-testid="page-payment-success">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="surface border border-app rounded-3xl shadow-[0_30px_80px_rgba(10,25,47,0.08)] p-10 w-full max-w-md text-center">
        {state.loading ? (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-pear-500 mx-auto mb-4" />
            <p className="font-heading text-lg text-strong">{t("verifying")}</p>
            <p className="text-sm text-muted-fg mt-1">{t("usually")}</p>
          </>
        ) : state.paid ? (
          <>
            <div className="w-14 h-14 rounded-full bg-pear-100 text-pear-500 flex items-center justify-center mx-auto mb-4"><CheckCircle2 className="h-8 w-8" /></div>
            <h1 className="font-heading text-2xl font-semibold text-strong mb-2">{t("success")}</h1>
            <p className="text-sm text-muted-fg mb-6">
              {t("invoicePrefix")} <strong>{state.data?.invoice_number}</strong> {t("paidText")}
            </p>
            <Link to="/portal" className="btn-primary w-full justify-center" data-testid="payment-success-back">
              {t("back")} <ArrowRight className="h-4 w-4" />
            </Link>
          </>
        ) : (
          <>
            <AlertCircle className="h-10 w-10 text-amber-500 mx-auto mb-4" />
            <h1 className="font-heading text-xl font-semibold text-strong mb-2">{t("notConfirmed")}</h1>
            <p className="text-sm text-muted-fg mb-6">{state.error}</p>
            <Link to="/portal" className="btn-secondary w-full justify-center">{t("back")}</Link>
          </>
        )}
      </motion.div>
    </div>
  );
}

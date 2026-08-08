import React, { useEffect, useState } from "react";
import axios from "axios";
import { useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2, AlertCircle, ArrowRight } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function PaymentSuccess() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const [state, setState] = useState({ loading: true, paid: false, data: null, error: null });

  useEffect(() => {
    if (!sessionId) { setState({ loading: false, paid: false, error: "session_id ontbreekt", data: null }); return; }
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
          setState({ loading: false, paid: false, data: r.data, error: "Betaling nog niet bevestigd. Controleer je bank of probeer over enkele minuten opnieuw." });
          return;
        }
        setTimeout(poll, 2000);
      } catch (e) {
        setState({ loading: false, paid: false, data: null, error: e?.response?.data?.detail || "Status ophalen mislukt" });
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [sessionId]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6 py-16" data-testid="page-payment-success">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="surface border border-app rounded-3xl shadow-[0_30px_80px_rgba(10,25,47,0.08)] p-10 w-full max-w-md text-center">
        {state.loading ? (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-pear-500 mx-auto mb-4" />
            <p className="font-heading text-lg text-strong">Betaling verifiëren…</p>
            <p className="text-sm text-muted-fg mt-1">Dit duurt meestal 2–5 seconden.</p>
          </>
        ) : state.paid ? (
          <>
            <div className="w-14 h-14 rounded-full bg-pear-100 text-pear-500 flex items-center justify-center mx-auto mb-4"><CheckCircle2 className="h-8 w-8" /></div>
            <h1 className="font-heading text-2xl font-semibold text-strong mb-2">Betaling geslaagd</h1>
            <p className="text-sm text-muted-fg mb-6">
              Factuur <strong>{state.data?.invoice_number}</strong> is voldaan. We hebben deze automatisch als betaald geregistreerd in Zoho Books.
            </p>
            <Link to="/portal" className="btn-primary w-full justify-center" data-testid="payment-success-back">
              Terug naar portaal <ArrowRight className="h-4 w-4" />
            </Link>
          </>
        ) : (
          <>
            <AlertCircle className="h-10 w-10 text-amber-500 mx-auto mb-4" />
            <h1 className="font-heading text-xl font-semibold text-strong mb-2">Nog niet bevestigd</h1>
            <p className="text-sm text-muted-fg mb-6">{state.error}</p>
            <Link to="/portal" className="btn-secondary w-full justify-center">Terug naar portaal</Link>
          </>
        )}
      </motion.div>
    </div>
  );
}

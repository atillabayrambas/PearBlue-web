import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquarePlus, X, Check } from "lucide-react";
import axios from "axios";
import { useLang } from "../i18n/LanguageContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * Discreet page-level feedback widget.
 * Renders a low-key "Give feedback" pill at the bottom of a page section.
 * Sends { page, message, email?, rating? } to POST /api/feedback.
 */
export const FeedbackWidget = ({ page, className = "" }) => {
  const { lang } = useLang();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [msg, setMsg] = useState("");
  const [email, setEmail] = useState("");
  const [rating, setRating] = useState(0);

  const send = async (e) => {
    e.preventDefault();
    if (busy || !msg.trim() || msg.length < 5) return;
    setBusy(true);
    try {
      await axios.post(`${API}/feedback`, {
        page,
        message: msg.trim(),
        email: email.trim() || null,
        rating: rating || null,
      });
      setDone(true);
    } catch {
      /* silently fail — this is optional feedback */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`mt-16 flex justify-center ${className}`} data-testid={`feedback-widget-${page}`}>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs text-muted-fg hover:text-pear-500 border border-dashed border-app hover:border-pear-500 rounded-full px-4 py-2 inline-flex items-center gap-2 transition-colors"
          data-testid={`feedback-open-${page}`}
        >
          <MessageSquarePlus className="h-3.5 w-3.5" />
          {lang === "en" ? "Give feedback — what can we improve?" : "Geef feedback — wat kunnen we verbeteren?"}
        </button>
      ) : (
        <AnimatePresence>
          <motion.form
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={send}
            className="w-full max-w-lg rounded-2xl border border-app surface p-5 relative"
            data-testid={`feedback-form-${page}`}
          >
            <button
              type="button"
              onClick={() => { setOpen(false); setDone(false); }}
              className="absolute top-3 right-3 text-muted-fg hover:text-strong"
              data-testid={`feedback-close-${page}`}
            >
              <X className="h-4 w-4" />
            </button>
            {done ? (
              <div className="text-center py-6" data-testid={`feedback-done-${page}`}>
                <Check className="h-8 w-8 text-pear-500 mx-auto mb-2" />
                <p className="text-sm text-strong">
                  {lang === "en" ? "Thanks — your feedback has been sent!" : "Bedankt — je feedback is verzonden!"}
                </p>
              </div>
            ) : (
              <>
                <div className="text-sm font-medium text-strong mb-2">
                  {lang === "en" ? `Feedback for this page` : `Feedback voor deze pagina`}
                </div>
                <div className="flex gap-1 mb-3" data-testid={`feedback-rating-${page}`}>
                  {[1, 2, 3, 4, 5].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRating(r)}
                      className={`text-xl transition-colors ${rating >= r ? "text-pear-500" : "text-muted-fg hover:text-pear-300"}`}
                      aria-label={`rating ${r}`}
                      data-testid={`feedback-star-${page}-${r}`}
                    >★</button>
                  ))}
                </div>
                <textarea
                  required
                  minLength={5}
                  maxLength={2000}
                  rows={3}
                  value={msg}
                  onChange={(e) => setMsg(e.target.value)}
                  placeholder={lang === "en" ? "What can we improve?" : "Wat kunnen we verbeteren?"}
                  className="w-full rounded-lg border border-app bg-app px-3 py-2 text-sm resize-none"
                  data-testid={`feedback-message-${page}`}
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={lang === "en" ? "Your email (optional, for follow-up)" : "Je e-mail (optioneel, voor terugkoppeling)"}
                  className="mt-2 w-full rounded-lg border border-app bg-app px-3 py-2 text-sm"
                  data-testid={`feedback-email-${page}`}
                />
                <button
                  type="submit"
                  disabled={busy || msg.length < 5}
                  className="mt-3 btn-primary w-full justify-center disabled:opacity-50"
                  data-testid={`feedback-submit-${page}`}
                >
                  {busy ? (lang === "en" ? "Sending…" : "Verzenden…") : (lang === "en" ? "Send feedback" : "Verstuur feedback")}
                </button>
              </>
            )}
          </motion.form>
        </AnimatePresence>
      )}
    </div>
  );
};

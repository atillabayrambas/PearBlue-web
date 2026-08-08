import React, { useEffect, useState } from "react";
import { Cookie, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLang } from "../i18n/LanguageContext";

const KEY = "pb_cookie_consent";

export const CookieBanner = () => {
  const { lang } = useLang();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(KEY);
    if (!stored) setShow(true);
  }, []);

  const decide = (choice) => {
    localStorage.setItem(KEY, JSON.stringify({ choice, at: new Date().toISOString() }));
    setShow(false);
    // Fire event so analytics can react
    window.dispatchEvent(new CustomEvent("pb-cookie-consent", { detail: { choice } }));
  };

  const copy = lang === "nl"
    ? {
        title: "We gebruiken cookies",
        body: "PearBlue gebruikt functionele cookies en (na jouw akkoord) analytics-cookies (Google Analytics) om de site te verbeteren. Weiger je? Dan blijft alleen het strikt noodzakelijke actief.",
        accept: "Accepteren",
        reject: "Weigeren",
      }
    : {
        title: "We use cookies",
        body: "PearBlue uses functional cookies and (with your consent) analytics cookies (Google Analytics) to improve the site. Reject? Then only strictly necessary cookies stay active.",
        accept: "Accept",
        reject: "Reject",
      };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
          className="fixed bottom-4 left-4 right-4 sm:right-auto sm:max-w-md z-[75]"
          data-testid="cookie-banner"
        >
          <div className="surface border border-app rounded-2xl shadow-[0_20px_50px_rgba(10,25,47,0.15)] p-5">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-pear-100 text-pear-500 flex items-center justify-center shrink-0">
                <Cookie className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-heading font-semibold text-strong text-sm">{copy.title}</p>
                <p className="text-xs text-muted-fg leading-relaxed mt-1">{copy.body}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => decide("accept")}
                    className="text-xs font-semibold rounded-full bg-pear-500 text-white px-4 py-2 hover:bg-pear-600"
                    data-testid="cookie-accept"
                  >
                    {copy.accept}
                  </button>
                  <button
                    onClick={() => decide("reject")}
                    className="text-xs font-semibold rounded-full surface-2 text-strong border border-app px-4 py-2 hover:border-pear-500"
                    data-testid="cookie-reject"
                  >
                    {copy.reject}
                  </button>
                </div>
              </div>
              <button onClick={() => decide("dismiss")} aria-label="Sluiten" className="text-muted-fg hover:text-strong">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

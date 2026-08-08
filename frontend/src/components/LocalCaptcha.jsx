import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, ShieldCheck } from "lucide-react";
import { useLang } from "../i18n/LanguageContext";

/**
 * Lightweight local captcha:
 *   1) A visible "I'm not a robot" checkbox the human ticks.
 *   2) A hidden honeypot input filled by naive bots.
 *   3) A minimum time-on-form check (bots submit instantly).
 * onChange(ok:boolean, meta:{honeypot, elapsedMs}) is called whenever any of the above change.
 *
 * NOT a replacement for reCAPTCHA/Turnstile at scale, but a solid first line of defense
 * for low-volume contact/review/portal-registration forms.
 */
export const LocalCaptcha = ({ onChange }) => {
  const { lang } = useLang();
  const [checked, setChecked] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const startRef = useRef(Date.now());

  useEffect(() => {
    const elapsed = Date.now() - startRef.current;
    const ok = checked && !honeypot && elapsed > 1500;
    onChange?.(ok, { honeypot, elapsedMs: elapsed });
  }, [checked, honeypot, onChange]);

  return (
    <div className="my-3" data-testid="local-captcha">
      {/* Honeypot — real users never see or fill this */}
      <input
        type="text"
        name="website_hp"
        tabIndex={-1}
        autoComplete="off"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        style={{ position: "absolute", left: "-9999px", opacity: 0, height: 0, width: 0 }}
        aria-hidden="true"
        data-testid="local-captcha-honeypot"
      />
      <label className="inline-flex items-center gap-2.5 cursor-pointer select-none rounded-xl border border-app hover:border-pear-500 transition-colors px-3.5 py-2.5">
        <span
          className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-all ${
            checked ? "bg-pear-500 border-pear-500" : "border-app"
          }`}
        >
          {checked && <Check className="h-3.5 w-3.5 text-white" />}
        </span>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="sr-only"
          data-testid="local-captcha-checkbox"
        />
        <ShieldCheck className="h-4 w-4 text-pear-500" />
        <span className="text-sm text-strong">
          {lang === "en" ? "I'm not a robot" : "Ik ben geen robot"}
        </span>
      </label>
    </div>
  );
};

/** Small "By submitting you agree to Terms + Privacy" line. */
export const ConsentText = ({ context = "form" }) => {
  const { lang } = useLang();
  return (
    <p className="text-[11px] text-muted-fg leading-relaxed mt-2" data-testid={`consent-text-${context}`}>
      {lang === "en" ? (
        <>
          By using this form you agree to our{" "}
          <Link to="/terms" className="underline hover:text-pear-500">terms &amp; conditions</Link> and{" "}
          <Link to="/privacy" className="underline hover:text-pear-500">privacy policy</Link>.
        </>
      ) : (
        <>
          Door gebruik te maken van dit formulier ga je akkoord met onze{" "}
          <Link to="/voorwaarden" className="underline hover:text-pear-500">algemene voorwaarden</Link> en{" "}
          <Link to="/privacybeleid" className="underline hover:text-pear-500">privacybeleid</Link>.
        </>
      )}
    </p>
  );
};

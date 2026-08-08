import React, { useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { Mail, Phone, MapPin, Send, Check } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "../i18n/LanguageContext";
import { Logo } from "./Logo";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const NewsletterForm = () => {
  const { lang } = useLang();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!/^.+@.+\..+$/.test(email.trim())) return toast.error(lang === "en" ? "Enter a valid email" : "Vul een geldig e-mailadres in");
    setBusy(true);
    try {
      await axios.post(`${API}/newsletter/subscribe`, { email: email.trim(), language: lang, source: "footer" });
      setDone(true);
      toast.success(lang === "en" ? "You're subscribed — welcome!" : "Aanmelding gelukt — welkom!");
      setEmail("");
    } catch { toast.error(lang === "en" ? "Signup failed. Try again later." : "Aanmelden mislukt. Probeer later opnieuw."); }
    finally { setBusy(false); }
  };
  return (
    <div data-testid="footer-newsletter">
      <h4 className="font-heading font-semibold mb-2 text-strong">{lang === "en" ? "Newsletter" : "Nieuwsbrief"}</h4>
      <p className="text-xs text-muted-fg mb-3 leading-relaxed">
        {lang === "en"
          ? "Product updates and tips — unsubscribe anytime."
          : "Product-updates en tips — uitschrijven kan altijd."}
      </p>
      {done ? (
        <div className="flex items-center gap-2 text-sm text-pear-500" data-testid="footer-newsletter-done">
          <Check className="h-4 w-4" /> {lang === "en" ? "Subscribed!" : "Aangemeld!"}
        </div>
      ) : (
        <form onSubmit={submit} className="flex gap-2">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={lang === "en" ? "you@example.com" : "jij@voorbeeld.nl"}
            className="flex-1 rounded-full border border-app bg-app px-3 py-2 text-sm outline-none focus:border-pear-500 min-w-0"
            data-testid="footer-newsletter-email"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-pear-500 hover:bg-pear-600 text-white px-3 py-2 text-sm inline-flex items-center gap-1.5 disabled:opacity-50 shrink-0"
            data-testid="footer-newsletter-submit"
          >
            <Send className="h-3.5 w-3.5" /> {lang === "en" ? "Join" : "Meld aan"}
          </button>
        </form>
      )}
    </div>
  );
};

export const Footer = () => {
  const { t, lang } = useLang();
  return (
    <footer className="mt-24 border-t border-app surface" data-testid="site-footer">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-16 grid grid-cols-1 md:grid-cols-4 gap-10">
        <div className="md:col-span-2">
          <Logo size={44} />
          <p className="text-muted-fg max-w-md leading-relaxed mt-5">{t("footer.tagline")}</p>
          <div className="mt-6 text-xs text-muted-fg space-y-1" data-testid="footer-kvk">
            <p className="font-semibold text-strong">{t("kvk.title")}</p>
            <p>ICT- en mediavormgeving.</p>
            <p>KVK-nummer: <span className="font-mono">87201607</span></p>
            <p>Vestigingsnummer: <span className="font-mono">000053124294</span></p>
          </div>
          <div className="mt-6">
            <NewsletterForm />
          </div>
        </div>
        <div>
          <h4 className="font-heading font-semibold mb-4 text-strong">{t("footer.pages")}</h4>
          <ul className="space-y-2 text-sm text-muted-fg">
            <li><Link to="/" className="hover:text-pear-500" data-testid="footer-link-home">{t("nav.home")}</Link></li>
            <li><Link to="/over-ons" className="hover:text-pear-500" data-testid="footer-link-about">{t("nav.about")}</Link></li>
            <li><Link to="/diensten" className="hover:text-pear-500" data-testid="footer-link-services">{t("nav.services")}</Link></li>
            <li><Link to="/portfolio" className="hover:text-pear-500" data-testid="footer-link-portfolio">{t("nav.portfolio")}</Link></li>
            <li><Link to="/portal" className="hover:text-pear-500" data-testid="footer-link-portal">Klantportaal</Link></li>
            <li><Link to="/contact" className="hover:text-pear-500" data-testid="footer-link-contact">{t("nav.contact")}</Link></li>
            <li><Link to="/voorwaarden" className="hover:text-pear-500" data-testid="footer-link-terms">{lang === "en" ? "Terms" : "Voorwaarden"}</Link></li>
            <li><Link to="/privacybeleid" className="hover:text-pear-500" data-testid="footer-link-privacy">{lang === "en" ? "Privacy" : "Privacybeleid"}</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-heading font-semibold mb-4 text-strong">{t("footer.contact")}</h4>
          <ul className="space-y-2 text-sm text-muted-fg">
            <li className="flex items-center gap-2"><Mail className="h-4 w-4 text-pear-500" /> info@pearblue.nl</li>
            <li className="flex items-center gap-2"><Phone className="h-4 w-4 text-pear-500" /> +31 596 229 030</li>
            <li className="flex items-center gap-2"><MapPin className="h-4 w-4 text-pear-500" /> Nederland, Delfzijl</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-app">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-muted-fg">
          <p>© {new Date().getFullYear()} PearBlue®. {t("footer.rights")} · <span className="text-muted-fg/70">v0.5.2-Beta</span></p>
          <p className="inline-flex items-center gap-1.5" data-testid="footer-made-with-care">
            Made with care in the Netherlands. <span aria-label="Netherlands flag" role="img">🇳🇱</span> <span aria-label="heart" role="img">❤️</span>
          </p>
        </div>
      </div>
    </footer>
  );
};

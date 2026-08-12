import React, { useEffect, useState } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import { Sparkles, Mail, ArrowRight, Wrench, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "../i18n/LanguageContext";
import { Logo } from "../components/Logo";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// -----------------------------------------------------------------------------
// MaintenancePage — playful coming-soon / maintenance splash.
// Shown by <MaintenanceGate/> in App.js when SiteSettings.maintenance_mode = true.
// Design: dark tilted gradient, floating pear blobs, wobbly wrench mascot, chunky
// H1, marquee-style overline. Newsletter capture writes to db.newsletter_subscribers
// (source=maintenance) so the list is Brevo-ready the moment we go live.
// -----------------------------------------------------------------------------
export default function MaintenancePage({ config }) {
  const { lang } = useLang();
  const nl = lang !== "en";
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    document.title = nl ? "In onderhoud · PearBlue" : "Under maintenance · PearBlue";
  }, [nl]);

  const title = (nl ? config?.maintenance_title_nl : config?.maintenance_title_en) || (nl ? "We werken aan iets moois" : "We are polishing something great");
  const message = (nl ? config?.maintenance_message_nl : config?.maintenance_message_en) || (nl
    ? "Onze site staat even in onderhoud. Laat je e-mail achter en we sturen je een berichtje zodra we live gaan."
    : "Our site is briefly under maintenance. Drop your email and we'll let you know the moment we go live.");
  const bg = config?.maintenance_bg_url || "";
  const version = config?.version || "";

  const submit = async (e) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error(nl ? "Voer een geldig e-mailadres in" : "Enter a valid email");
      return;
    }
    setSending(true);
    try {
      await axios.post(`${API}/newsletter/subscribe`, { email: email.trim(), language: lang, source: "maintenance" });
      setDone(true);
      toast.success(nl ? "Aangemeld! We houden je op de hoogte." : "Signed up! We'll keep you posted.");
    } catch (err) {
      toast.error(err?.response?.data?.detail || (nl ? "Er ging iets mis" : "Something went wrong"));
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="relative min-h-screen w-full overflow-hidden text-white"
      style={{
        background: bg
          ? `linear-gradient(135deg, rgba(10,25,47,0.85), rgba(2,192,255,0.5)), url(${bg}) center/cover no-repeat`
          : "linear-gradient(140deg, #0A192F 0%, #063a5e 40%, #02C0FF 100%)",
      }}
      data-testid="maintenance-page"
    >
      {/* Floating pear blobs */}
      <motion.div
        className="pointer-events-none absolute -top-24 -right-16 h-96 w-96 rounded-full blur-3xl opacity-40"
        style={{ background: "radial-gradient(circle at 30% 30%, #02C0FF, transparent 70%)" }}
        animate={{ y: [0, 30, 0], x: [0, -20, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute -bottom-24 -left-16 h-[28rem] w-[28rem] rounded-full blur-3xl opacity-30"
        style={{ background: "radial-gradient(circle at 70% 70%, #A78BFA, transparent 70%)" }}
        animate={{ y: [0, -25, 0], x: [0, 25, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Grid noise overlay */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.04]" style={{
        backgroundImage: "radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)",
        backgroundSize: "16px 16px",
      }} />

      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Top bar */}
        <header className="flex items-center justify-between px-6 sm:px-10 lg:px-16 py-6" data-testid="maintenance-header">
          <Logo />
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-white/20 bg-white/5 backdrop-blur px-3 py-1.5 text-xs uppercase tracking-widest">
            <Wrench className="h-3.5 w-3.5 text-pear-400" />
            <span>{nl ? "Onderhoud" : "Maintenance"}</span>
          </div>
        </header>

        {/* Hero */}
        <main className="flex-1 flex items-center justify-center px-6 sm:px-10 lg:px-16 py-10">
          <div className="w-full max-w-3xl">
            {/* Playful wrench */}
            <motion.div
              className="mx-auto mb-8 inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-white/10 backdrop-blur border border-white/20"
              animate={{ rotate: [0, -10, 12, -6, 0], scale: [1, 1.05, 1] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
              data-testid="maintenance-mascot"
            >
              <Wrench className="h-9 w-9 text-pear-300" strokeWidth={2.2} />
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="text-xs sm:text-sm uppercase tracking-[0.35em] text-pear-300 mb-3 flex items-center gap-2 justify-center"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {nl ? "Bijna klaar" : "Almost there"}
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="font-heading text-4xl sm:text-5xl lg:text-6xl font-medium text-white text-center leading-tight"
              data-testid="maintenance-title"
            >
              {title}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="mt-5 text-base sm:text-lg text-white/80 text-center max-w-2xl mx-auto whitespace-pre-line"
              data-testid="maintenance-message"
            >
              {message}
            </motion.p>

            {config?.maintenance_show_newsletter !== false && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="mt-10 mx-auto max-w-lg"
              >
                {done ? (
                  <div className="rounded-2xl border border-white/20 bg-white/10 backdrop-blur p-5 flex items-center gap-3" data-testid="maintenance-newsletter-done">
                    <CheckCircle2 className="h-6 w-6 text-emerald-300 shrink-0" />
                    <p className="text-sm text-white/90">
                      {nl ? "Top! Je hoort van ons zodra we online zijn." : "Sweet! You'll hear from us the moment we go live."}
                    </p>
                  </div>
                ) : (
                  <form onSubmit={submit} className="flex gap-2" data-testid="maintenance-newsletter-form">
                    <div className="flex-1 relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={nl ? "jouw@email.nl" : "you@email.com"}
                        className="w-full rounded-full bg-white/10 backdrop-blur border border-white/30 px-10 py-3 text-sm outline-none focus:border-pear-400 focus:ring-2 focus:ring-pear-400/30 text-white placeholder-white/50"
                        data-testid="maintenance-newsletter-email"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={sending}
                      className="rounded-full bg-pear-500 hover:bg-pear-400 text-slate-900 font-semibold px-5 py-3 text-sm inline-flex items-center gap-1.5 shadow-lg shadow-pear-500/30 transition disabled:opacity-60"
                      data-testid="maintenance-newsletter-submit"
                    >
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                        <>
                          {nl ? "Houd me op de hoogte" : "Notify me"}
                          <ArrowRight className="h-3.5 w-3.5" />
                        </>
                      )}
                    </button>
                  </form>
                )}
                <p className="text-[11px] text-white/50 text-center mt-3">
                  {nl ? "Geen spam. Alleen een bericht wanneer we live gaan." : "No spam. Just one email when we go live."}
                </p>
              </motion.div>
            )}
          </div>
        </main>

        {/* Footer */}
        <footer className="flex items-center justify-between px-6 sm:px-10 lg:px-16 py-5 border-t border-white/10 text-xs text-white/50" data-testid="maintenance-footer">
          <span>© {new Date().getFullYear()} PearBlue®</span>
          {config?.maintenance_show_version !== false && version && (
            <span className="font-mono" data-testid="maintenance-version">v{version}</span>
          )}
        </footer>
      </div>
    </div>
  );
}

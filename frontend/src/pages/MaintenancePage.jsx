import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, ArrowRight, Wrench, Rocket, Loader2, CheckCircle2, Globe2, Lock } from "lucide-react";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// -----------------------------------------------------------------------------
// MaintenancePage — one component, two themed variants:
//   • "maintenance"  → wrench mascot, warm amber accent, "Bijna klaar" / "Almost there".
//   • "coming_soon"  → rocket mascot, cool violet accent, "Binnenkort online" / "Coming soon".
//
// All copy is baked in and translated on the fly based on the resolved language
// (browser default when set to "auto", otherwise the CMS override). The admin
// never has to type a title/message — the correct one is chosen per mode.
//
// Background: 6 curated bokeh photos from Unsplash. On every page-load one is
// picked at random, blurred at 10% for a soft depth-of-field feel. Admins can
// override with a custom URL from the CMS.
// -----------------------------------------------------------------------------

const LOGO_URL = "https://customer-assets-gfyr7b9c.emergentagent.net/job_sheet-converter-68/artifacts/djwgz9jk_PearBlue%20logo-10.webp";

const BOKEH_BACKGROUNDS = [
  "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=2400&q=60", // starry night mountains
  "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=2400&q=60", // foggy landscape
  "https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=2400&q=60", // spring bokeh
  "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=2400&q=60", // aurora world
  "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?auto=format&fit=crop&w=2400&q=60", // forest sun rays
  "https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?auto=format&fit=crop&w=2400&q=60", // ocean bokeh
];

// Detect language: honour the admin override, else use the browser's preferred
// language, else fall back to Dutch (this is a Dutch product first).
const resolveLang = (override) => {
  if (override === "nl" || override === "en") return override;
  if (typeof navigator !== "undefined") {
    const primary = (navigator.language || "nl").toLowerCase();
    if (primary.startsWith("en")) return "en";
  }
  return "nl";
};

// Copy per mode. Adjust here — never in the CMS.
const COPY = {
  maintenance: {
    overline: { nl: "Onderhoud", en: "Maintenance" },
    title: { nl: "We poetsen even iets bij", en: "We're polishing things up" },
    message: {
      nl: "Onze site staat kort in onderhoud terwijl we een paar puntjes op de i zetten. Laat je e-mail achter en we sturen je een berichtje zodra we weer live zijn.",
      en: "The site is briefly under maintenance while we tighten a few bolts. Drop your email and we'll ping you the moment we're back.",
    },
    accent: "amber",
    Mascot: Wrench,
  },
  coming_soon: {
    overline: { nl: "Binnenkort online", en: "Coming soon" },
    title: { nl: "Er komt iets nieuws aan", en: "Something new is on its way" },
    message: {
      nl: "We werken achter de schermen aan een frisse, fruitige lancering. Schrijf je in en we zijn er als eerste bij zodra we live gaan.",
      en: "We are cooking something fresh and fruity behind the scenes. Sign up and you'll be the first to know the moment we launch.",
    },
    accent: "violet",
    Mascot: Rocket,
  },
};

// Three PearBlue services — rendered as a horizontal bulleted line under the
// mode chip. Kept intentionally short so it doesn't compete with the H1.
const SERVICES = [
  { nl: "Media Websites", en: "Media Websites" },
  { nl: "IT-diensten", en: "IT Services" },
  { nl: "Cybersecurity", en: "Cybersecurity" },
];

export default function MaintenancePage({ config, forceMode }) {
  const status = forceMode || config?.site_status || "maintenance";
  const mode = status === "coming_soon" ? "coming_soon" : "maintenance";
  // Language: CMS override first, else stored preference, else browser default.
  const [lang, setLang] = useState(() => {
    if (typeof window === "undefined") return "nl";
    const stored = localStorage.getItem("pb_splash_lang");
    if (stored === "nl" || stored === "en") return stored;
    return resolveLang(config?.site_status_lang);
  });
  useEffect(() => {
    // Re-resolve when the CMS-side lang changes (only if user hasn't picked a manual override).
    const stored = localStorage.getItem("pb_splash_lang");
    if (!stored) setLang(resolveLang(config?.site_status_lang));
  }, [config?.site_status_lang]);
  const nl = lang === "nl";
  const copy = COPY[mode];
  const Mascot = copy.Mascot;
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  // Bokeh screensaver: pick an initial index randomly, then rotate every 8s.
  // Custom URL wins — no rotation in that case. Pauses when tab is hidden so
  // background tabs don't waste bandwidth on unused Unsplash images.
  const useCustom = config?.maintenance_bg_mode === "custom" && !!config?.maintenance_bg_url;
  const [bokehIdx, setBokehIdx] = useState(() => Math.floor(Math.random() * BOKEH_BACKGROUNDS.length));
  useEffect(() => {
    if (useCustom) return;
    let iv = null;
    const start = () => {
      if (iv) return;
      iv = setInterval(() => setBokehIdx((i) => (i + 1) % BOKEH_BACKGROUNDS.length), 8000);
    };
    const stop = () => { if (iv) { clearInterval(iv); iv = null; } };
    const onVisibility = () => (document.hidden ? stop() : start());
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => { stop(); document.removeEventListener("visibilitychange", onVisibility); };
  }, [useCustom]);
  const bokehUrl = useCustom ? config.maintenance_bg_url : BOKEH_BACKGROUNDS[bokehIdx];

  useEffect(() => {
    document.title = nl
      ? (mode === "coming_soon" ? "Binnenkort online · PearBlue" : "In onderhoud · PearBlue")
      : (mode === "coming_soon" ? "Coming soon · PearBlue" : "Under maintenance · PearBlue");
  }, [nl, mode]);

  const toggleLang = () => {
    const next = lang === "nl" ? "en" : "nl";
    setLang(next);
    try { localStorage.setItem("pb_splash_lang", next); } catch { /* ignore */ }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error(nl ? "Voer een geldig e-mailadres in" : "Enter a valid email");
      return;
    }
    setSending(true);
    try {
      await axios.post(`${API}/newsletter/subscribe`, { email: email.trim(), language: lang, source: mode });
      setDone(true);
      toast.success(nl ? "Aangemeld! We houden je op de hoogte." : "Signed up! We'll keep you posted.");
    } catch (err) {
      toast.error(err?.response?.data?.detail || (nl ? "Er ging iets mis" : "Something went wrong"));
    } finally {
      setSending(false);
    }
  };

  const accentClass = copy.accent === "amber"
    ? { chip: "text-amber-300", chipBg: "border-amber-400/40 bg-amber-400/10", glow1: "#F59E0B", glow2: "#FB923C", cta: "bg-amber-400 hover:bg-amber-300 text-slate-900 shadow-amber-400/30" }
    : { chip: "text-violet-300", chipBg: "border-violet-400/40 bg-violet-400/10", glow1: "#8B5CF6", glow2: "#02C0FF", cta: "bg-violet-400 hover:bg-violet-300 text-slate-900 shadow-violet-400/30" };

  return (
    <div
      className="relative min-h-screen w-full overflow-hidden text-white"
      data-testid="maintenance-page"
      data-mode={mode}
    >
      {/* Bokeh photo layer with cross-fade — 10% blur for soft depth-of-field.
          Every 8s the index rotates so waiting visitors always see something new. */}
      <AnimatePresence mode="sync">
        <motion.div
          key={bokehUrl}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.6, ease: "easeInOut" }}
          style={{
            backgroundImage: `url(${bokehUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(10px) saturate(1.15)",
            transform: "scale(1.08)",
          }}
          aria-hidden
          data-testid="maintenance-bokeh"
        />
      </AnimatePresence>
      {/* Dark gradient wash so text always pops */}
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(135deg, rgba(10,25,47,0.85), rgba(2,25,80,0.65) 50%, rgba(2,192,255,0.35))" }}
        aria-hidden
      />

      {/* Floating animated blobs */}
      <motion.div
        className="pointer-events-none absolute -top-32 -right-24 h-[28rem] w-[28rem] rounded-full blur-3xl opacity-50"
        style={{ background: `radial-gradient(circle at 30% 30%, ${accentClass.glow1}, transparent 70%)` }}
        animate={{ y: [0, 40, 0], x: [0, -30, 0], scale: [1, 1.08, 1] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute -bottom-32 -left-24 h-[32rem] w-[32rem] rounded-full blur-3xl opacity-40"
        style={{ background: `radial-gradient(circle at 70% 70%, ${accentClass.glow2}, transparent 70%)` }}
        animate={{ y: [0, -35, 0], x: [0, 40, 0], scale: [1.05, 1, 1.05] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 h-72 w-72 rounded-full blur-3xl opacity-30"
        style={{ background: "radial-gradient(circle, rgba(255,255,255,0.6), transparent 70%)" }}
        animate={{ opacity: [0.15, 0.35, 0.15] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Twinkling particles — 20 small dots drifting slowly */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {Array.from({ length: 20 }).map((_, i) => (
          <motion.span
            key={i}
            className="absolute rounded-full bg-white/80"
            style={{
              width: 2 + (i % 4),
              height: 2 + (i % 4),
              left: `${(i * 53) % 100}%`,
              top: `${(i * 37) % 100}%`,
              filter: "blur(0.5px)",
            }}
            animate={{ opacity: [0, 0.9, 0], y: [0, -20, 0] }}
            transition={{ duration: 4 + (i % 5), repeat: Infinity, delay: (i % 6) * 0.4, ease: "easeInOut" }}
          />
        ))}
      </div>

      {/* Top-right controls: language toggle + admin lock (both float over content) */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20 flex items-center gap-2">
        <button
          type="button"
          onClick={toggleLang}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 backdrop-blur px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20 transition"
          aria-label={nl ? "Wissel taal" : "Switch language"}
          data-testid="maintenance-lang-toggle"
        >
          <Globe2 className="h-3.5 w-3.5" />
          <span>{nl ? "🇳🇱 NL" : "🇬🇧 EN"}</span>
        </button>
        <a
          href="/admin/login"
          className="inline-flex items-center justify-center h-8 w-8 rounded-full border border-white/25 bg-white/10 backdrop-blur text-white hover:bg-white/20 transition"
          aria-label={nl ? "Beheerder inlog" : "Admin sign-in"}
          title={nl ? "Beheerder inlog" : "Admin sign-in"}
          data-testid="maintenance-admin-lock"
        >
          <Lock className="h-3.5 w-3.5" />
        </a>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex min-h-screen flex-col">
        <main className="flex-1 flex items-center justify-center px-6 sm:px-10 lg:px-16 py-12">
          <div className="w-full max-w-3xl text-center">
            {/* Large PearBlue logo above everything */}
            <motion.img
              src={LOGO_URL}
              alt="PearBlue"
              initial={{ opacity: 0, y: -18, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.6 }}
              className="mx-auto h-40 sm:h-52 lg:h-64 w-auto drop-shadow-2xl mb-6"
              data-testid="maintenance-logo"
            />

            {/* Playful mascot inline chip */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={`inline-flex items-center gap-2 rounded-full border ${accentClass.chipBg} backdrop-blur px-4 py-1.5 text-xs uppercase tracking-[0.3em] mb-4 ${accentClass.chip}`}
              data-testid="maintenance-mode-chip"
            >
              <motion.span
                animate={{ rotate: mode === "maintenance" ? [0, -12, 12, -6, 0] : [0, 0, 0], y: mode === "coming_soon" ? [0, -3, 0] : 0 }}
                transition={{ duration: mode === "maintenance" ? 3.5 : 2.5, repeat: Infinity, ease: "easeInOut" }}
                className="inline-flex"
              >
                <Mascot className="h-3.5 w-3.5" />
              </motion.span>
              {copy.overline[lang]}
            </motion.div>

            {/* Three services — bullets separated by fresh pear-blue dots */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28 }}
              className="mb-5 text-[11px] sm:text-xs uppercase tracking-[0.25em] text-white/70 flex items-center justify-center flex-wrap gap-x-2 gap-y-1"
              data-testid="maintenance-services"
            >
              {SERVICES.map((s, i) => (
                <React.Fragment key={s.en}>
                  {i > 0 && <span className="inline-block h-1.5 w-1.5 rounded-full bg-pear-400/80" aria-hidden />}
                  <span>{s[lang]}</span>
                </React.Fragment>
              ))}
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="font-heading text-4xl sm:text-5xl lg:text-6xl font-medium text-white leading-tight"
              data-testid="maintenance-title"
            >
              {copy.title[lang]}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.42 }}
              className="mt-5 text-base sm:text-lg text-white/85 max-w-2xl mx-auto whitespace-pre-line"
              data-testid="maintenance-message"
            >
              {copy.message[lang]}
            </motion.p>

            {/* Newsletter capture */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mt-10 mx-auto max-w-lg text-left"
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
                      className="w-full rounded-full bg-white/10 backdrop-blur border border-white/30 px-10 py-3 text-sm outline-none focus:border-white focus:ring-2 focus:ring-white/30 text-white placeholder-white/50"
                      data-testid="maintenance-newsletter-email"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={sending}
                    className={`rounded-full font-semibold px-5 py-3 text-sm inline-flex items-center gap-1.5 shadow-lg transition disabled:opacity-60 ${accentClass.cta}`}
                    data-testid="maintenance-newsletter-submit"
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                      <>
                        {nl ? "Blijf op de hoogte" : "Keep me posted"}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </>
                    )}
                  </button>
                </form>
              )}
              <p className="text-[11px] text-white/60 text-center mt-3" data-testid="maintenance-newsletter-hint">
                {nl ? "Blijf op de hoogte!" : "Stay in the loop!"}
              </p>
            </motion.div>
          </div>
        </main>

        {/* Footer */}
        <footer className="flex items-center justify-between px-6 sm:px-10 lg:px-16 py-5 border-t border-white/10 text-xs text-white/60" data-testid="maintenance-footer">
          <span>© {new Date().getFullYear()} PearBlue®</span>
          {config?.version && (
            <span className="font-mono" data-testid="maintenance-version">v{config.version}</span>
          )}
        </footer>
      </div>
    </div>
  );
}

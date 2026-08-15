// AiTranslateButton — small inline button used next to CMS text/textarea fields.
// Calls /api/admin/ai/translate (Claude Sonnet 4.6 via Emergent LLM key).
// Detects source language from the current field content (defaults NL) and
// asks the backend to translate to the opposite language (or a specified one).
// Renders a compact chip so it fits next to the field label without cluttering.
import React, { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Sparkles, Loader2, Clock } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { useLang } from "../../i18n/LanguageContext";
import { API } from "./_shared";

// Very rough NL vs EN detector — counts a handful of Dutch-only words.
const NL_TOKENS = /\b(het|een|van|voor|onze|wij|ook|nog|meer|zonder|maar|niet|zoals|dat|met|is|zijn|worden|werd|wordt|door|omdat|website|gebruikers|bedrijf|klant|klanten|jouw|uw|jij|jou|we|ons)\b/i;
export const detectLang = (text) => {
  if (!text) return "nl";
  return NL_TOKENS.test(text) ? "nl" : "en";
};

export const AiTranslateButton = ({
  value,
  onTranslated,
  targetLang, // optional — otherwise inferred as the opposite of detected source
  label, // optional override, otherwise localized "AI vertaal"/"AI translate"
  testid = "ai-translate-btn",
  size = "sm", // "sm" or "xs"
  disabled = false,
}) => {
  const { authHeader } = useAuth();
  const { lang } = useLang();
  const en = lang === "en";
  const [busy, setBusy] = useState(false);
  // Countdown-until-retry when the backend returns 429. Ticks down every second.
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!cooldownUntil) return undefined;
    const iv = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, [cooldownUntil]);
  const cooldownRemaining = cooldownUntil ? Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000)) : 0;
  if (cooldownUntil && cooldownRemaining === 0) {
    // Clear expired lock on next render.
    setTimeout(() => setCooldownUntil(0), 0);
  }
  const btnLabel = label || (en ? "AI translate" : "AI vertaal");
  const busyLabel = en ? "Translating…" : "Vertalen…";
  // eslint-disable-next-line no-unused-vars
  const _tickUsed = tick; // referenced so React re-renders each second while counting down.

  const run = async () => {
    if (cooldownRemaining > 0) {
      toast.error(en ? `Wait ${cooldownRemaining}s — rate limit hit.` : `Wacht ${cooldownRemaining}s — rate limit bereikt.`);
      return;
    }
    if (!value || !value.trim()) {
      toast.error(en ? "Type text first to translate" : "Vul eerst tekst in om te vertalen");
      return;
    }
    const src = detectLang(value);
    const tgt = targetLang || (src === "nl" ? "en" : "nl");
    if (src === tgt) {
      toast.info(en ? "Text seems already in the target language" : "Tekst lijkt al in doeltaal");
      return;
    }
    setBusy(true);
    try {
      const r = await axios.post(
        `${API}/admin/ai/translate`,
        { text: value, source_lang: src, target_lang: tgt },
        { headers: authHeader() }
      );
      const translated = r?.data?.translated;
      if (!translated) throw new Error("No result");
      onTranslated?.(translated, { source_lang: src, target_lang: tgt });
      toast.success(`${en ? "Translated" : "Vertaald"} ${src.toUpperCase()} → ${tgt.toUpperCase()}`);
    } catch (e) {
      const status = e?.response?.status;
      const detail = e?.response?.data?.detail;
      if (status === 429) {
        // Detail is either {message, retry_after_seconds, limit} or the legacy string.
        const retryRaw = detail && typeof detail === "object" ? detail.retry_after_seconds : undefined;
        const retry = Number.isFinite(retryRaw) && retryRaw > 0 ? retryRaw : 60;
        const lim = detail && typeof detail === "object" && detail.limit;
        setCooldownUntil(Date.now() + retry * 1000);
        toast.error(en
          ? `Rate limit${lim ? ` (${lim}/min)` : ""} — retry in ${retry}s`
          : `Rate limit${lim ? ` (${lim}/min)` : ""} bereikt — probeer over ${retry}s`);
      } else {
        const msg = (typeof detail === "string" ? detail : detail?.message) || (en ? "Translation failed" : "Vertaling mislukt");
        toast.error(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  const cls = size === "xs"
    ? "text-[10px] px-2 py-0.5"
    : "text-[11px] px-2.5 py-1";

  // While on cooldown, render a countdown chip instead of the normal button.
  if (cooldownRemaining > 0) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full border border-red-300 text-red-600 bg-red-50/50 dark:bg-red-500/10 font-semibold uppercase tracking-widest cursor-not-allowed ${cls}`}
        data-testid={`${testid}-cooldown`}
        title={en ? "AI translate rate limit — wait to retry" : "AI vertaal limiet — wacht om opnieuw te proberen"}
      >
        <Clock className="h-3 w-3" />
        {cooldownRemaining}s
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={busy || disabled}
      className={`inline-flex items-center gap-1 rounded-full border border-violet-300 text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-500/10 disabled:opacity-50 disabled:cursor-not-allowed font-semibold uppercase tracking-widest ${cls}`}
      data-testid={testid}
      title={en ? "Auto-translate with AI (Claude Sonnet 4.6)" : "Automatisch vertalen met AI (Claude Sonnet 4.6)"}
    >
      {busy
        ? <Loader2 className="h-3 w-3 animate-spin" />
        : <Sparkles className="h-3 w-3" />}
      {busy ? busyLabel : btnLabel}
    </button>
  );
};

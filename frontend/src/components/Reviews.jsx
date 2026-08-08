import React, { useEffect, useState } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import { Star, Send, CheckCircle2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Public share targets. Fill in the Google Place ID + Trustpilot review URL via env
// to activate one-click cross-posting to those platforms.
const GOOGLE_PLACE_ID = process.env.REACT_APP_GOOGLE_PLACE_ID || "";
const TRUSTPILOT_REVIEW_URL = process.env.REACT_APP_TRUSTPILOT_REVIEW_URL || "";
const FACEBOOK_PAGE_URL = process.env.REACT_APP_FACEBOOK_PAGE_URL || "";

const SHARE_TARGETS = [
  GOOGLE_PLACE_ID && {
    key: "google", label: "Google",
    url: `https://search.google.com/local/writereview?placeid=${GOOGLE_PLACE_ID}`,
    bg: "bg-white text-slate-800 border border-slate-200 hover:bg-slate-50",
  },
  TRUSTPILOT_REVIEW_URL && {
    key: "trustpilot", label: "Trustpilot",
    url: TRUSTPILOT_REVIEW_URL,
    bg: "bg-[#00b67a] text-white hover:bg-[#009f6a]",
  },
  FACEBOOK_PAGE_URL && {
    key: "facebook", label: "Facebook",
    url: `${FACEBOOK_PAGE_URL}/reviews`,
    bg: "bg-[#1877f2] text-white hover:bg-[#166fe0]",
  },
].filter(Boolean);

const StarPicker = ({ value, onChange }) => (
  <div className="flex items-center gap-1" data-testid="review-rating-picker">
    {[1, 2, 3, 4, 5].map((n) => (
      <button
        key={n}
        type="button"
        onClick={() => onChange(n)}
        aria-label={`${n} sterren`}
        data-testid={`review-star-${n}`}
        className={`p-0.5 transition-transform ${value >= n ? "text-pear-500" : "text-slate-300 dark:text-slate-600"} hover:scale-110`}
      >
        <Star className={`h-6 w-6 ${value >= n ? "fill-current" : ""}`} />
      </button>
    ))}
  </div>
);

export const ReviewForm = ({ compact = false, initialProject = "" }) => {
  const [form, setForm] = useState({ name: "", company: "", project: initialProject, rating: 5, quote: "" });
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const change = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (form.quote.trim().length < 10) {
      toast.error("Schrijf minstens 10 tekens in je review.");
      return;
    }
    setSending(true);
    try {
      await axios.post(`${API}/reviews`, form);
      setDone(true);
      toast.success("Bedankt! We publiceren je review na goedkeuring.");
    } catch { toast.error("Review verzenden mislukt. Probeer opnieuw."); } finally { setSending(false); }
  };

  if (done) {
    return (
      <div className="text-center py-8" data-testid="review-form-success">
        <div className="w-14 h-14 rounded-full bg-pear-100 text-pear-500 flex items-center justify-center mx-auto mb-4"><CheckCircle2 className="h-7 w-7" /></div>
        <p className="font-heading text-lg text-strong">Bedankt voor je review!</p>
        <p className="text-sm text-muted-fg mt-1">Onze admin bekijkt je bericht en publiceert het binnen 1 werkdag.</p>
        {SHARE_TARGETS.length > 0 && (
          <div className="mt-6 pt-6 border-t border-app" data-testid="review-share-panel">
            <p className="text-xs uppercase tracking-widest text-muted-fg mb-3">Plaats hem ook op</p>
            <div className="flex flex-wrap justify-center gap-2">
              {SHARE_TARGETS.map((t) => (
                <a key={t.key} href={t.url} target="_blank" rel="noreferrer"
                  data-testid={`review-share-${t.key}`}
                  className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors ${t.bg}`}>
                  {t.label} <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ))}
            </div>
            <p className="text-[11px] text-muted-fg mt-3">Één klik — je review wordt geopend op het gekozen platform.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={`space-y-4 ${compact ? "" : "max-w-xl"}`} data-testid="review-form">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg">Naam *</span>
          <input required value={form.name} onChange={change("name")} type="text" data-testid="review-input-name"
            className="mt-1 w-full rounded-xl surface-2 border border-transparent focus:border-pear-500 focus:ring-2 focus:ring-pear-500/20 px-4 py-2.5 text-sm outline-none text-strong" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg">Bedrijf</span>
          <input value={form.company} onChange={change("company")} type="text" data-testid="review-input-company"
            className="mt-1 w-full rounded-xl surface-2 border border-transparent focus:border-pear-500 focus:ring-2 focus:ring-pear-500/20 px-4 py-2.5 text-sm outline-none text-strong" />
        </label>
      </div>
      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg">Welk project?</span>
        <input value={form.project} onChange={change("project")} type="text" placeholder="Bijv. Bitdefender rollout" data-testid="review-input-project"
          className="mt-1 w-full rounded-xl surface-2 border border-transparent focus:border-pear-500 focus:ring-2 focus:ring-pear-500/20 px-4 py-2.5 text-sm outline-none text-strong" />
      </label>
      <div>
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg block mb-2">Beoordeling *</span>
        <StarPicker value={form.rating} onChange={(n) => setForm({ ...form, rating: n })} />
      </div>
      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg">Je review *</span>
        <textarea required rows={4} value={form.quote} onChange={change("quote")} data-testid="review-input-quote"
          minLength={10}
          className="mt-1 w-full rounded-xl surface-2 border border-transparent focus:border-pear-500 focus:ring-2 focus:ring-pear-500/20 px-4 py-2.5 text-sm outline-none text-strong resize-none" />
      </label>
      <button type="submit" disabled={sending} className="btn-primary w-full justify-center" data-testid="review-submit">
        {sending ? "Verzenden…" : <>Review versturen <Send className="h-4 w-4" /></>}
      </button>
    </form>
  );
};

export const ReviewStars = ({ rating, size = 4 }) => (
  <div className="flex items-center gap-0.5 text-pear-500">
    {[...Array(5)].map((_, i) => (
      <Star key={i} className={`h-${size} w-${size} ${i < rating ? "fill-current" : "opacity-30"}`} />
    ))}
  </div>
);

export const FeaturedReviews = () => {
  const [reviews, setReviews] = useState([]);
  useEffect(() => {
    axios.get(`${API}/reviews?featured=true`).then((r) => setReviews(r.data || [])).catch(() => setReviews([]));
  }, []);
  if (!reviews.length) return null;
  return (
    <section className="max-w-7xl mx-auto px-6 lg:px-10 py-20" data-testid="featured-reviews">
      <div className="max-w-2xl mb-10">
        <p className="overline mb-4">Klantverhalen</p>
        <h2 className="font-heading text-4xl sm:text-5xl font-medium tracking-tight text-strong">Wat onze klanten zeggen.</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {reviews.slice(0, 6).map((r, i) => (
          <motion.article
            key={r.id}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: i * 0.05 }}
            className="surface border border-app rounded-2xl p-6 card-lift"
            data-testid={`review-card-${i}`}
          >
            <ReviewStars rating={r.rating} />
            <p className="mt-4 text-strong/90 leading-relaxed">&ldquo;{r.quote}&rdquo;</p>
            <div className="mt-5 pt-4 border-t border-app">
              <p className="font-semibold text-strong text-sm">{r.name}</p>
              {(r.company || r.project) && <p className="text-xs text-muted-fg">{[r.company, r.project].filter(Boolean).join(" · ")}</p>}
            </div>
          </motion.article>
        ))}
      </div>
    </section>
  );
};

// Compact horizontally-scrollable reviews strip — fits under trust-stats block on the homepage.
export const FeaturedReviewsCompact = () => {
  const [reviews, setReviews] = useState([]);
  useEffect(() => {
    axios.get(`${API}/reviews?featured=true`).then((r) => setReviews(r.data || [])).catch(() => setReviews([]));
  }, []);
  if (!reviews.length) return null;
  return (
    <section className="max-w-7xl mx-auto px-6 lg:px-10 pb-12" data-testid="featured-reviews-compact">
      <div className="flex items-baseline justify-between mb-4">
        <p className="overline">Klantverhalen</p>
        {reviews.length > 3 && <span className="text-xs text-muted-fg">{reviews.length} reviews</span>}
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2 snap-x snap-mandatory">
        {reviews.slice(0, 8).map((r, i) => (
          <motion.article
            key={r.id}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.4, delay: i * 0.05 }}
            className="surface border border-app rounded-2xl p-5 min-w-[280px] max-w-[320px] snap-start shrink-0"
            data-testid={`review-card-compact-${i}`}
          >
            <ReviewStars rating={r.rating} />
            <p className="mt-3 text-sm text-strong/90 leading-relaxed line-clamp-4">&ldquo;{r.quote}&rdquo;</p>
            <div className="mt-4 pt-3 border-t border-app">
              <p className="font-semibold text-strong text-xs">{r.name}</p>
              {(r.company || r.project) && <p className="text-[11px] text-muted-fg truncate">{[r.company, r.project].filter(Boolean).join(" · ")}</p>}
            </div>
          </motion.article>
        ))}
      </div>
    </section>
  );
};

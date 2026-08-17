// useSiteSettings — reads the singleton SiteSettings doc and returns the
// visibility flags used across the public site. The GET /api/settings
// endpoint is public (read-only) so we can use it without auth on any page.
//
// The hook caches at module scope so multiple components fetching in the
// same paint cycle share a single request; CMS mutations bust the cache via
// `invalidateSiteSettingsCache()`.
import { useEffect, useState } from "react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DEFAULTS = {
  show_reviews: true,
  show_trust_stats: true,
  hero_bg_mode: "animated",
  hero_bg_video_url: "",
  hero_bg_video_poster: "",
  hero_bg_video_dim: 35,
  // Social — every channel defaults to empty so the footer hides them
  // until the admin fills one in.
  social_linkedin: "",
  social_facebook: "",
  social_instagram: "",
  social_twitter: "",
  social_youtube: "",
  social_tiktok: "",
  social_whatsapp: "",
  social_telegram: "",
  social_signal: "",
  social_discord: "",
  social_github: "",
  social_gitlab: "",
  social_behance: "",
  social_dribbble: "",
  social_medium: "",
  social_mastodon: "",
  social_bluesky: "",
  social_threads: "",
  social_vimeo: "",
  social_twitch: "",
  social_trustpilot: "",
  social_google_business: "",
  social_pinterest: "",
  social_reddit: "",
};

let _cache = null;
let _inFlight = null;

export const invalidateSiteSettingsCache = () => { _cache = null; };

const fetchOnce = async () => {
  if (_cache) return _cache;
  if (!_inFlight) {
    _inFlight = axios.get(`${API}/settings`).then((r) => {
      _cache = { ...DEFAULTS, ...(r.data || {}) };
      return _cache;
    }).catch(() => ({ ...DEFAULTS })).finally(() => { _inFlight = null; });
  }
  return _inFlight;
};

export const useSiteSettings = () => {
  const [settings, setSettings] = useState(_cache || DEFAULTS);
  useEffect(() => {
    let cancelled = false;
    fetchOnce().then((s) => { if (!cancelled) setSettings(s); });
    return () => { cancelled = true; };
  }, []);
  return settings;
};

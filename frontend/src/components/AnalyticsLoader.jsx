import { useEffect } from "react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const CONSENT_KEY = "pb_cookie_consent";

const readConsent = () => {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.choice || null;
  } catch { return null; }
};

const injectGa4 = (measurementId) => {
  if (!measurementId) return;
  if (document.querySelector(`script[data-ga4="${measurementId}"]`)) return;
  const s1 = document.createElement("script");
  s1.async = true;
  s1.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  s1.setAttribute("data-ga4", measurementId);
  document.head.appendChild(s1);
  const s2 = document.createElement("script");
  s2.setAttribute("data-ga4-init", measurementId);
  s2.text = `window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', '${measurementId}', {anonymize_ip: true});`;
  document.head.appendChild(s2);
};

const injectSearchConsole = (code) => {
  if (!code) return;
  if (document.querySelector('meta[name="google-site-verification"]')) return;
  const m = document.createElement("meta");
  m.name = "google-site-verification";
  m.content = code;
  document.head.appendChild(m);
};

export const AnalyticsLoader = () => {
  useEffect(() => {
    let cancelled = false;
    const apply = (settings) => {
      if (cancelled) return;
      injectSearchConsole(settings.search_console_verification);
      if (readConsent() === "accept") {
        injectGa4(settings.ga4_measurement_id);
      }
    };
    axios.get(`${API}/settings`).then((r) => apply(r.data || {})).catch(() => {});

    const onConsent = (e) => {
      if (e?.detail?.choice === "accept") {
        axios.get(`${API}/settings`).then((r) => injectGa4((r.data || {}).ga4_measurement_id)).catch(() => {});
      }
    };
    window.addEventListener("pb-cookie-consent", onConsent);
    return () => { cancelled = true; window.removeEventListener("pb-cookie-consent", onConsent); };
  }, []);
  return null;
};

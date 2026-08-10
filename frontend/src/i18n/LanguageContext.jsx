import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { translations } from "./translations";

const LanguageContext = createContext({ lang: "nl", setLang: () => {}, t: (k) => k });

const readCookie = (name) => {
  try {
    const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return m ? decodeURIComponent(m[1]) : null;
  } catch { return null; }
};
const writeCookie = (name, value, days = 365) => {
  try {
    const exp = new Date(Date.now() + days * 24 * 3600 * 1000).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${exp}; path=/; SameSite=Lax`;
  } catch { /* ignore */ }
};

export const LanguageProvider = ({ children }) => {
  const [lang, setLangState] = useState("nl");

  useEffect(() => {
    // priority: localStorage > cookie > browser
    const stored = localStorage.getItem("pb_lang") || readCookie("pb_lang");
    if (stored === "nl" || stored === "en") {
      setLangState(stored);
    } else {
      const browser = (navigator.language || "nl").toLowerCase();
      setLangState(browser.startsWith("nl") ? "nl" : "en");
    }
    // On mount (and whenever token changes), fetch backend pref and apply if
    // it differs. This syncs language across devices for logged-in users.
    const token = localStorage.getItem("pb_admin_token");
    if (token) {
      const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
      fetch(`${API}/auth/me/prefs`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.ok ? r.json() : null)
        .then((d) => {
          if (d && (d.lang === "nl" || d.lang === "en")) {
            localStorage.setItem("pb_lang", d.lang);
            writeCookie("pb_lang", d.lang);
            setLangState(d.lang);
          }
        })
        .catch(() => {});
    }
    // Also listen to storage events from other tabs/windows for real-time sync
    const onStorage = (e) => {
      if (e.key === "pb_lang" && (e.newValue === "nl" || e.newValue === "en")) {
        setLangState(e.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setLang = (l) => {
    localStorage.setItem("pb_lang", l);
    writeCookie("pb_lang", l);
    setLangState(l);
    // If logged in, sync to backend profile (best-effort, silent on failure)
    const token = localStorage.getItem("pb_admin_token");
    if (token) {
      const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
      fetch(`${API}/auth/me/prefs`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ lang: l }),
      }).catch(() => {});
    }
  };

  const t = useMemo(() => {
    return (key) => {
      const parts = key.split(".");
      let node = translations[lang];
      for (const p of parts) {
        if (node && p in node) node = node[p];
        else return key;
      }
      return node;
    };
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLang = () => useContext(LanguageContext);

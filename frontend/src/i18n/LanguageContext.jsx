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
      return;
    }
    const browser = (navigator.language || "nl").toLowerCase();
    setLangState(browser.startsWith("nl") ? "nl" : "en");
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

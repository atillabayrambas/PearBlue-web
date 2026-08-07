import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { translations } from "./translations";

const LanguageContext = createContext({ lang: "nl", setLang: () => {}, t: (k) => k });

export const LanguageProvider = ({ children }) => {
  const [lang, setLangState] = useState("nl");

  useEffect(() => {
    const stored = localStorage.getItem("pb_lang");
    if (stored === "nl" || stored === "en") {
      setLangState(stored);
      return;
    }
    const browser = (navigator.language || "nl").toLowerCase();
    setLangState(browser.startsWith("nl") ? "nl" : "en");
  }, []);

  const setLang = (l) => {
    localStorage.setItem("pb_lang", l);
    setLangState(l);
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

import React, { createContext, useContext, useEffect, useState } from "react";

// Three modes: 'light' | 'dark' | 'system'
const ThemeContext = createContext({ mode: "system", resolved: "light", setMode: () => {} });

const getSystemPref = () => (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

export const ThemeProvider = ({ children }) => {
  const [mode, setModeState] = useState("system");
  const [resolved, setResolved] = useState("light");

  useEffect(() => {
    const stored = localStorage.getItem("pb_theme_mode");
    if (stored === "light" || stored === "dark" || stored === "system") setModeState(stored);
  }, []);

  useEffect(() => {
    const apply = () => {
      const effective = mode === "system" ? getSystemPref() : mode;
      const root = document.documentElement;
      if (effective === "dark") root.classList.add("dark");
      else root.classList.remove("dark");
      root.setAttribute("data-theme", effective);
      setResolved(effective);
    };
    apply();
    localStorage.setItem("pb_theme_mode", mode);

    if (mode === "system" && window.matchMedia) {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => apply();
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [mode]);

  const setMode = (m) => setModeState(m);

  return (
    <ThemeContext.Provider value={{ mode, resolved, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

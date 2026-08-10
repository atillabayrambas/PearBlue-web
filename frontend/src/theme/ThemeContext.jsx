import React, { createContext, useContext, useEffect, useState } from "react";

// Three modes: 'light' | 'dark' | 'system'
const ThemeContext = createContext({ mode: "system", resolved: "light", setMode: () => {} });

const getSystemPref = () => (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

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

export const ThemeProvider = ({ children }) => {
  const [mode, setModeState] = useState("system");
  const [resolved, setResolved] = useState("light");

  useEffect(() => {
    const stored = localStorage.getItem("pb_theme_mode") || readCookie("pb_theme_mode");
    if (stored === "light" || stored === "dark" || stored === "system") setModeState(stored);
    // Fetch backend pref if logged in — this syncs theme across devices
    const token = localStorage.getItem("pb_admin_token");
    if (token) {
      const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
      fetch(`${API}/auth/me/prefs`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.ok ? r.json() : null)
        .then((d) => {
          if (d && ["light", "dark", "system"].includes(d.theme_mode)) {
            setModeState(d.theme_mode);
          }
        })
        .catch(() => {});
    }
    // Cross-tab sync via storage events
    const onStorage = (e) => {
      if (e.key === "pb_theme_mode" && ["light", "dark", "system"].includes(e.newValue)) {
        setModeState(e.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
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
    writeCookie("pb_theme_mode", mode);
    // Sync to profile if logged in
    const token = localStorage.getItem("pb_admin_token");
    if (token) {
      const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
      fetch(`${API}/auth/me/prefs`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ theme_mode: mode }),
      }).catch(() => {});
    }

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

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PortalAuthContext = createContext({
  loading: true,
  authenticated: false,
  user: null,
  refresh: async () => {},
  logout: async () => {},
});

export const PortalAuthProvider = ({ children }) => {
  const [state, setState] = useState({ loading: true, authenticated: false, user: null });

  const refresh = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/auth/portal/me`, { withCredentials: true });
      setState({ loading: false, authenticated: !!r.data.authenticated, user: r.data.user || null });
    } catch {
      setState({ loading: false, authenticated: false, user: null });
    }
  }, []);

  const logout = useCallback(async () => {
    try { await axios.post(`${API}/auth/portal/logout`, {}, { withCredentials: true }); } catch { /* ignore */ }
    // Also drop the CMS admin token so a single sign-out clears both sessions.
    try { localStorage.removeItem("pb_admin_token"); } catch { /* ignore */ }
    setState({ loading: false, authenticated: false, user: null });
    try { window.dispatchEvent(new Event("pb:logout")); } catch { /* ignore */ }
  }, []);

  // Sync state when the CMS AuthContext (or any other source) broadcasts.
  useEffect(() => {
    const clear = () => setState({ loading: false, authenticated: false, user: null });
    window.addEventListener("pb:logout", clear);
    return () => window.removeEventListener("pb:logout", clear);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <PortalAuthContext.Provider value={{ ...state, refresh, logout }}>
      {children}
    </PortalAuthContext.Provider>
  );
};

export const usePortalAuth = () => useContext(PortalAuthContext);

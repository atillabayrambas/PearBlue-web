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
    try { await axios.post(`${API}/auth/portal/logout`, {}, { withCredentials: true }); } catch {}
    setState({ loading: false, authenticated: false, user: null });
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <PortalAuthContext.Provider value={{ ...state, refresh, logout }}>
      {children}
    </PortalAuthContext.Provider>
  );
};

export const usePortalAuth = () => useContext(PortalAuthContext);

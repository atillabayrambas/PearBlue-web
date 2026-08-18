import React, { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const TOKEN_KEY = "pb_admin_token";

const AuthContext = createContext({
  token: null,
  user: null,
  login: async () => {},
  logout: () => {},
  isAdmin: false,
  authHeader: () => ({}),
});

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) { setLoading(false); return; }
    axios.get(`${API}/auth/me`, { headers: { Authorization: `Bearer ${stored}` } })
      .then((res) => { setToken(stored); setUser(res.data); })
      .catch(() => { localStorage.removeItem(TOKEN_KEY); })
      .finally(() => setLoading(false));
  }, []);

  // Cross-context sync: any logout (portal OR CMS) dispatches `pb:logout`,
  // and BOTH contexts drop their local state so the whole app agrees.
  useEffect(() => {
    const clear = () => {
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setUser(null);
    };
    window.addEventListener("pb:logout", clear);
    return () => window.removeEventListener("pb:logout", clear);
  }, []);

  const login = async (email, password) => {
    const res = await axios.post(`${API}/auth/login`, { email, password });
    const t = res.data.access_token;
    localStorage.setItem(TOKEN_KEY, t);
    setToken(t);
    setUser(res.data.user);
    return res.data.user;
  };

  const adoptToken = async (t) => {
    if (!t) return null;
    try {
      const res = await axios.get(`${API}/auth/me`, { headers: { Authorization: `Bearer ${t}` } });
      localStorage.setItem(TOKEN_KEY, t);
      setToken(t);
      setUser(res.data);
      return res.data;
    } catch {
      return null;
    }
  };

  const logout = () => {
    // Fire-and-forget the portal session logout on the server so the Zoho
    // session cookie is invalidated too — CMS logout and portal logout are
    // now unified (see PortalAuthContext for the mirror side).
    try { axios.post(`${API}/auth/portal/logout`, {}, { withCredentials: true }).catch(() => {}); } catch { /* ignore */ }
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    // Broadcast so PortalAuthContext (and any other subscriber) drops state.
    try { window.dispatchEvent(new Event("pb:logout")); } catch { /* ignore */ }
  };

  const authHeader = () => (token ? { Authorization: `Bearer ${token}` } : {});

  return (
    <AuthContext.Provider value={{ token, user, login, logout, adoptToken, isAdmin: !!token, authHeader, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

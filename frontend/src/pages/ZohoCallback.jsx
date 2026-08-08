import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";
import { Loader2, AlertCircle } from "lucide-react";
import { usePortalAuth } from "../auth/PortalAuthContext";
import { useAuth } from "../auth/AuthContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function ZohoCallback() {
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { refresh } = usePortalAuth();
  const { adoptToken } = useAuth();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const params = new URLSearchParams(location.search);
    const code = params.get("code");
    const state = params.get("state");
    const err = params.get("error");
    if (err) { setError(err); return; }
    if (!code || !state) { setError("Missing OAuth parameters"); return; }
    axios
      .post(`${API}/auth/zoho/exchange`, { code, state }, { withCredentials: true })
      .then(async (res) => {
        await refresh();
        if (res.data?.admin_token) {
          await adoptToken(res.data.admin_token);
          navigate("/admin", { replace: true });
        } else {
          navigate("/portal", { replace: true });
        }
      })
      .catch((e) => setError(e?.response?.data?.detail || e.message || "Zoho login mislukt"));
  }, [location.search, navigate, refresh, adoptToken]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6 py-16" data-testid="page-zoho-callback">
      {error ? (
        <div className="surface rounded-3xl border border-app p-10 max-w-md w-full text-center">
          <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-4" />
          <h1 className="font-heading text-xl font-semibold text-strong mb-2">Inloggen mislukt</h1>
          <p className="text-sm text-muted-fg mb-6" data-testid="zoho-callback-error">{typeof error === "string" ? error : "Onbekende fout"}</p>
          <button onClick={() => navigate("/portal")} className="btn-primary">Terug naar portaal</button>
        </div>
      ) : (
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-pear-500 mx-auto mb-3" />
          <p className="text-muted-fg text-sm">Inloggen met Zoho…</p>
        </div>
      )}
    </div>
  );
}

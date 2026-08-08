import React, { useEffect, useState } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import { Link, useLocation } from "react-router-dom";
import { LogIn, FileText, FolderKanban, LifeBuoy, LogOut, AlertCircle, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { usePageSeo } from "../hooks/usePageSeo";
import { Logo } from "../components/Logo";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const startLogin = () => {
  window.location.href = `${API}/auth/zoho/login`;
};

const useSection = (name, when) => {
  const [state, setState] = useState({ loading: false, data: null, error: null });
  useEffect(() => {
    if (!when) return;
    setState({ loading: true, data: null, error: null });
    axios.get(`${API}/portal/${name}`, { withCredentials: true })
      .then((r) => setState({ loading: false, data: r.data, error: null }))
      .catch((e) => setState({ loading: false, data: null, error: e?.response?.data?.detail || e.message }));
  }, [name, when]);
  return state;
};

const SectionCard = ({ icon: Icon, title, subtitle, state, empty, children }) => (
  <section className="surface border border-app rounded-3xl p-6" data-testid={`portal-section-${title.toLowerCase()}`}>
    <div className="flex items-center gap-3 mb-5">
      <div className="w-10 h-10 rounded-full bg-pear-100 text-pear-500 flex items-center justify-center"><Icon className="h-5 w-5" /></div>
      <div>
        <h3 className="font-heading text-lg font-semibold text-strong">{title}</h3>
        <p className="text-xs text-muted-fg">{subtitle}</p>
      </div>
    </div>
    {state.loading && <div className="flex items-center gap-2 text-muted-fg text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Laden…</div>}
    {state.error && (
      <div className="flex items-start gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-500/10 rounded-xl p-3">
        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
        <span>{typeof state.error === "string" ? state.error : "Kon gegevens niet ophalen."}</span>
      </div>
    )}
    {!state.loading && !state.error && state.data && children}
    {!state.loading && !state.error && !state.data && empty}
  </section>
);

export default function Portal() {
  usePageSeo({ title: "Klantportaal", description: "Bekijk je facturen, projecten en support tickets bij PearBlue.", path: "/portal" });
  const [me, setMe] = useState({ loading: true, authenticated: false, user: null });
  const location = useLocation();

  const loadMe = () => {
    setMe((m) => ({ ...m, loading: true }));
    axios.get(`${API}/auth/portal/me`, { withCredentials: true })
      .then((r) => setMe({ loading: false, authenticated: !!r.data.authenticated, user: r.data.user }))
      .catch(() => setMe({ loading: false, authenticated: false, user: null }));
  };

  useEffect(() => { loadMe(); }, []);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const err = params.get("error");
    if (err) toast.error(`Zoho login niet gelukt: ${err}`);
  }, [location.search]);

  const logout = async () => {
    await axios.post(`${API}/auth/portal/logout`, {}, { withCredentials: true });
    setMe({ loading: false, authenticated: false, user: null });
    toast.success("Uitgelogd");
  };

  const invoices = useSection("invoices", me.authenticated);
  const projects = useSection("projects", me.authenticated);
  const tickets = useSection("tickets", me.authenticated);

  if (me.loading) {
    return <div className="min-h-[60vh] flex items-center justify-center text-muted-fg"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Klantportaal laden…</div>;
  }

  if (!me.authenticated) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-6 py-16" data-testid="page-portal-login">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="surface rounded-3xl border border-app shadow-[0_30px_80px_rgba(10,25,47,0.08)] p-10 max-w-md w-full text-center">
          <div className="flex justify-center mb-6"><Logo size={44} showText={false} /></div>
          <h1 className="font-heading text-3xl font-semibold text-strong mb-2">Klantportaal</h1>
          <p className="text-sm text-muted-fg mb-8">Log in met je Zoho-account om je facturen, projecten en support-tickets te bekijken.</p>
          <button onClick={startLogin} className="btn-primary w-full justify-center" data-testid="portal-zoho-login">
            <LogIn className="h-4 w-4" /> Inloggen met Zoho
          </button>
          <p className="text-[11px] text-muted-fg mt-6">
            Nog geen Zoho-account? Vraag ons om toegang via <Link to="/contact" className="text-pear-500 underline">/contact</Link>.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-10 py-12" data-testid="page-portal">
      <div className="flex items-center justify-between gap-4 mb-10">
        <div>
          <p className="overline mb-2">Klantportaal</p>
          <h1 className="font-heading text-3xl sm:text-4xl font-medium text-strong">Welkom{me.user?.display_name ? `, ${me.user.display_name}` : ""}</h1>
          {me.user?.email && <p className="text-sm text-muted-fg mt-1">{me.user.email}</p>}
        </div>
        <button onClick={logout} className="btn-secondary" data-testid="portal-logout">
          <LogOut className="h-4 w-4" /> Uitloggen
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SectionCard icon={FileText} title="Facturen" subtitle="Zoho Books" state={invoices} empty={<p className="text-sm text-muted-fg">Geen facturen gevonden.</p>}>
          {(() => {
            const list = invoices.data?.invoices || invoices.data?.data || [];
            if (!list.length) return <p className="text-sm text-muted-fg">Geen facturen gevonden.</p>;
            return (
              <ul className="space-y-2 max-h-80 overflow-y-auto" data-testid="portal-invoices-list">
                {list.slice(0, 20).map((inv, i) => (
                  <li key={inv.invoice_id || i} className="flex items-center justify-between gap-3 rounded-xl surface-2 p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-strong truncate">{inv.invoice_number || inv.number || `#${i + 1}`}</p>
                      <p className="text-xs text-muted-fg truncate">{inv.customer_name || inv.date}</p>
                    </div>
                    <span className="text-sm font-medium text-pear-500 shrink-0">{inv.total || inv.balance || ""}</span>
                  </li>
                ))}
              </ul>
            );
          })()}
        </SectionCard>

        <SectionCard icon={FolderKanban} title="Projecten" subtitle="Zoho Projects" state={projects} empty={<p className="text-sm text-muted-fg">Geen projecten gevonden.</p>}>
          {(() => {
            const list = projects.data?.projects || [];
            if (!list.length) return <p className="text-sm text-muted-fg">Geen projecten gevonden.</p>;
            return (
              <ul className="space-y-2 max-h-80 overflow-y-auto" data-testid="portal-projects-list">
                {list.slice(0, 20).map((p, i) => (
                  <li key={p.id || i} className="flex items-center justify-between gap-3 rounded-xl surface-2 p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-strong truncate">{p.name}</p>
                      <p className="text-xs text-muted-fg truncate">{p.status || p.owner_name}</p>
                    </div>
                    {p.link?.self?.url && <a href={p.link.self.url} target="_blank" rel="noreferrer" className="text-pear-500"><ExternalLink className="h-4 w-4" /></a>}
                  </li>
                ))}
              </ul>
            );
          })()}
        </SectionCard>

        <SectionCard icon={LifeBuoy} title="Support tickets" subtitle="Zoho Desk" state={tickets} empty={<p className="text-sm text-muted-fg">Geen tickets gevonden.</p>}>
          {(() => {
            const list = tickets.data?.data || [];
            if (!list.length) return <p className="text-sm text-muted-fg">Geen tickets gevonden.</p>;
            return (
              <ul className="space-y-2 max-h-80 overflow-y-auto" data-testid="portal-tickets-list">
                {list.slice(0, 20).map((tk, i) => (
                  <li key={tk.id || i} className="flex items-center justify-between gap-3 rounded-xl surface-2 p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-strong truncate">#{tk.ticketNumber || i + 1} — {tk.subject}</p>
                      <p className="text-xs text-muted-fg truncate">{tk.status} · {tk.priority}</p>
                    </div>
                  </li>
                ))}
              </ul>
            );
          })()}
        </SectionCard>
      </div>
    </div>
  );
}

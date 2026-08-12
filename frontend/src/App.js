import React, { useEffect, useState } from "react";
import axios from "axios";
import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { ThemeProvider } from "@/theme/ThemeContext";
import { AuthProvider } from "@/auth/AuthContext";
import { PortalAuthProvider } from "@/auth/PortalAuthContext";
import { Toaster } from "@/components/ui/sonner";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Chatbot } from "@/components/Chatbot";
import { CookieBanner } from "@/components/CookieBanner";
import { AnalyticsLoader } from "@/components/AnalyticsLoader";
import { CustomScriptsInjector } from "@/components/CustomScriptsInjector";
import { ParallaxBackground } from "@/components/ParallaxBackground";
import Home from "@/pages/Home";
import About from "@/pages/About";
import Services from "@/pages/Services";
import Projects from "@/pages/Projects";
import Contact from "@/pages/Contact";
import Portal from "@/pages/Portal";
import PortalProfile from "@/pages/PortalProfile";
import ZohoCallback from "@/pages/ZohoCallback";
import ReviewInvitePage from "@/pages/ReviewInvitePage";
import PaymentSuccess from "@/pages/PaymentSuccess";
import ProjectDetail from "@/pages/ProjectDetail";
import TicketDetail from "@/pages/TicketDetail";
import TermsPage from "@/pages/TermsPage";
import PrivacyPage from "@/pages/PrivacyPage";
import PricingListPage from "@/pages/PricingListPage";
import ChangelogPage from "@/pages/ChangelogPage";
import AdminLogin from "@/pages/AdminLogin";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import AdminDashboard from "@/pages/AdminDashboard";
import MaintenancePage from "@/pages/MaintenancePage";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, [pathname]);
  return null;
};

const useIsAdminRoute = () => {
  const { pathname } = useLocation();
  return pathname.startsWith("/admin");
};

// Public-facing maintenance / coming-soon gate.
// - Polls /api/site/maintenance every 60s so mode changes flip live.
// - NEVER blocks /admin/* or the Zoho OAuth callback (staff always work).
// - Any user with an admin token in localStorage is treated as staff and passes.
// - Preview overrides: ?preview=maintenance or ?preview=coming_soon force-render
//   the matching splash page (used by the Preview buttons in the CMS) even when
//   the site is live.
const useMaintenance = () => {
  const { pathname, search } = useLocation();
  const [state, setState] = useState({ loaded: false, status: "live", config: null });
  useEffect(() => {
    let alive = true;
    const fetchIt = async () => {
      try {
        const r = await axios.get(`${API}/site/maintenance`);
        if (alive) setState({ loaded: true, status: r.data?.site_status || "live", config: r.data });
      } catch {
        if (alive) setState({ loaded: true, status: "live", config: null });
      }
    };
    fetchIt();
    const iv = setInterval(fetchIt, 60000);
    return () => { alive = false; clearInterval(iv); };
  }, []);
  const previewParam = new URLSearchParams(search).get("preview");
  const isAdminRoute = pathname.startsWith("/admin") || pathname.startsWith("/oauth");
  const hasAdminToken = typeof window !== "undefined" && !!localStorage.getItem("pb_admin_token");
  // Explicit preview always wins so admins can eyeball the splash from the CMS.
  if (previewParam === "maintenance" || previewParam === "coming_soon") {
    return { ...state, blocked: true, forceMode: previewParam };
  }
  const blocked = state.status !== "live" && !isAdminRoute && !hasAdminToken;
  return { ...state, blocked, forceMode: null };
};

function Shell() {
  const isAdmin = useIsAdminRoute();
  const m = useMaintenance();
  if (m.loaded && m.blocked) {
    return <MaintenancePage config={m.config} forceMode={m.forceMode} />;
  }
  return (
    <div className="min-h-screen flex flex-col relative">
      {!isAdmin && <ParallaxBackground />}
      {!isAdmin && <Navbar />}
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/over-ons" element={<About />} />
          <Route path="/diensten" element={<Services />} />
          <Route path="/portfolio" element={<Projects />} />
          <Route path="/projecten" element={<Projects />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/portal" element={<Portal />} />
          <Route path="/portal/profile" element={<PortalProfile />} />
          <Route path="/portal/profiel" element={<PortalProfile />} />
          <Route path="/portal/project/:projectId" element={<ProjectDetail />} />
          <Route path="/portal/ticket/:ticketId" element={<TicketDetail />} />
          <Route path="/portal/betaling-gelukt" element={<PaymentSuccess />} />
          <Route path="/oauth/zoho/callback" element={<ZohoCallback />} />
          <Route path="/review" element={<ReviewInvitePage />} />
          <Route path="/voorwaarden" element={<TermsPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacybeleid" element={<PrivacyPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/prijslijst" element={<PricingListPage />} />
          <Route path="/pricing" element={<PricingListPage />} />
          <Route path="/changelog" element={<ChangelogPage />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/reset-password" element={<ResetPasswordPage />} />
          <Route path="/admin/*" element={<AdminDashboard />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>
      {!isAdmin && <Footer />}
      {!isAdmin && <Chatbot />}
      {!isAdmin && <CookieBanner />}
      <AnalyticsLoader />
      <CustomScriptsInjector />
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <PortalAuthProvider>
            <BrowserRouter>
              <ScrollToTop />
              <Shell />
              <Toaster position="top-right" richColors />
            </BrowserRouter>
          </PortalAuthProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;

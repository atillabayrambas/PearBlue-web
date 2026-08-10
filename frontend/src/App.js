import React, { useEffect } from "react";
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

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, [pathname]);
  return null;
};

const useIsAdminRoute = () => {
  const { pathname } = useLocation();
  return pathname.startsWith("/admin");
};

function Shell() {
  const isAdmin = useIsAdminRoute();
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

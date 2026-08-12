import React, { useEffect, useState } from "react";
import { Navigate, Routes, Route, Link } from "react-router-dom";
import { motion } from "framer-motion";
import axios from "axios";
import { useAuth } from "../auth/AuthContext";
import { useLang } from "../i18n/LanguageContext";
import { AnalyticsAdmin } from "./AdminAnalytics";
import { FinancialsAdmin } from "./AdminFinancials";
import AdminMessageThread from "./AdminMessageThread";

import { API } from "../components/admin/_shared";
import { AdminSidebar } from "../components/admin/AdminSidebar";
import { PriorityAlerts, VersionAlertBar } from "../components/admin/PriorityAlerts";
import { ProjectsAdmin } from "../components/admin/ProjectsAdmin";
import { SettingsAdmin } from "../components/admin/SettingsAdmin";
import { MessagesAdmin } from "../components/admin/MessagesAdmin";
import { RegistrationsAdmin } from "../components/admin/RegistrationsAdmin";
import { ReviewsAdmin } from "../components/admin/ReviewsAdmin";
import { UsersAdmin } from "../components/admin/UsersAdmin";
import { ScriptsAdmin } from "../components/admin/ScriptsAdmin";
import { CybersecurityAdmin } from "../components/admin/CybersecurityAdmin";
import { FeedbackAdmin } from "../components/admin/FeedbackAdmin";
import { MailboxesAdmin } from "../components/admin/MailboxesAdmin";
import { BrevoAdmin } from "../components/admin/BrevoAdmin";
import { VirusScannerAdmin } from "../components/admin/VirusScannerAdmin";
import { ChangelogAdmin } from "../components/admin/ChangelogAdmin";

const RequireAdmin = ({ children }) => {
  const { isAdmin, loading } = useAuth();
  if (loading) return <div className="p-10 text-center text-muted-fg">Laden…</div>;
  if (!isAdmin) return <Navigate to="/admin/login" replace />;
  return children;
};

const AdminLayout = ({ children }) => {
  const [currentVersion, setCurrentVersion] = useState(null);
  const { lang } = useLang();
  useEffect(() => {
    axios.get(`${API}/changelog`)
      .then((r) => setCurrentVersion(r.data?.current || null))
      .catch(() => {});
  }, []);
  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-10 py-10">
      <div className="mb-6 text-sm hidden lg:block">
        <Link to="/" className="text-muted-fg hover:text-pear-500">← {lang === "en" ? "Back to site" : "Terug naar site"}</Link>
      </div>
      <div className="flex flex-col lg:flex-row gap-8">
        <AdminSidebar />
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex-1 min-w-0">
          <PriorityAlerts />
          <VersionAlertBar currentVersion={currentVersion} />
          {children}
        </motion.div>
      </div>
    </div>
  );
};

export default function AdminDashboard() {
  return (
    <RequireAdmin>
      <AdminLayout>
        <Routes>
          <Route index element={<AnalyticsAdmin />} />
          <Route path="portfolio" element={<ProjectsAdmin />} />
          <Route path="analytics" element={<AnalyticsAdmin />} />
          <Route path="financials" element={<FinancialsAdmin />} />
          <Route path="registrations" element={<RegistrationsAdmin />} />
          <Route path="reviews" element={<ReviewsAdmin />} />
          <Route path="users" element={<UsersAdmin />} />
          <Route path="scripts" element={<ScriptsAdmin />} />
          <Route path="settings" element={<SettingsAdmin />} />
          <Route path="messages" element={<MessagesAdmin />} />
          <Route path="messages/:msgId" element={<AdminMessageThread />} />
          <Route path="feedback" element={<FeedbackAdmin />} />
          <Route path="cybersecurity" element={<CybersecurityAdmin />} />
          <Route path="virusscanner" element={<VirusScannerAdmin />} />
          <Route path="mailboxes" element={<MailboxesAdmin />} />
          <Route path="mailmarketing" element={<BrevoAdmin />} />
          <Route path="changelog" element={<ChangelogAdmin />} />
        </Routes>
      </AdminLayout>
    </RequireAdmin>
  );
}

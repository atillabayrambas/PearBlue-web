import React, { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { LogIn, Lock, Mail } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../auth/AuthContext";
import { Logo } from "../components/Logo";

export default function AdminLogin() {
  const { login, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (isAdmin) return <Navigate to="/projecten" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(email, password);
      toast.success("Welkom terug, Admin.");
      navigate("/projecten");
    } catch (err) {
      toast.error("Onjuiste inloggegevens.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center px-6 py-16" data-testid="page-admin-login">
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="surface rounded-3xl border border-app shadow-[0_30px_80px_rgba(10,25,47,0.08)] p-10 w-full max-w-md">
        <div className="flex justify-center mb-6"><Logo size={40} showText={false} /></div>
        <h1 className="font-heading text-3xl font-semibold text-strong text-center mb-2">Admin Login</h1>
        <p className="text-sm text-muted-fg text-center mb-8">Log in om projecten te beheren.</p>

        <form onSubmit={submit} className="space-y-4" data-testid="admin-login-form">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg">E-mail</span>
            <div className="mt-1.5 relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-fg" />
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                data-testid="admin-input-email" autoComplete="username"
                className="w-full rounded-xl surface-2 border border-transparent focus:border-pear-500 focus:ring-2 focus:ring-pear-500/20 pl-11 pr-4 py-3 text-sm outline-none text-strong" />
            </div>
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg">Wachtwoord</span>
            <div className="mt-1.5 relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-fg" />
              <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                data-testid="admin-input-password" autoComplete="current-password"
                className="w-full rounded-xl surface-2 border border-transparent focus:border-pear-500 focus:ring-2 focus:ring-pear-500/20 pl-11 pr-4 py-3 text-sm outline-none text-strong" />
            </div>
          </label>
          <button type="submit" disabled={submitting} className="btn-primary w-full justify-center" data-testid="admin-login-submit">
            {submitting ? "Bezig…" : <>Inloggen <LogIn className="h-4 w-4" /></>}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

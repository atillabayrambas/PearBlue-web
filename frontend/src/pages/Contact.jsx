import React, { useState } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import { Mail, Phone, MapPin, Clock, Send, CheckCircle2 } from "lucide-react";
import { useLang } from "../i18n/LanguageContext";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Contact() {
  const { t, lang } = useLang();
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "", subject: "", message: "" });
  const [status, setStatus] = useState("idle"); // idle | submitting | success | error

  const change = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setStatus("submitting");
    try {
      await axios.post(`${API}/contact`, { ...form, language: lang });
      setStatus("success");
      toast.success(t("contact.success"));
      setForm({ name: "", email: "", phone: "", company: "", subject: "", message: "" });
    } catch (err) {
      console.error(err);
      setStatus("error");
      toast.error(t("contact.error"));
    }
  };

  return (
    <div data-testid="page-contact">
      <section className="max-w-7xl mx-auto px-6 lg:px-10 pt-16 lg:pt-24 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-5">
            <p className="overline mb-4">{t("contact.eyebrow")}</p>
            <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
              className="font-heading text-4xl sm:text-5xl lg:text-6xl font-light tracking-tighter text-pear-900 leading-[1.05]" data-testid="contact-title">
              {t("contact.title")}
            </motion.h1>
            <p className="mt-5 text-lg text-pear-900/70 leading-relaxed max-w-md">{t("contact.subtitle")}</p>

            <div className="mt-10 space-y-6">
              <div>
                <h3 className="font-heading font-semibold text-pear-900 mb-3">{t("contact.info_title")}</h3>
                <ul className="space-y-3 text-sm text-pear-900/80">
                  <li className="flex items-start gap-3"><Mail className="h-4 w-4 text-pear-500 mt-0.5" /><span><strong className="block text-xs uppercase tracking-widest text-pear-900/50 mb-0.5">{t("contact.info_email")}</strong>info@pearblue.nl</span></li>
                  <li className="flex items-start gap-3"><Phone className="h-4 w-4 text-pear-500 mt-0.5" /><span><strong className="block text-xs uppercase tracking-widest text-pear-900/50 mb-0.5">{t("contact.info_phone")}</strong>+31 (0)6 1234 5678</span></li>
                  <li className="flex items-start gap-3"><MapPin className="h-4 w-4 text-pear-500 mt-0.5" /><span><strong className="block text-xs uppercase tracking-widest text-pear-900/50 mb-0.5">{t("contact.info_address")}</strong>Nederland</span></li>
                </ul>
              </div>
              <div>
                <h3 className="font-heading font-semibold text-pear-900 mb-3">{t("contact.hours_title")}</h3>
                <p className="text-sm text-pear-900/70 flex items-center gap-2"><Clock className="h-4 w-4 text-pear-500" /> {t("contact.hours")}</p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_30px_60px_rgba(10,25,47,0.06)] p-8 lg:p-10">
              {status === "success" ? (
                <div className="flex flex-col items-center justify-center text-center py-16" data-testid="contact-success">
                  <div className="w-16 h-16 rounded-full bg-pear-100 text-pear-500 flex items-center justify-center mb-5">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <h3 className="font-heading text-2xl font-medium text-pear-900 mb-2">{t("contact.success")}</h3>
                  <button onClick={() => setStatus("idle")} className="btn-secondary mt-6" data-testid="contact-new-message">
                    {lang === "nl" ? "Nieuw bericht" : "New message"}
                  </button>
                </div>
              ) : (
              <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-5" data-testid="contact-form">
                <label className="block md:col-span-1">
                  <span className="text-xs font-semibold uppercase tracking-widest text-pear-900/60">{t("contact.name")} *</span>
                  <input required value={form.name} onChange={change("name")} type="text" data-testid="contact-input-name"
                    className="mt-1.5 w-full rounded-xl bg-slate-50 border border-transparent focus:border-pear-500 focus:bg-white focus:ring-2 focus:ring-pear-500/20 px-4 py-3 text-sm outline-none transition-colors" />
                </label>
                <label className="block md:col-span-1">
                  <span className="text-xs font-semibold uppercase tracking-widest text-pear-900/60">{t("contact.email")} *</span>
                  <input required value={form.email} onChange={change("email")} type="email" data-testid="contact-input-email"
                    className="mt-1.5 w-full rounded-xl bg-slate-50 border border-transparent focus:border-pear-500 focus:bg-white focus:ring-2 focus:ring-pear-500/20 px-4 py-3 text-sm outline-none transition-colors" />
                </label>
                <label className="block md:col-span-1">
                  <span className="text-xs font-semibold uppercase tracking-widest text-pear-900/60">{t("contact.phone")}</span>
                  <input value={form.phone} onChange={change("phone")} type="tel" data-testid="contact-input-phone"
                    className="mt-1.5 w-full rounded-xl bg-slate-50 border border-transparent focus:border-pear-500 focus:bg-white focus:ring-2 focus:ring-pear-500/20 px-4 py-3 text-sm outline-none transition-colors" />
                </label>
                <label className="block md:col-span-1">
                  <span className="text-xs font-semibold uppercase tracking-widest text-pear-900/60">{t("contact.company")}</span>
                  <input value={form.company} onChange={change("company")} type="text" data-testid="contact-input-company"
                    className="mt-1.5 w-full rounded-xl bg-slate-50 border border-transparent focus:border-pear-500 focus:bg-white focus:ring-2 focus:ring-pear-500/20 px-4 py-3 text-sm outline-none transition-colors" />
                </label>
                <label className="block md:col-span-2">
                  <span className="text-xs font-semibold uppercase tracking-widest text-pear-900/60">{t("contact.subject")}</span>
                  <input value={form.subject} onChange={change("subject")} type="text" data-testid="contact-input-subject"
                    className="mt-1.5 w-full rounded-xl bg-slate-50 border border-transparent focus:border-pear-500 focus:bg-white focus:ring-2 focus:ring-pear-500/20 px-4 py-3 text-sm outline-none transition-colors" />
                </label>
                <label className="block md:col-span-2">
                  <span className="text-xs font-semibold uppercase tracking-widest text-pear-900/60">{t("contact.message")} *</span>
                  <textarea required value={form.message} onChange={change("message")} rows={6} data-testid="contact-input-message"
                    className="mt-1.5 w-full rounded-xl bg-slate-50 border border-transparent focus:border-pear-500 focus:bg-white focus:ring-2 focus:ring-pear-500/20 px-4 py-3 text-sm outline-none resize-none transition-colors" />
                </label>
                <div className="md:col-span-2">
                  <button type="submit" disabled={status === "submitting"} className="btn-primary" data-testid="contact-submit">
                    {status === "submitting" ? t("contact.submitting") : (<>{t("contact.submit")} <Send className="h-4 w-4" /></>)}
                  </button>
                </div>
              </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

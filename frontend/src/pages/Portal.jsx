import React, { useEffect, useState } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import { Link, useLocation } from "react-router-dom";
import { LogIn, FileText, FolderKanban, LifeBuoy, LogOut, AlertCircle, Loader2, Star, ShieldCheck, Download, Eye, Printer, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { usePageSeo } from "../hooks/usePageSeo";
import { Logo } from "../components/Logo";
import { ReviewForm } from "../components/Reviews";
import { LocalCaptcha, ConsentText } from "../components/LocalCaptcha";
import { COUNTRIES } from "../data/countries";
import { Avatar } from "../components/Avatar";
import { PhoneInput } from "../components/PhoneInput";
import { usePostalLookup } from "../hooks/usePostalLookup";
import { useAuth } from "../auth/AuthContext";
import { useLang } from "../i18n/LanguageContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PT = {
  loading: { nl: "Klantportaal laden…", en: "Loading client portal…" },
  sectionLoading: { nl: "Laden…", en: "Loading…" },
  sectionError: { nl: "Kon gegevens niet ophalen.", en: "Could not load data." },
  existingCustomer: { nl: "Bestaande klant?", en: "Existing customer?" },
  existingIntro: { nl: "Log in met je Zoho-account om je facturen, projecten en support-tickets te bekijken.", en: "Sign in with your Zoho account to view your invoices, projects and support tickets." },
  loginZoho: { nl: "Inloggen met Zoho", en: "Sign in with Zoho" },
  noAccessTitle: { nl: "Nog geen toegang?", en: "No access yet?" },
  noAccessIntro: { nl: "Vraag toegang aan tot je klantportaal — wij nemen contact op zodra je account klaarstaat.", en: "Request access to your client portal — we'll be in touch as soon as your account is ready." },
  headerHi: { nl: "Hallo", en: "Hi" },
  logout: { nl: "Uitloggen", en: "Sign out" },
  manage: { nl: "Beheer", en: "Manage" },
  invoices: { nl: "Facturen", en: "Invoices" },
  projects: { nl: "Projecten", en: "Projects" },
  tickets: { nl: "Support tickets", en: "Support tickets" },
  view: { nl: "Bekijken", en: "View" },
  pdf: { nl: "PDF", en: "PDF" },
  print: { nl: "Print", en: "Print" },
  payNow: { nl: "Betaal nu", en: "Pay now" },
  open: { nl: "open", en: "open" },
  noInvoices: { nl: "Geen facturen gevonden.", en: "No invoices found." },
  noProjects: { nl: "Geen projecten gevonden.", en: "No projects found." },
  noTickets: { nl: "Geen tickets gevonden.", en: "No tickets found." },
  leaveReview: { nl: "Laat een review achter", en: "Leave a review" },
  reviewIntro: { nl: "Tevreden over ons werk? We waarderen je feedback enorm — na goedkeuring plaatsen we hem op de site.", en: "Happy with our work? We'd love your feedback — once approved we'll feature it on the site." },
  regName: { nl: "Naam", en: "Name" },
  regEmail: { nl: "E-mailadres", en: "Email" },
  regCompany: { nl: "Bedrijfsnaam", en: "Company" },
  regPhone: { nl: "Telefoon", en: "Phone" },
  regMessage: { nl: "Bericht", en: "Message" },
  regSubmit: { nl: "Toegang aanvragen", en: "Request access" },
  regBusy: { nl: "Bezig…", en: "Sending…" },
  regThanks: { nl: "Bedankt!", en: "Thanks!" },
  regThanksIntro: { nl: "We beoordelen je aanvraag en sturen je een e-mail zodra je toegang hebt.", en: "We'll review your request and email you as soon as you have access." },
  regSuccessToast: { nl: "Aanvraag ontvangen! We nemen zo snel mogelijk contact op.", en: "Request received! We'll be in touch soon." },
  regErrorToast: { nl: "Aanvraag mislukt. Probeer het later opnieuw.", en: "Request failed. Please try again later." },
};

const startLogin = () => {
  window.location.href = `${API}/auth/zoho/login`;
};

const RegistrationForm = () => {
  const { lang } = useLang();
  const t = (k) => PT[k]?.[lang] || PT[k]?.nl || k;
  const { lookup } = usePostalLookup();
  const [form, setForm] = useState({ name: "", email: "", company: "", phone: "", message: "", address: "", postal_code: "", house_number: "", city: "", region: "", country: "NL" });
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [captchaOk, setCaptchaOk] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const change = (k) => (e) => setForm({ ...form, [k]: e.target.value, ...(k === "country" ? { region: "" } : {}) });
  const country = COUNTRIES.find((c) => c.code === form.country) || COUNTRIES[0];

  const autofill = async () => {
    if (!form.postal_code || form.country !== "NL") return;
    setLookingUp(true);
    const res = await lookup(form.postal_code, form.house_number);
    setLookingUp(false);
    if (!res) return;
    setForm((f) => ({
      ...f,
      address: res.street ? `${res.street}${f.house_number ? " " + f.house_number : ""}` : f.address,
      city: res.city || f.city,
      region: res.region || f.region,
    }));
  };
  const submit = async (e) => {
    e.preventDefault();
    if (!captchaOk) { toast.error(lang === "en" ? "Please confirm you are not a robot" : "Bevestig eerst dat je geen robot bent"); return; }
    // Required fields per user request: address + postal_code
    if (!form.address || !form.postal_code) {
      toast.error(lang === "en" ? "Please fill in your address and postal code" : "Vul je adres en postcode in");
      return;
    }
    setSending(true);
    try {
      await axios.post(`${API}/portal/register`, {
        ...form,
        country: country ? (lang === "en" ? country.en : country.nl) : form.country,
        language: lang,
      });
      setDone(true);
      toast.success(t("regSuccessToast"));
    } catch (err) {
      toast.error(t("regErrorToast"));
    } finally {
      setSending(false);
    }
  };
  if (done) {
    return (
      <div className="text-center py-6" data-testid="portal-register-success">
        <p className="font-heading text-lg text-strong mb-2">{t("regThanks")}</p>
        <p className="text-sm text-muted-fg">{t("regThanksIntro")}</p>
      </div>
    );
  }
  return (
    <form onSubmit={submit} className="space-y-3" data-testid="portal-register-form">
      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg">{t("regName")} *</span>
        <input required value={form.name} onChange={change("name")} type="text" data-testid="portal-reg-name"
          className="mt-1 w-full rounded-xl surface-2 border border-transparent focus:border-pear-500 focus:ring-2 focus:ring-pear-500/20 px-4 py-2.5 text-sm outline-none text-strong" />
      </label>
      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg">{t("regEmail")} *</span>
        <input required value={form.email} onChange={change("email")} type="email" data-testid="portal-reg-email"
          className="mt-1 w-full rounded-xl surface-2 border border-transparent focus:border-pear-500 focus:ring-2 focus:ring-pear-500/20 px-4 py-2.5 text-sm outline-none text-strong" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg">{t("regCompany")}</span>
          <input value={form.company} onChange={change("company")} type="text" data-testid="portal-reg-company"
            className="mt-1 w-full rounded-xl surface-2 border border-transparent focus:border-pear-500 focus:ring-2 focus:ring-pear-500/20 px-4 py-2.5 text-sm outline-none text-strong" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg">{t("regPhone")}</span>
          <div className="mt-1">
            <PhoneInput value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} testid="portal-reg-phone" />
          </div>
        </label>
      </div>
      {/* Address block — postcode + house number drives the auto-fill of city/region on NL */}
      <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
        <label className="block sm:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg">{lang === "en" ? "Postal code" : "Postcode"} *</span>
          <input required value={form.postal_code} onChange={change("postal_code")} onBlur={autofill} type="text" placeholder="1234AB" data-testid="portal-reg-postal"
            className="mt-1 w-full rounded-xl surface-2 border border-transparent focus:border-pear-500 focus:ring-2 focus:ring-pear-500/20 px-4 py-2.5 text-sm outline-none text-strong uppercase" />
        </label>
        <label className="block sm:col-span-1">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg">{lang === "en" ? "House #" : "Huisnr."}</span>
          <input value={form.house_number} onChange={change("house_number")} onBlur={autofill} type="text" data-testid="portal-reg-house"
            className="mt-1 w-full rounded-xl surface-2 border border-transparent focus:border-pear-500 focus:ring-2 focus:ring-pear-500/20 px-4 py-2.5 text-sm outline-none text-strong" />
        </label>
        <label className="block sm:col-span-3">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg">{lang === "en" ? "Address" : "Adres"} *</span>
          <input required value={form.address} onChange={change("address")} type="text" placeholder={lang === "en" ? "Auto-filled from postcode" : "Wordt automatisch ingevuld"} data-testid="portal-reg-address"
            className="mt-1 w-full rounded-xl surface-2 border border-transparent focus:border-pear-500 focus:ring-2 focus:ring-pear-500/20 px-4 py-2.5 text-sm outline-none text-strong" />
        </label>
      </div>
      {lookingUp && <p className="text-[11px] text-muted-fg -mt-2">{lang === "en" ? "Looking up address…" : "Adres opzoeken…"}</p>}
      {/* City/country/region row — auto-filled but overridable */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg">{lang === "en" ? "City" : "Plaats"}</span>
          <input value={form.city} onChange={change("city")} type="text" data-testid="portal-reg-city"
            className="mt-1 w-full rounded-xl surface-2 border border-transparent focus:border-pear-500 focus:ring-2 focus:ring-pear-500/20 px-4 py-2.5 text-sm outline-none text-strong" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg">{lang === "en" ? "Country" : "Land"}</span>
          <select value={form.country} onChange={change("country")} data-testid="portal-reg-country"
            className="mt-1 w-full rounded-xl surface-2 border border-transparent focus:border-pear-500 focus:ring-2 focus:ring-pear-500/20 px-4 py-2.5 text-sm outline-none text-strong">
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.flag} {lang === "en" ? c.en : c.nl}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg leading-tight" title={lang === "en" ? "Region / province" : "Regio / provincie"}>
            {lang === "en" ? "Region" : "Regio"}
          </span>
          {(country?.regions || []).length > 0 ? (
            <select value={form.region} onChange={change("region")} data-testid="portal-reg-region"
              className="mt-1 w-full rounded-xl surface-2 border border-transparent focus:border-pear-500 focus:ring-2 focus:ring-pear-500/20 px-4 py-2.5 text-sm outline-none text-strong">
              <option value="">{lang === "en" ? "— Choose —" : "— Kies —"}</option>
              {country.regions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          ) : (
            <input value={form.region} onChange={change("region")} type="text" placeholder={lang === "en" ? "State / region" : "Staat / regio"} data-testid="portal-reg-region"
              className="mt-1 w-full rounded-xl surface-2 border border-transparent focus:border-pear-500 focus:ring-2 focus:ring-pear-500/20 px-4 py-2.5 text-sm outline-none text-strong" />
          )}
        </label>
      </div>
      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-fg">{t("regMessage")}</span>
        <textarea rows={3} value={form.message} onChange={change("message")} data-testid="portal-reg-message"
          className="mt-1 w-full rounded-xl surface-2 border border-transparent focus:border-pear-500 focus:ring-2 focus:ring-pear-500/20 px-4 py-2.5 text-sm outline-none resize-none text-strong" />
      </label>
      <button type="submit" disabled={sending || !captchaOk} className="btn-primary w-full justify-center disabled:opacity-50" data-testid="portal-reg-submit">
        {sending ? t("regBusy") : t("regSubmit")}
      </button>
      <LocalCaptcha onChange={setCaptchaOk} />
      <ConsentText context="portal-register" />
    </form>
  );
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

const SectionCard = ({ icon: Icon, title, subtitle, state, empty, children }) => {
  const { lang } = useLang();
  const t = (k) => PT[k]?.[lang] || PT[k]?.nl || k;
  return (
    <section className="surface border border-app rounded-3xl p-6" data-testid={`portal-section-${title.toLowerCase()}`}>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-full bg-pear-100 text-pear-500 flex items-center justify-center"><Icon className="h-5 w-5" /></div>
        <div>
          <h3 className="font-heading text-lg font-semibold text-strong">{title}</h3>
          <p className="text-xs text-muted-fg">{subtitle}</p>
        </div>
      </div>
      {state.loading && <div className="flex items-center gap-2 text-muted-fg text-sm"><Loader2 className="h-4 w-4 animate-spin" /> {t("sectionLoading")}</div>}
      {state.error && (
        <div className="flex items-start gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-500/10 rounded-xl p-3">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{typeof state.error === "string" ? state.error : t("sectionError")}</span>
        </div>
      )}
      {!state.loading && !state.error && state.data && children}
      {!state.loading && !state.error && !state.data && empty}
    </section>
  );
};

export default function Portal() {
  const { lang } = useLang();
  const t = (k) => PT[k]?.[lang] || PT[k]?.nl || k;
  usePageSeo({
    title: lang === "en" ? "Client portal" : "Klantportaal",
    description: lang === "en" ? "View your invoices, projects and support tickets at PearBlue." : "Bekijk je facturen, projecten en support tickets bij PearBlue.",
    path: "/portal",
  });
  const [me, setMe] = useState({ loading: true, authenticated: false, user: null });
  const [pdfPreview, setPdfPreview] = useState(null); // { url, invoice_id }
  const location = useLocation();
  const { isAdmin } = useAuth();

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
    if (err) toast.error(`${lang === "en" ? "Zoho login failed" : "Zoho login niet gelukt"}: ${err}`);
  }, [location.search]);

  const logout = async () => {
    await axios.post(`${API}/auth/portal/logout`, {}, { withCredentials: true });
    setMe({ loading: false, authenticated: false, user: null });
    toast.success(lang === "en" ? "Signed out" : "Uitgelogd");
  };

  const invoices = useSection("invoices", me.authenticated);
  const projects = useSection("projects", me.authenticated);
  const tickets = useSection("tickets", me.authenticated);

  if (me.loading) {
    return <div className="min-h-[60vh] flex items-center justify-center text-muted-fg"><Loader2 className="h-5 w-5 animate-spin mr-2" /> {t("loading")}</div>;
  }

  if (!me.authenticated) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-6 py-16" data-testid="page-portal-login">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="surface rounded-3xl border border-app shadow-[0_30px_80px_rgba(10,25,47,0.08)] p-10 text-center">
            <div className="flex justify-center mb-6"><Logo size={72} iconOnly showText={false} /></div>
            <h1 className="font-heading text-2xl sm:text-3xl font-semibold text-strong mb-2">{t("existingCustomer")}</h1>
            <p className="text-sm text-muted-fg mb-8">{t("existingIntro")}</p>
            <button onClick={startLogin} className="btn-primary w-full justify-center" data-testid="portal-zoho-login">
              <LogIn className="h-4 w-4" /> {t("loginZoho")}
            </button>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
            className="surface rounded-3xl border border-app shadow-[0_30px_80px_rgba(10,25,47,0.08)] p-10">
            <h2 className="font-heading text-2xl font-semibold text-strong mb-2">{t("noAccessTitle")}</h2>
            <p className="text-sm text-muted-fg mb-6">{t("noAccessIntro")}</p>
            <RegistrationForm />
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-10 py-12" data-testid="page-portal">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-10">
        <div className="flex items-center gap-4 min-w-0">
          <Avatar
            name={me.user?.display_name || me.user?.email}
            email={me.user?.email}
            profilePicture={me.user?.profile_picture}
            size={56}
          />
          <div className="min-w-0">
            <p className="overline mb-2">{lang === "en" ? "Client portal" : "Klantportaal"}</p>
            <h1 className="font-heading text-2xl sm:text-3xl md:text-4xl font-medium text-strong break-words">{t("headerHi")}{me.user?.display_name ? `, ${me.user.display_name}` : ""}</h1>
            {me.user?.email && <p className="text-sm text-muted-fg mt-1 break-all">{me.user.email}</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {isAdmin && (
            <Link to="/admin" className="btn-primary !px-4 !py-2 !text-xs" data-testid="portal-admin-shortcut">
              <ShieldCheck className="h-4 w-4" /> {t("manage")}
            </Link>
          )}
          <Link to="/portal/profile" className="btn-secondary !px-4 !py-2 !text-xs" data-testid="portal-profile-link">
            {lang === "en" ? "My profile" : "Mijn profiel"}
          </Link>
          <button onClick={logout} className="btn-secondary !px-4 !py-2 !text-xs" data-testid="portal-logout">
            <LogOut className="h-4 w-4" /> {t("logout")}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SectionCard icon={FileText} title={t("invoices")} subtitle="Zoho Books" state={invoices} empty={<p className="text-sm text-muted-fg">{t("noInvoices")}</p>}>
          {(() => {
            const list = invoices.data?.invoices || invoices.data?.data || [];
            if (!list.length) return <p className="text-sm text-muted-fg">{t("noInvoices")}</p>;
            const payInvoice = async (invoice_id) => {
              try {
                const r = await axios.post(
                  `${API}/payments/invoice-checkout`,
                  { invoice_id, origin_url: window.location.origin },
                  { withCredentials: true }
                );
                if (r.data?.checkout_url) window.location.href = r.data.checkout_url;
              } catch (e) {
                toast.error(e?.response?.data?.detail || (lang === "en" ? "Could not start Stripe checkout" : "Kon Stripe checkout niet starten"));
              }
            };
            const fmtAmount = (val, currency = "EUR") => {
              if (val == null || val === "") return "—";
              const n = typeof val === "number" ? val : parseFloat(String(val).replace(/[^\d.-]/g, ""));
              if (isNaN(n)) return String(val);
              try {
                return new Intl.NumberFormat("nl-NL", { style: "currency", currency }).format(n);
              } catch { return `€ ${n.toFixed(2)}`; }
            };
            // PDF backend needs the portal-session cookie — fetch as blob then use it 3 ways:
            //  · View → inline modal
            //  · PDF  → open blob URL in new tab (uses temp URL, no re-auth needed)
            //  · Print → open blob URL in new window and trigger print()
            const fetchPdfBlob = async (invoice_id) => {
              try {
                const res = await axios.get(`${API}/portal/invoices/${invoice_id}/pdf`, {
                  responseType: "blob",
                  withCredentials: true,
                });
                return URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
              } catch (e) {
                toast.error(lang === "en" ? "Could not load PDF" : "Kon PDF niet laden");
                return null;
              }
            };
            const openPdfNewTab = async (invoice_id) => {
              const url = await fetchPdfBlob(invoice_id);
              if (url) window.open(url, "_blank", "noopener,noreferrer");
            };
            const printPdf = async (invoice_id) => {
              const url = await fetchPdfBlob(invoice_id);
              if (!url) return;
              // On mobile Safari, an iframe print() is more reliable than opening a new window.
              const w = window.open(url, "_blank");
              if (w) {
                w.addEventListener("load", () => { try { w.focus(); w.print(); } catch { /* ignore */ } });
              } else {
                // Popup blocked — fallback: hidden iframe print
                const iframe = document.createElement("iframe");
                iframe.style.position = "fixed";
                iframe.style.right = "0";
                iframe.style.bottom = "0";
                iframe.style.width = "0";
                iframe.style.height = "0";
                iframe.style.border = "0";
                iframe.src = url;
                iframe.onload = () => { try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch { /* ignore */ } };
                document.body.appendChild(iframe);
              }
            };
            const viewInline = async (invoice_id) => {
              const url = await fetchPdfBlob(invoice_id);
              if (url) setPdfPreview({ url, invoice_id });
            };
            return (
              <ul className="space-y-3" data-testid="portal-invoices-list">
                {list.slice(0, 20).map((inv, i) => {
                  const balance = parseFloat(inv.balance || 0);
                  const canPay = balance > 0 && (inv.status !== "paid" && inv.status !== "void");
                  const currency = inv.currency_code || "EUR";
                  return (
                    <li key={inv.invoice_id || i} className="rounded-xl surface-2 p-3.5" data-testid={`portal-invoice-row-${inv.invoice_id}`}>
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-strong truncate">{inv.invoice_number || inv.number || `#${i + 1}`}</p>
                          <p className="text-xs text-muted-fg truncate">{inv.customer_name || inv.date}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-sm font-semibold text-strong tabular-nums">{fmtAmount(inv.total, currency)}</span>
                          {balance > 0 && balance !== parseFloat(inv.total || 0) && (
                            <p className="text-[10px] text-amber-600">open: {fmtAmount(balance, currency)}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <button onClick={() => viewInline(inv.invoice_id)} className="inline-flex items-center gap-1 text-xs rounded-full px-2.5 py-1 surface text-strong border border-app hover:border-pear-500" data-testid={`portal-view-invoice-${inv.invoice_id}`}>
                          <Eye className="h-3 w-3" /> {t("view")}
                        </button>
                        <button onClick={() => openPdfNewTab(inv.invoice_id)} className="inline-flex items-center gap-1 text-xs rounded-full px-2.5 py-1 surface text-strong border border-app hover:border-pear-500" data-testid={`portal-pdf-invoice-${inv.invoice_id}`}>
                          <Download className="h-3 w-3" /> {t("pdf")}
                        </button>
                        <button onClick={() => printPdf(inv.invoice_id)} className="inline-flex items-center gap-1 text-xs rounded-full px-2.5 py-1 surface text-strong border border-app hover:border-pear-500" data-testid={`portal-print-invoice-${inv.invoice_id}`}>
                          <Printer className="h-3 w-3" /> {t("print")}
                        </button>
                        {canPay && (
                          <button
                            onClick={() => payInvoice(inv.invoice_id)}
                            data-testid={`portal-pay-invoice-${inv.invoice_id}`}
                            className="inline-flex items-center gap-1 text-xs font-semibold rounded-full bg-pear-500 text-white px-2.5 py-1 hover:bg-pear-600 ml-auto"
                          >
                            <CreditCard className="h-3 w-3" /> {t("payNow")}
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            );
          })()}
        </SectionCard>

        <SectionCard icon={FolderKanban} title={t("projects")} subtitle="Zoho Projects" state={projects} empty={<p className="text-sm text-muted-fg">{t("noProjects")}</p>}>
          {(() => {
            const list = projects.data?.projects || [];
            if (!list.length) return <p className="text-sm text-muted-fg">{t("noProjects")}</p>;
            const openProject = (pid) => window.location.assign(`/portal/project/${pid}`);
            return (
              <ul className="space-y-2 max-h-80 overflow-y-auto" data-testid="portal-projects-list">
                {list.slice(0, 20).map((p, i) => (
                  <li key={p.id || i}
                      className="flex items-center justify-between gap-3 rounded-xl surface-2 p-3 cursor-pointer hover:border-pear-500 border border-transparent transition-colors"
                      onClick={() => openProject(p.id_string || p.id)}
                      data-testid={`portal-project-row-${p.id_string || p.id}`}>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-strong truncate">{p.name}</p>
                      <p className="text-xs text-muted-fg truncate">{p.status || p.owner_name}</p>
                    </div>
                    <Eye className="h-4 w-4 text-pear-500 shrink-0" />
                  </li>
                ))}
              </ul>
            );
          })()}
        </SectionCard>

        <SectionCard icon={LifeBuoy} title={t("tickets")} subtitle="Zoho Desk" state={tickets} empty={<p className="text-sm text-muted-fg">{t("noTickets")}</p>}>
          {(() => {
            const list = tickets.data?.data || [];
            if (!list.length) return <p className="text-sm text-muted-fg">{t("noTickets")}</p>;
            const openTicket = (tid) => window.location.assign(`/portal/ticket/${tid}`);
            const badge = (s) => {
              const st = String(s || "").toLowerCase();
              if (st === "closed" || st === "solved") return "bg-emerald-100 text-emerald-700";
              if (st === "on hold") return "bg-amber-100 text-amber-700";
              if (st === "open") return "bg-pear-100 text-pear-700";
              return "bg-slate-100 text-slate-700";
            };
            return (
              <ul className="space-y-2 max-h-80 overflow-y-auto" data-testid="portal-tickets-list">
                {list.slice(0, 20).map((tk, i) => (
                  <li key={tk.id || i}
                      onClick={() => openTicket(tk.id)}
                      data-testid={`portal-ticket-row-${tk.id}`}
                      className="flex items-center justify-between gap-3 rounded-xl surface-2 p-3 cursor-pointer hover:border-pear-500 border border-transparent transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-strong truncate">#{tk.ticketNumber || i + 1} — {tk.subject}</p>
                      <p className="text-xs text-muted-fg truncate">{tk.priority || "—"}</p>
                    </div>
                    <span className={`text-[10px] uppercase tracking-widest rounded-full px-2 py-0.5 font-bold shrink-0 ${badge(tk.status)}`}>{tk.status}</span>
                  </li>
                ))}
              </ul>
            );
          })()}
        </SectionCard>
      </div>

      <section className="mt-10 surface border border-app rounded-3xl p-6 sm:p-8" data-testid="portal-review-section">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-full bg-pear-100 text-pear-500 flex items-center justify-center"><Star className="h-5 w-5" /></div>
          <div>
            <h3 className="font-heading text-lg font-semibold text-strong">{t("leaveReview")}</h3>
            <p className="text-xs text-muted-fg">{t("reviewIntro")}</p>
          </div>
        </div>
        <ReviewForm compact />
      </section>

      {pdfPreview && (
        <div
          className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3"
          onClick={() => { URL.revokeObjectURL(pdfPreview.url); setPdfPreview(null); }}
          data-testid="portal-pdf-preview-modal"
        >
          <div
            className="w-full max-w-4xl h-[92vh] surface rounded-2xl overflow-hidden flex flex-col border border-app"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="px-4 py-3 border-b border-app flex items-center justify-between shrink-0">
              <span className="text-sm font-semibold text-strong">{t("invoices")} — {pdfPreview.invoice_id}</span>
              <button
                onClick={() => { URL.revokeObjectURL(pdfPreview.url); setPdfPreview(null); }}
                className="text-muted-fg hover:text-strong text-2xl leading-none px-2"
                data-testid="portal-pdf-preview-close"
                aria-label="close"
              >×</button>
            </header>
            <iframe title="PDF preview" src={pdfPreview.url} className="flex-1 w-full bg-slate-800" data-testid="portal-pdf-preview-frame" />
          </div>
        </div>
      )}
    </div>
  );
}

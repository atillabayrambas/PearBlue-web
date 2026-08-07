import React from "react";
import { Link } from "react-router-dom";
import { Mail, Phone, MapPin } from "lucide-react";
import { useLang } from "../i18n/LanguageContext";

const LOGO_URL = "https://customer-assets-lxgj4vgw.emergentagent.net/job_3b5c4d50-dd30-4d09-93b8-e113754c7368/artifacts/bxpfaweb_PearBlue-logo-04-scaled.webp";

export const Footer = () => {
  const { t } = useLang();
  return (
    <footer className="mt-24 border-t border-slate-100 bg-white" data-testid="site-footer">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-16 grid grid-cols-1 md:grid-cols-4 gap-10">
        <div className="md:col-span-2">
          <img src={LOGO_URL} alt="PearBlue" className="h-10 w-auto mb-5" />
          <p className="text-pear-900/70 max-w-md leading-relaxed">{t("footer.tagline")}</p>
        </div>
        <div>
          <h4 className="font-heading font-semibold mb-4 text-pear-900">{t("footer.pages")}</h4>
          <ul className="space-y-2 text-sm text-pear-900/70">
            <li><Link to="/" className="hover:text-pear-500" data-testid="footer-link-home">{t("nav.home")}</Link></li>
            <li><Link to="/over-ons" className="hover:text-pear-500" data-testid="footer-link-about">{t("nav.about")}</Link></li>
            <li><Link to="/diensten" className="hover:text-pear-500" data-testid="footer-link-services">{t("nav.services")}</Link></li>
            <li><Link to="/portfolio" className="hover:text-pear-500" data-testid="footer-link-portfolio">{t("nav.portfolio")}</Link></li>
            <li><Link to="/contact" className="hover:text-pear-500" data-testid="footer-link-contact">{t("nav.contact")}</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-heading font-semibold mb-4 text-pear-900">{t("footer.contact")}</h4>
          <ul className="space-y-2 text-sm text-pear-900/70">
            <li className="flex items-center gap-2"><Mail className="h-4 w-4 text-pear-500" /> info@pearblue.nl</li>
            <li className="flex items-center gap-2"><Phone className="h-4 w-4 text-pear-500" /> +31 (0)6 1234 5678</li>
            <li className="flex items-center gap-2"><MapPin className="h-4 w-4 text-pear-500" /> Nederland</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-pear-900/60">
          <p>© {new Date().getFullYear()} PearBlue®. {t("footer.rights")}</p>
          <p>Made with care in the Netherlands.</p>
        </div>
      </div>
    </footer>
  );
};

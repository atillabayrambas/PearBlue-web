import React from "react";
import { Link } from "react-router-dom";
import { Mail, Phone, MapPin } from "lucide-react";
import { useLang } from "../i18n/LanguageContext";
import { Logo } from "./Logo";

export const Footer = () => {
  const { t } = useLang();
  return (
    <footer className="mt-24 border-t border-app surface" data-testid="site-footer">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-16 grid grid-cols-1 md:grid-cols-4 gap-10">
        <div className="md:col-span-2">
          <Logo size={40} />
          <p className="text-muted-fg max-w-md leading-relaxed mt-5">{t("footer.tagline")}</p>
          <div className="mt-6 text-xs text-muted-fg space-y-1" data-testid="footer-kvk">
            <p className="font-semibold text-strong">{t("kvk.title")}</p>
            <p>{t("kvk.line1")}</p>
            <p>{t("kvk.kvk")}: <span className="font-mono">87201607</span> · {t("kvk.form_val")}</p>
            <p>{t("kvk.loc_nr")}: <span className="font-mono">000053124294</span></p>
            <p>Boekweitkamp 7, 9932MA Delfzijl</p>
            <p>{t("kvk.brand")}: PearBlue</p>
          </div>
        </div>
        <div>
          <h4 className="font-heading font-semibold mb-4 text-strong">{t("footer.pages")}</h4>
          <ul className="space-y-2 text-sm text-muted-fg">
            <li><Link to="/" className="hover:text-pear-500" data-testid="footer-link-home">{t("nav.home")}</Link></li>
            <li><Link to="/over-ons" className="hover:text-pear-500" data-testid="footer-link-about">{t("nav.about")}</Link></li>
            <li><Link to="/diensten" className="hover:text-pear-500" data-testid="footer-link-services">{t("nav.services")}</Link></li>
            <li><Link to="/portfolio" className="hover:text-pear-500" data-testid="footer-link-portfolio">{t("nav.portfolio")}</Link></li>
            <li><Link to="/projecten" className="hover:text-pear-500" data-testid="footer-link-projects">{t("projects.title")}</Link></li>
            <li><Link to="/contact" className="hover:text-pear-500" data-testid="footer-link-contact">{t("nav.contact")}</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-heading font-semibold mb-4 text-strong">{t("footer.contact")}</h4>
          <ul className="space-y-2 text-sm text-muted-fg">
            <li className="flex items-center gap-2"><Mail className="h-4 w-4 text-pear-500" /> info@pearblue.nl</li>
            <li className="flex items-center gap-2"><Phone className="h-4 w-4 text-pear-500" /> +31 596 229 030</li>
            <li className="flex items-center gap-2"><MapPin className="h-4 w-4 text-pear-500" /> Boekweitkamp 7, 9932MA Delfzijl</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-app">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-muted-fg">
          <p>© {new Date().getFullYear()} PearBlue®. {t("footer.rights")}</p>
          <p>Made with care in the Netherlands.</p>
        </div>
      </div>
    </footer>
  );
};

import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, Globe, Server, ShieldCheck, ArrowRight, Sparkles } from "lucide-react";
import { useLang } from "../i18n/LanguageContext";

export const PricingTables = () => {
  const { t, lang } = useLang();

  const websiteFeatures = lang === "nl"
    ? ["Home + tot 5 pagina's design", "Meertaligheid (NL/EN)", "Copywriting per pagina", "Basis Setup: Hosting/CMS", "Basis Contactformulier", "Basis SEO Setup", "Stockfoto selectie", "Huisstijl handboek (compact)"]
    : ["Home + up to 5 pages design", "Multilingual (NL/EN)", "Copywriting per page", "Basic setup: Hosting/CMS", "Basic contact form", "Basic SEO setup", "Stock photo selection", "Brand style guide (compact)"];

  const ictFeatures = lang === "nl"
    ? ["Netwerkontwerp & bekabeling", "Cloud-inrichting & migratie", "Beheer & monitoring 24/7", "Security & toegangsbeheer (MFA)", "Werkplekuitrol & device-management", "Audit & roadmap"]
    : ["Network design & cabling", "Cloud setup & migration", "24/7 management & monitoring", "Security & access (MFA)", "Workplace rollout & device mgmt", "Audit & roadmap"];

  const cyberFeatures = lang === "nl"
    ? ["Bitdefender GravityZone Elite", "Antimalware & Ransomware bescherming", "Firewall & webbeveiliging", "EDR: geavanceerde detectie", "Encryptie voor gevoelige data", "Risk management dashboard", "Beheerd of onbeheerd", "Flexibel per actieve machine"]
    : ["Bitdefender GravityZone Elite", "Antimalware & ransomware protection", "Firewall & web protection", "EDR: advanced detection & response", "Encryption for sensitive data", "Risk management dashboard", "Managed or unmanaged", "Flexible per active machine"];

  const tiers = [
    {
      key: "web",
      icon: Globe,
      title: t("pricing.web_title"),
      from: t("pricing.web_from"),
      description: lang === "nl"
        ? "Een frisse, moderne website die je merk laat groeien — inclusief design, copy en hosting."
        : "A fresh, modern website that grows your brand — including design, copy and hosting.",
      features: websiteFeatures,
      accent: false,
    },
    {
      key: "ict",
      icon: Server,
      title: t("pricing.ict_title"),
      from: t("pricing.ict_from"),
      description: lang === "nl"
        ? "Betrouwbare ICT-infrastructuur: van netwerk en cloud tot beheer, monitoring en devices."
        : "Reliable ICT infrastructure: from network and cloud to management, monitoring and devices.",
      features: ictFeatures,
      accent: true,
    },
    {
      key: "cyber",
      icon: ShieldCheck,
      title: t("pricing.cyber_title"),
      from: t("pricing.cyber_from"),
      description: lang === "nl"
        ? "Enterprise-grade beveiliging met Bitdefender GravityZone. Betaal alleen voor wat je gebruikt."
        : "Enterprise-grade security with Bitdefender GravityZone. Pay only for what you use.",
      features: cyberFeatures,
      accent: false,
    },
  ];

  return (
    <section className="max-w-7xl mx-auto px-6 lg:px-10 py-24 lg:py-28" data-testid="pricing-section">
      <div className="max-w-3xl">
        <p className="overline mb-4">{t("pricing.eyebrow")}</p>
        <h2 className="font-heading font-medium text-4xl sm:text-5xl tracking-tight text-strong leading-tight">
          {t("pricing.title")}
        </h2>
        <p className="mt-4 text-lg text-muted-fg leading-relaxed">{t("pricing.subtitle")}</p>
      </div>

      <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-6">
        {tiers.map((tier, i) => (
          <motion.article
            key={tier.key}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: i * 0.06 }}
            className={`relative rounded-3xl border p-8 lg:p-10 flex flex-col surface card-lift ${
              tier.accent ? "border-pear-500 shadow-[0_30px_60px_rgba(2,192,255,0.14)]" : "border-app"
            }`}
            data-testid={`pricing-card-${tier.key}`}
          >
            {tier.accent && (
              <span className="absolute -top-3 left-8 inline-flex items-center gap-1 text-[10px] uppercase tracking-widest bg-pear-500 text-white rounded-full px-3 py-1 font-bold">
                <Sparkles className="h-3 w-3" /> {t("pricing.popular")}
              </span>
            )}
            <div className="w-12 h-12 rounded-full bg-pear-100 text-pear-500 flex items-center justify-center mb-5">
              <tier.icon className="h-6 w-6" />
            </div>
            <h3 className="font-heading text-2xl font-semibold text-strong">{tier.title}</h3>
            <div className="mt-2 mb-4">
              <span className="text-3xl font-heading font-medium text-pear-500">{tier.from}</span>
            </div>
            <p className="text-sm text-muted-fg leading-relaxed mb-6">{tier.description}</p>
            <ul className="space-y-3 mb-8 flex-1" data-testid={`pricing-features-${tier.key}`}>
              {tier.features.map((f, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-sm text-strong/85">
                  <span className="mt-0.5 w-5 h-5 rounded-full bg-pear-100 text-pear-500 flex items-center justify-center shrink-0">
                    <Check className="h-3 w-3" />
                  </span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Link
              to="/contact"
              className={tier.accent ? "btn-primary" : "btn-secondary"}
              data-testid={`pricing-cta-${tier.key}`}
            >
              {t("pricing.cta")} <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.article>
        ))}
      </div>
    </section>
  );
};

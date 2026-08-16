"""Seed data for the pricing catalog collection.

Split out of server.py to keep the seed table readable. Combines the original
Website/ICT/Cyber catalog with the two Excel imports supplied by PearBlue in
iteration 45 (`ict_diensten_prijzen_v8.xlsx` and
`cybersecurity_prijslijst_definitief.xlsx`).
"""

# The cyber endpoint agent price is €5.00/machine/month with a 10-step volume
# discount ladder (see cybersecurity_prijslijst_definitief.xlsx / sheet
# 'Endpoint Agent'). Discount is a per-unit EUR deduction — NOT a percentage.
CYBER_ENDPOINT_VOLUME_TIERS = [
    {"from_qty": 10, "to_qty": 19, "discount_per_unit": 0.10},
    {"from_qty": 20, "to_qty": 29, "discount_per_unit": 0.20},
    {"from_qty": 30, "to_qty": 39, "discount_per_unit": 0.30},
    {"from_qty": 40, "to_qty": 49, "discount_per_unit": 0.40},
    {"from_qty": 50, "to_qty": 59, "discount_per_unit": 0.50},
    {"from_qty": 60, "to_qty": 69, "discount_per_unit": 0.60},
    {"from_qty": 70, "to_qty": 79, "discount_per_unit": 0.70},
    {"from_qty": 80, "to_qty": 89, "discount_per_unit": 0.80},
    {"from_qty": 90, "to_qty": 99, "discount_per_unit": 0.90},
    {"from_qty": 100, "to_qty": None, "discount_per_unit": 1.00},
]


PRICING_SEED = [
    # =========================================================================
    # WEBSITE — Projectoverzicht
    # =========================================================================
    {"service": "web", "cat": "project", "nl": "Verkopen, leads, afspraken", "en": "Sales, leads, appointments",
     "unit": "eenmalig", "min_price": 50, "max_price": 50, "order": 10,
     "note_nl": "Doel-instelling & KPI-tracking", "note_en": "Goal setup & KPI tracking"},
    {"service": "web", "cat": "project", "nl": "5 revisies totaal (1e 2 voor testfase, laatste 3 voor verbeteringen)",
     "en": "5 revisions total (first 2 test, last 3 refinements)", "unit": "eenmalig",
     "min_price": 0, "max_price": 0, "included": True, "order": 20,
     "note_nl": "Inbegrepen bij elk pakket", "note_en": "Included with every package"},

    # WEBSITE — Pakket & Pagina's
    {"service": "web", "cat": "website", "nl": "Basis Pakket — 5 pagina's (Home, Over ons, Diensten, Portfolio, Contact)",
     "en": "Basic Package — 5 pages (Home, About, Services, Portfolio, Contact)",
     "unit": "eenmalig", "min_price": 200, "max_price": 200, "order": 10,
     "note_nl": "Vanaf-prijs", "note_en": "Starting price"},
    {"service": "web", "cat": "website", "nl": "Wettelijke pagina's (Algemene voorwaarden, Privacy, Cookies)",
     "en": "Legal pages (T&C, Privacy, Cookies)", "unit": "eenmalig",
     "min_price": 0, "max_price": 0, "included": True, "order": 20,
     "note_nl": "Verplicht — inbegrepen", "note_en": "Mandatory — included"},
    {"service": "web", "cat": "website", "nl": "Elke extra pagina (na de eerste 5)",
     "en": "Each extra page (after the first 5)", "unit": "per_stuk",
     "min_price": 50, "max_price": 50, "order": 30},
    {"service": "web", "cat": "website", "nl": "Handmatige thema-switcher (donker/licht)",
     "en": "Manual dark/light theme switcher", "unit": "eenmalig",
     "min_price": 50, "max_price": 50, "order": 40},
    {"service": "web", "cat": "website", "nl": "Automatisch systeemthema volgen",
     "en": "Auto system-theme follow", "unit": "eenmalig",
     "min_price": 10, "max_price": 10, "order": 50},
    {"service": "web", "cat": "website", "nl": "Extra taal (meertaligheid)",
     "en": "Extra language", "unit": "per_taal", "min_price": 50, "max_price": 50, "order": 60},

    # WEBSITE — Geavanceerde functies
    {"service": "web", "cat": "advanced", "nl": "AI Chat + Agent-overname (Claude API)",
     "en": "AI Chat + Agent takeover (Claude API)", "unit": "eenmalig",
     "min_price": 100, "max_price": 100, "order": 10},
    {"service": "web", "cat": "advanced", "nl": "AI Mail & Support-ticket sync via nummer",
     "en": "AI Mail & Support-ticket sync via number", "unit": "eenmalig",
     "min_price": 150, "max_price": 150, "order": 20},
    {"service": "web", "cat": "advanced", "nl": "AI Dashboard modules (analytics per module)",
     "en": "AI Dashboard modules (analytics per module)", "unit": "per_module",
     "min_price": 20, "max_price": 20, "order": 30},
    {"service": "web", "cat": "advanced", "nl": "Klant-feedbacksysteem", "en": "Client feedback system",
     "unit": "eenmalig", "min_price": 30, "max_price": 30, "order": 40},
    {"service": "web", "cat": "advanced", "nl": "Mailbox-integratie (IMAP) — beheer meerdere mailboxen vanuit CMS",
     "en": "Mailbox integration (IMAP) — manage multiple inboxes from CMS", "unit": "eenmalig",
     "min_price": 50, "max_price": 50, "order": 50,
     "note_nl": "Beheerders kunnen mailboxen toevoegen/verwijderen",
     "note_en": "Admins can add/remove mailboxes"},

    # WEBSITE — Upload & CMS
    {"service": "web", "cat": "upload", "nl": "Zelf producten toevoegen via CMS", "en": "Add products yourself via CMS",
     "unit": "eenmalig", "min_price": 20, "max_price": 20, "order": 10},
    {"service": "web", "cat": "upload", "nl": "Zelf portfolio-werk uploaden via CMS", "en": "Upload portfolio work via CMS",
     "unit": "eenmalig", "min_price": 20, "max_price": 20, "order": 20},
    {"service": "web", "cat": "upload", "nl": "Zelf artikelen plaatsen via CMS", "en": "Post articles via CMS",
     "unit": "eenmalig", "min_price": 20, "max_price": 20, "order": 30},
    {"service": "web", "cat": "upload", "nl": "Invoer door ons (per 20 items)", "en": "Data entry by us (per 20 items)",
     "unit": "per_20_items", "min_price": 100, "max_price": 200, "order": 40},

    # WEBSITE — E-commerce
    {"service": "web", "cat": "ecom", "nl": "Winkel-setup (mandje & checkout)", "en": "Shop setup (cart & checkout)",
     "unit": "eenmalig", "min_price": 300, "max_price": 2000, "order": 10,
     "note_nl": "Afhankelijk van complexiteit", "note_en": "Depends on complexity"},
    {"service": "web", "cat": "ecom", "nl": "Adressen & verzending (Standaard incl. — uitgebreid +€10)",
     "en": "Addresses & shipping (Standard incl. — extended +€10)", "unit": "eenmalig",
     "min_price": 10, "max_price": 10, "order": 20,
     "note_nl": "+€10 extra bij uitgebreide verzendopties",
     "note_en": "+€10 for extended shipping options"},
    {"service": "web", "cat": "ecom", "nl": "Betaalintegratie (iDEAL, Stripe)", "en": "Payment integration (iDEAL, Stripe)",
     "unit": "eenmalig", "min_price": 30, "max_price": 30, "order": 30},
    {"service": "web", "cat": "ecom", "nl": "Product-kleurvariaties", "en": "Product color variations",
     "unit": "eenmalig", "min_price": 20, "max_price": 20, "order": 40},
    {"service": "web", "cat": "ecom", "nl": "Product-maatvariaties", "en": "Product size variations",
     "unit": "eenmalig", "min_price": 20, "max_price": 20, "order": 50},
    {"service": "web", "cat": "ecom", "nl": "Gekoppelde productfoto's (sync kleur/maat)",
     "en": "Linked product photos (sync color/size)", "unit": "eenmalig",
     "min_price": 60, "max_price": 60, "order": 60},
    {"service": "web", "cat": "ecom", "nl": "Product-calculator (configurator)", "en": "Product calculator (configurator)",
     "unit": "eenmalig", "min_price": 50, "max_price": 50, "order": 70},

    # WEBSITE — Integraties & Training
    {"service": "web", "cat": "integrations", "nl": "Reviews-koppeling (Google, Trustpilot, …)",
     "en": "Reviews integration (Google, Trustpilot, …)", "unit": "per_stuk",
     "min_price": 30, "max_price": 30, "order": 10},
    {"service": "web", "cat": "integrations", "nl": "Custom scripts (header/footer)", "en": "Custom scripts (header/footer)",
     "unit": "eenmalig", "min_price": 20, "max_price": 20, "order": 20},
    {"service": "web", "cat": "integrations", "nl": "Analytics-koppeling per module",
     "en": "Analytics integration per module", "unit": "per_stuk",
     "min_price": 5, "max_price": 5, "order": 30},
    {"service": "web", "cat": "integrations", "nl": "CRM-koppeling Pro (Zoho, HubSpot, …)",
     "en": "CRM integration Pro (Zoho, HubSpot, …)", "unit": "vanaf",
     "min_price": 75, "max_price": 75, "order": 40},
    {"service": "web", "cat": "integrations", "nl": "Gebruikerstraining CMS", "en": "User training CMS",
     "unit": "per_uur", "min_price": 80, "max_price": 80, "order": 50},
    {"service": "web", "cat": "integrations", "nl": "Training Zoho/CRM", "en": "Training Zoho/CRM",
     "unit": "per_uur", "min_price": 80, "max_price": 80, "order": 60},

    # =========================================================================
    # ICT — from ict_diensten_prijzen_v8.xlsx
    # =========================================================================
    # Backup
    {"service": "ict", "cat": "ict_backup", "nl": "Veeam — perpetual licentie + support",
     "en": "Veeam — perpetual license + support", "unit": "eenmalig",
     "min_price": 1500, "max_price": 1500, "order": 10,
     "note_nl": "Veeam licentiekosten; support/maintenance ~20%/jaar",
     "note_en": "Veeam license cost; support/maintenance ~20%/year"},
    {"service": "ict", "cat": "ict_backup", "nl": "Rubrik — appliance-based (maandelijks)",
     "en": "Rubrik — appliance-based (monthly)", "unit": "per_maand",
     "min_price": 1200, "max_price": 1200, "order": 20,
     "note_nl": "Appliance + SaaS-achtig abonnement", "note_en": "Appliance + SaaS-style subscription"},
    {"service": "ict", "cat": "ict_backup", "nl": "NAS lokale backup — schijven (eenmalig, per TB)",
     "en": "NAS local backup — drives (one-off, per TB)", "unit": "per_stuk",
     "min_price": 75, "max_price": 75, "order": 30,
     "note_nl": "€75/TB. NAS-hardware (€400–€2000) en installatie apart.",
     "note_en": "€75/TB. NAS hardware (€400–€2000) and install separate."},

    # Netwerk
    {"service": "ict", "cat": "ict_network", "nl": "Netwerk-audit & ontwerp",
     "en": "Network audit & design", "unit": "eenmalig",
     "min_price": 300, "max_price": 300, "order": 10,
     "note_nl": "≈3 uur à €100/u", "note_en": "≈3h at €100/h"},
    {"service": "ict", "cat": "ict_network", "nl": "Switch installatie & configuratie (Mikrotik)",
     "en": "Switch install & configuration (Mikrotik)", "unit": "per_stuk",
     "min_price": 200, "max_price": 450, "order": 20,
     "note_nl": "Arbeid 2–4 uur à €100/u. Hardware apart.",
     "note_en": "Labour 2–4h at €100/h. Hardware separate."},

    # Infrastructure
    {"service": "ict", "cat": "ict_infra", "nl": "Server-installatie on-prem (excl. hardware)",
     "en": "On-prem server install (excl. hardware)", "unit": "eenmalig",
     "min_price": 3500, "max_price": 3500, "order": 10,
     "note_nl": "≈40 uur werk", "note_en": "≈40 hours of work"},
    {"service": "ict", "cat": "ict_infra", "nl": "VM-host implementatie", "en": "VM host implementation",
     "unit": "per_stuk", "min_price": 1200, "max_price": 1200, "order": 20,
     "note_nl": "Implementatie, opslagconfig, HA basis; licenties/hardware exclusief",
     "note_en": "Implementation, storage config, HA basis; licenses/hardware excluded"},
    {"service": "ict", "cat": "ict_infra", "nl": "Kassa-installatie + training",
     "en": "POS install + training", "unit": "per_stuk",
     "min_price": 1250, "max_price": 1250, "order": 30,
     "note_nl": "Hardware, software, training, configuratie",
     "note_en": "Hardware, software, training, configuration"},

    # Cloud
    {"service": "ict", "cat": "ict_cloud", "nl": "Internxt Ultimate — eenmalige aankoop",
     "en": "Internxt Ultimate — one-off purchase", "unit": "eenmalig",
     "min_price": 585, "max_price": 702, "order": 10,
     "note_nl": "Standaard €3.900. Tijdelijke promo €585.",
     "note_en": "Standard €3,900. Promo €585."},
    {"service": "ict", "cat": "ict_cloud", "nl": "Internxt Ultimate — jaarabonnement (€4,49/mnd)",
     "en": "Internxt Ultimate — annual subscription (€4.49/mo)", "unit": "per_maand",
     "min_price": 4.49, "max_price": 4.49, "order": 20,
     "note_nl": "Jaarabonnement gefactureerd", "note_en": "Billed annually"},

    # Boekhoudsysteem
    {"service": "ict", "cat": "ict_finance", "nl": "Implementatie cloud-boekhouding",
     "en": "Cloud accounting implementation", "unit": "eenmalig",
     "min_price": 850, "max_price": 850, "order": 10,
     "note_nl": "Licentie setup, koppelingen, data-migratie",
     "note_en": "License setup, integrations, data migration"},

    # Nazorg & Support
    {"service": "ict", "cat": "ict_support", "nl": "Onderhoud & support (SLA-uurtarief)",
     "en": "Maintenance & support (SLA hourly)", "unit": "per_uur",
     "min_price": 80, "max_price": 80, "order": 10,
     "note_nl": "Standaard nazorg-tarief", "note_en": "Standard SLA rate"},
    {"service": "ict", "cat": "ict_support", "nl": "Ad-hoc ondersteuning", "en": "Ad-hoc support",
     "unit": "per_uur", "min_price": 100, "max_price": 100, "order": 20},
    {"service": "ict", "cat": "ict_support", "nl": "Monitoring & alerting", "en": "Monitoring & alerting",
     "unit": "per_machine_maand", "min_price": 5, "max_price": 5, "order": 30,
     "note_nl": "€5 per machine per maand", "note_en": "€5 per machine per month"},
    {"service": "ict", "cat": "ict_support", "nl": "IT-strategie-sessie (2 uur workshop + rapport)",
     "en": "IT strategy session (2h workshop + report)", "unit": "eenmalig",
     "min_price": 200, "max_price": 200, "order": 40},
    {"service": "ict", "cat": "ict_support", "nl": "Projectmanagement ICT (per uur)",
     "en": "ICT project management (hourly)", "unit": "per_uur",
     "min_price": 90, "max_price": 90, "order": 50,
     "note_nl": "Minimaal 10 uur per project aanbevolen",
     "note_en": "10h minimum per project recommended"},
    {"service": "ict", "cat": "ict_support", "nl": "API / POS koppeling-ontwikkeling",
     "en": "API / POS integration development", "unit": "per_stuk",
     "min_price": 1250, "max_price": 1250, "order": 60,
     "note_nl": "Development, testen, documentatie", "note_en": "Development, testing, documentation"},

    # =========================================================================
    # CYBERSECURITY — from cybersecurity_prijslijst_definitief.xlsx
    # =========================================================================
    # Existing: Website IP-block/DDoS (keep)
    {"service": "cyber", "cat": "cybersecurity", "nl": "Website IP-block & DDoS-bescherming op formulieren/chat",
     "en": "Website IP-block & DDoS protection on forms/chat", "unit": "eenmalig",
     "min_price": 50, "max_price": 50, "order": 10},

    # Endpoint Agent (Bitdefender GravityZone) — with volume discount tiers
    {"service": "cyber", "cat": "cyber_endpoint", "nl": "Bitdefender GravityZone — endpoint agent",
     "en": "Bitdefender GravityZone — endpoint agent", "unit": "per_machine_maand",
     "min_price": 5.0, "max_price": 5.0, "order": 10,
     "special": "cyber_endpoint_agent",
     "volume_tiers": CYBER_ENDPOINT_VOLUME_TIERS,
     "note_nl": "Basis €5,00/machine/mnd — automatische volumekorting vanaf 10 machines (t/m €4,00 vanaf 100 machines)",
     "note_en": "Base €5.00/machine/mo — automatic volume discount from 10 machines (down to €4.00 from 100)"},
    {"service": "cyber", "cat": "cyber_endpoint", "nl": "Nazorg — SLA & incidentondersteuning",
     "en": "Managed care — SLA & incident support", "unit": "per_machine_maand",
     "min_price": 3.0, "max_price": 3.0, "order": 20,
     "note_nl": "+€3/machine/maand — optioneel bovenop endpoint agent",
     "note_en": "+€3/machine/month — optional on top of endpoint agent"},

    # Cyber — Overig (per-policy / eenmalige onboarding-diensten)
    {"service": "cyber", "cat": "cyber_services", "nl": "Per-policy configuratie in GravityZone",
     "en": "Per-policy configuration in GravityZone", "unit": "per_stuk",
     "min_price": 80, "max_price": 80, "order": 10,
     "note_nl": "Configuratie, testen en implementatie incl. QA",
     "note_en": "Configuration, testing and implementation incl. QA"},
    {"service": "cyber", "cat": "cyber_services", "nl": "Rapportage-setup (dashboards & scheduled exports)",
     "en": "Reporting setup (dashboards & scheduled exports)", "unit": "per_stuk",
     "min_price": 95, "max_price": 95, "order": 20},
    {"service": "cyber", "cat": "cyber_services", "nl": "Risk Management — initial setup",
     "en": "Risk Management — initial setup", "unit": "eenmalig",
     "min_price": 100, "max_price": 100, "order": 30,
     "note_nl": "Vulnerability scans, baseline, risico-prioritering + 1e rapportage",
     "note_en": "Vulnerability scans, baseline, risk prioritisation + first report"},
    {"service": "cyber", "cat": "cyber_services", "nl": "Server Anti-Malware onboarding (per server)",
     "en": "Server Anti-Malware onboarding (per server)", "unit": "per_stuk",
     "min_price": 45, "max_price": 45, "order": 40,
     "note_nl": "Server-specifieke tuning, agent deployment, exclusions, performance test",
     "note_en": "Server-specific tuning, agent deployment, exclusions, performance test"},
    {"service": "cyber", "cat": "cyber_services", "nl": "24/7 Monitoring — onboarding",
     "en": "24/7 Monitoring — onboarding", "unit": "eenmalig",
     "min_price": 100, "max_price": 100, "order": 50,
     "note_nl": "SOC-integratie, alerting-pipelines, playbooks, escalatiepaden",
     "note_en": "SOC integration, alerting pipelines, playbooks, escalation paths"},
    {"service": "cyber", "cat": "cyber_services", "nl": "Incident Response Retainer — setup",
     "en": "Incident Response Retainer — setup", "unit": "eenmalig",
     "min_price": 60, "max_price": 60, "order": 60,
     "note_nl": "Retainer, communicatielijnen, escalatieprocedures",
     "note_en": "Retainer, communication lines, escalation procedures"},
    {"service": "cyber", "cat": "cyber_services", "nl": "Threat Intelligence — feed tuning",
     "en": "Threat Intelligence — feed tuning", "unit": "eenmalig",
     "min_price": 50, "max_price": 50, "order": 70,
     "note_nl": "TI-feeds, whitelists/blacklists, feed-mapping",
     "note_en": "TI feeds, whitelists/blacklists, feed mapping"},
    {"service": "cyber", "cat": "cyber_services", "nl": "Configuration Hardening (per 50 machines)",
     "en": "Configuration Hardening (per 50 machines)", "unit": "per_stuk",
     "min_price": 90, "max_price": 90, "order": 80,
     "note_nl": "Hardening-baselines + automatisering per groep endpoints",
     "note_en": "Hardening baselines + automation per endpoint group"},
    {"service": "cyber", "cat": "cyber_services", "nl": "XDR / EDR — initial tuning & onboarding",
     "en": "XDR / EDR — initial tuning & onboarding", "unit": "eenmalig",
     "min_price": 100, "max_price": 100, "order": 90,
     "note_nl": "Correlaties, detection rules, threat-hunting playbooks",
     "note_en": "Correlations, detection rules, threat-hunting playbooks"},
    {"service": "cyber", "cat": "cyber_services", "nl": "Firewall-policy setup (per site / policy)",
     "en": "Firewall policy setup (per site / policy)", "unit": "per_stuk",
     "min_price": 75, "max_price": 75, "order": 100},
    {"service": "cyber", "cat": "cyber_services", "nl": "Policy testing & validation (per environment)",
     "en": "Policy testing & validation (per environment)", "unit": "per_stuk",
     "min_price": 70, "max_price": 70, "order": 110,
     "note_nl": "Testcases, regressietests, validatie in staging/productie",
     "note_en": "Test cases, regression tests, validation in staging/prod"},
]


# Human-readable category labels for CMS + public rendering. Keys are `cat`.
PRICING_CATEGORIES = [
    # Website
    {"key": "project", "service": "web", "nl": "Projectoverzicht", "en": "Project overview", "order": 10},
    {"key": "website", "service": "web", "nl": "Pakket & Pagina's", "en": "Package & Pages", "order": 20},
    {"key": "advanced", "service": "web", "nl": "Geavanceerde functies", "en": "Advanced features", "order": 30},
    {"key": "upload", "service": "web", "nl": "Upload & CMS", "en": "Upload & CMS", "order": 40},
    {"key": "ecom", "service": "web", "nl": "E-commerce modules", "en": "E-commerce modules", "order": 50},
    {"key": "integrations", "service": "web", "nl": "Integraties & Training", "en": "Integrations & Training", "order": 60},
    # ICT
    {"key": "ict_infra", "service": "ict", "nl": "Infrastructuur & Server", "en": "Infrastructure & Server", "order": 10},
    {"key": "ict_network", "service": "ict", "nl": "Netwerk", "en": "Network", "order": 20},
    {"key": "ict_cloud", "service": "ict", "nl": "Cloud & Storage", "en": "Cloud & Storage", "order": 30},
    {"key": "ict_backup", "service": "ict", "nl": "Backup", "en": "Backup", "order": 40},
    {"key": "ict_finance", "service": "ict", "nl": "Boekhouding & Kassa", "en": "Finance & POS", "order": 50},
    {"key": "ict_support", "service": "ict", "nl": "Nazorg, SLA & Consultancy", "en": "Support, SLA & Consultancy", "order": 60},
    # Cyber
    {"key": "cybersecurity", "service": "cyber", "nl": "Website-bescherming", "en": "Website protection", "order": 10},
    {"key": "cyber_endpoint", "service": "cyber", "nl": "Endpoint bescherming (Bitdefender GravityZone)",
     "en": "Endpoint protection (Bitdefender GravityZone)", "order": 20},
    {"key": "cyber_services", "service": "cyber", "nl": "Cybersecurity — services & onboarding",
     "en": "Cybersecurity — services & onboarding", "order": 30},
]

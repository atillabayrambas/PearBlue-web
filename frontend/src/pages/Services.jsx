import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Globe, Server, ShieldCheck, Check, ArrowRight } from "lucide-react";
import { useLang } from "../i18n/LanguageContext";
import { usePageSeo } from "../hooks/usePageSeo";

const IMG = {
  ict_hero: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?crop=entropy&cs=srgb&fm=jpg&w=1400&q=85",
  network: "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?crop=entropy&cs=srgb&fm=jpg&w=900&q=85",
  cloud: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?crop=entropy&cs=srgb&fm=jpg&w=900&q=85",
  monitor: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?crop=entropy&cs=srgb&fm=jpg&w=900&q=85",
  security_lock: "https://images.unsplash.com/photo-1563986768609-322da13575f3?crop=entropy&cs=srgb&fm=jpg&w=900&q=85",
  workplace: "https://images.unsplash.com/photo-1517502884422-41eaead166d4?crop=entropy&cs=srgb&fm=jpg&w=900&q=85",
  audit: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?crop=entropy&cs=srgb&fm=jpg&w=900&q=85",

  media_hero: "https://images.unsplash.com/photo-1626785774573-4b799315345d?crop=entropy&cs=srgb&fm=jpg&w=1400&q=85",
  visual_id: "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?crop=entropy&cs=srgb&fm=jpg&w=900&q=85",
  social: "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?crop=entropy&cs=srgb&fm=jpg&w=900&q=85",
  webdesign: "https://images.unsplash.com/photo-1467232004584-a241de8bcf5d?crop=entropy&cs=srgb&fm=jpg&w=900&q=85",
  hosting: "https://images.unsplash.com/photo-1667372393119-3d4c48d07fc9?crop=entropy&cs=srgb&fm=jpg&w=900&q=85",
  uiux: "https://images.unsplash.com/photo-1587440871875-191322ee64b0?crop=entropy&cs=srgb&fm=jpg&w=900&q=85",
  illustrations: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?crop=entropy&cs=srgb&fm=jpg&w=900&q=85",

  cyber_hero: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?crop=entropy&cs=srgb&fm=jpg&w=1400&q=85",
  bitdefender: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?crop=entropy&cs=srgb&fm=jpg&w=900&q=85",
  managed: "https://images.unsplash.com/photo-1573164713988-8665fc963095?crop=entropy&cs=srgb&fm=jpg&w=900&q=85",
  protection: "https://images.unsplash.com/photo-1614064641938-3bbee52942c7?crop=entropy&cs=srgb&fm=jpg&w=900&q=85",
  billing: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?crop=entropy&cs=srgb&fm=jpg&w=900&q=85",
};

const SERVICES = {
  ict: {
    key: "ict",
    icon: Server,
    priceFrom: "€100",
    hero_img: IMG.ict_hero,
    title_nl: "IT Platform & ICT Diensten",
    title_en: "IT Platform & ICT Services",
    subtitle_nl: "Vanaf €100. Robuuste ICT infrastructuur, van netwerk tot 24/7 beheer.",
    subtitle_en: "From €100. Robust ICT infrastructure, from network to 24/7 management.",
    intro_nl: "Diensten die wij leveren voor jouw bedrijf — solide fundering, klaar om te groeien.",
    intro_en: "Services we deliver for your business — a solid foundation, ready to grow.",
    items: [
      { title: { nl: "Netwerkontwerp & Bekabeling", en: "Network Design & Cabling" }, img: IMG.network,
        desc: { nl: "Een solide basis voor vandaag, voorbereid op groei morgen. Slimme segmentatie, Wi-Fi dat werkt en nette bekabeling die future-proof is.",
          en: "A solid foundation for today, ready to grow tomorrow. Smart segmentation, Wi-Fi that just works, and future-proof cabling." } },
      { title: { nl: "Cloud-inrichting & Migratie", en: "Cloud Setup & Migration" }, img: IMG.cloud,
        desc: { nl: "Start veilig in Nextcloud en Internxt of migreer gefaseerd vanuit on-premise. Wij regelen identity, rechten en data-migratie zonder downtime.",
          en: "Start securely in Nextcloud & Internxt or migrate phased from on-premise. We handle identity, permissions and zero-downtime data migration." } },
      { title: { nl: "Beheer & Monitoring", en: "Management & Monitoring" }, img: IMG.monitor,
        desc: { nl: "Proactieve bewaking van servers, netwerk en werkplekken. Updates, patching en 24/7 alarmering zodat issues worden opgelost vóór ze impact hebben.",
          en: "Proactive monitoring of servers, network and endpoints. Updates, patching and 24/7 alerting so issues get solved before they impact you." } },
      { title: { nl: "Security & Toegangsbeheer", en: "Security & Access Management" }, img: IMG.security_lock,
        desc: { nl: "Zero-Trust principes, MFA, device-compliance en netwerksegmentatie. Policies op maat voor starters en opschalers, met duidelijke rapportages. Veiligheid gaat voorop.",
          en: "Zero-Trust principles, MFA, device compliance and network segmentation. Custom policies for starters and scale-ups with clear reporting. Security first." } },
      { title: { nl: "Werkplekuitrol & Device-management", en: "Workplace Rollout & Device Management" }, img: IMG.workplace,
        desc: { nl: "Nieuwe collega's in minuten up-and-running. Gestandaardiseerde images, automatische configuratie en centraal beheer van laptops of mobiel.",
          en: "New colleagues up-and-running in minutes. Standardised images, automated configuration and central management of laptops and mobile." } },
      { title: { nl: "Audit & Roadmap", en: "Audit & Roadmap" }, img: IMG.audit,
        desc: { nl: "Nulmeting van performance, veiligheid en kosten. Concreet stappenplan met quick wins voor nu en een groeipad voor de komende 6–12 maanden.",
          en: "Baseline measurement of performance, security and costs. Concrete plan with quick wins now and a growth path for the next 6–12 months." } },
    ],
  },
  media: {
    key: "media",
    icon: Globe,
    priceFrom: "€200",
    hero_img: IMG.media_hero,
    title_nl: "Media Website",
    title_en: "Media Website",
    subtitle_nl: "Vanaf €200. Ontwerp, branding en web experiences die je merk laten opvallen.",
    subtitle_en: "From €200. Design, branding and web experiences that make your brand stand out.",
    intro_nl: "Diensten die wij aanbieden — van eerste concept tot publicatie en beyond.",
    intro_en: "Services we offer — from first concept to publication and beyond.",
    items: [
      { title: { nl: "Visual identity", en: "Visual identity" }, img: IMG.visual_id,
        desc: { nl: "Visual identity is de visuele basis van je merk. We ontwikkelen een onderscheidende stijl met logo, kleurpalet, typografie, iconen en beeldtaal. Consistente richtlijnen zorgen voor herkenning op elk kanaal, van website en social tot print en video, zodat je merk professioneel en memorabel overkomt.",
          en: "Visual identity is the visual foundation of your brand. We develop a distinctive style with logo, colour palette, typography, icons and imagery. Consistent guidelines ensure recognition across every channel — from website and social to print and video — so your brand feels professional and memorable." } },
      { title: { nl: "Branding voor social media", en: "Branding for social media" }, img: IMG.social,
        desc: { nl: "Branding voor social media draait om consistente, herkenbare content die je merk laat groeien. We ontwikkelen een visuele stijl en tone of voice, maken sjablonen voor posts en stories, en plannen formats die engagement en bereik vergroten. Data-gedreven optimalisatie zorgt voor continu betere resultaten.",
          en: "Social media branding is about consistent, recognisable content that grows your brand. We develop a visual style and tone of voice, create templates for posts and stories, and plan formats that increase engagement and reach. Data-driven optimisation continually improves results." } },
      { title: { nl: "Web design", en: "Web design" }, img: IMG.webdesign,
        desc: { nl: "Websites die op maat gebouwd worden voor jouw merk en publiek. Vanaf conceptueel schetsen tot fully-responsive design — modern, sleek, en gericht op conversie. Elk pixel doordacht, elke interactie helder.",
          en: "Websites built to measure for your brand and audience. From conceptual sketches to fully-responsive design — modern, sleek, and conversion-focused. Every pixel considered, every interaction clear." } },
      { title: { nl: "Hosting", en: "Hosting" }, img: IMG.hosting,
        desc: { nl: "Hosting en domein vormen de basis van je online aanwezigheid. We regelen een snel en veilig hostingpakket, koppelen je domeinnaam, installeren SSL en zorgen voor back-ups en monitoring. Met schaalbare resources, e-mailconfiguratie en support houd je je website stabiel, snel en altijd bereikbaar.",
          en: "Hosting and domain form the foundation of your online presence. We arrange fast and secure hosting, connect your domain, install SSL and take care of backups and monitoring. With scalable resources, email configuration and support your site stays stable, fast and always reachable." } },
      { title: { nl: "UI & UX", en: "UI & UX" }, img: IMG.uiux,
        desc: { nl: "UI & UX zorgen samen voor digitale producten die prettig ogen én logisch werken. We ontwerpen duidelijke interfaces, intuïtieve flows en consistente componenten, getest met echte gebruikers. Met focus op toegankelijkheid, snelheid en conversie ontstaat een ervaring die moeiteloos aanvoelt en beter presteert.",
          en: "UI & UX together create digital products that look great and work logically. We design clear interfaces, intuitive flows and consistent components, tested with real users. Focused on accessibility, speed and conversion, the result feels effortless and performs better." } },
      { title: { nl: "Aangepaste iconen & illustraties", en: "Custom icons & illustrations" }, img: IMG.illustrations,
        desc: { nl: "Aangepaste illustraties brengen je verhaal uniek en visueel tot leven. Van concept tot uitvoering creëren we originele beelden die perfect aansluiten bij je merkidentiteit en boodschap. Ideaal voor websites, campagnes, presentaties of social media om je te onderscheiden en complexe ideeën helder over te brengen.",
          en: "Custom illustrations bring your story to life uniquely and visually. From concept to execution we create original imagery that perfectly matches your brand identity and message. Ideal for websites, campaigns, presentations or social media — to stand out and communicate complex ideas clearly." } },
    ],
  },
  cyber: {
    key: "cyber",
    icon: ShieldCheck,
    priceFrom: "€5 p/machine",
    hero_img: IMG.cyber_hero,
    title_nl: "Cybersecurity — Bitdefender GravityZone",
    title_en: "Cybersecurity — Bitdefender GravityZone",
    subtitle_nl: "Vanaf €5 per actieve machine. Enterprise beveiliging zonder langlopende contracten.",
    subtitle_en: "From €5 per active machine. Enterprise security without long-term contracts.",
    intro_nl: "Diensten die wij leveren — complete bescherming voor endpoints, cloud en identiteiten.",
    intro_en: "Services we deliver — complete protection for endpoints, cloud and identities.",
    items: [
      { title: { nl: "Bitdefender", en: "Bitdefender" }, img: IMG.bitdefender,
        desc: { nl: "Bitdefender GravityZone (Elite) biedt ultieme, complete beveiliging voor uw organisatie, van endpoints tot cloud. Deze geavanceerde oplossing combineert toonaangevende preventie, detectie en respons om complexe cyberdreigingen realtime te neutraliseren. Met machine learning, gedragsanalyse en sandbox-technologie bent u beschermd tegen ransomware en zero-day exploits, met centraal beheer en top prestaties.",
          en: "Bitdefender GravityZone (Elite) delivers ultimate, complete security for your organisation, from endpoints to cloud. This advanced solution combines industry-leading prevention, detection and response to neutralise complex cyber threats in real time. Machine learning, behavioural analysis and sandbox tech protect against ransomware and zero-days, with central management and top-tier performance." } },
      { title: { nl: "Beheerd of Onbeheerd", en: "Managed or Unmanaged" }, img: IMG.managed,
        desc: { nl: "Bij beheerd nemen wij de volledige zorg voor uw systemen uit handen, inclusief monitoring, onderhoud en support. Bij onbeheerd behoudt u zelf de controle en verantwoordelijkheid. Wij leveren de infrastructuur, u beheert. Altijd een solide basis en ondersteuning, ongeacht uw keuze.",
          en: "With managed we take full care of your systems — including monitoring, maintenance and support. With unmanaged you retain control and responsibility. We provide the infrastructure, you manage it. Always a solid foundation and support, whichever you choose." } },
      { title: { nl: "Uitgebreide Bescherming op Maat", en: "Extensive tailored Protection" }, img: IMG.protection,
        desc: { nl: "Antimalware beschermt tegen virussen en ransomware. Firewall beveiligt netwerkverkeer. Webbeveiliging blokkeert online dreigingen. Gedragsanalyse detecteert verdacht gedrag. Encryptie beveiligt gevoelige data. EDR biedt geavanceerde detectie en respons. Risk management laat zien waar risico's liggen. Flexibel inzetbaar voor maatwerk beveiliging.",
          en: "Antimalware protects against viruses and ransomware. Firewall secures network traffic. Web protection blocks online threats. Behavioural analysis detects suspicious activity. Encryption secures sensitive data. EDR provides advanced detection & response. Risk management surfaces where risks live. Flexibly deployed for tailored security." } },
      { title: { nl: "Flexibele Betaling", en: "Flexible Billing" }, img: IMG.billing,
        desc: { nl: "Wij geloven in transparantie en flexibiliteit. Daarom betaalt u bij ons per actieve computer, zonder verborgen kosten of ingewikkelde contractuele verplichtingen. U zit niet vast aan langlopende contracten of onnodige opzegtermijnen. U betaalt alleen voor de beveiliging die u daadwerkelijk gebruikt, en kunt eenvoudig opschalen of afschalen naar gelang uw behoeften. Dit biedt u maximale vrijheid en controle over uw budget, zonder concessies te doen aan de kwaliteit van uw beveiliging.",
          en: "We believe in transparency and flexibility. That's why you pay per active machine — no hidden fees or complicated contractual obligations. You're not locked into long contracts or unnecessary notice periods. You only pay for the security you actually use, and can easily scale up or down as needs change. Maximum freedom and control over your budget, without compromising security quality." } },
    ],
  },
};

export default function Services() {
  const { t, lang } = useLang();
  usePageSeo({ title: "Diensten", description: "IT Platform (vanaf €100), Media Website (vanaf €200) en Cybersecurity Bitdefender GravityZone (vanaf €5 p/machine).", path: "/diensten" });
  const services = [SERVICES.ict, SERVICES.media, SERVICES.cyber];

  return (
    <div data-testid="page-services">
      <section className="max-w-7xl mx-auto px-6 lg:px-10 pt-16 lg:pt-24 pb-10">
        <div className="max-w-3xl">
          <p className="overline mb-4">{t("servicesPage.eyebrow")}</p>
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-light tracking-tighter text-strong leading-[1.05]" data-testid="services-title">
            {t("servicesPage.title")}
          </h1>
          <p className="mt-5 text-lg text-muted-fg leading-relaxed">{t("servicesPage.subtitle")}</p>
        </div>

        {/* Quick anchors */}
        <div className="mt-8 flex flex-wrap gap-2">
          {services.map((s) => (
            <a key={s.key} href={`#svc-${s.key}`}
              className="text-sm rounded-full px-4 py-2 border border-app surface text-strong hover:border-pear-500 transition-colors inline-flex items-center gap-2"
              data-testid={`services-jump-${s.key}`}>
              <s.icon className="h-4 w-4 text-pear-500" />
              {lang === "nl" ? s.title_nl : s.title_en}
            </a>
          ))}
        </div>
      </section>

      {services.map((svc, idx) => (
        <section
          key={svc.key}
          id={`svc-${svc.key}`}
          className={`py-20 ${idx % 2 === 1 ? "surface-2" : ""}`}
          data-testid={`service-section-${svc.key}`}
        >
          <div className="max-w-7xl mx-auto px-6 lg:px-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center mb-16">
              <div className="lg:col-span-6">
                <div className="w-12 h-12 rounded-full bg-pear-100 text-pear-500 flex items-center justify-center mb-5">
                  <svc.icon className="h-6 w-6" />
                </div>
                <span className="inline-block text-xs uppercase tracking-widest bg-pear-100 text-pear-700 rounded-full px-3 py-1.5 font-semibold mb-4">
                  {lang === "nl" ? "vanaf" : "from"} {svc.priceFrom}
                </span>
                <h2 className="font-heading text-3xl sm:text-4xl font-medium tracking-tight text-strong leading-tight">
                  {lang === "nl" ? svc.title_nl : svc.title_en}
                </h2>
                <p className="mt-4 text-lg text-muted-fg leading-relaxed">
                  {lang === "nl" ? svc.subtitle_nl : svc.subtitle_en}
                </p>
                <p className="mt-3 text-sm text-muted-fg italic">
                  {lang === "nl" ? svc.intro_nl : svc.intro_en}
                </p>
                <div className="mt-6">
                  <Link to="/contact" className="btn-primary" data-testid={`services-cta-${svc.key}`}>
                    {t("servicesPage.cta")} <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
              <div className="lg:col-span-6">
                <div className="rounded-3xl overflow-hidden aspect-[5/4] shadow-[0_30px_80px_rgba(2,192,255,0.14)]">
                  <img src={svc.hero_img} alt={svc.title_en} className="w-full h-full object-cover" />
                </div>
              </div>
            </div>

            {/* Sub-service cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {svc.items.map((item, i) => (
                <motion.article
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.5, delay: (i % 4) * 0.06 }}
                  className="rounded-2xl overflow-hidden border border-app surface card-lift"
                  data-testid={`svc-${svc.key}-item-${i}`}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-0">
                    <div className="sm:col-span-2 aspect-[4/3] sm:aspect-auto overflow-hidden">
                      <img src={item.img} alt={item.title[lang]} className="w-full h-full object-cover" />
                    </div>
                    <div className="sm:col-span-3 p-6">
                      <h3 className="font-heading text-lg font-semibold text-strong mb-2">{item.title[lang]}</h3>
                      <p className="text-sm text-muted-fg leading-relaxed">{item.desc[lang]}</p>
                    </div>
                  </div>
                </motion.article>
              ))}
            </div>
          </div>
        </section>
      ))}

      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
        <div className="relative rounded-3xl overflow-hidden bg-pear-900 text-white p-10 lg:p-14">
          <div className="pear-blob bg-pear-500 w-[380px] h-[380px] top-[-120px] right-[-80px]" />
          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <h3 className="font-heading text-3xl sm:text-4xl font-medium tracking-tight leading-tight max-w-lg">{t("cta.title")}</h3>
            <Link to="/contact" className="btn-primary self-start" data-testid="services-page-cta">
              {t("cta.button")} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

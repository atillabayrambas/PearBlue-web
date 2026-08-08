import React from "react";
import { motion } from "framer-motion";
import { useLang } from "../i18n/LanguageContext";
import { usePageSeo } from "../hooks/usePageSeo";

const NL = `
# Privacybeleid

PearBlue (KvK 89654321, gevestigd te Delfzijl, Nederland) hecht groot belang aan de bescherming van jouw persoonsgegevens. Dit privacybeleid beschrijft welke gegevens wij verwerken, waarom en hoe wij daarmee omgaan.

## Artikel 1 — Verantwoordelijke

PearBlue is de verwerkingsverantwoordelijke voor jouw persoonsgegevens. Contact via **privacy@pearblue.nl** of +31 596 229 030.

## Artikel 2 — Welke gegevens verwerken wij?

- **Contact/offerte**: naam, e-mail, telefoon, bericht.
- **Klantportaal**: naam, e-mail, bedrijfsgegevens (KVK, BTW), factuur- en projectgegevens via Zoho.
- **Reviews**: naam (of pseudoniem), waardering, tekst.
- **AI-chatbot**: sessie-ID, ingevoerde berichten, geanonimiseerd voor optimalisatie.
- **Cybersecurity-logs**: IP-adres, user-agent, verzoeken die door de rate-limiter of DDOS-filter zijn geblokkeerd (uitsluitend voor beveiliging).
- **Websiteanalyse**: geanonimiseerde bezoek-statistieken via PostHog en/of Google Analytics (alleen na cookieconsent).

## Artikel 3 — Doeleinden

1. Uitvoering van een overeenkomst of dienstverlening.
2. Beantwoorden van vragen en offertes.
3. Beheer van klantportaal, facturen en support.
4. Verbetering van onze website en dienstverlening (analytics, feedback).
5. Voldoen aan wettelijke verplichtingen (fiscale bewaarplicht).
6. Bescherming tegen misbruik (spam, brute-force, DDOS).

## Artikel 4 — Rechtsgrondslagen

- Uitvoering van de overeenkomst (art. 6 lid 1 sub b AVG)
- Wettelijke verplichting (art. 6 lid 1 sub c AVG)
- Gerechtvaardigd belang — o.a. fraudepreventie en beveiliging (art. 6 lid 1 sub f AVG)
- Toestemming voor niet-noodzakelijke cookies en marketing (art. 6 lid 1 sub a AVG)

## Artikel 5 — Delen met derden

Wij delen persoonsgegevens uitsluitend met verwerkers die noodzakelijk zijn voor onze dienstverlening:

- **Zoho Corporation** (EU DC — Books/Projects/Desk) — klantportaal & facturatie
- **Resend** — transactionele e-mail
- **Stripe** — iDEAL/kaartbetalingen
- **Anthropic / Emergent** — AI-chatbot
- **Brevo** (voorheen Sendinblue) — mailmarketing (alleen bij aanmelding)
- **PostHog / Google Analytics** — geanonimiseerde bezoekstatistieken

Met alle bovenstaande partijen zijn verwerkersovereenkomsten gesloten. Gegevens worden binnen de EU verwerkt tenzij anders aangegeven (met passende waarborgen zoals SCC's).

## Artikel 6 — Bewaartermijnen

- Contact-/offerte-berichten: **24 maanden** na laatste interactie.
- Klantportaal & facturen: **7 jaar** (fiscale bewaarplicht).
- Cybersecurity-logs: **90 dagen**, tenzij onderzoek loopt.
- Chatbot-transcripten: **12 maanden**, geanonimiseerd na 90 dagen.
- Feedback-inzendingen: **24 maanden**.

## Artikel 7 — Jouw rechten

Je hebt recht op inzage, rectificatie, verwijdering, beperking, dataportabiliteit en bezwaar. Ook kun je toestemming intrekken voor cookies en marketing. Verzoeken kun je richten aan **privacy@pearblue.nl**. Wij reageren binnen 30 dagen.

Ben je het niet eens met de afhandeling? Dan kun je klacht indienen bij de **Autoriteit Persoonsgegevens** (autoriteitpersoonsgegevens.nl).

## Artikel 8 — Cookies

Wij gebruiken functionele cookies (noodzakelijk voor de site) en — na expliciete toestemming — analytische en marketing-cookies. Je kunt jouw voorkeuren wijzigen via de cookiebanner onderaan de pagina.

## Artikel 9 — Beveiliging

Wij passen passende technische en organisatorische maatregelen toe: HTTPS, encrypted tokens (Fernet), IP-rate-limiting, MFA voor beheer, geregelde back-ups en cybersecurity-monitoring via Bitdefender GravityZone.

## Artikel 10 — Wijzigingen

Wij kunnen dit privacybeleid wijzigen. De actuele versie staat altijd op **pearblue.nl/privacybeleid** met vermelding van de laatste update.

---

*Laatst bijgewerkt: februari 2026 · PearBlue · KvK 89654321 · privacy@pearblue.nl · +31 596 229 030*
`;

const EN = `
# Privacy Policy

PearBlue (Chamber of Commerce nr. 89654321, based in Delfzijl, The Netherlands) values the protection of your personal data. This privacy policy describes what data we process, why, and how we handle it.

## Article 1 — Controller

PearBlue is the controller for your personal data. Contact via **privacy@pearblue.nl** or +31 596 229 030.

## Article 2 — Which data do we process?

- **Contact/quote**: name, email, phone, message.
- **Client portal**: name, email, company details (CoC, VAT), invoice and project data via Zoho.
- **Reviews**: name (or alias), rating, text.
- **AI chatbot**: session ID, entered messages, anonymized for optimization.
- **Cybersecurity logs**: IP address, user-agent, requests blocked by the rate limiter or DDOS filter (solely for security purposes).
- **Website analytics**: anonymized visitor stats via PostHog and/or Google Analytics (only after cookie consent).

## Article 3 — Purposes

1. Execution of a contract or service delivery.
2. Answering questions and quotes.
3. Managing the client portal, invoices and support.
4. Improving our website and service (analytics, feedback).
5. Complying with legal obligations (tax retention).
6. Protection against abuse (spam, brute-force, DDOS).

## Article 4 — Legal bases

- Performance of a contract (art. 6(1)(b) GDPR)
- Legal obligation (art. 6(1)(c) GDPR)
- Legitimate interest — incl. fraud prevention & security (art. 6(1)(f) GDPR)
- Consent for non-essential cookies and marketing (art. 6(1)(a) GDPR)

## Article 5 — Sharing with third parties

We share personal data only with processors necessary for our services:

- **Zoho Corporation** (EU DC — Books/Projects/Desk) — client portal & billing
- **Resend** — transactional email
- **Stripe** — iDEAL/card payments
- **Anthropic / Emergent** — AI chatbot
- **Brevo** (formerly Sendinblue) — email marketing (only after opt-in)
- **PostHog / Google Analytics** — anonymized visitor statistics

Data processing agreements are in place with all listed parties. Data is processed within the EU unless stated otherwise (with appropriate safeguards such as SCCs).

## Article 6 — Retention periods

- Contact/quote messages: **24 months** after last interaction.
- Client portal & invoices: **7 years** (tax retention obligation).
- Cybersecurity logs: **90 days**, unless investigation is ongoing.
- Chatbot transcripts: **12 months**, anonymized after 90 days.
- Feedback submissions: **24 months**.

## Article 7 — Your rights

You have rights of access, rectification, erasure, restriction, portability and objection. You can also withdraw consent for cookies and marketing. Requests can be sent to **privacy@pearblue.nl**. We reply within 30 days.

If you disagree with our handling, you can file a complaint with the **Dutch Data Protection Authority** (autoriteitpersoonsgegevens.nl).

## Article 8 — Cookies

We use functional cookies (necessary for the site) and — after explicit consent — analytical and marketing cookies. You can adjust your preferences via the cookie banner at the bottom of the page.

## Article 9 — Security

We apply appropriate technical and organizational measures: HTTPS, encrypted tokens (Fernet), IP rate limiting, MFA for admin, regular backups and cybersecurity monitoring via Bitdefender GravityZone.

## Article 10 — Amendments

We may amend this policy. The current version is always published at **pearblue.nl/privacy** with the latest-update date.

---

*Last updated: February 2026 · PearBlue · CoC 89654321 · privacy@pearblue.nl · +31 596 229 030*
`;

const renderMd = (md) => {
  const lines = md.split("\n");
  const out = [];
  let list = [];
  const flushList = () => {
    if (list.length) {
      out.push(<ul key={`ul-${out.length}`} className="list-disc pl-6 space-y-1 my-4 text-strong/90">{list.map((it, i) => <li key={i} dangerouslySetInnerHTML={{ __html: it }} />)}</ul>);
      list = [];
    }
  };
  const bold = (s) => s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  lines.forEach((line, i) => {
    if (/^# /.test(line)) { flushList(); out.push(<h1 key={i} className="font-heading text-4xl sm:text-5xl font-medium text-strong mb-6">{line.replace(/^# /, "")}</h1>); }
    else if (/^## /.test(line)) { flushList(); out.push(<h2 key={i} className="font-heading text-2xl font-semibold text-strong mt-10 mb-3">{line.replace(/^## /, "")}</h2>); }
    else if (/^\d+\. /.test(line)) { out.push(<p key={i} className="my-2 text-strong/90 pl-4" dangerouslySetInnerHTML={{ __html: bold(line) }} />); }
    else if (/^- /.test(line)) { list.push(bold(line.replace(/^- /, ""))); }
    else if (/^---$/.test(line)) { flushList(); out.push(<hr key={i} className="my-8 border-app" />); }
    else if (/^\*.*\*$/.test(line.trim()) && !line.includes("**")) { flushList(); out.push(<p key={i} className="text-xs text-muted-fg italic mt-4">{line.replace(/^\*|\*$/g, "")}</p>); }
    else if (line.trim()) { flushList(); out.push(<p key={i} className="my-3 text-strong/90 leading-relaxed" dangerouslySetInnerHTML={{ __html: bold(line) }} />); }
  });
  flushList();
  return out;
};

export default function PrivacyPage() {
  const { lang } = useLang();
  usePageSeo({
    title: lang === "en" ? "Privacy Policy" : "Privacybeleid",
    description: lang === "en"
      ? "How PearBlue handles your personal data, retention, rights and legal bases."
      : "Hoe PearBlue omgaat met jouw persoonsgegevens, bewaartermijnen, rechten en rechtsgrondslagen.",
    path: "/privacybeleid",
  });
  return (
    <div className="max-w-3xl mx-auto px-6 lg:px-10 py-16" data-testid="page-privacy">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        {renderMd(lang === "en" ? EN : NL)}
      </motion.div>
    </div>
  );
}

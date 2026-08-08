import React from "react";
import { motion } from "framer-motion";
import { useLang } from "../i18n/LanguageContext";
import { usePageSeo } from "../hooks/usePageSeo";

const NL = `
# Algemene Voorwaarden

Deze algemene voorwaarden zijn van toepassing op alle overeenkomsten met PearBlue (KvK 89654321, gevestigd te Delfzijl, Nederland), verder aangeduid als "PearBlue", "wij" of "ons".

## Artikel 1 — Definities

- **Opdrachtgever**: de natuurlijke persoon of rechtspersoon die met PearBlue een overeenkomst aangaat.
- **Diensten**: alle door PearBlue geleverde diensten waaronder — maar niet beperkt tot — websiteontwikkeling, mediaproductie, IT-infrastructuur, cybersecurity-audits en AI-integraties.
- **Overeenkomst**: elke afspraak tussen PearBlue en Opdrachtgever, schriftelijk of langs elektronische weg vastgelegd.

## Artikel 2 — Toepasselijkheid

1. Deze voorwaarden gelden voor iedere aanbieding, offerte en overeenkomst tussen PearBlue en Opdrachtgever, tenzij partijen uitdrukkelijk en schriftelijk zijn afgeweken.
2. Inkoop- of andere voorwaarden van Opdrachtgever worden uitdrukkelijk van de hand gewezen.

## Artikel 3 — Offertes en aanbiedingen

1. Alle offertes zijn vrijblijvend en 30 dagen geldig, tenzij anders vermeld.
2. Kennelijke vergissingen of fouten in de offerte binden PearBlue niet.

## Artikel 4 — Prijzen en betaling

1. Alle prijzen zijn in euro's, exclusief btw en eventuele reiskosten, tenzij anders vermeld.
2. Facturen dienen binnen **14 dagen** na factuurdatum voldaan te zijn.
3. Bij overschrijding van de betaaltermijn is Opdrachtgever van rechtswege in verzuim en verschuldigd wettelijke handelsrente plus buitengerechtelijke incassokosten conform WIK.
4. PearBlue kan aan zakelijke opdrachtgevers vragen om een aanbetaling van 30-50% van de projectsom voordat gestart wordt.

## Artikel 5 — Uitvoering van de opdracht

1. PearBlue spant zich in de opdracht zorgvuldig uit te voeren, met de vereiste vakbekwaamheid — inspanningsverplichting, geen resultaatsverplichting tenzij expliciet overeengekomen.
2. Opdrachtgever draagt zorg voor tijdige aanlevering van benodigde informatie, teksten, beeldmateriaal en toegangen. Vertraging vanuit Opdrachtgever leidt tot herplanning.
3. Meerwerk buiten de originele scope wordt schriftelijk (via e-mail) bevestigd en apart gefactureerd.

## Artikel 6 — Intellectueel eigendom

1. Alle rechten van intellectueel eigendom op ontwikkelde websites, ontwerpen, code en content berusten bij PearBlue tot volledige betaling van de laatste factuur.
2. Na volledige betaling verkrijgt Opdrachtgever een niet-exclusief, wereldwijd gebruiksrecht op het opgeleverde eindresultaat voor zijn eigen bedrijfsvoering.
3. PearBlue behoudt het recht om het geleverde werk te tonen in eigen portfolio, tenzij schriftelijk anders overeengekomen (NDA).

## Artikel 7 — Hosting, onderhoud en SLA

1. Voor doorlopende diensten (hosting, onderhoud, monitoring) gelden aparte SLA's die worden opgenomen in de dienstovereenkomst.
2. PearBlue garandeert geen 100% beschikbaarheid maar streeft naar minimaal 99,5% uptime per kalendermaand.
3. Opzegging van doorlopende diensten geschiedt schriftelijk met een opzegtermijn van één (1) kalendermaand.

## Artikel 8 — Aansprakelijkheid

1. De totale aansprakelijkheid van PearBlue is beperkt tot het bedrag dat in het betreffende geval door de aansprakelijkheidsverzekering wordt uitgekeerd, dan wel — indien geen verzekeringsuitkering plaatsvindt — tot maximaal het factuurbedrag van de opdracht over de laatste zes (6) maanden.
2. PearBlue is niet aansprakelijk voor indirecte schade, gevolgschade, gederfde winst, gemiste besparingen of dataverlies.
3. Deze beperkingen gelden niet bij opzet of grove nalatigheid.

## Artikel 9 — Privacy en verwerking van persoonsgegevens

1. PearBlue verwerkt persoonsgegevens conform de AVG/GDPR. Waar PearBlue als verwerker optreedt, wordt een verwerkersovereenkomst gesloten.
2. Aanmeldingen via het contactformulier en klantportaal worden bewaard tot maximaal **24 maanden** na laatste interactie, tenzij een langere wettelijke bewaartermijn geldt (bijv. fiscale bewaarplicht 7 jaar).
3. Ons volledige privacybeleid is beschikbaar op verzoek via privacy@pearblue.nl.

## Artikel 10 — Overmacht

1. PearBlue is niet gehouden tot nakoming indien sprake is van overmacht — waaronder maar niet beperkt tot storingen bij hostingpartijen, cyberaanvallen, energie-uitval, pandemieën of overheidsmaatregelen.
2. Duurt de overmacht langer dan 60 dagen, dan hebben beide partijen het recht de overeenkomst schriftelijk te ontbinden zonder schadevergoeding.

## Artikel 11 — Reviews en klantcommunicatie

1. Klanten kunnen via het klantportaal reviews indienen. PearBlue behoudt het recht reviews te modereren op basis van beleefdheidsnormen en waarheidsgetrouwheid.
2. Uitnodigingen om reviews op derden-platforms (Google, Trustpilot, Facebook) achter te laten zijn optioneel; deelname is nooit voorwaardelijk voor levering.

## Artikel 12 — Herroeping en annulering

1. Bij consumenten (particuliere klanten) geldt een bedenktijd van 14 dagen conform artikel 6:230o BW, tenzij het gaat om op maat gemaakt digitaal werk waar met de uitvoering is begonnen na uitdrukkelijke toestemming (art. 6:230p sub g BW).
2. Zakelijke opdrachtgevers hebben geen wettelijk herroepingsrecht. Annulering na aanvang leidt tot doorbelasting van gemaakte uren en gereserveerde capaciteit.

## Artikel 13 — Geschillen en toepasselijk recht

1. Op alle overeenkomsten met PearBlue is uitsluitend **Nederlands recht** van toepassing.
2. Geschillen worden voorgelegd aan de bevoegde rechter in het arrondissement Noord-Nederland, tenzij dwingend recht anders voorschrijft.

## Artikel 14 — Wijzigingen

PearBlue behoudt het recht deze voorwaarden te wijzigen. De actuele versie wordt op **pearblue.nl/voorwaarden** gepubliceerd. Bij ingrijpende wijzigingen worden actieve opdrachtgevers per e-mail geïnformeerd.

---

*Laatst bijgewerkt: februari 2026 · PearBlue · KvK 89654321 · info@pearblue.nl · +31 596 229 030*
`;

const EN = `
# Terms & Conditions

These terms & conditions apply to all agreements with PearBlue (Chamber of Commerce nr. 89654321, based in Delfzijl, The Netherlands), hereinafter referred to as "PearBlue", "we" or "us".

## Article 1 — Definitions

- **Client**: the natural or legal person entering into an agreement with PearBlue.
- **Services**: all services delivered by PearBlue including — but not limited to — website development, media production, IT infrastructure, cybersecurity audits and AI integrations.
- **Agreement**: any arrangement between PearBlue and Client, recorded in writing or electronically.

## Article 2 — Applicability

1. These terms apply to every offer, quote and agreement between PearBlue and Client, unless the parties have explicitly agreed otherwise in writing.
2. Client's purchasing or other conditions are expressly rejected.

## Article 3 — Quotes and offers

1. All quotes are non-binding and valid for 30 days, unless otherwise stated.
2. Obvious errors in a quote do not bind PearBlue.

## Article 4 — Prices and payment

1. All prices are in euros, excluding VAT and any travel costs, unless stated otherwise.
2. Invoices must be paid within **14 days** of the invoice date.
3. Late payment automatically constitutes default and results in statutory commercial interest plus extra-judicial collection costs.
4. PearBlue may request a down payment of 30-50% of the project total from business clients before commencement.

## Article 5 — Execution of the assignment

1. PearBlue undertakes to perform the assignment carefully and with due professional expertise — this is a best-efforts obligation, not a result obligation, unless explicitly agreed.
2. Client is responsible for timely delivery of required information, copy, media and access. Delays on the Client's side lead to rescheduling.
3. Additional work outside the original scope will be confirmed in writing (via email) and invoiced separately.

## Article 6 — Intellectual property

1. All intellectual property rights on developed websites, designs, code and content remain with PearBlue until full payment of the final invoice.
2. After full payment, Client obtains a non-exclusive, worldwide right of use of the delivered end-result for its own business operations.
3. PearBlue reserves the right to display delivered work in its own portfolio, unless otherwise agreed in writing (NDA).

## Article 7 — Hosting, maintenance and SLA

1. For recurring services (hosting, maintenance, monitoring) separate SLAs apply, incorporated in the service agreement.
2. PearBlue does not guarantee 100% availability but strives for at least 99.5% uptime per calendar month.
3. Recurring services can be cancelled in writing with a notice period of one (1) calendar month.

## Article 8 — Liability

1. PearBlue's total liability is limited to the amount paid out by our professional liability insurance for the relevant case — or, if no insurance payout is made, to a maximum of the invoiced amount over the last six (6) months.
2. PearBlue is not liable for indirect damage, consequential damage, lost profits, missed savings or data loss.
3. These limitations do not apply in case of wilful misconduct or gross negligence.

## Article 9 — Privacy and personal data

1. PearBlue processes personal data in accordance with the GDPR. Where PearBlue acts as a processor, a data processing agreement will be signed.
2. Contact form and client portal submissions are retained for up to **24 months** after last interaction, unless a longer statutory retention period applies (e.g. 7-year tax retention).
3. Our full privacy policy is available on request via privacy@pearblue.nl.

## Article 10 — Force majeure

1. PearBlue is not obliged to perform in case of force majeure — including but not limited to hosting-provider outages, cyberattacks, energy failure, pandemics or government measures.
2. If force majeure lasts more than 60 days, both parties are entitled to terminate the agreement in writing without compensation.

## Article 11 — Reviews and client communication

1. Clients may submit reviews via the client portal. PearBlue reserves the right to moderate reviews on grounds of civility and truthfulness.
2. Invitations to post reviews on third-party platforms (Google, Trustpilot, Facebook) are optional; participation is never a condition of delivery.

## Article 12 — Withdrawal and cancellation

1. For consumers (private clients), a 14-day cooling-off period applies pursuant to Dutch Civil Code art. 6:230o, unless the work concerns custom-made digital work where execution began after explicit consent (art. 6:230p sub g BW).
2. Business clients have no statutory right of withdrawal. Cancellation after commencement results in charge-back of hours spent and reserved capacity.

## Article 13 — Disputes and applicable law

1. All agreements with PearBlue are exclusively governed by **Dutch law**.
2. Disputes will be submitted to the competent court in the district of North Netherlands, unless mandatory law prescribes otherwise.

## Article 14 — Amendments

PearBlue reserves the right to amend these terms. The current version is published on **pearblue.nl/terms**. Active clients will be notified by email of substantive changes.

---

*Last updated: February 2026 · PearBlue · CoC 89654321 · info@pearblue.nl · +31 596 229 030*
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
    else if (/^\d+\. /.test(line)) {
      out.push(<p key={i} className="my-2 text-strong/90 pl-4" dangerouslySetInnerHTML={{ __html: bold(line) }} />);
    }
    else if (/^- /.test(line)) { list.push(bold(line.replace(/^- /, ""))); }
    else if (/^---$/.test(line)) { flushList(); out.push(<hr key={i} className="my-8 border-app" />); }
    else if (/^\*.*\*$/.test(line.trim()) && !line.includes("**")) { flushList(); out.push(<p key={i} className="text-xs text-muted-fg italic mt-4">{line.replace(/^\*|\*$/g, "")}</p>); }
    else if (line.trim()) { flushList(); out.push(<p key={i} className="my-3 text-strong/90 leading-relaxed" dangerouslySetInnerHTML={{ __html: bold(line) }} />); }
  });
  flushList();
  return out;
};

export default function TermsPage() {
  const { lang } = useLang();
  usePageSeo({
    title: lang === "en" ? "Terms & Conditions" : "Algemene Voorwaarden",
    description: lang === "en"
      ? "PearBlue terms & conditions covering payments, IP, liability, GDPR and disputes."
      : "PearBlue algemene voorwaarden — betaling, IP, aansprakelijkheid, AVG en geschillen.",
    path: "/voorwaarden",
  });
  return (
    <div className="max-w-3xl mx-auto px-6 lg:px-10 py-16" data-testid="page-terms">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        {renderMd(lang === "en" ? EN : NL)}
      </motion.div>
    </div>
  );
}

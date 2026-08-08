# PearBlue Website — PRD

## Original Problem Statement
"Make a website based on everything described in the excel file" — Reference: `Website_Offerte_Template_Sociaal_NL.xlsx` (PearBlue quote template).

PearBlue is a Dutch ICT & Media Design agency ("Your Complete Digital Partner"). Brand: pear + leaves, fresh/fruity/modern. Target: business starters + older-generation entrepreneurs.

## Architecture
- **Frontend**: React 19 + React Router + Tailwind + shadcn/ui + framer-motion. NL/EN via LanguageContext.
- **Backend**: FastAPI + Motor (MongoDB async). All routes prefixed `/api`. Starlette `SessionMiddleware` for Zoho OAuth state.
- **Integrations**: Claude Sonnet 4.6 (Emergent LLM key) chatbot, Resend (transactional email), Zoho OAuth 2.0 (Books/Projects/Desk EU DC).
- **Design**: primary `#02C0FF`, Outfit (headings) + Manrope (body).

## Core Requirements
- 5 pages: Home, About, Services, Portfolio, Contact
- Multi-language NL/EN with browser auto-detect
- Contact form + quote endpoints (Resend delivery)
- Admin CMS for portfolio, messages, GA settings, registrations, reviews
- Zoho-connected client portal (invoices/projects/tickets)
- AI chatbot with rate limiting + analytics dashboard
- Cookie/GDPR banner + GA4 opt-in

## Implemented
### Feb 2026 — Iterations 1–6
- 5-page site, NL/EN switcher, dark/light theme
- Admin CMS (projects, messages, settings, GA4 config)
- Claude 4.6 chatbot (`/api/chat`) with rate limiting + admin AI-cost dashboard
- Cookie banner, GA4 loader (`AnalyticsLoader`), robots.txt, sitemap.xml
- Resend contact + portal notifications
- Zoho OAuth 2.0 portal (Books invoices, Projects, Desk tickets) with token encryption (Fernet)
- Portal client registration flow + admin approve/reject with automated email

### Feb 2026 — Iteration 7 (this session)
- **Client Reviews / Testimonials** — public POST `/api/reviews`, admin CMS tab (`/admin/reviews`) with approve / feature / delete, featured reviews render on the homepage (`FeaturedReviews`), `ReviewForm` exposed inside authenticated `/portal`.
- **Zoho OAuth Redirect URI fix** — frontend callback route `/oauth/zoho/callback` + `POST /api/auth/zoho/exchange` endpoint so the URI matches the Zoho console entries (`http://localhost:3000/oauth/zoho/callback`, `https://pearblue.nl/oauth/zoho/callback`, and the preview URL).
- **Privacy fix** — `GET /api/reviews` no longer accepts `approved` query param; public route always returns only approved reviews. Admin uses `GET /api/reviews/all`.
- **CORS hardening** — replaced wildcard `*` with explicit allow-list (preview URL + pearblue.nl + localhost) so `withCredentials` cookies (Zoho session) actually get set in the browser.
- **XSS-in-admin-email hardening** — HTML-escape user-submitted review name/company/quote in the notification email body.
- **Login-page logo** — Admin + Portal login pages both render `PearBlue logo-10.webp` via the icon-only Logo variant (theme-independent, as requested).
- Testing: pytest 28/28 pass, Playwright frontend end-to-end pass (`/app/test_reports/iteration_7.json`).

### Feb 2026 — Iterations 8–11
- Stripe iDEAL "Betaal Nu" on open Zoho Books invoices (`stripe_payments.py`, `PaymentSuccess.jsx`).
- Review invitations + Trust-stats (Trustpilot/Google) UI.
- Portal in-app Zoho Project detail page, i18n for portal.
- User Management CMS (6 roles: super_admin/beheerder/analist/moderator/chat_support/gebruiker).
- Custom Scripts CMS (header + footer) with public `/api/site/scripts`.
- Algemene Voorwaarden / Terms & Conditions page (`/voorwaarden`, `/terms`).
- Portal ticket detail (thread view + reply).
- Super-admin via Zoho OAuth (`beheer@multibay.eu`) with `admin_token` handoff.

### Feb 2026 — Iteration 12 (this session, tested)
- **AI Chat anti-spam** — regex spam detection on `/api/chat`; blocked messages return 400 with inline notice (`Chatbot.jsx`).
- **"Vraag een agent" handoff** — `POST /api/chat/agent-handoff` logs to `db.chat_handoffs`, emails support with recent chat history, schedules a 2-min fallback reminder if unacknowledged. Admin ack via `POST /api/chat/agent-handoff/{id}/ack`.
- **Ticket attachments** — client → Zoho Desk multipart upload via `POST /api/portal/tickets/{id}/attachments` (20 MB cap, uses `python-multipart`).
- **Trustpilot script bugfix** — `PUT /api/admin/scripts` now writes scripts directly into `public/index.html` between `<!-- PB_HEADER_START -->` / `<!-- PB_FOOTER_START -->` markers so third-party crawlers see them at HTML level.
- **CustomScriptsInjector polish** — client-side fallback now uses `DOMParser` so `<meta>`/`<link>` tags survive runtime injection (SSR path was already fine).
- **Testing**: pytest 17/17 pass + Playwright frontend flows all green (`/app/test_reports/iteration_12.json`).

### Feb 2026 — Iteration 13 (this session, tested 21/21 + frontend green)
- **Prijslijst** (`/prijslijst`) — volledige categorie-tabellen uit Excel + ankers + revisies-callout.
- **Kostencalculator** — modal met smartAverage (bias tegen extreme ranges) + één-malig/maandelijks/uurlijks apart.
- **Privacybeleid** (`/privacybeleid`, `/privacy`) — 10 artikelen NL+EN.
- **Google Maps** op Contactpagina (Delfzijl embed).
- **LocalCaptcha + ConsentText** — checkbox + honeypot + timing-gate op contact/portal-register/reviews/chatbot.
- **IP-rate-limiter + block-logging** — contact/portal/reviews/chat hits worden gelogd in `cybersec_blocks` bij spam/rate-limit; manual reblock schrijft naar `cybersec_manual_blocks`.
- **Cybersecurity CMS** — wie/wat/waar/hoe/wanneer tabel, deblokkeren/opnieuw-blokkeren, daily chart, top-oorzaken.
- **Feedback-widget** + **Feedback CMS** — per pagina, status (nieuw/in behandeling/hold/afgerond), toewijzen, interne notities.
- **Sidebar-badges** peer-blauw (Berichten / Portaal / Reviews / Feedback / Cybersecurity) via `/api/admin/counters`.
- **MessagesAdmin uitgebreid** — status, toewijzen, notities, "Antwoord via e-mail" button.
- **Cybersecurity prijs** €5 p/machine → **€5 p/machine p/maand** (translations + PricingTables bullets).
- **Terms** — Artikel 5 clause 4 "5 revisierondes" toegevoegd (NL+EN).
- **Mobiele header fix** — thema + taal in hamburger; CMS-knop blijft in top bar.
- **Parallax pear-achtergrond** — fixed, 4,5% opacity, subtiele scroll drift, verborgen op /admin.
- **Versie 1.2** in footer + Terms.
- Testing: pytest 21/21 pass + Playwright all flows green (`/app/test_reports/iteration_13.json`).

### Feb 2026 — Iteration 14 (this session, 9/9 pytest + all UI flows green)
- **Prijslijst 3-tabs**: Website & Media / ICT-diensten / Cybersecurity — categorieën per dienst.
- **Calculator herwerkt**: solid opaque modal + BTW 21% + wishlist (localStorage) + share (navigator.share/clipboard) + per-service subtotalen + gecombineerd.
- **Prijslijst design fix** (px-5 padding), **prijslijst uit footer**, **versie → v0.7-Beta**.
- **Volledige parallax pear** (dual-layer op alle publieke pagina's, verborgen op /admin).
- **About bold render fix** + **Terms 5.4 revisies-clause**.
- **Changelog**: publieke `/changelog` + CMS `/admin/changelog` + `GET /api/changelog` (7 versies).
- **CMS Version alert bar** (dismiss/bekijk/auto-31d).
- **Portfolio seed** (6 curated cases) + Archiveer-filter/knop + PATCH /projects/{id}.
- **Kruisrol-toewijzing** (`/admin/assignees`) op Feedback + Messages.
- **Messages upgrade**: Postvak IN / Spam / Archief / Alles + sort + Outlook-checkbox + prio P1-P4/Major + mark-spam + bulk-delete + delete-all-spam.
- **Cybersecurity UA-parsing** (OS/browser/device/land) + captcha-verified chart via `/telemetry/captcha-verified`.
- Bugfix door testing agent: `ContactMessage` Pydantic model uitgebreid met spam/priority/status/assigned_to/notes (anders verdwenen ze in GET response).

## Prioritized Backlog (Phase 4/5 — deferred)
- **P1** — Virusscanner tab in Cybersecurity (scan-API + quarantaine + mail-alert)
- **P1** — Brevo mailmarketing CMS-tab (lists/campaigns/tracking)
- **P1** — Zoho bidirectional contact-sync (daily worker)
- **P1** — Berichten ↔ Zoho Desk 2-way sync via ticket-nummer in subject
- **P1** — Review autopilot (invite dag na paid invoice)
- **P2** — Uitgebreid gebruikersbeheer (adres/postcode/KVK/BTW/wachtwoord-reset-mail/profielfoto pear-thema, 2-way Zoho sync in-place)
- **P2** — CMS pagination (5/10/25/50/100/200) op alle lijsten
- **P2** — Globale CMS zoekbalk met previews
- **P2** — Sharing facturen/projecten/tickets met externe email + dual-party confirmatie
- **P2** — Meta Pixel ID in AI Dashboard
- **P3** — ICT + Cybersecurity managed prijzen (wacht op user-input)
- **P3** — Volledige EN i18n voor CMS labels
- **P3** — Refactor `server.py` (1764 regels) naar `routes/*.py`

### Feb 2026 — Iteration 15 (this session, 16/16 pytest + all UI flows green)
- **Prijslijst fixes**: 'Product-/dienstdetail paginastructuur' verwijderd; 'Adressen & verzending' → flat €10 (was €10-150); nieuw: **Mailbox-integratie (IMAP) €50** eenmalig.
- **Calculator herwerkt (3 kolommen)**: Eenmalig / Maandelijks (vast) / Uurlijks (los) elk met eigen Subtotaal + BTW + Totaal. Setup-kolom weg (valt onder Eenmalig). Feedback-widget in modal. Wishlist opslaan met info-tooltip over cookies/profiel.
- **About**: 9 waarden — toegevoegd Transparant, Toekomstgericht, Fris & Fruitig, Duurzaam, Kwaliteit.
- **Services**: 'Zie prijslijst' knop per dienst met deep-link `/prijslijst?tab=web|ict|cyber`.
- **Nieuwsbrief-aanmelding** in footer (geen captcha) via `POST /api/newsletter/subscribe`; analytics chart in CMS via `/api/admin/newsletter/stats`. Marketing-mails vanaf `communication-noreply@pearblue.nl`.
- **CMS Priority balloons**: Major (donkerrood, blijft), P1 (rood, terug elk uur na dismiss), P2 (geel, dismissible zoals changelog) — boven versie-bar, via `/api/admin/priority-alerts`.
- **Cybersecurity table**: sticky action-kolom (knoppen vielen buiten scherm).
- **Feedback + Messages**: avatar (pear-gradient initialen) + prettyRole (geen underscores).
- **Nieuwe CMS-tabs**:
  - **Mailboxen (IMAP)** — CRUD + RBAC (super_admin/admin/beheerder only) — IMAP-fetch **MOCKED**.
  - **Mailmarketing (Brevo)** — API-key entry + settings + campaigns lijst (**MOCKED** tot user Brevo-key invoert).
  - **Virusscanner** — logs + quarantine/restore endpoints, engine **MOCKED**.
- **User-details endpoints**: GET/PUT `/admin/users/{email}/details` voor adres/KVK/BTW/bedrijf/profielfoto; POST `/admin/users/{email}/reset-password` → reset-mail via Resend. Zoho 2-way sync **MOCKED** (`zoho_synced:false` in response).
- **Changelog data**: minor version format Vx.x.x nu ondersteund (v0.7.1-Beta live).
- **Versie sync**: footer + CMS sidebar tonen nu **v0.7.1-Beta**.

### Feb 2026 — Iteration 16 (this session)
- **P0 fix — 'Financiën' rol** toegevoegd aan backend `ROLE_PERMS` + `ALL_ROLES` + frontend `ROLE_LABELS`; nieuwe permission `financials` toegewezen aan super_admin/admin/beheerder/financien.
- **Fernet encryptie** — nieuwe helpers `enc_secret()` / `dec_secret()` op basis van `TOKEN_ENCRYPTION_KEY`. Brevo API-key + IMAP mailbox-wachtwoord worden nu versleuteld opgeslagen (prefix `enc:`).
- **Mailbox dubbele-sync preventie** — POST `/admin/mailboxes` weigert nu een tweede mailbox met hetzelfde e-mailadres (409).
- **AI Dashboard Financiën** — nieuwe route `/admin/financials` + backend `/api/admin/financials?period=7d|30d|90d|6m|1y..5y|custom`. Emergent AI-kosten berekend via werkelijk aantal `chat_messages`; Zoho Books-cijfers MOCKED (klaar voor Zoho Books API-koppeling).
- **Chat smiley-rating** — nieuwe endpoints `POST /api/chat/rating` + `GET /api/admin/chat/ratings`; UI in `Chatbot.jsx` (1-5 smileys na 2 exchanges). Analytics-grafiek op AI Dashboard.
- **Calculator uitgebreid**:
  - Per-categorie subtotalen (Eenmalig/Maandelijks/Uurlijks) onder elke categorie.
  - Overbodige middenblok "Setup / Per maand / Uurlijks" verwijderd (staat in de gecombineerde footer).
  - Submit-knop hernoemd naar "Offerte aanvragen en calculatie en wensen mee verzenden" (Dutch) / "Request quote & send calculation and wishes" (English).
  - Nieuw QuoteFromCalculator modal met "SFEER EN VERHAAL VAN UW WEBSITE" textarea.
  - `/api/quote` accepteert nu `wishlist_items`, `wishlist_totals` en `story`. Wishlist + totalen worden meegestuurd in de mail.
  - Mobiele share-tekst: "Dit is mijn wishlist bij PearBlue voor mijn droom website, IT platform en de beveiliging".
- **Version bump**: v0.5.1-Beta → **v0.5.2-Beta** (footer + CMS sidebar + changelog).

## Explicit MOCKED items (waiting on real integration)
- Brevo campaign send (API key opslag Fernet-encrypted, `/campaigns` retourneert placeholder response)
- IMAP mailbox fetching (settings + password Fernet-encrypted, dubbele-mailbox-preventie actief, geen echte inbox-sync)
- Virus scan engine (logs schema + quarantine/restore werkt, geen scan-uitvoering)
- Zoho user 2-way sync (backend accepts writes, geen Zoho Books push)
- Zoho Desk ticket ↔ mail 2-way sync via subject-parsing
- **Zoho Books financials** in `/admin/financials` (gefactureerd/betaald/openstaand/top klanten — allemaal MOCKED tot Zoho Books API-koppeling)
- Password reset UI-pagina (`/admin/reset-password?token=...`) — token verificatie werkt backend-side, UI-form ontbreekt

## Prioritized Backlog (Phase 5/6)
- **P0** — Wire real Brevo v3 API against api.brevo.com/v3/emailCampaigns + smtp-relay for `/api/newsletter/subscribe`
- **P0** — Wire real IMAP via aioimaplib; parse ticket-nummer regex `#TKT-\d+` in Subject/Message-ID/References; push to `db.contact_messages` + Zoho Desk via `zoho_portal.add_ticket_thread`
- **P0** — Wire Zoho Books API in `/api/admin/financials` (replace mocked `zoho_books` payload with real invoice/paid/outstanding totals)
- **P1** — Refactor `server.py` (2300+ lines) → `routes/priority.py`, `routes/newsletter.py`, `routes/brevo.py`, `routes/mailboxes.py`, `routes/virus_scanner.py`, `routes/user_details.py`, `routes/financials.py`, `routes/chat_rating.py`
- **P1** — Build `/admin/reset-password?token=...` page for actual password change
- **P1** — Wire ClamAV/VirusTotal for virus scanner
- **P1** — Zoho Books contact 2-way sync daily worker (auto-create client, conflict detect)
- **P1** — Detailed per-message/per-ticket CMS page (portal-style thread view with reply/status/assign/attach)
- **P2** — Random pear-thema profielfoto generator (avatar op basis van naam+seed)
- **P2** — CMS pagination selector (5/10/25/50/100/200) op alle lijsten
- **P2** — Globale CMS zoekbalk met previews
- **P2** — Sharing facturen/projecten/tickets met externe email + dual-party confirmatie
- **P2** — Meta Pixel ID in AI Dashboard
- **P2** — Review Autopilot (Send review invites automatically the day after every paid Zoho invoice)
- **P3** — ICT + Cybersecurity managed prijzen (wacht op user-input)
- **P3** — Volledige EN i18n voor CMS labels

## Test Credentials
- Admin: `admin@pearblue.nl` / `PearBlue2026!` — see `/app/memory/test_credentials.md`.
- Zoho: end-to-end OAuth requires a real user consent; endpoint contracts + redirect URL tested.

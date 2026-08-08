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

## Prioritized Backlog (Phase 4 & beyond)
- **P1** — Zoho bidirectionele contact-sync (daily worker, Zoho Books ↔ CMS gebruikers).
- **P1** — Review autopilot (invite dag na paid Zoho invoice).
- **P1** — Brevo mailmarketing integratie + CMS-tab (campaigns, lists, tracking).
- **P1** — Uitgebreid Gebruikersbeheer: adres/postcode/KVK/BTW/bedrijfsnaam velden, wachtwoord wijzigen / reset-mail knop, profielfoto randomizer (pear/robot thema), 2-way Zoho-sync in-place.
- **P1** — Berichten↔Zoho Desk 2-way koppeling (subject/header ticket-nummer parse; reply-in-CMS pusht naar Zoho; Zoho reply pusht naar berichten).
- **P2** — Sharing (facturen/projecten/tickets) met externe email, dubbele bevestiging via mail.
- **P2** — Changelog CMS-pagina + versies zichtbaar in footer + Terms.
- **P2** — Meta Pixel ID in Site Settings + toevoegen aan AI Dashboard.
- **P2** — CMS EN i18n compleet — audit alle statische strings in `AdminDashboard.jsx` (nu hardcoded NL).
- **P2** — Refactor `server.py` (>1500 lines) naar `routes/` en `AdminDashboard.jsx` naar `admin/tabs/*.jsx`.
- **P3** — ICT + Cybersecurity prijzen (wachten op user-input).
- **P3** — Twee-weg review-sync (Google/Trustpilot API-limitaties).

## Test Credentials
- Admin: `admin@pearblue.nl` / `PearBlue2026!` — see `/app/memory/test_credentials.md`.
- Zoho: end-to-end OAuth requires a real user consent; endpoint contracts + redirect URL tested.

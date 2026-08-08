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

## Test Credentials
- Admin: `admin@pearblue.nl` / `PearBlue2026!` — see `/app/memory/test_credentials.md`.
- Zoho: end-to-end OAuth requires a real user consent; endpoint contracts + redirect URL tested.

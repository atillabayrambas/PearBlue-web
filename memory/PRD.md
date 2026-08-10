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
### Feb 2026 — Iteration 23 (this session, v0.5.9-Beta) — OTAP procedure + Batch C essentials
- **OTAP procedure sectie op /over-ons** — nieuwe uitgebreide sectie met horizontal timeline (desktop) en verticale timeline (mobiel) van 6 fases: Intake · Ontwikkeling · Test · Acceptatie · Productie · Nazorg. Gekleurde iconen, dag-labels (Dag 1-7 / Doorlopend), animation-in-view. Callout benadrukt "Website live binnen 7 dagen. Transparant, betaalbaar."
- **30 unieke avatars + kleurpalet** — `AvatarPicker` component. 10 mannelijk (avataaars short-hair seeds) + 10 vrouwelijk (long-hair seeds) + 10 unisex robots (bottts-neutral). 8-kleuren achtergrond palette (pear/sky/mint/amber/rose/violet/coral/slate). Tabs: Alles / Mannelijk / Vrouwelijk / Unisex. Reset naar initialen knop.
- **Nederlandse postcode auto-fill** — `usePostalLookup` hook gebruikt postcode.tech als primaire bron met Nominatim (OSM) fallback. Vult straat + plaats + provincie + land automatisch in. Cache in memory zodat één postcode niet twee keer wordt opgehaald.
- **Telefoon met landcode-picker** — `PhoneInput` component met 31 dial codes, emoji-vlaggen (🇳🇱 🇧🇪 🇩🇪 🇫🇷 🇬🇧 …), inline zoekbalk in de dropdown. Slaat automatisch samengesteld `+31612345678` E.164-formaat op.
- **User Edit modal in CMS** uitgebreid — Kies avatar knop, Postcode+Huisnummer met Zoek-knop en on-blur autofill, aparte Provincie/regio veld, geïntegreerde PhoneInput.
- **Backend**: `UserDetailsUpdate` + GET/PUT endpoints accepteren nu ook `house_number`.
- **Testing**: alle nieuwe UI's smoke-tested (avatar grid, postcode Groningen 9711AA test, phone dial picker menu). Backend blijft groen.

### Feb 2026 — Iteration 22 (v0.5.8-Beta) — Batch B (CMS home, templates, attachment preview)
- **AI dashboard is nu de CMS-startpagina** (`/admin` → `AnalyticsAdmin`). Portfolio verhuisd naar `/admin/portfolio`.
- **Uitgebreide periode-selectie** in AI dashboard: 1D (default) / 7D / 30D / 90D / 6M / 1J / 2J / 3J / 5J + **Aangepast** met van/tot datumkiezer. Backend `/api/chat/stats` steunt nu `?from=YYYY-MM-DD&to=YYYY-MM-DD` en `days` tot 1825 (5 jaar). Zelfde geldt voor `/api/admin/chat/ratings`.
- **CMS auto-refresh 15s** — AnalyticsAdmin en MessagesAdmin herladen automatisch elke 15s zodat cijfers en berichten live blijven.
- **Antwoord-templates CRUD** — nieuw `/api/admin/reply-templates` GET/POST/PATCH/DELETE (RBAC via `messages` permission). Frontend: `ReplyTemplatesDropdown` in het antwoord-panel toont opgeslagen templates; `TemplatesManager` modal biedt volledige CRUD (titel + tekst). Snel-insert dropdown voegt template body toe aan reply-textarea.
- **Bijlage-preview** — nieuwe `AttachmentsGrid` (thumbnail-tegel per bijlage, via blob URL) + `AttachmentPreview` modal (fullscreen `<img>` voor images, `<iframe>` voor PDF). Nieuw backend endpoint `GET /api/admin/contact/{id}/attachments/{aid}/preview` levert bytes met `Content-Disposition: inline`.
- **CMS-taal (partieel)** — sidebar labels, "Signed in as" / "Ingelogd als", "Back to site" / "Terug naar site", "Log out" / "Uitloggen" en AI dashboard heading volgen nu `useLang()`. Diepere pagina-bodies (thread, portfolio-formulier) blijven Nederlands — volgende iteratie.
- **CMS sidebar** — toont e-mailadres in kleiner grijs onder display name (data-testid `cms-sidebar-email`).
- **Testing**: pytest 13/13 nieuw + 13/13 regressie iter20 = 26/26 groen (`/app/test_reports/iteration_22.json`). Frontend acceptatie-criteria alle geverifieerd.

### Feb 2026 — Iteration 21 (v0.5.7-Beta) — Mobile blockers batch A
- **Global `.pb-modal` utility** (in `index.css`) — mobile-first bottom-sheet on <640px, centered on ≥640px, capped at `100dvh` minus safe-area, internal flex+`.pb-modal-body` scroll pattern. Solid theme-aware background via `--pb-bg-solid` variable. Removes legacy `bg-white dark:bg-slate-900` + broken `var(--pb-bg-solid, white)` inline overrides across CalculatorModal, QuoteFromCalculator, User details editor and Feedback notes modal.
- **Body scroll lock** — new `hooks/useBodyScrollLock.js` adds `body.pb-lock-scroll`. Prevents underlying page from scrolling when Calculator modal or CMS mobile sidebar is open.
- **Chatbot creative repositioning** — via CSS, when any modal/drawer is open the floating chatbot launcher fades out and slides down on mobile (opacity 0 + translateY 120%) so it never covers the "Request quote" CTA. On desktop it slides 4rem left for the same reason.
- **Safe-area padding** — sticky navbar (`.glass-nav`) now respects `env(safe-area-inset-top)` so it paints under the iOS notch/status bar, removing the "space above header when scrolled to top".
- **Calculator swipe-to-close** — mobile-only drag handle bar at the top of the modal header. Touch-drag ≥ 80px downward within 500ms closes the modal. Close button (X) stays sticky in the header.
- **Quote-from-Calculator modal** — now uses `.pb-modal` + inherits surface theme; the white-in-dark bug is gone.
- **CMS mobile sidebar** — sets explicit `height: 100dvh` + `box-sizing: border-box` so `overflow-y-auto` actually kicks in (was `clientHeight === scrollHeight` before, blocking scroll). Now full-screen, safe-area padded and can scroll independently of the underlying page. Backdrop tap still closes. Body-scroll locked via `useBodyScrollLock`.
- **Frontend hamburger theme dropdown** — repositioned to `left-0 sm:right-0` so it no longer overflows the mobile menu on the left side.
- **Reviews marquee true infinite loop** — rebuilt to a 2-copy CSS marquee translating `translateX(0)` → `translateX(-50%)` for a seamless loop; also 22s → 18s for faster feel. Auto-pads to ≥6 cards if fewer real reviews exist so the strip never runs empty on wide viewports.

### Feb 2026 — Iteration 20 (v0.5.6-Beta) — Ticket Threads CMS
- **Nieuwe CMS-detailpagina** `/admin/messages/:msgId` — volledige conversational thread-weergave per contactbericht, analoog aan `/portal/tickets/:id`.
- **AdminMessageThread.jsx** — timeline die origineel bericht + admin-replies + interne notities chronologisch toont; klant-berichten in surface-2, admin-antwoorden in pear-blue tint, notities in amber-card. Statuschips, prioriteitschips, "Vergrendeld"-badge bij afgeronde items voor niet-admins.
- **Antwoord-panel** met onderwerp-veld, textarea, bijlage-picker (multi-file, max 20 MB), "E-mail naar klant sturen"-toggle en `Verstuur antwoord`-knop. Automatische status-flip naar `in_progress` (behoudt `done` als reeds afgerond via `$cond`-pipeline).
- **Bijlagen** — upload via multipart, download via `Content-Disposition attachment`-header, verwijder-icoon. Base64 payload wordt uit list-responses gestripped (bandwidth-vriendelijk).
- **Internal note** panel binnen dezelfde pagina; verschijnt als geel-gemarkeerde kaart in de timeline.
- **Meta-acties** — status/prioriteit-selects, mark-as-spam/undo, mailto-link → open in mail-client.
- **Backend endpoints** (allemaal `require_permission("messages")`):
  - `GET /api/admin/contact/{msg_id}` — detail + strip base64
  - `POST /api/admin/contact/{msg_id}/reply` — reply, e-mail via Resend, status-transitie
  - `POST /api/admin/contact/{msg_id}/attachments` — multipart upload, base64-opslag
  - `GET /api/admin/contact/{msg_id}/attachments/{aid}` — binary download
  - `DELETE /api/admin/contact/{msg_id}/attachments/{aid}` — bijlage verwijderen
- **MongoDB-fix** — Alle push-operaties (`replies`, `attachments`, `notes`) gebruiken nu aggregation-pipeline updates (`$concatArrays` + `$ifNull`) om te werken op oude docs waarin het veld `null` was i.p.v. array.
- **MessagesAdmin (list view)** — nieuwe "Bekijk gesprek →" knop per item die naar de threadpagina navigeert.
- **Testing**: pytest 13/13 + Playwright frontend end-to-end (`/app/test_reports/iteration_20.json`).

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

### Feb 2026 — Iteration 19 (this session, v0.5.5-Beta)
- **Password Reset UI-pagina** op `/admin/reset-password?token=…` — verify-token GET/apply POST volledig gekoppeld met backend (was al gebouwd). Foutafhandeling voor invalid/expired tokens + succes-flow met 2s redirect naar login.
- **Klantportaal aanvragen uitgebreid** — nieuwe verplichte velden adres + postcode, optioneel plaats + regio + land. Land-dropdown met emoji-vlaggen 🇳🇱🇧🇪🇩🇪🇫🇷🇬🇧🇺🇸🌍; regio wisselt van SELECT (NL 12 provincies, BE, DE, FR, GB) naar text-input voor US/Ander land. Backend `PortalRegistrationCreate/PortalRegistration` uitgebreid.
- **Backend UserDetailsUpdate** uitgebreid met `region` + `phone` — `GET /admin/users/{email}/details` retourneert nu alle 12 velden.
- **Avatar-component gedeeld** — verplaatst van inline in AdminDashboard.jsx naar `/app/frontend/src/components/Avatar.jsx`. Gebruikt in CMS sidebar én in klantportaal welkomstblok naast naam.
- **Klantverhalen marquee** — 60s → 22s cyclus (bijna 3x sneller), 5x replicated array (was 3x) zodat auto-scroll geen lege plekken toont zelfs bij grote viewport; drag-to-scroll blijft werken; hover-pauze.
- **FloatingReviewTicker** — toont nu naast quote ook naam + bedrijf ("Super tof!" — TEST, PEARBLUE).
- **Assignee-labels** — dropdowns tonen NOOIT meer volledig e-mailadres. Prioriteit: first_name+last_name → display_name → local-part van e-mail.
- **CMS mobile header** — Versietekst en logo verwijderd; enkel hamburger + "Terug naar site"-knop → compacter en meer bruikbaar.
- **CMS mobile hamburger click-outside** — nieuwe `cms-mobile-backdrop` overlay sluit menu bij tik/klik buiten.
- **CMS zijmenu-logo** — h-12 lg:h-14 (was h-8), gecentreerd met `mx-auto`.
- **CMS notificatie-badges** — compacter (min-w 18px, h-4, rode pil).
- **Homepage hero mobile** — kortere overline "WEBSITES · IT · CYBERSECURITY" (geen em-dash); H1 fits binnen 390-viewport (H1 breedte 342px < 390px).
- **Calculator knoppen** — 1 horizontale rij met `overflow-x-auto`, kortere labels op mobile ("Leeg"/"Deel"/"Offerte + wensen").
- **Home lang variabele** — was `const { t }` → nu `const { t, lang }` (fix voor "lang is not defined" runtime error).

### Feb 2026 — Iteration 18 (v0.5.4-Beta)
- **Global theme-aware form styling** — nieuwe base layer in `index.css` zorgt dat ALLE `<select>`, `<input>`, `<textarea>` en `<option>` de themakleur volgen (surface bg, text-strong tekst, muted placeholder, 0.7 opacity disabled). Fixt de witte-op-witte dropdowns overal in CMS (Berichten, Feedback, Reviews, Portaal, Brevo).
- **CMS mobile hamburger + PearBlue-logo header** — nieuwe `cms-mobile-header` boven de content op < lg, met hamburger toggle en versie-tag. Zijmenu klapt uit/in.
- **CMS sidebar upgraded** — PearBlue-logo bovenaan, profielfoto (Avatar met random pear-avatar of initialen) naast display-name, taal (NL/EN) en thema (Licht/Donker/Auto) toggle onderaan.
- **AdminSidebar duplicaat opgeruimd** — er stond een oude versie die dood-code was.
- **Reviews upgrade**:
  - Verwijderd de duplicaat `FeaturedReviewsCompact` op Home; nu alleen 1 marquee midden op de pagina.
  - Marquee-snelheid van 60s → 32s (~2x sneller), triple-array voor smoother wrap-around.
  - **Drag-to-scroll** met muis/vinger: pointer-events pauzeren de marquee tijdens slepen; auto-resume na 1.5s.
- **Homepage hero-titel** — schaalt van `text-4xl` op mobile tot `text-7xl` op lg (was `text-5xl` als base wat overflow gaf).
- **Calculator mobile** — compact 3-kolom grid altijd (vs. sm+ vertical stack); alleen totalen in cellen, subtotal/vat labels verborgen op mobile. Buttons kleiner (`!text-xs !px-4`). List blijft daardoor zichtbaar.
- **Klantportaal facturen** — View/PDF/Print hebben nu 3 verschillende gedragingen:
  - **View** → axios-fetch PDF als blob + inline-modal met `<iframe>` (`portal-pdf-preview-modal`)
  - **PDF** → blob-URL in nieuw tabblad
  - **Print** → blob-URL in nieuw venster + `print()`; fallback: verborgen iframe voor popup-blockers
- **Klantportaal admin-shortcut overflow** — flex-wrap + compactere buttons voorkomen dat de Manage-knop de Uitlog-knop uit beeld duwt.
- **Cybersecurity CMS sticky-column** — bg was `bg-app` (bestaat niet in Tailwind), dus transparent en overlappend. Vervangen door `surface` klasse met `border-l` scheiding — geen overlap meer op tablet.
- **Bulk `bg-app` → `surface`** in AdminDashboard.jsx: alle 23 voorkomens vervangen (opgeloste selects in Berichten, Feedback, Cybersecurity, etc.).
- **Services page**: `priceFrom` nu taal-specifiek (`priceFrom_nl` + `priceFrom_en`) — cybersecurity "vanaf €5 p/machine p/maand" → "from €5 /machine /month".
- **Footer Klantportaal** vertaalt correct naar "Client portal" in Engels.

### Feb 2026 — Iteration 17 (v0.5.3-Beta)
- **Nieuwe rol 'CRM'** met permissions `{users, chat, tickets, messages, feedback, reviews}`; kan reset-mails sturen voor klanten (naast super_admin/beheerder/admin).
- **Extended user editor modal** in Gebruikers CMS — geen paginanavigatie, alle bewerkingen op één plek. Verplicht: voornaam, achternaam, adres, postcode. Optioneel: plaats, land, bedrijfsnaam, KVK, BTW. E-mail-notificatie naar klant via `/api/admin/users/{email}/notify-updated` (MOCKED Zoho 2-way sync).
- **Random pear+robot avatar** generator (DiceBear bottts-neutral + PearBlue palet). Iedereen (moderator/beheerder/admin) kan random-avatar toewijzen of terugzetten op initialen.
- **Direct password change** door super_admin/beheerder via `/api/admin/users/{email}/change-password` + auto-notificatie.
- **Public password reset endpoints** — `GET /auth/reset-password/verify?token=` + `POST /auth/reset-password/apply` (frontend UI-pagina komt in batch B).
- **Assignee-picker upgrade** — voornaam + achternaam + rol + profielfoto in alle Berichten/Feedback/Reviews/Portaal aanvragen. AssigneeChip component + `assigneeLabel()` helper.
- **Auto-lock op afgeronde items** — Berichten en Feedback met status 'done' zijn read-only behalve voor super_admin/admin (badge 🔒 Vergrendeld).
- **Reviews upgrade**:
  - Home hero: `FloatingReviewTicker` — reviews vervagen 1-voor-1 in/uit (6s interval, framer-motion blur transition)
  - Middenpagina: `FeaturedReviews` marquee met naadloze CSS animatie (60s loop, hover-pauze, gradient mask)
- **Calculator UX**:
  - "Anders" vrij-tekstveld met info-tooltip (uitleg over flexibele prijzen bij maatwerk)
  - "Contact" knop verwijderd — offerte-flow gaat exclusief via QuoteFromCalculator modal
  - `custom_request` veld doorgestuurd via `/api/quote` en meegestuurd in e-mail
- **Cybersecurity unread badge** — Virusscanner-knop toont rood aantal met `/api/admin/virus-scanner/unread`; verdwijnt na open door `/api/admin/virus-scanner/acknowledge-all`. `counters.virus_scanner` toegevoegd aan `/admin/counters`.
- **Lang + theme persistence** — LocalStorage + Cookie (365d) + user profile via `PATCH /auth/me/prefs`. Voorkeuren blijven behouden bij inloggen op elk apparaat.
- **Parallax fix** — fullscreen `cover` watermark op alle pagina's + secondaire textuurlaag (multiply blend).
- **Backend cleanup** — `RegistrationReview`, `Review`, `PortalRegistration`, `ReviewUpdate` uitgebreid met `assigned_to` en `status` velden.

### Feb 2026 — Iteration 16 (v0.5.2-Beta)
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

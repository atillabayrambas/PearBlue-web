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
### Feb 2026 — Iteration 54 (v0.8.6-Beta) — Server-side Zoho callback role resolution
- **Bug op productie**: `ZOHO_REDIRECT_URI` op Render wijst naar `GET /api/auth/zoho/callback` (server-side flow), NIET naar de frontend `/oauth/zoho/callback` page. De server-side callback deed de OAuth token exchange en zette de portal session, maar had géén role-resolution en géén admin_token minting — dus mint hij nooit een admin_token en redirectte blind naar `/portal`. Frontend riep dus nooit `/api/auth/zoho/exchange` aan (dat was alleen de dev-preview flow). Resultaat: zelfs met correct gezette `SUPER_ADMIN_EMAILS` op Render kreeg de gebruiker geen CMS-toegang.
- **Fix**: `GET /api/auth/zoho/callback` doet nu de **volledige** role-resolution via `_resolve_cms_role_with_debug`. Als de gebruiker admin is → mint admin_token en redirect naar `/oauth/zoho/callback#admin_token=…&admin_role=…` (URL fragment, wordt nooit naar servers gestuurd, dus veilig voor Render/CDN logs). Als portal-only → redirect naar `/oauth/zoho/callback?portal_only=1&role_debug=…&bootstrap_eligible=…`.
- **Frontend `ZohoCallback.jsx`** — nu 3 paden:
  1. `#admin_token=…` in URL fragment → adoptToken + navigate naar `/admin` + wipe URL via `history.replaceState` zodat token niet in browser history achterblijft.
  2. `?portal_only=1&role_debug=…` in query string → toon debug UI (dezelfde als POST-flow diagnostic).
  3. `?code=…&state=…` legacy → oude POST-exchange flow (dev preview).
- **Nieuw diagnostisch endpoint `GET /api/auth/zoho/debug`** — requires een actieve portal session. Retourneert: `resolved_role`, `would_get_admin_token`, `role_debug`, `bootstrap_eligible`, `admins_with_cms_access_count`. Zonder session: retourneert `whitelist_size` en een hint. Nu kan de operator op productie direct zien: "Zit ik in de whitelist? Heeft de backend mijn email correct herkend?" zonder in server logs te hoeven graven.
- **Removed HTTPException raises in callback** → nu redirecten met `?error=…` zodat de frontend de fout kan tonen i.p.v. Raw 400/500 pagina.
- **Verificatie**: 19/19 pytest tests slagen, Vercel build clean, `curl /api/auth/zoho/debug` retourneert 200 met correcte JSON.

### Feb 2026 — Iteration 53 (v0.8.5-Beta) — Zoho admin diagnostics + bootstrap
- **Bug op productie**: super-admin (`beheer@multibay.eu`) kreeg géén CMS-toegang na Zoho login op https://pearblue.nl/https://login.pearblue.nl. Root cause: op de **Render backend** ontbrak (of was fout gespeld) de env var `SUPER_ADMIN_EMAILS`. De preview backend had de waarde wél. `_resolve_cms_role` gaf daarom stil `None` terug, waardoor de frontend naar `/portal` navigeerde zonder `admin_token`.
- **Actionable diagnostics** — `_resolve_cms_role_with_debug` retourneert nu naast de role ook een debug-dict (`whitelist_size`, `whitelist_match`, `admins_doc_found`, `admins_doc_role`, `reason`). `/api/auth/zoho/exchange` neemt deze op in `role_debug` als er géén `admin_token` uitgereikt wordt, plus een `bootstrap_eligible` boolean.
- **Frontend ZohoCallback UI** — als het exchange-antwoord `role_debug` bevat, blijft de gebruiker op de callback pagina en ziet: (1) een Nederlandse uitleg waarom (mapping van reason-code → helptekst met exacte env-var naam), (2) een collapsible technische JSON dump, (3) een "Ga naar klantportaal"-knop, (4) optioneel een groene bootstrap-knop.
- **`POST /api/auth/zoho/bootstrap-super-admin`** — chicken-and-egg breaker. Wanneer `SUPER_ADMIN_EMAILS` env leeg is **én** de `admins` collection nul CMS-role docs bevat, kan de eerste Zoho-authenticated gebruiker zichzelf éénmalig promoveren tot super_admin. Daarna 409 voor iedereen (nieuwe admins gaan via CMS Users tab). Requires actieve Zoho session cookie — geen client-side trust.
- **Zoho identity email fallback** — accepteert nu zowel `Email` (Zoho standaard, capitalized) als `email` (sommige regio's/tiers) voor future-proofing.
- **Regressietests** — 5 nieuwe tests in `test_zoho_role_detection.py` dekken alle debug-reason paden: empty whitelist, whitelist met andere email, admins-doc met sub-CMS role, succesvolle whitelist-hit, empty email. **19/19 tests pass**.
- **Actie voor operator (jij)** — twee opties om productie live te krijgen:
  1. **Aanbevolen**: log opnieuw in met Zoho op https://pearblue.nl → op de callback-pagina verschijnt nu de "Word super-admin"-knop (mits geen andere admins) → klik en je bent binnen.
  2. **Alternatief**: op Render.com, in de service settings van login.pearblue.nl, voeg toe: `SUPER_ADMIN_EMAILS=beheer@multibay.eu` en herstart de service.

### Feb 2026 — Iteration 52 (v0.8.4-Beta) — Vercel build ESLint fixes
- **Bug**: Vercel production build (`CI=true react-scripts build`) faalde omdat `react-hooks/exhaustive-deps` warnings als errors werden behandeld in 15+ bestanden verspreid over Admin CMS + pages.
- **Fix**: Alle `load()`/`loadTemplates()`/`loadStatus()` functies gerefactored naar `useCallback` met correcte deps (`authHeader`, `msgId`, `ticketId`, `email`, `lang`, `en`). Alle bijbehorende `useEffect(() => { load(); }, [])` → `useEffect(() => { load(); }, [load])` — stabiele referentie via useCallback.
- **AttachmentsGrid effect** in AdminMessageThread refactored om `useRef` te gebruiken voor "already loaded" tracking i.p.v. `thumbs` state check (voorkomt oneindige re-render loop met correcte deps).
- **PricingAdminTab** — complexe expressies (`editing?.id`, `editing === null ? "closed" : "open"`) in deps array uitgepakt naar losse variabelen (`editingId`, `editingOpen`) om ESLint statisch te laten controleren.
- **`eslint-disable-next-line` comments** volledig verwijderd overal — géén shortcuts, alleen correcte deps.
- **Files gefixed** (13): `BrevoAdmin`, `CybersecurityAdmin`, `FeedbackAdmin`, `MailboxesAdmin`, `MessagesAdmin`, `PricingAdminTab`, `PriorityAlerts`, `RegistrationsAdmin`, `ReviewsAdmin`, `SettingsAdmin`, `UsersAdmin`, `AdminAnalytics`, `AdminFinancials`, `AdminMessageThread`, `Portal`, `TicketDetail`.
- **Verificatie**: `CI=true yarn build` compileert nu clean (319 kB gzip), homepage-smoke test slaagt.

### Feb 2026 — Iteration 51 (v0.8.3-Beta) — Zoho admin role detection fix
- **Bug**: gebruikers die in de `admins` collectie een CMS-role hadden (beheerder/moderator/analist/financien/chat_support/crm/super_admin) maar NIET in `SUPER_ADMIN_EMAILS` env whitelist stonden, kregen géén `admin_token` bij Zoho login. Gevolg: het CMS-icoon verscheen niet in de navigatie na een succesvolle Zoho super-admin login.
- **Fix**: nieuwe `_resolve_cms_role(db, email)` helper in `zoho_portal.py` met 3-tier precedence: (1) whitelist bootstrap → altijd super_admin + auto-upsert admins-doc, (2) bestaande admins-collectie role in `ROLES_WITH_CMS_ACCESS` → hergebruik die exacte role, (3) anders portal-only (geen admin_token).
- **Role wordt nu correct in JWT gezet**: `_mint_admin_token(email, role)` accepteert de resolved role als parameter i.p.v. hardcoded `super_admin`. Zo krijgt een moderator via Zoho login een JWT met `role="moderator"` — waar `require_admin` (backend) en `isAdmin` (frontend) correct op reageren.
- **Case-safe normalisatie** — `SUPER_ADMIN_EMAILS` gebruikt nu `casefold()` i.p.v. `lower()` (correcter voor internationale characters), resolver renormaliseert defensief.
- **Extra response veld** `admin_role` in `/api/auth/zoho/exchange` response (naast `admin_token`) — nuttig voor frontend debug/logging.
- **Integration playbook geconsulteerd** (integration_playbook_expert_v2) voordat auth-wijzigingen zijn gedaan, per system prompt regel voor auth-mutaties.
- **Regressietests**: `tests/test_zoho_role_detection.py` — 14/14 pass. Dekt: elke CMS role wordt herkend (parametrized over 8 roles), whitelist bootstrap upsert, portal-only fallback, non-CMS role rejection, empty-email edge case, whitelist promotion overwrites lower role, en JWT payload check.

### Feb 2026 — Iteration 50 (v0.8.2-Beta) — Deployment vault (CMS tab)
- **Nieuwe "Deployment"-tab in Site instellingen** — één plek voor álle 17 env vars die op Render/Vercel horen te staan: MONGO_URL, DB_NAME, EMERGENT_LLM_KEY, ZOHO_CLIENT_ID/SECRET, ZOHO_BOOKS/PROJECTS/DESK_ORG_ID, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, TOKEN_ENCRYPTION_KEY, RESEND_API_KEY, JWT_SECRET, SESSION_SECRET, FRONTEND_URL, CORS_ORIGINS, SUPER_ADMIN_EMAILS.
- **Encrypted at rest** — waarden worden opgeslagen in `deployment_vault` collectie via de bestaande Fernet cipher (`enc_secret`/`dec_secret`), dezelfde die Zoho refresh-tokens beschermt.
- **Waarschuwing prominent** — grote amber banner bovenaan: "Dit is een kluis — géén runtime configuratie. Wijzigingen herstarten de backend NIET; kopieer naar Render/Vercel." Voorkomt dat een admin denkt dat aanpassingen live gaan.
- **"LIVE ON BACKEND" indicator** — per rij groen chip als de variable écht als `os.environ` gezet is in het proces (env_status), rode chip als niet. Snelle sanity-check tegen productie.
- **Ingebouwde docs per key** — Nederlandse "waar vindt je dit" tekst + externe "Open ↗" link naar het juiste dashboard (MongoDB Atlas, Zoho API Console, Stripe, Resend, Emergent).
- **Bulk-tools** — "Kopieer .env-blok"-knop bouwt een paste-ready `.env` string (met quotes op waarden met spaties), "Alles opslaan"-knop met dirty-teller, "Vernieuwen"-knop. Per-rij Eye-toggle om sensitive values te tonen/verbergen.
- **Whitelist enforcement** — backend accepteert alleen keys uit `DEPLOYMENT_VAULT_KEYS`, onbekende keys stilzwijgend genegeerd. Max 4000 chars per waarde.
- **Nieuwe endpoints**: `GET/PUT /api/admin/deployment/vault` (admin-guarded). Response bevat vault + env_status + updated_at/updated_by meta.
- **Regressietests**: `tests/test_deployment_vault.py` — 4/4 pass (auth-guard, shape/17-keys, encrypt-roundtrip, whitelist).

### Feb 2026 — Iteration 49 (v0.8.1-Beta) — Hero video library gallery
- **Video-bibliotheek in CMS** — Site instellingen → Hero achtergrond → Video-modus toont nu een galerij van eerder geüploade clips (aspect-video thumbnails, autoplay on-hover, filenaam-caption). "Kies"-knop swap de actieve hero-video zonder her-upload, prullenbak-icoon doet soft-delete. De actieve clip toont een pear-500 "ACTIVE"-pill en gehighlighte rand.
- **Auto-refresh** — bibliotheek laadt zodra de admin naar Video-modus schakelt en na elke succesvolle upload. Handmatig "Vernieuwen"-knop naast de teller (`YOUR LIBRARY · N`).
- **Cascade-cleanup** — als de admin de huidige actieve video verwijdert, blanken we `hero_bg_video_url` automatisch zodat de publieke hero terugvalt op de animated backdrop (geen broken video-tag).
- **Bestaande backend endpoints hergebruikt** — `GET /api/hero-videos/list`, `DELETE /api/hero-videos/{id}`, geen nieuwe routes nodig. `hero_bg_video_url` blijft de single source of truth.

### Feb 2026 — Iteration 48 (v0.8.0-Beta) — Auto MP4↔WebM transcode + Social media in footer
- **ffmpeg auto-transcode** — bij elke video-upload draait ffmpeg 5.1 op de server: MP4-input krijgt automatisch een WebM-sibling (libvpx-vp9 realtime), WebM krijgt een MP4-sibling (libx264 ultrafast + faststart). Beide varianten worden in Emergent Object Storage bewaard onder één asset-ID. `hero_video_assets` collectie kreeg `mp4_path`, `webm_path`, `transcode_ok` velden.
- **Content-negotiating streamer** — `/api/hero-videos/{id}` kijkt naar User-Agent en Accept-header en levert WebM voor Chromium/Firefox (kleiner), MP4 voor Safari/iOS (compat). `.mp4` en `.webm` suffixen forceren een specifiek formaat. Publieke hero `<video>` rendert nu twee `<source>`-tags met `.webm` + `.mp4` zodat de browser zelf de snelste variant kiest.
- **Backend regressie**: `tests/test_hero_video_uploads.py::test_upload_transcodes_mp4_to_webm` doet end-to-end ffmpeg-transcode van een real testsrc-clip, controleert beide streams + Chrome/Safari content-negotiation. 8/8 tests groen.
- **Social media in footer** — nieuwe `<SocialIcons>` component toont pill-buttons van elk kanaal waarvan de admin een URL heeft ingevuld. Lege velden = geen icoon. Volledig CMS-gestuurd via nieuwe kaart "Social media kanalen" in Site instellingen → Algemeen.
- **24 kanalen ondersteund** — LinkedIn, Facebook, Instagram, X (Twitter), YouTube, TikTok, WhatsApp, Telegram, Signal, Discord, GitHub, GitLab, Behance, Dribbble, Medium, Mastodon, Bluesky, Threads, Vimeo, Twitch, Pinterest, Reddit, Trustpilot, Google Business. Iconen uit `react-icons/fa6`.
- **Nieuwe backend velden** in `SiteSettings`/`SiteSettingsUpdate`: `social_*` (24 string velden, elk max_length=500). Empty string = verborgen in footer.
- **Regressietests**: `tests/test_social_settings.py` — 4/4 pass (defaults present, roundtrip, max_length rejection, admin-only).

### Feb 2026 — Iteration 47 (v0.7.9-Beta) — Hero video uploads + prefers-reduced-motion
- **Directe video-upload uit CMS** — nieuwe upload-knop in Site instellingen → Hero achtergrond. Admin selecteert MP4/WebM (max 20MB), bestand wordt naar Emergent Object Storage gestuurd via `POST /api/hero-videos/upload`, `hero_bg_video_url` wordt automatisch gevuld met `${BACKEND}/api/hero-videos/{id}` en de publieke hero swapt direct. Fallback URL-veld blijft beschikbaar voor externe CDN's.
- **Nieuwe backend module** `/app/backend/hero_uploads.py` — dedicated router (mounted via `make_router(db, require_admin)`) met endpoints `POST /upload`, `GET /list`, `DELETE /{id}` (soft-delete conform playbook — Emergent storage heeft geen delete API), en publieke `GET /{id}` streamer met `Cache-Control: public, max-age=31536000, immutable`. Session-scoped storage key wordt gecached + geforceerd hermint bij 403/404. Content-type whitelist `video/mp4` en `video/webm`.
- **MongoDB collectie** `hero_video_assets` — `{id, storage_path, content_type, size, original_filename, uploaded_by, created_at, is_deleted}`.
- **prefers-reduced-motion** — `HeroBackground` gebruikt `useReducedMotion()` van framer-motion. Bij `reduce` wordt de drifting-orb animatie overgeslagen (nieuwe `hero-bg-animated-reduced` variant met alleen radial glow + statisch dot-grid), en `<video autoPlay={!reduceMotion}>` in video-mode.
- **Regressietests**: `tests/test_hero_video_uploads.py` (7/7 pass — mp4/webm upload, non-video reject, anonymous reject, public streaming, soft-delete) + `tests/test_hero_bg_settings.py` (4/4 pass). Ook screenshot-verified met Playwright `emulate_media(reduced_motion="reduce")`.

### Feb 2026 — Iteration 46 (v0.7.8-Beta) — Root-cause fix "blauwe lijn" + Hero background video
- **Blauwe lijn permanent verholpen** — de mysterieuze horizontale blauwe streep die weken zichtbaar was boven élke eyebrow-label ("WEBSITES, IT & CYBERSECURITY — ONE PARTNER" op home, "Klantverhalen", "Onze reis", etc.) bleek een klasse-naam-conflict. Onze custom utility `.overline` botste met **Tailwind's ingebouwde `.overline` utility** (`text-decoration-line: overline`). Fix: expliciete `text-decoration-line: none` toegevoegd aan `/app/frontend/src/index.css` `.overline` rule. Werkt sitewide op alle 20+ plekken die de klasse gebruiken.
- **HeroBackground vereenvoudigd** — als extra bescherming vervangen we `bg-gradient-to-br via-transparent` (diagonaal midden-tint verving zichtbare naad) door een enkele soft radial glow, en het dot-grid mask ging van `linear-gradient` (met harde top/bottom randen) naar een radial ellipse mask zodat dots aan alle kanten smooth uitvouwen.
- **Hero achtergrondvideo (CMS)** — nieuwe `Hero background`-kaart in Site instellingen → Algemeen. Admin kiest tussen "Animatie (standaard)" of "Video", plakt een MP4/WebM URL, optionele poster-afbeelding, en een 0-80% dim-slider. Live preview in CMS met dezelfde overlay als publiek. Video speelt gedempt + loopt + `playsInline` op de publieke hero. Cache-invalidator (`invalidateSiteSettingsCache()`) draait op elke settings-PUT zodat publieke site zonder refresh omschakelt.
- **Nieuwe backend velden** in `SiteSettings`/`SiteSettingsUpdate`: `hero_bg_mode` (`animated`|`video`), `hero_bg_video_url`, `hero_bg_video_poster`, `hero_bg_video_dim` (0-80, default 35).
- **Regressietests**: `/app/backend/tests/test_hero_bg_settings.py` — 4/4 pass (defaults present, video roundtrip, invalid mode → 422, out-of-range dim → 422).

### Feb 2026 — Iteration 45 (v0.7.7-Beta) — CMS-driven Pricing Catalog + Cyber Volume Discount
- **Alle 61 prijs-items nu editable via CMS** → Site instellingen → **Prijslijst-tab**. Service picker (Website 30 / ICT Services 17 / Cybersecurity 14) met totaal-badges + per-categorie inklap-blok met inline `+ add`. Volledig NL/EN CRUD (create/edit/delete + tag `TBD` / `Included`).
- **ICT-catalogus geïmporteerd uit `ict_diensten_prijzen_v8.xlsx`** — 17 items verdeeld over 6 nieuwe subcategorieën: Infrastructure & Server (server-installatie €3500, VM-host €1200, Kassa €1250), Netwerk (audit €300, switch install €200-450), Cloud & Storage (Internxt Ultimate), Backup (Veeam €1500, Rubrik €1200/mnd, NAS €75/TB), Boekhouding & Kassa (cloud-boekhouding €850), Nazorg/SLA & Consultancy (SLA €80/u, ad-hoc €100/u, monitoring €5/machine/mnd, IT-strategie €200, PM €90/u, API/POS koppeling €1250).
- **Cybersecurity-catalogus geïmporteerd uit `cybersecurity_prijslijst_definitief.xlsx`** — 14 items in 3 subcategorieën: Website-bescherming (bestaand), Endpoint bescherming (Bitdefender GravityZone endpoint agent €5/machine/mnd + Nazorg SLA +€3/machine/mnd), Cybersecurity — services & onboarding (Per-policy €80, Rapportage-setup €95, Risk Management €100, Server Anti-Malware €45, 24/7 Monitoring onboarding €100, Incident Response Retainer €60, Threat Intelligence tuning €50, Configuration Hardening €90/50-machines, XDR/EDR €100, Firewall-policy €75, Policy validation €70).
- **Volumekorting-model** — nieuw `PricingVolumeTier` model (`from_qty`, `to_qty`, `discount_per_unit`). De Bitdefender endpoint agent bevat de 10-staps EUR-korting-ladder uit de Excel: 10-19 → −€0,10 … 100+ → −€1,00. Frontend `effectiveUnitPrice()` past dit toe zodra de klant een aantal machines invoert.
- **Calculator live volumekorting-indicator** — bij `special === "cyber_endpoint_agent"` toont de calculator direct onder het label: `Volumekorting: −€0,10/machine → €4,90/mnd × 15`. Werkt door in de per-categorie subtotals, maandtotalen én combi-total footer. Test-verified: 15 machines → €73,50/mnd, 100 machines → €400/mnd.
- **Cache-invalidatie** — `invalidatePricingCache()` in `data/pricing.js` wordt aangeroepen bij elke CMS-mutatie (create/patch/delete) zodat publieke `/prijslijst` en calculator zonder page-refresh de nieuwe waardes zien.
- **CMS inline volumekorting-editor** — per-item tabel-editor (Van #, T/m #, −€/stuk, remove-knop) + "Volumekorting toevoegen"-actie voor niet-cyber items zonder tiers.
- **Nieuwe backend structuur**: `/app/backend/pricing_seed.py` bevat de 61-item seed + 15 categorieën, geïmporteerd in `server.py`. Modellen (`PricingItem`, `PricingItemCreate`, `PricingItemUpdate`, `PricingVolumeTier`) staan in `/app/backend/models.py`.
- **Endpoints**: `GET /api/site/pricing` (public), `GET|POST|PATCH|DELETE /api/admin/pricing` (admin-guarded, activity-logged, unit-whitelisted, min<max validated).
- **Testing**: `tests/test_iteration45.py` — 8/8 pass (public seed shape, ICT Excel-import verification, cyber 10-tier volume ladder, CRUD, unit-whitelist rejection, min>max rejection, volume-tiers create round-trip). Iter43+44 regressie: 15/15 pass, geen breekage.
- **Frontend refactor**: `PricingListPage.jsx` fetcht de catalog nu via `loadPricingCatalog()` uit een gecachte API-call. Verwijderde de amber "TBD" ICT-callout — vervangen door een pear-tinted intake-notitie omdat we nu wél ICT-prijzen tonen.

### Feb 2026 — Iteration 44 (this session, v0.7.6-Beta) — Company Roadmap Timeline + CMS Editor
- **Publieke tijdlijn op /over-ons** — nieuwe `<RoadmapSection>` onder de kernwaarden. Desktop = horizontale connected timeline met **doorlopende rail die overgaat van solide pear (behaald) naar gestreepte grijs (gepland)**. Mobile = verticale variant. Elk item: gradient pear-500→pear-600 tegel voor behaald (+ emerald ✓ chip), transparante `surface` met gestreepte pear-500 rand voor gepland. Framer-motion staggered reveal + summary chips ("1 behaald / 4 gepland") onderaan.
- **5 seed-items**: `PearBlue website live` (Globe, achieved, "2026 · Live"), `Live Website Builder` (Wand2, "2026 · Q3"), `PearPhone` (Smartphone, "2027"), `PearTab` (Tablet, "2027"), `Pear OS` (Cpu, "2028"). Idempotent seed op startup — admin edits/deletes stick.
- **CMS "Roadmap" tab** in Site instellingen naast General/Engineering:
  - 25-icoontjes picker (Globe, Wand2, Smartphone, Tablet, Cpu, Gamepad2, Rocket, ShieldCheck, Trophy, Palette, Wrench, Layers, Star, Award, Package, Zap, Brain, Cloud, Code, Database, MessageCircle, Lock, Leaf, Sparkles, Sparkles-fallback).
  - Status-toggle (Behaald/Gepland), datumlabel (vrije tekst zoals "2026 · Q3"), volgorde (int), NL/EN titel + beschrijving.
  - Sortable list met per-rij `↑/↓` reorder-knoppen (optimistic update + bulk PUT), `Bewerk` + `Verwijder`.
- **Backend endpoints** (all `/api`):
  - `GET /site/roadmap` — publiek, buckets `{achieved, planned}` sorted by `order`.
  - `GET /site/roadmap-icons` — publieke whitelist voor de icon-picker.
  - `GET|POST|PATCH|DELETE /admin/roadmap` (admin-guarded, activity-logged).
  - `PUT /admin/roadmap/reorder` — bulk order update `{order: [{id, order}, ...]}`.
- **Icon whitelist enforcement** — POST/PATCH rejecteren onbekende icons met 400 en Nederlandse foutmelding; frontend en backend share dezelfde 25-key set (`/data/roadmapIcons.js` ↔ `ROADMAP_ICON_WHITELIST`).
- **Nieuwe model file**: `RoadmapItem` + `RoadmapItemCreate` + `RoadmapItemUpdate` toegevoegd aan `/app/backend/models.py`.
- **Testing**: `tests/test_iteration44.py` — 7/7 pass (seed shape, icon whitelist, auth, unknown-icon reject, full CRUD cycle, reorder, patch-bad-icon). Playwright smoke test: `/over-ons` toont 5 items met correcte solid/dashed switch en summary chip; CMS-tab kan een testitem toevoegen → verwijderen zonder issue.

### Feb 2026 — Iteration 43 (this session, v0.7.5-Beta) — Global CMS Search + Live Toasts + Autopilot Weekly + Models Split
- **Global CMS search** — new `GET /api/admin/search?q=…` endpoint that scans `contact_messages` (subject/name/email/message/ticket_ref), `portal_registrations` (name/email/company/message), `reviews` (name/company/quote) and `feedback` (name/email/comment) via case-insensitive regex + exact ticket_ref shortcut. Returns kind-tagged hits with deep-linked `target` URLs. Frontend adds a debounced (250ms) search box directly under the sidebar profile block — dropdown with kind chips, ticket_ref highlight and click-to-navigate. Testids: `cms-sidebar-search-input`, `cms-sidebar-search-results`, `cms-sidebar-search-hit-{i}`.
- **Live toast notifications on new items** — `useSilentPolling` extended with an optional `onChange(prev, next)` callback that fires only when the payload changed. `AdminSidebar` uses it: when `messages/portal/reviews/feedback/cybersecurity` counters INCREMENT between polls, a Sonner toast pops with a delta count + "Open" action that navigates to the right admin route. NL/EN aware.
- **Books-autopilot weekly recap** — new `GET /api/admin/reviews/books-autopilot-weekly?days=7` endpoint aggregates the last N days of `review_invites` (source=`zoho_books_autopilot`) into `{total, delivered, skipped, errored, delivery_rate, per_day, recent_errors, last_run}`. `days` clamped to [1..90]. Frontend renders a recap card in ReviewsAdmin with 4 stat tiles (total/delivered/skipped/errored), delivery-ratio chip, per-day dual-tone sparkline (emerald=delivered, amber=skipped) and a red errors panel with the last 5 failures. Testids: `cms-books-autopilot-weekly`, `weekly-total`, `weekly-delivered`, `weekly-skipped`, `weekly-errored`, `weekly-sparkline`.
- **Server modularization Phase 1** — 18 Pydantic models + `new_ticket_ref()` helper moved from `server.py` to a new `/app/backend/models.py` (253 lines). `server.py` now imports them via a clean block and drops from 3753 → 3664 lines. Fully backwards-compatible; every existing route still resolves the same symbols.
- **Testing**: `tests/test_iteration43.py` — 8/8 pass (search shape+auth+short-query, weekly shape+clamp+auth, models round-trip through `/reviews` + `/projects`). Playwright smoke test confirmed search hits render + navigate correctly and the weekly card renders with 0 activity (autopilot has no invites yet this week).

### Feb 2026 — Iteration 42 (this session, v0.7.4-Beta) — CMS Silent Polling (no more state resets)
- **New `useSilentPolling` hook** (`/app/frontend/src/hooks/useSilentPolling.js`) — background-refresh helper that (1) NEVER toggles a `loading` flag, (2) skips the tick while the user is actively interacting with an `<input>`/`<select>`/`<textarea>`/contentEditable so open dropdowns and half-typed notes are preserved, (3) skips ticks when the tab is hidden, and (4) only calls `setData` when the fetched JSON has actually changed (hash-diff via `JSON.stringify`).
- **Refactored 4 CMS surfaces** to use the hook instead of a raw `setInterval` that called a full `load()` (which reset `loading=true` and clobbered local component state every 15–60s):
  - `MessagesAdmin.jsx` — 15s poll for `/contact` + `/admin/assignees`.
  - `pages/AdminAnalytics.jsx` — 15s poll for `/chat/stats` (respects `[days, customFrom, customTo]` deps).
  - `AdminSidebar.jsx` — 30s poll for badge counters.
  - `PriorityAlerts.jsx` — 60s poll for `/admin/priority-alerts`.
- **Verified via Playwright**: opened a message accordion, focused a `<select>`, typed a note, waited 18s (past the poll interval) — text was preserved, accordion stayed open, all three inline dropdowns retained their selections.

### Feb 2026 — Iteration 41 (v0.7.3-Beta) — Discovery Log + Auto-Ticket Dedup
- **Notification-type discovery log** — nieuwe `_FALLBACK_SEEN` set in `imap_parser.py` logt een `WARNING` **exactly one time per unique subject-prefix** (eerste 5 woorden, lowercased) wanneer de generieke `[PearBlue]` fallback vuurt. Zo zien we automatisch welke nieuwe notificatie-types nog een specifieke regex verdienen zonder logspam.
- **Auto-ticket dedup window** — `_create_ticket_from_email()` zoekt eerst een bestaand open ticket van dezelfde `from_email` (case-insensitive) met een genormaliseerde subject-match binnen `AUTO_TICKET_DEDUP_HOURS` (default 24u, env-configureerbaar). Match → append als `contact_message_replies` doc (`source: "imap_dedup"`). Geen match → verse ticket met nieuw `ticket_ref`.
- **Subject normalization** — `_normalize_subject()` strip herhaaldelijk `Re:/Fwd:/Fw:/Antw:/AW:/VS:` + `[TAG]` prefixen en lowercased whitespace, zodat een threaded reply-mail dedup-matcht met de originele.
- **Bevestigd via async test**: `dedup-test@example.com` stuurt 3 mails → resultaat is 2 tickets + 1 reply (2e mail met `Re:` prefix wordt gededupliceerd, 3e mail met ander onderwerp krijgt eigen ticket). Discovery log: 2 unieke prefixen → 2 warnings; hetzelfde prefix een tweede keer → 0 extra warnings.

### Feb 2026 — Iteration 40 (v0.7.2-Beta) — IMAP fuzzy match + Auto-tickets
- **Uitbreidbare notificatie-classifier in de IMAP parser** — `_classify_notification()` herkent 4 uitgaande subject-patronen (`Nieuw contactbericht`, `Nieuwe klantbeoordeling`, `Nieuwe portaal-aanvraag`, `Chat handoff`, `Offerte-aanvraag`) + een generieke `[PearBlue]` fallback. Specifieke patronen komen eerst (was bug: greedy fallback pikte alle andere types op).
- **Case-insensitive fuzzy name-match** — matcht een notificatie-mail terug naar het originele `contact_messages` / `reviews` / `portal_registrations` record via `{name: {$regex: ^X$, $options: i}}`. Als het bron-record een `ticket_ref` heeft, wordt die direct op de ingest-rij gezet zodat de CMS-chip #TKT-XXX toont i.p.v. "Zonder ticket".
- **Auto-ticket vanaf externe e-mails** — inkomende klant-mails uit domeinen buiten `OWN_NOTIFICATION_DOMAINS` (resend.dev/notifications.resend.com/pearblue.nl) worden nu automatisch omgezet in een nieuw `contact_messages` doc met eigen `ticket_ref`. Zowel live-poll (`_sync_one_mailbox`) als rebuild-batch doen dit.
- **`POST /api/admin/mailboxes/rebuild-matches`** — batch-endpoint dat alle bestaande unmatched ingest-rijen opnieuw classificeert. Idempotent: filter op `matched_kind = null` én `ticket_ref = null`, dus dubbele calls returnen `matched: 0` als er niks veranderd is. Live geverifieerd (145 rows → 97 matched (67%), 37 auto-tickets aangemaakt inclusief een echte klantmail van elghamrawy.com).
- **Frontend chips upgrade** — MailboxesAdmin toont naast de bestaande pear `#TKT-XXXXXX` chip nu een emerald `✓ contact · Naam` / `✓ review · Naam` / `✓ portaal · Naam` / `✓ chat · Naam` / `✓ nieuw ticket · Naam` chip. Nieuwe knop "🔄 Match bestaande opnieuw" om de rebuild handmatig te triggeren.
- **Testing**: iteration_40.json → **backend 18/18 pytest + 100% Playwright**, geen action items. Post-fix idempotentie via curl bevestigd.

### Feb 2026 — Iteration 39 (v0.7.1-Beta) — Autopilot Lock + Countdown Detail + EN Preview
- **MongoDB advisory lock voor Books-autopilot** — `_try_acquire_lock("books_autopilot")` in `_books_autopilot_loop()`; TTL index op `advisory_locks.expires_at` (expireAfterSeconds=0). Meerdere backend-replicas hameren niet meer gelijktijdig op Zoho. Manual scan endpoint blijft de lock bewust bypassen.
- **Autopilot last-run status endpoint** — `GET /api/admin/reviews/books-autopilot-status` levert `{at, trigger, triggered_by, scanned, invited, skipped, errors}`. Reviews-CMS toont dit als groene/rode chip (`cms-books-autopilot-status`) met timestamp + tellers + eerste error inline.
- **Zoho Access-Denied → NL hint** — `_books_autopilot_scan_once()` mapt Zoho's `ACCESS_DENIED` naar een actionable Dutch string die naar de refresh-token wizard verwijst (`ZohoBooks.fullaccess.all` scope).
- **BulkTranslateButton countdown** — `progress.waitingSecs` tikt elke seconde af tijdens een 429-wait; amber pill (`⏳ rate limit · Xs`, `cms-projects-bulk-translate-cooldown`) toont de resterende seconden en de progressbar wordt oranje. Cancel-ref op unmount voorkomt React warnings.
- **Portfolio EN-Preview knop** — `cms-projects-preview-en` toggle in ProjectsAdmin swapt de lijst live naar `title_en`/`description_en`. Per rij: `✓ EN` badge (translated) of `⚠ NL fallback` (still Dutch). Ideaal om vertalingen te reviewen zonder de sidebar-taal te wisselen.
- **Testing**: iteration_39.json → **6/6 pytest + 100% Playwright**, geen action items.

### Feb 2026 — Iteration 38 (v0.7.0-Beta) — Autopilot + Bulk Translate + Rate-Limit UX
- **Zoho Books Paid-Invoice Review Autopilot** — nieuwe `_books_autopilot_loop()` scant elke 15 min in de achtergrond alle facturen met status `paid` uit de laatste 90 dagen. Dedupe via `review_invites.project_id` prefix `zohobooks:{invoice_id}`. Manual trigger endpoint `POST /api/admin/reviews/scan-books-invoices` + nieuwe **Scan Books nu**-knop in de Reviews CMS.
- **Bulk AI Translate** — nieuwe herbruikbare `BulkTranslateButton.jsx` component met modal + live progressbar + auto-backoff bij 429 (respecteert `retry_after_seconds`). Ingebouwd in:
  - **Portfolio CMS**: vertaalt `title` → `title_en` en `description` → `description_en` in bulk.
  - **Reviews CMS**: vertaalt `quote` → `quote_en` voor alle approved reviews.
  - Publieke site (`Home`, `Projects`, `FeaturedReviews`, `FloatingReviewTicker`, `FeaturedReviewsCompact`) toont automatisch de `_en`-versie zodra taal = EN, met NL-fallback.
- **429 Countdown Chip** — `AiTranslateButton` toont bij een 429 een rode chip met de resterende seconden (leest `retry_after_seconds` uit de response, tikt elke seconde af). NaN-defensief.
- **Zoho Books LIVE-banner** — `/admin/financials` toont nu een groene "Zoho Books LIVE" banner én een groene "live"-pill in de Zoho-sectie zodra `mocked=false`. Amber MOCKED-banner is weg.
- **MongoDB TTL Index** op `ai_translate_hits.created_at` (120s expiry) — collection blijft bounded, geen handmatige purge nodig.
- **Backend polish**:
  - `POST /api/admin/ai/translate` 429-body is nu `{message, message_en, retry_after_seconds, limit}` + `Retry-After` header.
  - `Project` + `Review` Pydantic models kregen `title_en` / `description_en` / `quote_en` (`ProjectUpdate` allowlist + `ReviewUpdate` uitgebreid).
- **Testing**: iteration_35.json → **backend 6/6 pytest + 100% frontend**. Post-fix (mocked badge, NaN, TTL) via curl bevestigd.

### Feb 2026 — Iteration 37 (v0.6.9-Beta) — Zoho Books LIVE! 🎉
- **Zoho Books integratie is LIVE bevestigd** — `org_matched: true`, `org_name: PearBlue`, `mocked: false`. Live financials-endpoint pullt nu echte facturen uit de PearBlue Zoho Books organisatie (org_id `20109165270`, DC EU).
- **Wizard UX gehard**:
  - `runWizard()` slaat na een succesvolle code→refresh_token exchange **automatisch alle 3 velden (client_id + client_secret + refresh_token + org_id)** in één PUT op, zodat de credentials nooit meer uit sync kunnen raken.
  - Backend `_books_access_token()` surfaced nu de echte Zoho-error string (invalid_code / invalid_grant / invalid_client) i.p.v. generieke "no access_token" melding.
  - `/test`-endpoint vertaalt Zoho-errors naar heldere NL-hints: "Refresh token past niet bij deze Client ID/Secret — voer de wizard opnieuw uit met de correcte credentials van je Self Client."
- **Belangrijke docs voor toekomstige integraties**: Zoho Server-based/Client-based clients hebben géén "Generate Code" tab; alleen het type **Self Client** heeft die. Dit is in de wizard-instructies + finish-tool output opgenomen zodat volgende agents niet dezelfde vraag krijgen.

### Feb 2026 — Iteration 36 (v0.6.8-Beta) — Persistent rate-limit + Zoho refresh-token wizard
- **AI Vertaal rate-limit — MongoDB persistent**
  - `_ai_translate_hits` dict verwijderd; nieuwe collection `ai_translate_hits` slaat elke succesvolle call op als `{email, ts, created_at}`.
  - Rolling 60s window wordt geteld met `count_documents`, en oude entries (>5 min) worden op elk succes lazily geprund.
  - **Bewezen persistent**: limit=3 → 3× 200, 4× 429 → `supervisorctl restart backend` → 5e call retourneert nog steeds 429. Ook robuust bij horizontal scaling (meerdere backend-replicas delen nu dezelfde teller).
- **Zoho Books refresh-token wizard** — 100% self-service in de CMS
  - Nieuwe endpoint `POST /api/admin/integrations/zoho-books/exchange-code` neemt een fresh Self-Client `code` + `client_id/secret/dc`, doet server-side de OAuth code→refresh_token exchange bij Zoho, en haalt meteen `/organizations` op zodat de admin org kan kiezen.
  - Nieuwe wizard-paneel in de Zoho Books-kaart (paars, `zoho-wizard-toggle`, `zoho-wizard-panel`, `zoho-wizard-code-input`, `zoho-wizard-exchange`): 3-stappen instructies, één-klik exchange, auto-fill van refresh_token-veld + organization-dropdown.
  - Foutmeldingen zijn NL en helder (bv. "Kon geen refresh_token krijgen: invalid_client. Genereer een nieuwe code (deze is maar 10 min geldig).").
- **Testing**: Bash curl volledig, incl. persistence-check na backend-restart en fake-code exchange (400 met heldere melding).

### Feb 2026 — Iteration 35 (v0.6.7-Beta) — Polish & Rate-Limit
- **House # label EN-fix** — Portal registration form: label `House #` (EN) that pushed the input naar beneden is nu `House no.` en alle drie labels op de postcode-rij (`Postal code`, `House no.`, `Address`) hebben `whitespace-nowrap` zodat ze nooit wrappen bij smallere breakpoints.
- **Female avatar tab — no more beards** — `AvatarPicker.jsx.buildUrl()` voegt nu `&facialHairProbability=0` toe voor alle feminiene avatars (`genderTop === "f"`). DiceBear enum `facialHair=blank` bestaat niet — de juiste key is de probability. Alle 19 tegels in de Vrouwelijk-tab renderen nu gegarandeerd zonder baard/snor.
- **AI Translate rate limit + CMS instelling**
  - Backend: `SiteSettings.ai_translate_limit_per_minute: Optional[int]=30` (Field ge=1,le=500). `POST /api/admin/ai/translate` handhaaft nu een **rolling 60-seconden venster per admin-email**. Response krijgt extra velden `remaining` en `limit`. Bij overschrijding: 429 met `AI translate rate limit (N/min) exceeded`. Falende calls tellen NIET mee tegen het budget.
  - Frontend: nieuwe kaart `cms-ai-translate-limit-card` in Site instellingen → Engineering, met number-input `cms-ai-translate-limit-input` (auto-save op blur, client-side clamp 1..500).
- **Testing**: iteration_34.json → **100% backend (7/7) + 100% frontend**. Curl-verificatie bevestigt limit=3 → 3× 200 → 4× 429. Vrouwelijke avatars renderen zonder baard.

### Feb 2026 — Iteration 34 (v0.6.6-Beta) — Modular refactor + AI translate + EN-sprint 2
- **`AdminDashboard.jsx` modular refactor** — het monolithische bestand (3160 regels) is opgesplitst in **13 zelfstandige componenten** onder `/app/frontend/src/components/admin/`:
  - `_shared.jsx` — gedeelde helpers, constants (ROLE_LABELS, MSG_STATUS/PRIORITY, USER_COL_DEFS, PEARBLUE_LOGO, API), `AssigneeChip`, `StarsRow`, `generatePearAvatar`.
  - `AdminSidebar.jsx`, `PriorityAlerts.jsx`, `ProjectsAdmin.jsx`, `SettingsAdmin.jsx`, `MessagesAdmin.jsx`, `RegistrationsAdmin.jsx`, `ReviewsAdmin.jsx`, `UsersAdmin.jsx`, `ScriptsAdmin.jsx`, `CybersecurityAdmin.jsx`, `FeedbackAdmin.jsx`, `MailboxesAdmin.jsx`, `BrevoAdmin.jsx`, `VirusScannerAdmin.jsx`, `ChangelogAdmin.jsx`.
  - `AdminDashboard.jsx` blijft nu **~85 regels** — enkel router + layout.
- **AI Vertaal-Assist knop** — nieuwe `AiTranslateButton.jsx` (violet chip met Sparkles-icoon) toegevoegd naast:
  - Portfolio-formulier: Titel + Omschrijving (`cms-title-translate` / `cms-desc-translate`).
  - Feedback notities-modal: nieuwe geïntegreerde `FeedbackNoteForm` met AI-vertaal knop (`fb-note-translate`).
  - Backend endpoint `POST /api/admin/ai/translate` gebruikt Claude Sonnet 4.6 via Emergent LLM Key. Auto-detecteert NL/EN via `detectLang()` heuristiek en vertaalt naar de tegenovergestelde taal.
- **CMS EN-Sprint deel 2**:
  - **Cybersecurity** — alle UI-labels (kolommen "Wie/Wat/Waar/Hoe/Wanneer", filter buttons "Alle/Actief geblokkeerd/Gedeblokkeerd", knoppen "Deblokkeren/Opnieuw blokkeren", "Blokkades per dag", "Top-oorzaken", toast messages) reageren op `useLang()`.
  - **AdminMessageThread** (Ticket Threads) — subject/message labels, "Verstuur antwoord/Save", "Interne notitie", status/priority selects, "Vergrendeld" badge, timeline labels ("Gesprek", "verstuurd/enkel opgeslagen"), attachment picker en alle toast-messages zijn nu tweetalig. **CRITICAL:** Origineel klant-bericht (`msg.message`), reply-bodies (`t.body`) en notitie-teksten (`t.text`) worden NOOIT vertaald — alleen UI-omhullende labels.
- **Testing**: Handmatige verificatie via testing-subagent (backend + frontend) volgt onmiddellijk hierna.

### Feb 2026 — Iteration 33 (v0.6.5-Beta continued) — International postal lookup + EN-Sprint 1
- **International postal auto-fill** — `usePostalLookup` is nu een 4-traps cascade: (1) postcode.tech voor NL, (2) Nominatim OSM *structured query* met `postalcode=X&street=Y[&countrycodes=X]` voor beste disambiguatie, (3) Zippopotam.us wereldwijde probe cascade (EU-first bias, US last voor 5-cijferige ambiguïteit), (4) Nominatim vrije zoekopdracht als laatste redmiddel. Ondersteunt NL/BE/DE/FR/GB/US/CA/AU/CH/DK/SE/NO/FI/PL/AT/IT/ES/PT/IE/NZ/MX/BR/ZA/JP/IN.
- **"Wijzig land" override** — postcode-blok in Portal-aanmelding heeft nu een kleine "Wijzig" knop naast Land die een dropdown opent. Wanneer geselecteerd wordt het als `preferredCountry` naar de lookup gestuurd — zo lost 10001 in NYC vs 10001 in Cáceres/Spanje correct op naar de gekozen keuze.
- **Auto-country detection** — Land wordt nu automatisch gevuld op basis van postcode+adres (bv. US ZIP 10001 + "350 5th Avenue" → 🇺🇸 New York, New York). Legacy user records worden via `guessCountryCodeFrom(code, name)` naar ISO-code omgezet voor de vlag-emoji.
- **Shared `isoToFlag()` helper** — Regional-indicator symbol berekening geëxtraheerd uit de hook zodat Portal / PortalProfile / AdminDashboard dezelfde vlag-render logica delen.
- **EN-Sprint (deel 1)** — Portfolio, Feedback en Users tabellen: kop, filter-knoppen, "Kolommen" dropdown, kolom-headers, "Acties", refresh-knop en formulier-placeholders zijn nu tweetalig. Reageert direct op de EN/NL taalknop in de CMS sidebar.
- **Testing**: Handmatig geverifieerd voor NL 9711AA (Groningen), US 10001 + 5th Avenue (New York), DE 10115 (Berlin). Preferred-country override werkt zoals bedoeld.

### Feb 2026 — Iteration 32 (v0.6.5-Beta) — Zoho Books live, manual review invite & IMAP parser
- **Zoho Books credentials in CMS** — nieuwe kaart in Site instellingen → Engineering met 4 velden (client id, client secret, refresh token, org id) + data-centre dropdown (EU/US/IN/AU). Geheimen worden Fernet-versleuteld opgeslagen. Nieuwe endpoints: `GET/PUT /api/admin/integrations/zoho-books` en `POST /admin/integrations/zoho-books/test`. Status-badge toont "Live" of "Nog niet ingesteld".
- **Live financials fallback** — `/api/admin/financials` haalt nu live invoice-data uit Zoho Books zodra credentials zijn gevuld. Op elke fout (ongeldige token, netwerkfout, verkeerde org) valt het automatisch terug naar mocked, dus het CMS blijft altijd renderen.
- **Handmatige review-uitnodiging** — nieuwe `ManualReviewInviteRow` in `/admin/reviews`: vul e-mail + projectnaam + factuur-id, klik "Verstuur uitnodiging" en de tweetalige review-e-mail (via bestaande `review_invites._bilingual_invite_html`) gaat direct de deur uit. Verschijnt met "Handmatig" badge in de invite-log.
- **IMAP inbound parser** — nieuwe module `backend/imap_parser.py` die achter de schermen elke 60s alle actieve mailboxen scant, `[#TKT-XXXXXX]` uit subjects extraheert en het bericht als reply aan de bijbehorende ticket-thread hangt (via `contact_message_replies`). Idempotent via `imap_ingested` collectie.
- **Mailboxen CMS uitbreid** — "Sync nu" knop, nieuwe folder-veld (default INBOX), en een "Laatste 100 IMAP-ingests" log onderaan die per e-mail toont welk ticket-nummer werd gematcht.
- **Socket timeout** — `IMAP_SOCKET_TIMEOUT` (default 10s) om te voorkomen dat een defecte host de poller-thread blokkeert.
- **Testing**: iteration_32.json → 100% backend (6/6) + 100% frontend. Alle nieuwe flows geverifieerd.

### Feb 2026 — Iteration 30 (v0.6.5-Beta) — Splash improvements + Documents portal
- **Splash top-right controls** — floating `Language toggle` (globe + flag + code) en `Admin lock` (slot-icoon → `/admin/login`) rechtsboven op elke splash. Taalkeuze wordt onthouden in `localStorage.pb_splash_lang`.
- **3 diensten onder mode-chip** — nieuwe centrale bulleted lijn ("MEDIA WEBSITES • IT-DIENSTEN • CYBERSECURITY") vertaald naar EN. Zit netjes tussen de MAINTENANCE/COMING SOON chip en de H1.
- **Bokeh screensaver** — de willekeurige bokeh-foto wisselt nu elke 8s zacht (1.6s cross-fade via `AnimatePresence`). Pauzeert automatisch wanneer de tab verborgen is, dus geen onnodig Unsplash-verkeer in background tabs.
- **Documents Portal** — nieuwe `"Documenten"` `SectionCard` in `/portal` (naast Facturen/Projecten/Tickets). Toont contracten/facturen/overige documenten met type-badge + download-knop. Endpoint `/api/portal/documents` (session-gated) + `/portal/documents/{id}/download` streamt blob.
- **Admin document upload** — nieuwe `UserDocumentsPanel` binnen de User QuickView-modal. Selecteer doc_type (contract/factuur/overig) + label, klik Uploaden. Bestanden tot 20 MB worden als base64 in `db.portal_documents` opgeslagen. Delete-knop verwijdert direct.
- **Endpoints toegevoegd**: `GET/POST/DELETE /api/admin/portal/documents`, `GET /api/portal/documents`, `GET /api/portal/documents/{id}/download`.
- **Testing**: iteration_30.json → 100% backend (5/5) + 100% frontend, incl. bokeh-rotatie na 9s en admin upload/delete flow.

### Feb 2026 — Iteration 29 (v0.6.5-Beta) — Coming-soon splash + admin bypass
- **Tri-state site status** — `site_status` in SiteSettings kan nu `live`, `maintenance` of `coming_soon` zijn. Vervangt de simpele boolean uit iter 28. Segmented control in CMS → Engineering met **direct auto-save** (geen Save-knop meer nodig).
- **Twee themed splash-varianten**:
  - `maintenance` → amber accent, wrench-mascotte, "We're polishing things up" / "We poetsen even iets bij"
  - `coming_soon` → violet accent, rocket-mascotte, "Something new is on its way" / "Er komt iets nieuws aan"
- **Alle copy hard-coded + auto-vertaald** — geen title/message input velden meer in de CMS. Nieuwe **Language on splash** segmented control (Auto/NL/EN) — Auto pakt de browsertaal van de bezoeker.
- **Admin bypass zonder ?preview=1** — iedereen met `pb_admin_token` in localStorage ziet altijd de normale site. Bezoekers zonder token krijgen de splash. `/admin/*` en `/oauth/*` blijven altijd bereikbaar.
- **Dynamische bokeh-achtergrond** — 6 curated Unsplash bokeh-foto's, per page-load willekeurig gekozen en 10% gebluurd voor een soft-focus atmosfeer. Alternatief: eigen URL invoeren (`bg_mode = custom`).
- **Achtergrondanimatie**: 3 kleurgloed-blobs (accent-specifiek) driften rond, 20 twinklende sterretjes drijven omhoog met individuele delays.
- **Grote PearBlue-logo** boven de titel (h-40 → h-64 responsive), oude header verwijderd. Nieuwsbrief-hint "Blijf op de hoogte!" / "Stay in the loop!".
- **Preview knoppen** — 2 aparte buttons in CMS ("Preview Maintenance" / "Preview Coming Soon") die `?preview=maintenance` en `?preview=coming_soon` openen in een nieuw tabblad. Deze force-render de splash zonder de live status te wijzigen.
- **Testing**: handmatig geverifieerd - admin bypass ✓, guest ziet splash ✓, beide preview modes renderen ✓, CMS auto-save ✓.

### Feb 2026 — Iteration 28 (v0.6.5-Beta) — Maintenance mode + form/avatar polish
- **Onderhoudsmodus (Maintenance / Coming-soon)** — nieuwe schakelaar in CMS → Site instellingen → **Engineering** tab. Playful splash-pagina met wobbly wrench-mascotte, floating pear/violet blobs, dot-grid overlay, PearBlue-gradient achtergrond (of custom URL), NL/EN titel + bericht, optionele nieuwsbrief-aanmelding en versienummer.
- **MaintenanceGate** — `useMaintenance` hook in `App.js` polt elke 60s `/api/site/maintenance`; publieke routes tonen `<MaintenancePage/>` zodra `maintenance_mode:true`. Admin (`/admin/*`) en Zoho-callback altijd toegankelijk. Bypass: `?preview=1`.
- **Newsletter Brevo-ready** — inschrijving op maintenance-pagina schrijft naar `db.newsletter_subscribers` met `source:"maintenance"` zodat lijst klaar staat voor Brevo import zodra keys binnen zijn.
- **APP_VERSION centraal** — nieuwe constante in `server.py`, gepubliceerd via `/api/site/version` en `/api/site/maintenance`. Footer + CMS sidebar fetchen deze bij mount → geen hard-coded versienummers meer.
- **Adres/postcode niet meer verplicht** — Portal-aanmelding, portal-profiel en CMS gebruikersedit accepteren nu inzending zonder deze velden.
- **Land / Regio / Plaats als platte tekst** — overal (incl. bewerken) worden deze velden nu getoond als read-only tekstweergave met landvlag-emoji ipv input-boxes. Postcode + huisnummer blijven bewerkbaar en vullen de rest automatisch via de bestaande `usePostalLookup` hook.
- **AvatarPicker cleanup**:
  - **Overige** tab verwijderd. Tabs zijn nu: Alles / Mannelijk / Vrouwelijk / Robots.
  - DiceBear v9 `top` filter forceert korte kapsels op mannelijke avatars (`shortWaved`, `shortRound`, `shortFlat`, `shortCurly`, `sides`, `frizzle`, `dreads01/02`, `theCaesar`, `theCaesarAndSidePart`, `shaggy`, `shaggyMullet`, `shavedSides`) — geen hijab/turban/hoofddoek meer mogelijk.
  - Vrouwelijke avatars forceren lange kapsels (`straight01/02`, `straightAndStrand`, `bun`, `curly`, `curvy`, `miaWallace`, `bigHair`, `dreads`, `frida`, `bob`, `fro`, `froBand`, `longButNotTooLong`).
- **Changelog** — nieuwe v0.6.5-Beta entry bovenaan; CMS "nieuwe versie" banner toont nu correct 0.6.5-Beta.
- **Testing**: iteration_28.json → 100% backend + 100% frontend (Playwright verified maintenance splash render + newsletter capture + form flows + Engineering tab controls).

### Feb 2026 — Iteration 27 (v0.6.4-Beta) — Western avatars + Ticket references
- **4 westerse mannelijke + 4 westerse vrouwelijke avatars** — nieuwe seeds bovenaan de MASC en FEM lijst (`WESTERN_M`/`WESTERN_F`). Elk forceert `skinColor` én `hairColor` als HEX-waarden (`FFDBB4`/`EDB98A` voor lichte huid, verschillende bruine/blonde/rode haartinten) zodat DiceBear nooit random een donkerder tint kiest. Ontdekt onderweg: DiceBear v9 accepteert alleen HEX-codes, geen preset-namen zoals "light".
- **Totaal 58 avatars** in "Alles": 19 mannelijk (4 westers + 15 gemixt) · 19 vrouwelijk (4 westers + 15 gemixt) · 10 overige · 10 robots.
- **Ticket referenties `#TKT-XXXXXX`** — elke nieuwe contact-message krijgt automatisch een korte hex-referentie (6 hex chars). Backend `_new_ticket_ref()` helper. In de reply-e-mail komt het subject nu als `[#TKT-XXXXXX] Re: ...` én in de footer: `Referentie: #TKT-XXXXXX`. Zo blijven inkomende e-mail replies threaded aan hetzelfde gesprek. Legacy berichten zonder ref krijgen bij eerste reply automatisch een ref (auto-heal).
- **Frontend** — CMS berichtenlijst en `AdminMessageThread` header tonen nu `#TKT-XXXXXX` (fallback op id-prefix).
- **Testing**: End-to-end getest via curl — nieuw bericht kreeg `TKT-6FF75E`, reply-subject werd `[#TKT-6FF75E] Re: Test TKT`. Avatars visueel bevestigd in 2 tabs; alle 4 westerse mannen en 4 westerse vrouwen renderen correct met lichte huid.

### Feb 2026 — Iteration 26 (v0.6.3-Beta) — Avatar library uitgebreid
- **Rode-mond avatars verwijderd** — de oude `adventurer` / `big-smile` / `micah` subculture-avatars produceerden soms een rode frownmond (die op een streep onder de kin leek). Alles omgezet naar `avataaars` met vaste `mouth=smile,default,twinkle` filter zodat er nooit meer een boze mond verschijnt.
- **Meer diverse mannelijk & vrouwelijk** — MASC_SEEDS uitgebreid van 10 naar 15 (Kai, Liam, Mika, Noah, Oscar toegevoegd) en FEM_SEEDS van 10 naar 15 (Lisa, Mira, Nora, Olivia, Puck toegevoegd). Meer huidskleur- en stijl-variatie in dezelfde style-family.
- **Tab hernoemd** — "Subculturen" → **"Overige"**. Same 10 unique seeds voor diverse looks.
- **Totaal 50 avatars** in "Alles" tab (15 + 15 + 10 + 10).
- **Testing**: full smoke test bevestigt schone rendering — geen frown-lijnen meer, alle 4 tabs (Alles / Mannelijk / Vrouwelijk / Overige / Robots) tonen enkel happy-face resultaten. Ook custom kleur-picker en upload/webcam werken zoals voorheen.

### Feb 2026 — Iteration 25 (v0.6.1-Beta / .6.2-Beta) — UsersAdmin polish + bidirectional postcode
- **Bidirectionele postcode-autofill** — Adres-veld triggert nu ook autofill: als de gebruiker een volledig adres met NL-postcode invult, wordt de postcode automatisch geëxtraheerd (regex `\d{4}\s?[A-Za-z]{2}`), evenals het huisnummer. Werkt op: portaal-aanmeldformulier, `/portal/profile` én CMS gebruikersrollen edit-modal.
- **Plaats / Regio / Land nu read-only** — Deze velden zijn alleen nog te wijzigen door de postcode API. Voorkomt inconsistente data en handmatige typos. Op alle 3 formulieren.
- **Nominatim NL-restrictie** — Fallback geocoder gebruikt `countrycodes=nl` zodat postcode-resultaten niet meer per ongeluk naar gelijknamige straten in andere landen kunnen mappen.
- **Gebruikers & Rollen redesign**:
  - Kolomtitel "Voornaam & achternaam" → **"Voor- en achternaam"**.
  - "Snelle weergave"-tekstknop → compact **oog-icoontje** (Eye) met tooltip, geen ruimteverspilling meer.
  - **Horizontale scrollbar verwijderd** — `overflow-x-auto` weg, tabel `min-w` verwijderd.
  - **Paginering** met keuzevakje "Per pagina" (20/50/100/200, default 20) + Vorige/Volgende-knoppen. Voorkeur opgeslagen in `localStorage` (`pb_user_page_size`).
  - Voetregel toont `1–20 van N` en `Pagina 1 / M`.
- **About OTAP** — 04 · ACCEPTATIE tekst aangepast: nu "**3 revisierondes** inbegrepen" (was "5 hoofd + 3 extra").
- **Testing**: smoke-test geverifieerd — pagination + Eye icoon + kolomkiezer werken; bidirectional autofill test: typen van `Grote Markt 1, 9711JV Groningen` in Adres → postcode 9711JV en huisnummer 1 automatisch ingevuld, Plaats/Regio uit API. City/Region velden `readOnly=true` bevestigd.

### Feb 2026 — Iteration 24 (v0.6.0-Beta) — Portal profile + Batch C polish
- **Klantportaal profielbewerking** — nieuwe `/portal/profile` pagina (route + link in portal header). Iedere ingelogde klant kan zelf voornaam, achternaam, weergavenaam, bedrijf, telefoon (met landcode picker), volledig adres (met postcode-autofill), avatar (uit 40 presets) OF eigen foto/webcam-upload aanpassen. Backend `GET /portal/profile` en `PUT /portal/profile` toegevoegd in `zoho_portal.py` (writes gaan naar `db.zoho_users`).
- **Avatar library uitgebreid tot 40 varianten + verbeteringen**
  - 10 mannelijk + 10 vrouwelijk + 10 nieuwe **subculturen** (Gothic, Emo, Artist, Rocker, Punk, Skater, Preppy, Vintage, Sporty, Anime — met verschillende DiceBear-styles voor visuele diversiteit) + 10 robots.
  - Tabs hernoemd: **Robots** apart (i.p.v. "Unisex / robots"). Toegevoegd: **Subculturen** tab.
  - Palette dubbele blauwtinten opgeruimd; **Midnight** kleur toegevoegd; nieuw **Custom color picker** met hex-input + native color picker + Toepassen.
  - **Upload foto**-knop en **Foto met webcam**-knop (getUserMedia + canvas snapshot → base64 JPEG).
- **Postcode auto-fill in aanmeldformulier** — Portaal-aanvraag heeft nu Postcode + Huisnummer + auto-populated Adres/Plaats/Regio via de gedeelde `usePostalLookup` hook. Regio-label ingekort naar "Regio" (was "Regio / provincie") en compacter grid.
- **PhoneInput met landcode-picker** in portaal-aanmeldformulier én in Portal Profile.
- **User CMS aanpasbare kolommen** — kolom-instellingen popover (⚙︎ Kolommen) waarmee beheerders kunnen kiezen welke velden zichtbaar zijn: E-mail (verplicht) · Voornaam & achternaam · Rol · Bedrijf · Telefoon · Plaats · Land · Zoho. Voorkeur bewaard in `localStorage` als `pb_user_cols`.
- **Snelle weergave** knop per gebruiker — `UserQuickViewModal` toont read-only alle velden (avatar + role + adres/postcode/huisnummer/regio/KVK/BTW) met "Bewerken"-knop in de footer om door te schakelen naar de edit-modal.
- **Backend `/admin/users`** — response nu inclusief `first_name`, `last_name`, `company`, `phone`, `city`, `country`, `profile_picture` voor de nieuwe tabelkolommen.
- **Cross-device taal/thema-sync** — `LanguageContext` en `ThemeContext` fetchen bij mount de `/api/auth/me/prefs` van backend (indien token aanwezig) en luisteren op `storage`-events voor real-time sync tussen tabs/vensters.
- **OTAP procedure updates op /over-ons**:
  - Ontwikkeling: "**3 landingpage-varianten om te vergelijken** → definitieve UI-mockup".
  - Acceptatie: "5 hoofd-revisierondes + **3 extra design-revisies** voor de gekozen landingpage".
- **Cybersecurity CMS overlap opgelost** — Status-cel `min-w-[130px]` en sticky "Actions"-cel alleen sticky <lg (op desktop niet meer, dus geen overlap met blokkeer-knop).
- **Openingstijden** aangepast van "Ma-vr 09:00 - 17:30" naar "**Ma-vr 10:00 - 17:00**" in NL + EN i18n bundels.
- **Testing**: Alle nieuwe UI's smoke-tested (subculture-tab volledig zichtbaar, kolomtoggle, quickview modal render). Backend endpoints geverifieerd via curl.

### Feb 2026 — Iteration 23 (v0.5.9-Beta) — OTAP procedure + Batch C essentials
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

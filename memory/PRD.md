# PearBlue Website — PRD

## Original Problem Statement
"Make a website based on everything described in the excel file" — Reference: `Website_Offerte_Template_Sociaal_NL.xlsx` (PearBlue quote template).

PearBlue is a Dutch ICT & Media Design agency: "Your Complete Digital Partner". Brand positioning: innovative, sustainable, quality-at-affordable-price, "the new generation of website creation". Symbolism: pear (fruit), leaves, tree — fresh, fruity, modern, sleek. Target: business starters + older generation.

## Architecture
- **Frontend**: React 19 + React Router + Tailwind + shadcn/ui + framer-motion. Multi-language (NL/EN) via context + localStorage with browser auto-detect.
- **Backend**: FastAPI + Motor (MongoDB async). Routes prefixed `/api`. Resend integration ready but inactive (no API key yet); backend gracefully returns `email_sent:false`.
- **Design**: Light theme, primary `#02C0FF`, typography Outfit (headings) + Manrope (body), glass-nav, framer-motion staggered reveals, blob background, marquee.

## User Personas
1. **Prospective client** — SMB owner exploring digital services.
2. **Older generation entrepreneur** — needs clear, readable, trustworthy layout.
3. **Startup founder** — expects modern aesthetic + fast contact.

## Core Requirements (static)
- 5 pages: Home, Over ons, Diensten, Portfolio, Contact
- Contact form + quote request endpoints
- Multi-language NL/EN (browser detection)
- Portfolio grid with example placeholder cases
- Clear branding around PearBlue values

## Implemented (2026-02)
- [x] Home page with hero, marquee, services bento grid, portfolio preview, CTA banner
- [x] About page with brand story + values grid
- [x] Services page with 4 detailed services (IT Infra, Media, Security, AI) + pricing indications
- [x] Portfolio page with filterable grid (6 example projects)
- [x] Contact page with validated form, success state, and DB persistence
- [x] Backend `/api/contact` (POST + GET), `/api/quote` (POST), `/api/health`
- [x] NL/EN language switcher with browser detect + persistence
- [x] Resend integration wired (dormant — needs `RESEND_API_KEY` in `/app/backend/.env`)
- [x] Test coverage: 100% backend + frontend (iteration_1)

## Prioritized Backlog
- **P1** — Activate email delivery: user supplies `RESEND_API_KEY`; verify sender domain in Resend.
- **P1** — Real portfolio content (replace placeholder cases with actual PearBlue projects).
- **P2** — Interactive multi-step quote wizard mirroring the Excel template (modules, price ranges).
- **P2** — Admin panel to view/manage contact & quote submissions.
- **P2** — Blog/News section for SEO.
- **P2** — Cookie banner + GDPR compliance page (privacy/impressum in NL).
- **P3** — Google Analytics 4 + Search Console integration.
- **P3** — Newsletter signup (Mailchimp/Resend audiences).

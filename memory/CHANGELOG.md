## Iteration 8 Notes (Feb 2026)

New features:
- **Reviews auto-invite** — background poller (15 min) + admin "Scan nu" button in CMS. When a Zoho Projects project is closed/completed/archived, emails the linked Zoho Books customer a bilingual (NL+EN) invite → `pearblue.nl/review?project=<name>`. Idempotent via `review_invites` collection.
- **Stripe iDEAL Betaal Nu** — every unpaid Zoho Books invoice in the portal has a "Betaal nu" button. Backend creates a Stripe Checkout Session with `payment_method_types=['ideal','card']`, EUR amount from Zoho. On success (webhook OR poll fallback) posts /books/v3/customerpayments to Zoho so the invoice flips to paid. `/portal/betaling-gelukt` success screen polls status every 2s.
- **Review Syndication (invite portion)** — success state on ReviewForm shows "Ook op Google / Trustpilot / Facebook" buttons via `REACT_APP_GOOGLE_PLACE_ID` / `REACT_APP_TRUSTPILOT_REVIEW_URL` / `REACT_APP_FACEBOOK_PAGE_URL` env vars. Hidden if unset.

Configuration set this iteration:
- Zoho IDs: `ZOHO_BOOKS_ORG_ID=20109165270`, `ZOHO_PROJECTS_PORTAL_ID=20118024653` (numeric — the slug "multibaydoteu" was rejected by Zoho Projects API), `ZOHO_DESK_ORG_ID=20118024663`.
- Stripe sandbox keys in .env (claimable sandbox `acct_1U1gXqLFZvKwzguc`, onboarding URL: https://dashboard.stripe.com/onboard_sandbox/YWNjdF8xVTFnWHFMRlp2S3d6Z3VjLDE3ODY3NjgzOTkv100V4vdnHj5).

Testing: iteration_8.json — 25/25 backend, 100% frontend.

## Prioritized Backlog (updated)
- **P1** — Real Stripe onboarding (claim sandbox at onboarding_url once ready for production).
- **P1** — Google Places API key + Place ID to activate Google review syndication (fetch + share button).
- **P1** — Trustpilot Business API key + review URL to activate Trustpilot syndication.
- **P2** — Facebook — Meta has closed the page-reviews API in 2026; only the "share" button will work, no server-side pull.
- **P2** — Extract review CRUD + Stripe helpers from `server.py` into `routers/` (file now 810 lines).
- **P2** — Rate-limit `POST /api/reviews` and `POST /api/portal/register`.
- **P2** — Pagination on `/api/reviews` and `/api/reviews/all`.
- **P2** — Attach `pearblue.nl` domain to Resend for deliverability.
- **P3** — Blog/news section + newsletter signup.

# OPflow admin site

The internal website for the OPflow team: add and verify doctors, hospitals, bookings, refunds and payouts,
patients (masked), live OPDs, emergency, first aid, support, rules and kill switches, admins and the audit log.
Plan: [`docs/ADMIN_PORTAL.md`](docs/ADMIN_PORTAL.md). Not linked from the landing site; never indexed.

**Next.js 16** (App Router). Read `../web/AGENTS.md` before changing framework code: this version differs from
older docs (e.g. `middleware` is now `src/proxy.ts`; `cookies()` and page `params` are async).

## How it is safe

- **The browser never talks to the API.** Pages and Server Actions call `/v1/admin/*` from this server
  (`src/lib/api.ts`). The admin's tokens live only in httpOnly, `SameSite=strict` cookies.
- `src/proxy.ts` runs before every page: no session → sign in; access token about to expire → refreshed there
  (pages can't set cookies while rendering).
- **OPflow has exactly one admin** (enforced by the database). Sign-in = email + password → authenticator code.
  The admin is made with `npm run admin:create` in `backend/`, which prints a one-time setup link (QR code); there
  is no sign-up page. Changes apply at once (no approval queue) and every one is written to the audit log.
- Risky actions (verifying or suspending a doctor, changing registered details, refunds, revealing a phone number,
  payout accounts, rules and kill switches) ask for a **fresh authenticator code** when the API says so: the form shows a code box and sends the same action again
  (`src/components/action-form.tsx` + `src/lib/actions.ts`).
- Strict headers (`next.config.ts`): CSP, no framing, `noindex`, `Referrer-Policy: same-origin` (not `no-referrer`,
  which makes browsers send `Origin: null` and Server Actions would refuse every form).

## Run it locally

```bash
# 1. the API (backend/): npm run start:dev  → http://localhost:3000
# 2. the admin:         cd backend && npm run admin:create -- --email you@opflow.in --name "You"
#                       → open the printed setup link, scan the QR with an authenticator app, choose a password
# 3. this site:
cd admin
cp .env.example .env.local        # ADMIN_API_BASE_URL=http://localhost:3000
npm install
npm run dev                       # http://localhost:3002
```

For document and photo uploads the browser PUTs files straight to storage with 5-minute links: locally that is the
API (`CORS_ORIGINS=http://localhost:3002` in `backend/.env`); in production, add the admin site's origin to the
R2 bucket's CORS rules (PUT, `content-type` header).

## Checks

```bash
npm run lint && npm run typecheck && npm run build
npm run test:e2e   # a real browser drives the site (see below)
```

`test:e2e` (`tests/admin.e2e.js`) needs: the API on :3000 against a **throwaway** Postgres, this site on :3002
(`npm run build && npm start`), Chrome installed, and the setup link from `admin:create` saved in `setupA.txt`.
It covers 40 checks: setup link + authenticator, wrong password, sign-in, the 6-step "Add a doctor" wizard with a
document upload, the doctor hidden until verified, verifying, the removed approval/admin pages staying gone, every
page opening without errors, phone width without sideways scrolling, sign-out, and no browser errors.

## Layout

```
src/
├─ proxy.ts                  session check + token refresh before each page
├─ lib/                      api (server-only fetch), session cookies, actions (step-up), format, me
├─ components/               ActionForm (every change), Nav (register-style index), ui (Head, Stamp, Pager…)
└─ app/
   ├─ (auth)/                sign-in, authenticator code, setup/[token]
   └─ (portal)/              Today, Needs attention, Live OPDs, Emergency, Doctors (+ wizard),
                             Hospitals, Bookings, Patients, Money (+ CSV export), First aid, Catalog, Support,
                             Settings (rules & kill switches, audit log)
```

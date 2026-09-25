# OPflow Admin Portal — Plan

> The internal website where the OPflow team onboards doctors and hospitals, watches the day's OPDs,
> handles money and support, and changes the rules. Separate from the patient/doctor app and from the
> landing site (which never links to it). Status (25 Sep 2026): **built** — the API (`/v1/admin/*`) and the website
> (`admin/`, see its README), checked by browser tests and the backend's end-to-end tests.
>
> **Decision 25 Sep 2026: OPflow has exactly ONE admin.** No roles, no second admin, no approval queue: the rows
> about roles and two-person approvals below are superseded. Every change applies at once, the riskiest ones need a
> fresh authenticator code, and all are written to the audit log. The database refuses a second active admin. The database rules it relies on are already in
> `backend/migrations/…001600_admin_controls.sql` and tested.

---

## 0. The rules this portal is built around

| # | Rule | Enforced by |
|---|---|---|
| A1 | **Only OPflow admins can add doctors.** There is no doctor sign-up anywhere: not in the app, not on the website, not through the API. | The admin API (only admin sessions reach `POST /admin/doctors`) **and the database**: inserts into `doctors`, `doctor_credentials` and `doctor_hospitals` are refused unless the session is `admin`/`system` (tested). |
| A2 | **A doctor is invisible to patients until verified.** | Public queries filter `verification = 'verified' and status = 'active'`. Verification needs a second admin's approval. |
| A3 | **No admin acts alone on risky things.** Verifying a doctor, editing a doctor's locked details, suspending, large refunds, changing rules, changing admins. | `approval_requests`. The database refuses an approval by the same admin who asked (tested). |
| A4 | **Doctors can't change who they are.** Name, type of doctor, degrees and registration are locked. Only admins change them, with approval. | Database trigger on `doctors` (tested). |
| A5 | **Admins see the least patient data needed.** Phone numbers and notes are masked; revealing them needs a reason and is logged. | Admin API + `audit_log`. |
| A6 | **Everything an admin does is recorded**: who, what, before/after, when, from where. | `audit_log` (append-only; the database refuses edits and deletes, tested). |
| A7 | **The portal can't be reached from the open internet** except by known admins. | Cloudflare Access in front + IP allow-list + password + authenticator code. |

---

## 1. Who uses it: admin roles

Five roles. A person has exactly one role. Permissions are checked by the admin API on every request (the
portal only hides buttons; it never decides).

| What | super | ops | finance | support | content |
|---|:-:|:-:|:-:|:-:|:-:|
| See dashboard, needs-attention list | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Add a doctor**, upload documents, link hospitals, issue login | ✅ | ✅ | – | – | – |
| Request doctor verification | ✅ | ✅ | – | – | – |
| **Approve** verification / locked-field edit / suspension | ✅ | ✅ (not own request) | – | – | – |
| Reset a doctor's password, unlock a login | ✅ | ✅ | – | ✅ | – |
| Add / edit hospitals | ✅ | ✅ | – | – | – |
| Search bookings, see timelines | ✅ | ✅ | ✅ | ✅ | – |
| Reveal a patient's phone (with reason) | ✅ | ✅ | – | ✅ | – |
| Refund up to ₹2,000 (goodwill) | ✅ | – | ✅ | – | – |
| Refund above ₹2,000 | request + approve by another | – | request + approve by another | – | – |
| Payouts, reconciliation, exports | ✅ | – | ✅ | – | – |
| Support tickets | ✅ | ✅ | ✅ | ✅ | – |
| Emergency first aid and catalog (types, problems, emergency situations) | ✅ | – | – | – | ✅ |
| Publish a first-aid page (needs a doctor reviewer + confirmed WHO source) | ✅ | – | – | – | ✅ |
| App rules and kill switches | request + approve | request | – | – | – |
| **Turn a kill switch OFF immediately** (break glass) | ✅ | ✅ | – | – | – |
| Add/remove admins, change roles | request + approve by another super | – | – | – | – |
| Audit log | ✅ | read own | read own | read own | read own |

Rule of thumb: **anything that changes money, visibility of a doctor, or the rules needs two people.**
Turning something *off* in an emergency needs one; turning it back *on* goes through approval.

---

## 2. Access and security

**No sign-up page. Admins are created, never self-registered.**
- **The first super admin** is created once from the server with a command-line script
  (`npm run admin:create -- --email … --name … --role super`). It prints a one-time setup link.
- After that, a super admin requests "Add admin" and a **second super admin approves** it.
- New admins receive a **one-time setup link** (valid 24 h). They set a password and **must scan the authenticator (TOTP) QR code** before they can use anything.

**Signing in**
1. Cloudflare Access (company Google accounts or a one-time email code) in front of the whole site.
2. Then email + password (argon2id, 12+ characters, checked against known-breached passwords).
3. Then the 6-digit authenticator code. Five wrong tries → locked 15 minutes, and the other supers are emailed.
4. Session: 8 hours at most, **30 minutes idle** → signed out. Only an httpOnly, Secure, SameSite=strict cookie.
   Nothing is stored in the browser.
5. **Step-up:** approving anything, revealing patient data, refunds and config changes ask for the authenticator code
   again if the last one was more than 5 minutes ago.

**Other protections:** IP allow-list (`ADMIN_ALLOWED_IPS`), CSRF tokens on every change, strict Content-Security-Policy,
no third-party scripts, and removing an admin revokes their sessions instantly. Every login (success and failure) goes
into `audit_log`.

---

## 3. Adding a doctor — the core flow

Doctors are onboarded by the OPflow team, usually after an in-person or phone conversation. Nobody else can
add a doctor. The same doctor record can't be added twice: registration council + number is unique.

```
 ops admin                                   second admin (ops/super)            doctor
 ─────────                                   ────────────────────────            ──────
 1 Identity ─ 2 Registration ─ 3 Documents
 ─ 4 Hospitals & fee ─ 5 Payout ─ 6 Photo & profile
          │
          ▼ "Create doctor"  → doctor exists, verification = pending (NOT visible to patients)
          │                     login issued: OPD-10001 + one-time password ─────────────► gets SMS + email
          │                                                                               logs in, sets own password,
          │                                                                               fills "My timings", sees
          │                                                                               "Verification in progress"
 7 Checklist ticked ─► "Request verification" ──► Approvals queue ──► checks the same list
                                                                      Approve ─► verified + listed_at set
                                                                      │           doctor visible to patients ───► "You are live"
                                                                      └ Needs correction (with note) ─► back to ops
```

### The "Add doctor" wizard (6 short steps, saved as a draft at each step)

| Step | Fields | Checks |
|---|---|---|
| **1. Identity** | Full name (as on registration), gender, mobile number, email | Mobile is valid Indian E.164, and not already a doctor. Email format. The name is shown in simple title case. |
| **2. Registration** | Type of doctor (from the catalog), degrees, medical council (NMC or state, e.g. APMC), registration number, year of registration | Council + number must be unique. A **"Check on council website"** button opens the official search in a new tab, and ops ticks "Registration matches the council record". |
| **3. Documents** | Degree certificate, registration certificate, government ID (Aadhaar masked / PAN / passport) | PDF/JPG/PNG, max 10 MB each. Stored in the **private** bucket and viewed only through 5-minute signed links. Each document has approve/reject with a note. |
| **4. Hospitals & fee** | One or more hospitals (search; or "Add hospital" if missing), primary hospital, fee (₹50–₹3,000; per-hospital override optional), languages | At least one hospital. The fee preview shows "Doctor gets ₹270 · OPflow ₹30". |
| **5. Payout** | Bank account holder, account number (entered twice), IFSC, PAN | Creates a **Razorpay Route linked account**. A penny-drop check confirms the name matches. The doctor can't receive money until it's active (bookings can still open; transfers wait). |
| **6. Photo & about** (optional) | Profile photo, "About me" | Photo guideline shown (clear face, plain background). The doctor can also add these later from the app. |

**"Create doctor"** then, in one transaction:
1. Creates the `users` row (role doctor), `doctors` (verification = pending, created_by_admin), `doctor_hospitals`, `doctor_documents` and `payout_accounts`.
2. Issues the login: `login_id = next_doctor_login_id()` (OPD-10001…), a random **one-time password** (12 characters), `must_change = true`.
3. Queues an **SMS with the password** and an **email with the login ID and app link**. They're sent separately, so one message alone isn't enough to log in.
4. Shows the password **once** to the admin (for reading out on the phone if needed). It's never visible again. "Resend" issues a new one.

### Verification checklist (both admins see the same list)
- [ ] Name matches the registration record
- [ ] Registration number and council checked on the council website
- [ ] Degree certificate approved
- [ ] Registration certificate approved
- [ ] ID approved, and the photo (if any) matches the ID
- [ ] At least one hospital linked, and the doctor confirmed they practise there
- [ ] Payout account active (or "live without payouts" consciously chosen)

The approver can **Approve** (doctor goes live, gets a "You are live on OPflow" message) or **Needs correction**
(with a note the ops admin sees; the doctor sees "Please contact OPflow" if it concerns them).

### Later changes to a doctor
| Change | How |
|---|---|
| Fee, about, languages, photo, timings | The doctor does it in the app. The admin can see it in History. |
| Name, type, degrees, registration | Admin requests → second admin approves → applied → the doctor is notified. |
| Add/remove a hospital | Ops admin (adding a hospital with future bookings asks what to do with them). |
| Suspend (complaint, expired registration) | Request → approve. Suspension hides the doctor at once; future bookings go through the doctor-cancel flow (full refunds) after a final confirmation that shows the count and total. |
| Reset password / unlock | Ops or support, with a reason; the doctor gets a new one-time password by SMS. |
| Remove a doctor | Never deleted (money and history refer to them). Suspended and anonymised on request after the legal retention period. |

---

## 4. Pages (sitemap)

```
Sign in → Authenticator
├─ Today (dashboard)
├─ Needs attention          (badge count)
├─ Approvals                (badge count)
├─ Doctors                  list · Add doctor · Doctor page (tabs)
├─ Hospitals                list · Add hospital · Hospital page
├─ Bookings                 search · Booking page
├─ Live OPDs                what is running right now
├─ Money                    Payments · Refunds · Payouts · Reconciliation
├─ Patients                 search · Patient page
├─ Emergency                who is marked available now
├─ Content                  Emergency first aid · Catalog
├─ Support                  tickets
└─ Settings                 Rules & kill switches · App versions · Admins · Audit log · My account
```

### What's on each page

**Today:** the first screen.
- Numbers: bookings today, OPDs running now, patients seen, money collected, refunds started, new doctors pending.
- Two small charts: bookings per hour today vs last week, and payment success rate.
- Health strip: API ✓ · Payments ✓ · Push ✓ · last night's consistency checks ✓ (from `/health` and `invariants.check`).

**Needs attention:** one list for everything a person must look at, newest first, each with a one-click action:
- failed refunds after 3 retries;
- stuck bulk operations ("cancel day" at 12/18);
- consistency-check failures;
- Razorpay reconcile mismatches;
- expired approval requests;
- doctors waiting for verification over 48 h;
- documents rejected;
- support tickets older than 24 h.

**Approvals:** open requests, each showing who asked, why, the exact before → after, and Approve / Reject with a
note. Your own requests appear greyed out ("waiting for another admin").

**Doctors list:** search by name, phone, OPD ID or registration number. Filters: verification state, type of doctor,
hospital, active/suspended, payout ready. Columns: photo, name, type, hospitals, state, joined, last OPD.

**Doctor page** (tabs):
- *Overview*: the same card patients see (preview), verification checklist, status, quick actions (Request verification, Suspend, Reset password).
- *Documents*: view (signed link), approve/reject each, upload replacement.
- *Hospitals & timings*: linked hospitals, the weekly timings the doctor set (read-only here; the doctor owns them), leave days.
- *OPD sessions*: calendar of sessions with booked/seen/no-show counts; open a session to see its full line and history.
- *Bookings*: all bookings for this doctor with filters.
- *Money*: fee history, transfers (on hold / released / reversed), payout account status, monthly statement download.
- *Login & security*: OPD ID, last login, devices, locked or not; Reset password, Sign out everywhere.
- *History*: every change to this doctor from `audit_log` (who, what, when).

**Hospitals:**
- Add/edit hospital: name, address with a map pin (Google Geocoding fills lat/lng, and the pin can be dragged), area, city, PIN, phone, OPD timings text, emergency 24 h yes/no, and the departments.
- Hospital page: its doctors, today's sessions, and emergency status.

**Bookings:**
- Search by booking code (OPF7Q2K9), patient phone (exact match only), doctor, date or token.
- Booking page: the ticket, the full timeline (`booking_events`), payment and refund details (Razorpay IDs link to the Razorpay dashboard), and the queue history for that day.
- Actions: resend receipt, goodwill refund (limits in §1), and "move to another time" on the doctor's behalf (with the doctor's consent noted).

**Live OPDs:** every running session: doctor, hospital, now-seeing token, waiting count, late minutes, time since the last
action. Sessions with no action for 45 minutes are flagged ("Doctor may have forgotten to end OPD"). Read-only: admins
never press the doctor's buttons.

**Money:**
- *Payments*: search and filter; failed payments by method.
- *Refunds*: the queue (pending / failed); retry now; mark as paid manually with a UTR number (when the bank route fails).
- *Payouts*: transfers due, released, reversed; per-doctor totals.
- *Reconciliation*: daily report of captured − refunded vs the Razorpay settlement, with any mismatch rows. CSV export.

**Patients:**
- Search by phone number (exact) or booking code.
- The patient page shows name, age, gender, place, bookings and payments. The phone is masked ("98xxxxx210"); **"Show full number"** asks for a reason and is logged.
- Actions: block an account (abuse), handle an account-deletion request (starts the DPDP deletion job after confirmation), and data export for the patient.

**Emergency:** every doctor currently marked available/on call, with "updated X min ago". Ops can switch off a clearly
wrong status (the doctor is notified).

**Content:**
- *Emergency first aid*: one page per emergency situation (Do's, Don'ts, "Call 108 now if…"), each with its WHO source documents. The editor shows the phone view. **Publishing needs a doctor reviewer's name and date, and a confirmed WHO source** (the database refuses otherwise). Every change keeps history. Emergency advice must never be edited casually: changes go back to "in review".
- *Catalog*: types of doctor (simple + proper names, icon, "common" flag), health problems with their doctor-type mapping for adults and children, and emergency kinds. Changes show in the app the next time it refreshes.

**Support:** tickets from the app with the request ID and the patient/doctor. Assign, reply (sent as an in-app message +
email), close. Canned replies in simple English.

**Settings:**
- *Rules & kill switches*: every `app_config` value with its meaning (fee %, cut-offs, hold minutes, payout hours…). Editing creates an approval request, except that a kill switch can be turned **off** at once.
- *App versions*: minimum and latest version per platform ("Please update" screen).
- *Admins*: list, roles, last login; add/remove through approval.
- *Audit log*: search by person, doctor, booking, action or date; export.
- *My account*: password, authenticator, active sessions.

---

## 5. Admin API (`/v1/admin/*`)

Same NestJS server, separate module and audience (`aud: admin` tokens only). Every write takes an Idempotency-Key,
writes `audit_log`, and runs with `app.role = 'admin'` so the database rules in §0 apply.

| Area | Endpoints |
|---|---|
| Auth | `POST /admin/auth/login` · `POST /admin/auth/totp` · `POST /admin/auth/step-up` · `POST /admin/auth/logout` · `POST /admin/auth/setup/:token` |
| Dashboard | `GET /admin/dashboard/today` · `GET /admin/attention` |
| Approvals | `GET /admin/approvals?status=` · `POST /admin/approvals` · `POST /admin/approvals/:id/approve` · `POST /admin/approvals/:id/reject` |
| Doctors | `GET /admin/doctors` · `POST /admin/doctors` (the wizard's final "Create") · `GET/PATCH /admin/doctors/:id` · `POST /admin/doctors/:id/documents/upload-url` · `POST /admin/doctors/:id/documents/:docId/review` · `POST /admin/doctors/:id/hospitals` · `DELETE /admin/doctors/:id/hospitals/:hid` · `POST /admin/doctors/:id/payout-account` · `POST /admin/doctors/:id/request-verification` · `POST /admin/doctors/:id/reset-password` · `POST /admin/doctors/:id/unlock` · `POST /admin/doctors/:id/sign-out-everywhere` · `GET /admin/doctors/:id/history` |
| Hospitals | `GET/POST /admin/hospitals` · `GET/PATCH /admin/hospitals/:id` · `POST /admin/hospitals/geocode` |
| Bookings | `GET /admin/bookings?code=&phone=&doctor=&date=` · `GET /admin/bookings/:id` · `POST /admin/bookings/:id/resend-receipt` · `POST /admin/bookings/:id/refund` · `POST /admin/bookings/:id/move` |
| Live | `GET /admin/live/sessions` · `GET /admin/live/sessions/:id` |
| Money | `GET /admin/payments` · `GET /admin/refunds?status=` · `POST /admin/refunds/:id/retry` · `POST /admin/refunds/:id/mark-paid` · `GET /admin/transfers` · `GET /admin/reconciliation?date=` · `GET /admin/exports/:kind.csv` |
| Patients | `GET /admin/patients?phone=` · `GET /admin/patients/:id` · `POST /admin/patients/:id/reveal {field, reason}` · `POST /admin/patients/:id/block` · `POST /admin/patients/:id/deletion` · `POST /admin/patients/:id/export` |
| Emergency | `GET /admin/emergency` · `POST /admin/emergency/:doctorId/off` |
| Content | `GET /admin/first-aid` · `PUT /admin/first-aid/:kind` · `POST /admin/first-aid/:kind/publish {reviewedByDoctor}` · `GET/PUT /admin/catalog/{types,problems,emergency-kinds}` |
| Support | `GET /admin/tickets` · `POST /admin/tickets/:id/reply` · `POST /admin/tickets/:id/close` |
| Settings | `GET /admin/config` · `POST /admin/config/:key/kill` (immediate off) · `GET /admin/admins` · `GET /admin/audit?…` |

---

## 6. Database (what the portal uses)

Already in the migrations:
- `admin_users` (…000300)
- `doctors` + `created_by_admin`, `listed_at`, and row-level security (…001600)
- `doctor_credentials`, `doctor_documents`, `doctor_hospitals`, `payout_accounts` (…000300 / …000600)
- `approval_requests`: maker ≠ checker, one open request per subject, only pending → approved / rejected / expired (…001600)
- `next_doctor_login_id()` → OPD-10001… (…001600)
- `audit_log` (append-only), `app_config`, `support_tickets`, `first_aid_guides` (publish needs a doctor reviewer + confirmed WHO source)

Tested on PostgreSQL 17 (12 checks, all passing):
- doctors, patients and anonymous sessions **cannot add doctors or doctor logins**;
- an admin can;
- a doctor can change only their own editable fields;
- another doctor can't touch the profile;
- the same admin can't approve their own request;
- duplicate open requests and re-opening a decision are refused.

Still to add, when the portal is built: `admin_setup_tokens` (one-time setup links) and `patient_reveals`, a small table on top of
`audit_log` for the "who looked at which phone number" report.

---

## 7. Technology and structure

- **Next.js (App Router) + TypeScript** in `admin/`, the same framework as the landing site. That version has breaking changes, so read `web/AGENTS.md` and its bundled docs before writing code.
- **The server talks to the API; the browser never does.** Pages are server components. Actions go through server actions / route handlers that call `/v1/admin/*` with the session. The admin's refresh token lives only in an httpOnly cookie. There is no direct database access from the portal.
- **Types from the API contract:** `openapi-typescript` generates types from the backend's OpenAPI file, so the portal and API can't drift apart.
- **UI:** the same OPflow design tokens (paper, ink, forest, Newsreader + IBM Plex), set denser for work: tables, filters and side panels. TanStack Table for lists (server-side paging), react-hook-form + zod for forms, and no heavy UI kit.
- **Tests:** Playwright for the main journeys (add a doctor end to end, approve, refund, kill switch), plus the permission matrix run for every role.

```
admin/
├─ docs/ADMIN_PORTAL.md          ← this file
├─ src/
│  ├─ app/
│  │  ├─ (auth)/sign-in/ · (auth)/authenticator/ · (auth)/setup/[token]/
│  │  └─ (portal)/
│  │     ├─ layout.tsx           ← sidebar, role-aware menu, idle sign-out
│  │     ├─ today/ · attention/ · approvals/
│  │     ├─ doctors/ · doctors/new/[step]/ · doctors/[id]/[tab]/
│  │     ├─ hospitals/ · hospitals/new/ · hospitals/[id]/
│  │     ├─ bookings/ · bookings/[id]/ · live/
│  │     ├─ money/{payments,refunds,payouts,reconciliation}/
│  │     ├─ patients/ · patients/[id]/ · emergency/
│  │     ├─ content/{first-aid,catalog}/ · support/
│  │     └─ settings/{rules,versions,admins,audit,account}/
│  ├─ server/
│  │  ├─ api.ts                  ← fetch to /v1/admin with session, Idempotency-Key, error mapping
│  │  ├─ session.ts              ← cookie handling, idle timeout, step-up
│  │  └─ permissions.ts          ← the §1 matrix (UI only; the API is the authority)
│  ├─ components/                ← DataTable, FilterBar, DoctorCardPreview, ApprovalDiff, MaskedField, StepUpDialog
│  └─ lib/generated/api.d.ts     ← from OpenAPI
├─ tests/e2e/                    ← Playwright
├─ .env.example
└─ package.json
```

**Environment (`admin/.env.example`):** `ADMIN_API_BASE_URL` (server-side), `SESSION_COOKIE_NAME`,
`SESSION_IDLE_MINUTES=30`, `SENTRY_DSN_ADMIN`, `NEXT_PUBLIC_APP_ENV`.
No API secrets live here: the portal only holds the admin's own session.

**Hosting:** Vercel or Fly (same region as the API), with **Cloudflare Access in front** and a separate domain
(e.g. `admin.opflow.in`). It is not linked from the landing site and not indexed (`noindex`, `robots.txt` disallow).

---

## 8. Build order

| # | Milestone | Done when |
|---|---|---|
| A1 | Skeleton: Next.js app, design tokens, sign-in + authenticator + setup link, first-super CLI, idle sign-out | A super admin can sign in with an authenticator |
| A2 | **Doctors: the 6-step wizard, documents, login issue (SMS + email), doctor page tabs** | Ops adds a doctor; the doctor logs into the app with OPD-10001 and sets a password |
| A3 | Approvals: verification request/approve/reject, locked-field edits, suspension | A second admin verifies; the doctor appears in patient search |
| A4 | Hospitals (with map pin) and catalog | New hospital + departments visible in the app |
| A5 | Bookings search, booking page, patients (masked + reveal), support | Support can find a booking by code and answer a ticket |
| A6 | Money: refunds queue, payouts, reconciliation, exports; Live OPDs; Needs attention | Finance closes a day with zero mismatches |
| A7 | First-aid editor + publishing with doctor reviewer; Settings (rules, kill switches, versions, admins, audit) | A kill switch turned off in the portal stops bookings in the app within a minute |
| A8 | Hardening: Playwright journeys, permission-matrix tests, Cloudflare Access, pen test of admin routes | All roles tested; external test passed |

Backend dependency: the admin API grows alongside (backend milestones B2 → B10). A2 needs B2 (auth) and B3 (doctors).

---

## 9. Decisions to confirm

1. **Who approves?** Assumed: any other ops or super admin can approve verification. With a very small team at the start,
   a single founder could be both. We can allow that for the pilot with a logged "sole admin" override, or insist on two people from day one.
2. **Doctor login timing:** assumed the login is issued at creation, so doctors can set timings before going live. The alternative
   is issuing it only after verification.
3. **Large refund limit:** assumed ₹2,000 for two-person approval.
4. **Portal host:** Vercel + Cloudflare Access (assumed), or Fly next to the API.
5. **Council check:** manual (a "check on council website" button) for the pilot. Automating it needs NMC/state council API access, which is usually not available.

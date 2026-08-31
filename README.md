# Bursary-Bridge

**Find funding. Build your future.**

Bursary-Bridge connects students with bursaries, scholarships and education-funding
opportunities, and gives organisations a place to create funding programmes, receive
applications, review applicants and select beneficiaries.

This repository contains the submission prototype: a working, database-backed
Next.js application covering both complete user journeys end to end.

---

## Contents

- [Quick start](#quick-start)
- [Demo accounts](#demo-accounts)
- [What works](#what-works)
- [Architecture](#architecture)
- [Data model](#data-model)
- [The matching engine](#the-matching-engine)
- [Security](#security)
- [Testing](#testing)
- [Project structure](#project-structure)
- [Environment variables](#environment-variables)
- [Prototype scope](#prototype-scope)

---

## Quick start

**Requirements:** Node.js 20+ and PostgreSQL 14+.

```bash
# 1. Install dependencies
npm install

# 2. Configure the environment
cp .env.example .env
#    Then set DATABASE_URL, and generate a secret:
#    node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
#    ...and paste it into AUTH_SECRET.

# 3. Create the database schema
npm run db:deploy      # applies migrations
#    (or `npm run db:migrate` during development)

# 4. Load the demo data
npm run db:seed

# 5. Run it
npm run dev
```

Open <http://localhost:3000>.

<details>
<summary>Creating the PostgreSQL database</summary>

```bash
createdb bursarybridge
psql -c "CREATE ROLE bursary WITH LOGIN PASSWORD 'bursary';"
psql -c "GRANT ALL PRIVILEGES ON DATABASE bursarybridge TO bursary;"
```

Then set:

```
DATABASE_URL="postgresql://bursary:bursary@localhost:5432/bursarybridge?schema=public"
```

</details>

### Verification emails

The prototype's email driver writes to the server console rather than sending mail.
After registering, look in your terminal for a block like:

```
[email] ---------------------------------------------------
  To:      you@example.com
  Subject: Verify your Bursary-Bridge email address
  Action: Verify my email -> http://localhost:3000/verify?token=...
```

Email verification is not enforced — you can continue straight into onboarding —
so the journey is never blocked while testing.

---

## Demo accounts

Seeded by `npm run db:seed`. The password comes from `DEMO_PASSWORD` in `.env`
(default `Demo1234!`).

| Role | Email | What you'll see |
| --- | --- | --- |
| **Student** | `student@demo.bursarybridge.local` | A complete profile, matched opportunities, and applications at several stages |
| **Corporate** | `corporate@demo.bursarybridge.local` | Kgotso Holdings, with two live programmes and a full applicant pipeline |

Three further funder accounts exist for variety: `umoya@`, `thuto@` and
`amandla@demo.bursarybridge.local`.

> Demo passwords are read from the environment and never hard-coded. Every funder
> and funding programme in the seed data is **fictional** — the prototype does not
> present any real organisation as offering funding.

---

## What works

Both journeys run end to end against PostgreSQL. None of it is mocked.

### Student

Register → verify email → education journey → **up to six study preferences** →
academic profile → funding needs → financial profile → location and interests →
review → **matched opportunities with reasons** → opportunity detail → apply →
track the application.

### Corporate

Register → organisation details → role → funding profile → current process →
review → dashboard → create a funding programme → define eligibility → publish →
view applications → review an applicant → shortlist → move to selected.

### The loop that ties them together

A funder publishes a programme; a matching student sees it in their opportunities,
applies using their existing profile, and the funder reviews, shortlists and
selects them — with the student notified at each step. This is covered by an
automated test (see [Testing](#testing)).

---

## Architecture

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 15 (App Router) | Server components for reads, route handlers for writes |
| Language | TypeScript, `strict` | No `any` in application code |
| Styling | Tailwind CSS 3.4 | Design tokens transcribed from the approved reference screens |
| Database | PostgreSQL 16 + Prisma 6 | Relational integrity for a genuinely relational domain |
| Auth | Server-side sessions | Revocable, unlike a bare JWT |
| Validation | Zod | One schema shared by the client hint and the server enforcement |

**Reads** happen in server components, which call a service in `services/`.
**Writes** go through API route handlers under `app/api/`, so every mutation has one
authenticated, validated, auditable entry point — and can be exercised by the test
suite without a browser.

### Authorisation

Every page and endpoint resolves the caller through a guard before touching data:

```
requireStudent()   -> { user, studentProfileId }
requireCorporate() -> { user, corporateProfileId, organisationId }
```

The returned id is then used in the `WHERE` clause of every query. This is what
enforces the two central rules — a student can only read their own applications,
and a funder can only read applications submitted to its own programmes — at the
query level rather than in the UI.

Middleware additionally bounces anonymous traffic away from `/student`,
`/corporate` and `/onboarding` before any rendering happens.

---

## Data model

```
User ──┬── StudentProfile ──┬── StudyPreference ──> Programme
       │                    │                   └─> Institution
       │                    ├── Application ─────┬─> FundingProgramme
       │                    │                    ├─> Organisation
       │                    │                    └─> ApplicationDocument ──> Document
       │                    └── Document
       │
       └── CorporateProfile ──> Organisation ──> FundingProgramme ──┬── EligibilityRule
                                                                    ├── ApplicationQuestion
                                                                    ├── FundingProgrammeInstitution
                                                                    └── FundingProgrammeProgramme

Application ──> Shortlist          Session, VerificationToken, Notification, AuditLog
```

Two decisions are worth calling out.

**A study preference is a course paired with an institution.** Courses and
institutions are never stored as two unrelated lists. `StudyPreference` holds
`studentProfileId`, `preferenceNumber`, `programmeId` and `institutionId`
together, because a bursary that funds Computer Science at one university is not
necessarily open to the same course elsewhere. The matching engine scores both
halves of the *same* pair.

**Eligibility is structured data, not prose.** `EligibilityRule` stores the
minimum average, qualification levels, years of study, citizenship, income
threshold and provinces as typed columns. What a funder configures in the UI is
exactly what the engine evaluates.

Integrity is enforced in the database: foreign keys throughout, a unique
constraint on `[studentProfileId, preferenceNumber]` and on
`[studentProfileId, programmeId, institutionId]`, one application per student per
programme, and indexes on every column the dashboards filter by.

---

## The matching engine

`lib/matching/` is pure TypeScript with no Prisma import and no React import. It
takes plain objects and returns a score with its justification, so it can be
tested directly and replaced later without touching the UI.

### Scoring

| Criterion | Weight |
| --- | ---: |
| Course | 30% |
| Institution | 25% |
| Academic requirement | 20% |
| Qualification level | 10% |
| Location | 10% |
| Financial requirement | 5% |

Each criterion returns `MET`, `NOT_MET` or `UNKNOWN`. A criterion we cannot
evaluate earns **half credit** rather than zero: the student is not penalised as
though they had failed, but the gap still lowers the score and is surfaced.

| Classification | Rule |
| --- | --- |
| **Strong Match** | 85–100% |
| **Potential Match** | 60–84% |
| **More Information Needed** | Below 60%, or more than 25 points of weight unevaluable |

### Why this match?

A percentage on its own is not trustworthy, so the engine returns the reasoning
alongside the score, and the UI always shows it:

```
94% Match
  ✓ Course supported
  ✓ Institution supported
  ✓ Academic requirement met
  ✓ Qualification level matches
  ✓ Location requirement met
  ⚠ Financial requirement needs verification
```

### Two services, two questions

- **`MatchingService`** answers the student's question — *how well does this fit
  me?* — as a ranked, weighted score.
- **`EligibilityService`** answers the funder's question — *does this applicant
  meet our stated rules?* — as `ELIGIBLE`, `NOT_ELIGIBLE` or
  `PENDING_VERIFICATION`.

Missing information is never an automatic rejection. It surfaces as
`PENDING_VERIFICATION` so a reviewer can request the document instead. The
verdict is recorded on the application at submission time, so the funder's
"Eligible" counts reflect their actual criteria rather than being inferred from a
score.

All tuning lives in `lib/matching/config.ts`.

---

## Security

- **Passwords** hashed with bcrypt (cost 12) and never logged.
- **Sessions** are opaque 32-byte random tokens in an httpOnly, SameSite=Lax
  cookie. Only the SHA-256 hash is stored, so a database dump cannot be replayed
  as a login. Logout deletes the row; changing a password invalidates every
  session.
- **Account enumeration** is prevented — an unknown email and a wrong password
  return byte-identical responses, and the unknown-email path still performs a
  bcrypt comparison so the timing matches.
- **Rate limiting** on registration, login (per IP *and* per account),
  verification resend, uploads and application submission.
- **Server-side validation** on every endpoint via Zod. The client hints are
  generated from the same schemas, so the two cannot drift.
- **Uploads** are validated for MIME type and size, written outside `public/`, and
  served only through an authorised handler that checks whether the caller owns
  the document or received an application it is attached to.
- **No secrets in source control.** `.env` is gitignored; `.env.example` documents
  every variable.

---

## Testing

```bash
npm run typecheck      # tsc --noEmit, strict
npm run test:matching  # 22 checks — engine weights, thresholds, edge cases
npm run test:e2e       # 67 checks — both journeys + access control (needs a running server)
npm run test           # all of the above
npm run screenshots    # visual QA capture at 3 breakpoints
```

`test:matching` runs against the pure engine with hand-built profiles: scoring
weights, classification thresholds, the pairing rule, unknown handling, and the
eligibility outcomes.

`test:e2e` drives the real HTTP API with real session cookies. It registers new
users, completes both onboarding journeys, has a funder publish a programme, has
a student discover and apply to it, and has the funder shortlist and select them
— then asserts every access-control boundary, including that one funder cannot
read, decide on, shortlist or close another funder's records.

To run it:

```bash
npm run dev            # terminal 1
npm run test:e2e       # terminal 2
```

### Visual QA

`npm run screenshots` captures every major screen at 1440px, 834px and 390px into
`.screenshots/`, for comparison against the reference designs.

---

## Project structure

```
app/
  (auth)/              login, registration, email verification
  onboarding/
    student/           7 steps: education -> preferences -> ... -> review
    organisation/      5 steps: details -> role -> funding -> process -> review
  student/             dashboard, opportunities, applications, profile, documents
  corporate/           dashboard, programmes, applications, shortlists, reports
  api/
    auth/              register, login, logout, verify
    student/  corporate/   role-scoped mutations
    account/           settings and notifications, shared by both roles
    documents/         upload, delete, authorised download
components/
  ui/                  design system: button, field, combobox, table, modal…
  student/  corporate/  onboarding/  layout/  landing/
lib/
  matching/            the engine — pure, no Prisma, no React
  validation/          Zod schemas shared by client and server
  auth/                sessions, guards, rate limiting
  storage/             StorageProvider interface + local and S3 implementations
  labels.ts            every enum's display text, in one place
services/              data loading and business operations
prisma/                schema, migrations, seed
scripts/               test and QA harnesses
```

Conventions worth knowing:

- No business logic in components. Scoring lives in `lib/matching/`, data loading
  in `services/`.
- No enum wording in components. `lib/labels.ts` is the single source of truth,
  so a label change is a one-line edit.
- Every list renders an empty state; every mutation has loading, success and
  error states; users never see a stack trace.

---

## Environment variables

See `.env.example` for the annotated list. The essentials:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | 32-byte hex string used to derive session identifiers |
| `NEXT_PUBLIC_APP_URL` | Base URL used in verification links |
| `STORAGE_DRIVER` | `local` (development) or `s3` |
| `EMAIL_DRIVER` | `console` (development) or `smtp` |
| `DEMO_PASSWORD` | Password for the seeded demo accounts |

`lib/env.ts` validates these at startup, so a misconfigured deployment fails
immediately with a readable message rather than at the first request.

---

## Prototype scope

Built deliberately as a foundation, not a finished platform.

**In scope, and working:** both user journeys end to end, the matching engine,
programme creation with structured eligibility, the review and shortlist
pipeline, role-based access control, document handling, notifications, and an
audit trail.

**Seams left open for production**, each behind an interface so it is a
replacement rather than a rewrite:

| Concern | Prototype | Production path |
| --- | --- | --- |
| File storage | Local disk | `S3StorageProvider` — implement four methods, flip `STORAGE_DRIVER` |
| Email | Server console | `sendViaSmtp` in `lib/email/` |
| Rate limiting | In-memory `Map` | Redis — one file changes |
| Matching | Weighted criteria | The engine's contract stays; the implementation can be replaced |

**Deliberately excluded:** microservices, Kubernetes, event buses, ML
infrastructure, payment and billing, and university or government integrations.
The schema and service boundaries are drawn so these can be added later without
restructuring what exists.

Two other deliberate choices:

- **Registration does not over-collect.** No street address, ID number, bank
  details, parent ID, financial records or transcripts. Registration establishes
  identity and the matching profile; applications collect what a specific
  programme actually requires.
- **The partner logos on the landing page are fictional.** The reference design
  shows real companies; presenting real organisations as partners of a prototype
  would misrepresent them, so clearly fictional demo funders are used instead.

---

## Licence

Prototype built for submission. Not licensed for production use.

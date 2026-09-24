# Bursary-Bridge — five-feature implementation report

Branch: `claude/bursary-bridge-prototype-vhhs5t`
Commits: `18869d4` … `e9dec7f` (six commits, 71 files, ~6 400 lines added)
Date: 23 September 2026

---

## 1. What was implemented

**F1 — Real bursary data.** The ingestion pipeline (robots check → fetch →
parse → normalise → deduplicate → validate → persist with provenance) was
already in place from the previous round; this round added the `CLOSING_SOON`
status (a bursary within 14 days of its deadline), the `openOrClosingSoon()`
and `isOpenNow()` predicates the directory and matching read, and an admin
**Sync Now** action that runs a source on demand and shows the run's outcome.
**The scraper cannot reach any external site from this environment** — see
item 9.

**F2 — Motivational letters.** A student picks a bursary (one they are
applying to, one from the directory, or one they name themselves), answers up
to seven questions in their own words, sees exactly which profile facts will
be used, and gets a draft they can edit, save, mark ready, copy and download
as a PDF. Letters are listed in a history page and can be rewritten from
changed answers or deleted.

**F3 — Subject and module results.** Students record results one row at a
time, with the vocabulary following their education stage (a Grade 12 learner
has _subjects_, a university student has _modules_). A result may be entered
without a mark, because knowing you take Mathematics but not yet what you got
is a real state and storing it as a zero would tell a funder something false.
Results feed a new `subjects` criterion in the matching engine.

**F4 — Request Information.** A funder asks an applicant for specific things
in the funder's own words; the student sees exactly what was asked, attaches
documents against each item and submits; the funder sees the response. It
replaces a modal that only changed a status.

**F5 — Admin catalogue management.** Institutions and courses can be created,
renamed, linked to each other and retired, with canonical-name matching so two
spellings of one institution cannot become two rows. Retiring uses a status
rather than a delete, so a student's chosen institution can never be orphaned.

### How they connect

- A **result** (F3) is scored against a bursary's **subject requirement** (F1)
  by the matching engine, and the same met requirement is cited in a
  **letter** (F2): _"I achieved Mathematics at 82%, against the 70% this
  bursary requires."_
- A **letter** (F2) is started from the opportunity page next to **Apply**,
  and arrives with that bursary already chosen.
- **Institutions and courses** (F5) are what a student's profile points at,
  what a funder's eligibility points at, and what the letter's opening
  paragraph names.
- An **information request** (F4) appears at the top of the student's own
  application page, above everything else on it, because it is the only thing
  there they can act on.

---

## 2. Files and components changed

New, by area:

| Area      | Files                                                                                                                                                |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Letters   | `lib/letters/{types,questions,compose,pdf}.ts`, `services/motivational-letters.ts`, `components/student/letters/{letter-composer,letter-editor}.tsx` |
| Results   | `services/student-results.ts`, `prisma/subject-data.ts`, `components/student/results-manager.tsx`                                                    |
| Requests  | `services/information-requests.ts`, `components/corporate/request-information-dialog.tsx`, `components/student/information-request-panel.tsx`        |
| Catalogue | `lib/catalogue.ts`, `services/catalogue.ts`, `components/admin/catalogue-manager.tsx`                                                                |
| Status    | `lib/bursary-status.ts` (CLOSING_SOON), `components/admin/sync-button.tsx`                                                                           |

Changed: `lib/matching/{config,criteria,types,adapters}.ts` (the new `subjects`
criterion and rebalanced weights), `components/student/opportunity-detail.tsx`
(the letter link), `app/student/layout.tsx` (two nav entries),
`components/corporate/applicant-profile.tsx` (a Requests tab),
`prisma/seed.ts` (subject catalogue), `scripts/e2e.ts` (two harness fixes,
item 8).

---

## 3. Database models changed

One migration: `prisma/migrations/20260923120000_catalogue_results_letters_requests`.

New tables: `ProgrammeInstitution`, `SubjectCatalogue`, `StudentSubjectResult`,
`EligibilitySubjectRequirement`, `MotivationalLetter`, `InformationRequest`,
`InformationRequestItem`.

New enums: `CatalogueStatus`, `SubjectLevel`, `ResultKind`, `LetterStatus`,
`InformationRequestStatus`; `CLOSING_SOON` added to `Availability`.

Changed columns: `status`, `code`, `website` and `canonicalName` on
`Institution` and `Programme`. `canonicalName` was added nullable, backfilled
with the same normalisation the application uses, guarded by a `DO $$ … RAISE
EXCEPTION` block that aborts the migration if the backfill would create a
duplicate, and only then set `NOT NULL` and unique — so a database with two
spellings of one institution stops the migration instead of silently losing
one.

Nothing was duplicated: results hang off `StudentProfile`, requirements off
`EligibilityRule`, letters off `StudentProfile` and (nullably)
`FundingProgramme`.

---

## 4. API and server-side changes

| Route                                                   | Methods                                     | Guard            |
| ------------------------------------------------------- | ------------------------------------------- | ---------------- |
| `/api/student/letters`                                  | GET, POST                                   | `apiStudent()`   |
| `/api/student/letters/[id]`                             | PATCH (`SAVE` \| `REGENERATE`), DELETE      | `apiStudent()`   |
| `/api/student/letters/[id]/pdf`                         | GET                                         | `apiStudent()`   |
| `/api/student/results`                                  | GET, POST, PATCH (reorder)                  | `apiStudent()`   |
| `/api/student/results/[id]`                             | PUT, DELETE                                 | `apiStudent()`   |
| `/api/student/information-requests/[id]`                | PATCH                                       | `apiStudent()`   |
| `/api/corporate/applications/[id]/information-requests` | POST, PATCH                                 | `apiCorporate()` |
| `/api/admin/catalogue/institutions`                     | POST (`CREATE` \| `UPDATE` \| `SET_STATUS`) | `apiAdmin()`     |
| `/api/admin/catalogue/courses`                          | POST (same union)                           | `apiAdmin()`     |
| `/api/admin/ingestion/sync`                             | POST                                        | `apiAdmin()`     |

Every student read and write is scoped by `studentProfileId` **inside the
WHERE clause** rather than fetched and then checked, so there is no path by
which one student reaches another's letter, result or request. Corporate reads
are scoped by `organisationId` the same way. All bodies are validated with
Zod; field-level errors come back for the form to display.

The letter generator sits behind a `LetterProvider` interface. Substituting a
model-backed writer is a one-file change and does not touch the service, the
routes or the UI.

---

## 5. Routes and pages added

- `/student/letters` — history, with a real empty state
- `/student/letters/new` — three-step create flow
- `/student/letters/[id]` — editor, rewrite panel, PDF download
- `/student/results` — results manager
- `/admin/catalogue` — institution and course management (rewritten)
- `/admin/data-sources` and `/admin/data-sources/[runId]` — ingestion runs

Mounted into existing pages: the Requests tab on
`/corporate/applications/[id]`, the request panel on
`/student/applications/[id]`, the letter link on
`/student/opportunities/[id]`, two sidebar entries in the student nav.

---

## 6. Tests performed

| Suite             | Checks    | What it covers                                        |
| ----------------- | --------- | ----------------------------------------------------- |
| `test:matching`   | 35        | Scoring, including the new `subjects` criterion       |
| `test:pdf:labels` | 39        | Field-label matching regressions                      |
| `test:pdf`        | 46 fields | Auto-fill accuracy harness                            |
| `test:autofill`   | 32        | Auto-fill service and failure isolation               |
| `test:catalogue`  | 17 + 26   | Canonical names; catalogue service                    |
| `test:results`    | 32        | Results service and requirement matching              |
| `test:requests`   | 31        | The full request/response loop, both sides            |
| `test:letters`    | 42 + 45   | Composer, PDF, service, ownership isolation           |
| `test:ingest`     | 78        | Pipeline: robots, parse, dedupe, status, provenance   |
| `test:directory`  | 25        | Browser: All Bursaries vs My Matches                  |
| `test:letters:ui` | 27        | Browser: the whole letter journey                     |
| `test:e2e`        | 109       | Browser + API: registration through to password reset |

Also run: `npm run typecheck` (clean), `npm run build` (clean),
`npm run audit:production` (**AUDIT PASSED** — no mock data in anything
user-visible).

The tests that matter most for F2 are the negative ones. For a student whose
profile is empty and who answered nothing, the letter must contain no
institution, no mark, no "passionate about", and no placeholder — those are
asserted directly, in both the unit suite and the browser suite.

## 7. What passed

All of it: **584 automated checks across twelve suites, 0 failures** (538
assertions plus the 46-field auto-fill accuracy harness), together with a
clean typecheck, a clean production build and a passing production-data
audit.

## 8. What failed, and what was done about it

Two failures surfaced in `test:e2e` during this round. Both were flaws in the
test harness, not the application, and both are fixed:

1. _"the owning funder cannot publish a suspended programme"_ intermittently
   returned 404 instead of 403. The test picked the programme to suspend with
   an unordered `findFirstOrThrow` over every organisation whose name contained
   the run id — and the run creates a second, rival organisation. When
   Postgres returned the rival's row, the test measured the ownership check
   instead of the suspension check. Now scoped to the funder that does the
   republish attempt.
2. _"the new password signs the student back in"_ returned 429. The login
   limiter allows six attempts per account and ten per IP in five minutes; one
   run signs the same student in seven times. The reset section now uses a
   student of its own, and each `Session` carries its own client address. **The
   limiter itself was not changed** — an account throttled after six attempts
   in five minutes is the behaviour we want, and loosening it to make a test
   pass would have been the wrong fix.

One design choice was corrected mid-implementation: the letter's opening read
_"I am a Bachelor's Degree in Electrical Engineering student at …"_, which is
grammatical but clumsy; it now reads _"I am studying towards a …"_.

## 9. Remaining limitations

**The directory is now populated from a live crawl.** This limitation has been
lifted: network access was raised for this environment and `npm run ingest` was
run against `www.zabursaries.co.za`, whose `robots.txt` and terms were checked
first and permit it. **189 real bursaries were imported**, each with the source
URL it came from, and a sample was reviewed before the full run. That is fewer
than the roughly 325 the site's category pages suggest, because entries that
could not be mapped to a funder, a closing date and a source page were rejected
rather than guessed at.

The one thing that has not changed is what happens when a page cannot be parsed:
it is recorded as rejected with a reason rather than being filled in. The
directory therefore holds what the source actually published and nothing else.

**The letter generator is not a language model.** No model endpoint is
reachable, so the built-in `ComposedLetter` provider assembles the letter
deterministically from profile facts and the student's own sentences. This is
stated plainly in the UI ("assembled from these facts and your own
sentences"), and it is why the letter is short when the student says little.
It is honest, it cannot fabricate, and the `LetterProvider` seam is where a
model-backed writer goes. It is not, and is not described as, AI writing.

**Tertiary modules are not seeded.** Module names differ at every institution
and there is no national list to draw on, so students type their own and those
become custom catalogue entries. The 39 seeded subjects are the real NSC
subject list.

**Email is not sent.** Notifications are written to the database and shown
in-app; there is no SMTP configured, so the reset link in the e2e suite is
read from the database the same way the server writes it.

**The rate limiter is in-memory**, so it resets when the process restarts and
does not work across more than one instance. The `rateLimit()` signature is
the single place that changes when it moves to Redis.

## 10. External services and API keys required

None are required for anything implemented here — the application runs on
PostgreSQL alone.

To go further, three things would need credentials:

| Purpose                | What is needed                                       | What it unlocks                                 |
| ---------------------- | ---------------------------------------------------- | ----------------------------------------------- |
| Further bursary sources | No key — network egress to each new source host     | `npm run ingest` against sources beyond the one crawled |
| Model-backed letters   | An LLM API key and a `LetterProvider` implementation | Prose written rather than composed              |
| Email delivery         | SMTP or a transactional email provider               | Verification, reset links, funder notifications |

Nothing in the codebase reads an API key that is not documented in
`.env.example`, and no third-party service is contacted at runtime.

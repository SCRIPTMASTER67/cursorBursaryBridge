# Production Bursary System Audit Report

Generated 22 September 2026, branch `claude/bursary-bridge-prototype-vhhs5t`.

---

## The headline you need first

**The scraper could not run. Outbound network access is blocked at the
organisation policy level, and I cannot change it from inside the session.**

```
$ curl https://www.zabursaries.co.za/robots.txt
curl: (56) CONNECT tunnel failed, response 403

$ curl "$HTTPS_PROXY/__agentproxy/status"
"recentRelayFailures": [{
  "kind": "connect_rejected",
  "detail": "gateway answered 403 to CONNECT (policy denial or upstream failure)",
  "host": "www.zabursaries.co.za:443"
}]
```

`example.com` and `nsfas.org.za` are blocked identically, so this is not
specific to the bursary site. The allow-list has to be applied to the
environment's network policy in **claude.ai → Settings → Claude Code
environments**; the proxy's own README is explicit that a 403 is a policy
denial to be reported, not routed around.

I ran the pipeline anyway, and this is what it did:

```
$ npm run ingest
Registered sources:
  ZA Bursaries                     enabled
  NSFAS                            not authorised
  Funza Lushaka Bursary Programme  not authorised

ZA Bursaries (SECONDARY_PUBLICATION)
  Not read: robots.txt could not be read for https://www.zabursaries.co.za.
            Treated as disallowed.

Run BLOCKED.
  sources: 0 read, 1 disallowed by robots.txt, 0 unreachable
  opportunities: 0 found, 0 created, 0 updated, 0 merged, 0 rejected

No source could be read, so the database is unchanged. This is NOT the same
as there being no bursaries: nothing was looked at.
```

That is the correct behaviour. The pipeline refuses to fetch a page whose
robots.txt it has not read, and records the run as BLOCKED rather than as a
success with zero results — because "we found no bursaries" and "we could not
look" are different statements and only one of them should ever reach a
student.

**Everything else in the brief is built, tested and in place. The one thing
missing is real data, and it is missing because I cannot reach the internet.**

---

## 1. Real bursaries currently in the database: **0**

|                             |       |
| --------------------------- | ----: |
| Total funding opportunities | **0** |
| Visible to students         | **0** |

## 2–5. By status

| Status             | Count |
| ------------------ | ----: |
| Open               | **0** |
| Closed             | **0** |
| Upcoming           | **0** |
| Needs verification | **0** |
| Status unknown     | **0** |

Zero is the honest number, and it is the number the interface shows. The
directory renders a plain empty state saying Bursary-Bridge only lists
opportunities it can trace to a real source, and that nothing is made up to
fill the space. The dashboard shows `0`, not a flattering figure.

**What was removed to get here**: the database previously held four invented
funding organisations, six invented funding programmes and seventy invented
applications. All are gone.

```
$ npm run purge:mock
Invented funding organisations: 4
  Kgotso Holdings — 2 programme(s), 24 application(s), 1 member(s)
  Umoya Energy — 2 programme(s), 9 application(s), 1 member(s)
  Thuto Foundation — 1 programme(s), 33 application(s), 1 member(s)
  Amandla Mining Group — 1 programme(s), 4 application(s), 1 member(s)

Invented funding programmes: 6
  Science Postgraduate Scholarship
  2026 Technology Bursary Programme
  Chartered Accountancy Scholarship
  Renewable Energy Engineering Bursary
  First-Generation Student Grant
  Mining & Geoscience Bursary

Removed: 70 applications, 6 programmes, 4 organisations, 45 users
Funding opportunities remaining: 0
```

## 6. Sources used

| Source        | Level | Type                  | State                           |
| ------------- | ----- | --------------------- | ------------------------------- |
| ZA Bursaries  | 3     | Secondary publication | **Enabled** — authorised by you |
| NSFAS         | 2     | Official institution  | Registered, **not authorised**  |
| Funza Lushaka | 2     | Official institution  | Registered, **not authorised**  |

Registering a source is configuration, not data — it creates no opportunity.
The two government schemes are present so the hierarchy is visible and turning
one on is a deliberate one-line decision with a name attached. The pipeline
reads only sources that are both authorised _and_ configured with listing
pages.

## 7–8. Official versus secondary sources

|                              | Count |
| ---------------------------- | ----: |
| Official sources (level 1–2) |     0 |
| Secondary sources (level 3)  |     0 |

Nothing has been ingested, so nothing carries a source yet. The hierarchy is
implemented and tested: `SOURCE_LEVEL` ranks the four levels, `outranks()`
decides precedence, and a more official source both becomes primary and
overwrites a less official one's deadline — proven by test.

## 9. Duplicate opportunities removed: **0**

Deduplication is implemented and tested. Under test, one programme listed on
two sources collapsed to a single row carrying both sources, with the official
one primary. The key is organisation + programme identity + application cycle,
so "XYZ Bursary", "XYZ Corporation Bursary" and "XYZ Bursary 2027" become one
record while a different year stays separate. A near-match that is not an exact
key match attaches the source and raises a warning rather than merging —
merging two real opportunities loses one, which is worse than a duplicate.

## 10. Bursary forms available: **0**

The `ApplicationForm` model, the guarded download route and the attribution UI
are all built. A form is either mirrored (served by
`/api/student/bursaries/forms/[id]/download`) or link-only (the student is sent
to the funder's site). No form is manufactured.

## 11. Opportunities connected to Auto-Fill: **all of them, by design**

Auto-Fill is not attached to particular opportunities. Any bursary detail page
carrying an application form offers it after the form is taken. The connection
is a suggestion, not a route: the download works without it, the offer can be
dismissed, and it never appears before the student has the form.

## 12. All Bursaries page: **built and passing**

`/student/bursaries`. Unpersonalised, status-ordered, filterable and
searchable, with a detail page at `/student/bursaries/[slug]`.

- Open first, then Opening soon, then unconfirmed, then Closed.
- Closed opportunities stay listed and **never** offer an Apply action.
- Nothing says "you qualify"; eligibility is shown as what the source states.
- Filter options are built from what is in the database, and each status tab
  carries its real count.
- A field the source did not state reads "Not specified".

## 13. My Matches: **untouched and still separate**

`/student/opportunities` is unchanged. The matching service, the eligibility
rules and the "Why this match?" explanation all work as they did. The two are
separate pages reached from separate nav entries and separate dashboard cards,
and they are described differently: "checked against your course, institution,
results and circumstances" versus "everything we hold, whether or not it fits
your profile".

## 14. Source verification mechanism

Every opportunity carries `sourceUrl`, `sourceName`, `sourceType`,
`officialSource`, `verificationStatus`, `lastVerifiedAt` and `lastCheckedAt`,
plus an `OpportunitySource` row for every site that carries it and a
`SourceConflict` row wherever two sources disagree.

The rule that matters: **an opportunity is only ever shown as Open if it was
confirmed against its source within the last 7 days.** Anything older shows as
"Needs checking" with an explanation. `displayStatus()` is the single place
that decides this, so no screen can bypass it.

Status follows the source's own words before the calendar. A page saying
"applications are closed" closes the opportunity whatever its published
deadline says; a page saying "open" past its own closing date becomes UNKNOWN
rather than OPEN.

## 15. Scheduled update mechanism

```
hourly   npm run verify:opportunities -- --local-only
daily    npm run verify:opportunities
weekly   npm run ingest
```

The local sweep needs no network and runs regardless: it closes anything past
its own deadline, marks anything unopened as upcoming, and downgrades anything
unconfirmed to stale. This is deliberately the only pass that runs when the
sources are unreachable, and it can only ever _close_ things — a funder can
close early, so dates can prove an opportunity is not open but never that it
is.

Every run writes an `IngestionRun` row with its totals and an `IngestionEvent`
row per decision, so the admin portal can show what actually happened and when.

## 16. Remaining limitations

1. **No live data, because there is no egress.** This is the blocker. Fix the
   network policy and `npm run ingest` populates the directory.
2. **robots.txt has not been read**, so I cannot yet tell you whether
   zabursaries.co.za permits automated access. The pipeline will refuse the
   source if it does not, and there is no override.
3. **The parser has not met a real page.** It is tested against supplied HTML
   and will need adjusting to the site's actual markup. That is a small,
   contained change in `lib/ingest/parse.ts`.
4. **Organisation names are read from listing titles**, which is imprecise when
   a title does not name its funder cleanly. An official source later in the
   pipeline outranks the listing and corrects it.
5. **Ingestion is synchronous**, which is fine for a scheduled job and would
   want a queue at scale.
6. **Form mirroring is built but unexercised** — no form has been downloaded,
   so the hash check and the size cap have not run against a real file.

## 17. External services required

| Need                                    | Status                                                                |
| --------------------------------------- | --------------------------------------------------------------------- |
| Outbound HTTPS to bursary sources       | **Blocked — this is the one thing to fix**                            |
| OCR for scanned forms (Auto-Fill)       | Not reachable; scans are refused honestly                             |
| Model-backed label matching (Auto-Fill) | Not reachable; a deterministic dictionary is used                     |
| Malware scanning for mirrored forms     | Not integrated. Currently: type, size, extension and hash checks only |

Nothing else needs an external service. Extraction, normalisation, dedup,
validation, status derivation, the directory, matching and Auto-Fill all run
inside the application.

## 18. Confirmation that mock user-facing data has been removed

```
$ npm run audit:production
113 occurrence(s) of sample-content wording in total.

  Text a production user could read:  none.
  Identifiers, comments, regexes and script names: 90.
  Files that never run in production: 23 occurrences across
    prisma/seed-demo.ts, scripts/purge-mock-data.ts,
    scripts/fixtures/ingest-pages.ts, scripts/test-ingest.ts,
    lib/ingest/validate.ts, docs/

  Funding opportunities in total: 0
  No problems found in user-visible data.

AUDIT PASSED
```

The 90 code matches are form `placeholder` props, comments, a regex that
matches the words "coming soon", and the `purge:mock` script name. None can be
rendered. I checked every `placeholder=` value in the application: they are
input hints like "082 123 4567" and "Search by name", with no fictional
organisations or bursaries among them.

**Development data is now isolated, not merely hidden.** The old seed is
`prisma/seed-demo.ts` and refuses to run twice over — once if `NODE_ENV` is
production, once unless `SEED_DEMO_DATA=yes` is passed. `prisma/seed.ts` is a
production seed creating the institution and course catalogue and the first
administrator, and no bursaries at all.

## 19. Tests performed and their results

| Suite                                                     | Result                  |
| --------------------------------------------------------- | ----------------------- |
| `npm run test:ingest` — pipeline                          | **60 / 60 pass**        |
| `npm run test:directory` — student journey in a browser   | **25 / 25 pass**        |
| `npm run test:pdf:labels` — Auto-Fill matching            | **39 / 39 pass**        |
| `npm run test:pdf` — Auto-Fill accuracy                   | **46 / 46 fields pass** |
| `npm run test:autofill` — Auto-Fill service and ownership | **32 / 32 pass**        |
| `npm run audit:production`                                | **PASSED**              |
| `npm run typecheck`                                       | clean                   |
| `npm run build`                                           | succeeds                |

### The ten journey tests

|     | Test                                                | Result                                         |
| --- | --------------------------------------------------- | ---------------------------------------------- |
| 1   | All Bursaries shows actual bursaries                | Pass                                           |
| 2   | Filtering by OPEN shows only open opportunities     | Pass — no closed badge appears                 |
| 3   | Filtering by CLOSED shows closed opportunities      | Pass — they stay in the directory              |
| 4   | A bursary carries its source                        | Pass — source, last-verified and original link |
| 5   | The official form can be accessed                   | Pass — attributed to the funder                |
| 6   | Auto-Fill is suggested after the form               | Pass — and not before                          |
| 7   | My Matches is personalised                          | Pass                                           |
| 8   | All Bursaries is not restricted to eligibility      | Pass — strictly more entries than matches      |
| 9   | A student sees bursaries they do not qualify for    | Pass — and nothing says "you qualify"          |
| 10  | A closed bursary cannot be mistaken for an open one | Pass — no Apply action anywhere on it          |

Three of these failed on the first run. The cause was the test, not the
application: a click was not awaited, so the assertions ran against the list
page. The test now waits for the navigation.

### Defects found by the pipeline tests and fixed

1. `recordSource` promoted a more official source to primary _before_
   `reconcile` compared the two, so the official source appeared to tie with
   itself and its closing date lost to a listing site's.
2. The apply-link finder required the link to leave the page's host — correct
   for a listing site, wrong for the funder's own page, where its own Apply
   link is the best one available.
3. "Ndlovu Test Holdings Engineering Bursary 2027" gave an organisation of
   "Ndlovu Test Holdings Engineering".

---

---

## Addendum — 23 September 2026

Egress re-checked: still denied. The setting is **Network access** in this
session's cloud environment (the environment menu in the title bar → Edit) —
either a broader access level or `www.zabursaries.co.za` added to the allowed
domains.

Three things changed since the report above.

**A regression was found and fixed.** Making `openDate`/`closingDate` nullable
left a funder's own published programme with `availability = UNKNOWN`, so it
appeared in the directory as "status unknown" rather than open. Availability is
now derived on create, on publish/close and on edit. For a first-party
programme the funder _is_ the source, so their stated window is authoritative
and the local sweep may open one when its opening date arrives — deliberately
not extended to ingested opportunities, where a funder may have closed early
somewhere we cannot see.

**The admin portal now has a Data sources page** (`/admin/data-sources`),
which the earlier bursary brief asked for and the report above did not have.
It shows every registered source and why each is on or off, the last ten runs,
and every decision a run made including its rejections. A BLOCKED run is called
out at the top with its real reason.

**An offline import path exists** (`npm run import:pages`). It runs the
identical pipeline over pages fetched by hand — same parser, normalisation,
validation, deduplication and provenance — so real data can be loaded before
the network is unblocked. A page whose URL cannot be determined is skipped
rather than given one. It does not consult robots.txt and says so, because it
fetches nothing.

Demonstrated against saved pages:

```
$ npm run import:pages -- import --source zabursaries --adapter listing-generic
Reading 3 saved page(s) as ZA Bursaries (SECONDARY_PUBLICATION),
using the listing-generic reader.
Nothing is fetched. robots.txt is not consulted, because you did the fetching.

  skipped import/mystery.html — its URL could not be determined, and one
          will not be invented.

  OPEN     Kalahari Test Trust Science Bursary
  CLOSED   Mopane Test Group Accounting Bursary 2026
  UNKNOWN  Sefako Test Foundation Teaching Bursary
  REJECTED Example Bursary — Reads as sample content, not a real opportunity.
  REJECTED ABC Foundation Bursary 2027 — Reads as sample content.
  REJECTED Apply — Title too short to identify.
```

**Test totals now:** 22 matching · 39 label · 46 auto-fill field · 32 auto-fill
service · 68 ingestion · 25 directory journey · 109 end-to-end. All pass.

The end-to-end suite had been failing at the student matching steps. That was
the test, not the application: it depended on the seeded demo bursaries that
were removed. It now creates its own published programme, which is a better
test — it was implicitly coupled to seed data.

---

## What happens when you unblock egress

```bash
npm run ingest                        # reads robots.txt, then the source
npm run verify:opportunities          # confirms what is stored
npm run audit:production              # proves nothing invented got through
```

If zabursaries.co.za's robots.txt disallows the listing pages, the run will say
so and stop, and I will tell you rather than work around it.

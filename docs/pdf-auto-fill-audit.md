# PDF Auto-Filling — final audit

Branch `claude/bursary-bridge-prototype-vhhs5t`. Three commits:
the engine and its test harness, the workflow (schema, service, API), and the
student-facing screens.

---

## 1. What was added

A student uploads one bursary form they have already completed, plus any number
of blank ones. The completed form is read into a canonical profile; each blank
form is then mapped against it field by field, filled, validated, and offered
for review. The student checks every field, edits anything they want, and
downloads real PDFs — one at a time or all of them as a ZIP.

The governing rule is enforced in code rather than stated in comments: a field
is populated only when the evidence supports it. Everything else is left blank
with a reason attached. Across the six test forms, **20 of 46 fields are
populated and 26 are deliberately left for the student** — that ratio is the
feature working, not failing.

## 2. Files and components created

**Engine** (`lib/pdf/`, pure — no Prisma, no React, no I/O):

| File           | Lines | Responsibility                                                  |
| -------------- | ----: | --------------------------------------------------------------- |
| `profile.ts`   |   147 | The canonical data model that decouples source from targets     |
| `aliases.ts`   |   326 | Label vocabulary, plus third-party markers                      |
| `match.ts`     |   172 | Label → canonical key, with confidence and a stated reason      |
| `extract.ts`   |   230 | AcroForm fields, falling back to positional text-layout reading |
| `normalise.ts` |   158 | Dates, phones, numbers, choices — refusing what it cannot read  |
| `map.ts`       |   232 | One of six outcomes per target field                            |
| `fill.ts`      |   240 | Writes into the original PDF                                    |
| `validate.ts`  |    96 | Re-checks every populated field before it is offered            |
| `source.ts`    |   141 | Reads the completed form; reports scans and locked PDFs plainly |
| `pipeline.ts`  |   200 | Composes the above per target, with per-form failure isolation  |
| `upload.ts`    |    37 | Upload checking by file header, not declared content type       |

**Workflow**: `services/auto-fill.ts` (623 lines) and seven API routes.

**Screens**: `components/student/auto-fill/{start,review,status}.tsx` and three
pages under `app/student/auto-fill/`.

**Tests**: `scripts/fixtures/bursary-forms.ts` (581 lines of fixtures),
`scripts/test-pdf-autofill.ts`, `scripts/test-auto-fill-service.ts`,
`scripts/test-matching-labels.ts`.

**Supporting**: `scripts/copy-pdf-worker.mjs`, a `serverExternalPackages` entry
in `next.config.ts`, and a nav entry in the student sidebar.

## 3. Database changes

Two additive migrations. **No existing table was altered.**

`20260922203620_add_auto_fill_jobs` — four enums (`AutoFillJobStatus`,
`AutoFillFormStatus`, `AutoFillFieldStatus`, `AutoFillConfidence`) and five
tables:

- `AutoFillJob` — the run, its source upload, and why it failed if it did
- `AutoFillExtractedValue` — each value read from the completed form, with
  provenance (page, field label, and whether it came from a real form field)
- `AutoFillTargetForm` — each blank form, its own status, and its counts
- `AutoFillField` — every field on every target: outcome, value, reason,
  provenance, and the widget rectangle used to highlight it
- `AutoFillFieldEdit` — an append-only record of every change the student makes

`20260922205835_add_fields_to_confirm_count` — one column,
`AutoFillTargetForm.fieldsToConfirm`, added after the UI review (see §13).

**Filled PDFs are not stored.** Each download is produced from the original
upload and the values as they currently stand, so an edited value and the file
sent to a funder can never disagree.

## 4. PDF processing approach

`pdf-lib` reads and writes AcroForm structures; `pdfjs-dist` recovers text and
its positions. The target PDF is **loaded and re-saved, never rebuilt**, so
page size, layout, logos, tables, headers and footers survive exactly as the
funder designed them — only field values are added. Native form fields are used
where the PDF has them; a flat PDF is overlaid, with text sized and wrapped to
stay inside its box. Fields stay interactive, so the student can still edit the
PDF afterwards in any reader.

Encrypted PDFs are refused, not circumvented: the student is asked for an
unlocked copy.

## 5. Extraction approach

Two routes, trusted differently:

- **AcroForm** — the field name is humanised into a label, the value read
  directly, the page resolved from the widget's `P()` entry. Exact, so `HIGH`.
- **Text layout** — a label is a run of text ending in a colon; the answer area
  is inferred as the space to its right. A heuristic, so `MEDIUM`.

A document with neither (`likelyScanned`) is **not read at all**. It is
reported as a scan with a request for a digital copy, because guessing at a
photograph is exactly the failure this feature must not have.

One derivation is applied: a first name plus a surname yields a full name. The
reverse is deliberately not done — splitting "Nomvula Precious Mthembu" back
into parts means deciding which word is the surname, which is a guess.

## 6. Field-mapping approach

A deterministic dictionary of 30 canonical keys with `exact` phrases, weaker
`tokens`, and `negative` guards, behind a `MatcherProvider` interface.

Matching runs in stages: third-party guard → exact phrase (`HIGH`) →
whole-word containment (`HIGH` if the whole label, `MEDIUM` otherwise, longest
phrase wins, ambiguous ties refuse) → token overlap (`LOW`) → no match. A
leading "Applicant" or "Student" is stripped only as a second attempt, so
"Applicant Full Name" matches exactly while "Student Number" keeps its meaning.

Labels naming a parent, guardian, next of kin, referee, employer, spouse, bank
or witness **never** map to the applicant, however closely the rest reads.

## 7. Validation approach

Validation runs **before** the page is written, not after. A value the checks
reject must never reach the PDF — a downloaded page that disagrees with the
review panel is the same wrong-value failure in a different place.

Each populated field must trace back to a real source value, be non-empty after
formatting, and — for a choice field — be an option that exists on _that_ form.
Anything failing is downgraded to `MISSING` or `NEEDS_REVIEW` with an issue
recorded. A second pass afterwards applies what the writer reported: a value
that could not be placed legibly is cleared, and a value that was written but
will display badly is kept and flagged.

## 8. Confidence system

Three levels, and the **weakest link governs**: label-match confidence, value-
read confidence, and placement confidence are combined by taking the lowest.

- `HIGH` → written and marked **Filled in**
- `MEDIUM` → written and marked **Check this**
- `LOW` → **never written**, however certain the value itself is

Six outcomes are possible per field: `FILLED`, `NEEDS_REVIEW`, `MISSING`,
`AMBIGUOUS`, `SIGNATURE`, `MANUAL`. The last two are never automated —
signatures are the student's, and a request for a certified copy is a document
no form field can supply.

## 9. Manual editing system

The student has the last word on every field. Editing accepts what they type as
written, clearing a field is valid, and a choice field accepts only options that
form actually offers. Every change writes an `AutoFillFieldEdit` row with the
previous and new value; the field is marked as theirs and its confidence
cleared. Saving rebuilds the preview from the saved values.

The audit row records _whether_ a value existed before and after, not the value
itself — an audit log is not a place to copy someone's ID number to.

## 10. Download system

Real PDFs, never JSON or screenshots. `GET /api/student/auto-fill/forms/[id]/download`
returns one form as `application/pdf`; `GET /api/student/auto-fill/[id]/download-all`
returns a ZIP of every completed form. Both are generated at request time from
the original upload and the current values. Forms that failed are left out of
the archive rather than shipped empty.

## 11. Security and privacy

- Every service function is scoped by the student profile that owns the job.
  There is no unscoped read: another student's id is indistinguishable from one
  that does not exist — including on download, where a leak would be a leak of
  someone's ID number. Proven by test, not assumed.
- Uploads live outside `public/` and are reachable only through guarded route
  handlers, reusing the existing storage abstraction.
- All routes sit behind `apiStudent()`; the pages behind
  `requireOnboardedStudent()`.
- Uploads are validated by reading the file header, not by trusting the
  declared content type; 5 MB cap; 15 forms per job; rate limits on creating,
  uploading and processing.
- Downloads are sent `Cache-Control: private, no-store`.
- Password-protected PDFs are refused, never opened by force.
- Third-party details read from the source (guardian name, guardian ID,
  referee number) are recorded as unmapped and are proven never to reach any
  target form.

## 12. Test results

| Suite                                           | Result                                                                           |
| ----------------------------------------------- | -------------------------------------------------------------------------------- |
| `npm run test:pdf:labels` — label matching      | **39 / 39 pass**                                                                 |
| `npm run test:pdf` — accuracy harness           | **46 / 46 fields pass**, 0 review, 0 fail                                        |
| `npm run test:autofill` — service and ownership | **32 / 32 pass**                                                                 |
| `npm run typecheck`                             | clean                                                                            |
| `npm run build`                                 | succeeds                                                                         |
| Browser run against the fixtures                | 4 forms uploaded → processed → reviewed → edited → downloaded, no console errors |

The harness compares every field against what a person reading the source would
have written, reads the saved PDFs back to confirm the values are really in
them, and fails the run **only** when something wrong was written. A blank is a
gap; a wrong value on a bursary application is a defect.

The fixtures are six target forms in six vocabularies, across one to three
pages, covering text, checkbox, radio, dropdown and signature fields, a flat
form with no fields at all, a box too small for the answer, document requests,
vague labels, third-party sections, and questions the source never answered.

**Eight defects were found by these tests and fixed** rather than accommodated:

1. `First Names` matched `fullName` and wrote the surname into a first-name box.
   The bare aliases `name` and `names` were too weak to carry a match.
2. A leading "Applicant" weakened otherwise exact matches.
3. Target fields located by reading the printed layout were reported as
   certain; they are now capped at needs-review.
4. A long answer in a small field was silently cramped to nothing legible.
5. Validation ran after the write, so a rejected value could still reach the PDF.
6. `pdfjs-dist` resolved its worker through an import the server bundler
   rewrote to a path that does not exist — every upload failed.
7. The same package path could not be resolved for the browser worker either.
8. PDF analysis failures were swallowed entirely, leaving no diagnosable cause.

A PDF was not treated as complete because the library returned a file: the
rendered pages were inspected visually, confirming the third-party fields are
blank and that the cramped motivation really is illegible.

## 13. Known limitations

1. **No OCR.** A scanned or photographed form cannot be read. It is reported
   honestly rather than guessed at.
2. **Matching is a dictionary, not a language model.** It is inspectable and
   cannot hallucinate a mapping, but its vocabulary is finite: a phrasing it has
   not seen becomes `AMBIGUOUS` and falls to the student. `MatcherProvider` is
   the seam where a model-backed matcher would go. See §15.
3. **Text-layout reading is positional.** It assumes a label ends in a colon
   with its answer to the right. Multi-column and table layouts will be read
   poorly, which is why such fields are never marked certain.
4. **"Postal Address" maps to the one address the source holds**, which may be
   a residential address. It is populated but flagged for confirmation.
5. **Overlay text sits slightly high on a ruled line** on flat forms. Legible
   and on the line, but not typeset.
6. **Processing is synchronous.** A job of fifteen large forms holds the request
   open. A queue would be the next step.
7. **Counts needed correcting once.** The first build reported "0 of 7 filled
   in" for a form visibly carrying six answers, because fields awaiting
   confirmation were counted only as outstanding. `fieldsToConfirm` now
   separates "has an answer" from "is settled".
8. **A pre-existing `/favicon.ico` 404** appears in the console on every page of
   the app. Out of scope here and left alone.

## 14. Screens and routes

**Pages**

| Route                                    | Purpose                                                    |
| ---------------------------------------- | ---------------------------------------------------------- |
| `/student/auto-fill`                     | Upload the completed form and the blank ones; earlier runs |
| `/student/auto-fill/[id]`                | Results: per-form counts, what was read, downloads         |
| `/student/auto-fill/[id]/forms/[formId]` | Review: PDF preview, highlighting, editing                 |

Plus an "Auto-Fill Forms" entry in the student sidebar.

**API**

| Method | Route                                            |
| ------ | ------------------------------------------------ |
| POST   | `/api/student/auto-fill`                         |
| GET    | `/api/student/auto-fill`                         |
| GET    | `/api/student/auto-fill/[id]`                    |
| POST   | `/api/student/auto-fill/[id]/targets`            |
| POST   | `/api/student/auto-fill/[id]/process`            |
| PATCH  | `/api/student/auto-fill/fields/[fieldId]`        |
| GET    | `/api/student/auto-fill/forms/[formId]/download` |
| GET    | `/api/student/auto-fill/[id]/download-all`       |

The screens use the existing visual system — the purple brand ramp
(`brand.600 = #5B2EDB`), the `#12132B` sidebar, and the same `Card`, `Button`,
`Badge` and `ProgressBar` components. No second look was introduced. Note that
the brief's suggested palette (cream, deep teal, terracotta) is not the
codebase's; the brief's own instruction to use the current Bursary-Bridge
identity was followed.

## 15. Features still requiring external services

1. **OCR for scanned forms.** Nothing in this environment can read a scan.
   Reaching a hosted OCR service would need network egress, which is blocked.
2. **Model-backed label matching.** The `MatcherProvider` interface exists for
   it, and a model would handle phrasings the dictionary cannot. It needs an
   API the environment cannot currently reach. The dictionary was written
   because the alternative was to _claim_ AI matching without having it, and the
   brief was explicit: do not fake the AI.
3. **A job queue** for large batches. Nothing external is strictly required —
   this is a design step, not a dependency.

Everything else — extraction, matching, normalisation, filling, validation,
review, editing, downloads — runs entirely inside the application with no
external service.

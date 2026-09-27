# Bursary-Bridge — 5-Minute Presentation Script

**Group 25** · Supervisor: Ms Zulu
CPP Mchunu · A Nsibande · KN Bikile · SP Tshazi

Measured length: **761 words**. 4:55 at a brisk 155 wpm, 5:15 at a normal 145 wpm.
Sentences in `[square brackets]` are safe to drop live if you are running long —
dropping all six brings it to 691 words, about 4:46.

---

## 1. Presentation Strategy

The rubric decides the shape. Of the 100 marks, **System Functionality is 30** and sits
under "Demonstration of the system" — the examiner wants to *see* it run, not hear it
described. A further **20** are for Documentation, which your four submitted documents
already carry. That leaves **50 marks riding on these five spoken minutes**: Introduction
and Background (10), Problem Statement and Goal/Objectives (10), Methodology (10),
Project Value (10), and Presentation and Discussion (10).

So the script does two things deliberately. It spends its time on the five criteria the
talking is actually marked against, and it hands the system walkthrough to KN Bikile in
words that work whether you are clicking through the live system or narrating slides —
same script either way.

Each member speaks to the part they built, because "Presentation and Discussion" rewards
students who "display deep knowledge and expertise, effectively addressing all
questions". You cannot fake that on someone else's module.

One deliberate departure from a strict section split: the **matching mechanism** is
explained by A Nsibande, who built it, rather than by the person doing the system
walkthrough. Nsibande explains *how the score is computed*; Bikile shows *what the user
sees*. Same feature, two levels, no repetition — and each is answerable by the person
who says it.

---

## 2. Complete 5-Minute Script

### SPEAKER 1: CPP MCHUNU
*Slides: Title → Background → Problem Statement*

> Good morning. We are Group 25. Our project is Bursary-Bridge: it matches South African
> students to bursaries they qualify for, and helps funders administer the applications.
> I am CPP Mchunu.
>
> In 2023 South Africa had over 1.35 million students in higher education. For most, the
> deciding question is financial, not academic. NSFAS answers it for one group,
> means-tested at R350 000 household income, under one published set of rules.
>
> Everything outside it is the problem. Corporations, foundations and universities each
> fund bursaries with their own criteria, closing dates and forms. [There is no register
> and no shared application process.]
>
> We measured that. We crawled the thirteen category pages of South Africa's largest
> bursary aggregator. Only 189 listings gave us a named funder, a closing date and a
> source page. [We refused the rest rather than guess.]
>
> So students read prose to judge their own eligibility, then retype the same details
> onto every form. Funders get those forms back as email attachments and screen them by
> hand.
>
> Nsibande will explain what we built.

**172 words · ~1:11**

---

### SPEAKER 2: A NSIBANDE
*Slides: Goal & Objectives → Methodology → Matching*

> Thank you. I am A Nsibande. I built the data model, the matching and eligibility
> modules, and the ingestion pipeline.
>
> Our goal: match students to funding they are eligible for, explain every match, and
> give organisations one structured platform to publish programmes and administer
> applications.
>
> We set ten measurable objectives. Three shaped the rest: hold eligibility as typed,
> machine-evaluable criteria rather than prose; design a weighted matching algorithm that
> reports its own reasoning; and build both sides of the system.
>
> We chose Scrum because the criteria funders use were not known upfront. [We learned
> them from what funders publish, so the data model kept changing; Waterfall would have
> fixed it too early.] Each sprint produced a working increment, which our supervisor
> reviewed as product owner.
>
> Matching: a profile is scored against a programme across weighted criteria, covering
> field of study, institution, academic performance, subject requirements and household
> circumstances. A criterion that is met contributes its full weight. One we cannot
> evaluate contributes partial weight and is reported as needing verification, never
> silently failed.
>
> Eligibility is evaluated separately, returning eligible, not eligible, or pending
> verification. So a high score never implies a qualification the student does not hold.
>
> Bikile will show you the system.

**203 words · ~1:24**

---

### SPEAKER 3: KN BIKILE
*Slides / live system: Student flow → Funder flow → Bulk intake*

> Thank you. I am KN Bikile, and I built the organisation-facing portal.
>
> Start with the student. They complete one profile: identity, academic record, subject
> results, preferences and household circumstances. From that, the system returns a
> ranked list of matched opportunities, each carrying the reasons behind its score, so
> the student sees which criterion was met, which could not be evaluated, and what would
> improve the match. [They can browse every opportunity we hold, each showing its source
> page.] When they apply, that profile fills the application, documents are attached
> once, and every application is tracked in one place.
>
> Now the funder's side. An organisation publishes a programme with its eligibility
> criteria entered as structured fields, not prose. Applications then arrive as records,
> not attachments. The organisation reviews each applicant against its own criteria,
> shortlists and selects, and every step leaves an audit record.
>
> Funders also receive applications outside our system, so we built bulk intake. They
> upload the forms they were emailed, we extract the fields, and suspected duplicates are
> flagged for a person to decide, never merged automatically.
>
> Tshazi will cover the document processing behind that.

**187 words · ~1:17**

---

### SPEAKER 4: SP TSHAZI
*Slides: Document processing → Testing → Value → Close*

> Thank you. I am SP Tshazi. I built the document processing and led the testing.
>
> Most bursary forms are PDFs. We read the form, normalise its field labels, match them
> against a canonical set of profile fields, and record a confidence level for each
> value. Where confidence is too low the field is left empty and flagged, [because a
> wrong answer on a funding application is worse than a blank one.]
>
> We test at unit, integration and end-to-end level against the real database, and
> measure extraction accuracy against prepared forms.
>
> The value: for students, search becomes matching, so effort goes to opportunities they
> are actually eligible for. [Details are entered once, not on every form.] And the
> reasons behind each score tell them what would improve it, which the current process
> never gives back. For funders, screening by hand in an inbox becomes structured,
> auditable review.
>
> Bursary-Bridge does not disburse funds, verify documents with their issuers, or hold
> every bursary in South Africa. What it does is hold funding criteria as data, hold a
> student's circumstances once, and use the two together to decide, explain and
> administer the fit between them.
>
> Thank you. We are happy to take questions.

**199 words · ~1:22**

---

## 3. Timing Breakdown

| Speaker | Section | Words | At 155 wpm | At 145 wpm |
|---|---|---:|---:|---:|
| CPP Mchunu | Introduction, Background, Problem | 172 | 1:07 | 1:11 |
| A Nsibande | Goal, Objectives, Methodology, Matching | 203 | 1:19 | 1:24 |
| KN Bikile | System Functionality (student + funder) | 187 | 1:12 | 1:17 |
| SP Tshazi | Document Processing, Testing, Value, Close | 199 | 1:17 | 1:22 |
| **Total** | | **761** | **4:55** | **5:15** |

Dropping all six bracketed passages: **691 words → 4:27 / 4:46**.

---

## 4. Rubric Coverage

| Rubric Criterion | Marks | Where it is covered |
|---|---:|---|
| Introduction and Background | /10 | Speaker 1 — enrolment context, NSFAS as the one structured door, the unstructured second source |
| Problem Statement | /5 | Speaker 1 — prose criteria, repeated data entry, manual screening, measured with the 189-listing crawl |
| Goal and Objectives | /5 | Speaker 2 — goal stated in one sentence, ten objectives with the three that shaped the build |
| Methodology | /10 | Speaker 2 — Scrum, why it was chosen over Waterfall, sprints, supervisor as product owner |
| Project Value | /10 | Speaker 4 — value to students and to funders, stated without overclaiming |
| System Functionality | /30 | **Speaker 3 + the live demonstration** — see the note below |
| Organization and Structure | /10 | The four submitted documents |
| Professionalism | /10 | The four submitted documents |
| Presentation and Discussion | /10 | All four speakers; each explains their own module, so each can answer on it |

### How the script targets the Excellent band

**Introduction (9–10 needs "relevance and significance … leaving no room for
ambiguity").** Speaker 1 does not open with a definition of a bursary. It opens with the
size of the affected population, names the one structured funding door, and then defines
the problem as everything outside it. Relevance is established in three sentences.

**Problem statement (9–10 needs "deep understanding").** The rubric rewards depth, and
depth here is the *measurement*: thirteen category pages crawled, 189 listings resolvable
to a funder, a closing date and a source, the rest refused. That is a specific, evidenced
claim about the field rather than "finding bursaries is difficult".

**Methodology (9–10 needs "rationale and suitability").** The script never explains what
Scrum is. It explains why *this* project could not use Waterfall: the criteria were not
knowable before design, so the data model had to keep moving. That is rationale, which is
what the band asks for.

**Project Value (9–10 reads "completely innovative, useful for the society").** The claim
made is the one the project document supports: eligibility held as data, circumstances
held once, and the two used together to decide, explain and administer the fit. The
explainability — telling a student *why* they scored what they scored — is the part the
current process never returns, and it is stated as a contribution rather than as a boast.

**System Functionality (23–30 needs "fully functional, all features working as
expected"). This is the largest single block on the rubric and it is not won by talking.**
Have the system running before you walk in, on a machine you control, signed in and with
the tabs you need already open. Do not demonstrate anything you have not clicked through
that morning.

**Presentation and Discussion (9–10 needs "deep knowledge … addressing all questions").**
Each speaker presents their own module, so every likely question has an owner in the room.

---

## 5. Likely Examiner Questions

**1. Why this problem?**
Because for most of 1.35 million students the barrier is financial, and outside NSFAS the
funding is published as scattered prose with no register and no shared application
process. We measured it: of the listings on the thirteen category pages we crawled, only
189 could be resolved to a funder, a closing date and a source page.
*They want:* that you can quantify the problem, not just assert it.

**2. What makes Bursary-Bridge different from what already exists?**
Aggregators solve discovery, but hold opportunities as articles rather than data and
handle no applications. University student information systems manage enrolled students,
not external funding. Commercial applicant tracking systems model employment, not
academic eligibility like minimum averages or subject requirements. We combine a
structured student profile, structured funding criteria, explainable matching and
application administration.
*They want:* a specific gap, and no unsupported attack on competitors.

**3. Why Scrum?**
Because we did not know what criteria funders use — that could only be established by
examining what they actually publish, so the data model had to change as we learned.
Waterfall assumes a complete requirements set before design and would have deferred the
discovery of a wrong assumption until integration. RAD is iterative too but favours rapid
prototyping over the quality practices a system handling personal and financial
information needs. Design Science Research governs how you evaluate an artefact, not how
four people organise a semester — we kept its rigour in our evaluation stage.
*They want:* a reason from the problem, not "Scrum is popular".

**4. Why weighted matching rather than a simple filter?**
A filter gives a yes or no and throws away everything in between. Criteria are not equally
decisive — field of study matters differently from province. Weights let us produce a
ranking, and because each criterion's contribution is known, the score can be explained
rather than just asserted.
*They want:* that the weights exist to enable ranking *and* explanation.

**5. What is the difference between the match score and eligibility?**
The score ranks how well a profile fits a programme. Eligibility is a separate verdict
against the criteria the funder published, and returns eligible, not eligible, or pending
verification. We keep them apart so a high score never implies a qualification the student
does not hold.
*They want:* that you did not conflate ranking with qualifying. This is the sharpest
technical point in the project — make sure Nsibande owns it.

**6. How do you protect student information?**
Passwords are hashed with bcrypt, never stored. Authorisation happens at the top of every
server-side entry point, and the guard returns the identifiers that scope every subsequent
database query — the organisation's id goes inside the query itself, so a request for
another organisation's applicant returns nothing rather than leaking a record. An
authorisation failure produces a missing record, not a visible one.
*They want:* that access control is enforced in the query, not by hiding a button.

**7. How does the ingestion pipeline work?**
It fetches listing pages from sources agreed with our supervisor, parses them, and maps
each opportunity onto the structured model. Before any source is crawled we check its
robots directives and terms of use, and we honour the crawl delay they request — our
principal source asks for thirty seconds between requests. Every imported opportunity
records the page it came from, and a listing we cannot resolve to a funder, a closing date
and a source is recorded as rejected with the reason rather than imported with assumed
values.
*They want:* that you crawled ethically and that nothing is invented.

**8. How does a funding organisation use the system?**
It registers, then publishes a funding programme with eligibility criteria entered as
structured fields. Applications arrive as records. It reviews each applicant against its
own criteria, shortlists, and selects, with an audit record at every step. For
applications it received by email instead, bulk intake extracts the fields, flags
suspected duplicates for a person to decide, and imports nothing until someone confirms.
*They want:* the whole funder path, publication through to selection.

**9. What are the project's limitations?**
We do not disburse funds — we record selection decisions. We do not verify a document with
its issuer; we record what was submitted and flag what needs checking. We do not integrate
with university or government systems, including NSFAS. There is no native mobile app; the
interface is responsive web. The motivational letter composer assembles text
deterministically from stated facts — no language model writes on a student's behalf. And
we do not claim coverage of every bursary in South Africa: only agreed sources are
ingested.
*They want:* that you know your boundaries and set them deliberately, for a four-month
semester project with a team of four.

**10. What happens when eligibility information cannot be evaluated?**
The criterion returns "pending verification" rather than a failure. In the score it
contributes a defined partial weight, and it is reported to the student as something
needing verification. We never treat a missing fact as a failed criterion, because that
would hide an opportunity the student might well qualify for.
*They want:* that the third state is deliberate, and that you know why silently failing
would be wrong.

---

## 6. Final Delivery Tips

**Rehearse against a clock, twice, out loud.** Reading it in your head is roughly 40%
faster than speaking it. If the full run goes past 5:00, drop the bracketed sentences —
they are chosen so that nothing the rubric marks is lost.

**Have the system already running.** Signed in, tabs open, on a machine you control.
Thirty marks sit on the system working; none sit on you launching it gracefully.

**Never demonstrate anything you have not clicked that morning.** If a screen is
uncertain, talk over a screenshot instead.

**Rehearse the four handovers separately.** They are where a group presentation visibly
falls apart. Each speaker's last line is written to hand over — say it, then stop, and
step back.

**Your own module is yours to answer.** In questions, the person who built it answers.
Agree that beforehand so nobody hesitates or talks over anyone.

**If you do not know, say what you do know.** "We did not implement that — it is out of
scope, and here is why we drew the line there" scores better than a guess. The rubric
rewards demonstrated knowledge, and knowing your boundaries is part of it.

**Do not read this script from a page.** Learn the shape of your section — the three or
four moves it makes — and speak it. The rubric marks communication as well as content, and
reading aloud costs you the engagement marks.

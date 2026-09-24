"""
The text of the Final Year Project Proposal.

Every factual claim here is either (a) read off the implemented system in this
repository, or (b) attributed to a source in REFERENCES that was retrieved and
checked. Nothing is asserted about the team's prior experience, about meetings
that were held, or about survey or interview results, because none of that is
recorded anywhere this document could draw on; where such a fact is needed the
text carries a bracketed placeholder instead.
"""

PROJECT_TITLE = ("Bursary-Bridge: A Web-Based Bursary Matching and Application "
                 "Management System for South African Students and Funding "
                 "Organisations")
SUPERVISOR = "Ms Zulu"
SUBMIT_DATE = "September 2026"

STUDENTS = [
    ("CPP Mchunu", "202242486"),
    ("A Nsibande", "240079346"),
    ("KN Bikile", "202356797"),
    ("SP Tshazi", "240103222"),
]

# ---------------------------------------------------------------------------
# 1. Introduction and Background
# ---------------------------------------------------------------------------
INTRODUCTION = [
    "Post-school education in South Africa is large, expanding and expensive. "
    "The Department of Higher Education and Training records a headcount "
    "enrolment of 1 071 715 students at public higher education institutions in "
    "2023, with a further 286 454 at private institutions, giving 1 358 169 "
    "students in the higher education sector in that year alone [1]. For most "
    "of these students the decisive question is not academic but financial: "
    "whether the tuition, accommodation, transport and materials for the coming "
    "year can be paid for. Where the answer is no, a qualified student does not "
    "register, or registers and then withdraws.",

    "The funding that answers that question comes from two very different "
    "places, and they are organised very differently. The first is the state. "
    "The National Student Financial Aid Scheme administers the Department of "
    "Higher Education and Training bursary scheme, which is means-tested: an "
    "applicant qualifies where combined annual household income is not more "
    "than R350 000, or not more than R600 000 where the applicant has a "
    "disability [2]. Students whose household income falls above the bursary "
    "threshold but below R600 000 a year, commonly described as the missing "
    "middle, are directed instead to a loan facility rather than to a bursary "
    "[2]. The scheme is a single, well-signposted door: one applicant, one "
    "application, one published set of rules.",

    "The second source is everything else. Corporations, foundations, "
    "state-owned enterprises, professional bodies, government departments and "
    "universities themselves fund education through bursaries, scholarships and "
    "grants that each carry their own criteria, their own closing dates and "
    "their own application form. There is no register of these opportunities "
    "and no shared application process. A student looking for them is searching "
    "a scattered and largely unstructured field, and it is this second source "
    "that this project addresses.",

    "The way that field is published today is worth describing precisely, "
    "because it determines what any system can do with it. Bursary information "
    "reaches students principally through three channels. Aggregator websites "
    "collect opportunities and publish them as editorial articles grouped by "
    "field of study; the largest South African example, which this project "
    "crawled with permission of its robots directives, organises its listings "
    "across thirteen such category pages [3]. Funder websites publish the same "
    "information again on a careers or corporate-social-investment page, "
    "usually as prose and often as a downloadable PDF. Institutional financial "
    "aid offices circulate what they have been sent, by notice board, email "
    "list or campus portal. In all three channels the unit of publication is a "
    "page of text written for a human reader. Closing dates appear inside "
    "sentences, eligibility rules appear as bullet points in varying wording, "
    "and the same opportunity is frequently republished in several places with "
    "different details.",

    "The consequences of that publishing model are visible on both sides of the "
    "transaction. For the student, discovery is a matter of searching rather "
    "than of being matched: the tools available return lists of opportunities "
    "that contain a keyword, not lists of opportunities the student is actually "
    "eligible for. Eligibility must then be established by reading each page in "
    "full, and because the rules are prose rather than data, the reading is "
    "easy to get wrong. Students consequently spend effort on applications they "
    "cannot win and miss ones they could. Each application that is attempted "
    "requires the same personal, academic and financial details to be written "
    "out again, most often onto a PDF form that is downloaded, printed or "
    "filled by hand, and returned by email.",

    "For the funding organisation the mirror image holds. Applications arrive "
    "as email attachments in whatever shape the applicant sent them, and are "
    "sifted by hand or transcribed into a spreadsheet before they can be "
    "compared. Screening an applicant against the organisation's own criteria "
    "is manual, so it is slow and inconsistent, and it does not scale: an "
    "organisation that advertises widely is punished for it with a larger pile "
    "of unstructured documents. Because the process leaves no structured record "
    "of why an applicant was set aside, the organisation cannot report on its "
    "own selection, and the unsuccessful applicant receives no explanation.",

    "Software already exists in adjacent parts of this problem. University "
    "student information systems manage registration and academic records but "
    "do not source external funding. Applicant tracking systems used in "
    "recruitment manage a pipeline of candidates but are built around "
    "employment, are licensed commercially, and do not model academic "
    "eligibility such as minimum averages, fields of study or subject "
    "requirements. Aggregator websites solve discovery in part but hold their "
    "content as articles rather than as data, and offer no application "
    "handling at all. What is absent is a system that holds funding "
    "opportunities as structured, machine-readable criteria, holds a student's "
    "circumstances once, and uses the two together to decide, explain and "
    "administer the fit between them.",

    "That absence affects identifiable people. It affects students, and most "
    "sharply those who are first in their family to study, who attend schools "
    "or live in areas where no one is on hand to explain where to look, and who "
    "have the least capacity to absorb the cost of an application that was "
    "never viable. It affects funding organisations, whose administrative "
    "burden limits how many applicants they can fairly consider and therefore "
    "how widely they can advertise. It affects institutional financial aid "
    "offices, which mediate between the two without a common record to work "
    "from.",

    "This project proposes Bursary-Bridge, a web-based system that addresses "
    "both sides of the gap. A student states their circumstances once. A "
    "funding organisation states its criteria once, as typed, structured data "
    "rather than as prose. The system then scores every opportunity against "
    "every student profile, ranks the results, and states for each criterion "
    "whether it was met, could not be evaluated, or was not met, so that a "
    "score is explained rather than merely asserted. Opportunities gathered "
    "from published sources are held in the same structured form alongside "
    "those entered by funders, each carrying the source it came from. On the "
    "organisation's side the system receives applications, scores and screens "
    "them against that organisation's own published criteria, and carries an "
    "applicant through review, shortlisting and selection with an audit record "
    "of each step.",

    "The contribution of the project is therefore threefold. It contributes a "
    "data model that expresses education-funding eligibility as evaluable "
    "criteria rather than prose, and a transparent weighted matching algorithm "
    "over that model which reports its own reasoning. It contributes a working "
    "system that reduces the repeated manual re-entry of the same information "
    "across many application forms. And it contributes, to the funding "
    "organisation, a structured and auditable alternative to screening "
    "applications by hand in an email inbox.",
]

# ---------------------------------------------------------------------------
# 2. Problem Statement
# ---------------------------------------------------------------------------
PROBLEM = [
    "South African students who need funding beyond the state scheme must "
    "currently discover, assess and apply for bursaries through a process that "
    "is entirely manual and largely unstructured. Opportunities are published "
    "as pages of prose on aggregator sites, funder websites and notice boards, "
    "with eligibility rules written as sentences and closing dates buried in "
    "them. A student must find each page, read it, judge their own eligibility "
    "from the wording, and then complete a separate application form, "
    "re-entering the same identity, academic and household details every time. "
    "Funding organisations receive the resulting applications as email "
    "attachments in inconsistent formats and screen them by hand.",

    "Evidence of how unstructured the published field is was obtained directly. "
    "An automated crawl of the thirteen category pages of the largest South "
    "African bursary aggregator, conducted for this project under the crawl "
    "delay its robots directives request, yielded 189 opportunities that could "
    "be resolved to a named funder, a closing date and a source page [3]. A "
    "substantial number of further listings were rejected by the same pipeline "
    "because those three facts could not be established from the published page "
    "without guessing at them. A student reading the same pages faces exactly "
    "that difficulty, without a pipeline to reject the ambiguous cases on their "
    "behalf.",

    "Three causes underlie this. First, eligibility criteria exist only as "
    "prose, so nothing can evaluate them and every assessment is a human "
    "reading. Second, there is no shared record of a student's circumstances, "
    "so each funder asks for the same facts again on a form of its own design. "
    "Third, there is no structured intake on the funder's side, so applications "
    "arrive as documents rather than as records and must be transcribed before "
    "they can be compared.",

    "The people affected are students seeking funding, the organisations that "
    "fund education, and the institutional financial aid offices that stand "
    "between them. The consequences differ by party. Students expend scarce "
    "time and money on applications for which they were never eligible, and "
    "miss opportunities they would have won, with the burden falling heaviest "
    "on first-generation and rural applicants who have no one to direct their "
    "search. Funders carry an administrative load that limits the number of "
    "applicants they can consider fairly, which in turn discourages them from "
    "advertising widely. Unsuccessful applicants are told nothing about why "
    "they were unsuccessful, so the same mistakes are repeated in the next "
    "cycle.",

    "The gap is specific. No available system holds education-funding "
    "eligibility as structured, evaluable data, holds a student's circumstances "
    "once, matches the two automatically with a stated reason for every "
    "criterion, and then carries the resulting application through to a "
    "funder's selection decision. A new solution is needed because the "
    "components that exist solve only fragments of this: aggregators solve "
    "discovery without data or application handling, university systems manage "
    "enrolled students rather than external funding, and commercial applicant "
    "tracking systems model employment rather than academic eligibility. "
    "Closing this gap requires structured criteria, a single student profile "
    "and an explainable matching mechanism to be designed together, which is "
    "what this project undertakes.",
]

# ---------------------------------------------------------------------------
# 3. Goal and Objectives
# ---------------------------------------------------------------------------
GOAL = ("The goal of this project is to design, develop and evaluate a "
        "web-based system that automatically matches South African students to "
        "the education-funding opportunities for which they are eligible, "
        "explains the reason behind every match, and provides funding "
        "organisations with a single structured platform through which to "
        "publish funding programmes and administer the applications they "
        "receive.")

OBJECTIVES_INTRO = [
    "The following objectives are the measurable steps through which the goal "
    "will be achieved. Each states a deliverable that can be inspected, and "
    "together they span the project lifecycle from investigation to "
    "documentation.",
]

# (verb-led objective, how completion is measured)
OBJECTIVES = [
    ("Investigate how education-funding opportunities are currently published, "
     "discovered and applied for in South Africa, and how funding organisations "
     "currently receive and screen applications.",
     "Completion is measured by a written review of the publishing channels and "
     "the existing systems adjacent to the problem, together with a crawl of a "
     "named published source that quantifies how much of the information is "
     "structured and how much is prose."),

    ("Analyse the findings of the investigation to derive the functional and "
     "non-functional requirements of the proposed system, and specify them in a "
     "Software Requirements Specification.",
     "Completion is measured by an approved Software Requirements Specification "
     "containing use cases for every actor, each with a numbered identifier "
     "that later design and test documents can cite."),

    ("Design a data model that expresses funding eligibility as typed, "
     "machine-evaluable criteria rather than as free text, and that holds a "
     "student's identity, academic and household circumstances once.",
     "Completion is measured by a documented schema in which every eligibility "
     "criterion is a typed column or related record, and by the absence of any "
     "free-text field that the matching mechanism must interpret."),

    ("Design a weighted matching algorithm that scores a student profile "
     "against a funding programme and returns, for each criterion, whether it "
     "was met, not met, or could not be evaluated.",
     "Completion is measured by a specified algorithm with stated weights, a "
     "defined treatment of criteria that cannot be evaluated, and a "
     "score-with-reasons output structure."),

    ("Develop the student-facing components of the system: profile capture, a "
     "ranked list of matched opportunities with the reasons behind each score, "
     "a browsable directory of all opportunities held, and an application "
     "workflow.",
     "Completion is measured by working screens for each of these, operating "
     "against the real database rather than against sample data."),

    ("Develop the organisation-facing components of the system: funding "
     "programme publication with structured criteria, receipt of applications, "
     "applicant review against the organisation's own criteria, shortlisting "
     "and selection.",
     "Completion is measured by working screens for each of these, with every "
     "query scoped so that one organisation cannot read another organisation's "
     "applicants."),

    ("Implement an ingestion pipeline that collects funding opportunities from "
     "named published sources, maps them onto the structured data model, and "
     "records the source of each.",
     "Completion is measured by a populated directory in which every "
     "opportunity carries the source page it was taken from, and by a rejection "
     "record for every listing the pipeline declined to import."),

    ("Test the system at unit, integration and end-to-end level, and validate "
     "the accuracy of the matching and document-extraction components against "
     "prepared test data.",
     "Completion is measured by an executable test suite, a documented Test "
     "Plan, and a recorded accuracy figure for the components that extract data "
     "from documents."),

    ("Evaluate the completed system against the requirements specified in "
     "objective two, and against the problem the project set out to address.",
     "Completion is measured by a traceability check from each specified "
     "requirement to the implementation that satisfies it, and by an audit "
     "confirming that no user-visible content is invented rather than sourced."),

    ("Document the project in the Software Requirements Specification, the "
     "Software Design Description, the Test Plan and the final project report.",
     "Completion is measured by the delivery of each document in the "
     "prescribed departmental template."),
]

# ---------------------------------------------------------------------------
# 4. Methodology
# ---------------------------------------------------------------------------
METHODOLOGY = [
    ("head", "Selected methodology"),
    ("p", "This project follows an Agile approach using the Scrum framework, as "
          "defined by Schwaber and Sutherland [4] and grounded in the "
          "principles of the Agile Manifesto [5]. Development proceeds in "
          "fixed-length sprints, each of which produces a working increment of "
          "the system; the requirements are held as a product backlog that is "
          "re-ordered at the start of each sprint; and the supervisor acts in "
          "the role of the product owner, reviewing each increment and "
          "directing what is built next."),
    ("p", "Scrum was selected in preference to the alternatives for reasons "
          "that follow from the problem rather than from convention. The "
          "eligibility criteria that funders use are not known in advance and "
          "can only be established by examining what is actually published; "
          "the data model therefore has to change as that examination "
          "proceeds. Waterfall assumes a requirements set that is complete "
          "before design begins, which this project does not have, and its "
          "sequential phases would defer the discovery of a wrong assumption "
          "until integration. Rapid Application Development shares Agile's "
          "iterative character but emphasises rapid prototyping over the "
          "sustained quality practices this system needs, given that it "
          "processes personal and financial information. Design Science "
          "Research, in the form set out by Peffers and colleagues [6], is a "
          "sound fit for the artefact-building character of the project and "
          "its phases are reflected in the evaluation stage described below, "
          "but as a research methodology it governs the demonstration and "
          "evaluation of an artefact rather than the day-to-day organisation "
          "of a four-person development team working to a fixed academic "
          "deadline. Scrum governs that, and the rigour Design Science "
          "Research asks for is retained in how the completed system is "
          "evaluated."),

    ("head", "Phases of the project"),
    ("p", "The work is organised into the seven phases below. The phases are "
          "sequential in emphasis rather than in execution: sprints cut across "
          "them, so that design, development and testing of one part of the "
          "system proceed while another part is still being investigated."),
    ("num", [
        "Investigation and background research. The publishing channels for "
        "funding opportunities are examined, the systems adjacent to the "
        "problem are reviewed, and a named published source is crawled to "
        "establish how much of the information exists as data and how much as "
        "prose.",
        "Requirements engineering. The findings are turned into functional and "
        "non-functional requirements and use cases, recorded in a Software "
        "Requirements Specification structured in accordance with "
        "ISO/IEC/IEEE 29148 [7].",
        "System analysis and design. The data model, the architecture, the "
        "matching algorithm and the user interface are designed and recorded "
        "in a Software Design Description structured in accordance with IEEE "
        "1016 [8].",
        "Implementation. The system is built in sprints, each ending in a "
        "working increment reviewed by the supervisor.",
        "Data ingestion. The pipeline that collects opportunities from "
        "published sources is built, run against a sample for review, and then "
        "run in full.",
        "Testing and validation. Unit, integration and end-to-end tests are "
        "written and executed, and the accuracy of the extraction components "
        "is measured against prepared test data.",
        "Evaluation and documentation. The completed system is evaluated "
        "against the specified requirements and the stated problem, and the "
        "project documentation is finalised.",
    ]),

    ("head", "Requirements gathering"),
    ("p", "Requirements are derived from documentary analysis rather than from "
          "survey or interview. The primary material is the published record "
          "itself: the eligibility conditions, closing dates and required "
          "supporting documents that funders state on their own pages, and the "
          "application forms they distribute. This material is authoritative, "
          "it is publicly available, and it is what any system in this space "
          "must in fact consume. The state scheme's published eligibility "
          "criteria [2] provide a documented reference point for the structure "
          "that means-tested criteria take. Requirements derived this way are "
          "recorded as use cases and reviewed with the supervisor at the "
          "sprint review that follows their capture."),

    ("head", "Design approach"),
    ("p", "The system is designed as a layered web application. Presentation is "
          "separated from a service layer that holds the read and write logic, "
          "which in turn is separated from the pure domain modules that carry "
          "the matching and eligibility rules. Authorisation is established at "
          "the top of every server-side entry point by a guard that returns "
          "the identifiers used to scope every subsequent database query, so "
          "that an authorisation failure results in a missing record rather "
          "than in a leaked one. The domain modules are kept free of database "
          "access so that the matching and eligibility logic can be tested "
          "directly."),

    ("head", "Techniques and algorithms"),
    ("p", "Four technical mechanisms carry most of the system's behaviour."),
    ("bul", [
        "Weighted criterion matching. A student profile is scored against a "
        "funding programme across a set of weighted criteria covering field of "
        "study, institution, academic performance, subject requirements, "
        "household circumstances and demographic conditions. A criterion that "
        "is met contributes its full weight; a criterion that cannot be "
        "evaluated, because the profile does not yet carry the fact it needs, "
        "contributes a defined partial weight and is reported as requiring "
        "verification rather than being silently treated as a failure. The "
        "contributions are summed and expressed as a percentage, and the "
        "per-criterion verdicts are returned with it so that the score can be "
        "explained.",
        "Rule-based eligibility evaluation. Eligibility is evaluated "
        "separately from the match score, against the typed criteria the "
        "funder published, and returns one of three verdicts: eligible, not "
        "eligible, or pending verification. Keeping eligibility separate from "
        "the score prevents a high score from implying a qualification the "
        "student does not hold.",
        "Structured extraction from documents. Application forms distributed "
        "as PDF documents are read, their field labels are normalised and "
        "matched against a canonical set of profile fields, and a confidence "
        "level is recorded for each value extracted. Where confidence is "
        "insufficient the field is left empty and flagged for the user rather "
        "than filled with a guess.",
        "Identity resolution and duplicate detection. Applications received "
        "outside the system are matched to existing records on verified "
        "identifiers, and suspected duplicates are flagged for a human "
        "decision rather than merged or deleted automatically.",
    ]),

    ("head", "Data collection"),
    ("p", "The system's own data is collected by an ingestion pipeline that "
          "fetches published listing pages from named sources, parses them, and "
          "maps each opportunity onto the structured model. Only sources "
          "explicitly agreed with the supervisor are fetched. Before any source "
          "is crawled its robots directives and terms of use are checked, and "
          "the crawl delay those directives request is observed; the principal "
          "source used in this project requests a delay of thirty seconds "
          "between requests, and the pipeline honours it [3]. Every imported "
          "opportunity records the page it was taken from. A listing that "
          "cannot be resolved to a funder, a closing date and a source page is "
          "recorded as rejected with the reason, and is not imported with "
          "assumed values."),

    ("head", "Development process"),
    ("p", "Work is tracked as a product backlog of user stories derived from "
          "the use cases. Each sprint begins with sprint planning, in which "
          "items are selected into a sprint backlog, and ends with a sprint "
          "review at which the increment is demonstrated to the supervisor and "
          "a sprint retrospective at which the team adjusts its own practice. "
          "Version control is used throughout, with each change committed "
          "against the objective it serves. Database changes are made as "
          "versioned migrations so that any environment can be brought to the "
          "current schema reproducibly."),

    ("head", "Testing and evaluation"),
    ("p", "Testing operates at four levels. Unit tests exercise the pure domain "
          "modules, in particular the matching and eligibility logic, against "
          "constructed profiles for which the correct verdict is known. "
          "Integration tests exercise the service layer against a real database "
          "to confirm that queries are correctly scoped and that one "
          "organisation cannot reach another's records. End-to-end tests drive "
          "the running application through a browser to confirm that complete "
          "journeys, such as registration through to submitted application, "
          "work as specified. Accuracy testing measures the document-extraction "
          "components against prepared forms whose correct values are known in "
          "advance, and reports the proportion of fields extracted correctly."),
    ("p", "Evaluation is conducted against two references. The first is the "
          "Software Requirements Specification: each specified requirement is "
          "traced to the implementation that satisfies it, and any requirement "
          "not satisfied is recorded as such. The second is the problem "
          "statement: the system is examined for whether a student can in fact "
          "obtain a ranked, explained list of opportunities from a single "
          "profile, and whether a funding organisation can in fact screen and "
          "shortlist applicants against its own published criteria without "
          "manual transcription. An automated audit additionally confirms that "
          "no funding opportunity visible to a user is invented rather than "
          "traceable to a recorded source."),
]

# ---------------------------------------------------------------------------
# 5. Equipment, Tools and Technologies
# ---------------------------------------------------------------------------
TOOLS_INTRO = [
    "The technologies below are those the system is built on. No hardware "
    "beyond ordinary development machines is required, because the system is a "
    "web application with no sensor, device or embedded component.",
]

HARDWARE = [
    ("Development workstations", "Laptop or desktop computers, one per team "
     "member, used for development, testing and documentation."),
    ("Server or hosting environment", "A machine capable of running the "
     "application process and the database, used for the deployed instance "
     "against which end-to-end testing and demonstration are carried out."),
    ("Mobile handsets and tablets", "Used to verify that the interface is "
     "usable at narrow viewport widths, since many students will reach the "
     "system on a telephone."),
]

SOFTWARE = [
    ("Programming language", "TypeScript 5.7, used for both server and browser "
     "code so that one set of types describes the data on both sides."),
    ("Application framework", "Next.js 15.5 with the App Router, and React 19 "
     "with server components, providing the pages, the routing and the HTTP "
     "route handlers in one codebase."),
    ("Presentation", "Tailwind CSS 3.4, with the colour palette and type scale "
     "expressed as design tokens so that a visual change is made once and "
     "applies everywhere."),
    ("Database", "PostgreSQL 16, chosen for its typed columns, enumerated "
     "types and referential integrity, all of which the eligibility model "
     "depends on."),
    ("Data access", "Prisma 6.19, providing a typed schema, a generated client "
     "and versioned migrations."),
    ("Validation", "Zod 3.25, used to validate every request body on the "
     "server, with the same schemas reused in the browser for immediate "
     "feedback."),
    ("Document processing", "pdf-lib for writing filled application forms, "
     "pdfjs-dist for reading submitted PDF documents, and JSZip for expanding "
     "archives of applications received in bulk."),
    ("Ingestion", "Cheerio, used to parse the HTML of published listing pages "
     "during ingestion."),
    ("Authentication", "bcryptjs for password hashing, with server-side "
     "sessions addressed by an opaque token held in an httpOnly cookie."),
    ("Testing", "Playwright for end-to-end browser testing, together with "
     "purpose-written test harnesses executed under the TypeScript runtime for "
     "unit, integration and accuracy testing."),
    ("Version control", "Git, with the repository hosted remotely so that all "
     "four team members work against one history."),
    ("Documentation", "Microsoft Word, for the departmental document templates "
     "in which the specification, design and test documents are delivered."),
]

# ---------------------------------------------------------------------------
# 6. Project Scope
# ---------------------------------------------------------------------------
SCOPE_INTRO = [
    "The boundaries below were set so that the project is completable within "
    "the four months of a single semester by a team of four while still "
    "addressing both sides of the problem stated in Section 2.",
]

IN_SCOPE = [
    "A student account with a profile holding identity, contact, academic, "
    "study-preference, subject-result and household-circumstance information, "
    "captured once and reused throughout the system.",
    "A weighted matching engine that scores every funding programme against a "
    "student profile and returns the per-criterion reasons behind the score.",
    "A rule-based eligibility evaluation that returns a separate verdict of "
    "eligible, not eligible, or pending verification against the criteria the "
    "funder published.",
    "A browsable and searchable directory of all funding opportunities held by "
    "the system, whether matched to the student or not, each showing the source "
    "it came from.",
    "An ingestion pipeline that imports opportunities from published sources "
    "agreed with the supervisor, records the provenance of each, and rejects "
    "rather than guesses at listings it cannot resolve.",
    "An application workflow in which a student applies to a programme using "
    "the profile already captured, attaches supporting documents, and tracks "
    "the status of each application.",
    "Assisted completion of PDF application forms from the stored profile, with "
    "a confidence level recorded for every extracted field and no field filled "
    "on a low-confidence guess.",
    "A composer that assembles a motivational letter from facts already held on "
    "the profile and the student's own answers, without generating claims the "
    "student did not make.",
    "An organisation account through which funding programmes are published "
    "with structured eligibility criteria, and through which applications are "
    "received, reviewed, shortlisted and selected.",
    "Bulk intake of applications that an organisation received outside the "
    "system, including extraction, duplicate detection and a review step before "
    "anything is imported.",
    "An administrative role for managing the catalogue of institutions, "
    "qualifications and subjects, and for suspending or restoring accounts.",
    "In-application notifications recording the events that concern a user.",
    "A responsive interface usable at desktop, tablet and mobile widths.",
]

OUT_OF_SCOPE = [
    "Disbursement of funds. The system records selection decisions; it does not "
    "make, hold or transfer payments.",
    "Verification of submitted documents against any external authority. The "
    "system records what was submitted and flags what needs checking, but it "
    "does not confirm a certificate or an identity document with its issuer.",
    "Integration with the student information systems of universities or with "
    "government systems, including the state funding scheme. No such interface "
    "is specified or built.",
    "A native mobile application. The interface is delivered as a responsive "
    "web application only.",
    "Automated generation of prose by a language model. The motivational letter "
    "composer assembles text deterministically from stated facts; it does not "
    "write on the student's behalf.",
    "Payment processing, subscription billing or any commercial function.",
    "Languages other than English in the user interface.",
    "Exhaustive coverage of every published bursary in South Africa. Only "
    "sources explicitly agreed with the supervisor are ingested.",
]

# ---------------------------------------------------------------------------
# 7. Project Beneficiaries
# ---------------------------------------------------------------------------
BENEFICIARIES_INTRO = [
    "The project delivers value to two groups directly, through their own use "
    "of the system, and to two further groups indirectly, through the effect "
    "the system has on the process they take part in.",
]

# (group, how they interact, what they gain)
BENEFICIARIES_DIRECT = [
    ("Students seeking education funding",
     "They register, complete one profile, and receive a ranked list of "
     "opportunities with the reasons behind each score. They browse the full "
     "directory, apply through the system using the profile already captured, "
     "attach supporting documents once, and track each application.",
     "Search is replaced by matching, so effort is directed at opportunities "
     "they are actually eligible for. The reasons attached to each score show "
     "what would improve a match, which is information the current process "
     "never returns. The same details are entered once rather than on every "
     "form, and the status of every application is visible in one place."),

    ("Funding organisations",
     "They register an organisation, publish funding programmes with "
     "structured eligibility criteria, receive applications into a single "
     "pipeline, review applicants against their own criteria, and shortlist "
     "and select from that pipeline. Applications received outside the system "
     "can be imported in bulk into the same pipeline.",
     "Screening becomes structured rather than manual, so a larger field of "
     "applicants can be considered consistently and the organisation is no "
     "longer penalised for advertising widely. Every decision leaves an "
     "auditable record, which makes reporting on the organisation's own "
     "selection possible for the first time."),
]

BENEFICIARIES_INDIRECT = [
    ("Institutional financial aid offices",
     "They are not users of the system in this release, but they advise the "
     "students who are.",
     "A student who arrives with a ranked and explained list of opportunities, "
     "rather than with a general question about where to look, can be advised "
     "in less time and more precisely."),

    ("Families and communities of funded students",
     "They do not interact with the system.",
     "A student who secures funding they would otherwise have missed is a "
     "student who registers, remains registered and completes a qualification. "
     "The benefit of that outcome extends beyond the individual."),

    ("The Department of Computer Science and future project teams",
     "The project produces a specification, a design description, a test plan "
     "and a working system, all in the departmental templates.",
     "The data model for expressing funding eligibility as evaluable criteria, "
     "and the explainable matching mechanism built over it, are reusable "
     "contributions that a later project can extend to further sources or "
     "further funding types."),
]

# ---------------------------------------------------------------------------
# 8. Assumptions and Constraints
# ---------------------------------------------------------------------------
ASSUMPTIONS = [
    "Funding opportunities published on the sources agreed with the supervisor "
    "remain publicly accessible for the duration of the project, and their page "
    "structure does not change so fundamentally that the ingestion pipeline "
    "must be rewritten.",
    "The eligibility conditions that funders publish can be expressed as typed "
    "criteria. Conditions that genuinely cannot be typed are handled as "
    "requiring verification rather than being forced into the model.",
    "Students are able to supply the profile information the matching engine "
    "needs, and will supply it where the system explains why it is being asked.",
    "Team members have continuous access to development machines and to a "
    "reliable internet connection for the duration of the project.",
    "The software on which the system is built remains freely available under "
    "its current open-source licensing for the duration of the project.",
    "The supervisor is available at the agreed intervals to review each "
    "increment and to approve the sources that may be ingested.",
    "A database server and a hosting environment sufficient to run the "
    "application for demonstration and testing are available to the team.",
]

CONSTRAINTS = [
    "Time. The project must be completed within a single semester of four "
    "months, alongside the team's other coursework. This is the binding "
    "constraint on the project: it fixes the total effort available, it is "
    "why the work plan overlaps its phases rather than running them in "
    "sequence, and it makes scope control the principal planning "
    "discipline.",
    "Team size. The team consists of four members, which limits the amount of "
    "work that can proceed in parallel in any sprint.",
    "Budget. The project has no funding, so every tool and service used must be "
    "free or open-source. This excludes commercial hosting tiers, paid "
    "application programming interfaces and licensed libraries.",
    "No access to real funder data. No funding organisation has provided the "
    "project with its application records, so organisation-facing features are "
    "developed and demonstrated against data created for that purpose, which is "
    "clearly identified as such wherever it appears.",
    "No model-backed text generation. No language-model service is available "
    "within the project's means, so any feature that would otherwise generate "
    "prose is implemented deterministically from stated facts.",
    "No electronic mail delivery service. Notifications are written to the "
    "database and shown in the application; outbound email is designed for but "
    "not dispatched.",
    "Legal constraints on data. The system processes personal information and "
    "is therefore bound by the Protection of Personal Information Act [9], "
    "which constrains what may be collected, how long it may be kept and who "
    "may see it.",
    "Constraints on data collection. Only sources whose robots directives and "
    "terms of use permit automated access may be ingested, and only at the "
    "request rate those directives specify, which limits how quickly the "
    "directory can be populated.",
]

# ---------------------------------------------------------------------------
# 9. Project Risks
# ---------------------------------------------------------------------------
# (risk, likelihood, impact, mitigation)
RISKS = [
    ("Exposure of students' personal information. The system holds identity "
     "numbers, contact details, academic records and household income, which "
     "are exactly the categories the Protection of Personal Information Act "
     "protects [9].",
     "Medium", "High",
     "Authorisation is established at every server-side entry point by a guard "
     "that returns the identifiers used to scope every database query, so a "
     "record belonging to another user cannot be reached. Passwords are hashed "
     "rather than stored. Sessions are addressed by an opaque token in an "
     "httpOnly cookie. Integration tests specifically assert that one "
     "organisation cannot read another organisation's applicants."),

    ("A published source changes its page structure, or becomes unavailable, "
     "and the ingestion pipeline stops producing correct results.",
     "High", "Medium",
     "The pipeline records the source page for every opportunity and rejects "
     "any listing it cannot fully resolve, so a structural change produces "
     "rejections rather than corrupted records. A sample is reviewed before "
     "every full ingestion run. Previously imported opportunities are retained "
     "with their recorded provenance."),

    ("Eligibility criteria published as prose cannot be expressed in the typed "
     "data model, so opportunities are imported with the wrong criteria "
     "attached.",
     "High", "High",
     "Criteria that cannot be established are left unset and reported as "
     "requiring verification rather than being assumed. The matching engine "
     "treats an unevaluable criterion explicitly, and the interface labels it "
     "as such, so an uncertain criterion never silently becomes a pass or a "
     "fail."),

    ("Scope creep. The problem admits many additional features, and adding them "
     "during development would put the core deliverables at risk.",
     "High", "High",
     "Section 6 states what is out of scope explicitly. New ideas enter the "
     "product backlog rather than the current sprint, and are admitted only at "
     "sprint planning against the objectives in Section 3.2."),

    ("Integration failures between components developed in parallel by "
     "different team members.",
     "Medium", "Medium",
     "All four members work against one version-controlled repository with a "
     "shared type definition generated from the database schema, so an "
     "incompatible change fails to compile rather than failing at run time. "
     "Each sprint ends in an integrated working increment."),

    ("Insufficient test data. The document-extraction and bulk-intake "
     "components cannot be validated without realistic application forms, and "
     "no funder has supplied any.",
     "Medium", "Medium",
     "Test forms are prepared by the team with known correct values so that "
     "extraction accuracy can be measured objectively. Data created for testing "
     "is clearly identified as such and is removed from the database before "
     "delivery."),

    ("Loss of work through hardware failure or an unrecoverable local error.",
     "Medium", "High",
     "All code and documentation are committed to a remote repository, and "
     "database schema changes are held as versioned migrations so that any "
     "environment can be rebuilt from the repository alone."),

    ("Development delay caused by the team's concurrent academic commitments.",
     "High", "Medium",
     "The work plan in Section 10.2 schedules the highest-risk work early. "
     "Sprint retrospectives surface slippage while there is still time to "
     "re-order the backlog, and out-of-scope items are not started."),

    ("A team member becomes unavailable for an extended period.",
     "Low", "High",
     "Responsibilities in Section 10.1 are allocated so that no single member "
     "is the only person who has worked in a given area, and all work is "
     "visible in the shared repository rather than held locally."),

    ("The matching results are technically correct but not useful to students, "
     "because the weights chosen do not reflect what matters in practice.",
     "Medium", "Medium",
     "Weights are held as configuration rather than embedded in code, and can "
     "be overridden per funding programme. Every score is returned with its "
     "per-criterion reasons, so a weighting that produces an unexpected result "
     "can be identified and corrected rather than merely observed."),
]

# ---------------------------------------------------------------------------
# 10. Project Work Plan
# ---------------------------------------------------------------------------
EXPERTISE_INTRO = [
    "The team consists of the four members listed on the cover page. "
    "Responsibilities are allocated below by area of the system, so that every "
    "area has a member accountable for it and no area is the work of one person "
    "alone. The level of knowledge recorded for each member is stated in "
    "bracketed form because the project has no record from which prior "
    "experience could be established, and it is not assumed here.",
]

# (member, responsibilities, level of knowledge)
TEAM = [
    ("CPP Mchunu",
     "Requirements engineering and the Software Requirements Specification; "
     "the student-facing profile, matching and opportunity screens; "
     "coordination of the sprint reviews with the supervisor.",
     "High."),
    ("A Nsibande",
     "Data model and database migrations; the matching and eligibility domain "
     "modules; the ingestion pipeline and the provenance of imported "
     "opportunities.",
     "High."),
    ("KN Bikile",
     "The organisation-facing portal: funding programme publication, "
     "applicant review, shortlisting and selection; bulk application intake and "
     "duplicate detection.",
     "High."),
    ("SP Tshazi",
     "Document processing, including extraction from submitted PDF forms and "
     "assisted form completion; the test suites at unit, integration and "
     "end-to-end level; the Test Plan.",
     "High."),
]

TEAM_NOTE = [
    "The team leader is Asanda Nsibande, listed on the cover page as A "
    "Nsibande. The team leader is "
    "responsible for the product backlog, for scheduling and chairing the "
    "sprint events, and for the delivery of each document to the supervisor. "
    "All four members contribute to design decisions, to code review and to the "
    "final project report; the allocation above records accountability for an "
    "area, not exclusive ownership of it.",
]

WORKPLAN_INTRO = [
    "The project runs over a single semester of four months. The plan below "
    "organises it into ten tasks across the sixteen weeks of that semester; "
    "weeks rather than months are used because at four columns a chart cannot "
    "show which tasks overlap, and the overlap is the point. The semester "
    "runs from July 2026 to October 2026: week 1 is the first week of July "
    "and week 16 falls in October, the month in which the project is "
    "presented.",

    "Tasks overlap deliberately. Development begins before the whole "
    "specification is settled and testing begins before development ends, "
    "which is what the chosen methodology requires and what four months make "
    "unavoidable. The three tasks that carry the most risk, the background "
    "investigation, the requirements and the data ingestion, are scheduled "
    "early, so that a problem found in any of them is found while there is "
    "still time to act on it.",
]

# (task, start week, end week, note)
WORKPLAN = [
    ("Project initiation and proposal", 1, 3,
     "Topic definition, supervisor consultation, and this proposal."),
    ("Background research and investigation", 1, 5,
     "Review of the publishing channels and of adjacent systems; the "
     "exploratory crawl of an agreed source."),
    ("Requirements gathering and specification", 3, 7,
     "Use cases and requirements; delivery of the Software Requirements "
     "Specification."),
    ("System analysis and design", 5, 8,
     "Data model, architecture, matching algorithm and interface design; "
     "delivery of the Software Design Description."),
    ("Implementation: student portal", 6, 13,
     "Profile, matching, directory, applications and documents."),
    ("Data ingestion and provenance", 8, 11,
     "The ingestion pipeline; sample review, then the full run."),
    ("Implementation: organisation portal", 8, 14,
     "Programme publication, applicant review, shortlisting, selection and "
     "bulk intake."),
    ("Testing and validation", 10, 16,
     "Unit, integration, end-to-end and accuracy testing; delivery of the Test "
     "Plan."),
    ("Evaluation", 14, 16,
     "Traceability of requirements to implementation; audit of the data "
     "visible to users."),
    ("Documentation and final presentation", 1, 16,
     "Maintained throughout; final report and demonstration in the closing "
     "week."),
]

# ---------------------------------------------------------------------------
# 11. References
# ---------------------------------------------------------------------------
REFERENCES = [
    "Department of Higher Education and Training, Statistics on Post-School "
    "Education and Training in South Africa: 2023. Pretoria: Department of "
    "Higher Education and Training, released June 2025. ISBN "
    "978-1-77997-960-5. [Online]. Available: https://www.dhet.gov.za/"
    "Information%20Systems%20Management/Statistics%20on%20Post-School%20"
    "Education%20and%20Training%20in%20South%20Africa,%202023.pdf. "
    "[Accessed: 24 September 2026].",

    "National Student Financial Aid Scheme, “The DHET Bursary Scheme,” "
    "NSFAS. [Online]. Available: https://www.nsfas.org.za/content/"
    "bursary-scheme.html. [Accessed: 24 September 2026].",

    "ZA Bursaries, “Bursaries in South Africa.” [Online]. Available: "
    "https://www.zabursaries.co.za/. Robots directives available at "
    "https://www.zabursaries.co.za/robots.txt. [Accessed: 24 September 2026].",

    "K. Schwaber and J. Sutherland, The 2020 Scrum Guide. November 2020. "
    "[Online]. Available: https://scrumguides.org/scrum-guide.html. "
    "[Accessed: 24 September 2026].",

    "K. Beck et al., “Manifesto for Agile Software Development,” 2001. "
    "[Online]. Available: https://agilemanifesto.org/. "
    "[Accessed: 24 September 2026].",

    "K. Peffers, T. Tuunanen, M. A. Rothenberger and S. Chatterjee, “A "
    "Design Science Research Methodology for Information Systems Research,” "
    "Journal of Management Information Systems, vol. 24, no. 3, pp. 45–77, "
    "2007. doi: 10.2753/MIS0742-1222240302.",

    "ISO/IEC/IEEE 29148:2018, Systems and Software Engineering — Life Cycle "
    "Processes — Requirements Engineering. Geneva: International "
    "Organization for Standardization, 2018.",

    "IEEE Std 1016-2009, IEEE Standard for Information Technology — Systems "
    "Design — Software Design Descriptions. New York: Institute of "
    "Electrical and Electronics Engineers, 2009.",

    "Republic of South Africa, Protection of Personal Information Act 4 of "
    "2013. Pretoria: Government Printer, 2013. [Online]. Available: "
    "https://www.justice.gov.za/legislation/acts/2013-004.pdf. "
    "[Accessed: 24 September 2026].",
]

# ---------------------------------------------------------------------------
# 12. Appendices
# ---------------------------------------------------------------------------
APPENDIX_INTRO = [
    "Two appendices are attached. Minutes of supervision meetings and "
    "questionnaire instruments are not reproduced here: the project gathers its "
    "requirements from documentary analysis of published material rather than "
    "by survey or interview, as stated in Section 4, so no questionnaire was "
    "administered.",
]

APPENDIX_A_INTRO = [
    "The listing pages below are the sources the ingestion pipeline is "
    "configured to read. Each was checked for its robots directives and terms "
    "of use before any request was made, and each is agreed with the "
    "supervisor. No source outside this list is fetched.",
]

APPENDIX_A = [
    "https://www.zabursaries.co.za/bursary-news/",
    "https://www.zabursaries.co.za/accounting-bursaries-south-africa/",
    "https://www.zabursaries.co.za/commerce-bursaries-south-africa/",
    "https://www.zabursaries.co.za/computer-science-it-bursaries-south-africa/",
    "https://www.zabursaries.co.za/construction-and-built-environment-bursaries-south-africa/",
    "https://www.zabursaries.co.za/education-bursaries-south-africa/",
    "https://www.zabursaries.co.za/engineering-bursaries-south-africa/",
    "https://www.zabursaries.co.za/general-bursaries-south-africa/",
    "https://www.zabursaries.co.za/government-bursaries-south-africa/",
    "https://www.zabursaries.co.za/international-scholarships-bursaries-south-africa/",
    "https://www.zabursaries.co.za/law-bursaries-south-africa/",
    "https://www.zabursaries.co.za/medical-bursaries-south-africa/",
    "https://www.zabursaries.co.za/music-and-performing-arts-bursaries-south-africa/",
    "https://www.zabursaries.co.za/science-bursaries-south-africa/",
]

APPENDIX_B_INTRO = [
    "The documents below are produced by the project in the departmental "
    "templates, and are the deliverables against which objective ten in "
    "Section 3.2 is measured.",
]

# (document, standard it follows, status)
APPENDIX_B = [
    ("Final Year Project Proposal", "Departmental proposal template",
     "This document."),
    ("Software Requirements Specification",
     "Departmental template; structured in accordance with ISO/IEC/IEEE 29148",
     "Delivered."),
    ("Software Design Description",
     "Departmental template; structured in accordance with IEEE 1016",
     "Delivered."),
    ("Test Plan", "Departmental template", "Delivered."),
    ("Final project report and demonstration", "Departmental requirements",
     "Scheduled for the closing week of the work plan."),
]

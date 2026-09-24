"""
Content of the Test Plan.

Section titles and their order are the template's, unchanged. Only the sample
e-commerce content is replaced.

Every suite, command, count and environment requirement stated here was run
before it was written down; the counts are the ones the suites printed on the
run recorded in TEST_RUN_DATE. Where the project has not fixed a fact – who
holds a role, which dates apply, which issue tracker is used – a bracketed
placeholder is used rather than an invented value.

Block kinds: "p" a paragraph, "blank" an empty line, or an integer numId for a
list item (2 numbered, 3 and 1 bulleted, as the template defines them).
"""

TITLE = "Bursary-Bridge System Test Plan"

SUPERVISOR = "Ms Zulu"
TEST_RUN_DATE = "24 September 2026"

SECTIONS = [

    ("Test Plan Identifier", [
        ("p", "Bursary-Bridge TP_2.0"),
        ("blank", None),
        ("p", "This test plan covers the Bursary-Bridge system developed by "
              "CPP Mchunu (202242486), A Nsibande (240079346), KN Bikile "
              "(202356797) and SP Tshazi (240103222) for the Department of "
              "Computer Science, University of Zululand, under the supervision "
              "of Ms Zulu."),
    ]),

    ("References", [
        ("p", "The documents below support this test plan and are cited by "
              "bracketed number where they are relied on. Every source listed "
              "here is cited at least once in the text."),
        ("blank", None),
        ("ref", "[1] Department of Computer Science, University of Zululand, "
            "\u201cFinal Year Project Proposal: Bursary-Bridge,\u201d 2026."),
        ("ref", "[2] Department of Computer Science, University of Zululand, "
            "\u201cSoftware Requirements Specification: Bursary-Bridge,\u201d "
            "2026. Section 3.2 defines the thirty-seven use cases from which "
            "the features in this plan are drawn."),
        ("ref", "[3] Department of Computer Science, University of Zululand, "
            "\u201cSoftware Design Description: Bursary-Bridge,\u201d 2026. "
            "Section 5 traces twelve of those use cases to the design objects "
            "that carry them out."),
        ("ref", "[4] Republic of South Africa, Protection of Personal Information "
            "Act 4 of 2013. Pretoria: Government Printer, 2013. [Online]. "
            "Available: https://www.justice.gov.za/legislation/acts/"
            "2013-004.pdf."),
    ]),

    ("Introduction", [
        ("p", "This test plan for the Bursary-Bridge system supports the "
              "following objectives:"),
        ("blank", None),
        (2, "To define the tools to be used throughout the testing process."),
        (2, "To communicate to the responsible parties the items to be tested, "
            "set expectations around schedule, and define environmental needs."),
        (2, "To define how the tests will be conducted."),
    ]),

    ("Test Items", [
        ("p", "The systems to be tested are the Student portal, the Corporate "
              "portal, the Administration portal, the application programming "
              "interface that serves all three, and the server-side modules "
              "behind them: the matching engine, the eligibility service, the "
              "bursary ingestion pipeline, the document extraction engine, the "
              "application import pipeline and the motivational letter "
              "composer. Persistent state is held in PostgreSQL and reached "
              "through Prisma, and the stored schema is itself a test item "
              "because the eligibility model depends on its typed columns."),
        ("blank", None),
        ("p", "The automated interface checks run in Chromium through "
              "Playwright at a desktop width of 1440 pixels, a tablet width of "
              "834 pixels and a mobile width of 390 pixels. Manual checks use "
              "Chromium as well, so one browser engine is exercised and only "
              "one."),
    ]),

    ("Features To Be Tested", [
        ("p", "Features to be tested include the following:"),
        (3, "As a student, registering an account and signing in"),
        (3, "As a student, resetting a forgotten password through an issued token"),
        (3, "As a student, completing the profile through the onboarding steps"),
        (3, "As a student, adding study preferences that pair a course with an institution"),
        (3, "As a student, capturing subject and module results that the matching engine reads"),
        (3, "As a student, viewing matched opportunities ranked by match score"),
        (3, "As a student, viewing the per-criterion reasons behind a match score"),
        (3, "As a student, browsing the full directory of opportunities the system holds, "
            "whether or not they match the profile"),
        (3, "As a student, searching and filtering the directory, and seeing the source each "
            "opportunity was taken from"),
        (3, "As a student, viewing the eligibility requirements of an opportunity and the "
            "verdict against them"),
        (3, "As a student, submitting an application to a funding programme"),
        (3, "As a student, tracking the status of a submitted application"),
        (3, "As a student, uploading and managing supporting documents"),
        (3, "As a student, having a downloaded PDF application form completed from the stored "
            "profile, and reviewing every field before accepting it"),
        (3, "As a student, generating a motivational letter assembled from stored facts and "
            "the student's own answers"),
        (3, "As a student, responding to a funder's request for further information"),
        (3, "As a corporate user, registering an organisation account"),
        (3, "As a corporate user, completing the organisation profile"),
        (3, "As a corporate user, creating a funding programme and its structured eligibility criteria"),
        (3, "As a corporate user, publishing a funding programme"),
        (3, "As a corporate user, viewing applications received"),
        (3, "As a corporate user, reviewing an applicant and the eligibility verdict"),
        (3, "As a corporate user, requesting further information from an applicant"),
        (3, "As a corporate user, shortlisting an applicant and selecting a beneficiary"),
        (3, "As a corporate user, importing in bulk the applications the organisation received "
            "outside the system, and reviewing the extraction before anything is imported"),
        (3, "As a corporate user, viewing reports"),
        (3, "As an administrator, maintaining the catalogue of institutions, qualifications and subjects"),
        (3, "As an administrator, suspending and restoring an account"),
        (3, "The ingestion pipeline: obeying robots directives, recording the source of every "
            "imported opportunity, rejecting a listing it cannot fully resolve, and resolving "
            "a disagreement between two sources in favour of the more authoritative one"),
        (3, "The scoring rules of the matching engine, including the weight of each criterion, "
            "the treatment of a criterion that cannot be evaluated, and the classification thresholds"),
        (3, "The eligibility service, including that missing information yields "
            "PENDING_VERIFICATION rather than an automatic rejection"),
        (3, "Document extraction, including that a field read with insufficient confidence is "
            "left empty rather than guessed at"),
        (3, "Duplicate detection and identity resolution in the import pipeline, including that "
            "a suspected duplicate is flagged rather than merged or deleted"),
        (3, "Access control, that a student cannot read another student's data and a corporate "
            "user cannot read another organisation's applicants"),
        (3, "Server-side validation of every submitted form"),
        (3, "The responsive layout at desktop, tablet and mobile widths"),
    ]),

    ("Features Not To Be Tested", [
        ("p", "Fund disbursement will not be tested, because the prototype does "
              "not disburse funds. Verification of submitted documents against "
              "any external authority will not be tested, because no such "
              "integration exists. Integration with the student information "
              "systems of universities or with government systems will not be "
              "tested, because it lies outside the scope of this release."),
        ("blank", None),
        ("p", "Delivery of electronic mail will not be tested. Notifications "
              "are written to the database and shown in the application, and no "
              "outbound mail is dispatched, so there is no delivery to observe. "
              "Storage of documents in S3-compatible object storage will not be "
              "tested, because the prototype writes to local disk. Generation "
              "of prose by a language model will not be tested, because the "
              "motivational letter composer assembles text deterministically "
              "from stated facts and reaches no model."),
        ("blank", None),
        ("p", "Behaviour in browsers other than Chromium will not be tested. "
              "Both the automated suites and the manual checks use Chromium, so "
              "a defect specific to the Gecko or WebKit engine would not be "
              "found by this plan. This is a known limitation of the plan "
              "rather than a claim about the system."),
        ("blank", None),
        ("p", "Load, stress and performance testing are outside the scope of "
              "this plan. The system is tested for correctness, not for "
              "behaviour under concurrent load, and no performance target has "
              "been set for this release."),
    ]),

    ("Approach", [
        ("p", "Testing is carried out in five layers, all of which run from the "
              "project repository with a single command each."),
        ("blank", None),
        ("p", "First, static checking. The command npm run typecheck runs the "
              "TypeScript compiler across the whole project. Because the "
              "database client is generated from the schema, a change that "
              "breaks a query fails this step rather than failing at run time."),
        ("blank", None),
        ("p", "Second, unit testing of the pure domain modules. These suites "
              "exercise the scoring rules, the eligibility rules and the "
              "field-label matching against constructed inputs for which the "
              "correct answer is known. They reach neither a browser nor a "
              "server."),
        ("blank", None),
        ("p", "Third, integration testing of the service layer against a real "
              "database. These suites create their own data, exercise the "
              "service functions directly, assert the resulting database state, "
              "and remove only what they created. Nothing is mocked and no "
              "suite may delete a record it did not write."),
        ("blank", None),
        ("p", "Fourth, end-to-end testing through the real interface. The "
              "command npm run test:e2e drives complete journeys against a "
              "running server using real HTTP requests and real session "
              "cookies, then asserts the database state that resulted. Two "
              "further browser suites drive Chromium through Playwright to "
              "check the bursary directory and the letter composer as a user "
              "sees them."),
        ("blank", None),
        ("p", "Fifth, accuracy measurement. The command npm run test:pdf fills "
              "prepared application forms whose correct values are known in "
              "advance, then reads the saved documents back and reports how "
              "many fields were populated correctly. This measures accuracy "
              "rather than returning a pass or a fail, because a field the "
              "system correctly declines to guess at is a success and not a "
              "failure."),
        ("blank", None),
        ("p", "The counted suites and the checks each contributed on the run "
              f"of {TEST_RUN_DATE} are as follows:"),
        ("blank", None),
        (3, "npm run test:matching – the matching engine, the eligibility "
            "service and the subject requirements: 35 checks"),
        (3, "npm run test:pdf:labels – field-label matching and normalisation: "
            "39 checks"),
        (3, "npm run test:autofill – the auto-fill service and its handling of "
            "unreadable documents: 32 checks"),
        (3, "npm run test:catalogue – the catalogue of institutions, "
            "qualifications and courses, and the service over it: 43 checks"),
        (3, "npm run test:results – subject and module results and their effect "
            "on matching: 32 checks"),
        (3, "npm run test:requests – requests for further information: 31 checks"),
        (3, "npm run test:letters – the letter composer and the service over it: "
            "87 checks"),
        (3, "npm run test:import – bulk application intake, extraction, duplicate "
            "detection and identity resolution: 59 checks"),
        (3, "npm run test:ingest – robots handling, parsing, provenance, "
            "deduplication and conflict resolution: 78 checks"),
        (3, "npm run test:directory – the bursary directory in the browser: "
            "25 checks"),
        (3, "npm run test:letters:ui – the letter composer in the browser: "
            "27 checks"),
        (3, "npm run test:e2e – complete student and organisation journeys "
            "through the real interface: 109 checks"),
        ("blank", None),
        ("p", "A separate audit, npm run audit:production, confirms that no "
              "funding opportunity visible to a user is invented rather than "
              "traceable to a recorded source. It is run before any "
              "demonstration or submission."),
        ("blank", None),
        ("p", "Manual exploratory testing covers what the automated suites do "
              "not reach, in particular the rendering of each screen at the three "
              "widths and the "
              "usability of the onboarding steps. Defects found by any layer "
              "are recorded as GitHub issues against the project "
              "repository, with the steps needed to "
              "reproduce them."),
    ]),

    ("Pass/Fail Criteria", [
        ("p", "A test run passes when npm run typecheck reports no errors and "
              "every check in every automated suite passes. The command npm "
              "test runs all thirteen commands in sequence and stops at the "
              "first that fails. Twelve of them report a pass and fail count; "
              "the thirteenth is the accuracy harness, which is judged as "
              f"described below. On the run of {TEST_RUN_DATE} every command "
              "succeeded: 597 checks passed across the twelve counted suites, "
              "none failed, and the compiler reported no errors."),
        ("blank", None),
        ("p", "The accuracy harness is judged differently, because it measures "
              "rather than asserts. It passes when every field it populated "
              "carries a value the source document actually stated, when every "
              "populated field is present in the saved PDF on read-back, and "
              "when no field was filled on a low-confidence guess. On the run "
              "recorded above it checked 46 fields across 6 forms with 46 "
              "correct and none filled from anything the source did not say, "
              "populating 20 of the 46 fields; the remaining 26 were correctly "
              "left for the student because the source form did not answer them."),
        ("blank", None),
        ("p", "A defect is classified as high severity when it prevents a user "
              "from completing a journey, exposes data belonging to another "
              "user or organisation, causes the match score shown to a student "
              "to contradict the eligibility verdict shown to a funder, or "
              "causes the system to present information it cannot trace to a "
              "source. The system is not accepted for submission while any "
              "high-severity defect remains open."),
    ]),

    ("Suspension Criteria", [
        ("p", "Testing is paused immediately if users cannot sign in, if the "
              "database is unavailable or its migrations fail to apply, or if "
              "the test environment cannot be prepared. Testing is also paused "
              "if a defect is found that exposes one user's data to another, "
              "because every later result would be unsafe to trust until that "
              "is corrected and because the system holds information the "
              "Protection of Personal Information Act [4] requires to be kept "
              "from anyone not entitled to see it."),
        ("blank", None),
        ("p", "Testing is paused if a suite is found to delete data it did not "
              "create. A suite that removes records belonging to the imported "
              "directory destroys the evidence that later checks depend on, and "
              "any result recorded after such a run must be discarded and the "
              "run repeated. Testing resumes once the blocking defect is fixed "
              "and the affected checks pass again."),
    ]),

    ("Test Deliverables", [
        ("p", "The deliverables of this testing project are this test plan, the "
              "recorded output of each test run showing the checks that passed "
              "and failed, the accuracy report produced by the document "
              "extraction harness, the report produced by the production audit, "
              "the list of defects recorded during testing, and a test summary "
              "report prepared at the end of each round."),
    ]),

    ("Testing Tasks", [
        ("p", "The following activities must be completed:"),
        (1, "Test plan prepared."),
        (1, "Software Requirements Specification [2] and Software Design "
            "Description [3] delivered to the testing team."),
        (1, "Environment prepared: Node.js 20 or later installed, PostgreSQL 16 "
            "running, the database created and its migrations applied, and the "
            "bursary directory restored from the recorded snapshot."),
        (1, "Static checking run and its output recorded."),
        (1, "Automated suites run and their output recorded."),
        (1, "Accuracy harness run and its figures recorded."),
        (1, "Production audit run and its report recorded."),
        (1, "Manual exploratory testing performed on what the "
            "automated suites do not reach."),
        (1, "Defects recorded and assigned."),
        (1, "Defects fixed and the affected checks re-run."),
        (1, "Test summary report prepared."),
    ]),

    ("Environmental Needs", [
        ("p", "Testing requires a machine with Node.js 20 or later and "
              "PostgreSQL 16. Node.js 20 is the floor because Playwright, which "
              "drives the browser suites, requires it. Chromium must be "
              "available to Playwright."),
        ("blank", None),
        ("p", "The repository must contain a .env file holding DATABASE_URL and "
              "AUTH_SECRET. The database must be created and its migrations "
              "applied with npm run db:deploy. The bursary directory is "
              "restored with npm run import:snapshot, which loads the 189 "
              "opportunities the ingestion pipeline collected, each carrying "
              "the source page it was read from; the matching suites need that "
              "directory in place to have anything to score against."),
        ("blank", None),
        ("p", "The end-to-end and browser suites need the development server "
              "running on http://localhost:3000. Each suite creates the "
              "accounts it needs, uses them, and removes them again, so no "
              "standing test accounts are required. Where a screen can only be "
              "populated by an organisation that has received applications, "
              "demonstration data is created for the purpose, clearly "
              "identified as such, and removed with npm run purge:mock before "
              "delivery."),
    ]),

    ("Responsibilities", [
        ("p", "The Test Manager, Salma, is responsible for "
              "facilitating the testing project, preparing the test "
              "environment, coordinating the availability of the testers, "
              "reviewing the results of each test run and reporting back to the "
              "project team and to the supervisor."),
        ("blank", None),
        ("p", "The testers are responsible for running the automated suites, "
              "performing the manual checks assigned to them, and recording "
              "each defect with the steps needed to reproduce it. The "
              "developers are responsible for fixing recorded defects and "
              "confirming that the affected checks pass again. No developer "
              "signs off a defect in their own area without a second member "
              "confirming the fix."),
    ]),

    ("Staffing And Training Needs", [
        ("p", "Testing is carried out by the project team of four. Each tester "
              "should work through the student journey and the organisation "
              "journey, so that no journey is only ever seen by one person, and "
              "the areas of the system allocated in Section 10.1 of the Final "
              "Year Project Proposal [1] should not determine who tests them."),
        ("blank", None),
        ("p", "Testers need no specialist tools beyond the repository itself, "
              "but they must be able to run the project locally and read the "
              "output of the test scripts. Before testing begins they should "
              "read Section 3.2 of the Software Requirements Specification [2], so "
              "that the expected behaviour of each use case is clear; they "
              "should understand how the weighted criteria produce a match "
              "score, so that an incorrect score is recognised rather than "
              "accepted; and they should understand that a criterion the system "
              "cannot evaluate is reported as requiring verification rather "
              "than as a failure, so that correct behaviour is not recorded as "
              "a defect."),
    ]),

    ("Schedule", [
        ("p", "Testing takes place between 21 and 24 September 2026. The "
              "submission date is 24 September 2026, which is the last day of "
              "that window."),
        ("blank", None),
        ("p", "One week is allowed for the first round of testing. That is "
              "longer than the window, so the round does not sit inside it. "
              "The automated part of the first round begins before 21 "
              "September and needs no scheduled window of its own, because the "
              "full sequence runs in minutes and is run on every change in any "
              "case. The four days from 21 to 24 September are reserved for "
              "the manual checks, which need a person rather "
              "than a command."),
        ("blank", None),
        ("p", "Because the submission date is the last day of the window, "
              "there is no time after it. Any defect found between 21 and 24 "
              "September must be fixed and its checks re-run within those four "
              "days, or accepted as an open defect and recorded as such in the "
              "test summary report."),
        ("blank", None),
        ("p", "The static check and the unit suites are quick enough to be run "
              "on every change. The integration and browser suites are run "
              "before each increment is shown to the supervisor. The full "
              "sequence, the accuracy harness and the production audit are run "
              "before any demonstration and before submission."),
    ]),

    ("Risks And Contingencies", [
        ("p", "If the environment is not prepared correctly, testing cannot "
              "start. Three failures have been seen in practice: PostgreSQL not "
              "running, Node.js older than version 20, and a stale generated "
              "database client left behind when a dependency install was a "
              "no-op. The setup script in the repository addresses all three, "
              "and testers should use it rather than preparing the environment "
              "by hand."),
        ("blank", None),
        ("p", "If a suite deletes data it did not create, the imported "
              "directory can be lost during a run and every later result "
              "becomes unreliable. This has occurred: two suites removed every "
              "externally sourced organisation rather than only the ones they "
              "had written, and one run of the full sequence emptied the "
              "directory of all 189 imported bursaries. Both suites now record "
              "what exists before they write anything and remove only the "
              "difference. The contingency is the recorded snapshot: npm run "
              "import:snapshot restores the directory in full, and it should be "
              "run and the audit repeated before results are trusted again."),
        ("blank", None),
        ("p", "If a suite assumes it is the only writer, it can fail for "
              "reasons that are not defects. Checks that expected a fixture to "
              "appear on the first page of the directory began failing once the "
              "directory held real imported bursaries; the checks now search "
              "for their own fixture instead of assuming its position. A "
              "failure of this kind must be diagnosed before it is reported, "
              "because recording it as a system defect wastes development time "
              "on correct behaviour."),
        ("blank", None),
        ("p", "If the testers do not understand how a match score is produced, "
              "an incorrect score may be accepted as correct, or correct "
              "handling of an unevaluable criterion may be reported as a "
              "defect. The training described above reduces this risk."),
        ("blank", None),
        ("p", "If the first round of testing is not completed on schedule, there "
              "is no slack to absorb it: the submission date of 24 September "
              "2026 is the last day of the testing window, so a round that runs "
              "late does not delay the final round, it removes it. The "
              "contingency is to prioritise the checks that cover access "
              "control, the matching engine and the provenance of imported "
              "data, because a defect in any of the three is the most serious "
              "kind this system can have, and to record anything left unchecked "
              "in the test summary report rather than leaving it unstated."),
    ]),

    ("Approvals", [
        ("p", "The Test Manager, Salma, and the Project Supervisor, "
              "Ms Zulu, must both agree that the testing project is complete "
              "and determine when the system is ready for submission."),
    ]),
]

"""
Content of the Test Plan.

Section titles and their order are the template's, unchanged. Only the sample
e-commerce content is replaced.

Everything stated about the test suites, the commands, the environment and the
demo accounts is taken from the repository and was run before being written
down. Where the project has not fixed a fact - who holds a role, which dates
apply - a placeholder is used rather than an invented value.

Block kinds: "p" a paragraph, "blank" an empty line, or an integer numId for a
list item (2 numbered, 3 and 1 bulleted, as the template defines them).
"""

TITLE = "Bursary-Bridge System Test Plan"

SECTIONS = [

    ("Test Plan Identifier", [
        ("p", "Bursary-Bridge TP_1.0"),
    ]),

    ("References", [
        ("p", "Documents that support this test plan include the Software "
              "Requirements Specification for Bursary-Bridge and the Software "
              "Design Description for Bursary-Bridge. Section 3.2 of the "
              "Software Requirements Specification defines the twenty-five use "
              "cases that the features listed below are drawn from."),
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
        ("p", "The systems to be tested include the Student portal, the "
              "Corporate portal, the application programming interface that "
              "serves them, the matching engine, and the PostgreSQL database "
              "reached through Prisma."),
        ("blank", None),
        ("p", "The automated interface checks run in Chromium through "
              "Playwright at desktop, tablet and mobile widths. The browsers "
              "used for manual checks are [BROWSERS TO BE CONFIRMED]."),
    ]),

    ("Features To Be Tested", [
        ("p", "Features to be tested include the following:"),
        (3, "As a student, registering an account and verifying the email address"),
        (3, "As a student, completing the profile through the onboarding steps"),
        (3, "As a student, adding study preferences that pair a course with an institution"),
        (3, "As a student, viewing matched opportunities with a match score"),
        (3, "As a student, viewing the reasons behind a match score"),
        (3, "As a student, searching and filtering opportunities"),
        (3, "As a student, viewing the eligibility requirements of an opportunity"),
        (3, "As a student, submitting an application to a funding programme"),
        (3, "As a student, tracking the status of a submitted application"),
        (3, "As a student, uploading and managing supporting documents"),
        (3, "As a corporate user, registering an organisation account"),
        (3, "As a corporate user, completing the organisation profile"),
        (3, "As a corporate user, creating a funding programme and its eligibility criteria"),
        (3, "As a corporate user, publishing a funding programme"),
        (3, "As a corporate user, viewing applications received"),
        (3, "As a corporate user, reviewing an applicant and the eligibility verdict"),
        (3, "As a corporate user, shortlisting an applicant"),
        (3, "As a corporate user, selecting a beneficiary"),
        (3, "As a corporate user, viewing reports"),
        (3, "Access control, that a student cannot read another student's data "
            "and a corporate user cannot read another organisation's applications"),
        (3, "Server-side validation of every submitted form"),
        (3, "The scoring rules of the matching engine, including the weighting "
            "of each criterion and the classification thresholds"),
    ]),

    ("Features Not To Be Tested", [
        ("p", "Fund disbursement will not be tested, because the prototype does "
              "not disburse funds. Verification of uploaded documents against "
              "any external authority will not be tested, because no such "
              "integration exists. Integration with the administration systems "
              "of universities or of government will not be tested, because it "
              "lies outside the scope of this release."),
        ("blank", None),
        ("p", "Delivery of electronic mail will not be tested. The prototype "
              "writes messages to the server console rather than sending them, "
              "and the system takes no decision that depends on delivery. "
              "Storage of documents in S3-compatible object storage will not be "
              "tested, because the prototype writes to local disk."),
    ]),

    ("Approach", [
        ("p", "Testing is carried out in four layers, all of which run from the "
              "project repository."),
        ("blank", None),
        ("p", "First, the TypeScript compiler is run with npm run typecheck to "
              "confirm the project builds without type errors."),
        ("blank", None),
        ("p", "Second, npm run test:matching exercises the scoring rules of the "
              "matching engine against hand-built profiles. This suite contains "
              "22 checks and needs neither a browser nor a database."),
        ("blank", None),
        ("p", "Third, npm run test:e2e drives both complete user journeys "
              "against a running server using the real HTTP interface and real "
              "session cookies, then asserts the resulting database state. This "
              "suite contains 67 checks and nothing in it is mocked. It requires "
              "the development server to be running."),
        ("blank", None),
        ("p", "Fourth, npm run screenshots captures every major screen at "
              "desktop, tablet and mobile widths through Playwright, so the "
              "implementation can be compared against the approved reference "
              "designs and horizontal overflow can be seen."),
        ("blank", None),
        ("p", "Manual exploratory testing covers anything the automated suites "
              "do not reach. Defects found by any layer are recorded in "
              "[ISSUE TRACKER] with the steps needed to reproduce them."),
    ]),

    ("Pass/Fail Criteria", [
        ("p", "A test run passes when all 22 matching-engine checks pass, all 67 "
              "end-to-end checks pass, and npm run typecheck reports no errors. "
              "Any failing check fails the run."),
        ("blank", None),
        ("p", "A defect is classified as high severity when it prevents a user "
              "from completing a journey, exposes data belonging to another user "
              "or organisation, or causes the match score shown to a student to "
              "differ from the eligibility verdict shown to a funder. The system "
              "is not accepted for submission while any high-severity defect "
              "remains open."),
    ]),

    ("Suspension Criteria", [
        ("p", "Testing should be paused immediately if users cannot sign in, if "
              "the database is unavailable or its migrations fail to apply, or "
              "if the seeded demo data cannot be loaded. Testing should also be "
              "paused if a defect is found that exposes one user's data to "
              "another, because every later result would be unsafe to trust "
              "until that is corrected. Testing resumes once the blocking defect "
              "is fixed and the affected checks pass again."),
    ]),

    ("Test Deliverables", [
        ("p", "The deliverables of this testing project are this test plan, the "
              "output of each test run showing the checks that passed and "
              "failed, the list of defects recorded during testing, and a test "
              "summary report prepared at the end of each round."),
    ]),

    ("Testing Tasks", [
        ("p", "The following activities must be completed:"),
        (1, "Test plan prepared."),
        (1, "Software Requirements Specification and Software Design Description "
            "delivered to the testing team."),
        (1, "Environment prepared: Node.js 20 or later installed, PostgreSQL "
            "running, the database created and migrated, and the demo data seeded."),
        (1, "Automated suites run and their output recorded."),
        (1, "Manual exploratory testing performed on the journeys the automated "
            "suites do not reach."),
        (1, "Defects recorded and assigned."),
        (1, "Defects fixed and the affected checks re-run."),
        (1, "Test summary report prepared."),
    ]),

    ("Environmental Needs", [
        ("p", "Testing requires a machine with Node.js 20 or later and "
              "PostgreSQL 16. Node.js 20 is the floor because Playwright, which "
              "drives the interface checks, requires it."),
        ("blank", None),
        ("p", "The repository must contain a .env file holding DATABASE_URL and "
              "AUTH_SECRET. The database must be created and its migrations "
              "applied with npm run db:deploy, and the demo data loaded with "
              "npm run db:seed. The seed creates the standardised catalogue, "
              "fictional funders with published programmes, a spread of students "
              "and applications at every stage of review, which gives the "
              "matching engine data to work against."),
        ("blank", None),
        ("p", "The end-to-end suite needs the development server running on "
              "http://localhost:3000. Two demo accounts are used for manual "
              "testing: student@demo.bursarybridge.local and "
              "corporate@demo.bursarybridge.local."),
    ]),

    ("Responsibilities", [
        ("p", "The Test Manager, [TEST MANAGER], is responsible for facilitating "
              "the testing project, preparing the test environment, coordinating "
              "the availability of the testers, reviewing the results of each "
              "test run and reporting back to the project team."),
        ("blank", None),
        ("p", "The testers are responsible for running the automated suites, "
              "performing the manual checks assigned to them, and recording each "
              "defect with the steps needed to reproduce it. The developers are "
              "responsible for fixing recorded defects and confirming that the "
              "affected checks pass again."),
    ]),

    ("Staffing And Training Needs", [
        ("p", "Testing is carried out by the project team. Each tester should "
              "work through both the student journey and the corporate journey, "
              "so that no journey is only ever seen by one person."),
        ("blank", None),
        ("p", "Testers need no specialist tools beyond the repository itself, but "
              "they must be able to run the project locally and read the output "
              "of the test scripts. Before testing begins they should read "
              "Section 3.2 of the Software Requirements Specification, so that "
              "the expected behaviour of each use case is clear, and they should "
              "understand how the six weighted criteria produce a match score, "
              "so that an incorrect score is recognised rather than accepted."),
    ]),

    ("Schedule", [
        ("p", "Testing takes place between [TESTING START DATE] and "
              "[TESTING END DATE], before the submission date of "
              "[SUBMISSION DATE]. The first round of testing should be completed "
              "within [DURATION OF FIRST ROUND], leaving time for defects to be "
              "fixed and the affected checks to be re-run before the final round."),
        ("blank", None),
        ("p", "The automated suites are quick enough to be run on every change. "
              "The manual checks should be scheduled once the environment is "
              "prepared and the seeded data is in place."),
    ]),

    ("Risks And Contingencies", [
        ("p", "If the environment is not prepared correctly, testing cannot "
              "start. Three failures have been seen in practice: PostgreSQL not "
              "running, Node.js older than version 20, and scripts run outside "
              "the application that do not read the .env file. The setup script "
              "in the repository addresses all three, and testers should use it "
              "rather than preparing the environment by hand."),
        ("blank", None),
        ("p", "If the demo data is reseeded during a round of testing, results "
              "recorded earlier in that round may no longer be reproducible, "
              "because reseeding clears and rebuilds the data. Reseeding should "
              "therefore be done at the start of a round rather than during it."),
        ("blank", None),
        ("p", "If the testers do not understand how a match score is produced, "
              "an incorrect score may be accepted as correct. The training "
              "described above reduces this risk. If the first round of testing "
              "is not completed on schedule, it could delay defect fixes and the "
              "final round; the contingency is to prioritise the checks that "
              "cover access control and the matching engine, because a defect in "
              "either is the most serious kind this system can have."),
    ]),

    ("Approvals", [
        ("p", "The Test Manager, [TEST MANAGER], and the Project Supervisor, "
              "Mr Isiah Adebayo, must both agree that the testing project is "
              "complete and determine when the system is ready for submission."),
    ]),
]

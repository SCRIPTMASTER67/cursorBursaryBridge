"""
Content of the Software Design Description.

Every statement here is drawn from the implemented system: the Prisma schema,
the route handlers under app/api, the service layer, and the modules under lib.
Where a value is a matter of configuration rather than design it is given as it
stands in the repository.
"""

PROJECT = "Bursary-Bridge"
SUPERVISOR = "Mr Isiah Adebayo"
SUBMIT_DATE = "September 2026"
STUDENTS = [
    ("1.  CPP Mchunu", "202242486"),
    ("2.  A Nsibande", "240079346"),
    ("3.  KN Bikile", "202356797"),
    ("4.  SP Tshazi", "240103222"),
    ("5.", ""),
    ("6.", ""),
]

# ---------------------------------------------------------------------------
# 1.1 Purpose
# ---------------------------------------------------------------------------
PURPOSE = [
    "This Software Design Description presents the design of Bursary-Bridge, a "
    "web application that connects South African students with bursaries, "
    "scholarships and other education funding, and gives the organisations that "
    "fund education a place to publish those opportunities and administer the "
    "applications they attract. It describes the design entities that make up "
    "the system, the responsibilities of each, the interfaces between them, the "
    "structure of the stored data and the way the use cases stated in the "
    "Software Requirements Specification are realised by those entities.",

    "The expected audience is the Department of Computer Science at the "
    "University of Zululand, including the project supervisor and the studio "
    "committee, together with any developer who is asked to extend or maintain "
    "the system. The reader is assumed to be familiar with the Software "
    "Requirements Specification for Bursary-Bridge, to which this document is a "
    "companion; requirements are not restated here except where a design "
    "decision cannot be understood without them.",
]

# ---------------------------------------------------------------------------
# 1.2 Scope
# ---------------------------------------------------------------------------
SCOPE = [
    "This document contains a complete description of the design of "
    "Bursary-Bridge as implemented in the prototype.",

    "The architecture is a single web application served from one process. It "
    "is built on Next.js 15 using the App Router, with React 19 components "
    "rendered on the server by default, TypeScript throughout and Tailwind CSS "
    "for presentation. Persistent state is held in PostgreSQL and reached "
    "through Prisma. The application exposes two portals over one codebase and "
    "one database: a Student portal and a Corporate portal.",

    "The system recognises exactly two roles, STUDENT and CORPORATE. A Student "
    "builds a profile, receives ranked funding opportunities with the reasons "
    "behind each score, and applies using the profile already captured. A "
    "Corporate User states an organisation's funding criteria as structured "
    "data, publishes funding programmes, and moves applicants through review, "
    "shortlisting and selection. No administrative, university or government "
    "role exists in the system.",

    "The prototype does not disburse funds, does not verify submitted documents "
    "against any external authority, and does not integrate with the "
    "administration systems of universities or of government. Those lie outside "
    "the scope of this release and are not designed for in this document.",
]

# ---------------------------------------------------------------------------
# 1.3 Glossary
# ---------------------------------------------------------------------------
GLOSSARY = [
    ("Applicant", "A Student who has submitted an Application to a Funding Programme."),
    ("Application", "A Student's formal request for funding under a specific Funding "
                    "Programme, carrying a status, the match score recorded at "
                    "submission, answers to programme questions and any attached "
                    "Documents."),
    ("App Router", "The Next.js routing model used by the system, in which the "
                   "directory structure under app/ defines both the pages and the "
                   "HTTP route handlers."),
    ("Corporate User", "A representative of an Organisation who administers that "
                       "Organisation's Funding Programmes. Also referred to as the "
                       "Funder."),
    ("Design Entity", "A named component of the design with a distinct "
                      "responsibility, described in Section 3 by its type, "
                      "attributes, resources and operations."),
    ("Eligibility Outcome", "The verdict returned when an Applicant is evaluated "
                            "against a programme's Eligibility Rule: ELIGIBLE, "
                            "NOT_ELIGIBLE or PENDING_VERIFICATION."),
    ("Eligibility Rule", "The machine-readable conditions attached to a Funding "
                         "Programme, held as typed columns rather than free text."),
    ("Funding Programme", "A bursary, scholarship or grant published by an "
                          "Organisation, to which Students may apply."),
    ("Guard", "A server-side function that establishes the caller's identity and "
              "role and returns the identifiers used to scope every subsequent "
              "database query."),
    ("Match Score", "A percentage from 0 to 100 expressing how closely a Student's "
                    "profile fits a Funding Programme, produced by the Matching "
                    "Engine."),
    ("Matching Engine", "The pure component that scores a Student profile against a "
                        "Funding Programme across six weighted criteria and returns "
                        "both the score and the reasons behind it."),
    ("Organisation", "A corporation, foundation, non-governmental organisation or "
                     "other body that funds education through the system."),
    ("Prisma", "The type-safe object relational mapper through which all database "
               "access passes."),
    ("Programme", "A standardised course of study held in the catalogue, distinct "
                  "from a Funding Programme."),
    ("Route Handler", "A server-side function under app/api that answers an HTTP "
                      "request, validates its body and calls the service layer."),
    ("Server Component", "A React component rendered on the server, able to query "
                         "the database directly and never shipped to the browser."),
    ("Service Layer", "The modules under services/ that hold the read and write "
                      "logic shared by pages and route handlers."),
    ("Session", "A server-side record identifying a signed-in user, addressed by an "
                "opaque token held in an httpOnly cookie."),
    ("Study Preference", "A course paired with the institution at which the Student "
                         "wishes to study it, held as one record."),
    ("Zod", "The schema library used to validate every request body on the server."),
]

# ---------------------------------------------------------------------------
# 1.4 References
# ---------------------------------------------------------------------------
REFERENCES = [
    "[IEEE] The applicable IEEE standards are published in “IEEE Standards",
    "Collection,” 2001 edition. IEEE 1016 Recommended Practice for Software",
    "Design Descriptions provides the structure adopted by this document.",
    "",
    "[SRS] “Software Requirements Specification: Bursary-Bridge, A Bursary and",
    "Scholarship Matching Platform.” Department of Computer Science,",
    "University of Zululand, 2026. All Section 3.2 cross references in Section 5",
    "of this document refer to that specification.",
    "",
    "[Next] Next.js 15 documentation, App Router. Vercel, 2025.",
    "",
    "[Prisma] Prisma ORM documentation, version 6. Prisma Data, Inc., 2025.",
    "",
    "[POPIA] Protection of Personal Information Act 4 of 2013, Republic of South",
    "Africa.",
]

# ---------------------------------------------------------------------------
# 1.5 Overview of document
# ---------------------------------------------------------------------------
OVERVIEW = [
    "The remaining chapters and their contents are listed below.",
    "Section 2 is a Deployment Diagram showing the physical nodes on which the "
    "system runs and the artefacts placed on each, so that the location of every "
    "part of the system is unambiguous.",
    "Section 3 is the Architecture Design. It identifies the design entities that "
    "collaborate to perform the functions of the system and describes each by its "
    "name, type, description, attributes, resources and operations, in the manner "
    "recommended by IEEE 1016.",
    "Section 4 concerns the Data Structure Design, giving the logical structure of "
    "the stored data and the type and size of each field.",
    "Section 5 contains the Use Case Realizations. Each use case is traced from "
    "the Software Requirements Specification to the design objects that carry it "
    "out, and is illustrated by a sequence diagram.",
    "Section 6 discusses the User Interface Design and shows the implemented "
    "screens.",
    "Section 7 covers the help system.",
    "Section 8 is the index.",
]

# ---------------------------------------------------------------------------
# 2.0 Deployment
# ---------------------------------------------------------------------------
DEPLOYMENT = [
    "Bursary-Bridge is deployed as a single Node.js process serving both portals, "
    "with PostgreSQL as the only persistent store. The browser is the sole client; "
    "no native application is distributed.",
    "The application node runs the Next.js server, which renders the React server "
    "components, executes the route handlers under app/api and hosts the Matching "
    "Engine in process. The Matching Engine is not a separate service: it is a "
    "pure TypeScript module with no input or output of its own, which is what "
    "allows the same scoring code to run when a Student views their matches and "
    "when a Corporate User reviews an applicant.",
    "The database node runs PostgreSQL and is reached only by the application "
    "node, over a connection string held in the environment rather than in source "
    "control. No client ever addresses the database directly.",
    "Uploaded documents are held outside the public web root. In the prototype "
    "they are written to a directory on the application node; when STORAGE_DRIVER "
    "is set to s3 the same interface writes to S3-compatible object storage "
    "instead, and no calling code changes. Documents are never served as static "
    "files: every retrieval passes through an authorised route handler.",
    "The one cooperating system is an electronic mail service, used for address "
    "verification and for notifications raised when an application changes status. "
    "The prototype's default driver writes these messages to the server console; "
    "the system takes no decision that depends on their delivery.",
]

# ---------------------------------------------------------------------------
# 3.0 Architecture
# ---------------------------------------------------------------------------
ARCH_INTRO = [
    "The system is layered. The browser holds presentation only. The application "
    "node holds the pages, the route handlers, the service layer and the pure "
    "domain modules. The database holds all persistent state. Requests move "
    "downward through the layers and data moves upward; no layer reaches past the "
    "one beneath it.",
    "Two properties of this arrangement carry most of the design. The first is "
    "that authorisation is established at the top of every server-side entry "
    "point by a guard, which returns the identifiers that then scope every query, "
    "so an authorisation failure is a missing identifier rather than a forgotten "
    "check. The second is that the Matching Engine is pure: it imports neither "
    "Prisma nor React, receives plain data structures and returns a score with its "
    "reasons, which makes it independently testable and prevents the score shown "
    "to a Student from diverging from the verdict shown to a Funder.",
    "The design entities that follow are the components of the system. Each is "
    "described by its name, type, description, attributes, resources and "
    "operations.",
]

# Each entity: name, type, description [paras], attributes [lines],
# resources [lines], operations [ {name, arguments, returns, pre, post,
# exceptions, flow [steps]} ].
ARCHITECTURE = [
    {
        "name": "Student Portal",
        "type": "Set of web pages",
        "description": [
            "The Student Portal is the set of screens presented to a user holding "
            "the STUDENT role. It comprises the dashboard, the opportunities list, "
            "the opportunity detail and application screens, the applications "
            "tracker, the document library, the notification list, the account "
            "settings and the seven-step onboarding sequence that builds the "
            "profile.",
            "The pages are React server components. They query the service layer "
            "directly during rendering rather than fetching from the application's "
            "own HTTP interface, so the first paint carries real data and no "
            "loading state is shown for content the server already holds. Only the "
            "interactive parts, principally the forms, are client components.",
            "Every page under /student and /onboarding calls a guard before it "
            "reads anything. A visitor without a session never reaches these pages: "
            "the edge middleware redirects them to the login screen and preserves "
            "the path they were heading for.",
        ],
        "attributes": [
            "Route prefix: /student, /onboarding/student",
            "Rendering: server components, with client components for forms",
            "Guard: requireStudent(), requireOnboardedStudent()",
        ],
        "resources": [
            "Service layer: matching, student-profile, student-summary, "
            "profile-strength, notifications",
            "Authentication and Session Module",
        ],
        "operations": [
            {
                "name": "viewDashboard()",
                "arguments": "None",
                "returns": "Rendered page",
                "pre": "The Student holds a valid session",
                "post": "The dashboard is displayed with the profile strength, the "
                        "strongest matches and the state of any open applications",
                "exceptions": "No session: the user is redirected to the login page",
                "flow": [
                    "The Student requests the dashboard.",
                    "The guard establishes the identity and returns the student "
                    "profile identifier.",
                    "The page asks the service layer for the profile summary and "
                    "the ranked opportunities.",
                    "The Matching Engine scores each published programme against "
                    "the profile.",
                    "The page is rendered with the results and returned.",
                ],
            },
            {
                "name": "completeOnboardingStep()",
                "arguments": "Step name, submitted form values",
                "returns": "Redirect to the next step",
                "pre": "The Student holds a valid session",
                "post": "The step is saved, the profile strength is recalculated "
                        "and the Student is advanced to the next step",
                "exceptions": "Validation failure: the step is redisplayed with "
                              "messages against the offending fields and nothing is "
                              "written",
                "flow": [
                    "The Student completes the fields of the current step.",
                    "The values are submitted to the onboarding route handler.",
                    "The handler validates them against the step's schema.",
                    "The service layer writes the values and records the step "
                    "reached, so an interrupted profile can be resumed.",
                    "The Student is advanced to the next step.",
                ],
            },
        ],
    },
    {
        "name": "Corporate Portal",
        "type": "Set of web pages",
        "description": [
            "The Corporate Portal is the set of screens presented to a user holding "
            "the CORPORATE role. It comprises the dashboard, the funding programme "
            "list and editor, the applications table, the applicant review screen, "
            "the shortlists, the beneficiaries, the reports, the organisation "
            "profile and the four-step organisation onboarding sequence.",
            "Every read performed by these pages is scoped to the organisation "
            "identifier returned by the guard. A Corporate User cannot address "
            "another organisation's programmes or applications, because no query "
            "in the portal is written without that identifier in its filter.",
            "The applicant review screen presents the eligibility verdict and the "
            "reasons behind it alongside the applicant's profile. The verdict is "
            "produced by the same criteria that generated the Student's match "
            "score, so the two views of a single pairing cannot disagree.",
        ],
        "attributes": [
            "Route prefix: /corporate, /onboarding/organisation",
            "Rendering: server components, with client components for forms and "
            "filters",
            "Guard: requireCorporate()",
        ],
        "resources": [
            "Service layer: applicants, shortlists, corporate-stats, "
            "organisation-summary, notifications",
            "Eligibility Service",
            "Authentication and Session Module",
        ],
        "operations": [
            {
                "name": "reviewApplicant()",
                "arguments": "Application identifier",
                "returns": "Rendered page",
                "pre": "The Corporate User holds a valid session and the "
                       "application belongs to their Organisation",
                "post": "The applicant's profile, eligibility verdict and reasons "
                        "are displayed",
                "exceptions": "The application belongs to another Organisation: the "
                              "record is not found and the request is refused",
                "flow": [
                    "The Corporate User selects an application.",
                    "The guard returns the organisation identifier.",
                    "The service layer loads the application, filtered by that "
                    "identifier as well as by the application identifier.",
                    "The Eligibility Service evaluates the applicant against the "
                    "programme's Eligibility Rule.",
                    "The page is rendered with the verdict and the reason for each "
                    "criterion.",
                ],
            },
            {
                "name": "publishProgramme()",
                "arguments": "Funding programme identifier",
                "returns": "Updated programme status",
                "pre": "The programme is in DRAFT and its eligibility criteria are "
                       "complete",
                "post": "The programme status becomes PUBLISHED and it becomes "
                        "visible to matching Students",
                "exceptions": "Incomplete criteria: publication is refused and the "
                              "missing items are named",
                "flow": [
                    "The Corporate User opens a draft programme.",
                    "The system checks that the programme carries an Eligibility "
                    "Rule and the fields a match requires.",
                    "The Corporate User confirms publication.",
                    "The status is set to PUBLISHED and the change is written to "
                    "the audit log.",
                    "The programme enters the pool the Matching Engine scores.",
                ],
            },
        ],
    },
    {
        "name": "Authentication and Session Module",
        "type": "Server-side module",
        "description": [
            "This module establishes and carries identity. It hashes and verifies "
            "passwords, issues and destroys sessions, resolves the current user "
            "from the request, and provides the guards that every protected entry "
            "point calls before it reads or writes anything.",
            "A session token is a random 32-byte value encoded for transport and "
            "handed to the browser in a cookie marked httpOnly, SameSite=Lax and, "
            "outside development, Secure. Only the SHA-256 hash of the token, "
            "salted with the application secret, is stored, so a database dump "
            "cannot be replayed as a login. Tokens expire fourteen days after "
            "issue.",
            "Passwords are hashed with bcrypt at a cost factor of 12. The password "
            "policy is declared once and used both by the client-side strength "
            "hint and by the server-side schema, so the two cannot drift apart.",
            "The guards are the authorisation mechanism of the whole system. "
            "requireStudent() and requireCorporate() return the profile or "
            "organisation identifier of the caller, and that identifier is placed "
            "in the filter of every query the caller's request goes on to make. "
            "Authorisation is therefore not a check that can be omitted but a value "
            "without which no query can be written.",
        ],
        "attributes": [
            "Session cookie name: bb_session",
            "Session lifetime: 14 days",
            "Token: 32 random bytes, stored as a salted SHA-256 hash",
            "Password hash: bcrypt, cost factor 12",
            "Roles: STUDENT, CORPORATE",
        ],
        "resources": [
            "Bursary-Bridge Database (User, Session and VerificationToken tables)",
            "AUTH_SECRET from the environment",
        ],
        "operations": [
            {
                "name": "createSession()",
                "arguments": "User identifier, user agent, network address",
                "returns": "No return value",
                "pre": "The credentials presented have been verified",
                "post": "A session record exists and the browser holds the cookie",
                "exceptions": "None",
                "flow": [
                    "A token of 32 random bytes is generated.",
                    "Its salted SHA-256 hash is written to the Session table with "
                    "an expiry fourteen days ahead.",
                    "The token itself is set as an httpOnly cookie on the response.",
                ],
            },
            {
                "name": "requireStudent()",
                "arguments": "None",
                "returns": "The signed-in user and their student profile identifier",
                "pre": "None",
                "post": "The caller holds an identifier that scopes its queries",
                "exceptions": "No session, an expired session, or a user whose role "
                              "is not STUDENT: the request is redirected to the "
                              "login page, or answered 401 when it arrived at the "
                              "application programming interface",
                "flow": [
                    "The session cookie is read from the request.",
                    "Its hash is looked up in the Session table.",
                    "An expired or unknown session is rejected.",
                    "The user's role is checked.",
                    "The student profile identifier is returned to the caller.",
                ],
            },
            {
                "name": "verifyPassword()",
                "arguments": "Submitted password, stored hash",
                "returns": "Boolean",
                "pre": "None",
                "post": "None",
                "exceptions": "None",
                "flow": [
                    "The submitted password is compared against the stored bcrypt "
                    "hash.",
                    "The result is returned without revealing whether the address "
                    "or the password was at fault.",
                ],
            },
        ],
    },
]

ARCHITECTURE += [
    {
        "name": "Matching Engine",
        "type": "Pure domain module",
        "description": [
            "The Matching Engine scores a Student profile against a Funding "
            "Programme and returns both a percentage and the reason for every "
            "criterion that contributed to it. It is the component that gives the "
            "system its purpose, and it is deliberately pure: it imports neither "
            "Prisma nor React, takes plain data structures as arguments and "
            "performs no input or output. It can therefore be tested in isolation "
            "and executed in any context.",
            "Six criteria are evaluated, each carrying a fixed weight: course 30, "
            "institution 25, academic 20, qualification level 10, location 10 and "
            "financial 5, totalling 100. A criterion that cannot be evaluated "
            "because the profile does not yet carry the information earns half "
            "credit rather than zero, so an incomplete profile is not treated as a "
            "failed one, while the gap still lowers the score and is reported as "
            "needing verification. When more than 25 points of weight are "
            "unevaluable the result is reported as needing more information "
            "whatever the remaining criteria scored.",
            "The score is classified as a strong match at 85 and above, a "
            "potential match from 60 to 84, and more information needed below 60. "
            "The reasons are returned with the score and are always displayed with "
            "it; a percentage is never shown on its own.",
            "All tuning is held in a single configuration module so the weights "
            "and thresholds can be changed, or in future loaded per funder, "
            "without altering evaluation logic or the user interface.",
        ],
        "attributes": [
            "Criterion weights: course 30, institution 25, academic 20, "
            "qualification 10, location 10, financial 5",
            "Unknown credit ratio: 0.5",
            "Maximum unknown weight: 25",
            "Strong match threshold: 85",
            "Potential match threshold: 60",
        ],
        "resources": [
            "None. The engine performs no input or output and holds no state.",
        ],
        "operations": [
            {
                "name": "score()",
                "arguments": "Student profile, funding programme with its "
                             "eligibility rule",
                "returns": "Score, classification and the reason for each criterion",
                "pre": "Both arguments have been adapted from database records into "
                       "the engine's own data structures",
                "post": "None; the engine holds no state",
                "exceptions": "None",
                "flow": [
                    "Each of the six criteria is evaluated in turn.",
                    "A criterion that is met contributes its full weight; one that "
                    "cannot be evaluated contributes half.",
                    "The contributions are summed and expressed as a percentage.",
                    "The unevaluable weight is compared against the maximum.",
                    "The score is classified and returned with its reasons.",
                ],
            },
            {
                "name": "rank()",
                "arguments": "Student profile, list of published funding programmes",
                "returns": "The programmes ordered by descending score",
                "pre": "As for score()",
                "post": "None",
                "exceptions": "None",
                "flow": [
                    "Each programme is scored against the profile.",
                    "The results are ordered by score, highest first.",
                    "The ordered list is returned with each score's reasons intact.",
                ],
            },
        ],
    },
    {
        "name": "Eligibility Service",
        "type": "Pure domain module",
        "description": [
            "The Eligibility Service answers the Funder's question, which is "
            "different from the Student's. Where the Matching Engine asks how well "
            "a profile fits and returns a percentage, the Eligibility Service asks "
            "whether the criteria are met and returns a verdict: ELIGIBLE, "
            "NOT_ELIGIBLE or PENDING_VERIFICATION.",
            "The two share their criteria definitions, which is what guarantees "
            "that the score shown to a Student and the verdict shown to a Funder "
            "are two readings of the same evaluation rather than two independent "
            "calculations that may disagree.",
            "The verdict is evaluated when an application is submitted and stored "
            "on the Application record. Recording it at submission rather than "
            "recomputing it on demand means a Funder reviewing an application sees "
            "the assessment as it stood when the Student applied, and that counts "
            "reported on the dashboard remain stable as profiles and programmes "
            "change afterwards.",
        ],
        "attributes": [
            "Outcomes: ELIGIBLE, NOT_ELIGIBLE, PENDING_VERIFICATION",
            "Criteria: shared with the Matching Engine",
        ],
        "resources": [
            "None. The service performs no input or output.",
        ],
        "operations": [
            {
                "name": "evaluate()",
                "arguments": "Student profile, eligibility rule",
                "returns": "Outcome and the reason for each criterion",
                "pre": "The programme carries an eligibility rule",
                "post": "None",
                "exceptions": "None",
                "flow": [
                    "Each condition of the rule is tested against the profile.",
                    "A condition the profile contradicts yields NOT_ELIGIBLE.",
                    "A condition the profile cannot yet answer yields "
                    "PENDING_VERIFICATION.",
                    "A profile that satisfies every condition yields ELIGIBLE.",
                    "The outcome is returned with the reason for each condition.",
                ],
            },
        ],
    },
    {
        "name": "Application Programming Interface",
        "type": "Set of HTTP route handlers",
        "description": [
            "The application exposes twenty-one route handlers under app/api. They "
            "serve the browser's write operations; reads performed during page "
            "rendering go to the service layer directly and do not pass through "
            "this interface.",
            "Each handler follows the same shape. It calls a guard to establish "
            "identity and role; it parses the request body against a Zod schema and "
            "answers 400 with field-level messages if parsing fails; it calls the "
            "service layer with the identifiers the guard returned; and it answers "
            "with JSON. Validation is performed on the server in every case. The "
            "same schemas are used in the browser to give immediate feedback, but "
            "the browser's result is never trusted.",
            "The handlers answer 401 rather than redirecting, because they are "
            "called by scripts rather than navigated to; the edge middleware "
            "excludes /api from its redirect rules for this reason.",
            "The authentication handlers are rate limited by address and by "
            "account, as are registration, verification email requests, document "
            "uploads and application submissions.",
        ],
        "attributes": [
            "Base path: /api",
            "Handlers: 21",
            "Groups: auth, student, corporate, documents, account, catalog",
            "Validation: Zod schemas under lib/validation",
        ],
        "resources": [
            "Authentication and Session Module",
            "Service layer",
            "Document Storage Service",
        ],
        "operations": [
            {
                "name": "POST /api/auth/login",
                "arguments": "Email address, password",
                "returns": "The signed-in user, or an error",
                "pre": "None",
                "post": "A session exists and the cookie is set",
                "exceptions": "Unknown address or wrong password: 401 with a single "
                              "message that does not reveal which was wrong. Too "
                              "many attempts: 429 with the seconds to wait.",
                "flow": [
                    "The body is validated against the login schema.",
                    "The rate limiter is consulted for the address and the account.",
                    "The user is looked up and the password compared against the "
                    "stored hash.",
                    "A session is created and the cookie set.",
                    "The user's role determines the dashboard the browser is sent "
                    "to.",
                ],
            },
            {
                "name": "POST /api/student/applications",
                "arguments": "Funding programme identifier, answers, attached "
                             "document identifiers",
                "returns": "The created application",
                "pre": "The Student holds a valid session and a completed profile",
                "post": "An application exists carrying the match score, "
                        "classification, reasons and eligibility outcome recorded at "
                        "submission",
                "exceptions": "A second application to the same programme is "
                              "refused. A closed or unpublished programme is refused. "
                              "A missing required answer or document is refused with "
                              "the field named.",
                "flow": [
                    "The guard returns the student profile identifier.",
                    "The body is validated and the programme checked to be open.",
                    "The Matching Engine scores the profile against the programme.",
                    "The Eligibility Service evaluates the same pairing.",
                    "The application is written with the score, the reasons and the "
                    "outcome, a notification is raised and the action is recorded in "
                    "the audit log.",
                ],
            },
        ],
    },
]

ARCHITECTURE += [
    {
        "name": "Document Storage Service",
        "type": "Server-side module",
        "description": [
            "This service holds the files Students upload in support of their "
            "applications: identity documents, academic records, proof of income "
            "and similar. It presents one interface with two implementations, "
            "selected by configuration: a local disk provider used by the "
            "prototype and an S3-compatible provider for deployment. No calling "
            "code touches the filesystem, so the change is to one environment "
            "variable.",
            "Files are held outside the public web root and are never served as "
            "static assets. Every retrieval passes through a route handler that "
            "first establishes who is asking: the Student who owns the document, "
            "or an Organisation to which that document has been attached as part "
            "of an application. Any other request is refused.",
            "Uploads are constrained on the server. The declared content type must "
            "be one of PDF, JPEG, PNG or WebP, and the file must not exceed five "
            "megabytes. Both checks are applied before anything is written.",
        ],
        "attributes": [
            "Drivers: local, s3",
            "Permitted types: application/pdf, image/jpeg, image/png, image/webp",
            "Maximum size: 5 MB",
            "Location: outside the public web root",
        ],
        "resources": [
            "Local filesystem, or S3-compatible object storage",
            "Bursary-Bridge Database (Document and ApplicationDocument tables)",
        ],
        "operations": [
            {
                "name": "put()",
                "arguments": "File contents, declared content type, owning student "
                             "profile",
                "returns": "The stored object's key",
                "pre": "The Student holds a valid session",
                "post": "The file is stored and a Document record refers to it",
                "exceptions": "A type that is not permitted, or a file above five "
                              "megabytes, is rejected before any write occurs",
                "flow": [
                    "The content type is checked against the permitted list.",
                    "The size is checked against the maximum.",
                    "The file is written through the configured provider.",
                    "A Document record is created against the owning profile.",
                ],
            },
            {
                "name": "get()",
                "arguments": "Object key, requesting user",
                "returns": "The file contents",
                "pre": "The requester owns the document, or holds an application to "
                       "which it is attached",
                "post": "None",
                "exceptions": "A requester with neither relationship is refused and "
                              "the document is reported as not found",
                "flow": [
                    "The route handler establishes the requester's identity.",
                    "The document's ownership is checked, and the applications it "
                    "is attached to are checked against the requester's "
                    "organisation.",
                    "The file is streamed through the handler if either holds.",
                ],
            },
        ],
    },
    {
        "name": "Notification and Email Service",
        "type": "Server-side module",
        "description": [
            "This service raises the in-application notifications a user sees in "
            "their notification list and sends the corresponding electronic mail. "
            "Notifications are written to the database and are therefore durable; "
            "mail is a secondary channel and the system takes no decision that "
            "depends on its delivery.",
            "The mail transport is a seam with two drivers. The prototype's driver "
            "writes each message to the server console, which makes address "
            "verification demonstrable without a mail server. Setting EMAIL_DRIVER "
            "to smtp directs the same messages to a development mail catcher or a "
            "transactional provider without altering any call site.",
            "Notifications are raised when an address requires verification, when "
            "an application is submitted, when its status changes, when further "
            "information is requested and when an applicant is shortlisted or "
            "selected.",
        ],
        "attributes": [
            "Drivers: console, smtp",
            "Persistence: Notification table, read state per user",
        ],
        "resources": [
            "Bursary-Bridge Database (Notification table)",
            "Electronic mail service, when configured",
        ],
        "operations": [
            {
                "name": "notify()",
                "arguments": "Recipient, subject, heading, body, optional action",
                "returns": "No return value",
                "pre": "The recipient exists",
                "post": "A notification record exists and mail has been dispatched "
                        "through the configured driver",
                "exceptions": "A mail failure is logged and does not fail the "
                              "operation that raised the notification",
                "flow": [
                    "The notification is written to the database.",
                    "The message is passed to the configured mail driver.",
                    "The result of dispatch is logged and discarded.",
                ],
            },
        ],
    },
    {
        "name": "Bursary-Bridge Database",
        "type": "Relational database",
        "description": [
            "The database is PostgreSQL and is reached only through Prisma. It "
            "holds twenty tables and thirty-five enumerated types. No component "
            "outside the application node addresses it, and no raw connection "
            "string appears in source control.",
            "Two aspects of the structure carry most of the design. The first is "
            "the Study Preference, which pairs a course with the institution at "
            "which the Student wishes to study it and holds the two together as "
            "one record. Courses and institutions are not stored as unrelated "
            "lists, because a Student who wishes to read law at one university and "
            "engineering at another is stating two different things, and a "
            "matching engine given two flat lists cannot tell the difference.",
            "The second is the Eligibility Rule, which holds a funder's conditions "
            "as typed columns rather than as prose. This is what allows the same "
            "conditions to drive both the Student's match score and the Funder's "
            "eligibility verdict.",
            "Referential actions are stated explicitly. A profile's dependants "
            "cascade when it is deleted; catalogue references are restricted so "
            "that an institution in use cannot be removed; optional references are "
            "set to null.",
        ],
        "attributes": [
            "Engine: PostgreSQL",
            "Access: Prisma, version 6",
            "Tables: 20",
            "Enumerated types: 35",
            "Migrations: applied from version-controlled files",
        ],
        "resources": [
            "DATABASE_URL from the environment",
        ],
        "operations": [
            {
                "name": "query()",
                "arguments": "A Prisma query carrying the identifier returned by a "
                             "guard",
                "returns": "Typed records",
                "pre": "The caller has passed a guard",
                "post": "None",
                "exceptions": "A record outside the caller's scope is simply not "
                              "returned, because the scope is part of the filter "
                              "rather than a check applied afterwards",
                "flow": [
                    "The service layer composes the query with the caller's "
                    "identifier in its filter.",
                    "Prisma issues the statement.",
                    "Typed records are returned to the service layer.",
                ],
            },
            {
                "name": "audit()",
                "arguments": "Actor, action, subject",
                "returns": "No return value",
                "pre": "A change has been made",
                "post": "An append-only audit record exists",
                "exceptions": "None",
                "flow": [
                    "The change to an application, programme, shortlist or account "
                    "is written.",
                    "An audit record naming the actor, the action and the subject "
                    "is appended.",
                ],
            },
        ],
    },
]

# ---------------------------------------------------------------------------
# 4.0 Data structure design
# ---------------------------------------------------------------------------
DATA_INTRO = [
    "The data is stored in a relational database managed by PostgreSQL and "
    "reached through Prisma. The schema is declared in one file and applied by "
    "version-controlled migrations, so the structure of a deployed database is "
    "always reproducible from source.",
    "Identifiers are collision-resistant strings generated by the application "
    "rather than sequential integers, so that a record's identifier discloses "
    "neither the number of records held nor the order in which they were "
    "created. Textual fields are stored in PostgreSQL's text type, which is not "
    "fixed width; the sizes given below are therefore the limits imposed by the "
    "validation schemas on the server, which are the limits a user actually "
    "encounters. Fields whose type is an enumerated type are constrained by the "
    "database itself to the values listed in the schema.",
    "The table below gives the fields of the principal entities. Relationship "
    "fields are shown by the entity they refer to rather than by their "
    "identifier column.",
]

# (name, type, size)
DATA_FIELDS = [
    ("Attribute Name", "Attribute Type", "Attribute Size"),
    ("User.email*", "Text", "254"),
    ("User.passwordHash*", "Text", "60 (bcrypt)"),
    ("User.role*", "Enumerated", "STUDENT, CORPORATE"),
    ("User.firstName*", "Text", "60"),
    ("User.lastName*", "Text", "60"),
    ("User.mobile", "Text", "20"),
    ("User.emailVerifiedAt", "Timestamp", "8 bytes"),
    ("Session.tokenHash*", "Text", "64 (SHA-256)"),
    ("Session.expiresAt*", "Timestamp", "8 bytes"),
    ("StudentProfile.qualificationLevel", "Enumerated", "See schema"),
    ("StudentProfile.academicAverage", "Integer", "0 to 100"),
    ("StudentProfile.yearOfStudy", "Integer", "1 to 8"),
    ("StudentProfile.householdIncome", "Enumerated", "Income bands"),
    ("StudentProfile.citizenship", "Enumerated", "See schema"),
    ("StudentProfile.province", "Enumerated", "9 provinces"),
    ("StudentProfile.city", "Text", "80"),
    ("StudentProfile.profileStrength", "Integer", "0 to 100"),
    ("StudyPreference.preferenceNumber*", "Integer", "1 to 6"),
    ("StudyPreference.programme*", "Reference", "Programme"),
    ("StudyPreference.institution*", "Reference", "Institution"),
    ("Organisation.name*", "Text", "120"),
    ("Organisation.type*", "Enumerated", "See schema"),
    ("FundingProgramme.name*", "Text", "120"),
    ("FundingProgramme.fundingType*", "Enumerated", "Bursary, scholarship, grant"),
    ("FundingProgramme.openDate*", "Timestamp", "8 bytes"),
    ("FundingProgramme.closingDate*", "Timestamp", "8 bytes"),
    ("FundingProgramme.status*", "Enumerated", "DRAFT, PUBLISHED, CLOSED"),
    ("EligibilityRule.minAcademicAverage", "Integer", "0 to 100"),
    ("EligibilityRule.qualificationLevels", "Enumerated list", "See schema"),
    ("EligibilityRule.yearsOfStudy", "Integer list", "1 to 8"),
    ("EligibilityRule.maxHouseholdIncome", "Enumerated", "Income bands"),
    ("EligibilityRule.provinces", "Enumerated list", "9 provinces"),
    ("Application.status*", "Enumerated", "See Section 3"),
    ("Application.matchScore", "Integer", "0 to 100"),
    ("Application.matchClassification", "Enumerated", "Strong, potential, more info"),
    ("Application.eligibilityOutcome", "Enumerated", "ELIGIBLE, NOT_ELIGIBLE, PENDING_VERIFICATION"),
    ("Document.mimeType*", "Text", "PDF, JPEG, PNG, WebP"),
    ("Document.sizeBytes*", "Integer", "Maximum 5 242 880"),
]

DATA_NOTES = [
    "Fields marked with an asterisk are required. Fields shown as Reference are "
    "foreign keys to the named entity. Fields shown as Enumerated are constrained "
    "by the database to the values declared in the schema; where the set is long "
    "the schema is cited rather than reproduced.",
    "Two uniqueness constraints carry business meaning rather than mere "
    "housekeeping. A Study Preference is unique on the profile and the preference "
    "number, so the ordering a Student expresses cannot contain duplicates or "
    "gaps in position; and it is unique on the profile, the course and the "
    "institution, so the same pairing cannot be entered twice under different "
    "numbers. An Application is unique on the profile and the funding programme, "
    "so a Student cannot apply twice to the same programme.",
]

# ---------------------------------------------------------------------------
# 5.0 Use case realizations
# ---------------------------------------------------------------------------
SYSTEM_SEQUENCE_NOTE = [
    "The diagram below shows the interaction common to every request the system "
    "serves. A request from the browser reaches the application node, where the "
    "guard resolves the session before anything else occurs, the service layer "
    "composes a query already scoped to the caller, and the result is rendered "
    "and returned. The realizations that follow elaborate this pattern for "
    "individual use cases and omit the steps it has already established.",
]

# title, srs, note, figure file, caption
REALIZATIONS = [
    ("Use Case: Log In", "3.2.1",
     "The Student or Corporate User presents their credentials. The password is "
     "compared against the stored bcrypt hash, a session is created and its token "
     "returned as an httpOnly cookie. The user's role determines the dashboard "
     "they are sent to. A failure names neither the address nor the password as "
     "the cause, and repeated failures are rate limited by address and by "
     "account.",
     "uc_login.png", "Log In Sequence Diagram"),

    ("Use Case: Complete Student Profile", "3.2.7",
     "The Student advances through the onboarding steps. Each step is validated "
     "on the server against its own schema and written before the next is shown, "
     "and the step reached is recorded on the profile, so a Student who leaves "
     "part way through resumes where they stopped rather than starting again. The "
     "profile strength is recalculated after each step and is what prompts the "
     "Student to supply the information that would most improve their matches.",
     "uc_profile.png", "Complete Student Profile Sequence Diagram"),

    ("Use Case: View Matched Opportunities", "3.2.9",
     "The dashboard and the opportunities list both ask the service layer to rank "
     "the published programmes against the Student's profile. The Matching Engine "
     "scores each pairing across the six weighted criteria and returns the score "
     "with the reason for every criterion. The list is ordered by score, and each "
     "entry is displayed with its reasons; a percentage is never presented on its "
     "own.",
     "uc_match.png", "View Matched Opportunities Sequence Diagram"),

    ("Use Case: Apply for Funding", "3.2.12",
     "The Student submits an application against an open programme. The system "
     "scores the pairing and evaluates eligibility at that moment and stores both "
     "results on the application, so the Funder later reviews the assessment as it "
     "stood at submission. A notification is raised for the Student and the action "
     "is appended to the audit log. A second application to the same programme is "
     "refused by a uniqueness constraint rather than by a check that could be "
     "omitted.",
     "uc_apply.png", "Apply for Funding Sequence Diagram"),

    ("Use Case: Create Funding Programme", "3.2.17",
     "The Corporate User describes a programme and states its eligibility "
     "criteria through ordinary form controls. The criteria are written to the "
     "Eligibility Rule as typed columns, not as prose, which is what allows the "
     "same conditions to drive both the Student's match score and the Funder's "
     "eligibility verdict. The programme is created in draft and is invisible to "
     "Students until it is published.",
     "uc_create.png", "Create Funding Programme Sequence Diagram"),

    ("Use Case: Review Applicant", "3.2.21",
     "The Corporate User opens an application belonging to their Organisation. "
     "The guard returns the organisation identifier and it forms part of the "
     "query, so an application belonging to another Organisation is not found "
     "rather than refused after being read. The Eligibility Service evaluates the "
     "applicant against the programme's rule and the verdict is displayed with "
     "the reason for each condition.",
     "uc_review.png", "Review Applicant Sequence Diagram"),

    ("Use Case: Shortlist Applicant", "3.2.22",
     "The Corporate User adds an applicant to the shortlist for a programme. The "
     "application's status is advanced, a shortlist entry is created, the "
     "applicant is notified and the change is appended to the audit log. The "
     "operation is scoped to the Organisation throughout.",
     "uc_shortlist.png", "Shortlist Applicant Sequence Diagram"),
]

# ---------------------------------------------------------------------------
# 6.0 Interface design
# ---------------------------------------------------------------------------
INTERFACE_INTRO = [
    "The interface follows the approved reference designs, which are the visual "
    "source of truth for the system. It is laid out on a single palette and type "
    "scale expressed as Tailwind tokens, so that a change to a colour or a "
    "spacing step is made once and applies everywhere.",
    "The layout is responsive rather than merely legible at small sizes. Many "
    "Students will reach the system on a mobile telephone, and some over a "
    "metered or intermittent connection, so the screens are laid out for narrow "
    "viewports as well as wide, wide content such as tables and reports scrolls "
    "within its own container rather than forcing the page sideways, and the "
    "profile is gathered in short steps that can be left and resumed.",
    "Two principles govern the presentation of a match. The first is that a "
    "score is explained rather than merely asserted: the opportunity detail "
    "screen sets out every criterion, states whether it was met and names the "
    "weight it carried, so a Student can see why a programme scored as it did "
    "and what would improve it. The second is that a criterion the system could "
    "not evaluate is labelled as needing verification rather than being "
    "silently treated as a failure.",

    "The screens reproduced below are captured from the running system rather "
    "than drawn, so they show the interface as implemented.",
]

# filename, caption. Written by make_figures.py from the capture run, so the
# document lists exactly the screens that were captured.
import json as _json
import os as _os

INTERFACE_SHOTS = []
if _os.path.exists("interface_shots.json"):
    with open("interface_shots.json") as _fh:
        INTERFACE_SHOTS = [tuple(row) for row in _json.load(_fh)]

# ---------------------------------------------------------------------------
# 7.0 Help system design
# ---------------------------------------------------------------------------
HELP_SYSTEM = [
    "The system carries contextual guidance rather than a separate help "
    "application. Wherever the system asks for something it says why it is being "
    "asked, each onboarding step carries a short explanation of how the "
    "information affects matching, and every match is accompanied by the reasons "
    "behind its score, which is the explanation a Student most often needs.",
    "A help page is provided at /help, together with the terms of service and "
    "the privacy notice, which states what is collected and why. No indexed help "
    "system, guided tour or offline documentation is planned for this release.",
]

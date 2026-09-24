"""
Generate the diagrams used by the SDD.

Every figure is placed in a 6 inch text column, so a label's size on the page is
font_px / image_width * 432 points. `report()` prints that figure by figure,
which is what keeps the type legible rather than merely present.
"""
import os
from PIL import Image
import diagrams as D
from content import REALIZATIONS

OUT = "figures"
os.makedirs(OUT, exist_ok=True)


def report(name, font_px, max_width_in=6.0):
    w, h = Image.open(f"{OUT}/{name}").size
    width_in = min(max_width_in, w / 96)
    pt = font_px / w * width_in * 72
    flag = "  <-- SMALL" if pt < 6.5 else ""
    print(f"  {name:26s} {w:5d}x{h:<5d} {width_in:4.2f}in x {width_in*h/w:5.2f}in"
          f"  label {pt:4.1f}pt{flag}")


# ---------------------------------------------------------------------------
# Figure 1 - Deployment diagram
# ---------------------------------------------------------------------------
def deployment():
    D.boxes(
        f"{OUT}/fig1_deployment.png",
        nodes=[
            ("Client Device\n(Web Browser)", 90, 260),
            ("Application Node\nNext.js Server", 470, 260),
            ("Matching Engine\n(in process)", 470, 60),
            ("Document Store\n(local or S3)", 470, 460),
            ("Database Node\nPostgreSQL", 850, 160),
            ("Email Service", 850, 360),
            ("Published Bursary\nSources (HTTPS)", 850, 560),
        ],
        edges=[(0, 1, "HTTPS"), (1, 2, ""), (1, 3, "file"),
               (1, 4, "TCP 5432"), (1, 5, "SMTP"), (1, 6, "HTTPS, read only")],
        box_w=250, box_h=104, font_px=17,
    )
    report("fig1_deployment.png", 17)


# ---------------------------------------------------------------------------
# Figure 2 - Architecture design
# ---------------------------------------------------------------------------
def architecture():
    """
    A strict grid: each layer is a row, and the collaborators of the service
    layer share one row with a deliberate gap at the centre, so the line from
    the service layer to the database passes between them rather than through
    one of them. The Matching Engine and the Eligibility Service carry no line
    to the database because they hold no state and perform no input or output.
    """
    D.boxes(
        f"{OUT}/fig2_architecture.png",
        nodes=[
            ("Student Portal", 120, 72),                        # 0
            ("Corporate Portal", 460, 72),                      # 1
            ("Administration Portal", 800, 72),                 # 2
            ("Edge Middleware", 460, 212),                      # 3
            ("Application Programming Interface", 460, 352),    # 4
            ("Authentication and Session Module", 810, 352),    # 5
            ("Service Layer", 460, 492),                        # 6
            ("Matching Engine", 20, 680),                       # 7
            ("Eligibility Service", 250, 680),                  # 8
            ("Document Extraction Engine", 480, 680),           # 9
            ("Application Import Pipeline", 710, 680),          # 10
            ("Bursary Ingestion Pipeline", 940, 680),           # 11
            ("Motivational Letter Composer", 20, 860),          # 12
            ("Document Storage Service", 250, 860),             # 13
            ("Notification and Email Service", 940, 860),       # 14
            ("Bursary-Bridge Database", 590, 1020),             # 15
        ],
        edges=[
            (0, 3, ""), (1, 3, ""), (2, 3, ""), (3, 4, ""),
            (4, 5, ""), (4, 6, ""),
            (6, 7, ""), (6, 8, ""), (6, 9, ""), (6, 10, ""), (6, 11, ""),
            (6, 12, ""), (6, 13, ""), (6, 14, ""),
            (6, 15, ""), (13, 15, ""), (14, 15, ""), (11, 15, ""),
        ],
        box_w=210, box_h=104, font_px=16,
    )
    report("fig2_architecture.png", 17)


# ---------------------------------------------------------------------------
# Figure 3 - System sequence diagram
# ---------------------------------------------------------------------------
def system_sequence():
    D.sequence(
        f"{OUT}/fig3_system.png",
        ["User", "Browser", "Application Node", "Database"],
        [
            (0, 1, "performs action", "call"),
            (1, 2, "HTTPS request", "call"),
            (2, 2, "guard resolves session()"),
            (2, 2, "scope query to caller()"),
            (2, 3, "query()"),
            (3, 2, "typed records"),
            (2, 1, "rendered response"),
            (1, 0, "displays outcome"),
        ],
    )
    report("fig3_system.png", 16)


# ---------------------------------------------------------------------------
# Figures 4 onwards - one sequence diagram per use case realization
#
# Four lifelines and short message labels, because both the participant count
# and the longest label set the image width, and the width is what decides how
# large the type can be once the figure is placed in a 6 inch column.
# ---------------------------------------------------------------------------
SEQUENCES = {
    "uc_directory.png": (
        ["Student", "Directory Page", "Directory Service", "Database"],
        [
            (0, 1, "GET /student/bursaries", "call"),
            (1, 1, "guard requireStudent()"),
            (1, 2, "listDirectory(filters)"),
            (2, 3, "published programmes()"),
            (3, 2, "rows with dates and provenance"),
            (2, 2, "derive display status()"),
            (2, 1, "ordered list and counts"),
            (1, 0, "directory, open first"),
        ],
    ),
    "uc_letter.png": (
        ["Student", "Letters Handler", "Letter Service", "Composer", "Database"],
        [
            (0, 1, "write a letter", "call"),
            (1, 1, "guard()"),
            (1, 2, "generateLetter()"),
            (2, 4, "read facts()"),
            (4, 2, "facts, results"),
            (2, 4, "requirements()"),
            (4, 2, "stated minimums"),
            (2, 3, "compose()"),
            (3, 2, "draft, answers used"),
            (2, 4, "store letter()"),
            (2, 1, "letter, gaps"),
            (1, 0, "draft"),
        ],
    ),
    "uc_autofill.png": (
        ["Student", "Auto-Fill Handler", "Auto-Fill Service",
         "Extraction Engine", "Storage"],
        [
            (0, 1, "completed form", "call"),
            (1, 2, "createJob()"),
            (2, 4, "store source()"),
            (2, 3, "readSourceForm()"),
            (3, 2, "values, confidence"),
            (0, 1, "blank forms", "call"),
            (2, 3, "analyse fields()"),
            (3, 2, "detected fields"),
            (2, 2, "match, validate()"),
            (2, 4, "write forms()"),
            (2, 1, "filled, flagged, failed"),
            (1, 0, "review screen"),
        ],
    ),
    "uc_import.png": (
        ["Corporate User", "Import Handler", "Import Pipeline",
         "Extraction Engine", "Database"],
        [
            (0, 1, "upload forms", "call"),
            (1, 1, "guard apiCorporate()"),
            (1, 2, "createBatch()"),
            (2, 4, "store every file()"),
            (2, 3, "readSourceForm()"),
            (3, 2, "fields, confidence"),
            (2, 4, "find student()"),
            (4, 2, "verified match only"),
            (2, 2, "score, check docs()"),
            (2, 2, "flag duplicates()"),
            (2, 4, "record outcomes()"),
            (2, 1, "batch ready"),
            (1, 0, "review screen"),
        ],
    ),
    "uc_confirm.png": (
        ["Corporate User", "Import Handler", "Import Pipeline", "Database"],
        [
            (0, 1, "correct a field", "call"),
            (1, 3, "keep both values()"),
            (0, 1, "confirm import", "call"),
            (1, 2, "confirmImport()"),
            (2, 3, "create application()"),
            (2, 3, "link to document()"),
            (2, 1, "imported, discarded"),
            (1, 0, "result"),
        ],
    ),
    "uc_login.png": (
        ["Student", "Auth Handler", "Session Module", "Database"],
        [
            (0, 1, "POST /auth/login", "call"),
            (1, 1, "validate, rate limit()"),
            (1, 3, "find user by email()"),
            (3, 1, "user record"),
            (1, 2, "verify password()"),
            (2, 1, "match"),
            (2, 3, "create session()"),
            (1, 0, "cookie set, role"),
        ],
    ),
    "uc_profile.png": (
        ["Student", "Onboarding Handler", "Profile Service", "Database"],
        [
            (0, 1, "POST onboarding step", "call"),
            (1, 1, "guard requireStudent()"),
            (1, 1, "validate step schema()"),
            (1, 2, "saveStep()"),
            (2, 3, "write profile fields()"),
            (2, 2, "recalculate strength()"),
            (2, 1, "next step"),
            (1, 0, "next step shown"),
        ],
    ),
    "uc_match.png": (
        ["Student", "Matching Service", "Matching Engine", "Database"],
        [
            (0, 1, "open opportunities", "call"),
            (1, 1, "guard requireStudent()"),
            (1, 3, "load profile, programmes()"),
            (3, 1, "records"),
            (1, 2, "rank()"),
            (2, 2, "score six criteria()"),
            (2, 1, "scores with reasons"),
            (1, 0, "matches with reasons"),
        ],
    ),
    "uc_apply.png": (
        ["Student", "Application Handler", "Matching, Eligibility", "Database"],
        [
            (0, 1, "POST application", "call"),
            (1, 1, "guard and validate()"),
            (1, 2, "score()"),
            (2, 1, "score and reasons"),
            (1, 2, "evaluate()"),
            (2, 1, "eligibility outcome"),
            (1, 3, "create application()"),
            (1, 3, "notify and audit()"),
            (1, 0, "application created"),
        ],
    ),
    "uc_create.png": (
        ["Corporate User", "Programme Handler", "Programme Service", "Database"],
        [
            (0, 1, "POST programme", "call"),
            (1, 1, "guard requireCorporate()"),
            (1, 1, "validate schema()"),
            (1, 2, "createProgramme()"),
            (2, 3, "write programme, DRAFT()"),
            (2, 3, "write eligibility rule()"),
            (2, 1, "programme"),
            (1, 0, "draft shown"),
        ],
    ),
    "uc_review.png": (
        ["Corporate User", "Applicants Service", "Eligibility Service", "Database"],
        [
            (0, 1, "open application", "call"),
            (1, 1, "guard requireCorporate()"),
            (1, 3, "query scoped to org()"),
            (3, 1, "application or none"),
            (1, 2, "evaluate()"),
            (2, 1, "verdict with reasons"),
            (1, 0, "review screen"),
        ],
    ),
    "uc_shortlist.png": (
        ["Corporate User", "Shortlist Service", "Notification Service", "Database"],
        [
            (0, 1, "POST shortlist", "call"),
            (1, 1, "guard requireCorporate()"),
            (1, 3, "advance status()"),
            (1, 3, "create shortlist entry()"),
            (1, 2, "notify applicant()"),
            (2, 3, "write notification()"),
            (1, 3, "append audit record()"),
            (1, 0, "applicant shortlisted"),
        ],
    ),
}


# A diagram with five lifelines is half as wide again as one with four, and at
# a fixed six-inch column that is the difference between six point labels and
# five. These narrow their lifeline boxes to compensate; the labels wrap onto a
# second line rather than shrinking.
NARROW = {"uc_letter.png", "uc_autofill.png", "uc_import.png"}


def realization_sequences():
    for _, _, _, fname, _ in REALIZATIONS:
        lifelines, messages = SEQUENCES[fname]
        options = {"box_w": 136 if fname == "uc_import.png" else 150} if fname in NARROW else {}
        D.sequence(f"{OUT}/{fname}", lifelines, messages, **options)
        report(fname, 16)



# ---------------------------------------------------------------------------
# Section 6 - screens captured from the running system
#
# The captures are full-page and some are very tall; a 1440x2300 image placed
# in a 6 inch column would stand nine inches high. Each is therefore cropped to
# the top of the page, which is the part a design section needs to show, and
# lands at roughly 6.0 x 4.8 inches.
# ---------------------------------------------------------------------------
SHOTS = [
    ("landing.png", "Landing page"),
    ("login.png", "Log in page"),
    ("register-chooser.png", "Registration, choice of account type"),
    ("register-student.png", "Student registration"),
    ("register-organisation.png", "Organisation registration"),
    ("student-dashboard.png", "Student dashboard"),
    ("student-profile.png", "Student profile"),
    ("student-opportunities.png", "Opportunities, ranked by match"),
    ("student-opportunity-detail.png", "Opportunity detail, with the match explained"),
    ("student-apply.png", "Application form"),
    ("student-applications.png", "Student application tracker"),
    ("student-application-detail.png", "Application detail"),
    ("student-documents.png", "Student document library"),
    ("student-notifications.png", "Student notifications"),
    ("student-settings.png", "Student account settings"),
    ("corporate-dashboard.png", "Corporate dashboard"),
    ("corporate-programmes.png", "Funding programmes held by the Organisation"),
    ("corporate-programme-new.png", "Funding programme editor"),
    ("corporate-applications.png", "Applications received"),
    ("corporate-applicant-profile.png", "Applicant review, with the eligibility verdict"),
    ("corporate-shortlists.png", "Shortlists"),
    ("corporate-beneficiaries.png", "Beneficiaries"),
    ("corporate-reports.png", "Corporate reports"),
    ("corporate-organisation.png", "Organisation profile"),
]

# The responsive layout is a claim the section makes, so it is evidenced rather
# than asserted: the same screens are shown again at the two narrower widths the
# captures were taken at. Only a few are repeated, because showing every screen
# three times would pad the document without saying anything the first two do
# not already say.
NARROW_SHOTS = [
    ("tablet", "landing.png", "Landing page at a tablet width of 834 pixels"),
    ("tablet", "student-opportunities.png",
     "Opportunities at a tablet width of 834 pixels"),
    ("tablet", "corporate-applications.png",
     "Applications received at a tablet width of 834 pixels"),
    ("mobile", "landing.png", "Landing page at a mobile width of 390 pixels"),
    ("mobile", "student-dashboard.png",
     "Student dashboard at a mobile width of 390 pixels"),
    ("mobile", "student-opportunities.png",
     "Opportunities at a mobile width of 390 pixels"),
    ("mobile", "corporate-dashboard.png",
     "Corporate dashboard at a mobile width of 390 pixels"),
]

CROP_HEIGHT = 1150


def interface_shots():
    """
    Crop the captures and record them for the document.

    The list is built from scratch on every run. It used to be read back from
    the manifest of the previous run and appended to, which meant each rebuild
    listed every screen once more than the last; six rebuilds had the document
    printing the same sixteen screens six times over.
    """
    shots = []

    for name, caption in SHOTS:
        im = Image.open(f"shots/desktop/{name}")
        w, h = im.size
        if h > CROP_HEIGHT:
            im = im.crop((0, 0, w, CROP_HEIGHT))
        out = f"ui_{name}"
        im.save(f"{OUT}/{out}")
        shots.append((out, caption))

    for width, name, caption in NARROW_SHOTS:
        im = Image.open(f"shots/{width}/{name}")
        w, h = im.size
        limit = 1400 if width == "mobile" else CROP_HEIGHT
        if h > limit:
            im = im.crop((0, 0, w, limit))
        out = f"ui_{width}_{name}"
        im.save(f"{OUT}/{out}")
        shots.append((out, caption))

    import json
    with open("interface_shots.json", "w") as fh:
        json.dump(shots, fh, indent=2)
    print(f"  interface shots: {len(shots)}")


if __name__ == "__main__":
    deployment()
    architecture()
    system_sequence()
    realization_sequences()
    interface_shots()
    print("figures written:", len(os.listdir(OUT)))

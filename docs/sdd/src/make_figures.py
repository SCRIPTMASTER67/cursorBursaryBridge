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
            ("Client Device\n(Web Browser)", 90, 250),
            ("Application Node\nNext.js Server", 470, 250),
            ("Matching Engine\n(in process)", 470, 60),
            ("Document Store\n(local or S3)", 470, 440),
            ("Database Node\nPostgreSQL", 850, 250),
            ("Email Service", 850, 440),
        ],
        edges=[(0, 1, "HTTPS"), (1, 2, ""), (1, 3, "file"),
               (1, 4, "TCP 5432"), (1, 5, "SMTP")],
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
            ("Student Portal", 240, 72),                        # 0
            ("Corporate Portal", 690, 72),                      # 1
            ("Edge Middleware", 465, 202),                      # 2
            ("Application Programming Interface", 465, 332),    # 3
            ("Authentication and Session Module", 810, 332),    # 4
            ("Service Layer", 465, 462),                        # 5
            ("Matching Engine", 120, 650),                      # 6
            ("Eligibility Service", 350, 650),                  # 7
            ("Document Storage Service", 580, 650),             # 8
            ("Notification and Email Service", 810, 650),       # 9
            ("Bursary-Bridge Database", 465, 800),              # 10
        ],
        edges=[
            (0, 2, ""), (1, 2, ""), (2, 3, ""),
            (3, 4, ""), (3, 5, ""),
            (5, 6, ""), (5, 7, ""), (5, 8, ""), (5, 9, ""),
            (5, 10, ""), (8, 10, ""), (9, 10, ""),
        ],
        box_w=200, box_h=104, font_px=17,
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


def realization_sequences():
    for _, _, _, fname, _ in REALIZATIONS:
        lifelines, messages = SEQUENCES[fname]
        D.sequence(f"{OUT}/{fname}", lifelines, messages)
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
    ("student-dashboard.png", "Student dashboard"),
    ("student-opportunities.png", "Opportunities, ranked by match"),
    ("student-opportunity-detail.png", "Opportunity detail, with the match explained"),
    ("student-apply.png", "Application form"),
    ("student-applications.png", "Student application tracker"),
    ("student-documents.png", "Student document library"),
    ("corporate-dashboard.png", "Corporate dashboard"),
    ("corporate-programme-new.png", "Funding programme editor"),
    ("corporate-applications.png", "Applications received"),
    ("corporate-applicant-profile.png", "Applicant review, with the eligibility verdict"),
    ("corporate-shortlists.png", "Shortlists"),
    ("corporate-reports.png", "Corporate reports"),
]

CROP_HEIGHT = 1150


def interface_shots():
    """Crop the desktop captures and record them for the document."""
    from content import INTERFACE_SHOTS
    src = "shots/desktop"
    for name, caption in SHOTS:
        im = Image.open(f"{src}/{name}")
        w, h = im.size
        if h > CROP_HEIGHT:
            im = im.crop((0, 0, w, CROP_HEIGHT))
        out = f"ui_{name}"
        im.save(f"{OUT}/{out}")
        INTERFACE_SHOTS.append((out, caption))
    # One mobile capture, to evidence the responsive layout the section claims.
    im = Image.open(f"shots/mobile/student-dashboard.png")
    w, h = im.size
    im.crop((0, 0, w, min(h, 1400))).save(f"{OUT}/ui_mobile_dashboard.png")
    INTERFACE_SHOTS.append(("ui_mobile_dashboard.png",
                            "Student dashboard at a mobile width of 390 pixels"))
    import json
    with open("interface_shots.json", "w") as fh:
        json.dump(INTERFACE_SHOTS, fh, indent=2)
    print(f"  interface shots: {len(INTERFACE_SHOTS)}")


if __name__ == "__main__":
    deployment()
    architecture()
    system_sequence()
    realization_sequences()
    interface_shots()
    print("figures written:", len(os.listdir(OUT)))

"""
Generate every figure used in the SRS.

One small diagram per use case, three per-actor summary diagrams, the complete
use case diagram, the system environment, the application status lifecycle and
the logical data structure.

Every figure is placed in a 6 inch text column, so a figure's label size on the
page is font_px / image_width * 432 points. `report()` prints that figure by
figure, which is what keeps the type legible rather than merely present.
"""
import math
import os
from PIL import Image
import diagrams as D
import check_geom
from content import USE_CASES

OUT = "figures"
TEXT_COL_PT = 432.0                    # 6 inch text column
os.makedirs(OUT, exist_ok=True)


def report(name, font_px, max_width_in=6.0):
    w, h = Image.open(f"{OUT}/{name}").size
    width_in = min(max_width_in, w / 96)
    pt = font_px / w * width_in * 72
    print(f"  {name:24s} {w:5d}x{h:<5d}  {width_in:4.2f}in x {width_in*h/w:4.2f}in"
          f"  label {pt:4.1f}pt")


# ---------------------------------------------------------------------------
# Figure 1 - System Environment
# ---------------------------------------------------------------------------
def system_environment():
    """
    Two portals over one application, with the stores and the one cooperating
    system it depends on. Laid out in columns so no connector crosses a box.
    """
    D.boxes(
        f"{OUT}/fig1_environment.png",
        nodes=[
            ("Student Portal", 250, 110),
            ("Corporate Portal", 250, 420),
            ("Administration Portal", 250, 700),
            ("Bursary-Bridge Application", 560, 400),
            ("Matching Engine", 880, 60),
            ("Bursary-Bridge Database", 880, 220),
            ("Document Storage", 880, 380),
            ("Email Service", 880, 540),
            ("Published Bursary Sources", 880, 700),
        ],
        edges=[(0, 3), (1, 3), (2, 3), (3, 4), (3, 5), (3, 6), (3, 7), (3, 8)],
        actors=[("Student", 40, 70), ("Corporate User", 40, 380),
                ("Administrator", 40, 660)],
        actor_edges=[(0, 0), (1, 1), (2, 2)],
        box_w=200, box_h=86, font_px=17, actor_scale=1.7,
    )
    report("fig1_environment.png", 17)


# ---------------------------------------------------------------------------
# Figure 2 - Application status lifecycle
# ---------------------------------------------------------------------------
def lifecycle():
    D.boxes(
        f"{OUT}/fig2_lifecycle.png",
        nodes=[
            ("Draft", 80, 210),
            ("Submitted", 290, 210),
            ("Under Review", 500, 210),
            ("Documents Required", 500, 40),
            ("Shortlisted", 715, 210),
            ("Approved", 930, 100),
            ("Unsuccessful", 930, 320),
        ],
        edges=[
            (0, 1), (1, 2), (2, 3), (3, 2),
            (2, 4), (4, 5), (4, 6), (2, 6),
        ],
        box_w=168, box_h=76, font_px=16, arrow=True,
    )
    report("fig2_lifecycle.png", 16)


# ---------------------------------------------------------------------------
# Figures 3-5 - one summary diagram per actor group
#
# The use cases sit on an arc centred on the actor, so every association line
# runs along a radius and cannot pass through an ellipse it does not belong to.
# The arc is stretched horizontally by uc_w/uc_h, which is the bias at which
# neighbouring ellipses stay clear of each other all the way round the arc.
# ---------------------------------------------------------------------------
def group_summary(group, actor_label, filename, uc_w, uc_h, spread, font_px,
                  actor_scale=1.5, names=None):
    if names is None:
        names = [uc["name"] for uc in USE_CASES if uc["group"] == group]
    radius = uc_h * len(names) / (2 * spread * 3.14159 / 180)
    ucs = D.arc_layout(0, 0, radius, names, -spread, spread,
                       rx_bias=uc_w / uc_h)
    actors = [(actor_label, 0, -30)]
    links = [(0, i) for i in range(len(ucs))]
    check_geom.check(ucs, links, actors, uc_w, uc_h, label=filename)
    D.render(f"{OUT}/{filename}", actors=actors, usecases=ucs, links=links,
             uc_w=uc_w, uc_h=uc_h, font_px=font_px, actor_scale=actor_scale)
    report(filename, font_px)


def group_summaries(group, actor_label, stem, uc_w, uc_h, spread, font_px,
                    per_diagram=8, actor_scale=1.5):
    """
    An actor's use cases, across as many diagrams as legibility requires.

    A fan's width grows with the number of use cases on it, and every figure is
    placed in the same six-inch column, so a fan of fifteen prints its labels at
    five points. Splitting the fan is what keeps the type readable; the
    alternative is a diagram that is complete and cannot be read, which serves
    nobody. Each part carries the same actor, so the actor's full set is still
    shown — just not all in one arc.
    """
    names = [uc["name"] for uc in USE_CASES if uc["group"] == group]
    parts = [names[i:i + per_diagram] for i in range(0, len(names), per_diagram)]
    written = []
    for i, part in enumerate(parts, start=1):
        suffix = "" if len(parts) == 1 else chr(ord("a") + i - 1)
        filename = f"{stem}{suffix}.png"
        group_summary(group, actor_label, filename, uc_w, uc_h, spread, font_px,
                      actor_scale=actor_scale, names=part)
        written.append((filename, len(parts), i))
    return written


# ---------------------------------------------------------------------------
# One diagram per use case
# ---------------------------------------------------------------------------
def per_use_case():
    for uc in USE_CASES:
        D.render(f"{OUT}/{uc['id']}.png",
                 actors=[(uc["actor"], 0, -30)],
                 usecases=[(uc["name"], 340, 8)],
                 links=[(0, 0)],
                 uc_w=250, uc_h=88, font_px=15, actor_scale=1.5)
    report("UC-01.png", 15, max_width_in=4.9)


# ---------------------------------------------------------------------------
# Figure 7 - every use case on one diagram
# ---------------------------------------------------------------------------
def complete_diagram():
    """
    Every actor and every use case on one diagram, given a page of its own.

    Each actor's use cases sit on an arc centred on that actor, on the same
    principle as the per-actor diagrams above, so no association line can pass
    through an ellipse it does not belong to. The four shared use cases attach
    to an abstract User actor which Student and Corporate User both specialise,
    which is why they are drawn once rather than wired twice. Each fan is laid
    out with one slot more than it has use cases and the spare slot is left
    empty on the side facing the User, so the generalisation line has a clear
    corridor out of the fan.
    """
    student = [uc["name"] for uc in USE_CASES if uc["group"] == "student"]
    corporate = [uc["name"] for uc in USE_CASES if uc["group"] == "corporate"]
    admin = [uc["name"] for uc in USE_CASES if uc["group"] == "admin"]
    common = [uc["name"] for uc in USE_CASES if uc["group"] == "common"]

    uc_w, uc_h, font_px, spread = 156, 118, 22, 156
    bias = uc_w / uc_h
    rad = spread * math.pi / 180

    # Student and Corporate User face each other across the page, the
    # Administrator sits above with its fan opening upward, and the User sits
    # below with the shared use cases beneath it. That leaves the centre of the
    # page empty, which is the corridor the three generalisation lines run down.
    s_ax, s_ay = 60, 820
    c_ax, c_ay = 1500, 820
    a_ax, a_ay = 780, 430
    u_ax, u_ay = 780, 1320

    def fan(ax, ay, names, first_deg, last_deg):
        """Lay the names on an arc, leaving the slot nearest the User empty."""
        n = len(names)
        radius = uc_h * (n + 1) / (2 * rad)
        slots = D.arc_layout(ax, ay, radius, [""] * (n + 1), first_deg, last_deg,
                             rx_bias=bias)
        want = math.atan2(u_ay - ay, (u_ax - ax) / bias)
        drop = min(range(n + 1),
                   key=lambda i: abs(math.atan2(slots[i][2] - ay,
                                                (slots[i][1] - ax) / bias) - want))
        kept = [p for i, p in enumerate(slots) if i != drop]
        return [(names[i], x, y) for i, (_, x, y) in enumerate(kept)]

    ucs = fan(s_ax, s_ay, student, -spread, spread)
    ucs += fan(c_ax, c_ay, corporate, 180 - spread, 180 + spread)
    ucs += D.arc_layout(a_ax, a_ay, uc_h * len(admin) / (2 * 1.0),
                        admin, -180 + 26, -26, rx_bias=1.75)
    ucs += D.arc_layout(u_ax, u_ay, uc_h * len(common) / (2 * 0.95),
                        common, 24, 156, rx_bias=1.7)

    actors = [("Student", s_ax, s_ay - 30),
              ("Corporate User", c_ax, c_ay - 30),
              ("Administrator", a_ax, a_ay - 30),
              ("User", u_ax, u_ay - 30)]
    n_s, n_c, n_a, n_k = len(student), len(corporate), len(admin), len(common)
    links = [(0, i) for i in range(n_s)]
    links += [(1, n_s + i) for i in range(n_c)]
    links += [(2, n_s + n_c + i) for i in range(n_a)]
    links += [(3, n_s + n_c + n_a + i) for i in range(n_k)]
    gens = [(0, 3), (1, 3), (2, 3)]

    check_geom.check(ucs, links, actors, uc_w, uc_h, gens, "fig7_complete.png")
    D.render(f"{OUT}/fig7_complete.png",
             actors=actors, usecases=ucs, links=links,
             uc_w=uc_w, uc_h=uc_h, font_px=font_px, pad=60,
             actor_scale=2.6, generalisations=gens)
    report("fig7_complete.png", font_px)


# ---------------------------------------------------------------------------
# Figure 8 - logical structure of the data
# ---------------------------------------------------------------------------
def data_structure():
    """
    The logical structure of the stored data.

    Laid out strictly in rows, parents above children, because a line from a box
    on one row to a box on the row below cannot pass through a third box on that
    lower row: it is still above the row until it arrives. That property is what
    keeps the diagram readable without hand-routing a single connector.
    """
    D.boxes(
        f"{OUT}/fig8_data.png",
        nodes=[
            # row 1
            ("User", 640, 40),
            # row 2
            ("Student Profile", 200, 250),
            ("External Applicant", 940, 250),
            ("Corporate Profile", 1340, 250),
            # row 3
            ("Study Preference", 20, 460),
            ("Subject Result", 260, 460),
            ("Document", 500, 460),
            ("Motivational Letter", 740, 460),
            ("Application", 980, 460),
            ("Organisation", 1340, 460),
            ("Import Batch", 1640, 460),
            # row 4
            ("Institution", 20, 670),
            ("Course", 260, 670),
            ("Shortlist", 740, 670),
            ("Information Request", 980, 670),
            ("Funding Programme", 1340, 670),
            ("Import File", 1640, 670),
            # row 5
            ("Eligibility Rule", 1220, 880),
            ("Opportunity Source", 1460, 880),
        ],
        edges=[
            (0, 1, "has"), (0, 3, "has"),
            (1, 4, "holds"), (1, 5, "records"), (1, 6, "owns"),
            (1, 7, "writes"), (1, 8, "submits"),
            (2, 8, "stands behind"),
            (3, 9, "acts for"),
            (4, 11, "names"), (4, 12, "names"),
            (8, 13, "may reach"), (8, 14, "may receive"), (8, 15, "applies to"),
            (9, 15, "offers"), (9, 10, "runs"),
            (10, 16, "contains"),
            (15, 17, "governed by"), (15, 18, "read from"),
        ],
        box_w=210, box_h=78, font_px=16,
    )
    report("fig8_data.png", 16)


if __name__ == "__main__":
    system_environment()
    lifecycle()
    group_summaries("common", "User", "fig3_common",
                    uc_w=210, uc_h=100, spread=70, font_px=14)
    group_summaries("student", "Student", "fig4_student",
                    uc_w=210, uc_h=100, spread=74, font_px=14, per_diagram=5)
    group_summaries("corporate", "Corporate User", "fig5_corporate",
                    uc_w=210, uc_h=100, spread=74, font_px=14, per_diagram=5)
    group_summaries("admin", "Administrator", "fig6_admin",
                    uc_w=210, uc_h=100, spread=74, font_px=14, per_diagram=5)
    per_use_case()
    complete_diagram()
    data_structure()
    print("figures written:", len(os.listdir(OUT)))

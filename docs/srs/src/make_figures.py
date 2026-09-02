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
            ("Bursary-Bridge Application", 560, 265),
            ("Matching Engine", 880, 40),
            ("Bursary-Bridge Database", 880, 190),
            ("Document Storage", 880, 340),
            ("Email Service", 880, 490),
        ],
        edges=[(0, 2), (1, 2), (2, 3), (2, 4), (2, 5), (2, 6)],
        actors=[("Student", 40, 70), ("Corporate User", 40, 380)],
        actor_edges=[(0, 0), (1, 1)],
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
                  actor_scale=1.5):
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
# Figure 6 - every use case on one diagram
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
    common = [uc["name"] for uc in USE_CASES if uc["group"] == "common"]

    uc_w, uc_h, font_px, spread = 240, 196, 30, 88
    bias = uc_w / uc_h
    rad = spread * math.pi / 180

    s_ax, s_ay = 70, 900
    c_ax, c_ay = 2200, 900
    u_ax, u_ay = 1120, 2280

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
    ucs += D.arc_layout(u_ax, u_ay, uc_h * len(common) / (2 * 1.08),
                        common, 28, 152, rx_bias=1.8)

    actors = [("Student", s_ax, s_ay - 30),
              ("Corporate User", c_ax, c_ay - 30),
              ("User", u_ax, u_ay - 30)]
    n_s, n_c, n_k = len(student), len(corporate), len(common)
    links = [(0, i) for i in range(n_s)]
    links += [(1, n_s + i) for i in range(n_c)]
    links += [(2, n_s + n_c + i) for i in range(n_k)]

    check_geom.check(ucs, links, actors, uc_w, uc_h, [(0, 2), (1, 2)],
                     "fig6_complete.png")
    D.render(f"{OUT}/fig6_complete.png",
             actors=actors, usecases=ucs, links=links,
             uc_w=uc_w, uc_h=uc_h, font_px=font_px, pad=60,
             actor_scale=2.6, generalisations=[(0, 2), (1, 2)])
    report("fig6_complete.png", font_px)


# ---------------------------------------------------------------------------
# Figure 7 - logical structure of the data
# ---------------------------------------------------------------------------
def data_structure():
    """
    The logical structure of the stored data, arranged as a tree from the User
    outwards so that no relationship line has to cross an entity box.
    """
    D.boxes(
        f"{OUT}/fig7_data.png",
        nodes=[
            ("User", 640, 60),
            ("Student Profile", 230, 275),
            ("Corporate Profile", 1050, 275),
            ("Study Preference", 120, 490),
            ("Document", 390, 490),
            ("Institution", 120, 705),
            ("Course", 390, 705),
            ("Application", 640, 490),
            ("Shortlist", 640, 705),
            ("Organisation", 1050, 490),
            ("Funding Programme", 1050, 705),
            ("Eligibility Rule", 800, 900),
        ],
        edges=[
            (0, 1, "has"), (0, 2, "has"),
            (1, 3, "holds"), (1, 4, "owns"), (1, 7, "submits"),
            (3, 5, "names"), (3, 6, "names"),
            (7, 8, "may reach"), (7, 10, "applies to"),
            (2, 9, "acts for"), (9, 10, "offers"), (10, 11, "governed by"),
        ],
        box_w=196, box_h=80, font_px=17,
    )
    report("fig7_data.png", 17)


if __name__ == "__main__":
    system_environment()
    lifecycle()
    group_summary("common", "User", "fig3_common.png",
                  uc_w=210, uc_h=100, spread=70, font_px=14)
    group_summary("student", "Student", "fig4_student.png",
                  uc_w=205, uc_h=106, spread=86, font_px=14)
    group_summary("corporate", "Corporate User", "fig5_corporate.png",
                  uc_w=205, uc_h=106, spread=86, font_px=14)
    per_use_case()
    complete_diagram()
    data_structure()
    print("figures written:", len(os.listdir(OUT)))

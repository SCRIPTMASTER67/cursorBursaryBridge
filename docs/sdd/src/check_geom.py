"""
Geometry check for a use case diagram layout.

Confirms that no two ellipses overlap and that no association or
generalisation line passes through an ellipse it does not terminate on.
"""
import math


def _inside(px, py, cx, cy, a, b, slack=0.0):
    return ((px - cx) / (a + slack)) ** 2 + ((py - cy) / (b + slack)) ** 2 < 1.0


def check(usecases, links, actors, uc_w, uc_h, generalisations=(), label=""):
    a, b = uc_w / 2, uc_h / 2
    bad = []

    for i in range(len(usecases)):
        for j in range(i + 1, len(usecases)):
            (_, x1, y1), (_, x2, y2) = usecases[i], usecases[j]
            if abs(x1 - x2) < uc_w and abs(y1 - y2) < uc_h:
                # cheap ellipse separation test on the normalised distance
                d = math.hypot((x1 - x2) / uc_w, (y1 - y2) / uc_h)
                if d < 1.0:
                    bad.append(f"ellipses overlap: {usecases[i][0]!r} / {usecases[j][0]!r}")

    segs = [((actors[ai][1], actors[ai][2] + 28), usecases[ui][:1] and
             (usecases[ui][1], usecases[ui][2]), ui) for ai, ui in
            [(l[0], l[1]) for l in links]]
    for (ax, ay), (ux, uy), owner in segs:
        for k, (name, cx, cy) in enumerate(usecases):
            if k == owner:
                continue
            for t in [i / 240 for i in range(241)]:
                px, py = ax + (ux - ax) * t, ay + (uy - ay) * t
                if _inside(px, py, cx, cy, a, b):
                    bad.append(f"association crosses {name!r}")
                    break

    for ai, aj in generalisations:
        ax, ay = actors[ai][1], actors[ai][2] + 28
        bx, by = actors[aj][1], actors[aj][2] + 28
        for name, cx, cy in usecases:
            for t in [i / 240 for i in range(241)]:
                px, py = ax + (bx - ax) * t, ay + (by - ay) * t
                if _inside(px, py, cx, cy, a, b):
                    bad.append(f"generalisation {actors[ai][0]}->{actors[aj][0]} crosses {name!r}")
                    break

    seen, out = set(), []
    for m in bad:
        if m not in seen:
            seen.add(m)
            out.append(m)
    print(f"{label}: {'OK' if not out else str(len(out)) + ' problems'}")
    for m in out:
        print("   ", m)
    return not out

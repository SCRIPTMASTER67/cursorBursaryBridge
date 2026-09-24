"""
Draw the Gantt chart for Section 10.2.

The chart is generated from WORKPLAN in content.py rather than drawn by hand,
so the bars and the table beneath them can never disagree about when a task
runs.
"""
import os
from PIL import Image, ImageDraw, ImageFont

from content import WORKPLAN

OUT = "figures"

# The chart is drawn at twice its printed size and placed at the full text
# width of the template's page, which is 6.27 inches once the margins are taken
# off A4. Every dimension below is therefore chosen so that the total width
# comes to exactly that, because an image wider than the column is scaled down
# by Word and takes its labels with it: the first version of this chart was
# eleven inches wide and printed its task names at under four points.
SCALE = 2
TEXT_WIDTH_IN = 6.27
FULL_W = int(TEXT_WIDTH_IN * 96 * SCALE)        # 1203 px

# Sixteen weeks, the four months of one semester. At four columns the chart
# could not show which tasks overlap, and the overlap is what the plan is for.
WEEKS = 16
WEEK_W = 36
LABEL_W = FULL_W - WEEKS * WEEK_W               # 628 px, about 3.3in printed
FONT_PX = 24                                     # 9pt once printed at 6.27in
LINE_H = 26
ROW_H = 44
HEAD_H = 34
PAD = 14


def font(size):
    for path in (
        "/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ):
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def wrap(draw, text, fnt, width):
    words, lines, line = text.split(), [], ""
    for word in words:
        trial = f"{line} {word}".strip()
        if draw.textlength(trial, font=fnt) <= width:
            line = trial
        else:
            if line:
                lines.append(line)
            line = word
    if line:
        lines.append(line)
    return lines


def gantt():
    body = font(FONT_PX)
    head = font(FONT_PX)

    probe = Image.new("RGB", (10, 10), "white")
    pd = ImageDraw.Draw(probe)

    # Wrap every label first, so a two-line label gets a taller row.
    rows = []
    for name, start, end, _ in WORKPLAN:
        lines = wrap(pd, name, body, LABEL_W - 2 * PAD)
        rows.append((lines, start, end))

    heights = [max(ROW_H, len(lines) * LINE_H + 14) for lines, _, _ in rows]

    w = LABEL_W + WEEKS * WEEK_W + 1
    h = HEAD_H + sum(heights) + 1
    im = Image.new("RGB", (w, h), "white")
    d = ImageDraw.Draw(im)

    grid = (150, 150, 150)
    bar = (70, 70, 70)

    # Header row.
    d.rectangle([0, 0, w - 1, HEAD_H], outline=grid, width=2)
    d.text((PAD, HEAD_H // 2), "Task", font=head, fill="black", anchor="lm")
    for m in range(WEEKS):
        x = LABEL_W + m * WEEK_W
        d.rectangle([x, 0, x + WEEK_W, HEAD_H], outline=grid, width=2)
        d.text((x + WEEK_W // 2, HEAD_H // 2), str(m + 1),
               font=head, fill="black", anchor="mm")

    y = HEAD_H
    for (lines, start, end), rh in zip(rows, heights):
        d.rectangle([0, y, LABEL_W, y + rh], outline=grid, width=2)
        ty = y + (rh - len(lines) * LINE_H) // 2
        for i, line in enumerate(lines):
            d.text((PAD, ty + i * LINE_H), line, font=body, fill="black")

        for m in range(WEEKS):
            x = LABEL_W + m * WEEK_W
            d.rectangle([x, y, x + WEEK_W, y + rh], outline=grid, width=2)

        x0 = LABEL_W + (start - 1) * WEEK_W + 5
        x1 = LABEL_W + end * WEEK_W - 5
        d.rectangle([x0, y + rh // 2 - 9, x1, y + rh // 2 + 9], fill=bar)
        y += rh

    os.makedirs(OUT, exist_ok=True)
    path = f"{OUT}/gantt.png"
    im.save(path)
    printed_in = im.size[0] / (96 * SCALE)
    label_pt = FONT_PX / SCALE * 72 / 96
    flag = "  <-- SMALL" if label_pt < 8 else ""
    print(f"  {path}  {im.size[0]}x{im.size[1]}px  {printed_in:.2f}in wide  "
          f"labels {label_pt:.1f}pt{flag}")


if __name__ == "__main__":
    gantt()
    print("figures written")

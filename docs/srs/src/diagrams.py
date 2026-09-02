"""
Use case diagram renderer.

Draws UML use case diagrams in the same visual language as the SRS template:
a stick-figure actor with its name beneath, plain ellipses for use cases, and
thin straight association lines. Black on white, Times-compatible serif type.

Rendered at 3x and downsampled so the strokes stay clean in Word and in print.
"""
from PIL import Image, ImageDraw, ImageFont

S = 3  # supersampling factor
SERIF = "/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf"


def _font(px):
    return ImageFont.truetype(SERIF, px * S)


def _text_size(draw, text, font):
    box = draw.textbbox((0, 0), text, font=font)
    return box[2] - box[0], box[3] - box[1]


def _wrap(draw, text, font, max_w):
    """Greedy wrap so a long use case name fits inside its ellipse."""
    words, lines, cur = text.split(), [], ""
    for w in words:
        trial = f"{cur} {w}".strip()
        if _text_size(draw, trial, font)[0] <= max_w or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def _actor(draw, cx, cy, name, font, scale=1.0):
    """
    Stick figure, drawn from its centre-top. Returns the y of the shoulder
    line, which is where association lines attach.
    """
    lw = max(1, int(1.3 * S))
    head_r = int(9 * S * scale)
    head_cy = cy + head_r
    draw.ellipse(
        [cx - head_r, head_cy - head_r, cx + head_r, head_cy + head_r],
        outline="black", width=lw,
    )

    spine_top = head_cy + head_r
    spine_bot = spine_top + int(30 * S * scale)
    draw.line([cx, spine_top, cx, spine_bot], fill="black", width=lw)

    arm_y = spine_top + int(9 * S * scale)
    arm_w = int(16 * S * scale)
    draw.line([cx - arm_w, arm_y, cx + arm_w, arm_y], fill="black", width=lw)

    leg_len = int(18 * S * scale)
    draw.line([cx, spine_bot, cx - leg_len, spine_bot + leg_len], fill="black", width=lw)
    draw.line([cx, spine_bot, cx + leg_len, spine_bot + leg_len], fill="black", width=lw)

    tw, th = _text_size(draw, name, font)
    draw.text((cx - tw / 2, spine_bot + leg_len + int(7 * S)), name, font=font, fill="black")
    return arm_y


def _ellipse(draw, cx, cy, w, h, label, font):
    draw.ellipse([cx - w // 2, cy - h // 2, cx + w // 2, cy + h // 2],
                 outline="black", width=max(1, int(1.3 * S)))
    lines = _wrap(draw, label, font, int(w * 0.74))
    _, lh = _text_size(draw, "Xg", font)
    gap = int(lh * 1.30)
    top = cy - (len(lines) - 1) * gap / 2 - lh / 2
    for i, ln in enumerate(lines):
        tw, _ = _text_size(draw, ln, font)
        draw.text((cx - tw / 2, top + i * gap), ln, font=font, fill="black")


def _edge_point(cx, cy, w, h, tx, ty):
    """Where the line from (tx,ty) meets the ellipse outline."""
    dx, dy = tx - cx, ty - cy
    if dx == 0 and dy == 0:
        return cx, cy
    a, b = w / 2, h / 2
    t = 1.0 / ((dx / a) ** 2 + (dy / b) ** 2) ** 0.5
    return cx + dx * t, cy + dy * t


def render(path, actors, usecases, links, width=None, height=None,
           uc_w=150, uc_h=54, font_px=9, boundary=None, actor_scale=1.0, pad=14,
           generalisations=None):
    """
    actors    [(label, x, y)]              x,y = centre-top of the figure
    usecases  [(label, x, y)]              x,y = ellipse centre
    links     [(actor_i, uc_i)] or [(actor_i, uc_i, 'dashed', 'text')]
    boundary  (x1, y1, x2, y2, title) system boundary box, or None

    Canvas size is derived from the content unless width/height are given, so
    nothing is ever clipped and every diagram is tightly cropped.
    """
    actor_h = int(60 * actor_scale) + 20   # figure plus its label
    actor_w = int(40 * actor_scale)
    xs, ys = [], []
    for _, x, y in actors:
        xs += [x - actor_w, x + actor_w]
        ys += [y, y + actor_h]
    for _, x, y in usecases:
        xs += [x - uc_w // 2, x + uc_w // 2]
        ys += [y - uc_h // 2, y + uc_h // 2]
    if boundary:
        xs += [boundary[0], boundary[2]]
        ys += [boundary[1], boundary[3]]

    ox, oy = pad - min(xs), pad - min(ys)
    actors = [(l, x + ox, y + oy) for l, x, y in actors]
    usecases = [(l, x + ox, y + oy) for l, x, y in usecases]
    if boundary:
        boundary = (boundary[0] + ox, boundary[1] + oy,
                    boundary[2] + ox, boundary[3] + oy, boundary[4])
    if width is None:
        width = int(max(xs) - min(xs) + pad * 2)
    if height is None:
        height = int(max(ys) - min(ys) + pad * 2)

    img = Image.new("RGB", (width * S, height * S), "white")
    d = ImageDraw.Draw(img)
    f_uc = _font(font_px)
    f_actor = _font(font_px)
    f_note = _font(font_px - 1)
    lw = max(1, int(1.3 * S))

    if boundary:
        x1, y1, x2, y2, title = boundary
        d.rectangle([x1 * S, y1 * S, x2 * S, y2 * S], outline="black", width=lw)
        if title:
            tw, _ = _text_size(d, title, f_actor)
            d.text(((x1 + x2) * S / 2 - tw / 2, y1 * S + int(6 * S)),
                   title, font=f_actor, fill="black")

    arm_ys = []
    for label, x, y in actors:
        arm_ys.append(_actor(d, x * S, y * S, label, f_actor, actor_scale))

    # Actor generalisation: a hollow triangle pointing at the parent actor.
    # Drawing Student and Corporate User as specialisations of User lets the
    # shared use cases attach once, instead of every actor connecting to each.
    import math
    for child, parent in (generalisations or []):
        cx, cy = actors[child][1] * S, arm_ys[child]
        px, py = actors[parent][1] * S, arm_ys[parent]
        ang = math.atan2(py - cy, px - cx)
        head = 13 * S
        tipx, tipy = px - head * 1.15 * math.cos(ang), py - head * 1.15 * math.sin(ang)
        d.line([cx, cy, tipx, tipy], fill="black", width=lw)
        a1 = (tipx + head * math.cos(ang + 2.55), tipy + head * math.sin(ang + 2.55))
        a2 = (tipx + head * math.cos(ang - 2.55), tipy + head * math.sin(ang - 2.55))
        apex = (tipx + head * 1.15 * math.cos(ang), tipy + head * 1.15 * math.sin(ang))
        d.polygon([apex, a1, a2], outline="black", fill="white")
        d.line([apex, a1], fill="black", width=lw)
        d.line([a1, a2], fill="black", width=lw)
        d.line([a2, apex], fill="black", width=lw)

    for label, x, y in usecases:
        _ellipse(d, x * S, y * S, uc_w * S, uc_h * S, label, f_uc)

    for link in links:
        ai, ui = link[0], link[1]
        style = link[2] if len(link) > 2 else "solid"
        note = link[3] if len(link) > 3 else None

        ax = actors[ai][1] * S
        ay = arm_ys[ai]
        ucx, ucy = usecases[ui][1] * S, usecases[ui][2] * S
        ex, ey = _edge_point(ucx, ucy, uc_w * S, uc_h * S, ax, ay)
        # start just outside the actor's arm span
        span = int(16 * S * actor_scale)
        sx = ax + span if ex > ax else ax - span

        if style == "dashed":
            total = ((ex - sx) ** 2 + (ey - ay) ** 2) ** 0.5
            dash, i = 5 * S, 0.0
            while i < total:
                j = min(i + dash, total)
                d.line([sx + (ex - sx) * i / total, ay + (ey - ay) * i / total,
                        sx + (ex - sx) * j / total, ay + (ey - ay) * j / total],
                       fill="black", width=lw)
                i += dash * 2
        else:
            d.line([sx, ay, ex, ey], fill="black", width=lw)

        if note:
            mx, my = (sx + ex) / 2, (ay + ey) / 2
            tw, _ = _text_size(d, note, f_note)
            d.text((mx - tw / 2, my - int(13 * S)), note, font=f_note, fill="black")

    img.resize((width, height), Image.LANCZOS).save(path, "PNG")
    return path



def arc_layout(ax, ay, radius, labels, start_deg=-58, end_deg=58, rx_bias=1.0):
    """
    Place use cases on an arc centred on the actor.

    Association lines then run along radii, so a line to one ellipse can never
    pass through another — which is what keeps a fan-out diagram readable.
    """
    import math
    n = len(labels)
    out = []
    for i, label in enumerate(labels):
        t = 0.5 if n == 1 else i / (n - 1)
        deg = start_deg + (end_deg - start_deg) * t
        rad = math.radians(deg)
        out.append((label,
                    int(ax + radius * math.cos(rad) * rx_bias),
                    int(ay + radius * math.sin(rad))))
    return out


def _rect_edge(x, y, w, h, tx, ty):
    """Where a line from (tx,ty) meets the rectangle outline."""
    dx, dy = tx - x, ty - y
    if dx == 0 and dy == 0:
        return x, y
    sx = (w / 2) / abs(dx) if dx else float('inf')
    sy = (h / 2) / abs(dy) if dy else float('inf')
    s = min(sx, sy)
    return x + dx * s, y + dy * s


def boxes(path, nodes, edges, actors=None, width=None, height=None,
          box_w=130, box_h=48, font_px=9, pad=16, arrow=False, actor_edges=None,
          actor_scale=1.0):
    """
    Rectangles joined by lines: used for the system environment, the
    application status lifecycle and the logical data structure.

    nodes  [(label, x, y)]                    centre of each box
    edges  [(a, b)] or [(a, b, 'label')]      indices into nodes
    actors [(label, x, y)]                    stick figures, optional
    """
    actors = actors or []
    xs, ys = [], []
    for _, x, y in nodes:
        xs += [x - box_w // 2, x + box_w // 2]
        ys += [y - box_h // 2, y + box_h // 2]
    aw, ah = int(40 * actor_scale), int(80 * actor_scale)
    for _, x, y in actors:
        xs += [x - aw, x + aw]
        ys += [y, y + ah]
    ox, oy = pad - min(xs), pad - min(ys)
    nodes = [(l, x + ox, y + oy) for l, x, y in nodes]
    actors = [(l, x + ox, y + oy) for l, x, y in actors]
    if width is None:
        width = int(max(xs) - min(xs) + pad * 2)
    if height is None:
        height = int(max(ys) - min(ys) + pad * 2)

    img = Image.new("RGB", (width * S, height * S), "white")
    d = ImageDraw.Draw(img)
    f = _font(font_px)
    lw = max(1, int(1.3 * S))

    for a, b, *rest in edges:
        label = rest[0] if rest else None
        ax, ay = nodes[a][1] * S, nodes[a][2] * S
        bx, by = nodes[b][1] * S, nodes[b][2] * S
        sx, sy = _rect_edge(ax, ay, box_w * S, box_h * S, bx, by)
        ex, ey = _rect_edge(bx, by, box_w * S, box_h * S, ax, ay)
        d.line([sx, sy, ex, ey], fill="black", width=lw)
        if arrow:
            import math
            ang = math.atan2(ey - sy, ex - sx)
            hl = 9 * S
            for off in (2.6, -2.6):
                d.line([ex, ey,
                        ex + hl * math.cos(ang + off),
                        ey + hl * math.sin(ang + off)], fill="black", width=lw)
        if label:
            tw, th = _text_size(d, label, f)
            mx, my = (sx + ex) / 2, (sy + ey) / 2
            d.rectangle([mx - tw / 2 - 3 * S, my - th / 2 - 2 * S,
                         mx + tw / 2 + 3 * S, my + th / 2 + 3 * S], fill="white")
            d.text((mx - tw / 2, my - th / 2), label, font=f, fill="black")

    for label, x, y in nodes:
        cx, cy = x * S, y * S
        d.rectangle([cx - box_w * S // 2, cy - box_h * S // 2,
                     cx + box_w * S // 2, cy + box_h * S // 2],
                    outline="black", fill="white", width=lw)
        lines = _wrap(d, label, f, int(box_w * S * 0.86))
        _, lh = _text_size(d, "Xg", f)
        gap = int(lh * 1.32)
        top = cy - (len(lines) - 1) * gap / 2 - lh / 2
        for i, ln in enumerate(lines):
            tw, _ = _text_size(d, ln, f)
            d.text((cx - tw / 2, top + i * gap), ln, font=f, fill="black")

    arm_ys = []
    for label, x, y in actors:
        arm_ys.append(_actor(d, x * S, y * S, label, f, actor_scale))

    for ai, ni in (actor_edges or []):
        ax, ay = actors[ai][1] * S, arm_ys[ai]
        bx, by = nodes[ni][1] * S, nodes[ni][2] * S
        ex, ey = _rect_edge(bx, by, box_w * S, box_h * S, ax, ay)
        span = int(16 * S * actor_scale)
        sx = ax + span if ex > ax else ax - span
        d.line([sx, ay, ex, ey], fill="black", width=lw)

    img.resize((width, height), Image.LANCZOS).save(path, "PNG")
    return path

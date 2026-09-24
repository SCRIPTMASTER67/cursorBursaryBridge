"""
Build the Final Year Project Proposal inside the faculty's own proposal template.

Only word/document.xml is rewritten. styles.xml, the theme, the footer, the
media and the single section definition are carried through from the template
untouched, so the fonts, margins, page size, headers, footers and page
numbering are the template's own rather than a reconstruction of them.
numbering.xml gains list definitions and loses nothing: the section numbering
the template defines is reused exactly as it stands.

The formatting contract was read off the template and is reproduced:

    Heading1   pStyle Heading1 + numPr(ilvl 0, numId 2) + jc both,
               runs Times New Roman at sz 22
    Heading2   pStyle Heading2 + numPr(ilvl 1, numId 2) + jc both,
               runs Times New Roman at sz 22
    body       jc both, runs Times New Roman, size inherited (22 = 11pt)
    tables     TableGrid, with Times New Roman stated on every cell because
               the style itself resolves to the theme's sans face

To the template's body paragraphs this build adds one property the brief
requires and the template does not carry: line spacing of 360 twips, which is
one and a half lines.
"""
import os
import re
import shutil
import subprocess
import zipfile
from xml.sax.saxutils import escape

from PIL import Image

from content import (APPENDIX_A, APPENDIX_A_INTRO, APPENDIX_B, APPENDIX_B_INTRO,
                     APPENDIX_INTRO, ASSUMPTIONS, BENEFICIARIES_DIRECT,
                     BENEFICIARIES_INDIRECT, BENEFICIARIES_INTRO, CONSTRAINTS,
                     GOAL, HARDWARE, IN_SCOPE, INTRODUCTION, METHODOLOGY,
                     OBJECTIVES, OBJECTIVES_INTRO, OUT_OF_SCOPE, PROBLEM,
                     PROJECT_TITLE, REFERENCES, RISKS, SCOPE_INTRO, SOFTWARE,
                     STUDENTS, SUBMIT_DATE, SUPERVISOR, TEAM, TEAM_NOTE,
                     TOOLS_INTRO, EXPERTISE_INTRO, WORKPLAN, WORKPLAN_INTRO)

SRC = "unpacked"
BUILD = "build"
OUT = "Bursary-Bridge_Project_Proposal.docx"

# A4 less the template's 1440-twip margins.
TEXT_WIDTH_TWIPS = 9026
TEXT_WIDTH_IN = TEXT_WIDTH_TWIPS / 1440
EMU_PER_INCH = 914400

TNR = ('<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" '
       'w:cs="Times New Roman"/>')
BODY_RPR = f'<w:rPr>{TNR}</w:rPr>'
# One and a half lines. The template leaves spacing to the document default of
# 259 (1.08); the brief asks for 1.5, so the body carries it explicitly and the
# headings are left exactly as the template set them.
BODY_SPACING = '<w:spacing w:line="360" w:lineRule="auto"/>'

HEADINGS = []        # (level, numbered text) in document order
_counter = [0, 0]
images = []
_list_id = [20]      # numIds allocated to this build, above the template's 5


def next_list_id():
    _list_id[0] += 1
    return _list_id[0]


def rid_for(path):
    for rid, p in images:
        if p == path:
            return rid
    rid = f"rIdImg{len(images) + 1}"
    images.append((rid, path))
    return rid


def runs(parts, sz=None, rpr_extra=""):
    """parts: a string, or [(text, bold, italic)]."""
    if isinstance(parts, str):
        parts = [(parts, False, False)]
    out = []
    for text, bold, italic in parts:
        rpr = "<w:rPr>" + TNR
        if bold:
            rpr += "<w:b/>"
        if italic:
            rpr += "<w:i/>"
        rpr += rpr_extra
        if sz:
            rpr += f'<w:sz w:val="{sz}"/><w:szCs w:val="{sz}"/>'
        rpr += "</w:rPr>"
        # A typewriter apostrophe in a justified serif column is the one
        # typographic detail a marker notices without looking for it.
        out.append(f'<w:r>{rpr}<w:t xml:space="preserve">'
                   f'{escape(text.replace(chr(39), chr(8217)))}</w:t></w:r>')
    return "".join(out)


def para(parts, jc="both", sz=None, spacing=True, ind=None, style=None,
         keep_next=False, break_before=False):
    """
    A body paragraph in the template's shape.

    CT_PPr fixes the order of its children: pStyle, keepNext, numPr, spacing,
    ind, jc, rPr. Emitting them in any other order produces a file Word
    refuses to open.
    """
    ppr = "<w:pPr>"
    if style:
        ppr += f'<w:pStyle w:val="{style}"/>'
    if keep_next:
        ppr += "<w:keepNext/>"
    if break_before:
        ppr += "<w:pageBreakBefore/>"
    if spacing:
        ppr += BODY_SPACING
    if ind:
        ppr += ind
    if jc:
        ppr += f'<w:jc w:val="{jc}"/>'
    ppr += "<w:rPr>" + TNR + (f'<w:sz w:val="{sz}"/><w:szCs w:val="{sz}"/>' if sz else "") + "</w:rPr>"
    ppr += "</w:pPr>"
    return f"<w:p>{ppr}{runs(parts, sz=sz)}</w:p>"


def blank(sz=None):
    return para("", jc=None, sz=sz)


def heading(level, text, break_before=False):
    """A numbered heading, using the template's own Heading styles and list."""
    if level == 1:
        _counter[0] += 1
        _counter[1] = 0
        number = f"{_counter[0]}."
    else:
        _counter[1] += 1
        number = f"{_counter[0]}.{_counter[1]}."
    HEADINGS.append((level, f"{number} {text}"))

    style = "Heading1" if level == 1 else "Heading2"
    ilvl = 0 if level == 1 else 1
    ppr = (f'<w:pPr><w:pStyle w:val="{style}"/>'
           + ('<w:pageBreakBefore/>' if break_before else "")
           + f'<w:numPr><w:ilvl w:val="{ilvl}"/><w:numId w:val="2"/></w:numPr>'
           f'<w:jc w:val="both"/>'
           f'<w:rPr>{TNR}<w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr>')
    return f"<w:p>{ppr}{runs(text, sz=22)}</w:p>"


def bullets(items, num_id=None):
    """A bulleted list on the template's own bullet definition."""
    nid = num_id or next_list_id()
    out = ""
    for item in items:
        ppr = ('<w:pPr>'
               f'<w:numPr><w:ilvl w:val="1"/><w:numId w:val="{nid}"/></w:numPr>'
               + BODY_SPACING
               + '<w:ind w:left="720" w:hanging="360"/>'
               '<w:jc w:val="both"/>'
               f'<w:rPr>{TNR}</w:rPr></w:pPr>')
        out += f"<w:p>{ppr}{runs(item)}</w:p>"
    return out


def numbered(items):
    """A numbered list on a counter of its own, so it restarts at one."""
    nid = next_list_id()
    out = ""
    for item in items:
        ppr = ('<w:pPr>'
               f'<w:numPr><w:ilvl w:val="0"/><w:numId w:val="{nid}"/></w:numPr>'
               + BODY_SPACING
               + '<w:ind w:left="720" w:hanging="360"/>'
               '<w:jc w:val="both"/>'
               f'<w:rPr>{TNR}</w:rPr></w:pPr>')
        out += f"<w:p>{ppr}{runs(item)}</w:p>"
    return out


# ---------------------------------------------------------------------------
# Tables
# ---------------------------------------------------------------------------
def cell(content, width, bold=False, sz=None):
    """
    One table cell.

    Times New Roman is stated on the paragraph mark and on every run. That is
    not redundant: TableGrid resolves rFonts to the theme's minor font, which
    is a sans face, so a cell without the explicit override renders in the
    wrong typeface however the document defaults are set.
    """
    if isinstance(content, str):
        content = [content]
    body = ""
    for i, part in enumerate(content):
        # The template's own tables carry no line spacing; one-and-a-half
        # spacing is for the prose, and applying it inside a cell makes a
        # four-column table twice as tall for no gain in legibility.
        ppr = ("<w:pPr><w:spacing w:after=\"40\" w:line=\"240\" "
               "w:lineRule=\"auto\"/><w:jc w:val=\"left\"/><w:rPr>" + TNR
               + (f'<w:sz w:val="{sz}"/><w:szCs w:val="{sz}"/>' if sz else "")
               + ("<w:b/>" if bold else "") + "</w:rPr></w:pPr>")
        body += f"<w:p>{ppr}{runs([(part, bold, False)], sz=sz)}</w:p>"
    return (f'<w:tc><w:tcPr><w:tcW w:w="{width}" w:type="dxa"/></w:tcPr>'
            f"{body}</w:tc>")


def table(rows, widths, sz=None, header=True):
    grid = "".join(f'<w:gridCol w:w="{w}"/>' for w in widths)
    out = ('<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/>'
           '<w:tblW w:w="0" w:type="auto"/>'
           '<w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" '
           'w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/>'
           f'</w:tblPr><w:tblGrid>{grid}</w:tblGrid>')
    for r, row in enumerate(rows):
        bold = header and r == 0
        trpr = '<w:trPr><w:tblHeader/></w:trPr>' if bold else ""
        out += "<w:tr>" + trpr + "".join(
            cell(value, widths[c], bold=bold, sz=sz) for c, value in enumerate(row)
        ) + "</w:tr>"
    return out + "</w:tbl>"


# ---------------------------------------------------------------------------
# Pictures
# ---------------------------------------------------------------------------
def picture(path, doc_id=[1]):
    w_px, h_px = Image.open(path).size
    width_in = min(TEXT_WIDTH_IN, w_px / 192)      # drawn at 2x
    height_in = width_in * h_px / w_px
    cx, cy = int(width_in * EMU_PER_INCH), int(height_in * EMU_PER_INCH)
    rid = rid_for(path)
    n = doc_id[0]
    doc_id[0] += 1
    return (
        '<w:p><w:pPr><w:keepNext/><w:jc w:val="center"/></w:pPr><w:r><w:drawing>'
        '<wp:inline distT="0" distB="0" distL="0" distR="0">'
        f'<wp:extent cx="{cx}" cy="{cy}"/>'
        '<wp:effectExtent l="0" t="0" r="0" b="0"/>'
        f'<wp:docPr id="{950 + n}" name="Figure {n}"/>'
        '<wp:cNvGraphicFramePr><a:graphicFrameLocks '
        'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
        'noChangeAspect="1"/></wp:cNvGraphicFramePr>'
        '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'
        '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">'
        '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">'
        f'<pic:nvPicPr><pic:cNvPr id="{950 + n}" name="{os.path.basename(path)}"/>'
        '<pic:cNvPicPr/></pic:nvPicPr>'
        f'<pic:blipFill><a:blip r:embed="{rid}"/>'
        '<a:stretch><a:fillRect/></a:stretch></pic:blipFill>'
        '<pic:spPr><a:xfrm><a:off x="0" y="0"/>'
        f'<a:ext cx="{cx}" cy="{cy}"/></a:xfrm>'
        '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>'
        '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>'
    )


def caption(text):
    ppr = ('<w:pPr>' + BODY_SPACING + '<w:jc w:val="center"/><w:rPr>' + TNR
           + '<w:b/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:pPr>')
    return f"<w:p>{ppr}{runs([(text, True, False)], sz=20)}</w:p>"


# ---------------------------------------------------------------------------
# Cover page and contents
# ---------------------------------------------------------------------------
def title_page():
    crest = open("crest_para.xml", encoding="utf-8").read()
    x = crest
    x += para("Department of Computer Science", jc="center", sz=38, spacing=False)
    x += blank(sz=32)
    x += para("Final Year Project Proposal", jc="center", sz=38, spacing=False)
    x += blank(sz=32)
    x += para(PROJECT_TITLE, jc="center", sz=30, spacing=False)
    x += para("Supervisor", jc="center", sz=24, spacing=False)
    x += para(SUPERVISOR, jc="center", sz=24, spacing=False)
    x += blank(sz=24)
    x += para("Submitted by", jc="left", sz=24, spacing=False)

    # The template's table: two columns, eight numbered rows, the first row a
    # header. The four members are entered against the first four numbers and
    # the remaining rows are left as the template has them.
    rows = [["Student Name", "Student Number"]]
    for i in range(8):
        if i < len(STUDENTS):
            name, number = STUDENTS[i]
            rows.append([f"{i + 1}.  {name}", number])
        else:
            rows.append([f"{i + 1}.", ""])
    x += table(rows, [5524, 3492], sz=24, header=False)

    x += blank(sz=24)
    x += para(SUBMIT_DATE, jc="center", sz=24, spacing=False)
    return x


def toc_paragraph(level, text, page):
    indent = '<w:ind w:left="360"/>' if level == 2 else ""
    # The contents is set closer than the body. One and a half spacing is asked
    # for the prose; a contents page set that far apart reads as a list of
    # unrelated lines rather than as a table.
    ppr = ('<w:pPr>'
           f'<w:tabs><w:tab w:val="right" w:leader="dot" w:pos="{TEXT_WIDTH_TWIPS}"/></w:tabs>'
           '<w:spacing w:after="0" w:line="276" w:lineRule="auto"/>' + indent
           + f'<w:rPr>{TNR}</w:rPr></w:pPr>')
    return (f"<w:p>{ppr}"
            f'<w:r><w:rPr>{TNR}</w:rPr><w:t xml:space="preserve">{escape(text)}</w:t></w:r>'
            f'<w:r><w:rPr>{TNR}</w:rPr><w:tab/></w:r>'
            f'<w:r><w:rPr>{TNR}</w:rPr><w:t>{page}</w:t></w:r></w:p>')


def contents(entries):
    x = para("Table of Contents", jc="center", sz=24, spacing=False,
             break_before=True)
    x += blank()
    if entries:
        for level, text, page in entries:
            x += toc_paragraph(level, text, page)
    return x


# ---------------------------------------------------------------------------
# Body sections
# ---------------------------------------------------------------------------
def introduction_section():
    x = heading(1, "Introduction and Background", break_before=True)
    for p in INTRODUCTION:
        x += para(p)
    return x


def problem_section():
    x = heading(1, "Problem Statement")
    for p in PROBLEM:
        x += para(p)
    return x


def goal_section():
    x = heading(1, "Goal and Objectives")
    x += heading(2, "Goal")
    x += para(GOAL)
    x += heading(2, "Objectives")
    for p in OBJECTIVES_INTRO:
        x += para(p)
    x += blank()
    rows = [["No.", "Objective", "How completion is measured"]]
    for i, (objective, measure) in enumerate(OBJECTIVES, start=1):
        rows.append([str(i), objective, measure])
    x += table(rows, [560, 4233, 4233], sz=20)
    return x


def methodology_section():
    x = heading(1, "Methodology")
    for kind, value in METHODOLOGY:
        if kind == "head":
            x += para([(value, True, False)], jc="left")
        elif kind == "p":
            x += para(value)
        elif kind == "bul":
            x += bullets(value)
        elif kind == "num":
            x += numbered(value)
    return x


def tools_section():
    x = heading(1, "Equipment, Tools, and Technologies Required for the Project")
    for p in TOOLS_INTRO:
        x += para(p)
    x += blank()
    x += para([("Hardware", True, False)], jc="left")
    x += table([["Item", "Purpose in this project"]] + [list(r) for r in HARDWARE],
               [2800, 6226], sz=20)
    x += blank()
    x += para([("Software and technologies", True, False)], jc="left")
    x += table([["Category", "Technology and the reason for it"]]
               + [list(r) for r in SOFTWARE], [2800, 6226], sz=20)
    return x


def scope_section():
    x = heading(1, "Project Scope")
    for p in SCOPE_INTRO:
        x += para(p)
    x += para([("In scope", True, False)], jc="left")
    x += bullets(IN_SCOPE)
    x += para([("Out of scope", True, False)], jc="left")
    x += bullets(OUT_OF_SCOPE)
    return x


def beneficiaries_section():
    x = heading(1, "Project Beneficiaries")
    for p in BENEFICIARIES_INTRO:
        x += para(p)
    x += blank()
    x += para([("Direct beneficiaries", True, False)], jc="left")
    rows = [["Beneficiary", "How they interact with the system", "Benefit"]]
    rows += [list(r) for r in BENEFICIARIES_DIRECT]
    x += table(rows, [1900, 3563, 3563], sz=20)
    x += blank()
    x += para([("Indirect beneficiaries", True, False)], jc="left")
    rows = [["Beneficiary", "Relationship to the system", "Benefit"]]
    rows += [list(r) for r in BENEFICIARIES_INDIRECT]
    x += table(rows, [1900, 3563, 3563], sz=20)
    return x


def assumptions_section():
    x = heading(1, "Project Assumptions and Constraints")
    x += para([("Assumptions", True, False)], jc="left")
    x += bullets(ASSUMPTIONS)
    x += para([("Constraints", True, False)], jc="left")
    x += bullets(CONSTRAINTS)
    return x


def risks_section():
    x = heading(1, "Project Risks")
    x += para("The risks below are those that could prevent the project from "
              "reaching its objectives. Likelihood and impact are the team's "
              "own assessment; each risk carries the mitigation that is "
              "already planned for it rather than a general intention to be "
              "careful.")
    x += blank()
    rows = [["Risk", "Likelihood", "Impact", "Mitigation"]]
    rows += [[r[0], r[1], r[2], r[3]] for r in RISKS]
    x += table(rows, [2800, 1300, 850, 4076], sz=20)
    return x


def workplan_section():
    x = heading(1, "Project Work Plan")

    x += heading(2, "Expertise of the Team members")
    for p in EXPERTISE_INTRO:
        x += para(p)
    x += blank()
    rows = [["Member", "Responsibilities", "Level of knowledge"]]
    rows += [list(r) for r in TEAM]
    x += table(rows, [1500, 4726, 2800], sz=20)
    x += blank()
    for p in TEAM_NOTE:
        x += para(p)

    x += heading(2, "Work plan")
    for p in WORKPLAN_INTRO:
        x += para(p)
    x += blank()
    rows = [["Task", "Months", "Description"]]
    for name, start, end, note in WORKPLAN:
        span = str(start) if start == end else f"{start}–{end}"
        rows.append([name, span, note])
    x += table(rows, [2600, 900, 5526], sz=20)
    x += blank()
    x += picture("figures/gantt.png")
    x += caption("Figure 1 Gantt chart of the project work plan, months 1 to 10")
    return x


def references_section():
    x = heading(1, "References")
    x += para("References are numbered in the order of their first citation in "
              "the text and are cited by bracketed number throughout.")
    x += blank()
    nid = next_list_id()
    for i, ref in enumerate(REFERENCES, start=1):
        ppr = ('<w:pPr>' + BODY_SPACING
               + '<w:ind w:left="720" w:hanging="720"/>'
                 '<w:jc w:val="both"/>'
               f'<w:rPr>{TNR}</w:rPr></w:pPr>')
        x += f"<w:p>{ppr}{runs(f'[{i}] {ref}')}</w:p>"
    return x


def appendices_section():
    x = heading(1, "Appendices (if applicable)")
    for p in APPENDIX_INTRO:
        x += para(p)
    x += blank()

    x += para([("Appendix A: Funding sources the ingestion pipeline is "
                "configured to read", True, False)], jc="left")
    for p in APPENDIX_A_INTRO:
        x += para(p)
    x += bullets(APPENDIX_A)
    x += blank()

    x += para([("Appendix B: Project documents", True, False)], jc="left")
    for p in APPENDIX_B_INTRO:
        x += para(p)
    x += blank()
    rows = [["Document", "Structure it follows", "Status"]]
    rows += [list(r) for r in APPENDIX_B]
    x += table(rows, [3000, 4026, 2000], sz=20)
    return x


# ---------------------------------------------------------------------------
# Assembly
# ---------------------------------------------------------------------------
SECTPR = ('<w:sectPr><w:footerReference w:type="default" r:id="rId8"/>'
          '<w:pgSz w:w="11906" w:h="16838"/>'
          '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" '
          'w:header="708" w:footer="708" w:gutter="0"/>'
          '<w:cols w:space="708"/><w:titlePg/>'
          '<w:docGrid w:linePitch="360"/></w:sectPr>')


def assemble(toc_entries=None):
    HEADINGS.clear()
    _counter[0] = _counter[1] = 0
    _list_id[0] = 20
    images.clear()

    body = (
        title_page()
        + contents(toc_entries)
        + introduction_section()
        + problem_section()
        + goal_section()
        + methodology_section()
        + tools_section()
        + scope_section()
        + beneficiaries_section()
        + assumptions_section()
        + risks_section()
        + workplan_section()
        + references_section()
        + appendices_section()
    )

    prefix = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<w:document '
        'xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" '
        'xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" '
        'xmlns:o="urn:schemas-microsoft-com:office:office" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
        'xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" '
        'xmlns:v="urn:schemas-microsoft-com:vml" '
        'xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" '
        'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" '
        'xmlns:w10="urn:schemas-microsoft-com:office:word" '
        'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" '
        'xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" '
        'xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml" '
        'xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" '
        'xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk" '
        'xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" '
        'xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" '
        'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
        'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" '
        'mc:Ignorable="w14 w15 wp14">'
        "<w:body>"
    )
    return f"{prefix}{body}{SECTPR}</w:body></w:document>"


# ---------------------------------------------------------------------------
# Packaging
# ---------------------------------------------------------------------------
def add_list_definitions(path):
    """
    Give this build's lists their own numIds.

    Every numId added points at abstract definition 3, which the template
    already carries and whose first two levels are exactly what is needed: a
    decimal number at level 0 and a bullet at level 1. Nothing the template
    defines is altered. A fresh numId per list is what makes a numbered list
    restart at one rather than continue the section numbering.
    """
    xml = open(path, encoding="utf-8").read()
    added = ""
    for nid in range(21, _list_id[0] + 1):
        added += f'<w:num w:numId="{nid}"><w:abstractNumId w:val="3"/></w:num>'
    xml = xml.replace("</w:numbering>", added + "</w:numbering>")
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(xml)


def package(document, out):
    if os.path.exists(BUILD):
        shutil.rmtree(BUILD)
    shutil.copytree(SRC, BUILD)
    with open(f"{BUILD}/word/document.xml", "w", encoding="utf-8") as fh:
        fh.write(document)

    add_list_definitions(f"{BUILD}/word/numbering.xml")

    os.makedirs(f"{BUILD}/word/media", exist_ok=True)
    rels = open(f"{BUILD}/word/_rels/document.xml.rels", encoding="utf-8").read()
    added = ""
    for rid, path in images:
        name = os.path.basename(path)
        shutil.copy(path, f"{BUILD}/word/media/{name}")
        added += (f'<Relationship Id="{rid}" Type="http://schemas.openxmlformats.org'
                  f'/officeDocument/2006/relationships/image" Target="media/{name}"/>')
    rels = rels.replace("</Relationships>", added + "</Relationships>")
    with open(f"{BUILD}/word/_rels/document.xml.rels", "w", encoding="utf-8") as fh:
        fh.write(rels)

    ct_path = f"{BUILD}/[Content_Types].xml"
    ct = open(ct_path, encoding="utf-8").read()
    if 'Extension="png"' not in ct:
        ct = ct.replace('<Default Extension="jpeg"',
                        '<Default Extension="png" ContentType="image/png"/>'
                        '<Default Extension="jpeg"')
    with open(ct_path, "w", encoding="utf-8") as fh:
        fh.write(ct)

    if os.path.exists(out):
        os.remove(out)
    names = []
    for root, _, files in os.walk(BUILD):
        for f in files:
            rel = os.path.relpath(os.path.join(root, f), BUILD)
            names.append(rel.replace(os.sep, "/"))
    names.sort(key=lambda n: (n != "[Content_Types].xml", n))
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for name in names:
            z.write(os.path.join(BUILD, name), name)


def render(docx, pdf):
    subprocess.run(["soffice", "--headless", "--norestore", "--convert-to", "pdf",
                    docx], check=True, capture_output=True, timeout=600)
    return pdf


def body_offset(pdf):
    """How far the PDF page index runs ahead of the printed page number."""
    n = int(subprocess.run(["pdfinfo", pdf], capture_output=True, text=True)
            .stdout.split("Pages:")[1].split()[0])
    for i in range(1, n + 1):
        txt = subprocess.run(
            ["pdftotext", "-f", str(i), "-l", str(i), "-layout", pdf, "-"],
            capture_output=True, text=True).stdout
        m = re.search(r"Page\s+(\d+)\s+of\s+\d+", " ".join(txt.split()))
        if m:
            return i - int(m.group(1))
    return 0


def page_map(pdf, needles, offset, skip_pages=0):
    """
    The printed page each heading first appears on.

    The whole line must be the heading. A substring search finds a section name
    where the prose mentions it, pages before the heading itself, and puts the
    wrong number in the contents without saying so.
    """
    n = int(subprocess.run(["pdfinfo", pdf], capture_output=True, text=True)
            .stdout.split("Pages:")[1].split()[0])
    pages = []
    for i in range(1, n + 1):
        txt = subprocess.run(
            ["pdftotext", "-f", str(i), "-l", str(i), "-layout", pdf, "-"],
            capture_output=True, text=True).stdout
        pages.append([" ".join(line.split()) for line in txt.splitlines()])

    result, cursor = [], skip_pages
    for needle in needles:
        flat = " ".join(needle.split())
        squashed = flat.replace(" ", "")
        found = None
        for i in range(cursor, len(pages)):
            if any(line == flat or line.replace(" ", "") == squashed
                   for line in pages[i]):
                found = i
                break
        if found is None:
            for i in range(cursor, len(pages)):
                if any(line.startswith(flat[:40]) for line in pages[i]):
                    found = i
                    break
        if found is None:
            result.append(None)
        else:
            cursor = found
            result.append(max(1, found + 1 - offset))
    return result


def build():
    """
    Lay the document out, read the page numbers off the render, rebuild with
    them in the contents, and repeat until a rebuild stops moving anything.

    Repeating is the point. An empty contents page occupies one page; a filled
    one can occupy more, and that difference pushes every heading after it
    further down the document. A single second pass would therefore write page
    numbers that were true of a shorter document than the one being shipped.
    """
    assemble()
    headings = list(HEADINGS)
    entries = [(lvl, txt, 1) for lvl, txt in headings]
    missing = 0
    settled = False

    for _ in range(6):
        package(assemble(entries), "pass1.docx")
        render("pass1.docx", "pass1.pdf")
        offset = body_offset("pass1.pdf")
        pages = page_map("pass1.pdf", [t for _, t in headings], offset,
                         skip_pages=2)
        nxt = [(lvl, txt, pg if pg else 1)
               for (lvl, txt), pg in zip(headings, pages)]
        missing = sum(1 for p in pages if p is None)
        if nxt == entries:
            settled = True
            break
        entries = nxt

    package(assemble(entries), OUT)
    size = os.path.getsize(OUT)
    print(f"wrote {OUT}  ({size / 1024:.0f} KB, {len(entries)} contents entries"
          + ("" if settled else ", PAGE NUMBERS DID NOT SETTLE")
          + (f", {missing} not resolved" if missing else "") + ")")
    for f in ("pass1.docx", "pass1.pdf"):
        if os.path.exists(f):
            os.remove(f)


if __name__ == "__main__":
    build()

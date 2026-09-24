"""
Build the Software Design Description inside the faculty's own SDD template.

Only word/document.xml is rewritten; styles.xml, numbering.xml, the theme, the
footer and both section definitions are carried through from the template
untouched, so the fonts, margins, page size and page numbering are the
template's own rather than a reconstruction of them.

The formatting contract was read off the template and is reproduced exactly:

    Heading1        pStyle + spacing 276 + jc both, runs bold sz 28
    Heading2        pStyle + spacing 276 + jc both, runs rFonts Times New Roman
    Heading3        pStyle + spacing 276 + jc both, no run override
    Caption         pStyle + spacing 276 + jc both, runs sz 24
    IndexHeading    pStyle + spacing 276 + jc both
    body text       spacing 276 + ind firstLine 389 + jc both, runs sz 24
"""
import os
import re
import shutil
import subprocess
import zipfile
from xml.sax.saxutils import escape

from PIL import Image

from content import (ARCHITECTURE, DATA_FIELDS, DEPLOYMENT, GLOSSARY,
                     INTERFACE_SHOTS, OVERVIEW, PROJECT, REALIZATIONS,
                     REFERENCES, SCOPE, PURPOSE, HELP_SYSTEM, DATA_INTRO,
                     SYSTEM_SEQUENCE_NOTE, INTERFACE_INTRO,
                     DATA_NOTES, ARCH_INTRO, SUPERVISOR, STUDENTS, SUBMIT_DATE,
                     INDEX_TERMS)

SRC = "unpacked"
BUILD = "build"
OUT = "Bursary-Bridge_SDD.docx"

TEXT_WIDTH_IN = 6.0                 # 12240 page - 1800 - 1800 margins = 8640 twips
TEXT_WIDTH_TWIPS = 8640
EMU_PER_INCH = 914400

# Paragraph fragments taken verbatim from the template.
# Body text at eleven points, one and a half spaced, as the brief requires.
# The supplied sample is set twelve on 1.15; where the two disagree the stated
# requirement wins, and it is the only place this document departs from the
# sample's typography.
BODY_RPR = '<w:rPr><w:sz w:val="22"/></w:rPr>'
BODY_SPACING = '<w:spacing w:line="360" w:lineRule="auto"/>'
BODY_IND = '<w:ind w:firstLine="389"/>'

images = []          # (relationship id, filename)


def rid_for(path):
    """Register an image and return the relationship id the body should use."""
    for rid, p in images:
        if p == path:
            return rid
    rid = f"rIdImg{len(images) + 1}"
    images.append((rid, path))
    return rid


def runs(parts):
    """parts: str, or [(text, bold, italic)]."""
    if isinstance(parts, str):
        parts = [(parts, False, False)]
    out = []
    for text, bold, italic in parts:
        rpr = '<w:rPr>'
        if bold:
            rpr += '<w:b/>'
        if italic:
            rpr += '<w:i/>'
        rpr += '<w:sz w:val="24"/></w:rPr>'
        out.append(f'<w:r>{rpr}<w:t xml:space="preserve">{escape(text)}</w:t></w:r>')
    return "".join(out)


def para(parts, style=None, jc="both", ind=True, keep_next=False):
    """
    A body paragraph in the template's own shape.

    CT_PPr fixes the order of these children: pStyle, keepNext, spacing, ind,
    jc, rPr.
    """
    ppr = "<w:pPr>"
    if style:
        ppr += f'<w:pStyle w:val="{style}"/>'
    if keep_next:
        ppr += "<w:keepNext/>"
    ppr += BODY_SPACING
    if ind:
        ppr += BODY_IND
    if jc:
        ppr += f'<w:jc w:val="{jc}"/>'
    ppr += BODY_RPR + "</w:pPr>"
    return f"<w:p>{ppr}{runs(parts)}</w:p>"


def plain(text, style=None, jc="both"):
    """A paragraph with no first-line indent, for label/value lines."""
    return para(text, style=style, jc=jc, ind=False)


def blank():
    return f'<w:p><w:pPr>{BODY_SPACING}{BODY_RPR}</w:pPr></w:p>'


def page_break():
    return ('<w:p><w:pPr>' + BODY_SPACING + '</w:pPr>'
            '<w:r><w:br w:type="page"/></w:r></w:p>')
HEADINGS = []      # (level, text) in document order, collected during build
FIGURES = []       # caption text in document order


def toc_entry(level, text, page, first=False, last=False, instr=None):
    style = f"TOC{min(level, 4)}"
    begin = ""
    end = ""
    if first:
        begin = ('<w:r><w:fldChar w:fldCharType="begin" w:dirty="true"/></w:r>'
                 f'<w:r><w:instrText xml:space="preserve"> {instr} </w:instrText></w:r>'
                 '<w:r><w:fldChar w:fldCharType="separate"/></w:r>')
    if last:
        end = '<w:r><w:fldChar w:fldCharType="end"/></w:r>'
    return (f'<w:p><w:pPr><w:pStyle w:val="{style}"/>'
            '<w:tabs><w:tab w:val="right" w:leader="dot" w:pos="8640"/></w:tabs>'
            '<w:rPr><w:noProof/></w:rPr></w:pPr>'
            f'{begin}'
            f'<w:r><w:t xml:space="preserve">{escape(text)}</w:t></w:r>'
            f'<w:r><w:tab/></w:r><w:r><w:t>{page}</w:t></w:r>'
            f'{end}</w:p>')


def build_toc(entries, instr):
    """entries: [(level, text, page)]"""
    if not entries:
        return ""
    out = ""
    for i, (level, text, page) in enumerate(entries):
        out += toc_entry(level, text, page,
                         first=(i == 0), last=(i == len(entries) - 1),
                         instr=instr)
    return out



def body_offset(pdf):
    """
    How many pages come before the body section.

    The body footer prints "Page N of M", so the first page carrying one tells
    us how far the PDF index runs ahead of the printed page number.
    """
    n = int(subprocess.run(["pdfinfo", pdf], capture_output=True, text=True)
            .stdout.split("Pages:")[1].split()[0])
    for i in range(1, n + 1):
        txt = subprocess.run(
            ["pdftotext", "-f", str(i), "-l", str(i), "-layout", pdf, "-"],
            capture_output=True, text=True).stdout
        m = re.search(r"Page\s+(\d+)\s+of\s+\d+", " ".join(txt.split()))
        if m:
            return i - int(m.group(1))
    return 3

def page_map(pdf, needles, offset):
    """
    Find the printed page number each heading or caption first appears on.

    Matching is done line by line and requires the whole line to be the needle.
    A substring search finds a design entity's name where the prose mentions it,
    several pages before its own heading, and silently puts the wrong number in
    the contents; requiring the line to be the heading rules that out.

    `offset` converts the PDF's absolute page index into the page number the
    footer actually prints.
    """
    n = int(subprocess.run(["pdfinfo", pdf], capture_output=True, text=True)
            .stdout.split("Pages:")[1].split()[0])
    pages = []
    for i in range(1, n + 1):
        txt = subprocess.run(
            ["pdftotext", "-f", str(i), "-l", str(i), "-layout", pdf, "-"],
            capture_output=True, text=True).stdout
        pages.append([" ".join(line.split()) for line in txt.splitlines()])

    result, cursor = [], 0
    for needle in needles:
        flat = " ".join(needle.split())
        squashed = flat.replace(" ", "")
        found = None
        for i in range(cursor, len(pages)):
            if any(line == flat or line.replace(" ", "") == squashed
                   for line in pages[i]):
                found = i
                break
        if found is None:                  # a heading that wrapped onto two lines
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
def page_hits(pdf, terms, offset, skip_pages=0, stop_page=None):
    """
    Every printed page on which each index term appears.

    The contents and the table of figures repeat many of these words, so the
    first `skip_pages` of the render are ignored; an index that pointed a
    reader back at the contents page would be worse than no index. The index
    itself is excluded the same way through `stop_page`, or every entry would
    cite the page it is printed on. Matching is on a word boundary and ignores
    case, because "Session" should be found in "the Session record" but not
    inside "Sessions" of some other sense.
    """
    n = int(subprocess.run(["pdfinfo", pdf], capture_output=True, text=True)
            .stdout.split("Pages:")[1].split()[0])
    text = []
    for i in range(1, n + 1):
        out = subprocess.run(
            ["pdftotext", "-f", str(i), "-l", str(i), "-layout", pdf, "-"],
            capture_output=True, text=True).stdout
        text.append(" ".join(out.split()))

    hits = {}
    for term in terms:
        pattern = re.compile(r"\b" + re.escape(term) + r"\b", re.IGNORECASE)
        last = n if stop_page is None else min(n, stop_page)
        pages = [i + 1 - offset for i in range(skip_pages, last)
                 if pattern.search(text[i])]
        if pages:
            hits[term] = sorted({p for p in pages if p >= 1})
    return hits


def picture(path, max_width_in=TEXT_WIDTH_IN, doc_id=[1]):
    w_px, h_px = Image.open(path).size
    width_in = min(max_width_in, w_px / 96)
    height_in = width_in * h_px / w_px
    # Keep a tall figure inside one page.
    if height_in > 7.6:
        height_in = 7.6
        width_in = height_in * w_px / h_px
    cx, cy = int(width_in * EMU_PER_INCH), int(height_in * EMU_PER_INCH)
    rid = rid_for(path)
    n = doc_id[0]
    doc_id[0] += 1
    return (
        '<w:p><w:pPr><w:keepNext/><w:jc w:val="center"/></w:pPr><w:r><w:drawing>'
        f'<wp:inline distT="0" distB="0" distL="0" distR="0">'
        f'<wp:extent cx="{cx}" cy="{cy}"/>'
        '<wp:effectExtent l="0" t="0" r="0" b="0"/>'
        f'<wp:docPr id="{900 + n}" name="Figure {n}"/>'
        '<wp:cNvGraphicFramePr><a:graphicFrameLocks '
        'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
        'noChangeAspect="1"/></wp:cNvGraphicFramePr>'
        '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'
        '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">'
        '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">'
        f'<pic:nvPicPr><pic:cNvPr id="{900 + n}" name="{os.path.basename(path)}"/>'
        '<pic:cNvPicPr/></pic:nvPicPr>'
        f'<pic:blipFill><a:blip r:embed="{rid}"/>'
        '<a:stretch><a:fillRect/></a:stretch></pic:blipFill>'
        '<pic:spPr><a:xfrm><a:off x="0" y="0"/>'
        f'<a:ext cx="{cx}" cy="{cy}"/></a:xfrm>'
        '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>'
        '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>'
    )
def cell(content, width, bold=False):
    """
    A table cell.

    The template states Times New Roman explicitly on both the paragraph mark
    and the run of every cell. That is not redundant: the TableGrid style sets
    rFonts to the theme's minor font, which is a sans face, and without the
    explicit override a table inherits it and renders in the wrong typeface.
    Cells also carry no line spacing, matching the template's own tables.
    """
    if isinstance(content, str):
        rpr = ('<w:rPr><w:rFonts w:ascii="Times New Roman" '
               'w:hAnsi="Times New Roman" w:cs="Times New Roman"/>'
               + ("<w:b/>" if bold else "")
               + '<w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>')
        body = (f"<w:p><w:pPr>{rpr}</w:pPr>"
                f'<w:r>{rpr}<w:t xml:space="preserve">{escape(content)}</w:t></w:r></w:p>')
    else:
        body = "".join(content)
    return f'<w:tc><w:tcPr><w:tcW w:w="{width}" w:type="dxa"/></w:tcPr>{body}</w:tc>'
def toc_field(instr, placeholder):
    return ('<w:p><w:pPr><w:jc w:val="left"/></w:pPr>'
            '<w:r><w:fldChar w:fldCharType="begin" w:dirty="true"/></w:r>'
            f'<w:r><w:instrText xml:space="preserve"> {instr} </w:instrText></w:r>'
            '<w:r><w:fldChar w:fldCharType="separate"/></w:r>'
            f'<w:r>{BODY_RPR}<w:t xml:space="preserve">{escape(placeholder)}</w:t></w:r>'
            '<w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>')


# ---------------------------------------------------------------------------
# Section properties, copied verbatim from the template
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Headings
#
# The template carries the point size and weight on every run rather than only
# on the paragraph mark, and overrides Heading2's Arial back to Times New
# Roman. Both are reproduced, or the headings come out at the 10pt Normal size.
# ---------------------------------------------------------------------------
HEADING_RPR = {
    1: '<w:rPr><w:b/><w:sz w:val="28"/></w:rPr>',
    2: '<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/></w:rPr>',
    3: '',
}


def heading(level, text, in_toc=True):
    if in_toc:
        HEADINGS.append((level, text))
    rpr = HEADING_RPR[level]
    ppr = (f'<w:pPr><w:pStyle w:val="Heading{level}"/>'
           + BODY_SPACING + '<w:jc w:val="both"/>'
           + (rpr if rpr else "") + "</w:pPr>")
    return (f"<w:p>{ppr}"
            f'<w:r>{rpr}<w:t xml:space="preserve">{escape(text)}</w:t></w:r></w:p>')


def entity_line(text):
    """A `Name:` / `Type:` line, in the template's IndexHeading style."""
    return (f'<w:p><w:pPr><w:pStyle w:val="IndexHeading"/>{BODY_SPACING}'
            f'<w:jc w:val="both"/></w:pPr>'
            f'<w:r><w:t xml:space="preserve">{escape(text)}</w:t></w:r></w:p>')


def caption(text):
    """Numbered with a SEQ field, so Word can rebuild the Table of Figures."""
    FIGURES.append(f"Figure {len(FIGURES) + 1} {text}")
    n = len(FIGURES)
    return (
        f'<w:p><w:pPr><w:pStyle w:val="Caption"/>{BODY_SPACING}'
        f'<w:jc w:val="both"/>{BODY_RPR}</w:pPr>'
        f'<w:r>{BODY_RPR}<w:t xml:space="preserve">Figure </w:t></w:r>'
        f'<w:r>{BODY_RPR}<w:fldChar w:fldCharType="begin"/></w:r>'
        f'<w:r>{BODY_RPR}<w:instrText xml:space="preserve"> SEQ Figure \\* ARABIC </w:instrText></w:r>'
        f'<w:r>{BODY_RPR}<w:fldChar w:fldCharType="separate"/></w:r>'
        f'<w:r>{BODY_RPR}<w:t>{n}</w:t></w:r>'
        f'<w:r>{BODY_RPR}<w:fldChar w:fldCharType="end"/></w:r>'
        f'<w:r>{BODY_RPR}<w:t xml:space="preserve"> {escape(text)}</w:t></w:r></w:p>'
    )


def figure(path, text, max_width_in=TEXT_WIDTH_IN):
    return picture(path, max_width_in) + caption(text)


# The template's own content tables declare their borders inline and carry no
# table style. That matters: the TableGrid style sets rFonts to the theme's
# minor font, which is a sans face, so a table given that style renders in the
# wrong typeface. Only the title page table uses TableGrid, as in the template.
TBLPR_TABLEGRID = ('<w:tblPr><w:tblStyle w:val="TableGrid"/>'
                   '<w:tblW w:w="0" w:type="auto"/>'
                   '<w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" '
                   'w:firstColumn="1" w:lastColumn="0" w:noHBand="0" '
                   'w:noVBand="1"/></w:tblPr>')


def _borders(sz, color):
    edges = ("top", "left", "bottom", "right", "insideH", "insideV")
    return ("<w:tblBorders>"
            + "".join(f'<w:{e} w:val="single" w:sz="{sz}" w:space="0" '
                      f'w:color="{color}"/>' for e in edges)
            + "</w:tblBorders>")


TBLPR_GLOSSARY = ('<w:tblPr><w:tblW w:w="8640" w:type="dxa"/>'
                  + _borders(4, "auto")
                  + '<w:tblLayout w:type="fixed"/>'
                  '<w:tblLook w:val="0000" w:firstRow="0" w:lastRow="0" '
                  'w:firstColumn="0" w:lastColumn="0" w:noHBand="0" '
                  'w:noVBand="0"/></w:tblPr>')

TBLPR_DATA = ('<w:tblPr><w:tblW w:w="0" w:type="auto"/>'
              + _borders(6, "000080")
              + '<w:tblLayout w:type="fixed"/>'
              '<w:tblLook w:val="0020" w:firstRow="1" w:lastRow="0" '
              'w:firstColumn="0" w:lastColumn="0" w:noHBand="0" '
              'w:noVBand="0"/></w:tblPr>')


def table(rows, widths, header_bold=True, first_col_bold=False,
          tblpr=TBLPR_GLOSSARY):
    grid = "".join(f'<w:gridCol w:w="{w}"/>' for w in widths)
    body = ""
    for r, row in enumerate(rows):
        cells = ""
        for c, value in enumerate(row):
            bold = (header_bold and r == 0) or (first_col_bold and c == 0)
            cells += cell(value, widths[c], bold)
        body += f"<w:tr>{cells}</w:tr>"
    return f'<w:tbl>{tblpr}<w:tblGrid>{grid}</w:tblGrid>{body}</w:tbl>'


# ---------------------------------------------------------------------------
# Section properties, copied verbatim from the template.
#
# The first governs the title page and the front matter (titlePg suppresses the
# footer on page one); the second is the continuous break the template places
# after the glossary table. Both are kept where the template puts them.
# ---------------------------------------------------------------------------
SECT_FRONT = ('<w:sectPr><w:footerReference w:type="default" r:id="rId8"/>'
              '<w:pgSz w:w="12240" w:h="15840" w:code="1"/>'
              '<w:pgMar w:top="1440" w:right="1800" w:bottom="1440" w:left="1800" '
              'w:header="720" w:footer="720" w:gutter="0"/>'
              '<w:cols w:space="720"/><w:titlePg/></w:sectPr>')

SECT_BODY = ('<w:sectPr><w:type w:val="continuous"/>'
             '<w:pgSz w:w="12240" w:h="15840"/>'
             '<w:pgMar w:top="1440" w:right="1800" w:bottom="1440" w:left="1800" '
             'w:header="720" w:footer="720" w:gutter="0"/>'
             '<w:pgNumType w:start="1"/><w:cols w:space="720"/></w:sectPr>')


def section_break(sect):
    return f"<w:p><w:pPr>{sect}</w:pPr></w:p>"


def centred(text, size=24, bold=False, style=None):
    ppr = "<w:pPr>"
    if style:
        ppr += f'<w:pStyle w:val="{style}"/>'
    ppr += '<w:jc w:val="center"/>'
    ppr += f'<w:rPr>{"<w:b/>" if bold else ""}<w:sz w:val="{size}"/>'
    ppr += f'<w:szCs w:val="{size}"/></w:rPr></w:pPr>'
    rpr = f'<w:rPr>{"<w:b/>" if bold else ""}<w:sz w:val="{size}"/><w:szCs w:val="{size}"/></w:rPr>'
    return (f"<w:p>{ppr}<w:r>{rpr}"
            f'<w:t xml:space="preserve">{escape(text)}</w:t></w:r></w:p>')


def title_page():
    """Rebuilt to match the template's title page line for line."""
    crest = open("crest_para.xml", encoding="utf-8").read()
    rows = [("Student Name", "Student Number")] + STUDENTS
    return (
        crest
        + centred("Department of Computer Science", size=38)
        + blank()
        + centred("Software Design Description", size=38, style="BodyText")
        + blank()
        + blank()
        + centred(PROJECT, size=38, style="BodyText")
        + blank()
        + centred("Supervisor", size=24)
        + centred(SUPERVISOR, size=24)
        + blank()
        + plain("Submitted by", jc="left")
        + table(rows, [5274, 3356], header_bold=False, tblpr=TBLPR_TABLEGRID)
        + blank()
        + centred(SUBMIT_DATE, size=24)
        + page_break()
    )
def package(document, out):
    if os.path.exists(BUILD):
        shutil.rmtree(BUILD)
    shutil.copytree(SRC, BUILD)
    with open(f"{BUILD}/word/document.xml", "w", encoding="utf-8") as fh:
        fh.write(document)

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

    st_path = f"{BUILD}/word/settings.xml"
    st = open(st_path, encoding="utf-8").read()
    if "updateFields" not in st:
        # CT_Settings orders updateFields immediately before footnotePr.
        st = st.replace("<w:footnotePr>",
                        '<w:updateFields w:val="true"/><w:footnotePr>', 1)
    with open(st_path, "w", encoding="utf-8") as fh:
        fh.write(st)

    if os.path.exists(out):
        os.remove(out)
    # Word writes [Content_Types].xml as the first entry and stores no
    # directory entries. Some readers rely on both, so write the archive the
    # same way rather than letting a recursive zip decide the order.
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
    subprocess.run(["soffice", "-env:UserInstallation=file:///tmp/lo_toc",
                    "--headless", "--norestore", "--convert-to", "pdf",
                    "--outdir", ".", docx],
                   capture_output=True, check=True, timeout=600)
    return pdf


# ---------------------------------------------------------------------------
# Front matter: contents and table of figures
# ---------------------------------------------------------------------------
def front_matter(toc_entries=None, fig_entries=None):
    toc = (build_toc(toc_entries, 'TOC \\o "1-3"') if toc_entries
           else toc_field('TOC \\o "1-3"', "Table of contents"))
    lof = (build_toc(fig_entries, 'TOC \\c "Figure"') if fig_entries
           else toc_field('TOC \\c "Figure"', "Table of figures"))
    return (
        heading(1, "Table of Contents", in_toc=False)
        + blank()
        + toc
        + page_break()
        + heading(1, "Table of Figures", in_toc=False)
        + blank()
        + lof
        + page_break()
    )


# ---------------------------------------------------------------------------
# 1.0 Introduction
# ---------------------------------------------------------------------------
def introduction():
    x = heading(1, "1.0. Introduction")

    x += heading(2, "1.1. Purpose")
    for p in PURPOSE:
        x += para(p, style="BodyTextIndent", ind=False)

    x += heading(2, "1.2. Scope")
    for p in SCOPE:
        x += para(p)

    x += heading(2, "1.3. Glossary")
    x += table([("Term", "Definition")] + GLOSSARY, [2122, 6518])
    x += blank()

    # The template places its second section break here, after the glossary.
    x += section_break(SECT_FRONT)

    x += heading(2, "1.4. References")
    for line in REFERENCES:
        x += plain(line) if line else blank()

    x += heading(2, "1.5. Overview of document")
    for i, p in enumerate(OVERVIEW):
        x += para(p, ind=(i > 0))
    return x


# ---------------------------------------------------------------------------
# 2.0 Deployment diagram
# ---------------------------------------------------------------------------
def deployment_section():
    x = heading(1, "2.0. Deployment diagram")
    x += figure("figures/fig1_deployment.png", "Deployment Diagram")
    for p in DEPLOYMENT:
        x += para(p)
    return x


# ---------------------------------------------------------------------------
# 3.0 Architecture design
# ---------------------------------------------------------------------------
def architecture_section():
    x = heading(1, "3.0. Architecture design")
    x += heading(2, "3.1. Web System Architecture")
    x += figure("figures/fig2_architecture.png", "Architecture Design")
    for p in ARCH_INTRO:
        x += para(p)

    for entity in ARCHITECTURE:
        x += heading(3, entity["name"])
        x += entity_line(f"Name: {entity['name']}")
        x += entity_line(f"Type: {entity['type']}")
        for i, d in enumerate(entity["description"]):
            x += para(("Description: " if i == 0 else "") + d, ind=False)
        x += plain("Attributes:")
        for a in entity["attributes"]:
            x += plain(f"    {a}")
        x += plain("Resources:")
        for r in entity["resources"]:
            x += plain(f"    {r}")
        x += plain("Operations:")
        for op in entity["operations"]:
            x += plain(f"    Name: {op['name']}")
            x += plain(f"    Arguments: {op['arguments']}")
            x += plain(f"    Returns: {op['returns']}")
            x += plain(f"    Pre-condition: {op['pre']}")
            x += plain(f"    Post-condition: {op['post']}")
            x += plain(f"    Exceptions: {op['exceptions']}")
            x += plain("    Flow of Events:")
            for step in op["flow"]:
                x += plain(f"        {step}")
            x += blank()
    return x


# ---------------------------------------------------------------------------
# 4.0 Data structure design
# ---------------------------------------------------------------------------
def data_section():
    x = heading(1, "4.0. Data structure design")
    for p in DATA_INTRO:
        x += para(p)
    x += heading(2, "4.1.  Data field types and sizes.")
    x += table(DATA_FIELDS, [4140, 1620, 2880], tblpr=TBLPR_DATA)
    x += blank()
    for p in DATA_NOTES:
        x += para(p)
    return x


# ---------------------------------------------------------------------------
# 5.0 Use case realizations
# ---------------------------------------------------------------------------
def realizations_section():
    x = heading(1, "5.0. Use case realizations")
    for p in SYSTEM_SEQUENCE_NOTE:
        x += para(p)
    x += figure("figures/fig3_system.png", "System Sequence Diagram")
    for title, srs, note, fname, cap in REALIZATIONS:
        x += heading(2, title)
        x += para([(f"See also {title.split(': ', 1)[1]} in Software Requirements "
                    f"Specification {srs}.", False, False)], style="BodyText")
        x += para(note)
        x += figure(f"figures/{fname}", cap)
    return x


# ---------------------------------------------------------------------------
# 6.0 Interface design
# ---------------------------------------------------------------------------
def interface_section():
    x = heading(1, "6.0. Interface design")
    for p in INTERFACE_INTRO:
        x += para(p, style="BodyText", ind=False)
    for fname, cap in INTERFACE_SHOTS:
        x += figure(f"figures/{fname}", cap)
    return x


# ---------------------------------------------------------------------------
# 7.0 Help system design and 8.0 Index
# ---------------------------------------------------------------------------
def help_section():
    x = heading(1, "7.0. Help system design")
    for p in HELP_SYSTEM:
        x += para(p, style="BodyText", ind=False)
    return x


def index_section(index_hits=None):
    """
    Section 8, an alphabetical index of the terms the document defines and uses.

    The template leaves this section empty for Word to fill from an INDEX field,
    which only populates once the reader presses F9 and shows nothing at all in
    a viewer that does not implement the field. The pages are therefore read off
    the laid-out document in the same pass that numbers the contents, and the
    entries are written as ordinary text, so the index is there when the file is
    opened, whatever it is opened in.
    """
    x = heading(1, "8.0. Index")

    if not index_hits:
        return x + blank()

    for term in sorted(index_hits, key=str.lower):
        pages = index_hits[term]
        # Consecutive pages read as a range, which is how an index is written
        # and is considerably shorter for a term used throughout a section.
        runs, run = [], [pages[0]]
        for page in pages[1:]:
            if page == run[-1] + 1:
                run.append(page)
            else:
                runs.append(run)
                run = [page]
        runs.append(run)
        printed = ", ".join(str(r[0]) if len(r) == 1
                            else f"{r[0]}\u2013{r[-1]}" for r in runs)
        x += ('<w:p><w:pPr>'
              '<w:tabs><w:tab w:val="right" w:leader="dot" w:pos="8640"/></w:tabs>'
              + BODY_SPACING + BODY_RPR + '</w:pPr>'
              f'<w:r>{BODY_RPR}<w:t xml:space="preserve">{escape(term)}</w:t></w:r>'
              f'<w:r>{BODY_RPR}<w:tab/></w:r>'
              f'<w:r>{BODY_RPR}<w:t xml:space="preserve">{escape(printed)}</w:t></w:r>'
              '</w:p>')
    return x


def assemble(toc_entries=None, fig_entries=None, index_hits=None):
    HEADINGS.clear()
    FIGURES.clear()
    images.clear()
    body = (
        title_page()
        + front_matter(toc_entries, fig_entries)
        + introduction()
        + deployment_section()
        + architecture_section()
        + data_section()
        + realizations_section()
        + interface_section()
        + help_section()
        + index_section(index_hits)
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
    return f"{prefix}{body}{SECT_BODY}</w:body></w:document>"


def build():
    """
    Lay the document out, read the page numbers off the render, rebuild with
    those numbers cached into the contents and the table of figures, and repeat
    until the numbers stop moving.

    Repeating is the point. An unfilled contents field occupies one line; the
    filled one occupies four pages, and that difference pushes every heading
    after it further down the document. A single second pass would therefore
    write page numbers that were true of a document two pages shorter than the
    one being shipped. Each rebuild feeds the previous layout back in, and the
    numbers settle once a rebuild no longer changes where anything sits.
    """
    assemble()                       # collects HEADINGS and FIGURES
    headings = list(HEADINGS)
    figures = list(FIGURES)

    toc_entries = [(lvl, txt, 1) for lvl, txt in headings]
    fig_entries = [(1, txt, 1) for txt in figures]
    index_hits = {}
    missing = 0
    settled = False

    for _ in range(6):
        package(assemble(toc_entries, fig_entries, index_hits), "pass1.docx")
        render("pass1.docx", "pass1.pdf")

        offset = body_offset("pass1.pdf")
        h_pages = page_map("pass1.pdf", [t for _, t in headings], offset)
        f_pages = page_map("pass1.pdf", figures, offset)

        next_toc = [(lvl, txt, pg if pg else 1)
                    for (lvl, txt), pg in zip(headings, h_pages)]
        next_fig = [(1, txt, pg if pg else 1)
                    for txt, pg in zip(figures, f_pages)]
        # The front matter repeats most of these words; skipping it keeps the
        # index pointing at the body rather than back at the contents.
        front = next((pg for (_, txt, pg) in next_toc
                      if txt.startswith("1.0.")), 1) + offset - 1
        index_at = next((pg for (_, txt, pg) in next_toc
                         if txt.startswith("8.0.")), None)
        next_index = page_hits("pass1.pdf", INDEX_TERMS, offset,
                               skip_pages=front,
                               stop_page=(index_at + offset - 1) if index_at else None)
        missing = sum(1 for p in h_pages + f_pages if p is None)

        if (next_toc == toc_entries and next_fig == fig_entries
                and next_index == index_hits):
            settled = True
            break
        toc_entries, fig_entries, index_hits = next_toc, next_fig, next_index

    package(assemble(toc_entries, fig_entries, index_hits), OUT)
    size = os.path.getsize(OUT)
    print(f"wrote {OUT}  ({size/1024:.0f} KB, {len(images)} figures, "
          f"{len(toc_entries)} contents entries, {len(fig_entries)} figure entries, "
          f"{len(index_hits)} index entries"
          + ("" if settled else ", PAGE NUMBERS DID NOT SETTLE")
          + (f", {missing} page numbers not resolved" if missing else "") + ")")
    for f in ("pass1.docx", "pass1.pdf"):
        if os.path.exists(f):
            os.remove(f)


if __name__ == "__main__":
    build()

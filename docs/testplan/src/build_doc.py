"""
Build the Test Plan inside the supplied template.

Only word/document.xml is rewritten; styles.xml, numbering.xml, the theme, the
header and the section definition are carried through from the template
untouched, so the heading sizes, the margins, the page size and the page setup
are the template's own.

The paragraph shapes were read off the template and are reproduced exactly:

    Heading1   pStyle + pBdr, sz 40 (20pt) from the template's own style
    Heading2   pStyle + pBdr + <w:b/> on the paragraph mark, sz 32 (16pt)
    body       pBdr alone
    list item  numPr + pBdr

Every paragraph in the template carries a pBdr of nil borders, which is an
export artefact of the tool that produced it. It is reproduced rather than
tidied away, because the instruction is to preserve the template.

Two things the template does NOT carry are added, because the brief asks for
them explicitly and names the template's own default as a font not to use:

    Times New Roman   stated on every paragraph mark and every run. The
                      template's docDefaults set Arial, which the brief rules
                      out by name, so the override is stated everywhere rather
                      than by editing the template's styles.
    1.5 line spacing  on body text and list items. The template's default is
                      276 (1.15). Headings keep the template's own spacing,
                      since the requirement is for the body.

Body text stays at 11pt, which is what the template's docDefaults already give
it, so no size is stated on body runs at all.

List numbering is kept as the template defines it:
    numId 2 -> decimal, used for the Introduction objectives
    numId 3 -> bullet,  used for Features To Be Tested
    numId 1 -> bullet,  used for Testing Tasks
"""
import os
import shutil
import zipfile
from xml.sax.saxutils import escape

import content as C

SRC = "unpacked"
BUILD = "build"
OUT = "Bursary-Bridge_Test_Plan.docx"

PBDR = ('<w:pBdr><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/>'
        '<w:right w:val="nil"/><w:between w:val="nil"/></w:pBdr>')

TNR = ('<w:rFonts w:ascii="Times New Roman" w:eastAsia="Times New Roman" '
       'w:hAnsi="Times New Roman" w:cs="Times New Roman"/>')
SPACING = '<w:spacing w:line="360" w:lineRule="auto"/>'
JC = '<w:jc w:val="both"/>'


def _text(s, bold=False):
    # A typewriter apostrophe in a justified serif column is the one
    # typographic detail a reader notices without looking for it.
    body = escape(s.replace("'", "\u2019"))
    rpr = "<w:rPr>" + TNR + ("<w:b/>" if bold else "") + "</w:rPr>"
    return f'<w:r>{rpr}<w:t xml:space="preserve">{body}</w:t></w:r>'


def h1(s):
    # No jc: the template leaves its headings ranged left, and the brief asks
    # for justification of the body.
    return (f'<w:p><w:pPr><w:pStyle w:val="Heading1"/>{PBDR}'
            f'<w:rPr>{TNR}</w:rPr></w:pPr>{_text(s)}</w:p>')


def h2(s):
    # The <w:b/> sits on the paragraph mark and not on the run, which is how
    # the template has it: the heading text itself is not bold, and making it
    # bold would change the template's appearance.
    return (f'<w:p><w:pPr><w:pStyle w:val="Heading2"/>{PBDR}'
            f'<w:rPr>{TNR}<w:b/></w:rPr></w:pPr>{_text(s)}</w:p>')


def para(s):
    # CT_PPr orders pBdr before spacing, spacing before jc, jc before rPr.
    return (f'<w:p><w:pPr>{PBDR}{SPACING}{JC}<w:rPr>{TNR}</w:rPr></w:pPr>'
            f'{_text(s)}</w:p>')


def blank():
    # No spacing override. The template's own empty paragraphs carry nothing
    # but the border, and an empty paragraph set to one and a half lines is
    # half a line of whitespace that only ever pushes content onto a new page.
    return f'<w:p><w:pPr>{PBDR}<w:rPr>{TNR}</w:rPr></w:pPr></w:p>'


def item(s, num):
    # CT_PPr orders numPr before pBdr.
    return (f'<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/>'
            f'<w:numId w:val="{num}"/></w:numPr>{PBDR}{SPACING}{JC}'
            f'<w:rPr>{TNR}</w:rPr></w:pPr>{_text(s)}</w:p>')


def section(title, blocks):
    """A Heading2 followed by its blocks, then the blank line the template uses."""
    out = h2(title)
    for kind, value in blocks:
        if kind == "p":
            out += para(value)
        elif kind == "blank":
            out += blank()
        else:
            out += item(value, kind)
    return out + blank()


def build_body():
    x = h1(C.TITLE) + blank()
    for title, blocks in C.SECTIONS:
        x += section(title, blocks)
    return x + blank()


PREFIX = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    '<w:document '
    'xmlns:o="urn:schemas-microsoft-com:office:office" '
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
    'xmlns:v="urn:schemas-microsoft-com:vml" '
    'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" '
    'xmlns:w10="urn:schemas-microsoft-com:office:word" '
    'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" '
    'xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" '
    'xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" '
    'xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" '
    'xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" '
    'xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" '
    'mc:Ignorable="w14 wp14">'
    "<w:body>"
)

# Section properties, copied verbatim from the template.
SECTPR = ('<w:sectPr><w:headerReference w:type="default" r:id="rId7"/>'
          '<w:pgSz w:w="12240" w:h="15840"/>'
          '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" '
          'w:header="0" w:footer="720" w:gutter="0"/>'
          '<w:pgNumType w:start="1"/><w:cols w:space="720"/></w:sectPr>')


def package(document, out):
    if os.path.exists(BUILD):
        shutil.rmtree(BUILD)
    shutil.copytree(SRC, BUILD)
    with open(f"{BUILD}/word/document.xml", "w", encoding="utf-8") as fh:
        fh.write(document)

    names = []
    for root, _, files in os.walk(BUILD):
        for f in files:
            rel = os.path.relpath(os.path.join(root, f), BUILD)
            names.append(rel.replace(os.sep, "/"))
    # Word writes [Content_Types].xml first and stores no directory entries.
    names.sort(key=lambda n: (n != "[Content_Types].xml", n))

    if os.path.exists(out):
        os.remove(out)
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for name in names:
            z.write(os.path.join(BUILD, name), name)


if __name__ == "__main__":
    package(PREFIX + build_body() + SECTPR + "</w:body></w:document>", OUT)
    size = os.path.getsize(OUT)
    print(f"wrote {OUT} ({size/1024:.0f} KB, {len(C.SECTIONS)} sections)")

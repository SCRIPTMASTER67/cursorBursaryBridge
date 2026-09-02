"""
Build the Bursary-Bridge SRS.

Works by rewriting the body of the supplied template, leaving styles.xml,
numbering.xml, the theme, the headers and footers and the page setup exactly as
they were. That is what keeps the fonts and the section structure identical to
the template rather than merely similar.
"""
import os
import re
import shutil
import subprocess
from xml.sax.saxutils import escape

from PIL import Image

from content import (DATA_ENTITIES, GLOSSARY, NON_FUNCTIONAL, PROJECT,
                     SECURITY, SUBTITLE, USE_CASES)

SRC = "unpacked"
BUILD = "build"
OUT = "Bursary-Bridge_SRS.docx"

EMU_PER_INCH = 914400
TEXT_WIDTH_IN = 6.0                 # 12240 page - 1800 - 1800 margins = 8640 twips
TEXT_WIDTH_TWIPS = 8640

# Body runs in the template carry these directly; reproducing them keeps the
# generated text identical to the sample rather than merely similar.
BODY_RPR = '<w:rPr><w:spacing w:val="-3"/><w:sz w:val="24"/></w:rPr>'
BODY_SPACING = '<w:spacing w:line="276" w:lineRule="auto"/>'

images = []          # (relationship id, filename)
_next_rid = [100]


def rid_for(path):
    """Register an image and return the relationship id to embed it with."""
    rid = f"rId{_next_rid[0]}"
    _next_rid[0] += 1
    images.append((rid, path))
    return rid


# ---------------------------------------------------------------------------
# Paragraph helpers
# ---------------------------------------------------------------------------
def runs(parts):
    """parts: str, or list of (text, bold, italic)."""
    if isinstance(parts, str):
        parts = [(parts, False, False)]
    out = []
    for text, bold, italic in parts:
        rpr = '<w:rPr><w:spacing w:val="-3"/>'
        if bold:
            rpr += "<w:b/>"
        if italic:
            rpr += "<w:i/>"
        rpr += '<w:sz w:val="24"/></w:rPr>'
        out.append(f'<w:r>{rpr}<w:t xml:space="preserve">{escape(text)}</w:t></w:r>')
    return "".join(out)


def para(parts, style=None, jc="both", ind=None, keep_next=False, spacing=True):
    # CT_PPr fixes the order of these children:
    # pStyle, keepNext, spacing, ind, jc, rPr.
    ppr = "<w:pPr>"
    if style:
        ppr += f'<w:pStyle w:val="{style}"/>'
    if keep_next:
        ppr += "<w:keepNext/>"
    if spacing:
        ppr += BODY_SPACING
    if ind:
        ppr += ind
    if jc:
        ppr += f'<w:jc w:val="{jc}"/>'
    ppr += BODY_RPR + "</w:pPr>"
    return f"<w:p>{ppr}{runs(parts)}</w:p>"


# ---------------------------------------------------------------------------
# Two-pass table of contents
#
# The template ships a TOC field whose result is cached, so the entries and page
# numbers are visible the moment the document is opened. Reproducing that means
# rendering once to discover the page numbers, then rebuilding with them.
# ---------------------------------------------------------------------------
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
    Find the printed page number each string first appears on.

    `offset` converts the PDF's absolute page index into the arabic page number
    the body section actually shows.
    """
    import subprocess
    pages = []
    n = int(subprocess.run(["pdfinfo", pdf], capture_output=True, text=True)
            .stdout.split("Pages:")[1].split()[0])
    for i in range(1, n + 1):
        txt = subprocess.run(
            ["pdftotext", "-f", str(i), "-l", str(i), "-layout", pdf, "-"],
            capture_output=True, text=True).stdout
        pages.append(" ".join(txt.split()))

    result, cursor = [], 0
    for needle in needles:
        flat = " ".join(needle.split())
        found = None
        for i in range(cursor, len(pages)):
            if flat in pages[i]:
                found = i
                break
        if found is None:                      # ignore how the tab was spaced
            squashed = flat.replace(" ", "")
            for i in range(cursor, len(pages)):
                if squashed in pages[i].replace(" ", ""):
                    found = i
                    break
        if found is None:                      # fall back to a looser search
            head = flat[:38]
            for i in range(cursor, len(pages)):
                if head in pages[i]:
                    found = i
                    break
        if found is None:
            result.append(None)
        else:
            cursor = found
            result.append(max(1, found + 1 - offset))
    return result

# The template gives its own headings an explicit tab stop at 900 twips so that
# a two-digit section number ("3.2.10") still clears the number column, and it
# overrides the point size on levels 1, 3 and 4. Both are reproduced here.
HEADING_SZ = {1: "28", 3: "24", 4: "24"}


def heading(level, text, in_toc=True, plain_lead=None):
    """
    Headings use the template's own Heading1..Heading4 styles.

    The template carries its point size on every run rather than only on the
    paragraph mark, and writes the "Use case:" label of a level 4 heading with
    the style's bold switched off, so both are reproduced here.
    """
    if in_toc:
        HEADINGS.append((level, ((plain_lead or "") + text).replace("\t", " ")))

    ppr = f'<w:pPr><w:pStyle w:val="Heading{level}"/><w:keepNext/>'
    if "\t" in text:
        ppr += '<w:tabs><w:tab w:val="left" w:pos="900"/></w:tabs>'
    ppr += BODY_SPACING + '<w:jc w:val="both"/>'
    sz = HEADING_SZ.get(level)
    if sz:
        ppr += f'<w:rPr><w:sz w:val="{sz}"/></w:rPr>'
    ppr += "</w:pPr>"

    rpr = f'<w:rPr><w:sz w:val="{sz}"/></w:rPr>' if sz else ""
    lead_rpr = ('<w:rPr><w:b w:val="0"/>'
                + (f'<w:sz w:val="{sz}"/>' if sz else "") + "</w:rPr>")

    body = ""
    if plain_lead:
        body += (f'<w:r>{lead_rpr}'
                 f'<w:t xml:space="preserve">{escape(plain_lead)}</w:t></w:r>')
    for i, part in enumerate(text.split("\t")):
        if i:
            body += f"<w:r>{rpr}<w:tab/></w:r>"
        body += f'<w:r>{rpr}<w:t xml:space="preserve">{escape(part)}</w:t></w:r>'
    return f"<w:p>{ppr}{body}</w:p>"


def numbered(index, text):
    """A hanging-indent numbered step, matching the template's step lists."""
    ind = '<w:ind w:left="720" w:hanging="360"/>'
    return (f'<w:p><w:pPr>{BODY_SPACING}{ind}<w:jc w:val="both"/>{BODY_RPR}</w:pPr>'
            f'<w:r>{BODY_RPR}<w:t>{index}.</w:t></w:r>'
            f'<w:r>{BODY_RPR}<w:tab/></w:r>'
            f'<w:r>{BODY_RPR}<w:t xml:space="preserve">{escape(text)}</w:t></w:r></w:p>')


def bullet(text):
    ind = '<w:ind w:left="720" w:hanging="360"/>'
    return (f'<w:p><w:pPr>{BODY_SPACING}{ind}<w:jc w:val="both"/>{BODY_RPR}</w:pPr>'
            f'<w:r>{BODY_RPR}<w:t>•</w:t></w:r>'
            f'<w:r>{BODY_RPR}<w:tab/></w:r>'
            f'<w:r>{BODY_RPR}<w:t xml:space="preserve">{escape(text)}</w:t></w:r></w:p>')


def page_break():
    return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'


def blank():
    return f'<w:p><w:pPr>{BODY_RPR}</w:pPr></w:p>'


# ---------------------------------------------------------------------------
# Images and captions
# ---------------------------------------------------------------------------
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


def caption(text):
    """Numbered with a SEQ field so the List of Figures can be built by Word."""
    FIGURES.append(f"Figure {len(FIGURES) + 1} - {text}")
    return (
        '<w:p><w:pPr><w:pStyle w:val="Caption"/><w:jc w:val="center"/></w:pPr>'
        '<w:r><w:t xml:space="preserve">Figure </w:t></w:r>'
        '<w:r><w:fldChar w:fldCharType="begin"/></w:r>'
        '<w:r><w:instrText xml:space="preserve"> SEQ Figure \\* ARABIC </w:instrText></w:r>'
        '<w:r><w:fldChar w:fldCharType="separate"/></w:r>'
        f'<w:r><w:t>{len(FIGURES)}</w:t></w:r>'
        '<w:r><w:fldChar w:fldCharType="end"/></w:r>'
        f'<w:r><w:t xml:space="preserve"> - {escape(text)}</w:t></w:r></w:p>'
    )


def figure(path, text, max_width_in=TEXT_WIDTH_IN):
    return picture(path, max_width_in) + caption(text)


# ---------------------------------------------------------------------------
# Tables
# ---------------------------------------------------------------------------
BORDER = ('<w:tblBorders>'
          '<w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
          '<w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
          '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
          '<w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
          '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
          '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
          '</w:tblBorders>')


def cell(content, width, bold=False):
    if isinstance(content, str):
        body = para([(content, bold, False)], jc="left", spacing=False)
    else:
        body = "".join(content)
    return (f'<w:tc><w:tcPr><w:tcW w:w="{width}" w:type="dxa"/></w:tcPr>{body}</w:tc>')


def table(rows, widths, header_bold=True, first_col_bold=False):
    grid = "".join(f'<w:gridCol w:w="{w}"/>' for w in widths)
    body = ""
    for r, row in enumerate(rows):
        cells = ""
        for c, value in enumerate(row):
            bold = (header_bold and r == 0) or (first_col_bold and c == 0)
            cells += cell(value, widths[c], bold)
        body += f"<w:tr>{cells}</w:tr>"
    return (f'<w:tbl><w:tblPr><w:tblW w:w="{sum(widths)}" w:type="dxa"/>'
            f'{BORDER}<w:tblLayout w:type="fixed"/></w:tblPr>'
            f"<w:tblGrid>{grid}</w:tblGrid>{body}</w:tbl>")


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
SECT_TITLE = ('<w:sectPr><w:type w:val="continuous"/>'
              '<w:pgSz w:w="12240" w:h="15840" w:code="1"/>'
              '<w:pgMar w:top="1440" w:right="1800" w:bottom="1440" w:left="1800" '
              'w:header="720" w:footer="720" w:gutter="0"/>'
              '<w:pgNumType w:fmt="lowerRoman"/><w:cols w:space="720"/>'
              '<w:vAlign w:val="center"/></w:sectPr>')

SECT_FRONT = ('<w:sectPr><w:footerReference w:type="default" r:id="rId8"/>'
              '<w:pgSz w:w="12240" w:h="15840" w:code="1"/>'
              '<w:pgMar w:top="1440" w:right="1800" w:bottom="1440" w:left="1800" '
              'w:header="720" w:footer="720" w:gutter="0"/>'
              '<w:pgNumType w:fmt="lowerRoman" w:start="1"/>'
              '<w:cols w:space="720"/></w:sectPr>')

SECT_BODY = ('<w:sectPr><w:headerReference w:type="default" r:id="rId9"/>'
             '<w:footerReference w:type="default" r:id="rId10"/>'
             '<w:type w:val="nextPage"/>'
             '<w:pgSz w:w="12240" w:h="15840" w:code="1"/>'
             '<w:pgMar w:top="1440" w:right="1800" w:bottom="1440" w:left="1800" '
             'w:header="720" w:footer="720" w:gutter="0"/>'
             '<w:pgNumType w:start="1"/><w:cols w:space="720"/></w:sectPr>')


def section_break(sect):
    return f"<w:p><w:pPr>{sect}</w:pPr></w:p>"


def centred(text, bold=False, size=24):
    rpr = "<w:rPr>" + ("<w:b/>" if bold else "") + f'<w:sz w:val="{size}"/></w:rPr>'
    return (f'<w:p><w:pPr><w:jc w:val="center"/>{rpr}</w:pPr>'
            f'<w:r>{rpr}<w:t xml:space="preserve">{escape(text)}</w:t></w:r></w:p>')


# ---------------------------------------------------------------------------
# Title page
# ---------------------------------------------------------------------------
def title_page():
    crest = open("crest_para.xml", encoding="utf-8").read()
    students = [("Student Name", "Student Number"),
                ("1.  CPP Mchunu", "202242486"),
                ("2.  A Nsibande", "240079346"),
                ("3.  KN Bikile", "202356797"),
                ("4.  SP Tshazi", "240103222"),
                ("5.", ""), ("6.", "")]
    return (
        crest
        + centred("Department of Computer Science", size=28)
        + blank() * 2
        + centred("Software Requirements Specification", size=28)
        + blank() * 2
        + centred(PROJECT, size=28)
        + centred(SUBTITLE, size=24)
        + blank() * 2
        + centred("Supervisor", size=20)
        + centred("Mr Isiah Adebayo", size=20)
        + blank()
        + para("Submitted by", jc="left", spacing=False)
        + table(students, [4320, 4320], header_bold=False)
        + blank()
        + centred("Date", size=20)
        + section_break(SECT_TITLE)
    )


# ---------------------------------------------------------------------------
# Front matter
# ---------------------------------------------------------------------------
def front_matter(toc_entries=None, fig_entries=None):
    toc = (build_toc(toc_entries, 'TOC \\o "1-4" \\h \\z \\u') if toc_entries
           else toc_field('TOC \\o "1-4" \\h \\z \\u', "Table of contents"))
    lof = (build_toc(fig_entries, 'TOC \\h \\z \\c "Figure"') if fig_entries
           else toc_field('TOC \\h \\z \\c "Figure"', "List of figures"))
    return (
        heading(1, "Table of Contents", in_toc=False)
        + toc
        + page_break()
        + heading(1, "List of Figures", in_toc=False)
        + lof
        + section_break(SECT_FRONT)
    )


GROUPS = [
    ("common", "2.2.1", "Common Use Cases", "User",
     "fig3_common.png", "Common Use Cases",
     "Both kinds of user share a small number of use cases. They are described "
     "once here and are not repeated under each actor."),
    ("student", "2.2.2", "Student Use Cases", "Student",
     "fig4_student.png", "Student Use Cases",
     "The Student is the actor the system exists to serve. The use cases below "
     "carry the Student from registration through to tracking a submitted "
     "application."),
    ("corporate", "2.2.3", "Corporate User Use Cases", "Corporate User",
     "fig5_corporate.png", "Corporate User Use Cases",
     "The Corporate User administers an Organisation's funding programmes and "
     "decides who receives funding."),
]


def uc_number(uc):
    """Section 3.2.N for a use case, matching its position in the list."""
    return USE_CASES.index(uc) + 1


# ---------------------------------------------------------------------------
# 1.0 Introduction
# ---------------------------------------------------------------------------
def introduction():
    x = heading(1, "1.0.\tIntroduction")
    x += heading(2, "1.1.\tPurpose")
    x += para(
        "The purpose of this document is to present a detailed description of "
        "Bursary-Bridge. It explains the purpose and the features of the system, "
        "what the system does, the constraints under which it must operate and "
        "how it reacts to the people who use it. This document is intended for "
        "the stakeholders who commissioned the system and for the developers who "
        "will build it.")

    x += heading(2, "1.2.\tScope of Project")
    x += para(
        "Bursary-Bridge is a web application that connects South African students "
        "with bursaries, scholarships and other education funding, and gives the "
        "organisations that fund education a place to publish those opportunities "
        "and administer the applications they attract.")
    x += para(
        "Students who need funding face two related problems. Opportunities are "
        "scattered across many websites and are hard to find, and each one asks "
        "for the same information in a different form. Organisations that offer "
        "funding face the mirror of those problems. They receive large numbers of "
        "applications, many from students who do not meet the criteria, and they "
        "screen them by hand using email and spreadsheets.")
    x += para(
        "Bursary-Bridge addresses both. A student builds one profile, which "
        "records what they want to study and where, what results they hold and "
        "what funding they need. The system compares that profile against every "
        "published funding programme and presents the opportunities that fit, "
        "each with a match score and, importantly, the reasons behind that score. "
        "The student applies using the profile they have already built rather "
        "than entering the same information again.")
    x += para(
        "An organisation states its criteria once, as structured data rather than "
        "as prose. The same criteria then drive the matches shown to students and "
        "the eligibility verdict shown to the reviewer, so the two views cannot "
        "disagree. The organisation receives applications that are already scored "
        "and assessed, and moves applicants through review, shortlisting and "
        "selection.")
    x += para(
        "The system serves two kinds of user: the Student and the Corporate User. "
        "It does not attempt to disburse funds, to verify documents against any "
        "external authority, or to integrate with the administration systems of "
        "universities or of government. Those lie outside the scope of this "
        "release.")

    x += heading(2, "1.3.\tGlossary")
    x += table([("Term", "Definition")] + GLOSSARY, [2520, 6120])

    x += heading(2, "1.4.\tReferences")
    x += para("IEEE. IEEE Std 830-1998 IEEE Recommended Practice for Software "
              "Requirements Specifications. IEEE Computer Society, 1998.")
    x += para("Object Management Group. OMG Unified Modeling Language (OMG UML), "
              "Version 2.5.1. Object Management Group, 2017.")
    x += para("Republic of South Africa. Protection of Personal Information Act 4 "
              "of 2013. Government Gazette, 2013.")

    x += heading(2, "1.5.\tOverview of Document")
    x += para(
        "The next chapter, the Overall Description section, gives an overview of "
        "the functionality of the product. It describes the environment the "
        "system sits in, the actors who use it and the use cases each actor "
        "performs, in language intended for the stakeholders who commissioned it.")
    x += para(
        "The third chapter, the Requirements Specification section, is written "
        "primarily for the developers. It describes each use case formally, with "
        "its trigger, its preconditions, the basic path through it, the "
        "alternative and exception paths and its postconditions, together with "
        "the logical structure of the data and the security requirements.")
    x += para(
        "Both chapters describe the same software product in its entirety, but "
        "are intended for different audiences and so use different language.")
    return x


# ---------------------------------------------------------------------------
# 2.0 Overall Description
# ---------------------------------------------------------------------------
def overall_description():
    x = page_break() + heading(1, "2.0.\tOverall Description")
    x += heading(2, "2.1\tSystem Environment")
    x += figure("figures/fig1_environment.png", "System Environment")
    x += para(
        "Bursary-Bridge has two active actors and one cooperating system.")
    x += para(
        "The Student and the Corporate User both reach the system through a web "
        "browser over the Internet. Each is presented with a different portal, "
        "but both are served by one application and one database, so a funding "
        "programme published by an organisation is visible to a matching student "
        "immediately.")
    x += para(
        "The Matching Engine is a component of the application rather than a "
        "separate system. It is drawn separately here because it is the part of "
        "the system that gives Bursary-Bridge its purpose: it compares a student "
        "profile against a funding programme and produces both a score and the "
        "reasons for that score.")
    x += para(
        "Document Storage holds the files students upload. It is drawn separately "
        "because those files are held outside the web root and are released only "
        "through an authorised request, and because in a production deployment it "
        "would be an object store rather than part of the application server.")
    x += para(
        "The Email Service is the one cooperating system. It delivers address "
        "verification messages and the notifications raised when an application "
        "changes status. The system does not depend on it for any decision; if a "
        "message cannot be delivered the user can still complete every journey "
        "through the interface.")

    x += heading(2, "2.2\tFunctional Requirements Specification")
    x += para(
        "This section sets out the use cases for each actor. Use cases common to "
        "both actors are given first, followed by those belonging to the Student "
        "and then those belonging to the Corporate User. Each use case is "
        "presented with a diagram, a brief description, the steps that make it up "
        "and a cross reference to its formal description in Section 3.2.")

    x += figure("figures/fig2_lifecycle.png", "Application Status Lifecycle")
    x += para(
        "The Application Status Lifecycle above summarises the use cases that "
        "follow. A Student prepares an application as a draft and submits it. The "
        "Corporate User reviews it, may ask for further information, and either "
        "shortlists the applicant or records the application as unsuccessful. A "
        "shortlisted applicant is either selected as a beneficiary or, ultimately, "
        "unsuccessful.")

    for group, number, title, actor, fig, figtitle, blurb in GROUPS:
        x += heading(3, f"{number}\t{title}")
        x += para(blurb)
        x += figure(f"figures/{fig}", figtitle)
        for uc in [u for u in USE_CASES if u["group"] == group]:
            x += use_case_section(uc)

    # The complete picture, at the end of the section, as required.
    x += page_break() + heading(3, "2.2.4\tComplete Use Case Diagram")
    x += para(
        "The diagram below brings together every actor and every use case "
        "described in this section. The Student and the Corporate User are both "
        "specialisations of a User, which is why the four use cases they share "
        "are attached once to the User actor rather than drawn twice.")
    x += figure("figures/fig6_complete.png", "Complete Use Case Diagram")

    x += heading(2, "2.3\tUser Characteristics")
    x += para(
        "The Student is expected to be able to use a web browser and to complete "
        "an online form. Many students will reach the system on a mobile "
        "telephone, and some over a metered or intermittent connection, so the "
        "interface is laid out for small screens as well as large and the profile "
        "is gathered in short steps that can be left and resumed. No knowledge of "
        "bursary administration is assumed; wherever the system asks for "
        "something, it says why it is being asked.")
    x += para(
        "The Corporate User is expected to be comfortable with an administrative "
        "web application of the kind used in an office, including tables, filters "
        "and forms. They are assumed to understand their own organisation's "
        "funding criteria, but not to have any technical knowledge, so the "
        "eligibility criteria are captured through ordinary form controls rather "
        "than through any rule language.")
    x += para(
        "Neither actor is expected to receive training. The detailed appearance of "
        "the screens is discussed in Section 3.1 below.")

    x += heading(2, "2.4\tNon-Functional Requirements")
    for name, text in NON_FUNCTIONAL:
        x += para([(f"{name}. ", True, False), (text, False, False)])
    return x


def use_case_section(uc):
    """One use case in the informal style used by Section 2.2 of the template."""
    x = heading(4, f" {uc['name']}", plain_lead="Use case: ")
    if uc["pre"].startswith("This use case"):
        first = uc["pre"].split(". ")[0] + "."
        x += para([(first, False, True)])
    x += para([("Diagram:", True, False)])
    x += picture(f"figures/{uc['id']}.png", max_width_in=4.9)
    x += para([("Brief Description", True, False)])
    x += para(uc["brief"])
    x += para([("Initial Step-By-Step Description", True, False)])
    x += para(uc["pre"] if not uc["pre"].startswith("This use case")
              else uc["pre"].split(". ", 1)[1])
    for i, step in enumerate(uc["steps"], 1):
        x += numbered(i, step)
    x += para([("Xref: ", True, False),
               (f"Section 3.2.{uc_number(uc)}, {uc['name']}", False, False)])
    return x


# ---------------------------------------------------------------------------
# 3.0 Requirements Specification
# ---------------------------------------------------------------------------
def requirements_specification():
    x = page_break() + heading(1, "3.0.\tRequirements Specification")

    x += heading(2, "3.1\tExternal Interface Requirements")
    x += para(
        "The only link to an external system is the link to the Email Service, "
        "which delivers address verification messages and status notifications. "
        "The system passes a recipient address, a subject and a body, and treats "
        "delivery as advisory: no decision anywhere in the system depends on a "
        "message having been delivered, and every journey can be completed "
        "through the interface alone.")
    x += para(
        "The user interface is delivered as web pages. The Student portal "
        "presents a dashboard, a searchable list of opportunities, the detail of "
        "a single opportunity, an application form, an application tracker, a "
        "profile and a document library. The Corporate portal presents a "
        "dashboard, a programme builder, an applicant list, an applicant detail "
        "screen, a shortlist, a beneficiary register and a report. Both portals "
        "share a navigation sidebar which collapses behind a menu on a narrow "
        "screen.")
    x += para(
        "Uploaded documents are written to Document Storage through an interface "
        "that names only a folder, a file name, a content type and the bytes, so "
        "that local disk may be exchanged for object storage without any change "
        "to the code that calls it.")

    x += heading(2, "3.2\tFunctional Requirements")
    x += para("The Logical Structure of the Data is contained in Section 3.3.1.")
    for uc in USE_CASES:
        x += requirement_table(uc)

    x += heading(2, "3.3\tDetailed Non-Functional Requirements")
    x += heading(3, "3.3.1\tLogical Structure of the Data")
    x += para("The logical structure of the data stored by Bursary-Bridge is "
              "given below.")
    x += figure("figures/fig7_data.png", "Logical Structure of the Bursary-Bridge Data")
    x += para("The data descriptions of each of these data entities is as follows:")
    for name, rows in DATA_ENTITIES:
        x += para([(f"{name} Data Entity", True, False)])
        x += table([("Data Item", "Type", "Description", "Comment")] + rows,
                   [1780, 1440, 3160, 2260])
    x += para(
        "Two aspects of this structure carry the weight of the design. A Study "
        "Preference holds a course and an institution together as one record, "
        "never as two unrelated lists, because a bursary that funds a course at "
        "one institution is not necessarily open to that course elsewhere. An "
        "Eligibility Rule holds a funder's criteria as typed columns rather than "
        "as prose, because those columns are exactly what the Matching Engine "
        "evaluates.")

    x += heading(3, "3.3.2\tSecurity")
    x += para(
        "The system holds personal information about students, including their "
        "academic results and an indication of their household income, and it "
        "holds funding criteria that organisations may regard as commercially "
        "sensitive. The following requirements apply.")
    for item in SECURITY:
        x += bullet(item)
    x += para(
        "Registration deliberately does not ask for a residential address, an "
        "identity number, a passport number, banking details, a parent's identity "
        "number or detailed financial records. Registration establishes identity "
        "and the matching profile; an application collects what a specific "
        "programme requires. Collecting less reduces both the value of the "
        "database to an attacker and the obligations of the operator under the "
        "Protection of Personal Information Act.")
    return x


def requirement_table(uc):
    n = uc_number(uc)
    x = heading(3, f"3.2.{n}\t{uc['name']}")

    basic = "".join(numbered(i, s) for i, s in enumerate(uc["basic_path"], 1))
    group_number = {"common": "2.2.1", "student": "2.2.2",
                    "corporate": "2.2.3"}[uc["group"]]

    rows = [
        ("Use Case Name", uc["name"]),
        ("XRef", f"Section {group_number}, {uc['name']}"),
        ("Trigger", uc["trigger"]),
        ("Precondition", uc["precondition"]),
        ("Basic Path", [basic]),
        ("Alternative Paths", uc["alternative_paths"]),
        ("Postcondition", uc["postcondition"]),
        ("Exception Paths", uc["exception_paths"]),
        ("Other", uc["other"]),
    ]
    return x + table(rows, [1980, 6660], header_bold=False, first_col_bold=True)


# ---------------------------------------------------------------------------
# Assemble and package
# ---------------------------------------------------------------------------
def assemble(toc_entries=None, fig_entries=None):
    """Produce the whole document.xml for one pass."""
    HEADINGS.clear()
    FIGURES.clear()
    images.clear()
    _next_rid[0] = 100

    tp = title_page()
    intro = introduction()
    overall = overall_description()
    reqs = requirements_specification()
    front = front_matter(toc_entries, fig_entries)

    body = tp + front + intro + overall + reqs
    src = open(f"{SRC}/word/document.xml", encoding="utf-8").read()
    prefix = src[:src.index("<w:body>") + len("<w:body>")]
    return f"{prefix}{body}{SECT_BODY}</w:body></w:document>"


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
    subprocess.run(["zip", "-Xrq", f"../{out}", "."], cwd=BUILD, check=True)


def render(docx, pdf):
    subprocess.run(["soffice", "-env:UserInstallation=file:///tmp/lo_toc",
                    "--headless", "--norestore", "--convert-to", "pdf",
                    "--outdir", ".", docx],
                   capture_output=True, check=True, timeout=600)
    return pdf


def build():
    # Pass 1 — lay the document out so the page numbers can be read off it.
    package(assemble(), "pass1.docx")
    headings = list(HEADINGS)
    figures = list(FIGURES)
    render("pass1.docx", "pass1.pdf")

    # The body restarts its numbering at 1, so work out how many pages precede
    # it by reading the first printed "Page N of M" footer off the render.
    offset = body_offset("pass1.pdf")
    h_pages = page_map("pass1.pdf", [t for _, t in headings], offset)
    f_pages = page_map("pass1.pdf", figures, offset)

    toc_entries = [(lvl, txt, pg if pg else 1)
                   for (lvl, txt), pg in zip(headings, h_pages)]
    fig_entries = [(1, txt, pg if pg else 1)
                   for txt, pg in zip(figures, f_pages)]

    missing = sum(1 for p in h_pages + f_pages if p is None)

    # Pass 2 — rebuild with the cached table of contents and list of figures.
    package(assemble(toc_entries, fig_entries), OUT)
    size = os.path.getsize(OUT)
    print(f"wrote {OUT}  ({size/1024:.0f} KB, {len(images)} figures, "
          f"{len(toc_entries)} TOC entries, {len(fig_entries)} figure entries"
          + (f", {missing} page numbers not resolved" if missing else "") + ")")
    for f in ("pass1.docx", "pass1.pdf"):
        if os.path.exists(f):
            os.remove(f)


if __name__ == "__main__":
    build()

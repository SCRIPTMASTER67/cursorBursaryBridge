# Software Design Description

`Bursary-Bridge_SDD.docx` is the SDD for this project, written into the faculty's
own SDD template so that the fonts, styles, headers, footers, page numbering and
section structure are the template's rather than an imitation of them.

The document is 81 pages: sections 1.0 to 8.0 as the template lays them out, a
deployment diagram, fourteen design entities described by name, type,
description, attributes, resources and operations, seventy-three data fields
with their types and sizes, twelve use case realizations with a sequence diagram
each, and the implemented interface at three widths.

## How it is built

The build rewrites only `word/document.xml` inside a copy of the supplied
template and repackages it. Everything else the template ships — `styles.xml`,
`numbering.xml`, the theme, the headers and footers and the section definitions
— is carried through untouched. That is what keeps the typography identical
rather than merely similar.

The contents, the table of figures and the index carry real page numbers rather
than fields a reader has to refresh. They are produced by laying the document
out, rendering it to PDF, reading the pages off that render, rebuilding with
those numbers cached in, and repeating until a rebuild no longer moves anything.
Repeating is the point: an unfilled contents field occupies a single line and
the filled contents and table of figures occupy two pages, so a single second
pass would write page numbers that were true of a document two pages shorter
than the one being shipped. Every number in the contents, the table of figures
and the index was checked against a render of the shipped file.

## Sources

    src/content.py          the text: glossary, design entities, data fields,
                            realizations, index terms
    src/make_figures.py     the deployment, architecture and sequence diagrams
    src/interface_shots.json the screens captured for Section 6, with captions
    src/build_doc.py        assembles word/document.xml and packages the .docx
    src/crest_para.xml      the university crest paragraph, lifted from the template

To rebuild, put the faculty template beside the sources as `template.docx`,
unpack it to `unpacked/`, then run:

    python3 make_figures.py
    python3 build_doc.py

`build_doc.py` needs Pillow and a `soffice` on the path for the page number
passes.

## Figures

Forty-six in all. Fifteen are drawn: one deployment diagram, one architecture
diagram, one system sequence diagram and twelve use case sequence diagrams. The
other thirty-one are screenshots of the running system, captured through a real
browser rather than mocked up: twenty-four screens at a desktop width, then
seven of those same screens again at tablet and mobile widths, which is what
evidences the responsive layout the section claims.

The manifest of captured screens is written fresh on every run. It used to be
read back from the previous run and appended to, so each rebuild listed every
screen once more than the last; by the sixth rebuild Section 6 was printing the
same sixteen screens six times over and the document stood at 148 pages.

## Index

Section 8 is an alphabetical index of forty-one terms, each listed against the
pages it actually appears on, found by searching the laid-out document. The
front matter and the index's own pages are excluded, so no entry points a reader
back at the contents. A term the document never uses gets no entry rather than
an invented one.

## Typography

Body text is Times New Roman at eleven points, one and a half spaced and
justified, with no background or watermark. The supplied sample is set
differently; where the brief and the sample disagree the brief wins, and this is
the only place the document departs from the sample's typography. Everything
else — the styles, the headings, the headers and footers, the crest — is the
template's own.

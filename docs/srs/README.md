# Software Requirements Specification

`Bursary-Bridge_SRS.docx` is the SRS for this project, written into the faculty's
own SRS template so that the fonts, styles, headers, footers, page numbering and
section structure are the template's rather than an imitation of them.

## How it is built

The build rewrites only `word/document.xml` inside a copy of the supplied
template and repackages it. Everything else the template ships — `styles.xml`,
`numbering.xml`, the theme, the three headers and footers and the three section
definitions — is carried through untouched. That is what keeps the typography
identical rather than merely similar.

The table of contents and list of figures are built in two passes: the document
is laid out once and rendered to PDF to read the page numbers off it, then
rebuilt with those numbers cached into the fields, so both are filled in the
moment the file is opened.

## Sources

    src/content.py       the text: glossary, 37 use cases, requirements, entities
    src/diagrams.py      the use case diagram renderer
    src/check_geom.py    proves no association line crosses an ellipse
    src/make_figures.py  generates the 32 figures in src/figures
    src/build_doc.py     assembles word/document.xml and packages the .docx
    src/crest_para.xml   the university crest paragraph, lifted from the template

To rebuild, put the faculty template beside the sources as `template.docx`,
unpack it to `unpacked/`, then run:

    python3 make_figures.py
    python3 build_doc.py

`build_doc.py` needs Pillow and a `soffice` on the path for the page number pass.

## Diagrams

Each use case has its own diagram, each actor has a summary diagram, and
Section 2.2.5 closes with a single diagram carrying all 37 use cases across all
four actors. In every one, the use cases sit on an arc centred on their actor,
so each association line runs along a radius and cannot pass through an ellipse
it does not belong to. `check_geom.py` verifies that on each build.

Two diagrams needed a decision rather than a setting. An actor with fifteen use
cases makes a fan wide enough that its labels print at five points in a
six-inch column, so the Student and Corporate User summaries are split across
three diagrams each; together they still show the actor's complete set. And the
complete diagram is set sideways on a page of its own, because thirty-seven use
cases do not fit across a portrait column at a legible size.

## Typography

Body text is Times New Roman at eleven points, one and a half spaced and
justified. The supplied sample is set twelve on 1.15; where the brief and the
sample disagree the brief wins, and this is the only place the document departs
from the sample's typography. Everything else — the styles, the headings, the
headers and footers, the crest — is the template's own.

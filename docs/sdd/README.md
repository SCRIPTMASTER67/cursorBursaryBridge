# Software Design Description

`Bursary-Bridge_SDD.docx` is the SDD for this project, written into the faculty's
supplied SDD template so that the fonts, styles, margins, section definitions and
page numbering are the template's own rather than an imitation of them.

## How it is built

The build rewrites only `word/document.xml` inside a copy of the supplied
template and repackages it. `styles.xml`, `numbering.xml`, the theme, the footer
and both section definitions are carried through untouched.

The structure follows the template exactly: sections 1.0 to 8.0 in the
template's order, with the design entities of section 3 written in the
template's own Name / Type / Description / Attributes / Resources / Operations
form, and each use case realization cross referenced to the SRS section that
states it.

The contents and the table of figures are built in two passes: the document is
laid out once and rendered to PDF to read the page numbers off it, then rebuilt
with those numbers cached into the fields.

## Sources

    src/content.py       the text: glossary, design entities, data fields,
                         use case realizations
    src/diagrams.py      the diagram renderer, including UML sequence diagrams
    src/make_figures.py  generates the diagrams and crops the UI captures
    src/build_doc.py     assembles word/document.xml and packages the .docx
    src/crest_para.xml   the university crest paragraph, lifted from the template

To rebuild, put the faculty template beside the sources as `template.docx`,
unpack it to `unpacked/`, then run `make_figures.py` followed by `build_doc.py`.

## Figures

Figures 1 to 10 are generated diagrams: the deployment diagram, the architecture
design, a system sequence diagram and one sequence diagram per use case
realization. Figures 11 to 26 are captured from the running application by
`scripts/screenshots.ts`, so section 6 shows the interface as implemented rather
than as drawn.

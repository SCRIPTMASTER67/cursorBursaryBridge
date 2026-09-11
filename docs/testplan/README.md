# Test Plan

`Bursary-Bridge_Test_Plan.docx` is the test plan for this project, written into
the supplied Test Plan template.

## How it is built

The build rewrites only `word/document.xml` inside a copy of the template and
repackages it, so `styles.xml`, `numbering.xml`, the theme, the header and the
section definition carry through untouched. The font is therefore the
template's own Arial rather than a substitute, and the heading sizes, margins
and page setup are unchanged.

All seventeen section headings appear in the template's order with their
original wording; only the sample e-commerce content is replaced. The list
numbering the template defines is preserved: the Introduction objectives stay a
numbered list, Features To Be Tested and Testing Tasks stay bulleted.

## Sources

    src/content.py    the section content
    src/build_doc.py  assembles word/document.xml and packages the .docx

To rebuild, put the template beside the sources as `template.docx`, unpack it to
`unpacked/`, then run `build_doc.py`.

## Grounding

The suites, commands, environment requirements and demo accounts named in the
plan were run before being written down: 22 matching-engine checks and 67
end-to-end checks, both passing. Where the project has not fixed a fact - who
holds a role, which dates apply, which issue tracker is used - the document
carries a bracketed placeholder rather than an invented value.

# Test Plan

`Bursary-Bridge_Test_Plan.docx` is the test plan for this project, written into
the supplied Test Plan sample. Nine pages, all seventeen sections of the sample
in its order and under its original wording.

## How it is built

The build rewrites only `word/document.xml` inside a copy of the sample and
repackages it, so `styles.xml`, `numbering.xml`, the theme, the header and the
section definition carry through untouched: the heading sizes, the Letter page
size, the margins and the list definitions are the sample's own. Its numbering
is preserved too — the Introduction objectives stay a numbered list, and
Features To Be Tested, the suite breakdown and Testing Tasks stay bulleted on
the sample's own bullet definitions.

Two things the sample does not carry are added, because the brief asks for them
and names the sample's own default as a font not to use:

- **Times New Roman**, stated on every paragraph mark and every run. The
  sample's `docDefaults` set Arial, which the brief rules out by name, so the
  override is stated everywhere rather than by editing the sample's styles.
- **One and a half line spacing and justification** on body text and list
  items. The sample leaves spacing at 1.15 and its text ranged left. Headings
  keep the sample's own spacing and alignment, and its empty paragraphs keep
  carrying nothing but the border, because the requirement is for the body.

Body text stays at 11pt, which is what the sample's `docDefaults` already give
it, so no size is stated on a body run at all. Heading weight is the sample's:
its `<w:b/>` sits on the Heading 2 paragraph mark rather than on the run, so the
heading text is not bold, and this build does not make it bold either.

## Sources

    src/content.py    the section content
    src/build_doc.py  assembles word/document.xml and packages the .docx

To rebuild, put the sample beside the sources as `template.docx`, unpack it to
`unpacked/`, then run `build_doc.py`.

## Grounding

Every suite, command and count in the plan was run before it was written down.
The figures are from the run of 24 September 2026: 597 checks across the twelve
counted suites, all passing, with no errors from `npm run typecheck`; and 46
fields across 6 forms in the accuracy harness, 46 correct, 20 populated and 26
correctly left for the student because the source form did not answer them.

Where the project has not fixed a fact — who is test manager, which dates
apply, which issue tracker is used, which browsers are used for manual checks —
the document carries a bracketed placeholder rather than an invented value.
There are seven.

The Risks section describes two failures that actually happened during this
round of testing rather than hypothetical ones: two suites that deleted every
externally sourced organisation rather than only the ones they had written, and
checks that assumed a fixture would appear on the first page of the directory.
Both are fixed; both are recorded because the contingency matters more than the
embarrassment.

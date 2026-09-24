# Final Year Project Proposal

`Bursary-Bridge_Project_Proposal.docx` is the project proposal, written into the
faculty's own proposal template so that the fonts, styles, headers, footers,
page numbering and section structure are the template's rather than an
imitation of them.

The document is 20 pages and carries all twelve sections of the template, in the
template's order and under the template's own headings and numbering.

## How it is built

The build rewrites only `word/document.xml` inside a copy of the supplied
template, and appends list definitions to `numbering.xml`. Everything else the
template ships — `styles.xml`, the theme, the crest, the footer and the section
definition — is carried through untouched. The list definitions that are
appended all point at an abstract definition the template already contains; a
fresh numId per list is what makes a numbered list restart at one instead of
continuing the section numbering.

The table of contents carries real page numbers rather than a field a reader
has to refresh. They are produced by laying the document out, rendering it to
PDF, reading the pages off that render, rebuilding with those numbers, and
repeating until a rebuild no longer moves anything. All sixteen entries were
checked against a render of the shipped file.

## Sources

    src/content.py      the text of every section, the references and the
                        work plan the Gantt chart is drawn from
    src/make_figures.py draws the Gantt chart for Section 10.2
    src/build_doc.py    assembles word/document.xml and packages the .docx
    src/crest_para.xml  the university crest paragraph, lifted from the template

To rebuild, put the faculty template beside the sources as `template.docx`,
unpack it to `unpacked/`, then run:

    python3 make_figures.py
    python3 build_doc.py

`build_doc.py` needs Pillow and a `soffice` on the path for the page-number
passes.

## What is asserted and what is not

Every factual claim is either read off the implemented system in this
repository or attributed to one of the nine references, each of which was
retrieved and checked rather than recalled. Where the proposal needs a fact
about the team that nothing in the project records — who leads it, what prior
experience each member brings, which calendar month the project year starts in
— the text carries a bracketed placeholder instead of an invention. There are
six such placeholders and they are the only ones in the document.

No survey or interview result is reported, because none was conducted: Section
4 states that requirements are derived from documentary analysis of published
material, and Section 12 says so again in place of the questionnaire the
template's appendix list suggests.

## Departures from the template

Two, both deliberate.

Section 7 is set as a Heading 1 rather than as the List Paragraph the template
uses for it. It numbers and prints identically, because the template's own
paragraph carries the heading colour and the same list, but as a heading it
appears in the table of contents, which it otherwise would not.

Body text is set at one and a half lines. The template leaves spacing at the
document default of 1.08; where the brief and the template disagree the brief
wins. Table cells and the contents page are set closer, since a four-column
risk table at one and a half lines is twice as tall for no gain in legibility.

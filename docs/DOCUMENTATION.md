# Documentation set

Four documents are submitted, each written into the template prescribed for it:

| Document | File | Pages |
| --- | --- | --- |
| Final Year Project Proposal | `proposal/Bursary-Bridge_Project_Proposal.docx` | 21 |
| Software Requirements Specification | `srs/Bursary-Bridge_SRS.docx` | 79 |
| Software Design Description | `sdd/Bursary-Bridge_SDD.docx` | 83 |
| Test Plan | `testplan/Bursary-Bridge_Test_Plan.docx` | 10 |

Each has a `README.md` beside it describing how it is built and what it
asserts. This file records the conventions the four share, because a marker
reading them as a set should not have to work out that they agree.

## Conventions common to all four

**Referencing.** One style throughout: sources are numbered in order of first
citation and cited by bracketed number. Every source listed is cited at least
once in the text, and every bracketed number in the text appears in the list.
This is checked mechanically on every build rather than by eye.

**Figures.** Numbered consecutively within each document, captioned beneath,
and referred to in the text by number. No figure is introduced as "the diagram
below".

**Tables.** Numbered consecutively within each document, captioned above, and
referred to in the text by number. The SRS's thirty-seven formal requirement
tables in Section 3.2 are the deliberate exception: each sits directly beneath
the numbered heading of the use case it describes, and Section 1.5 of that
document says so.

**Lists.** The SRS carries a List of Figures and a List of Tables; the SDD
carries a Table of Figures. Their page numbers are real, produced by rendering
the document and reading the pages off it rather than by a field a reader has
to refresh.

**Terminology.** The system is Bursary-Bridge throughout. It recognises three
roles, Student, Corporate User and Administrator, and exposes one portal to
each. The supervisor is Ms Zulu. The four team members and their student
numbers appear identically on every cover page and in the Test Plan identifier.

**Placeholders.** None remain in any of the four.

## Cross-document traceability

    Proposal 3.2 objectives
        -> SRS 3.2 use cases (thirty-seven, numbered)
            -> SDD 5.0 realizations (twelve, each citing its SRS number)
                -> Test Plan features to be tested
                    -> the suites and counts in the Test Plan's Approach section

Each link is stated in the document that depends on it: the SDD names the SRS
section each realization comes from, and the Test Plan cites both.

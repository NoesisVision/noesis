# The INCOSE rules for needs and requirements

Based on the INCOSE Guide to Writing Requirements (INCOSE-TP-2010-006-04,
version 4, 2023), as summarised in the Reqi article "INCOSE Requirements
Quality: The Complete 42-Rule Guide". The wording and examples here are this
skill's own. Each rule has the check to run on a statement and a poor and a
better statement. `[checker]` marks the rules `check-requirements.ts` looks
for; the others need a reader.

## Quality characteristics

The rules exist to give requirements these characteristics. Use them as the
final review questions.

### Of each need and requirement

- **C1 Necessary**: it traces to a need or a parent requirement; removing it
  would leave that need unmet.
- **C2 Appropriate**: its detail fits the level of the entity (no component
  detail in a system requirement).
- **C3 Unambiguous**: every intended reader understands it the same way.
- **C4 Complete**: it says enough to build and verify it without asking.
- **C5 Singular**: one capability, characteristic, constraint or quality.
- **C6 Feasible**: it can be met within cost, schedule and technology at an
  acceptable risk.
- **C7 Verifiable**: there is a test, analysis, inspection or demonstration
  that proves it, with a pass criterion.
- **C8 Correct**: it says what its source says, without loss or addition.
- **C9 Conforming**: it follows the patterns and style of this document.

### Of the set

- **C10 Complete**: the set covers every need, and every kind of requirement
  was considered.
- **C11 Consistent**: no two requirements conflict; terms and units are the
  same throughout.
- **C12 Feasible**: the requirements can be met together, not only one by
  one.
- **C13 Comprehensible**: it is clear what is expected of the entity and how
  it relates to its neighbours.
- **C14 Able to be validated**: meeting the set can be shown to satisfy the
  needs.
- **C15 Correct**: the set says what its sources say.

## 1. Accuracy (R1–R9): say exactly what is meant

**R1 Structured statements.** `[checker: shall]` Each statement follows an
agreed pattern (see the SKILL.md patterns): condition, subject, `shall`,
action, object, performance.

- Poor: The search should be fast.
- Better: When a user submits a search query, the Document Index shall
  return the first page of results within 2.0 ± 0.5 s.

**R2 Active voice.** `[checker]` The responsible entity is the subject. A
passive `shall be <verb>ed` hides who does it.

- Poor: Attachments shall be scanned for malware.
- Better: The Attachment Service shall scan each uploaded attachment for
  malware.

**R3 Appropriate subject and verb.** `[checker: user as subject]` The
subject is the entity this document specifies, at this document's level. A
requirement on a person, a neighbouring system or a subsystem belongs in
another document.

- Poor: The approver shall approve each file of the version.
- Better: The QDoc System shall record the approval of each file of the
  version by its approver.

**R4 Defined terms.** Every term a reader could understand two ways is in
the glossary, and only glossary terms are used.

**R5 Definite articles.** `[checker]` Use `the` for a specific, defined
entity. `a`/`an` leaves open which one; for every instance, use `each`
(R32).

- Poor: A notification shall be sent to a quality manager.
- Better: The QDoc System shall notify each quality manager of the
  organisation.

**R6 Common units of measure.** One unit system for the whole document, the
unit written next to each value.

- Poor: The upload limit shall be 25 (the rationale talks about megabytes).
- Better: The Attachment Service shall accept each attachment up to 25 MiB.

**R7 Vague terms.** `[checker]` No `some`, `several`, `many`, `adequate`,
`reasonable`, `sufficient`, `suitable`, `appropriate`, `typical`,
`significant`, `acceptable`, `approximately`, `large`, `small`. Replace each
with a number or a defined term.

- Poor: The system shall keep a sufficient history of versions.
- Better: The QDoc System shall retain each version of each QDoc for 10
  years after the QDoc is archived.

**R8 Escape clauses.** `[checker]` No `where possible`, `as appropriate`,
`if necessary`, `as required`, `to the extent practicable`. They let the
builder decide not to comply.

- Poor: The system shall encrypt backups where possible.
- Better: The Backup Service shall encrypt each backup with AES-256.

**R9 Open-ended clauses.** `[checker]` No `including but not limited to`,
`etc.`, `such as`, `and so on`. List every item, or write one requirement
per item.

- Poor: The system shall accept documents in common formats such as PDF,
  DOCX, etc.
- Better: The Attachment Service shall accept attachments in PDF format.
  (A second requirement for DOCX, if DOCX is needed.)

## 2. Concision (R10–R11): no words that earn nothing

**R10 Superfluous infinitives.** `[checker]` No `be able to`, `be capable
of`, `have the capability to`, `be designed to`. They make it unclear when
the capability must be shown.

- Poor: The system shall be able to export the activity list.
- Better: When an auditor requests the activity list of a QDoc, the QDoc
  System shall export the activity list as a CSV file.

**R11 Separate clauses.** Each condition, qualification or performance
figure in a clause of its own, so it is clear what applies to what.

- Poor: The system shall send reminders to reviewers who have not commented
  three days before the due date by e-mail.
- Better: When 3 days remain before the review due date of a version, the
  QDoc System shall e-mail a reminder to each reviewer of the version who
  has [no comment on the version AND no review mark on the version].

## 3. Non-ambiguity (R12–R17): one reading only

**R12 Correct grammar.** Readers include non-native speakers and tools; a
broken sentence gets several readings.

**R13 Correct spelling.** Watch for real words that are the wrong word
(`affect`/`effect`, `ordinance`/`ordnance`).

**R14 Correct punctuation.** A comma can move a qualifier from one noun to
another. Read the sentence with and without each comma.

**R15 Logical expressions.** `[checker: lowercase and/or]` Combine
conditions with an explicit convention: `[A AND B]`, `[A OR B]`, `NOT A`,
in capitals and brackets, defined in the conventions section.

- Poor: When the version is shared and approved or rejected …
- Better: When the version is [shared AND [approved OR returned]], …

**R16 Use of "not".** `[checker]` State what the entity shall do, not what
it shall not do. A negative cannot be tested exhaustively. Prohibitions
that must stay negative (security, safety) are written as a positive
response to the forbidden event.

- Poor: The system shall not allow reviewers to edit content.
- Better: If a reviewer submits an edit to a content file, the QDoc System
  shall reject the edit.

**R17 Oblique symbol.** `[checker]` No `/`: it can mean and, or, per, or
alternatives. Write the word. Units such as `km/h` are written `km per h`
or defined in the conventions.

- Poor: The author/approver shall be notified.
- Better: The QDoc System shall notify each author of the version. (A
  second requirement for approvers.)

## 4. Singularity (R18–R23): one thought per requirement

**R18 Single thought sentence.** `[checker: one shall]` One sentence, one
`shall`, one action, with only the clauses that qualify it. Several actions
are several requirements, each traceable, allocable and verifiable alone.

- Poor: The system shall validate the credentials and log each attempt and
  notify the administrator.
- Better: three requirements — validate, log, notify.

**R19 Combinators.** `[checker]` `and`, `or`, `then`, `unless`, `but`, `as
well as`, `otherwise` often join two requirements. Split them, or, for
conditions, use the R15 convention. `and` inside a defined term ("terms and
conditions") is fine.

**R20 Purpose phrases.** `[checker]` No `in order to`, `so that`, `so as
to`, `for the purpose of`. The purpose goes in `Rationale`.

- Poor: The system shall record the reason for archiving so that auditors
  can understand the decision.
- Better: When a quality manager archives a QDoc, the QDoc System shall
  record the archiving reason entered by the quality manager. Rationale:
  auditors must be able to see why a QDoc stopped being in force.

**R21 Parentheses.** `[checker]` No parenthetical text. It is either part of
the requirement (write it in) or explanation (move it to `Rationale`).
Brackets for R15 logic and `[TBD-nn]` markers are allowed.

**R22 Enumeration.** A group noun ("all user management functions") hides a
list. Name each member, one requirement each, or a defined list in the
glossary.

- Poor: The system shall support all document lifecycle actions.
- Better: one requirement each for create, share, approve, publish,
  archive.

**R23 Supporting diagrams.** When behaviour is too complex for one sentence
(a state machine, a message exchange, a data format), the requirement
points at a named diagram, model, table or interface definition, which is
under the same change control.

- Better: The QDoc System shall change the status of each version in
  accordance with the version lifecycle in Figure 3.

## 5. Completeness (R24–R25): each statement stands alone

**R24 Pronouns.** `[checker]` No `it`, `its`, `they`, `them`, `their`,
`this`, `these`, `those`. Repeat the noun. Requirements get sorted, filtered
and exported one by one; a pronoun then points at nothing.

- Poor: When the scan finds malware, it shall quarantine it.
- Better: When the Attachment Service detects malware in an attachment, the
  Attachment Service shall quarantine the attachment.

**R25 Headings.** The statement does not lean on its section heading or
title. "Shall be signed" under "Approval" says nothing once exported.

## 6. Realism (R26): achievable targets

**R26 Absolutes.** `[checker]` No `100%`, `always`, `never`, `at all times`,
`completely`, `zero` unless truly absolute and verifiable. State the target
that can be met and proved with finite effort.

- Poor: The system shall be available 100% of the time.
- Better: The QDoc System shall have an availability of at least 99.9% per
  calendar month, measured between 06:00 and 22:00 local time.

## 7. Conditions (R27–R28): when it applies

**R27 Explicit conditions.** Every condition under which the requirement
applies is in the statement — not implied by the section, the title or
another requirement.

- Poor: The system shall lock the version.
- Better: When the last approver of a version approves the last file of the
  version, the QDoc System shall lock each file of the version against
  editing.

**R28 Multiple conditions.** When several conditions trigger one action,
state whether all are needed `[A AND B]` or any one suffices `[A OR B]`.

## 8. Uniqueness (R29–R30): no duplicates

**R29 Classification.** `[checker: Type present]` Each requirement has a
type (functional, performance, interface, data, security, safety,
reliability, availability, usability, maintainability, compliance,
constraint). Grouping by type exposes gaps, overlaps and conflicts.

**R30 Unique expression.** `[checker: exact duplicates]` Each need and
requirement is stated once. Two wordings of one requirement drift apart
over time; refer to the one ID instead.

## 9. Abstraction (R31): what, not how

**R31 Solution free.** State the outcome, not the implementation, unless
there is a stated reason to constrain the design (then the rationale says
it).

- Poor: The system shall store documents in PostgreSQL.
- Better: The QDoc System shall retain each content file with no loss of
  committed edits after a restart of the QDoc System.

## 10. Quantifiers (R32): clear scope

**R32 Universal qualification.** `[checker]` Use `each` instead of `all`,
`any`, `every` or `both`. `all` can mean the set as a whole; `each` means
every single member.

- Poor: All approvers shall be notified.
- Better: The QDoc System shall notify each approver of the version.

## 11. Tolerance (R33): ranges, not points

**R33 Range of values.** `[checker: value without bound]` A measured value
has a tolerance or a bound (`2.0 ± 0.3 s`, `at most 5 s`, `between 10 and
20 items`). A point value cannot be met exactly and wastes trade space.
Exact counts ("the fifth attempt") need none.

- Poor: The system shall respond in 2 seconds.
- Better: The QDoc System shall display the version within 2.0 ± 0.3 s of
  the request.

## 12. Quantification (R34–R35): measurable targets

**R34 Measurable performance.** `[checker]` No `fast`, `quick`, `easy`,
`user-friendly`, `intuitive`, `efficient`, `robust`, `reliable`, `flexible`,
`seamless`, `optimal`, `minimise`, `maximise`. Give the measure, the value
and how it is measured.

- Poor: The editor shall be easy to use.
- Better: The QDoc System shall let 9 of 10 first-time authors, in a
  usability test, insert a table into a content file within 60 s without
  help.

**R35 Temporal dependencies.** `[checker]` No `soon`, `eventually`,
`immediately`, `promptly`, `periodically`, `in real time`, and no bare
`before`/`after`/`until` without a named event and a bound.

- Poor: The system shall notify the authors soon after the version is
  returned.
- Better: When an approver returns a version, the QDoc System shall notify
  each author of the version within 60 s.

## 13. Uniformity of language (R36–R40): consistent words

**R36 Consistent terms and units.** One name per thing and one unit per
quantity across requirements, design, tests and manuals. The glossary
records synonyms as not used.

**R37 Acronyms.** `[checker: defined in glossary]` Each acronym is in the
glossary and always used the same way — never the acronym in one place and
the expansion in another.

**R38 Abbreviations.** `[checker]` No `e.g.`, `i.e.`, `approx.`, `min.`,
`max.`, `w.r.t.`, `vs.` in statements. Abbreviations that must stay are in
the glossary.

**R39 Style guide.** The document follows one style guide: the patterns,
the attributes, the ID scheme, the conventions section.

**R40 Decimal format.** One decimal separator and a consistent number of
significant digits (`2.0 s` everywhere, not `2 s`, `2.0 s` and `2.00 s`).

## 14. Modularity (R41–R42): organised sets

**R41 Related requirements.** Group requirements by function, interface or
another logical relation, so gaps and conflicts show.

**R42 Structured sets.** The document follows the template, so every kind
of requirement is considered, and an empty kind is empty on purpose.

## Verification and validation

- Each requirement names its verification method — test, analysis,
  inspection or demonstration — and what passes. If no method can be named,
  the requirement is not verifiable (C7); rewrite it.
- Each requirement traces to a need; each need is traced to by at least one
  requirement (C1, C10). Validation asks whether the set, once met, solves
  the needs.
- Reused requirements from another project are re-checked against this
  project's needs, not copied.
- After baselining, requirements change only through change control: a new
  status, never a silent edit.

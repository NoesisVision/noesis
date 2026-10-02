---
name: writing-requirements
description: Write or review a requirements document — stakeholder needs and traceable requirement statements — against the INCOSE Guide to Writing Requirements (42 rules, 15 quality characteristics). Use when the user asks to write, draft, derive, rewrite, restructure or review requirements, a requirements specification (SRS, SyRS, StRS, PRD with requirements), or acceptance-level "shall" statements from notes, transcripts, user stories or business requirements.
argument-hint: [source files or topic] [output path]
---

# Writing requirements (INCOSE 42 rules)

A requirement is a promise that something specific will be true, written so
that a stranger can build it and prove it was built. The test for every
statement: hand it to someone who has never met you. If they must ask a
question to build or verify it, it fails one of the rules.

This skill produces a Markdown requirements document in which every need and
requirement is a block with a stable ID, one statement and the attributes
that make it traceable. It follows the INCOSE Guide to Writing Requirements
(INCOSE-TP-2010-006-04) and ISO/IEC/IEEE 29148.

## Files

- `references/rules.md`: all 42 rules, each with a check and a poor and a
  better example, plus the 15 quality characteristics. Read it at step 5,
  in full, before writing the first statement.
- `references/template.md`: the document skeleton. Copy it at step 4.
- `scripts/check-requirements.ts`: checks a document for the rules a
  machine can see (wording, block format, attributes, IDs, duplicates,
  acronyms). Run it at step 7.

## Block format

Every need and requirement is a heading with its ID, a blockquote with the
statement, and a list of attributes inside a collapsed `Details` block, so
the reader sees the statement first. The checker relies on this shape.
Each need is a section; the requirements that trace first to it sit under
it, one heading level down.

```markdown
#### FR-ACC-004 Lock the account after repeated failed sign-ins

> When the Authentication Service records the fifth consecutive failed
> sign-in attempt for one user account within 10 minutes, the Authentication
> Service shall lock the user account for 15 ± 1 minutes.

<details>
<summary>Details</summary>

- **Type:** security
- **Level:** system
- **Rationale:** Limits online password guessing; 5 attempts balance lockout
  of legitimate users against guessing (security review SR-12).
- **Trace:** N-SEC-02
- **Verification:** test — 5 failed attempts within 10 minutes lock the
  account; a 6th attempt with the correct password is refused; the account
  unlocks between 14 and 16 minutes later.
- **Status:** draft
- **Remarks:** Support asked for an unlock link by e-mail; deferred to a
  later change.

</details>
```

Write out every attribute in each block, also when it repeats the block
above; the blank lines around the list keep it Markdown inside the HTML.
Keep `<details>` and `<summary>` on lines of their own: MDX-based viewers,
Noesis among them, read `<details><summary>…` on one line as inline HTML and
fail to load the whole document.

- **ID**: `<PREFIX>-<AREA>-<NNN>`, never reused, never renumbered. A deleted
  requirement keeps its ID with status `deleted`. Needs use the `N-` prefix
  (`N-SEC-02`); requirements use a type prefix (`FR`, `PR`, `IR`, `SR`,
  `CR`, …) agreed in the document's conventions section. When the system
  is split into subsystems, the area is the code of the subsystem the item
  is allocated to, and a structure file next to the requirements lists the
  subsystems and their codes; a `subsystem` requirement then names its
  subsystem as the subject.
- **Title**: a short name for navigation only. The statement must not rely
  on it (R25).
- **Statement**: one sentence, one `shall`, in the blockquote.
- **Attributes** (required for requirements): `Type` (R29), `Rationale`
  (where purpose, intent and explanation go — R20, R21), `Trace` (the need
  or parent requirement it satisfies — the "Necessary" characteristic),
  `Verification` (method: test, analysis, inspection or demonstration, and
  the success criterion). Recommended: `Level`, `Status`. Optional:
  `Remarks`, `Priority`, `Owner`, `Risk`, `Allocated to`. Delivery slicing
  is not an attribute: the change that delivers a requirement (its change
  key) says which slice it belongs to.
- **Level**: how far down the hierarchy the requirement sits, independent of
  its `Type`: `business` (an outcome the organisation wants), `stakeholder`
  (what a stakeholder group needs from the entity), `system` (the entity as
  a whole), `subsystem` (one module or service of it), `software` (one
  software item). A requirement traces to a need or to a requirement one
  level up (C2: its detail fits its level).
- **Remarks**: notes that are neither the requirement nor its reason —
  discussion history, a deferred idea, a pointer for the reader. Nothing in
  `Remarks` is binding; a missing value is a `[TBD-nn]`, not a remark.
- **Needs** carry no `Trace` or `Verification`; they are validated, not
  verified. A need carries `Level` (`business` or `stakeholder`) and may
  carry `Source` (who said it, where: a transcript, a document, a meeting),
  `Priority` and `Remarks`.

## Steps

1. **Establish the scope.** Settle with the user, or from the sources, before
   writing: the entity being specified (the system, a subsystem, a service —
   it becomes the subject of every statement, R3), the level (stakeholder,
   system, software), the audience, the sources, and where the document goes.
   Ask only for what the sources do not answer.

2. **Read the sources** in full: the user's message, every file they point
   at, existing requirements. When sources disagree, trust the user's
   message first, then the newer source; record the conflict in the open
   issues section instead of silently picking one.

3. **Extract the needs.** One need per stakeholder expectation, in the
   stakeholder's terms: "The quality managers need …". Give each a `Level`.
   Needs say what problem must be solved; requirements say what the entity
   shall do to solve it. Every requirement later traces to a need or a
   parent requirement — a requirement with nothing to trace to is either a
   missing need or not necessary.

4. **Set up the document** from `references/template.md`, before any
   statement:
   - **Glossary** (R4, R36–R38): each entity by its one name (the name used
     as the subject), each domain term, each acronym and abbreviation. Pick
     one name per thing; record synonyms the sources used and say which one
     wins. The glossary ends the document and holds only the terms the
     document uses, so the document reads on its own. In a set split over
     several documents, a term used in several documents has the same
     definition in each — within one bounded context, one meaning per
     term. Change a definition in each document that uses the term.
   - **Conventions** (R6, R15, R39, R40): the unit system, the decimal
     format and significant digits, the logical expression convention
     (`[A AND B]`), the meaning of `shall`/`should`/`will`, the ID prefixes.
   - **Outline** (R29, R41, R42): one section per need, its requirements
     under it. Consider every kind of requirement for each need —
     functional, performance, interface, data, security, safety,
     reliability and availability, usability, maintainability, compliance,
     constraints — and list each kind with no requirement in the "Kinds
     not covered" section with the reason ("Safety: none; …"), never
     leave it out silently.

5. **Write each requirement.** Read `references/rules.md` first. Then, per
   need, derive the requirements that satisfy it:
   - Pick a pattern (R1) from the table below.
   - Subject: the entity, by its glossary name, with `the` (R2, R3, R5).
     Never the user: "the user shall enter" is a requirement on a person.
   - One action, one `shall`, no `and`/`or` joining two thoughts (R18, R19).
     Split instead, and give each part its own ID.
   - Every condition stated (R27); several conditions joined by explicit
     `[A AND B]` or `[A OR B]` (R15, R28).
   - Every quality quantified (R34) with a unit (R6) and a range or bound
     (R33); every timing bound explicit (R35).
   - What, not how (R31). A design constraint is allowed only when the
     rationale says why the design must be constrained.
   - No vague words, escape clauses, open lists, pronouns, parentheses,
     `not`, `/`, absolutes or purpose phrases (R7–R10, R16, R17, R20, R21,
     R24, R26). Explanation goes in `Rationale`.
   - A value nobody knows yet is `[TBD-nn]` (to be determined) or a best
     guess marked `[TBR-nn]` (to be resolved), listed in the open issues
     section with an owner — never a vague word standing in for it.
   - `should` statements are goals, not requirements: put them in the goals
     section, without an ID prefix of a requirement type.
   - Fill the attributes. `Verification` names the method and what passes.
     `Level` says where the requirement sits; detail that belongs a level
     lower goes into a child requirement at that level, traced to this one.

6. **Check the set** against the set characteristics in
   `references/rules.md`: every need traced by at least one requirement,
   every requirement traced to a need, no two requirements saying the same
   thing (R30), none contradicting another, units and terms consistent
   (R36), complex behaviour pointing at a diagram, model or interface
   definition instead of paragraphs of text (R23).

7. **Run the checker** and resolve its findings:

   ```
   bun .claude/skills/writing-requirements/scripts/check-requirements.ts <document.md>
   ```

   To count the terms of a separate glossary file as defined in each
   document, pass it:

   ```
   bun .claude/skills/writing-requirements/scripts/check-requirements.ts \
     --glossary <glossary.md> <document.md>...
   ```

   Errors are format and set problems (missing `shall`, missing attribute,
   duplicate ID or statement); fix all of them. Warnings are words that
   usually break a rule; rewrite the statement, or keep it only when the
   word is right in context (`and` inside a defined term, `before` relative
   to a named event). The checker cannot see the semantic rules — R3, R11,
   R12–R14, R22, R23, R25, R27, R28, R30 (near-duplicates), R31, R33, R34 —
   so read each statement once more against them.

8. **Report**: the document's path, how many needs and requirements, needs
   without requirements, the open `TBD`/`TBR` items, and any checker
   warning you kept, with why.

## Patterns (R1)

Write conditions first, then the subject, `shall`, the action, the object,
and the performance measure.

- **Ubiquitous** (always applies): `The <entity> shall <action> <object>
  <performance>.`
- **Event-driven**: `When <trigger>, the <entity> shall <action> <object>
  <performance>.`
- **State-driven**: `While <state>, the <entity> shall …`
- **Unwanted behaviour**: `If <undesired event or condition>, the <entity>
  shall <response>.` State the response, not the absence of failure (R16).
- **Optional feature**: `Where <feature is included>, the <entity> shall …`
- **Combined**: `While <state>, when <trigger>, the <entity> shall …`
- **Interface**: `The <entity> shall <send|receive> <item> <to|from>
  <other entity> in accordance with <interface definition>.`
- **Constraint**: `The <entity> shall <comply with|be> <constraint>.` Needs
  a rationale that says why the design is constrained (R31).

## Reviewing an existing document

When asked to review rather than write: run the checker, then read each
statement against `references/rules.md`. Report per requirement the rule
broken, the reason, and a rewritten statement. When the document is not in
the block format, convert a copy first or check statements by hand; do not
rewrite the user's file unasked.

## Rules of this skill

- Never invent a number. A value the sources do not give is `[TBD-nn]` or a
  proposed `[TBR-nn]` with the reasoning in `Rationale`.
- Never drop a source statement because it is hard to write well; capture it
  as a need and flag it in open issues.
- Keep the stakeholders' vocabulary in the glossary; requirement statements
  use only glossary terms.
- Narrative context (why the system exists, the domain story) belongs in the
  introduction and rationales, never in a statement.

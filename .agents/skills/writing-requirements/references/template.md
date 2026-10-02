# <System or entity name>: requirements

- **Document ID:** <id>
- **Version:** <n.n>, <YYYY-MM-DD>
- **Status:** draft | in review | baselined
- **Entity specified:** <the system of interest, by its glossary name>
- **Level:** business | stakeholder | system | subsystem | software (the
  level most requirements sit at; each block states its own)

## 1. Introduction

### 1.1 Purpose

Why the entity exists and what problem it solves, in two or three paragraphs.

### 1.2 Scope and boundary

What the entity includes and what it does not. The external entities it
interacts with. A context diagram when there are more than two of them (R23).

### 1.3 Out of scope

What the sources explicitly deferred or excluded, and why.

## 2. Conventions

- **Modal verbs:** `shall` states a binding requirement; `should` states a
  goal (section 3 only); `will` states a fact or an expectation about
  something outside the entity; `must` is not used.
- **Units:** SI. Time in seconds (s) or milliseconds (ms); data in bytes
  (B, KiB, MiB).
- **Numbers:** decimal point; values carry the significant digits that the
  verification measures (`2.0 s`, not `2 s` and `2.00 s` in one document).
- **Logic:** conditions combined as `[A AND B]`, `[A OR B]`, `NOT A`, in
  capitals inside brackets.
- **IDs:** `N-<AREA>-<NN>` needs; `FR` functional, `PR` performance, `IR`
  interface, `DR` data, `SR` security, `SFR` safety, `RR` reliability and
  availability, `UR` usability, `MR` maintainability, `CR` compliance and
  constraints. IDs are never reused or renumbered.
- **Verification methods:** test, analysis, inspection, demonstration.
- **Levels:** business, stakeholder, system, subsystem, software. A
  requirement traces to a need or to a requirement one level up.
- **Layout:** each need is a section; the requirements that trace first to
  the need sit under the need. Each need and requirement shows its
  statement; its attributes are in a collapsed `Details` block. The
  glossary ends the document.

## 3. Goals

Non-binding `should` statements, each with the need it serves.

## 4. Needs and requirements

One section per need, in the order a reader meets them. Under each need,
the requirements that trace to it; a requirement that traces to several
needs sits under the first one in its `Trace`. Every attribute is written
out in the `Details` block, also when it repeats the value of the block
above. Leave out `Remarks` when it has no value. Optional on needs and
requirements: `Source`, `Priority`.

### N-<AREA>-01 <short title>

> The <stakeholder group> need <the entity> to <capability or outcome>.

<details>
<summary>Details</summary>

- **Level:** business | stakeholder

</details>

#### FR-<AREA>-001 <short title>

> When <trigger>, the <entity> shall <action> <object> <performance>.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** system
- **Rationale:** <why this requirement exists, why this value>
- **Trace:** N-<AREA>-01
- **Verification:** test — <what passes>
- **Status:** draft
- **Remarks:** <optional: notes that are neither requirement nor reason>

</details>

#### SR-<AREA>-001 <short title>

> If <undesired event or condition>, the <entity> shall <response>.

<details>
<summary>Details</summary>

- **Type:** security
- **Level:** system
- **Rationale:** <why this requirement exists>
- **Trace:** N-<AREA>-01
- **Verification:** test — <what passes>
- **Status:** draft

</details>

## 5. Kinds not covered

Each kind of requirement with no requirement in the document, and why, so
that its absence is on purpose (R41, R42): functional, performance,
interface, data, security, safety, reliability and availability,
usability, maintainability, compliance and constraints.

- **<Kind>**: <why there is none: not discussed, not applicable, deferred>.

## 6. Traceability

| Need | Requirements | Covered |
| --- | --- | --- |
| N-<AREA>-01 | FR-<AREA>-001, SR-<AREA>-001 | yes |

## 7. Open issues

| ID | Issue | Affects | Owner | Due |
| --- | --- | --- | --- | --- |
| TBD-01 | <the value or decision missing> | FR-<AREA>-001 | <name> | <date> |

## 8. Glossary

One entry per entity, term, acronym and abbreviation the document uses.
The name in bold is the only name statements may use. When the set spans
several documents, each document has its own glossary of the terms it
uses, and a term used in several documents has the same definition in
each.

- **<Term>**: <definition>. Synonyms in the sources: <…>; not used.

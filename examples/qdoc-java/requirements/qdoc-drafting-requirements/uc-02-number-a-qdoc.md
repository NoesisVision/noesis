# UC-2 Number a QDoc

When a QDoc is created, the QDoc System gives the QDoc a document number:
an incremental sequence number with the month and year of creation, like an
invoice number. Organisations may wrap the number in their own prefix and
suffix. A demo installation marks each number as demo.

**Builds on:** UC-1. Terms: [glossary](#glossary) below.

## Number format table

The parts of a document number, in order. A part whose condition does not
hold is left out. Separators and the order of the two prefixes are
[TBD-03]; the session's example of a core number is `1/12/2025`.

| Order | Part                       | Present when                                |
| ----- | -------------------------- | ------------------------------------------- |
| 1     | Demo prefix                | the QDoc System runs as a demo installation |
| 2     | Organisation prefix        | the numbering settings hold a prefix        |
| 3     | Sequence number            | always                                      |
| 4     | Month of creation          | always                                      |
| 5     | Year of creation, 4 digits | always                                      |
| 6     | Organisation suffix        | the numbering settings hold a suffix        |

## N-PRE-03 Find and name a QDoc

> The quality managers need each QDoc to carry a unique number that people use
> to refer to the QDoc.

<details>
<summary>Details</summary>

- **Level:** stakeholder

</details>

### FR-PRE-011 Number format

> The Preparation subsystem shall compose each document number from the parts
> of the number format table in the order of the number format table.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** One format with optional parts covers the core number, the
  organisation's convention and demos.
- **Trace:** N-PRE-03, N-PRE-04
- **Verification:** test — one QDoc per combination of conditions gets the
  parts the table prescribes, in the prescribed order.
- **Status:** draft

</details>

### FR-PRE-012 Sequence number

> When the Preparation subsystem creates a QDoc, the Preparation subsystem
> shall give the QDoc the sequence number one greater than the sequence number
> of the QDoc the organisation created last [TBR-02].

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** An incremental number, like an invoice number, lets people
  name and find a QDoc.
- **Trace:** N-PRE-03
- **Verification:** test — 3 QDocs created in a row get 3 consecutive
  sequence numbers.
- **Status:** draft
- **Remarks:** The session described the sequence as the previous number
  plus one, but its example also called a number "the first in December";
  whether the sequence restarts each month is TBR-02.

</details>

### FR-PRE-013 Month

> The Preparation subsystem shall take the month part of the document number
> from the month in which the QDoc System created the QDoc.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** The core number reads like an invoice number: sequence,
  month, year.
- **Trace:** N-PRE-03
- **Verification:** test — a QDoc created on 2026-12-03 has month 12 in the
  document number.
- **Status:** draft

</details>

### FR-PRE-014 Year

> The Preparation subsystem shall take the year part of the document number
> from the year in which the QDoc System created the QDoc.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** See FR-PRE-013.
- **Trace:** N-PRE-03
- **Verification:** test — a QDoc created on 2026-12-03 has year 2026 in
  the document number.
- **Status:** draft

</details>

### FR-PRE-018 Unique number

> The Preparation subsystem shall keep the document number of each QDoc of the
> organisation distinct from the document number of each other QDoc of the
> organisation.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** The number identifies the QDoc unambiguously.
- **Trace:** N-PRE-03
- **Verification:** test — 2 QDocs created at the same moment get 2
  different numbers; analysis — the sequence is assigned in one atomic
  step.
- **Status:** draft

</details>

### FR-PRE-019 Stable number

> The Preparation subsystem shall keep the document number of each QDoc
> unchanged for the life of the QDoc.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** A new version is the same QDoc under the same number
  (UC-8); people keep referring to the QDoc by the number.
- **Trace:** N-PRE-03
- **Verification:** test — the document number of a QDoc is the same after
  a new version and after archiving.
- **Status:** draft

</details>

## N-PRE-04 Own numbering convention

> The organisations need the document numbers to follow the organisation's own
> convention, distinct from the organisation's invoice numbers.

<details>
<summary>Details</summary>

- **Level:** business

</details>

### FR-PRE-016 Organisation prefix

> The Preparation subsystem shall include the prefix of the numbering settings
> in each document number of the organisation.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** The organisation's convention keeps QDoc numbers apart from the organisation's other numbers. The prefix
  is optional.
- **Trace:** N-PRE-04
- **Verification:** test — with prefix `QA` set, a new document number
  carries `QA`; with no prefix set, the number has none.
- **Status:** draft

</details>

### FR-PRE-017 Configure the numbering settings

> The Preparation subsystem shall let [TBD-04] change the numbering settings
> of the organisation.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** The session asked for the template to be easy to
  configure; who configures it, and what happens to existing numbers, is
  open.
- **Trace:** N-PRE-04
- **Verification:** demonstration — the permitted user changes the prefix;
  the next QDoc carries the new prefix.
- **Status:** draft

</details>

### FR-PRE-020 Organisation suffix

> The Preparation subsystem shall include the suffix of the numbering settings
> in each document number of the organisation.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** As FR-PRE-016; the suffix is optional.
- **Trace:** N-PRE-04
- **Verification:** test — with suffix `H1` set, a new document number
  carries `H1`; with no suffix set, the number has none.
- **Status:** draft

</details>

## N-PRE-05 Recognisable demo documents

> The vendor of the QDoc System needs each QDoc made on a demo installation to
> be recognisable as demo.

<details>
<summary>Details</summary>

- **Level:** business

</details>

### FR-PRE-015 Demo prefix

> While the Preparation subsystem runs as a demo installation, the Preparation
> subsystem shall include the demo prefix in each document number.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** Makes misuse of a demo for real work visible.
- **Trace:** N-PRE-05
- **Verification:** test — on a demo installation, each new document
  number starts with the demo prefix; on a production installation, none
  does.
- **Status:** draft

</details>

## Open issues used here

- **TBR-02**: does the sequence restart each month?
- **TBD-03**: separators, order of the two prefixes, zero-padding of the
  month.
- **TBD-04**: who changes the numbering settings; effect on existing
  numbers.

## Glossary

Terms used in this file. One name per thing; the term in bold is the only
name a statement may use. A term used in several files has the same
definition in each.

- **Demo installation**: An installation of the QDoc System given to a
  prospective customer to try.
- **Demo prefix**: The text `demo` at the start of each document number of a
  demo installation.
- **Document number**: The human-facing identifier the QDoc System gives a
  QDoc at creation, for searching and for referring to the QDoc. Not a
  security device; tamper evidence comes at publication. Not used:
  signature.
- **Numbering settings**: The prefix and the suffix an organisation adds to
  each document number. Not used: postfix.
- **Preparation subsystem**: Value stream. Creates and numbers QDocs and
  versions, assigns people, holds the files of a version, shares versions
  for review, records review marks, archives QDocs. Area code `PRE`.
- **QDoc**: A quality document: a procedure, guideline, instruction, policy
  or similar document the organisation must maintain. A package of files
  that always works as a whole, like a loan agreement with its annexes:
  whoever signs the QDoc signs each file in it. Has a title, a document
  type, a document number and one or more versions. Is either active or
  archived. Not used: quality document, KUDOK, document (alone).
- **QDoc System**: The system these requirements specify: the subject of
  each `system` requirement. Split into subsystems; see [the
  structure](../qdoc-system-structure.md).
- **Quality manager**: Runs the lifecycle of QDocs in the organisation:
  creates QDocs and versions, assigns people. Writes no content.
- **Sequence number**: The incremental part of the document number.
- **UC-n**: Use case n of this set; one file each.
- **User**: A person with an account in the identity provider.
- **Version**: A complete, self-contained edition of a QDoc, numbered
  from 1. Carries the workflow status: new, approved, published, no
  longer in force or archived. Contains files. A QDoc has at least one
  version.

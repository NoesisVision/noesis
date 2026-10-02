# UC-1 Create a QDoc

A quality manager learns that the organisation needs a new quality document
and starts it in the QDoc System: gives it a title, a document type and at
least one author. The QDoc System numbers it, creates version 1 with an
empty content file and tells the other quality managers.

**Builds on:** nothing. **Leads to:** UC-2 (the number), UC-3 (more people),
UC-4 (writing). Terms: [glossary](#glossary) below.

## N-PRE-01 Start a QDoc

> The quality managers need to start a QDoc in the QDoc System when the
> organisation decides the QDoc is needed, naming the authors who will write
> the QDoc.

<details>
<summary>Details</summary>

- **Level:** stakeholder

</details>

### SR-PRE-001 Only quality managers create QDocs

> If a user who lacks the quality manager role submits a QDoc creation
> request, the Preparation subsystem shall reject the QDoc creation request.

<details>
<summary>Details</summary>

- **Type:** security
- **Level:** subsystem
- **Rationale:** Creating a QDoc is a quality manager's decision. An auditor
  has read-only access (SR-ACT-002) and creates nothing.
- **Trace:** N-PRE-01
- **Verification:** test — a request from an author, a reviewer, an
  approver and an auditor is each rejected; a request from a quality
  manager is accepted.
- **Status:** draft

</details>

### FR-PRE-001 Mandatory creation data

> If a QDoc creation request lacks [the title OR the document type OR at least
> one author], the Preparation subsystem shall reject the QDoc creation
> request.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** The session named these three as the checks made before a
  QDoc is created. Reviewers and approvers may be added later (UC-3).
- **Trace:** N-PRE-01
- **Verification:** test — one request lacking each item is rejected; a
  request with the three items is accepted.
- **Status:** draft

</details>

### FR-PRE-002 Document types

> The Preparation subsystem shall take the document type of each QDoc from the
> list of document types in the glossary.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** The session listed procedure, guideline, instruction and
  policy, and said the list may grow.
- **Trace:** N-PRE-01
- **Verification:** test — each listed type is accepted; a type outside the
  list is rejected.
- **Status:** draft

</details>

### FR-PRE-003 Active QDoc

> When the Preparation subsystem accepts a QDoc creation request, the
> Preparation subsystem shall create the QDoc with the status active.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** A QDoc itself has only two statuses, active and archived;
  workflow statuses belong to versions.
- **Trace:** N-PRE-01
- **Verification:** test — the new QDoc is listed as active.
- **Status:** draft

</details>

### FR-PRE-006 Authors of version 1

> When the Preparation subsystem accepts a QDoc creation request, the
> Preparation subsystem shall assign each author named in the QDoc creation
> request to version 1.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** Each named author must meet the assignment checks of UC-3
  (SR-PRE-003).
- **Trace:** N-PRE-01
- **Verification:** test — each named author appears as an author of
  version 1 and can edit the content file.
- **Status:** draft

</details>

### FR-PRE-007 Optional reviewers at creation

> When a QDoc creation request names reviewers, the Preparation subsystem
> shall assign each named reviewer to version 1.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** Reviewers are optional and may be added now or later
  (UC-3).
- **Trace:** N-PRE-01
- **Verification:** test — a request with 2 reviewers creates version 1 with
  the 2 reviewers; a request with none is accepted.
- **Status:** draft

</details>

### FR-PRE-008 Optional approvers at creation

> When a QDoc creation request names approvers, the Preparation subsystem
> shall assign each named approver to version 1.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** At least one approver is needed only when the version is
  shared (UC-6), so naming none at creation is allowed.
- **Trace:** N-PRE-01
- **Verification:** test — a request with 2 approvers creates version 1
  with the 2 approvers; a request with none is accepted.
- **Status:** draft

</details>

### FR-PRE-009 Document number

> When the Preparation subsystem accepts a QDoc creation request, the
> Preparation subsystem shall give the new QDoc the document number defined by
> UC-2.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** Each QDoc needs a number from the moment the QDoc exists,
  for searching and referring to the QDoc.
- **Trace:** N-PRE-01
- **Verification:** test — each new QDoc carries a document number in the
  format of FR-PRE-011.
- **Status:** draft

</details>

## N-NOT-01 Know about new QDocs

> The quality managers need to learn of each QDoc another quality manager
> creates.

<details>
<summary>Details</summary>

- **Level:** stakeholder

</details>

### FR-NOT-001 Notify the quality managers

> When the QDoc System creates a QDoc, the Notifications subsystem shall
> notify each quality manager of the organisation within [TBD-01].

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** The creation of a procedure matters to each quality
  manager, not only to the one who created it.
- **Trace:** N-NOT-01
- **Verification:** test — with 3 quality managers, each of the 3 receives a
  notification naming the QDoc, its number and its creator.
- **Status:** draft

</details>

## N-PRE-02 Ready to write

> The authors need a version with a content file to write in from the moment
> the QDoc exists.

<details>
<summary>Details</summary>

- **Level:** stakeholder

</details>

### FR-PRE-004 Version 1

> When the Preparation subsystem accepts a QDoc creation request, the
> Preparation subsystem shall create version 1 of the new QDoc with the status
> new.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** Creating a QDoc is creating its first version.
- **Trace:** N-PRE-02
- **Verification:** test — the new QDoc has exactly one version, numbered
  1, with the status new.
- **Status:** draft

</details>

### FR-PRE-005 First content file

> When the Preparation subsystem creates version 1 of a QDoc, the Preparation
> subsystem shall create one empty content file in version 1.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** Each version has at least one content file (UC-4); the
  authors fill the first one.
- **Trace:** N-PRE-02
- **Verification:** test — version 1 of the new QDoc holds one content file
  with no text, and no attachment.
- **Status:** draft

</details>

### FR-PRE-010 A QDoc keeps a version

> The Preparation subsystem shall keep at least one version in each QDoc.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** A QDoc without a version has nothing to review, approve or
  publish.
- **Trace:** N-PRE-02
- **Verification:** test — no operation leaves a QDoc with zero versions.
- **Status:** draft

</details>

## Open issues used here

- **TBD-01**: channel and maximum delay of notifications.

## Glossary

Terms used in this file. One name per thing; the term in bold is the only
name a statement may use. A term used in several files has the same
definition in each.

- **Approver**: At least one per shared version; approves each file and
  takes responsibility for the QDoc. Has no way to reject a QDoc.
- **Assignment**: The link between a user, a version and one role on the
  version: author, reviewer or approver.
- **Attachment**: A PDF file added to a version. Never edited; held in
  quarantine until scanned.
- **Auditor**: An external accredited person who inspects the quality
  process. Reads each QDoc and the record of the QDoc; changes nothing.
- **Author**: The only role that edits content files and adds attachments.
  Not used: contributor.
- **Content file**: A rich-text file the authors write; the body of the
  QDoc. Each version has at least one. Comments and the change history
  attach to content files.
- **Document number**: The human-facing identifier the QDoc System gives a
  QDoc at creation, for searching and for referring to the QDoc. Not a
  security device; tamper evidence comes at publication. Not used:
  signature.
- **Document type**: One of procedure, guideline, instruction, policy. The
  list may grow.
- **Edit**: One saved change to the text of a content file.
- **File**: A content file or an attachment of a version.
- **Notifications subsystem**: Platform. Tells users about events. Area code
  `NOT`.
- **Preparation subsystem**: Value stream. Creates and numbers QDocs and
  versions, assigns people, holds the files of a version, shares versions
  for review, records review marks, archives QDocs. Area code `PRE`.
- **QDoc**: A quality document: a procedure, guideline, instruction, policy
  or similar document the organisation must maintain. A package of files
  that always works as a whole, like a loan agreement with its annexes:
  whoever signs the QDoc signs each file in it. Has a title, a document
  type, a document number and one or more versions. Is either active or
  archived. Not used: quality document, KUDOK, document (alone).
- **QDoc creation request**: A quality manager's request to create a QDoc,
  naming the title, the document type, at least one author and, optionally,
  reviewers and approvers.
- **QDoc System**: The system these requirements specify: the subject of
  each `system` requirement. Split into subsystems; see [the
  structure](../qdoc-system-structure.md).
- **Quality manager**: Runs the lifecycle of QDocs in the organisation:
  creates QDocs and versions, assigns people. Writes no content.
- **Reviewer**: Optional; reads a shared version, comments and marks files
  as reviewed. Blocks nothing. May later be an AI agent.
- **UC-n**: Use case n of this set; one file each.
- **User**: A person with an account in the identity provider.
- **Version**: A complete, self-contained edition of a QDoc, numbered
  from 1. Carries the workflow status: new, approved, published, no
  longer in force or archived. Contains files. A QDoc has at least one
  version.

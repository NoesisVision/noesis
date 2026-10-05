# UC-8 Create a new version

A published QDoc needs to change — the same procedure, done a new way. A
quality manager creates the next version under the same document number.
The new version starts as a copy of each file of the previous version, gets
its people assigned afresh, and goes through review and approval again.

**Builds on:** UC-1 to UC-7 and publication (a later session). Terms: [glossary](#glossary) below.

## N-PRE-14 Change a published QDoc

> The quality managers need to change a published QDoc under the same document
> number.

<details>
<summary>Details</summary>

- **Level:** stakeholder

</details>

### SR-PRE-008 Quality managers create versions

> If a user who lacks the quality manager role submits a new version request,
> the Preparation subsystem shall reject the new version request.

<details>
<summary>Details</summary>

- **Type:** security
- **Level:** subsystem
- **Rationale:** Versions are part of the lifecycle the quality manager
  runs.
- **Trace:** N-PRE-14
- **Verification:** test — a new version request from an author is
  rejected.
- **Status:** draft

</details>

### FR-PRE-037 Version number

> When the Preparation subsystem accepts a new version request, the
> Preparation subsystem shall create the new version with the version number
> one greater than the version number of the latest version.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** The document number stays (FR-PRE-019); the version
  number counts editions.
- **Trace:** N-PRE-14
- **Verification:** test — the next version of a QDoc whose latest version
  is 1 is version 2.
- **Status:** draft

</details>

### FR-PRE-038 Status new

> When the Preparation subsystem creates a new version, the Preparation
> subsystem shall give the new version the status new.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** The new version runs through UC-4 to UC-7 again.
- **Trace:** N-PRE-14
- **Verification:** test — the new version shows the status new.
- **Status:** draft

</details>

## N-PRE-15 One version in work

> The organisations need at most one version of a QDoc in preparation at one
> time.

<details>
<summary>Details</summary>

- **Level:** business

</details>

### FR-PRE-035 Previous version published

> If the latest version of the QDoc has a status other than published, the
> Preparation subsystem shall reject the new version request.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** Until publication, the authors fix the current version
  instead (subject to TBR-12).
- **Trace:** N-PRE-15
- **Verification:** test — a request while the latest version is new, and
  while the latest version is approved, is each rejected.
- **Status:** draft

</details>

### FR-PRE-036 Active QDoc

> If the QDoc is archived, the Preparation subsystem shall reject the new
> version request.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** An archived QDoc is out of use (UC-9).
- **Trace:** N-PRE-15
- **Verification:** test — a request on an archived QDoc is rejected.
- **Status:** draft

</details>

## N-PRE-16 Start from the previous content

> The authors need the new version to start from the files of the previous
> version.

<details>
<summary>Details</summary>

- **Level:** stakeholder

</details>

### FR-PRE-039 Copy the files

> When the Preparation subsystem creates a new version, the Preparation
> subsystem shall copy each file of the latest version into the new version.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** Covers content files and attachments. The authors then
  change, add or remove files (UC-4, UC-5).
- **Trace:** N-PRE-16
- **Verification:** test — version 1 with 1 content file and 1 attachment
  yields version 2 with copies of both.
- **Status:** draft

</details>

### FR-CON-010 Versions independent

> When an author edits a file of a version, the Content management subsystem
> shall change the file of the edited version only.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** The published version stays as published while the next
  one is written.
- **Trace:** N-PRE-16
- **Verification:** test — an edit in version 2 leaves the copy in version
  1 unchanged.
- **Status:** draft

</details>

## N-PRE-17 Fresh people

> The quality managers need to choose the people of each new version anew.

<details>
<summary>Details</summary>

- **Level:** stakeholder

</details>

### FR-PRE-040 People assigned afresh

> When the Preparation subsystem creates a new version, the Preparation
> subsystem shall assign to the new version only the users named in the new
> version request.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** Assignments of the previous version do not carry over; the
  QDoc System should propose the people of the previous version, for the
  quality manager to confirm or replace (a goal, not binding). Each
  assignment meets UC-3.
- **Trace:** N-PRE-17
- **Verification:** test — version 1 had author X; a request naming author
  Y gives version 2 author Y only.
- **Status:** draft

</details>

### FR-PRE-041 At least one author

> If a new version request names zero authors, the Preparation subsystem shall
> reject the new version request [TBR-18].

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** Same rule as at creation (FR-PRE-001); only authors can
  write the new version.
- **Trace:** N-PRE-17
- **Verification:** test — a request with zero authors is rejected.
- **Status:** draft

</details>

## N-NOT-03 Know about new versions

> The quality managers need to learn of each new version.

<details>
<summary>Details</summary>

- **Level:** stakeholder

</details>

### FR-NOT-003 Notify the quality managers

> When the QDoc System creates a new version, the Notifications subsystem
> shall notify each quality manager of the organisation within [TBD-01].

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** As for a new QDoc (FR-NOT-001).
- **Trace:** N-NOT-03
- **Verification:** test — each of 3 quality managers receives a
  notification naming the QDoc and the version number.
- **Status:** draft

</details>

## Open issues used here

- **TBD-01**: channel and maximum delay of notifications.
- **TBR-12**: editing between approval and publication.
- **TBR-18**: at least one author at new version creation.

## Glossary

Terms used in this file. One name per thing; the term in bold is the only
name a statement may use. A term used in several files has the same
definition in each.

- **Approval**: One approver's acceptance of one file.
- **Assignment**: The link between a user, a version and one role on the
  version: author, reviewer or approver.
- **Attachment**: A PDF file added to a version. Never edited; held in
  quarantine until scanned.
- **Author**: The only role that edits content files and adds attachments.
  Not used: contributor.
- **Content file**: A rich-text file the authors write; the body of the
  QDoc. Each version has at least one. Comments and the change history
  attach to content files.
- **Content management subsystem**: Platform. Holds content files: editing,
  concurrent editing, change history, comments, locking. Area code `CON`.
- **Document number**: The human-facing identifier the QDoc System gives a
  QDoc at creation, for searching and for referring to the QDoc. Not a
  security device; tamper evidence comes at publication. Not used:
  signature.
- **Edit**: One saved change to the text of a content file.
- **File**: A content file or an attachment of a version.
- **Latest version**: The version of a QDoc with the highest version number.
- **New version request**: A quality manager's request to create the next
  version of a QDoc, naming the people of the new version.
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
- **QDoc System**: The system these requirements specify: the subject of
  each `system` requirement. Split into subsystems; see [the
  structure](../qdoc-system-structure.md).
- **Quality manager**: Runs the lifecycle of QDocs in the organisation:
  creates QDocs and versions, assigns people. Writes no content.
- **UC-n**: Use case n of this set; one file each.
- **User**: A person with an account in the identity provider.
- **Version**: A complete, self-contained edition of a QDoc, numbered
  from 1. Carries the workflow status: new, approved, published, no
  longer in force or archived. Contains files. A QDoc has at least one
  version.

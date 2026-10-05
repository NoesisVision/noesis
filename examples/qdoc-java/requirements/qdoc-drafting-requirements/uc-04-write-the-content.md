# UC-4 Write the content

The authors write the content files of a version, together and at the same
time, in a rich-text editor. Nobody else edits the content. Each content
file keeps a change history that the people preparing the QDoc can read.

**Builds on:** UC-1, UC-3. Terms: [glossary](#glossary) below.

## N-PRE-08 Write the content

> The authors need to write the content files of each version the authors are
> assigned to.

<details>
<summary>Details</summary>

- **Level:** stakeholder

</details>

### FR-CON-001 Save an author's edit

> When an author of the version submits an edit to an unapproved content file
> of the version, the Content management subsystem shall save the edit.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** Approved content files are locked (FR-CON-009); an edit to
  a partly approved content file withdraws the approvals given
  (FR-APR-010).
- **Trace:** N-PRE-08
- **Verification:** test — an author's edit to an unapproved content file
  is visible to the other authors.
- **Status:** draft

</details>

### FR-CON-003 Rich text

> The Content management subsystem shall provide the formatting features
> listed in [TBD-22] in each content file.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** The session asked for a rich-text editor without listing
  features.
- **Trace:** N-PRE-08
- **Verification:** demonstration — each listed feature is applied in a
  content file.
- **Status:** draft

</details>

## N-CON-01 Clear responsibility for the text

> The organisations need the authors to be the only people who change the
> content.

<details>
<summary>Details</summary>

- **Level:** business

</details>

### SR-CON-001 Only authors edit

> If a user other than an author of the version submits an edit to a content
> file of the version, the Content management subsystem shall reject the edit.

<details>
<summary>Details</summary>

- **Type:** security
- **Level:** subsystem
- **Rationale:** The quality manager, reviewers and approvers comment
  (UC-6); responsibility for the text stays with the authors.
- **Trace:** N-CON-01
- **Verification:** test — edits from a quality manager, a reviewer and an
  approver are each rejected; an edit from an author is saved.
- **Status:** draft

</details>

## N-CON-02 Write together

> The authors need to edit one content file at the same time as the other
> authors of the version.

<details>
<summary>Details</summary>

- **Level:** stakeholder

</details>

### FR-CON-002 Concurrent editing

> The Content management subsystem shall accept edits to one content file from
> at least [TBD-15] authors at the same time while keeping each edit.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** Several authors write one QDoc together, at the same time.
- **Trace:** N-CON-02
- **Verification:** test — the given number of authors type into one
  content file at the same time; the saved text holds each author's edit.
- **Status:** draft
- **Remarks:** The session expects a rich-text editor with collaborative
  editing, possibly an embedded office suite or an own editor with a
  conflict-free merge algorithm (CRDT); the choice is a design decision.

</details>

## N-CON-03 See who changed what

> The people preparing the QDoc need to see the change history of each content
> file from the creation of the content file in the version.

<details>
<summary>Details</summary>

- **Level:** stakeholder

</details>

### FR-CON-004 Record the change history

> When the Content management subsystem saves an edit, the Content management
> subsystem shall record the following data of the edit in the change history
> of the content file: the author of the edit; the time of the edit; the
> changed text.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** The history runs from the creation of the content file in
  the version to the present.
- **Trace:** N-CON-03
- **Verification:** test — 2 authors make 1 edit each; the change history
  shows 2 entries with the right author, time and text.
- **Status:** draft

</details>

### SR-CON-002 Who reads the change history

> If a user who is none of [a quality manager, an auditor, a participant of
> the version] requests the change history of a content file of the version,
> the Content management subsystem shall refuse the request.

<details>
<summary>Details</summary>

- **Type:** security
- **Level:** subsystem
- **Rationale:** Employees see only the published version; the history is
  for the people preparing the QDoc, and for the auditor who inspects the
  process (SR-ACT-002).
- **Trace:** N-CON-03
- **Verification:** test — an employee with no role on the version is
  refused; a reviewer of the version and an auditor are served.
- **Status:** draft

</details>

## N-PRE-09 Several content files

> The authors need to split the content of a version over more than one
> content file.

<details>
<summary>Details</summary>

- **Level:** stakeholder

</details>

### FR-PRE-024 Add a content file

> When an author of a version with the status new adds a content file, the
> Preparation subsystem shall add the content file to the version.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** A version may hold several content files.
- **Trace:** N-PRE-09
- **Verification:** test — an author adds a second content file; the
  version lists 2 content files.
- **Status:** draft

</details>

### FR-PRE-025 Remove a content file

> When an author of a version with the status new removes an unapproved
> content file, the Preparation subsystem shall remove the content file from
> the version.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** Authors shape the package; a fully approved file stays.
- **Trace:** N-PRE-09
- **Verification:** test — an author removes 1 of 3 content files; the
  version lists 2.
- **Status:** draft

</details>

### FR-PRE-026 Keep one content file

> If the removal of a content file would leave the version with zero content
> files, the Preparation subsystem shall reject the removal.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** Each version holds at least one content file; attachments
  are optional.
- **Trace:** N-PRE-09
- **Verification:** test — removing the only content file of a version is
  rejected, also when the version holds attachments.
- **Status:** draft

</details>

### FR-PRE-027 Files fixed outside the status new

> If a version has a status other than new, the Preparation subsystem shall
> reject each [file addition OR file removal] on the version.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** An approved or published version stays as approved; a
  change goes into a new version (UC-8). Covers content files and
  attachments (UC-5).
- **Trace:** N-PRE-09
- **Verification:** test — adding a content file and adding an attachment
  to an approved version are each rejected; removing a file of a published
  version is rejected.
- **Status:** draft

</details>

## Open issues used here

- **TBD-15**: number of authors editing one content file at once.
- **TBD-22**: rich-text formatting features.

## Glossary

Terms used in this file. One name per thing; the term in bold is the only
name a statement may use. A term used in several files has the same
definition in each.

- **Approval**: One approver's acceptance of one file.
- **Approver**: At least one per shared version; approves each file and
  takes responsibility for the QDoc. Has no way to reject a QDoc.
- **Attachment**: A PDF file added to a version. Never edited; held in
  quarantine until scanned.
- **Auditor**: An external accredited person who inspects the quality
  process. Reads each QDoc and the record of the QDoc; changes nothing.
- **Author**: The only role that edits content files and adds attachments.
  Not used: contributor.
- **Change history**: The record of the edits to one content file within one
  version. Not used: versions of a file.
- **Comment**: A remark attached to a fragment of a content file; open or
  closed.
- **Content file**: A rich-text file the authors write; the body of the
  QDoc. Each version has at least one. Comments and the change history
  attach to content files.
- **Content management subsystem**: Platform. Holds content files: editing,
  concurrent editing, change history, comments, locking. Area code `CON`.
- **CRDT**: Conflict-free replicated data type: a data structure that merges
  concurrent edits without conflicts.
- **Edit**: One saved change to the text of a content file.
- **Employee**: Reads published versions only; outside this set.
- **File**: A content file or an attachment of a version.
- **Fully approved file**: A file that each approver of the version has
  approved. Locked: a content file against editing, an attachment against
  removal.
- **Participant of a version**: A user assigned to the version as author,
  reviewer or approver.
- **Preparation subsystem**: Value stream. Creates and numbers QDocs and
  versions, assigns people, holds the files of a version, shares versions
  for review, records review marks, archives QDocs. Area code `PRE`.
- **QDoc**: A quality document: a procedure, guideline, instruction, policy
  or similar document the organisation must maintain. A package of files
  that always works as a whole, like a loan agreement with its annexes:
  whoever signs the QDoc signs each file in it. Has a title, a document
  type, a document number and one or more versions. Is either active or
  archived. Not used: quality document, KUDOK, document (alone).
- **Quality manager**: Runs the lifecycle of QDocs in the organisation:
  creates QDocs and versions, assigns people. Writes no content.
- **Reviewer**: Optional; reads a shared version, comments and marks files
  as reviewed. Blocks nothing. May later be an AI agent.
- **UC-n**: Use case n of this set; one file each.
- **Unapproved file**: A file that some approver of the version has yet to
  approve. An unapproved content file stays editable; an edit withdraws the
  approvals already given on the content file.
- **User**: A person with an account in the identity provider.
- **Version**: A complete, self-contained edition of a QDoc, numbered
  from 1. Carries the workflow status: new, approved, published, no
  longer in force or archived. Contains files. A QDoc has at least one
  version.

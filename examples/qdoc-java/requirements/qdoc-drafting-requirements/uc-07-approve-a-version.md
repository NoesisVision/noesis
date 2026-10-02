# UC-7 Approve a version

Each approver approves each file of a shared version. An approver first
closes the open comments on a content file, and approves exactly the
revision the approver saw. A file locks once each approver has approved it;
until then the authors may still edit, and an edit withdraws the approvals
already given on that file. When the last approval arrives, the version
becomes approved and goes on to publication.
An approver has no way to reject: disagreement goes through comments until
the team reaches a version the approver accepts.

**Builds on:** UC-5, UC-6. Terms: [glossary](#glossary) below.

## N-APR-01 Approve each file

> The approvers need to approve each file of a version, taking responsibility
> for the QDoc.

<details>
<summary>Details</summary>

- **Level:** stakeholder

</details>

### SR-APR-001 Only approvers approve

> If a user other than an approver of the version submits an approval, the
> Approval subsystem shall reject the approval.

<details>
<summary>Details</summary>

- **Type:** security
- **Level:** subsystem
- **Rationale:** The approver takes responsibility for the QDoc.
- **Trace:** N-APR-01
- **Verification:** test — an approval from an author and from a reviewer
  is rejected.
- **Status:** draft

</details>

### FR-APR-001 Shared versions only

> If the version is an unshared version, the Approval subsystem shall reject
> each approval on the version.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** Sharing is the authors' statement that the version is
  ready for approval.
- **Trace:** N-APR-01
- **Verification:** test — an approval on an unshared version is rejected.
- **Status:** draft

</details>

### FR-APR-002 Record an approval

> When an approver of a shared version approves a file of the version, the
> Approval subsystem shall record the approval of the approver on the file.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** Approval is per file and per approver.
- **Trace:** N-APR-01
- **Verification:** test — 2 approvers approve 1 file; the file shows 2
  approvals.
- **Status:** draft

</details>

### FR-APR-004 Scanned attachments only

> If the scan status of an attachment differs from released, the Approval
> subsystem shall reject each approval of the attachment.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** Only a scanned, released attachment is an active file;
  a version therefore reaches approval only with each attachment released.
- **Trace:** N-APR-01
- **Verification:** test — an approval of a quarantined attachment is
  rejected.
- **Status:** draft

</details>

### FR-APR-007 Review marks never block

> When an approver approves a file, the Approval subsystem shall record the
> approval regardless of the review marks on the file.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** A reviewer's silence counts as consent; the approver
  decides whether to wait (FR-PRE-033).
- **Trace:** N-APR-01
- **Verification:** test — an approval on a file with zero review marks is
  recorded.
- **Status:** draft

</details>

### FR-APR-008 No rejection

> The Approval subsystem shall offer each approver the approval as the only
> decision on each file.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** When the quality manager says a QDoc is needed, the QDoc
  is needed; the approver is a safeguard, not a veto.
- **Trace:** N-APR-01
- **Verification:** inspection — the approver's actions on a file are
  approve, comment and close comment.
- **Status:** draft

</details>

### FR-APR-009 Download before approving an attachment

> If an approver has no recorded download of an attachment, the Approval
> subsystem shall reject the approval of the attachment by the approver
> [TBR-11].

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** The session compared this with online insurance: the
  download is the evidence that the person read the file.
- **Trace:** N-APR-01
- **Verification:** test — an approval without a prior download is
  rejected; after a download, the approval is recorded.
- **Status:** draft

</details>

## N-APR-02 Comments dealt with

> The organisations need each comment on a content file dealt with explicitly
> as a condition of the approval of the content file.

<details>
<summary>Details</summary>

- **Level:** business

</details>

### FR-APR-003 Open comments block approval

> If a content file has at least one open comment, the Approval subsystem
> shall reject each approval of the content file.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** Forces the approver to go through each comment.
- **Trace:** N-APR-02
- **Verification:** test — an approval with 1 open comment is rejected;
  after the comment is closed, the approval is recorded.
- **Status:** draft

</details>

### FR-CON-008 Close a comment

> When an approver of the version closes a comment on a content file of the
> version, the Content management subsystem shall mark the comment as closed.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** An approver may close the comment of each other person:
  reviewer, author or approver. Who else may close comments is [TBD-19].
- **Trace:** N-APR-02
- **Verification:** test — an approver closes a reviewer's comment; the
  comment shows as closed.
- **Status:** draft

</details>

## N-APR-03 Approve what was seen

> The approvers need each approval to apply to exactly the text the approver
> read.

<details>
<summary>Details</summary>

- **Level:** stakeholder

</details>

### FR-APR-005 Approve the revision seen

> If the content revision named in an approval differs from the current
> content revision of the content file, the Approval subsystem shall reject
> the approval.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** Optimistic locking: each approval carries the content
  revision the approver saw.
- **Trace:** N-APR-03
- **Verification:** test — an author edits the file after the approver
  opened the file; the approver's approval is rejected.
- **Status:** draft

</details>

### FR-APR-010 An edit withdraws approvals

> When the Content management subsystem saves an edit to a content file, the
> Approval subsystem shall withdraw each approval of the content file.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** An approval covers exactly the text the approver read; an
  approver who approved the earlier text approves again.
- **Trace:** N-APR-03
- **Verification:** test — approver A approves a content file; an author
  edits the content file; the content file shows zero approvals; A
  approves the new content revision and the approval is recorded.
- **Status:** draft
- **Remarks:** Domain expert decision at the review of 2026-10-01.

</details>

## N-APR-04 Approved stays approved

> The organisations need an approved file to stay as the approvers approved
> the file.

<details>
<summary>Details</summary>

- **Level:** business

</details>

### FR-CON-009 Lock an approved content file

> When a content file becomes a fully approved file, the Content management
> subsystem shall lock the content file against editing.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** Approval makes the file read-only. Locking at the first
  approval would leave a later approver who wants a change with no way
  forward, since an approver cannot reject.
- **Trace:** N-APR-04
- **Verification:** test — with 2 approvers, an author's edit after the
  first approval is saved; after the second approval, an author's edit is
  rejected.
- **Status:** draft
- **Remarks:** Domain expert decision at the review of 2026-10-01; the
  session draft locked at the first approval. Edits after the whole version
  is approved remain TBR-12.

</details>

### FR-PRE-034 Lock an approved attachment

> When an attachment becomes a fully approved file, the Preparation subsystem
> shall lock the attachment against removal.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** An attachment is never edited, so removal is the only
  change to prevent. Same moment as for content files (FR-CON-009).
- **Trace:** N-APR-04
- **Verification:** test — removing an attachment that each approver has
  approved is rejected.
- **Status:** draft

</details>

## N-APR-05 Hand over to publication

> The quality managers need a version to become approved once fully approved,
> ready for publication.

<details>
<summary>Details</summary>

- **Level:** stakeholder

</details>

### FR-APR-006 Version approved

> When each approver of the version has approved each file of the version, the
> Approval subsystem shall set the status of the version to approved.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** Approval strategies other than "each approver approves
  each file" are a future goal: each approver, at least one approver, or a
  majority approves each file.
- **Trace:** N-APR-05
- **Verification:** test — with 2 approvers and 2 files, the version turns
  approved on the fourth approval, not earlier.
- **Status:** draft

</details>

### IR-APR-001 Hand over to publication

> When the Approval subsystem sets a version to approved, the Approval
> subsystem shall pass the version to the Distribution subsystem.

<details>
<summary>Details</summary>

- **Type:** interface
- **Level:** subsystem
- **Rationale:** Publication, PDF conversion and signatures belong to the
  Distribution and Acknowledgment subsystems, outside this set.
- **Trace:** N-APR-05
- **Verification:** test — the Distribution subsystem receives the
  approved version once.
- **Status:** draft

</details>

## Open issues used here

- **TBR-11**: download required before approving an attachment?
- **TBR-12**: editing between approval and publication.
- **TBD-19**: who besides an approver may close a comment.

## Glossary

Terms used in this file. One name per thing; the term in bold is the only
name a statement may use. A term used in several files has the same
definition in each.

- **Acknowledgment subsystem**: Value stream. Records employees reading and
  signing a published version; outside this set. Area code `ACK`.
- **Approval**: One approver's acceptance of one file.
- **Approval subsystem**: Value stream. Records approvals per file and per
  approver, sets a version to approved, hands it to the Distribution
  subsystem. Area code `APR`.
- **Approver**: At least one per shared version; approves each file and
  takes responsibility for the QDoc. Has no way to reject a QDoc.
- **Attachment**: A PDF file added to a version. Never edited; held in
  quarantine until scanned.
- **Author**: The only role that edits content files and adds attachments.
  Not used: contributor.
- **Comment**: A remark attached to a fragment of a content file; open or
  closed.
- **Content file**: A rich-text file the authors write; the body of the
  QDoc. Each version has at least one. Comments and the change history
  attach to content files.
- **Content management subsystem**: Platform. Holds content files: editing,
  concurrent editing, change history, comments, locking. Area code `CON`.
- **Content revision**: The identifier of one state of the text of a content
  file; changes with each edit. Not a version.
- **Distribution subsystem**: Value stream. Publishes approved versions to
  employees; outside this set. Not used: publication context. Area code
  `DIS`.
- **Edit**: One saved change to the text of a content file.
- **File**: A content file or an attachment of a version.
- **Fully approved file**: A file that each approver of the version has
  approved. Locked: a content file against editing, an attachment against
  removal.
- **PDF**: Portable Document Format.
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
- **Review mark**: A reviewer's record that the reviewer has read a file and
  has no objection.
- **Reviewer**: Optional; reads a shared version, comments and marks files
  as reviewed. Blocks nothing. May later be an AI agent.
- **Scan status**: One of in quarantine, released, failed.
- **Shared version**: A version the authors have opened to the reviewers and
  approvers of the version. Sharing is a mark on a new version, not a
  status.
- **UC-n**: Use case n of this set; one file each.
- **Unshared version**: A new version without the shared mark.
- **User**: A person with an account in the identity provider.
- **Version**: A complete, self-contained edition of a QDoc, numbered
  from 1. Carries the workflow status: new, approved, published, no
  longer in force or archived. Contains files. A QDoc has at least one
  version.

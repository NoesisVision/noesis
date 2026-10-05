# UC-6 Share a version for review

Until the authors judge a version ready, only the authors and the quality
manager who created the QDoc see the version. Then the authors share it:
the reviewers and approvers join, comment on fragments of the content, and
reviewers mark files as reviewed. Sharing does not hand the version over;
the authors keep editing, like an editor and an author working on a book.

**Builds on:** UC-3, UC-4. Terms: [glossary](#glossary) below.

## N-PRE-11 Private drafting

> The authors need to work on a version without readers while the authors
> consider the version unfinished.

<details>
<summary>Details</summary>

- **Level:** stakeholder

</details>

### SR-PRE-006 Unshared version stays private

> While a version is an unshared version, the Preparation subsystem shall
> refuse access to the version to each user other than [the authors of the
> version OR the quality manager who created the QDoc] [TBD-13].

<details>
<summary>Details</summary>

- **Type:** security
- **Level:** subsystem
- **Rationale:** The authors work without readers until the authors judge
  the version ready.
- **Trace:** N-PRE-11
- **Verification:** test — a reviewer and an approver of an unshared
  version are refused; an author is served.
- **Status:** draft
- **Remarks:** Open: whether other quality managers see an unshared version
  (TBD-13), and whether an auditor does (TBR-24; proposed, no).

</details>

## N-PRE-12 Open for review and approval

> The authors need to open the version to the reviewers and approvers once the
> authors consider the version ready for approval.

<details>
<summary>Details</summary>

- **Level:** stakeholder

</details>

### FR-PRE-029 Share

> When an author of a new version shares the version, the Preparation
> subsystem shall mark the version as shared.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** The authors decide when the version is ready.
- **Trace:** N-PRE-12
- **Verification:** test — after an author shares, the version shows as
  shared.
- **Status:** draft

</details>

### FR-PRE-030 Approver required

> If a version has zero approvers, the Preparation subsystem shall reject each
> request to share the version.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** Reviewers are optional; at least one approver is needed
  from sharing onwards. The session ruled out automatic approval.
- **Trace:** N-PRE-12
- **Verification:** test — sharing a version with reviewers and zero
  approvers is rejected; with 1 approver it succeeds.
- **Status:** draft

</details>

### FR-PRE-031 Reviewers and approvers join

> When the Preparation subsystem marks a version as shared, the Preparation
> subsystem shall give each user who is [a reviewer OR an approver] of the
> version access to the version.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** Sharing opens the version to the people assigned to review
  and approve the version.
- **Trace:** N-PRE-12
- **Verification:** test — after sharing, each reviewer and each approver
  opens the version.
- **Status:** draft

</details>

### SR-PRE-007 Only authors share

> If a user other than an author of the version requests to share the version,
> the Preparation subsystem shall reject the request.

<details>
<summary>Details</summary>

- **Type:** security
- **Level:** subsystem
- **Rationale:** Sharing is the authors' statement that the version is
  ready for approval; nobody else may make it for them.
- **Trace:** N-PRE-12
- **Verification:** test — share requests from a quality manager, a
  reviewer and an approver of the version are each rejected; one from an
  author succeeds.
- **Status:** draft

</details>

## N-CON-04 Comment while the authors write

> The reviewers and approvers need to comment on fragments of the content
> while the authors keep improving the content.

<details>
<summary>Details</summary>

- **Level:** stakeholder

</details>

### FR-CON-005 Authors keep writing

> While a version is shared, the Content management subsystem shall accept
> edits from the authors of the version to each unapproved content file of the
> version.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** Sharing is not a hand-over; the authors respond to
  comments. Approved content files are locked (FR-CON-009).
- **Trace:** N-CON-04
- **Verification:** test — an author edits a content file of a shared
  version.
- **Status:** draft

</details>

### FR-CON-006 Comment on a fragment

> While a version is shared, when a user who is [a quality manager OR an
> author OR a reviewer OR an approver] of the version comments on a fragment
> of a content file, the Content management subsystem shall attach the comment
> to the fragment.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** Everyone besides the authors works through comments;
  authors comment too. Approvers voice disagreement through comments only.
- **Trace:** N-CON-04
- **Verification:** test — a reviewer selects a sentence and comments; the
  comment shows on the sentence to each author.
- **Status:** draft

</details>

### FR-CON-007 Comments on content files only

> If a user comments on an attachment, the Content management subsystem shall
> reject the comment.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** Attachments are PDF files that are accepted as they are,
  never edited.
- **Trace:** N-CON-04
- **Verification:** test — a comment on an attachment is rejected.
- **Status:** draft

</details>

## N-PRE-13 See who has reviewed

> The approvers need to see which reviewers have reviewed each file, to decide
> whether to wait for the remaining reviewers.

<details>
<summary>Details</summary>

- **Level:** stakeholder

</details>

### FR-PRE-032 Mark as reviewed

> When a reviewer of a shared version marks a file of the version as reviewed,
> the Preparation subsystem shall record the review mark of the reviewer on
> the file.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** Review is per file, as approval is.
- **Trace:** N-PRE-13
- **Verification:** test — a reviewer marks 1 of 2 files; the review mark
  shows on that file only.
- **Status:** draft

</details>

### FR-PRE-033 Show the review marks

> The Preparation subsystem shall show each approver of each shared version
> the review marks of each reviewer on each file of the version.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** The approver sees who has reviewed and may chase a
  reviewer outside the QDoc System; the marks never block approval
  (FR-APR-007).
- **Trace:** N-PRE-13
- **Verification:** test — with 2 reviewers, 1 of whom marked the file,
  the approver sees 1 marked and 1 unmarked reviewer.
- **Status:** draft

</details>

## Open issues used here

- **TBD-13**: do other quality managers see an unshared version?
- **TBR-24**: does an auditor see an unshared version?
- **TBD-19**: who besides an approver may close a comment.

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
- **Comment**: A remark attached to a fragment of a content file; open or
  closed.
- **Content file**: A rich-text file the authors write; the body of the
  QDoc. Each version has at least one. Comments and the change history
  attach to content files.
- **Content management subsystem**: Platform. Holds content files: editing,
  concurrent editing, change history, comments, locking. Area code `CON`.
- **Edit**: One saved change to the text of a content file.
- **File**: A content file or an attachment of a version.
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
- **QDoc System**: The system these requirements specify: the subject of
  each `system` requirement. Split into subsystems; see [the
  structure](../qdoc-system-structure.md).
- **Quality manager**: Runs the lifecycle of QDocs in the organisation:
  creates QDocs and versions, assigns people. Writes no content.
- **Review mark**: A reviewer's record that the reviewer has read a file and
  has no objection.
- **Reviewer**: Optional; reads a shared version, comments and marks files
  as reviewed. Blocks nothing. May later be an AI agent.
- **Shared version**: A version the authors have opened to the reviewers and
  approvers of the version. Sharing is a mark on a new version, not a
  status.
- **UC-n**: Use case n of this set; one file each.
- **Unapproved file**: A file that some approver of the version has yet to
  approve. An unapproved content file stays editable; an edit withdraws the
  approvals already given on the content file.
- **Unshared version**: A new version without the shared mark.
- **User**: A person with an account in the identity provider.
- **Version**: A complete, self-contained edition of a QDoc, numbered
  from 1. Carries the workflow status: new, approved, published, no
  longer in force or archived. Contains files. A QDoc has at least one
  version.

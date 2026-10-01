# QDoc preparation: requirements for the QDoc draft

Prepared from the domain discovery session between the domain expert and the
analyst (`.local/qdoc_transcription.txt`). This document covers only the
**preparation** bounded context (also called drafting): the life of a quality
document from the moment it is created until a version of it is approved and
handed over to publication. It is written around one model, the **QDoc
draft**, and lists the use cases that change it, each with scenarios.

## 1. Scope

In scope:

- creating a QDoc draft and generating its document number,
- working on the files of a version: content files and attachments,
- sharing a version for review, commenting, closing comments, marking a
  version as reviewed,
- approving files and, through them, the version,
- creating a new version of a published document,
- archiving a QDoc,
- the activity list and the change history that record all of the above.

Out of scope for this document:

- **Assigning people.** Adding or replacing authors, reviewers and approvers,
  and checking that a person exists, is active and holds the role, belong to a
  separate use case not described here. The draft only reads who is currently
  assigned to a version (see 3.4).
- **Notifications** of any kind (e-mail, in-app, invitations).
- Publication, distribution to employees, conversion to PDF, signatures.
- Storage and scanning of attachment files, which live in a separate
  attachment storage module. The draft keeps only a link to each file.
- The rich-text editor and its concurrent editing mechanism, which live in a
  separate content module. The draft keeps a link to each content file and
  the revision it was last seen at.
- Document templates, AI reviewers, approval strategies other than "every
  approver approves every file", per-section approval, deletion of documents.

## 2. Vocabulary

| Term | Meaning |
| --- | --- |
| QDoc | Quality document: a procedure, guideline, instruction, policy or similar. A package of files that always functions as a whole. |
| QDoc draft | The model of a QDoc inside the preparation context: its identity, number, versions and their files, and the activity list. |
| Document type | Procedure, guideline, instruction, policy. The list may grow. |
| Document number | Human-facing identifier generated at creation, e.g. `1/12/2025`. Not a security device. |
| Version | A complete, self-contained edition of a QDoc. Carries the workflow status. Contains files. |
| Content file | A file written by the authors in the rich-text editor. The body of the document. Commentable. |
| Attachment | A PDF file added by an author. Not edited in the system, not commentable, downloaded rather than displayed. |
| Revision | The identifier of a specific state of a content file's content. Not to be confused with a version. |
| Change history | The record of edits to a content file within one version. Never called "versioning". |
| Activity list | The per-document log of everything that happened to it, by whom and when. |
| Shared | A fact about a version: its authors have made it visible to reviewers and approvers. Not a separate status. |
| Author | The only participant who may change the files of a version. "Contributor" is a synonym; use "author". |
| Reviewer | Optional participant who reads, comments and may mark the version as reviewed. |
| Approver | Participant who closes comments and approves files. Takes responsibility for the document. Cannot reject. |
| Quality manager | Creates QDocs and new versions, archives QDocs. Does not write content. |
| Auditor | External, accredited person. May create test QDocs, treated like a quality manager for their own documents. |
| System actor | The system itself (or an automated agent) acting on the draft, e.g. removing an attachment that failed scanning. |

## 3. The QDoc draft model

### 3.1 Structure

```
QDoc draft
├── id
├── document number          (generated once, never changes)
├── title
├── document type
├── state                    active | archived
├── created by               (quality manager or auditor)
├── versions [1..n]
│   ├── version number       1, 2, 3, ...
│   ├── status               new | approved | published | withdrawn
│   ├── shared               yes/no, with when and by whom
│   ├── reviewed by          set of reviewers who marked the version as reviewed
│   └── files [1..n]
│       ├── Content file
│       │   ├── link to content module
│       │   ├── current revision
│       │   ├── comments       open | closed, anchored to a fragment
│       │   └── approvals      one per approver, each at a revision
│       └── Attachment
│           ├── link to attachment storage
│           ├── verification   pending | verified | rejected
│           └── approvals      one per approver
└── activity list
```

### 3.2 Invariants

1. A QDoc draft always has a document number, a title and a type.
2. A QDoc draft always has at least one version.
3. Every version always has at least one content file. Attachments are
   optional.
4. At most one version of a QDoc is in preparation (status `new` or
   `approved`, not yet published) at any time.
5. At most one version of a QDoc is published at any time.
6. A file approved by at least one approver can no longer be edited or
   removed.
7. A version becomes `approved` exactly when every assigned approver has
   approved every file of that version.
8. An archived QDoc draft accepts no changes at all.
9. Every change to the draft is recorded in the activity list with the actor
   (person or system), the action and the time.

### 3.3 Version statuses

```
new ──(last approval of last file)──▶ approved ──(published by publication)──▶ published ──(superseded / withdrawn)──▶ withdrawn
```

- `new`: from creation until approval. Sharing does not change the status; it
  sets the `shared` flag.
- `approved`: every approver approved every file. Handed over to publication.
- `published` and `withdrawn`: set in reaction to facts reported by the
  publication context. The preparation context does not decide them, but needs
  them to enforce the rules for new versions and archiving.

### 3.4 Participants (input, not managed here)

For every version the draft needs to know its current authors, reviewers and
approvers. How they get there (direct assignment, invitation, directory
lookup) is out of scope. The use cases below only read these lists and assume
they are trustworthy. The creator of the QDoc is always a participant with the
quality manager role for that document.

## 4. Use cases

Every use case below:

- is refused when the QDoc draft is archived (invariant 8),
- on success records an entry in the activity list (invariant 9).

These two rules are not repeated in each scenario list.

### UC-1 Create QDoc draft

**Actor:** quality manager or auditor.

**Input:** title, document type, participants for version 1 (at least one
author).

**Rules:**

- The title must not be empty.
- The document type must be one of the known types.
- At least one author must be given.
- The actor must hold the quality manager or auditor role.

**Outcome:**

- a document number is generated (UC-2),
- version 1 is created with status `new`, not shared,
- one empty content file is created in version 1,
- the creation is recorded in the activity list.

Until the version is shared it is visible only to its creator and its
authors.

**Scenarios:**

1. *Happy path.* A quality manager creates "Web application testing
   procedure", type procedure, with one author. The draft gets number
   `1/12/2025`, version 1 with status `new` and one empty content file. The
   activity list shows "created by <quality manager>".
2. *Missing title.* A quality manager submits the form with an empty title.
   The draft is not created.
3. *Unknown type.* A quality manager chooses a type that is not on the list.
   The draft is not created.
4. *No author.* A quality manager fills in title and type but no author. The
   draft is not created.
5. *Reviewers and approvers postponed.* A quality manager creates a draft with
   one author and no reviewers or approvers. The draft is created; approvers
   will be needed only before sharing (UC-8).
6. *Wrong role.* A user with only the author role tries to create a draft.
   Creation is refused.
7. *Auditor.* An auditor creates a test procedure. The draft is created like
   any other; only its number differs (UC-2, scenario 4).

### UC-2 Generate document number

**Actor:** system, as part of UC-1.

**Rules:**

- The core format is `<sequence>/<month>/<year>`, where the sequence is the
  previous document's sequence plus one, and month and year are those of the
  creation date.
- Numbers are unique within the organisation. Two drafts created at the same
  moment must never get the same sequence.
- The template is configurable per organisation: a customer may add their own
  prefix or suffix, e.g. so numbers do not collide with invoice numbers.
- In a demo instance a `demo` prefix is added.
- When the creator holds the auditor role, an auditor suffix is added.
- The number never changes after creation, not even for new versions.

**Scenarios:**

1. *First in the month.* The first draft in December 2025 gets `1/12/2025`.
2. *Next document.* The previous draft has sequence 7. The next one, created
   in January 2026, gets `8/01/2026`.
3. *Organisation template.* The organisation configured prefix `QD-`. The
   next draft gets `QD-8/01/2026`.
4. *Auditor.* An auditor creates a draft. Its number carries the auditor
   suffix, e.g. `9/01/2026/AUD`, marking it as non-binding.
5. *Demo.* A prospective customer creates a draft in a demo instance. The
   number carries the `demo` prefix, e.g. `demo/1/01/2026`.
6. *Demo and auditor.* An auditor creates a draft in a demo instance. Both the
   prefix and the suffix are applied.
7. *Concurrent creation.* Two quality managers create drafts at the same
   second. They get two different consecutive sequence numbers.
8. *New version keeps the number.* Version 2 of `1/12/2025` is created in
   2027. The number stays `1/12/2025`.

### UC-3 Edit content file

**Actor:** author of the version.

**Rules:**

- Only authors may change the content. Quality managers, reviewers and
  approvers may not.
- The version must not be published.
- The file must not be approved by anyone (invariant 6).
- Several authors may edit at the same time; the content module merges
  concurrent edits.
- Every change is kept in the file's change history (who, what, when), from
  the moment the file was created in this version.
- Editing is allowed both before and after the version is shared.

**Outcome:** the file's current revision advances; the change is recorded in
the change history and in the activity list.

**Scenarios:**

1. *Author writes.* An author fills in the empty content file of version 1.
   The revision advances; the change history shows the author and the time.
2. *Two authors at once.* Two authors edit different paragraphs at the same
   time. Both changes are kept, each attributed to its author.
3. *Edit after sharing.* A reviewer comments that a section is missing. The
   author adds it. The edit is accepted even though the version is shared.
4. *Reviewer tries to edit.* A reviewer tries to change the text. The change
   is refused; the reviewer can only comment.
5. *Quality manager tries to edit.* Refused, the quality manager does not
   write content.
6. *Edit of an approved file.* One approver has approved the content file.
   An author tries to edit it. The edit is refused.
7. *Edit of a published version.* An author tries to edit a file of a
   published version. Refused; a new version is needed (UC-13).

### UC-4 Add content file

**Actor:** author of the version.

**Rules:** the version must be in status `new`.

**Outcome:** a new empty content file is added to the version with its own
change history.

**Scenarios:**

1. *Second content file.* An author adds a second content file for an annex
   written in the editor. The version now has two content files.
2. *Approved version.* The version is already approved. An author tries to
   add a content file. Refused.
3. *Not an author.* An approver tries to add a content file. Refused.

### UC-5 Add attachment

**Actor:** author of the version.

**Input:** a link to a file already uploaded to the attachment storage.

**Rules:**

- The version must be in status `new`.
- Only PDF files are accepted.
- A new attachment starts with verification `pending` (quarantine). It
  cannot be downloaded or approved until it is `verified`.

**Outcome:** the attachment is part of the version with verification
`pending`.

**Scenarios:**

1. *PDF checklist.* An author adds a PDF checklist. It appears on the version
   as pending verification.
2. *Wrong format.* An author tries to add a `.docx` file as an attachment.
   Refused.
3. *Reviewer adds file.* A reviewer tries to add an attachment. Refused.
4. *Download during quarantine.* An approver tries to download an attachment
   that is still pending. The download is not possible.
5. *Approved version.* An author tries to add an attachment to an approved
   version. Refused.

### UC-6 Record attachment verification result

**Actor:** system, in reaction to a result from the attachment storage
(malware, unacceptable content, size).

**Rules:**

- Applies only to an attachment with verification `pending`.
- Expected within a few minutes of upload.
- The result is recorded in the activity list as an action of the system, not
  of a person.

**Outcome:**

- `verified`: the attachment becomes active, downloadable and approvable.
- `rejected`: the attachment can never be downloaded or approved. What happens
  next is an open decision (section 6): either it stays on the version marked
  as rejected until an author removes it, or the system removes it
  automatically (UC-7, performed by the system actor).

**Scenarios:**

1. *Clean file.* The scan passes. The attachment becomes `verified`. The
   activity list shows "verified by system".
2. *Malware found.* The scan finds malware. The attachment becomes
   `rejected`; it cannot be downloaded or approved. The activity list shows
   the outcome and that the system took the action.
3. *Offensive content.* The scan finds offensive images. Same as scenario 2.
4. *Result for a removed attachment.* The author removed the attachment
   before the scan finished. The late result is ignored.
5. *Duplicate result.* The same verification result arrives twice. The second
   one changes nothing and is not logged twice.

### UC-7 Remove file

**Actor:** author of the version, or the system actor for a rejected
attachment.

**Rules:**

- The version must be in status `new`.
- A file approved by anyone cannot be removed.
- The last content file of a version cannot be removed (invariant 3).
  Attachments may all be removed.

**Outcome:** the file is no longer part of the version; the removal and its
actor are in the activity list.

**Scenarios:**

1. *Extra file.* The version has three content files. An author removes two.
   One remains.
2. *Last content file.* The version has one content file and one attachment.
   An author tries to remove the content file. Refused.
3. *All attachments.* An author removes the only attachment. Allowed, a
   version without attachments is valid.
4. *Approved file.* An approver has approved an attachment. An author tries
   to remove it. Refused.
5. *System removes rejected attachment.* If automatic removal is chosen, the
   system removes a rejected attachment. The activity list shows "removed by
   system, reason: failed verification".

### UC-8 Share version for review

**Actor:** author of the version.

**Rules:**

- The version must be in status `new` and not yet shared.
- At least one approver must be assigned to the version. Reviewers are
  optional.
- Sharing is the authors' statement that, in their view, the document is
  ready to be approved. It does not stop editing.

**Outcome:** the version is marked as shared; its reviewers and approvers can
now see it, comment on it and, for approvers, approve its files.

**Scenarios:**

1. *Ready to share.* The version has one approver and two reviewers. An author
   shares it. Reviewers and approvers now see it.
2. *No approver.* The version has reviewers but no approver. Sharing is
   refused.
3. *No reviewers.* The version has one approver and no reviewers. Sharing is
   allowed.
4. *Already shared.* An author tries to share a version that is already
   shared. Nothing changes.
5. *Not an author.* The quality manager tries to share the version. Refused;
   the authors decide when the draft is ready.
6. *Attachment still pending.* An author shares the version a minute after
   adding a PDF that is still pending. Sharing is allowed; the attachment
   stays non-downloadable until verified.

### UC-9 Comment on content file

**Actor:** reviewer, approver or author of the version; the quality manager.

**Rules:**

- The version must be shared (for reviewers and approvers) and not approved.
- Comments are attached to a fragment of a content file. Attachments cannot
  be commented on.
- A new comment is open.

**Outcome:** an open comment on the content file.

**Scenarios:**

1. *Reviewer comment.* A reviewer highlights a paragraph and writes "the
   rollback step is missing". An open comment appears on that fragment.
2. *Approver comment.* An approver disagrees with a step and says so in a
   comment. This is how an approver pushes back; there is no reject action.
3. *Author reply.* An author comments on their own paragraph to explain a
   choice. Allowed.
4. *Before sharing.* A reviewer tries to comment on a version not yet shared.
   Refused; the reviewer cannot see it yet.
5. *Comment on attachment.* A reviewer tries to comment on a PDF attachment.
   Refused.
6. *Comment on approved version.* A reviewer tries to comment on an approved
   version. Refused.

### UC-10 Close comment

**Actor:** approver of the version.

**Rules:**

- The comment must be open.
- Any open comment may be closed, regardless of who wrote it.
- Closing means "I have seen this", whether or not it led to a change.

**Outcome:** the comment is closed; the activity list shows who closed it.

**Scenarios:**

1. *Addressed comment.* The author added the missing rollback step. The
   approver closes the reviewer's comment.
2. *Rejected suggestion.* The approver disagrees with a reviewer's
   suggestion and closes the comment without any change to the text.
3. *Reviewer tries to close.* A reviewer tries to close a comment. Refused.
4. *Author tries to close.* An author tries to close a comment. Refused.
5. *Already closed.* An approver closes a comment that is already closed.
   Nothing changes.

### UC-11 Mark version as reviewed

**Actor:** reviewer of the version.

**Rules:**

- The version must be shared and in status `new`.
- Purely informational: it does not block or unblock anything. Approvers see
  which reviewers have marked the version and may chase the others outside the
  system.
- A reviewer who never marks the version is treated as silently accepting.

**Outcome:** the reviewer is in the version's "reviewed by" set.

**Scenarios:**

1. *No objections.* A reviewer reads the version and marks it as reviewed
   without commenting. The approver sees "reviewed by <reviewer>".
2. *Silent reviewer.* One of two reviewers never marks the version. The
   approver still approves every file; the version becomes approved.
3. *Twice.* A reviewer marks the same version twice. Recorded once.
4. *Not shared.* A reviewer tries to mark a version that is not shared.
   Refused.
5. *Approver marks.* An approver tries to mark the version as reviewed.
   Refused; approvers approve files instead.

### UC-12 Approve file

**Actor:** approver of the version.

**Input:** the file and, for a content file, the revision the approver was
looking at.

**Rules:**

- The version must be shared and in status `new`.
- The actor must be an approver of the version.
- The file must be active: an attachment must be `verified`.
- The content file must have no open comments.
- The given revision must equal the file's current revision (optimistic
  lock): the approver approves exactly what they saw.
- Each approver approves each file once.

**Outcome:**

- the approval is recorded on the file with the approver, time and revision,
- the file is locked for editing and removal (invariant 6),
- when this is the last missing approval of the last file, the version becomes
  `approved` automatically and is handed over to publication.

**Scenarios:**

1. *Single approver, single file.* The version has one content file and one
   approver. The approver approves it at the current revision. The file is
   locked and the version becomes `approved`.
2. *Two approvers.* The version has one content file and two approvers. The
   first approves: the file is locked, the version stays `new`. The second
   approves: the version becomes `approved`.
3. *Content file and attachment.* One approver approves the content file; the
   version stays `new` until the same approver approves the verified
   attachment too.
4. *Open comment.* A reviewer's comment is still open. The approver tries to
   approve. Refused. The approver closes the comment and approves.
5. *Content changed meanwhile.* The approver opened revision 14. An author
   saved revision 15 before the approver clicked approve. The approval is
   refused; the approver must look at the new content.
6. *Pending attachment.* The approver tries to approve an attachment still
   being scanned. Refused.
7. *Rejected attachment.* The approver tries to approve an attachment that
   failed verification. Refused; the version cannot become approved until the
   attachment is gone.
8. *Not an approver.* A reviewer tries to approve a file. Refused.
9. *Not shared.* The approver tries to approve before the authors shared the
   version. Refused.
10. *Approve twice.* An approver approves a file they already approved.
    Nothing changes.
11. *Reviewers silent.* No reviewer marked the version as reviewed. Approval
    is still allowed.

### UC-13 Create new version

**Actor:** quality manager (or auditor for their own document).

**Input:** participants for the new version (supplied from outside, see 3.4).

**Rules:**

- The QDoc must be active.
- The latest version must be `published`. There may be no version in
  preparation (invariant 4).
- The new version gets the next version number and status `new`, not shared.
- The new version is a copy of all files of the previous version, content
  files and attachments alike. Comments, approvals and "reviewed by" are not
  copied. Change history of each copied content file starts in the new
  version.
- The previous version stays in force until the new one is published.
- The document number does not change.

**Outcome:** a new version in preparation, ready for authors to edit.

**Scenarios:**

1. *Switch to automated testing.* Version 1 of `1/12/2025` is published. The
   quality manager creates version 2. It contains copies of version 1's
   content file and PDF attachment. Version 1 remains published.
2. *Previous version not published.* Version 1 is approved but not yet
   published. Creating version 2 is refused.
3. *Version already in preparation.* Version 2 is in status `new`. The
   quality manager tries to create version 3. Refused.
4. *Diverging files.* After creating version 2, an author removes the copied
   attachment and adds three new ones. Version 1 is unaffected.
5. *Clean slate for approval.* Version 1's content file was approved by two
   approvers. In version 2 the copied file has no approvals and is editable.
6. *Archived QDoc.* The QDoc is archived. Creating a version is refused.

### UC-14 Archive QDoc

**Actor:** quality manager.

**Rules:**

- No version may be in preparation (`new` or `approved`).
- No version may be in force (`published`).
- Archiving is a convenience to declutter lists, not a process step.

**Outcome:** the QDoc draft is `archived` and accepts no further changes.

**Scenarios:**

1. *Retired procedure.* The only version of a procedure was withdrawn by
   publication. The quality manager archives the QDoc.
2. *Version in force.* Version 1 is published. Archiving is refused.
3. *Version in preparation.* Version 2 is `new`. Archiving is refused.
4. *Already archived.* The quality manager archives an archived QDoc. Nothing
   changes.

### UC-15 Record publication facts

**Actor:** system, in reaction to facts from the publication context.

**Rules:**

- "Version published" applies only to an `approved` version; it becomes
  `published`, and the previously published version of the same QDoc, if any,
  becomes `withdrawn`.
- "Version withdrawn" applies only to a `published` version.

**Scenarios:**

1. *First publication.* Version 1 is approved; publication reports it
   published. Version 1 becomes `published`.
2. *Replacement.* Version 2 is approved and reported published. Version 2
   becomes `published`, version 1 becomes `withdrawn` (invariant 5).
3. *Unexpected fact.* Publication reports a `new` version as published. The
   fact is rejected.

## 5. Cross-cutting requirements

### 5.1 Activity list

Every QDoc draft has one activity list covering all its versions. Each entry
holds the actor (a person, or the system/an automated agent, clearly
distinguished), the action, the version and file concerned, and the time. It
records at least: creation, number generation, content changes, files added
and removed, attachment verification results, sharing, comments added and
closed, "marked as reviewed", file approvals, version status changes, new
versions and archiving. Status transitions must never be lost: a reader must
never find a change that has no trace.

**Scenarios:**

1. *Full trail.* After scenario UC-12/1 the activity list shows, in order:
   created, content edited (several entries), attachment added, attachment
   verified by system, shared, comment added, comment closed, file approved,
   version approved.
2. *System action.* A rejected attachment was removed automatically. The
   entry names the system as the actor, not the author.

### 5.2 Visibility

- Before sharing: the creator and the authors of the version.
- After sharing: additionally its reviewers and approvers.
- Change history, activity list and previous versions: quality managers,
  authors, reviewers and approvers of the document. Never regular employees.

**Scenarios:**

1. *Early draft.* An approver opens a version that has not been shared. It is
   not visible to them.
2. *Employee.* A regular employee cannot see the draft, its history or
   previous versions at all.

### 5.3 Auditor documents

A draft created by an auditor follows exactly the same rules as any other.
Only the number differs. The system does not hide or filter it.

## 6. Open questions

- Rejected attachment: keep it on the version marked as rejected for the
  author to remove, or remove it automatically as the system actor.
- Whether the verification state is kept in the draft (denormalised from the
  attachment storage) or only shown from the attachment storage. The rules
  above assume the draft knows it, because approval depends on it.
- Late correction between approval and publication: the session allowed it,
  but approval locks the file. How a correction is made without breaking the
  lock is undecided.
- Whether "shared" is shown as a state of the version or only as an entry in
  the activity list.
- Initial list of document types.
- Which parts of the number template an organisation may customise, and the
  exact form of the auditor suffix and demo prefix.
- Attachment size limits per file and per version.
- Whether to record that reviewers and approvers downloaded an attachment.

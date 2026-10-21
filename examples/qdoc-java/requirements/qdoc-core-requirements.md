# QDoc System: detailed requirements (core variant)

- **Document ID:** QDOC-CORE-REQ
- **Version:** 0.1, 2026-10-06
- **Status:** draft
- **Entity specified:** the QDoc System
- **Size:** 40 use cases, 304 rules

## 1. Introduction

### 1.1 Purpose

This document is the input for a modelling workshop. It spells out, in the
language of the business, what the QDoc System does with a controlled
document from the first draft to the signature of the last recipient. The
participants read the rules and find the model in them: which things must
change together, which facts are computed, which rules guard a transition,
who is allowed to do what, and what happens as a reaction somewhere else.

The document therefore describes behaviour only. It names no subsystem, no
bounded context, no aggregate and no event; finding them is the work of the
workshop. Each rule has the QDoc System as its subject.

### 1.2 Sources

- [QDoc one-pager, core variant](qdoc-one-pager-core.md): the flow, the
  concepts and the rules in short.
- [QDoc UI prototype](qdoc-ui.prototype.html): the screens of the owner, the
  author, the quality manager and the employee. Where the one-pager is
  silent, the behaviour of the prototype is taken as decided.

### 1.3 Structure

Five sections follow the life of a version: **Preparation**, **Review**,
**Approval**, **Distribution** and **Signing**. Each section holds use
cases. A use case has a name and one sentence saying who needs what. Under
it stands the list of rules the QDoc System keeps while the use case runs,
one statement per rule.

Rules that return in many use cases are written out in each of them: who may
act, in which status, the electronic signature, the audit entry, the
activity entry and the notifications. A use case can then be read, cut out
and modelled without the rest of the document.

### 1.4 Out of scope

- **Reading the logs.** Each use case says which audit entry and which
  activity entry it writes. Who reads the audit log, how the activity log is
  shown, and the rule that nobody edits or deletes an entry are not part of
  the five sections.
- **Delivery of notifications.** A rule says who is told about what; the
  glossary says a notification reaches the action list and the e-mail of the
  user. Wording, timing and retries are not covered.
- **Users and groups.** Creating users, giving levels, managing groups and
  signing in are assumed. Only the reaction to a user joining a group is
  covered.
- **Left out by the one-pager on purpose:** bulk actions, import, templates
  and tags, change control, periodic review, training plans, time limits for
  review and approval, changing approvers during the round, signing on
  behalf, the HR System, controlled export, document links, reporting,
  security events, API, system validation.

## 2. Conventions

- **Modal verbs:** `shall` states a binding rule. Other modal verbs are not
  used in statements.
- **Statement patterns:** `When <event>, the QDoc System shall …` for a
  reaction; `If <unwanted event>, the QDoc System shall reject …` for a
  check; `While <state>, the QDoc System shall …` for something that holds
  during a state; `The QDoc System shall …` for something that holds at
  each moment.
- **Logic:** conditions and lists of alternatives are combined as
  `[A AND B]` and `[A OR B]`, in capitals inside brackets. "Outside
  `[A OR B]`" means neither A nor B.
- **IDs:** each use case has the ID `N-<SECTION>-<NN>`. The section codes
  are `PREP`, `REVW`, `APPR`, `DIST` and `SIGN`. They are sections of this
  document, not subsystems, and differ on purpose from the subsystem codes
  in [QDoc System: structure](qdoc-system-structure.md). Rules carry no ID;
  a rule is referred to by its use case.
- **Version lifecycle.** Statements name the statuses of this figure:

  ```text
  Draft → In review → In approval → Approved → Published → Effective → Archived
    ↑____ reverted ____|__ declined __|                                QDoc: retired
    |_____________ sent for approval without review _____↑
  ```

  A QDoc is `active` or `retired`. A QACK is `to sign`, `overdue`, `signed`
  or `closed`. A suggestion is `open`, `accepted` or `discarded`. An
  attachment has the scan status `quarantine`, `released` or `failed`. A
  review mark has the kind `reviewed` or `do not care`.

## 3. Preparation

From the first draft to a version ready to be sent on: creating QDocs and
versions, deciding who sees a version, writing the files, attaching PDFs,
commenting, suggesting and resolving suggestions, deleting a draft and
comparing versions.

| Use case | ID | Rules |
| --- | --- | --- |
| Create a new QDoc | N-PREP-01 | 12 |
| Open the next draft version | N-PREP-02 | 10 |
| Open a version in the workspace | N-PREP-03 | 3 |
| Invite a contributor | N-PREP-04 | 6 |
| Add a content file | N-PREP-05 | 4 |
| Edit a content file | N-PREP-06 | 8 |
| Remove a file | N-PREP-07 | 6 |
| Attach a PDF | N-PREP-08 | 15 |
| Comment on a draft | N-PREP-09 | 2 |
| Suggest an edit to a draft | N-PREP-10 | 4 |
| Resolve a suggestion | N-PREP-11 | 7 |
| Delete a draft version | N-PREP-12 | 7 |
| Compare two versions | N-PREP-13 | 3 |

### N-PREP-01 Create a new QDoc

The authors need to start each new QDoc from two entries alone: the title, the
document type.

- If the user who submits the request to create the QDoc is outside [the
  authors OR the quality managers], the QDoc System shall reject the request
  to create the QDoc.
- If the request to create the QDoc lacks the title, the QDoc System shall
  reject the request to create the QDoc.
- If the title in the request to create the QDoc equals the title of one QDoc
  of the organisation, the QDoc System shall reject the request to create the
  QDoc.
- If the document type in the request to create the QDoc is outside the list
  of document types, the QDoc System shall reject the request to create the
  QDoc.
- When the QDoc System creates the QDoc, the QDoc System shall assign to the
  QDoc the next unused QDoc ID of the document type.
- The QDoc System shall assign each QDoc ID to at most one QDoc.
- When the QDoc System creates the QDoc, the QDoc System shall record the user
  who submitted the request as the owner of the QDoc.
- When the QDoc System creates the QDoc, the QDoc System shall set the status
  of the QDoc to active.
- When the QDoc System creates the QDoc, the QDoc System shall open the first
  version of the QDoc with the version number 0.1 in the status Draft.
- When the QDoc System opens the first version of the QDoc, the QDoc System
  shall add one empty content file to the first version.
- When the QDoc System creates the QDoc, the QDoc System shall add to the
  audit log the audit entry with the action "QDoc created" for the first
  version of the QDoc.
- When the QDoc System creates the QDoc, the QDoc System shall add to the
  activity log of the QDoc the activity entry for the property "Version".

### N-PREP-02 Open the next draft version

The authors need to open the next draft version of each QDoc whose effective
version has to change.

- If the user who submits the request to open the next draft version is
  outside [the owner of the QDoc OR the contributors of the effective
  version], the QDoc System shall reject the request to open the next draft
  version.
- If the QDoc System receives the request to open the next draft version while
  the latest version of the QDoc is outside the status Effective, the QDoc
  System shall reject the request to open the next draft version.
- When the QDoc System opens the next draft version, the QDoc System shall
  give the next draft version the major number of the effective version with
  the minor number 1.
- When the QDoc System opens the next draft version, the QDoc System shall
  copy each file of the effective version into the next draft version.
- When the QDoc System opens the next draft version, the QDoc System shall
  copy the version settings of the effective version into the next draft
  version.
- When the QDoc System opens the next draft version, the QDoc System shall
  open the next draft version with the review trail empty.
- When the QDoc System opens the next draft version, the QDoc System shall set
  to no the retraining decision of the next draft version.
- While the QDoc holds the version in preparation, the QDoc System shall keep
  the effective version of the QDoc in the status Effective.
- When the QDoc System opens the next draft version, the QDoc System shall add
  to the audit log the audit entry with the action "Draft version opened" for
  the next draft version.
- When the QDoc System opens the next draft version, the QDoc System shall add
  to the activity log of the QDoc the activity entry for the property
  "Version".

### N-PREP-03 Open a version in the workspace

The owners need each version in preparation shown only to the users who take
part in the version.

- If the user who submits the request to open in the workspace the version in
  the status Draft is outside the contributors of the version, the QDoc System
  shall reject the request to open in the workspace the version in the status
  Draft.
- If the user who submits the request to open in the workspace the version in
  the status In review is outside [the contributors of the version OR the
  reviewers of the version], the QDoc System shall reject the request to open
  in the workspace the version in the status In review.
- If the user who submits the request to open in the workspace the version in
  the status [In approval OR Approved OR Published OR Effective OR Archived]
  is outside [the contributors of the version OR the reviewers of the version
  OR the approvers of the version], the QDoc System shall reject the request
  to open in the workspace the version in the status [In approval OR Approved
  OR Published OR Effective OR Archived].

### N-PREP-04 Invite a contributor

The owners need to invite other authors to write each draft version with the
owner.

- If the user who submits the request to change the contributors of the
  version differs from the owner of the QDoc, the QDoc System shall reject the
  request to change the contributors of the version.
- If the QDoc System receives the request to change the contributors of the
  version while the version is outside the status Draft, the QDoc System shall
  reject the request to change the contributors of the version.
- If the user named in the request to add the contributor is outside the
  authors, the QDoc System shall reject the request to add the contributor.
- If the user named in the request to add the contributor is the owner of the
  QDoc, the QDoc System shall reject the request to add the contributor.
- When the QDoc System adds the contributor to the version, the QDoc System
  shall notify the contributor of the invitation.
- When the QDoc System changes the contributors of the version, the QDoc
  System shall add to the activity log of the QDoc the activity entry for the
  property "Contributors".

### N-PREP-05 Add a content file

The contributors need to split the text of each version over more than one
content file.

- If the user who submits the request to add the content file is outside the
  contributors of the version, the QDoc System shall reject the request to add
  the content file.
- If the QDoc System receives the request to add the content file while the
  version is outside the status Draft, the QDoc System shall reject the
  request to add the content file.
- If the request to add the content file lacks the file name, the QDoc System
  shall reject the request to add the content file.
- When the QDoc System adds the content file to the version, the QDoc System
  shall add to the activity log of the QDoc the activity entry for the
  property "Files".

### N-PREP-06 Edit a content file

The contributors need to write the content files of each draft version
together.

- If the user who submits the edit to the content file is outside the
  contributors of the version, the QDoc System shall reject the edit to the
  content file.
- If the QDoc System receives the edit to the content file while the version
  is outside the status Draft, the QDoc System shall reject the edit to the
  content file.
- While at least two contributors edit one content file at the same time, the
  QDoc System shall keep each edit submitted by each contributor.
- If the edit to the content file targets the fragment that holds one open
  suggestion, the QDoc System shall reject the edit to the content file.
- When the QDoc System accepts the change to the content file, the QDoc System
  shall add the change history entry to the content file.
- When the QDoc System accepts the change to the content file that holds
  sign-offs, the QDoc System shall remove each sign-off of the content file.
- When the QDoc System accepts the change to one content file of the version,
  the QDoc System shall keep each sign-off of each other file of the version.
- When the QDoc System removes the sign-offs of the changed content file, the
  QDoc System shall add to the activity log of the QDoc the activity entry for
  the property "Review marks and approvals".

### N-PREP-07 Remove a file

The contributors need to take out of each draft version each file the version
no longer needs.

- If the user who submits the request to remove the file is outside the
  contributors of the version, the QDoc System shall reject the request to
  remove the file.
- If the QDoc System receives the request to remove the file while the version
  is outside the status Draft, the QDoc System shall reject the request to
  remove the file.
- If the request to remove the file names the only content file of the
  version, the QDoc System shall reject the request to remove the file.
- When the QDoc System removes the file from the draft version, the QDoc
  System shall remove each sign-off of the removed file.
- When the QDoc System removes the file from the draft version, the QDoc
  System shall keep the file in each other version of the QDoc.
- When the QDoc System removes the file from the version, the QDoc System
  shall add to the activity log of the QDoc the activity entry for the
  property "Files".

### N-PREP-08 Attach a PDF

The contributors need to add finished PDF documents to each draft version,
with the organisation protected from harmful files.

- If the user who submits the upload of the attachment is outside the
  contributors of the version, the QDoc System shall reject the upload of the
  attachment.
- If the QDoc System receives the upload of the attachment while the version
  is outside the status Draft, the QDoc System shall reject the upload of the
  attachment.
- If the content of the uploaded file differs from the PDF format, the QDoc
  System shall reject the upload of the attachment.
- If the size of the uploaded file exceeds [TBD-01], the QDoc System shall
  reject the upload of the attachment.
- When the QDoc System accepts the upload of the attachment, the QDoc System
  shall place the attachment in quarantine.
- The QDoc System shall scan each attachment in quarantine for malware.
- The QDoc System shall scan each attachment in quarantine for inappropriate
  content.
- When [the malware scan AND the content scan] of the attachment end without
  finding, the QDoc System shall set the scan status of the attachment to
  released.
- When [the malware scan OR the content scan] of the attachment ends with one
  finding, the QDoc System shall set the scan status of the attachment to
  failed.
- While the scan status of the attachment is failed, the QDoc System shall
  keep the attachment in the file list of the draft version.
- If the QDoc System receives the request to download the attachment while the
  scan status of the attachment is outside released, the QDoc System shall
  reject the request to download the attachment.
- When the QDoc System accepts the upload of the attachment, the QDoc System
  shall add to the audit log the audit entry with the action "Attachment
  uploaded" for the attachment.
- When the QDoc System sets the scan status of the attachment to released, the
  QDoc System shall add to the audit log the audit entry with the action
  "Attachment released" for the attachment.
- When the QDoc System sets the scan status of the attachment to failed, the
  QDoc System shall add to the audit log the audit entry with the action
  "Attachment failed the scan" for the attachment.
- When the QDoc System changes the scan status of the attachment, the QDoc
  System shall add to the activity log of the QDoc the activity entry for the
  property "Scan".

### N-PREP-09 Comment on a draft

The contributors need to leave remarks for each other on fragments of the
content files of each draft version.

- If the user who submits the comment on the content file of the version in
  the status Draft is outside the contributors of the version, the QDoc System
  shall reject the comment on the content file of the version in the status
  Draft.
- When the QDoc System accepts the comment, the QDoc System shall attach the
  comment to the fragment named in the comment.

### N-PREP-10 Suggest an edit to a draft

The contributors need to propose new wording for one fragment without changing
the text.

- If the user who submits the suggestion on the content file of the version in
  the status Draft is outside the contributors of the version, the QDoc System
  shall reject the suggestion on the content file of the version in the status
  Draft.
- If the text proposed by the suggestion equals the text of the fragment, the
  QDoc System shall reject the suggestion.
- If the fragment named by the suggestion holds one open suggestion, the QDoc
  System shall reject the suggestion.
- When the QDoc System accepts the suggestion, the QDoc System shall record
  the suggestion in the status open.

### N-PREP-11 Resolve a suggestion

The owners need to settle each suggestion on each draft version by one
decision of the owner.

- If the user who submits the resolution of the suggestion differs from the
  owner of the QDoc, the QDoc System shall reject the resolution of the
  suggestion.
- If the QDoc System receives the resolution of the suggestion while the
  version is outside the status Draft, the QDoc System shall reject the
  resolution of the suggestion.
- When the owner accepts the suggestion, the QDoc System shall replace the
  text of the fragment with the text proposed by the suggestion.
- When the owner discards the suggestion, the QDoc System shall keep the text
  of the fragment unchanged.
- When the owner resolves the suggestion, the QDoc System shall record on the
  suggestion the outcome with the owner who resolved the suggestion.
- When the QDoc System accepts the suggestion, the QDoc System shall add to
  the audit log the audit entry with the action "Suggestion accepted" for the
  content file of the version.
- When the QDoc System discards the suggestion, the QDoc System shall add to
  the audit log the audit entry with the action "Suggestion discarded" for the
  content file of the version.

### N-PREP-12 Delete a draft version

The owners need to give up each draft version the organisation no longer
wants.

- If the user who submits the request to delete the draft version differs from
  the owner of the QDoc, the QDoc System shall reject the request to delete
  the draft version.
- If the QDoc System receives the request to delete the draft version while
  the version is outside the status Draft, the QDoc System shall reject the
  request to delete the draft version.
- When the QDoc System deletes the draft version of the QDoc that holds the
  effective version, the QDoc System shall keep the effective version in the
  status Effective.
- When the QDoc System deletes the only version of the QDoc, the QDoc System
  shall remove the QDoc.
- The QDoc System shall withhold the QDoc ID of each removed QDoc from each
  QDoc created afterwards.
- When the QDoc System deletes the draft version, the QDoc System shall add to
  the audit log the audit entry with the action "Draft deleted" for the draft
  version.
- When the QDoc System deletes the draft version of the QDoc that holds the
  effective version, the QDoc System shall add to the activity log of the QDoc
  the activity entry for the property "Version".

### N-PREP-13 Compare two versions

The authors need to see what changed between two versions of one QDoc.

- When the user requests the comparison of two versions of the QDoc, the QDoc
  System shall mark in each content file each text addition between the two
  versions.
- When the user requests the comparison of two versions of the QDoc, the QDoc
  System shall mark in each content file each text removal between the two
  versions.
- When the user requests the comparison of two versions of the QDoc, the QDoc
  System shall label each content file that exists in exactly one of the two
  versions.

## 4. Review

The optional round in which named reviewers read a locked version, comment,
suggest and acknowledge each file, or set aside a file outside their
competence, and the owner takes the version back to resolve what they said. A
review gives no verdict.

| Use case | ID | Rules |
| --- | --- | --- |
| Name the reviewers | N-REVW-01 | 6 |
| Send a version for review | N-REVW-02 | 9 |
| Comment and suggest during review | N-REVW-03 | 5 |
| Mark a file as reviewed or do not care | N-REVW-04 | 11 |
| Learn that the reviews are complete | N-REVW-05 | 4 |
| Revert a version to draft | N-REVW-06 | 9 |

### N-REVW-01 Name the reviewers

The owners need to name the users who review each version.

- If the user who submits the request to change the reviewers of the version
  differs from the owner of the QDoc, the QDoc System shall reject the request
  to change the reviewers of the version.
- If the QDoc System receives the request to change the reviewers of the
  version while the version is outside the status Draft, the QDoc System shall
  reject the request to change the reviewers of the version.
- If the user named in the request to add the reviewer is outside [the authors
  OR the quality managers], the QDoc System shall reject the request to add
  the reviewer.
- If the user named in the request to add the reviewer is the owner of the
  QDoc, the QDoc System shall reject the request to add the reviewer.
- When the QDoc System adds the reviewer to the version, the QDoc System shall
  notify the reviewer of the nomination.
- When the QDoc System changes the reviewers of the version, the QDoc System
  shall add to the activity log of the QDoc the activity entry for the
  property "Reviewers".

### N-REVW-02 Send a version for review

The owners need to hand each draft version to the reviewers of the version,
with the text held still while the reviewers read.

- If the user who submits the request to send the version for review differs
  from the owner of the QDoc, the QDoc System shall reject the request to send
  the version for review.
- If the QDoc System receives the request to send the version for review while
  the version is outside the status Draft, the QDoc System shall reject the
  request to send the version for review.
- If the version named in the request to send the version for review holds
  zero reviewers, the QDoc System shall reject the request to send the version
  for review.
- When the QDoc System accepts the request to send the version for review, the
  QDoc System shall set the status of the version to In review.
- When the QDoc System sends the version for review, the QDoc System shall
  remove the decline record of the version.
- When the QDoc System sends the version for review, the QDoc System shall
  keep each review mark held by each file of the version.
- When the QDoc System sends the version for review, the QDoc System shall
  notify each reviewer of the version of the review request.
- When the QDoc System sends the version for review, the QDoc System shall add
  to the audit log the audit entry with the action "Version sent for review"
  for the version.
- When the QDoc System sends the version for review, the QDoc System shall add
  to the activity log of the QDoc the activity entry for the property
  "Status".

### N-REVW-03 Comment and suggest during review

The reviewers need to remark on the content files of each version under
review, proposing new wording where the reviewer sees the need.

- If the user who submits the comment on the content file of the version in
  the status In review is outside [the owner of the QDoc OR the reviewers of
  the version], the QDoc System shall reject the comment on the content file
  of the version in the status In review.
- If the user who submits the suggestion on the content file of the version in
  the status In review is outside [the owner of the QDoc OR the reviewers of
  the version], the QDoc System shall reject the suggestion on the content
  file of the version in the status In review.
- If the QDoc System receives the comment on the content file of the version
  in the status outside [Draft OR In review], the QDoc System shall reject the
  comment.
- If the QDoc System receives the suggestion on the content file of the
  version in the status outside [Draft OR In review], the QDoc System shall
  reject the suggestion.
- While the version is in the status In review, the QDoc System shall keep
  each suggestion on the version in the status open.

### N-REVW-04 Mark a file as reviewed or do not care

The reviewers need to state for each file of the version that the reviewer has
checked the file, or that the file lies outside the competence of the
reviewer.

- If the user who submits the review mark is outside the reviewers of the
  version, the QDoc System shall reject the review mark.
- If the QDoc System receives the review mark while the version is outside the
  status In review, the QDoc System shall reject the review mark.
- If the reviewer submits the review mark for the file that holds the review
  mark of the reviewer, the QDoc System shall reject the review mark.
- If the review mark carries the kind outside [reviewed OR do not care], the
  QDoc System shall reject the review mark.
- If the reviewer submits the review mark of the kind do not care while each
  other file of the version holds the review mark of the kind do not care of
  the reviewer, the QDoc System shall reject the review mark.
- When the QDoc System accepts the review mark, the QDoc System shall record
  the review mark of the reviewer on the file with the kind of the review
  mark.
- The QDoc System shall count each attachment of the version among the files
  that each reviewer marks.
- When the QDoc System accepts the review mark, the QDoc System shall keep the
  status of the version unchanged.
- When the QDoc System accepts the review mark of the kind reviewed, the QDoc
  System shall add to the audit log the audit entry with the action "File
  marked as reviewed" for the file of the version.
- When the QDoc System accepts the review mark of the kind do not care, the
  QDoc System shall add to the audit log the audit entry with the action "File
  marked as do not care" for the file of the version.
- When the QDoc System accepts the review mark, the QDoc System shall add to
  the activity log of the QDoc the activity entry for the property "Review
  mark".

### N-REVW-05 Learn that the reviews are complete

The owners need to hear once when the reviewers have finished, without
watching each review mark.

- The QDoc System shall count the reviews of the version as complete when each
  reviewer of the version holds one review mark of the kind [reviewed OR do
  not care] on each file of the version.
- When the reviews of the version become complete, the QDoc System shall
  notify the owner of the QDoc once per review round.
- When the QDoc System sends for review the version whose reviews are
  complete, the QDoc System shall notify the owner of the QDoc of the complete
  reviews.
- When the reviews of the version become complete, the QDoc System shall keep
  the version in the status In review.

### N-REVW-06 Revert a version to draft

The owners need to take each version under review back to draft to resolve the
suggestions of the reviewers.

- If the user who submits the request to revert the version to draft differs
  from the owner of the QDoc, the QDoc System shall reject the request to
  revert the version to draft.
- If the QDoc System receives the request to revert the version to draft while
  the version is outside the status In review, the QDoc System shall reject
  the request to revert the version to draft.
- When the QDoc System accepts the request to revert the version to draft, the
  QDoc System shall set the status of the version to Draft.
- When the QDoc System reverts the version to draft, the QDoc System shall
  raise the minor number of the version by 1.
- When the QDoc System reverts the version to draft, the QDoc System shall
  keep each review mark of the version.
- When the QDoc System reverts the version to draft, the QDoc System shall
  keep each open suggestion of the version in the status open.
- When the QDoc System reverts the version to draft, the QDoc System shall add
  to the audit log the audit entry with the action "Version reverted to draft"
  for the version.
- When the QDoc System reverts the version to draft, the QDoc System shall add
  to the activity log of the QDoc the activity entry for the property
  "Status".
- When the QDoc System reverts the version to draft, the QDoc System shall add
  to the activity log of the QDoc the activity entry for the property "Version
  number".

## 5. Approval

The round in which each named approver authorises each file with an electronic
signature, or declines the version and hands it back. Approved does not mean
effective.

| Use case | ID | Rules |
| --- | --- | --- |
| Name the approvers | N-APPR-01 | 5 |
| Send a version for approval | N-APPR-02 | 12 |
| Approve a file | N-APPR-03 | 9 |
| Count a version as approved | N-APPR-04 | 8 |
| Decline a version | N-APPR-05 | 12 |

### N-APPR-01 Name the approvers

The owners need to name the users who approve each version.

- If the user who submits the request to change the approvers of the version
  differs from the owner of the QDoc, the QDoc System shall reject the request
  to change the approvers of the version.
- If the QDoc System receives the request to change the approvers of the
  version while the version is outside the status Draft, the QDoc System shall
  reject the request to change the approvers of the version.
- If the user named in the request to add the approver is outside [the authors
  OR the quality managers], the QDoc System shall reject the request to add
  the approver.
- When the QDoc System adds the approver to the version, the QDoc System shall
  notify the approver of the nomination.
- When the QDoc System changes the approvers of the version, the QDoc System
  shall add to the activity log of the QDoc the activity entry for the
  property "Approvers".

### N-APPR-02 Send a version for approval

The owners need to hand each finished version to the approvers of the version.

- If the user who submits the request to send the version for approval differs
  from the owner of the QDoc, the QDoc System shall reject the request to send
  the version for approval.
- If the QDoc System receives the request to send the version for approval
  while the version is outside the status [Draft OR In review], the QDoc
  System shall reject the request to send the version for approval.
- If the version named in the request to send the version for approval holds
  at least one open suggestion, the QDoc System shall reject the request to
  send the version for approval.
- If the version named in the request to send the version for approval holds
  zero approvers, the QDoc System shall reject the request to send the version
  for approval.
- If the approvers of the version named in the request to send the version for
  approval include zero quality managers, the QDoc System shall reject the
  request to send the version for approval.
- If the version named in the request to send the version for approval holds
  at least one attachment with the scan status outside released, the QDoc
  System shall reject the request to send the version for approval.
- When the QDoc System accepts the request to send the version for approval,
  the QDoc System shall set the status of the version to In approval.
- When the QDoc System sends the version for approval, the QDoc System shall
  remove the decline record of the version.
- When the QDoc System sends the version for approval, the QDoc System shall
  keep each approval held by each file of the version.
- When the QDoc System sends the version for approval, the QDoc System shall
  notify each approver of the version of the approval request.
- When the QDoc System sends the version for approval, the QDoc System shall
  add to the audit log the audit entry with the action "Version sent for
  approval" for the version.
- When the QDoc System sends the version for approval, the QDoc System shall
  add to the activity log of the QDoc the activity entry for the property
  "Status".

### N-APPR-03 Approve a file

The approvers need to authorise each file of the version under the approver's
own name.

- If the user who submits the approval of the file is outside the approvers of
  the version, the QDoc System shall reject the approval of the file.
- If the QDoc System receives the approval of the file while the version is
  outside the status In approval, the QDoc System shall reject the approval of
  the file.
- If the approver submits the approval of the file that holds the approval of
  the approver, the QDoc System shall reject the approval of the file.
- If the approval of the file names the attachment with the scan status
  outside released, the QDoc System shall reject the approval of the file.
- If the password entered with the approval of the file fails the password
  check of the signing user, the QDoc System shall reject the approval of the
  file.
- When the QDoc System accepts the approval of the file, the QDoc System shall
  record the electronic signature of the signing user with the meaning
  "Approval of the file in the version".
- When the QDoc System accepts the approval of the file, the QDoc System shall
  record the approval of the approver on the file.
- When the QDoc System accepts the approval of the file, the QDoc System shall
  add to the audit log the audit entry with the action "File approved
  (signed)" for the file of the version.
- When the QDoc System accepts the approval of the file, the QDoc System shall
  add to the activity log of the QDoc the activity entry for the property
  "Approval".

### N-APPR-04 Count a version as approved

The owners need each version to become approved by the approvals alone, with
no further step.

- While the version is in the status In approval, when each approver of the
  version holds one approval on each file of the version, the QDoc System
  shall set the status of the version to Approved.
- When the QDoc System sets the status of the version to Approved, the QDoc
  System shall give the version the next major number with the minor number 0.
- When the QDoc System sets the status of the version to Approved, the QDoc
  System shall keep the effective version of the QDoc in the status Effective.
- When the QDoc System sets the status of the version to Approved, the QDoc
  System shall notify the owner of the QDoc of the approval.
- When the QDoc System sets the status of the version to Approved, the QDoc
  System shall notify each quality manager that the version waits for
  publication.
- When the QDoc System sets the status of the version to Approved, the QDoc
  System shall add to the audit log the audit entry with the action "Version
  approved" for the version.
- When the QDoc System sets the status of the version to Approved, the QDoc
  System shall add to the activity log of the QDoc the activity entry for the
  property "Status".
- When the QDoc System sets the status of the version to Approved, the QDoc
  System shall add to the activity log of the QDoc the activity entry for the
  property "Version number".

### N-APPR-05 Decline a version

The approvers need to refuse each version the approver cannot authorise,
saying why.

- If the user who submits the decline of the version is outside the approvers
  of the version, the QDoc System shall reject the decline of the version.
- If the QDoc System receives the decline of the version while the version is
  outside the status In approval, the QDoc System shall reject the decline of
  the version.
- If the decline of the version lacks the comment, the QDoc System shall
  reject the decline of the version.
- If the password entered with the decline of the version fails the password
  check of the signing user, the QDoc System shall reject the decline of the
  version.
- When the QDoc System accepts the decline of the version, the QDoc System
  shall record the electronic signature of the signing user with the meaning
  "Decline of the version".
- When the QDoc System accepts the decline of the version, the QDoc System
  shall set the status of the version to Draft.
- When the QDoc System accepts the decline of the version, the QDoc System
  shall keep the version number of the version unchanged.
- When the QDoc System accepts the decline of the version, the QDoc System
  shall attach to the version the decline record of the approver.
- When the QDoc System accepts the decline of the version, the QDoc System
  shall keep each approval of each file of the version.
- When the QDoc System accepts the decline of the version, the QDoc System
  shall notify the owner of the QDoc of the decline.
- When the QDoc System accepts the decline of the version, the QDoc System
  shall add to the audit log the audit entry with the action "Version declined
  (signed)" for the version.
- When the QDoc System accepts the decline of the version, the QDoc System
  shall add to the activity log of the QDoc the activity entry for the
  property "Status".

## 6. Distribution

Who a version is for and when it applies: naming recipients, the public flag,
retraining, publication with an effective date, assigning QACKs, changing the
date, coming into force, the library and retirement.

| Use case | ID | Rules |
| --- | --- | --- |
| Name the recipients | N-DIST-01 | 5 |
| Flag a version public | N-DIST-02 | 4 |
| Decide the retraining of earlier signers | N-DIST-03 | 4 |
| Publish an approved version | N-DIST-04 | 15 |
| Assign the QACKs | N-DIST-05 | 8 |
| Change the effective date | N-DIST-06 | 13 |
| Bring a version into force | N-DIST-07 | 11 |
| Read in the library | N-DIST-08 | 8 |
| Retire a QDoc | N-DIST-09 | 13 |

### N-DIST-01 Name the recipients

The owners need to name the recipients who have to learn each version.

- If the user who submits the request to change the recipients of the version
  differs from the owner of the QDoc, the QDoc System shall reject the request
  to change the recipients of the version.
- If the QDoc System receives the request to change the recipients of the
  version while the version is outside the status Draft, the QDoc System shall
  reject the request to change the recipients of the version.
- If the recipient named in the request to add the recipient is outside [the
  users OR the groups], the QDoc System shall reject the request to add the
  recipient.
- The QDoc System shall count the persons named by the recipients of the
  version as the sum of the members of each named group plus the number of
  named users.
- When the QDoc System changes the recipients of the version, the QDoc System
  shall add to the activity log of the QDoc the activity entry for the
  property "Recipients".

### N-DIST-02 Flag a version public

The owners need to open each version meant for the whole organisation to each
user, beyond the recipients of the version.

- If the user who submits the request to change the public flag of the version
  differs from the owner of the QDoc, the QDoc System shall reject the request
  to change the public flag of the version.
- If the QDoc System receives the request to change the public flag of the
  version while the version is outside the status Draft, the QDoc System shall
  reject the request to change the public flag of the version.
- When the QDoc System opens the first version of the QDoc, the QDoc System
  shall set to no the public flag of the first version.
- When the QDoc System changes the public flag of the version, the QDoc System
  shall add to the activity log of the QDoc the activity entry for the
  property "Public".

### N-DIST-03 Decide the retraining of earlier signers

The owners need to decide for each version whether the users who signed the
earlier version train again.

- If the user who submits the request to change the retraining decision of the
  version differs from the owner of the QDoc, the QDoc System shall reject the
  request to change the retraining decision of the version.
- If the QDoc System receives the request to change the retraining decision of
  the version while the version is outside the status Draft, the QDoc System
  shall reject the request to change the retraining decision of the version.
- If the QDoc System receives the request to change the retraining decision of
  the version while the QDoc holds zero effective versions, the QDoc System
  shall reject the request to change the retraining decision.
- When the QDoc System changes the retraining decision of the version, the
  QDoc System shall add to the activity log of the QDoc the activity entry for
  the property "Earlier signers train again".

### N-DIST-04 Publish an approved version

The quality managers need to release each approved version to the recipients
of the version with the date from which the version applies.

- If the user who submits the publication of the version is outside the
  quality managers, the QDoc System shall reject the publication of the
  version.
- If the QDoc System receives the publication of the version while the version
  is outside the status Approved, the QDoc System shall reject the publication
  of the version.
- If the publication of the version lacks the effective date, the QDoc System
  shall reject the publication of the version.
- If the effective date in the publication of the version is earlier than the
  current date, the QDoc System shall reject the publication of the version.
- If the password entered with the publication of the version fails the
  password check of the signing user, the QDoc System shall reject the
  publication of the version.
- When the QDoc System accepts the publication of the version, the QDoc System
  shall record the electronic signature of the signing user with the meaning
  "Publication of the version".
- When the QDoc System accepts the publication of the version, the QDoc System
  shall set the status of the version to Published.
- When the QDoc System accepts the publication of the version, the QDoc System
  shall record on the version the effective date entered by the quality
  manager.
- When the QDoc System accepts the publication of the version with the
  effective date equal to the current date, the QDoc System shall make the
  version effective on the current date.
- While the version is in the status Published, the QDoc System shall keep the
  earlier effective version of the QDoc in the status Effective.
- When the QDoc System accepts the publication of the version that holds zero
  recipients, the QDoc System shall publish the version with zero QACKs.
- When the QDoc System accepts the publication of the version, the QDoc System
  shall notify the owner of the QDoc of the effective date of the version.
- When the QDoc System accepts the publication of the version, the QDoc System
  shall add to the audit log the audit entry with the action "Version
  published (signed)" for the version.
- When the QDoc System accepts the publication of the version, the QDoc System
  shall add to the activity log of the QDoc the activity entry for the
  property "Effective date".
- When the QDoc System accepts the publication of the version, the QDoc System
  shall add to the activity log of the QDoc the activity entry for the
  property "Status".

### N-DIST-05 Assign the QACKs

The quality managers need each person who has to learn each published version
to hold one QACK for the version.

- When the QDoc System publishes the version, the QDoc System shall create one
  QACK of the version for each assignee of the version.
- The QDoc System shall hold at most one QACK per assignee per version.
- When the QDoc System publishes the version with the retraining decision no,
  the QDoc System shall withhold the QACK of the version from each assignee
  who holds the signed QACK of the earlier effective version of the QDoc.
- When the QDoc System creates the QACK, the QDoc System shall set the status
  of the QACK to to sign.
- The QDoc System shall take the effective date of the version as the due date
  of each QACK of the version.
- When the user joins the group named as recipient of the version in the
  status [Published OR Effective], the QDoc System shall create one QACK of
  the version for the user.
- When the QDoc System creates the QACK, the QDoc System shall notify the user
  who holds the QACK of the due date of the QACK.
- When the QDoc System creates the QACKs of the published version, the QDoc
  System shall add to the audit log the audit entry with the action "QACK
  assigned" for the version.

### N-DIST-06 Change the effective date

The quality managers need to move the effective date of each published version
while the version has yet to come into force.

- If the user who submits the change of the effective date is outside the
  quality managers, the QDoc System shall reject the change of the effective
  date.
- If the QDoc System receives the change of the effective date while the
  version is outside the status Published, the QDoc System shall reject the
  change of the effective date.
- If the new effective date in the change of the effective date is earlier
  than the current date, the QDoc System shall reject the change of the
  effective date.
- If the new effective date in the change of the effective date equals the
  effective date of the version, the QDoc System shall reject the change of
  the effective date.
- If the password entered with the change of the effective date fails the
  password check of the signing user, the QDoc System shall reject the change
  of the effective date.
- When the QDoc System accepts the change of the effective date, the QDoc
  System shall record the electronic signature of the signing user with the
  meaning "Change of the effective date of the version".
- When the QDoc System accepts the change of the effective date, the QDoc
  System shall replace the effective date of the version with the new
  effective date.
- When the QDoc System replaces the effective date of the version, the QDoc
  System shall move the due date of each unsigned QACK of the version to the
  new effective date.
- When the QDoc System accepts the change of the effective date with the new
  effective date equal to the current date, the QDoc System shall make the
  version effective on the current date.
- When the QDoc System accepts the change of the effective date, the QDoc
  System shall notify the owner of the QDoc of the new effective date.
- When the QDoc System accepts the change of the effective date, the QDoc
  System shall notify each user who holds one unsigned QACK of the version of
  the new due date.
- When the QDoc System accepts the change of the effective date, the QDoc
  System shall add to the audit log the audit entry with the action "Effective
  date changed (signed)" for the version.
- When the QDoc System accepts the change of the effective date, the QDoc
  System shall add to the activity log of the QDoc the activity entry for the
  property "Effective date".

### N-DIST-07 Bring a version into force

The organisation needs each published version to start applying on the
effective date of the version, replacing the earlier version.

- When the effective date of the version in the status Published arrives, the
  QDoc System shall set the status of the version to Effective.
- The QDoc System shall leave the number of unsigned QACKs of the version out
  of the conditions for making the version effective.
- When the QDoc System sets the status of the version to Effective, the QDoc
  System shall set the status of the earlier effective version of the QDoc to
  Archived.
- The QDoc System shall hold at most one version in the status Effective per
  QDoc.
- The QDoc System shall retain each version in the status Archived with each
  file of the version.
- When the QDoc System sets the status of the version to Effective, the QDoc
  System shall notify the owner of the QDoc that the version is effective.
- When the QDoc System sets the status of the version to Effective, the QDoc
  System shall notify each user who holds one QACK of the version that the
  version is effective.
- When the QDoc System sets the status of the version to Effective, the QDoc
  System shall add to the audit log the audit entry with the action "Version
  became effective" for the version.
- When the QDoc System sets the status of the earlier effective version to
  Archived, the QDoc System shall add to the audit log the audit entry with
  the action "Version archived" for the earlier effective version.
- When the QDoc System sets the status of the version to Effective, the QDoc
  System shall add to the activity log of the QDoc the activity entry for the
  property "Status".
- When the QDoc System sets the status of the earlier effective version to
  Archived, the QDoc System shall add to the activity log of the QDoc the
  activity entry for the property "Earlier version".

### N-DIST-08 Read in the library

The employees need to read the versions in force that are assigned to the
employee, together with the versions meant for each user.

- The QDoc System shall list in the library only versions in the status
  Effective.
- The QDoc System shall show in the library to each assignee of the effective
  version the effective version.
- While the public flag of the effective version is yes, the QDoc System shall
  show the effective version in the library to each user.
- The QDoc System shall show in the library to each quality manager each
  effective version.
- If the user who requests the effective version from the library is outside
  [the assignees of the version OR the quality managers] while the public flag
  of the version is no, the QDoc System shall reject the request.
- The QDoc System shall leave the roles owner, contributor, reviewer, approver
  out of the conditions for access to the library.
- While the version is in the status Published, the QDoc System shall offer
  the version for reading to each assignee only through the QACK of the
  assignee.
- The QDoc System shall show beside each version in the library the status of
  the QACK that the reading user holds for the version.

### N-DIST-09 Retire a QDoc

The quality managers need to take out of use each QDoc the organisation no
longer needs.

- If the user who submits the retirement of the QDoc is outside the quality
  managers, the QDoc System shall reject the retirement of the QDoc.
- If the QDoc System receives the retirement of the QDoc while the latest
  version of the QDoc is outside the status Effective, the QDoc System shall
  reject the retirement of the QDoc.
- If the retirement of the QDoc lacks the reason, the QDoc System shall reject
  the retirement of the QDoc.
- If the password entered with the retirement of the QDoc fails the password
  check of the signing user, the QDoc System shall reject the retirement of
  the QDoc.
- When the QDoc System accepts the retirement of the QDoc, the QDoc System
  shall record the electronic signature of the signing user with the meaning
  "Retirement of the QDoc".
- When the QDoc System accepts the retirement of the QDoc, the QDoc System
  shall set the status of the QDoc to retired.
- When the QDoc System accepts the retirement of the QDoc, the QDoc System
  shall set the status of the effective version of the QDoc to Archived.
- The QDoc System shall leave each version of each retired QDoc out of the
  library.
- If the QDoc System receives the request to change the retired QDoc, the QDoc
  System shall reject the request to change the retired QDoc.
- The QDoc System shall retain each version of each retired QDoc.
- When the QDoc System accepts the retirement of the QDoc, the QDoc System
  shall notify the owner of the QDoc of the retirement.
- When the QDoc System accepts the retirement of the QDoc, the QDoc System
  shall add to the audit log the audit entry with the action "QDoc retired
  (signed)" for the QDoc.
- When the QDoc System accepts the retirement of the QDoc, the QDoc System
  shall add to the activity log of the QDoc the activity entry for the
  property "QDoc".

## 7. Signing

How a person learns a published version and signs for it: the training the
owner sets, a person's own QACKs, reading the files, the quiz, the signature,
overdue and closed QACKs, and the figures the owner follows.

| Use case | ID | Rules |
| --- | --- | --- |
| Set the training of a version | N-SIGN-01 | 10 |
| Follow one's own QACKs | N-SIGN-02 | 5 |
| Read the files of a QACK | N-SIGN-03 | 4 |
| Take the quiz | N-SIGN-04 | 10 |
| Sign a QACK | N-SIGN-05 | 11 |
| Chase and close unsigned QACKs | N-SIGN-06 | 4 |
| Follow the training of a version | N-SIGN-07 | 2 |

### N-SIGN-01 Set the training of a version

The owners need to choose the training mode of each version, with the quiz
questions where the mode asks for one quiz.

- If the user who submits the request to change the training of the version
  differs from the owner of the QDoc, the QDoc System shall reject the request
  to change the training of the version.
- If the QDoc System receives the request to change the training of the
  version while the version is outside the status Draft, the QDoc System shall
  reject the request to change the training of the version.
- If the training mode in the request to change the training of the version is
  outside [read-and-sign OR read-quiz-sign], the QDoc System shall reject the
  request to change the training of the version.
- If the quiz question in the request to change the training of the version
  lacks [the question text OR the first option OR the second option], the QDoc
  System shall reject the request to change the training of the version.
- If the quiz question in the request to change the training of the version
  holds more than three options, the QDoc System shall reject the request to
  change the training of the version.
- If the option named as correct in the quiz question is empty, the QDoc
  System shall reject the request to change the training of the version.
- The QDoc System shall record exactly one correct option for each quiz
  question.
- While the version with the training mode read-quiz-sign holds zero quiz
  questions, the QDoc System shall treat the training mode of the version as
  read-and-sign.
- When the QDoc System changes the training mode of the version, the QDoc
  System shall add to the activity log of the QDoc the activity entry for the
  property "Training".
- When the QDoc System changes the quiz questions of the version, the QDoc
  System shall add to the activity log of the QDoc the activity entry for the
  property "Quiz".

### N-SIGN-02 Follow one's own QACKs

Each user needs to see each QACK the user holds, with the status of the QACK.

- The QDoc System shall list to each user each QACK the user holds.
- The QDoc System shall apply the QACK rules to each user regardless of the
  level of the user.
- The QDoc System shall show each QACK in exactly one of the statuses to sign,
  overdue, signed, closed.
- While [the QACK is unsigned AND the current date is past the due date of the
  QACK], the QDoc System shall show the QACK in the status overdue.
- If the user who submits the request to open the QACK differs from the holder
  of the QACK, the QDoc System shall reject the request to open the QACK.

### N-SIGN-03 Read the files of a QACK

The recipients need to read each file of the version the recipient has to
learn, also while the version has yet to come into force.

- When the holder of the QACK opens the QACK, the QDoc System shall present
  each file of the version of the QACK.
- When the holder of the QACK confirms the reading of the file, the QDoc
  System shall record the reading confirmation of the holder for the file.
- The QDoc System shall count each attachment of the version among the files
  that the holder of the QACK confirms as read.
- If the QDoc System receives the reading confirmation for the QACK in the
  status outside [to sign OR overdue], the QDoc System shall reject the
  reading confirmation.

### N-SIGN-04 Take the quiz

The recipients need to show by one quiz that the recipient understood the
version, trying again when an answer is wrong.

- If the holder of the QACK submits the quiz attempt while at least one file
  of the version lacks the reading confirmation of the holder, the QDoc System
  shall reject the quiz attempt.
- If the quiz attempt lacks the answer to at least one quiz question of the
  version, the QDoc System shall reject the quiz attempt.
- The QDoc System shall count the quiz attempt as passed only when each answer
  in the quiz attempt names the correct option of the quiz question.
- When the QDoc System accepts the quiz attempt, the QDoc System shall record
  the quiz attempt with the outcome of the quiz attempt.
- When the quiz attempt fails, the QDoc System shall tell the holder of the
  QACK which quiz questions hold the wrong answer.
- The QDoc System shall withhold the correct option of each quiz question from
  each holder of the QACK of the version.
- When the quiz attempt fails, the QDoc System shall accept the next quiz
  attempt of the holder of the QACK.
- When the quiz attempt passes, the QDoc System shall record the quiz of the
  QACK as passed.
- When the QDoc System records the passed quiz attempt, the QDoc System shall
  add to the audit log the audit entry with the action "Quiz passed" for the
  version.
- When the QDoc System records the failed quiz attempt, the QDoc System shall
  add to the audit log the audit entry with the action "Quiz attempt failed"
  for the version.

### N-SIGN-05 Sign a QACK

The recipients need to sign for each version the recipient has learned, which
makes the record of the training.

- If the user who submits the signing of the QACK differs from the holder of
  the QACK, the QDoc System shall reject the signing of the QACK.
- If the QDoc System receives the signing of the QACK in the status [signed OR
  closed], the QDoc System shall reject the signing of the QACK.
- If the QDoc System receives the signing of the QACK while at least one file
  of the version lacks the reading confirmation of the holder, the QDoc System
  shall reject the signing of the QACK.
- If the QDoc System receives the signing of the QACK of the version with the
  training mode read-quiz-sign while the quiz of the QACK is outside the
  outcome passed, the QDoc System shall reject the signing of the QACK.
- The QDoc System shall accept the signing of each QACK in the status overdue
  under the conditions that apply to each QACK in the status to sign.
- If the password entered with the signing of the QACK fails the password
  check of the signing user, the QDoc System shall reject the signing of the
  QACK.
- When the QDoc System accepts the signing of the QACK, the QDoc System shall
  record the electronic signature of the signing user with the meaning "I have
  read and understood the version".
- When the QDoc System accepts the signing of the QACK, the QDoc System shall
  set the status of the QACK to signed.
- The QDoc System shall retain each signed QACK as the training record of the
  holder for the version.
- When the QDoc System sets the status of the version to Archived, the QDoc
  System shall retain each signed QACK of the version.
- When the QDoc System accepts the signing of the QACK, the QDoc System shall
  add to the audit log the audit entry with the action "QACK signed" for the
  version.

### N-SIGN-06 Chase and close unsigned QACKs

The quality managers need each unsigned QACK chased while the version applies,
with the QACK closed when the version stops applying.

- When [TBD-03] days remain to the due date of the unsigned QACK, the QDoc
  System shall notify the holder of the QACK of the due date.
- When the QACK becomes overdue, the QDoc System shall notify the holder of
  the QACK that the QACK is overdue.
- When the QDoc System sets the status of the version to Archived, the QDoc
  System shall set the status of each unsigned QACK of the version to closed.
- When the QDoc System shows the QACK as overdue for the first time, the QDoc
  System shall add to the audit log the audit entry with the action "QACK
  overdue" for the QACK of the holder.

### N-SIGN-07 Follow the training of a version

The owners need to see how far the recipients of each published version have
come with signing.

- The QDoc System shall show the training figures of each version in the
  status [Published OR Effective] to each user who opens the version in the
  workspace.
- When the status of one QACK of the version changes, the QDoc System shall
  recompute the training figures of the version.

## 8. Open issues

| ID | Issue | Affects | Owner | Due |
| --- | --- | --- | --- | --- |
| TBD-01 | The size limit of an attachment. The one-pager asks for a limit and gives no value. | Attach a PDF (N-PREP-08) | product owner | before the rules are baselined |
| TBD-02 | What counts as inappropriate content in an attachment. | Attach a PDF (N-PREP-08) | product owner | before the rules are baselined |
| TBD-03 | How many days before the due date the holder of a QACK is told it is due soon. | Chase and close unsigned QACKs (N-SIGN-06) | product owner | before the rules are baselined |

## 9. Glossary

The name in bold is the only name the statements use.

### The system and its users

- **QDoc System**: the system this document specifies. It supports an
  organisation in preparing, approving, distributing and acknowledging
  quality documents, and keeps the record of who did what and when.
  "System" as an actor in a log means the QDoc System acting by itself.
- **Organisation**: the tenant of the QDoc System: the one body whose users,
  groups and QDocs the QDoc System keeps apart from those of each other
  tenant.
- **User**: a person with an account in the QDoc System. Each user has one
  level.
- **Level**: employee, author or quality manager.
- **Employee**: the level that reads versions in force and completes QACKs.
- **Author**: the level that also creates QDocs, writes, reviews and
  approves.
- **Quality manager**: the level that also creates QDocs, and alone publishes,
  changes an effective date and retires.
- **Group**: a named set of users. Its users are its members.
- **Current date**: the calendar day on which the QDoc System acts.

### QDocs and versions

- **QDoc**: the logical quality document: QDoc ID, title, document type,
  owner and versions. Its status is active or retired.
- **Document type**: Policy, SOP or Work Instruction. The **list of
  document types** is these three.
- **QDoc ID**: the identifier of a QDoc: the prefix of the document type
  (POL, SOP, WI), a hyphen and a number. Numbers run separately for each
  document type, upwards from 1; the **next unused QDoc ID** of a document
  type has the lowest number above each number the type has used.
- **SOP**: standard operating procedure, one of the document types.
- **ID**: identifier.
- **Version**: one edition of a QDoc: its files, its people, its version
  settings, its status and its dates.
- **Version number**: the number of a version, written major.minor. The
  **major number** counts approved versions; the **minor number** counts
  draft iterations above the last approved one.
- **Status of a version**: Draft, In review, In approval, Approved,
  Published, Effective or Archived, as in the lifecycle figure.
- **First version**: the version opened when a QDoc is created.
- **Draft version**: a version in the status Draft.
- **Next draft version**: the draft version opened from an effective
  version.
- **Version in preparation**: a version in the status Draft, In review, In
  approval, Approved or Published.
- **Latest version**: the version of a QDoc opened last.
- **Effective version**: the version of a QDoc in the status Effective; the
  version in force.
- **Earlier effective version**: the effective version of a QDoc at the
  moment a newer version is published or comes into force.
- **Version settings**: the contributors, the reviewers, the approvers, the
  recipients, the public flag, the training mode and the quiz of a version.
- **Workspace**: the part of the QDoc System where QDocs are prepared,
  reviewed, approved and published. It is apart from the library.

### People on a QDoc

- **Owner**: the user who created the QDoc.
- **Contributor**: an author invited to write a version with the owner.
- **Reviewer**: a user named on a version to review it.
- **Approver**: a user named on a version to approve it.
- **Recipient**: a user or a group named on a version as having to learn it.
- **Assignee**: a user who has to learn a version: each user named as
  recipient, and each member of each group named as recipient. The version
  is assigned to its assignees.
- **Holder of a QACK**: the user the QACK was created for.

### Files and what is said about them

- **File**: a content file or an attachment of a version.
- **Content file**: a rich-text file the contributors write. A version has at
  least one.
- **Fragment**: a part of the text of a content file that a comment or a
  suggestion points at.
- **Attachment**: a PDF added to a version. It is never edited.
- **PDF**: Portable Document Format.
- **Quarantine**: where an uploaded attachment waits, unusable, for its
  scans. Also the first scan status.
- **Scan status**: quarantine, released or failed.
- **Malware scan**, **content scan**: the two checks of an attachment in
  quarantine, for malware and for inappropriate content. Each ends with a
  finding or without one.
- **Inappropriate content**: [TBD-02].
- **Edit**: a change a contributor makes to the text of a content file.
- **Change to a content file**: an accepted edit, or an accepted suggestion.
- **Change history entry**: who changed what in a content file, and when.
- **Comment**: a remark on a fragment, with its author and its time. A reply
  to a comment is a comment.
- **Suggestion**: a proposed new text for a fragment, with its author and
  its time. Its status is open, accepted or discarded. To **resolve** a
  suggestion is to accept or discard it; the **outcome** is accepted or
  discarded.
- **Review mark**: one reviewer's statement on one file, of the kind
  reviewed or do not care. An acknowledgement, not a verdict. Each rule that
  names the review mark holds for both kinds.
- **Reviewed**: the kind of review mark that says the reviewer checked the
  file.
- **Do not care**: the kind of review mark that says the file lies outside
  the competence of the reviewer. A reviewer holds at least one review mark
  of the kind reviewed among the review marks of a version.
- **Reviews of a version**: the review marks of each reviewer on each file.
- **Review round**: the time a version spends in the status In review, from
  sending to reverting or sending for approval.
- **Approval**: one approver's authorisation of one file, bound to an
  electronic signature.
- **Sign-off**: a review mark or an approval that a file holds.
- **Review trail**: the comments, the suggestions, the review marks and the
  approvals of a version.
- **Decline**: an approver's refusal of a version, with a comment.
- **Decline record**: who declined a version, when, and the comment.
- **Electronic signature**: the identity of the user plus the password,
  entered again for the action, with the meaning of the action and the
  time. The **signing user** is the user who gives it; the **password
  check** compares the entered password with the account of that user.

### Distribution

- **Public flag**: yes or no, set per version. A version with the flag yes
  is, once effective, readable in the library by each user.
- **Retraining decision**: yes or no, set per version: whether the users who
  signed the QACK of the earlier effective version get a QACK again.
- **Publication**: the release of an approved version to its recipients,
  with an effective date.
- **Effective date**: the day from which a published version is in force.
- **Library**: where a user reads versions in force.
- **Retirement**: taking a QDoc out of use, with a reason.

### Signing

- **QACK**: one user's obligation to learn one published version. Its
  status is to sign, overdue, signed or closed. An **unsigned** QACK is to
  sign or overdue.
- **Due date**: the day by which a QACK is to be signed: the effective date
  of its version.
- **Training mode**: read-and-sign, or read-quiz-sign.
- **Quiz**: the quiz questions of a version.
- **Quiz question**: a question text, two or three options, and the one
  correct option.
- **Option**: one of the answers a quiz question offers.
- **Answer**: the option the holder of a QACK picks for one quiz question.
- **Quiz attempt**: one set of answers by the holder of a QACK, one per quiz
  question. Its outcome is passed or failed.
- **Reading confirmation**: the statement of the holder of a QACK that the
  holder has read one file.
- **Training record**: a signed QACK.
- **Training figures**: for one version, the number of QACKs assigned,
  signed, to sign and overdue.

### Logs and messages

- **Audit log**: the system-wide, append-only log of actions.
- **Audit entry**: one line of the audit log: the actor (a user or the
  System), the action, the record and the time.
- **Activity log**: the append-only log of one QDoc.
- **Activity entry**: one line of an activity log: the property, the
  previous value, the new value, who and when.
- **Notification**: a message to a user about assigned work or a due date.
  It appears in the action list of the user and is sent by e-mail. To
  **notify** a user is to send one.

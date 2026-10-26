# QDoc System: preparation requirements (core variant)

- **Document ID:** QDOC-PREP-REQ
- **Version:** 0.4, 2026-10-23
- **Status:** draft
- **Entity specified:** the QDoc System
- **Size:** 26 use cases, 184 rules
- **Replaces:** QDOC-CORE-REQ 0.3, sections 3 to 5

## 1. Introduction

### 1.1 Purpose

This document is the input for a modelling workshop. It spells out, in the
language of the business, what the QDoc System does with a controlled
document from the first draft to the approval of a version. The participants
read the rules and find the model in them: which things must change
together, which facts are computed, which rules guard a transition, who is
allowed to do what, and what happens as a reaction somewhere else.

The document therefore describes behavior only. It names no subsystem, no
bounded context, no aggregate and no event; finding them is the work of the
workshop. The exception are the three platform services the QDoc System
builds on (see 1.3). Each rule has the QDoc System as its subject.

### 1.2 Sources

- [QDoc one-pager, core variant](qdoc-one-pager-core.md): the flow, the
  concepts and the rules in short.
- [QDoc UI prototype](qdoc-ui.prototype.html): the screens of the owner, the
  author, the quality manager and the employee. Where the one-pager is
  silent, the behavior of the prototype is taken as decided.
- [QDoc System: implementation
  requirements](qdoc-implementation-requirements.md): the companion
  document, for the other part of the life of a version.
- [Content File Service](content-files-requirements.md),
  [Notification Service](notifications-requirements.md) and
  [Activity Log Service](activity-log-requirements.md): the platform
  services the QDoc System builds on.

### 1.3 Structure

Three sections follow the life of a version up to its approval:
**Preparation**, **Review** and **Approval**. The life of a version after
its approval, **Distribution** and **Signing**, is specified in [QDoc
System: implementation requirements](qdoc-implementation-requirements.md).
Each section holds use cases. A use case has a name and one sentence saying
who needs what. Under it stands the list of rules the QDoc System keeps
while the use case runs, one statement per rule.

Rules that return in many use cases are written out in each of them: who may
act, in which status, the electronic signature, the audit entry, the
activity entry and the notifications. A use case can then be read, cut out
and modelled without the rest of the document.

Three platform services are specified in documents of their own: the
**Content File Service** holds rich-text files that users write, comment on
and suggest edits to; the **Notification Service** delivers messages to
users; the **Activity Log Service** keeps append-only logs of changes. They
know nothing of QDocs, versions, rounds or the people on a version. This
document states what the QDoc System asks of them and how it reads what they
report: which right on a content file each person holds in each status,
whom the QDoc System notifies of what, and which activity entry it writes.
Where a use case relies on a rule of a platform service, it names the use
case of that service, for example (N-CFIL-06).

### 1.4 Out of scope

- **Reading the logs.** Each use case says which audit entry and which
  activity entry it writes. Who reads the audit log, how the activity log is
  shown, and the rule that nobody edits or deletes an entry are not part of
  the three sections. Keeping the activity log is specified in the Activity
  Log Service.
- **Delivery of notifications.** A rule says who is told about what. How a
  notification reaches the user is specified in the Notification Service.
- **Editing, commenting and suggesting as such.** How a content file is
  edited, commented on and compared, and how a suggestion is resolved, is
  specified in the Content File Service. This document says who may do it
  and when.
- **Users and groups.** Creating users, giving levels, managing groups and
  signing in are assumed.
- **Distribution and signing.** Publication, the effective date, QACKs, the
  library, retirement and the version settings that serve them (recipients,
  public flag, retraining decision, training mode, quiz) are specified in
  [QDoc System: implementation
  requirements](qdoc-implementation-requirements.md). This document ends
  where a version reaches the status Approved.
- **Left out by the one-pager on purpose:** bulk actions, import, templates
  and tags, change control, periodic review, training plans, time limits for
  review and approval, signing on behalf, the HR System, controlled export,
  document links, reporting, security events, API, system validation.

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
- **IDs:** each use case has the ID `N-<SECTION>-<NN>`. The section codes of
  this document are `PREP`, `REVW` and `APPR`; the use cases of distribution
  and signing carry `DIST` and `SIGN` in [QDoc System: implementation
  requirements](qdoc-implementation-requirements.md). They are sections of
  this document, not subsystems, and differ on purpose from the subsystem
  codes in [QDoc System: structure](qdoc-system-structure.md). Rules carry
  no ID; a rule is referred to by its use case. Use cases of the platform
  services carry the IDs `N-CFIL-<NN>`, `N-NOTE-<NN>` and `N-ALOG-<NN>`.
- **Rights on content files.** The QDoc System holds the content files of each
  version in the Content File Service and gives users the rights read,
  comment, edit and resolve on them (N-CFIL-04). A rule that gives a right
  holds while its condition holds; when the condition stops holding, the
  QDoc System withdraws the right. The QDoc System gives no right on a
  content file beyond those the rules of this document and of [QDoc System:
  implementation requirements](qdoc-implementation-requirements.md) give.
- **Version lifecycle.** Statements name the statuses of this figure:

  ```text
  Draft → In review → In approval → Approved → Published → Effective → Archived
    ↑____ reverted ____|__ declined __|                                QDoc: retired
    |_____________ sent for approval without review _____↑
  ```

  Each return to Draft, reverted or declined, raises the minor number. Each
  stay in In review is one review round, and each stay in In approval is one
  approval round; a version keeps each of its rounds.

  A QDoc is `active` or `retired`. A suggestion is `open`, `accepted` or
  `discarded`, as in the Content File Service. An attachment has the scan
  status `quarantine`, `released` or `failed`. A review mark has the kind
  `reviewed` or `do not care`. A review round is `open`, or closed with the
  outcome `reverted` or `sent for approval`. An approval round is `open`, or
  closed with the outcome `approved` or `declined`.

## 3. Preparation

From the first draft to a version ready to be sent on: creating QDocs and
versions, deciding who sees a version, writing the files, attaching PDFs,
commenting, suggesting and resolving suggestions, deleting a draft and
comparing versions.

| Use case | ID | Rules |
| --- | --- | --- |
| Create a new QDoc | N-PREP-01 | 12 |
| Open the next draft version | N-PREP-02 | 10 |
| Open a version in the workspace | N-PREP-03 | 4 |
| Invite a contributor | N-PREP-04 | 5 |
| Add a content file | N-PREP-05 | 5 |
| Edit a content file | N-PREP-06 | 3 |
| Remove a file | N-PREP-07 | 7 |
| Attach a PDF | N-PREP-08 | 15 |
| Comment on a draft | N-PREP-09 | 1 |
| Suggest an edit to a draft | N-PREP-10 | 1 |
| Resolve a suggestion | N-PREP-11 | 3 |
| Delete a draft version | N-PREP-12 | 8 |
| Compare two versions | N-PREP-13 | 2 |

### N-PREP-01 Create a new QDoc

The quality managers need to start each new QDoc from two entries alone: the
title, the document type.

- If the user who submits the request to create the QDoc is outside the
  quality managers, the QDoc System shall reject the request to create the
  QDoc.
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
  shall add to the first version one content file created in the Content
  File Service with the file name [TBD-04] (N-CFIL-01).
- When the QDoc System creates the QDoc, the QDoc System shall add to the
  audit log the audit entry with the action "QDoc created" for the first
  version of the QDoc.
- When the QDoc System creates the QDoc, the QDoc System shall add to the
  activity log of the QDoc the activity entry for the property "Version".

### N-PREP-02 Open the next draft version

The owners and the contributors need to open the next draft version of each
QDoc whose effective version has to change.

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
  copy each file of the effective version into the next draft version, each
  content file through the Content File Service (N-CFIL-02).
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

The owners need each version in preparation shown only to the quality
managers and to the users who take part in the version.

- If the user who submits the request to open in the workspace the version in
  the status Draft is outside [the quality managers OR the contributors of the
  version], the QDoc System shall reject the request to open in the workspace
  the version in the status Draft.
- If the user who submits the request to open in the workspace the version in
  the status In review is outside [the quality managers OR the contributors of
  the version OR the reviewers of the version], the QDoc System shall reject
  the request to open in the workspace the version in the status In review.
- If the user who submits the request to open in the workspace the version in
  the status [In approval OR Approved OR Published OR Effective OR Archived]
  is outside [the quality managers OR the contributors of the version OR the
  reviewers of the version OR the approvers of the version], the QDoc System
  shall reject the request to open in the workspace the version in the status
  [In approval OR Approved OR Published OR Effective OR Archived].
- The QDoc System shall give the right read on each content file of the
  version to each user who may open the version in the workspace.

### N-PREP-04 Invite a contributor

The owners need to invite other users to write each draft version with the
owner.

- If the user who submits the request to change the contributors of the
  version differs from the owner of the QDoc, the QDoc System shall reject the
  request to change the contributors of the version.
- If the QDoc System receives the request to change the contributors of the
  version while the version is outside the status [Draft OR In review OR In
  approval], the QDoc System shall reject the request to change the contributors
  of the version.
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
- When the QDoc System accepts the request to add the content file, the QDoc
  System shall add to the version the content file created in the Content
  File Service with the file name from the request (N-CFIL-01).
- When the QDoc System adds the content file to the version, the QDoc System
  shall give on the content file each right the version gives on each other
  content file of the version.
- When the QDoc System adds the content file to the version, the QDoc System
  shall add to the activity log of the QDoc the activity entry for the
  property "Files".

### N-PREP-06 Edit a content file

The contributors need to write the content files of each draft version
together, as the Content File Service allows (N-CFIL-06).

- The QDoc System shall give the right edit on each content file of the
  version only to the contributors of the version, and only while the version
  is in the status Draft.
- When the Content File Service reports the change to the content file of the
  version, the QDoc System shall take the file revision in the report as the
  file revision of the content file in the version.
- When the content file of the version gets the next file revision, the QDoc
  System shall retain each review mark given on each earlier file revision of
  the content file in the review round in which the reviewer gave the review
  mark.

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
  System shall retain each review mark and each approval of the removed file
  in the round in which the review mark or the approval was given.
- When the QDoc System removes the file from the draft version, the QDoc
  System shall keep the file in each other version of the QDoc.
- When the QDoc System removes the content file from the draft version, the
  QDoc System shall delete the content file in the Content File Service
  (N-CFIL-03).
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
content files of each draft version, as the Content File Service allows
(N-CFIL-07).

- While the version is in the status Draft, the QDoc System shall give the
  right comment on each content file of the version to each contributor of
  the version.

### N-PREP-10 Suggest an edit to a draft

The contributors need to propose new wording for one fragment without changing
the text, as the Content File Service allows (N-CFIL-08).

- While the version is in the status Draft, the QDoc System shall give the
  right comment on each content file of the version to each contributor of
  the version.

### N-PREP-11 Resolve a suggestion

The owners need to settle each suggestion on each draft version by one
decision of the owner, as the Content File Service allows (N-CFIL-09).

- The QDoc System shall give the right resolve on each content file of the
  version only to the owner of the QDoc, and only while the version is in the
  status Draft.
- When the Content File Service reports the accepted suggestion on the content
  file of the version, the QDoc System shall add to the audit log the audit
  entry with the action "Suggestion accepted" for the content file of the
  version.
- When the Content File Service reports the discarded suggestion on the
  content file of the version, the QDoc System shall add to the audit log the
  audit entry with the action "Suggestion discarded" for the content file of
  the version.

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
- When the QDoc System deletes the draft version, the QDoc System shall
  delete each content file of the draft version in the Content File Service
  (N-CFIL-03).
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

The contributors need to see what changed between two versions of one QDoc.

- When the user requests the comparison of two versions of the QDoc, the QDoc
  System shall compare each content file of the one version with the same
  content file of the other version (N-CFIL-10).
- When the user requests the comparison of two versions of the QDoc, the QDoc
  System shall label each content file that exists in exactly one of the two
  versions.

## 4. Review

The optional rounds in which named reviewers read a locked version, comment,
suggest and acknowledge each file, or set aside a file outside their
competence, and the owner takes the version back to resolve what they said. A
review gives no verdict. A version can pass through several review rounds;
each keeps its results, and a "reviewed" mark on an unchanged file carries
over to the next round.

| Use case | ID | Rules |
| --- | --- | --- |
| Name the reviewers | N-REVW-01 | 5 |
| Send a version for review | N-REVW-02 | 10 |
| Comment and suggest during review | N-REVW-03 | 4 |
| Mark a file as reviewed or do not care | N-REVW-04 | 12 |
| Learn that the reviews are complete | N-REVW-05 | 4 |
| Revert a version to draft | N-REVW-06 | 9 |
| See the results of each review round | N-REVW-07 | 8 |

### N-REVW-01 Name the reviewers

The owners need to name the users who review each version.

- If the user who submits the request to change the reviewers of the version
  differs from the owner of the QDoc, the QDoc System shall reject the request
  to change the reviewers of the version.
- If the QDoc System receives the request to change the reviewers of the
  version while the version is outside the status [Draft OR In review OR In
  approval], the QDoc System shall reject the request to change the reviewers
  of the version.
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
  open the next review round of the version.
- When the QDoc System opens the review round, the QDoc System shall count
  each carried-over review mark as the review mark of the reviewer in the
  review round.
- When the QDoc System opens the review round, the QDoc System shall leave out
  of the review round each review mark of the kind do not care given in each
  earlier review round.
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

- While the version is in the status In review, the QDoc System shall give the
  right comment on each content file of the version to the owner of the QDoc
  and to each reviewer of the version.
- While the version is outside the status [Draft OR In review], the QDoc
  System shall give the right comment on each content file of the version to
  no user.
- While the version is in the status In review, the QDoc System shall give the
  right resolve on each content file of the version to no user, so that each
  suggestion on the version stays open.
- When the Content File Service reports [the comment OR the suggestion] on the
  content file of the version in the status In review, the QDoc System shall
  record [the comment OR the suggestion] in the open review round of the
  version.

### N-REVW-04 Mark a file as reviewed or do not care

The reviewers need to state for each file of the version that the reviewer has
checked the file, or that the file lies outside the competence of the
reviewer.

- If the user who submits the review mark is outside the reviewers of the
  version, the QDoc System shall reject the review mark.
- If the QDoc System receives the review mark while the version is outside the
  status In review, the QDoc System shall reject the review mark.
- If the reviewer submits the review mark for the file that holds the review
  mark of the reviewer in the open review round, the QDoc System shall reject
  the review mark.
- If the review mark carries the kind outside [reviewed OR do not care], the
  QDoc System shall reject the review mark.
- If the reviewer submits the review mark of the kind do not care while each
  other file of the version holds the review mark of the kind do not care of
  the reviewer in the open review round, the QDoc System shall reject the
  review mark.
- When the QDoc System accepts the review mark, the QDoc System shall record
  the review mark of the reviewer on the file with the kind of the review
  mark in the open review round.
- When the QDoc System accepts the review mark, the QDoc System shall record
  on the review mark the file revision of the file.
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
  not care] on each file of the version in the open review round.
- When the reviews of the version become complete, the QDoc System shall
  notify the owner of the QDoc once per review round.
- When the QDoc System opens the review round in which the carried-over review
  marks make the reviews complete, the QDoc System shall notify the owner of
  the QDoc of the complete reviews.
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
  close the open review round with the outcome reverted.
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

### N-REVW-07 See the results of each review round

The owners need to see what the reviewers said in each review round of each
version, also after later review rounds.

- The QDoc System shall number the review rounds of each version upwards from
  1.
- When the QDoc System opens the review round, the QDoc System shall record on
  the review round the version number of the version.
- The QDoc System shall hold at most one review round per version number.
- The QDoc System shall retain each closed review round with each review mark,
  each comment and each suggestion recorded in the review round.
- The QDoc System shall show the review rounds of the version to each user who
  opens the version in the workspace.
- When the QDoc System shows the review round, the QDoc System shall show each
  review mark of each reviewer on each file in the review round.
- When the QDoc System shows the review round, the QDoc System shall label each
  carried-over review mark with the review round in which the reviewer gave
  the review mark.
- When the QDoc System shows the closed review round, the QDoc System shall
  show the outcome of the review round.

## 5. Approval

The round in which each named approver authorises each file with an electronic
signature, or declines the version and hands it back. Approved does not mean
effective. A version can pass through several approval rounds; each keeps its
results, and each round starts with zero approvals.

| Use case | ID | Rules |
| --- | --- | --- |
| Name the approvers | N-APPR-01 | 5 |
| Send a version for approval | N-APPR-02 | 12 |
| Approve a file | N-APPR-03 | 9 |
| Count a version as approved | N-APPR-04 | 9 |
| Decline a version | N-APPR-05 | 13 |
| See the results of each approval round | N-APPR-06 | 8 |

### N-APPR-01 Name the approvers

The owners need to name the users who approve each version.

- If the user who submits the request to change the approvers of the version
  differs from the owner of the QDoc, the QDoc System shall reject the request
  to change the approvers of the version.
- If the QDoc System receives the request to change the approvers of the
  version while the version is outside the status [Draft OR In review OR In
  approval], the QDoc System shall reject the request to change the approvers
  of the version.
- If the user named in the request to add the approver is the owner of the
  QDoc, the QDoc System shall reject the request to add the approver.
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
- If one content file of the version named in the request to send the
  version for approval holds at least one open suggestion (N-CFIL-11), the
  QDoc System shall reject the request to send the version for approval.
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
  open the next approval round of the version with zero approvals.
- When the QDoc System sends for approval the version in the status In review,
  the QDoc System shall close the open review round with the outcome sent for
  approval.
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
  the approver in the open approval round, the QDoc System shall reject the
  approval of the file.
- If the approval of the file names the attachment with the scan status
  outside released, the QDoc System shall reject the approval of the file.
- If the password entered with the approval of the file fails the password
  check of the signing user, the QDoc System shall reject the approval of the
  file.
- When the QDoc System accepts the approval of the file, the QDoc System shall
  record the electronic signature of the signing user with the meaning
  "Approval of the file in the version".
- When the QDoc System accepts the approval of the file, the QDoc System shall
  record the approval of the approver on the file in the open approval round.
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
  version holds one approval on each file of the version in the open approval
  round, the QDoc System shall set the status of the version to Approved.
- When the QDoc System sets the status of the version to Approved, the QDoc
  System shall close the open approval round with the outcome approved.
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
  shall raise the minor number of the version by 1.
- When the QDoc System accepts the decline of the version, the QDoc System
  shall record the decline record of the approver in the open approval round.
- When the QDoc System accepts the decline of the version, the QDoc System
  shall close the open approval round with the outcome declined.
- When the QDoc System accepts the decline of the version, the QDoc System
  shall notify the owner of the QDoc of the decline.
- When the QDoc System accepts the decline of the version, the QDoc System
  shall add to the audit log the audit entry with the action "Version declined
  (signed)" for the version.
- When the QDoc System accepts the decline of the version, the QDoc System
  shall add to the activity log of the QDoc the activity entry for the
  property "Status".
- When the QDoc System accepts the decline of the version, the QDoc System
  shall add to the activity log of the QDoc the activity entry for the
  property "Version number".

### N-APPR-06 See the results of each approval round

The owners need to see what the approvers did in each approval round of each
version, also after later approval rounds.

- The QDoc System shall number the approval rounds of each version upwards
  from 1.
- When the QDoc System opens the approval round, the QDoc System shall record
  on the approval round the version number of the version.
- The QDoc System shall hold at most one approval round per version number.
- The QDoc System shall retain each closed approval round with each approval,
  each electronic signature and the decline record recorded in the approval
  round.
- The QDoc System shall show the approval rounds of the version to each user
  who opens the version in the workspace.
- When the QDoc System shows the approval round, the QDoc System shall show
  each approval of each approver on each file in the approval round.
- When the QDoc System shows the closed approval round, the QDoc System shall
  show the outcome of the approval round.
- When the QDoc System shows the approval round with the outcome declined, the
  QDoc System shall show the decline record of the approval round.

## 6. Open issues

| ID | Issue | Affects | Owner | Due |
| --- | --- | --- | --- | --- |
| TBD-01 | The size limit of an attachment. The one-pager asks for a limit and gives no value. | Attach a PDF (N-PREP-08) | product owner | before the rules are baselined |
| TBD-02 | What counts as inappropriate content in an attachment. | Attach a PDF (N-PREP-08) | product owner | before the rules are baselined |
| TBD-04 | The file name of the content file the first version opens with. The Content File Service needs one (N-CFIL-01). | Create a new QDoc (N-PREP-01) | product owner | before the rules are baselined |

## 7. Glossary

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
- **Level**: normal user or quality manager. Each level reads versions in
  force, completes QACKs, and writes, reviews and approves the versions the
  user is named on.
- **Normal user**: the level that sees only the versions the user is named on
  as contributor, reviewer or approver, or is assigned to.
- **Quality manager**: the level that sees each QDoc of the organisation, and
  alone creates QDocs, publishes, changes an effective date and retires. The
  approvers of a version include at least one quality manager.
- **Group**: a named set of users. Its users are its members.

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
  draft iterations above the last approved one. It is 1 when a draft
  version opens and rises by 1 at each return to Draft, reverted or
  declined.
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
- **Version settings**: the contributors, the reviewers, the approvers, the
  recipients, the public flag, the training mode and the quiz of a version.
  The recipients, the public flag, the retraining decision, the training
  mode and the quiz are specified in [QDoc System: implementation
  requirements](qdoc-implementation-requirements.md).
- **Workspace**: the part of the QDoc System where QDocs are prepared,
  reviewed, approved and published. It is apart from the library.

### People on a QDoc

- **Owner**: the user who created the QDoc. The owner writes each version
  with the contributors: each rule on the contributors of the version holds
  for the owner as well. The owner is never named as contributor, reviewer
  or approver of a version of the QDoc.
- **Contributor**: a user invited to write a version with the owner.
- **Reviewer**: a user named on a version to review it.
- **Approver**: a user named on a version to approve it.
- **Recipient**: a user or a group named on a version as having to learn it.
- **Assignee**: a user who has to learn a version: each user named as
  recipient, and each member of each group named as recipient. The version
  is assigned to its assignees.

### Files and what is said about them

- **File**: a content file or an attachment of a version.
- **Content file**: a rich-text file the contributors write, held in the
  Content File Service. A version has at least one.
- **Same content file**: a content file of one version and the copies made
  of it into each later version of the QDoc.
- **Right**: read, comment, edit or resolve on a content file, as the
  Content File Service defines it.
- **Fragment**: as the Content File Service defines it.
- **Attachment**: a PDF added to a version. It is never edited.
- **PDF**: Portable Document Format.
- **Quarantine**: where an uploaded attachment waits, unusable, for its
  scans. Also the first scan status.
- **Scan status**: quarantine, released or failed.
- **Malware scan**, **content scan**: the two checks of an attachment in
  quarantine, for malware and for inappropriate content. Each ends with a
  finding or without one.
- **Inappropriate content**: [TBD-02].
- **Edit**, **change to a content file**, **change history entry**,
  **comment**, **suggestion**, **resolve**, **outcome** of a suggestion: as
  the Content File Service defines them.
- **File revision**: the state of a file after its latest change. A content
  file has the file revision the Content File Service gives it; an
  attachment keeps one file revision.
- **Review mark**: one reviewer's statement on one file revision, of the
  kind reviewed or do not care, given in one review round. An
  acknowledgement, not a verdict. Each rule that names the review mark holds
  for both kinds.
- **Reviewed**: the kind of review mark that says the reviewer checked the
  file.
- **Do not care**: the kind of review mark that says the file lies outside
  the competence of the reviewer. A reviewer holds at least one review mark
  of the kind reviewed among the review marks of a review round.
- **Carried-over review mark**: a review mark of the kind reviewed, given in
  an earlier review round of the same version by a user who is still a
  reviewer of the version, on the file revision the file still has. A review
  mark of the kind do not care never carries over.
- **Reviews of a version**: the review marks of each reviewer on each file
  in the open review round.
- **Review round**: one stay of a version in the status In review, from
  sending for review to reverting or sending for approval, with the version
  number at the start, the review marks, the comments and the suggestions
  recorded in it, and its outcome: reverted or sent for approval. The
  **open review round** is the review round of a version in the status In
  review.
- **Approval**: one approver's authorisation of one file, bound to an
  electronic signature, given in one approval round. It counts only in that
  approval round.
- **Approval round**: one stay of a version in the status In approval, from
  sending for approval to the approval or the decline of the version, with
  the version number at the start, the approvals and the decline record
  recorded in it, and its outcome: approved or declined. The **open approval
  round** is the approval round of a version in the status In approval.
- **Round**: a review round or an approval round.
- **Outcome of a round**: how a round closed, as named in the definitions
  of the review round and the approval round.
- **Review trail**: the review rounds, the approval rounds, the comments,
  the suggestions, the review marks and the approvals of a version.
- **Decline**: an approver's refusal of a version, with a comment.
- **Decline record**: who declined a version, when, and the comment. The
  declined approval round holds it.
- **Electronic signature**: the identity of the user plus the password,
  entered again for the action, with the meaning of the action and the
  time. The **signing user** is the user who gives it; the **password
  check** compares the entered password with the account of that user.

### Distribution

This document names these terms in passing. They, the QACK and the other
terms of distribution and signing are defined in [QDoc System:
implementation requirements](qdoc-implementation-requirements.md).

- **Retraining decision**: yes or no, set per version: whether the users who
  signed the QACK of the earlier effective version get a QACK again.
- **Publication**: the release of an approved version to its recipients,
  with an effective date.

### Logs and messages

- **Audit log**: the system-wide, append-only log of actions.
- **Audit entry**: one line of the audit log: the actor (a user or the
  System), the action, the record and the time.
- **Activity log**: the activity log the Activity Log Service keeps for one
  QDoc as its subject.
- **Activity entry**: one line of an activity log, as the Activity Log
  Service defines it (N-ALOG-01). "System" as its actor means the QDoc System
  acting by itself.
- **Notification**: a message to a user about assigned work or a due date,
  sent through the Notification Service (N-NOTE-01). To **notify** a user is
  to send one.

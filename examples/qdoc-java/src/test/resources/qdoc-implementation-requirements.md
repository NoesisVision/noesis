# QDoc System: implementation requirements (core variant)

- **Document ID:** QDOC-IMPL-REQ
- **Version:** 0.4, 2026-10-23
- **Status:** draft
- **Entity specified:** the QDoc System
- **Size:** 16 use cases, 129 rules
- **Replaces:** QDOC-CORE-REQ 0.3, sections 6 and 7

## 1. Introduction

### 1.1 Purpose

This document is the input for a modelling workshop. It spells out, in the
language of the business, what the QDoc System does with a controlled
document from the approval of a version to the signature of the last
recipient and the retirement of the QDoc. The participants read the rules
and find the model in them: which things must change together, which facts
are computed, which rules guard a transition, who is allowed to do what, and
what happens as a reaction somewhere else.

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
- [QDoc System: preparation requirements](qdoc-preparation-requirements.md):
  the companion document, for the other part of the life of a version.
- [Content File Service](content-files-requirements.md),
  [Notification Service](notifications-requirements.md) and
  [Activity Log Service](activity-log-requirements.md): the platform
  services the QDoc System builds on.

### 1.3 Structure

Two sections follow the life of a version after its approval:
**Distribution** and **Signing**. The life of a version up to its approval,
**Preparation**, **Review** and **Approval**, is specified in [QDoc System:
preparation requirements](qdoc-preparation-requirements.md). Each section
holds use cases. A use case has a name and one sentence saying who needs
what. Under it stands the list of rules the QDoc System keeps while the use
case runs, one statement per rule.

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
  the two sections. Keeping the activity log is specified in the Activity
  Log Service.
- **Delivery of notifications.** A rule says who is told about what. How a
  notification reaches the user is specified in the Notification Service.
- **Reading a content file as such.** How a content file is read is
  specified in the Content File Service (N-CFIL-05). This document says who
  may read it and when.
- **Users and groups.** Creating users, giving levels, managing groups and
  signing in are assumed. Only the reaction to a user joining a group is
  covered.
- **Preparation, review and approval.** How a version is written, reviewed and
  approved up to the status Approved is specified in [QDoc System:
  preparation requirements](qdoc-preparation-requirements.md). The version
  settings this document specifies are changed while the version is in the
  status Draft.
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
  this document are `DIST` and `SIGN`; the use cases of preparation, review
  and approval carry `PREP`, `REVW` and `APPR` in [QDoc System: preparation
  requirements](qdoc-preparation-requirements.md). They are sections of this
  document, not subsystems, and differ on purpose from the subsystem codes
  in [QDoc System: structure](qdoc-system-structure.md). Rules carry no ID;
  a rule is referred to by its use case. Use cases of the platform services
  carry the IDs `N-CFIL-<NN>`, `N-NOTE-<NN>` and `N-ALOG-<NN>`.
- **Rights on content files.** The QDoc System holds the content files of each
  version in the Content File Service and gives users the rights read,
  comment, edit and resolve on them (N-CFIL-04). A rule that gives a right
  holds while its condition holds; when the condition stops holding, the
  QDoc System withdraws the right. The QDoc System gives no right on a
  content file beyond those the rules of this document and of [QDoc System:
  preparation requirements](qdoc-preparation-requirements.md) give.
- **Version lifecycle.** Statements name the statuses of this figure:

  ```text
  Draft → In review → In approval → Approved → Published → Effective → Archived
    ↑____ reverted ____|__ declined __|                                QDoc: retired
    |_____________ sent for approval without review _____↑
  ```

  Each return to Draft, reverted or declined, raises the minor number. Each
  stay in In review is one review round, and each stay in In approval is one
  approval round; a version keeps each of its rounds.

  A QDoc is `active` or `retired`. A QACK is `to sign`, `overdue`, `signed`
  or `closed`.

## 3. Distribution

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
| Read in the library | N-DIST-08 | 9 |
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

The users need to read the versions in force that are assigned to the user,
together with the versions meant for each user.

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
- The QDoc System shall give the right read on each content file of the
  effective version to each user to whom the library shows the effective
  version.
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

## 4. Signing

How a person learns a published version and signs for it: the training the
owner sets, a person's own QACKs, reading the files, the quiz, the signature,
overdue and closed QACKs, and the figures the owner follows.

| Use case | ID | Rules |
| --- | --- | --- |
| Set the training of a version | N-SIGN-01 | 10 |
| Follow one's own QACKs | N-SIGN-02 | 5 |
| Read the files of a QACK | N-SIGN-03 | 5 |
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
- The QDoc System shall give the right read on each content file of the
  version to the holder of each QACK of the version.
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

## 5. Open issues

| ID | Issue | Affects | Owner | Due |
| --- | --- | --- | --- | --- |
| TBD-03 | How many days before the due date the holder of a QACK is told it is due soon. | Chase and close unsigned QACKs (N-SIGN-06) | product owner | before the rules are baselined |

## 6. Glossary

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
- **Status of a version**: Draft, In review, In approval, Approved,
  Published, Effective or Archived, as in the lifecycle figure.
- **First version**: the version opened when a QDoc is created.
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
- **Holder of a QACK**: the user the QACK was created for.

### Files and signatures

- **File**: a content file or an attachment of a version.
- **Content file**: a rich-text file the contributors write, held in the
  Content File Service. A version has at least one.
- **Right**: read, comment, edit or resolve on a content file, as the
  Content File Service defines it.
- **Attachment**: a PDF added to a version. It is never edited.
- **PDF**: Portable Document Format.
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
- **Activity log**: the activity log the Activity Log Service keeps for one
  QDoc as its subject.
- **Activity entry**: one line of an activity log, as the Activity Log
  Service defines it (N-ALOG-01). "System" as its actor means the QDoc System
  acting by itself.
- **Notification**: a message to a user about assigned work or a due date,
  sent through the Notification Service (N-NOTE-01). To **notify** a user is
  to send one.

# UC-10 Trace a QDoc's activity

Each QDoc has an activity list, like the activity tab of an issue tracker:
who created the QDoc, who was assigned, who edited, commented, reviewed and
approved, and when. Actors are people, the QDoc System itself (for example
releasing an attachment after the scan), and in future AI agents. The list
is the evidence an organisation shows an auditor, or a hospital shows in a
patient's dispute. An auditor reads everything and changes nothing.

**Builds on:** UC-1 to UC-9, each of which adds events. Terms: [glossary](#glossary) below.

## Activity event table

The events the activity list records. Each comes from the use case named.

| Event                                                | Use case   |
| ---------------------------------------------------- | ---------- |
| QDoc created                                         | UC-1       |
| User assigned to a version, with the role            | UC-3       |
| Content file added, edited, removed                  | UC-4       |
| Attachment added, released, failed the scan, removed | UC-5       |
| Attachment downloaded, with the user                 | UC-5, UC-7 |
| Version shared                                       | UC-6       |
| Comment added, closed                                | UC-6, UC-7 |
| File marked as reviewed                              | UC-6       |
| File approved                                        | UC-7       |
| Approvals of a content file withdrawn by an edit     | UC-7       |
| Version approved                                     | UC-7       |
| New version created                                  | UC-8       |
| QDoc archived                                        | UC-9       |

## N-ACT-01 Prove how a QDoc was made

> The organisations need to prove to an auditor, or in a dispute, who did what
> to each QDoc and when.

<details>
<summary>Details</summary>

- **Level:** business

</details>

### FR-ACT-001 Record the events

> When an event of the activity event table occurs on a QDoc, the Activity
> subsystem shall add one activity entry to the activity list of the QDoc.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** How many edits one "content file edited" entry groups is
  [TBD-23]; recording each keystroke would bury the other events.
- **Trace:** N-ACT-01, N-ACT-02
- **Verification:** test — running UC-1 to UC-9 on one QDoc yields one
  entry per event in the table.
- **Status:** draft

</details>

### FR-ACT-002 Content of an entry

> The Activity subsystem shall record the following data in each activity
> entry: the event; the actor; the kind of actor; the time; the version
> concerned; the file concerned.

<details>
<summary>Details</summary>

- **Type:** data
- **Level:** subsystem
- **Rationale:** The version and the file are left empty for events on the
  whole QDoc. The kind of actor is user, QDoc System or AI agent.
- **Trace:** N-ACT-01, N-ACT-03
- **Verification:** inspection — each entry of a test run carries each
  field that applies.
- **Status:** draft

</details>

### SR-ACT-001 Entries are permanent

> If a user requests to [change OR delete] an activity entry, the Activity
> subsystem shall reject the request.

<details>
<summary>Details</summary>

- **Type:** security
- **Level:** subsystem
- **Rationale:** Evidence that can be edited proves nothing.
- **Trace:** N-ACT-01
- **Verification:** test — change and deletion requests from a quality
  manager are rejected.
- **Status:** draft

</details>

## N-ACT-02 One place for the history

> The people preparing a QDoc need the history of the QDoc in one place.

<details>
<summary>Details</summary>

- **Level:** stakeholder

</details>

### FR-ACT-003 Show the list

> When a permitted user opens the activity list of a QDoc, the Activity
> subsystem shall show the activity entries of the QDoc in chronological
> order.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** Who is permitted is [TBR-14]: proposed, the quality
  managers, auditors, authors, reviewers and approvers, as for the change
  history.
- **Trace:** N-ACT-02
- **Verification:** test — a reviewer sees the entries of a QDoc in the
  order the events occurred.
- **Status:** draft

</details>

## N-ACT-03 Tell people from machines

> The organisations need to tell the actions of people from the actions of the
> QDoc System and of AI agents.

<details>
<summary>Details</summary>

- **Level:** business

</details>

## N-ACT-04 Inspect without changing

> The auditors need to inspect how each QDoc was prepared without changing
> anything in the QDoc System.

<details>
<summary>Details</summary>

- **Level:** stakeholder

</details>

### FR-ACT-004 Auditor reads

> The QDoc System shall give each auditor read access to each QDoc of the
> organisation, with the versions, files, comments, change histories and
> activity list of the QDoc [TBR-24].

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** system
- **Rationale:** The auditor checks the process, not one document, so the
  auditor sees each QDoc.
- **Trace:** N-ACT-04
- **Verification:** test — an auditor opens a QDoc the auditor has no
  assignment on and reads each listed item.
- **Status:** draft
- **Remarks:** TBR-24 proposes leaving unshared versions out, as
  SR-PRE-006 keeps those private to the authors.

</details>

### SR-ACT-002 Auditor changes nothing

> If an auditor submits a request that changes data of the QDoc System, the
> QDoc System shall reject the request.

<details>
<summary>Details</summary>

- **Type:** security
- **Level:** system
- **Rationale:** An auditor inspects; an auditor's action would itself
  become part of the record under inspection.
- **Trace:** N-ACT-04
- **Verification:** test — a QDoc creation, an assignment, an edit, a
  comment, an approval and an archiving request from an auditor are each
  rejected.
- **Status:** draft
- **Remarks:** Replaces the session's test QDocs created by auditors
  (former N-CRE-02, FR-CRE-011, N-NUM-04, FR-NUM-005, retired).

</details>

## Open issues used here

- **TBR-14**: who sees the activity list.
- **TBR-24**: does an auditor see unshared versions?
- **TBD-23**: grouping of content edits into entries.

## Glossary

Terms used in this file. One name per thing; the term in bold is the only
name a statement may use. A term used in several files has the same
definition in each.

- **Activity entry**: One event in the activity list.
- **Activity list**: The per-QDoc record of events, like the activity tab of
  an issue tracker.
- **Activity subsystem**: Platform. Holds the activity list of each QDoc.
  Area code `ACT`.
- **Actor**: Who caused an event: a user, the QDoc System, or an AI agent.
- **AI**: Artificial intelligence.
- **Approval**: One approver's acceptance of one file.
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
- **Change history**: The record of the edits to one content file within one
  version. Not used: versions of a file.
- **Comment**: A remark attached to a fragment of a content file; open or
  closed.
- **Content file**: A rich-text file the authors write; the body of the
  QDoc. Each version has at least one. Comments and the change history
  attach to content files.
- **Edit**: One saved change to the text of a content file.
- **File**: A content file or an attachment of a version.
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
- **Record of a QDoc**: The versions, files, change histories, comments and
  activity list of the QDoc.
- **Reviewer**: Optional; reads a shared version, comments and marks files
  as reviewed. Blocks nothing. May later be an AI agent.
- **UC-n**: Use case n of this set; one file each.
- **Unshared version**: A new version without the shared mark.
- **User**: A person with an account in the identity provider.
- **Version**: A complete, self-contained edition of a QDoc, numbered
  from 1. Carries the workflow status: new, approved, published, no
  longer in force or archived. Contains files. A QDoc has at least one
  version.

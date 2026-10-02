# QDoc System: structure

The decomposition every QDoc requirements set uses for `Level` and for the
area code in IDs. One system, split into value-stream subsystems that follow
a QDoc from idea to signature, and platform subsystems that serve them.

## System

**QDoc System**: supports organisations in preparing, approving, distributing
and acknowledging quality documents (QDocs), and keeps the record of who did
what and when. Level `system`.

## Subsystems

Level `subsystem`. The code is the area code in the ID of each need and
requirement allocated to the subsystem (`FR-PRE-004`, `N-APR-02`).

### Value-stream subsystems

In the order a QDoc passes through them.

| Code | Subsystem     | Responsible for                                                                                                                                                       |
| ---- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PRE  | Preparation   | Creating and numbering QDocs, versions, assigning people, the files of a version, sharing a version for review, review marks, new versions, archiving                |
| APR  | Approval      | Approvals per file and per approver, the approved status of a version, the hand-over to distribution                                                                  |
| DIS  | Distribution  | Publishing an approved version to the employees who must read it, conversion to PDF                                                                                   |
| ACK  | Acknowledgment | Employees reading and signing a published version                                                                                                                    |

### Platform subsystems

Serve the value-stream subsystems; hold no process of their own.

| Code | Subsystem          | Responsible for                                                                                              |
| ---- | ------------------ | ------------------------------------------------------------------------------------------------------------ |
| NOT  | Notifications      | Telling users about events: new QDocs, new versions, assignments                                             |
| FIL  | File storage       | Attachments: format and size checks, quarantine, malware and content scans, scan status, downloads           |
| CON  | Content management | Content files: rich-text editing, concurrent editing, change history, comments, locking against editing      |
| ACT  | Activity           | The activity list of each QDoc: recording events, showing them, keeping them unchanged                      |
| IDN  | Identity           | Users, roles and account status; replaceable by a directory the organisation runs                            |

## Rules

- **Level.** A requirement allocated to one subsystem is `subsystem`, and
  its statement names that subsystem as the subject ("the Preparation
  subsystem shall …"). A requirement no single subsystem can meet — a rule
  across each subsystem, or a property of the whole record — is `system`,
  with the QDoc System as the subject. Needs stay `business` or
  `stakeholder`.
- **Area.** The area code of a need or requirement is the code of the
  subsystem that meets it; a `system` requirement takes the code of the
  subsystem it concerns most. A requirement moved to another subsystem gets
  a new ID; the old one is retired, never reused.
- **Conditions.** A condition may name another subsystem's event ("When
  the QDoc System creates a QDoc, the Notifications subsystem shall …");
  only the subject is the allocated subsystem.

## Requirements sets

| Set                                                               | Covers                                     |
| ----------------------------------------------------------------- | ------------------------------------------ |
| [QDoc drafting](qdoc-drafting-requirements/)                     | PRE, APR and the platform subsystems they use |
| Publication (not yet written)                                     | DIS, ACK                                   |

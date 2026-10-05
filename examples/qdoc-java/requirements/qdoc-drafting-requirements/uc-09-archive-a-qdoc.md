# UC-9 Archive a QDoc

A QDoc that is no longer used clutters everyday lists. A quality manager
archives the QDoc instead of deleting the QDoc. Archiving is about tidiness,
not process: the QDoc and its whole record stay.

**Builds on:** UC-8. Terms: [glossary](#glossary) below.

## N-PRE-18 Tidy lists without deletion

> The quality managers need to take a QDoc that is out of use off the QDoc
> lists without deleting the QDoc.

<details>
<summary>Details</summary>

- **Level:** stakeholder

</details>

### SR-PRE-009 Quality managers archive

> If a user who lacks the quality manager role requests the archiving of a
> QDoc, the Preparation subsystem shall reject the request [TBR-17].

<details>
<summary>Details</summary>

- **Type:** security
- **Level:** subsystem
- **Rationale:** The session did not name who archives; the quality
  manager runs the lifecycle.
- **Trace:** N-PRE-18
- **Verification:** test — a request from an author is rejected.
- **Status:** draft

</details>

### FR-PRE-042 Versions out of force

> If at least one version of the QDoc has a status other than [archived OR no
> longer in force], the Preparation subsystem shall reject the archiving of
> the QDoc [TBR-16].

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** A QDoc in force, or in preparation, stays active. Whether
  a version in preparation should block archiving is open.
- **Trace:** N-PRE-18
- **Verification:** test — archiving a QDoc with a published version is
  rejected; with each version no longer in force it succeeds.
- **Status:** draft

</details>

### FR-PRE-043 Archive

> When the Preparation subsystem accepts the archiving of a QDoc, the
> Preparation subsystem shall set the status of the QDoc to archived.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** Archived QDocs refuse assignments (FR-PRE-021) and new
  versions (FR-PRE-036).
- **Trace:** N-PRE-18
- **Verification:** test — the QDoc shows the status archived.
- **Status:** draft

</details>

### FR-PRE-044 Off the lists

> The Preparation subsystem shall leave each archived QDoc out of the QDoc
> list.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** The purpose of archiving.
- **Trace:** N-PRE-18
- **Verification:** test — an archived QDoc is missing from the QDoc list
  of a quality manager and of an author.
- **Status:** draft

</details>

### FR-PRE-045 Find archived QDocs

> When a quality manager filters the QDoc list by the status archived, the
> Preparation subsystem shall list each archived QDoc [TBR-25].

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** Archived is out of sight, not lost.
- **Trace:** N-PRE-18
- **Verification:** test — the filter shows the archived QDoc.
- **Status:** draft
- **Remarks:** Not from the session, which said only that archived QDocs
  leave people's lists; proposed so the record of FR-PRE-046 stays
  reachable.

</details>

### FR-PRE-046 Keep the record

> The QDoc System shall retain the record of each archived QDoc.

<details>
<summary>Details</summary>

- **Type:** data
- **Level:** system
- **Rationale:** The record is the evidence the organisation relies on in
  audits and disputes. Retention period and restoring an archived QDoc are
  [TBD-21].
- **Trace:** N-PRE-18
- **Verification:** test — the versions, change histories and activity
  list of an archived QDoc remain readable to a quality manager.
- **Status:** draft

</details>

## Open issues used here

- **TBR-16**: may a QDoc with a version in preparation be archived?
- **TBR-17**: who archives.
- **TBD-21**: retention period; restoring an archived QDoc.
- **TBR-25**: a filter that lists archived QDocs.
- **TBD-26**: who sets a version to no longer in force or archived.

## Glossary

Terms used in this file. One name per thing; the term in bold is the only
name a statement may use. A term used in several files has the same
definition in each.

- **Activity list**: The per-QDoc record of events, like the activity tab of
  an issue tracker.
- **Assignment**: The link between a user, a version and one role on the
  version: author, reviewer or approver.
- **Author**: The only role that edits content files and adds attachments.
  Not used: contributor.
- **Change history**: The record of the edits to one content file within one
  version. Not used: versions of a file.
- **Preparation subsystem**: Value stream. Creates and numbers QDocs and
  versions, assigns people, holds the files of a version, shares versions
  for review, records review marks, archives QDocs. Area code `PRE`.
- **QDoc**: A quality document: a procedure, guideline, instruction, policy
  or similar document the organisation must maintain. A package of files
  that always works as a whole, like a loan agreement with its annexes:
  whoever signs the QDoc signs each file in it. Has a title, a document
  type, a document number and one or more versions. Is either active or
  archived. Not used: quality document, KUDOK, document (alone).
- **QDoc list**: The list of QDocs a user sees on opening the QDoc System.
- **QDoc System**: The system these requirements specify: the subject of
  each `system` requirement. Split into subsystems; see [the
  structure](../qdoc-system-structure.md).
- **Quality manager**: Runs the lifecycle of QDocs in the organisation:
  creates QDocs and versions, assigns people. Writes no content.
- **Record of a QDoc**: The versions, files, change histories, comments and
  activity list of the QDoc.
- **UC-n**: Use case n of this set; one file each.
- **User**: A person with an account in the identity provider.
- **Version**: A complete, self-contained edition of a QDoc, numbered
  from 1. Carries the workflow status: new, approved, published, no
  longer in force or archived. Contains files. A QDoc has at least one
  version.

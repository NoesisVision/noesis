# UC-5 Attach a PDF

An author adds a PDF file to a version as an attachment. The QDoc System
holds the attachment in quarantine and scans the attachment for malware and
inappropriate content. Nobody downloads the attachment until the scans pass.

**Builds on:** UC-4. Terms: [glossary](#glossary) below.

## N-PRE-10 Attach PDF files

> The authors need to add PDF files to a version as attachments.

<details>
<summary>Details</summary>

- **Level:** stakeholder

</details>

### SR-PRE-005 Only authors attach

> If a user other than an author of the version adds an attachment to the
> version, the Preparation subsystem shall reject the attachment.

<details>
<summary>Details</summary>

- **Type:** security
- **Level:** subsystem
- **Rationale:** Attachments are part of the content the authors are
  responsible for.
- **Trace:** N-PRE-10
- **Verification:** test — an attachment from a reviewer is rejected; one
  from an author is accepted.
- **Status:** draft

</details>

### FR-FIL-001 PDF only

> If an uploaded file is in a format other than PDF, the File storage
> subsystem shall reject the upload.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** The session allows PDF attachments only. The format is
  checked from the file content, since a file name proves nothing.
- **Trace:** N-PRE-10, N-FIL-01
- **Verification:** test — a DOCX file renamed to `.pdf` is rejected; a PDF
  file is accepted.
- **Status:** draft

</details>

### FR-FIL-003 Release

> When the scans of an attachment find [no malware AND no inappropriate
> content], the File storage subsystem shall release the attachment from
> quarantine.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** Only a released attachment is downloadable and
  approvable.
- **Trace:** N-PRE-10
- **Verification:** test — a clean PDF reaches the scan status released.
- **Status:** draft

</details>

### FR-PRE-028 Remove an attachment

> When an author of a version with the status new removes an unapproved
> attachment, the Preparation subsystem shall remove the attachment from the
> version.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** Approved attachments stay (FR-PRE-034). A failed
  attachment is removed this way (FR-FIL-004).
- **Trace:** N-PRE-10
- **Verification:** test — an author removes 1 of 2 attachments; the
  version lists 1.
- **Status:** draft

</details>

## N-FIL-01 No malware through uploads

> The vendor of the QDoc System needs attachment uploads to be no attack path
> into the QDoc System.

<details>
<summary>Details</summary>

- **Level:** business

</details>

### SR-FIL-001 Quarantine on upload

> When an author adds an attachment to a version, the File storage subsystem
> shall place the attachment in quarantine.

<details>
<summary>Details</summary>

- **Type:** security
- **Level:** subsystem
- **Rationale:** The attachment is listed in the version at once but stays
  inactive until scanned.
- **Trace:** N-FIL-01, N-FIL-02
- **Verification:** test — a new attachment appears in the version with the
  scan status in quarantine.
- **Status:** draft

</details>

### SR-FIL-002 Malware scan

> When the File storage subsystem places an attachment in quarantine, the File
> storage subsystem shall scan the attachment for malware.

<details>
<summary>Details</summary>

- **Type:** security
- **Level:** subsystem
- **Rationale:** An upload must be no attack path into the QDoc System.
- **Trace:** N-FIL-01
- **Verification:** test — the EICAR test file wrapped in a PDF fails the
  scan.
- **Status:** draft
- **Remarks:** The session expects an existing scanning service, not an own
  scanner; the tool is a design decision.

</details>

### SR-FIL-004 No download in quarantine

> If a user requests the download of an attachment whose scan status differs
> from released, the File storage subsystem shall refuse the download.

<details>
<summary>Details</summary>

- **Type:** security
- **Level:** subsystem
- **Rationale:** Covers quarantined and failed attachments; the refusal
  tells the user the scan is pending or failed.
- **Trace:** N-FIL-01, N-FIL-02
- **Verification:** test — downloads of a quarantined and of a failed
  attachment are refused; a released one is served.
- **Status:** draft

</details>

### FR-FIL-004 Failed scan

> If the scans of an attachment find [malware OR inappropriate content], the
> File storage subsystem shall set the scan status of the attachment to
> failed.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** A failed attachment stays listed with the status failed
  (FR-FIL-005), closed to download and approval, until an author removes it
  (FR-PRE-028). The activity list records the scan outcome (UC-10).
- **Trace:** N-FIL-01, N-FIL-02
- **Verification:** test — an infected PDF reaches the scan status failed.
- **Status:** draft

</details>

## N-FIL-02 No inappropriate content

> The organisations need the attachments free of inappropriate content.

<details>
<summary>Details</summary>

- **Level:** business

</details>

### SR-FIL-003 Content scan

> When the File storage subsystem places an attachment in quarantine, the File
> storage subsystem shall scan the attachment for inappropriate content.

<details>
<summary>Details</summary>

- **Type:** security
- **Level:** subsystem
- **Rationale:** Definition and tool [TBD-08].
- **Trace:** N-FIL-02
- **Verification:** test — a PDF from the agreed set of inappropriate test
  samples fails the scan.
- **Status:** draft

</details>

## N-FIL-03 Know whether an attachment is ready

> The reviewers and approvers need to see whether each attachment is ready to
> download without trying to download the attachment.

<details>
<summary>Details</summary>

- **Level:** stakeholder

</details>

### PR-FIL-001 Scan time

> The File storage subsystem shall finish the scans of each attachment within
> 5 min of the upload for at least [TBR-09] of the attachments uploaded in
> each calendar month.

<details>
<summary>Details</summary>

- **Type:** performance
- **Level:** subsystem
- **Rationale:** The session proposed 5 minutes as the service level "in
  most cases"; reviewers typically get access days later, so a slower scan
  is a rare edge case.
- **Trace:** N-FIL-03
- **Verification:** analysis — scan durations of one month of uploads in
  production.
- **Status:** draft

</details>

### FR-FIL-005 Show the scan status

> The File storage subsystem shall show the scan status of each attachment to
> each user with access to the version of the attachment.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** An approver sees which attachments are ready without
  trying each download; an author sees which attachment failed and removes
  the attachment.
- **Trace:** N-FIL-03
- **Verification:** test — a reviewer sees in quarantine, released and
  failed on 3 attachments in those states.
- **Status:** draft
- **Remarks:** Chosen over removing a failed attachment automatically and
  e-mailing the uploader (TBD-10, closed). Whether the Preparation subsystem
  copies the status from the File storage subsystem or the page shows both side by side is
  a design decision.

</details>

## N-FIL-04 No oversized files

> The organisations need attachment sizes kept within limits that keep the
> process running.

<details>
<summary>Details</summary>

- **Level:** business

</details>

### FR-FIL-002 Size limit

> If an uploaded file exceeds [TBD-07], the File storage subsystem shall
> reject the upload.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** Limits per file and per version are to be researched; the
  QDoc System only offers attachments for download, it never renders them.
- **Trace:** N-FIL-04
- **Verification:** test — a file 1 byte over the limit is rejected; a file
  at the limit is accepted.
- **Status:** draft

</details>

## Open issues used here

- **TBD-07**: size limits.
- **TBD-08**: definition and detection of inappropriate content.
- **TBR-09**: share of scans within 5 min.
- **TBD-10** (closed): a failed attachment shows the status failed; an
  author removes it.

## Glossary

Terms used in this file. One name per thing; the term in bold is the only
name a statement may use. A term used in several files has the same
definition in each.

- **Activity list**: The per-QDoc record of events, like the activity tab of
  an issue tracker.
- **Approval**: One approver's acceptance of one file.
- **Approver**: At least one per shared version; approves each file and
  takes responsibility for the QDoc. Has no way to reject a QDoc.
- **Attachment**: A PDF file added to a version. Never edited; held in
  quarantine until scanned.
- **Author**: The only role that edits content files and adds attachments.
  Not used: contributor.
- **EICAR**: European Institute for Computer Antivirus Research; its test
  file is a harmless file that every malware scanner reports as malware.
- **File**: A content file or an attachment of a version.
- **File storage subsystem**: Platform. Holds attachments: checks,
  quarantine, scans, scan status, downloads. Not used: attachment storage.
  Area code `FIL`.
- **Inappropriate content**: Content the organisation must keep out of the
  QDoc System, for example indecent images; full definition [TBD-08].
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
- **Quarantine**: The state of an attachment from upload to the end of the
  scans: listed in the version, closed to download, closed to approval.
- **Reviewer**: Optional; reads a shared version, comments and marks files
  as reviewed. Blocks nothing. May later be an AI agent.
- **Scan status**: One of in quarantine, released, failed.
- **UC-n**: Use case n of this set; one file each.
- **User**: A person with an account in the identity provider.
- **Version**: A complete, self-contained edition of a QDoc, numbered
  from 1. Carries the workflow status: new, approved, published, no
  longer in force or archived. Contains files. A QDoc has at least one
  version.

# UC-3 Assign people to a version

A quality manager puts authors, reviewers and approvers on a version, at
creation (UC-1) or later. Whatever the client sends, the QDoc System accepts
only active users who hold the role being assigned, and tells each assigned
user.

**Builds on:** UC-1. Terms: [glossary](#glossary) below.

## N-PRE-06 Put people on a version

> The quality managers need to assign people to each role of a version from
> the creation of the QDoc to the approval of the version.

<details>
<summary>Details</summary>

- **Level:** stakeholder

</details>

### SR-PRE-002 Quality managers assign

> If a user who lacks the quality manager role submits an assignment request,
> the Preparation subsystem shall reject the assignment request.

<details>
<summary>Details</summary>

- **Type:** security
- **Level:** subsystem
- **Rationale:** Only the quality manager adds people; whether any quality
  manager or only the QDoc's creator may do so is [TBR-05].
- **Trace:** N-PRE-06
- **Verification:** test — assignment requests from an author, a reviewer
  and an approver are rejected; one from a quality manager is accepted.
- **Status:** draft

</details>

### FR-PRE-021 Archived QDoc

> If the QDoc of the version is archived, the Preparation subsystem shall
> reject the assignment request.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** An archived QDoc is out of use (UC-9).
- **Trace:** N-PRE-06
- **Verification:** test — an assignment request on a version of an
  archived QDoc is rejected.
- **Status:** draft

</details>

### FR-PRE-022 Assign while new

> While a version has the status new, the Preparation subsystem shall accept
> assignment requests for each of the roles author, reviewer, approver on the
> version.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** People may be added from creation until approval;
  reviewers and approvers are typically added before sharing (UC-6).
- **Trace:** N-PRE-06
- **Verification:** test — on a new version, an assignment for each role is
  accepted; on an approved version, each is rejected.
- **Status:** draft

</details>

### FR-PRE-023 Several people per role

> The Preparation subsystem shall accept more than one assigned user per role
> on each version.

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** A QDoc may have several authors, reviewers or approvers.
- **Trace:** N-PRE-06
- **Verification:** test — 3 authors, 2 reviewers and 2 approvers on one
  version are each recorded.
- **Status:** draft

</details>

## N-PRE-07 Trustworthy assignments

> The organisations need each assignment to name an active user who holds the
> assigned role, even when the request was crafted outside the user interface.

<details>
<summary>Details</summary>

- **Level:** business

</details>

### SR-PRE-003 Assignee holds the role

> If the user named in an assignment request lacks the assigned role at the
> moment of the assignment request, the Preparation subsystem shall reject the
> assignment request.

<details>
<summary>Details</summary>

- **Type:** security
- **Level:** subsystem
- **Rationale:** Filtering in the user interface guarantees nothing; the
  check runs on the server, against the identity provider, at the moment of
  assignment.
- **Trace:** N-PRE-07
- **Verification:** test — a request crafted with the identifier of a user
  without the author role is rejected for the author role.
- **Status:** draft
- **Remarks:** The mechanism — asking the identity module, a local copy of
  users, or an invitation the assignee accepts — is TBD-06; each must meet
  this requirement. With invitations, the check runs when the invitation is
  accepted, and a refused acceptance needs no polished message: it means
  tampering or a role revoked meanwhile.

</details>

### SR-PRE-004 Assignee is active

> If the user named in an assignment request is an inactive user at the moment
> of the assignment request, the Preparation subsystem shall reject the
> assignment request.

<details>
<summary>Details</summary>

- **Type:** security
- **Level:** subsystem
- **Rationale:** A blocked or inactive account must never gain access to a
  QDoc. Mechanism as in SR-PRE-003.
- **Trace:** N-PRE-07
- **Verification:** test — a request naming a blocked user and one naming
  an inactive user are each rejected.
- **Status:** draft

</details>

## N-NOT-02 Know about the assignment

> The assigned users need to learn that the assigned users were put on a
> version.

<details>
<summary>Details</summary>

- **Level:** stakeholder

</details>

### FR-NOT-002 Notify the assignee

> When the QDoc System records an assignment, the Notifications subsystem
> shall notify the assigned user within [TBD-01].

<details>
<summary>Details</summary>

- **Type:** functional
- **Level:** subsystem
- **Rationale:** The assignee learns of the work.
- **Trace:** N-NOT-02
- **Verification:** test — the assigned user receives one notification
  naming the QDoc, the version and the role.
- **Status:** draft

</details>

## N-IDN-01 Own identity provider

> The organisations that run the QDoc System on the organisation's own
> premises need the QDoc System to use the directory of users the organisation
> already runs.

<details>
<summary>Details</summary>

- **Level:** business

</details>

### CR-IDN-001 Replaceable identity provider

> The QDoc System shall pass each request for identity data through the
> identity provider interface.

<details>
<summary>Details</summary>

- **Type:** constraint
- **Level:** system
- **Rationale:** Constrains the design: each subsystem stays independent of
  where identity data lives, so an on-premise installation can swap the
  Identity subsystem for the organisation's directory.
- **Trace:** N-IDN-01
- **Verification:** inspection — no subsystem other than the Identity
  subsystem depends on identity data except through the interface;
  demonstration — the Preparation subsystem runs against a second identity
  provider.
- **Status:** draft

</details>

## Open issues used here

- **TBD-01**: channel and maximum delay of notifications.
- **TBR-05**: any quality manager, or only the QDoc's creator?
- **TBD-06**: how an assignment is checked.
- **TBD-20**: removing a person from a version.

## Glossary

Terms used in this file. One name per thing; the term in bold is the only
name a statement may use. A term used in several files has the same
definition in each.

- **Active user**: A user whose account is neither blocked nor inactive in
  the identity provider.
- **Approval**: One approver's acceptance of one file.
- **Approver**: At least one per shared version; approves each file and
  takes responsibility for the QDoc. Has no way to reject a QDoc.
- **Assignment**: The link between a user, a version and one role on the
  version: author, reviewer or approver.
- **Assignment request**: A request to the QDoc System to create an
  assignment.
- **Author**: The only role that edits content files and adds attachments.
  Not used: contributor.
- **Identity data**: Users, the roles of the users, the account status of
  the users.
- **Identity provider**: The source of users, roles and account status: the
  Identity subsystem, or a directory the organisation runs in its place.
- **Identity provider interface**: The one boundary through which each
  subsystem of the QDoc System learns about users, roles and account status.
- **Identity subsystem**: Platform. Holds users, roles and account status;
  the default identity provider. Area code `IDN`.
- **Notifications subsystem**: Platform. Tells users about events. Area code
  `NOT`.
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
- **Reviewer**: Optional; reads a shared version, comments and marks files
  as reviewed. Blocks nothing. May later be an AI agent.
- **UC-n**: Use case n of this set; one file each.
- **User**: A person with an account in the identity provider.
- **Version**: A complete, self-contained edition of a QDoc, numbered
  from 1. Carries the workflow status: new, approved, published, no
  longer in force or archived. Contains files. A QDoc has at least one
  version.

Feature: Creating a QDoc
  A quality manager creates a QDoc in the Preparation subsystem
  (qdoc-preparation-requirements.md, UC-1).

  Background:
    Given a quality manager

  @validation
  Rule: A title is never blank
    A QDoc title holds at least one character other than whitespace; a blank
    title cannot be created.

    Scenario: Blank title
      When the quality manager submits a QDoc creation request whose title is only spaces
      Then the request is rejected and no QDoc is created

  @validation
  Rule: A document type comes from the list of document types
    A document type is one of procedure, guideline, instruction and policy
    (FR-PRE-002). Adding a type to the list is a change to this list, not to
    any QDoc.

    Scenario Outline: Each listed type is accepted
      When the quality manager submits a valid QDoc creation request for the document type <type>
      Then the request is accepted and the QDoc carries the document type <type>

      Examples:
        | type        |
        | procedure   |
        | guideline   |
        | instruction |
        | policy      |

    Scenario: A type outside the list is rejected
      When the quality manager submits a creation request with the document type 'memo'
      Then the request is rejected and no QDoc is created

  @validation
  Rule: A creation request names a title, a document type and at least one author
    A QDoc creation request that lacks the title, the document type or at
    least one author is rejected (FR-PRE-001). Reviewers and approvers are
    optional.

    Scenario: No title
      When the quality manager submits a creation request without a title
      Then the request is rejected and no QDoc is created

    Scenario: No document type
      When the quality manager submits a creation request without a document type
      Then the request is rejected and no QDoc is created

    Scenario: No author
      When the quality manager submits a creation request naming no author
      Then the request is rejected and no QDoc is created

    Scenario: All mandatory data
      When the quality manager submits a creation request with a title, the document type procedure and one author, and no reviewer or approver
      Then the request is accepted and the QDoc is created

  @validation
  Rule: A QDoc keeps at least one version
    Every QDoc holds at least one version at all times (FR-PRE-010); no
    operation leaves a QDoc with zero versions.

    Scenario: Creation yields a version
      When a QDoc is created from a valid request
      Then the QDoc holds one version

  @state_change
  Rule: Only quality managers create QDocs
    A QDoc creation request from a user who lacks the quality manager role is
    rejected (SR-PRE-001). Authors, reviewers, approvers and auditors create
    nothing. The requester's roles are those held at the moment of the
    request.

    Scenario Outline: Non-quality-managers are rejected
      Given a user holding only the <role> role
      When that user submits a valid QDoc creation request
      Then the request is rejected and no QDoc is created

      Examples:
        | role     |
        | author   |
        | reviewer |
        | approver |
        | auditor  |

    Scenario: A quality manager is accepted
      When the quality manager submits a valid QDoc creation request
      Then the QDoc is created

    Scenario: Creating a procedure
      Given 2 more quality managers
      When the quality manager creates the procedure 'Supplier audit' with one author and two reviewers
      Then an active QDoc with a document number exists, its version 1 has the status new, one empty content file, the author and the two reviewers, QDocCreated is published and each of the 3 quality managers is notified of the new QDoc

  @validation
  Rule: A new QDoc carries a document number
    Every QDoc gets its document number when it is created (FR-PRE-009), from
    the DocumentNumberGenerator; the format is defined by UC-2.

    Scenario: Number at creation
      When the quality manager submits a valid QDoc creation request
      Then the new QDoc carries a document number

  @validation
  Rule: A QDoc is saved and announced together
    The new QDoc is saved and QDocCreated is published in the same unit of
    work: either both happen or neither does. A rejected request creates
    nothing and publishes nothing.

    Scenario: An invalid request leaves no trace
      When the quality manager submits a QDoc creation request that names no author
      Then the request is rejected, no QDoc is saved and no QDocCreated is published

  @state_change
  Rule: Each quality manager learns of a new QDoc
    When a QDoc is created, the Preparation subsystem asks the Notifications
    subsystem to notify each quality manager of the organisation, naming the
    QDoc, its number and its creator (FR-NOT-001). The quality managers are
    those holding the role at the moment the QDoc is created.

    Scenario: Three quality managers notified
      Given 2 more quality managers
      When the quality manager submits a valid QDoc creation request
      Then each of the 3 quality managers receives a notification naming the QDoc, its document number and its creator

    Scenario: A rejected request notifies nobody
      Given 2 more quality managers
      When the quality manager submits a QDoc creation request that names no author
      Then the request is rejected and no quality manager is notified

  @state_change
  Rule: A new QDoc is active
    A QDoc starts with the status active (FR-PRE-003).

    Scenario: New QDoc listed as active
      When a QDoc is created from a valid request
      Then the QDoc is listed with the status active

  @state_change
  Rule: Version 1 starts with the status new
    Creating a QDoc creates its version 1, with the status new (FR-PRE-004).

    Scenario: One version, numbered 1, new
      When version 1 is created for a valid request
      Then version 1 is numbered 1, with the status new

  @validation
  Rule: Version 1 holds one empty content file
    Version 1 is created with exactly one content file holding no text, and
    no attachment (FR-PRE-005).

    Scenario: Empty content file
      When version 1 is created for a valid request
      Then version 1 holds one content file with no text and no attachment

  @validation
  Rule: The named authors are assigned to version 1
    Each author named in the creation request is assigned to version 1 as
    author (FR-PRE-006).

    Scenario: Authors assigned
      Given a creation request naming two authors
      When version 1 is created for the request
      Then both appear as authors of version 1

  @validation
  Rule: The named reviewers are assigned to version 1
    Each reviewer named in the creation request is assigned to version 1 as
    reviewer (FR-PRE-007).

    Scenario: Two reviewers
      Given a creation request naming two reviewers
      When version 1 is created for the request
      Then version 1 has the two reviewers

    Scenario: No reviewer
      Given a creation request naming no reviewer
      When version 1 is created for the request
      Then version 1 has no reviewer

  @validation
  Rule: The named approvers are assigned to version 1
    Each approver named in the creation request is assigned to version 1 as
    approver (FR-PRE-008).

    Scenario: Two approvers
      Given a creation request naming two approvers
      When version 1 is created for the request
      Then version 1 has the two approvers

    Scenario: No approver
      Given a creation request naming no approver
      When version 1 is created for the request
      Then version 1 has no approver

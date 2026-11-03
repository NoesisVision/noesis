Feature: Creating a QDoc
  A quality manager creates a QDoc in the Preparation subsystem
  (qdoc-preparation-requirements.md, UC-1).

  Background:
    Given a quality manager

  @validation
  Rule: Only quality managers create QDocs
    A QDoc creation request from a user who lacks the quality manager role is
    rejected (SR-PRE-001).

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

  @validation
  Rule: A title is never blank
    A QDoc title holds at least one character other than whitespace; a blank
    title cannot be created.

    Scenario: Blank title
      When the quality manager submits a QDoc creation request whose title is only spaces
      Then the request is rejected and no QDoc is created

  @validation
  Rule: A creation request names a title, a document type and at least one author
    A QDoc creation request that lacks the title, the document type or at
    least one author is rejected (FR-PRE-001). Reviewers and approvers are
    optional.

    Scenario: No author
      When the quality manager submits a QDoc creation request naming no author
      Then the request is rejected and no QDoc is created

    Scenario: All mandatory data
      When the quality manager submits a valid QDoc creation request
      Then the QDoc is created

  @post
  Rule: A new QDoc carries a document number
    Every QDoc gets its document number when it is created (FR-PRE-009).

    Scenario: Number at creation
      When the quality manager submits a valid QDoc creation request
      Then the new QDoc carries a document number

  @state_change
  Rule: A new QDoc is active
    A QDoc starts with the status active (FR-PRE-003).

    Scenario: New QDoc listed as active
      When the quality manager submits a valid QDoc creation request
      Then the QDoc has the status active

  @state_change
  Rule: Version 1 starts with the status new
    Creating a QDoc creates its version 1, with the status new (FR-PRE-004).

    Scenario: One version, numbered 1, new
      When the quality manager submits a valid QDoc creation request
      Then the QDoc has exactly one version, numbered 1, with the status new

  @coordination
  Rule: Each quality manager learns of a new QDoc
    When a QDoc is created, the Preparation subsystem asks the Notifications
    subsystem to notify each quality manager of the organisation.

    Scenario: Three quality managers notified
      Given 2 more quality managers
      When the quality manager submits a valid QDoc creation request
      Then each of the 3 quality managers is notified of the new QDoc

    Scenario: A rejected request notifies nobody
      Given 2 more quality managers
      When the quality manager submits a QDoc creation request naming no author
      Then no quality manager is notified

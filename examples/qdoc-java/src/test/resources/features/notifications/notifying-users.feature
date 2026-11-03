Feature: Notifying users
  Another subsystem asks the Notifications subsystem to tell users something
  (notifications-requirements.md).

  Background:
    Given a request naming 3 recipients, a subject and a body

  @post
  Rule: Each named recipient receives the notification
    When a subsystem asks the Notifications subsystem to notify users, each
    recipient the request names receives one notification carrying the
    subject and the body of the request.

    Scenario: Three recipients notified
      When a subsystem asks the Notifications subsystem to notify them
      Then each of the 3 receives one notification with that subject and that body

  @post
  Rule: A failed delivery stops no other
    When delivering the notification to one recipient fails, the
    notifications to the other recipients are still sent.

    Scenario: One delivery fails
      Given delivery to one of them fails
      When a subsystem asks the Notifications subsystem to notify them
      Then the other 2 recipients each receive the notification

# Notification Service: detailed requirements

- **Document ID:** NOTE-REQ
- **Version:** 0.1, 2026-10-23
- **Status:** draft
- **Entity specified:** the Notification Service
- **Size:** 2 use cases, 10 rules

## 1. Introduction

### 1.1 Purpose

The Notification Service tells users about something that needs their
attention. Each notification appears in the action list of the user and is
sent to the user by e-mail.

The service is a platform service. It does not know what a notification is
about. The systems that send notifications, the clients, decide whom to tell,
what to say and when. Each rule has the Notification Service as its subject.

### 1.2 Structure

Section 3 holds the use cases. A use case has a name and one sentence saying
who needs what. Under it stands the list of rules the Notification Service
keeps while the use case runs, one statement per rule.

### 1.3 Out of scope

- **Wording** of notifications and of e-mails.
- **Timing and retries** of e-mail delivery.
- **Preferences** of users, such as turning e-mail off, and channels other
  than the action list and e-mail.
- **Users and organisations.** Creating users, their e-mail addresses and
  signing in are assumed.

## 2. Conventions

- **Modal verbs:** `shall` states a binding rule. Other modal verbs are not
  used in statements.
- **Statement patterns:** `When <event>, the Notification Service shall …`
  for a reaction; `If <unwanted event>, the Notification Service shall
  reject …` for a check; `The Notification Service shall …` for something
  that holds at each moment.
- **Logic:** conditions and lists of alternatives are combined as
  `[A AND B]` and `[A OR B]`, in capitals inside brackets. "Outside
  `[A OR B]`" means neither A nor B.
- **IDs:** each use case has the ID `N-NOTE-<NN>`. Rules carry no ID; a rule
  is referred to by its use case.

## 3. Use cases

| Use case | ID | Rules |
| --- | --- | --- |
| Notify a user | N-NOTE-01 | 7 |
| See one's action list | N-NOTE-02 | 3 |

### N-NOTE-01 Notify a user

The clients need to tell one user about something that needs the user's
attention.

- If the notification lacks the addressee, the Notification Service shall
  reject the notification.
- If the addressee of the notification is outside the users of the
  organisation of the client, the Notification Service shall reject the
  notification.
- If the notification lacks the text, the Notification Service shall reject
  the notification.
- When the Notification Service accepts the notification, the Notification
  Service shall place the notification in the action list of the addressee.
- When the Notification Service accepts the notification, the Notification
  Service shall send the notification by e-mail to the e-mail address of the
  addressee.
- When the Notification Service accepts the notification, the Notification
  Service shall record on the notification the client, the addressee, the
  text, the link and the time.
- The Notification Service shall deliver each accepted notification once, to
  the addressee alone.

### N-NOTE-02 See one's action list

Each user needs to see each notification the user received, and reach what
it is about.

- The Notification Service shall list to each user each notification of the
  user, the latest first.
- If the user who requests the action list differs from the addressee of the
  action list, the Notification Service shall reject the request.
- When the user opens the notification that holds the link, the Notification
  Service shall lead the user to the link.

## 4. Open issues

| ID | Issue | Affects | Owner | Due |
| --- | --- | --- | --- | --- |
| NOTE-TBD-01 | Whether a user marks a notification as done, and whether a done notification leaves the action list. | See one's action list (N-NOTE-02) | product owner | before the rules are baselined |
| NOTE-TBD-02 | Whether a client can withdraw a notification that no longer applies. | Notify a user (N-NOTE-01) | product owner | before the rules are baselined |

## 5. Glossary

The name in bold is the only name the statements use.

- **Notification Service**: the service this document specifies.
- **Organisation**: the tenant: the one body whose users the service keeps
  apart from those of each other tenant.
- **User**: a person with an account in the organisation, with one e-mail
  address.
- **Client**: a system that sends notifications through the Notification
  Service.
- **Notification**: a message to one user: a text and, optionally, a link
  to what the message is about. To **notify** a user is to send one.
- **Addressee**: the user a notification is for.
- **Action list**: the list of the notifications of one user, shown to that
  user alone.
- **Link**: the address of the place where the addressee acts on the
  notification.

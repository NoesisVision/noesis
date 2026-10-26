# Activity Log Service: detailed requirements

- **Document ID:** ALOG-REQ
- **Version:** 0.1, 2026-10-23
- **Status:** draft
- **Entity specified:** the Activity Log Service
- **Size:** 3 use cases, 14 rules

## 1. Introduction

### 1.1 Purpose

The Activity Log Service keeps, for each subject a client names, the
append-only list of changes made to the properties of that subject: which
property changed, from which value to which value, who changed it and when.

The service is a platform service. It does not know what a subject is or
what its properties mean. The systems that write the logs, the clients,
decide what a subject is, which properties to log and who may see a log.
Each rule has the Activity Log Service as its subject.

### 1.2 Structure

Section 3 holds the use cases. A use case has a name and one sentence saying
who needs what. Under it stands the list of rules the Activity Log Service
keeps while the use case runs, one statement per rule.

### 1.3 Out of scope

- **Showing a log to users.** The client reads the log and decides whom to
  show it to.
- **Search and reporting** across the logs of many subjects.
- **Retention periods** and archiving.

## 2. Conventions

- **Modal verbs:** `shall` states a binding rule. Other modal verbs are not
  used in statements.
- **Statement patterns:** `When <event>, the Activity Log Service shall …`
  for a reaction; `If <unwanted event>, the Activity Log Service shall
  reject …` for a check; `The Activity Log Service shall …` for something
  that holds at each moment.
- **Logic:** conditions and lists of alternatives are combined as
  `[A AND B]` and `[A OR B]`, in capitals inside brackets. "Outside
  `[A OR B]`" means neither A nor B.
- **IDs:** each use case has the ID `N-ALOG-<NN>`. Rules carry no ID; a rule
  is referred to by its use case.

## 3. Use cases

| Use case | ID | Rules |
| --- | --- | --- |
| Add an activity entry | N-ALOG-01 | 7 |
| Keep an activity log | N-ALOG-02 | 4 |
| Read an activity log | N-ALOG-03 | 3 |

### N-ALOG-01 Add an activity entry

The clients need to record each change to a property of a subject the moment
the change is made.

- If the activity entry lacks the subject, the Activity Log Service shall
  reject the activity entry.
- If the activity entry lacks the property, the Activity Log Service shall
  reject the activity entry.
- If the activity entry lacks [the actor OR the time of the change], the
  Activity Log Service shall reject the activity entry.
- The Activity Log Service shall accept the activity entry with an empty
  previous value or an empty new value.
- When the Activity Log Service accepts the first activity entry for the
  subject, the Activity Log Service shall open the activity log of the
  subject with the client that added the entry as the client of the activity
  log.
- If the client that adds the activity entry to the activity log differs
  from the client of the activity log, the Activity Log Service shall reject
  the activity entry.
- When the Activity Log Service accepts the activity entry, the Activity Log
  Service shall append the activity entry to the activity log of the
  subject.

### N-ALOG-02 Keep an activity log

The clients need each activity log to stay as it was written, as the record
of who changed what and when.

- If the Activity Log Service receives the request to change the activity
  entry, the Activity Log Service shall reject the request.
- If the Activity Log Service receives the request to delete the activity
  entry, the Activity Log Service shall reject the request.
- The Activity Log Service shall retain each activity entry of each activity
  log.
- The Activity Log Service shall keep the activity entries of each activity
  log in the order of the time of the change.

### N-ALOG-03 Read an activity log

The clients need to read the activity log of each subject they log, to show
it to the users they choose.

- When the client requests the activity log of the subject, the Activity Log
  Service shall give the client each activity entry of the activity log in
  the order of the time of the change.
- When the client requests the activity log of the subject for one property,
  the Activity Log Service shall give the client only the activity entries
  for that property.
- If the client that requests the activity log differs from the client of
  the activity log, the Activity Log Service shall reject the request.

## 4. Open issues

None.

## 5. Glossary

The name in bold is the only name the statements use.

- **Activity Log Service**: the service this document specifies.
- **Client**: a system that writes activity logs in the Activity Log
  Service. The **client of an activity log** is the client that added its
  first activity entry.
- **Subject**: anything a client keeps an activity log for, named by the
  client with an identifier of its own.
- **Property**: a named attribute of a subject, named by the client.
- **Activity log**: the append-only list of the activity entries of one
  subject.
- **Activity entry**: one line of an activity log: the property, the
  previous value, the new value, the actor and the time of the change.
- **Actor**: the user who made the change, or the client acting by itself,
  shown as "System".

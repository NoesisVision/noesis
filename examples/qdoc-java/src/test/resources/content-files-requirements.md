# Content File Service: detailed requirements

- **Document ID:** CFIL-REQ
- **Version:** 0.1, 2026-10-23
- **Status:** draft
- **Entity specified:** the Content File Service
- **Size:** 11 use cases, 53 rules

## 1. Introduction

### 1.1 Purpose

The Content File Service holds rich-text files that users write together. It
lets users read and edit the text, comment on fragments of it, suggest new
wording, and accept or discard suggestions. It keeps the history of each
change and gives each file a new file revision after each change.

The service is a platform service. It does not know what a file is used for.
The systems that keep files in it, the clients, decide which user holds
which right on which file, and learn from the service what happened in their
files. Each rule has the Content File Service as its subject.

### 1.2 Structure

Section 3 holds the use cases. A use case has a name and one sentence saying
who needs what. Under it stands the list of rules the Content File Service
keeps while the use case runs, one statement per rule.

### 1.3 Out of scope

- **The editor.** Layout, formatting, styles, tables, images and the way an
  editor shows comments and suggestions.
- **Export and print** of a content file.
- **Storage**, backup and retention periods.
- **Users and organisations.** Creating users and signing in are assumed.

## 2. Conventions

- **Modal verbs:** `shall` states a binding rule. Other modal verbs are not
  used in statements.
- **Statement patterns:** `When <event>, the Content File Service shall …`
  for a reaction; `If <unwanted event>, the Content File Service shall
  reject …` for a check; `While <state>, the Content File Service shall …`
  for something that holds during a state; `The Content File Service shall
  …` for something that holds at each moment.
- **Logic:** conditions and lists of alternatives are combined as
  `[A AND B]` and `[A OR B]`, in capitals inside brackets. "Outside
  `[A OR B]`" means neither A nor B.
- **IDs:** each use case has the ID `N-CFIL-<NN>`. Rules carry no ID; a rule
  is referred to by its use case.
- **Statuses:** a suggestion is `open`, `accepted` or `discarded`.

## 3. Use cases

| Use case | ID | Rules |
| --- | --- | --- |
| Create a content file | N-CFIL-01 | 5 |
| Copy a content file | N-CFIL-02 | 6 |
| Delete a content file | N-CFIL-03 | 4 |
| Set the rights on a content file | N-CFIL-04 | 6 |
| Read a content file | N-CFIL-05 | 4 |
| Edit a content file | N-CFIL-06 | 6 |
| Comment on a content file | N-CFIL-07 | 4 |
| Suggest an edit | N-CFIL-08 | 5 |
| Resolve a suggestion | N-CFIL-09 | 5 |
| Compare two content files | N-CFIL-10 | 3 |
| Follow what happens to a content file | N-CFIL-11 | 5 |

### N-CFIL-01 Create a content file

The clients need to start each new content file from the file name alone.

- If the request to create the content file lacks the file name, the Content
  File Service shall reject the request to create the content file.
- When the Content File Service creates the content file, the Content File
  Service shall give the content file empty text.
- When the Content File Service creates the content file, the Content File
  Service shall give the content file the first file revision.
- When the Content File Service creates the content file, the Content File
  Service shall record the client that submitted the request as the client
  of the content file.
- When the Content File Service creates the content file, the Content File
  Service shall give no user a right on the content file.

### N-CFIL-02 Copy a content file

The clients need to start a content file from the text of an existing one.

- If the client that submits the request to copy the content file differs
  from the client of the content file, the Content File Service shall reject
  the request to copy the content file.
- When the Content File Service copies the content file, the Content File
  Service shall give the copy the text of the latest file revision of the
  content file.
- When the Content File Service copies the content file, the Content File
  Service shall give the copy the first file revision.
- When the Content File Service copies the content file, the Content File
  Service shall open the copy with zero comments, zero suggestions and an
  empty change history.
- When the Content File Service copies the content file, the Content File
  Service shall give no user a right on the copy.
- When the Content File Service copies the content file, the Content File
  Service shall keep the content file unchanged.

### N-CFIL-03 Delete a content file

The clients need to give up each content file they no longer hold.

- If the client that submits the request to delete the content file differs
  from the client of the content file, the Content File Service shall reject
  the request to delete the content file.
- When the Content File Service deletes the content file, the Content File
  Service shall reject each later request on the content file.
- When the Content File Service deletes the content file, the Content File
  Service shall keep each copy of the content file.
- The Content File Service shall retain each content file with its change
  history, its comments and its suggestions until the client of the content
  file deletes the content file.

### N-CFIL-04 Set the rights on a content file

The clients need to decide which user may read, comment on, edit and resolve
the suggestions of each content file they hold.

- If the client that submits the change of the rights on the content file
  differs from the client of the content file, the Content File Service shall
  reject the change of the rights.
- If the right named in the change of the rights is outside [read OR comment
  OR edit OR resolve], the Content File Service shall reject the change of
  the rights.
- When the Content File Service gives the user the right [comment OR edit OR
  resolve] on the content file, the Content File Service shall give the user
  the right read on the content file.
- When the client gives the right read on the content file to each user, the
  Content File Service shall let each user of the organisation of the client
  read the content file.
- When the Content File Service withdraws the right from the user, the
  Content File Service shall reject each later request of the user that needs
  the right.
- When the Content File Service changes the rights on the content file, the
  Content File Service shall keep the text, the comments and the suggestions
  of the content file unchanged.

### N-CFIL-05 Read a content file

The users need to read each content file they hold the right read on, with
what others said about it.

- If the user who requests the content file lacks the right read on the
  content file, the Content File Service shall reject the request.
- When the user opens the content file, the Content File Service shall show
  the text of the latest file revision.
- When the user opens the content file, the Content File Service shall show
  each comment on the content file with its author and its time.
- When the user opens the content file, the Content File Service shall show
  each open suggestion on the content file with its author and its time.

### N-CFIL-06 Edit a content file

The users need to write each content file together.

- If the user who submits the edit to the content file lacks the right edit on
  the content file, the Content File Service shall reject the edit.
- While at least two users edit one content file at the same time, the
  Content File Service shall keep each edit submitted by each user.
- If the edit to the content file targets the fragment that holds one open
  suggestion, the Content File Service shall reject the edit.
- When the Content File Service accepts the change to the content file, the
  Content File Service shall add the change history entry to the content
  file.
- When the Content File Service accepts the change to the content file, the
  Content File Service shall give the content file the next file revision.
- When the Content File Service accepts the change to one content file, the
  Content File Service shall keep the file revision of each other content
  file.

### N-CFIL-07 Comment on a content file

The users need to leave remarks for each other on fragments of each content
file.

- If the user who submits the comment on the content file lacks the right
  comment on the content file, the Content File Service shall reject the
  comment.
- When the Content File Service accepts the comment, the Content File Service
  shall attach the comment to the fragment named in the comment.
- When the Content File Service accepts the reply to the comment, the Content
  File Service shall attach the reply to the comment.
- When the Content File Service accepts the comment, the Content File Service
  shall record on the comment the author and the time.

### N-CFIL-08 Suggest an edit

The users need to propose new wording for one fragment without changing the
text.

- If the user who submits the suggestion on the content file lacks the right
  comment on the content file, the Content File Service shall reject the
  suggestion.
- If the text proposed by the suggestion equals the text of the fragment, the
  Content File Service shall reject the suggestion.
- If the fragment named by the suggestion holds one open suggestion, the
  Content File Service shall reject the suggestion.
- When the Content File Service accepts the suggestion, the Content File
  Service shall record the suggestion in the status open with the author and
  the time.
- When the Content File Service accepts the suggestion, the Content File
  Service shall keep the text of the content file unchanged.

### N-CFIL-09 Resolve a suggestion

The users need to settle each suggestion by one decision: accept it or
discard it.

- If the user who submits the resolution of the suggestion lacks the right
  resolve on the content file, the Content File Service shall reject the
  resolution.
- If the Content File Service receives the resolution of the suggestion in
  the status outside open, the Content File Service shall reject the
  resolution.
- When the user accepts the suggestion, the Content File Service shall
  replace the text of the fragment with the text proposed by the suggestion.
- When the user discards the suggestion, the Content File Service shall keep
  the text of the fragment unchanged.
- When the user resolves the suggestion, the Content File Service shall
  record on the suggestion the outcome with the user who resolved the
  suggestion and the time.

### N-CFIL-10 Compare two content files

The users need to see what changed between two content files, such as a
content file and its copy.

- If the user who requests the comparison lacks the right read on [the one
  content file OR the other content file], the Content File Service shall
  reject the comparison.
- When the user requests the comparison of two content files, the Content
  File Service shall mark each text addition between the two content files.
- When the user requests the comparison of two content files, the Content
  File Service shall mark each text removal between the two content files.

### N-CFIL-11 Follow what happens to a content file

The clients need to learn what happens in each content file they hold, so
that they can act on it in their own terms.

- When the Content File Service accepts [the change OR the comment OR the
  suggestion OR the resolution of the suggestion] on the content file, the
  Content File Service shall report it to the client of the content file
  with the content file, the user, the time and the file revision.
- The Content File Service shall give the client of the content file the
  number of open suggestions on the content file.
- The Content File Service shall give the client of the content file each
  comment and each suggestion on the content file made within the period the
  client names.
- The Content File Service shall retain each comment and each suggestion with
  its author, its time, its status and its outcome, also after the
  suggestion is resolved.
- If the client that requests what happened to the content file differs from
  the client of the content file, the Content File Service shall reject the
  request.

## 4. Open issues

| ID | Issue | Affects | Owner | Due |
| --- | --- | --- | --- | --- |
| CFIL-TBD-01 | Whether the author of a comment or a reply can change or delete it. | Comment on a content file (N-CFIL-07) | product owner | before the rules are baselined |
| CFIL-TBD-02 | Whether a user other than the author can close a comment as done, as editors usually allow. | Comment on a content file (N-CFIL-07) | product owner | before the rules are baselined |

## 5. Glossary

The name in bold is the only name the statements use.

- **Content File Service**: the service this document specifies.
- **Organisation**: the tenant: the one body whose users and files the
  service keeps apart from those of each other tenant.
- **User**: a person with an account in the organisation.
- **Client**: a system that keeps content files in the Content File Service.
  The **client of a content file** is the client that created it or copied
  it.
- **Content file**: a rich-text file held by the Content File Service: a
  file name, a text, a file revision, a change history, comments and
  suggestions.
- **Copy**: a content file started from the text of another content file.
- **Right**: what a user may do with one content file: **read**,
  **comment** (comment and suggest), **edit**, or **resolve** (accept or
  discard suggestions). Each right is given or withdrawn by the client of
  the content file.
- **Fragment**: a part of the text of a content file that a comment or a
  suggestion points at.
- **Edit**: a change a user makes to the text of a content file.
- **Change to a content file**: an accepted edit, or an accepted suggestion.
- **Change history entry**: who changed what in a content file, and when.
- **File revision**: the state of a content file after its latest change.
  The **first file revision** is the state of a new content file or a copy;
  each change gives the content file the **next file revision**.
- **Comment**: a remark on a fragment, with its author and its time. A
  **reply** to a comment is a comment.
- **Suggestion**: a proposed new text for a fragment, with its author and
  its time. Its status is open, accepted or discarded. To **resolve** a
  suggestion is to accept or discard it; the **outcome** is accepted or
  discarded.
- **Period**: the time between two moments the client names.

# QDoc: controlled documents from draft to training 


**What it is.** An organisation maintains quality documents (QDocs): policies,
procedures, work instructions. QDoc is not a file store. It answers: which
version was in force on a given day, who reviewed and approved each file, who
had to learn it, who signed, and who changed what and when.

**Users.** Three levels: *employee* (reads the effective versions assigned to
them and the public ones, completes QACKs), *author* (does what an employee
does, and creates QDocs, writes, reviews, approves), *quality manager*
(does what an author does on every QDoc, and alone publishes, retires and
reads the audit log). Roles on one QDoc: *owner* (the author who created it),
*contributors*, *reviewers*, *approvers*, *recipients*. System administration
is separate from quality authority.

## Main flow

1. **Create.** An author creates a QDoc with a title and a document type. The
   system assigns the ID (`SOP-12`) and opens the first draft version. The
   creator is the owner and invites other authors as contributors.
2. **Write.** The contributors write the content files together, comment,
   suggest and attach PDFs. The owner names reviewers, approvers and
   recipients, may flag the version public, and may add a quiz.
3. **Review (optional).** The owner sends the version for review; the content
   is locked. Reviewers comment, suggest, and mark each file as reviewed, or
   as "do not care" when it is outside their competence. They give no verdict.
   The owner reverts to draft to resolve the suggestions.
4. **Approve.** The owner sends the version for approval. Each approver
   approves each file with an electronic signature, or declines with a
   comment, which hands the version back to the owner.
5. **Publish.** A quality manager publishes the approved version with an
   effective date. Each recipient gets a QACK.
6. **Train.** The recipient reads every file, passes the quiz if the version
   has one, and signs.
7. **In force.** On the effective date the System makes the version effective;
   the previous effective version is archived but kept.
8. **Change or retire.** An author opens a new draft version of an effective
   QDoc and the flow repeats. A quality manager retires a QDoc no longer needed.

```text
Draft → In review → In approval → Approved → Published → Effective → Archived
  ↑____ reverted ____|__ declined __|        (QACKs signed here)   QDoc: Retired
```

## Core domain concepts

| Concept | Meaning |
| --- | --- |
| **QDoc** | The logical document: ID, title, document type, owner, versions. Active or retired. |
| **Version** | One edition of a QDoc: its files, people, status and dates. Numbered major.minor by the system. |
| **Content file** | A rich-text file the contributors write; a version has at least one. Carries comments, suggestions and a change history. |
| **Attachment** | A PDF added to a version; never edited; in quarantine until scanned. |
| **Comment, suggestion** | A remark on, or a proposed edit to, a fragment of a content file. The owner accepts or discards each suggestion. |
| **Review mark** | One reviewer's statement on one file: *reviewed* (they checked it) or *do not care* (it is outside their competence). An acknowledgement, not a verdict. |
| **Approval** | One approver's authorisation of one file, bound to an electronic signature. |
| **Electronic signature** | The user's identity plus password, re-entered for the action, with its meaning and time. |
| **Recipient** | A user or a group named on a QDoc as having to learn its versions. The version is assigned to them. |
| **Public flag** | Set per version by the owner. A public version, once effective, is readable by every user, not only its recipients. |
| **Publication** | The release of an approved version to its recipients, with an effective date. |
| **Effective version** | The version in force; at most one per QDoc. |
| **Library** | What a user reads: the effective versions assigned to them and the public ones. |
| **QACK** | One employee's obligation to learn one published version: to sign, signed or overdue. A signed QACK is the training record. |
| **Quiz** | Multiple-choice questions attached to a version; passed only with every answer correct. |
| **Audit entry** | System-wide, action-level: actor (a user or the System), action, record, time. |
| **Activity entry** | Per QDoc, field-level: property, previous value, new value, who and when. |

## Main features and rules

- **Creation and versions:** the type (Policy, SOP, Work Instruction) gives
  the ID prefix and the next number. Draft iterations take minor numbers
  (1.1, 1.2); the approved version takes the next major number (2.0). A QDoc
  has one draft at a time, visible only to its contributors and the quality
  managers. The owner may delete a draft; the effective version stays.
- **Rich-text editing:** contributors edit one content file at the same time
  and every edit is kept; each file records who changed what and when. Any two
  versions can be compared, additions and removals marked.
- **Comments by status:** in draft the contributors comment; in review the
  owner, the reviewers and the quality managers; in approval nobody. All
  suggestions are accepted or discarded before the version goes for approval.
- **Stable text:** outside draft nobody edits, adds or removes a file. A file
  changed after a revert loses its review marks and approvals; the others keep
  theirs.
- **Attachments:** PDF only, checked from the content, within a size limit.
  An upload is quarantined and scanned for malware and inappropriate content;
  only a released attachment can be downloaded or approved. A failed one stays
  listed until a contributor removes it.
- **Review apart from approval:** the owner cannot be a reviewer. The owner is
  told once, when every reviewer has marked every file.
- **Do not care:** a "do not care" mark counts the same as a "reviewed" mark.
  A reviewer marks at least one file as reviewed, never every file as "do not
  care".
- **Approval per file:** a version is approved once each approver has approved
  each file. At least one approver is a quality manager.
- **Electronic signatures:** approving, declining, publishing, retiring and
  signing a QACK require the password again.
- **Approved is not effective:** only a quality manager publishes or retires.
  The version becomes effective on its date whether or not every QACK is
  signed; until then the previous version applies.
- **Library access:** the library shows only effective versions, and to each
  user only those assigned to them, directly or through a group, and those
  flagged public. Authors follow the same rule: a role on a QDoc opens its
  preparation, not the library. Quality managers see every effective version.
  The owner sets the public flag in draft; only recipients get a QACK. A
  published version not yet effective is read only through its QACK.
- **Training:** a QACK is either read-and-sign or read, quiz and sign; the quiz
  can be retaken. The QACK is due on the effective date and can still be signed
  when overdue. The owner decides per version whether earlier signers train
  again. A user who joins a recipient group gets its QACKs. Signed QACKs of
  archived versions are kept.
- **Audit log:** every lifecycle and training action in the system; nobody,
  including administrators, can edit or delete an entry.
- **Activity log:** per QDoc, the before and after of each property (title,
  owner, people, recipients, public flag, effective date), file and scan
  events, and the version history with archived versions.
- **Notifications:** in the user's action list and by e-mail: sent for review,
  reviews complete, sent for approval, declined, approved, QACK assigned,
  QACK due soon and overdue, version effective.


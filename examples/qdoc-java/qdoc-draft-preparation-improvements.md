# QDoc preparation: improvements inspired by Qualio

Proposed improvements to the QDoc preparation process described in
`qdoc-draft-preparation-requirements.md`, drawn from a review of how Qualio, an
eQMS for life-science companies, runs its document lifecycle (October 2026,
from Qualio's product pages and help center; see [Sources](#sources)).

Each improvement says what Qualio does, what our process lacks, and what we
would change, with rules and scenarios in the style of the base document. Use
case numbers (UC-n) and invariants refer to that document. Improvements are
proposals: where one contradicts a decision taken in the discovery session, it
says so, and nothing here is in scope until the domain expert accepts it.

## 1. Summary

| # | Improvement | Priority | Touches |
| --- | --- | --- | --- |
| IMP-1 | Change control record on every new version | High | UC-13, activity list |
| IMP-2 | Electronic signature with a meaning on approval | High | UC-12 |
| IMP-3 | Return a version to its authors with a reason | High | UC-8, UC-12, new use case |
| IMP-4 | Suggestions (tracked changes) from reviewers and approvers | Medium | UC-3, UC-9, UC-12 |
| IMP-5 | Comment threads, resolution by the comment's author, mentions | Medium | UC-9, UC-10 |
| IMP-6 | Document owner | Medium | UC-1, UC-13, UC-14 |
| IMP-7 | Review and approval due dates | Medium | UC-8, UC-12 |
| IMP-8 | Periodic review | Medium | new use case, UC-13 |
| IMP-9 | Effective date and training requirement captured in preparation | Medium | UC-12, hand-over to publication |
| IMP-10 | Templates per document type, type-based numbering | Low | UC-1, UC-2 |
| IMP-11 | Links between QDocs | Low | UC-3 |
| IMP-12 | Reason for archiving | Low | UC-14 |
| IMP-13 | Tags and restricted visibility | Low | 5.2 |
| IMP-14 | Cycle-time analytics from the activity list | Low | 5.1 |

Out of this list on purpose: AI drafting and AI gap analysis (Qualio's AI
Assistant and Compliance Intelligence) stay out of scope, as the base document
already excludes AI reviewers. Section 5 records them for later.

## 2. Vocabulary added

| Term | Meaning |
| --- | --- |
| Change control record | The justification for a new version: why it is made, what changes, what it affects. Belongs to the version. |
| Signature meaning | What an approver states by signing, e.g. "approved as author's manager" or "approved for compliance". Recorded with the approval. |
| Return to authors | An approver's or quality manager's request that the authors rework a shared version, with a reason. Not a rejection of the document. |
| Suggestion | A proposed change to a content file's text made by a reviewer or approver, which an author accepts or rejects. |
| Document owner | The one person accountable for a QDoc over its life: periodic reviews, new versions, archiving. |
| Due date | The date by which a step (review, approval, periodic review) should be done. Informational; never blocks. |
| Periodic review | A recurring check that a published QDoc is still correct, at a cadence set per document type or per document. |
| Effective date | The date from which a published version is in force, proposed in preparation and applied by publication. |

## 3. Improvements

### IMP-1 Change control record on every new version

**Qualio:** every document version has a Change Control tab, presented
whenever a document is revised. It records the justification and the impact of
the update, so an auditor sees why the document moved from one version to the
next. Its form comes from an organisation-wide template that quality users can
change. Several documents that change for one reason can be bundled in a
Document Change Request, approved per document and as a whole.

**Gap:** UC-13 creates version 2 with no record of why. Approvers see what
changed (change history) but not why, and an auditor reading the activity list
learns only who created the version and when.

**Requirement:**

- Creating a new version (UC-13) requires a change control record: the reason
  for the change (required), a summary of what changes (required) and its
  impact (optional, e.g. affected processes, other QDocs, training).
- Version 1 has no change control record; its creation is its own reason.
- Authors may edit the record until the version is shared; after that only
  through a return to authors (IMP-3).
- Approvers see the record next to the files they approve.
- The fields of the record come from an organisation-wide template that a
  quality manager may change; a change applies to versions created afterwards.

**Scenarios:**

1. *New version with a reason.* The quality manager creates version 2 of
   `1/12/2025` with reason "switch to automated testing" and summary "steps
   4-7 replaced by the CI pipeline". The approver sees both while approving.
2. *Missing reason.* The quality manager creates version 2 without a reason.
   Refused.
3. *Edit before sharing.* An author refines the summary before sharing.
   Allowed; the activity list records the edit.
4. *Edit after sharing.* An author tries to change the reason of a shared
   version. Refused.
5. *Template change.* The quality manager adds a field "affected training".
   Version 3, created afterwards, has it; version 2 keeps its old form.

**Later:** a change request bundling several QDocs (Qualio's DCR), approved
per QDoc and as a whole. It needs a model above a single QDoc draft, so it is
a separate bounded context, not part of this document.

### IMP-2 Electronic signature with a meaning on approval

**Qualio:** approvers approve or decline by entering their digital signature
credentials, optionally with a comment; signatures are designed to meet FDA 21
CFR Part 11. Part 11 signatures carry the signer's name, the date and time and
the meaning of the signature.

**Gap:** UC-12 records the approver, time and revision, but not that the
approver re-confirmed their identity nor what the approval means. The base
document puts signatures in publication; for a regulated customer the act that
needs the signature is the approval itself.

**Requirement:**

- Approving a file (UC-12) requires the approver to re-confirm their identity
  at that moment (re-entering credentials or an equivalent step-up check
  supplied by the identity provider).
- Every approval records the signature meaning, chosen from a list the
  organisation configures; one meaning may be the default.
- The approval entry in the activity list shows the approver's full name,
  the time, the meaning and the revision.
- A failed identity check records nothing on the file and is logged as a
  failed signature attempt.

**Scenarios:**

1. *Signed approval.* The approver approves the content file at revision 14,
   re-enters their password and chooses "approved for compliance". The
   approval carries all four facts.
2. *Wrong password.* The approver enters a wrong password. The file stays
   unapproved; the activity list shows a failed signature attempt.
3. *Default meaning.* The organisation configured one meaning. The approver
   is not asked to choose; that meaning is recorded.

**Open:** whether the organisation needs Part 11 at all, or only some
customers; the identity provider's support for step-up authentication.

### IMP-3 Return a version to its authors with a reason

**Qualio:** an approver may decline. The document owner is notified, reverts
the document to draft, edits it and sends it for review or approval again. A
document sent for review or approval is locked until it is reverted.

**Gap:** the session decided that an approver cannot reject: they push back
through comments. That works for a single point of disagreement but not for "this
version is not ready at all": the version stays shared, reviewers keep
reviewing a draft the approver considers unfinished, and nothing in the
activity list states the approver's position.

**Requirement:** a new use case, *Return version to authors*. It does not
contradict the session's decision: the document is not rejected, the version
goes back to its authors.

- Actor: an approver of the version, or the quality manager.
- The version must be shared and in status `new`.
- A reason is required.
- The version stops being shared; reviewers and approvers no longer see it
  until the authors share it again (UC-8).
- Every approval already given on the version is withdrawn and its file
  unlocked: the authors may have to change what was approved. Comments,
  "reviewed by" marks and the change history are kept.
- The activity list records the return, its actor and its reason.

**Scenarios:**

1. *Not ready.* The approver reads the shared version and returns it with
   "procedure lacks the rollback part entirely". The version is no longer
   shared; the authors see the reason.
2. *Approvals withdrawn.* One of two approvers had approved the content file.
   The other returns the version. The file is unlocked and has no approvals.
3. *No reason.* An approver returns a version without a reason. Refused.
4. *Reviewer tries.* A reviewer tries to return a version. Refused; reviewers
   comment.
5. *Shared again.* The authors fix the version and share it. Reviewers and
   approvers see it again with the earlier comments.

### IMP-4 Suggestions (tracked changes)

**Qualio:** collaborators can edit directly, suggest (inline changes that are
accepted or rejected, each time-stamped with its author) or comment.
Suggestion mode is available while a document is in draft and in review.

**Gap:** reviewers and approvers can only describe a change in a comment; the
author retypes it. A one-word correction costs a comment, an edit and a
closure.

**Requirement:**

- Reviewers and approvers may make suggestions on a content file of a shared
  version in status `new`. Authors may too, before sharing, to propose changes
  to a co-author.
- A suggestion is anchored to a fragment and holds the proposed text, its
  author and the time.
- Only an author accepts or rejects a suggestion. Accepting is an edit by that
  author (UC-3 rules apply: the file must not be approved); the change history
  records the suggestion's author as its source.
- A content file with an open suggestion cannot be approved, as with an open
  comment (UC-12).
- A suggestion on text that has since changed stays open and is shown as
  outdated; the author decides.

**Scenarios:**

1. *Typo.* A reviewer suggests "rollback" instead of "rolback". The author
   accepts; the revision advances; the history shows "suggested by reviewer,
   accepted by author".
2. *Rejected.* The author rejects a suggestion. The text stays; the activity
   list records the rejection.
3. *Blocks approval.* A suggestion is open. The approver tries to approve.
   Refused.
4. *Approved file.* The file is already approved by one approver. A reviewer
   tries to suggest. Refused.

### IMP-5 Comment threads, resolution by the comment's author, mentions

**Qualio:** the creator of a comment can edit and resolve it; resolved
comments remain in the comment history, visible to the owner and quality users.
Colleagues can be mentioned in a comment and linked to its location.

**Gap:** UC-10 lets only approvers close comments. A reviewer who sees their
point addressed cannot say so, and an approver must close every comment, even
ones whose author is satisfied. There are no replies: a discussion becomes a
row of separate comments on the same fragment.

**Requirement:**

- A comment may have replies, which form a thread. Replies follow UC-9's
  rules for who may write.
- The author of a comment may resolve it. Approvers may still close any
  comment (UC-10). Both end the thread as closed; the activity list records
  who closed it and whether that was the comment's author.
- Closed threads stay readable in the file's comment history.
- A comment or reply may mention a participant of the version; the mention is
  recorded so notifications can deliver it.

**Scenarios:**

1. *Reviewer resolves.* The author adds the missing step and replies "done".
   The reviewer resolves their own comment. The approver no longer has to.
2. *Approver closes over objection.* The approver closes a reviewer's thread
   without a change. Allowed, as today.
3. *Mention.* An author writes "@Anna can you confirm the tool name?". Anna is
   recorded as mentioned.
4. *Mention of an outsider.* An author mentions a person who is not a
   participant of the version. Refused; the person cannot see the version.

**Conflict:** UC-10 scenario 3 refuses a reviewer closing a comment. This
improvement allows it for the reviewer's own comment only.

### IMP-6 Document owner

**Qualio:** every document has an owner who receives its comments, periodic
review reminders and lifecycle updates; only owners complete periodic reviews,
and quality users can change the owner.

**Gap:** the base document has a creator, never changed. When the quality
manager who created a QDoc leaves, nobody is accountable for it.

**Requirement:**

- Every QDoc has exactly one owner, initially its creator.
- The owner must hold the quality manager role (or, for an auditor's
  document, be that auditor).
- A quality manager may hand ownership to another quality manager; the
  activity list records it.
- The owner, not any quality manager, creates new versions (UC-13), completes
  periodic reviews (IMP-8) and archives the QDoc (UC-14). Another quality
  manager may first take ownership.

**Scenarios:**

1. *Hand-over.* The owner leaves the company. Another quality manager takes
   ownership and creates version 2.
2. *Non-owner.* A quality manager who is not the owner tries to archive the
   QDoc. Refused until they take ownership.
3. *Owner without role.* Ownership is handed to an author. Refused.

### IMP-7 Review and approval due dates

**Qualio:** review and approval deadlines can be set per template; reminders
go out in weekly e-mails, or a quality user sends one from the activity
report.

**Gap:** nothing tells participants how long they have. Reviewers who never
mark a version are "silently accepting" (UC-11), but nobody knows when the
silence started to count.

**Requirement:**

- Sharing a version (UC-8) sets a review due date and an approval due date,
  defaulting from the document type's settings and adjustable by the author
  who shares.
- Due dates never block anything; they mark steps as overdue.
- The draft exposes, per version, who still has to review or approve and
  whether they are overdue. Sending reminders belongs to notifications.

**Scenarios:**

1. *Default.* Procedures default to 5 working days for review and 10 for
   approval. An author shares a procedure on Monday; both dates are set.
2. *Overdue.* An approver has not approved after the approval due date. The
   version shows them as overdue; approval is still possible.
3. *Adjusted.* An author shares an urgent fix with a 1-day approval due date.

### IMP-8 Periodic review

**Qualio:** documents are reviewed on a cadence set per document type or per
document. The owner is reminded ten days ahead and sees a warning when the
review is overdue. Reviewing, the owner answers whether the document needs an
update; if not, they set the next review date and send the confirmation for
approval. Retired documents have no periodic review.

**Gap:** the base document starts a new version only when someone decides to.
ISO 9001 and the customers' auditors expect quality documents to be reviewed
regularly; today the evidence of such a review is outside the system.

**Requirement:** a new use case, *Complete periodic review*, plus a review
date on every published QDoc.

- Each document type has a default review cadence (e.g. 12 or 24 months);
  the owner may override it per QDoc.
- When a version is published (UC-15) the next review date is set from its
  publication date and the cadence.
- The owner completes the review with one of two outcomes:
  - *No update needed:* the owner sets the next review date and sends the
    confirmation to approvers; when they approve, the review date moves and
    the activity list records the confirmation. No new version is created.
  - *Update needed:* the owner creates a new version (UC-13), with the review
    as the change control reason (IMP-1). The review date moves when that
    version is published.
- An archived QDoc has no review date.

**Scenarios:**

1. *Still valid.* A procedure's review is due. The owner answers "no update
   needed", sets the next review in 12 months; the approver approves. The
   version stays published and the review date moves.
2. *Outdated.* The owner answers "update needed". Version 2 is created with
   reason "periodic review: new tooling".
3. *Overdue.* The review date passed without a review. The QDoc is shown as
   overdue; nothing else changes.
4. *Version in preparation.* Version 2 is already `new` when the review falls
   due. The owner may record "update in progress"; the review completes when
   version 2 is published.

### IMP-9 Effective date and training requirement captured in preparation

**Qualio:** after approval a document becomes effective either on the
approval date or manually, so that training can happen between approval and
effectiveness. Authors can attach a multiple-choice training assessment; a
trainee reads the document, passes the assessment and signs.

**Gap:** publication is out of scope, but what publication needs to know is
decided by the people preparing the version, and today there is nowhere to
record it.

**Requirement:**

- A version in preparation carries a hand-over for publication: the intended
  effective date (on publication, or a given date) and whether employees must
  be trained before it takes effect.
- When training is required, the version may carry a training assessment:
  multiple-choice questions written by its authors.
- Both are edited by authors before sharing and approved with the version:
  approval covers them like a file (UC-12 rules on locking apply).
- The approved version hands them over to publication, which applies them.

**Scenarios:**

1. *Training first.* Version 2 changes a safety step. The authors require
   training and add a five-question assessment. Publication receives both.
2. *Immediate.* An editorial fix takes effect on publication with no
   training.
3. *Locked.* An approver has approved the assessment. An author tries to
   change a question. Refused.

### IMP-10 Templates per document type, type-based numbering

**Qualio:** each document template stands for a document type and has a
unique prefix (e.g. `SOP-`, `POL-`); document IDs are the prefix and an
ascending number, generated by the system and never reset.

**Gap:** templates are out of scope in the base document, and the number does
not show the document type. The open questions ask which parts of the number
template an organisation may customise.

**Requirement:**

- A document type may have a template: the initial content of the first
  content file of version 1 (UC-1). Without one, the file starts empty, as
  today.
- The number template (UC-2) may include the type's code, e.g.
  `PROC-<sequence>/<month>/<year>`. Whether the sequence then runs per type
  or for the whole organisation is the organisation's choice, fixed once.

**Scenarios:**

1. *Procedure template.* A quality manager creates a procedure. Its content
   file starts with the sections "Purpose", "Scope", "Steps", "Records".
2. *Type in the number.* The organisation includes the type code. A new
   policy gets `POL-3/01/2026`.

### IMP-11 Links between QDocs

**Qualio:** typing `@` in the editor inserts a smart link to another document
by ID or title, always pointing at its latest version.

**Gap:** procedures refer to each other by number in plain text; when the
referred QDoc is archived, nothing notices.

**Requirement:**

- A content file may link to another QDoc by its number. The link resolves to
  the QDoc's published version.
- Sharing (UC-8) warns, without refusing, when a link points to an archived
  QDoc or to one with no published version.
- The QDoc draft records the QDocs it links to, so a QDoc can list what links
  to it.

**Scenarios:**

1. *Link.* An author links "see `4/11/2025`". Readers open its published
   version.
2. *Archived target.* `4/11/2025` was archived. Sharing warns the author.

### IMP-12 Reason for archiving

**Qualio:** retiring an effective document requires a digital signature;
using a change request documents the reason for the retirement. Retired
documents stay retained and viewable.

**Gap:** UC-14 archives without a reason.

**Requirement:** archiving requires a reason, recorded in the activity list.
An archived QDoc, its versions and its activity list stay readable to those
who could read them before (5.2).

**Scenarios:**

1. *Replaced.* The owner archives a procedure with "replaced by
   `7/02/2026`".
2. *No reason.* Archiving without a reason is refused.

### IMP-13 Tags and restricted visibility

**Qualio:** documents carry tags besides their template; a tag tied to user
groups restricts who can access the document.

**Requirement:** a QDoc may carry tags set by its owner. A tag may be marked
as restricting: then quality managers and participants still see the QDoc
(5.2), but other users with the right to see drafts see it only if they belong
to a group the tag allows.

**Scenarios:**

1. *Grouping.* Procedures tagged "IT" are listed together.
2. *Restricted.* A procedure tagged "HR-confidential" is hidden from an
   auditor outside the HR group.

### IMP-14 Cycle-time analytics from the activity list

**Qualio:** document analytics show cycle times and approval timeframes, and
counts of live, draft and archived documents.

**Requirement:** the activity list must hold enough to compute, per version,
the time from creation to sharing, from sharing to approval, and each
approver's time to approve. No new behaviour; every relevant transition
already has an entry (5.1) with a time, and IMP-3 adds returns.

## 4. Effect on the base document's open questions

- *Rejected attachment:* unaffected.
- *Late correction between approval and publication:* IMP-3 gives a path
  before approval; after approval it still needs a decision. Qualio's answer
  is to revert to draft, which here would mean withdrawing approvals as in
  IMP-3, allowed until publication.
- *Shared as state or as activity entry:* IMP-3 makes sharing reversible,
  which argues for a state.
- *Which parts of the number template are customisable:* IMP-10 proposes the
  type code as one of them.
- *Recording attachment downloads:* Qualio records every auditable action
  with user, time and IP address; a download is one, if the customers'
  auditors ask for it.

## 5. Seen in Qualio, left for later

- **AI assistant:** answers questions from the organisation's documents and
  drafts new documents.
- **Compliance Intelligence:** maps documents to the clauses of ISO 9001, ISO
  13485, FDA QMSR and other frameworks and reports gaps.
- **Document change requests:** one approval over changes to several QDocs
  (see IMP-1).
- **Files uploaded in any format or synced from OneDrive** instead of written
  in the editor.

## Sources

- [Quality document management software (Qualio)](https://qualio.com/product/document-management-software)
- [Document lifecycle overview](https://docs.qualio.com/en/articles/6508293-document-lifecycle-overview)
- [Review a document](https://docs.qualio.com/en/articles/6508386-review-a-document)
- [Approve a document](https://docs.qualio.com/en/articles/6508395-approve-a-document)
- [Collaborating on documents in Qualio](https://docs.qualio.com/en/articles/10245012-collaborating-on-documents-in-qualio)
- [Editor FAQ](https://docs.qualio.com/en/articles/7033222-editor-faq)
- [Manage documents](https://docs.qualio.com/en/articles/6508363-manage-documents)
- [Change management options in Qualio](https://docs.qualio.com/en/articles/12739506-change-management-options-in-qualio)
- [Viewing the change control of an effective document](https://docs.qualio.com/en/articles/11188-viewing-the-change-control-of-an-effective-document)
- [Periodic review overview](https://docs.qualio.com/en/articles/11131-periodic-review-overview)
- [Complete a periodic review](https://docs.qualio.com/en/articles/6508408-complete-a-periodic-review)
- [Make a document effective](https://docs.qualio.com/en/articles/6508403-make-a-document-effective)
- [Create a new document](https://docs.qualio.com/en/articles/6176579-create-a-new-document)
- [Retire effective documents](https://docs.qualio.com/en/articles/6508417-retire-effective-documents)
- [Document templates](https://docs.qualio.com/en/articles/6172648-document-templates)
- [Qualio notifications](https://docs.qualio.com/en/articles/5479081-qualio-notifications)
- [Audit trail overview](https://docs.qualio.com/en/articles/11122-audit-trail-overview)
- [Document analytics](https://docs.qualio.com/en/articles/8013826-document-analytics)
- [AI Assistant](https://docs.qualio.com/en/articles/13732550-ai-assistant)
- [Qualio announces Compliance Intelligence (October 2025)](https://www.prnewswire.com/news-releases/qualio-announces-compliance-intelligence-the-ai-powered-solution-advancing-its-industry-leading-life-sciences-grc-platform-302583316.html)

# QDoc preparation IMP-4: Suggestions (tracked changes)

One of the proposed improvements to the QDoc preparation process described in
`qdoc-draft-preparation-requirements.md`, drawn from a review of how Qualio, an
eQMS for life-science companies, runs its document lifecycle (October 2026,
from Qualio's product pages and help center). The full list is in
[the index](README.md).

Use case numbers (UC-n) and invariants refer to the base document; IMP-n
refers to the other improvements. This is a proposal: where it contradicts a
decision taken in the discovery session, it says so, and nothing here is in
scope until the domain expert accepts it.

**Priority:** Medium. **Touches:** UC-3, UC-9, UC-12.

## Vocabulary

| Term | Meaning |
| --- | --- |
| Suggestion | A proposed change to a content file's text made by a reviewer or approver, which an author accepts or rejects. |

## Improvement

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

## Sources

- [Quality document management software (Qualio)](https://qualio.com/product/document-management-software)
- [Collaborating on documents in Qualio](https://docs.qualio.com/en/articles/10245012-collaborating-on-documents-in-qualio)
- [Editor FAQ](https://docs.qualio.com/en/articles/7033222-editor-faq)

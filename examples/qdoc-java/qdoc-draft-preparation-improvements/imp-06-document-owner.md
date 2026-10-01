# QDoc preparation IMP-6: Document owner

One of the proposed improvements to the QDoc preparation process described in
`qdoc-draft-preparation-requirements.md`, drawn from a review of how Qualio, an
eQMS for life-science companies, runs its document lifecycle (October 2026,
from Qualio's product pages and help center). The full list is in
[the index](README.md).

Use case numbers (UC-n) and invariants refer to the base document; IMP-n
refers to the other improvements. This is a proposal: where it contradicts a
decision taken in the discovery session, it says so, and nothing here is in
scope until the domain expert accepts it.

**Priority:** Medium. **Touches:** UC-1, UC-13, UC-14.

## Vocabulary

| Term | Meaning |
| --- | --- |
| Document owner | The one person accountable for a QDoc over its life: periodic reviews, new versions, archiving. |

## Improvement

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

## Related improvements

- [IMP-8 Periodic review](imp-08-periodic-review.md)
- [IMP-12 Reason for archiving](imp-12-reason-for-archiving.md)
- [IMP-13 Tags and restricted visibility](imp-13-tags-and-restricted-visibility.md)

## Sources

- [Quality document management software (Qualio)](https://qualio.com/product/document-management-software)
- [Manage documents](https://docs.qualio.com/en/articles/6508363-manage-documents)
- [Qualio notifications](https://docs.qualio.com/en/articles/5479081-qualio-notifications)

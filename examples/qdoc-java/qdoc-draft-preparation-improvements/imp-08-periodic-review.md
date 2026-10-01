# QDoc preparation IMP-8: Periodic review

One of the proposed improvements to the QDoc preparation process described in
`qdoc-draft-preparation-requirements.md`, drawn from a review of how Qualio, an
eQMS for life-science companies, runs its document lifecycle (October 2026,
from Qualio's product pages and help center). The full list is in
[the index](README.md).

Use case numbers (UC-n) and invariants refer to the base document; IMP-n
refers to the other improvements. This is a proposal: where it contradicts a
decision taken in the discovery session, it says so, and nothing here is in
scope until the domain expert accepts it.

**Priority:** Medium. **Touches:** new use case, UC-13.

## Vocabulary

| Term | Meaning |
| --- | --- |
| Periodic review | A recurring check that a published QDoc is still correct, at a cadence set per document type or per document. |
| Due date | The date by which a step (review, approval, periodic review) should be done. Informational; never blocks. |

## Improvement

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

## Related improvements

- [IMP-1 Change control record on every new version](imp-01-change-control-record-on-every-new-version.md)
- [IMP-6 Document owner](imp-06-document-owner.md)

## Sources

- [Quality document management software (Qualio)](https://qualio.com/product/document-management-software)
- [Periodic review overview](https://docs.qualio.com/en/articles/11131-periodic-review-overview)
- [Complete a periodic review](https://docs.qualio.com/en/articles/6508408-complete-a-periodic-review)

# QDoc preparation IMP-14: Cycle-time analytics from the activity list

One of the proposed improvements to the QDoc preparation process described in
`qdoc-draft-preparation-requirements.md`, drawn from a review of how Qualio, an
eQMS for life-science companies, runs its document lifecycle (October 2026,
from Qualio's product pages and help center). The full list is in
[the index](README.md).

Use case numbers (UC-n) and invariants refer to the base document; IMP-n
refers to the other improvements. This is a proposal: where it contradicts a
decision taken in the discovery session, it says so, and nothing here is in
scope until the domain expert accepts it.

**Priority:** Low. **Touches:** 5.1.

## Improvement

**Qualio:** document analytics show cycle times and approval timeframes, and
counts of live, draft and archived documents.

**Requirement:** the activity list must hold enough to compute, per version,
the time from creation to sharing, from sharing to approval, and each
approver's time to approve. No new behaviour; every relevant transition
already has an entry (5.1) with a time, and IMP-3 adds returns.

## Related improvements

- [IMP-3 Return a version to its authors with a reason](imp-03-return-a-version-to-its-authors-with-a-reason.md)

## Sources

- [Quality document management software (Qualio)](https://qualio.com/product/document-management-software)
- [Document analytics](https://docs.qualio.com/en/articles/8013826-document-analytics)

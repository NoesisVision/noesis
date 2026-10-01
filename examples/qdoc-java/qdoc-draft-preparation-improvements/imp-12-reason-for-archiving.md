# QDoc preparation IMP-12: Reason for archiving

One of the proposed improvements to the QDoc preparation process described in
`qdoc-draft-preparation-requirements.md`, drawn from a review of how Qualio, an
eQMS for life-science companies, runs its document lifecycle (October 2026,
from Qualio's product pages and help center). The full list is in
[the index](README.md).

Use case numbers (UC-n) and invariants refer to the base document; IMP-n
refers to the other improvements. This is a proposal: where it contradicts a
decision taken in the discovery session, it says so, and nothing here is in
scope until the domain expert accepts it.

**Priority:** Low. **Touches:** UC-14.

## Improvement

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

## Related improvements

- [IMP-6 Document owner](imp-06-document-owner.md)

## Sources

- [Quality document management software (Qualio)](https://qualio.com/product/document-management-software)
- [Retire effective documents](https://docs.qualio.com/en/articles/6508417-retire-effective-documents)

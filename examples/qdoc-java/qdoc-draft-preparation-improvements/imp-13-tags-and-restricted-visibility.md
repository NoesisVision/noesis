# QDoc preparation IMP-13: Tags and restricted visibility

One of the proposed improvements to the QDoc preparation process described in
`qdoc-draft-preparation-requirements.md`, drawn from a review of how Qualio, an
eQMS for life-science companies, runs its document lifecycle (October 2026,
from Qualio's product pages and help center). The full list is in
[the index](README.md).

Use case numbers (UC-n) and invariants refer to the base document; IMP-n
refers to the other improvements. This is a proposal: where it contradicts a
decision taken in the discovery session, it says so, and nothing here is in
scope until the domain expert accepts it.

**Priority:** Low. **Touches:** 5.2.

## Improvement

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

## Related improvements

- [IMP-6 Document owner](imp-06-document-owner.md)

## Sources

- [Quality document management software (Qualio)](https://qualio.com/product/document-management-software)
- [Manage documents](https://docs.qualio.com/en/articles/6508363-manage-documents)

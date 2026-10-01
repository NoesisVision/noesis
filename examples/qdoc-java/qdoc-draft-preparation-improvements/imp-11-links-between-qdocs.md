# QDoc preparation IMP-11: Links between QDocs

One of the proposed improvements to the QDoc preparation process described in
`qdoc-draft-preparation-requirements.md`, drawn from a review of how Qualio, an
eQMS for life-science companies, runs its document lifecycle (October 2026,
from Qualio's product pages and help center). The full list is in
[the index](README.md).

Use case numbers (UC-n) and invariants refer to the base document; IMP-n
refers to the other improvements. This is a proposal: where it contradicts a
decision taken in the discovery session, it says so, and nothing here is in
scope until the domain expert accepts it.

**Priority:** Low. **Touches:** UC-3.

## Improvement

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

## Sources

- [Quality document management software (Qualio)](https://qualio.com/product/document-management-software)
- [Editor FAQ](https://docs.qualio.com/en/articles/7033222-editor-faq)

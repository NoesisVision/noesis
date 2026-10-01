# QDoc preparation IMP-1: Change control record on every new version

One of the proposed improvements to the QDoc preparation process described in
`qdoc-draft-preparation-requirements.md`, drawn from a review of how Qualio, an
eQMS for life-science companies, runs its document lifecycle (October 2026,
from Qualio's product pages and help center). The full list is in
[the index](README.md).

Use case numbers (UC-n) and invariants refer to the base document; IMP-n
refers to the other improvements. This is a proposal: where it contradicts a
decision taken in the discovery session, it says so, and nothing here is in
scope until the domain expert accepts it.

**Priority:** High. **Touches:** UC-13, activity list.

## Vocabulary

| Term | Meaning |
| --- | --- |
| Change control record | The justification for a new version: why it is made, what changes, what it affects. Belongs to the version. |

## Improvement

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

## Related improvements

- [IMP-3 Return a version to its authors with a reason](imp-03-return-a-version-to-its-authors-with-a-reason.md)
- [IMP-8 Periodic review](imp-08-periodic-review.md)

## Sources

- [Quality document management software (Qualio)](https://qualio.com/product/document-management-software)
- [Change management options in Qualio](https://docs.qualio.com/en/articles/12739506-change-management-options-in-qualio)
- [Viewing the change control of an effective document](https://docs.qualio.com/en/articles/11188-viewing-the-change-control-of-an-effective-document)

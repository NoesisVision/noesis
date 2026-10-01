# QDoc preparation IMP-3: Return a version to its authors with a reason

One of the proposed improvements to the QDoc preparation process described in
`qdoc-draft-preparation-requirements.md`, drawn from a review of how Qualio, an
eQMS for life-science companies, runs its document lifecycle (October 2026,
from Qualio's product pages and help center). The full list is in
[the index](README.md).

Use case numbers (UC-n) and invariants refer to the base document; IMP-n
refers to the other improvements. This is a proposal: where it contradicts a
decision taken in the discovery session, it says so, and nothing here is in
scope until the domain expert accepts it.

**Priority:** High. **Touches:** UC-8, UC-12, new use case.

## Vocabulary

| Term | Meaning |
| --- | --- |
| Return to authors | An approver's or quality manager's request that the authors rework a shared version, with a reason. Not a rejection of the document. |

## Improvement

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

## Effect on the base document's open questions

- *Late correction between approval and publication:* IMP-3 gives a path
  before approval; after approval it still needs a decision. Qualio's answer
  is to revert to draft, which here would mean withdrawing approvals as in
  IMP-3, allowed until publication.
- *Shared as state or as activity entry:* IMP-3 makes sharing reversible,
  which argues for a state.

## Related improvements

- [IMP-1 Change control record on every new version](imp-01-change-control-record-on-every-new-version.md)
- [IMP-14 Cycle-time analytics from the activity list](imp-14-cycle-time-analytics-from-the-activity-list.md)

## Sources

- [Quality document management software (Qualio)](https://qualio.com/product/document-management-software)
- [Document lifecycle overview](https://docs.qualio.com/en/articles/6508293-document-lifecycle-overview)
- [Approve a document](https://docs.qualio.com/en/articles/6508395-approve-a-document)

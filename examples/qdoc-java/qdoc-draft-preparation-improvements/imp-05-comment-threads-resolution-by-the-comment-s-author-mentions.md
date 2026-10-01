# QDoc preparation IMP-5: Comment threads, resolution by the comment's author, mentions

One of the proposed improvements to the QDoc preparation process described in
`qdoc-draft-preparation-requirements.md`, drawn from a review of how Qualio, an
eQMS for life-science companies, runs its document lifecycle (October 2026,
from Qualio's product pages and help center). The full list is in
[the index](README.md).

Use case numbers (UC-n) and invariants refer to the base document; IMP-n
refers to the other improvements. This is a proposal: where it contradicts a
decision taken in the discovery session, it says so, and nothing here is in
scope until the domain expert accepts it.

**Priority:** Medium. **Touches:** UC-9, UC-10.

## Improvement

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

## Sources

- [Quality document management software (Qualio)](https://qualio.com/product/document-management-software)
- [Collaborating on documents in Qualio](https://docs.qualio.com/en/articles/10245012-collaborating-on-documents-in-qualio)
- [Review a document](https://docs.qualio.com/en/articles/6508386-review-a-document)

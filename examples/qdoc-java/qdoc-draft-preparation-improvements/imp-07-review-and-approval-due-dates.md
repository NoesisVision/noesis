# QDoc preparation IMP-7: Review and approval due dates

One of the proposed improvements to the QDoc preparation process described in
`qdoc-draft-preparation-requirements.md`, drawn from a review of how Qualio, an
eQMS for life-science companies, runs its document lifecycle (October 2026,
from Qualio's product pages and help center). The full list is in
[the index](README.md).

Use case numbers (UC-n) and invariants refer to the base document; IMP-n
refers to the other improvements. This is a proposal: where it contradicts a
decision taken in the discovery session, it says so, and nothing here is in
scope until the domain expert accepts it.

**Priority:** Medium. **Touches:** UC-8, UC-12.

## Vocabulary

| Term | Meaning |
| --- | --- |
| Due date | The date by which a step (review, approval, periodic review) should be done. Informational; never blocks. |

## Improvement

**Qualio:** review and approval deadlines can be set per template; reminders
go out in weekly e-mails, or a quality user sends one from the activity
report.

**Gap:** nothing tells participants how long they have. Reviewers who never
mark a version are "silently accepting" (UC-11), but nobody knows when the
silence started to count.

**Requirement:**

- Sharing a version (UC-8) sets a review due date and an approval due date,
  defaulting from the document type's settings and adjustable by the author
  who shares.
- Due dates never block anything; they mark steps as overdue.
- The draft exposes, per version, who still has to review or approve and
  whether they are overdue. Sending reminders belongs to notifications.

**Scenarios:**

1. *Default.* Procedures default to 5 working days for review and 10 for
   approval. An author shares a procedure on Monday; both dates are set.
2. *Overdue.* An approver has not approved after the approval due date. The
   version shows them as overdue; approval is still possible.
3. *Adjusted.* An author shares an urgent fix with a 1-day approval due date.

## Sources

- [Quality document management software (Qualio)](https://qualio.com/product/document-management-software)
- [Review a document](https://docs.qualio.com/en/articles/6508386-review-a-document)
- [Approve a document](https://docs.qualio.com/en/articles/6508395-approve-a-document)
- [Document templates](https://docs.qualio.com/en/articles/6172648-document-templates)
- [Qualio notifications](https://docs.qualio.com/en/articles/5479081-qualio-notifications)

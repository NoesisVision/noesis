# QDoc preparation IMP-2: Electronic signature with a meaning on approval

One of the proposed improvements to the QDoc preparation process described in
`qdoc-draft-preparation-requirements.md`, drawn from a review of how Qualio, an
eQMS for life-science companies, runs its document lifecycle (October 2026,
from Qualio's product pages and help center). The full list is in
[the index](README.md).

Use case numbers (UC-n) and invariants refer to the base document; IMP-n
refers to the other improvements. This is a proposal: where it contradicts a
decision taken in the discovery session, it says so, and nothing here is in
scope until the domain expert accepts it.

**Priority:** High. **Touches:** UC-12.

## Vocabulary

| Term | Meaning |
| --- | --- |
| Signature meaning | What an approver states by signing, e.g. "approved as author's manager" or "approved for compliance". Recorded with the approval. |

## Improvement

**Qualio:** approvers approve or decline by entering their digital signature
credentials, optionally with a comment; signatures are designed to meet FDA 21
CFR Part 11. Part 11 signatures carry the signer's name, the date and time and
the meaning of the signature.

**Gap:** UC-12 records the approver, time and revision, but not that the
approver re-confirmed their identity nor what the approval means. The base
document puts signatures in publication; for a regulated customer the act that
needs the signature is the approval itself.

**Requirement:**

- Approving a file (UC-12) requires the approver to re-confirm their identity
  at that moment (re-entering credentials or an equivalent step-up check
  supplied by the identity provider).
- Every approval records the signature meaning, chosen from a list the
  organisation configures; one meaning may be the default.
- The approval entry in the activity list shows the approver's full name,
  the time, the meaning and the revision.
- A failed identity check records nothing on the file and is logged as a
  failed signature attempt.

**Scenarios:**

1. *Signed approval.* The approver approves the content file at revision 14,
   re-enters their password and chooses "approved for compliance". The
   approval carries all four facts.
2. *Wrong password.* The approver enters a wrong password. The file stays
   unapproved; the activity list shows a failed signature attempt.
3. *Default meaning.* The organisation configured one meaning. The approver
   is not asked to choose; that meaning is recorded.

**Open:** whether the organisation needs Part 11 at all, or only some
customers; the identity provider's support for step-up authentication.

## Sources

- [Quality document management software (Qualio)](https://qualio.com/product/document-management-software)
- [Approve a document](https://docs.qualio.com/en/articles/6508395-approve-a-document)
- [Audit trail overview](https://docs.qualio.com/en/articles/11122-audit-trail-overview)

# QDoc preparation IMP-9: Effective date and training requirement captured in preparation

One of the proposed improvements to the QDoc preparation process described in
`qdoc-draft-preparation-requirements.md`, drawn from a review of how Qualio, an
eQMS for life-science companies, runs its document lifecycle (October 2026,
from Qualio's product pages and help center). The full list is in
[the index](README.md).

Use case numbers (UC-n) and invariants refer to the base document; IMP-n
refers to the other improvements. This is a proposal: where it contradicts a
decision taken in the discovery session, it says so, and nothing here is in
scope until the domain expert accepts it.

**Priority:** Medium. **Touches:** UC-12, hand-over to publication.

## Vocabulary

| Term | Meaning |
| --- | --- |
| Effective date | The date from which a published version is in force, proposed in preparation and applied by publication. |

## Improvement

**Qualio:** after approval a document becomes effective either on the
approval date or manually, so that training can happen between approval and
effectiveness. Authors can attach a multiple-choice training assessment; a
trainee reads the document, passes the assessment and signs.

**Gap:** publication is out of scope, but what publication needs to know is
decided by the people preparing the version, and today there is nowhere to
record it.

**Requirement:**

- A version in preparation carries a hand-over for publication: the intended
  effective date (on publication, or a given date) and whether employees must
  be trained before it takes effect.
- When training is required, the version may carry a training assessment:
  multiple-choice questions written by its authors.
- Both are edited by authors before sharing and approved with the version:
  approval covers them like a file (UC-12 rules on locking apply).
- The approved version hands them over to publication, which applies them.

**Scenarios:**

1. *Training first.* Version 2 changes a safety step. The authors require
   training and add a five-question assessment. Publication receives both.
2. *Immediate.* An editorial fix takes effect on publication with no
   training.
3. *Locked.* An approver has approved the assessment. An author tries to
   change a question. Refused.

## Sources

- [Quality document management software (Qualio)](https://qualio.com/product/document-management-software)
- [Make a document effective](https://docs.qualio.com/en/articles/6508403-make-a-document-effective)

# QDoc preparation: improvements inspired by Qualio

Proposed improvements to the QDoc preparation process described in
`qdoc-draft-preparation-requirements.md`, drawn from a review of how Qualio, an
eQMS for life-science companies, runs its document lifecycle (October 2026,
from Qualio's product pages and help center; see each improvement's sources).

Each improvement, in a document of its own, says what Qualio does, what our
process lacks, and what we would change, with rules and scenarios in the style
of the base document. Use case numbers (UC-n) and invariants refer to that
document. Improvements are proposals: where one contradicts a decision taken in
the discovery session, it says so, and nothing here is in scope until the
domain expert accepts it.

## Improvements

| # | Improvement | Priority | Touches |
| --- | --- | --- | --- |
| [IMP-1](imp-01-change-control-record-on-every-new-version.md) | Change control record on every new version | High | UC-13, activity list |
| [IMP-2](imp-02-electronic-signature-with-a-meaning-on-approval.md) | Electronic signature with a meaning on approval | High | UC-12 |
| [IMP-3](imp-03-return-a-version-to-its-authors-with-a-reason.md) | Return a version to its authors with a reason | High | UC-8, UC-12, new use case |
| [IMP-4](imp-04-suggestions.md) | Suggestions (tracked changes) from reviewers and approvers | Medium | UC-3, UC-9, UC-12 |
| [IMP-5](imp-05-comment-threads-resolution-by-the-comment-s-author-mentions.md) | Comment threads, resolution by the comment's author, mentions | Medium | UC-9, UC-10 |
| [IMP-6](imp-06-document-owner.md) | Document owner | Medium | UC-1, UC-13, UC-14 |
| [IMP-7](imp-07-review-and-approval-due-dates.md) | Review and approval due dates | Medium | UC-8, UC-12 |
| [IMP-8](imp-08-periodic-review.md) | Periodic review | Medium | new use case, UC-13 |
| [IMP-9](imp-09-effective-date-and-training-requirement-captured-in-preparation.md) | Effective date and training requirement captured in preparation | Medium | UC-12, hand-over to publication |
| [IMP-10](imp-10-templates-per-document-type-type-based-numbering.md) | Templates per document type, type-based numbering | Low | UC-1, UC-2 |
| [IMP-11](imp-11-links-between-qdocs.md) | Links between QDocs | Low | UC-3 |
| [IMP-12](imp-12-reason-for-archiving.md) | Reason for archiving | Low | UC-14 |
| [IMP-13](imp-13-tags-and-restricted-visibility.md) | Tags and restricted visibility | Low | 5.2 |
| [IMP-14](imp-14-cycle-time-analytics-from-the-activity-list.md) | Cycle-time analytics from the activity list | Low | 5.1 |

Out of this list on purpose: AI drafting and AI gap analysis (Qualio's AI
Assistant and Compliance Intelligence) stay out of scope, as the base document
already excludes AI reviewers. [Left for later](#left-for-later) records them for later.

## Vocabulary added

| Term | Meaning |
| --- | --- |
| Change control record | The justification for a new version: why it is made, what changes, what it affects. Belongs to the version. |
| Signature meaning | What an approver states by signing, e.g. "approved as author's manager" or "approved for compliance". Recorded with the approval. |
| Return to authors | An approver's or quality manager's request that the authors rework a shared version, with a reason. Not a rejection of the document. |
| Suggestion | A proposed change to a content file's text made by a reviewer or approver, which an author accepts or rejects. |
| Document owner | The one person accountable for a QDoc over its life: periodic reviews, new versions, archiving. |
| Due date | The date by which a step (review, approval, periodic review) should be done. Informational; never blocks. |
| Periodic review | A recurring check that a published QDoc is still correct, at a cadence set per document type or per document. |
| Effective date | The date from which a published version is in force, proposed in preparation and applied by publication. |

## Effect on the base document's open questions

- *Rejected attachment:* unaffected.
- *Late correction between approval and publication:* IMP-3 gives a path
  before approval; after approval it still needs a decision. Qualio's answer
  is to revert to draft, which here would mean withdrawing approvals as in
  IMP-3, allowed until publication.
- *Shared as state or as activity entry:* IMP-3 makes sharing reversible,
  which argues for a state.
- *Which parts of the number template are customisable:* IMP-10 proposes the
  type code as one of them.
- *Recording attachment downloads:* Qualio records every auditable action
  with user, time and IP address; a download is one, if the customers'
  auditors ask for it.

## Left for later

- **AI assistant:** answers questions from the organisation's documents and
  drafts new documents.
- **Compliance Intelligence:** maps documents to the clauses of ISO 9001, ISO
  13485, FDA QMSR and other frameworks and reports gaps.
- **Document change requests:** one approval over changes to several QDocs
  (see IMP-1).
- **Files uploaded in any format or synced from OneDrive** instead of written
  in the editor.

## Sources

- [Quality document management software (Qualio)](https://qualio.com/product/document-management-software)
- [Document lifecycle overview](https://docs.qualio.com/en/articles/6508293-document-lifecycle-overview)
- [Review a document](https://docs.qualio.com/en/articles/6508386-review-a-document)
- [Approve a document](https://docs.qualio.com/en/articles/6508395-approve-a-document)
- [Collaborating on documents in Qualio](https://docs.qualio.com/en/articles/10245012-collaborating-on-documents-in-qualio)
- [Editor FAQ](https://docs.qualio.com/en/articles/7033222-editor-faq)
- [Manage documents](https://docs.qualio.com/en/articles/6508363-manage-documents)
- [Change management options in Qualio](https://docs.qualio.com/en/articles/12739506-change-management-options-in-qualio)
- [Viewing the change control of an effective document](https://docs.qualio.com/en/articles/11188-viewing-the-change-control-of-an-effective-document)
- [Periodic review overview](https://docs.qualio.com/en/articles/11131-periodic-review-overview)
- [Complete a periodic review](https://docs.qualio.com/en/articles/6508408-complete-a-periodic-review)
- [Make a document effective](https://docs.qualio.com/en/articles/6508403-make-a-document-effective)
- [Create a new document](https://docs.qualio.com/en/articles/6176579-create-a-new-document)
- [Retire effective documents](https://docs.qualio.com/en/articles/6508417-retire-effective-documents)
- [Document templates](https://docs.qualio.com/en/articles/6172648-document-templates)
- [Qualio notifications](https://docs.qualio.com/en/articles/5479081-qualio-notifications)
- [Audit trail overview](https://docs.qualio.com/en/articles/11122-audit-trail-overview)
- [Document analytics](https://docs.qualio.com/en/articles/8013826-document-analytics)
- [AI Assistant](https://docs.qualio.com/en/articles/13732550-ai-assistant)
- [Qualio announces Compliance Intelligence (October 2025)](https://www.prnewswire.com/news-releases/qualio-announces-compliance-intelligence-the-ai-powered-solution-advancing-its-industry-leading-life-sciences-grc-platform-302583316.html)

# QDoc drafting 7: Create a new version

Part 7 of 8 of the QDoc drafting business requirements, split so that each
part can be delivered in order and is useful on its own. Prepared from the
domain discovery session between the domain expert and the analyst; see
[the overview](README.md) for why the system exists, the roles, the whole
lifecycle and what is out of scope.

**Builds on:** parts 1 to 6, which take a version from creation to approval,
and on publication, a separate part of the system, which tells drafting that
a version was published.

**Delivers:** a published QDoc can change: the quality manager starts a new
version that keeps the document's number, starts from the previous version's
files and goes through review and approval again, while the published version
stays in force.

## Vocabulary

**Version.** A complete, self-contained edition of a QDoc. A version is what
goes through review, approval and publication. Versions carry the workflow
status; the QDoc itself does not. A version contains files.

## Requirements

A published version cannot be changed. Until publication, even after approval,
a late correction is still possible (rare, but it happens between approval and
distribution). Once employees have been given a version, any change, however
small, requires a new version, and the new version goes through the entire
review and approval process again. Each version is a complete document in its
own right; a version that merely "adds one sentence" still contains the whole
text.

The example used: a software testing procedure, version 1, describes manual
testing. A new CTO switches the company to automated testing. It is still the
same procedure with the same number; it gets version 2.

Rules for new versions:

- A new version can be created only when the previous version is published
  and the QDoc is not archived. There can never be two versions of the same
  document in preparation at once, nor two published at once.
- The new version starts with status new and is a copy of all files of the
  previous version, content files and attachments alike, so the authors edit
  rather than start from nothing. The number of files may then diverge from
  the previous version.
- Authors, reviewers and approvers are assigned afresh for the new version.
  Because years may pass between versions, the people on the previous version
  may have left or changed roles. The user interface may pre-fill the form with
  the previous version's people as a convenience, but each of them is subject
  to the normal assignment checks.
- Creating a new version notifies all quality managers, as creating a
  document does.

## Visibility

- Change history of content files and previous versions: quality managers,
  authors, reviewers and approvers of the document. Never regular employees.
- Employees see only the current published version, and only from the point
  where the publication part of the system hands it to them.

## Activity list and notifications

The activity list records, from this part: every version created, and its
status transitions.

Notifications required:

- All quality managers when a new version of a QDoc is created.

## Scenarios

**Later change.** Two years on, the company drops manual testing. The quality
manager creates version 2 of `1/12/2025`. It starts as a copy of version 1's
files. The form pre-fills the old author, reviewers and approver; one reviewer
has left the company and cannot be assigned, so the quality manager picks a
replacement. Version 2 goes through review and approval; version 1 remains the
one in force until version 2 is published.

## Not in this part

Publication of an approved version itself is out of scope; this part only
needs to learn that a version was published.

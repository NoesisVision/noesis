# QDoc drafting 3: Write the content

Part 3 of 8 of the QDoc drafting business requirements, split so that each
part can be delivered in order and is useful on its own. Prepared from the
domain discovery session between the domain expert and the analyst; see
[the overview](README.md) for why the system exists, the roles, the whole
lifecycle and what is out of scope.

**Builds on:** [part 1](01-create-a-qdoc-and-assign-its-people.md), which
creates version 1 with an empty content file and assigns the authors.

**Delivers:** the authors write the document together in the system instead
of passing office files around by e-mail, and everyone on the drafting team
can see who changed what and when.

## Vocabulary

**Content file.** A file the authors write in a rich-text editor. This is the
body of the document. A version must always have at least one content file.
Comments and edit history attach to content files.

**Revision / change history.** The record of edits made to a content file's
content over time, within one version. The expert was explicit that this is
called history, not versioning, to avoid confusion with document versions.

**Author (also called contributor).** The only role that may edit content
files and add attachments. Responsible for preparing the document. The expert
used "author" and "contributor" interchangeably and asked to standardise on
"author".

## Who may do it

| Role | Edits content | Sees history |
| --- | --- | --- |
| Quality manager | no | yes |
| Auditor | no | yes |
| Author | yes | yes |
| Reviewer | no | yes |
| Approver | no | yes |
| Employee | no | no |

## Requirements

Once a version exists, the authors work on its content files. The work is
collaborative: several authors may edit at the same time, in a rich-text
editor. The system keeps the change history of every content file from the
moment the file was created in that version to the present, so that anyone on
the drafting team can see who changed what and when.

Authors may add further content files and attachments, and may remove files,
as long as the version keeps at least one content file. A version with no
attachments is fine; a version with no content file is not allowed.

There is no separate "in progress" or "in review" status on the version.
Sharing the version with reviewers and approvers is not a hand-over after
which the authors stop working. The expert described it as editing a book:
reviewers and approvers join the work and comment, but only the authors change
the text. A version is therefore new from creation until it is approved,
possibly with a flag recording that it has been shared.

## Visibility

- Before sharing: the creating quality manager and the assigned authors.
- Change history of content files and previous versions: quality managers,
  authors, reviewers and approvers of the document. Never regular employees.

## Activity list

The activity list records, from this part: every content change and every
file added or removed.

## Scenarios

**Standard document, writing.** The author writes the procedure over a few
days.

## Not in this part

Attachments come in [part 4](04-add-attachments.md); reviewers and approvers
joining the work, in [part 5](05-share-for-review-and-comment.md); the lock
an approval puts on a file, in [part 6](06-approve-the-version.md).

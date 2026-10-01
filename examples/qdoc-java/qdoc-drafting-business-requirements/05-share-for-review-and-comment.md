# QDoc drafting 5: Share for review and comment

Part 5 of 8 of the QDoc drafting business requirements, split so that each
part can be delivered in order and is useful on its own. Prepared from the
domain discovery session between the domain expert and the analyst; see
[the overview](README.md) for why the system exists, the roles, the whole
lifecycle and what is out of scope.

**Builds on:** [part 3](03-write-the-content.md) (content and its history)
and [part 4](04-add-attachments.md) (attachments).

**Delivers:** the authors open the draft to its reviewers and approvers, who
comment on exact fragments of it instead of in e-mails, while the authors
keep editing; reviewers can say they have no objections.

## Vocabulary

**Reviewer.** Reads the shared version and leaves comments. Optional; a
document may have none. Reviewers do not block the process. In the future a
reviewer may be an AI agent rather than a person.

**Approver.** Takes responsibility for the document by approving each of its
files. At least one is required before a version can be shared. Approvers may
close comments and, in the end, must approve; they cannot reject a document
outright.

## Who may do it

| Role | Comments | Marks as reviewed |
| --- | --- | --- |
| Quality manager | yes | no |
| Auditor | yes | no |
| Author | yes | no |
| Reviewer | yes | yes |
| Approver | yes | no |
| Employee | no | no |

## Requirements

The authors decide when the draft is far enough along to share. Sharing means
the assigned reviewers and approvers can now see the version and comment on
it. From the authors' side, sharing is their statement that, in their view,
the document is ready to be approved.

Before a version can be shared, at least one approver must be assigned.
Reviewers remain optional.

After sharing:

- Reviewers and approvers comment on fragments of content files.
- Authors respond by editing, which they may continue to do freely.
- A reviewer may mark the version as reviewed, meaning "I have read it and
  have no objections". This is informational. It exists so that an approver
  can see whether the reviewers have had their say before approving, and can
  chase a silent reviewer outside the system if they want to.
- A reviewer who says nothing is treated as silently accepting. Approval does
  not wait for reviewers.

There is no separate "in progress" or "in review" status on the version.
Sharing the version with reviewers and approvers is not a hand-over after
which the authors stop working. A version is therefore new from creation
until it is approved, possibly with a flag recording that it has been shared.

## Visibility

- Before sharing: the creating quality manager and the assigned authors.
- After sharing: additionally the assigned reviewers and approvers.

## Activity list

The activity list records, from this part: every comment and every "mark as
reviewed", and the sharing itself, since status transitions must not get
lost.

## Scenarios

**Standard document, review.** The author shares the version once the quality
manager has added two reviewers and one approver. One reviewer comments that
a section is missing; the author adds it. The other reviewer marks it as
reviewed without comments.

## Open questions

- Whether "shared for review" is a visible state of a version or only a fact
  recorded in the activity list.

## Not in this part

Closing comments and approving come in [part 6](06-approve-the-version.md).

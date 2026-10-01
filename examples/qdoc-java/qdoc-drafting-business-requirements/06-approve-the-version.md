# QDoc drafting 6: Approve the version

Part 6 of 8 of the QDoc drafting business requirements, split so that each
part can be delivered in order and is useful on its own. Prepared from the
domain discovery session between the domain expert and the analyst; see
[the overview](README.md) for why the system exists, the roles, the whole
lifecycle and what is out of scope.

**Builds on:** [part 5](05-share-for-review-and-comment.md), which shares the
version and collects comments.

**Delivers:** approvers take responsibility for every file of the version,
nobody can later claim "that is not what I approved", and the approved
version is ready for publication. With this part the first version of a QDoc
can go from creation to approval.

## Who may do it

| Role | Approves files | Closes comments |
| --- | --- | --- |
| Quality manager | no | no |
| Auditor | no | no |
| Author | no | no |
| Reviewer | no | no |
| Approver | yes | yes |
| Employee | no | no |

## Requirements

Approval is given file by file, not on the version as a whole. Every assigned
approver must approve every file. The expert acknowledged that in most cases a
version will have a single content file, so this is not burdensome, and that
per-section approval may become necessary in industries with very long
documents (aviation manuals were the example), but that is out of scope.

To approve a file:

- the approver must be assigned to the document,
- the file must be active, meaning an attachment must have completed its
  verification ([part 4](04-add-attachments.md)),
- there must be no open comments on the file. An approver must explicitly
  close every comment on a file before approving it. Closing a comment is the
  approver's acknowledgement that it was seen, whether or not it led to a
  change. The expert first allowed approval over open comments, then decided
  the explicit closing was the better product decision.
- the approver must be approving exactly the content they were looking at.
  If the content changed under them since they opened it, the approval must
  not go through.

Once a file has been approved its content is locked; authors can no longer
edit it. Consequently there is no scenario where an edit invalidates an
earlier approval.

When the last approver approves the last file, the version automatically
becomes approved and is ready for publication, which is handled by a separate
part of the system.

An approver cannot reject a document. The reasoning: if the quality manager
has decided the organisation needs the procedure (a new X-ray machine has
arrived and the radiologists cannot work without an operating procedure), then
the procedure must come into existence. The approver's job is to make sure the
content is fit for purpose, by commenting and pushing back until it is, and
then to take responsibility for it by approving. Disagreement is expressed
through comments and conversation, not through a reject action.

Future ideas noted but not required now: configurable approval strategies
(everyone, at least one per file, majority), chosen by the quality manager
when creating the document; an auto-approve policy in place of a list of
approvers. The analyst pointed out that a majority strategy would need some
form of explicit objection so nobody is outvoted silently; parked until the
need is real.

## Activity list

The activity list records, from this part: every approval, every comment
closed, and the version becoming approved.

## Scenarios

**Standard document, approval.** The approver closes the remaining comment,
approves the content file and the attachment, and the version becomes
approved.

**Approval attempt with open comments.** An approver tries to approve a
content file that still has a reviewer's open comment. The approval is
refused. The approver reads the comment, closes it, and approves.

**Late correction.** A version is approved but not yet published. Someone
spots a typo. Because nobody outside the drafting team has received it, the
correction is made in place rather than through a new version. (The session
stated this as allowed; how it interacts with the lock that approval places on
a file was not resolved and is listed under open questions.)

## Open questions

- How a late correction between approval and publication is performed, given
  that approval locks the file.

## Not in this part

Approval strategies other than "every approver approves every file" and
per-section review and approval are out of scope.

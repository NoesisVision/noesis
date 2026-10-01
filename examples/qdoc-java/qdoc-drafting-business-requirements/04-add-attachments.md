# QDoc drafting 4: Add attachments

Part 4 of 8 of the QDoc drafting business requirements, split so that each
part can be delivered in order and is useful on its own. Prepared from the
domain discovery session between the domain expert and the analyst; see
[the overview](README.md) for why the system exists, the roles, the whole
lifecycle and what is out of scope.

**Builds on:** [part 3](03-write-the-content.md), in which authors work on a
version's files.

**Delivers:** authors add supporting PDF files to a version, and no file that
carries malware or unacceptable content can ever be downloaded or approved.

## Vocabulary

**Attachment.** A supporting file added to a version. Attachments are PDF only,
are not edited inside the system and are downloaded rather than displayed.
Attachments are optional. Before it counts as part of the version an
attachment must pass a verification step.

## Who may do it

| Role | Adds attachments |
| --- | --- |
| Quality manager | no |
| Auditor | no |
| Author | yes |
| Reviewer | no |
| Approver | no |
| Employee | no |

## Requirements

Attachments are PDF files only. They are added by authors and are not edited
in the system; reviewers and approvers download them, read them and either
comment elsewhere or approve them.

Authors may add further content files and attachments, and may remove files,
as long as the version keeps at least one content file. A version with no
attachments is fine.

Uploaded attachments are a potential attack vector and a potential channel for
inappropriate content. Every uploaded attachment therefore goes into
quarantine until it has been checked for malware and for unacceptable content
(the example given was offensive images), and possibly for size. Only once the
checks pass does the attachment become active. Until then:

- nobody can download it,
- it cannot be approved,
- and so the version cannot become approved.

The organisation expects scanning to complete within a few minutes of upload.
Because authors normally share a version days after adding attachments, the
window in which a reviewer could hit an unscanned file is considered a rare
edge case, but the rule stands.

What happens when a scan fails was left as an open product decision between
two options:

1. Show a status on each attachment (checking, ready, failed) in the document
   view, and let the author decide what to do with a failed file.
2. Remove the failed attachment automatically, record the removal in the
   activity list as an action by the system, and e-mail the author explaining
   what was found and that the file was removed.

The analyst leaned towards visible statuses on the grounds that the approver
should see at a glance that every attachment is ready, and that the author
should make a conscious decision. The expert leaned towards automatic removal
plus notification to avoid keeping unusable files on screen. Either way the
audit trail must show the outcome.

Size limits for a single attachment and for all attachments of a version were
raised and not decided; a short piece of research on sensible limits and on
available scanning tools was agreed.

A related idea: recording that a reviewer or approver actually downloaded an
attachment, in the same way that downloading an insurance policy online counts
as having read it. This would let the system show that the people approving a
version have opened its attachments. Not committed to.

## Activity list and notifications

The activity list records, from this part: every file added or removed, and
every action taken automatically by the system (for instance an attachment
removed after a failed scan). It must make clear which actions were taken by
the system rather than by a person.

Notifications required:

- The author when an attachment fails scanning, if the automatic-removal
  option is chosen.

## Scenarios

**Standard document, attachment.** The author uploads one PDF checklist.

**Suspicious attachment.** An author uploads a PDF that fails the malware
check. The file never becomes downloadable or approvable. Depending on the
option chosen, either the author sees it flagged as failed and removes it, or
the system removes it, logs that it did so, and e-mails the author.

## Open questions

- Attachment scan failure: statuses in the document view versus automatic
  removal with notification.
- Attachment size limits, per file and per version.
- Whether the drafting view should show each attachment's verification status
  even if the source of that status lives elsewhere.
- Whether to track that reviewers and approvers have downloaded attachments.

## Not in this part

Approving an attachment comes in [part 6](06-approve-the-version.md).

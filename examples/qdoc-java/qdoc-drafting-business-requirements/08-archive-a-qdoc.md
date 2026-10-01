# QDoc drafting 8: Archive a QDoc

Part 8 of 8 of the QDoc drafting business requirements, split so that each
part can be delivered in order and is useful on its own. Prepared from the
domain discovery session between the domain expert and the analyst; see
[the overview](README.md) for why the system exists, the roles, the whole
lifecycle and what is out of scope.

**Builds on:** [part 7](07-create-a-new-version.md), which knows when a
version is in force or in preparation.

**Delivers:** QDocs nobody needs any more stop cluttering people's lists.

## Vocabulary

**QDoc (quality document).** A QDoc has a title, a type, a document number
and one or more versions. It is either active or archived.

## Requirements

A QDoc can be archived so that it stops cluttering people's lists. This is a
convenience for users, not a step in the process. A QDoc may be archived only
when none of its versions is still in force or in preparation. An archived
QDoc accepts no further assignments or versions. Deletion was mentioned as
distinct from archiving and was not discussed further.

The quality manager may add authors, reviewers and approvers at any time
while the document is not archived; every assignment requires that the
document is not archived ([part 1](01-create-a-qdoc-and-assign-its-people.md)).
A new version can be created only when the QDoc is not archived
([part 7](07-create-a-new-version.md)).

## Activity list

The activity list records the archiving, since status transitions must not
get lost.

## Not in this part

Deletion of documents is out of scope.

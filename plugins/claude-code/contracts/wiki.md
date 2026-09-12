<!-- Copied from packages/shared-contracts/src/wiki.md by @noesis-vision/noesis 0.1.0-beta.4. Do not edit: run `bun run generate`. -->

# The wiki: topics and decisions

Companion to `topic.ts` and `decision.ts`.

## What the wiki is

The wiki is the distillate of everything imported: what the conversations and
documents mean, organised by subject rather than by source. It is the part a
person reads and edits, which is why its fields carry locks.

## Topics

- One file per topic under `wiki/topics/`. The tree is in the data: a topic
  names its parent by `parent_id`; a root has `null`. To move a topic, change
  that one field.
- A topic is a subject, not an event. "Slot holds" is a topic; "the call on
  Tuesday" is a conversation. Prefer fewer, broader topics with good summaries
  over many thin ones.
- `short_summary` is what the topic is about, in one or two sentences, for a
  list. `long_summary` is the write-up: what is known, what was decided, what
  is still open. Every claim in it should be traceable to an item.
- `items` are the fragments the topic is grounded in. Add the fragments that
  carry information; leave out `Irrelevant` ones.

## Decisions

- One file per decision under `wiki/decisions/`; `topic_id` names the topic
  it belongs to.
- A decision has a context (why it had to be made), the chosen option with
  its rationale, and the alternatives with theirs. Write each alternative's
  rationale as why it lost, not as a description of it.
- `status` is the decision's own lifecycle. `superseded` means a later
  decision replaced it; say which in the context text.
- `supporting_info` on each slot points at the fragments where that part was
  said. A decision with no supporting fragments is a guess; record it as
  `proposed`.

## Locks

`title_locked`, `short_summary_locked`, `long_summary_locked` on a topic and
the `*_locked` fields of a decision mean a person edited that field. When a
skill merges a new import into an existing topic or decision, it keeps every
locked field as it is and puts what it learned into the unlocked ones. If the
locked text is now wrong, say so and ask; do not overwrite it.

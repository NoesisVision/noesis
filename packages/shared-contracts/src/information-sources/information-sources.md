# Information sources: conversations, documents and their analysis

Companion to `conversation.ts`, `document.ts`, `information-category.ts`,
`information-fragment.ts`, `conversation-analysis.ts` and
`document-analysis.ts`.

## Imports are records, not summaries

A conversation or document file is a faithful record of the source, split into
fragments the wiki can point at. Text is verbatim: fix nothing, shorten
nothing, reorder nothing. What the source means goes into the analysis, and
from there into the wiki.

## Splitting a conversation

- A **turn** is one uninterrupted contribution by one speaker. Keep the
  speaker names the transcript uses.
- A **fragment** is one idea unit inside a turn: a few sentences making one
  point. A turn that makes three points has three fragments; a turn that says
  "yes" has one. Fragments cover the whole turn, in order, with nothing left
  out.
- `main_topic` is one line on what the conversation was mostly about, for a
  list.

## Splitting a document

- A **fragment** is one block: a paragraph, a list item, a code block, a table
  row group, a blockquote. Headings are `structural` fragments so their
  position is kept.
- `section_path` on a fragment and `path` on a section are heading titles from
  the top down, so a fragment can be placed without walking the tree.
- `fragment_indices` on a section lists only the fragments directly under that
  heading; subsections list their own.

## Categories

Every fragment gets at least one `InformationCategory`:

- `Information` — states a fact about the domain or the system.
- `Position` — states a view someone holds ("we should hold slots for ten
  minutes").
- `Argument` — gives a reason for or against a position.
- `Decision` — records a choice being made, here, in this source.
- `Irrelevant` — greetings, scheduling, asides. Never referenced from the wiki.

When in doubt between `Position` and `Decision`: a decision has an agreed
outcome in the source; a position is one side of it.

## The analysis

An import payload carries the source and its analysis into topics:

- For each subject the source speaks to, one `AnalyzedTopic`. Reuse an
  existing wiki topic when there is one (`is_new: false`, its id); create one
  only when nothing fits. New topics may name a placeholder id and refer to
  each other by it; the service replaces placeholders.
- `items` lists the fragments of this source (by `conversation_id` or
  `document_id` and index) that ground the topic. Grounding means the fragment
  supports a claim in the summary, not that it mentions the word.
- Decisions found in the source go under the topic they belong to. Leave the
  decision `id` out; the service mints it.
- When merging into an existing topic, write the summaries as they should read
  after the import, keeping locked fields as they are.

## Ids and duplicates

`conversation_id` and `document_id` are content hashes of the source, computed
by the service; the value in the payload is replaced. Importing the same
source twice is reported as a duplicate, not written again.

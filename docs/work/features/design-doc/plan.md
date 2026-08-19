# Collaborative Design Document Workspace — implementation plan

**Status:** Phases 1–5 delivered; phases 6–6b (agent surface) dropped from this iteration
(decision 57) — the iteration is complete
**Date:** 2026-08-17
**Basis:** [`prototypes/document-view.html`](prototypes/document-view.html), the specification in
[`design-doc.md`](design-doc.md), and decisions 49–52 in `docs/decisions.md`.
**Supersedes:** the Stage 1 three-concept comparison (section 15 of the specification). Those
prototypes moved to [`prior-art/stage1/`](prior-art/README.md).

Sections 3 to 6 record the shape as built where phase 1 settled it, and as intended where it has
not been built yet. Decision 50 owns the model; decision 51 owns which representation is the truth
once the editor exists.

---

## 1. The direction

The workspace is **one document, read top to bottom**, not a catalogue or a map to browse.

> Goal → business context → target outcomes → scope → actors → use cases, grouped bounded context →
> application service, each with summary, description, rules, input, output, acceptance scenarios and
> quality attributes.

A table of contents rail carries navigation; the right rail carries comments and suggestions; the
agent sits in a docked chat. Every block on the page is bound to exactly one typed element of the
design-doc schema — there is no free-floating prose anywhere in the product.

Three properties make this work, and they are the ones to protect while building:

1. **Nothing untyped.** Insertion offers only elements the schema allows at that point; reordering
   only moves a block inside its own schema array. A document that cannot hold untyped content stays
   agent-readable by construction.
2. **Nothing loud.** Provenance and completeness hints stay quieter than the content. Empty
   sections are named once at the end of a use case rather than printed as empty boxes.
3. **Nothing applied behind the user's back.** What a person asks for is applied and shown; what
   nobody asked for is proposed and reviewed. Suggestions between people are accepted or rejected
   one by one.

## 2. What the prototype settles

Answers to open questions from section 17 of the specification:

| Question                                             | Settled as                                                                                                                              |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Primary navigation and editing model              | One scrolling document with a table-of-contents rail. Panels, previews and canvas navigation are dropped.                               |
| 2. Editing full Gherkin without intimidating readers | Scenario blocks render Background / Scenario / Outline / Examples as labelled lines; keyword column is visually separated from prose.   |
| 3. Wording of Input and Output for both audiences    | One typed field list per direction carrying **label** (business wording) and **name: Type**; both readerships read the same row.        |
| 4. Summarising all-or-nothing proposal impact        | Added / changed / removed / specification-only columns plus an explicit "challenges a human decision" block with the agent's reasoning. |
| 6. Showing human provenance quietly                  | Provenance as a small `person` tag on the element, not a badge on every field.                                                          |

The prototype also settled question **9** — an accessible `+ new` / `± modified` / `− removed`
word-plus-glyph treatment, never colour alone — but the codebase-delta feature it belongs to is now
deferred whole (decision 52), so the answer is parked with the feature.

Still open for this iteration: **5** (collaboration semantics while a proposal is pending), plus two
the prototype raised — what happens to a comment or suggestion whose anchor text is edited away, and
how a chat-applied change is shown and undone. Questions **7** and **8** are parked with the
features they belong to.

Phase 1 narrowed the anchor question without closing it. An anchor now points at an element by id
rather than at text, so editing the words inside a rule cannot detach a thread from it; what remains
open is the substring case — a comment on "10 minutes" when that phrase is rewritten — which lands
with the Yjs relative positions in phase 4.

**Out of the first iteration.** The specification carries the whole product direction; this
iteration deliberately builds less. Not now:

| Deferred                                                                               | Why it can wait                                                                               |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Codebase delta (§2.6, §6.2, §8.3, §14.9): baseline, markers, scanner identity, refresh | Deferred whole (decision 52). Element ids stay stable, so it reattaches without re-anchoring. |
| Product/Technical lens (§2.1, §9.2)                                                    | One typed field list already serves both audiences; the lens is designed next iteration.      |
| Related building blocks and Interaction flow sections (§9.1 rows 9–10)                 | They are the technical half of the lens.                                                      |
| Behaviour graph, scenario paths, sequence diagrams (§10.2, §12, §14.4–14.5)            | Nothing in the document view reads or edits them; they arrive with the Technical lens.        |
| Visual canvas in every form (§8)                                                       | The document replaced it as the primary surface.                                              |
| Dashboard landing and catalogue filters (§7.1–7.2)                                     | The table of contents is the catalogue; a document list belongs to the app shell.             |
| Building-block behavioural scenarios (§11.1)                                           | Acceptance scenarios are what the document shows. The type exists; nothing renders it.        |
| Agent mentions in comments (§3.2, §13)                                                 | Comments are a human conversation; the agent is asked in chat.                                |

Keep the model lens-ready all the same: a lens must remain a pure presentation filter over the same
elements, so nothing in the schema or the editor may assume a single audience.

## 3. Model and schema work

**Delivered in phase 1** (decision 50), across four files in `packages/shared-contracts/src`:

| File                          | Holds                                                |
| ----------------------------- | ---------------------------------------------------- |
| `design-doc.ts`               | The portable specification.                          |
| `design-doc-ref.ts`           | `ElementRef` and resolution against the document.    |
| `design-doc-collaboration.ts` | Comments, suggestions, whole-document proposals.     |
| `design-doc-integrity.ts`     | Whole-document invariants no element schema can see. |

A fifth file, `design-doc-baseline.ts` (comparable projections and derived codebase state), was
delivered with phase 1 and then removed when the codebase-delta feature was deferred whole
(decision 52).

The old tree of `changeSetSchema(...)` wrappers is gone, replaced by flat arrays related by id
(specification §14.7). Nothing outside the package imported the old schema, so there was no
migration to write.

### 3.1 New document-level fields

The prototype introduced these and they are load-bearing for the reading order:

- `goal: string`
- `businessContext: { id, text }[]`
- `outcomes: { id, text, measure }[]`
- `scope: { inScope: { id, text }[], outOfScope: { id, text }[] }`

### 3.2 Actors

Actors stay minimal in this iteration: a stable id, name, kind (human role or external system) and
description, listed as a document section, with each use case naming its actors in its header line.
No actor-centred navigation, filtering or canvas presence.

### 3.3 First-class use cases (specification §14.1–14.2)

`DesignedUseCase` is top-level, with a stable id, one owning application-service reference,
Command/Query/Event type, **actor id references** (replacing `actor: string | null`), and ownership
of its rules, fields, scenarios and quality attributes.

`DesignedBehaviour` was **not** replaced by it. A behaviour belongs to a building block and is the
node type of the invocation graph (§14.4), which exists at every level from `BookAppointment` down
to `SlotHold.place()`; a use case belongs to an application service, references actors and owns the
document's acceptance scenarios. The two name each other: the behaviour that is a use case's entry
point carries `useCaseId`, and the use case carries `behaviourId` back.

There is no separate application-service record. An application service is a
`DesignedBuildingBlock` whose `type` is `application_service`, so `useCase.applicationServiceId` and
`behaviour.buildingBlockId` resolve in one id space.

### 3.4 One typed field list per direction

A single list replaces the split product/technical representations, as the prototype does:

```ts
Field = { id: string; name: string; label: string; type: string; note: string }
UseCase.input  = { fields: Field[] }
UseCase.output = { summary: string; fields: Field[] }
```

`label` is the business wording, `name`/`type` the structural truth. The `id` is not in the prototype's shape: without
one, a comment on a field row would re-point the moment someone dragged the list, and a field rename
would orphan it.

### 3.5 Gherkin (§14.3)

One `DesignedScenario` shape carries the full Gherkin hierarchy the document shows — background,
scenario, scenario outline, examples table, ordered steps and tags. It serves both places the
product writes scenarios: a use case's acceptance scenarios, aliased as
`DesignedAcceptanceScenario`, and a behaviour's behavioural scenarios (§11.1). Ownership is what
distinguishes them, not structure.

Behaviour relationships and scenario paths (§14.4–14.5) are **not** modelled — they exist to feed
interaction flow and sequence diagrams, which are deferred. Behaviour and scenario ids are stable so
they slot in later without re-anchoring anything.

### 3.6 Technical vocabulary, modelled but unrendered

`DesignedBuildingBlock`, `DesignedDomainModule`, `DesignedProperty` and `DesignedBehaviour` are in
the model even though nothing in the document view reads them this iteration. They are here because
the Technical lens and the scanners need the vocabulary, and because a behaviour graph with no
behaviour type has no nodes to connect.

### 3.7 Addressing (§14.8)

An address is an `ElementRef`:

```ts
ElementRef = { kind: 'element'; id: string }
           | { kind: 'slot'; ownerId: string; path: string[] }
```

An element ref names something by its id and says nothing about where it sits, so it survives the
element being renamed, reordered, moved to another parent, and a schema field around it being
renamed. A slot ref names a place that holds no element of its own — the goal text,
`output.summary`, a list addressed as the insertion point it is — and is the only form a schema
rename can invalidate. Resolution is one lookup in `elementIndex`, which is why ids are unique
across the whole document rather than per collection.

There is deliberately no string form. An earlier draft carried a readable path expression,
`useCase[uc-book].rules[rule-hold]`, as the stored address with a grammar to parse it back; once
refs became what gets stored, nothing produced such a string that anything had to read. A display
format that no longer round-trips belongs with the view that renders it.

### 3.8 Collaboration objects, kept outside the portable specification (§14.8)

```ts
Anchor     = { ref: ElementRef; quote: string }
Comment    = { id, documentId, anchor, author, body, resolved, replies[], mentions[], createdAt }
Suggestion = { id, documentId, anchor, replacement, author, note, createdAt, status }
Proposal   = { id, documentId, trigger, status, rationale, document, impact, challengedDecisions[] }
```

The quote is evidence, not the anchor mechanism — it is what lets a thread still say what it was
about once its mark is gone.

### 3.9 Whole-document invariants

`checkDesignDocument` carries what zod cannot, because zod validates one object at a time: id
uniqueness and non-emptiness across the document, every id reference resolving, an
`applicationServiceId` naming a block of the right type, `useCaseId` and `behaviourId` agreeing, a
domain module living in its block's bounded context, and examples rows matching their header count.
Errors mean the document is inconsistent; warnings mean it resolves but will read wrong.

### 3.10 Proposal dimension (§14.7)

Proposal state lives in its own object — a whole-document `DesignDocProposal` outside the portable
specification — and a pending proposal never changes what the accepted document says. The
codebase-relative dimension (baseline snapshots, derived `existing | new | modified | removed`,
scanner identity, newer-scan tracking) was built in phase 1 and removed when the codebase-delta
feature was deferred whole (decision 52); decision 49's derivation rule travels with it.

## 4. Editor

The frontend already depends on `@blocknote/core`, `@blocknote/react` and `@blocknote/shadcn`
(`server/frontend/package.json`), plus `yjs`. Build the document view on BlockNote with a **custom
block schema** where each block type maps to one design-doc element:

| Block type         | Bound to                                      |
| ------------------ | --------------------------------------------- |
| `goal`             | `designDocument.goal`                         |
| `contextParagraph` | `designDocument.businessContext[]`            |
| `outcome`          | `designDocument.outcomes[]`                   |
| `scopeItem`        | `designDocument.scope.{inScope,outOfScope}[]` |
| `actor`            | `actor[]`                                     |
| `useCaseHeading`   | `useCase[id]` (name, type badge)              |
| `rule`             | `useCase[id].rules[]`                         |
| `fieldRow`         | `useCase[id].{input,output}.fields[]`         |
| `scenario`         | `acceptanceScenario[id]`                      |
| `qualityAttribute` | `useCase[id].qualityAttributes[]`             |

The right-hand column is documentation shorthand for reading this table, not a type. An address in
code is an `ElementRef` (§3.7); there is no string form of one.

**Which side holds the truth** (decision 51). BlockNote wraps ProseMirror, which owns its own
document representation, so a ProseMirror document exists whether or not one is designed. The Yjs
document holding it is the **stored truth for editing**; `DesignDocument` is the **interchange
format** — agent output, API reads, export, integrity input — derived from the
Y.Doc on read. It may be cached, invalidated on update, but it is a cache and never a second store.

The custom block schema is therefore the mechanism by which "nothing untyped" is enforced rather
than merely intended: what may be inserted at a point, what may nest in what, what a paste coerces
to and what a drag may reparent all come from the ProseMirror schema.

Design-doc ids are the BlockNote block ids — they are already unique document-wide, so one id space
serves both, and an `ElementRef` resolves in either representation. Elements below block
granularity, such as Gherkin steps and example rows, keep their ids in block attributes.

Rules to enforce in the editor layer:

- **One block menu**, opened from the gutter pen or by typing `/`: the typed elements insertable at
  that point (BlockNote `getSlashMenuItems`, filtered per insertion point, never the default set)
  followed by the actions on the block itself. The drag handle only drags.
- **Drag and drop** constrained to siblings of the same block type / schema array; reject
  cross-array drops rather than silently reparenting.
- **Delete and paste** cannot produce untyped paragraphs — paste is coerced into the current block
  type or rejected. Deletion is offered per block through the drag-handle menu and is schema-aware:
  list members are removed, single fields are cleared, and elements the schema requires cannot be
  deleted at all. While Suggesting, a deletion is filed as a suggested removal rather than applied.
- **Marks** for comments and suggestions (BlockNote inline styles / custom marks), so a substring
  anchor survives editing rather than being re-matched by text search as the prototype does. The
  element an anchor belongs to is already durable — that is the `ElementRef` — so what the mark adds
  is the position inside it.
- **Modes**: Editing / Suggesting, the latter editor-level (edits captured as suggestion
  objects instead of document mutations). A read-only Viewing mode was built and later dropped —
  the editor is always editable per client.

Section order and the "not written yet" line are rendering concerns over the model, not editor state.

## 5. Collaboration and persistence

Full collaborative editing is in scope from the start, so the editor is built on a shared document
from the first line rather than retrofitted onto a single-user one.

- **Yjs from phase 3.** One Yjs document per design document with BlockNote's collaboration
  extension, persisted through the backend. Retrofitting collaboration onto a custom block schema
  later would mean rebuilding the editor, so it lands with typed editing.
- **Presence, cursors and selections** from the same awareness channel, alongside comments.
- **Comments and suggestions** stored as their own records keyed by document id and anchor, not
  inside the portable specification (§14.8), and updated through the same real-time channel so a
  second reader sees a new thread appear.
- Decide early what happens to suggestions and comments whose anchor text is edited away — reanchor,
  orphan, or resolve. Concurrent editing makes this sharper, not softer: two people can edit the
  anchored text at once.

**Seeding a document.** Every write from outside the editor is whole-document replacement: initial
creation from the agent and an accepted proposal. One `toBlocks(document)` function serves both,
and no incremental external change is ever merged into live editor state. The pipeline is validate then seed:

```
DesignDocumentSchema.parse  →  checkDesignDocument  →  toBlocks  →  seed the Y.Doc, persist
```

Validation happens at the boundary, so a document that fails is a retry rather than a corrupted
Y.Doc. Seeding happens **exactly once, server-side**, at document creation: two clients that each
initialise the same empty Y.Doc produce two concurrent inserts of the whole document and Yjs merges
both. Clients sync into an already-populated document and never initialise an empty one. Because
seeding runs headless, block-to-ProseMirror conversion must work outside a browser — check whether
`@blocknote/server-util` covers it at 0.53 before planning to drive `prosemirror-model` directly.

## 6. Agent integration

- **Chat** docked in the document, always reachable, with **schema-bound context**: each context item
  is `{ ref, quote }` from the current selection, so the agent is asked about a typed element rather
  than loose text. The chip a person sees, and the wording the prompt carries, are labels rendered
  from the resolved element — that rendering lives in the view, not in the contracts package.
  **Mocked in this iteration** — build the surface, the context plumbing and both hand-offs against
  canned replies, and wire a real model afterwards. The prototype labels the panel `mock` for the
  same reason.
- **The agent emits `DesignDocument`**, a typed JSON object it can be constrained to, never a
  ProseMirror node tree or a Yjs update. Validation at the boundary turns its normal failure mode —
  inventing an `applicationServiceId` that names nothing — into a retry prompt rather than a
  corrupted document.
- **Comments address people only.** No agent mention: a comment thread is a human conversation. Ask
  the agent in chat instead.
- **What the user asked for is applied; what the user did not ask for is proposed.** A change the
  user requests in chat lands in the document directly — they initiated it, they are reading the
  result, and undo is the remedy. A change nobody asked for arrives as a **whole-document proposal**
  (specification §6.3–6.4): a re-analysis of the existing model, plus anything else the agent
  starts on its own. Proposals are reviewed and accepted whole. (Scan-driven triggers arrive with
  the codebase-delta feature, decision 52.)
- Consequently the agent never authors **suggestions**. Suggesting mode is the human review path:
  people propose wording to each other and accept or reject it individually.

## 7. Delivery phases

Each phase ends with something reviewable in the running app.

**Phase 1 — Model. Done.** The schema from section 3, `design-doc.ts` replaced in place, the
ref ↔ model-path mapping tested both directions over every addressable position in a fixture
document, and the whole-document integrity check. No UI. Beyond what this section originally
scoped, phase 1 also restored the technical vocabulary (§3.6), folded the application-service
record into `DesignedBuildingBlock`, and dropped the binding string form (§3.7). Derived codebase
state was delivered here and removed again when the codebase-delta feature was deferred
(decision 52).

**Phase 2 — Read-only document. Done.** Render a stored design document in the reading order, with
the table of contents, numbering, scroll-spy and the "not written yet" line. Viewing mode only. This
is the first thing to put in front of a product reviewer. As built: documents persist as validated
`DesignDocument` JSON on a `DesignDoc` graph node behind `/ui/design-docs` (boundary pipeline
`DesignDocumentSchema.parse → checkDesignDocument`, server-minted UUID); the documents view lists
the current project's documents and opens each in the reading view
(`components/design-doc/`). A "create sample document" endpoint seeds the shared-contracts fixture
so a reviewer has something to read before the agent exists. In phase 3 the Y.Doc becomes the
stored editing truth (decision 51) and this JSON column becomes the seed input / projection cache.

**Phase 3 — Typed collaborative editing. Done, with noted gaps.** BlockNote with the custom block
schema on a Yjs document: filtered block menu, constrained drag and drop, schema-aware deletion,
`toBlocks` seeding, and the `DesignDocument` projection for reads. Two browsers editing the same
document is the acceptance test for this phase; running `checkDesignDocument` over the projection is
how the projection is kept total.

As built: block configs, `toBlocks` and the `toDocument` projection live in
`@repo/design-doc-blocks`, shared by the frontend editor (React renders) and the backend's headless
schema (`design-doc-editor.server.ts`), so both sides produce the same document structure. Elements
attach to their owners through explicit props (`useCaseId`, `applicationServiceId`), never position.
The `/collab` surface embeds Hocuspocus in the backend process (decision 53, now accepted): session
cookie on the upgrade, Y.Doc state persisted as a `DesignDocState` node, seed-once at creation, and
the store hook refreshing the `DesignDocument` JSON column — now explicitly the projection cache.
The document route is one surface, as the prototype has it: always the collaborative editor, with
the table-of-contents rail permanently beside it — the outline (prototype numbering, scroll-spy,
click-to-jump) recomputed live from the editor's block list, so a renamed use case renames its TOC
entry as it is typed. The phase-2 static reading view was retired with this; a read-only Viewing
mode returned as editor-level state in phase 5 and was later dropped. Gherkin steps and example rows live
in the scenario block's `data` prop (ids included) behind a structured step editor.

The three gaps this phase left open are now closed. Drag and drop is constrained to same-group
siblings (the prototype's `data-group` rule): a capture-phase drop guard cancels any block drop
whose target under the pointer is not a block of the same reorder group — `blockGroup` from
`@repo/design-doc-blocks` on both ends — and also refuses foreign content dropped into the pane.
Paste is coerced through a `pasteHandler`: clipboard text lands as plain text in the typed block at
the caret, extra lines becoming sibling blocks of the same type (owner props carried over) where
the schema keeps a list, so paste can no longer produce `paragraph` blocks; BlockNote's own
clipboard format still round-trips typed blocks through the default handler. The "not written yet"
line renders inside the editor in both of the reading view's forms: an empty fixed section shows
its numbered heading with a quiet "Not written yet." anchored above the next section that has a
block (the first bounded context catches trailing ones, and the slash menu offers Goal while its
single block is absent), and each use case prints "Not written yet: …" below its last block for
the parts it does not hold. The fixed section headings (1 Goal … 5 Actors, with the
In/Out-of-scope labels) also render: they are drawn above whichever block currently opens each
section — a rendering concern over the model, not undeletable heading blocks.

**Phase 4 — Comments and presence. Done.** Threads sidebar, anchors as marks, filters, replies,
resolve, mentions of people, plus live presence and cursors on the awareness channel.

The build rides BlockNote's own comments feature rather than hand-rolling one (decision 55): the
`CommentsExtension` carries a comment mark in the shared fragment — the durable substring anchor
section 4 asks for — and threads live in a `threads` Y.Map inside the same Y.Doc through
`YjsThreadStore`, so sync and persistence come free from the existing `/collab` surface and store
hook. Four slices, each reviewable in the running app:

1. **Comments core.** `CommentsExtension` on the editor: a `YjsThreadStore` keyed by the account
   login over `provider.document.getMap('threads')`, with `DefaultThreadStoreAuth` in the `editor`
   role, and `resolveUsers` backed by a new `/ui/accounts` endpoint serving
   `{ id, name, avatarUrl }` from the `Account` nodes (the instance is invite-gated, so every
   account may comment). Add-comment enters through the formatting toolbar over a selection, with
   the floating composer and floating thread views. At creation the thread's `metadata` records the
   plan's anchor pair from section 3.8 — `{ elementId, quote }`, the enclosing block's id and the
   selected text — so a thread still names what it was about after its mark is edited away.
2. **Threads rail.** The right rail from section 1: `ThreadsSidebar` with the open/resolved/all
   filter and position sort, docked beside the document pane opposite the table of contents.
3. **Mentions.** People mentions inside comment bodies: a `mention` inline-content spec in the
   comment editor schema (the extension's `schema` option) with an `@` menu over the accounts
   list. Comments address people only — no agent mention (section 6). This slice carries the
   phase's verification risk: prove the comment composer accepts a custom inline-content schema
   and a suggestion menu before building the menu; the fallback is plain `@login` text.
4. **Presence.** Remote carets and selections already render from phase 3's awareness wiring; what
   is new is the who-is-here facepile in the document header, read from `awareness.getStates()`
   (name, avatar, cursor colour), updating as clients join and leave.

Acceptance is two browsers again: a comment created in one appears live in the other, resolve and
the sidebar filter round-trip, a mention renders as a chip, and both faces show in the header. The
anchor-durability risk (section 8) closes with this phase: element-id anchors were settled by the
model, and the mark plus the `{ elementId, quote }` metadata is the reanchoring story — an
orphaned mark degrades the thread to its element with the quote as evidence, never to a dangling
pointer.

As built, three integration findings beyond the slices. First, the **server's headless schema must
know the comment mark**: y-prosemirror deletes any Y node whose marks the reading schema cannot
construct, so running the projection over the live Y.Doc without the mark silently destroyed every
commented text run a few seconds after the comment was made — the headless editor now registers
`CommentsExtension` (with an inert thread store) for its mark alone. Second, the comment UI is
**opted out of BlockNote's default rendering** (`comments={false}`) and re-mounted through
mention-aware controllers: the shadcn `Comments` components read `ShadCNComponentsContext`, which
only a shadcn `BlockNoteView` provides, so the threads rail wraps its subtree in that provider
plus a `ComponentsContext` override whose comment editor adds the `@` suggestion menu. Third, the
rail mounts only after the provider's first sync — the sidebar's thread subscription caches its
first snapshot, and mounting before sync left it stuck on an empty list. Verified in the running
app end to end (create over a selection, mention chip, resolve, filter, orphaned thread showing
its quote, persistence across reload); the two-browser live pass rides the same channel phase 3
proved.

**Phase 5 — Suggestions. Done.** Suggesting mode, tracked marks, accept/reject writing through to
the model, and word-level narrowing — all under concurrent editing.

As built (decision 56): the build rides `@handlewithcare/prosemirror-suggest-changes` — the tracked-
changes library BlockNote's own xl-ai package uses — rather than the hand-rolled `Suggestion`
record. The three suggestion marks (`insertion`, `deletion`, `modification`) travel in the shared
fragment, so sync, persistence and concurrency come free from the `/collab` surface; the mark
definitions live in `@repo/design-doc-blocks/suggestion-marks` and are registered by the frontend
editor and the headless server schema from the same source (the phase-4 mark rule, made
structural). Suggesting is a local mode: the Editing / Suggesting toggle in the document
header drives `enableSuggestChanges` per client, with the dispatch wrap
minting `<accountId>:<nonce>` suggestion ids so authorship rides in the mark. The right rail merges
comments and suggestions into one document-order list, Google-Docs style: threads render through
BlockNote's own `Thread` component (the list shell replaces `ThreadsSidebar`, which cannot
interleave foreign items), suggestion cards carry author, Add/Delete text and accept/reject, plus
accept-all/reject-all; clicking marked text highlights its card and clicking a card scrolls to and
tints the marked text. The server
projection reverts pending suggestions before `toDocument`, so the `DesignDocument` cache is always
the accepted document; accepting writes through via the ordinary store hook. One limitation is
recorded in decision 56: Enter is inert while Suggesting, because the library's revert of a
block-opening split leaves the split behind — structural suggestions are slash-menu insertions and
drag-handle removals, which round-trip.

**Phase 6 — Agent surface, mocked. Dropped** (decision 57). Chat with schema-bound context applying
its changes directly, plus proposal review (impact summary, challenged decisions) and the
accept/reject flow for whole proposals — all against canned agent output, so both paths can be
exercised before a model is wired in.

**Phase 6b — Real agent. Dropped** (decision 57). Replace the canned replies with the model, keeping
the proposal contract unchanged.

The scanner-baseline phase that used to follow (delta markers from real scans, newer-scan
notification, refresh through a reconciled proposal) moved out of this iteration with the
codebase-delta feature (decision 52). The agent phases followed it out (decision 57): section 6
remains the design for when agent integration returns.

Phases 2–3 are the minimum for internal use; 4–5 make it reviewable together — and close this
iteration.

## 8. Risks

- **Anchor durability under concurrent editing.** Half of this is closed: an anchor points at an
  element by id, so editing the words inside a rule cannot detach a thread from it. What remains is
  the substring — a comment on "10 minutes" while someone else rewrites the sentence — which needs
  real marks carried in the shared document and a reanchoring story.
- **Projection totality.** If the Y.Doc can reach a state that does not project to a valid
  `DesignDocument`, the typed guarantee has already failed and the integrity check is catching what
  the ProseMirror schema should have prevented. Treat an integrity error found on the projection as
  a bug in the block schema, not as a document to repair.
- **Collaboration plus a custom block schema.** Yjs, custom BlockNote blocks and suggestion marks
  interact; prove the combination on one block type early rather than discovering it in phase 5.
- **Schema churn.** Every block type is a contract between editor, model and agent. Adding a
  building-block detail later is cheap; changing the field shape after content exists is not.
- **Document length.** Eight use cases read well. Sixty will not without collapsing, filtering or
  per-context routing — test with a medium document (specification §4) before phase 3 ends.
- **Direct application from chat.** Because chat changes are applied rather than proposed, the
  document must make them visible and reversible: show what changed after each request, and keep undo
  and version history within reach. Without that, "applied directly" reads as "changed behind my
  back".

## 9. Non-goals for the first implementation

The deferral table in section 2 is the list. Alongside it, the specification's own non-goals stand:
no BDD execution or test results, no field-by-field proposal acceptance, no additional lenses, no
architecture graph, no optimisation for enterprise-scale models, no technically immutable human
content, and no tablet or mobile editing.

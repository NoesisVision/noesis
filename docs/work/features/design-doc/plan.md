# Collaborative Design Document Workspace — implementation plan

**Status:** Agreed direction, ready to break into tasks
**Date:** 2026-08-16
**Basis:** [`prototypes/document-view.html`](prototypes/document-view.html), the specification in
[`design-doc.md`](design-doc.md), and decision 49 in `docs/decisions.md`.
**Supersedes:** the Stage 1 three-concept comparison (section 15 of the specification). Those
prototypes moved to [`prior-art/stage1/`](prior-art/README.md).

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
2. **Nothing loud.** Codebase-delta markers, provenance and completeness hints stay quieter than the
   content. Empty sections are named once at the end of a use case rather than printed as empty
   boxes.
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
| 9. Accessible New / Modified / Removed treatment     | `+ new`, `± modified`, `− removed` word-plus-glyph beside the name; Existing unmarked; never colour alone.                              |

Still open for this iteration: **5** (collaboration semantics while a proposal is pending), plus two
the prototype raised — what happens to a comment or suggestion whose anchor text is edited away, and
how a chat-applied change is shown and undone. Questions **7** and **8** are parked with the
features they belong to.

**Out of the first iteration.** The specification carries the whole product direction; this
iteration deliberately builds less. Not now:

| Deferred                                                                    | Why it can wait                                                                          |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Product/Technical lens (§2.1, §9.2)                                         | One typed field list already serves both audiences; the lens is designed next iteration. |
| Related building blocks and Interaction flow sections (§9.1 rows 9–10)      | They are the technical half of the lens.                                                 |
| Behaviour graph, scenario paths, sequence diagrams (§10.2, §12, §14.4–14.5) | Nothing in the document view reads or edits them; they arrive with the Technical lens.   |
| Visual canvas in every form (§8)                                            | The document replaced it as the primary surface.                                         |
| Dashboard landing and catalogue filters (§7.1–7.2)                          | The table of contents is the catalogue; a document list belongs to the app shell.        |
| Building-block behavioural scenarios (§11.1)                                | Acceptance scenarios are what the document shows.                                        |
| Agent mentions in comments (§3.2, §13)                                      | Comments are a human conversation; the agent is asked in chat.                           |

Keep the model lens-ready all the same: a lens must remain a pure presentation filter over the same
elements, so nothing in the schema or the editor may assume a single audience.

## 3. Model and schema work

All in `packages/shared-contracts/src/design-doc.ts` unless noted. Current shape is a tree of
`changeSetSchema(...)` wrappers; the target is a normalised accepted model with explicit baseline
references and overlays (specification §14.7).

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

`DesignedBehaviour` becomes a top-level `UseCase` with a stable id, one owning application-service
reference, Command/Query/Event type, **actor id references** (replacing `actor: string | null`),
and ownership of its rules, fields, scenarios and quality attributes.

### 3.4 One typed field list per direction

Replace the split product/technical representations with a single list, as the prototype does:

```ts
Field = { name: string; label: string; type: string; note?: string }
UseCase.input  = { fields: Field[] }
UseCase.output = { summary: string; fields: Field[] }
```

`label` is the business wording, `name`/`type` the structural truth, and only `name`, `type` and the
field set are baseline-comparable (decision 49).

### 3.5 Gherkin (§14.3)

Acceptance scenarios owned by use cases, with the full Gherkin hierarchy the document shows:
background, scenario, scenario outline, examples table, ordered steps and tags.

Behaviour relationships and scenario paths (§14.4–14.5) are **not** in this iteration — they exist to
feed interaction flow and sequence diagrams, which are deferred. Leave room for them (scenarios keep
stable ids) but do not model them yet.

### 3.6 Collaboration objects, kept outside the portable specification (§14.8)

```ts
Anchor     = { binding: string; quote: string }     // schema element + quoted text
Comment    = { id, anchor, author, role, body, resolved, replies[], createdAt }
Suggestion = { id, anchor, replacement, author, role, note, status: 'pending'|'accepted'|'rejected' }
```

`binding` is the string the prototype prints in `Schema bindings` mode. It must be derivable from,
and resolvable back to, a model path — that mapping is the contract between the editor and the
model, so define it once and test it both ways.

### 3.7 Baseline and proposal dimensions (§14.7, §14.9)

Codebase-relative state (`existing | new | modified | removed`) derived from baseline-comparable
fields only, scanner identity per element, active baseline scan id plus "newer scan available", and
proposal state kept as a separate dimension. Not collapsible into one flag.

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
| `useCaseHeading`   | `useCase[id]` (name, type badge, delta)       |
| `rule`             | `useCase[id].rules[]`                         |
| `fieldRow`         | `useCase[id].{input,output}.fields[]`         |
| `scenario`         | `acceptanceScenario[id]`                      |
| `qualityAttribute` | `useCase[id].qualityAttributes[]`             |

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
- **Marks** for comments and suggestions (BlockNote inline styles / custom marks), so anchors survive
  editing rather than being re-matched by text search as the prototype does.
- **Modes**: Editing / Suggesting / Viewing, the last two being editor-level (read-only, and
  edits captured as suggestion objects instead of document mutations).

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

## 6. Agent integration

- **Chat** docked in the document, always reachable, with **schema-bound context**: each context item
  is `{ binding, quote }` from the current selection, so the agent is asked about a typed element
  rather than loose text. **Mocked in this iteration** — build the surface, the context plumbing and
  both hand-offs against canned replies, and wire a real model afterwards. The prototype labels the
  panel `mock` for the same reason.
- **Comments address people only.** No agent mention: a comment thread is a human conversation. Ask
  the agent in chat instead.
- **What the user asked for is applied; what the user did not ask for is proposed.** A change the
  user requests in chat lands in the document directly — they initiated it, they are reading the
  result, and undo is the remedy. A change nobody asked for arrives as a **whole-document proposal**
  (specification §6.3–6.4): agent work triggered by an as-is model change — a new source-code scan,
  a baseline refresh, a re-analysis of the existing model — plus anything else the agent starts on
  its own. Proposals are reviewed and accepted whole.
- Consequently the agent never authors **suggestions**. Suggesting mode is the human review path:
  people propose wording to each other and accept or reject it individually.
- Baseline refresh reuses the proposal mechanism with three-way comparison (§14.9).

## 7. Delivery phases

Each phase ends with something reviewable in the running app.

**Phase 1 — Model.** Schema changes from section 3, migration of the existing `design-doc.ts`, and
the binding ↔ model-path mapping with tests both directions. No UI.

**Phase 2 — Read-only document.** Render a stored design document in the reading order, with the
table of contents, numbering, scroll-spy, delta markers and the "not written yet" line. Viewing mode
only. This is the first thing to put in front of a product reviewer.

**Phase 3 — Typed collaborative editing.** BlockNote with the custom block schema on a Yjs document:
filtered block menu, constrained drag and drop, schema-aware deletion, and persistence of edits into
the model. Two browsers editing the same document is the acceptance test for this phase.

**Phase 4 — Comments and presence.** Threads sidebar, anchors as marks, filters, replies, resolve,
mentions of people, plus live presence and cursors on the awareness channel.

**Phase 5 — Suggestions.** Suggesting mode, tracked marks, accept/reject writing through to the
model, and word-level narrowing — all under concurrent editing.

**Phase 6 — Agent surface, mocked.** Chat with schema-bound context applying its changes directly,
plus proposal review (impact summary, challenged decisions) and the accept/reject flow for whole
proposals — all against canned agent output, so both paths can be exercised before a model is wired
in.

**Phase 6b — Real agent.** Replace the canned replies with the model, keeping the proposal contract
unchanged.

**Phase 7 — Scanner baseline.** Baseline comparison producing the delta markers from real scans,
newer-scan notification, and explicit refresh through a reconciled proposal.

Phases 2–3 are the minimum for internal use; 4–5 make it reviewable together; 6–7 close the loop
with agents and the codebase.

## 8. Risks

- **Anchor durability under concurrent editing.** Comments and suggestions must survive edits to the
  text they point at, including edits made by someone else at the same moment. The prototype matches
  text; production needs real marks carried in the shared document and a reanchoring story.
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
